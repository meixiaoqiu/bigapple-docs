---
sidebar_position: 1
title: 架构说明
---

# 架构说明

执衡者资格由 world 内部的题库考试产生：有效守约者在成员工作台参加随机组卷的服务端考试，通过后原子获得一年任期。典守者以独立业务权限 `governance.manage_deliberator_exam` 维护题库和政策；Django staff/superuser 标记本身不构成该权限。

## 目标

Big Apple Live OS 是社区运行的权威系统。

v0.1 必须保证真实用户和 Simulation Engine 使用同一套 API。Simulation Engine 是外部客户端，不是权威系统，不能直接修改业务表。

产品规划按照中远期完全体来描述，当前实现只是完整系统的阶段性切片。完整系统应同时服务匿名访问者、成员、典守者和 Simulation Engine；当前 Django Admin 只是内部维护入口，不代表最终运营后台边界。

治理交互模型遵循 [治理交互模型边界](./governance-boundary.md)：任务、申诉、角色任命、积分流水等具体业务保留自己的结构化模型；提案只作为需要共同决定时的决策机制；统一事件账本只记录已经发生的关键事实和责任链，不替代业务状态机。

## 文件与头像运行期边界

成员头像经过 Magika 识别、Pillow 安全解码和 `512 × 512` WebP 重编码后写入 Django Storage。对象 key 采用 `<world-id>/runtime/<lifecycle>/...`：当前头像位于 `current-assets/avatars/`，临时上传位于 `temporary/avatar-uploads/`。Storage alias 不再添加 `current/temporary` 顶层 location，因此数据库 key、OCI object key 和本地相对路径保持一致。

仿真 world 重置只清理 `<world-id>/runtime/`，清理失败时不得 flush 数据库。该流程不查询或修改 control DB 的 `SimulationSnapshot`，也不访问本地 `var/simulation_archives/`；归档与重置是独立动作。真实 world、其它 world 前缀和历史归档均不属于本次清理范围。

## 仓库边界

本仓库负责：

- Django 应用代码
- 数据库模型和迁移
- Live OS API 实现
- 早期开发用 Django Admin 检查工具
- 数据库化项目执行计划模型
- Observer / Lab / Simulation 的边界：观察、实验控制和自动推演分离
- 证明 API 响应符合 `technical-contracts` 的测试
- Live OS 运行和开发文档

本仓库不负责：

- JSON Schema 或 OpenAPI 的源头定义
- Simulation Engine 行为模型
- 虚拟成员生成逻辑
- 生产密钥
- 真实成员隐私数据

契约源头位于相邻仓库：

```text
static/technical-contracts
```

## 第一版形态

```text
HTTP client
  |
  v
live_os.urls_admin / live_os.urls_real / live_os.urls_sim
  |
  v
live_os.api.urls
  |
  v
live_os.api.* / workspace / observer / simulation_lab
  |
  v
workspace.context / core.tasks.* / core.dispute_services / core.resource_services / core.ledger_services / observer.* / simulation.engine
  |
  v
core.models.*
  |
  v
MySQL
```

当前默认运行入口分为三个站点：

- `bigadmin.local` / `live_os.settings_admin`：control plane。`/admin/` 是技术后台、原始数据和兜底维护入口；`/admin/simulation-lab/` 是仿真实验后台，负责启动、推进、归档和废弃仿真实验。
- `bigreal.local` / `live_os.settings_real`：真实世界 runtime。固定绑定 `realworld`，使用根路径 `/api/v0.1/`、`/`、`/workspace/`、`/register/`。守约者报名是 workspace 子功能（`/workspace/apply/`），`/apply/` 和 `/apply/partner/` 已删除。
- `bigsim.local` / `live_os.settings_sim`：仿真世界 runtime。固定绑定 `simulation0001`，使用与真实世界相同的根路径和同一套页面/服务代码。

带 world 前缀的历史路由族已经从 runtime URLConf 移除。真实世界和仿真世界由固定 host settings 绑定，不再通过 URL 中的 world id 选择。

固定 world runtime 的业务路由：

