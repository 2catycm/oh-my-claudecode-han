---
name: auto-sync
description: 手动同步上游 — 拉取 upstream 最新代码，翻译变更文件并创建 PR（Manual upstream sync + translate + PR）
argument-hint: "[--dry-run] [--force] [--file <path>]"
level: 3
---

# Auto Sync Skill

从上游 oh-my-claudecode 仓库拉取最新代码，自动识别需要翻译的文件，调用 AI 翻译后创建 PR。

## Usage

```
/omc-han:auto-sync [options]
```

- 无参数：完整执行（fetch → detect → merge → translate → push → PR）
- `--dry-run`：只展示变更摘要，不实际翻译或创建 PR
- `--force`：重新翻译所有可翻译文件（忽略是否有上游变更）
- `--file <path>`：只翻译指定文件

## Execution Flow

### Step 1 — Check Prerequisites

1. Verify `upstream` remote exists: `git remote -v | grep upstream`
2. If not: `git remote add upstream https://github.com/nicobailey-omc/oh-my-claudecode.git`
3. Verify current branch is `main` or create a working branch

### Step 2 — Fetch Upstream

```bash
git fetch upstream main
```

### Step 3 — Detect Changes

1. Find last merge point:
   ```bash
   LAST_MERGE=$(git log --oneline --grep="chore(release): merge dev" -1 --format="%H")
   ```
   Fallback: `git merge-base HEAD upstream/main`

2. Count new commits:
   ```bash
   git rev-list --count ${LAST_MERGE}..upstream/main
   ```

3. If zero commits and not `--force`: report "No new upstream changes" and exit

### Step 4 — Show Summary

List the new upstream commits and changed translatable files:
```bash
git log --oneline ${LAST_MERGE}..upstream/main
git diff --name-only ${LAST_MERGE}..upstream/main -- 'agents/*.md' 'skills/*/SKILL.md' 'CLAUDE.md'
```

Report to user. If `--dry-run`, stop here.

### Step 5 — Create Branch & Merge

```bash
git checkout -b auto-sync/upstream-$(date +%Y%m%d)
git merge upstream/main --no-edit
```

If conflicts occur:
- List conflicted files
- Commit the conflict state
- Mark these files as "skip translation, needs manual resolution"
- Continue with non-conflicted files

### Step 6 — Translate

For each changed translatable file (that doesn't have conflicts):

1. Read the file content
2. Determine changed line ranges via `git diff --unified=0`
3. Compose a translation prompt following `docs/L10N-GLOSSARY.zh.md` rules
4. Call Anthropic API (or use the installed `translate-upstream-changes.mjs` script)
5. Validate output:
   - `name:` field unchanged
   - Known identifiers preserved
   - Output not suspiciously short
6. Write translated content back

If `--file <path>` is specified, only translate that file (full translation, ignoring diff ranges).

### Step 7 — Commit & Push & PR

```bash
git add -A
git commit -m "docs(l10n): auto-translate upstream changes $(date +%Y-%m-%d)"
git push -u origin auto-sync/upstream-$(date +%Y%m%d)
gh pr create --base main --title "chore(l10n): sync upstream $(date +%Y-%m-%d)" --body "..."
```

## Environment

- Requires `ANTHROPIC_API_KEY` for API translation (or can use the agent's own capability for in-session translation)
- Uses `docs/L10N-GLOSSARY.zh.md` as the authoritative translation ruleset
- The script `scripts/translate-upstream-changes.mjs` handles the mechanical work; this skill orchestrates the full flow

## Error Handling

| Scenario | Action |
|----------|--------|
| Upstream unreachable | Report error, abort |
| Merge conflicts | Skip conflicted files, note in PR |
| Translation API failure | Keep untranslated version, note in PR |
| Validation failure | Retry once, then keep original |
| PR already exists | Update existing branch |
