import { describe, it, expect } from 'vitest';

import {
  isHubRunnable,
  toHubRunRequest,
  buildEventsRequest,
  buildHealthRequest,
  HUB_RUN_ALLOWED_SUBCOMMANDS,
  type HubConfig,
} from '../../src/core/hub-client.js';
import type { CatalogEntry } from '../../src/core/catalog.js';

function entry(path: string): CatalogEntry {
  return {
    path,
    aliases: [],
    description: '',
    args: [],
    flags: [],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
  };
}

const config: HubConfig = { baseUrl: 'http://127.0.0.1:5179', token: 'secret-token' };

describe('isHubRunnable', () => {
  it('accepts allow-listed subcommands', () => {
    for (const path of HUB_RUN_ALLOWED_SUBCOMMANDS) {
      expect(isHubRunnable(entry(path))).toBe(true);
    }
  });

  it('rejects a non-allow-listed path', () => {
    expect(isHubRunnable(entry('create'))).toBe(false);
    expect(isHubRunnable(entry('workspace remove'))).toBe(false);
  });
});

describe('toHubRunRequest', () => {
  it('maps an allow-listed entry to the run commandId + subcommand param', () => {
    const result = toHubRunRequest(entry('workspace health'), '/repo');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.commandId).toBe('run');
    expect(result.params).toEqual({ subcommand: 'workspace health', cwd: '/repo' });
  });

  it('omits cwd when not provided', () => {
    const result = toHubRunRequest(entry('doctor'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params).toEqual({ subcommand: 'doctor' });
  });

  it('rejects an entry that is not on the allow-list', () => {
    const result = toHubRunRequest(entry('create'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not on the hub run allow-list/);
  });
});

describe('buildEventsRequest', () => {
  it('shapes the SSE request with token in header and query', () => {
    const req = buildEventsRequest(config, 'run', { subcommand: 'doctor' });
    expect(req.method).toBe('GET');
    const url = new URL(req.url);
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('commandId')).toBe('run');
    expect(JSON.parse(url.searchParams.get('params')!)).toEqual({ subcommand: 'doctor' });
    expect(url.searchParams.get('token')).toBe('secret-token');
    expect(req.headers['x-re-shell-ui-hub-token']).toBe('secret-token');
    expect(req.headers['Accept']).toBe('text/event-stream');
    expect(req.headers['Sec-Fetch-Mode']).toBe('cors');
  });

  it('normalizes a trailing slash on the base URL', () => {
    const req = buildEventsRequest({ ...config, baseUrl: 'http://127.0.0.1:5179/' }, 'run', {});
    expect(req.url.startsWith('http://127.0.0.1:5179/events')).toBe(true);
  });

  it('serializes params to JSON in the query (never raw)', () => {
    const req = buildEventsRequest(config, 'run', { subcommand: 'analyze', cwd: '/x' });
    const url = new URL(req.url);
    expect(url.searchParams.get('params')).toBe('{"subcommand":"analyze","cwd":"/x"}');
  });

  it('defaults params to an empty object when nullish', () => {
    const req = buildEventsRequest(config, 'doctor', undefined);
    const url = new URL(req.url);
    expect(url.searchParams.get('params')).toBe('{}');
  });
});

describe('buildHealthRequest', () => {
  it('targets /health with the token', () => {
    const req = buildHealthRequest(config);
    const url = new URL(req.url);
    expect(url.pathname).toBe('/health');
    expect(url.searchParams.get('token')).toBe('secret-token');
    expect(req.headers['x-re-shell-ui-hub-token']).toBe('secret-token');
  });
});
