import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { getWorkspaces } from '../../src/utils/monorepo';

// Mock monorepo discovery so policy evaluation is fully deterministic: we
// control exactly which workspaces exist and materialize matching package.json
// files + disk artifacts under a temp root.
vi.mock('../../src/utils/monorepo', () => ({
  getWorkspaces: vi.fn(),
  // type-only export in the real module; provided for shape completeness.
}));

const mockedGetWorkspaces = vi.mocked(getWorkspaces);

const {
  BUILTIN_PACKS,
  policyPackSchema,
  loadPolicyPack,
  resolvePolicyPack,
  evaluatePolicyPack,
} = await import('../../src/utils/policy-engine');

import type { PolicyPack } from '../../src/utils/policy-engine';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-policy-'));
  mockedGetWorkspaces.mockReset();
});

afterEach(async () => {
  await fs.remove(root);
});

/** Workspace descriptor the mocked getWorkspaces returns. */
const ws = (name: string, rel: string) => ({
  name,
  path: rel,
  type: 'package' as const,
  version: '1.0.0',
  dependencies: [] as string[],
});

/** Write <root>/<rel>/package.json with the given fields. */
async function writeWsPkg(rel: string, pkg: Record<string, unknown>): Promise<void> {
  const dir = path.join(root, rel);
  await fs.ensureDir(dir);
  await fs.writeJson(path.join(dir, 'package.json'), pkg);
}

/** Write <root>/package.json (the monorepo root manifest). */
async function writeRootPkg(pkg: Record<string, unknown>): Promise<void> {
  await fs.writeJson(path.join(root, 'package.json'), pkg);
}

/** Minimal valid pack with a single rule of the given shape. */
const pack = (name: string, rule: Record<string, unknown>): PolicyPack =>
  ({ name, rules: [rule] } as PolicyPack);

describe('BUILTIN_PACKS', () => {
  it('exposes the recommended and baseline packs', () => {
    expect(Object.keys(BUILTIN_PACKS).sort()).toEqual(['baseline', 'recommended']);
  });

  it('recommended has 4 rules with the expected ids/types/severities', () => {
    const r = BUILTIN_PACKS.recommended;
    expect(r.name).toBe('recommended');
    expect(r.description).toBeTruthy();
    expect(r.rules.map(x => x.id)).toEqual([
      'required-files-readme',
      'required-scripts-build-test',
      'naming-lowercase',
      'min-node-18',
    ]);
    const byType = Object.fromEntries(r.rules.map(x => [x.type, x]));
    expect(byType['required-files'].severity).toBe('warning');
    expect(byType['required-scripts'].severity).toBe('error');
    expect(byType['naming'].severity).toBe('error');
    expect(byType['min-node'].severity).toBe('warning');
  });

  it('baseline has 2 rules (build script + naming)', () => {
    const b = BUILTIN_PACKS.baseline;
    expect(b.name).toBe('baseline');
    expect(b.rules.map(x => x.type)).toEqual(['required-scripts', 'naming']);
  });

  it('both built-in packs validate against policyPackSchema', () => {
    expect(policyPackSchema.safeParse(BUILTIN_PACKS.recommended).success).toBe(true);
    expect(policyPackSchema.safeParse(BUILTIN_PACKS.baseline).success).toBe(true);
  });
});

describe('policyPackSchema', () => {
  it('rejects a pack with no rules', () => {
    expect(policyPackSchema.safeParse({ name: 'x', rules: [] }).success).toBe(false);
  });

  it('rejects a pack missing a name', () => {
    expect(policyPackSchema.safeParse({ rules: [{ id: 'a', type: 'naming', pattern: '^x$' }] }).success).toBe(false);
  });

  it('rejects an unknown rule type', () => {
    expect(
      policyPackSchema.safeParse({ name: 'x', rules: [{ id: 'a', type: 'bogus' }] }).success,
    ).toBe(false);
  });
});

