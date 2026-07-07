# OMC 汉化术语表 (Localization Glossary)

本项目正在进行**概念本地化**：把面向用户的角色名、系统提示词、交互概念翻译为中文，
让中文高级程序员（Claude Code 重度用户）获得更好的体验。

## 汉化原则（务必遵守）

1. **只汉化"人类可读的概念与提示词"，不动核心代码逻辑。**
2. **绝不修改**以下内容（它们是路由/程序标识符，改了会破坏功能）：
   - frontmatter 的 `name:` 字段（如 `name: executor`）
   - agent 标识符字符串（如 `oh-my-claudecode:executor`、`subagent_type="..."`）
   - 工具名（`lsp_diagnostics`、`ast_grep_search`、`AskUserQuestion`、`TodoWrite`…）
   - 文件路径、目录、代码符号、命令（`.omc/plans/*.md`、`/oh-my-claudecode:start-work`、`npm run build`…）
   - 魔法关键词 / 钩子协议字符串（`[MAGIC KEYWORD: ...]`、`hook success`、`The boulder never stops`…）
3. **翻译 `description:`** 为中文，角色名首次出现用「中文名（English）」格式，保留英文以便对照与检索。
4. XML 标签名（`<Role>`、`<Constraints>`…）**保留英文**，只翻译标签内的正文。
5. 语气：专业、简洁、面向资深工程师，不啰嗦、不卖萌。

## 角色名（Agent Roles）

| 标识符 | 中文角色名 | 说明 |
|--------|-----------|------|
| explore | 探路者 | 代码库搜索、定位文件与模式 |
| analyst | 需求分析师 | 规划前的需求分析顾问 |
| planner | 规划师 | 通过访谈产出可执行工作计划 |
| architect | 架构师 | 架构与调试策略顾问（只读） |
| debugger | 调试专家 | 根因分析、回归定位、编译错误排查 |
| executor | 执行者 | 精确落地代码改动 |
| verifier | 验收员 | 验证策略、基于证据的完成度检查 |
| tracer | 溯因追踪者 | 证据驱动的因果追踪 |
| security-reviewer | 安全审查员 | 安全漏洞检测 |
| code-reviewer | 代码评审员 | 带严重级别的专业代码评审 |
| test-engineer | 测试工程师 | 测试策略、集成/e2e 覆盖、TDD |
| designer | 设计师 | UI/UX 界面设计与开发 |
| writer | 文档撰稿人 | README、API 文档、注释 |
| qa-tester | QA 测试员 | 基于 tmux 的交互式 CLI 测试 |
| scientist | 数据科学家 | 数据分析与研究执行 |
| document-specialist | 文档专家 | 外部文档与参考资料检索 |
| git-master | Git 大师 | 原子提交、变基、历史管理 |
| code-simplifier | 代码简化师 | 在不改变功能前提下提升可读性 |
| critic | 评审专家 | 工作计划与代码的多视角批判性评审 |

## 关键"黑话"概念（重点）

| 原词 | 中文定名 | 解释 |
|------|---------|------|
| Ralph loop | 永动循环（Ralph） | 自主持续循环：反复推进任务直到目标达成，中途不停下等待。名字源自"推石头"的隐喻。 |
| Sisyphus / boulder | 西西弗斯 / 巨石 | 同上循环的比喻。`The boulder never stops`（巨石永不停歇）= 循环仍在运行的信号，**此字符串保留原文**，可在旁边补注中文。 |
| autopilot | 自动驾驶 | 端到端自动完成任务的执行模式 |
| ultrawork | 超级工作模式 | 高强度持续工作模式 |
| ultrathink | 深度思考 | 触发更深推理 |
| team | 团队协作 | 多 agent / 外部 CLI worker 协同 |
| orchestrator | 编排者 | 调度各 agent 的主控角色 |
| worker preamble | worker 前置协议 | 确保 worker 直接执行、不再派生子 agent 的约定 |
| escalate | 上报 / 升级 | 卡住后交给更高级别 agent |
| deslop / anti-slop | 去 AI 味清理 | 清理 AI 生成的冗余/套话代码 |
| kill switch | 一键关闭开关 | 停用某功能的环境变量 |
| handoff | 工作交接 | 上下文过长时移交给下一个 session |

## 术语一致性

- diff → 差异改动 / diff（保留）
- scope creep → 范围蔓延
- root cause → 根因
- acceptance criteria → 验收标准
- guardrails → 护栏（约束）
- evidence → 证据
- verification → 验证
- consensus mode → 共识模式
- pre-mortem → 事前验尸（预演失败）
</content>
</invoke>
