---
sidebar_position: 6
title: 页面自动截图使用说明
---

# 页面自动截图使用说明

本文档是 Big Apple 文档站页面截图功能的完整操作手册。

---

## 功能用途

截图功能实现以下自动化流程：

```
自动访问 Big Apple Live OS 页面
→ 验证 HTTP 响应
→ 等待页面身份选择器
→ 验证 HTML 页面标题
→ 生成 WebP 截图
→ 保存到页面说明书目录
→ 由 Markdown 相对路径引用
→ 创建历史版本时与说明书一起冻结
```

**该功能不是**：

- 用户访问文档时实时截图；
- 自动遍历所有路由；
- 自动生成页面说明正文；
- 视觉回归测试；
- 自动比较不同版本截图；
- 自动创建 Docusaurus 历史版本。

---

## 工程文件位置

| 文件 | 用途 | 是否随 Docusaurus 版本冻结 |
| --- | --- | --- |
| `screenshot-manifest.json` | 当前截图任务清单 | 否，由 Git 管理历史 |
| `scripts/screenshot-pages.js` | 当前截图执行脚本 | 否，由 Git 管理历史 |
| `docs/development/page-screenshots.md` | 截图功能使用说明 | 是 |
| `docs/product-pages/**/index.md` | 页面说明书 | 是 |
| `docs/product-pages/**/images/*.webp` | 页面截图 | 是 |

**原则**：

- `screenshot-manifest.json` 和 `scripts/screenshot-pages.js` 本身会通过开源 Git 仓库公开；
- 它们无需移动到 `docs/`；
- 它们也不应复制到 `static/`；
- 文档站公开的是使用说明、配置结构和必要示例；
- 完整源码以仓库中的真实文件为准；
- Git 提交和 Git 标签负责保存截图工具源码的历史；
- Docusaurus 版本负责保存页面说明书和页面截图的历史。

---

## 当前已配置页面

| 页面 | Live OS 路径 | 截图输出 |
| --- | --- | --- |
| Observer 仪表盘 | `/` | `docs/product-pages/observer-dashboard/images/dashboard.webp` |
| 公开财务 | `/finance/` | `docs/product-pages/observer-finance/images/finance.webp` |
| 公开事件列表 | `/events/` | `docs/product-pages/observer-events/images/events.webp` |

---

## 前置条件

- `bigapple-liveos` 已启动且可通过浏览器正常访问；
- Node.js（>=20.9.0）和 npm 可用；
- 已在 `bigapple-docs` 中执行 `npm install`；
- Playwright 能找到可用浏览器（Chromium 或系统 Chrome）；
- 当前默认基础地址为 `http://127.0.0.1:20101`。

---

## 基本使用

```bash
cd bigapple-docs
npm install
npm run capture:screenshots
npm run build
```

- `capture:screenshots`：更新当前版本截图；
- `build`：验证文档、图片、链接和侧边栏；
- 正式 `.webp` 截图需要提交到 Git；
- `.tmp` 文件属于异常产物，不得提交。

---

## 配置 Live OS 地址

通过环境变量 `SCREENSHOT_BASE_URL` 指定 Live OS 基础地址。

当前默认值：

```
http://127.0.0.1:20101
```

**PowerShell 示例**：

```powershell
$env:SCREENSHOT_BASE_URL = "http://127.0.0.1:20101"
npm run capture:screenshots
```

**CMD 示例**：

```cmd
set SCREENSHOT_BASE_URL=http://127.0.0.1:20101
npm run capture:screenshots
```

环境变量仅对当前终端会话有效，关闭终端后失效。

---

## 浏览器选择策略

脚本按以下顺序确定浏览器：

1. 如果设置了 `PLAYWRIGHT_EXECUTABLE_PATH`，使用指定浏览器；
2. 尝试 Playwright 自带 Chromium；
3. 尝试系统 Chrome；
4. 全部不可用时输出清晰错误并退出。