- `/api/v0.1/`：contract-facing JSON API。
- `/`：面向公众的公开首页/社区动态，只展示当前固定 world 的运行结果；`/simulations/` 展示公开仿真档案和可读报告。
- `/workspace/`：面向当前登录成员的自助工作台页面。

当前代码边界：

- `core.models.identity`、`proposals`、`planning`、`simulation_runs`、`simulation_feedback`、`operations`、`events`、`disputes`：权威业务模型按领域拆分，但仍归属 `core` app，避免为了 app 名称重复造平行模型。
- `core.models`：稳定导出入口；新模型应进入对应领域文件，不要重新写回单个大文件。
- `core.file_processing.*`：与业务 owner 无关的文件大小限制、Magika 内容识别、Pillow 图片解码/规范化和哈希原语。
- `core.file_storage.*`：Django Storage gateway、随机对象 key、临时对象和严格的 world/生命周期前缀校验；业务代码不直接依赖 bucket 或供应商 URL。
- `core.avatar_services`：个人头像上传、替换、恢复默认和维护移除的权威状态变化；头像是可删除的当前展示资产，不是永久附件。
- `live_os.api.*`：contract-facing JSON API 和 contract serializers，不承载页面模板，不放回 core 规则引擎。
- `core.access`：User / Member 到治理权限的纯权限桥接，不返回 HTTP response。
- `live_os.access`：Django request、页面 decorator、JSON 401/403 和 request actor 解析，供 API、workspace 和 simulation_lab 使用。
- `workspace.views`：成员自助工作台页面动作，身份来自当前登录账号绑定的 Member。
- `workspace.context`：成员工作台共享读模型，保持 HTTP-free，不放回 core 规则引擎。
- `observer.dashboard_context`、`page_context`、`timeline_context`、`simulation_reports`、`page_views`、`theme_views`、`api_views`：观察复盘读模型、公开仿真报告读模型、HTML/HTMX 页面、主题切换和观察摘要 API。
- `observer.theme.*`：观察端主题配置、当前主题 session、模板 fallback 和静态资源查找分离。
- `simulation.boundary`、`world_snapshot`、`run_state`、`run_progress`、`feasibility`、`failure_handling`、`feedback_suggestions`、`feedback_operation_handlers`、`feedback_operations`、`feedback_services`、`engine`、`ids`：仿真边界、真实世界只读快照、run/world 写入、节点推进、可行性判断、失败处理、计划反馈生成、失败类型操作生成、计划变更操作路由、反馈落库服务、推进循环和仿真记录 ID，不依赖 core 业务写服务。
- `simulation_lab.views`：仿真实验后台页面入口。
- `core.admin`、`admin_identity`、`admin_proposals`、`admin_operations`、`admin_events`、`admin_support`：Django 技术后台入口、成员/角色维护配置、提案维护配置、运营对象维护配置、只读事件账本配置和通用 Admin mixin。
- `core.event_ledger`、`event_payloads`、`governance_setup`、`role_assignment_services`、`core.proposals.*`、`permission_services`、`governance_signals`：统一事件账本、事件快照、基础治理权限初始化、角色任命、提案生命周期/投票/执行、角色权限判断和事件追加 signal。不要重新新增 `core.governance` 或 `core.proposal_services` 门面。
- `core.tasks.authoring`、`member_workflow`、`review`、`core.dispute_services`、`core.resource_services`、`core.ledger_services`：真实世界业务写操作。不要再新增 `core.services` 或 `core.task_services` 这种大杂烩服务门面。
- `live_os.demo_seed.*`：幂等演示数据写入逻辑，按项目计划、成员、资源、任务、事件、积分、申诉和容量评估拆分；`seed_demo` 命令只做编排。
- `simulation.admin`、`admin_planning`、`admin_runs`、`admin_feedback`：Django Admin 自动发现入口、项目计划维护配置、只读仿真运行记录配置和仿真反馈/计划变更配置。

项目执行计划位于任务系统之上：

```text
ProjectPlan / PlanRevision / PlanNode
  |
  v
Task / Resource / Event / CapacityAssessment
```

