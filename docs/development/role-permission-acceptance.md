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
| 正式成员 | 正式成员准入 | 由任命记录决定 | 成为议事者或维护者的前提。 |
| 议事者 | 有效正式成员本人申请，无需审核 | 一年，到期不自动续任 | 承担议事义务，并按提案的选民政策参与表决。 |
| 维护者 | 正常任命 | 由任命记录决定 | 仅拥有明确绑定的维护权限。不会因此成为议事者或取得投票权。 |

以下是派生状态，不创建 `Role`、`RoleAssignment` 或 OpenFGA tuple：未登录用户访问公开内容是匿名访问；已注册但没有有效正式成员资格的用户显示为贡献者；正式成员申请是流程状态。

## 提案表决规则

| 提案类型 | 当前有效选民 |
| --- | --- |
| 普通议事提案 | 同时具有有效正式成员资格和未到期议事者任期的成员。 |
| 专业议事提案 | 同时具有有效正式成员资格、未到期议事者任期和该提案指定专业资格的成员。 |

维护者不是普通或专业提案的自动选民。成员资格、议事者任期、专业资格、用户停用状态和当前 world 都在投票时重新校验；提案开始时的快照不能绕过之后失效的授权。

## 仿真 world 的可重复基线

以下命令只允许明确的仿真 world。命令会先验证 OpenFGA 连通性和当前模型；预检失败时不会修改数据库。

```powershell
docker compose -f docker-compose.dev.yml exec big-apple-admin python manage.py reset_role_permission_baseline --world-id simulation0001 --settings=live_os.settings_admin --format json
```

成功后，基线包含正式成员、议事者、维护者、具有财务专业资格的议事者，以及必要的 OpenFGA tuple。重置会清理该仿真 world 中用于本场景的角色、任命、资格和提案选民数据；不可用于 `realworld`。

## 验收矩阵

| 场景 | 应有结果 | 自动证据 |
| --- | --- | --- |
| 未登录访问公开首页 | 可读取公开内容；不显示或写入任何观看身份角色。 | `observer.tests.test_member_profiles` |
| 已注册但未取得正式成员资格 | 显示贡献者；没有角色任命或投票权。 | `core.tests.test_identity_display` |
| 正式成员 | 显示正式成员；可以申请议事者，但不能仅凭此投票。 | `core.tests.test_role_catalog` |
| 议事者 | 显示正式成员和议事者；可投普通议事提案。 | `core.tests.test_openfga_role_policy.OpenFGARolePolicyTests`、`core.tests.test_proposals.ProposalVotingPolicyTests` |
| 维护者 | 显示正式成员和维护者；可执行明确维护操作；不可投票。 | `core.tests.test_openfga_role_policy.OpenFGARolePolicyTests`、`core.tests.test_proposals.ProposalVotingPolicyTests.test_formal_member_or_maintainer_without_deliberator_term_cannot_vote` |
| 兼任议事者和维护者 | 两项职责同时显示；维护权和投票权分别计算。 | `core.tests.test_identity_display` |
| 具备专业资格的议事者 | 仅在相同专业领域的专业议事提案中可投票。 | `core.tests.test_proposals` |
| 专业资格撤销或到期 | 立即失去相应专业提案投票权。 | `core.tests.test_proposals` |
| 议事者任期到期 | 不自动续任；失去投票权，重新申请后才恢复。 | `core.tests.test_deliberation_services.DeliberationServiceTests.test_expired_term_is_retained_and_reapplication_creates_new_term` |
| 用户停用 | 失去运行时授权。 | `core.tests.test_authorization_services` |
| 跨 world 成员 | 不能取得另一 world 的权限。 | `worlds.tests.test_world_routes.WorldRouteTests.test_world_session_does_not_cross_to_another_world`、`worlds.tests.test_world_database_isolation.WorldDatabaseIsolationTests` |

界面验收时可打开 `/u/role-baseline-deliberator/` 和 `/u/role-baseline-maintainer/`：前者应显示“正式成员、议事者”，后者应显示“正式成员、维护者”，且维护者页面不应显示“议事者”。
