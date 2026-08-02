---
sidebar_position: 3
title: 数据库表结构
---

# 数据库表结构

本文档描述当前 Live OS 数据表。任何 model 或 migration 变化，都必须同步更新本文档。

当前物理数据库由 `DATABASE_URL` 或本地 env 文件配置：

```text
.env
DATABASE_URL=mysql://用户名:URL编码后的密码@主机:3306/数据库名?charset=utf8mb4
```

## 命名规则

- 表名使用 `core_` 前缀。
- 主键使用 contracts 中的业务 ID，例如 `mem-0001`、`task-0001`。
- 面向 contract 的字段名尽量贴近 JSON payload。
- JSON 字段只用于 v0.1 中确实需要弹性的 metadata、模拟画像、风险指标等。

## core_member

成员权威记录。Django `User` 只负责登录账号；`Member` 才是大苹果的授权主体。成员身份类型、是否虚拟成员和单个 `role_id` 字段已删除；当前有效的直接角色事实由 `RoleAssignment` 表示。已注册但没有有效守约者资格的成员是“贡献者”这一派生状态，不创建基础角色任命。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 数据库内部主键。 |
| `member_no` | string unique | 是 | 稳定业务编号，例如 `mem-0001`。 |
| `user_id` | fk | 否 | 关联 Django 登录用户。 |
| `display_name` | string | 否 | 显示名称。 |
| `status` | enum string | 是 | 成员准入和生命周期状态。 |
| `batch_id` | string | 否 | 准入批次或模拟批次。 |
| `joined_simulation_day` | integer | 否 | 模拟中进入据点的日期。 |
| `credit_floor` | integer | 是 | 该成员类别允许的最低积分。 |
| `profile` | json | 是 | 模拟画像，例如疲劳值、满意度、技能等。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `metadata` | json | 是 | 扩展对象。 |

常用成员状态包括 `active`、`pending_training`、`pending_review`、`admitted`、`application_rejected`、`suspended`、`exited`。`pending_review` / `application_rejected` 账号只能进入最小报名工作台，业务权限仍由成员状态和角色权限共同限制。

## Auth/Admin 权限边界

Django `User` 仍只负责技术登录和 Admin 入口控制：`is_active` 控制账号是否可用，`is_staff` 控制是否可进入 Django Admin，`is_superuser` 是技术 root / 初始化 / 救急账号。日常治理人员不应被批量设置为 superuser。

大苹果业务权限由 `AuthorizationService` / OpenFGA 计算，权威事实主路径是 `User -> Member -> RoleAssignment -> RolePermission -> Permission`。直接角色事实只有守约者、执衡者和典守者；临时或有期限的职责通过 `end_at` 表达。具体权限必须来自 `RolePermission` 投影出的 OpenFGA 授权，不能以显示标签或 Django 技术账号标记作为放行依据。

普通 world 的典守者账号推荐为 `is_active=True`、`is_staff=False`、`is_superuser=False`，并拥有有效 `Member`、`RoleAssignment` 和对应 `Permission`。`grant_maintainer` 只创建或复用典守者任命，不会修改 `is_staff` 或 `is_superuser`；真实和仿真 world 不暴露 `/admin/`，业务维护账号不需要 Django staff 权限。

成员是否虚拟不再是成员字段，而由当前世界实例类型决定：`WORLD_INSTANCE_TYPE=simulation` 时 actor 输出为 `virtual_member`，`WORLD_INSTANCE_TYPE=real` 时 actor 输出为 `human_member`。当前默认值是 `simulation`。

## core_member_public_profile

公开展示资料表，不是权限来源。成员资格、职责和专业资格必须从 `RoleAssignment`、`MemberProfessionalQualification` 与权限服务动态计算，不能手填。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `member_id` | FK | 关联 Member (OneToOne) |
| `public_name` | string | 公开显示名，优先于 display_name |
| `avatar_key` | string | 系统生成的当前头像私有对象 key；为空时使用默认头像，不允许由表单直接填写。 |
| `avatar_sha256` | string | 处理后 WebP 的 SHA-256，仅用于一致性检查，不进入公开 URL。 |
| `avatar_size` | integer nullable | 处理后 WebP 的字节数；使用默认头像时为空。 |
| `avatar_updated_at` | datetime nullable | 当前头像最后成功切换或移除的时间。 |
| `bio` | text | 公开简介 |
| `is_visible` | boolean | 遗留兼容字段；当前 Observer 不把它作为公开资料开关。无论其值为何，公开主页仍按 `public_name → display_name → member_no` 的顺序选择姓名，并在存在当前头像时展示头像。 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

头像是可替换的当前展示资产，不是永久审计附件。系统不保存原始文件名、原图或历史头像；替换流程在新对象和数据库引用成功后删除旧对象。头像对象、临时上传和未来永久附件使用分离的 world 存储前缀，头像清理不得访问永久附件前缀。

## core_member_application

MemberApplication stores public member applications. Member applications are submitted through `/workspace/apply/` (login required). Registration at `/register/` creates the login account and baseline `Member`; formal admission is decided by governance proposal execution via `/workspace/apply/`.

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `application_id` | string pk | 是 | 成员报名 ID。 |
| `applicant_name` | string | 是 | 报名人名称。 |
| `contact` | string | 是 | 联系方式。 |
| `motivation` | text | 是 | 报名动机。 |
| `availability_hours_per_week` | integer | 是 | 历史兼容字段；当前表单用可参与时段表达投入时间。 |
| `role_gap` | string | 否 | 报名时选择的申请方向 `CredentialTemplate.code`。新提交只能选择 `CredentialTemplate.metadata.recruitment.show_on_application=true` 的模板 code，例如 `company_legal_representative`、`finance_responsible_person`、`ai_engineer`、`life_service`。`MemberApplication.metadata` 保存申请时快照：`role_gap_label`、`role_gap_description`、`role_gap_required_count`、`role_gap_current_count`、`role_gap_missing_count`、`role_gap_credential_template_code`。申请通过后不会自动发放所选方向 Credential，也不会自动授予对应 Role。 |
| `availability_slots` | json | 是 | 可参与时段数组，例如 `any_time`、`off_hours`、`weekend`；`any_time` 与其它时段互斥。 |
| `capability_scores` | json | 是 | 历史兼容和仿真字段；当前个人报名页不再展示能力自述输入。 |
| `can_issue_responsibility_documents` | boolean | 是 | 历史兼容字段；当前个人报名页固定为否，责任文件能力由合作方/机构报名承担。 |
| `document_authority_domains` | json | 是 | 历史兼容字段；当前个人报名页不再采集责任文件领域。 |
| `status` | enum string | 是 | `submitted`、`admission_voting`、`admitted`、`rejected`、`withdrew`。旧状态 `under_review`/`candidate`/`standby` 已迁移到 `admission_voting`。 |
| `requested_member_no` | string | 否 | 期望成员编号；仿真会写入稳定候选编号。 |
| `account_user_id` | fk | 否 | 成员报名时创建或复用的登录账号；提交后绑定到最小权限成员身份。 |
| `linked_member_id` | fk | 否 | 提交后创建或复用的最小权限 `Member`。 |
| `dynamic_answers` | json | 是 | 动态 textarea 问答数组，元素包含 `key`、`label`、`type`、`answer`。 |
| `frozen_at` | datetime | 否 | 报名提交并二次确认的时间；业务入口不提供提交后的撤回或修改。 |
| `admission_proposal_id` | fk | 否 | 接纳该申请者为守约者的提案。 |
| `decided_by_id` | fk | 否 | 决议人（执行准入或提案拒绝的典守者）。 |
| `submitted_at` | datetime | 是 | 提交时间。 |
| `decided_at` | datetime | 否 | 决议时间（准入执行或拒绝的时间）。 |
| `metadata` | json | 是 | 扩展数据；仿真会写入 `simulation_run_id`、`simulation_hour`、`driver_mode` 和 `external_ref`。 |

提交会创建登录账号、创建或复用最小 `Member`、自动创建 `member_admission` 提案，并追加 `member_application_submitted` 统一事件。已注册但尚未取得守约者资格的成员显示为贡献者，不创建同名角色。正式接纳经关联提案投票并执行完成后，才把报名状态改为 `admitted`、把成员状态改为 `admitted` 并授予守约者任命；选民必须同时具有有效守约者资格和执衡者任期。准入执行或提案拒绝会追加 `member_application_reviewed` 统一事件。

## core_partner_application

PartnerApplication stores partner applications from suppliers, institutions, professionals, and other service or responsibility-file providers. `/apply/partner/` has been removed; partner/supplier system will be designed separately. Zero-start simulation submits partner records through `core.application_services.submit_partner_application` service adapter.

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `application_id` | string pk | 是 | 合作方报名 ID。 |
| `organization_name` | string | 是 | 合作方名称。 |
| `contact_name` | string | 是 | 联系人。 |
| `contact` | string | 是 | 联系方式。 |
| `service_domains` | json | 是 | 服务、能力或资质领域。 |
| `can_issue_responsibility_documents` | boolean | 是 | 是否能出具可归档、可追责、可作为决策依据的书面文件。 |
| `responsibility_document_domains` | json | 是 | 可签署或盖章承担责任的文件领域。 |
| `qualification_summary` | text | 否 | 资质说明。 |
| `quote_summary` | text | 否 | 报价说明。 |
| `service_area` | string | 否 | 服务地区。 |
| `delivery_cycle_days` | integer | 否 | 交付周期天数。 |
| `constraints` | text | 否 | 限制条件。 |
| `status` | enum string | 是 | `submitted`、`under_review`、`qualified`、`standby`、`rejected`、`withdrew`。 |
| `reviewed_by_id` | fk | 否 | 审核人。 |
| `submitted_at` | datetime | 是 | 提交时间。 |
| `reviewed_at` | datetime | 否 | 审核时间。 |
| `metadata` | json | 是 | 扩展数据；仿真会写入 `simulation_run_id`、`simulation_hour`、`driver_mode` 和 `external_ref`。 |

提交会追加 `partner_application_submitted` 统一事件；审核会追加 `partner_application_reviewed` 统一事件。第一版不单独创建 `Partner` 主数据表，合作方池先由申请表承载；只有已审核且能出具责任文件的合作方才可覆盖启动门槛中的文件签署方需求。

## core_organization

治理组织容器，只表达容器和层级。组织不再保存类型；治理含义由角色、角色任命和角色权限表达。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `name` | string | 是 | 组织名称。 |
| `role_catalog_key` | string | 否 | 唯一稳定目录标识；仅“成员资格与职责”规范角色目录使用，其他组织留空。 |
| `parent_id` | fk self | 否 | 上级组织。 |
| `status` | enum string | 是 | `active`、`inactive`、`archived`。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

## core_role