`ProjectPlan` 和 `PlanNode` 不替代 `Task`。它们回答"为什么要做这些任务、这些任务属于哪个主线目标、完成后增加哪些容量"。`Task` 仍负责具体可领取、可提交、可验收的工作。

`views` 应保持轻量：

- 解析请求 JSON
- 读取记录
- 调用 service
- 返回符合 technical contracts 的 JSON

`services` 负责状态变化：

- 领取任务
- 提交劳动
- 创建任务草稿
- 发布任务
- 指派任务
- 关闭未开始任务
- 验收任务
- 调整资源库存
- 记录资源事件
- 受理申诉
- 记录申诉处理结论
- 记录申诉事件
- 推进一回合页面式仿真，并将任务、资源和事件变化落回权威表
- 创建自动模拟运行，按项目执行计划推进到失败或完成
- 记录计划节点在模拟中的状态、失败原因和修订建议
- 把计划修订建议转化为结构化计划变更集和变更操作
- 创建积分流水
- 创建事件

`core.models.*` 负责持久化权威状态；`core.models` 包入口保留稳定导入面。

## 权威边界

### 文件资产与未来永久附件边界

第一阶段文件上传只落地个人头像。输入经过 Magika 内容识别；Pillow 读取图片头部尺寸并在完整解码前执行边长和总像素限制，通过后才完整解码，最终统一输出为去除来源元数据的 `512 × 512` 静态 WebP。数据库只保存当前私有对象 key、SHA-256、字节数和更新时间。成员本人可以替换或恢复默认头像，维护人员仅在具有 `governance.manage_people` 权限时移除违规头像，不能代成员上传。公开头像 URL 使用更新时间作为版本参数，替换或移除后地址立即变化；有效头像可长期缓存，默认或存储故障回退只短期缓存。

对象存储通过 Django Storage 抽象接入。当前生产目标是 OCI Object Storage 的 S3 兼容接口，终极形态可以替换为园区内网兼容后端而不改变成员资料或页面语义。真实 world、仿真 world、临时对象、当前头像和未来永久附件必须使用不可混淆的 bucket/prefix 边界。

头像只表达当前展示状态，成功替换后旧对象可以删除。报销凭证等进入审计记录的文件不得直接复用头像删除生命周期：当前使用独立 `Attachment` 权威模型和 `ExpenseClaimAttachment` 真实业务外键，公开副本与更正版本只追加，密封记录在 Admin 中只读。未来提案资料、任务交付物应继续采用同样的真实领域外键，而不是引入缺少完整性约束的万能关联。两类对象只复用内容识别、图片处理、哈希、随机 key 和 Storage 写入原语。

Live OS 对以下数据拥有权威：

- 成员身份状态
- 任务状态
- 项目执行计划、计划版本、计划节点、节点依赖、节点需求和容量影响
- 积分账本流水
- 资源状态
- 申诉记录
- 规则版本记录
- 容量评估记录
- 事件流记录
- 自动模拟运行、节点模拟状态、模拟失败和计划修订建议
- 计划变更集和计划变更操作

Simulation Engine 可以：

- 调用 Live OS API
- 以虚拟成员身份提交请求
- 读取响应和事件流

Simulation Engine 不可以：

- 直接写入 Live OS 数据表
- 在 Live OS 外部结算最终积分
- 绕过任务验收
- 绕过申诉流程
- 绕过规则版本

Observer 不再负责仿真控制。仿真实验的启动和推进归属 `bigadmin.local/admin/simulation-lab/`；`bigreal.local/` 和 `bigsim.local/` 只负责观察和复盘各自固定 world，`/simulations/` 负责把已归档仿真快照转成公开可读报告。`simulation` 服务可以读取真实计划和资源作为输入，但写入必须归属于明确的 world 数据库和 simulation run，不能默认修改真实任务、真实库存、真实积分或真实计划。

项目执行计划是模拟和真实执行都可引用的计划源头，不能只写在 Markdown 中。Markdown 只说明规则和边界；计划本体必须落库、可编辑、可版本化，并能被观察台和后续模拟运行引用。

自动模拟反馈遵循三层边界：

