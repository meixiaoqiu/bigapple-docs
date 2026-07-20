---
sidebar_position: 3
title: JSON Schema
---

# JSON Schema

Schema 源目录：

```text
technical-contracts/schemas/
```

当前 schema 文件：

| 文件 | 标题 |
| --- | --- |
| `capacity-assessment.schema.json` | `CapacityAssessment` |
| `common.schema.json` | `Big Apple Common Contract Definitions` |
| `dispute.schema.json` | `Dispute` |
| `event.schema.json` | `Event` |
| `ledger-entry.schema.json` | `LedgerEntry` |
| `member.schema.json` | `Member` |
| `member-workspace.schema.json` | `MemberWorkspaceSummary` |
| `public-event.schema.json` | `PublicEvent` |
| `public-resource.schema.json` | `PublicResource` |
| `public-task.schema.json` | `PublicTask` |
| `resource.schema.json` | `Resource` |
| `ruleset.schema.json` | `Ruleset` |
| `task.schema.json` | `Task` |

## 公开投影

匿名访客可浏览的公开仿真接口使用 `public-*` schema：

- `public-task.schema.json`：用于 `GET /tasks`。
- `public-resource.schema.json`：用于 `GET /resources` 和观察台摘要。
- `public-event.schema.json`：用于 `GET /events?visibility=public` 和观察台摘要。

完整的 `task.schema.json`、`resource.schema.json`、`event.schema.json` 仍用于成员工作台、已认证写接口响应或治理权限下的内部视图。