describe('loadPolicyPack', () => {
  it('throws when the file does not exist', async () => {
    await expect(loadPolicyPack(path.join(root, 'missing.yaml'))).rejects.toThrow(
      /Policy pack not found/,
    );
  });

  it('loads and validates a YAML pack', async () => {
    const file = path.join(root, 'pack.yaml');
    await fs.writeFile(
      file,
      ['name: yaml-pack', 'description: d', 'rules:', '  - id: n', '    type: naming', '    pattern: ^a$'].join('\n'),
      'utf8',
    );
    const loaded = await loadPolicyPack(file);
    expect(loaded.name).toBe('yaml-pack');
    expect(loaded.rules[0]).toMatchObject({ id: 'n', type: 'naming', pattern: '^a$' });
  });

  it('loads a JSON pack (yaml.load parses JSON too)', async () => {
    const file = path.join(root, 'pack.json');
    await fs.writeJson(file, { name: 'json-pack', rules: [{ id: 'n', type: 'naming', pattern: '^b$' }] });
    const loaded = await loadPolicyPack(file);
    expect(loaded.name).toBe('json-pack');
  });

  it('applies the schema severity default (error) when omitted', async () => {
    const file = path.join(root, 'pack.yaml');
    await fs.writeFile(
      file,
      ['name: d', 'rules:', '  - id: n', '    type: naming', '    pattern: ^x$'].join('\n'),
      'utf8',
    );
    const loaded = await loadPolicyPack(file);
    expect((loaded.rules[0] as { severity: string }).severity).toBe('error');
  });

  it('applies the license rule default severity (warning)', async () => {
    const file = path.join(root, 'pack.yaml');
    await fs.writeFile(
      file,
      ['name: d', 'rules:', '  - id: l', '    type: license', '    allowed: [MIT]'].join('\n'),
      'utf8',
    );
    const loaded = await loadPolicyPack(file);
    expect((loaded.rules[0] as { severity: string }).severity).toBe('warning');
  });

  it('throws on an invalid pack (missing name)', async () => {
    const file = path.join(root, 'bad.yaml');
    await fs.writeFile(file, ['rules:', '  - id: n', '    type: naming', '    pattern: ^x$'].join('\n'), 'utf8');
    await expect(loadPolicyPack(file)).rejects.toThrow(/Invalid policy pack/);
  });
});

describe('resolvePolicyPack', () => {
  it('defaults to the recommended pack when no ref is given', async () => {
    expect(await resolvePolicyPack()).toBe(BUILTIN_PACKS.recommended);
  });

  it('resolves the recommended pack by name', async () => {
    expect(await resolvePolicyPack('recommended')).toBe(BUILTIN_PACKS.recommended);
  });

  it('resolves the baseline pack by name', async () => {
    expect(await resolvePolicyPack('baseline')).toBe(BUILTIN_PACKS.baseline);
  });

  it('treats an unknown name as a file path', async () => {
    const file = path.join(root, 'custom.yaml');
    await fs.writeFile(file, ['name: c', 'rules:', '  - id: n', '    type: naming', '    pattern: ^x$'].join('\n'), 'utf8');
    const resolved = await resolvePolicyPack(file);
    expect(resolved.name).toBe('c');
  });

  it('rethrows the missing-file error for an unknown path', async () => {
    await expect(resolvePolicyPack(path.join(root, 'nope.yaml'))).rejects.toThrow(/not found/);
  });
});

