---
description: "为手动的 Claude Code /compact 交接准备 OMC 上下文。"
argument-hint: "[optional compaction note]"
---

# OMC 手动上下文压缩助手

本命令刻意使用插件作用域的名字 `/omc-han:compact`，而非裸的 `/compact`。裸 `/compact` 保留给 Claude Code 的原生压缩命令，OMC 不得遮蔽它。

OMC 无法从插件命令中调用 Claude Code 内置的 `/compact`：`/compact` 是原生斜杠命令，而非提示型 skill，对 `compact` 的提示型 skill 调用不是受支持的交接方式。本助手仅提供指引，且不得声称 OMC 自己触发了压缩。

## 分发

1. 把这当作"为手动的 Claude Code 对话压缩做准备"的请求。不要另建一个 OMC 摘要器，也不要替换已有的自动压缩行为。
2. 保留用户为压缩请求提供的任何备注：

```text
$ARGUMENTS
```

3. 告诉用户直接运行 Claude Code 内置的裸 `/compact` 命令。若上面的备注非空，告诉他们把它随 `/compact` 一起带上。
4. 交接前，提醒用户：原生压缩发生时，Claude Code 正常的 `PreCompact` 生命周期应会运行 OMC 已有的预压缩钩子（`pre-compact`、项目记忆和 wiki 保全）。
5. 不要调用 `compact` skill，不要替用户调用 `/compact`，也不要手动总结会话。

## 面向用户的交接话术

使用以下措辞，仅调整备注文本：

```text
OMC 已准备好压缩上下文，但插件命令无法直接触发 Claude Code 的原生 /compact。现在请把它作为裸的 Claude Code 命令运行：

/compact $ARGUMENTS

裸 /compact 仍是 Claude Code 的原生命令；OMC 不会遮蔽或调用它。
```
