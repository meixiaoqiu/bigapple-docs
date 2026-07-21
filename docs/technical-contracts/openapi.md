---
sidebar_position: 2
title: OpenAPI
---

# OpenAPI

OpenAPI 契约文件：

```text
static/technical-contracts/openapi/live-os.v0.1.openapi.json
```

静态站点访问链接：

- <a href="/technical-contracts/openapi/live-os.v0.1.openapi.json">live-os.v0.1.openapi.json</a>

当前 API 契约信息：

```text
title: Big Apple Live OS API
version: 0.1.0
description: Contract draft for the Live OS API used by humans and the Simulation Engine.
```

当前路径范围：

- `/members/{member_no}`
- `/members/{member_no}/workspace`
- `/tasks`
- `/tasks/{task_id}/claim`
- `/tasks/{task_id}/submit-labor`
- `/tasks/{task_id}/review`
- `/ledger-entries`
- `/resources`
- `/disputes`
- `/events`
- `/capacity-assessments/latest`
- `/observer/summary`

后续迁移 contracts 本体时，应优先保证 OpenAPI 与 [API 文档](../reference/api.md) 的路径、payload 和安全边界一致。