组织下的角色，例如电工、仓库典守者、安全委员。只有带 `role_catalog_key=member-role-catalog` 的成员资格与职责目录才承载三项可直接记录的规范角色：守约者、执衡者、典守者；其他组织即使使用同名角色，也不能形成规范成员资格或职责。贡献者、匿名访问和守约者申请分别是派生参与状态或流程状态，不是角色。真实世界和仿真世界使用同一套角色语义，是否仿真只由当前 world / actor 上下文表达，不创建单独的仿真角色。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `organization_id` | fk | 是 | 所属组织。 |
| `name` | string | 是 | 角色名称。 |
| `description` | text | 否 | 角色说明。 |
| `status` | enum string | 是 | `active`、`inactive`、`retired`。 |
| `appointment_electorate_role_id` | fk self | 否 | 任命此角色时由哪个角色参与表决。 |
| `appointment_required_percent` | integer | 是 | 任命通过比例，50 表示过半，100 表示全票通过。 |
| `appointment_deadline_days` | integer | 是 | 默认任命表决截止天数。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

约束：同一组织下 `name` 唯一。

## core_permission

领域治理权限定义，独立于 Django 内置 model permission。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `code` | string unique | 是 | 权限代码，例如 `access.warehouse`。 |
| `name` | string | 是 | 权限名称。 |
| `category` | string | 是 | 权限分类，例如 `access`、`grant`、`view`。 |
| `description` | text | 否 | 权限说明。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

基础维护和财务权限由 `python manage.py init_maintainer_permissions --world-id realworld` 幂等初始化：

| code | 说明 |
| --- | --- |
| `governance.view_admin` | 允许访问治理和运营维护入口。 |
| `governance.manage_people` | 允许维护成员治理主体。 |
| `governance.manage_organizations` | 允许维护治理组织容器。 |
| `governance.manage_roles` | 允许维护角色和任命。 |
| `governance.manage_permissions` | 允许维护权限定义和角色权限绑定。 |
| `governance.view_event_ledger` | 允许查看只追加统一事件账本。 |
| `finance.review` | 允许审核成员提交的报销申请。 |
| `finance.pay` | 允许将已批准报销标记为已付款并生成财务流水。 |
| `finance.view_private` | 预留权限：允许查看非公开财务凭证或隐私材料。 |

初始化命令会创建或复用典守者及财务权限所需的目录项，并通过 `core_role_permission` 绑定明确能力。它不会自动批量授权成员；需要维护或财务权限的成员必须通过规范任命或专业资格流程获得相应授权。

可以用 `python manage.py grant_maintainer --world-id realworld --username <username>` 或 `--world-id realworld --member-no <member_no>` 把一个已有且有效的守约者任命为典守者。该命令不会自动授予守约者资格，也不会创建执衡者任期或投票权；重复执行不会重复创建 active `RoleAssignment`。运行时启用 world 数据库路由后，直接执行必须显式传入 `--world-id`。

## core_role_assignment

成员被任命到角色的记录。撤销时更新状态，不删除记录。成员可以同时拥有多个 active 角色；同一成员不应重复拥有同一个 active 角色。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `member_id` | fk | 是 | 被任命成员。 |
| `role_id` | fk | 是 | 角色。 |
| `status` | enum string | 是 | `active`、`revoked`、`suspended`、`expired`。 |
| `start_at` | datetime | 是 | 开始时间。 |
| `end_at` | datetime | 是 | 结束时间；所有角色任命必须有结束时间。 |
| `granted_by_id` | fk | 否 | 任命人。 |
| `revoked_by_id` | fk | 否 | 卸任处理人。 |
| `source_type` | enum string | 是 | 来源类型：`direct`、`self_application`、`proposal`、`initialization`、`system`。 |
| `source_proposal_id` | fk | 否 | 如果该任命由提案执行产生，关联来源提案。 |
| `source_proposal_execution_id` | fk | 否 | 如果该任命由提案执行产生，关联具体执行记录。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

新增记录会追加一次 `role_assigned` 统一事件；状态从 `active` 变为 `revoked` 时追加一次 `role_revoked` 统一事件。普通字段编辑不会重复追加任命或卸任事件。事件 payload 会包含 `source_type`、`source_proposal_id` 和 `source_proposal_execution_id`，用于区分直接任命、本人申请、提案执行、初始化或系统规则产生的任命。执衡者只能由有效守约者本人申请，任期为一年且不会自动续任；典守者是独立职责，不会自动创建执衡者任期。

## core_professional_domain

专业事务可引用的专业领域目录。领域代码是稳定标识，只有启用状态的领域可以用于新的专业事务提案。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | string unique | 稳定领域代码。 |
| `name` | string | 中文领域名称。 |
| `description` | text | 领域说明。 |
| `status` | enum string | `active` 或 `archived`。 |
| `created_at` / `updated_at` | datetime | 记录创建与更新时间。 |

## core_member_professional_qualification

成员专业资格的权威事实。资格由具备 `governance.manage_professional_qualifications` 权限的典守者录入或撤销；系统只记录外部确认结果，不实现面试、考试或评估流程。资格不是角色，也不自动赋予典守者职责。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `member_id` | fk | 取得资格的成员。 |
| `domain_id` | fk | 对应专业领域。 |
| `status` | enum string | `active`、`revoked` 或 `expired`。 |
| `external_confirmation_source` | string | 外部确认来源。 |
| `confirmed_by_id` / `confirmed_at` | fk / datetime | 确认人和确认时间。 |
| `valid_from` / `valid_until` | datetime | 生效与失效时间；失效时间可为空。 |
| `revoked_by_id` / `revoked_at` | fk / datetime | 撤销处理人和撤销时间。 |
| `notes` | text | 补充备注。 |

运行时只有当前有效的专业资格才能参与对应领域的专业事务投票。

## core_proposal

通用治理提案。成员准入和角色任命都不保留平行表决结构，分别使用 `proposal_type=member_admission` 和 `proposal_type=role_appointment`。后续规则、政策、预算、项目、声明等也复用同一套 `Proposal -> ProposalVote -> ProposalExecution -> SystemEvent` 流程。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `proposal_no` | string unique | 是 | 可读提案编号，例如 `0001`。 |
| `title` | string | 是 | 提案标题。 |
| `body` | text | 否 | 提案正文。 |
| `proposal_type` | enum string | 是 | `member_admission`、`role_appointment`、`role_revocation`、`rule`、`policy`、`budget`、`project`、`statement`。 |
| `status` | enum string | 是 | `draft`、`voting`、`passed`、`failed`、`cancelled`、`executed`。 |
| `proposer_member_id` | fk | 否 | 提案人。 |
| `proposer_role_assignment_id` | fk | 否 | 提案时角色身份；后台会按已选择的提案人过滤为该成员拥有的角色任命。 |
| `organization_id` | fk | 否 | 提案所属组织。 |
| `electorate_rule_version_id` | fk | 是 | 创建提案时固定的选民规则版本。 |
| `electorate_rule_snapshot_json` | json | 是 | 规范化后的条件树、模板标识、版本和开放参数。 |
| `professional_domain_id` | fk | 否 | 专业事务规则指定的启用中专业领域，必须与规则参数一致。 |
| `eligible_voters_snapshot_json` | json | 是 | 提案开始时冻结的投票资格成员快照。 |
| `pass_ratio` | integer | 是 | 通过所需赞成比例，1 到 100；`50` 表示严格超过 50%，例如 2 人需 2 票、4 人需 3 票。 |
| `quorum_count` | integer | 是 | 最低参与人数。 |
| `allow_vote_change` | boolean | 是 | 截止前是否允许改票。 |
| `start_at` | datetime | 是 | 投票开始时间。 |
| `deadline_at` | datetime | 是 | 投票截止时间。 |
| `passed_at` | datetime | 否 | 通过时间。 |
| `failed_at` | datetime | 否 | 失败时间。 |
| `cancelled_at` | datetime | 否 | 取消时间。 |
| `executed_at` | datetime | 否 | 执行完成时间。 |
| `payload_json` | json | 是 | 提案业务载荷。 |
| `result_json` | json | 是 | 投票统计与结果。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

规则模板由 `core_electorate_rule_template` 和不可变的 `core_electorate_rule_version` 表达，`core_proposal_type_electorate_rule` 限制每种提案类型允许使用的模板和最低条件。社区共议允许贡献者参与；守约事务要求守约者和执衡者；专业事务再要求对应专业资格；典守事务只选择典守者。成员资格、任期、专业资格和用户状态会在投票时重新校验，因此快照不能绕过之后失效的授权。

## core_electorate_rule_template / core_electorate_rule_version

规则模板保存稳定 `code`、中文名称和启用状态；规则版本保存版本号、只含 `ALL`、`ANY`、`NOT` 与封闭选择器的 `condition_json`，以及开放参数约束。已被提案引用的版本不可原地改写，制度变化必须新增版本。

## core_proposal_type_electorate_rule

显式声明提案类型允许使用的规则模板以及不可删除的最低条件。提案发起人只能选择允许模板和模板开放参数，不能提交原始条件树。

`role_appointment` 的 `payload_json` 至少包含内部 `target_member_id`、可读 `target_member_no`、`role_id`、`assignment_type`、`resource_id`、`scope_json`、`reason`、`start_at`、`end_at`。提案通过后不会直接创建任命，必须执行 `ProposalExecution(action_type=create_role_assignment)` 后才创建 `RoleAssignment`。

## core_proposal_vote

提案投票记录。同一 `proposal_id`、`voter_member_id` 只能有一张当前票；如果 `allow_vote_change=True` 且未到 `deadline_at`，允许改票并记录 `proposal_vote_changed` 事件。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `proposal_id` | fk | 是 | 提案。 |
| `voter_member_id` | fk | 是 | 投票成员。 |
| `voter_role_assignment_id` | fk | 否 | 投票时使用的角色任命。 |
| `choice` | enum string | 是 | `yes`、`no`、`abstain`。通用提案支持三种选择；`member_admission` 的 workspace 投票入口只允许 `yes`/`no`，反对票必须填写 `reason`。 |
| `reason` | text | 否 | 投票理由。 |
| `voted_at` | datetime | 是 | 投票或改票时间。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

约束：同一 `proposal_id`、`voter_member_id` 唯一。快照用于记录开票时的选民范围，但投票时仍必须由 `AuthorizationService` 重新验证当前资格，避免已失效成员继续投票。人工 workspace 投票要求成员可登录：成员需绑定 active `User`，或存在 active `User.username == Member.member_no` 的兼容登录账号。

## core_proposal_execution

提案执行记录。提案通过不等于执行完成；执行结果和错误信息由本表记录。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `proposal_id` | fk | 是 | 被执行的提案。 |
| `executor_member_id` | fk | 否 | 执行人。 |
| `executor_role_assignment_id` | fk | 否 | 执行人使用的角色任命。 |
| `action_type` | enum string | 是 | `admit_member_application`、`create_role_assignment`、`revoke_role_assignment`、`create_rule`、`create_policy`、`record_statement`、`manual`。 |
| `status` | enum string | 是 | `pending`、`succeeded`、`failed`、`skipped`。 |
| `payload_json` | json | 是 | 执行载荷。 |
| `result_json` | json | 是 | 执行结果。 |
| `error_message` | text | 否 | 执行失败原因。 |
| `executed_at` | datetime | 否 | 执行时间。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

