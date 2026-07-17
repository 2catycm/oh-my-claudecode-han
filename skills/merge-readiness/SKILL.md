---
name: merge-readiness
aliases: understanding-gate
description: "任务完成后的合并就绪检查关卡，基于状态驱动的可解释性报告与人类理解测验"
argument-hint: "[--quick|--standard|--deep] [--from-diff|--from-artifacts] <change summary or artifact path>"
---

<Purpose>
合并就绪检查是任务完成后的可解释性关卡。在实现、测试、QA 和评审证据齐备后，它会生成一份人类可读的变更说明，然后向人类提出针对性问题，验证其能否解释：变更存在的原因、具体改动内容、做出的取舍、考虑过的风险，以及团队应如何理解该变更。
</Purpose>

<Use_When>
- 任务、PR 或变更集在功能上已完成，需要在合并前进行最终的人类理解检查
- 测试、QA、代码评审、安全评审或其他验证已完成，或缺失的证据需要被明确记录
- 用户希望 AI 先解释变更，再通过测验验证人类能否复述要点
- 需要一份持久化的会话审计记录，证明团队在请求合并批准前已理解并信任该变更
</Use_When>

<Do_Not_Use_When>
- 需求在实现前仍不明确；请使用 `/deep-interview`（深度访谈）
- 实现尚未完成；请使用 `/ralph`（永动循环）、`/team`（团队协作）或 `/autopilot`（自动驾驶）
- 测试或 QA 尚未运行，且用户期望本命令替代它们
- 用户需要的是代码评审意见；请使用 `/review` 或相应的评审工作流
</Do_Not_Use_When>

<Why_This_Exists>
真正的交付不仅仅是能运行的代码。团队需要理解变更存在的原因、具体改动了什么、有意不做的事情、考虑过哪些风险，以及未来维护者对该变更应持有的认知。本工作流在请求合并批准前，将这种理解显式化。通过此关卡并不意味着变更已获批或已合并，它仅意味着人类能够解释该变更。
</Why_This_Exists>

<Depth_Profiles>
- **快速模式（`--quick`）**：小范围/局部变更；正确率阈值 `>= 0.70`；最多 3 道选择题（MCQ）；必须覆盖维度：why / change / risk
- **标准模式（`--standard`，默认）**：常规功能/缺陷修复；正确率阈值 `>= 0.80`；最多 5 道选择题（MCQ）；必须覆盖维度：why / change / tradeoff / risk / team
- **深度模式（`--deep`）**：高风险、架构级、安全相关或跨模块变更；正确率阈值 `>= 0.90`；最多 8 道选择题（MCQ），五个维度均设冗余题目

未指定标志时默认使用**标准模式**。阈值与轮次数量的权威定义在 `src/hooks/merge-readiness/mcq.ts`，须与本文件保持同步。
</Depth_Profiles>

<Execution_Policy>
- 本命令为任务后置命令。不要在此模式下编写实现代码。
- 在向人类索要可通过本地发现的信息之前，先收集仓库和制品证据。
- 在一次 AI 步骤中生成说明文档 + 选择题（MCQ），随后逐题呈现。
- 运行时（TS hook 代码）是骨干：它负责校验、权威会话状态、客观 MCQ 评分和报告渲染。AI 负责内容生成 + 通过 AskUserQuestion 呈现选择题（MCQ）。
- 通过 AskUserQuestion 逐轮呈现每道选择题（MCQ）（深度访谈风格）。通过运行时记录每个选项，确保客观评分。
- 提问应聚焦于可解释性，而非实现细节。
- 绝不要求人类记忆行号、变量名、私有辅助函数名或无关紧要的实现细节。
- 得分为客观正确率（正确回答数 / 已回答数），而非关键词启发式匹配。
- 如果在所有必答选择题（MCQ）完成后正确率低于阈值，标记结果为 `paused`，不宣称合并就绪。
- 如果关键证据缺失（无 diff/变更信号），标记结果为 `blocked`。
- 通过此关卡不等于批准合并、不替代测试、不替代评审、不替代安全评审、不接受风险、不绕过维护者审批。
- 状态持久化于 `.omc/state/merge-readiness-state.json`（会话作用域位于 `.omc/state/sessions/<sessionId>/`）。不要直接写入此文件。
- v1 为建议性质：关卡逻辑（`checkMergeReadiness`）未接入 Stop hook，因此活跃关卡不会阻断会话。它不执行也不批准 Git 合并。
</Execution_Policy>