- 计划层：`ProjectPlan`、`PlanRevision`、`PlanNode` 记录当前权威计划。
- 模拟层：`SimulationRun`、`PlanNodeRunState`、`SimulationTurn`、`SimulationFailure` 记录当前 world 数据库中的某次模拟如何推进以及在哪里失败。
- 建议层：`PlanRevisionProposal` 记录从失败中得到的修订建议，等待人审核。
- 补丁层：`PlanChangeSet`、`PlanChangeOperation` 记录如果采纳建议，应如何修改计划数据库对象。

自动模拟可以生成失败、建议和结构化补丁，但不能直接改写计划层。采纳建议必须产生新的计划版本或人工可审计的计划变更。

## 当前限制

当前实现暂时不包含：

- 面向外部客户端和 Simulation Engine 的服务账号/API token 认证
- API schema 校验中间件
- 完整运营后台角色拆分
- 治理后台
- 复杂观察台交互
- Celery 任务
- Redis
- 每日模拟快照表
- 独立仿真实验 ID 和随机种子表

## 长期架构完成清单

这份清单用于判断"边界是否真正清楚"，不是一次性必须完成的功能列表。

1. `core` 只承载底层规则、共享模型、权限、统一事件账本、API 合约和领域服务，不承载页面入口。
2. `bigadmin.local/admin/` 只作为 control plane 技术后台、原始数据查看、兜底维护和只读审计入口，不作为日常业务运营后台。
3. `bigreal.local/workspace/` 和 `bigsim.local/workspace/` 承载各自固定 world 的成员工作台，并走同一套页面和服务边界。
4. `bigreal.local/` 和 `bigsim.local/` 只负责观察、复盘和展示各自 world 运行结果，不提供仿真控制写入口。
5. `simulation` 只承载仿真推演逻辑；仿真写入必须绑定明确的 world 数据库和 simulation run，不能默认改写真世界任务、资源、积分、成员或计划。
6. `/admin/simulation-lab/` 承载仿真实验启动、配置、运行管理和实验结果管理，负责"怎么跑"，不负责手动干预真实业务过程。
7. 所有真实世界关键状态变化必须通过对应领域服务模块完成，并追加统一事件账本。
8. 任务、申诉、提案、积分流水等业务对象保留结构化表；统一事件账本记录关键事实、顺序、责任人和哈希链。
9. Django `User` 只作为登录账号；业务责任主体是 `Member`，权限事实来自 `Member -> RoleAssignment -> RolePermission -> Permission`，运行时授权由 `AuthorizationService` / OpenFGA 计算。
10. `is_staff` / `is_superuser` 只属于 Django 技术后台边界，不能等同于业务治理权限。
11. Admin、服务、URL、文档和测试必须共同约束边界，避免后续把页面逻辑塞回 `core` 或让仿真误写真实世界。
12. 早期兼容门面和中间态命名应持续删除，不能因为"能跑"就长期保留。
13. 模型定义应继续按 `core.models` 领域文件维护；`core.models.__init__` 只能作为导出层，不能重新膨胀为单文件模型仓库。

## 身份体系

### 三层身份模型

```text
User          → 登录认证（Django auth）
Member        → 业务身份（所有注册用户的权威主体）
Role          → 权限集合（通过 RoleAssignment 授予）
Credential    → 公开事实证明（非权限来源）
```

1. **User 只负责登录认证。** `auth_user` 是 Django 的认证账号，承载 username / password / session。User 本身不表达任何业务权限，不存在"某个 User 天生有治理权"的概念。

2. **Member 是所有注册用户的业务身份。** 任何人通过 `/register/` 注册后，系统立即创建 `Member` 记录。Member 是业务世界的唯一主体：领取任务、提交申诉、持有角色、获得 Credential 都以 Member 为锚点。Member 和 User 是一对一绑定关系。

3. **注册状态不创建基础角色。** 新注册用户只创建 User 与 Member。已注册但没有当前有效守约者资格的成员，其参与状态派生显示为“贡献者”；匿名访问公开内容只是观察行为。两者都不创建同名 Role、RoleAssignment 或 OpenFGA tuple。最小 workspace、公开资料维护和守约者报名依据账号与 Member 绑定开放，不依赖虚构的基础角色。