第一版重点支持 `member_admission` 提案通过后的 `admit_member_application` 执行，以及 `role_appointment` 提案通过后的 `create_role_assignment` 执行，并保持幂等：同一个已执行提案不会重复创建 active `RoleAssignment`。
## core_role_permission

角色和领域权限的绑定。日常后台中，管理员主要从角色详情页理解“角色拥有哪些能力”；`Permission` 是系统判断所需的能力明细。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `role_id` | fk | 是 | 角色。 |
| `permission_id` | fk | 是 | 权限。 |
| `scope` | string | 是 | 简单作用域，默认 `global`。 |
| `constraints_json` | json | 是 | 简单约束，例如 `resource_id` 或 `resource_ids`。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

约束：同一 `role_id`、`permission_id`、`scope` 唯一。

## core_system_event

统一事件账本。只追加，不作为普通可编辑日志使用；第一版通过 `core.event_ledger.append_event()` 统一分配 `seq`、计算 `payload_hash`、`prev_hash` 和 `event_hash`。

系统不再拆分“治理事件账本”“提案事件账本”“积分事件账本”“任务事件账本”“申诉事件账本”等多套哈希链。提案、投票、执行、角色任命、角色撤销、任务生命周期、申诉生命周期、资源调整、报销提交、财务审核、财务付款、积分获得、积分扣减、积分调整、积分冲正和系统初始化等关键事实都进入同一条可校验链。业务表仍然存在：`Proposal`、`ProposalVote`、`ProposalExecution`、`RoleAssignment`、`Task`、`Dispute`、`Resource`、`ExpenseClaim`、`FinanceReview`、`FinanceTransaction`、`LedgerEntry` 负责结构化状态、查询、校验和后台维护；`SystemEvent` 负责全局顺序、责任追溯、业务快照和篡改可发现。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | integer pk | 是 | 内部主键。 |
| `seq` | integer unique | 是 | 单调递增系统事件序号。 |
| `event_type` | enum string | 是 | `member_created`、`member_application_submitted`、`member_application_reviewed`、`partner_application_submitted`、`partner_application_reviewed`、`role_assigned`、`role_revoked`、`proposal_created`、`proposal_vote_cast`、`proposal_vote_changed`、`proposal_passed`、`proposal_failed`、`proposal_cancelled`、`proposal_executed`、`task_created`、`task_published`、`task_assigned`、`task_claimed`、`task_submitted`、`task_reviewed`、`task_closed`、`dispute_created`、`dispute_review_started`、`dispute_resolved`、`resource_adjusted`、`credit_earned`、`credit_deducted`、`credit_adjusted`、`credit_reversed`、`system_initialized`。 |
| `aggregate_type` | string | 是 | 聚合类型，例如 `RoleAssignment`。 |
| `aggregate_id` | string | 是 | 聚合记录 ID（内部关联查询字段，不进入 v2 公开 event_hash）。 |
| `actor_member_id` | fk | 否 | 行为人。 |
| `actor_role_assignment_id` | fk | 否 | 行为人使用的角色任命。 |
| `payload_json` | json | 是 | 事件快照。 |
| `payload_hash` | string | 是 | `payload_json` 的规范化 SHA-256 哈希。 |
| `prev_hash` | string | 否 | 上一条系统事件的 `event_hash`。 |
| `event_hash` | string unique | 是 | 当前事件哈希。 |
| `occurred_at` | datetime | 是 | 事件发生时间。 |
| `created_at` | datetime | 是 | 记录创建时间。 |

v2（当前规范，schema = `liveos.system-event.public.v1`）：

`payload_json` 本身为公开可验证结构，包含 `subject`、`action`、`stage`、`summary`、`public_facts`、`private_commitments`。`payload_hash` = SHA-256(canonical_json(payload_json))。`event_hash` = SHA-256(canonical_json(event_hash_input_v2))，其中 event_hash_input_v2 包含 `seq`、`event_type`、`aggregate_type`、`subject_ref`、`payload_hash`、`prev_hash`；`subject_ref` 来源于 `payload_json.subject.ref`，不使用内部 `aggregate_id`/`actor_member_id`/`actor_role_assignment_id`。

历史 v1：旧记录使用旧 hash 输入（含 `aggregate_id`、`actor_member_id`、`actor_role_assignment_id`）。`core.event_ledger.verify_event_chain()` 按 `seq` 遍历，根据 `payload_json.schema` 自动选择 v2 或 v1 算法校验。旧格式事件可能显示校验不通过。

当前 MySQL 哈希链是应用层篡改可发现机制，不是绝对不可篡改存证；它没有外部锚定，也没有数据库存储过程强制保护。Django model/admin 会阻止普通新增和修改历史事件，但数据库级写入或 ORM `update()` 仍可绕过保护，绕过后的不一致应通过 `verify_event_chain()` 被发现。错误不能通过改写历史 `SystemEvent` 修复，只能追加新的撤销、冲正或更正事件。

## 治理权限判断

`AuthorizationService` 是当前运行时权限判断入口。Django 的 `Member`、`RoleAssignment`、`RolePermission`、`Permission` 仍是权威事实来源；OpenFGA 是授权计算引擎。正常 runtime 使用 OpenFGA check 回答“某成员能否执行某操作”，不能在 view、API、后台任务或业务 service 中重新拼接角色表查询。

OpenFGA tuple 由 `openfga_rebuild_tuples` 从 Django 权威数据完整重建。投影时只纳入 active 成员、active 角色、active 且仍在任期内的 `RoleAssignment`，并保留 `SUSPENDED` / `EXITED` 成员 veto。`governance.*` 和 `finance.*` 这类高信任权限会投影为 guarded permission，必须同时满足守约者资格、未冻结和具体角色权限。

`core.access.user_has_governance_permission(user, permission_code, resource=None, at_time=None)` 是治理入口函数。它根据用户关联的 `Member` 调用 `AuthorizationService`；没有绑定 `governance.*` 权限的基础角色不能进入治理入口。财务入口同理通过 `is_finance_reviewer()` / `is_finance_payer()` 进入 `AuthorizationService`，不使用 Django `is_staff` / `is_superuser`。

传入 `resource` 时必须做对象级授权。`resource=None` 只回答“成员是否在任一资源范围拥有该权限”；传入具体 `Resource` 时才回答“成员是否能对这个资源执行该权限”。`RolePermission.constraints_json.resource_id` / `resource_ids` 会在 OpenFGA rebuild 时投影为具体资源 permission object；`scope=global`、`scope=all` 或空 scope 会投影为全局资源授权。资源级入口不能用 `resource=None` 的结果替代具体对象判断。

`core.permission_services.legacy_member_has_permission()` 和 `members_with_permission()` 只作为 legacy 对照、probe 和兼容层保留。业务入口不应直接调用它们。

Django Admin 当前只在 control plane 暴露，并提供关系化底层维护入口：`Member` 详情页内联显示和新增 `RoleAssignment`，`Organization` 详情页内联显示 `Role`，`Role` 详情页内联显示 `RolePermission` 和拥有该角色的成员。`Proposal` 用于查看和维护通用治理提案，详情页内联显示 `ProposalVote` 和 `ProposalExecution`。固定 world 站点不暴露 `/admin/`；真实世界和仿真世界的日常用户系统不需要 `is_staff` 账号。`SystemEvent` 和 `LedgerEntry` 集中在“技术审计与配置”分组；其中 `SystemEvent` 在 Admin 中仍然只读，只用于查看事件快照和哈希链信息。

`SimulationSnapshot`、`SimulationSnapshotItem`、`SimulationRunDisposition` 和仿真实验后台入口位于 control plane `/admin/` 的“仿真”分组。实验后台只保留启动、推进、run 审阅、中止、归档和废弃这类独有动作。业务 `Event` 不注册到 Django Admin；固定 world API 和 `/` 负责展示它。`Ruleset` 变更应通过提案或专门规则发布流程完成，`CapacityAssessment` 归属观察台摘要，`Permission` / `RolePermission` 主要通过角色详情页维护。

## core_ruleset

规则版本记录。`Ruleset` 是 world 业务数据，不是 control DB 的全局配置；真实世界和每个仿真世界都在各自 world 数据库中保留自己的 `core_ruleset` 数据。后续规则变更应通过提案或专门规则发布流程创建新版本。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ruleset_id` | string pk | 是 | 稳定 ID。 |
| `version` | string unique | 是 | 例如 `ruleset-v0.1.0`。 |
| `status` | enum string | 是 | `draft`、`active`、`retired`。 |
| `effective_from` | date | 是 | 开始生效日期。 |
| `effective_to` | date | 否 | 退役或失效日期。 |
| `negative_point_floor` | json | 是 | 各成员类别的积分下限。 |
| `task_point_rules` | json | 是 | 任务基础分和系数规则。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `created_by` | json | 是 | 对该规则版本负责的 ActorRef。 |
| `change_summary` | text | 是 | 规则变化说明。 |
| `metadata` | json | 是 | 扩展对象。工程类节点可在这里声明 `required_responsibility_closures` 和已取得的 `responsibility_documents`。 |

## core_project_plan

项目执行计划总表。它是主线任务线的数据库源头，不使用 Markdown 作为权威记录。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `plan_id` | string pk | 是 | 稳定计划 ID，例如 `plan-bigapple001`。 |
| `name` | string | 是 | 计划名称，例如 `bigapple001据点执行计划`。 |
| `status` | enum string | 是 | `draft`、`active`、`archived`。 |
| `description` | text | 否 | 计划说明。 |
| `target_location` | string | 否 | 目标地点。 |
| `owner` | json | 是 | 计划责任人 ActorRef。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_plan_revision

项目执行计划版本。模拟运行后续应绑定具体版本，避免计划编辑污染历史模拟结果。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `revision_id` | string pk | 是 | 稳定版本 ID。 |
| `plan_id` | fk | 是 | 所属执行计划。 |
| `revision_code` | string | 是 | 计划内唯一版本号。 |
| `status` | enum string | 是 | `draft`、`published`、`retired`。 |
| `title` | string | 是 | 版本标题。 |
| `change_summary` | text | 是 | 变更说明。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `created_by` | json | 是 | 创建人 ActorRef。 |
| `published_at` | datetime | 否 | 发布时间。 |
| `metadata` | json | 是 | 扩展对象。 |

约束：同一 `plan_id` 下 `revision_code` 唯一。

## core_plan_node

项目执行计划节点。可表示阶段、里程碑、工程包、运营包、治理节点、招募节点、抵达节点、容量门槛和扩容节点。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `node_id` | string pk | 是 | 稳定节点 ID。 |
| `revision_id` | fk | 是 | 所属计划版本。 |
| `parent_id` | fk self | 否 | 上级节点。 |
| `sequence` | integer | 是 | 排序。 |
| `code` | string | 是 | 人类可读节点编号，例如 `B1`。 |
| `title` | string | 是 | 节点标题。 |
| `node_type` | enum string | 是 | `stage`、`milestone`、`work_package`、`operations`、`governance`、`recruitment`、`arrival`、`capacity_gate`、`expansion`。 |
| `status` | enum string | 是 | `planned`、`in_progress`、`blocked`、`completed`、`cancelled`。 |
| `is_required` | boolean | 是 | 是否必要节点。 |
| `is_expandable` | boolean | 是 | 是否可分阶段扩容。 |
| `allow_simulation_adjustment` | boolean | 是 | 是否允许模拟提出调整建议。 |
| `description` | text | 否 | 节点说明。 |
| `planned_start_day` | integer | 否 | 计划开始模拟日。 |
| `planned_duration_days` | integer | 是 | 计划工期天数。 |
| `planned_end_day` | integer | 否 | 计划完成模拟日。 |
| `estimated_cost_low` | decimal | 是 | 低估成本。 |
| `estimated_cost_expected` | decimal | 是 | 预期成本。 |
| `estimated_cost_high` | decimal | 是 | 高估成本。 |
| `required_people_min` | integer | 是 | 最低人数。 |
| `required_people_max` | integer | 是 | 建议人数。 |
| `required_person_days` | decimal | 是 | 预计人天。 |
| `required_skills` | json | 是 | 所需技能。 |
| `required_resources` | json | 是 | 所需资源。 |
| `completion_criteria` | json | 是 | 完成标准。 |
| `risk_notes` | text | 否 | 风险说明。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_plan_dependency

计划节点依赖。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dependency_id` | string pk | 是 | 稳定依赖 ID。 |
| `revision_id` | fk | 是 | 所属计划版本。 |
| `node_id` | fk | 是 | 后续节点。 |
| `depends_on_id` | fk | 是 | 前置节点。 |
| `dependency_type` | enum string | 是 | `finish_to_start`、`resource_gate`、`capacity_gate`、`governance_approval`、`recruitment_threshold`。 |
| `description` | text | 否 | 依赖说明。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_plan_requirement

