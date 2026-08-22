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

3. **守约者通过资格获得更多功能。** 守约者资格由当前有效的 `ROLE_COVENANTER` 任命表达。workspace 通过 `AuthorizationService` 检查具体权限并展示对应功能模块（任务、事件反馈事务、议事与维护入口等）；功能扩展来自有效资格、职责及其权限绑定，不是"切换 workspace 版本"。

   **当前落地**：完整 workspace 主授权看 active `ROLE_COVENANTER`（`member_has_role(member, ROLE_COVENANTER)`）。`SUSPENDED` / `EXITED` 作为生命周期禁用状态行使 veto——即使有 `ROLE_COVENANTER`，禁用状态成员也不能进入完整 workspace。`Member.status` 只作为生命周发展示字段，不作为权限来源。

4. **守约者编号不是登录账号，也不是权限来源。**
   - 登录仍使用 `User.username`，不因获得正式编号而创建新账号。
   - 守约者编号（如 `#1`）是一次性发放的 Credential Grant，永不复用，退出后保留为历史归属证明。
   - 编号不参与任何权限判断。成员退出后 RoleAssignment 撤销、workspace 功能回收，编号只作为"曾经是第几号守约者"的公开记录存在。

## 当前功能

当前最小工作台覆盖：

- 查看当前成员状态和运行环境，并从首页进入任务中心及积分功能入口。
- 在任务中心查看本人的当前任务、可领取任务和最近结束任务。
- 在任务详情领取开放任务，或提交本人已领取任务的劳动记录和证据引用。
- 从公开事件详情提交纠错、意见、投诉、举报、复核或风险反馈。
- 从"我的事务"进入相关任务或事件反馈详情，查看处理状态和结果。
- 维护公开资料（公开姓名和系统管理的头像），所有注册用户（含报名审核中的申请人）可用。

### 首页竖版页面外壳

Workspace 首页在手机、平板和桌面端共用同一套单列竖版布局：页头与主体位于同一个至少满屏高的纯白应用画布中。画布使用完整可用宽度，最大宽度为 `480px`，超过该宽度后水平居中，外部视口继续使用灰色背景，自然形成页面边界；视口不超过 `480px` 时白色画布铺满可用宽度。

外部视口变宽时，首页内部的导航分组、事务分组、待处理事项和核心状态不会重新展开为桌面多列。当前阶段只建立稳定画布，不删除、合并或替换任何现有模块；后续视觉更新继续按独立步骤逐模块接近设计稿，并在每一步确认功能入口与权限边界。

### 首页紧凑页头

完整成员的 Workspace 首页使用专用紧凑页头，取代面向宽屏网站的横向公共页头。共享运行时品牌文案统一为“大苹果社区”；页头在同一行左侧通过运行时导航上下文显示该品牌并指向首页地址，右侧是一个带"页面导航"可访问名称的折叠菜单入口。菜单默认收起，展开后按 `runtime_nav.items` 的现有顺序完整展示当前用户可见的全部入口（首页、事件流、财务、资源库存、我的主页、工作台、退出），不因窄画布删除、重排或新增任何入口。

菜单使用浏览器原生折叠结构，无需 JavaScript 即可用键盘或指针展开、浏览和收起；每个入口保留原有 URL 与请求方法，其中"退出"继续使用带 CSRF 保护的 POST 表单，不降级为 GET 链接。页头不新增通知铃铛、未读数量、头像菜单、底部导航或任何尚无业务入口支撑的交互。

该紧凑页头仅作用于完整成员首页；任务中心、财务等 Workspace 子页面、报名工作台和其他运行时页面继续使用变更前的公共运行时页头结构。由于这些页面读取同一个运行时品牌上下文，它们也显示“大苹果社区”，但导航权限和行为不受影响。

### 首页顶部欢迎与状态摘要

紧凑页头之后，Workspace 首页以轻量的白色欢迎区域开场，依次展示"你好，"和"欢迎回到工作台"，不再使用早期面向旧后台风格的整块黄色英雄卡与重阴影。欢迎文案是稳定文案，不根据客户端或服务端时间切换"早上好/下午好"。

