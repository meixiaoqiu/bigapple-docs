---
sidebar_position: 1
title: 开发说明
---

# 开发说明

## 本地依赖

- Docker Desktop
- 已存在的 Docker network：`dev-net`
- 已存在的 MySQL 容器：`mysql97`
- 已存在的 nginx 容器：`nginx`
- 可连接的 MySQL 数据库，推荐 `utf8mb4` 字符集和 `utf8mb4_0900_as_cs` 排序规则

## 安装

```bat
copy .env.example .env
notepad .env
```

## 数据库连接配置

本地运行推荐填写：

```text
.env
```

格式：

```dotenv
DATABASE_URL=mysql://用户名:URL编码后的密码@mysql97:3306/数据库名?charset=utf8mb4
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,bigadmin.local,bigreal.local,bigsim.local
```

Docker 开发模式下，Django 进程运行在 `big-apple-admin`、`big-apple-real`、`big-apple-sim` 容器内，MySQL host 应写同一 `dev-net` 网络里的容器名 `mysql97`。如果写成宿主机视角的 `127.0.0.1`，容器内会尝试连接自己而不是 MySQL。

如果需要使用 nginx gateway URL，请确认 Windows hosts 文件包含：

```text
127.0.0.1 bigadmin.local
127.0.0.1 bigreal.local
127.0.0.1 bigsim.local
```

`BIG_APPLE_CONTRACTS_ROOT` 默认使用 `../bigapple-docs/technical-contracts`，通常不需要手动设置；当前运行时代码不直接读取 contracts 文件，普通 CI 和 Live OS 自检也不要求相邻 docs 仓库存在。

`start.bat` 会检查 Docker Desktop、`.env`、`dev-net`、`mysql97`、`nginx` 和本地域名映射。它只启动和连接已有容器，不会创建数据库容器、nginx 容器、Docker network 或数据卷。

## 常用命令

无第三方依赖的仓库检查。默认只检查 Live OS 仓库自身：

```bash
python scripts/check_project.py
```

涉及 API、schema 或 payload 兼容性时，再显式检查 contracts：

```bash
python scripts/check_project.py --check-contracts
```

启动 Docker 开发环境：

```bat
start.bat
```

`start.bat` 是本地开发推荐启动方式。它会：

- 切换到 Live OS 仓库根目录。
- 校验 `.env` 中的 `DATABASE_URL=mysql://...@mysql97:3306/...`。
- 检查 Docker Desktop 是否可用。
- 检查 `dev-net` 网络是否存在。
- 启动已有的 `mysql97` 容器并连接到 `dev-net`。
- 等待 `mysql97` health check 通过。
- 通过 `docker compose -f docker-compose.dev.yml up -d --force-recreate big-apple-admin big-apple-real big-apple-sim` 启动三个 Django 站点。
- 启动已有的 `nginx` 容器并连接到 `dev-net`。
- 输出直连 Django 和 nginx gateway 访问地址。
- 使用 `--noreload` 启动 Django 开发服务，避免 autoreload 在 Docker 开发环境中派生额外进程。模板小改后刷新页面即可看到；Python 代码改动后需要重新运行 `start.bat` 或手动重建对应服务。

容器启动后，control plane 和 world 迁移命令通常通过 `big-apple-admin` 执行：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py check --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py makemigrations --check --dry-run --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py migrate --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py migrate_world realworld --noinput --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py migrate_world simulation0001 --noinput --settings=live_os.settings_admin
```

创建 Django Admin 超级用户：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py createsuperuser --settings=live_os.settings_admin
```

