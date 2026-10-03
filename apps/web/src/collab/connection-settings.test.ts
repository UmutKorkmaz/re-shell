import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_CONNECTION,
  checkControlPlaneUrl,
  clearConnectionToken,
  loadConnectionSettings,
  parseIceOverride,
  saveConnectionSettings,
} from './connection-settings';

const META_KEY = 're-shell.dashboard.control-plane.v1';
const TOKEN_KEY = 're-shell.dashboard.control-plane.token.v1';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('connection settings storage', () => {
  it('defaults to an empty, disconnected configuration', () => {
    expect(loadConnectionSettings()).toEqual(DEFAULT_CONNECTION);
  });

  it('keeps the token in sessionStorage by default and never in localStorage', () => {
    saveConnectionSettings({ ...DEFAULT_CONNECTION, url: 'https://cp.example', tenant: 'acme', token: 'secret' });
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('secret');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(META_KEY)).not.toContain('secret');
    expect(loadConnectionSettings()).toMatchObject({ url: 'https://cp.example', tenant: 'acme', token: 'secret', rememberToken: false });
  });

  it('remembers the token on the device only when asked, and moves it between stores', () => {
    saveConnectionSettings({ ...DEFAULT_CONNECTION, url: 'https://cp.example', token: 'secret', rememberToken: true });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('secret');
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(loadConnectionSettings().token).toBe('secret');

    saveConnectionSettings({ ...DEFAULT_CONNECTION, url: 'https://cp.example', token: 'secret', rememberToken: false });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe('secret');
  });

  it('forgets the token everywhere', () => {
    saveConnectionSettings({ ...DEFAULT_CONNECTION, token: 'secret', rememberToken: true });
    clearConnectionToken();
    expect(loadConnectionSettings().token).toBe('');
  });

  it('survives corrupt stored data and unavailable storage', () => {
    window.localStorage.setItem(META_KEY, '{nope');
    expect(loadConnectionSettings()).toEqual(DEFAULT_CONNECTION);
    window.localStorage.setItem(META_KEY, JSON.stringify({ url: 5 }));
    expect(loadConnectionSettings()).toEqual(DEFAULT_CONNECTION);
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(loadConnectionSettings()).toEqual(DEFAULT_CONNECTION);
      expect(() => saveConnectionSettings({ ...DEFAULT_CONNECTION, url: 'https://x.example' })).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});

describe('checkControlPlaneUrl', () => {
  it('normalizes and validates', () => {
    expect(checkControlPlaneUrl(' https://cp.example.com/ ')).toEqual({ ok: true, url: 'https://cp.example.com' });
    expect(checkControlPlaneUrl('http://127.0.0.1:8787')).toEqual({ ok: true, url: 'http://127.0.0.1:8787' });
    expect(checkControlPlaneUrl('http://cp.example.com')).toMatchObject({ ok: true, warning: expect.stringMatching(/cleartext/) });
    expect(checkControlPlaneUrl('')).toMatchObject({ ok: false });
    expect(checkControlPlaneUrl('javascript:alert(1)')).toMatchObject({ ok: false });
    expect(checkControlPlaneUrl('https://u:p@x.example')).toMatchObject({ ok: false, message: expect.stringMatching(/token/) });
    expect(checkControlPlaneUrl('not a url')).toMatchObject({ ok: false });
  });
});

describe('parseIceOverride', () => {
  it('accepts empty (server configuration) and valid server lists', () => {
    expect(parseIceOverride('')).toEqual({ ok: true, servers: [] });
    expect(parseIceOverride('[{"urls":"stun:stun.example.org:3478"}]')).toEqual({
      ok: true,
      servers: [{ urls: 'stun:stun.example.org:3478' }],
    });
    expect(parseIceOverride('[{"urls":["turn:t.example.org"],"username":"u","credential":"c"}]')).toMatchObject({ ok: true });
  });

  it('rejects anything else', () => {
    expect(parseIceOverride('{')).toMatchObject({ ok: false });
    expect(parseIceOverride('{"urls":"stun:x"}')).toMatchObject({ ok: false });
    expect(parseIceOverride('[{"urls":"http://evil"}]')).toMatchObject({ ok: false, message: expect.stringMatching(/stun:/) });
    expect(parseIceOverride('[{"nope":1}]')).toMatchObject({ ok: false });
  });
});
