---
sidebar_position: 1
title: 开发说明
---

# 开发说明

## 本地依赖

头像能力新增 Pillow、Magika、`django-storages` 和 boto3，随项目依赖一起安装。Pillow 负责完整解码与 WebP 重编码，Magika 负责内容类型识别，后两者用于 OCI Object Storage 的 S3 兼容接入；Magika 不替代图片解码或病毒扫描。

本地开发默认使用：

```dotenv
BIG_APPLE_AVATAR_STORAGE_BACKEND=filesystem
```

处理后的当前头像和临时对象分别位于被 Git 忽略的 `var/avatars/` 与 `var/avatar_temporary/`。生产 OCI 配置使用私有 bucket：

```dotenv
BIG_APPLE_AVATAR_STORAGE_BACKEND=oci_s3
BIG_APPLE_OCI_S3_ENDPOINT_URL=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
BIG_APPLE_OCI_S3_REGION=<region>
BIG_APPLE_OCI_S3_BUCKET=<private-bucket>
BIG_APPLE_OCI_S3_ACCESS_KEY=<customer-secret-access-key>
BIG_APPLE_OCI_S3_SECRET_KEY=<customer-secret-key>
```

不要提交或输出 Customer Secret Key。完成 bucket 和最小权限配置后，可在目标环境运行：

```powershell
python manage.py probe_avatar_storage --world-id realworld --settings=live_os.settings_admin
python manage.py audit_avatar_storage --world-id realworld --settings=live_os.settings_admin
```

`probe_avatar_storage` 只写入并清理一个临时测试对象。`audit_avatar_storage` 默认 dry-run，报告缺失、无引用、过期临时对象和元数据不一致；只有显式增加 `--clean` 才清理已经证明无当前引用的头像/临时对象，且命令拒绝永久附件前缀。

- Docker Desktop
- Docker network：`dev-net`（缺少时由 `start.bat` 自动创建）
- 已存在的 MySQL 容器：`mysql97`
- 已存在的 nginx 容器：`nginx`
- 可连接的 MySQL 数据库，推荐 `utf8mb4` 字符集和 `utf8mb4_0900_as_cs` 排序规则
- OpenFGA 由 `docker-compose.dev.yml` 启动两个本地实例：realworld 和 simulation 分离

## 安装

```bat
copy .env.example .env
notepad .env
```

头像上传依赖 Pillow、Magika、`django-storages` 和 boto3，随项目依赖一起安装。Pillow 负责完整解码与 WebP 重编码，Magika 负责内容类型识别，后两者用于 OCI Object Storage 的 S3 兼容接入；Magika 不替代图片解码或病毒扫描。

OCI S3 兼容后端使用 SigV4、path-style addressing，并把 botocore 的请求和响应 checksum 策略设为 `when_required`。OCI 不支持带 `aws-chunked` content encoding 的上传；不得移除该配置，否则新版 boto3/botocore 的尾随 checksum 可能让 PutObject 返回 HTTP 501。

头像和临时对象共享同一 bucket/root，使用 `<world-id>/runtime/current-assets/avatars/` 和 `<world-id>/runtime/temporary/avatar-uploads/` 区分生命周期。旧版 `current/worlds/...` 对象使用以下命令先 dry-run，再执行无损迁移：

```bat
python manage.py migrate_avatar_storage_layout --world-id simulation0001 --settings=live_os.settings_sim
python manage.py migrate_avatar_storage_layout --world-id simulation0001 --apply --settings=live_os.settings_sim
```

仿真世界重置会清理该 world 的 `runtime/` 对象，但不会读取或删除 `SimulationSnapshot` 与 `var/simulation_archives/`。

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

`BIG_APPLE_CONTRACTS_ROOT` 默认使用 `../bigapple-docs/static/technical-contracts`，通常不需要手动设置；当前运行时代码不直接读取 contracts 文件，普通 CI 和 Live OS 自检也不要求相邻 docs 仓库存在。

`start.bat` 会检查 Docker Desktop、`.env`、`dev-net`、`mysql97`、`nginx` 和本地域名映射。缺少 `dev-net` 时会自动创建；它会启动已有的数据库和 nginx 容器并连接网络，但不会创建数据库容器、nginx 容器或它们的数据卷。

## OpenFGA 本地授权服务

本地开发环境使用两个独立 OpenFGA 实例：

