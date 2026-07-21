---
sidebar_position: 5
title: 项目执行计划
---

# 项目执行计划

## 定位

项目执行计划是主线任务线的数据库源头，不使用 Markdown 作为权威记录。

`bigapple001据点执行计划` 覆盖从 0 到 1 再到 100% 的全过程：招募、分批抵达、现场评估、开会制定计划、初步开荒、食堂、住房、光伏、仓储、办公、娱乐、民宿/旅馆、新成员接纳和后续扩容。

Markdown 文档只负责解释规则、边界和使用方式；计划本体必须可编辑、可版本化、可被模拟引用，也可以在未来导出为真实世界项目计划。

## 当前模型

当前第一版使用以下表：

- `core_project_plan`：执行计划总表，例如 `bigapple001据点执行计划`。
- `core_plan_revision`：计划版本。模拟运行应绑定某个已发布版本，避免后续编辑污染历史模拟结果。
- `core_plan_node`：计划节点，支持树状结构，可表示阶段、里程碑、工程包、运营包、治理节点、招募节点、抵达节点、容量门槛和扩容节点。
- `core_plan_dependency`：节点依赖，表示前置完成、资源门槛、容量门槛、治理确认或招募门槛。
- `core_plan_requirement`：节点需求，记录预算、人力、技能、材料、设备、空间、许可和容量需求。
- `core_plan_capacity_impact`：节点完成后的容量影响，例如新增床位、供餐能力、光伏装机、仓储体积、办公面积、娱乐空间和接待房间。
- `core_simulation_run`：一次基于计划版本的自动模拟运行。
- `core_plan_node_run_state`：某个计划节点在一次模拟中的实际状态。
- `core_simulation_turn`：自动模拟推进日志，供观察台回放。
- `core_simulation_failure`：自动模拟失败记录。
- `core_plan_revision_proposal`：由失败反哺出的计划修订建议。
- `core_plan_change_set`：由修订建议生成的结构化计划数据补丁。
- `core_plan_change_operation`：变更集中的单条计划数据操作。

`core_task.plan_node_id` 是可选关联。它表示具体任务服务于哪个主线节点；为空时表示临时运营任务。

## 节点粒度

节点应足够细，至少能回答：

- 这个节点为什么存在。
- 它属于哪个阶段或上级节点。
- 它是不是必要节点。
- 它预计需要几天。
- 它预计需要多少钱。
- 它需要多少人或多少人天。
- 它需要哪些技能、物资、设备或手续。
- 它的完成标准是什么。
- 它完成后会增加或消耗哪些容量。
- 它是否可以分阶段扩容。
- 它是否允许模拟提出调整建议。

## 版本策略

当前约定：

- 计划和节点可以在 Admin 中编辑。
- 对外可引用的基线使用 `PlanRevision` 表达。
- 模拟运行后续应绑定具体 `PlanRevision`。
- 模拟结果不能直接改写计划本体，只能产生修订建议。
- 人工确认采纳 `PlanChangeSet` 后，系统复制源 `PlanRevision` 并应用结构化操作，生成新的计划版本；源版本不可修改。

## 失败反哺机制

当前第一版自动模拟已经建立反馈闭环：

1. 观察台点击“自动跑到失败”。
2. 系统基于当前激活计划创建 `SimulationRun`。
3. 系统按计划节点顺序推进必要的非阶段节点。
4. 每个完成节点都会写入 `PlanNodeRunState`、`SimulationTurn` 和公开事件。
5. 当节点触发预算、人力、技能、资源、依赖、人员状态或工程责任闭环失败时，写入 `SimulationFailure`。
6. 失败会生成一条 `PlanRevisionProposal`。
7. 修订建议会生成一条 `PlanChangeSet` 和多条 `PlanChangeOperation`。
8. 修订建议和变更集都保持 `draft` 状态，等待人审阅。

这种设计的重点是分离三类事实：

- 计划事实：`ProjectPlan`、`PlanRevision`、`PlanNode` 等表记录“我们打算怎么做”。
- 模拟事实：`SimulationRun`、`PlanNodeRunState`、`SimulationTurn`、`SimulationFailure` 记录“按这个计划跑会发生什么”。
- 修订建议：`PlanRevisionProposal` 记录“从失败中学到了什么，建议怎么改”。
- 数据补丁：`PlanChangeSet` 和 `PlanChangeOperation` 记录“如果采纳，应该怎样改计划数据库”。

