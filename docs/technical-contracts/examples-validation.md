---
sidebar_position: 4
title: 示例与校验
---

# 示例与校验

示例 payload 源目录：

```text
technical-contracts/examples/
```

当前示例文件：

- `capacity-assessment.example.json`
- `dispute.example.json`
- `event.example.json`
- `ledger-entry.example.json`
- `member.example.json`
- `member-workspace.example.json`
- `public-event.example.json`
- `public-resource.example.json`
- `public-task.example.json`
- `resource.example.json`
- `ruleset.example.json`
- `task.example.json`

校验脚本：

```text
technical-contracts/scripts/validate_contracts.py
```

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
