import { describe, it, expect } from 'vitest';

import {
  DEFAULT_CLI_BIN,
  DEFAULT_HUB_TIMEOUT_MS,
  DEFAULT_HUB_URL,
  resolveCliBinSetting,
  resolveHubConfig,
} from '../../src/core/settings.js';

describe('resolveCliBinSetting', () => {
  it('prefers an explicitly configured value over the environment', () => {
    expect(resolveCliBinSetting('/custom/re-shell', { RE_SHELL_CLI_BIN: '/env/re-shell' })).toBe(
      '/custom/re-shell'
    );
  });

  it('falls back to RE_SHELL_CLI_BIN when the setting is the default', () => {
    expect(resolveCliBinSetting(DEFAULT_CLI_BIN, { RE_SHELL_CLI_BIN: '/env/cli/index.js' })).toBe(
      '/env/cli/index.js'
    );
    expect(resolveCliBinSetting(undefined, { RE_SHELL_CLI_BIN: '/env/cli/index.js' })).toBe(
      '/env/cli/index.js'
    );
    expect(resolveCliBinSetting('   ', { RE_SHELL_CLI_BIN: '/env/cli/index.js' })).toBe(
      '/env/cli/index.js'
    );
  });

  it('uses the default when neither is set', () => {
    expect(resolveCliBinSetting(undefined, {})).toBe(DEFAULT_CLI_BIN);
    expect(resolveCliBinSetting(DEFAULT_CLI_BIN, { RE_SHELL_CLI_BIN: '' })).toBe(DEFAULT_CLI_BIN);
  });
});

describe('resolveHubConfig', () => {
  it('fails explicitly when no token is available', () => {
    const result = resolveHubConfig({ url: DEFAULT_HUB_URL, token: '' }, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/No hub token configured/);
    expect(result.error).toMatch(/RE_SHELL_UI_HUB_TOKEN/);
  });

  it('reads the token from the setting, then the environment', () => {
    const fromSetting = resolveHubConfig({ token: 'cfg-token' }, { RE_SHELL_UI_HUB_TOKEN: 'env-token' });
    expect(fromSetting.ok && fromSetting.config.token).toBe('cfg-token');

    const fromEnv = resolveHubConfig({ token: '' }, { RE_SHELL_UI_HUB_TOKEN: 'env-token' });
    expect(fromEnv.ok && fromEnv.config.token).toBe('env-token');
  });

  it('uses the default URL and timeout when unset', () => {
    const result = resolveHubConfig({ token: 't' }, {});
    expect(result).toEqual({
      ok: true,
      config: { baseUrl: 'http://127.0.0.1:3334', token: 't' },
      timeoutMs: DEFAULT_HUB_TIMEOUT_MS,
    });
  });

  it('prefers a configured URL, falls back to RE_SHELL_UI_HUB_URL when default', () => {
    const configured = resolveHubConfig(
      { url: 'http://127.0.0.1:4000', token: 't' },
      { RE_SHELL_UI_HUB_URL: 'http://127.0.0.1:9' }
    );
    expect(configured.ok && configured.config.baseUrl).toBe('http://127.0.0.1:4000');

    const fromEnv = resolveHubConfig(
      { url: DEFAULT_HUB_URL, token: 't' },
      { RE_SHELL_UI_HUB_URL: 'http://localhost:3334/' }
    );
    expect(fromEnv.ok && fromEnv.config.baseUrl).toBe('http://localhost:3334');
  });

  it('rejects malformed and non-http URLs', () => {
    const bad = resolveHubConfig({ url: 'not a url', token: 't' }, {});
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/not a valid URL/);

    const ftp = resolveHubConfig({ url: 'ftp://127.0.0.1:21', token: 't' }, {});
    expect(ftp.ok).toBe(false);
    if (!ftp.ok) expect(ftp.error).toMatch(/http or https/);
  });

  it('refuses to send the token to a non-loopback host', () => {
    for (const url of ['http://example.com:5179', 'http://192.168.1.10:5179', 'http://0.0.0.0:5179']) {
      const result = resolveHubConfig({ url, token: 'secret' }, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/not a loopback address/);
        expect(result.error).not.toContain('secret');
      }
    }
  });

  it('accepts every loopback spelling', () => {
    for (const url of ['http://127.0.0.1:1', 'http://localhost:1', 'http://[::1]:1']) {
      expect(resolveHubConfig({ url, token: 't' }, {}).ok).toBe(true);
    }
  });

  it('honours a sane timeout and ignores nonsense', () => {
    const ok = resolveHubConfig({ token: 't', timeoutMs: 5000 }, {});
    expect(ok.ok && ok.timeoutMs).toBe(5000);
    for (const timeoutMs of [0, 10, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolveHubConfig({ token: 't', timeoutMs }, {});
      expect(result.ok && result.timeoutMs).toBe(DEFAULT_HUB_TIMEOUT_MS);
    }
  });
});
