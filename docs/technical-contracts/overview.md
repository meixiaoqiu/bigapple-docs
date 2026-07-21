---
sidebar_position: 1
title: 技术契约概览
---

# 技术契约概览

技术契约分区用于说明 `static/technical-contracts` 中的 machine-readable contracts，包括 OpenAPI、JSON Schema、示例 payload 和本地校验规则。

这里的“技术契约”不是正式章程、决议、政策、规则或修订案。它服务于 Live OS、Simulation Engine 和未来外部客户端之间的数据结构和 API 兼容性。

## 当前源头

当前契约源头位于本仓库：

```text
static/technical-contracts
```

`openapi/`、`schemas/`、`examples/` 和 `scripts/validate_contracts.py` 是机器可读契约本体。修改这些文件时必须保持本地校验通过，不要把技术契约混入治理正式文本区。

## 仓库边界

`technical-contracts` 负责：

- JSON Schema Draft 2020-12 契约。
- OpenAPI 3.1 Live OS API 契约。
- 共享枚举和状态定义。
- 请求和响应示例。
- 本地契约校验。

`technical-contracts` 不负责：

- Django model。
- 数据库迁移。
- Simulation Engine 行为模型。
- 任务分配或积分结算实现。
- UI 代码。
- 生产密钥或真实成员隐私数据。

## 当前 v0.1 范围

- 成员身份。
- 任务。
- 贡献积分流水。
- 资源。
- 事件。
- 申诉。
- 规则版本。
- 容量评估。
- 成员工作台摘要。
- 匿名公开投影。
