---
sidebar_position: 3
title: JSON Schema
---

# JSON Schema

Schema 源目录：

```text
static/technical-contracts/schemas/
```

静态站点会发布下列 schema 文件。不要依赖目录索引，请直接访问单个文件链接。

当前 schema 文件：

| 文件 | 标题 |
| --- | --- |
| <a href="/technical-contracts/schemas/capacity-assessment.schema.json">capacity-assessment.schema.json</a> | `CapacityAssessment` |
| <a href="/technical-contracts/schemas/common.schema.json">common.schema.json</a> | `Big Apple Common Contract Definitions` |
| <a href="/technical-contracts/schemas/dispute.schema.json">dispute.schema.json</a> | `Dispute` |
| <a href="/technical-contracts/schemas/event.schema.json">event.schema.json</a> | `Event` |
| <a href="/technical-contracts/schemas/ledger-entry.schema.json">ledger-entry.schema.json</a> | `LedgerEntry` |
| <a href="/technical-contracts/schemas/member.schema.json">member.schema.json</a> | `Member` |
| <a href="/technical-contracts/schemas/member-workspace.schema.json">member-workspace.schema.json</a> | `MemberWorkspaceSummary` |
| <a href="/technical-contracts/schemas/public-event.schema.json">public-event.schema.json</a> | `PublicEvent` |
| <a href="/technical-contracts/schemas/public-resource.schema.json">public-resource.schema.json</a> | `PublicResource` |
| <a href="/technical-contracts/schemas/public-task.schema.json">public-task.schema.json</a> | `PublicTask` |
| <a href="/technical-contracts/schemas/resource.schema.json">resource.schema.json</a> | `Resource` |
| <a href="/technical-contracts/schemas/ruleset.schema.json">ruleset.schema.json</a> | `Ruleset` |
| <a href="/technical-contracts/schemas/task.schema.json">task.schema.json</a> | `Task` |

## 公开投影

匿名访客可浏览的公开仿真接口使用 `public-*` schema：

- <a href="/technical-contracts/schemas/public-task.schema.json">public-task.schema.json</a>：用于 `GET /tasks`。
- <a href="/technical-contracts/schemas/public-resource.schema.json">public-resource.schema.json</a>：用于 `GET /resources` 和观察台摘要。
- <a href="/technical-contracts/schemas/public-event.schema.json">public-event.schema.json</a>：用于 `GET /events?visibility=public` 和观察台摘要。

完整的 `task.schema.json`、`resource.schema.json`、`event.schema.json` 仍用于成员工作台、已认证写接口响应或治理权限下的内部视图。