<Steps>

## 阶段 0：证据收集

1. 解析 `{{ARGUMENTS}}`、深度档案、来源模式（`--from-diff|--from-artifacts`），并派生任务标识。`--from-pr` 不受支持；本工作流仅使用本地证据。
2. 收集可用证据（运行时通过文件名启发式检测制品；不解析文件内容）：
   - 本地 Git diff 和提交范围
   - 变更文件
   - 测试/QA/验证制品（文件名匹配 `test|spec|qa|verify|validation`）
   - 评审/风险/安全/就绪/结论制品（文件名匹配 `review|risk|security|readiness|verdict`）
   - `.omc/plans/`、`.omc/specs/`、`.omc/interviews/`、`.omc/artifacts/`、`.omc/logs/`，以及相关模式状态制品（`.omc/state/` 下记录真实运行的规范 `{mode}-state.json` 文件）
3. 明确记录缺失证据。缺失的证据不会被良好的说明所掩盖。

## 阶段 1：初始化

调用 `merge_readiness_start` 工具并传入变更摘要以初始化状态（运行时解析 `--quick`/`--deep` 档案；未指定任一标志时默认为 `--standard`，它不是需要解析的令牌）。状态结构：

```json
{
  "active": true,
  "current_phase": "merge-readiness",
  "phase": "content",
  "profile": "standard",
  "threshold": 0.80,
  "max_rounds": 5,
  "required_dimensions": ["why", "change", "tradeoff", "risk", "team"],
  "questions": [],
  "answers": [],
  "awaiting_content": true,
  "readiness_score": 0,
  "result": "pending"
}
```

`awaiting_content` 为 true，直到 AI 通过 `merge_readiness_set_content` 提交生成的文档 + 选择题（MCQ）。

## 阶段 2：生成说明文档 + 选择题（MCQ）（AI 内容步骤）

基于实际 diff + 证据（非模板）生成：

1. 五段叙述：**Why（原因）**、**What Changed（变更内容）**、**Tradeoffs（取舍）**、**Risks Considered（已考虑的风险）**、**Team Understanding（团队理解）**。
2. 一组选择题（MCQ）（每题一个正确选项，含 `correctOptionId` + 可选 `rationale`）：
   - 数量不超过档案上限（快速 3 / 标准 5 / 深度 8）
   - 分布于所有必须覆盖的维度
   - 测试对本次变更的理解，而非实现细节

通过 `merge_readiness_set_content` 提交（需要先通过 `merge_readiness_start` 激活关卡；若无活跃关卡则报错）。不要直接写入状态 JSON 或调用内部运行时函数。无效内容会被拒绝并返回可恢复的验证错误。验证通过的内容将持久化到权威会话状态中。

使用 `merge_readiness_report` 直接从状态渲染五个章节、证据、测验进度、就绪状态和合并边界。该操作为只读，不创建文件。在测验完成前，正确答案和解析保持隐藏；取消或覆盖时仅显示已回答的问题。

合并边界必须声明："通过意味着人类能够解释该变更。它不等于批准合并、不替代测试、不替代评审、不接受风险。"

### 维护者覆盖权限

`/merge-readiness --override <reason>` 仅在以下条件满足时被接受：MCP 服务器启动器在 `OMC_MERGE_READINESS_AUTHENTICATED_PRINCIPAL` 中注入已认证主体，且该主体出现在逗号分隔的 `OMC_MERGE_READINESS_MAINTAINERS` 白名单中。调用方提供的 `session_id` 仅用于选择状态记录，不具备覆盖权限，也不会被记录为 `override_owner`。

## 阶段 3：人类测验循环（选择题 MCQ，逐轮呈现，深度访谈风格）

通过 AskUserQuestion 逐轮呈现每道选择题（MCQ），将选项 id/文本作为选择项，然后使用 `merge_readiness_record_answer` 工具记录人类的选择（questionId + optionId）。运行时客观评分，随后推进到下一题或终结关卡（pass / paused / blocked）。

