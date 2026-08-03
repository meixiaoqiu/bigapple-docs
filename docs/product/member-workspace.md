---
sidebar_position: 1
title: 成员工作台
---

# 成员工作台

## 入口

成员工作台是固定 world 站点的唯一成员自助入口：

```text
/workspace/
```

未登录用户访问 `/workspace/` 时，展示 **workspace 入口门禁页**（`templates/workspace/login_required.html`），引导注册、登录或先去观察台，不直接返回 403。登录后才进入个人 workspace。

本地开发常用入口：

```text
http://127.0.0.1:20101/workspace/
http://127.0.0.1:20102/workspace/
```

旧 `/member/` 入口已移除，不再保留兼容路径。

## 身份来源

工作台不从 URL 选择成员，也不使用 `/members/{member_no}/workspace/` 这类入口。当前成员必须从登录账号绑定关系推导：

```text
User -> Member
```

如果当前登录账号没有绑定目标 world 中的 `Member`，访问 `/workspace/` 会被拒绝。

## 长期架构：所有注册用户都拥有最小 workspace

当前 workspace 入口只对已绑定 Member 的登录用户开放，守约者和报名审核中的申请人看到的页面不同。长期架构下，**所有注册用户都拥有最小 workspace**，其设计原则如下：

1. **注册即获 workspace。** 通过 `/register/` 注册并绑定 Member 的用户，无论是否通过守约者审核，都可访问 `/workspace/`。最小 workspace 不依赖守约者身份。`/workspace/apply/` 是登录后的守约者报名入口，不会创建账号。

2. **最小 workspace 至少包含：**
   - 公开资料维护（`/workspace/profile/`）：编辑公开姓名并上传、替换或恢复默认头像，展示在 Observer 公开主页。
   - 守约者报名入口：已注册但尚未成为守约者的用户，可在 workspace 内发起守约者报名申请。
   - 基础身份信息展示：当前角色、Credential 列表、近期活动摘要。

3. **守约者通过资格获得更多功能。** 守约者资格由当前有效的 `ROLE_COVENANTER` 任命表达。workspace 通过 `AuthorizationService` 检查具体权限并展示对应功能模块（任务、申诉、议事与维护入口等）；功能扩展来自有效资格、职责及其权限绑定，不是“切换 workspace 版本”。

   **当前落地**：完整 workspace 主授权看 active `ROLE_COVENANTER`（`member_has_role(member, ROLE_COVENANTER)`）。`SUSPENDED` / `EXITED` 作为生命周期禁用状态行使 veto——即使有 `ROLE_COVENANTER`，禁用状态成员也不能进入完整 workspace。`Member.status` 只作为生命周发展示字段，不作为权限来源。

4. **守约者编号不是登录账号，也不是权限来源。**
   - 登录仍使用 `User.username`，不因获得正式编号而创建新账号。
   - 守约者编号（如 `#1`）是一次性发放的 Credential Grant，永不复用，退出后保留为历史归属证明。
   - 编号不参与任何权限判断。成员退出后 RoleAssignment 撤销、workspace 功能回收，编号只作为"曾经是第几号守约者"的公开记录存在。

## 当前功能

当前最小工作台覆盖：

- 查看当前成员状态、积分和当前任务。
- 领取可领取任务。
- 提交已领取任务的劳动记录和证据引用。
- 提交申诉。
- 查看个人任务历史、近期事件、资源预警和申诉状态。
- 维护公开资料（公开姓名和系统管理的头像），所有注册用户（含报名审核中的申请人）可用。

### 首页统一事务投影

完整 Workspace 首页优先提供“我的事务”统一工作视图。它把与当前成员有关的现有任务、申诉、审批提案和采购处理投影为一致的页面信息，并区分：

- 需要我处理：现有领域规则确认当前成员可以执行下一步；
- 等待他人：当前成员与事项有关，但下一步属于其他成员或责任角色；
- 最近结束：近期已经进入领域终态的相关事项。

每项投影尽量展示稳定事项标识、领域类型、原始业务状态、责任归属、当前处理方、下一动作和更新时间。现有模型不能可靠确认具体责任人时，页面显示责任角色或“暂未明确”，不会为了补齐展示而创建新的责任事实。

