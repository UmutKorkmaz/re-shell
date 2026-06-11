import { describe, expect, it } from 'vitest';
import {
  generateRootAgents,
  generatePackageAgents,
  generateLlmsIndex,
  generateAllAgentsDocs,
  toAgentsDocFile,
  byteLength,
  ROOT_AGENTS_FILE,
  LLMS_INDEX_FILE,
  type AgentsWorkspaceInput,
} from '../../src/utils/agents-doc';
import { agentsDocFileSchema } from '@re-shell/contracts';

/** A small, fixed workspace surface used across the generator tests. */
function fixture(): AgentsWorkspaceInput {
  return {
    projectName: 'demo-monorepo',
    projectDescription: 'A demo workspace.',
    packageManager: 'pnpm',
    rootScripts: { build: 'pnpm -r build', test: 'pnpm -r test', lint: 'pnpm -r lint' },
    packages: [
      {
        name: '@demo/contracts',
        dir: 'packages/contracts',
        description: 'Shared wire contracts.',
        scripts: { build: 'tsc', test: 'vitest run' },
        internalDeps: [],
      },
      {
        name: '@demo/cli',
        dir: 'packages/cli',
        description: 'The CLI.',
        scripts: { build: 'tsc', test: 'vitest run', lint: 'eslint src' },
        internalDeps: ['@demo/contracts'],
      },
    ],
    contractsPath: 'packages/contracts/src/index.ts',
    commandGroups: ['agents', 'workspace'],
    doNotTouch: ['dist/', 'packages/cli/dist/'],
  };
}

describe('generateRootAgents', () => {
  it('includes overview, real commands, structure, contract location, and do-not-touch', () => {
    const md = generateRootAgents(fixture());
    expect(md).toContain('# AGENTS.md');
    expect(md).toContain('## Project overview');
    expect(md).toContain('## Commands');
    expect(md).toContain('`pnpm run build`');
    expect(md).toContain('`pnpm run test`');
    expect(md).toContain('`pnpm run lint`');
    expect(md).toContain('## Structure');
    expect(md).toContain('`@demo/cli`');
    expect(md).toContain('`packages/cli`');
    expect(md).toContain('## JSON contract');
    expect(md).toContain('packages/contracts/src/index.ts');
    expect(md).toContain('## Do not touch');
    expect(md).toContain('`dist/`');
  });

  it('renders internal dependency edges in the structure table', () => {
    const md = generateRootAgents(fixture());
    // @demo/cli depends on @demo/contracts
    expect(md).toMatch(/@demo\/cli[\s\S]*@demo\/contracts/);
  });

  it('is deterministic for the same input', () => {
    expect(generateRootAgents(fixture())).toBe(generateRootAgents(fixture()));
  });
});

describe('generatePackageAgents', () => {
  it("surfaces the package's own filtered commands and boundaries", () => {
    const ws = fixture();
    const md = generatePackageAgents(ws, ws.packages[1]);
    expect(md).toContain('# AGENTS.md — @demo/cli');
    expect(md).toContain('`pnpm --filter @demo/cli run build`');
    expect(md).toContain('`pnpm --filter @demo/cli run test`');
    expect(md).toContain('## Boundaries');
    expect(md).toContain('`@demo/contracts`');
  });

  it('states when a package has no internal deps', () => {
    const ws = fixture();
    const md = generatePackageAgents(ws, ws.packages[0]);
    expect(md).toContain('no internal workspace dependencies');
  });
});

describe('generateLlmsIndex', () => {
  it('produces a terse machine index of the workspace surface', () => {
    const txt = generateLlmsIndex(fixture());
    expect(txt).toContain('# demo-monorepo');
    expect(txt).toContain('## Packages');
    expect(txt).toContain('@demo/cli (packages/cli)');
    expect(txt).toContain('packages/cli/AGENTS.md');
    expect(txt).toContain('## Contract');
  });
});

describe('generateAllAgentsDocs', () => {
  it('emits root + one per package + index, in deterministic order', () => {
    const files = generateAllAgentsDocs(fixture());
    expect(files.map(f => f.path)).toEqual([
      ROOT_AGENTS_FILE,
      'packages/contracts/AGENTS.md',
      'packages/cli/AGENTS.md',
      LLMS_INDEX_FILE,
    ]);
    expect(files.map(f => f.kind)).toEqual(['root', 'package', 'package', 'index']);
  });

  it('summaries validate against the contract schema with correct byte counts', () => {
    for (const file of generateAllAgentsDocs(fixture())) {
      const summary = toAgentsDocFile(file);
      expect(agentsDocFileSchema.safeParse(summary).success).toBe(true);
      expect(summary.bytes).toBe(byteLength(file.content));
    }
  });
});
