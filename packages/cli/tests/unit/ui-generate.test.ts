import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  GENERATE_SYSTEM_PROMPT,
  buildGeneratePrompt,
  exportedComponentName,
  generateComponent,
  inspectGeneratedSource,
  parseFields,
  parseIntent,
  parseModelFiles,
} from '../../src/utils/ui-generate';
import { runUiGenerate } from '../../src/commands/ui-generate';
import { renderComponent } from '../../src/utils/ui-component-templates';
import { AiProviderError, type AiProvider, type TextRequest } from '../../src/ai/types';
import type { TypecheckResult } from '../../src/utils/ui-typecheck';

const OK: TypecheckResult = { ok: true, diagnostics: [], durationMs: 5, output: '' };
const okTypecheck = vi.fn(async () => OK);

/** A minimal UI package on disk (the layout the scaffolder detects). */
function uiPackage(root: string): string {
  const dir = path.join(root, 'packages', 'ui');
  fs.mkdirSync(path.join(dir, 'src', 'components', 'ui'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'components', 're-shell'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@re-shell/ui' }));
  fs.writeFileSync(path.join(dir, 'src', 'components', 'ui', 'index.ts'), "export * from './badge';\n");
  fs.writeFileSync(path.join(dir, 'src', 'components', 'ui', 'badge.tsx'), 'export const Badge = () => null;\n');
  return dir;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-generate-'));
}

/** The reply a model would give for a "ServiceBadge": three fenced blocks. */
function modelReply(name = 'ServiceBadge'): string {
  const files = renderComponent({
    name,
    kind: 'badge',
    group: 're-shell',
    fields: [
      { key: 'healthy', label: 'Healthy', type: 'status' },
      { key: 'down', label: 'Down', type: 'status' },
    ],
  });
  return `Here you go.\n\n\`\`\`tsx component\n${files.component}\`\`\`\n\n\`\`\`tsx story\n${files.story}\`\`\`\n\n\`\`\`tsx test\n${files.test}\`\`\`\n`;
}

function provider(complete: (request: TextRequest) => Promise<string>, name: AiProvider['name'] = 'anthropic'): AiProvider {
  return {
    name,
    model: 'claude-test',
    propose: async () => {
      throw new Error('propose must not be used for generation');
    },
    complete: async (request) => ({ text: await complete(request), model: 'claude-test', latencyMs: 1 }),
  };
}

describe('parseIntent (offline)', () => {
  it.each([
    ['a card showing service name, port and status', 'card', ['serviceName', 'port', 'status']],
    ['a table of services with name, port, status', 'table', ['name', 'port', 'status']],
    ['login form with email and password', 'form', ['email', 'password']],
    ['a list of jobs with label and duration', 'list', ['label', 'duration']],
    ['a status badge with healthy, degraded, down', 'badge', ['healthy', 'degraded', 'down']],
  ] as const)('%s -> %s', (prompt, kind, keys) => {
    const intent = parseIntent(prompt);
    expect(intent.kind).toBe(kind);
    expect(intent.fields.map((f) => f.key)).toEqual(keys);
  });

  it('infers field types from the names', () => {
    const types = Object.fromEntries(parseFields('name, port, enabled, created date, contact email, password, build status').map((f) => [f.key, f.type]));
    expect(types).toEqual({
      name: 'string',
      port: 'number',
      enabled: 'boolean',
      createdDate: 'date',
      contactEmail: 'email',
      password: 'password',
      buildStatus: 'status',
    });
  });

  it('derives a deterministic PascalCase name', () => {
    expect(parseIntent('a service status card with name and port').name).toBe('ServiceStatusCard');
    expect(parseIntent('a table of services with name, port').name).toBe('ServicesTable');
    expect(parseIntent('a login form with email and password').name).toBe('LoginForm');
    expect(parseIntent('a badge with ok and failed').name).toBe('StatusBadge');
    expect(parseIntent('a card', 'MyCard').name).toBe('MyCard');
    // Same prompt, same answer.
    expect(parseIntent('job list with label')).toEqual(parseIntent('job list with label'));
  });

  it('falls back to a card with default fields and says so', () => {
    const intent = parseIntent('something interesting');
    expect(intent.kind).toBe('card');
    expect(intent.notes.join(' ')).toMatch(/defaulted to card/);
    expect(intent.notes.join(' ')).toMatch(/default card fields/);
  });

  it('drops duplicates, keywords and over-long phrases and caps the field count', () => {
    expect(parseFields('name, name, class, a b c d e f').map((f) => f.key)).toEqual(['name', 'classValue']);
    expect(parseFields(Array.from({ length: 30 }, (_, i) => `f${i}`).join(', '))).toHaveLength(12);
  });
});

describe('model output handling', () => {
  it('extracts the three files and the exported name', () => {
    const files = parseModelFiles(modelReply());
    expect(Object.keys(files)).toEqual(['component', 'story', 'test']);
    expect(exportedComponentName(files.component)).toBe('ServiceBadge');
  });

  it('reports which block is missing', () => {
    expect(() => parseModelFiles('```tsx component\nexport const A = 1;\n```')).toThrow(/missing the story, test/);
  });

  it('puts the conventions and the offline-free contract in the prompts', () => {
    expect(GENERATE_SYSTEM_PROMPT).toMatch(/design tokens/);
    expect(GENERATE_SYSTEM_PROMPT).toMatch(/NEVER raw colours/);
    expect(buildGeneratePrompt('a badge', 'MyBadge')).toContain('use exactly): MyBadge');
    expect(buildGeneratePrompt('a badge', undefined, 'TS2322 boom')).toContain('TS2322 boom');
  });

  it('accepts a conforming reply', () => {
    expect(inspectGeneratedSource(parseModelFiles(modelReply()), 'ServiceBadge')).toEqual([]);
  });

  it.each([
    ["import fs from 'fs';", /imports "fs"/],
    ["import x from 'left-pad';", /imports "left-pad"/],
    ["import y from './other-file';", /only \.\/service-badge/],
    ["const z = eval('1');", /eval\(\)/],
    ["const e = process.env.SECRET;", /process\.env/],
    ["fetch('https://evil.test');", /network access/],
    ["const html = <div dangerouslySetInnerHTML={{ __html: '' }} />;", /dangerouslySetInnerHTML/],
    ["const m = require('child_process');", /require\(\)|child_process/],
  ])('rejects dangerous or unknown code: %s', (line, pattern) => {
    const files = parseModelFiles(modelReply());
    const bad = { ...files, component: `${line}\n${files.component}` };
    expect(inspectGeneratedSource(bad, 'ServiceBadge').join('\n')).toMatch(pattern);
  });

  it('requires the exported name, a play() story, and an axe check', () => {
    const files = parseModelFiles(modelReply());
    expect(inspectGeneratedSource({ ...files, component: 'export const Other = 1;\n' }, 'ServiceBadge').join()).toMatch(/must export a symbol named ServiceBadge/);
    expect(inspectGeneratedSource({ ...files, story: files.story.replace(/play\s*:/g, 'noplay:') }, 'ServiceBadge').join()).toMatch(/play\(\)/);
    expect(inspectGeneratedSource({ ...files, test: files.test.replace(/expectNoA11yViolations/g, 'x') }, 'ServiceBadge').join()).toMatch(/axe/);
  });
});

describe('generateComponent', () => {
  let root: string;
  let ui: string;
  beforeEach(() => {
    root = tmp();
    ui = uiPackage(root);
    okTypecheck.mockClear();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const env = {} as NodeJS.ProcessEnv;

  it('OFFLINE: with no provider configured it generates from the parsed prompt and says so', async () => {
    const result = await generateComponent(
      { prompt: 'a table of services with name, port and status', workspace: root },
      { env, persisted: {}, typecheck: okTypecheck }
    );
    expect(result).toMatchObject({ source: 'offline', offline: true, provider: 'offline', name: 'ServicesTable', kind: 'table', group: 're-shell', package: '@re-shell/ui' });
    expect(result.warnings[0]).toMatch(/^OFFLINE: no AI model was used/);
    expect(result.intent?.fields.map((f) => f.key)).toEqual(['name', 'port', 'status']);

    // Written in the packages/ui convention: component + story + test + barrel.
    for (const file of ['services-table.tsx', 'services-table.stories.tsx', 'services-table.test.tsx']) {
      expect(fs.existsSync(path.join(ui, 'src/components/re-shell', file))).toBe(true);
    }
    expect(fs.readFileSync(path.join(ui, 'src/components/re-shell/index.ts'), 'utf8')).toBe("export * from './services-table';\n");
    // The typecheck gate ran before the write.
    expect(okTypecheck).toHaveBeenCalledTimes(1);
  });

  it('OFFLINE is deterministic: the same prompt yields identical files', async () => {
    const run = () => generateComponent({ prompt: 'a card showing name and port', workspace: root, dryRun: true }, { env, persisted: {}, typecheck: okTypecheck });
    const [a, b] = [await run(), await run()];
    expect(a.sources).toEqual(b.sources);
  });

  it('--dry-run typechecks and returns the code but writes nothing', async () => {
    const result = await generateComponent({ prompt: 'a health badge with ok and failed', workspace: root, dryRun: true }, { env, persisted: {}, typecheck: okTypecheck });
    expect(result.dryRun).toBe(true);
    expect(okTypecheck).toHaveBeenCalledTimes(1);
    expect(result.name).toBe('HealthBadge');
    expect(result.sources.component).toContain('export { HealthBadge }');
    expect(fs.readdirSync(path.join(ui, 'src/components/re-shell'))).toEqual([]);
  });

  it('refuses to write when the generated code does not typecheck, and reports the diagnostics', async () => {
    const failing = vi.fn(async (): Promise<TypecheckResult> => ({
      ok: false,
      durationMs: 1,
      output: '',
      diagnostics: [{ file: 'components/re-shell/x.tsx', line: 3, column: 1, code: 'TS2322', message: 'Type mismatch' }],
    }));
    await expect(
      generateComponent({ prompt: 'a card with name', workspace: root, name: 'XCard' }, { env, persisted: {}, typecheck: failing })
    ).rejects.toThrow(/does not typecheck; nothing was written[\s\S]*TS2322 Type mismatch/);
    expect(fs.readdirSync(path.join(ui, 'src/components/re-shell'))).toEqual([]);
  });

  it('MODEL: uses the configured provider via complete(), validates and writes its files', async () => {
    const seen: TextRequest[] = [];
    const result = await generateComponent(
      { prompt: 'a service badge', workspace: root },
      { env, persisted: {}, provider: provider(async (request) => (seen.push(request), modelReply())), typecheck: okTypecheck }
    );
    expect(result).toMatchObject({ source: 'model', offline: false, provider: 'anthropic', model: 'claude-test', name: 'ServiceBadge', kind: 'custom' });
    expect(result.warnings).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(seen[0].system).toBe(GENERATE_SYSTEM_PROMPT);
    expect(seen[0].prompt).toContain('a service badge');
    expect(fs.existsSync(path.join(ui, 'src/components/re-shell/service-badge.tsx'))).toBe(true);
  });

  it('MODEL: feeds compiler errors back once and succeeds on the repaired attempt', async () => {
    const calls: string[] = [];
    const flaky = vi
      .fn<[], Promise<TypecheckResult>>()
      .mockResolvedValueOnce({ ok: false, durationMs: 1, output: '', diagnostics: [{ file: 'a.tsx', line: 1, column: 1, code: 'TS2304', message: "Cannot find name 'Foo'" }] })
      .mockResolvedValueOnce(OK);
    const result = await generateComponent(
      { prompt: 'a service badge', workspace: root },
      { env, persisted: {}, provider: provider(async (request) => (calls.push(request.prompt), modelReply())), typecheck: flaky }
    );
    expect(result.typecheck.attempts).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/did not pass validation[\s\S]*TS2304/);
  });

  it('MODEL: fails (writing nothing) when the output keeps failing the gate', async () => {
    const bad = vi.fn(async (): Promise<TypecheckResult> => ({ ok: false, durationMs: 1, output: '', diagnostics: [{ file: 'a.tsx', line: 1, column: 1, code: 'TS1005', message: 'nope' }] }));
    await expect(
      generateComponent({ prompt: 'a service badge', workspace: root }, { env, persisted: {}, provider: provider(async () => modelReply()), typecheck: bad })
    ).rejects.toThrow(/did not pass validation after 2 attempts; nothing was written/);
    expect(bad).toHaveBeenCalledTimes(2);
    expect(fs.readdirSync(path.join(ui, 'src/components/re-shell'))).toEqual([]);
  });

  it('MODEL: rejects an unsafe reply without ever typechecking it', async () => {
    const reply = modelReply().replace("import * as React from 'react';", "import * as React from 'react';\nimport cp from 'child_process';");
    await expect(
      generateComponent({ prompt: 'a service badge', workspace: root }, { env, persisted: {}, provider: provider(async () => reply), typecheck: okTypecheck })
    ).rejects.toThrow(/child_process|not an allowed dependency/);
    expect(okTypecheck).not.toHaveBeenCalled();
  });

  it('falls back to OFFLINE (with a warning) when the provider fails', async () => {
    const failing = provider(async () => {
      throw new AiProviderError('anthropic', 'network', 'could not reach Anthropic');
    });
    const result = await generateComponent({ prompt: 'a card with name', workspace: root }, { env, persisted: {}, provider: failing, typecheck: okTypecheck });
    expect(result.offline).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/AI provider "anthropic" failed \(could not reach Anthropic\); used the offline generator/);
  });

  it('falls back to OFFLINE when the provider cannot generate text', async () => {
    const noComplete: AiProvider = { name: 'offline', propose: async () => { throw new Error('x'); } };
    const result = await generateComponent({ prompt: 'a card with name', workspace: root }, { env, persisted: {}, provider: noComplete, typecheck: okTypecheck });
    expect(result.offline).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/cannot generate free-form text/);
  });

  it('--offline skips a configured provider', async () => {
    const complete = vi.fn(async () => modelReply());
    const result = await generateComponent({ prompt: 'a card with name', workspace: root, offline: true }, { env, persisted: {}, provider: provider(complete), typecheck: okTypecheck });
    expect(result.offline).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('detects a configured provider from the environment and calls it through createProvider', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fakeFetch = (async (url: string, init: { body?: string }) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : undefined });
      return new Response(
        JSON.stringify({ model: 'local-model', choices: [{ message: { role: 'assistant', content: modelReply() }, finish_reason: 'stop' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as unknown as typeof fetch;
    const result = await generateComponent(
      { prompt: 'a service badge', workspace: root },
      { env: { RE_SHELL_AI_BASE_URL: 'http://localhost:11434/v1', RE_SHELL_AI_MODEL: 'local-model' } as NodeJS.ProcessEnv, persisted: {}, fetch: fakeFetch, typecheck: okTypecheck }
    );
    expect(result).toMatchObject({ source: 'model', provider: 'openai-compatible', model: 'local-model' });
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('validates input before doing any work', async () => {
    const deps = { env, persisted: {}, typecheck: okTypecheck };
    await expect(generateComponent({ prompt: '   ', workspace: root }, deps)).rejects.toThrow(/--prompt must not be empty/);
    await expect(generateComponent({ prompt: 'x'.repeat(2001), workspace: root }, deps)).rejects.toThrow(/longer than 2000/);
    await expect(generateComponent({ prompt: 'a card', name: 'bad name', workspace: root }, deps)).rejects.toThrow(/PascalCase/);
    await expect(generateComponent({ prompt: 'a card', group: 'weird' as never, workspace: root }, deps)).rejects.toThrow(/--group/);
    expect(okTypecheck).not.toHaveBeenCalled();
  });

  it('refuses a name that already exists in the package', async () => {
    await expect(
      generateComponent({ prompt: 'a card with name', name: 'Badge', workspace: root }, { env, persisted: {}, typecheck: okTypecheck })
    ).rejects.toThrow(/symbol named Badge is already declared/);
  });
});

describe('runUiGenerate (command)', () => {
  let root: string;
  let written: string[];
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    root = tmp();
    uiPackage(root);
    written = [];
    process.exitCode = undefined;
    spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    spy.mockRestore();
    process.exitCode = undefined;
    fs.rmSync(root, { recursive: true, force: true });
  });

  const deps = { env: {} as NodeJS.ProcessEnv, persisted: {}, typecheck: okTypecheck };

  it('--json says it is offline and omits the source text unless dry-run', async () => {
    await runUiGenerate({ prompt: 'a health badge with ok and failed', workspace: root, json: true }, deps);
    const envelope = JSON.parse(written[written.length - 1]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toMatchObject({ offline: true, source: 'offline', provider: 'offline', dryRun: false });
    expect(envelope.data.sources).toBeUndefined();
    expect(envelope.warnings[0]).toMatch(/^OFFLINE/);
  });

  it('--json --dry-run includes the generated sources', async () => {
    await runUiGenerate({ prompt: 'a health badge with ok and failed', workspace: root, json: true, dryRun: true }, deps);
    const envelope = JSON.parse(written[written.length - 1]);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.sources.component).toContain('forwardRef');
  });

  it('reports failures as UI_GENERATE_ERROR and exits non-zero', async () => {
    await runUiGenerate({ prompt: 'a card', name: 'lowercase', workspace: root, json: true }, deps);
    const envelope = JSON.parse(written[written.length - 1]);
    expect(envelope).toMatchObject({ ok: false, error: { code: 'UI_GENERATE_ERROR' } });
    expect(process.exitCode).toBe(1);
  });

  it('requires --prompt', async () => {
    await runUiGenerate({ workspace: root, json: true }, deps);
    expect(JSON.parse(written[written.length - 1]).error.message).toMatch(/--prompt/);
  });

  it('human output states OFFLINE clearly', async () => {
    await runUiGenerate({ prompt: 'a health badge with ok and failed', workspace: root }, deps);
    expect(written.join('')).toMatch(/OFFLINE/);
    expect(written.join('')).toMatch(/no AI model was used/);
  });
});
