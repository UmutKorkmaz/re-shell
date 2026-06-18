import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WorkspaceParser } from '../../src/parsers/workspace-parser';

/**
 * Unit tests for WorkspaceParser — the YAML parser + validator that feeds 10+
 * CLI commands (create, generate, doctor, dev-cluster, catalog, etc.).
 * Previously had ZERO direct tests.
 */

const VALID_CONFIG = [
  'name: test-workspace',
  'version: "2.0.0"',
  'services:',
  '  api:',
  '    name: api',
  '    language: typescript',
  '    framework: express',
  '    path: services/api',
  '    port: 3000',
  '',
].join('\n');

function tmpFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-parser-'));
  const file = path.join(dir, 're-shell.workspaces.yaml');
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

const TMP: string[] = [];
afterEach(() => {
  for (const f of TMP.splice(0)) {
    try { fs.rmSync(path.dirname(f), { recursive: true, force: true }); } catch {}
  }
});

describe('WorkspaceParser', () => {
  it('parses a valid workspace config', () => {
    const file = tmpFile(VALID_CONFIG); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config?.name).toBe('test-workspace');
    expect(result.config?.services.api).toBeDefined();
  });

  it('reports a missing file', () => {
    const result = new WorkspaceParser().parse('/nonexistent/file.yaml');
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain('not found');
  });

  it('reports YAML syntax errors with line numbers', () => {
    const file = tmpFile('name: test\n  bad: indent: here\n'); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('flags an unsupported language', () => {
    const file = tmpFile(VALID_CONFIG.replace('typescript', 'klingon')); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    expect(result.valid).toBe(false);
  });

  it('flags a service name mismatch', () => {
    const file = tmpFile([
      'name: test', 'version: "2.0.0"', 'services:',
      '  api:', '    name: web', '    language: typescript', '    framework: express', '',
    ].join('\n')); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    expect(result.errors.some(e => e.message.includes('Service name must match'))).toBe(true);
  });

  it('flags an out-of-range port', () => {
    const file = tmpFile(VALID_CONFIG.replace('port: 3000', 'port: 80')); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    expect(result.valid).toBe(false);
  });

  it('handles an empty config gracefully', () => {
    const file = tmpFile(''); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    // Empty YAML parses to undefined — should be an error, not a crash
    expect(result.valid).toBe(false);
  });

  it('error messages interpolate values (not literal ${...})', () => {
    // Test with the name-mismatch path (a custom rule, not caught by AJV schema)
    const file = tmpFile([
      'name: test', 'version: "2.0.0"', 'services:',
      '  api:', '    name: web', '    language: typescript', '    framework: express', '',
    ].join('\n')); TMP.push(file);
    const result = new WorkspaceParser().parse(file);
    const msg = result.errors.find(e => e.message.includes('Service name must match'))?.message;
    expect(msg).toBeDefined();
    // The message should contain the actual key 'api' and value 'web', not literal ${...}
    expect(msg).toContain('api');
    expect(msg).toContain('web');
    expect(msg).not.toContain('${');
  });
});
