// `re-shell ui generate`: prompt -> a packages/ui-convention component (TSX + story + test).
//
// Two sources, one gate:
//   model   - the configured AI provider (createProvider / resolveAiConfig from src/ai) writes
//             the three files; its output is UNTRUSTED text that must pass an import/API
//             allow-list, a structure check and a real `tsc` typecheck before anything is written
//   offline - no provider configured (or it failed): a deterministic, template-based generator
//             driven by the parsed intent (component kind + fields). The result says so.
//
// Nothing is written unless the generated sources typecheck against the real UI package.

import {
  AI_PROVIDER_NAMES,
  AiProviderError,
  createProvider,
  readPersistedAiConfig,
  resolveAiConfig,
  type AiProvider,
  type PersistedAiConfig,
} from '../ai';
import {
  COMPONENT_GROUPS,
  defaultFields,
  renderComponent,
  type ComponentGroup,
  type ComponentKind,
  type FieldSpec,
  type FieldType,
  type GeneratedFiles,
} from './ui-component-templates';
import { isValidComponentName, RESERVED_WORDS, splitWords, toCamel, toKebab, toLabel, toPascal } from './ui-names';
import {
  assertNoCollision,
  findUiPackage,
  writeComponent,
  UiScaffoldError,
  type UiPackage,
  type WriteResult,
} from './ui-package';
import { typecheckComponent, type TypecheckResult } from './ui-typecheck';

/** Longest accepted prompt. */
export const MAX_GENERATE_PROMPT_LENGTH = 2000;

/** What the prompt asked for, as understood by the offline parser. */
export interface ParsedIntent {
  readonly kind: ComponentKind;
  readonly name: string;
  readonly fields: FieldSpec[];
  /** Human-readable notes about guesses the parser made. */
  readonly notes: string[];
}

// ---------------------------------------------------------------------------
// intent parsing (offline)
// ---------------------------------------------------------------------------

const KIND_WORDS: ReadonlyArray<readonly [Exclude<ComponentKind, 'basic'>, RegExp]> = [
  ['table', /\b(table|grid|spreadsheet|datagrid|rows|columns)\b/i],
  ['form', /\b(form|login|signup|sign-up|register|checkout|survey|input fields?)\b/i],
  ['list', /\b(list|feed|timeline|queue|menu|items)\b/i],
  ['badge', /\b(badge|chip|pill|tag|label|status indicator|indicator)\b/i],
  ['card', /\b(card|tile|panel|summary|widget|overview)\b/i],
];

const FIELD_LEAD = /\b(?:with|showing|shows|show|displaying|displays|display|containing|contains|including|includes|has|have|fields?|columns?|attributes?|properties|for each|per row)\b[:\s]*/i;
const STOP_WORDS = new Set(['a', 'an', 'the', 'its', 'their', 'each', 'every', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'with', 'that', 'which', 'component', 'ui', 'new', 'simple', 'small', 'basic']);

function classify(key: string, label: string): FieldType {
  const words = splitWords(label);
  const last = words[words.length - 1] ?? '';
  const any = (re: RegExp): boolean => words.some((w) => re.test(w));
  if (any(/^e-?mail$/)) return 'email';
  if (any(/^(password|passcode|secret|token)$/)) return 'password';
  if (/^(is|has|can|should|enabled|disabled|active|visible|checked|remember|subscribed|newsletter|required)/.test(words[0] ?? '') || /^(enabled|disabled|active|visible|checked|required)$/.test(last)) {
    return 'boolean';
  }
  if (any(/^(status|state|health|level|severity|phase|result|outcome)$/)) return 'status';
  if (any(/^(date|time|timestamp|created|updated|modified|deployed|started|finished|expires|at)$/) && !any(/^(status|state)$/)) return 'date';
  if (any(/^(count|port|total|number|size|age|duration|latency|score|version|index|rank|price|amount|quantity|percent|percentage|rate|cpu|memory|ms|bytes|retries)$/)) return 'number';
  void key;
  return 'string';
}

/** Parse "name, port and status" style field lists. */
export function parseFields(text: string): FieldSpec[] {
  const seen = new Set<string>();
  const fields: FieldSpec[] = [];
  for (const raw of text.split(/,|;|\band\b|&|\/|\bplus\b/i)) {
    const words = raw
      .replace(/\([^)]*\)/g, ' ')
      .split(/[^A-Za-z0-9]+/)
      .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
    if (words.length === 0 || words.length > 4) continue;
    let key = toCamel(words.join(' '));
    if (RESERVED_WORDS.has(key)) key = `${key}Value`;
    if (!/^[a-z][A-Za-z0-9]*$/.test(key) || seen.has(key)) continue;
    seen.add(key);
    const label = toLabel(key);
    fields.push({ key, label, type: classify(key, label) });
    if (fields.length >= 12) break;
  }
  return fields;
}