**PowerShell 示例**：

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run capture:screenshots
```

**安装 Playwright Chromium**：

```bash
npx playwright install chromium
```

不是所有环境都已经安装 Chromium，首次使用需先安装。

---

## `screenshot-manifest.json` 字段说明

### `id`

- 任务唯一标识；
- 不得重复；
- 建议使用稳定的英文短横线命名（如 `observer-finance`）。

### `title`

- 日志和错误信息中显示的中文页面名称。

### `path`

- 相对于 `SCREENSHOT_BASE_URL` 的页面路径；
- 必须以 `/` 开头；
- 不得写完整域名；
- 不得包含用于写文件的本机路径。

### `waitFor`

- 用于确认目标页面关键区域已经出现的 CSS 选择器；
- 不应使用 `body`（无法验证页面内容是否正确加载）；
- 不应优先使用 `nth-child`（结构变更后容易失效）；
- 应优先使用页面专属 `id`、主容器、唯一标题元素或稳定语义属性。

### `expectTitle`

- HTML `<title>` 必须包含的文字；
- 对应 `page.title()` 的返回值；
- 用于避免错误路径返回 HTTP 200 时被误判为正确页面；
- 不是搜索页面正文内容。

### `output`

- 正式 WebP 输出路径（相对于仓库根目录）；
- 必须位于 `docs/` 内；
- 不得使用 `../` 越界；
- 不得输出到 `static/screenshots/`；
- 建议位于对应说明书的 `images/` 目录。

### `fullPage`

- `false`：只截固定视口（1440×900）；
- `true`：截取完整页面高度。

### `viewport`

当前版本所有任务使用统一默认视口 `1440×900`，`manifest.json` 中不支持逐任务单独配置视口尺寸。

### 完整示例

```json
{
  "id": "observer-finance",
  "title": "公开财务",
  "path": "/finance/",
  "waitFor": "h1",
  "expectTitle": "公开财务",
  "output": "docs/product-pages/observer-finance/images/finance.webp",
  "fullPage": false
}
```

---

## 如何增加一个新页面

> **新增页面前，请先在[页面说明书清单](./page-guide-inventory.md)中登记页面信息**，确认权限、状态和是否值得单独建立说明书。

完整流程：

1. 确认 Live OS 页面真实存在；
2. 确认页面是否需要登录（当前脚本不支持登录态截图）；
3. 确认页面标题和稳定身份选择器；
4. 在 `docs/product-pages/` 下建立说明书目录和 `images/` 目录；
5. 编写 `index.md`；
6. 在 `screenshot-manifest.json` 中增加任务；
7. 设置稳定的 `waitFor` 和真实的 `expectTitle`；
8. 运行 `npm run capture:screenshots`；
9. 人工检查截图内容是否准确；
10. 在 Markdown 中使用相对路径引用截图；
11. 将说明书加入 `sidebars.js`；
12. 运行 `npm run build` 验证。

**目录示例**：

```text
docs/product-pages/observer-finance/
├── index.md
└── images/
    └── finance.webp
