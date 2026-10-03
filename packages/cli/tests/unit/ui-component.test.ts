import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runUiComponentNew } from '../../src/commands/ui-component';
import { addBarrelExport, findUiPackage } from '../../src/utils/ui-package';
import { isValidComponentName, splitWords, toCamel, toKebab, toLabel, toPascal } from '../../src/utils/ui-names';
import { renderComponent, toneForStatus, type ComponentKind } from '../../src/utils/ui-component-templates';

function fixture(): { root: string; ui: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-component-'));
  const ui = path.join(root, 'packages', 'ui');
  for (const group of ['ui', 're-shell', 'primitives']) fs.mkdirSync(path.join(ui, 'src', 'components', group), { recursive: true });
  fs.writeFileSync(path.join(ui, 'package.json'), JSON.stringify({ name: '@re-shell/ui' }));
  fs.writeFileSync(path.join(ui, 'src', 'components', 'ui', 'index.ts'), "export * from './badge';\nexport * from './tabs';\n");
  fs.writeFileSync(path.join(ui, 'src', 'components', 'ui', 'badge.tsx'), 'export const Badge = () => null;\n');
  return { root, ui };
}

describe('naming helpers', () => {
  it('converts between cases', () => {
    expect(splitWords('serviceStatus-card_v2')).toEqual(['service', 'status', 'card', 'v2']);
    expect(toPascal('service status')).toBe('ServiceStatus');
    expect(toKebab('ServiceStatusCard')).toBe('service-status-card');
    expect(toKebab('HTTPServer')).toBe('http-server');
    expect(toCamel('Port Number')).toBe('portNumber');
    expect(toCamel('2fa code')).toBe('field2faCode');
    expect(toLabel('portNumber')).toBe('Port number');
  });

  it.each([['ServiceCard', true], ['A', true], ['serviceCard', false], ['Service Card', false], ['1Card', false], ['Card-X', false], ['', false]])('isValidComponentName(%j)', (name, ok) => {
    expect(isValidComponentName(name)).toBe(ok);
  });
});

describe('barrel', () => {
  it('adds a sorted export, is idempotent, and keeps other lines', () => {
    expect(addBarrelExport(undefined, 'alpha')).toBe("export * from './alpha';\n");
    const once = addBarrelExport("// components\nexport * from './badge';\nexport * from './tabs';\n", 'card');
    expect(once).toBe("// components\nexport * from './badge';\nexport * from './card';\nexport * from './tabs';\n");
    expect(addBarrelExport(once, 'card')).toBe(once);
  });
});

