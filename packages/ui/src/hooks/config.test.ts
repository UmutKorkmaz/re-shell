import { describe, expect, it } from 'vitest';

import {
  resolveHubToken,
  resolveHubBaseUrl,
  buildEventsUrl,
  buildJobsUrl,
} from './config';

// In the vitest/node env, import.meta.env is absent (or carries no VITE_* hub
// vars), so resolution falls back to explicit options and localhost defaults.
describe('hub config resolution', () => {
  describe('resolveHubToken', () => {
    it('prefers an explicit token', () => {
      expect(resolveHubToken('explicit-token')).toBe('explicit-token');
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