该视图只是 Workspace 请求期间生成的只读投影，不是新的通用事务模型，不统一各领域状态机，也不参与授权。任务、申诉、提案和采购动作仍由原有领域入口、service 和 `AuthorizationService` 处理；尚未领取的开放任务属于参与机会，不计入个人事务。

当前处于迁移对照阶段：新的“我的事务”区域位于旧首页模块之前，但原有待处理事项、统计、下一步动作、任务历史、当前任务、可领取任务、积分流水、资源预警、相关事件和申诉状态全部保留。旧模块只会在后续逐项确认后单独删除或迁移。

## 表单入口

```text
POST /workspace/tasks/{task_id}/claim/
POST /workspace/tasks/{task_id}/submit-labor/
POST /workspace/disputes/
```

任务领取、劳动提交和申诉提交仍通过对应领域服务完成，并写入必要的业务事件和统一事件账本。

### 公开资料维护

```text
GET  /workspace/profile/
POST /workspace/profile/update/
POST /workspace/profile/avatar/upload/
POST /workspace/profile/avatar/remove/
GET  /u/<member_no>/avatar/
```

当前成员可以维护公开姓名并上传自己的头像，展示在 `/u/<member_no>/` 公开主页。头像支持 JPEG、PNG、WebP、GIF、BMP 和 TIFF，最大 10 MiB；系统在完整解码前检查图片边长和总像素，随后去除来源元数据、居中裁剪并统一保存为 `512 × 512` 静态 WebP，不保存原始文件名或原图。头像地址随每次成功替换或移除更新，避免浏览器继续展示旧缓存。头像属于当前展示资产，替换成功后旧头像会被清理，不作为永久审计附件保存。

头像上传与公开资料文本更新使用独立表单。成员不能指定或修改其他成员头像；拥有 `governance.manage_people` 的维护人员可以移除违规头像，但不能代成员上传。对象缺失或存储暂时异常时公开页面回退默认头像。公开主页包含身份头部、公开凭证列表、成员资格与职责，以及近期公开记录。不能编辑角色、权限或职责；成员资格与职责由 RoleAssignment 动态计算，不来自个人填写。

公开资料页（`/workspace/profile/`）的"我的凭证"区域展示当前成员的 Credential Grant 列表（通过 `credentials_for_member()` 获取），如守约者编号 `#1`。凭证只读显示，用户不能编辑。凭证是公开事实/荣誉/资格证明，不是权限来源。

### 公开反馈

注册用户可以通过 `/feedback/` 和 `/feedback/new/` 提交公开问题、建议、担忧、提案种子或其他反馈。反馈是公众参与层，不是正式治理提案，不直接改变系统权威状态。

反馈页面会显示作者公开身份并链接到 `/u/<member_no>/`。典守者可以回应、关闭、隐藏或关联正式提案；普通注册用户不能执行这些维护操作。`hidden` 反馈不会出现在公开列表或首页。

### 公开财务 / 报销

```text
GET  /workspace/finance/claims/
GET  /workspace/finance/claims/new/
POST /workspace/finance/claims/new/
GET  /workspace/finance/claims/<claim_id>/
POST /workspace/finance/claims/<claim_id>/review/
POST /workspace/finance/claims/<claim_id>/pay/
POST /workspace/finance/claims/<claim_id>/withdraw/
```

注册成员可以在 workspace 中提交自己的报销申请，并查看自己的报销状态。拥有 `finance.review` 或 `finance.pay` 权限的财务成员可以查看全部报销；普通成员不能查看他人的报销详情。

财务审核和付款不是用户自助资料的一部分，必须由财务角色执行。申请人不能审核或付款自己的报销；拒绝报销必须填写理由。已批准并付款的记录会生成只追加 `FinanceTransaction` 流水，并进入 `/finance/` 公开财务页。

### 积分功能（守约者 + 典守者）

```text
GET  /workspace/credits/budgets/                # 积分预算（典守者：发行池余额、任务锁定预算、发行积分、锁定/退回预算）
POST /workspace/credits/budgets/
GET  /workspace/credits/transfer/              # 积分转账（守约者）
POST /workspace/credits/transfer/
GET  /workspace/credits/redemption/             # 兑换订单列表、创建、取消、申诉（守约者）
POST /workspace/credits/redemption/
GET  /workspace/credits/redemption/review/      # 兑换履约（典守者）
POST /workspace/credits/redemption/review/
GET  /workspace/credits/merchant-settlements/   # 商户结算记录（典守者看全部，现金结算商户 operator 看自己的）
```

