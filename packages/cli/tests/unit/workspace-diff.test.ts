import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { diffWorkspace } from '../../src/commands/workspace-diff';

// Covers src/commands/workspace-diff.ts — the `workspace diff` command. Only
// diffWorkspace is exported, so the pure diff helpers (computeDiff /
// compareServices / compareValues / the text + markdown renderers) are exercised
// through it. We write real (empty) on-disk from/to files so fs.existsSync
// succeeds, and mock the workspace parser so parse() returns controlled configs
// keyed by path. console.log is spied to capture every rendered line.

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
}));

vi.mock('../../src/parsers/workspace-parser', () => ({
  workspaceParser: { parse: mocks.parse },
}));

let projectDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wsdiff-'));
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

/** Every console.log argument, joined per-call into a single string. */
function logged(): string {
  return logSpy.mock.calls.map(args => args.join(' ')).join('\n');
}

/** Find and parse the JSON document emitted in --format json mode. */
function jsonDiff(): any {
  const line = logSpy.mock.calls
    .map(args => args.join(' '))
    .find(s => {
      try {
        const v = JSON.parse(s);
        return v && typeof v === 'object' && 'metadata' in v && 'summary' in v;
      } catch {
        return false;
      }
    });
  return line ? JSON.parse(line) : null;
}

interface SetupResult {
  fromPath: string;
  toPath: string;
}

/** Write empty from/to files and route the mocked parser to the given configs. */
function setup(
  fromConfig: any,
  toConfig: any,
  opts: { fromMissing?: boolean; toMissing?: boolean; fromInvalid?: boolean } = {}
): SetupResult {
  const fromPath = path.join(projectDir, 'old.yaml');
  const toPath = path.join(projectDir, 'new.yaml');
  if (!opts.fromMissing) fs.writeFileSync(fromPath, '', 'utf8');
  if (!opts.toMissing) fs.writeFileSync(toPath, '', 'utf8');
  mocks.parse.mockImplementation((p: string) => {
    if (p === fromPath) return opts.fromInvalid ? { valid: false } : { valid: true, config: fromConfig };
    if (p === toPath) return { valid: true, config: toConfig };
    return { valid: false };
  });
  return { fromPath, toPath };
}

