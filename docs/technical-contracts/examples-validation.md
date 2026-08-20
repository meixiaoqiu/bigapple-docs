---
sidebar_position: 4
title: 示例与校验
---

# 示例与校验

示例 payload 源目录：

```text
static/technical-contracts/examples/
```

静态站点会发布下列示例文件。不要依赖目录索引，请直接访问单个文件链接。

当前示例文件：

- <a href="/technical-contracts/examples/capacity-assessment.example.json">capacity-assessment.example.json</a>
- <a href="/technical-contracts/examples/credit-account.example.json">credit-account.example.json</a>
- <a href="/technical-contracts/examples/credit-transaction.example.json">credit-transaction.example.json</a>
- <a href="/technical-contracts/examples/credit-transfer-request.example.json">credit-transfer-request.example.json</a>
- <a href="/technical-contracts/examples/credit-transfer-response.example.json">credit-transfer-response.example.json</a>
- <a href="/technical-contracts/examples/event-feedback.example.json">event-feedback.example.json</a>
- <a href="/technical-contracts/examples/event.example.json">event.example.json</a>
- <a href="/technical-contracts/examples/ledger-entry.example.json">ledger-entry.example.json</a>
- <a href="/technical-contracts/examples/member.example.json">member.example.json</a>
- <a href="/technical-contracts/examples/member-workspace.example.json">member-workspace.example.json</a>
- <a href="/technical-contracts/examples/merchant-profile.example.json">merchant-profile.example.json</a>
- <a href="/technical-contracts/examples/merchant-settlement-record.example.json">merchant-settlement-record.example.json</a>
- <a href="/technical-contracts/examples/public-event.example.json">public-event.example.json</a>
- <a href="/technical-contracts/examples/public-resource.example.json">public-resource.example.json</a>
- <a href="/technical-contracts/examples/public-task.example.json">public-task.example.json</a>
- <a href="/technical-contracts/examples/redemption-order.example.json">redemption-order.example.json</a>
- <a href="/technical-contracts/examples/redemption-order-create-request.example.json">redemption-order-create-request.example.json</a>
- <a href="/technical-contracts/examples/redemption-order-action-request.example.json">redemption-order-action-request.example.json</a>
- <a href="/technical-contracts/examples/resource.example.json">resource.example.json</a>
- <a href="/technical-contracts/examples/ruleset.example.json">ruleset.example.json</a>
- <a href="/technical-contracts/examples/task.example.json">task.example.json</a>
- <a href="/technical-contracts/examples/unified-proposal.example.json">unified-proposal.example.json</a>

校验脚本：

```text
static/technical-contracts/scripts/validate_contracts.py
```

构建后的静态访问链接：

- <a href="/technical-contracts/scripts/validate_contracts.py">validate_contracts.py</a>

运行方式：

```bash
python scripts/validate_contracts.py
```

当前盘点时校验结果：

```text
Contract validation passed.
Checked 40 JSON files.
```

后续迁移或改动技术契约时，应先保持该校验通过，再同步 Live OS、Simulation Engine 和文档站中的说明。