/** Derive a PascalCase name from the words around the kind keyword. */
function deriveName(prompt: string, kind: ComponentKind, fields: readonly FieldSpec[]): string {
  const kindWordRe = KIND_WORDS.find(([k]) => k === kind)?.[1];
  const head = prompt.split(FIELD_LEAD)[0] ?? prompt;
  const words = head.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let subject: string[] = [];
  if (kindWordRe) {
    // Prefer the literal kind noun ("login FORM") over a synonym ("LOGIN form").
    const exact = words.findIndex((w) => w.toLowerCase() === kind);
    const index = exact >= 0 ? exact : words.findIndex((w) => kindWordRe.test(w));
    if (index > 0) {
      subject = words
        .slice(Math.max(0, index - 3), index)
        .filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    }
    if (subject.length === 0) {
      // "table of services" / "list for jobs": the noun after of/for names it.
      const match = /\b(?:of|for)\s+([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)/i.exec(head);
      if (match) subject = match[1].split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    }
  }
  if (subject.length === 0 && kind === 'badge') subject = ['status'];
  if (subject.length === 0 && fields.length > 0 && kind !== 'form') subject = [fields[0].key];
  const kindSuffix = kind === 'basic' ? '' : toPascal(kind);
  let base = toPascal(subject.join(' '));
  if (kindSuffix && base.endsWith(kindSuffix)) base = base.slice(0, -kindSuffix.length);
  const name = `${base}${kindSuffix}` || `Generated${kindSuffix || 'Component'}`;
  return /^[A-Z]/.test(name) ? name : `Generated${name}`;
}

/**
 * Understand a free-text description: the component kind, its fields and a name.
 *
 * Deterministic: the same prompt always yields the same intent.
 */
export function parseIntent(prompt: string, nameOverride?: string): ParsedIntent {
  const notes: string[] = [];
  const found = KIND_WORDS.find(([, re]) => re.test(prompt));
  let kind: ComponentKind;
  if (found) {
    kind = found[0];
  } else {
    kind = 'card';
    notes.push('no component kind recognised in the prompt (card, table, form, list, badge); defaulted to card');
  }

  const lead = FIELD_LEAD.exec(prompt);
  let fields = lead ? parseFields(prompt.slice(lead.index + lead[0].length)) : [];
  if (fields.length === 0) {
    fields = defaultFields(kind);
    notes.push(`no fields named in the prompt; used the default ${kind} fields (${fields.map((f) => f.key).join(', ')})`);
  }
  if (kind === 'badge') {
    // A badge's "fields" are the states it can show.
    fields = fields.map((f) => ({ ...f, type: 'status' as const }));
  }

  const name = nameOverride ?? deriveName(prompt, kind, fields);
  return { kind, name, fields, notes };
}

// ---------------------------------------------------------------------------
// model path
// ---------------------------------------------------------------------------

/** Imports generated code may use (everything the UI package already depends on). */
const ALLOWED_IMPORTS: ReadonlyArray<RegExp> = [
  /^\.\/[a-z0-9-]+$/,
  /^@\/(components|lib|hooks|test)\//,
  /^react(\/jsx-runtime)?$/,
  /^class-variance-authority$/,
  /^clsx$/,
  /^tailwind-merge$/,
  /^lucide-react$/,
  /^@radix-ui\/react-[a-z-]+$/,
  /^@storybook\/react-vite$/,
  /^storybook\/test$/,
  /^vitest$/,
  /^@testing-library\/(react|user-event|jest-dom)$/,
  /^@re-shell\/contracts$/,
];

const FORBIDDEN_CODE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/\bdangerouslySetInnerHTML\b/, 'dangerouslySetInnerHTML'],
  [/\bchild_process\b/, 'child_process'],
  [/\bprocess\.env\b/, 'process.env'],
  [/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b\s*[(.]?/, 'network access'],
  [/\bdocument\.write\b/, 'document.write'],
  [/\brequire\s*\(/, 'require()'],
  [/\bimport\s*\(/, 'dynamic import()'],
];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

/** Check untrusted model output; returns human-readable problems (empty = acceptable). */
export function inspectGeneratedSource(files: GeneratedFiles, name: string): string[] {
  const problems: string[] = [];
  const kebab = toKebab(name);
  for (const [label, source] of Object.entries(files) as Array<[keyof GeneratedFiles, string]>) {
    if (source.length > 40_000) problems.push(`${label} file is larger than 40 KB`);
    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (!ALLOWED_IMPORTS.some((re) => re.test(specifier))) {
        problems.push(`${label} imports "${specifier}", which is not an allowed dependency of the UI package`);
      }
      if (specifier.startsWith('./') && specifier !== `./${kebab}`) {
        problems.push(`${label} imports "${specifier}"; only ./${kebab} (its own component) may be imported relatively`);
      }
    }
    for (const [re, what] of FORBIDDEN_CODE) {
      if (re.test(source)) problems.push(`${label} uses ${what}`);
    }
  }
  const exported = new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
  if (!exported.test(files.component)) problems.push(`component file must export a symbol named ${name}`);
  if (!/export\s+default\s+meta\b|export\s+default\s*\{/.test(files.story)) problems.push('story file must default-export its Storybook meta');
  if (!/\bplay\s*:/.test(files.story)) problems.push('story file must include at least one play() interaction test');
  if (!/\bdescribe\s*\(/.test(files.test) || !/\bit\s*\(/.test(files.test)) problems.push('test file must contain a describe()/it() suite');
  if (!/expectNoA11yViolations|toHaveNoViolations/.test(files.test)) problems.push('test file must include an axe accessibility check');
  return problems;
}

/** The system prompt: the UI package conventions the model must follow. */
export const GENERATE_SYSTEM_PROMPT = `You write React + TypeScript components for the @re-shell/ui package. Follow its conventions EXACTLY.

Return exactly three fenced code blocks and nothing else, each opened with an info string:
  \`\`\`tsx component   - the component file (<kebab-name>.tsx)
  \`\`\`tsx story       - the Storybook CSF3 story (<kebab-name>.stories.tsx)
  \`\`\`tsx test        - the vitest + testing-library + vitest-axe test (<kebab-name>.test.tsx)

Component rules:
- React.forwardRef, a typed Props interface extending the right React HTML attributes, displayName, data-slot="<kebab-name>".
- Compose shadcn primitives from '@/components/ui/*' (Card, Badge, Button, Input, Label, ScrollArea, Alert) and use cn() from '@/lib/utils'; variants via class-variance-authority.
- Style ONLY with the design tokens in Tailwind classes: bg-card, bg-bg-1, text-foreground, text-muted-foreground, border-border, text-healthy|warn|critical|info, label-eyebrow. NEVER raw colours, hex, or inline style colours.
- Numbers, ports, counts, durations and ids use "font-mono tabular-nums".
- Accessible by construction: real <label>s, aria-describedby/aria-invalid for errors, semantic elements (table with caption + th scope, ul/li), visible keyboard focus (focus-visible:shadow-focus-ring), never colour alone for meaning, aria-live for status changes.
- Icons only from 'lucide-react'. No network access, no process.env, no eval, no dangerouslySetInnerHTML.
Story rules: import { Meta, StoryObj } from '@storybook/react-vite' and { expect, within, userEvent, fn } from 'storybook/test'; "const meta = {...} satisfies Meta<typeof X>"; export default meta; at least one story with a play() function.
Test rules: import { render, screen } from '@testing-library/react'; { describe, expect, it, vi } from 'vitest'; { expectNoA11yViolations } from '@/test/axe'; include an axe check.
The story and test import the component as: import { <Name> } from './<kebab-name>';
Export the component by NAME (export const <Name> / export { <Name> }).`;

/** Build the user prompt, optionally including compiler feedback from a failed attempt. */
export function buildGeneratePrompt(prompt: string, name: string | undefined, feedback?: string): string {
  const lines = [`Component description: ${prompt.trim()}`];
  if (name) lines.push(`Component name (PascalCase, use exactly): ${name}`);
  else lines.push('Choose a concise PascalCase component name that fits the description.');
  if (feedback) {
    lines.push('', 'Your previous attempt did not pass validation. Fix every problem and return all three files again:', feedback);
  }
  return lines.join('\n');
}

const BLOCK_RE = /```(?:tsx|ts|typescript)?[ \t]+(?:file[=:])?(component|story|test)[^\n]*\n([\s\S]*?)```/g;

/** Extract the three files from the model's reply. @throws {UiScaffoldError} when any is missing. */
export function parseModelFiles(text: string): GeneratedFiles {
  const found: Partial<Record<keyof GeneratedFiles, string>> = {};
  for (const match of text.matchAll(BLOCK_RE)) {
    const label = match[1] as keyof GeneratedFiles;
    if (found[label] === undefined) found[label] = `${match[2].trimEnd()}\n`;
  }
  const missing = (['component', 'story', 'test'] as const).filter((label) => found[label] === undefined);
  if (missing.length > 0) {
    throw new UiScaffoldError(`the model reply is missing the ${missing.join(', ')} code block(s)`, { missing });
  }
  return found as GeneratedFiles;
}

/** Find the component name a model-written component file exports. */
export function exportedComponentName(componentSource: string): string | null {
  const direct = /export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9]*)\b/.exec(componentSource);
  if (direct) return direct[1];
  const list = /export\s*\{\s*([A-Z][A-Za-z0-9]*)\b/.exec(componentSource);
  return list ? list[1] : null;
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

/** Options for {@link generateComponent}. */
export interface GenerateOptions {
  readonly prompt: string;
  readonly name?: string;
  readonly group?: ComponentGroup;
  readonly workspace: string;
  /** UI package directory (otherwise detected). */
  readonly ui?: string;
  readonly dryRun?: boolean;
  readonly force?: boolean;
  /** Skip the provider and use the offline generator. */
  readonly offline?: boolean;
}

/** Injection points (tests). */
export interface GenerateDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly persisted?: PersistedAiConfig;
  readonly fetch?: typeof fetch;
  /** Replaces `createProvider(...)`. */
  readonly provider?: AiProvider;
  readonly typecheck?: typeof typecheckComponent;
}

/** What `re-shell ui generate` reports. */
export interface GenerateResult {
  readonly name: string;
  readonly kind: ComponentKind | 'custom';
  readonly group: ComponentGroup;
  /** Where the code came from. `offline` means NO model was involved. */
  readonly source: 'model' | 'offline';
  readonly offline: boolean;
  readonly provider: string;
  readonly model?: string;
  readonly package: string;
  readonly files: string[];
  readonly barrel: string;
  readonly dryRun: boolean;
  readonly typecheck: { readonly ok: true; readonly durationMs: number; readonly attempts: number };
  readonly intent?: { readonly kind: ComponentKind; readonly fields: FieldSpec[] };
  readonly warnings: string[];
  /** The generated sources (always returned; only written when not a dry run). */
  readonly sources: GeneratedFiles;
}

function formatDiagnostics(result: TypecheckResult): string {
  return result.diagnostics
    .slice(0, 12)
    .map((d) => `${d.file}:${d.line}:${d.column} ${d.code} ${d.message}`)
    .join('\n');
}

/**
 * Generate a component from a description.
 *
 * @throws {UiScaffoldError} when the input is invalid, the package cannot be found, the name
 *   collides, or the generated code does not pass inspection and `tsc`
 */
export async function generateComponent(options: GenerateOptions, deps: GenerateDeps = {}): Promise<GenerateResult> {
  const prompt = options.prompt.trim();
  if (prompt.length === 0) throw new UiScaffoldError('--prompt must not be empty');
  if (prompt.length > MAX_GENERATE_PROMPT_LENGTH) {
    throw new UiScaffoldError(`--prompt is longer than ${MAX_GENERATE_PROMPT_LENGTH} characters`);
  }
  if (options.name !== undefined && !isValidComponentName(options.name)) {
    throw new UiScaffoldError(`--name "${options.name}" must be PascalCase (letters and digits, starting with a capital)`);
  }
  const group = options.group ?? 're-shell';
  if (!COMPONENT_GROUPS.includes(group)) {
    throw new UiScaffoldError(`--group must be one of ${COMPONENT_GROUPS.join(', ')}`);
  }

  const pkg = findUiPackage(options.workspace, options.ui);
  const typecheck = deps.typecheck ?? typecheckComponent;
  const warnings: string[] = [];

  // ---- choose the source ---------------------------------------------------
  const env = deps.env ?? process.env;
  const persisted = deps.persisted ?? readPersistedAiConfig();
  const config = resolveAiConfig(env, persisted);
  let provider: AiProvider | undefined;
  if (!options.offline) {
    if (deps.provider) {
      provider = deps.provider;
    } else if (config.provider !== 'offline') {
      try {
        provider = createProvider(config, { fetch: deps.fetch });
      } catch (error) {
        warnings.push(`AI provider "${config.provider}" is not usable (${(error as Error).message}); used the offline generator`);
      }
    }
  }
  if (provider && typeof provider.complete !== 'function') {
    warnings.push(`AI provider "${provider.name}" cannot generate free-form text; used the offline generator`);
    provider = undefined;
  }

  if (provider) {
    const viaModel = await generateWithModel(pkg, group, prompt, options, provider, typecheck, warnings);
    if (viaModel) return viaModel;
  }

  // ---- offline -------------------------------------------------------------
  const intent = parseIntent(prompt, options.name);
  if (!isValidComponentName(intent.name)) {
    throw new UiScaffoldError(`could not derive a valid component name from the prompt (got "${intent.name}"); pass --name`);
  }
  assertNoCollision(pkg, group, intent.name, Boolean(options.force));
  const sources = renderComponent({ name: intent.name, kind: intent.kind, group, fields: intent.fields, description: prompt });
  const check = await typecheck(pkg, group, intent.name, sources);
  if (!check.ok) {
    throw new UiScaffoldError(
      `the offline template for "${intent.name}" does not typecheck; nothing was written:\n${formatDiagnostics(check)}`,
      { diagnostics: check.diagnostics }
    );
  }
  const written: WriteResult = writeComponent(pkg, group, intent.name, sources, { dryRun: options.dryRun });
  return {
    name: intent.name,
    kind: intent.kind,
    group,
    source: 'offline',
    offline: true,
    provider: 'offline',
    package: pkg.name,
    files: written.files,
    barrel: written.barrel,
    dryRun: written.dryRun,
    typecheck: { ok: true, durationMs: check.durationMs, attempts: 1 },
    intent: { kind: intent.kind, fields: intent.fields },
    warnings: [
      'OFFLINE: no AI model was used. This is a deterministic template filled from the parsed prompt (component kind and fields).',
      ...intent.notes,
      ...warnings,
    ],
    sources,
  };
}

async function generateWithModel(
  pkg: UiPackage,
  group: ComponentGroup,
  prompt: string,
  options: GenerateOptions,
  provider: AiProvider,
  typecheck: typeof typecheckComponent,
  warnings: string[]
): Promise<GenerateResult | null> {
  let feedback: string | undefined;
  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let text: string;
    let model: string;
    try {
      const reply = await provider.complete!({
        system: GENERATE_SYSTEM_PROMPT,
        prompt: buildGeneratePrompt(prompt, options.name, feedback),
        maxTokens: 8192,
      });
      text = reply.text;
      model = reply.model;
    } catch (error) {
      if (error instanceof AiProviderError || (error as Error)?.name === 'AiProviderError') {
        warnings.push(`AI provider "${provider.name}" failed (${(error as Error).message}); used the offline generator`);
        return null;
      }
      throw error;
    }

    let files: GeneratedFiles;
    let name: string;
    try {
      files = parseModelFiles(text);
      name = options.name ?? exportedComponentName(files.component) ?? '';
    } catch (error) {
      lastProblems = [(error as Error).message];
      feedback = lastProblems.join('\n');
      continue;
    }
    if (!isValidComponentName(name)) {
      lastProblems = [`the component name "${name}" is not valid PascalCase`];
      feedback = lastProblems.join('\n');
      continue;
    }

    const problems = inspectGeneratedSource(files, name);
    if (problems.length > 0) {
      lastProblems = problems;
      feedback = problems.join('\n');
      continue;
    }
    assertNoCollision(pkg, group, name, Boolean(options.force));

    const check = await typecheck(pkg, group, name, files);
    if (!check.ok) {
      lastProblems = check.diagnostics.map((d) => `${d.file}:${d.line} ${d.code} ${d.message}`);
      feedback = formatDiagnostics(check);
      continue;
    }

    const written = writeComponent(pkg, group, name, files, { dryRun: options.dryRun });
    return {
      name,
      kind: 'custom',
      group,
      source: 'model',
      offline: false,
      provider: provider.name,
      model,
      package: pkg.name,
      files: written.files,
      barrel: written.barrel,
      dryRun: written.dryRun,
      typecheck: { ok: true, durationMs: check.durationMs, attempts: attempt },
      warnings,
      sources: files,
    };
  }
  throw new UiScaffoldError(
    `the model's component did not pass validation after 2 attempts; nothing was written:\n${lastProblems.slice(0, 12).join('\n')}`,
    { problems: lastProblems, provider: provider.name }
  );
}

/** Provider names, for help text. */
export const GENERATE_PROVIDERS = AI_PROVIDER_NAMES;
