---
name: setup
description: 安装/更新的首选路由 — 把 setup、doctor 或 MCP 请求分发到正确的 OMC 安装流程
level: 2
---

# Setup

Use `/omc-han:setup` as the unified setup/configuration entrypoint.

## Usage

```bash
/omc-han:setup                # full setup wizard
/omc-han:setup doctor         # installation diagnostics
/omc-han:setup mcp            # MCP server configuration
/omc-han:setup wizard --local # explicit wizard path
```

## Routing

Process the request by the **first argument only** so install/setup questions land on the right flow immediately:

- No argument, `wizard`, `local`, `global`, or `--force` -> route to `/omc-han:omc-setup` with the same remaining args
- `doctor` -> route to `/omc-han:omc-doctor` with everything after the `doctor` token
- `mcp` -> route to `/omc-han:mcp-setup` with everything after the `mcp` token

Examples:

```bash
/omc-han:setup --local          # => /omc-han:omc-setup --local
/omc-han:setup doctor --json    # => /omc-han:omc-doctor --json
/omc-han:setup mcp github       # => /omc-han:mcp-setup github
```

## Notes

- `/omc-han:omc-setup`, `/omc-han:omc-doctor`, and `/omc-han:mcp-setup` remain valid compatibility entrypoints.
- Prefer `/omc-han:setup` in new documentation and user guidance.

Task: {{ARGUMENTS}}