欢迎文案下方是一张细边框、无重阴影的双列成员状态摘要卡：左列展示 `Member` 的当前状态显示值及当前成员的资格或派生身份，右列展示当前 world 标识和模拟日。成员编号与职责位于同一卡片底部的可换行元数据行，职责仍按既有身份数据循环展示，不写死展示值，也不在卡片下方保留零散的独立信息行。

Workspace 首页不再展示当前积分、可用积分、历史贡献或近期积分流水，也不再为这些首页模块查询积分汇总与账本记录。积分权威数据、积分转账、兑换订单及财务/报销入口保持不变；成员财务聚合页面留待后续独立规划。页面不使用设计稿中的示例积分、通知按钮或底部导航。

### 首页顶部导航

Workspace 首页顶部入口位于“快捷操作”区，按用途使用具名分组，不使用按钮颜色区分。每个可见分组以三列等宽卡片展示，卡片包含语义图标和完整文字名称：

- **个人功能**：任务中心、财务 / 报销、申请执衡者、积分转账、兑换订单、公开资料。
- **治理职责**：成员报名审核、招募方向、财务职责、待处理提案。
- **考试维护**：执衡者考试配置。
- **运营管理**：创建任务、任务验收、兑换履约、积分预算、商户结算、资源库存、采购管理。

分组只调整信息结构，不改变任何入口的 URL、组内顺序或权限条件。普通成员始终看到个人功能；治理职责、考试维护和运营管理仅在当前成员至少拥有其中一个可见入口时展示，分组容器本身不授予权限。图标复用 Live OS 本地 Lucide 资源并标记为装饰性内容；即使图标脚本不可用，文字链接仍可阅读和操作。

### 首页统一事务投影

完整 Workspace 首页优先提供"我的事务"统一工作视图。它把与当前成员有关的现有任务、事件反馈、审批提案和采购处理投影为一致的页面信息，并区分：

- 需要我处理：现有领域规则确认当前成员可以执行下一步；
- 等待他人：当前成员与事项有关，但下一步属于其他成员或责任角色；
- 最近结束：近期已经进入领域终态的相关事项。

每项投影尽量展示稳定事项标识、领域类型、原始业务状态、责任归属、当前处理方、下一动作和更新时间。现有模型不能可靠确认具体责任人时，页面显示责任角色或"暂未明确"，不会为了补齐展示而创建新的责任事实。

"我的事务"以轻量区段呈现，三个分组按"需要我处理""等待他人""最近结束"顺序组织为带数量标签的标签页，默认激活"需要我处理"，同一时间只突出一个分组。标签页使用与设计稿一致的下划线风格（选中标签下方一条 2px 下划线与深色文字，未选中为浅灰文字），标题下保留灰色分割线；下划线通过 `border-b-2 border-primary` 等 daisyUI/Tailwind 工具类实现，颜色跟随主题主色，不为单个模块单独写颜色。Workspace 首页启用接近设计稿黑白配色的自定义 `bigapple` 主题（黑色主色、白色背景），以最小化各模块的额外颜色代码。标签页采用页面内渐进增强：服务端仍渲染全部分组和事务事实，脚本不可用时三个分组按原顺序连续可读；脚本可用时仅切换可见面板并同步 `aria-selected`、roving `tabindex` 与 `hidden`，支持点击、左右方向键、Home 和 End。每个事务条目显示为紧凑的白色描边卡片，完整保留类型、状态、标题、稳定事项标识、责任、当前处理方、下一步、更新时间和详情入口；行动分组详情使用"进入处理"，等待与结束分组使用中性的"查看详情"，没有目标链接的事务不渲染详情按钮。零事项分组收敛为轻量单行空状态。面向实施过程的迁移期说明已经删除，相关历史决定继续保留在 OpenSpec 清单中。