自动模拟不能直接修改计划事实。只有当人采纳建议并应用 `PlanChangeSet` 生成新的 `PlanRevision`，并把它发布为下一轮基线后，主线计划才算真正变化；后续仿真应基于新的计划版本继续推演。

## 计划数据 patch

结构化变更操作使用声明式数据描述，不直接执行数据库写入。第一版会生成以下类型：

- `add_node`：新增一个前置计划节点，例如 `C3-GRID-PRESCREEN 并网预筛与接入风险判断` 或 `C3-STRUCTURE-DOC 结构/建筑安全责任文件取得`。
- `add_dependency`：新增依赖，例如让 `C3 光伏一期 0.5MW` 依赖并网预筛、结构安全责任文件、光伏设计责任文件、电气并网责任文件、施工质量责任和验收归档责任节点。
- `add_requirement`：新增节点需求，例如记录关键责任文件缺口。
- `update_node_field`：建议调整节点字段，例如延长工期。
- `add_capacity_impact`：新增节点完成后的容量影响。
- `reduce_admission`：建议降低接纳规模或暂停接纳，当前会记录到新版本 metadata 中供人工继续结构化。
- `note`：暂时无法结构化的补充说明。

“采纳变更集”的正确流程是：

1. 人审核 `PlanRevisionProposal` 和 `PlanChangeSet`。
2. 人在仿真实验后台 run 详情页点击“采纳为下一轮仿真基线”。仿真 world 的计划变更集不应从普通 Django Admin 详情页处理，因为普通 Admin 不携带 world 数据库上下文。
3. 服务层复制源 `PlanRevision`、节点、依赖、需求和容量影响。
4. 服务层按 `PlanChangeOperation.sequence` 应用操作到新版本。
5. 服务层发布新版本，并退役同一计划下旧的已发布版本。
6. 服务层把 `PlanChangeSet.status` 标记为 `applied`，写入 `applied_at`，并把 `applied_revision` 指向新版本。
7. 旧版本内容和旧模拟运行保持可复盘；重复应用同一个变更集会直接返回已生成的新版本，不会再复制一份。

应用计划变更和归档仿真 run 是两个独立决定：前者把经验采纳进下一版 `PlanRevision`，后者把本轮仿真历史保存为快照或明确废弃。归档不代表采纳计划变更，采纳计划变更也不代表 run 已归档。

## 当前 seed 计划

`python manage.py seed_demo --world-id realworld` 会写入：

- `plan-bigapple001`
- `plan-bigapple001-rev-v0_1_0`
- 30 个以上主线节点
- 节点依赖
- 预算和人天需求
- 光伏、床位、食堂、仓储、办公、娱乐、民宿等容量影响

当前主线阶段包括：

1. 招募与组队。
2. 分批抵达与临时集结。
3. 现场评估与开荒会议。
4. 初步开荒基础设施。
5. 第一轮扩容和新成员接纳。
6. 长期空间和对外服务扩张。

seed 数据同时包含 `res-cash` 现金资源，供自动模拟判断节点预算是否足够；成员画像中也包含部分中文技能，供技能缺口判断使用。`C3 光伏一期 0.5MW` 使用工程责任闭环判断：默认缺少结构/建筑安全、光伏设计、电气并网、施工质量和验收归档责任文件，因此会先生成责任文件前置节点建议，而不是把问题简化为成员技能不足。

## 零起点仿真基线

`bigapple001据点执行计划` 是成熟计划骨架，不等于真实项目的最早起点。第二轮仿真新增 `zero_start` 基线，用于表达“只有一个发起人，尚无成员池、候选场地、任务和资源”的状态。

`zero_start` 基线包含：

