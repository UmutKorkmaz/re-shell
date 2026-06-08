import { afterEach, describe, expect, it } from 'vitest';

import {
  getRuntimeHubConfig,
  resolveHubToken,
  resolveHubBaseUrl,
  buildEventsUrl,
  buildJobsUrl,
} from './config';

// jsdom provides a `window`; clean any injected runtime global between tests so
// the env/default fallback paths still observe an absent global.
function clearRuntimeHubGlobal(): void {
  if (typeof window !== 'undefined') {
    delete window.__RE_SHELL_HUB__;
  }
}

// In the vitest/node env, import.meta.env is absent (or carries no VITE_* hub
// vars), so resolution falls back to explicit options and localhost defaults.
describe('hub config resolution', () => {
  afterEach(() => {
    clearRuntimeHubGlobal();
  });

  describe('getRuntimeHubConfig', () => {
    it('returns the injected runtime global when present', () => {
      window.__RE_SHELL_HUB__ = { url: 'http://runtime:7777', token: 'rt-token' };
      expect(getRuntimeHubConfig()).toEqual({ url: 'http://runtime:7777', token: 'rt-token' });
    });

    it('returns an empty object when the global is absent', () => {
      clearRuntimeHubGlobal();
      expect(getRuntimeHubConfig()).toEqual({});
    });

    it('ignores non-string url/token values defensively', () => {
      // Force a malformed global to verify we never surface a non-string value.
      window.__RE_SHELL_HUB__ = { url: 123, token: {} } as unknown as Window['__RE_SHELL_HUB__'];
      expect(getRuntimeHubConfig()).toEqual({ url: undefined, token: undefined });
    });
  });

  describe('resolveHubToken', () => {
    it('prefers an explicit token over the runtime global', () => {
      window.__RE_SHELL_HUB__ = { token: 'rt-token' };
      expect(resolveHubToken('explicit-token')).toBe('explicit-token');
    });

    it('uses the runtime global token when no explicit token is given', () => {
      window.__RE_SHELL_HUB__ = { token: 'rt-token' };
      expect(resolveHubToken()).toBe('rt-token');
    });

    it('returns undefined when no token is available', () => {
      expect(resolveHubToken()).toBeUndefined();
      expect(resolveHubToken('')).toBeUndefined();
    });
  });

  describe('resolveHubBaseUrl', () => {
    it('uses an explicit url and strips a trailing slash', () => {
      expect(resolveHubBaseUrl('http://localhost:9000/')).toBe('http://localhost:9000');
    });

    it('prefers an explicit url over the runtime global', () => {
      window.__RE_SHELL_HUB__ = { url: 'http://runtime:7777' };
      expect(resolveHubBaseUrl('http://explicit:9000')).toBe('http://explicit:9000');
    });

    it('uses the runtime global url when no explicit url is given', () => {
      window.__RE_SHELL_HUB__ = { url: 'http://runtime:7777/' };
      expect(resolveHubBaseUrl()).toBe('http://runtime:7777');
    });

    it('falls back to the localhost default', () => {
      expect(resolveHubBaseUrl()).toBe('http://127.0.0.1:3333');
    });
  });

  describe('buildEventsUrl', () => {
    it('encodes commandId and params as query string', () => {
      const url = buildEventsUrl('http://127.0.0.1:3333', 'workspace.summary', { cwd: '/repo' });
      const parsed = new URL(url);
      expect(parsed.pathname).toBe('/events');
      expect(parsed.searchParams.get('commandId')).toBe('workspace.summary');
      expect(parsed.searchParams.get('params')).toBe(JSON.stringify({ cwd: '/repo' }));
    });

    it('omits params when undefined', () => {
      const url = buildEventsUrl('http://127.0.0.1:3333', 'commands.list');
      const parsed = new URL(url);
      expect(parsed.searchParams.has('params')).toBe(false);
      expect(parsed.searchParams.get('commandId')).toBe('commands.list');
    });
  });

  describe('buildJobsUrl', () => {
    it('rewrites http -> ws and appends /jobs', () => {
      expect(buildJobsUrl('http://127.0.0.1:3333')).toBe('ws://127.0.0.1:3333/jobs');
    });

    it('rewrites https -> wss', () => {
      expect(buildJobsUrl('https://hub.example.com')).toBe('wss://hub.example.com/jobs');
    });

    it('handles a trailing slash on the base url', () => {
      expect(buildJobsUrl('http://127.0.0.1:3333/')).toBe('ws://127.0.0.1:3333/jobs');
    });
  });
});