该视图只是 Workspace 请求期间生成的只读投影，不是新的通用事务模型，不统一各领域状态机，也不参与授权。任务、事件反馈、提案和采购动作仍由各自领域入口、service 和 `AuthorizationService` 处理；尚未领取的开放任务属于参与机会，不计入个人事务。

当前处于迁移对照阶段：新的"我的事务"区域位于仍保留的旧首页模块之前。原有"当前任务""可领取任务""下一步动作""个人任务历史""相关事件"、旧"申诉状态"、成员核心财务状态和近期积分流水均已在逐项确认后删除。资源预警已迁入仅管理员可访问的 `/workspace/inventory/`。事件反馈创建入口位于 `/events/{event_id}/`，Workspace 只保留事务投影。

## 表单入口

```text
POST /workspace/tasks/{task_id}/claim/
POST /workspace/tasks/{task_id}/submit-labor/
POST /events/{event_id}/
```

任务列表入口为 `GET /workspace/tasks/`，任务详情入口为 `GET /workspace/tasks/{task_id}/`。事件反馈详情入口为 `GET /event-feedbacks/{feedback_id}/`。任务动作和反馈处理都通过对应领域服务完成，并写入统一事件账本。

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

### 执衡者资格考试

```text
GET/POST /workspace/deliberator-exam/
GET/POST /workspace/deliberator-exam/<attempt_id>/
```

当前有效守约者且没有有效执衡者任期时，可以从工作台开始资格考试。系统按当前政策在服务端随机抽题、保存私有快照并评分；通过后立即创建一年期执衡者任期，未通过不创建任期。页面只展示本次题目、作答、得分、及格线和结果，不返回题库正确答案。

### 公开反馈

注册用户可以通过 `/feedback/` 和 `/feedback/new/` 提交公开问题、建议、担忧、提案种子或其他反馈。反馈是公众参与层，不是正式治理提案，不直接改变系统权威状态。

反馈页面会显示作者公开身份并链接到 `/u/<member_no>/`。管理员可以回应、关闭、隐藏或关联正式提案；普通注册用户不能执行这些维护操作。`hidden` 反馈不会出现在公开列表或首页。

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

### 财务审核职责任命

```text
GET/POST /workspace/finance/reviewer-appointments/
```

该页面当前只展示有效财务审核员和统一提案流程迁移说明。财务审核职责的提名、表决和执行尚未由新系统承接，所有写操作失败关闭；页面不会创建任命提案，也不会直接授予角色或权限。未来恢复该流程时，执行结果仍只能授予财务审核及查看审核材料所需权限，不得捆绑付款或公开附件发布能力。

### 积分功能（守约者 + 管理员）

```text
GET  /workspace/credits/budgets/                # 积分预算（管理员：发行池余额、任务锁定预算、发行积分、锁定/退回预算）
POST /workspace/credits/budgets/
GET  /workspace/credits/transfer/              # 积分转账（守约者）
POST /workspace/credits/transfer/
GET  /workspace/credits/redemption/             # 兑换订单列表、创建、取消、报告履约问题（守约者）
POST /workspace/credits/redemption/
GET  /workspace/credits/redemption/review/      # 兑换履约（管理员）
POST /workspace/credits/redemption/review/
GET  /workspace/credits/merchant-settlements/   # 商户结算记录（管理员看全部，现金结算商户 operator 看自己的）
```

工作台首页不展示积分数值或积分流水，但继续提供积分转账和兑换订单入口。管理员额外可见积分预算、兑换履约入口；管理员或现金结算商户经营者可见商户结算入口。积分余额、历史贡献、积分流水以及与本人相关的财务信息未来由独立的成员财务页面承接，当前不在本次删除中提前定义。

#### 积分预算（管理员）

积分发行到公共池，管理员为任务锁定预算。锁定预算从发行池扣除，任务发布前必须已有足够锁定预算。未用预算可退回发行池。表单使用 per-render `idempotency_key` 防重复提交。

#### 商户规则