计划节点需求明细，用于记录预算、人力、技能、材料、设备、空间、许可和容量需求。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `requirement_id` | string pk | 是 | 稳定需求 ID。 |
| `node_id` | fk | 是 | 所属计划节点。 |
| `resource_id` | fk | 否 | 对应 `core_resource`。当需求可以对应库存台账中的资源时填写，用于计算缺口和匹配报价。 |
| `requirement_type` | enum string | 是 | `budget`、`labor`、`skill`、`material`、`equipment`、`space`、`permit`、`capacity`。 |
| `name` | string | 是 | 需求名称。 |
| `quantity` | decimal | 是 | 数量。 |
| `unit` | string | 否 | 单位。 |
| `unit_cost` | decimal | 是 | 单价。 |
| `total_cost_estimate` | decimal | 是 | 总成本估算。 |
| `is_must` | boolean | 是 | 是否刚性需求。 |
| `notes` | text | 否 | 说明。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_plan_capacity_impact

计划节点完成后的容量影响。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `impact_id` | string pk | 是 | 稳定容量影响 ID。 |
| `node_id` | fk | 是 | 所属计划节点。 |
| `impact_type` | enum string | 是 | `member_capacity`、`bed_slots`、`canteen_meals_per_day`、`pv_mw`、`electricity_kwh_per_day`、`storage_cubic_meter`、`office_square_meter`、`recreation_square_meter`、`hospitality_rooms`。 |
| `delta` | decimal | 是 | 容量变化量。 |
| `unit` | string | 是 | 单位。 |
| `description` | text | 否 | 说明。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_simulation_run

一次基于计划版本的自动模拟运行。它记录模拟的输入快照和最终状态，不直接修改计划版本。运行隔离由当前 world 数据库提供，不再通过独立的仿真世界表二次分层。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `run_id` | string pk | 是 | 稳定模拟运行 ID。 |
| `plan_revision_id` | fk | 是 | 本次模拟绑定的计划版本。 |
| `status` | enum string | 是 | `draft`、`running`、`failed`、`completed`、`paused`、`aborted`。 |
| `current_day` | integer | 是 | 当前推进到的模拟日期。 |
| `max_turns` | integer | 是 | 本次运行允许的最大推进步数。 |
| `started_at` | datetime | 是 | 开始时间。 |
| `ended_at` | datetime | 否 | 结束、失败或暂停时间。 |
| `failure_summary` | text | 否 | 最近一次阻断性失败摘要。 |
| `metadata` | json | 是 | 输入快照，例如初始预算、剩余预算、可用人数、可用技能和平均疲劳值。 |

## core_plan_node_run_state

某个计划节点在一次模拟运行中的实际状态。它不改变 `core_plan_node.status`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `state_id` | string pk | 是 | 稳定节点运行状态 ID。 |
| `run_id` | fk | 是 | 所属模拟运行。 |
| `plan_node_id` | fk | 是 | 对应计划节点。 |
| `status` | enum string | 是 | `pending`、`running`、`blocked`、`failed`、`completed`、`skipped`。 |
| `started_day` | integer | 否 | 该节点在本次模拟中的开始日。 |
| `completed_day` | integer | 否 | 该节点在本次模拟中的完成日。 |
| `progress_percent` | decimal | 是 | 0-100 进度百分比。 |
| `actual_cost` | decimal | 是 | 本次模拟计入的实际成本。 |
| `actual_person_days` | decimal | 是 | 本次模拟计入的人天。 |
| `blocker_reason` | text | 否 | 失败或阻塞原因。 |
| `metadata` | json | 是 | 扩展对象，例如完成后剩余预算或失败类型。 |

约束：同一 `run_id` 和 `plan_node_id` 只能有一条状态。

## core_simulation_turn

自动模拟推进日志，用于观察台按文字 MUD 方式回放。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `turn_id` | string pk | 是 | 稳定推进日志 ID。 |
| `run_id` | fk | 是 | 所属模拟运行。 |
| `turn_number` | integer | 是 | 本次运行内的推进序号。 |
| `simulation_day` | integer | 是 | 该日志对应的模拟日期。 |
| `summary` | text | 是 | 人类可读摘要。 |
| `occurred_at` | datetime | 是 | 发生时间。 |
| `metadata` | json | 是 | 标题、严重程度、事件类型和相关对象。 |

约束：同一 `run_id` 下 `turn_number` 唯一。

## core_simulation_failure

自动模拟失败记录，用于说明当前计划为什么在某个节点走不通。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `failure_id` | string pk | 是 | 稳定失败 ID。 |
| `run_id` | fk | 是 | 所属模拟运行。 |
| `plan_node_id` | fk | 否 | 失败关联的计划节点。 |
| `failure_type` | enum string | 是 | `budget_unrealistic`、`labor_shortage`、`skill_shortage`、`resource_shortage`、`dependency_unmet`、`personnel_issue`、`execution_issue`、`responsibility_closure_missing`。 |
| `severity` | enum string | 是 | `warning`、`critical`。 |
| `title` | string | 是 | 失败标题。 |
| `description` | text | 是 | 失败说明。 |
| `simulation_day` | integer | 是 | 失败发生的模拟日期。 |
| `detected_at` | datetime | 是 | 发现时间。 |
| `metadata` | json | 是 | 结构化失败细节，例如缺口预算、缺失技能、未完成依赖或缺失责任闭环文件。 |

## core_plan_revision_proposal

由模拟失败生成、等待人工审核的计划修订建议。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `proposal_id` | string pk | 是 | 稳定建议 ID。 |
| `run_id` | fk | 是 | 来源模拟运行。 |
| `source_failure_id` | fk | 否 | 来源失败。 |
| `plan_revision_id` | fk | 是 | 建议基于哪个计划版本提出。 |
| `plan_node_id` | fk | 否 | 建议关联的计划节点。 |
| `proposal_type` | enum string | 是 | `adjust_budget`、`adjust_duration`、`add_dependency`、`add_node`、`reduce_admission`、`add_requirement`、`change_capacity`。 |
| `status` | enum string | 是 | `draft`、`reviewed`、`accepted`、`rejected`。 |
| `title` | string | 是 | 建议标题。 |
| `rationale` | text | 是 | 建议依据，通常来自失败说明。 |
| `suggested_changes` | json | 是 | 结构化建议变更，例如补充技能、增加前置节点、补足预算或补齐工程责任主体与责任文件。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `metadata` | json | 是 | 扩展对象。 |

重要规则：`core_plan_revision_proposal` 只是建议，不是计划变更本身。采纳建议后应生成或更新计划版本，并保留人工审核责任人。

## core_plan_change_set

由计划修订建议生成的结构化计划数据补丁。它把建议拆成一组可审核操作，但仍不直接修改当前计划版本。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `change_set_id` | string pk | 是 | 稳定变更集 ID。 |
| `run_id` | fk | 是 | 来源模拟运行。 |
| `proposal_id` | fk | 是 | 来源计划修订建议。 |
| `plan_revision_id` | fk | 是 | 被建议修改的源计划版本。 |
| `status` | enum string | 是 | `draft`、`reviewed`、`accepted`、`rejected`、`applied`。 |
| `title` | string | 是 | 变更集标题。 |
| `summary` | text | 是 | 变更集摘要。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `reviewed_at` | datetime | 否 | 审阅时间。 |
| `applied_at` | datetime | 否 | 应用时间。 |
| `applied_revision_id` | fk | 否 | 如果已经应用，指向生成并发布为下一轮基线的新计划版本。 |
| `metadata` | json | 是 | 扩展对象。 |

重要规则：`core_plan_change_set` 是计划变更草案，不是已生效计划。人工采纳后，`simulation.plan_application.apply_plan_change_set()` 会在事务中复制源 `PlanRevision` 及其 `PlanNode`、`PlanDependency`、`PlanRequirement`、`PlanCapacityImpact`，再把变更操作应用到新版本上。仿真实验后台会以 `publish=True` 调用该服务，把新版本发布为下一轮基线，并退役同一计划下旧的已发布版本。应用成功后写入 `status=applied`、`applied_at` 和 `applied_revision_id`；重复应用同一变更集必须返回已生成版本，不得再创建新版本。应用失败时事务回滚，不应留下半成品计划版本。

## core_plan_change_operation