| 用途 | Docker service | 宿主机 API | 宿主机 Playground | 推荐 nginx 域名 |
| --- | --- | --- | --- | --- |
| 真实世界授权 | `openfga-real` | `127.0.0.1:20103` | `127.0.0.1:20105` | `openfga-real.local` |
| 仿真世界授权 | `openfga-sim` | `127.0.0.1:20106` | `127.0.0.1:20108` | `openfga-sim.local` |

两个实例使用各自的数据卷。仿真 world 可以频繁重置；sim OpenFGA 独立运行，必要时可以清空 sim store 或重建 sim tuple，而不会影响 realworld 授权数据。

Django 容器内访问 OpenFGA 使用 Compose service name；宿主机浏览器或调试脚本使用 `127.0.0.1:20103` / `127.0.0.1:20106`。`.env` 中需要保留下列配置键，值由本地 bootstrap 命令生成，不要把真实 store id 或 model id 写进公开文档：

```dotenv
BIG_APPLE_AUTHORIZATION_BACKEND=openfga
OPENFGA_REAL_API_URL=http://openfga-real:8080
OPENFGA_REAL_STORE_ID=...
OPENFGA_REAL_AUTHORIZATION_MODEL_ID=...
OPENFGA_SIM_API_URL=http://openfga-sim:8082
OPENFGA_SIM_STORE_ID=...
OPENFGA_SIM_AUTHORIZATION_MODEL_ID=...
```

初始化或更新授权模型后，需要从 Django 权威数据重建 tuple：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py openfga_rebuild_tuples --world-kind real --world-id realworld --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py openfga_rebuild_tuples --world-kind sim --world-id simulation0001 --settings=live_os.settings_admin
```

对照检查：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py openfga_authorization_probe --world-kind real --world-id realworld --fail-on-diff --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py openfga_authorization_probe --world-kind sim --world-id simulation0001 --fail-on-diff --settings=live_os.settings_admin
```

`openfga_rebuild_tuples` 是完整重建：先删除目标 store 中已有 tuple，再根据当前 Django 权威数据写入新的投影。重建失败不能视为成功迁移；运行时 OpenFGA 不可用或 store/model 配置缺失时必须失败关闭，成员工作台和治理/财务权限都应拒绝访问。

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
- 检查 `dev-net` 网络，缺少时自动创建。
- 启动已有的 `mysql97` 容器并连接到 `dev-net`。
- 等待 `mysql97` health check 通过。
- 构建缺失的 `big-apple-live-os:dev` 镜像并迁移 control、realworld 和 simulation0001 数据库。
- 启动并初始化 real/sim OpenFGA，重建权限 tuples，并比较 Django 权威数据与 OpenFGA 权限结果。
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

根据提示填写用户名、邮箱和密码，然后登录：

```text
http://bigadmin.local/admin/
```

该命令只创建 control DB 的 Django Admin 超级用户，不会创建 `bigreal.local` 或 `bigsim.local` 的成员账号。world 成员与管理员的初始化方式见 [World 数据库与生命周期](./world-databases.md)。

写入后台预览用演示数据：

```bat
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py seed_demo --world-id realworld --settings=live_os.settings_admin
```

演示任务领取者 `mem-0001` 拥有 active `ROLE_COVENANTER`。贡献者是派生状态，
不创建 `ROLE_CONTRIBUTOR`。完整工作台权限以 active role assignment 为准；
`Member.status=ADMITTED` 本身不能代替守约者角色。`smoke_workflow`
依赖这一演示身份，并会通过真实任务领取 API 验证权限链。

`seed_demo` 是幂等命令，重复执行不会重复插入同一批演示记录。它不会删除任何已有数据。运行时启用 world 数据库路由后，直接执行必须显式传入 `--world-id`；被 `seed_world` 或 `smoke_workflow` 调用时会复用已绑定的 world 上下文。
当前 seed 数据包含 `bigapple001据点执行计划`，可在 Admin 中编辑计划、版本、节点、依赖、需求和容量影响，并在观察台中查看主线进度。

## OpenFGA 本地初始化与 ID 恢复

本地开发使用两套 OpenFGA：

| 用途 | 容器内 API | 宿主机 API | Playground |
| --- | --- | --- | --- |
| realworld | `http://openfga-real:8080` | `http://127.0.0.1:20103` | `http://openfga-real.local/playground` |
| simulation0001 | `http://openfga-sim:8082` | `http://127.0.0.1:20106` | `http://openfga-sim.local/playground` |