工作台首页显示当前积分、可用积分、历史贡献，并提供积分转账和兑换订单入口。典守者额外可见积分预算、兑换履约入口；典守者或现金结算商户经营者可见商户结算入口。

#### 积分预算（典守者）

积分发行到公共池，典守者为任务锁定预算。锁定预算从发行池扣除，任务发布前必须已有足够锁定预算。未用预算可退回发行池。表单使用 per-render `idempotency_key` 防重复提交。

#### 商户规则

- `cash_settlement_merchant`：可通过兑换订单关联，履约后生成人民币应付结算记录。
- `member_micro_merchant`：不走兑换订单，应使用成员间积分转账。
- 商户结算记录不是积分提现，不代表商户持有可流通积分。

### 任务管理（典守者）

```text
GET  /workspace/tasks/new/       # 创建任务草稿、发布任务（典守者）
POST /workspace/tasks/new/
GET  /workspace/tasks/review/    # 查看 pending_review 任务、验收通过/驳回（典守者）
POST /workspace/tasks/review/
```

- `base_points=0` 表示无积分奖励任务，可创建和发布，不需要锁定预算。
- `base_points>0` 的任务**发布前必须有足够锁定预算**（预算先行）。
- 有积分任务验收通过后从锁定预算发放积分；0 积分任务验收通过只改变任务状态，不发放积分，不增加余额/历史贡献。
- 验收驳回时积分预算保留，不退回发行池。

### 招募方向维护（典守者）

```text
GET  /workspace/recruitment/
POST /workspace/recruitment/  (action=create / action=update)
```

典守者可以在工作台维护报名页 `/workspace/apply/` 展示的申请方向配置：
- 新增招募方向模板（`action=create`）：创建受限 `CredentialTemplate`（certificate / public / active），自动写入 `metadata.recruitment`。
- 更新已有方向配置（`action=update`）：修改 `show_on_application`、`public_label`、`public_description`、`required_count`、`sort_order`，并同步 `CredentialTemplate.name` 和 `description`。
- 不支持删除模板——只能通过取消"在报名页展示"来隐藏。
- 不发放任何 `CredentialGrant`，新增方向不授予 Role。

普通成员和未登录用户看不到该入口。

### 成员报名处理（典守者）

`/workspace/` 在守约者工作台之外，为具备 `governance.view_admin` 权限的典守者提供成员报名处理入口。普通守约者、待处理报名人、未绑定 `Member` 的 Django staff/superuser 都看不到入口，直接访问处理 URL 返回 403。

`/workspace/apply/` 提交成员报名后，系统自动创建 `MemberApplication` 和 `member_admission` Proposal，提案直接进入 `VOTING` 状态。准入不存在独立的单人审核动作，完全由提案生命周期驱动。

member_admission 是 yes/no 二元表决，使用严格多数决：赞成票超过 eligible voters 半数时立即通过；反对票超过 eligible voters 半数时立即失败，并自动将关联 `MemberApplication` 设为 `REJECTED`。未形成多数前保持表决中；截止仍未通过则失败。分母始终是 `eligible_voters_snapshot_json` 的人数，不是已投票人数。普通 proposal 规则不变。

```text
GET  /workspace/applications/                                          # 报名列表（按准入进度筛选）
GET  /workspace/applications/<application_id>/                         # 报名详情（申请人资料 + 准入提案 + 投票 + 执行）
POST /workspace/proposals/<proposal_id>/vote/                          # 成员准入投 yes/no；反对必须填写理由
POST /workspace/proposals/<proposal_id>/execute/                       # 执行已通过准入提案
```

不存在以下路由：

```text
POST /workspace/applications/<application_id>/review/
POST /workspace/applications/<application_id>/create-admission-proposal/
```

## 与 Control 后台的关系

`/workspace/` 是成员本人使用的工作台，不承担底层管理职责。

成员账号创建、角色任命、提案处理、任务兜底维护、资源底层调整、申诉兜底处理、仿真归档等高影响操作，统一通过 control 后台或领域服务完成。
