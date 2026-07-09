---
name: ultrawork
description: 超级工作模式（Ultrawork）— 面向高吞吐任务的并行执行引擎
argument-hint: "<task description with parallel work items>"
level: 4
---

<概念说明>
「超级工作模式（Ultrawork）」是一个**并行执行引擎**：把彼此独立的工作同时甩给多个 agent 去做，
并按任务难度路由到合适的模型档位，从而缩短总耗时。它是一个可组合的"组件"，不是独立的持久模式 ——
不含持久化、验证循环或长期状态管理（那些由 ralph、autopilot 在其之上叠加）。
</概念说明>

<Purpose>
超级工作模式（Ultrawork）是面向独立工作的并行执行引擎与执行协议。它强调意图锚定、并行的上下文收集、为非琐碎工作构建依赖感知的任务图，以及简洁的、有证据支撑的执行小结。它是一个组件，而非独立的持久模式 —— 它提供并行与路由指引，但不提供持久化、验证循环或长期状态管理。
</Purpose>

<Use_When>
- 多个独立任务可同时运行
- 用户说 "ulw"、"ultrawork"，或想要并行执行
- 你需要一次委派工作给多个 agent
- 任务受益于并发执行，但用户会自行掌控完成
</Use_When>

<Do_Not_Use_When>
- 任务要求"有验证地保证完成" —— 改用 `ralph`（ralph 已包含 ultrawork）
- 任务需要完整的自主流水线 —— 改用 `autopilot`（autopilot 含 ralph，ralph 含 ultrawork）
- 只有一个串行任务、无并行机会 —— 直接委派给 executor agent
- 用户需要会话持久化以便恢复 —— 用 `ralph`，它在 ultrawork 之上叠加了持久化
</Do_Not_Use_When>

<Why_This_Exists>
当任务彼此独立时，串行执行是浪费时间。超级工作模式能同时发起多个 agent，并把每个路由到正确的模型档位，在控制 token 成本的同时缩短总执行时间。它被设计为可组合的组件，供 ralph 和 autopilot 在其之上分层。
</Why_This_Exists>

<Execution_Policy>
- 同时发起所有独立的 agent 调用 —— 绝不把独立工作串行化
- 委派时始终显式传 `model` 参数
- 首次委派前读 `docs/shared/agent-tiers.md` 获取 agent 选择指引
- 对超过约 30 秒的操作（安装、构建、测试）用 `run_in_background: true`
- 快速命令（git status、读文件、简单检查）在前台运行
- 实现前先厘清意图与不确定性；先探索，仍受阻时才发问
- 对非琐碎任务，执行前产出带并行波次的依赖感知计划
- 委派任务的报告保持简洁：简短小结、涉及文件、验证状态、阻塞项
- 对已实现的行为需做手动 QA，而非仅诊断
</Execution_Policy>

<Steps>
1. **读 agent 参考**：加载 `docs/shared/agent-tiers.md` 做档位选择
2. **先锚定意图**：确认请求是实现、调查、评估还是研究；在此明确前不要编码
3. **并行收集上下文**：
   - 用直接工具做快速读取/搜索
   - 用探索/文档 agent 获取广泛上下文
4. **按独立性给任务分类**：识别哪些任务可并行、哪些有依赖
5. **为非琐碎工作创建任务图**：
   - 并行执行波次
   - 依赖矩阵
   - 每个任务的验收标准与验证步骤
6. **路由到正确档位**：
   - 简单查找/定义：LOW 档（Haiku）
   - 标准实现：MEDIUM 档（Sonnet）
   - 复杂分析/重构：HIGH 档（Opus）
7. **同时发起独立任务**：一次性启动所有可并行的任务
8. **串行运行依赖任务**：先等前置完成，再启动依赖工作
9. **后台跑长操作**：构建、安装和测试套件用 `run_in_background: true`
10. **所有任务完成后验证**（轻量）：
   - 构建/类型检查通过
   - 受影响的测试通过
   - 已实现行为完成手动 QA
   - 未引入新错误
</Steps>

<Tool_Usage>
- Use `Task(subagent_type="oh-my-claudecode:executor", model="haiku", ...)` for simple changes
- Use `Task(subagent_type="oh-my-claudecode:executor", model="sonnet", ...)` for standard work
- Use `Task(subagent_type="oh-my-claudecode:executor", model="opus", ...)` for complex work
- Use `run_in_background: true` for package installs, builds, and test suites
- Use foreground execution for quick status checks and file operations
</Tool_Usage>

<Examples>
<Good>
Three independent tasks fired simultaneously:
```
Task(subagent_type="oh-my-claudecode:executor", model="haiku", prompt="Add missing type export for Config interface")
Task(subagent_type="oh-my-claudecode:executor", model="sonnet", prompt="Implement the /api/users endpoint with validation")
Task(subagent_type="oh-my-claudecode:executor", model="sonnet", prompt="Add integration tests for the auth middleware")
```
Why good: Independent tasks at appropriate tiers, all fired at once.
</Good>

<Good>
Correct use of background execution:
```
Task(subagent_type="oh-my-claudecode:executor", model="sonnet", prompt="npm install && npm run build", run_in_background=true)
Task(subagent_type="oh-my-claudecode:executor", model="haiku", prompt="Update the README with new API endpoints")
```
Why good: Long build runs in background while short task runs in foreground.
</Good>

<Bad>
Sequential execution of independent work:
```
result1 = Task(executor, "Add type export")  # wait...
result2 = Task(executor, "Implement endpoint")     # wait...
result3 = Task(executor, "Add tests")              # wait...
```
Why bad: These tasks are independent. Running them sequentially wastes time.
</Bad>

<Bad>
Wrong tier selection:
```
Task(subagent_type="oh-my-claudecode:executor", model="opus", prompt="Add a missing semicolon")
```
Why bad: Opus is expensive overkill for a trivial fix. Use executor with Haiku instead.
</Bad>
</Examples>

<Escalation_And_Stop_Conditions>
- When ultrawork is invoked directly (not via ralph), apply lightweight verification only -- build passes, tests pass, no new errors
- For full persistence and comprehensive architect verification, recommend switching to `ralph` mode
- If a task fails repeatedly across retries, report the issue rather than retrying indefinitely
- Escalate to the user when tasks have unclear dependencies or conflicting requirements
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] All parallel tasks completed
- [ ] Build/typecheck passes
- [ ] Affected tests pass
- [ ] No new errors introduced
</Final_Checklist>

## Parallel session caveats

- **Multi-repo workspace anchor:** drop a `.omc-workspace` marker at the parent directory so multiple sessions across sub-repos share one `.omc/`. Resolution order: `OMC_STATE_DIR > .omc-workspace > git > cwd`. See `docs/REFERENCE.md`.
- **Session id source:** OMC_SESSION_ID env var wins in CLI contexts; hook payload data.session_id wins in hook contexts.
- **Plan id (when applicable):** Ultrawork has no persistent state; two concurrent runs are independent by design. No plan-id needed.
- **Parallel verdict:** supported (stateless component)

<Advanced>
## Relationship to Other Modes

```
ralph (persistence wrapper)
 \-- includes: ultrawork (this skill)
     \-- provides: parallel execution only

autopilot (autonomous execution)
 \-- includes: ralph
     \-- includes: ultrawork (this skill)
```

Ultrawork is the parallelism layer. Ralph adds persistence and verification. Autopilot adds the full lifecycle pipeline.
</Advanced>