计划变更集中的单条结构化操作，描述未来如何修改计划数据库对象。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `operation_id` | string pk | 是 | 稳定操作 ID。 |
| `change_set_id` | fk | 是 | 所属变更集。 |
| `sequence` | integer | 是 | 变更集内排序。 |
| `operation_type` | enum string | 是 | `add_node`、`update_node_field`、`add_dependency`、`add_requirement`、`add_capacity_impact`、`reduce_admission`、`add_preparation`、`note`。 |
| `target_model` | string | 是 | 目标模型名称，例如 `PlanNode`、`PlanDependency`、`PlanRequirement`。 |
| `target_id` | string | 否 | 目标记录 ID。新增操作可为空。 |
| `target_field` | string | 否 | 目标字段名。新增操作可为空。 |
| `old_value` | json | 是 | 旧值或旧状态。 |
| `new_value` | json | 是 | 建议新值或新增对象 payload。 |
| `rationale` | text | 是 | 操作依据。 |
| `is_required` | boolean | 是 | 是否为必要操作。 |
| `metadata` | json | 是 | 扩展对象。 |

约束：同一 `change_set_id` 下 `sequence` 唯一。

重要规则：操作是声明式数据 patch。创建操作不会自动写入 `core_plan_node`、`core_plan_dependency` 或 `core_plan_requirement`。当前应用服务支持 `add_node`、`add_preparation`、`add_dependency`、`add_requirement`、`add_capacity_impact`、`update_node_field`、`reduce_admission` 和 `note`；其中 `note` 只记录应用说明，`reduce_admission` 先沉淀到新版本 metadata，后续可继续结构化。

零起点仿真生成的 `add_requirement` 会在 `new_value.metadata.requirement_kind` 中区分两类启动门槛：`capability` 表示成员或合作方需要具备实际能力，例如做饭、资料整理、采购询价；`document` 表示必须取得可归档、可追责、可作为决策依据的书面文件和签署方，例如结构报告、电气并网方案、施工安全方案或验收归档资料。

## core_simulation_snapshot

仿真快照索引，保存在 control DB 中，用于长期查询某次仿真归档。原始数据不直接塞进该表，而是写入 `raw_archive_path` 指向的不可变归档包。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `snapshot_id` | string pk | 是 | 稳定快照 ID。 |
| `title` | string | 是 | 快照标题。 |
| `simulation_round` | integer | 否 | 仿真轮次。正式历史中同一 world 递增，用于表达第几轮仿真。 |
| `scenario` | string | 否 | 仿真场景，例如 `zero_start`。 |
| `purpose` | text | 否 | 本轮仿真目的。 |
| `hypothesis` | text | 否 | 本轮仿真假设。 |
| `parameter_summary` | json | 是 | 关键参数摘要。 |
| `public_title` | string | 否 | 公开档案馆标题；为空时使用内部标题或失败标题。 |
| `public_summary` | text | 否 | 公开档案馆摘要；为空时由失败类型生成。 |
| `review_conclusion` | text | 否 | 人工复盘结论。 |
| `next_run_basis` | text | 否 | 下一轮仿真的依据和应调整方向。 |
| `publication_status` | string | 是 | `public`、`internal`、`hidden`。Observer 公开档案只展示 `public`。 |
| `source_world_id` | string | 是 | 来源仿真 world。 |
| `source_world_type` | string | 是 | 来源 world 类型。 |
| `source_database_alias` | string | 是 | 实际读取的数据库 alias。测试关闭路由时可能为 `default`。 |
| `source_database_name` | string | 否 | 来源数据库名。 |
| `source_run_id` | string | 是 | 来源 `SimulationRun.run_id`。同一个 world/run 只能归档一次。 |
| `plan_revision_id` | string | 否 | 来源计划版本。 |
| `run_status` | string | 是 | 运行最终状态。 |
| `failure_type` | string | 否 | 首个失败类型，便于快速筛选。 |
| `failure_title` | string | 否 | 首个失败标题。 |
| `snapshot_schema_version` | integer | 是 | 标准化快照结构版本。 |
| `status` | string | 是 | 当前为 `archived`。 |
| `raw_archive_path` | string | 是 | 原始归档目录。 |
| `raw_archive_hash` | string | 是 | 原始 raw 文件清单的稳定哈希；逐文件内容仍由 manifest 中的 SHA-256 校验。 |
| `report_path` | string | 否 | 预渲染报告路径。 |
| `raw_table_counts` | json | 是 | 原始归档逐模型记录数。 |
| `normalized_summary` | json | 是 | 查询和展示用标准化摘要。 |
| `code_version` | string | 否 | 归档时 Git commit。 |
| `archived_at` | datetime | 是 | 归档时间。 |
| `metadata` | json | 是 | 扩展对象，例如 manifest 路径、raw 格式版本和 raw 范围。 |

## core_simulation_run_disposition

仿真运行处置记录，保存在 control DB 中。它不是 Django Admin 的通用操作日志，而是某一轮仿真能否进入历史的业务结论。所有已结束的仿真 run 在开始下一轮前必须被人工处置：要么归档为 `SimulationSnapshot`，要么明确放弃归档并写明原因。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `disposition_id` | string pk | 是 | 稳定处置记录 ID。 |
| `source_world_id` | string | 是 | 来源仿真 world。 |
| `source_world_type` | string | 是 | 来源 world 类型。 |
| `source_database_alias` | string | 是 | 来源数据库 alias。 |
| `source_database_name` | string | 否 | 来源数据库名。 |
| `source_run_id` | string | 是 | 来源 `SimulationRun.run_id`。同一个 world/run 只能有一条处置记录。 |
| `run_status` | string | 是 | run 结束状态。 |
| `run_started_at` | datetime | 否 | run 开始时间。 |
| `run_ended_at` | datetime | 否 | run 结束时间。 |
| `simulation_round` | integer | 是 | 仿真轮次；归档和放弃都会占用正式轮次。 |
| `scenario` | string | 否 | 仿真场景。 |
| `disposition` | enum string | 是 | `archived` 或 `discarded`。 |
| `reason` | text | 是 | 归档或放弃归档的原因。 |
| `decided_by` | string | 否 | 处置人或命令来源。 |
| `decided_at` | datetime | 是 | 处置时间。 |
| `snapshot_id` | fk | 否 | `archived` 时关联的 `SimulationSnapshot`。 |
| `metadata` | json | 是 | 扩展对象。 |

约束：同一 `source_world_id`、`source_run_id` 唯一。记录创建后不可通过普通 model/admin 修改。Django Admin 自带 `LogEntry` 仍记录 `/admin/` 技术操作；本表记录仿真生命周期的正式业务结论，覆盖命令行归档、命令行放弃和未来 lab 页面操作。

## core_simulation_snapshot_item

仿真快照明细索引。它不是原始全量数据，而是从原始归档和 run 关系中抽取出的可查询条目。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `item_id` | string pk | 是 | 稳定明细 ID。 |
| `snapshot_id` | fk | 是 | 所属快照。 |
| `item_type` | string | 是 | `run`、`node_state`、`turn`、`failure`、`event`、`proposal`、`change_set`、`change_operation` 等。 |
| `source_model` | string | 是 | 来源模型名。 |
| `source_pk` | string | 否 | 来源主键。 |
| `title` | string | 否 | 展示标题。 |
| `summary` | text | 否 | 摘要。 |
| `sort_order` | integer | 是 | 快照内排序。 |
| `payload_json` | json | 是 | 标准化内容。 |

## core_task

可领取、可提交、可验收的劳动任务。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `task_id` | string pk | 是 | 稳定 contract ID。 |
| `title` | string | 是 | 人类可读任务标题。 |
| `task_type` | enum string | 是 | `cooking`、`dishwashing`、`public_cleaning` 等。 |
| `status` | enum string | 是 | `draft`、`open`、`claimed`、`in_progress`、`pending_review`、`accepted`、`rejected`、`disputed`、`closed`、`reversed`。 |
| `standard_minutes` | positive integer | 是 | 完成任务所需的标准整数分钟数。 |
| `base_points` | integer | 是 | 基础积分。 |
| `role_coefficient` | decimal | 是 | 规则系数。 |
| `physical_load` | decimal | 否 | 0-100 体力负担。 |
| `dirty_level` | decimal | 否 | 0-100 脏累程度。 |
| `psychological_load` | decimal | 否 | 0-100 心理负担。 |
| `urgency` | decimal | 否 | 0-100 紧急度。 |
| `can_be_delayed` | boolean | 是 | 是否允许延期。 |
| `requires_review` | boolean | 是 | 是否需要验收。 |
| `failure_consequence` | enum string | 否 | `low`、`medium`、`high`、`critical`。 |
| `assignee_member_id` | fk | 否 | 当前领取任务的成员。 |
| `plan_node_id` | fk | 否 | 该任务服务于哪个主线计划节点；为空表示临时运营任务。 |
| `source_type` | enum string | 是 | 来源类型：`direct`、`proposal`、`plan`、`simulation`、`system`。 |
| `source_proposal_id` | fk | 否 | 如果该任务由提案执行产生，关联来源提案。 |
| `source_proposal_execution_id` | fk | 否 | 如果该任务由提案执行产生，关联具体执行记录。 |
| `rule_version` | string | 是 | 创建或验收任务时使用的规则版本。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `due_at` | datetime | 否 | 截止时间。 |
| `submitted_at` | datetime | 否 | 提交时间。 |
| `reviewed_at` | datetime | 否 | 验收时间。 |
| `metadata` | json | 是 | 劳动说明、证据引用和扩展数据。 |

状态说明：

| 状态 | 含义 |
| --- | --- |
| `draft` | 运营后台已创建草稿，尚未开放给成员。 |
| `open` | 已发布，成员可以领取，运营人员也可以指派。 |
| `claimed` | 已绑定负责人，等待成员执行或提交。 |
| `in_progress` | 成员正在执行。 |
| `pending_review` | 成员已提交劳动记录，等待运营或典守者验收。 |
| `accepted` | 验收通过，通常已经产生贡献积分流水。 |
| `rejected` | 验收驳回，需要成员重新处理或发起申诉。 |
| `disputed` | 任务进入争议流程。 |
| `closed` | 未进入成员履约链路前由运营人员关闭，不应产生积分流水。 |
| `reversed` | 历史任务被冲正或撤销，通常需要和账本冲正、事件记录配套使用。 |

任务本身不保存独立哈希字段，也不维护自己的哈希链。正式任务生命周期应通过 `core.tasks.authoring.create_task_draft()`、`publish_task()`、`assign_task()`、`close_task()`，`core.tasks.member_workflow.claim_task()`、`submit_labor()`，以及 `core.tasks.review.review_task()` 完成，并追加 `task_*` 类型 `SystemEvent`；多个 `SystemEvent` 通过 `aggregate_type = "Task"` 和 `aggregate_id = task_id` 关联同一个任务。任务来源字段（`source_type`、`source_proposal_id`、`source_proposal_execution_id`）保存在 `Task` 结构化字段中。当前 v2 SystemEvent `public_facts` 公开 `title`、`task_type`、`status`、可选 `assignee_label`、`plan_node_id`，以及 allowlist extra（`action_type`/`accepted`）。内部来源提案/执行 ID 不作为公开 payload 保证字段。

## core_ledger_entry