describe('findUiPackage', () => {
  let ctx: ReturnType<typeof fixture>;
  beforeEach(() => {
    ctx = fixture();
  });
  afterEach(() => fs.rmSync(ctx.root, { recursive: true, force: true }));

  it('finds packages/ui from the workspace root and prefers @re-shell/ui', () => {
    expect(findUiPackage(ctx.root)).toEqual({ dir: ctx.ui, name: '@re-shell/ui' });
    const other = path.join(ctx.root, 'apps', 'kit');
    fs.mkdirSync(path.join(other, 'src', 'components', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'kit' }));
    expect(findUiPackage(ctx.root).dir).toBe(ctx.ui);
  });

  it('refuses to guess between several unnamed candidates and validates --ui', () => {
    fs.writeFileSync(path.join(ctx.ui, 'package.json'), JSON.stringify({ name: 'not-ours' }));
    const other = path.join(ctx.root, 'apps', 'kit');
    fs.mkdirSync(path.join(other, 'src', 'components', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'kit' }));
    expect(() => findUiPackage(ctx.root)).toThrow(/several UI packages/);
    expect(findUiPackage(ctx.root, 'apps/kit').dir).toBe(other);
    expect(() => findUiPackage(ctx.root, 'apps/missing')).toThrow(/not a UI package/);
  });

  it('fails clearly when there is no UI package', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-empty-'));
    try {
      expect(() => findUiPackage(empty)).toThrow(/no UI package found/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('templates', () => {
  const f = (key: string, label: string, type: 'string' | 'number' | 'boolean' | 'status' | 'date' | 'email' | 'password') => ({ key, label, type }) as const;
  const cases: Array<[ComponentKind, ReturnType<typeof f>[]]> = [
    ['basic', []],
    ['card', [f('name', 'Name', 'string'), f('port', 'Port', 'number'), f('status', 'Status', 'status')]],
    ['table', [f('name', 'Name', 'string'), f('port', 'Port', 'number')]],
    ['form', [f('email', 'Email', 'email'), f('remember', 'Remember', 'boolean')]],
    ['list', [f('label', 'Label', 'string'), f('duration', 'Duration', 'number')]],
    ['badge', [f('healthy', 'Healthy', 'status'), f('down', 'Down', 'status')]],
  ];

  it.each(cases)('%s follows the packages/ui conventions', (kind, fields) => {
    const { component, story, test } = renderComponent({ name: 'Sample', kind, group: 'ui', fields });
    // component: forwardRef + displayName + tokens only + named export
    expect(component).toContain('React.forwardRef');
    expect(component).toContain("Sample.displayName = 'Sample'");
    expect(component).toMatch(/export \{ Sample/);
    expect(component).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|oklch\(/);
    // story: CSF3 + satisfies Meta + play()
    expect(story).toContain("from '@storybook/react-vite'");
    expect(story).toContain('satisfies Meta<typeof Sample>');
    expect(story).toMatch(/play: async/);
    expect(story).toContain("title: 'UI/Sample'");
    // test: vitest + axe
    expect(test).toContain("from 'vitest'");
    expect(test).toContain('expectNoA11yViolations');
  });

  it('numbers render in mono + tabular-nums, and statuses map to Badge tones', () => {
    const { component } = renderComponent({ name: 'Svc', kind: 'card', group: 're-shell', fields: [f('port', 'Port', 'number'), f('status', 'Status', 'status')] });
    expect(component).toContain('font-mono tabular-nums');
    expect(component).toContain('statusVariant');
    expect(toneForStatus('Healthy')).toBe('healthy');
    expect(toneForStatus('degraded')).toBe('warn');
    expect(toneForStatus('FAILED')).toBe('critical');
    expect(toneForStatus('mystery')).toBe('info');
  });

  it('a kind that needs fields refuses to render without them', () => {
    expect(() => renderComponent({ name: 'X', kind: 'table', group: 'ui', fields: [] })).toThrow(/needs at least one field/);
  });
});

describe('runUiComponentNew', () => {
  let ctx: ReturnType<typeof fixture>;
  let written: string[];
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    ctx = fixture();
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
    fs.rmSync(ctx.root, { recursive: true, force: true });
  });
  const last = (): Record<string, any> => JSON.parse(written[written.length - 1]);

  it('creates the component, story and test and registers the barrel export', async () => {
    await runUiComponentNew('ServiceStatus', { json: true, workspace: ctx.root });
    expect(last()).toMatchObject({
      ok: true,
      data: {
        name: 'ServiceStatus',
        group: 'ui',
        package: '@re-shell/ui',
        dryRun: false,
        files: [
          'src/components/ui/service-status.tsx',
          'src/components/ui/service-status.stories.tsx',
          'src/components/ui/service-status.test.tsx',
        ],
        barrel: 'src/components/ui/index.ts',
      },
    });
    for (const file of last().data.files) expect(fs.existsSync(path.join(ctx.ui, file))).toBe(true);
    expect(fs.readFileSync(path.join(ctx.ui, 'src/components/ui/index.ts'), 'utf8')).toBe(
      "export * from './badge';\nexport * from './service-status';\nexport * from './tabs';\n"
    );
    expect(fs.readFileSync(path.join(ctx.ui, 'src/components/ui/service-status.tsx'), 'utf8')).toContain('const ServiceStatus = React.forwardRef');
  });

  it('--group re-shell writes into that folder and its barrel', async () => {
    await runUiComponentNew('JobSummary', { json: true, workspace: ctx.root, group: 're-shell' });
    expect(fs.existsSync(path.join(ctx.ui, 'src/components/re-shell/job-summary.tsx'))).toBe(true);
    expect(fs.readFileSync(path.join(ctx.ui, 'src/components/re-shell/index.ts'), 'utf8')).toBe("export * from './job-summary';\n");
  });

  it('--dry-run writes nothing', async () => {
    await runUiComponentNew('Ghost', { json: true, workspace: ctx.root, dryRun: true });
    expect(last().data.dryRun).toBe(true);
    expect(fs.existsSync(path.join(ctx.ui, 'src/components/ui/ghost.tsx'))).toBe(false);
    expect(fs.readFileSync(path.join(ctx.ui, 'src/components/ui/index.ts'), 'utf8')).not.toContain('ghost');
  });

  it.each([
    ['badValue', {}, /not a valid component name/],
    ['Badge', {}, /badge\.tsx already exists/],
    ['Fine', { group: 'nope' }, /--group must be one of/],
  ])('rejects %s as UI_COMPONENT_ERROR', async (name, extra, message) => {
    await runUiComponentNew(name, { json: true, workspace: ctx.root, ...extra });
    expect(last()).toMatchObject({ ok: false, error: { code: 'UI_COMPONENT_ERROR', message: expect.stringMatching(message) } });
    expect(process.exitCode).toBe(1);
  });

  it('refuses a name already declared by a differently named file', async () => {
    fs.writeFileSync(path.join(ctx.ui, 'src/components/ui/misc.tsx'), 'export const Widget = () => null;\n');
    await runUiComponentNew('Widget', { json: true, workspace: ctx.root });
    expect(last().error.message).toMatch(/symbol named Widget is already declared in src\/components\/ui\/misc\.tsx/);
  });

  it('refuses to overwrite existing files unless --force', async () => {
    await runUiComponentNew('Twice', { json: true, workspace: ctx.root });
    await runUiComponentNew('Twice', { json: true, workspace: ctx.root });
    expect(last().error.message).toMatch(/already exists.*--force/);
    process.exitCode = undefined;
    await runUiComponentNew('Twice', { json: true, workspace: ctx.root, force: true });
    expect(last().ok).toBe(true);
  });

  it('prints a human summary', async () => {
    await runUiComponentNew('Plain', { workspace: ctx.root });
    expect(written.join('')).toMatch(/Created\s+src\/components\/ui\/plain\.tsx/);
  });
});
