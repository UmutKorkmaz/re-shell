import { describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { renderComponent, type ComponentKind, type FieldSpec } from '../../src/utils/ui-component-templates';
import { findUiPackage } from '../../src/utils/ui-package';
import { typecheckComponent } from '../../src/utils/ui-typecheck';
import { generateComponent } from '../../src/utils/ui-generate';
import { runUiComponentNew } from '../../src/commands/ui-component';

/**
 * Runs the REAL TypeScript compiler against the REAL packages/ui: every template (and the
 * offline `ui generate` pipeline end to end) must produce code that compiles with the
 * package's own tsconfig, and broken code must be caught. Each tsc run loads react,
 * storybook and vitest types, so these are slow (~10-20 s each).
 */
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const uiDir = path.join(repoRoot, 'packages', 'ui');
const available = fs.existsSync(path.join(uiDir, 'node_modules', 'typescript', 'bin', 'tsc'));

const f = (key: string, label: string, type: FieldSpec['type']): FieldSpec => ({ key, label, type });

const KINDS: Array<[string, ComponentKind, FieldSpec[]]> = [
  ['PlainBox', 'basic', []],
  ['ServiceCard', 'card', [f('name', 'Name', 'string'), f('port', 'Port', 'number'), f('status', 'Status', 'status'), f('active', 'Active', 'boolean'), f('updated', 'Updated', 'date')]],
  ['ServiceTable', 'table', [f('name', 'Name', 'string'), f('port', 'Port', 'number'), f('status', 'Status', 'status')]],
  ['LoginForm', 'form', [f('email', 'Email', 'email'), f('password', 'Password', 'password'), f('remember', 'Remember', 'boolean')]],
  ['JobList', 'list', [f('label', 'Label', 'string'), f('duration', 'Duration', 'number'), f('state', 'State', 'status')]],
  ['HealthPill', 'badge', [f('healthy', 'Healthy', 'status'), f('degraded', 'Degraded', 'status'), f('down', 'Down', 'status')]],
];

describe.skipIf(!available)('generated components typecheck against packages/ui', () => {
  const pkg = available ? findUiPackage(repoRoot) : { dir: uiDir, name: '@re-shell/ui' };

  it.each(KINDS)('%s (%s) compiles: component, story and test', async (name, kind, fields) => {
    const files = renderComponent({ name, kind, group: 'ui', fields });
    const result = await typecheckComponent(pkg, 'ui', name, files);
    expect(result.diagnostics.map((d) => `${d.file}:${d.line} ${d.code} ${d.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  }, 120_000);

  it('catches a type error in the generated component', async () => {
    const files = renderComponent({ name: 'PlainBox', kind: 'basic', group: 'ui', fields: [] });
    const result = await typecheckComponent(pkg, 'ui', 'PlainBox', { ...files, component: `${files.component}\nconst broken: number = 'nope';\n` });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ file: 'components/ui/plain-box.tsx', code: 'TS2322' });
  }, 120_000);

  it('catches a bad prop in the generated story and test (they are typechecked too)', async () => {
    const files = renderComponent({ name: 'PlainBox', kind: 'basic', group: 'ui', fields: [] });
    const result = await typecheckComponent(pkg, 'ui', 'PlainBox', {
      ...files,
      story: files.story.replace("args: { children: 'PlainBox content' }", "args: { children: 'x', notAProp: 1 }"),
      test: files.test.replace('<PlainBox tone="critical"', '<PlainBox tone="rainbow"'),
    });
    expect(result.ok).toBe(false);
    const flagged = new Set(result.diagnostics.map((d) => d.file));
    expect(flagged).toContain('components/ui/plain-box.stories.tsx');
    expect(flagged).toContain('components/ui/plain-box.test.tsx');
  }, 120_000);

  it('does not modify packages/ui while typechecking', async () => {
    const before = fs.readdirSync(path.join(uiDir, 'src', 'components', 'ui')).sort();
    await typecheckComponent(pkg, 'ui', 'PlainBox', renderComponent({ name: 'PlainBox', kind: 'basic', group: 'ui', fields: [] }));
    expect(fs.readdirSync(path.join(uiDir, 'src', 'components', 'ui')).sort()).toEqual(before);
    // and the overlay is cleaned up
    const cache = path.join(uiDir, 'node_modules', '.cache', 're-shell');
    expect(fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('ui-generate-')) : []).toEqual([]);
  }, 120_000);

  it('offline `ui generate` runs the real gate and writes a component that compiles (dry run on the real package)', async () => {
    const result = await generateComponent(
      { prompt: 'a table of services with name, port and status', workspace: repoRoot, dryRun: true },
      { env: {} as NodeJS.ProcessEnv, persisted: {} }
    );
    expect(result).toMatchObject({ offline: true, name: 'ServicesTable', typecheck: { ok: true, attempts: 1 } });
    expect(result.typecheck.durationMs).toBeGreaterThan(500); // tsc really ran
  }, 120_000);

  it('`ui component new` output compiles when written into a copy of the package layout', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-new-'));
    try {
      const dir = path.join(root, 'packages', 'ui');
      fs.mkdirSync(path.join(dir, 'src', 'components', 'ui'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@re-shell/ui' }));
      const out: string[] = [];
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        out.push(String(chunk));
        return true;
      });
      try {
        await runUiComponentNew('ScratchPad', { json: true, workspace: root });
      } finally {
        spy.mockRestore();
      }
      const source = fs.readFileSync(path.join(dir, 'src/components/ui/scratch-pad.tsx'), 'utf8');
      expect(source).toContain('ScratchPad');
      // The same source typechecks against the real package.
      const files = renderComponent({ name: 'ScratchPad', kind: 'basic', group: 'ui', fields: [] });
      expect(files.component).toBe(source);
      expect((await typecheckComponent(pkg, 'ui', 'ScratchPad', files)).ok).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
