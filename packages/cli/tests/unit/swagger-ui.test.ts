import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateSwaggerUIHTML,
  createSwaggerUI,
  generateSwaggerUI,
  getThemePresets,
  detectServices,
  formatSwaggerUIConfig,
} from '../../src/utils/swagger-ui';

const config = {
  title: 'My API Docs',
  description: 'Unified API documentation',
  services: [
    { name: 'orders', url: 'https://api.example.com/orders/openapi.json', description: 'Orders service', version: 'v1' },
    { name: 'payments', url: 'https://api.example.com/payments/openapi.json', description: 'Payments service', version: 'v2' },
  ],
  defaultService: 'orders',
  tryItOutEnabled: true,
  persistAuthorization: true,
  filter: true,
  docExpansion: 'list' as const,
  syntaxHighlight: true,
  syntaxHighlightTheme: 'monokai' as const,
};

describe('generateSwaggerUIHTML', () => {
  it('embeds title and service URLs', () => {
    const html = generateSwaggerUIHTML(config);
    expect(html).toContain('My API Docs');
    expect(html).toContain('https://api.example.com/orders/openapi.json');
  });

  it('emits an HTML document', () => {
    expect(generateSwaggerUIHTML(config)).toMatch(/<!DOCTYPE html>|<html/i);
  });
});

describe('getThemePresets', () => {
  it('returns named theme presets with hex colors', () => {
    const presets = getThemePresets();
    expect(Object.keys(presets).length).toBeGreaterThan(0);
    for (const key of Object.keys(presets)) {
      expect(presets[key].color).toMatch(/^#/);
      expect(typeof presets[key].name).toBe('string');
    }
  });
});

describe('createSwaggerUI', () => {
  it('instantiates a generator bound to the output path', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-'));
    try {
      const gen = await createSwaggerUI(path.join(tmp, 'index.html'), config);
      expect(gen).toBeDefined();
    } finally {
      await fs.remove(tmp);
    }
  });
});

describe('generateSwaggerUI', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes the generated HTML to disk', async () => {
    const out = path.join(tmpDir, 'swagger.html');
    await generateSwaggerUI(out, config);
    expect(await fs.pathExists(out)).toBe(true);
    const content = await fs.readFile(out, 'utf-8');
    expect(content).toContain('My API Docs');
  });
});

describe('detectServices', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swagger-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('returns an empty list when no apps/packages exist', async () => {
    expect(await detectServices(tmpDir)).toEqual([]);
  });

  it('discovers openapi.json files under apps/', async () => {
    const appDir = path.join(tmpDir, 'apps', 'api');
    await fs.ensureDir(appDir);
    await fs.writeJSON(path.join(appDir, 'openapi.json'), { openapi: '3.0.0' });
    const services = await detectServices(tmpDir);
    expect(services.length).toBeGreaterThan(0);
    expect(services.some(s => s.name === 'api')).toBe(true);
  });
});

describe('formatSwaggerUIConfig', () => {
  it('renders a human-readable summary', () => {
    const out = formatSwaggerUIConfig(config);
    expect(out).toContain('My API Docs');
    expect(out).toContain('orders');
    expect(out).toContain('payments');
  });
});