describe('evaluatePolicyPack', () => {
  it('scores 100 with zero failures when every rule passes', async () => {
    mockedGetWorkspaces.mockResolvedValue([ws('alpha', 'alpha')]);
    await writeRootPkg({ engines: { node: '>=20' } });
    await writeWsPkg('alpha', { name: 'alpha', license: 'MIT', scripts: { build: 'x', test: 'y' } });
    await fs.writeFile(path.join(root, 'alpha', 'README.md'), '# a', 'utf8');

    const result = await evaluatePolicyPack(BUILTIN_PACKS.recommended, root);
    expect(result.pack).toBe('recommended');
    expect(result.score).toBe(100);
    expect(result.failed).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(result.passed).toEqual([
      'required-files-readme',
      'required-scripts-build-test',
      'naming-lowercase',
      'min-node-18',
    ]);
  });

  describe('min-node rule', () => {
    const rule = { id: 'node', type: 'min-node', minNode: '18.0.0' };

    it('passes when root engines.node major >= required', async () => {
      mockedGetWorkspaces.mockResolvedValue([]);
      await writeRootPkg({ engines: { node: '>=20.0.0' } });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('node');
      expect(res.failed).toEqual([]);
    });

    it('fails when root engines.node is below the requirement', async () => {
      mockedGetWorkspaces.mockResolvedValue([]);
      await writeRootPkg({ engines: { node: '>=16.0.0' } });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).not.toContain('node');
      expect(res.failed[0].target).toBe('<root>');
      expect(res.failed[0].message).toMatch(/below required/);
    });

    it('fails when root package.json has no engines.node', async () => {
      mockedGetWorkspaces.mockResolvedValue([]);
      await writeRootPkg({});
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toMatch(/missing engines\.node/);
    });
  });

  describe('naming rule', () => {
    const rule = { id: 'name', type: 'naming', pattern: '^(@[a-z0-9-]+\\/)?[a-z0-9][a-z0-9.-]*$' };

    it('passes for a lowercase / scoped name', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('@scope/my-pkg', 'a'), ws('plain', 'b')]);
      await writeWsPkg('a', { name: '@scope/my-pkg' });
      await writeWsPkg('b', { name: 'plain' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('name');
    });

    it('fails for an uppercase / invalid name', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('BadName', 'a')]);
      await writeWsPkg('a', { name: 'BadName' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toMatch(/does not match pattern/);
      expect(res.passed).not.toContain('name');
    });
  });

  describe('required-files rule', () => {
    const rule = { id: 'rf', type: 'required-files', files: ['README.md'] };

    it('passes when the file exists in the workspace dir', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a' });
      await fs.writeFile(path.join(root, 'a', 'README.md'), '', 'utf8');
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('rf');
    });

    it('fails with a per-file message when the file is missing', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toBe('Missing required file: README.md');
    });
  });

  describe('required-scripts rule', () => {
    const rule = { id: 'rs', type: 'required-scripts', scripts: ['build', 'test'] };

    it('passes when all required scripts are defined', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', scripts: { build: 'b', test: 't' } });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('rs');
    });

    it('reports each missing script as a separate failure', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', scripts: {} });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed.map(f => f.message)).toEqual([
        'Missing required script: build',
        'Missing required script: test',
      ]);
    });
  });

  describe('dependency-constraints rule', () => {
    const rule = {
      id: 'dc',
      type: 'dependency-constraints',
      constraints: [{ dependency: 'react', range: '^18.0.0' }],
    };

    it('passes when the declared range matches exactly', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', dependencies: { react: '^18.0.0' } });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('dc');
    });

    it('is skipped (passes) when the dependency is absent', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', dependencies: {} });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('dc');
      expect(res.failed).toEqual([]);
    });

    it('fails when the declared range differs from the required one', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', devDependencies: { react: '^17.0.0' } });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toContain('is "^17.0.0"');
      expect(res.failed[0].message).toContain('requires "^18.0.0"');
    });
  });

  describe('license rule', () => {
    const rule = { id: 'lic', type: 'license', allowed: ['MIT', 'Apache-2.0'] };

    it('passes when the license is in the allowed list', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', license: 'Apache-2.0' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.passed).toContain('lic');
    });

    it('fails when the license is not allowed', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a', license: 'GPL-3.0' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toMatch(/License "GPL-3.0" not in allowed/);
    });

    it('fails with a missing-license message when license is absent', async () => {
      mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
      await writeWsPkg('a', { name: 'a' });
      const res = await evaluatePolicyPack(pack('p', rule), root);
      expect(res.failed[0].message).toMatch(/Missing license/);
    });
  });

  it('computes the score as the percentage of passing (rule x target) checks', async () => {
    // Two workspaces; naming rule fails for one, passes for the other -> 1/2 = 50%.
    mockedGetWorkspaces.mockResolvedValue([ws('good', 'g'), ws('Bad', 'b')]);
    await writeWsPkg('g', { name: 'good' });
    await writeWsPkg('b', { name: 'Bad' });
    const res = await evaluatePolicyPack(
      pack('p', { id: 'name', type: 'naming', pattern: '^[a-z]+$' }),
      root,
    );
    expect(res.score).toBe(50);
    expect(res.failed).toHaveLength(1);
    expect(res.passed).not.toContain('name'); // rule not fully passed
  });

  it('hasErrors is true only when an error-severity rule fails', async () => {
    mockedGetWorkspaces.mockResolvedValue([ws('a', 'a')]);
    await writeWsPkg('a', { name: 'a' });
    // warning-severity missing file -> failures exist but no errors.
    const warnRes = await evaluatePolicyPack(
      pack('p', { id: 'rf', type: 'required-files', severity: 'warning', files: ['NOPE.md'] }),
      root,
    );
    expect(warnRes.failed).toHaveLength(1);
    expect(warnRes.hasErrors).toBe(false);

    const errRes = await evaluatePolicyPack(
      pack('p', { id: 'rf', type: 'required-files', severity: 'error', files: ['NOPE.md'] }),
      root,
    );
    expect(errRes.hasErrors).toBe(true);
  });

  it('a rule appears in passed[] only when it passes for every workspace', async () => {
    mockedGetWorkspaces.mockResolvedValue([ws('a', 'a'), ws('b', 'b')]);
    await writeWsPkg('a', { name: 'a' });
    await writeWsPkg('b', { name: 'b' });
    const res = await evaluatePolicyPack(
      pack('p', { id: 'name', type: 'naming', pattern: '^[a-z]+$' }),
      root,
    );
    expect(res.passed).toContain('name');
    expect(res.score).toBe(100);
  });

  it('scores 100 when there are no evaluable targets (empty workspaces, non-min-node rule)', async () => {
    mockedGetWorkspaces.mockResolvedValue([]);
    const res = await evaluatePolicyPack(
      pack('p', { id: 'name', type: 'naming', pattern: '^x$' }),
      root,
    );
    expect(res.score).toBe(100);
    // With no workspaces, the rule is trivially "fully passed".
    expect(res.passed).toContain('name');
  });
});