beforeEach(() => {
  mocks.parse.mockReset();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('workspace-diff — dispatch & file handling', () => {
  it('shows usage when from and to resolve to the same path', async () => {
    await diffWorkspace({}); // both default to the same cwd-relative path
    const out = logged();
    expect(out).toContain('No comparison target specified');
    expect(out).toContain('Usage:');
  });

  it('errors when the from file is missing', async () => {
    const { fromPath, toPath } = setup(null, { services: {} }, { fromMissing: true });
    await diffWorkspace({ from: fromPath, to: toPath });
    expect(logged()).toContain('Cannot read from configuration: ' + fromPath);
  });

  it('errors when the to file is missing', async () => {
    const { fromPath, toPath } = setup({ services: {} }, null, { toMissing: true });
    await diffWorkspace({ from: fromPath, to: toPath });
    expect(logged()).toContain('Cannot read to configuration: ' + toPath);
  });

  it('treats an invalid (parse-failed) from config as unreadable', async () => {
    const { fromPath, toPath } = setup(null, { services: {} }, { fromInvalid: true });
    await diffWorkspace({ from: fromPath, to: toPath });
    expect(logged()).toContain('Cannot read from configuration: ' + fromPath);
  });
});

describe('workspace-diff — diff computation (json)', () => {
  it('reports an added service', async () => {
    const { fromPath, toPath } = setup(
      { services: { web: { port: 3000 } } },
      { services: { web: { port: 3000 }, api: { port: 4000 } } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const services = jsonDiff().changes.services;
    const added = services.find((s: any) => s.serviceId === 'api');
    expect(added.type).toBe('added');
    expect(added.changes[0].path).toBe('services.api');
    expect(jsonDiff().summary.added).toBeGreaterThan(0);
  });

  it('reports a removed service', async () => {
    const { fromPath, toPath } = setup(
      { services: { web: { port: 3000 }, api: { port: 4000 } } },
      { services: { web: { port: 3000 } } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const removed = jsonDiff().changes.services.find((s: any) => s.serviceId === 'api');
    expect(removed.type).toBe('removed');
  });

  it('reports a modified primitive (port 3000 → 4000) at the leaf path', async () => {
    const { fromPath, toPath } = setup(
      { services: { web: { port: 3000 } } },
      { services: { web: { port: 4000 } } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const web = jsonDiff().changes.services.find((s: any) => s.serviceId === 'web');
    expect(web.type).toBe('modified');
    const port = web.changes.find((c: any) => c.path.endsWith('port'));
    expect(port.type).toBe('modified');
    expect(port.oldValue).toBe(3000);
    expect(port.newValue).toBe(4000);
  });

  it('reports no changes for identical configs', async () => {
    const cfg = { services: { web: { port: 3000 } } };
    const { fromPath, toPath } = setup(cfg, cfg);
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const diff = jsonDiff();
    expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 0 });
    expect(diff.changes.services).toEqual([]);
  });

  it('counts a metadata-only change (version bump) with empty services', async () => {
    const { fromPath, toPath } = setup(
      { version: '1.0.0', services: {} },
      { version: '2.0.0', services: {} }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const diff = jsonDiff();
    expect(diff.summary.modified).toBe(1);
    expect(diff.changes.metadata.some((c: any) => c.path === '.version')).toBe(true);
  });

  it('records dependency changes when the dependencies section differs', async () => {
    const { fromPath, toPath } = setup(
      { services: {}, dependencies: { web: '1.0.0' } },
      { services: {}, dependencies: { web: '2.0.0' } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'json' });
    const deps = jsonDiff().changes.dependencies;
    expect(deps).toBeDefined();
    expect(deps.some((c: any) => c.path === 'dependencies.web')).toBe(true);
  });
});

describe('workspace-diff — render formats', () => {
  it('renders a markdown document with summary and service sections', async () => {
    const { fromPath, toPath } = setup(
      { services: { web: {} } },
      { services: { web: {}, api: {} } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'markdown' });
    const out = logged();
    expect(out).toContain('# Workspace Configuration Diff');
    expect(out).toContain('## Summary');
    expect(out).toContain('## Service Changes');
    expect(out).toContain('### api (added)');
  });

  it('renders text output with Summary counts and service +/-/~ icons (default)', async () => {
    const { fromPath, toPath } = setup(
      { services: { removed: {}, modified: { port: 3000 } } },
      { services: { added: {}, modified: { port: 4000 } } }
    );
    await diffWorkspace({ from: fromPath, to: toPath }); // format defaults to text
    const out = logged();
    expect(out).toContain('Summary:');
    expect(out).toContain('Added:');
    expect(out).toContain('Removed:');
    expect(out).toContain('Modified:');
    expect(out).toContain('+ added (added)');
    expect(out).toContain('- removed (removed)');
    expect(out).toContain('~ modified (modified)');
  });

  it('emits verbose nested modified values in text mode', async () => {
    const { fromPath, toPath } = setup(
      { services: { web: { port: 3000 } } },
      { services: { web: { port: 4000 } } }
    );
    await diffWorkspace({ from: fromPath, to: toPath, format: 'text', verbose: true });
    const out = logged();
    expect(out).toContain('3000');
    expect(out).toContain('4000');
  });

  it('renders "No changes detected." for identical configs in text mode', async () => {
    const cfg = { services: { web: { port: 3000 } } };
    const { fromPath, toPath } = setup(cfg, cfg);
    await diffWorkspace({ from: fromPath, to: toPath });
    expect(logged()).toContain('No changes detected.');
  });
});