`.env` 中必须为两套服务分别配置 store、authorization model 和当前模型文件的 SHA-256：

```dotenv
OPENFGA_REAL_STORE_NAME=big-apple-realworld
OPENFGA_REAL_STORE_ID=
OPENFGA_REAL_AUTHORIZATION_MODEL_ID=
OPENFGA_SIM_STORE_NAME=big-apple-simulation0001
OPENFGA_SIM_STORE_ID=
OPENFGA_SIM_AUTHORIZATION_MODEL_ID=
OPENFGA_AUTHORIZATION_MODEL_SHA256=
```

这些值由开发者根据 bootstrap 输出手工维护。`start.bat` 和 `scripts/Invoke-OpenFgaLocalSetup.ps1` 只读取、校验 `.env`，不会修改文件。

### 启动时的只读校验

`start.bat` 会先启动 OpenFGA 容器以便检查，然后调用 `scripts/Invoke-OpenFgaLocalSetup.ps1` 校验：

- real/sim OpenFGA HTTP API 是否可访问。
- real/sim store ID 和 authorization model ID 是否已填写。
- 配置的 store 是否真实存在。
- 配置的 authorization model 是否属于对应 store。
- real 与 sim 各自 model ID 对应的远端模型内容，是否都与当前 `openfga/bigapple.authorization-model.json` 一致。
- `OPENFGA_AUTHORIZATION_MODEL_SHA256` 是否等于当前 `openfga/bigapple.authorization-model.json` 的 SHA-256。

任何检查失败时，启动脚本会列出具体原因、bootstrap 命令和本文档地址，然后退出。开发者应检查输出、按需修改 `.env`，再重新运行 `start.bat`。启动脚本不会自动创建 model、选择 model ID 或改写本地配置。

`OPENFGA_AUTHORIZATION_MODEL_SHA256` 只是本地模型文件版本标记，不能单独证明 real/sim 正在使用该模型。启动脚本会分别读取两个 model ID 的远端内容，忽略 OpenFGA 补充的空默认字段，并对规范化后的 `schema_version`、`type_definitions` 和 `conditions` 做内容比较。两套模型必须分别通过。

配置有效后，启动流程才会重建权限 tuples、执行 Django/OpenFGA 权限结果比对并启动站点。

### 首次创建 store 和 model

首次运行 `start.bat` 时，OpenFGA 容器会启动，但因为 `.env` 中的 ID 和 SHA-256 为空，配置校验会失败。这是预期行为。保持 OpenFGA 容器运行，在 Live OS 仓库根目录执行以下命令。

创建或复用 realworld store，并写入当前授权模型：

```powershell
docker compose -f docker-compose.dev.yml run --rm --no-deps big-apple-admin python manage.py openfga_bootstrap --world-kind real --api-url http://openfga-real:8080
```

创建或复用 simulation0001 store，并写入当前授权模型：

```powershell
docker compose -f docker-compose.dev.yml run --rm --no-deps big-apple-admin python manage.py openfga_bootstrap --world-kind sim --api-url http://openfga-sim:8082
```

命令只操作 OpenFGA，不修改宿主机 `.env`。每条命令都会输出可复制的配置，例如：

```dotenv
OPENFGA_SIM_API_URL=http://openfga-sim:8082
OPENFGA_SIM_STORE_ID=...
OPENFGA_SIM_AUTHORIZATION_MODEL_ID=...
OPENFGA_AUTHORIZATION_MODEL_SHA256=...
```

把 real 命令输出的 `OPENFGA_REAL_STORE_ID`、`OPENFGA_REAL_AUTHORIZATION_MODEL_ID`，sim 命令输出的 `OPENFGA_SIM_STORE_ID`、`OPENFGA_SIM_AUTHORIZATION_MODEL_ID`，以及任一命令输出的 `OPENFGA_AUTHORIZATION_MODEL_SHA256` 手工写入 `.env`。检查无误后重新运行：

```powershell
.\start.bat
```

`openfga_bootstrap` 每次执行都会向目标 store 写入一个新的授权模型。不要把它当作查询命令重复执行；普通查询使用下文的只读 API。

### 查询 store ID

查询 realworld stores：

```powershell
(Invoke-RestMethod http://127.0.0.1:20103/stores).stores |
    Select-Object id, name
```

查询 simulation stores：

```powershell
(Invoke-RestMethod http://127.0.0.1:20106/stores).stores |
    Select-Object id, name
```