4. **守约者是独立的成员资格事实。** "守约者"不是新的 Member 或账号，而是 Member 获得当前有效的 `ROLE_COVENANTER` 任命。该资格通过 `member_admission` 提案执行后写入 RoleAssignment，并同时发放守约者编号 Credential。资格有效性统一考虑任命状态、起止时间、成员生命周期和关联 User 是否启用，不使用 `Member.status` 或 Credential 旁路授权。

5. **守约者编号是一次性发放、永不复用的 Credential。**
   - 每个正式编号（如 `BA-0001`）全局唯一，只发放一次。
   - 成员退出后编号不回收、不重新分配给其他人。
   - 编号作为 `Credential Instance` 持久保留：它记录"谁在什么时间以什么方式成为守约者"这一历史事实。
   - 编号自身不自动赋予任何权限——成员退出后 RoleAssignment 已撤销，编号只作为历史归属证明存在。

6. **RoleAssignment / RolePermission 是唯一权限事实来源。** 所有 view、service、API 的运行时权限判断必须走 `AuthorizationService`；OpenFGA tuple 从下列事实链投影：

   ```text
   Member → active RoleAssignment → RolePermission → Permission
   ```

   不允许为 Credential / NFT / Badge、`Member.status` 或 member_no 字符串编写第二套权限路径。`is_staff` / `is_superuser` 仅限 Django Admin 技术后台边界使用，不能等同于业务治理权限。

   **当前落地**：`/register/` 只创建 User 与 Member，`/workspace/apply/` 处理登录后的守约者报名。守约者资格、执衡者职责和典守者职责分别由 `ROLE_COVENANTER`、`ROLE_DELIBERATOR` 和 `ROLE_MAINTAINER` 的当前有效 RoleAssignment 表达；贡献者是派生状态。完整成员工作台主授权通过 `AuthorizationService` 查询 OpenFGA 的 `covenanter` 关系；OpenFGA tuple 来自 Django 权威数据投影，并保留 `SUSPENDED`/`EXITED` veto。`Member.status` 不作为权限来源。
   **资源级权限**：`member_has_permission(member, code, resource=None)` 只表示成员是否在任一范围拥有该权限；带具体 `Resource` 时才检查全局资源授权或该资源的 scoped 授权。`RolePermission.constraints_json.resource_id` / `resource_ids` 会在 OpenFGA rebuild 时投影为具体资源 permission object，不能用无资源上下文的结果替代对象级判断。
   **职责前置条件**：执衡者、典守者以及任何带 `governance.*` 或 `finance.*` permission 的职责，都要求目标成员已拥有当前有效的 `ROLE_COVENANTER`。`SUSPENDED` / `EXITED` 成员不能获得新职责。普通授予统一调用 `create_role_assignment()`；首次系统初始化使用 `bootstrap_initial_maintainer()` 在事务内建立守约者资格和典守者职责。典守者不会自动获得执衡者任期或投票权。RoleAssignment Admin 只读，禁止手工创建或修改。

### 注册与报名的拆分展望

当前实现已拆分为两个独立步骤：1) `/register/` 创建账号和基础 Member；2) `/workspace/apply/` 提交守约者报名。

1. **注册** → 只创建 User + Member，可立即访问最小 workspace；贡献者状态由“没有当前有效守约者资格”派生。
2. **报名守约者** → 已注册 Member 提交申请，创建 `member_admission` 提案，通过后授予 `ROLE_COVENANTER` 任命并发放守约者编号 Credential。

这一拆分依赖中远期报名流程重构，当前不做迁移。

## Credential / NFT / Badge 与权限边界

