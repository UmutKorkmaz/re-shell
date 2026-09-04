import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateInjectionCode,
  generateAutoWiringConfig,
  showInjectionRecommendations,
} from '../../src/utils/dependency-injection';

function makeGraph() {
  const nodes = new Map();
  nodes.set('user-service', {
    name: 'user-service',
    type: 'app' as const,
    path: '/srv/user-service',
    port: 3000,
    framework: 'express',
    language: 'typescript',
    exports: ['UserService'],
    imports: ['DatabaseService'],
    dependencies: ['database-service'],
  });
  nodes.set('database-service', {
    name: 'database-service',
    type: 'lib' as const,
    path: '/srv/database-service',
    framework: 'mongoose',
    language: 'typescript',
    exports: ['DatabaseService'],
    imports: [],
    dependencies: [],
  });

  const edges = new Map();
  edges.set('user-service', new Set(['database-service']));
  edges.set('database-service', new Set());

  const reverseEdges = new Map();
  reverseEdges.set('user-service', new Set());
  reverseEdges.set('database-service', new Set(['user-service']));

  return { nodes, edges, reverseEdges, cycles: [] };
}

const graph = makeGraph();

describe('generateInjectionCode', () => {
  it('generates injection code for a known service', async () => {
    const code = await generateInjectionCode('user-service', graph as any);
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });

  it('throws for unknown service', async () => {
    await expect(generateInjectionCode('nonexistent', graph as any)).rejects.toThrow(
      'not found in dependency graph'
    );
  });
});

describe('generateAutoWiringConfig', () => {
  it('writes auto-wiring JSON config to disk', async () => {
    const tmpDir = path.join(os.tmpdir(), `di-autowire-${Date.now()}`);
    const outputPath = path.join(tmpDir, 'autowiring.json');
    await generateAutoWiringConfig(graph as any, outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(json.version).toBe('1.0.0');
    expect(json.services).toBeDefined();
    expect(json.services['user-service']).toBeDefined();
    expect(json.services['database-service']).toBeDefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('showInjectionRecommendations', () => {
  it('logs recommendations without throwing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(showInjectionRecommendations(graph as any)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
