#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CHANGED_FILES = process.env.CHANGED_FILES || '';
const LAST_MERGE_SHA = process.env.LAST_MERGE_SHA || '';
const HAS_CONFLICTS = process.env.HAS_CONFLICTS === 'true';
const DRY_RUN = process.argv.includes('--dry-run');
const MODEL = process.env.TRANSLATION_MODEL || 'claude-sonnet-4-20250514';

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

// --- Glossary Parsing ---

function loadGlossary() {
  const glossaryPath = resolve(ROOT, 'docs/L10N-GLOSSARY.zh.md');
  if (!existsSync(glossaryPath)) {
    console.warn('Warning: Glossary not found at docs/L10N-GLOSSARY.zh.md, using defaults');
    return { rules: '', roleTable: '', termTable: '' };
  }
  const content = readFileSync(glossaryPath, 'utf-8');
  return { raw: content };
}

// --- Diff Parsing ---

function getChangedLineRanges(filePath, baseSha) {
  try {
    const diff = execSync(
      `git diff --unified=0 ${baseSha}..HEAD -- "${filePath}"`,
      { cwd: ROOT, encoding: 'utf-8' }
    );
    const ranges = [];
    for (const line of diff.split('\n')) {
      const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (match) {
        const start = parseInt(match[1], 10);
        const count = match[2] ? parseInt(match[2], 10) : 1;
        if (count > 0) {
          ranges.push({ start, end: start + count - 1 });
        }
      }
    }
    return ranges;
  } catch {
    return null; // new file or diff error — translate entire file
  }
}

function hasConflictMarkers(content) {
  return /^<{7}\s/m.test(content);
}

// --- Anthropic API ---

async function callAnthropic(systemPrompt, userPrompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`  API error ${res.status}, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`API error ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from API');
      return text;
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`  Error: ${e.message}, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// --- Translation ---

function buildSystemPrompt(glossary) {
  return `You are a professional Chinese localizer for the oh-my-claudecode project.
Your job is to translate English user-facing text into Chinese following strict rules.

## CRITICAL RULES (violations cause build failures):
1. NEVER modify the \`name:\` field in YAML frontmatter
2. NEVER modify agent identifiers (e.g., oh-my-claudecode:executor)
3. NEVER modify tool names (lsp_diagnostics, ast_grep_search, AskUserQuestion, TodoWrite, etc.)
4. NEVER modify file paths, directory names, or code symbols
5. NEVER modify magic keywords ("The boulder never stops", "[MAGIC KEYWORD: ...]", "hook success", etc.)
6. NEVER modify code blocks (content inside \`\`\` fences) except for comments
7. Keep XML tag names in English (<Role>, <Constraints>, etc.) — only translate content inside tags

## WHAT TO TRANSLATE:
- The \`description:\` field in frontmatter
- Role/concept names in prose (first mention: 「中文名（English）」format)
- System prompts, instructions, and explanations in natural language
- Markdown headers and prose paragraphs

## TONE:
- Professional, concise, for senior engineers
- No cutesy language or excessive politeness

## GLOSSARY:
${glossary.raw}

## OUTPUT FORMAT:
Return ONLY the complete translated file content. No markdown fences, no explanations, no preamble.
The output must be directly writable as the file content.`;
}

function buildUserPrompt(filePath, content, lineRanges) {
  if (!lineRanges) {
    return `Translate this entire file to Chinese following the rules above.

File: ${filePath}

---
${content}
---`;
  }

  const rangeDesc = lineRanges
    .map(r => r.start === r.end ? `line ${r.start}` : `lines ${r.start}-${r.end}`)
    .join(', ');

  return `Translate ONLY the changed sections (${rangeDesc}) of this file.
Keep all other lines EXACTLY as they are — do not re-translate already-translated content.
Return the COMPLETE file with only the specified sections translated.

File: ${filePath}

---
${content}
---`;
}

// --- Validation ---

function extractFrontmatterName(content) {
  const match = content.match(/^---\s*\n[\s\S]*?^name:\s*(.+?)\s*$/m);
  return match?.[1] || null;
}