- 一个发起人 `founder-0001`。
- 一个计划 `plan-zero-start`。
- 一个已发布计划版本 `plan-zero-start-rev-v0_0_1`。
- 完整生命周期 `PlanNode` 主线骨架（25+ 个节点，覆盖 Z/A/B/C/D 阶段），只有 Z0 是 `IN_PROGRESS`，其余均为 `PLANNED`。这些是主线 PlanNode 骨架，不是 `Task`、不是资源、不是真实成员池。
- 不预置任务、资源、候选场地、成熟成员池或 `SimulationRun` / `SimulationTurn`。

`run_zero_start_simulation` 会从发起人自媒体曝光、主动报名和初筛开始按小时推进。虚拟主体先通过真实 world URL 提交成员报名和合作方报名表单，形成 `MemberApplication`、`PartnerApplication`、候选池、筛选结论和启动门槛缺口；不再由仿真代码直接造报名成员。每小时推进日志会记录报名漏斗、筛选漏斗、候选池、合作方线索、能力覆盖、文件签署方覆盖、当前阻塞项和下一步动作。它的失败反馈会生成结构化计划修订建议和可应用的 `PlanNode` / `PlanRequirement` 操作，提醒下一版计划应在 A0 抵达之前补上自媒体报名筛选、前 N 名成员能力矩阵、合作伙伴和文件签署方矩阵。

Z0 计划需求需要区分两类语义：

- 能力需求：需要成员或合作方具备实际能力，例如做饭、视频剪辑、资料整理、采购询价、现场后勤；不要求签字盖章文件。
- 文件责任需求：需要可归档、可追责、可作为决策依据的书面文件和签署方，例如结构报告、电气并网方案、施工安全方案、验收归档资料。

在启动门槛满足前，项目处于筹备阶段；报名人数或候选池形成不等于真实项目已经可以启动。

合作方增长同样按虚拟小时推进。早期可能只有施工辅助、设备渠道和物流线索；更长观察窗口中才会逐步出现结构安全评估、光伏系统设计、电气并网、施工安全质量和验收归档等可承担书面责任文件的主体。一次较长的观察窗口如果直接补齐成员能力矩阵和文件签署方矩阵，可以让 `SimulationRun` 进入 `completed`；如果仍未补齐，则继续停留在 `running`，等待下一段观察窗口。

## 首页"当前主线"模块

观察台首屏 hero 下方展示"当前主线"模块，数据契约由 `observer.mainline_context.build_mainline_context()` 构建，数据源为 `ProjectPlan`、`PlanRevision`、`PlanNode` 及相关模拟运行表。Markdown 不是权威数据源，数据库 `PlanRevision` / `PlanNode` 是权威源。

### 展示契约

| 字段 | 说明 |
| --- | --- |
| plan_title / revision_title | 当前激活计划和已发布版本标题 |
| stage | 当前阶段节点（优先 IN_PROGRESS/BLOCKED 的 stage/milestone 类型，其次从当前节点的父链推导） |
| current_nodes | IN_PROGRESS / BLOCKED 节点（优先非 stage 节点，最多 4 个） |
| next_nodes | PLANNED 节点中最靠前的 1-3 个 |
| blockers | 阻塞项，优先级：最新 `SimulationFailure` > 最新 `SimulationTurn.metadata.blockers` > `PlanRevisionProposal` > 节点 `risk_notes` |
| progress | `required_completed / required_total` 及百分比 |
| latest_run | 最近一次 `SimulationRun` 的状态、失败摘要 |
| proposal_summary | 修订建议数量与第一条标题（如有） |

### zero_start 基线节点详情

> 本段由 AI 按 `live_os/demo_seed/zero_start.py` 中 `ZERO_START_NODES` 同步生成，不是自动生成物。如需核实最新值，请直接读取源码。

`seed_world --template zero_start` 写入 25 个 `PlanNode`，仅 Z0 是 `IN_PROGRESS`，其余均为 `PLANNED`。节点通过 `get_or_create` 幂等写入，重复 seed 不增加重复记录。

---

#### Z 阶段：零起点筹备

**Z0 启动门槛筹备**

| 字段 | 值 |
| --- | --- |
| node_type | `MILESTONE` |
| status | **`IN_PROGRESS`** |
| sequence | 10 |
| planned_duration_days | 14 |
| required_people | 1–3 |
| description | 确认自媒体渠道启动、报名入口开放、初筛标准和候选人沟通流程已预备。 |
| completion_criteria | 报名漏斗已建立、初筛标准已文档化 |
| risk_notes | 若自媒体曝光不足或报名标准未文档化，启动将延迟。 |

