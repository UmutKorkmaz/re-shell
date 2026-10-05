import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_TIMEOUT_MS,
  describeAiConfig,
  isAiConfigKey,
  parseConfigValue,
  readPersistedAiConfig,
  redactUrl,
  resolveAiConfig,
  scrubSecrets,
  writePersistedAiConfig,
} from '../../../src/ai/config';
import { tmpDir } from './helpers';

const SECRET = 'sk-ant-api03-SUPERSECRETVALUE-1234567890';

describe('resolveAiConfig: provider selection', () => {
  it('defaults to the offline parser when nothing is configured', () => {
    const c = resolveAiConfig({}, {});
    expect(c.provider).toBe('offline');
    expect(c.sources.provider).toBe('auto');
    expect(c.apiKey).toBeUndefined();
    expect(c.cache).toBe(true);
  });

  it('auto-selects Anthropic when ANTHROPIC_API_KEY is present', () => {
    const c = resolveAiConfig({ ANTHROPIC_API_KEY: SECRET }, {});
    expect(c.provider).toBe('anthropic');
    expect(c.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(c.apiKey).toBe(SECRET);
    expect(c.sources).toMatchObject({ provider: 'auto', apiKey: 'env', model: 'default' });
    expect(c.timeoutMs).toBe(DEFAULT_TIMEOUT_MS.anthropic);
  });

  it('auto-selects the local OpenAI-compatible provider when a base URL is set, ahead of an Anthropic key', () => {
    const c = resolveAiConfig(
      { RE_SHELL_AI_BASE_URL: 'http://localhost:11434', ANTHROPIC_API_KEY: SECRET, RE_SHELL_AI_MODEL: 'llama3.1:8b' },
      {}
    );
    expect(c.provider).toBe('openai-compatible');
    expect(c.baseUrl).toBe('http://localhost:11434');
    expect(c.model).toBe('llama3.1:8b');
    expect(c.timeoutMs).toBe(DEFAULT_TIMEOUT_MS['openai-compatible']);
  });

  it('honours an explicit provider, from env or persisted config', () => {
    expect(resolveAiConfig({ RE_SHELL_AI_PROVIDER: 'offline', ANTHROPIC_API_KEY: SECRET }, {}).provider).toBe('offline');
    expect(resolveAiConfig({}, { provider: 'anthropic' }).provider).toBe('anthropic');
    expect(resolveAiConfig({ RE_SHELL_AI_PROVIDER: 'ANTHROPIC' }, {}).provider).toBe('anthropic');
    expect(resolveAiConfig({ RE_SHELL_AI_PROVIDER: 'auto', ANTHROPIC_API_KEY: SECRET }, {}).provider).toBe('anthropic');
    expect(resolveAiConfig({ RE_SHELL_AI_PROVIDER: 'nonsense' }, {}).provider).toBe('offline');
  });

  it('applies precedence: override > env > persisted > default', () => {
    const persisted = { provider: 'anthropic' as const, model: 'persisted-model' };
    expect(resolveAiConfig({}, persisted).model).toBe('persisted-model');
    expect(resolveAiConfig({ RE_SHELL_AI_MODEL: 'env-model' }, persisted).model).toBe('env-model');
    expect(resolveAiConfig({ RE_SHELL_AI_MODEL: 'env-model' }, persisted, { model: 'flag-model' }).model).toBe('flag-model');
    expect(resolveAiConfig({}, persisted, { provider: 'offline' }).provider).toBe('offline');
    expect(resolveAiConfig({ RE_SHELL_AI_MODEL: 'env-model' }, persisted).sources.model).toBe('env');
  });

  it('clamps and parses the timeout', () => {
    expect(resolveAiConfig({ RE_SHELL_AI_TIMEOUT_MS: '5000' }, {}).timeoutMs).toBe(5000);
    expect(resolveAiConfig({ RE_SHELL_AI_TIMEOUT_MS: '1' }, {}).timeoutMs).toBe(500);
    expect(resolveAiConfig({ RE_SHELL_AI_TIMEOUT_MS: 'abc' }, {}).timeoutMs).toBe(DEFAULT_TIMEOUT_MS.offline);
    expect(resolveAiConfig({}, { timeoutMs: 9_999_999 }).timeoutMs).toBe(600_000);
  });

  it('reads cache settings', () => {
    expect(resolveAiConfig({}, { cache: false }).cache).toBe(false);
    expect(resolveAiConfig({}, { cache: false }, { cache: true }).cache).toBe(true);
    expect(resolveAiConfig({}, { cacheTtlSeconds: 60 }).cacheTtlSeconds).toBe(60);
  });
});

describe('resolveAiConfig: API keys never cross providers', () => {
  it('does not send ANTHROPIC_API_KEY to an OpenAI-compatible server', () => {
    const c = resolveAiConfig(
      { RE_SHELL_AI_PROVIDER: 'openai-compatible', RE_SHELL_AI_BASE_URL: 'http://localhost:1234', ANTHROPIC_API_KEY: SECRET },
      {}
    );
    expect(c.provider).toBe('openai-compatible');
    expect(c.apiKey).toBeUndefined();
    expect(c.sources.apiKey).toBe('unset');
  });

  it('uses RE_SHELL_AI_API_KEY for the OpenAI-compatible provider', () => {
    const c = resolveAiConfig(
      { RE_SHELL_AI_PROVIDER: 'openai-compatible', RE_SHELL_AI_BASE_URL: 'http://localhost:1234', RE_SHELL_AI_API_KEY: 'local-key-123' },
      {}
    );
    expect(c.apiKey).toBe('local-key-123');
  });

  it('prefers ANTHROPIC_API_KEY, then RE_SHELL_AI_API_KEY, then the persisted key for Anthropic', () => {
    const persisted = { provider: 'anthropic' as const, apiKey: 'persisted-key-xyz' };
    expect(resolveAiConfig({ ANTHROPIC_API_KEY: 'a'.repeat(12), RE_SHELL_AI_API_KEY: 'b'.repeat(12) }, persisted).apiKey).toBe('a'.repeat(12));
    expect(resolveAiConfig({ RE_SHELL_AI_API_KEY: 'b'.repeat(12) }, persisted).apiKey).toBe('b'.repeat(12));
    const c = resolveAiConfig({}, persisted);
    expect(c.apiKey).toBe('persisted-key-xyz');
    expect(c.sources.apiKey).toBe('config');
  });

  it('applies a base URL to Anthropic only when the provider was chosen explicitly', () => {
    expect(resolveAiConfig({ ANTHROPIC_API_KEY: SECRET, RE_SHELL_AI_PROVIDER: 'anthropic', RE_SHELL_AI_BASE_URL: 'https://gw.example.com' }, {}).baseUrl).toBe('https://gw.example.com');
    expect(resolveAiConfig({ RE_SHELL_AI_PROVIDER: 'offline', RE_SHELL_AI_BASE_URL: 'http://x' }, {}).baseUrl).toBeUndefined();
  });
});

describe('secrets are never printed', () => {
  it('describeAiConfig reduces the key to {set, source}', () => {
    const view = describeAiConfig(resolveAiConfig({ ANTHROPIC_API_KEY: SECRET }, {}));
    expect(view.apiKey).toEqual({ set: true, source: 'env' });
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(JSON.stringify(view)).not.toContain('SUPERSECRET');
  });

  it('redacts credentials embedded in a base URL', () => {
    const view = describeAiConfig(
      resolveAiConfig({ RE_SHELL_AI_BASE_URL: 'http://user:hunter2@localhost:11434' }, {})
    );
    expect(view.baseUrl).toBe('http://localhost:11434');
    expect(JSON.stringify(view)).not.toContain('hunter2');
    expect(redactUrl('not a url')).toBe('<invalid-url>');
    expect(redactUrl(undefined)).toBeUndefined();
  });

  it('scrubSecrets removes known secrets and key-shaped strings', () => {
    expect(scrubSecrets(`bad key ${SECRET} here`, [SECRET])).toBe('bad key [redacted] here');
    expect(scrubSecrets('leaked sk-ant-api03-ABCDEFGH12345678 elsewhere', [])).toContain('[redacted]');
    expect(scrubSecrets('short', ['abc'])).toBe('short');
  });
});

describe('parseConfigValue', () => {
  it.each([
    ['provider', 'Anthropic', 'anthropic'],
    ['provider', 'auto', 'auto'],
    ['provider', 'openai-compatible', 'openai-compatible'],
    ['model', 'claude-opus-5-5', 'claude-opus-5-5'],
    ['model', 'llama3.1:8b', 'llama3.1:8b'],
    ['baseUrl', 'http://localhost:11434/v1/', 'http://localhost:11434/v1'],
    ['timeoutMs', '15000', 15000],
    ['cache', 'off', false],
    ['cache', 'TRUE', true],
    ['cacheTtlSeconds', '3600', 3600],
    ['apiKey', 'sk-test-abcdefgh', 'sk-test-abcdefgh'],
  ] as const)('accepts %s=%s', (key, raw, expected) => {
    expect(parseConfigValue(key, raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['provider', 'gpt'],
    ['model', 'has spaces'],
    ['model', ''],
    ['baseUrl', 'ftp://x'],
    ['baseUrl', 'nope'],
    ['timeoutMs', '10'],
    ['timeoutMs', 'abc'],
    ['timeoutMs', '1.5'],
    ['cache', 'maybe'],
    ['cacheTtlSeconds', '0'],
    ['apiKey', 'short'],
    ['apiKey', 'has white space in it'],
  ] as const)('rejects %s=%j', (key, raw) => {
    expect(parseConfigValue(key, raw).ok).toBe(false);
  });

  it('knows its keys', () => {
    expect(isAiConfigKey('provider')).toBe(true);
    expect(isAiConfigKey('password')).toBe(false);
  });
});

describe('persisted config (the ai: section of the global config)', () => {
  it('round-trips values and preserves every other key in the file', () => {
    const t = tmpDir();
    try {
      const file = path.join(t.dir, 'config.yaml');
      fs.writeFileSync(file, yaml.stringify({ version: '1.0.0', packageManager: 'pnpm', cli: { telemetry: false } }));
      writePersistedAiConfig({ provider: 'anthropic', model: 'claude-opus-5-5', timeoutMs: 12000, cache: false }, file);
      const doc = yaml.parse(fs.readFileSync(file, 'utf8'));
      expect(doc.version).toBe('1.0.0');
      expect(doc.cli).toEqual({ telemetry: false });
      expect(doc.ai).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5', timeoutMs: 12000, cache: false });
      expect(readPersistedAiConfig(file)).toEqual(doc.ai);
    } finally {
      t.cleanup();
    }
  });

  it('removes keys (null) and drops the whole section when empty', () => {
    const t = tmpDir();
    try {
      const file = path.join(t.dir, 'config.yaml');
      writePersistedAiConfig({ provider: 'offline', model: 'x-model' }, file, { version: '1.0.0' });
      writePersistedAiConfig({ model: null }, file);
      expect(readPersistedAiConfig(file)).toEqual({ provider: 'offline' });
      writePersistedAiConfig({ provider: null }, file);
      expect('ai' in yaml.parse(fs.readFileSync(file, 'utf8'))).toBe(false);
    } finally {
      t.cleanup();
    }
  });

  it('seeds a missing file so other commands that validate the global config keep working', () => {
    const t = tmpDir();
    try {
      const file = path.join(t.dir, 'nested', 'config.yaml');
      writePersistedAiConfig({ provider: 'offline' }, file, { version: '1.0.0', packageManager: 'pnpm' });
      const doc = yaml.parse(fs.readFileSync(file, 'utf8'));
      expect(doc.version).toBe('1.0.0');
      expect(doc.packageManager).toBe('pnpm');
      expect(doc.ai.provider).toBe('offline');
    } finally {
      t.cleanup();
    }
  });

  it('stores an API key in an owner-only file', () => {
    const t = tmpDir();
    try {
      const file = path.join(t.dir, 'config.yaml');
      fs.writeFileSync(file, 'version: 1.0.0\n', { mode: 0o644 });
      writePersistedAiConfig({ apiKey: SECRET }, file);
      if (process.platform !== 'win32') {
        expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      }
      expect(readPersistedAiConfig(file).apiKey).toBe(SECRET);
    } finally {
      t.cleanup();
    }
  });

  it('drops unknown keys and wrongly-typed values instead of trusting them', () => {
    const t = tmpDir();
    try {
      const file = path.join(t.dir, 'config.yaml');
      fs.writeFileSync(
        file,
        yaml.stringify({ ai: { provider: 'gpt', model: 5, baseUrl: ['x'], timeoutMs: '9', cache: 'yes', extra: 'zzz', apiKey: 'k'.repeat(10) } })
      );
      expect(readPersistedAiConfig(file)).toEqual({ apiKey: 'k'.repeat(10) });
    } finally {
      t.cleanup();
    }
  });

  it('treats a missing or unreadable file as empty config', () => {
    const t = tmpDir();
    try {
      expect(readPersistedAiConfig(path.join(t.dir, 'nope.yaml'))).toEqual({});
      const bad = path.join(t.dir, 'bad.yaml');
      fs.writeFileSync(bad, '::: not yaml :::\n\t- [');
      expect(readPersistedAiConfig(bad)).toEqual({});
      // ...but a write never overwrites a config it cannot parse.
      const before = fs.readFileSync(bad, 'utf8');
      expect(() => writePersistedAiConfig({ provider: 'offline' }, bad)).toThrow(/not valid YAML/);
      expect(fs.readFileSync(bad, 'utf8')).toBe(before);
    } finally {
      t.cleanup();
    }
  });
});