function validateTranslation(original, translated, filePath) {
  const errors = [];

  const origName = extractFrontmatterName(original);
  const transName = extractFrontmatterName(translated);
  if (origName && transName && origName !== transName) {
    errors.push(`name: field changed from "${origName}" to "${transName}"`);
  }

  const magicPatterns = [
    'The boulder never stops',
    '[MAGIC KEYWORD:',
    'hook success',
    'oh-my-claudecode:',
  ];
  for (const pattern of magicPatterns) {
    const origCount = (original.match(new RegExp(escapeRegex(pattern), 'g')) || []).length;
    const transCount = (translated.match(new RegExp(escapeRegex(pattern), 'g')) || []).length;
    if (origCount > 0 && transCount < origCount) {
      errors.push(`Magic pattern "${pattern}" lost (${origCount} → ${transCount})`);
    }
  }

  if (translated.trim().length < original.trim().length * 0.3) {
    errors.push('Translation is suspiciously short (< 30% of original length)');
  }

  return errors;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Main ---

async function translateFile(filePath, glossary, baseSha) {
  const fullPath = resolve(ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.log(`  Skipped (file not found): ${filePath}`);
    return { status: 'skipped', reason: 'not found' };
  }

  const content = readFileSync(fullPath, 'utf-8');

  if (hasConflictMarkers(content)) {
    console.log(`  Skipped (has conflicts): ${filePath}`);
    return { status: 'conflict', reason: 'merge conflicts present' };
  }

  const lineRanges = baseSha ? getChangedLineRanges(filePath, baseSha) : null;

  if (lineRanges && lineRanges.length === 0) {
    console.log(`  Skipped (no translatable changes): ${filePath}`);
    return { status: 'skipped', reason: 'no changes in this file' };
  }

  if (DRY_RUN) {
    const rangeStr = lineRanges
      ? lineRanges.map(r => `${r.start}-${r.end}`).join(', ')
      : 'entire file';
    console.log(`  Would translate: ${filePath} [${rangeStr}]`);
    return { status: 'dry-run' };
  }

  console.log(`  Translating: ${filePath}...`);

  const systemPrompt = buildSystemPrompt(glossary);
  const userPrompt = buildUserPrompt(filePath, content, lineRanges);

  let translated;
  try {
    translated = await callAnthropic(systemPrompt, userPrompt);
  } catch (e) {
    console.error(`  Error translating ${filePath}: ${e.message}`);
    return { status: 'error', reason: e.message };
  }

  // Strip markdown fences if the model wrapped output
  translated = translated.replace(/^```\w*\n/, '').replace(/\n```\s*$/, '');

  const errors = validateTranslation(content, translated, filePath);
  if (errors.length > 0) {
    console.warn(`  Validation warnings for ${filePath}:`);
    errors.forEach(e => console.warn(`    - ${e}`));

    // Retry once with stricter instructions
    console.log(`  Retrying with stricter prompt...`);
    const strictPrompt = userPrompt + '\n\nCRITICAL: Your previous output had errors: ' +
      errors.join('; ') + '. Fix these issues. DO NOT change the name: field or identifiers.';
    try {
      translated = await callAnthropic(systemPrompt, strictPrompt);
      translated = translated.replace(/^```\w*\n/, '').replace(/\n```\s*$/, '');
      const retryErrors = validateTranslation(content, translated, filePath);
      if (retryErrors.length > 0) {
        console.error(`  Validation still failing after retry, keeping original`);
        return { status: 'validation-failed', reason: retryErrors.join('; ') };
      }
    } catch (e) {
      console.error(`  Retry failed: ${e.message}, keeping original`);
      return { status: 'error', reason: e.message };
    }
  }

  writeFileSync(fullPath, translated, 'utf-8');
  console.log(`  Done: ${filePath}`);
  return { status: 'translated' };
}

async function main() {
  console.log('=== oh-my-claudecode-han: Upstream Translation ===');
  console.log(`Model: ${MODEL}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const files = CHANGED_FILES.split('\n').map(f => f.trim()).filter(Boolean);
  if (files.length === 0) {
    console.log('No files to translate.');
    process.exit(0);
  }

  console.log(`\nFiles to process: ${files.length}`);
  const glossary = loadGlossary();

  const results = { translated: [], skipped: [], conflict: [], error: [] };

  for (const file of files) {
    // Rate limiting: 1 request per second
    const result = await translateFile(file, glossary, LAST_MERGE_SHA);
    results[result.status]?.push({ file, ...result });
    if (!DRY_RUN && result.status === 'translated') {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Write summary for PR body generation
  console.log('\n=== Summary ===');
  console.log(`Translated: ${results.translated?.length || 0}`);
  console.log(`Skipped: ${results.skipped?.length || 0}`);
  console.log(`Conflicts: ${results.conflict?.length || 0}`);
  console.log(`Errors: ${results.error?.length || 0}`);

  if (!DRY_RUN) {
    const summary = {
      translated: results.translated?.map(r => r.file) || [],
      skipped: results.skipped?.map(r => `${r.file} (${r.reason})`) || [],
      conflicts: results.conflict?.map(r => r.file) || [],
      errors: results.error?.map(r => `${r.file}: ${r.reason}`) || [],
    };
    writeFileSync(
      resolve(ROOT, '.translation-summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
  }

  if ((results.error?.length || 0) > files.length / 2) {
    console.error('More than half the files failed. Exiting with error.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