**Z1 自媒体报名与初筛**

| 字段 | 值 |
| --- | --- |
| node_type | `RECRUITMENT` |
| status | `PLANNED` |
| parent | Z0 |
| sequence | 20 |
| planned_duration_days | 7 |
| required_people | 2–4 |
| description | 通过自媒体渠道发布招募信息，对报名者进行首轮初筛并形成候选池。 |
| completion_criteria | 候选池 ≥ N 人 |
| risk_notes | 报名质量过低时初筛效率会大幅下降。 |

**Z2 候选成员能力矩阵**

| 字段 | 值 |
| --- | --- |
| node_type | `GOVERNANCE` |
| status | `PLANNED` |
| parent | Z0 |
| sequence | 30 |
| planned_duration_days | 5 |
| required_people | 2–3 |
| description | 对候选池成员建立能力矩阵，覆盖关键技能和可承担角色。 |
| completion_criteria | 能力矩阵覆盖前 N 名候选人 |
| risk_notes | 若关键技能门类空缺，需要定向补招或合作方承接。 |

**Z3 合作方与责任文件签署方矩阵**

| 字段 | 值 |
| --- | --- |
| node_type | `GOVERNANCE` |
| status | `PLANNED` |
| parent | Z0 |
| sequence | 40 |
| planned_duration_days | 10 |
| required_people | 2–5 |
| description | 梳理必须由外部合作方或责任主体签署的文件清单，建立签署方矩阵。 |
| completion_criteria | 责任文件清单已编制、签署方矩阵已建立 |
| risk_notes | 缺少可签署主体时后续工程节点无法通过责任闭环校验。 |

#### A 阶段：成员抵达与临时集结

**A0 分批抵达与临时集结**

| 字段 | 值 |
| --- | --- |
| node_type | `STAGE` |
| status | `PLANNED` |
| sequence | 100 |
| planned_duration_days | 14 |
| required_people | 3–10 |
| description | 先遣队抵达后建立临时指挥点，后续批次按计划抵达并完成登记和临时安置。 |
| completion_criteria | 临时指挥点就绪、首批抵达登记完成、临时安置完成 |
| risk_notes | 交通和天气可能导致分批抵达延迟。 |

**A1 先遣队抵达并建立临时指挥点**

| 字段 | 值 |
| --- | --- |
| node_type | `OPERATIONS` |
| status | `PLANNED` |
| parent | A0 |
| sequence | 110 |
| planned_duration_days | 3 |
| required_people | 3–6 |
| description | 先遣队率先抵达目标区域，搭建临时指挥与通信设施。 |
| completion_criteria | 指挥点搭建完成、通信联络测试通过 |
| risk_notes | 无 |

**A2 分批抵达登记和临时安置**

| 字段 | 值 |
| --- | --- |
| node_type | `OPERATIONS` |
| status | `PLANNED` |
| parent | A0 |
| sequence | 120 |
| planned_duration_days | 11 |
| required_people | 2–6 |
| description | 按批次完成抵达人员登记、健康筛查和临时住宿分配。 |
| completion_criteria | 全部批次登记完成 |
| risk_notes | 若临时住宿容量不足将导致抵达批次积压。 |

#### B 阶段：初步开荒基础设施

**B0 初步开荒基础设施**

| 字段 | 值 |
| --- | --- |
| node_type | `STAGE` |
| status | `PLANNED` |
| sequence | 200 |
| planned_duration_days | 30 |
| required_people | 8–20 |
| description | 建立确保成员基本生存和协作所需的基础设施：食宿、供水、供电、卫生、仓储。 |
| completion_criteria | 食住水电网卫生六大系统可运维 |
| risk_notes | 物资采购周期长，机电设备进场可能需要外部承包商。 |

**B1 建立临时公共食堂**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 210 |
| planned_duration_days | 7 |
| required_people | 3–6 |
| description | 搭建临时厨房和就餐区，建立食材采购与餐食供应制度。 |
| completion_criteria | 厨房和就餐区搭建完成、首批食材到位、出餐流程测试通过 |
| risk_notes | 食材供应链不完整时需提前储备干粮。 |

