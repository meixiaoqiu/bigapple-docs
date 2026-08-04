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
| 执衡者 | 有效守约者本人申请，无需审核 | 一年，到期不自动续任 | 承担执衡义务，并按提案的选民规则参与表决。 |
| 管理员 | 正常任命 | 由任命记录决定 | 不自动取得执衡者资格或投票权。 |

以下是派生状态，不创建 `Role`、`RoleAssignment` 或 OpenFGA tuple：未登录用户访问公开内容是匿名访问；已注册但没有有效守约者资格的用户显示为贡献者；守约者申请是流程状态。

## 提案表决规则

| 提案类型 | 当前有效选民 |
| --- | --- |
| 社区共议 | 当前有效注册成员，包括长期贡献者。 |
| 守约事务 | 同时具有有效守约者资格和未到期执衡者任期的成员。 |
| 专业事务 | 同时具有有效守约者资格、未到期执衡者任期和指定领域专业资格的成员。 |
| 管理事务 | 当前有效管理员；管理身份不因此产生执衡投票权。 |

管理员不是守约事务或专业事务的自动选民。成员资格、执衡者任期、专业资格、用户停用状态和当前 world 都在投票时重新校验；提案开始时的快照不能绕过之后失效的授权。

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
| 已注册但未取得守约者资格 | 显示贡献者；没有角色任命，可参与社区共议。 | `core.tests.test_identity_display`、`core.tests.test_electorate_rules` |
| 守约者 | 显示守约者；可以申请执衡者，但不能仅凭此投票。 | `core.tests.test_role_catalog` |
| 执衡者 | 显示守约者和执衡者；可投守约事务提案。 | `core.tests.test_openfga_role_policy.OpenFGARolePolicyTests`、`core.tests.test_proposals.ProposalVotingPolicyTests` |
| 管理员 | 显示守约者和管理员；可执行明确维护操作；不可投票。 | `core.tests.test_openfga_role_policy.OpenFGARolePolicyTests`、`core.tests.test_proposals.ProposalVotingPolicyTests.test_covenanter_or_maintainer_without_deliberator_term_cannot_vote` |
| 兼任执衡者和管理员 | 两项职责同时显示；维护权和投票权分别计算。 | `core.tests.test_identity_display` |
| 具备专业资格的执衡者 | 仅在相同专业领域的专业事务中可投票。 | `core.tests.test_proposals` |
| 专业资格撤销或到期 | 立即失去相应专业事务投票权。 | `core.tests.test_proposals` |
| 执衡者任期到期 | 不自动续任；失去投票权，重新申请后才恢复。 | `core.tests.test_deliberation_services.DeliberationServiceTests.test_expired_term_is_retained_and_reapplication_creates_new_term` |
| 用户停用 | 失去运行时授权。 | `core.tests.test_authorization_services` |
| 跨 world 成员 | 不能取得另一 world 的权限。 | `worlds.tests.test_world_routes.WorldRouteTests.test_world_session_does_not_cross_to_another_world`、`worlds.tests.test_world_database_isolation.WorldDatabaseIsolationTests` |

界面验收时可打开 `/u/role-baseline-deliberator/` 和 `/u/role-baseline-maintainer/`：前者应显示“守约者、执衡者”，后者应显示“守约者、管理员”，且管理员页面不应显示“执衡者”。
