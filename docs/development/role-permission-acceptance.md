---
sidebar_position: 8
title: 角色与权限验收矩阵
---

# 角色与权限验收矩阵

本矩阵定义当前角色与权限制度的可重复验收方式。它不把显示标签当作授权依据；运行时授权由 `AuthorizationService` 和 OpenFGA 计算。

## 直接事实与派生状态

系统只直接记录以下三种角色事实：

| 名称 | 取得方式 | 是否有期限 | 作用 |
| --- | --- | --- | --- |
| 守约者 | 守约者准入 | 由任命记录决定 | 成为执衡者或管理员的前提。 |
| 执衡者 | 有效守约者参加并通过资格考试，无需人工审核 | 一年，到期不自动续任 | 承担执衡义务，并按提案的选民规则参与表决。 |
| 管理员 | 正常任命 | 由任命记录决定 | 不自动取得执衡者资格或投票权。 |

以下是派生状态，不创建 `Role`、`RoleAssignment` 或 OpenFGA tuple：未登录用户访问公开内容是匿名访问；已注册但没有有效守约者资格的用户显示为贡献者；守约者申请是流程状态。

## 统一提案制度目标（当前尚未实现）

| 提案类型 | 未来统一提案系统的合格选民规则 |
| --- | --- |
| 社区共议 | 当前有效注册成员，包括长期贡献者。 |
| 守约事务 | 同时具有有效守约者资格和未到期执衡者任期的成员。 |
| 专业事务 | 同时具有有效守约者资格、未到期执衡者任期和指定领域专业资格的成员。 |
| 管理事务 | 当前有效管理员；管理身份不因此产生执衡投票权。 |

这些规则是后续统一提案系统必须实现的制度要求。当前旧通用提案实现已经删除，新的统一提案系统尚未完成，因此社区共议、守约事务、专业事务和管理事务都不能执行投票。管理员未来也不是守约事务或专业事务的自动选民；届时成员资格、执衡者任期、专业资格、用户停用状态和当前 world 必须在投票时重新校验。

## 仿真 world 的可重复基线

以下命令只允许明确的仿真 world。命令会先验证 OpenFGA 连通性和当前模型；预检失败时不会修改数据库。

```powershell
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py reset_role_permission_baseline --world-id simulation0001 --settings=live_os.settings_admin --format json
```

成功后，基线包含守约者、执衡者、管理员、具有财务专业资格的执衡者，以及必要的 OpenFGA tuple。重置会清理该仿真 world 中用于本场景的角色、任命、资格和提案选民数据；不可用于 `realworld`。

## 验收矩阵

| 场景 | 应有结果 | 自动证据 |
| --- | --- | --- |
| 未登录访问公开首页 | 可读取公开内容；不显示或写入任何观看身份角色。 | `observer.tests.test_member_profiles` |
| 已注册但未取得守约者资格 | 显示贡献者；没有角色任命。社区共议制度保留，但统一提案流程完成前不可执行投票。 | `core.tests.test_identity_display`、旧提案残余检查 |
| 守约者 | 显示守约者；可以参加执衡者考试，但不能仅凭守约者资格投票。 | `core.tests.test_deliberator_exam.DeliberatorExamServiceTests` |
| 执衡者 | 考试通过后显示守约者和执衡者；守约事务投票是未来制度能力，当前统一提案入口失败关闭。 | `core.tests.test_deliberator_exam`、`core.tests.test_identity_display`、旧提案残余检查 |
| 管理员 | 显示守约者和管理员；可执行明确维护操作；不会自动获得执衡者任期，当前也不存在可用的统一投票入口。 | `core.tests.test_authorization_services`、`core.tests.test_identity_display` |
| 兼任执衡者和管理员 | 两项职责同时显示；维护权和投票权分别计算。 | `core.tests.test_identity_display` |
| 具备专业资格的执衡者 | 专业资格事实可以记录；按领域投票是未来制度能力，当前不可执行。 | `core.tests.test_professional_qualification_services`、旧提案残余检查 |
| 专业资格撤销或到期 | 资格事实立即失效；未来统一提案系统不得再把该成员视为相应专业事务合格选民。 | `core.tests.test_professional_qualification_services` |
| 执衡者任期到期 | 不自动续任；失去投票权，重新参加并通过当时生效的考试后才恢复。 | `core.tests.test_deliberator_exam` |
| 财务审核员任命 | 任命页面可查看当前审核员，但提名、表决和执行在统一提案流程完成前失败关闭。 | `workspace.tests.test_finance_role_views`、旧提案残余检查 |
| 财务审核职责分离 | 已有财务审核权限者可以审核他人报销；不得自审，且不自动取得付款或公开附件发布权限。 | `core.tests.test_authorization_services`、财务领域定向测试 |
| 用户停用 | 失去运行时授权。 | `core.tests.test_authorization_services` |
| 跨 world 成员 | 不能取得另一 world 的权限。 | `worlds.tests.test_world_routes.WorldRouteTests.test_world_session_does_not_cross_to_another_world`、`worlds.tests.test_world_database_isolation.WorldDatabaseIsolationTests` |

界面验收时可打开 `/u/role-baseline-deliberator/` 和 `/u/role-baseline-administrator/`：前者应显示“守约者、执衡者”，后者应显示“守约者、管理员”，且管理员页面不应显示“执衡者”。