根据 `.env` 中的 `OPENFGA_REAL_STORE_NAME` 或 `OPENFGA_SIM_STORE_NAME` 选择名称匹配的 store，不要把 real 与 sim 的 ID 混用。

### 查询 authorization model ID

先填入上一步查到的 store ID，再列出该 store 的全部 model：

```powershell
$storeId = "替换为store-id"

(Invoke-RestMethod "http://127.0.0.1:20106/stores/$storeId/authorization-models").authorization_models |
    Select-Object id, schema_version
```

上例查询 simulation；查询 realworld 时把端口 `20106` 改为 `20103`。

如果结果为空，说明该 store 中没有 authorization model，需要运行对应的 `openfga_bootstrap`。如果存在多个 model，不要仅凭 ID 猜测应使用哪一个；应使用最近一次明确执行 bootstrap 或权限模型发布时输出并手工写入 `.env` 的 model ID。

### 权限服务不可用排查

如果 OpenFGA 容器正在运行，但 workspace 显示“权限服务不可用”，先检查 Django 和 OpenFGA 日志：

```powershell
docker logs --tail 120 big-apple-sim
docker logs --tail 120 big-apple-openfga-sim
```

出现以下错误表示 `.env` 中的 model ID 不属于当前 store，或对应模型已经随 OpenFGA 数据卷变化而丢失：

```text
authorization_model_not_found
Authorization Model '...' not found
```

处理顺序：

1. 阅读 `start.bat` 输出的每一项配置错误，不要只确认容器状态。
2. 按上文查询 store 和 model，确认 `.env` 中的 ID 是否真实存在且 real/sim 没有混用。
3. 某一套 store/model 缺失或失效时，只运行对应 world kind 的 `openfga_bootstrap`，把新 store/model ID 手工写入 `.env`。
4. `OPENFGA_AUTHORIZATION_MODEL_SHA256` 与仓库模型不一致时，说明授权模型文件已经变化。分别为 real 和 sim 运行 `openfga_bootstrap`，更新两套 model ID，并写入命令输出的新 SHA-256。
5. 重新运行 `start.bat`，让脚本重新校验配置、重建 OpenFGA tuples，并重新创建 Django 容器。
6. 再次检查 workspace 和容器日志。

模型升级时不能只 bootstrap real 或只 bootstrap sim 后更新全局 SHA-256。另一套旧 model 即使 ID 仍然存在，也会因为远端内容与仓库模型不一致而被启动检查拒绝。

World 重置不会创建 OpenFGA model，也不会修改 `.env`。重置世界后可以重新运行 `start.bat`，由本地 OpenFGA setup 重建 tuples；也可以在确认 store/model 配置有效后单独执行：

```powershell
docker compose -f docker-compose.dev.yml run --rm --no-deps big-apple-sim python manage.py openfga_rebuild_tuples --settings=live_os.settings_sim --world-kind sim
```

该命令会删除 sim store 中现有 tuples，再根据 simulation0001 的 Django 权威数据完整重建。当前本地配置只有一个 simulation store；增加多个仿真世界前，需要先明确每个 world 的 store 或 tuple 隔离边界。OpenFGA store/model 属于本地部署配置，不属于世界重置状态。

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
http://127.0.0.1:20105/playground/  # realworld OpenFGA Playground
http://127.0.0.1:20108/playground/  # simulation OpenFGA Playground
```

真实世界和仿真世界 runtime 不暴露 `/live-admin/` 或 `/admin/`。底层维护、仿真实验和高影响操作统一进入 control plane；成员日常使用 `/workspace/`，公开观察使用公开首页 `/`。

业务授权统一通过 `AuthorizationService` 调用 OpenFGA；Django 中的 `Member`、`RoleAssignment`、`RolePermission` 和 `Permission` 仍是权威事实来源。业务页面、API 和 service 不应直接查询角色表来判断运行时权限。

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

1. 修改 `static/technical-contracts`
2. 修改 Live OS 实现
3. 更新示例和测试
4. 更新文档

## World 数据库与生命周期

多数据库布局、固定 world 本地入口、`migrate_world`、历史数据修复命令、`bootstrap_world` 和 world 登记/归档/删除命令集中维护在 [World 数据库与生命周期](./world-databases.md)。

## 仿真开发命令

仿真 smoke、零起点推进、归档、废弃和后台重置流程集中维护在 [仿真开发命令](./simulation-commands.md)。