- `cash_settlement_merchant`：可通过兑换订单关联，履约后生成人民币应付结算记录。
- `member_micro_merchant`：不走兑换订单，应使用成员间积分转账。
- 商户结算记录不是积分提现，不代表商户持有可流通积分。

### 任务管理（管理员）

```text
GET  /workspace/tasks/new/       # 创建任务草稿、发布任务（管理员）
POST /workspace/tasks/new/
GET  /workspace/tasks/review/    # 查看 pending_review 任务、验收通过/驳回（管理员）
POST /workspace/tasks/review/
```

- `base_points=0` 表示无积分奖励任务，可创建和发布，不需要锁定预算。
- `base_points>0` 的任务**发布前必须有足够锁定预算**（预算先行）。
- 有积分任务验收通过后从锁定预算发放积分；0 积分任务验收通过只改变任务状态，不发放积分，不增加余额/历史贡献。
- 验收驳回时积分预算保留，不退回发行池。

### 招募方向维护（管理员）

```text
GET  /workspace/recruitment/
POST /workspace/recruitment/  (action=create / action=update)
```

管理员可以在工作台维护报名页 `/workspace/apply/` 展示的申请方向配置：
- 新增招募方向模板（`action=create`）：创建受限 `CredentialTemplate`（certificate / public / active），自动写入 `metadata.recruitment`。
- 更新已有方向配置（`action=update`）：修改 `show_on_application`、`public_label`、`public_description`、`required_count`、`sort_order`，并同步 `CredentialTemplate.name` 和 `description`。
- 不支持删除模板——只能通过取消"在报名页展示"来隐藏。
- 不发放任何 `CredentialGrant`，新增方向不授予 Role。

普通成员和未登录用户看不到该入口。

### 成员报名处理（管理员）

`/workspace/` 在守约者工作台之外，为具备 `governance.view_admin` 权限的管理员提供成员报名处理入口。普通守约者、待处理报名人、未绑定 `Member` 的 Django staff/superuser 都看不到入口，直接访问处理 URL 返回 403。

`/workspace/apply/` 提交后保存 `MemberApplication` 并关联唯一准入提案。当前 world 没有已发布准入政策时，提案显示"等待政策配置"；发布政策后，等待提案会冻结该版本、生成选民快照并进入表决。管理员身份不自动产生投票权。

管理员可以在 `/workspace/proposals/member-admission-policy/` 发布选民角色集合、通过与拒绝阈值、最低参与人数、期限和到期未决处理。登录且绑定 Member 的快照选民均可进入统一提案页，贡献者无需先取得守约者资格；服务层仍会在每次投票和计票时按冻结规则复核当前资格，资格失效后的旧票不再计入结果。达到冻结条件时系统自动判定；截止后的人工触发判定需要独立的 `governance.resolve_proposals` 权限，并记录实名触发人。有 `governance.manage_people` 权限的成员执行已通过提案，系统通过角色任命服务授予一年期守约者资格。

```text
GET  /workspace/applications/                                          # 报名列表（按准入进度筛选）
GET  /workspace/applications/<application_id>/                         # 报名详情与关联准入提案状态
GET|POST /workspace/proposals/member-admission-policy/                 # 准入政策查看与发布
GET  /workspace/proposals/                                             # 统一提案、资格解释与当前票数
POST /workspace/proposals/<proposal_id>/vote/                          # 实名投票或追加改票修订
POST /workspace/proposals/<proposal_id>/finalize/                      # 截止后按冻结规则判定
POST /workspace/proposals/<proposal_id>/execute/                       # 有权人员幂等执行
```

不存在以下路由：

```text
POST /workspace/applications/<application_id>/review/
POST /workspace/applications/<application_id>/create-admission-proposal/
```

## 与 Control 后台的关系

`/workspace/` 是成员本人使用的工作台，不承担底层管理职责。

成员账号创建、角色任命、提案处理、任务兜底维护、资源底层调整、事件反馈处理、仿真归档等高影响操作，统一通过 control 后台或领域服务完成；事件反馈不能在 Admin 中直接编辑。