只追加的积分账本。积分余额必须从流水推导，不能直接修改余额代替流水。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `ledger_entry_id` | string pk | 是 | 稳定 contract ID。 |
| `member_id` | fk | 是 | 积分变化归属成员。 |
| `amount` | integer | 是 | 有符号积分变化。 |
| `entry_type` | enum string | 是 | `contribution`、`consumption`、`penalty`、`compensation`、`correction`、`reversal`。 |
| `reason` | text | 是 | 人类可读原因。 |
| `related_task_id` | fk | 否 | 关联任务。 |
| `related_event_id` | string | 否 | 关联事件。 |
| `rule_version` | string | 是 | 使用的规则版本。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `created_by` | json | 是 | 创建该流水的 ActorRef。 |
| `reviewer` | json | 是 | 相关验收人 ActorRef。 |
| `status` | enum string | 是 | `posted`、`pending_review`、`reversed`。 |
| `reverses_entry_id` | fk self | 否 | 被冲正或撤销的流水。 |
| `system_event_id` | fk | 否 | 对应的统一事件账本记录；新的正式服务写入应自动填充。 |
| `metadata` | json | 是 | 扩展对象。 |

重要规则：不能通过修改或删除已入账流水来修正错误。错误必须通过新的 `correction` 或 `reversal` 流水处理。正式创建流水应通过 `core.ledger_services.create_ledger_entry()`；冲正应通过 `core.ledger_services.reverse_ledger_entry()`，两者都会追加 `SystemEvent`。成员当前积分由 `posted` 流水汇总得到；如未来增加余额缓存，该缓存也必须能由流水重建。积分流水自己的 `immutable_sequence` 和 `core_ledger_sequence` 已删除，审计顺序统一使用关联的 `SystemEvent.seq`。

## core_resource

当前资源主档和库存缓存。`current_stock` 便于页面查询和预警判断；库存变化的历史事实由 `core_resource_transaction` 只追加记录，并关联统一事件账本。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `resource_id` | string pk | 是 | 稳定 ID。 |
| `name` | string | 否 | 资源名称，例如 `一号仓库`。 |
| `resource_type` | enum string | 是 | `facility`、`room`、`system`、`material`、`equipment`、`grain`、`water`、`beds` 等。 |
| `location` | string | 否 | 资源位置。 |
| `description` | text | 否 | 资源说明。 |
| `status` | enum string | 是 | `active`、`inactive`、`maintenance`、`retired`。 |
| `unit` | enum string | 是 | `kg`、`bag`、`liter`、`kwh`、`yuan`、`count`、`slot`、`cubic_meter`。 |
| `current_stock` | decimal | 是 | 当前库存。 |
| `daily_consumption_estimate` | decimal | 是 | 预计每日消耗。 |
| `replenishment_method` | enum string | 是 | `purchase`、`donation`、`production`、`reuse`、`manual_adjustment`。 |
| `loss_rate` | decimal | 是 | 0-1 损耗率。 |
| `warning_threshold` | decimal | 是 | 预警线。 |
| `shortage_impact` | json | 是 | 资源短缺对满意度、冲突、任务完成率等的影响。 |
| `updated_at` | datetime | 是 | 更新时间。 |
| `rule_version` | string | 是 | 规则版本。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_supplier_quote

合作方对某一资源的供给报价。第一版直接关联 `PartnerApplication`，不单独建立完整供应商库；审核通过或备用的合作方报价可用于资源缺口匹配。它不是采购订单，也不代表已经定标或签约。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `quote_id` | string pk | 是 | 稳定报价 ID。 |
| `partner_application_id` | fk | 是 | 报价来源合作方报名。 |
| `resource_id` | fk | 是 | 可供应资源。 |
| `unit_price` | decimal | 是 | 单价。 |
| `currency` | string | 是 | 币种，默认 `CNY`。 |
| `available_quantity` | decimal | 是 | 可供数量。 |
| `minimum_order_quantity` | decimal | 是 | 最小起订量。 |
| `lead_time_days` | integer | 是 | 交付周期天数。 |
| `quality_grade` | enum string | 是 | `unknown`、`low_risk`、`standard`、`high_quality`、`risky`。 |
| `quality_summary` | text | 否 | 质量说明。 |
| `valid_from` | datetime | 否 | 有效开始。 |
| `valid_until` | datetime | 否 | 有效截止。 |
| `status` | enum string | 是 | `draft`、`active`、`expired`、`rejected`。 |
| `notes` | text | 否 | 备注。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |
| `metadata` | json | 是 | 扩展对象。 |

资源运营页通过 `core.resource_matching.resource_gap_rows()` 汇总已发布计划的 `PlanRequirement.resource`、当前 `Resource.current_stock` 和有效 `SupplierQuote`，展示计划需求、库存缺口、报价覆盖和最低报价。该计算只读，不创建采购单，不调整库存。

运营资源调整会写入 `metadata.last_adjustment`，当前结构为：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source` | string | 固定为 `control_resource_adjustment`。 |
| `operator` | ActorRef object | 记录执行操作的典守者。 |
| `reason` | string | 人类可读调整或处置原因。 |
| `delta` | string decimal | 本次库存变动数量，正数为补充，负数为扣减，`0` 为仅记录处置说明。 |
| `old_stock` | string decimal | 调整前库存。 |
| `new_stock` | string decimal | 调整后库存。 |
| `recorded_at` | datetime string | 调整记录时间。 |

## core_resource_transaction

库存流水。每次通过 `core.resource_services.record_resource_adjustment()` 调整库存时都会追加一条流水，并关联同一次 `resource_adjusted` 统一事件账本记录。该表用于回答“库存为什么变化、谁操作、变动前后是多少”；不应通过 Admin 直接新增、修改或删除历史流水。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `transaction_id` | string pk | 是 | 稳定库存流水 ID。 |
| `resource_id` | fk | 是 | 被调整资源。 |
| `transaction_type` | enum string | 是 | `inbound`、`outbound`、`stocktake_adjustment`、`loss`、`scrap`、`transfer`、`manual_adjustment`。 |
| `quantity_delta` | decimal | 是 | 库存变动数量，正数入库，负数出库或消耗，0 表示仅记录状态或处置。 |
| `stock_before` | decimal | 是 | 变动前库存。 |
| `stock_after` | decimal | 是 | 变动后库存。 |
| `reason` | text | 是 | 人类可读原因。 |
| `operator` | json | 是 | 操作人 ActorRef。 |
| `related_task_id` | fk | 否 | 关联任务。 |
| `related_supplier_quote_id` | fk | 否 | 关联供应商报价。 |
| `system_event_id` | fk | 否 | 对应统一事件账本记录。 |
| `occurred_at` | datetime | 是 | 发生时间。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_communityfeedback

公开反馈 / 公众参与层记录。它不是提案，不直接改变权威状态；典守者可以回应、隐藏或关联到正式提案。反馈生命周期只写普通公开 `core_event`，不写 `core_system_event` 哈希链。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `feedback_id` | string unique | 是 | 稳定业务 ID，如 `feedback-xxxxxxxxxxxx`。 |
| `author_member_id` | fk | 是 | 提交反馈的成员。 |
| `title` | string | 是 | 反馈标题。 |
| `category` | enum string | 是 | `question`、`suggestion`、`concern`、`proposal_seed`、`other`。 |
| `body` | text | 是 | 反馈正文，纯文本。 |
| `status` | enum string | 是 | `open`、`acknowledged`、`answered`、`linked`、`closed`、`hidden`。 |
| `official_response` | text | 否 | 典守者公开回应。 |
| `responded_by_id` | fk | 否 | 最近一次回应或处理反馈的典守者。 |
| `responded_at` | datetime | 否 | 最近一次回应或处理时间。 |
| `linked_proposal_id` | fk | 否 | 由该反馈转入的正式治理提案。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

公开规则：`hidden` 不进入公开列表和首页；提交、回应、关联提案会写普通公开 `Event`。隐藏不会写新的公开 Event，并会把该反馈既有公开 Event 转为 internal，避免放大违规内容。运行时权限仍由 `RoleAssignment` / `RolePermission` 判断，Feedback 不授予权限。

## core_expenseclaim

成员报销申请。它记录“谁为项目花了多少钱、用途是什么、当前处理状态如何”。报销本身不是提案；只有高影响预算、异常争议或财务规则变更才需要升级为 Proposal。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `claim_id` | string unique | 是 | 稳定业务 ID，如 `expense-claim-xxxxxxxxxxxx`。 |
| `claimant_member_id` | fk | 是 | 报销申请人。 |
| `title` | string | 是 | 报销标题。 |
| `description` | text | 否 | 支出用途和背景说明。 |
| `amount` | decimal | 是 | 报销金额，保存为两位小数。 |
| `currency` | string | 是 | 货币代码，默认 `CNY`。 |
| `expense_date` | date | 是 | 支出发生日期。 |
| `vendor` | string | 否 | 供应商或收款方名称。 |
| `category` | enum string | 是 | `server`、`ai_usage`、`software`、`operations`、`other`。 |
| `status` | enum string | 是 | `submitted`、`under_review`、`approved`、`rejected`、`paid`、`withdrawn`。 |
| `public_note` | text | 否 | 可公开展示的补充说明。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

提交必须通过 `core.finance_services.submit_expense_claim()`。任何非 `SUSPENDED` / `EXITED` 的注册成员都可以提交。提交会写普通公开 `Event` 和 `expense_claim_submitted` 统一事件。

## core_financereview

报销审核记录。每次审核都会新增一条记录，不通过修改申请历史来表达审核事实。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `review_id` | string unique | 是 | 稳定业务 ID，如 `finance-review-xxxxxxxxxxxx`。 |
| `claim_id` | fk | 是 | 被审核的报销申请。 |
| `reviewer_member_id` | fk | 是 | 审核人。 |
| `decision` | enum string | 是 | `approved` 或 `rejected`。 |
| `reason` | text | 否 | 审核理由；拒绝时必须填写。 |
| `reviewed_at` | datetime | 是 | 审核时间。 |

审核必须通过 `core.finance_services.review_expense_claim()`。审核人必须拥有 `finance.review` 权限，不能审核自己的报销；审核后会更新 `ExpenseClaim.status`，并写普通公开 `Event` 和 `expense_claim_reviewed` 统一事件。

## core_financetransaction

只追加公开财务流水。当前主要由已批准报销的付款动作产生，后续收入、普通支出和冲正也复用该表。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `transaction_id` | string unique | 是 | 稳定业务 ID，如 `finance-tx-xxxxxxxxxxxx`。 |
| `claim_id` | fk | 否 | 关联报销；收入或通用支出可为空。 |
| `transaction_type` | enum string | 是 | `reimbursement`、`income`、`expense`、`correction`。 |
| `amount` | decimal | 是 | 流水金额。 |
| `currency` | string | 是 | 货币代码。 |
| `direction` | enum string | 是 | `in` 或 `out`。 |
| `summary` | string | 是 | 流水摘要。 |
| `occurred_at` | datetime | 是 | 发生时间。 |
| `recorded_by_id` | fk | 否 | 记录人。 |
| `metadata` | json | 是 | 扩展数据。 |
| `created_at` | datetime | 是 | 创建时间。 |

付款必须通过 `core.finance_services.mark_expense_claim_paid()`。记录人必须拥有 `finance.pay` 权限，不能给自己的报销标记付款；只有 `approved` 报销可以付款。`FinanceTransaction` 不允许修改历史记录，错误应通过后续 `correction` 流水表达。付款会写普通公开 `Event` 和 `expense_claim_paid` 统一事件。

## core_event

可回放业务事件流。该表服务于 API 和 observer，不注册到 Django Admin；它不是统一哈希账本，审计顺序和篡改检测由 `core_system_event` 负责。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `event_id` | string pk | 是 | 稳定 ID。 |
| `event_type` | enum string | 是 | `task`、`ledger`、`resource`、`dispute`、`capacity` 等。 |
| `simulation_day` | integer | 是 | 可回放的模拟日期。 |
| `simulation_run_id` | fk | 否 | 仿真生成事件所属的模拟运行；真实世界事件为空。 |
| `severity` | enum string | 是 | `info`、`warning`、`critical`。 |
| `title` | string | 是 | 短标题。 |
| `summary` | text | 是 | 公开或内部摘要。 |
| `involved_member_ids` | json array | 是 | 涉及成员业务编号列表，不强制 FK。 |
| `related_task_id` | fk | 否 | 关联任务。 |
| `related_dispute_id` | string | 否 | 关联申诉。 |
| `occurred_at` | datetime | 是 | 发生时间。 |
| `generated_by` | enum string | 是 | `live_os`、`simulation_engine`、`human_operator`。 |
| `visibility` | enum string | 是 | `public`、`internal`、`private`。 |
| `payload` | json | 是 | 结构化扩展数据。 |

约束：`generated_by = simulation_engine` 的事件必须绑定 `simulation_run_id`。`payload.run_id` 仍保留为对外事件数据的一部分，但数据库查询和隔离判断应优先使用结构化外键。

资源调整会追加两类事件：`SystemEvent(event_type = resource_adjusted, aggregate_type = Resource)` 进入统一哈希账本；`Event(event_type = resource)` 进入可回放业务事件流，用于观察台和运营页面展示。

业务 Event(event_type=resource) payload 当前包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `resource_id` | string | 被调整资源。 |
| `transaction_id` | string | 对应库存流水。 |
| `resource_type` | string | 资源类型。 |
| `unit` | string | 单位。 |
| `old_stock` | string decimal | 调整前库存。 |
| `delta` | string decimal | 变动数量。 |
| `new_stock` | string decimal | 调整后库存。 |
| `warning_threshold` | string decimal | 预警线。 |
| `is_warning` | boolean | 调整后是否仍低于或等于预警线。 |
| `replenishment_method` | string | 本次记录使用的补充方式。 |
| `reason` | string | 操作原因。 |
| `operator` | ActorRef object | 执行操作的典守者。 |

SystemEvent(event_type=resource_adjusted) v2 `public_facts` 公开：`name`、`resource_type`、`unit`、`delta`、`is_warning`、`transaction_id`。`old_stock`/`new_stock`/`warning_threshold`/`reason_raw`/`actor` 只记录为 `private_commitments`，不公开原值。

申诉处理会追加 `event_type = dispute` 的内部事件。其 `payload` 当前包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action` | string | `start_review` 或 `resolve`。 |
| `dispute_id` | string | 关联申诉。 |
| `handler` | ActorRef object | 受理人，受理事件使用。 |
| `reviewer` | ActorRef object | 复核人，处理结论事件使用。 |
| `decision` | string | `resolved` 或 `rejected`，处理结论事件使用。 |
| `resolution` | string | 处理结论说明。 |
| `note` | string | 受理备注。 |