```

**Markdown 示例**：

```md
![公开财务页面](./images/finance.webp)
```

**说明**：

- 当前截图文件使用稳定名称（如 `finance.webp`）；
- 页面更新时直接覆盖当前截图；
- 当前截图文件名不加入日期或版本号；
- 历史页面截图由 Docusaurus 版本冻结机制保存。

---

## 页面说明书内容规范

主要页面可包含以下内容：

- 页面用途
- 访问方式
- 页面截图
- 页面组成
- 主要功能
- 使用流程
- 数据与权限
- 当前状态与限制
- 相关文档

**要求**：

- 内容必须基于真实页面、源码、路由或后端实现；
- 不得把规划写成已完成功能；
- 不为简单确认页、普通弹窗或过于细碎的页面单独建立说明书；
- 无实际内容的章节可以省略。

---

## 截图稳定性

当前脚本采取以下措施保证截图一致性：

- 固定视口 `1440×900`；
- 固定 `deviceScaleFactor: 1`；
- 固定语言 `zh-CN`；
- 固定时区 `Asia/Shanghai`；
- 固定浅色模式；
- 等待 DOM（`domcontentloaded`）；
- 等待 `waitFor` 选择器出现；
- 等待字体加载（`document.fonts.ready`）；
- 关闭动画（`animation-duration: 0s`）；
- 关闭过渡（`transition-duration: 0s`）；
- 关闭光标闪烁（`caret-color: transparent`）；
- 关闭平滑滚动（`scroll-behavior: auto`）；
- Playwright 生成 PNG Buffer；
- Sharp 在内存中生成 WebP Buffer；
- 不保存中间 PNG 文件；
- 不产生 `.tmp` 文件；
- 不在文件名中加入时间戳。

---

## 常见错误排查

### Live OS 未启动

**现象**：截图任务提示连接失败或超时。

**处理**：

- 启动 Live OS 服务；
- 在浏览器中手动访问基础地址确认服务可达；
- 检查端口是否与默认值（`20101`）一致；
- 检查 `SCREENSHOT_BASE_URL` 环境变量是否正确。

### HTTP 响应异常

**现象**：任务失败，提示"页面响应失败 (HTTP xxx)"。

**处理**：

- 脚本会检查 `response.ok()`，非 2xx 状态码会直接失败；
- 确认路径正确、服务正常响应。

### 选择器未出现

**现象**：任务失败，提示"选择器未出现"。

**处理**：

- 检查页面是否加载完整；
- 检查 `waitFor` 选择器是否仍然有效（页面 DOM 结构可能已变更）；
- 不要改成 `body` 绕过身份校验——这会失去对页面正确加载的验证；
- 建议使用页面专属的 `id` 或语义化选择器。

### 页面标题不符合预期

**现象**：任务失败，提示"页面标题不符合预期"。

**处理**：

- 查看浏览器标签页标题或 HTML `<title>` 的实际内容；
- 检查是否进入了错误页、登录页或其他兜底页面（返回 200 但内容不对）；
- 确认 `path` 配置正确；
- 确认 `expectTitle` 与实际 `<title>` 是否一致。

### 浏览器不可用

**现象**：脚本退出，提示"找不到可用的浏览器"。

**处理**：

```bash
npx playwright install chromium
```

或设置：

```
PLAYWRIGHT_EXECUTABLE_PATH
```

指向本地可执行浏览器路径。

### Windows 文件占用或 EBUSY

**处理**：

- 当前实现通过 Buffer 在内存中完成 WebP 转换，直接写入最终文件；
- 不再依赖临时文件重命名，正常情况下不会出现 EBUSY；
- 如果仍出现，应检查是否有其他程序（如图片查看器、编辑器）占用了正式截图文件。

### `.tmp` 文件残留

**处理**：

- 正常运行不应产生 `.tmp` 文件；
- 可以手动删除旧的残留文件；
- 脚本完成后会自动检查 `docs/product-pages/` 目录中是否存在 `.tmp` 文件；
- 如检测到 `.tmp` 残留，脚本会明确报错并以非零状态退出；
- `.tmp` 残留属于脚本异常，不能只靠 `.gitignore` 隐藏。

### 截图内容不稳定

**可能原因**：

- 页面内容依赖当前时间（如"最近 24 小时"）；
- 页面显示随机或实时数据；
- 后端数据在截图间隔内发生变化；
- 轮播图或自动播放组件；
- 异步加载的数据在截图时尚未完成；
- CSS 动画未完全停止；
- 固定演示数据尚未建立。

当前脚本无法消除所有动态数据导致的不稳定性。如需完全可复现的截图，需要在 Live OS 端提供固定演示数据集。

---

## 与 Docusaurus 历史版本的关系

```
docs/ 中的说明书和截图
→ 始终代表最新版

执行 Docusaurus docs:version
→ 将当前说明书和截图一起冻结为历史快照

截图脚本和 manifest
→ 继续保留在仓库工程目录，由 Git 管理历史
```

**创建历史版本前流程**：

```
更新页面实现
→ 更新说明书
→ 运行 npm run capture:screenshots
→ 人工检查截图
→ 运行 npm run build
→ 创建 Docusaurus 历史版本
→ 再次运行 npm run build
```

版本管理细则见：[文档站维护说明](./docs-maintenance.md)。

---

## 实现文件

以下文件路径均相对于 `bigapple-docs` 仓库根目录：

| 文件 | 说明 |
| --- | --- |
| `screenshot-manifest.json` | 截图任务清单 |
| `scripts/screenshot-pages.js` | 截图执行脚本 |
| `package.json` | npm 命令定义 |
| `docs/development/page-screenshots.md` | 本文档 |

完整源码可在开源仓库中查看。
