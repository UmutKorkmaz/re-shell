import { describe, expect, it } from 'vitest';
import {
  resolveCacheRoot,
  resolveCacheSecret,
  resolveRemoteCacheSettings,
  CACHE_SECRET_ENV,
  REMOTE_CACHE_ENV,
  REMOTE_CACHE_TOKEN_ENV,
} from '../../src/utils/cache-config';
import * as path from 'path';
import * as os from 'os';

describe('resolveCacheRoot', () => {
  it('returns workspace-local path when no override is given', () => {
    const root = resolveCacheRoot('/workspace/project');
    expect(root).toBe(path.join('/workspace/project', '.re-shell', 'cache'));
  });

  it('resolves an explicit override to an absolute path', () => {
    const root = resolveCacheRoot('/workspace/project', '/custom/cache');
    expect(root).toBe('/custom/cache');
  });
});

describe('resolveCacheSecret', () => {
  it('returns the explicit env var when set', () => {
    const src = { [CACHE_SECRET_ENV]: 'my-secret' };
    expect(resolveCacheSecret(src)).toBe('my-secret');
  });

  it('returns a deterministic default derived from homedir when env is unset', () => {
    const src: Record<string, string | undefined> = {};
    const s1 = resolveCacheSecret(src);
    const s2 = resolveCacheSecret(src);
    expect(s1).toBe(s2);
    expect(s1.length).toBeGreaterThan(0);
  });
});

describe('resolveRemoteCacheSettings — URL scheme validation', () => {
  it('returns undefined when REMOTE_CACHE_ENV is not set', () => {
    const src: Record<string, string | undefined> = {};
    expect(resolveRemoteCacheSettings(src)).toBeUndefined();
  });

  it('accepts an http:// URL', () => {
    const src = { [REMOTE_CACHE_ENV]: 'http://cache.example.com/v1' };
    const settings = resolveRemoteCacheSettings(src);
    expect(settings).toBeDefined();
    expect(settings!.baseUrl).toBe('http://cache.example.com/v1');
  });

  it('accepts an https:// URL', () => {
    const src = { [REMOTE_CACHE_ENV]: 'https://cache.example.com/v1' };
    const settings = resolveRemoteCacheSettings(src);
    expect(settings).toBeDefined();
    expect(settings!.baseUrl).toBe('https://cache.example.com/v1');
  });

  it('REJECTS a file:// URL with a clear scheme error', () => {
    const src = { [REMOTE_CACHE_ENV]: 'file:///tmp/cache' };
    expect(() => resolveRemoteCacheSettings(src)).toThrow(
      /scheme must be http or https/
    );
  });

  it('REJECTS a ftp:// URL', () => {
    const src = { [REMOTE_CACHE_ENV]: 'ftp://cache.example.com' };
    expect(() => resolveRemoteCacheSettings(src)).toThrow(
      /scheme must be http or https/
    );
  });

  it('REJECTS a javascript:// URL', () => {
    const src = { [REMOTE_CACHE_ENV]: 'javascript:alert(1)' };
    expect(() => resolveRemoteCacheSettings(src)).toThrow(
      /scheme must be http or https/
    );
  });

  it('REJECTS a completely invalid URL string', () => {
    const src = { [REMOTE_CACHE_ENV]: 'not a url at all' };
    expect(() => resolveRemoteCacheSettings(src)).toThrow(
      /RE_SHELL_REMOTE_CACHE/
    );
  });

  it('strips a trailing slash from the base URL', () => {
    const src = { [REMOTE_CACHE_ENV]: 'https://cache.example.com/v1/' };
    const settings = resolveRemoteCacheSettings(src);
    expect(settings!.baseUrl).toBe('https://cache.example.com/v1');
  });

  it('includes the bearer token when REMOTE_CACHE_TOKEN_ENV is set', () => {
    const src = {
      [REMOTE_CACHE_ENV]: 'https://cache.example.com',
      [REMOTE_CACHE_TOKEN_ENV]: 'tok-abc123',
    };
    const settings = resolveRemoteCacheSettings(src);
    expect(settings!.token).toBe('tok-abc123');
  });
});
