---
sidebar_position: 2
title: World 数据库与生命周期
---

# World 数据库与生命周期

本文档说明本地多数据库布局、world 数据库迁移、首个账号初始化、历史数据修复和 world 生命周期命令。

## 固定 World 本地入口

World routing 将 control 数据库和 world 数据库分离。默认本地 alias 是 `default -> dev_big_control`、`realworld -> dev_big_real` 和 `simulation0001 -> dev_big_sim0001`。推荐本地入口是三个固定站点：

```text
http://127.0.0.1:20100/admin/                  # control / bigadmin.local
http://127.0.0.1:20101/workspace/              # real world / bigreal.local
http://127.0.0.1:20101/                        # real world / bigreal.local
http://127.0.0.1:20102/workspace/              # simulation world / bigsim.local
http://127.0.0.1:20102/                        # simulation world / bigsim.local
```

带 world 前缀的历史路径已经移除。真实世界和仿真世界开发应使用固定 world 站点配置和根路径。

## 多数据库迁移命令

默认本地数据库布局：

```text
default        -> dev_big_control
realworld      -> dev_big_real
simulation0001 -> dev_big_sim0001
```

创建物理数据库并授权后，分别对每个数据库 alias 运行迁移：

```powershell
.\.venv\Scripts\python.exe manage.py migrate --database=default
.\.venv\Scripts\python.exe manage.py migrate --database=realworld
.\.venv\Scripts\python.exe manage.py migrate --database=simulation0001
```

`default` 拥有 `worlds.WorldRegistry` 和 Django Admin 技术账号。world 数据库拥有自己的 `auth_user`、`django_session` 行和业务表，因此 `bigreal.local` 与 `bigsim.local` 可以在拆分后的 runtime settings 下处理登录。使用 routed admin settings 时，session 读写仍走 `default`，但 `migrate_world` 也会在每个 world 数据库中创建 `django_session` 表。这样真实世界和仿真世界可以复用同一套登录路径，同时避免跨 world 混用业务数据。

可选环境变量：

```text
BIG_APPLE_CONTROL_DATABASE_URL
BIG_APPLE_REALWORLD_DATABASE_URL
BIG_APPLE_SIMULATION0001_DATABASE_URL
BIG_APPLE_SIMULATION0002_DATABASE_URL
BIG_APPLE_CONTROL_DB_NAME=dev_big_control
BIG_APPLE_REALWORLD_DB_NAME=dev_big_real
BIG_APPLE_SIMULATION0001_DB_NAME=dev_big_sim0001
BIG_APPLE_SIMULATION0002_DB_NAME=dev_big_sim0002
BIG_APPLE_WORLD_DATABASE_ALIASES=realworld,simulation0001,simulation0002
BIG_APPLE_DEFAULT_WORLD_DATABASE_ALIAS=realworld
```

`BIG_APPLE_WORLD_DATABASE_ALIASES` 驱动 Django `DATABASES` 中的 world 数据库条目。对列表中的任意 alias：

- `BIG_APPLE_{ALIAS}_DATABASE_URL` 可以完整覆盖连接 URL。
- `BIG_APPLE_{ALIAS}_DB_NAME` 可以只覆盖数据库名，并复用基础 `DATABASE_URL` 中的凭据和 host。
- 如果没有显式配置，`simulation0002` 这类仿真 alias 默认推导为 `dev_big_sim0002` 这类数据库名。

World routing 必须 fail closed。`WORLD_DATABASE_ROUTING_ENABLED=true` 时，active `WorldRegistry.database_alias` 必须存在于 `settings.DATABASES`，必须列入 `WORLD_DATABASE_ALIASES`，且不能是 `default`。如果 alias 缺失或指向 control 数据库，请求和 ORM routing 应失败，而不是静默读写 control 数据。

## 修复缺失的准入提案

