---
sidebar_position: 2
title: 治理交互模型边界
---

# 治理交互模型边界

本文约束业务对象、统一决策机制、权限与事件账本之间的边界。

## 当前实现状态

旧通用提案、投票、执行和选民规则实现已经完整删除。新的统一提案生命周期已经以 `ApprovalProposal` 为唯一聚合恢复**守约者报名准入**：它使用不可变政策版本、冻结选民快照、实名票据修订、确定性判定和幂等执行。下列尚未登记业务适配器的流程仍然失败关闭：

- 需要共同决定的角色任命与卸任；
- 财务审核职责的共同任命；
- 社区共议、守约事务、专业事务和管理事务。

成员报名提交后会关联唯一准入提案；无已发布政策时保持“等待政策配置”，不得表决或执行。其他未迁移流程必须显示明确关闭状态，不得回退到旧实现或借用准入适配器。当前实现由 Live OS OpenSpec 变更 `add-unified-member-admission-proposals` 约束。

## 三层边界

```text
业务对象：Task / MemberApplication / RoleAssignment / LedgerEntry / Resource ...
决策机制：统一提案系统（当前仅成员准入完成业务接入）
事实留痕：SystemEvent
```

1. 具体业务保留具体模型，提案不是所有业务对象的父类。
2. 多人共同授权、重大裁决、规则变化、预算或高影响资源分配必须进入统一提案系统。
3. 统一提案系统未覆盖的写操作必须失败关闭。
4. 已发生的关键状态变化追加 `SystemEvent`；事件账本不替代业务状态机。
5. 历史错误只能通过撤销、冲正、更正或后续业务动作处理。

## 业务对象

| 对象 | 职责 | 与统一提案的关系 |
| --- | --- | --- |
| `MemberApplication` | 保存报名资料和处理状态 | 关联唯一准入提案；通过后由适配器授予一年期守约者资格 |
| `RoleAssignment` | 保存成员在时间范围内拥有的角色 | 共同任免尚未迁入；初始化和明确允许的直接服务仍独立存在 |
| `Task` | 工作内容、领取、提交和验收 | 将来可由统一提案决议触发，但不保存旧提案来源字段 |
| `LedgerEntry` | 积分增加、扣减、调整和冲正 | 是账务事实，不是表决记录 |
| `Resource` | 库存、预警线和补充方式 | 日常调整走领域服务，重大政策进入未来统一提案 |
| `CommunityFeedback` | 注册用户公开提问、建议和倡议 | 只能形成提案种子，不得直接改变权威状态 |
| `SystemEvent` | 关键事实、顺序、责任人和哈希链 | 不承载选民规则或业务状态机 |

## 权限边界

权限事实链保持为：

```text
Member -> active RoleAssignment -> RolePermission -> Permission
```

运行时授权统一走 `AuthorizationService` / OpenFGA。Credential、NFT、Badge、`Member.status`、Django `is_staff` 和 `is_superuser` 都不能成为业务权限旁路。管理员不会自动获得执衡者任期或投票权。

所有 `RoleAssignment` 必须由 `core.role_assignment_services.create_role_assignment()` 或明确的初始化服务创建。执衡者、管理员以及带 `governance.*` / `finance.*` 权限的职责要求有效守约者资格；暂停或退出成员不能获得新职责。

## 当前仍可执行的领域服务

- 任务：`core.tasks.authoring`、`core.tasks.member_workflow`、`core.tasks.review`；
- 资源：`core.resource_services`；
- 事件反馈：`core.event_feedback_services`；
- 积分：`core.ledger_services`；
- 角色权威事实：`core.role_assignment_services`；
- 运行时授权：`core.authorization_services`。

这些服务成功改变权威状态后应追加相应 `SystemEvent`。需要共同决定的调用方不得因为统一提案尚未完成而直接调用底层服务绕过治理。

## 新功能开发规则

1. 先确定具体业务对象和权威状态。
2. 判断动作是否需要共同决定；需要时只接入统一提案系统并登记独立业务适配器。
3. 统一系统尚未覆盖时，提供明确关闭状态，不建立临时审批表或兼容旧模型。
4. view、Admin 和 command 不直接修改关键状态，写操作进入领域服务。
5. 成功动作追加 `SystemEvent`，失败校验必须发生在任何写入之前。
6. 测试至少覆盖成功证据、失败不写入、权限失败关闭和 world 隔离。
