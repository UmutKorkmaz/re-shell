import { describe, expect, it } from 'vitest';

import {
  REGISTERED_COMMAND_IDS,
  isRegisteredCommandId,
  resolveCommand,
  toCommandSpec,
} from './command-registry';

describe('command-registry', () => {
  it('exposes the full allow-list of command ids', () => {
    expect(REGISTERED_COMMAND_IDS).toEqual([
      'workspace.summary',
      'workspace.graph',
      'workspace.health',
      'templates.list',
      'templates.show',
      'commands.list',
      'doctor',
      'analyze',
      'run',
    ]);
  });

  describe('isRegisteredCommandId', () => {
    it('accepts registered ids and rejects unknown ones', () => {
      expect(isRegisteredCommandId('doctor')).toBe(true);
      expect(isRegisteredCommandId('workspace.summary')).toBe(true);
      expect(isRegisteredCommandId('rm -rf')).toBe(false);
      expect(isRegisteredCommandId('')).toBe(false);
    });
  });

  describe('resolveCommand', () => {
    it('rejects a non-string commandId without spawning', () => {
      const result = resolveCommand(123, {});
      expect(result).toEqual({ ok: false, error: 'commandId must be a string' });
    });

    it('rejects an unknown commandId and lists the allow-list', () => {
      const result = resolveCommand('nope', {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Unknown commandId "nope"');
        expect(result.error).toContain('doctor');
      }
    });

    it('builds fixed argv for a no-param command', () => {
      const result = resolveCommand('workspace.summary', undefined);
      expect(result).toEqual({
        ok: true,
        commandId: 'workspace.summary',
        args: ['workspace', 'summary', '--json'],
        cwd: undefined,
      });
    });

    it('builds fixed argv for every no-param workspace/commands entry', () => {
      const cases: Array<[string, string[]]> = [
        ['workspace.graph', ['workspace', 'graph', '--json']],
        ['workspace.health', ['workspace', 'health', '--json']],
        ['commands.list', ['commands', 'list', '--json']],
      ];
      for (const [id, args] of cases) {
        const result = resolveCommand(id, {});
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.args).toEqual(args);
        }
      }
    });

    it('carries cwd separately and never into argv', () => {
      const result = resolveCommand('doctor', { cwd: '/repo' });
      expect(result).toEqual({
        ok: true,
        commandId: 'doctor',
        args: ['doctor', '--json'],
        cwd: '/repo',
      });
    });

    it('appends validated filter flags for templates.list', () => {
      const result = resolveCommand('templates.list', { language: 'python', framework: 'fastapi' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.args).toEqual([
          'templates',
          'list',
          '--json',
          '--language',
          'python',
          '--framework',
          'fastapi',
        ]);
      }
    });

    it('treats an injection string as a single literal argv token', () => {
      const result = resolveCommand('templates.list', { language: 'a; rm -rf ~' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.args).toContain('a; rm -rf ~');
      }
    });

    it('rejects a templates.show id with an unsafe charset', () => {
      const result = resolveCommand('templates.show', { id: 'bad id; rm' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Invalid params for "templates.show"');
      }
    });

    it('accepts a safe templates.show id', () => {
      const result = resolveCommand('templates.show', { id: 'fast-api.v2_1' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.args).toEqual(['templates', 'show', 'fast-api.v2_1', '--json']);
      }
    });

    it('appends the analyze type flag when valid', () => {
      const result = resolveCommand('analyze', { type: 'security' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.args).toEqual(['analyze', '--json', '--type', 'security']);
      }
    });

    it('rejects an invalid analyze type', () => {
      const result = resolveCommand('analyze', { type: 'malware' });
      expect(result.ok).toBe(false);
    });

    it('resolves the vetted run subcommand into argv', () => {
      const result = resolveCommand('run', { subcommand: 'workspace health' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.args).toEqual(['workspace', 'health', '--json']);
      }
    });

    it('rejects a run subcommand outside the allow-list', () => {
      const result = resolveCommand('run', { subcommand: 'workspace destroy' });
      expect(result.ok).toBe(false);
    });

    it('rejects unknown extra params (strict schema)', () => {
      const result = resolveCommand('doctor', { sneaky: true });
      expect(result.ok).toBe(false);
    });
  });

  describe('toCommandSpec', () => {
    it('echoes a vetted command back as a CommandSpec', () => {
      const spec = toCommandSpec(
        'analyze',
        ['node', '/abs/index.js'],
        ['analyze', '--json'],
        '/repo'
      );
      expect(spec).toEqual({
        id: 'analyze',
        title: 'Analyze',
        description: 'Analyze bundles, dependencies, performance, and security.',
        command: ['node', '/abs/index.js', 'analyze', '--json'],
        cwd: '/repo',
        dryRunSupported: false,
        destructive: false,
        requiresConfirmation: false,
      });
    });
  });
});
