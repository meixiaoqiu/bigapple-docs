# Big Apple Docs

本仓库是“大苹果 docs + governance instruments”的 Docusaurus 文档站根目录，用于承载公开说明文档、治理文书入口、技术契约和文档站构建配置。

当前已迁入 Live OS 相关文档和 machine-readable `technical-contracts`，包括 OpenAPI、JSON Schema、示例 payload 和本地校验脚本。

## 本地预览

```bash
npm install
npm run start
```

默认本地预览地址由 Docusaurus 输出，一般为 `http://localhost:3000/`。

## 构建与校验

```bash
npm run build
npm run validate:contracts
```

构建产物位于 `build/`，不应提交到 Git。

## 文档新增方式

- 普通说明文档放入现有分区，例如 `docs/project/`、`docs/architecture/`、`docs/product/`、`docs/operations/`、`docs/development/` 或 `docs/reference/`。
- 面向 Live OS、Simulation Engine 或外部客户端的数据结构和 API 契约放入 `technical-contracts/`，并在 `docs/technical-contracts/` 中维护说明。
- 只有经过治理流程确认的正式治理文书，才放入 `docs/governance-instruments/` 下的正式分类目录。
- 新增一级分区前，应先确认现有分区无法承载该内容。
- 当前文档站只使用 Markdown 文档和默认 Docusaurus classic 主题，不主动创建 MDX 页面、自定义 React 组件或额外 UI 框架。

## 治理文书编号规则

治理文书编号采用稳定前缀加四位数字：

- `BA-CHARTER-0001`：章程。
- `BA-RES-0001`：决议。
- `BA-POLICY-0001`：政策。
- `BA-RULE-0001`：规则。
- `BA-AMEND-0001`：修订案。

正式编号一经使用，不应复用给其他文本。被废止、替代或修订的文本应保留历史记录。

## 许可证

本仓库采用双许可证：

- `LICENSE`：CC BY-SA 4.0，用于文档、治理文书、技术契约说明、手册、图片、图表等非代码内容。
- `LICENSE-CODE`：AGPL-3.0-or-later，用于 Docusaurus 配置、脚本、示例代码和构建相关代码。

详细边界见 `NOTICE.md`。
