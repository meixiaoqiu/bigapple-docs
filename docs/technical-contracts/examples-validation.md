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
- <a href="/technical-contracts/examples/dispute.example.json">dispute.example.json</a>
- <a href="/technical-contracts/examples/event.example.json">event.example.json</a>
- <a href="/technical-contracts/examples/ledger-entry.example.json">ledger-entry.example.json</a>
- <a href="/technical-contracts/examples/member.example.json">member.example.json</a>
- <a href="/technical-contracts/examples/member-workspace.example.json">member-workspace.example.json</a>
- <a href="/technical-contracts/examples/public-event.example.json">public-event.example.json</a>
- <a href="/technical-contracts/examples/public-resource.example.json">public-resource.example.json</a>
- <a href="/technical-contracts/examples/public-task.example.json">public-task.example.json</a>
- <a href="/technical-contracts/examples/resource.example.json">resource.example.json</a>
- <a href="/technical-contracts/examples/ruleset.example.json">ruleset.example.json</a>
- <a href="/technical-contracts/examples/task.example.json">task.example.json</a>

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
Checked 26 JSON files.
```

后续迁移或改动技术契约时，应先保持该校验通过，再同步 Live OS、Simulation Engine 和文档站中的说明。
