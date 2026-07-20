import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateEvolutionConfig,
  checkCompatibility,
  generateTypeScriptEvolution,
  generatePythonEvolution,
  generateGoEvolution,
  writeEvolutionFiles,
  displayEvolutionConfig,
  type EvolutionConfig,
} from '../../src/utils/schema-evolution';

const config: EvolutionConfig = {
  serviceName: 'orders-service',
  schemaType: 'avro',
  enableAutoMigration: true,
  requireCompatibility: true,
  breakingChangePolicy: 'warn',
};

describe('generateEvolutionConfig', () => {
  it('returns default config with the given service name', async () => {
    const cfg = await generateEvolutionConfig('payments');
    expect(cfg.serviceName).toBe('payments');
    expect(cfg.schemaType).toBe('avro');
    expect(cfg.enableAutoMigration).toBe(true);
    expect(cfg.requireCompatibility).toBe(true);
    expect(cfg.breakingChangePolicy).toBe('warn');
  });

  it('accepts an explicit schema type', async () => {
    expect((await generateEvolutionConfig('orders', 'protobuf')).schemaType).toBe('protobuf');
  });
});

describe('checkCompatibility', () => {
  const baseSchema = {
    version: '1.0.0',
    schema: {},
    type: 'avro' as const,
    createdAt: new Date(),
    breakingChanges: [],
    migrations: [],
  };

  it('returns full when both forward and backward compatible without breaking changes', () => {
    expect(
      checkCompatibility(baseSchema, {
        ...baseSchema,
        version: '1.1.0',
        compatibleFrom: ['1.0.0'],
        compatibleTo: ['1.0.0'],
      })
    ).toBe('full');
  });

  it('returns none when breaking changes are present', () => {
    expect(
      checkCompatibility(baseSchema, {
        ...baseSchema,
        version: '2.0.0',
        breakingChanges: ['field removed'],
      })
    ).toBe('none');
  });
});

describe('generateTypeScriptEvolution', () => {
  it('produces files referencing the service name', async () => {
    const result = await generateTypeScriptEvolution(config);
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map(f => f.content).join('\n');
    expect(allContent).toContain('orders-service');
  });
});

describe('generatePythonEvolution', () => {
  it('produces files referencing the service name', async () => {
    const result = await generatePythonEvolution(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.map(f => f.content).join('\n')).toContain('orders-service');
  });
});

describe('generateGoEvolution', () => {
  it('produces files referencing the service name', async () => {
    const result = await generateGoEvolution(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.map(f => f.content).join('\n')).toContain('orders-service');
  });
});

describe('writeEvolutionFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes integration files and BUILD.md', async () => {
    const integration = {
      files: [
        { path: 'main.ts', content: '// hello' },
        { path: 'nested/util.ts', content: '// util' },
      ],
      dependencies: [],
    };
    await writeEvolutionFiles('demo', integration, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'main.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'nested/util.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'BUILD.md'))).toBe(true);
  });
});

describe('displayEvolutionConfig', () => {
  it('logs without throwing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await displayEvolutionConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