写入后台预览用演示数据：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py seed_demo --world-id realworld --settings=live_os.settings_admin
```

`seed_demo` 是幂等命令，重复执行不会重复插入同一批演示记录。它不会删除任何已有数据。运行时启用 world 数据库路由后，直接执行必须显式传入 `--world-id`；被 `seed_world` 或 `smoke_workflow` 调用时会复用已绑定的 world 上下文。
当前 seed 数据包含 `bigapple001据点执行计划`，可在 Admin 中编辑计划、版本、节点、依赖、需求和容量影响，并在观察台中查看主线进度。

## 前端资源

本项目使用 Django 生态方式接入前端工具：

- `django-tailwind`：管理 `theme` Django app 中的 Tailwind 构建。
- `daisyUI`：作为 Tailwind 插件配置在 `theme/static_src/src/styles.css`。
- `django-htmx`：通过 `django_htmx.middleware.HtmxMiddleware` 和模板标签加载 HTMX。
- 主题模板：通过 `ACTIVE_THEME`、`THEME_CONFIGS` 和 `templates/themes/<theme_key>/` 管理页面展示层。完整规则见 `docs/development/theme-system.md`。

前端源码位置：

```text
theme/static_src/
```

编译后的 CSS 位置：

```text
theme/static/css/dist/styles.css
```

首次拉取或重新安装依赖后：

```bash
python manage.py tailwind install
```

修改模板或 Tailwind class 后，需要重新构建：

```bash
python manage.py tailwind build
```

## Runtime 错误页

固定 world runtime 的普通网页入口使用统一友好错误页：

- `live_os.error_handlers` 提供 400 / 403 / 404 / 500 handler 和 405 渲染函数。
- `live_os.middleware.FriendlyErrorPageMiddleware` 将普通网页中的 403 / 404 / 405 响应替换为 `templates/errors/runtime_error.html`。
- `/api/` 和 `/admin/` 被 middleware 跳过，避免把 API 或后台错误响应改成普通网页。
- `/logout/` 必须保持 POST-only；GET `/logout/` 返回 405 友好页，不执行退出。

修改错误页模板中的 Tailwind / daisyUI class 后，需要运行：

```bash
python manage.py tailwind build
```

开发时也可以使用 watch：

```bash
python manage.py tailwind start
```

当前 Dockerfile 不安装 Node.js。修改 Tailwind 源样式时，仍建议在宿主机 Python/Node 开发环境中运行上述 Tailwind 命令，或单独补充前端构建容器。

`node_modules/` 不入库；`package.json`、`package-lock.json`、Tailwind 源文件和编译后的 `styles.css` 入库，方便没有前端上下文的开发者和 AI agent 直接运行 Django 页面。

主题模板约定见 `docs/development/theme-system.md`。当前主 fallback 主题是 `default_game`。

跑通第一条 API 业务闭环：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py smoke_workflow --world-id realworld --seed-demo --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py smoke_workflow --world-id simulation0001 --settings=live_os.settings_admin
```

`smoke_workflow` 会在指定 world 内通过 HTTP API 完成：

1. 查询开放任务
2. 领取任务
3. 提交劳动
4. 验收任务
5. 查询积分流水
6. 查询事件流
7. 查询观察台摘要

该命令默认验证 `realworld`，也可以用 `--world-id simulation0001` 验证仿真世界。真实世界默认不会写入演示数据；需要本地演示起点时显式加 `--seed-demo`，或先运行 `seed_demo --world-id realworld`。仿真 world 会自动使用 `seed_world` 准备隔离演示数据。它会在目标 world 数据库中新建一个 `task-smoke-*` 任务，用于开发自检，不用于生产数据。

仿真 smoke、零起点推进、归档、废弃和后台重置流程集中维护在 [仿真开发命令](./simulation-commands.md)。

## 本地访问入口

```text
http://127.0.0.1:20100/admin/       # control 后台
http://bigadmin.local/admin/
http://127.0.0.1:20101/             # realworld 公开首页
http://bigreal.local/
http://127.0.0.1:20101/workspace/   # realworld 成员工作台
http://127.0.0.1:20102/             # simulation 公开首页
http://bigsim.local/
http://127.0.0.1:20102/workspace/   # simulation 成员工作台
```

真实世界和仿真世界 runtime 不暴露 `/live-admin/` 或 `/admin/`。底层维护、仿真实验和高影响操作统一进入 control plane；成员日常使用 `/workspace/`，公开观察使用公开首页 `/`。

产品边界说明：

- 成员工作台、成员报名、招募方向、公开资料和报销入口见 [成员工作台](../product/member-workspace.md)。
- 公开首页、事件流、公开反馈、公开财务和仿真档案馆见 [公开首页](../product/observer.md)。
- Control 后台职责见 [Admin 内部维护后台](../product/admin.md)。
- 仿真推进和实验后台职责见 [仿真与实验后台](../product/simulation.md)。

