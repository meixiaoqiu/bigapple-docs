---
sidebar_position: 7
title: 文档站维护说明
---

# 文档站维护说明

本文档说明 `bigapple-docs` 文档站的日常维护规则，包括版本管理、图片目录规范和页面截图处理方式。

---

## 文档版本管理

### 当前文档与历史版本的关系

- `docs/` 目录始终属于 Docusaurus 的 `current` 版本，配置为 `lastVersion: 'current'`。
- `current` 始终占据网站根路径 `/`，是面向公众的**最新版文档**。
- 运行 `npm run docusaurus docs:version <版本号>` 会将 `docs/` 的当前快照冻结为一个不可变的历史版本，存入 `versioned_docs/version-<版本号>/`。
- 冻结后，`docs/` 继续更新，历史版本不再随最新版变化。
- 访客可通过页面右上角的版本下拉菜单在不同版本之间切换。

历史版本的目的不是跟踪每次小改动，而是记录大苹果项目在重要时间节点的文档状态和页面演化。

### 版本路由（已通过构建验证）

基于 `lastVersion: 'current'` 配置，以冻结 `2026.08` 为例：

| 版本 | 默认语言路径 | en 路径 |
|---|---|---|
| `current`（`docs/`） | `/`（根路径，始终为最新版） | `/en/` |
| `2026.08`（冻结） | `/2026.08/` | `/en/2026.08/` |

**要点**：

- `current` 始终占据站点根路径 `/`，冻结版本**不会**自动取代根路径。
- 每个冻结版本有自己的子路径 `/版本号/`。
- 不同语言下的版本路径结构一致，仅在语言前缀后追加版本子路径。

### 版本命名原则

- 版本编号采用**日历版本格式**：`YYYY.MM`
- 版本号表示正式冻结历史快照的年月，例如：

  | 版本 | 含义 |
  |---|---|
  | `2026.08` | 2026 年 8 月冻结的快照 |
  | `2026.12` | 2026 年 12 月冻结的快照 |
  | `2027.05` | 2027 年 5 月冻结的快照 |

- 可以另外使用中文阶段名称帮助读者理解，例如 `2026.08 · 初始原型`、`2026.12 · 治理雏形`。但中文名称仅用于展示和说明，**不进入版本命令、目录名或 URL**。
- 除非同一个月确实有两个都值得永久保留的重要节点，否则不创建 `2026.08.1` 之类的子版本。
- 文档版本仅对应重要时间节点，不跟随每个 Git 提交、补丁版本或小修复创建。
- 历史版本会复制当时所有的文档和图片，因此应控制版本数量。

### 创建正式文档版本

创建版本前，依次完成：

1. **更新文档**：确保 `docs/` 内容反映当前项目状态，无明显的待补充标记或错误。
2. **更新页面截图**：如有页面截图，更新截图文件，确认相对路径引用正确。
3. **运行完整构建**：`npm run build`，确认无错误。
4. **执行冻结**：

   ```bash
   npm run docusaurus docs:version 2026.08
   ```

5. **验证路由**：检查 `build/` 目录，确认：
   - `build/index.html` 仍为当前版本首页。
   - `build/<版本号>/index.html` 为冻结版本首页。
   - 两套 HTML 内容可能不同（`docs/` 在冻结后可能已继续更新）。
6. **提交**：将生成的 `versions.json`、`versioned_docs/` 和 `versioned_sidebars/` 一并提交。

### 删除错误创建的版本

1. 从 `versions.json` 中删除对应的版本号条目。
2. 删除 `versioned_docs/version-<版本号>/` 目录。
3. 删除 `versioned_sidebars/version-<版本号>-sidebars.json`。
4. 删除 `i18n/<locale>/docusaurus-plugin-content-docs/version-<版本号>/`（如有）。
5. 运行 `npm run build` 验证。

### 版本切换注意事项

- 版本冻结时，Docusaurus 会复制 `docs/` 的**全部内容**（包括图片）。
- 不要在冻结前保留大量临时或未完成的文档在 `docs/` 中。
- 包含 i18n 翻译的项目，冻结时会同时处理所有已配置的语言版本。