## core_dispute

实名申诉或复核记录。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dispute_id` | string pk | 是 | 稳定 ID。 |
| `dispute_type` | enum string | 是 | `task_review`、`points_deduction` 等。 |
| `status` | enum string | 是 | `submitted`、`in_review`、`resolved`、`rejected`、`appealed`、`reversed`。 |
| `claimant_member_id` | fk | 是 | 实名申诉人。 |
| `respondent_member_id` | fk | 否 | 被申诉人。 |
| `related_task_id` | fk | 否 | 关联任务。 |
| `related_ledger_entry_id` | fk | 否 | 关联积分流水。 |
| `facts` | text | 是 | 事实陈述。 |
| `evidence_refs` | json array | 是 | 证据引用。 |
| `handler` | json | 是 | 处理人 ActorRef。 |
| `reviewer` | json | 是 | 复核人 ActorRef。 |
| `resolution` | text | 否 | 处理结果。 |
| `appeal_path` | string | 是 | 申诉路径。 |
| `submitted_at` | datetime | 是 | 提交时间。 |
| `resolved_at` | datetime | 否 | 解决时间。 |
| `metadata` | json | 是 | 扩展对象。 |

运营申诉处理会写入以下 `metadata` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `review_started_at` | datetime string | 申诉受理时间。 |
| `review_started_note` | string | 受理备注。 |
| `resolved_by` | ActorRef object | 记录处理结论的典守者。 |
| `resolved_at` | datetime string | 处理结论记录时间。 |
| `decision` | string | `resolved` 或 `rejected`。 |

申诉本身不保存独立哈希字段，也不维护自己的哈希链。正式申诉生命周期应通过 `core.dispute_services.submit_dispute()`、`start_dispute_review()`、`resolve_dispute()` 完成，并追加 `dispute_*` 类型 `SystemEvent`；多个 `SystemEvent` 通过 `aggregate_type = "Dispute"` 和 `aggregate_id = dispute_id` 关联同一个申诉。

## core_capacity_assessment

容量评估结果，用于决定是否接纳新成员、扩张任务量或推进扩容计划。`CapacityAssessment` 是 world 业务数据，不是 control DB 的全局配置；真实世界和每个仿真世界都在各自 world 数据库中保留自己的 `core_capacity_assessment` 数据。observer 展示摘要；重大容量决策应通过提案或专门流程落账。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `assessment_id` | string pk | 是 | 稳定 ID。 |
| `simulation_day` | integer | 是 | 模拟日期。 |
| `current_covenanters` | integer | 是 | 当前守约者数量。 |
| `current_contributors` | integer | 是 | 当前贡献者数量。 |
| `maximum_admissible_members` | integer | 是 | 当前最大可接纳人数。 |
| `recommended_new_members` | integer | 是 | 建议新增人数。 |
| `bottlenecks` | json array | 是 | 容量瓶颈列表。 |
| `risk_indicators` | json | 是 | 风险指标。 |
| `reasons` | json array | 是 | 人类可读原因。 |
| `rule_version` | string | 是 | 规则版本。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `metadata` | json | 是 | 扩展对象。 |

## core_credentialtemplate

凭证模板。定义可发放的凭证类型，例如守约者编号、勋章、证书、NFT 占位等。模板由 `ensure_builtin_credential_templates()` 幂等创建；不应在 Admin 中新增或修改，所有字段只读。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `template_id` | string pk | 是 | 稳定业务 ID，例如 `credential-template-formal-member-number`。 |
| `code` | string unique | 是 | 程序内唯一编码，例如 `covenanter_number`。 |
| `name` | string | 是 | 显示名称，例如"守约者编号"。 |
| `description` | text | 否 | 说明文本。 |
| `credential_type` | enum string | 是 | `formal_number` / `badge` / `certificate` / `nft_placeholder`。 |
| `status` | enum string | 是 | `active` / `archived`。 |
| `visibility` | enum string | 是 | `public` / `internal`。公开凭证可在 Observer 展示。 |
| `icon_url` | url | 否 | 图标 URL。 |
| `display_order` | integer | 是 | 展示排序，越小越靠前。 |
| `metadata` | json | 否 | 扩展数据。`recruitment` 子字段用于成员报名方向控制，约定如下。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

`metadata.recruitment` 约定（由 workspace 招募页 `/workspace/recruitment/` 维护，支持内置模板和自定义模板）：

```json
{
  "show_on_application": true,
  "required_count": 2,
  "public_label": "公司法人方向",
  "public_description": "需要愿意承担主体责任、参与公司治理的人",
  "sort_order": 10
}
```

- `required_count` 是当前招募需求，不是凭证库存。
- `current_count` 由 active `CredentialGrant` 实时统计。
- `missing_count = max(required_count - current_count, 0)`。
- `required_count=0` 表示不限量招募。
- Credential 仍不是权限来源。
- 自定义招募方向 code 规则：`a-z0-9_`、字母开头、长度 3-64。

## core_credentialgrant

凭证发放实例。按模板发放给 Member 的具体凭证，每个实例有唯一 `grant_id`、递增 `serial_no`（模板内）和展示编号 `display_no`。Credential 是公开事实证明，不参与权限判断。Admin 中只读。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `grant_id` | string pk | 是 | 业务 ID，自动生成（如 `credential-grant-<uuid>`）。 |
| `template_id` | fk → CredentialTemplate | 是 | 凭证模板。 |
| `member_id` | fk → Member | 是 | 接收凭证的成员。 |
| `serial_no` | positive integer | 否 | 模板内递增序列号（如守约者编号 1,2,3…）。 |
| `display_no` | string | 否 | 对外展示编号，如 `#1`。 |
| `title` | string | 否 | 标题，默认为模板名称。 |
| `status` | enum string | 是 | `active` / `revoked` / `archived`。 |
| `issued_at` | datetime | 是 | 发放时间。 |
| `issued_by_id` | fk → Member | 否 | 发放人。 |
| `source_type` | enum string | 是 | `system` / `proposal_execution` / `manual` / `earned`。 |
| `source_proposal_id` | fk → Proposal | 否 | 来源提案。 |
| `source_proposal_execution_id` | fk → ProposalExecution | 否 | 来源提案执行。 |
| `metadata` | json | 否 | 扩展数据。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 是 | 更新时间。 |

唯一约束：
- `(template, serial_no)` — 同一模板内序列号唯一。
- `(template, display_no)` — 同一模板内展示编号唯一。

## worlds_worldregistry

`worlds.WorldRegistry` 是 control DB 中的世界注册表，不是具体 world 的业务表。它负责把稳定的世界 ID 映射到 Django 数据库别名和物理数据库名称。

| 字段 | 说明 |
| --- | --- |
| `world_id` | 稳定世界 ID，例如 `realworld` 或 `simulation0001`；主键。 |
| `name` | 人类可读名称。 |
| `world_type` | `real` 或 `simulation`。 |
| `database_alias` | 该世界使用的 Django `DATABASES` 别名，例如 `realworld` 或 `simulation0001`。 |
| `database_name` | 独立 world 数据库的物理库名。 |
| `status` | `active`、`archived` 或 `deleted`。 |
| `archived_at` | 归档时间。 |