- **Credential / NFT / Badge 只能表示公开事实、荣誉、资格材料或历史证明。** 它们可以承载"某成员拥有某项资质/某 NFT"的公开信息，但不能被业务代码直接用来判定该成员是否有权执行某操作。
- **禁止出现** `if member.has_nft(...): allow_xxx` 或 `if member.has_credential(...): allow_xxx` 这类运行时授权路径。
- Credential / NFT / Badge 可以作为**授予 RoleAssignment 的依据**（例如治理提案决议"持有 X NFT 的成员获得治理角色"），但链上状态必须先导入/验证为系统记录，再通过治理规则或同步服务生成 RoleAssignment。应用运行时仍只查 RoleAssignment / RolePermission，不直接查询 NFT 所有权或 Credential 持有情况。
- 如果未来链上 NFT 上线，必须经过导入层写入链上证据表，再由治理流程授予相应角色。运行时权限链始终保持：`Member → active RoleAssignment → RolePermission → Permission`。
- Credential Template 与 Credential Grant 已落地：内置模板（如"守约者编号"）由 `ensure_builtin_credential_templates()` 幂等创建；发放 `issuance` 本身是一个有审计记录的业务动作（写入 `SystemEvent`）；发放后是否影响权限，必须通过另一份提案授予 RoleAssignment。守约者编号是 CredentialTemplate 的一个实例，不是 Member 字段，不是权限来源。

## Community Feedback / 公众参与层

`CommunityFeedback` 是注册用户公开发声的轻量入口，不是治理提案，也不是评论论坛。

- 未登录用户可以浏览公开反馈。
- 注册用户可以提交公开问题、建议、担忧、提案种子或其他反馈。
- 典守者可以回应、隐藏或把反馈关联到正式 `Proposal`。
- 反馈提交、维护回应和关联提案只写普通公开 `Event`，用于首页和事件流展示。
- 隐藏反馈不写新的公开 Event，并会把该反馈既有公开 Event 转为 internal，避免放大违规内容。
- Feedback 不写 `SystemEvent` 哈希链，不改变 RoleAssignment、RolePermission、Credential、Proposal 执行结果或其他权威状态。
- Feedback 不能作为运行时权限来源；如反馈需要变成正式行动，必须由典守者转入 Proposal 或对应领域服务流程。

## Public Finance / 公开财务层

公开财务用于把社区报销、审核和付款记录变成可观察、可追责的业务流程。它不是第二套治理系统，也不替代 Proposal。

- `ExpenseClaim` 记录成员提交的报销申请。任何非 `SUSPENDED` / `EXITED` 的注册成员都可以提交。
- `FinanceReview` 记录财务审核决定。审核人必须拥有 `finance.review` 权限，并且不能审核自己的报销；拒绝必须填写理由。
- `FinanceTransaction` 是只追加财务流水。标记付款的人必须拥有 `finance.pay` 权限，并且不能给自己的报销标记付款。
- 财务角色由 `ensure_finance_roles()` 幂等创建，属于 `大苹果财务组`，运行时权限仍通过 `AuthorizationService` / OpenFGA 判断；OpenFGA tuple 来自 `Member -> active RoleAssignment -> RolePermission -> Permission` 权威事实投影。
- 财务审核职责通过成员工作台的角色任命提案产生：具备 `governance.manage_roles` 的典守者提名当前守约者，合格执衡者按选民规则表决，通过后再由有权典守者执行。守约者准入和执衡者考试都不会自动授予财务权限。
- OpenFGA 对规范财务角色投影 `assignee -> role -> guarded permission`；`guarded_permission` 要求持有人仍是当前守约者且未被冻结。只有 `大苹果财务组` 中三个基线财务角色会进入投影，其他组织的同名角色失败关闭。
- 任何带 `finance.*` permission 的角色都属于高信任角色，授予前要求目标成员已经拥有 `ROLE_COVENANTER`。
- 报销提交、审核和付款会写普通公开 `Event`，进入首页、事件流和 `/finance/` 公开财务页；同时写入 `SystemEvent` 哈希链，便于审计证明。
- 撤回报销只写普通公开 `Event`，不写新的 `SystemEvent` 哈希链记录。
- 公开页面只展示业务摘要、金额、状态、申请人/审核人/付款人公开名称和可公开说明，不展示内部 pk、User.id、Member.id、联系方式或私密凭证材料。