---

## 图片与截图目录规范

### 核心原则

需要**跟随文档版本一起冻结**的页面截图和配图，必须与对应文档放在同一目录树下，并使用相对路径引用。

不应使用全局 `static/` 目录保存需要版本化的图片。

### 推荐目录结构

```text
docs/
└── product/
    └── observer/
        ├── index.md
        └── images/
            └── overview.webp
            └── detail-view.webp
```

### 引用方式

Markdown 中使用相对路径：

```md
![Observer 首页](./images/overview.webp)
![Observer 详情页](./images/detail-view.webp)
```

### 禁止使用的引用方式

```md
<!-- 不要使用全局绝对路径保存版本化截图 -->
![Observer 首页](/screenshots/observer-home.png)
```

### 资源分类

| 类型 | 存放位置 | 引用方式 | 是否跟随版本 |
|---|---|---|---|
| 页面截图 | `docs/<对应文档路径>/images/` | 相对路径 `./images/xxx.webp` | 是 |
| 页面配图 | `docs/<对应文档路径>/images/` | 相对路径 `./images/xxx.webp` | 是 |
| Logo / favicon | `static/` | 绝对路径 `/img/xxx` | 否 |
| 品牌图 / 装饰素材 | `static/` | 绝对路径 `/img/xxx` | 否 |
| 技术契约文件 | `static/technical-contracts/` | 绝对路径 | 否 |

### 为什么必须使用相对路径

版本冻结时，Docusaurus 会将 `docs/` 下的文件连同其目录结构整体复制到 `versioned_docs/version-<版本号>/`。使用相对路径的图片引用在复制后仍然有效。使用绝对路径（如 `/screenshots/xxx.png`）的图片不会被复制，在历史版本中将显示为 404。

---

## 页面说明书与截图维护

### 页面说明书规则

- 一个主要页面原则上对应一篇说明书（`index.md`）。
- 说明书与截图放在同一目录树下，截图通过相对路径引用。
- 不为普通弹窗、确认页和细碎页面单独建说明书。
- 页面说明必须基于 Live OS 的实际实现，不凭空编造。

### 截图管理

截图配置统一维护在项目根目录的 `screenshot-manifest.json`，每项包含 `id`、`title`、`path`、`waitFor`、`output` 和 `fullPage`。

生成截图：

```bash
npm run capture:screenshots
```

截图脚本执行流程：

1. 校验 `screenshot-manifest.json`（检查 id / output 唯一性、path 合法性、output 限制在 `docs/` 内）
2. 按顺序确定浏览器（`PLAYWRIGHT_EXECUTABLE_PATH` → Playwright 自带 Chromium → 系统 Chrome）
3. 读取 `SCREENSHOT_BASE_URL` 环境变量（默认 `http://127.0.0.1:20101`）
4. 逐个访问页面，固定视口 1440×900、浅色模式、zh-CN 语言、Asia/Shanghai 时区
5. 关闭动画和过渡效果后截图，PNG Buffer → Sharp 内存转 WebP Buffer → 直接写入正式文件
6. 写入后校验文件存在性、大小、格式（webp）、宽度和高度
7. 任务全部完成后递归检查输出目录，确保无 `.tmp` 残留
8. 任意任务失败时退出码为非零

### 截图与版本冻结的关系

- 当前截图使用稳定文件名并直接覆盖。
- 创建历史版本时，说明书和截图随 `docs/` 一起冻结到 `versioned_docs/`。
- 冻结前务必先运行 `npm run capture:screenshots`，确保截图是最新的。

### 截图工具源码的位置

- `screenshot-manifest.json` 和 `scripts/screenshot-pages.js` 保留在仓库工程目录，由 Git 管理历史；
- 它们不放进 `docs/`，也不在 `static/` 中维护副本；
- 页面说明书和截图随 Docusaurus 版本冻结，截图工具源码不随版本重复复制。

具体配置、运行方法和故障排查见：[页面自动截图使用说明](./page-screenshots.md)。