**B2 搭建临时住宿和洗浴区**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 220 |
| planned_duration_days | 10 |
| required_people | 4–10 |
| description | 搭建帐篷/集装箱宿舍和临时洗浴设施。 |
| completion_criteria | 住宿容量 ≥ 首批人数、洗浴设施可用 |
| risk_notes | 极端天气可能延缓搭建进度。 |

**B3 临时供水与净水系统**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 230 |
| planned_duration_days | 12 |
| required_people | 3–6 |
| description | 勘探水源、铺设临时供水管线并部署净水设备。 |
| completion_criteria | 水源确认、净水设备出水达标 |
| risk_notes | 地下水水质需提前检测。 |

**B4 临时供电和安全照明**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 240 |
| planned_duration_days | 10 |
| required_people | 3–5 |
| description | 部署柴油发电机、临时配电箱和道路/营地安全照明。 |
| completion_criteria | 发电机就位、主要通道照明覆盖 |
| risk_notes | 燃油消耗高，需预估日耗量并提前储备。 |

**B5 公共卫生和垃圾处理制度**

| 字段 | 值 |
| --- | --- |
| node_type | `OPERATIONS` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 250 |
| planned_duration_days | 5 |
| required_people | 2–4 |
| description | 制定营地卫生和垃圾分类处理制度，防止疫病。 |
| completion_criteria | 卫生制度已发布、垃圾处理点就绪 |
| risk_notes | 无 |

**B6 仓储一区和工具库**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | B0 |
| sequence | 260 |
| planned_duration_days | 8 |
| required_people | 3–6 |
| description | 搭建首批仓储空间，存放工具、建材和关键耗材。 |
| completion_criteria | 仓储一区投入使用 |
| risk_notes | 缺少货架和防潮措施会导致物资损耗。 |

#### C 阶段：第一轮扩容与新成员接纳

**C0 第一轮扩容和新成员接纳**

| 字段 | 值 |
| --- | --- |
| node_type | `STAGE` |
| status | `PLANNED` |
| sequence | 300 |
| planned_duration_days | 45 |
| required_people | 10–30 |
| description | 评估现有容量后接纳新一批成员，并启动正式住房、光伏和扩容仓储。 |
| completion_criteria | 新成员审核完毕、一期住房可入住、光伏发电上线 |
| risk_notes | 扩容速度受限于基建材料供应和人力投入。 |

**C1 公共食堂一期**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | C0 |
| sequence | 310 |
| planned_duration_days | 14 |
| required_people | 4–8 |
| description | 将临时食堂升级为标准化公共食堂，支持日均 100+ 人就餐。 |
| completion_criteria | 食堂硬件就绪、配餐排班系统运行 |
| risk_notes | 若无稳定食材供应链需延续干粮过渡。 |

**C2 正式住房一期**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | C0 |
| sequence | 320 |
| planned_duration_days | 30 |
| required_people | 6–15 |
| description | 建设首批正式住房（木结构或预制件），解除安置上限。 |
| completion_criteria | 一期住房完工并验收 |
| risk_notes | 建材到货延迟是最大风险。 |

**C3 光伏一期 0.5MW**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | C0 |
| sequence | 330 |
| planned_duration_days | 20 |
| required_people | 4–8 |
| description | 安装首批光伏面板与储能系统，替代柴油发电机。 |
| completion_criteria | 光伏并网发电、储能系统可用 |
| risk_notes | 光伏板运输和安装需要专业电工。 |

**C4 仓储空间一期扩容**

| 字段 | 值 |
| --- | --- |
| node_type | `WORK_PACKAGE` |
| status | `PLANNED` |
| parent | C0 |
| sequence | 340 |
| planned_duration_days | 10 |
| required_people | 3–6 |
| description | 扩大仓储面积以应对扩容带来的物资增长。 |
| completion_criteria | 扩容仓储存量翻倍 |
| risk_notes | 无 |

**C5 第一轮成员接纳评审**