历史数据从单人审核状态机迁移到 proposal-driven admission 后，如果存在历史 `MemberApplication` 有 `linked_member` 但没有 `admission_proposal`，可以对指定 world 运行修复命令。命令一次只修复一个 world 数据库。

```powershell
.\.venv\Scripts\python.exe manage.py repair_member_admission_proposals --world-id realworld --dry-run
.\.venv\Scripts\python.exe manage.py repair_member_admission_proposals --world-id realworld
.\.venv\Scripts\python.exe manage.py repair_member_admission_proposals --world-id simulation0001 --dry-run
```

Docker 开发环境：

```powershell
docker compose -f docker-compose.dev.yml exec -T big-apple-admin python manage.py repair_member_admission_proposals --world-id realworld --dry-run --settings=live_os.settings_admin
docker compose -f docker-compose.dev.yml exec -T big-apple-admin python manage.py repair_member_admission_proposals --world-id realworld --settings=live_os.settings_admin
```

该命令：

- 必须指定 `--world-id`，不能隐式依赖默认 world。
- 只处理 `linked_member` 存在且 `admission_proposal` 为空的 `MemberApplication`。
- 已有 `admission_proposal` 的记录不会被重复创建。
- 没有 `linked_member` 的记录不会被处理。
- `--dry-run` 只输出将修复的记录，不实际写入。
- 查询和提案创建均在指定 world 数据库内完成，不会跨库。

## 修复正式成员编号凭证

扫描拥有 `ROLE_FORMAL_MEMBER` 角色任命但没有正式成员编号凭证的成员，补发 `formal_member_number` Credential Grant。

```powershell
.\.venv\Scripts\python.exe manage.py repair_formal_member_credentials --world-id realworld --dry-run
.\.venv\Scripts\python.exe manage.py repair_formal_member_credentials --world-id realworld
```

该命令：

- 必须指定 `--world-id`。
- `--dry-run` 不写入任何数据（不创建 `CredentialTemplate`，不创建 `CredentialGrant`）。
- 非 dry-run 时才调用 `ensure_builtin_credential_templates()` 和 `issue_formal_member_number()`。
- 已有 `formal_member_number` 凭证的成员不会被重复发放。
- 所有 ORM 读写都在 `command_world_context(world_id)` 内执行，不会写到隐式默认 world。

## 初始化首个账号

三库迁移完成后，可用 `bootstrap_world` 一次性创建：

- control DB 的 Django Admin 技术 root：默认用户名 `admin`，`is_staff=True`，`is_superuser=True`。
- 目标 world DB 的世界治理管理员：默认用户名和成员编号 `member-admin-0001`，`is_staff=False`，`is_superuser=False`，并拥有 `治理管理员` 角色任命和 `governance.*` 基础权限。

推荐用环境变量传入密码，避免把密码写入 shell 历史：

```powershell
$env:BIG_APPLE_CONTROL_ADMIN_PASSWORD="..."
$env:BIG_APPLE_WORLD_ADMIN_PASSWORD="..."
.\.venv\Scripts\python.exe manage.py bootstrap_world --world-id realworld
```

也可以显式传参：

```powershell
.\.venv\Scripts\python.exe manage.py bootstrap_world --world-id realworld --control-password "..." --world-admin-password "..."
```

如果当前 Django 运行在 Docker 开发容器中，使用同一个容器执行命令：

```powershell
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py bootstrap_world --world-id realworld --control-password "..." --world-admin-password "..." --settings=live_os.settings_admin
```

该命令是幂等的；重复执行不会重复创建同一个 `Permission`、`Role`、`Member`、`User` 或 active `RoleAssignment`。control plane 的 `/admin/` 登录使用 control DB 技术账号；固定 world 站点的 `/login/` 登录使用对应 world DB 内的账号。
world 登录成功后统一进入 `/workspace/`。真实世界和仿真世界 runtime 不暴露独立业务后台；需要执行底层维护或高影响操作时，使用 control plane 的 `/admin/`，账号名固定使用 `member_no`。

