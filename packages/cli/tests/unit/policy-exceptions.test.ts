import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  loadExceptions,
  applyExceptions,
  type PolicyException,
} from '../../src/utils/policy-exceptions';

/**
 * Unit tests for the policy exceptions module.
 *
 * Covers loadExceptions (file not found, valid YAML, invalid YAML) and
 * applyExceptions (exact match, wildcard, expired, future expiry, no-match).
 */

interface TestFailedItem {
  service?: string;
  ruleId: string;
  passed: boolean;
  severity: string;
  message: string;
}

describe('loadExceptions', () => {
  const TMP_DIRS: string[] = [];

  afterEach(() => {
    for (const dir of TMP_DIRS.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('returns [] when file does not exist', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exc-nf-'));
    TMP_DIRS.push(dir);
    const result = await loadExceptions(path.join(dir, 'nonexistent.yaml'));
    expect(result).toEqual([]);
  });

  it('loads valid YAML exceptions file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exc-ok-'));
    TMP_DIRS.push(dir);
    const yamlContent = [
      '- service: api',
      '  rule: healthcheck-required',
      '  reason: "Legacy service"',
      '  expires: "2099-12-31"',
      '- service: "*"',
      '  rule: port-range',
      '',
    ].join('\n');
    const filePath = path.join(dir, 'exceptions.yaml');
    fs.writeFileSync(filePath, yamlContent, 'utf8');

    const result = await loadExceptions(filePath);
    expect(result).toHaveLength(2);
    expect(result[0].service).toBe('api');
    expect(result[0].rule).toBe('healthcheck-required');
    expect(result[0].reason).toBe('Legacy service');
    expect(result[0].expires).toBe('2099-12-31');
    expect(result[1].service).toBe('*');
    expect(result[1].rule).toBe('port-range');
  });

  it('throws on invalid YAML', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exc-bad-'));
    TMP_DIRS.push(dir);
    const yamlContent = 'service: api\n  rule: [unclosed';
    const filePath = path.join(dir, 'exceptions.yaml');
    fs.writeFileSync(filePath, yamlContent, 'utf8');

    await expect(loadExceptions(filePath)).rejects.toThrow();
  });

  it('normalizes Date objects from YAML parser to YYYY-MM-DD', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exc-date-'));
    TMP_DIRS.push(dir);
    // YAML interprets unquoted dates as Date objects
    const yamlContent = [
      '- service: api',
      '  rule: min-node',
      '  expires: 2099-06-15',
      '',
    ].join('\n');
    const filePath = path.join(dir, 'exceptions.yaml');
    fs.writeFileSync(filePath, yamlContent, 'utf8');

    const result = await loadExceptions(filePath);
    expect(result[0].expires).toBe('2099-06-15');
  });
});

describe('applyExceptions', () => {
  /** Helper to create a failed item. */
  function failed(ruleId: string, service?: string): TestFailedItem {
    return {
      service,
      ruleId,
      passed: false,
      severity: 'error',
      message: `Failed: ${ruleId}`,
    };
  }

  it('moves exact match to waived', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
      failed('port-range', 'web'),
    ];
    const exceptions: PolicyException[] = [
      { service: 'api', rule: 'healthcheck-required', reason: 'Legacy' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(1);
    expect(result.stillFailed[0].ruleId).toBe('port-range');
    expect(result.waived).toHaveLength(1);
    expect(result.waived[0].ruleId).toBe('healthcheck-required');
    expect(result.waived[0].waiveReason).toBe('Legacy');
    expect(result.expired).toHaveLength(0);
  });

  it('wildcard "*" matches any service', () => {
    const items: TestFailedItem[] = [
      failed('port-range', 'api'),
      failed('port-range', 'web'),
      failed('port-range', 'db'),
    ];
    const exceptions: PolicyException[] = [
      { service: '*', rule: 'port-range' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(0);
    expect(result.waived).toHaveLength(3);
  });

  it('expired exception stays in stillFailed and is reported in expired', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
    ];
    const exceptions: PolicyException[] = [
      { service: 'api', rule: 'healthcheck-required', expires: '2020-01-01' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(1);
    expect(result.stillFailed[0].ruleId).toBe('healthcheck-required');
    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].service).toBe('api');
    expect(result.expired[0].rule).toBe('healthcheck-required');
    expect(result.expired[0].expires).toBe('2020-01-01');
  });

  it('future expiry is waived (not expired)', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
    ];
    const exceptions: PolicyException[] = [
      { service: 'api', rule: 'healthcheck-required', expires: '2099-12-31' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(0);
    expect(result.waived).toHaveLength(1);
    expect(result.waived[0].waiveExpires).toBe('2099-12-31');
    expect(result.expired).toHaveLength(0);
  });

  it('no-match items stay in stillFailed', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
      failed('port-range', 'web'),
    ];
    const exceptions: PolicyException[] = [
      { service: 'db', rule: 'healthcheck-required' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(2);
    expect(result.waived).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
  });

  it('handles empty exceptions (all stay failed)', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
      failed('port-range', 'web'),
    ];

    const result = applyExceptions(items, []);
    expect(result.stillFailed).toHaveLength(2);
    expect(result.waived).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
  });

  it('handles empty failed items', () => {
    const exceptions: PolicyException[] = [
      { service: '*', rule: 'port-range' },
    ];

    const result = applyExceptions([], exceptions);
    expect(result.stillFailed).toHaveLength(0);
    expect(result.waived).toHaveLength(0);
    expect(result.expired).toHaveLength(0);
  });

  it('partial match by rule but not service stays in stillFailed', () => {
    const items: TestFailedItem[] = [
      failed('healthcheck-required', 'api'),
    ];
    const exceptions: PolicyException[] = [
      { service: 'web', rule: 'healthcheck-required' },
    ];

    const result = applyExceptions(items, exceptions);
    expect(result.stillFailed).toHaveLength(1);
    expect(result.waived).toHaveLength(0);
  });
});