| 字段 | 值 |
| --- | --- |
| node_type | `GOVERNANCE` |
| status | `PLANNED` |
| parent | C0 |
| sequence | 350 |
| planned_duration_days | 7 |
| required_people | 3–5 |
| description | 依据能力矩阵和社区规则对新一批申请人进行评审和接纳决策。 |
| completion_criteria | 评审记录已归档、接纳名单已公示 |
| risk_notes | 评审效率受信息完备程度影响。 |

#### D 阶段：稳定运营与治理闭环

**D0 稳定运营与治理闭环**

| 字段 | 值 |
| --- | --- |
| node_type | `STAGE` |
| status | `PLANNED` |
| sequence | 400 |
| planned_duration_days | 30 |
| required_people | 8–20 |
| description | 当扩容完成后进入日常运营治理：排班常态化、财务台账闭环、安全巡检和下一轮计划修订。 |
| completion_criteria | 运营排班制度化、财务台账完成首个周期 |
| risk_notes | 治理闭环依赖所有前置阶段已稳定。 |

**D1 食堂与住宿常态化排班**

| 字段 | 值 |
| --- | --- |
| node_type | `OPERATIONS` |
| status | `PLANNED` |
| parent | D0 |
| sequence | 410 |
| planned_duration_days | 7 |
| required_people | 4–8 |
| description | 建立食堂轮值和住宿维护的常态化排班制度。 |
| completion_criteria | 排班表发布、运转满 1 周 |
| risk_notes | 无 |

**D2 财务与物资台账闭环**

| 字段 | 值 |
| --- | --- |
| node_type | `GOVERNANCE` |
| status | `PLANNED` |
| parent | D0 |
| sequence | 420 |
| planned_duration_days | 10 |
| required_people | 2–4 |
| description | 建立收支记录、物资出入库台账和定期审计机制。 |
| completion_criteria | 首个周期台账完成 |
| risk_notes | 无专人负责时台账质量难以保证。 |

**D3 安全巡检与事故演练**

| 字段 | 值 |
| --- | --- |
| node_type | `OPERATIONS` |
| status | `PLANNED` |
| parent | D0 |
| sequence | 430 |
| planned_duration_days | 7 |
| required_people | 2–4 |
| description | 制定安全巡检清单并定期开展应急演练。 |
| completion_criteria | 巡检清单执行、应急演练完成 1 次 |
| risk_notes | 无 |

**D4 第二轮计划修订与容量评估**

| 字段 | 值 |
| --- | --- |
| node_type | `GOVERNANCE` |
| status | `PLANNED` |
| parent | D0 |
| sequence | 440 |
| planned_duration_days | 10 |
| required_people | 3–6 |
| description | 评估当前运营容量并启动第二轮计划修订，为下一步扩张或优化提供决策依据。 |
| completion_criteria | 容量评估报告、第二轮计划修订草案 |
| risk_notes | 评估质量取决于前置台账数据的完整性。 |

---

仿真反馈必须通过 `PlanRevisionProposal` / `PlanChangeSet`，人工采纳后生成新 `PlanRevision`，再同步文档摘要。

### 模块结构变更

- 旧"任务与提案线索"cards 及其相关 `dashboard.missions`、`mission_list.html`、`dashboard/partials/missions/` 路由已在 UI 层删除。
- `dashboard_context` 中不再暴露 `missions` 字段；改为 `mainline`。
- `map_points` 中的主线点位从 `context["mainline"]["current_nodes"]` 取，不再从 `missions` 取。

## 当前入口

Admin 编辑入口：

```text
http://127.0.0.1:20100/admin/
```

观察台展示入口：

```text
http://127.0.0.1:20101/
```

观察台首屏展示"当前主线"模块（阶段、当前节点、下一步、阻塞项、进度、最近仿真状态）。观察台也可以启动自动模拟，并展示最近一次运行的失败、节点状态、修订建议和结构化变更集：

```text
POST /admin/simulation-lab/run-until-failure/
```

## 后续演进

后续应继续补齐：

- 专门的计划编辑后台，而不是长期依赖 Django Admin。
- 计划节点状态流转服务。
- 多次模拟结果聚合、对比和统计。
- 计划导出和对比功能。
- 节点级成本分解、物资清单、责任人和审批链。