通过前须覆盖以下维度（快速模式仅需 why/change/risk）：

1. **why** - 为什么值得做这个变更
2. **change** - 行为、工作流、接口或维护模型发生了什么改变
3. **tradeoff** - 选择了什么、推迟了什么、拒绝了什么，以及原因
4. **risk** - 考虑了哪些风险，哪些仍存在风险
5. **team** - 团队应如何理解和维护这个变更

禁止的题目类型：

- 函数名细节
- 行号细节
- 变量名回忆
- 私有辅助函数记忆
- 任何答案无助于评审者解释变更的题目

## 阶段 4：评分就绪状态（运行时拥有，客观评分）

运行时计算：

- `readiness_score` = 正确率 = 正确回答数 / 已回答数，取值 [0, 1]
- 维度覆盖率 = 每个必须维度是否至少有一道已回答的选择题（MCQ）

关卡结果：

- `pass`：所有必答选择题（MCQ）已回答 且 正确率 >= 阈值 且 必须维度已覆盖
- `paused`：所有必答选择题（MCQ）已回答，但正确率低于阈值（或必须维度未覆盖）
- `blocked`：缺少最低限度证据（无 diff/变更信号）

阈值：快速 `0.70` / 标准 `0.80` / 深度 `0.90`。

## 阶段 5：固化结果

在终端会话状态中持久化以下字段，并通过 `merge_readiness_report` 查看：

- 最终就绪分数
- 维度分解
- 人类回答
- AI 评估
- 结果
- 阻塞或暂停原因
- 下一步操作

## 阶段 6：交接

若为 `pass`：
- 声明变更可进入人工合并审批流程。
- 不执行合并。

若为 `paused`：
- 说明哪个可解释性维度存在缺口。
- 建议重新阅读或修订报告，然后重新运行 `/merge-readiness`。

若为 `blocked`：
- 说明在重新运行前需要产出哪些证据。

</Steps>

<Tool_Usage>
- 在向人类索要上下文之前，先使用仓库搜索和本地制品进行证据收集。
- 可用时使用结构化用户提问。
- 使用 `merge_readiness_start` 初始化关卡，`merge_readiness_set_content` 提交报告 + 选择题（MCQ），`merge_readiness_record_answer` 记录每个选择，`merge_readiness_report` 渲染当前审计记录。仅对 `.omc/state/merge-readiness-state.json` 使用 state read/status/clear；绝不使用通用 state write 提交测验内容。`state_clear` 通过取消路径路由合并就绪检查并保留终态；传入当前 session_id 以避免取消并发测验。
</Tool_Usage>

<Escalation_And_Stop_Conditions>
- 用户说 stop/cancel/abort -> 持久化终态 `cancelled` 并停止。
- 缺少 diff 或变更证据 -> `blocked`。
- 人类无法解释某个必须维度 -> `paused`。
- 就绪阈值达标且所有强制关卡满足 -> `pass`。
</Escalation_And_Stop_Conditions>

<Final_Checklist>
- [ ] 证据收集已完成
- [ ] 缺失证据已记录
- [ ] 说明文档（5 个章节）+ 选择题（MCQ）已通过 merge_readiness_set_content 提交
- [ ] 选择题（MCQ）通过 AskUserQuestion 逐轮呈现
- [ ] 每个回答已从标记的 AskUserQuestion 输出中关联（客观评分）
- [ ] 题目避免了实现细节
- [ ] 正确率由运行时计算
- [ ] 结果为 `pass`、`paused`、`blocked`、`overridden` 或 `cancelled`
- [ ] 合并边界已明确声明
- [ ] 未执行任何实现代码或合并操作
</Final_Checklist>

<Advanced>
## 推荐交付流水线

```text
/deep-interview
  -> /omc-plan or /ralplan
  -> /ralph, /team, or /autopilot
  -> /ultraqa and review
  -> /merge-readiness
  -> human merge approval
```

## 自动驾驶桥接

自动驾驶模式可在 QA/验证完成后调用本工作流（需配置）：

```jsonc
{
  "autopilot": {
    "mergeReadiness": true
  }
}
```

`autopilot.understandingGate` 是 `autopilot.mergeReadiness` 的已弃用兼容别名。
</Advanced>

Task: {{ARGUMENTS}}
