---
sidebar_position: 3
title: 仿真开发命令
---

# 仿真开发命令

本文档说明本地开发中用于验证仿真闭环、零起点推进、归档、废弃和重置仿真 world 的命令。产品边界和页面职责见 [仿真与实验后台](../product/simulation.md)。

## 自动仿真闭环

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py run_simulation_smoke --world-id simulation0001 --settings=live_os.settings_admin
```

`run_simulation_smoke` 只接受仿真 world，会拒绝 `realworld`。它默认复用 `seed_world` 准备幂等演示数据，然后创建 `SimulationRun`，自动推进主线计划，检查 `SimulationTurn`、仿真 `Event`、节点状态和失败反馈是否完整；启用 world 数据库路由时，还会检查 `realworld` 关键表记录数没有变化。它验证的是自动推演闭环，不替代 HTTP 任务业务闭环。

## 零起点自媒体报名与启动门槛

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py seed_world simulation0001 --template zero_start --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py run_zero_start_simulation --world-id simulation0001 --hours 168 --settings=live_os.settings_admin
```

`zero_start` 模板只预置一个发起人、一个极简计划和一个已发布计划版本，不预置任务、资源、候选场地或成熟成员池。启用 `BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_ENABLED=true` 时，这个发起人就是配置的仿真 bootstrap admin 登录成员；未启用时才使用非交互 fallback 发起人。

`run_zero_start_simulation` 会按整数小时驱动虚拟主体通过真实 world URL 提交成员报名和合作方报名表单，生成自媒体主动报名、初筛、候选、备用、项目拒绝、主动退出、成员能力矩阵和文件签署方矩阵记录，用于下一轮从真正 0 点继续推演。成员报名表单使用 `role_gap`、`availability_slots`、动态问答和提交确认；历史小时字段只作为仿真兼容数据随 POST 一起带入，不再是页面主输入。

默认 168 小时只是一个观察窗口；如果启动门槛未满足，run 会保持 `running` 并允许再次执行命令继续推进同一个 run。报名密度会随虚拟曝光时间增加，而不是平均分布。当前 driver 会验证页面和 HTML 表单字段并通过 HTTP POST 提交；浏览器抽样验证后续接入同一 driver 边界。

启动门槛满足后，同一个 `zero_start` run 会继续进入 `pre_engineering` 工程前置阶段，而不是立刻结束。该阶段会把候选场地池、并网预筛、场地合法性与附条件租赁审查、结构/光伏/电气/施工/验收责任文件取得过程写入 `SimulationTurn.metadata` 和公开仿真事件；只有工程前置责任闭环完成后，run 才会进入 `completed`。

## 归档和废弃仿真运行

归档一次已结束的仿真运行：

```powershell
.\.venv\Scripts\python.exe manage.py archive_simulation_run --world-id simulation0001 --run-id sim-run-xxx
.\.venv\Scripts\python.exe manage.py archive_simulation_run --world-id simulation0001
```

归档命令会把来源 world 中的 `core` 域模型逐表导出到 `var/simulation_archives/{snapshot_id}/raw/`，同时在 control DB 写入 `SimulationSnapshot` 和 `SimulationSnapshotItem` 查询索引。`raw_archive` 是不可变原始证据，`normalized_archive` 是可迁移查询索引。

归档时可以补充正式复盘字段：

```powershell
.\.venv\Scripts\python.exe manage.py archive_simulation_run --world-id simulation0001 --run-id sim-run-xxx --scenario zero_start --purpose "验证零起点自媒体报名筛选" --review-conclusion "候选池形成不等于启动门槛满足"
```

如果一次已结束仿真没有归档价值，必须显式放弃归档，不能直接启动下一轮：

```powershell
.\.venv\Scripts\python.exe manage.py discard_simulation_run --world-id simulation0001 --run-id sim-run-xxx --reason "参数误设，作为调试运行放弃归档。"
```

`archive_simulation_run` 和 `discard_simulation_run` 都会写入 control DB 的 `SimulationRunDisposition`。`run_simulation_smoke` 和 `run_zero_start_simulation` 会拒绝在同一个仿真 world 中覆盖已结束但未处置的 run；仍为 `running` 的零起点 run，或旧版本留下的“启动门槛未满足”业务失败 run，不需要先处置，下一次执行会继续追加小时级推进记录。

如果一个 `running` run 因模型缺陷或参数误设已经没有继续价值，先在 `/admin/simulation-lab/` 的 run 详情页填写原因并“中止本轮仿真”。中止后的状态是 `aborted`，此时才能继续归档或废弃。

校验一个已归档快照：

```powershell
.\.venv\Scripts\python.exe manage.py verify_simulation_snapshot snapshot-xxx
```

校验命令会检查 `manifest.json`、逐模型 raw JSON 文件 SHA-256、raw 清单稳定哈希、逐模型记录数、`report.html` 路径和 control DB 中的标准化明细数量。

## 仿真实验后台

也可以通过 Django Admin 下的仿真实验后台选择仿真槽位、处理待归档 run、启动或继续零起点仿真：

```text
http://bigadmin.local/admin/simulation-lab/
```

已归档快照、标准化明细和处置记录的罗列查询归属 `/admin/` 首页的“仿真”一级菜单；仿真实验后台不再重复承担这些列表页职责。待处置 run 在归档或废弃前可以打开详情页，审阅失败证据、修订建议、结构化变更集和推进日志。

当前本地开发可以只使用 `simulation0001` 这一个仿真槽位。槽位中的运行态数据可以随着下一轮仿真重置或覆盖，但已结束 run 必须先在页面或命令中归档/废弃；归档后的正式历史来自 `SimulationSnapshot`、`SimulationSnapshotItem`、`SimulationRunDisposition` 和 `var/simulation_archives/`，不是来自永久在线的仿真数据库。

## 通过后台重置仿真世界

除了命令行 `seed_world`，还可以通过仿真实验后台直接重置一个仿真世界到 zero_start 基线：

1. 以 superuser 身份登录 `http://bigadmin.local/admin/simulation-lab/?world_id=simulation0001`。
2. 在"重置仿真世界"模块中：
   - 输入当前 world_id（例如 `simulation0001`）确认。
   - 输入确认文字"确认重置"。
   - 如果存在运行中或已结束但未处置的 run，勾选"强制重置"。
3. 点击"重置到零起点基线"。
4. 成功后目标 world 只有 zero_start 基线数据，不会推进虚拟小时，不会创建 SimulationRun / SimulationTurn。

与 `run_zero_start_simulation` 的区别：重置只清空并 seed 基线；`run_zero_start_simulation` 才创建 `SimulationRun` / `SimulationTurn` 并推进虚拟小时。重置后的审计记录写入 control DB 的 `WorldMaintenanceLog`（在 `/admin/worlds/worldmaintenancelog/` 中只读查看）。

通过后台重置与命令行 `seed_world simulation0001 --template zero_start` 都会写入 zero_start 基线，但命令行 `seed_world` 不会先清空已有数据。后台重置页面会把清空和重新 seed 串成一次受控维护流程；如果 seed 失败，会写入失败审计记录，需要修复配置后重新执行。

不要手动对本地 `dev_big_sim0001` 数据库执行清空操作；日常开发测试优先使用后台页面重置或命令行 `seed_world` 覆盖。确需命令行清空数据库时，必须先备份并确认当前数据可以丢弃，再由有权限的数据库管理员执行。