各 world 的业务表仍由各 app 模型拥有。世界注册表只负责路由和生命周期控制，不保存成员、任务、提案、事件等业务数据。当前默认映射是 `realworld -> realworld -> dev_big_real` 和 `simulation0001 -> simulation0001 -> dev_big_sim0001`；control 表位于 `default -> dev_big_control`。

## worlds_worldmaintenancelog

`worlds.WorldMaintenanceLog` 是 control DB 中的高风险 world 维护操作审计日志。它记录重置仿真 world 等破坏性维护动作，不能写入目标 world 数据库；这样即使目标 world 数据库被清空，维护审计仍保留在 control DB。

| 字段 | 说明 |
| --- | --- |
| `id` | 自增主键。 |
| `world_id` | fk → WorldRegistry；被维护操作作用的目标 world。 |
| `action` | 操作类型；当前为 `reset_zero_start`。 |
| `actor_username` | 执行维护操作的 Django 用户名。 |
| `status` | `succeeded` 或 `failed`。 |
| `force` | 是否绕过未处置运行保护机制强制执行。 |
| `counts_before_json` | 操作前目标 world 各核心表记录数。 |
| `counts_after_json` | 操作后（重新 seed 后）目标 world 各核心表记录数。 |
| `message` | 操作结果或失败原因的补充说明。 |
| `created_at` | 记录时间。 |

索引：

- `(world, action)`
- `status`

当前主要写入来源是 `/admin/simulation-lab/reset-world/`。该表只读展示于 control Admin，不替代 `SimulationRunDisposition`；前者记录高风险维护动作，后者记录某一轮仿真 run 是否归档或废弃。

## Database Alias Routing

Runtime database routing 感知 request/world 上下文：

| App label | 无 world context | 固定 world request context | 迁移目标 |
| --- | --- | --- | --- |
| `worlds` | `default` | `default` | `default` only |
| `sessions` | `default` | `default` | `default` and every world alias |
| `admin` | `default` | `default` | `default` only |
| `auth` | `default` | current world alias | `default` and every world alias |
| `contenttypes` | `default` | current world alias | `default` and every world alias |
| `core` | `realworld` by default | current world alias | every world alias only |

这意味着 `bigadmin.local/admin/` 技术账号位于 control 数据库，而 `bigreal.local/...` 和 `bigsim.local/...` 会通过固定 world host 的根路径访问各自 world 数据库并在其中认证。

## core_credit_account

积分账户（发行池、任务锁定、成员、冻结、销毁）。余额始终从 `core_credit_transaction` 聚合计算，从不直接编辑。成员账户与 `core_member` 一一对应；系统账户 `member_id` 为空。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `account_id` | string pk | 是 | 稳定账户 ID，如 `acct-member-M001`、`acct-sys-issuance_pool`。 |
| `account_type` | enum string | 是 | `issuance_pool`、`task_locked`、`member`、`frozen`、`burn`。 |
| `member_id` | fk nullable | 否 | 成员账户对应的 `core_member`。系统账户为空。 |
| `status` | enum string | 是 | `active`、`frozen`、`closed`。 |
| `metadata` | json | 是 | 扩展数据。不在公开页展示。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |

索引：`(account_type)`、`(member_id)`。

## core_credit_transaction

权威复式记账积分交易。余额从 `posted` 状态交易汇总推导；严禁直接修改 `core_credit_account` 余额字段。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `transaction_id` | string pk | 是 | 稳定交易 ID，如 `ct-abc123`。 |
| `transaction_type` | enum string | 是 | `issuance`、`lock`、`unlock`、`task_reward`、`transfer`、`consume`、`burn`、`freeze`、`unfreeze`、`correction`、`reversal`。 |
| `source_account_id` | fk nullable | 否 | 积分转出账户。`issuance` 时可空。 |
| `target_account_id` | fk nullable | 否 | 积分转入账户。 |
| `amount` | integer | 是 | 正数，实际转移积分数量。 |
| `related_task_id` | fk nullable | 否 | 关联任务。 |
| `related_ledger_entry_id` | fk nullable | 否 | 关联 `core_ledger_entry`（成员视角投影）。 |
| `related_event_id` | string | 是 | 关联 `core_systemevent.event_id`，构成审计哈希链。 |
| `initiated_by_id` | fk nullable | 否 | 业务发起人。 |
| `reviewed_by_id` | fk nullable | 否 | 治理/财务审核人。 |
| `reason` | text | 是 | 原因。 |
| `metadata` | json | 是 | 扩展数据。不在公开页展示。 |
| `idempotency_key` | string unique nullable | 否 | 数据库级唯一去重键（普通约束，非 conditional）。NULL 允许多笔。 |
| `reverses_transaction_id` | fk nullable | 否 | 冲正目标交易。 |
| `status` | enum string | 是 | `posted`（已入账）、`void`（已作废，deprecated — 使用 reversal）。 |
| `prev_hash` | string | 是 | 前一交易哈希（保留）。 |
| `transaction_hash` | string | 是 | 本交易哈希（保留）。审计链以 `core_systemevent` 为准。 |
| `created_at` | datetime | 是 | 创建时间。 |

索引：`(source_account_id)`、`(target_account_id)`、`(transaction_type)`、`(status)`、`(related_task_id)`、`(created_at)`。

重要规则：
- **余额推导**：`member_credit_balance(member) = sum(target=member_acct) − sum(source=member_acct)`，仅统计 `status=posted` 行。
- **错误修正**：只能追加 `reversal` 或 `correction` 交易，不得修改或删除已有记录。
- **任务奖励**：source_account = `task_locked`（锁定的任务预算），target_account = `member`。创世例外 (`allow_unbudgeted_genesis=True`) 从 `issuance_pool` 发放并标记 `genesis_unbudgeted=true`。
- **兑换冻结**：`consume`（member → frozen），取消 `unfreeze`（frozen → member），履约 `burn`（frozen → burn）。
- **幂等**：`idempotency_key` 非空时在数据库和服务层双重保证不重复记账。

## core_redemption_order

成员发起积分兑换订单。创建时冻结积分，取消时解冻，履约后销毁。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `order_id` | string pk | 是 | 稳定订单 ID，如 `ro-abc123`。 |
| `member_id` | fk | 是 | 兑换成员。 |
| `status` | enum string | 是 | `pending`、`fulfilled`、`cancelled`、`disputed`、`reversed`。 |
| `item_type` | enum string | 是 | `meal`、`goods`、`resource_use`、`room_upgrade`、`storage`、`parking`、`training`、`service`、`fee_reduction`、`other`。 |
| `title` | string | 是 | 订单标题。 |
| `original_amount_rmb` | decimal nullable | 否 | 原价（元）。 |
| `credit_amount` | integer | 是 | 冻结/销毁积分数量。 |
| `cash_amount_rmb` | decimal nullable | 否 | 现金部分（元）。 |
| `related_task_id` | fk nullable | 否 | 关联任务。 |
| `related_event_id` | string | 是 | 关联 `core_systemevent.event_id`。 |
| `resource_id` | string | 是 | 关联 `core_resource.resource_id`。 |
| `item_snapshot` | json | 是 | 兑换项目结构化快照。 |
| `finance_treatment_ref` | string | 是 | 财务处理外部引用。 |
| `reason` | text | 是 | 原因。 |
| `metadata` | json | 是 | 扩展数据。不在公开页展示。 |
| `created_by_id` | fk nullable | 否 | 创建人。 |
| `reviewed_by_id` | fk nullable | 否 | 审核人。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |
| `fulfilled_at` | datetime | 否 | 履约时间。 |
| `cancelled_at` | datetime | 否 | 取消时间。 |

索引：`(member_id, status)`、`(status)`。

重要规则：创建后冻结积分 (`consume`)，取消解冻 (`unfreeze`)，履约销毁 (`burn`)。所有积分变动通过 `core_credit_transaction` 记录，`core_redemption_order` 仅追踪订单生命周期。商业定价和现金结算不在当前一期实现。

## 积分与 LedgerEntry 关系

`core_ledger_entry` 是成员视角的积分流水投影，从任务验收等行为生成；`core_credit_transaction` 是权威复式记账层。两者通过 `related_ledger_entry_id` / `related_task_id` 关联。新代码应优先查询 `core_credit_transaction` 做权威余额推导，`core_ledger_entry` 作为成员可读流水和兼容层保留。

## core_merchant_profile

商户资料表。`member_micro_merchant` 通过自由转账收款，不生成结算；`cash_settlement_merchant` 积分消费后销毁并生成人民币应付款，商户不持有可流通积分账户。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `merchant_id` | string pk | 是 | 商户唯一标识。 |
| `display_name` | string | 是 | 商户展示名称。 |
| `operator_member_id` | fk nullable | 否 | 经营该商户的成员。商户本身不拥有独立积分账户。 |
| `merchant_type` | enum string | 是 | `member_micro_merchant`、`cash_settlement_merchant`。 |
| `status` | enum string | 是 | `active`、`suspended`、`closed`。非 active 商户不能接受新兑换订单。 |
| `settlement_rate` | decimal nullable | 否 | 仅 cash_settlement 商户使用。履约时快照写入 `core_merchant_settlement_record.settlement_rate`，不受后续修改影响。 |
| `metadata` | json | 是 | 扩展数据。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |

索引：`(merchant_type)`、`(operator_member_id)`。

## core_merchant_settlement_record

现金结算商户履约后生成的人民币应付记录。每条记录必须关联一笔 `core_redemption_order`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `settlement_id` | string pk | 是 | 结算记录 ID，如 `ms-ro-abc123`。 |
| `merchant_id` | fk | 是 | 关联 `core_merchant_profile`。 |
| `redemption_order_id` | one-to-one fk | 是 | 关联 `core_redemption_order`。每笔结算必须对应一笔订单。 |
| `covered_credit_amount` | integer | 是 | 本次结算覆盖的消费积分数（不是商户积分余额）。商户不持有可流通积分。 |
| `settlement_rate` | decimal | 是 | 履约时快照写入的结算汇率。 |
| `payable_rmb` | decimal | 是 | 人民币应付结算金额（两位小数），不是积分提现。 |
| `status` | enum string | 是 | `pending`、`approved`、`paid`、`disputed`、`cancelled`。 |
| `reason` | text | 是 | 备注。 |
| `metadata` | json | 是 | 扩展数据。 |
| `created_at` | datetime | 是 | 创建时间。 |
| `updated_at` | datetime | 否 | 更新时间。 |

索引：`(merchant_id, status)`。

重要规则：`covered_credit_amount` 是积分覆盖消费额，不是商户积分余额。`payable_rmb` 是社区应支付商户的人民币金额，不是积分提现。商户不持有可流通积分账户。

## core_redemption_order.merchant

`core_redemption_order` 新增 `merchant_id` nullable FK 指向 `core_merchant_profile`。非空时表示该订单属于某个特定现金结算商户，履约后由 `_generate_settlement_record()` 自动创建 `core_merchant_settlement_record`。空表示普通成员兑换，不生成商户结算。
