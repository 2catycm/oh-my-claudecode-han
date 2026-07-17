---
name: omc-setup
description: 按标准安装流程为插件、npm 和本地开发环境安装或刷新 oh-my-claudecode
level: 2
---

# OMC Setup

This is the **only command you need to learn**. After running this, everything else is automatic.

**When this skill is invoked, immediately execute the workflow below. Do not only restate or summarize these instructions back to the user.**

Note: All `~/.claude/...` paths in this guide respect `CLAUDE_CONFIG_DIR` when that environment variable is set.

## Best-Fit Use

Choose this setup flow when the user wants to **install, refresh, or repair OMC itself**.

- Marketplace/plugin install users should land here after `/plugin install oh-my-claudecode`
- npm users should land here after `npm i -g oh-my-claude-sisyphus@latest`
- local-dev and worktree users should land here after updating the checked-out repo and rerunning setup

## Flag Parsing

Check for flags in the user's invocation:
- `--help` → Show Help Text (below) and stop
- `--local` → Phase 1 only (target=local), then stop
- `--global` → Phase 1 only (target=global), then stop
- `--force` → Skip Pre-Setup Check, run full setup (Phase 1 → 2 → 3 → 4)
- No flags → Run Pre-Setup Check, then full setup if needed

## Help Text

When user runs with `--help`, display this and stop:

```
OMC Setup - Configure oh-my-claudecode

USAGE:
  /omc-han:omc-setup           Run initial setup wizard (or update if already configured)
  /omc-han:omc-setup --local   Configure local project (.claude/CLAUDE.md)
  /omc-han:omc-setup --global  Configure global settings (~/.claude/CLAUDE.md)
  /omc-han:omc-setup --force   Force full setup wizard even if already configured
  /omc-han:omc-setup --help    Show this help

MODES:
  Initial Setup (no flags)
    - Interactive wizard for first-time setup
    - Configures CLAUDE.md (local or global)
    - Sets up HUD statusline
    - Checks for updates
    - Offers MCP server configuration
    - Configures team mode defaults (agent count, type, model)
    - If already configured, offers quick update option

  Local Configuration (--local)
    - 通过 `scripts/setup-claude-md.sh` 调用插件本地协调器；shell 在执行任何安装后续工作之前会验证协调器响应及其退出状态
    - 仅对需要变更的文件报告协调器创建的逐字节一致备份
    - 项目级配置
    - 在 OMC 升级后使用此选项更新项目配置

  Global Configuration (--global)
    - 通过 `scripts/setup-claude-md.sh` 调用插件本地协调器；shell 在执行任何安装后续工作之前会验证协调器响应及其退出状态
    - 仅对已变更的全局文件报告协调器创建的逐字节一致备份
    - 默认：显式覆盖 ~/.claude/CLAUDE.md，使普通 `claude` 命令也使用 OMC
    - 可选保留模式：保留用户原有的 `CLAUDE.md`，将 OMC 安装到 `CLAUDE-omc.md` 供 `omc` 启动时使用
    - 应用于所有 Claude Code 会话
    - 保留同名旧版钩子文件，除非其精确的历史内容已被独立验证
    - 在 OMC 升级后使用此选项更新全局配置

  Force Full Setup (--force)
    - Bypasses the "already configured" check
    - Runs the complete setup wizard from scratch
    - Use when you want to reconfigure preferences

EXAMPLES:
  /omc-han:omc-setup           # First time setup (or update CLAUDE.md if configured)
  /omc-han:omc-setup --local   # Update this project
  /omc-han:omc-setup --global  # Update all projects
  /omc-han:omc-setup --force   # Re-run full setup wizard

For more info: https://github.com/Yeachan-Heo/oh-my-claudecode
```


## Setup Invocation

不要在本 skill 中独立扫描插件缓存目录或选择插件根目录。通过运行中的插件环境提供的插件根目录调用设置脚本：

```bash
bash "${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-claude-md.sh" <local|global> [overwrite|preserve]
```

该脚本是唯一的缓存解析器。它仅接受完整的插件根目录（包含规范的 `docs/CLAUDE.md`、协调器制品和 `omc-reference` skill），选择严格的完整 SemVer 缓存版本，验证编译源握手，并在协调器协议或状态不一致时安全失败。不要在该协调器之外下载配置或变更 `CLAUDE.md`。