报销现已使用正式业务附件，而不是头像生命周期。`Attachment` 保存私有原件或独立公开副本的不可变对象事实，`ExpenseClaimAttachment` 通过真实外键把支出凭证、付款凭证和公开材料关联到报销。已提交原件不能静默覆盖；更正会新增附件并保留来源关系。公开材料必须另存为经过人工确认的脱敏副本，不能通过切换私有原件的公开开关直接发布；发布动作要求独立 `finance.publish_public_attachments` 权限，审核、付款或私有查看权限均不自动获得该能力。对象先于数据库引用写入时，附件服务和报销/付款外层事务都会按本批次对象 key 执行失败补偿，避免数据库回滚后遗留孤儿对象。

付款执行通过窄 `FinancePaymentBackend` 边界完成。当前默认且完整的实现是 `LiveOSManualPaymentBackend`：财务人员在线下实际付款后，在 Live OS 填写付款日期、方式、凭证和备注。将来可以只替换付款执行后端，但报销理由、审核责任、权限、公开投影、统一事件和永久档案始终由 Live OS 掌握；当前没有提供 ERPNext、飞书、钉钉或银行后端的虚假配置项。

当前变更只涉及 Django 页面与内部权威模型，未增加或修改公共 API、schema 或 payload，因此 `static/technical-contracts/` 无需变更。



## World 数据库边界

长期 world 隔离使用数据库边界，而不是给每一行业务数据都增加 `world_id`。

- 标准成员入口是 `bigreal.local/workspace/` 和 `bigsim.local/workspace/`。
- 带 world 前缀的历史路由已从 runtime URLConf 移除；固定 world host 是唯一支持的产品和测试入口。
- `worlds.WorldRegistry` 是 control 层 world 目录，记录 `world_id`、类型、数据库 alias、数据库名和生命周期状态。
- control 数据库拥有 world routing metadata、`/admin/` 技术账号和技术 session 状态。
- 每个 world 数据库拥有自己的 `auth_user` 和业务表，因此真实世界和仿真世界可以运行同一套应用代码路径。
- 默认本地数据库 alias 是 `default -> dev_big_control`、`realworld -> dev_big_real` 和 `simulation0001 -> dev_big_sim0001`；`BIG_APPLE_WORLD_DATABASE_ALIASES` 中声明的额外 world alias 会在启动时转换为 Django `DATABASES` 条目。
- World 绑定必须失败关闭（fail closed）：active world 必须指向已配置、非 `default`、且列入 `WORLD_DATABASE_ALIASES` 的 alias。缺失 alias 或指向 control 数据库的 alias 都是配置错误，不能回退到 `default`。
- World 生命周期命令管理 control registry：`create_world` 登记已配置的 world alias，`migrate_world` 对一个 active world 运行迁移，`seed_world` 用安全幂等模板初始化 active simulation world，`archive_world` 禁用非真实 world，`delete_world` 把已归档的非真实 world 标记为 deleted。
- 这些命令不创建或删除 MySQL 物理数据库。物理数据库创建、备份、归档和删除仍是基础设施操作。
- `seed_world` 不复制 `realworld` 数据。首个支持模板是 `demo`，它在选中的 simulation world 上下文中复用现有幂等 `seed_demo` 数据。
- `realworld` 和所有 `world_type=real` 行都受保护，不能归档或删除。
- 固定 world 站点使用根 `/workspace/` 路径。URLConf 不再暴露兼容性 world-prefix 路由、`/live-admin/` 或旧 `/member/` workspace route。

## World 认证边界

`auth_user` is migrated into each world database so real and simulation worlds use the same login and authorization logic. `django_session` is also migrated into each world database because split runtime settings (`live_os.settings_real`, `live_os.settings_sim`) run with the world database as `default` and no routers; the `bigreal` and `bigsim` login flows write session rows there. Under routed admin settings (`live_os.settings_admin`), `WorldDatabaseRouter` still routes session reads and writes to the control `default` database, while `allow_migrate` permits `sessions` migrations on world aliases so `migrate_world` creates the table required by split runtime sites. The world login form writes the selected `world_id` into session state, and middleware prevents that session from being reused across a different world.