常用局部测试：

```powershell
.\.venv\Scripts\python.exe manage.py test feedback observer --settings=live_os.test_settings
.\.venv\Scripts\python.exe manage.py test core.tests.test_finance --settings=live_os.test_settings
```

后台界面已设置为中文：

- Django 语言：`zh-hans`
- 时区：`Asia/Shanghai`
- Admin 站点标题：`大苹果 Live OS 管理后台`
- 核心模型、字段、枚举显示名：中文

如果后台看起来像纯 HTML，或者标题仍然显示 `Django administration`、`Site administration`，说明当前访问到的服务进程没有正确加载本地开发配置。按下面步骤处理：

1. 停掉当前 Web 容器或旧的宿主机 `runserver` 进程。
2. 确认从 Live OS 仓库根目录启动。
3. 重新启动：

```powershell
docker compose -f docker-compose.dev.yml down
start.bat
```

4. 在浏览器中强制刷新 `http://127.0.0.1:20100/admin/` 或 `http://bigadmin.local/admin/`。

本地开发在未设置 `BIG_APPLE_ENV` / `DJANGO_ENV` 时默认按 `local` 处理，允许开发用 secret 和 `DJANGO_DEBUG=true`，这样 Django runserver 会提供 Admin 所需的 CSS/JS 静态资源。

非本地环境必须显式设置：

- `BIG_APPLE_ENV=production` 或 `DJANGO_ENV=production`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=false`
- `DJANGO_ALLOWED_HOSTS`
- 通过 HTTPS 代理访问表单页面时设置 `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_SECURE_SSL_REDIRECT=true`
- `DJANGO_SESSION_COOKIE_SECURE=true`
- `DJANGO_CSRF_COOKIE_SECURE=true`
- `DJANGO_SECURE_HSTS_SECONDS` 为正整数

生产环境还必须配置正式静态资源服务。

API 闭环测试：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py test core live_os observer workspace simulation simulation_lab worlds --settings=live_os.test_settings
```

测试设置位于 `live_os/test_settings.py`，默认使用 SQLite 内存库，不依赖本地 MySQL 连接。

## 文档同步规则

任何行为变化都应在同一个变更中更新文档：

- 模型或表结构变化：更新 `docs/architecture/database-schema.md`
- 项目执行计划或主线节点规则变化：更新 `docs/product/project-plan.md`
- API 变化：先更新 contracts，再更新 `docs/reference/api.md`
- 架构边界变化：更新 `docs/architecture/overview.md`
- 新开发流程：更新 `docs/development/setup.md`
- AI 协作规则变化：更新 `docs/development/ai-guide.md`
- 仿真推进规则或页面入口变化：更新 `docs/product/simulation.md`
- 观察台前端布局、HTMX partial 或 Tailwind/daisyUI 构建方式变化：更新 `docs/product/observer.md` 和本文件

整理或修正文档时遵守以下事实源规则：

- Live OS 行为以当前 `bigapple-liveos` 仓库实现、测试和配置为准，不以本地旧备份目录作为依据。
- 运行数据库以 MySQL 为目标；MySQL 接入和数据初始化文档不保留旧数据库迁移、回滚或兼容对比叙事。
- 已删除入口、当前可用入口、计划废弃入口和未来规划必须分别写清，不用“临时”“后续”等模糊词替代状态。
- 同一事实只保留一个主说明位置；其他文档需要提及时应链接到主说明，避免重复维护。

## 契约变更规则

不要先在 Live OS 里发明响应字段。变更顺序必须是：

1. 修改 `technical-contracts`
2. 修改 Live OS 实现
3. 更新示例和测试
4. 更新文档

## World 数据库与生命周期

多数据库布局、固定 world 本地入口、`migrate_world`、历史数据修复命令、`bootstrap_world` 和 world 登记/归档/删除命令集中维护在 [World 数据库与生命周期](./world-databases.md)。

## 仿真开发命令

仿真 smoke、零起点推进、归档、废弃和后台重置流程集中维护在 [仿真开发命令](./simulation-commands.md)。