## Pre-Setup Check: Already Configured?

**CRITICAL**: Before doing anything else, check if setup has already been completed. This prevents users from having to re-run the full setup wizard after every update.

```bash
# Check if setup was already completed
CONFIG_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.omc-config.json"

if [ -f "$CONFIG_FILE" ]; then
  SETUP_COMPLETED=$(jq -r '.setupCompleted // empty' "$CONFIG_FILE" 2>/dev/null)
  SETUP_VERSION=$(jq -r '.setupVersion // empty' "$CONFIG_FILE" 2>/dev/null)

  if [ -n "$SETUP_COMPLETED" ] && [ "$SETUP_COMPLETED" != "null" ]; then
    echo "OMC setup was already completed on: $SETUP_COMPLETED"
    [ -n "$SETUP_VERSION" ] && echo "Setup version: $SETUP_VERSION"
    ALREADY_CONFIGURED="true"
  fi
fi
```

### If Already Configured (and no --force flag)

If `ALREADY_CONFIGURED` is true AND the user did NOT pass `--force`, `--local`, or `--global` flags:

Use AskUserQuestion to prompt:

**Question:** "OMC is already configured. What would you like to do?"

**Options:**
1. **Update CLAUDE.md only** - 安装当前活跃插件的规范 CLAUDE.md，无需重新运行完整设置
2. **Run full setup again** - Go through the complete setup wizard
3. **Cancel** - Exit without changes

**If user chooses "Update CLAUDE.md only":**
- Detect if local (.claude/CLAUDE.md) or global (~/.claude/CLAUDE.md) config exists
- If local exists, run: `bash "${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-claude-md.sh" local`
- If only global exists, run: `bash "${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-claude-md.sh" global`
- Skip all other steps
- Report success and exit

**If user chooses "Run full setup again":**
- Continue with Resume Detection below

**If user chooses "Cancel":**
- Exit without any changes

### Force Flag Override

If user passes `--force` flag, skip this check and proceed directly to setup.

## Resume Detection

Before starting any phase, check for existing state:

```bash
bash "${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-progress.sh" resume
```

If state exists (output is not "fresh"), use AskUserQuestion to prompt:

**Question:** "Found a previous setup session. Would you like to resume or start fresh?"

**Options:**
1. **Resume from step $LAST_STEP** - Continue where you left off
2. **Start fresh** - Begin from the beginning (clears saved state)

If user chooses "Start fresh":
```bash
bash "${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-progress.sh" clear
```

## Phase Execution

### For `--local` or `--global` flags:
Read the file at `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/omc-setup/phases/01-install-claude-md.md` and follow its instructions.
(The phase file handles early exit for flag mode.)

### For full setup (default or --force):
Execute phases sequentially. For each phase, read the corresponding file and follow its instructions:

1. **Phase 1 - Install CLAUDE.md**: Read `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/omc-setup/phases/01-install-claude-md.md` and follow its instructions.

2. **Phase 2 - Environment Configuration**: Read `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/omc-setup/phases/02-configure.md` and follow its instructions. Phase 2 must delegate HUD/statusLine setup to the `hud` skill; do not generate or patch `statusLine` paths inline here.

3. **Phase 3 - Integration Setup**: Read `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/omc-setup/phases/03-integrations.md` and follow its instructions.

4. **Phase 4 - Completion**: Read `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/omc-setup/phases/04-welcome.md` and follow its instructions.

## Graceful Interrupt Handling

**IMPORTANT**: This setup process saves progress after each phase via `${OMC_SETUP_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/scripts/setup-progress.sh`. If interrupted (Ctrl+C or connection loss), the setup can resume from where it left off.

## Keeping Up to Date

After installing oh-my-claudecode updates (via npm or plugin update):

**Automatic**: Just run `/omc-han:omc-setup` - it will detect you've already configured and offer a quick "Update CLAUDE.md only" option that skips the full wizard.

**Manual options**:
- `/omc-han:omc-setup --local` to update project config only
- `/omc-han:omc-setup --global` to update global config only
- `/omc-han:omc-setup --force` to re-run the full wizard (reconfigure preferences)

This ensures you have the newest features and agent configurations without the token cost of repeating the full setup.