仿真 world 的首个治理管理员可以通过 `.env` 配置：

```env
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_ENABLED=true
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_USERNAME=your-simulation-admin
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_PASSWORD=CHANGE_ME
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_EMAIL=
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_MEMBER_NO=your-simulation-admin
BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_DISPLAY_NAME=Simulation admin
```

只有显式启用并同时提供用户名和密码时，`seed_world` 每次成功初始化目标仿真 world 后才会确保该账号存在并拥有治理管理员角色。`BIG_APPLE_SIMULATION_BOOTSTRAP_ADMIN_PASSWORD=CHANGE_ME` 是模板占位符，启用前必须改掉，否则命令会失败。这样重置 `simulation0001` 对应数据库后，再运行 `seed_world simulation0001 --template ...`，即可继续使用该账号登录 `bigsim.local/workspace/`。

## World 生命周期命令

世界生命周期由 control DB 的 `worlds.WorldRegistry` 管理。当前命令只管理 world 登记和状态，不自动创建或删除 MySQL 物理数据库；物理数据库仍应由技术管理员先创建、授权，再把 alias 加入 Django settings。

新增仿真世界的闭环：

1. 在 MySQL 中创建物理数据库，例如 `dev_big_sim0002`，并给当前 Django 数据库账号授权。
2. 在 `.env` 中把 alias 加入 `BIG_APPLE_WORLD_DATABASE_ALIASES=realworld,simulation0001,simulation0002`。如数据库名不符合默认推导，再设置 `BIG_APPLE_SIMULATION0002_DB_NAME` 或 `BIG_APPLE_SIMULATION0002_DATABASE_URL`。
3. 重启 Django 进程，让新的 alias 进入 `settings.DATABASES`。
4. 用 `create_world` 登记 world。
5. 用 `migrate_world` 初始化该 world 数据库结构。
6. 用 `bootstrap_world --world-id simulation0002` 创建该仿真 world 的首个治理管理员。
7. 如需后台预览数据，用 `seed_world simulation0002 --template demo` 初始化仿真 world；如需真正从一个发起人开始推演，用 `seed_world simulation0002 --template zero_start`。

登记一个已配置数据库 alias 的仿真世界：

```powershell
.\.venv\Scripts\python.exe manage.py create_world simulation0002 --name "Simulation 0002"
```

对某个 active world 运行迁移：

```powershell
.\.venv\Scripts\python.exe manage.py migrate_world simulation0002 --noinput
```

用安全模板初始化仿真世界：

```powershell
.\.venv\Scripts\python.exe manage.py seed_world simulation0002 --template demo
.\.venv\Scripts\python.exe manage.py seed_world simulation0002 --template zero_start
```

`seed_world` 只允许作用于 `world_type=simulation` 的 active world。`demo` 模板复用现有幂等 `seed_demo` 数据，用于后台预览；`zero_start` 模板只创建一个发起人和极简计划，用于从真正零起点推演自媒体报名、成员筛选和启动门槛确认。启用仿真 bootstrap admin 时，发起人使用该真实登录成员；未启用时使用非交互 fallback 发起人。两个模板都不会复制 `realworld` 数据，也不会清空、归档或删除任何物理数据库。

仿真 world 归档后，不再参与普通登录或固定站点 world 绑定：

```powershell
.\.venv\Scripts\python.exe manage.py archive_world simulation0002
```

删除仿真世界登记。删除前必须先归档；命令只把 registry 标记为 `deleted`，不会 drop database：

```powershell
.\.venv\Scripts\python.exe manage.py delete_world simulation0002
```

`realworld` 和 `world_type=real` 的世界不能被 `archive_world` 或 `delete_world` 操作。新增 world 的 `database_alias` 必须已经存在于 `settings.DATABASES`，并列入 `BIG_APPLE_WORLD_DATABASE_ALIASES`。
