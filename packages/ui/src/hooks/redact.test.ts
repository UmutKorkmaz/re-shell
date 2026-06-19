import { describe, it, expect } from 'vitest';
import { redactSecrets } from './redact';

/**
 * Tests for redactSecrets — the display-safety pass that strips obvious
 * secrets from job output before rendering. Previously zero tests.
 */
describe('redactSecrets', () => {
  it('returns non-secret lines unchanged', () => {
    expect(redactSecrets('Server is running on port 3000')).toBe('Server is running on port 3000');
  });

  it('redacts key=value tokens', () => {
    const out = redactSecrets('API_KEY=sk-live-1234567890abcdef');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sk-live-1234567890abcdef');
  });

  it('redacts key: value secrets', () => {
    const out = redactSecrets('auth_token: "abc123secret"');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abc123secret');
  });

  it('redacts password= values', () => {
    const out = redactSecrets('password=hunter2');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('hunter2');
  });

  it('redacts Bearer tokens', () => {
    const out = redactSecrets('Authorization: Bearer eyJhbGci.eyJzdWIi.SflKxwRJ');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('eyJhbGci');
  });

  it('redacts sk- prefixed keys', () => {
    const out = redactSecrets('Using key sk-proj-abcdefghijklmnopqrstuvwxyz0123456789');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('sk-proj-');
  });

  it('redacts GitHub tokens (ghp_)', () => {
    const out = redactSecrets('Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('ghp_');
  });

  it('redacts Slack tokens (xox)', () => {
    const out = redactSecrets('SLACK_API_TOKEN=xoxb-1234567890123-abcdefghij');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('xoxb-');
  });

  it('redacts AWS access key ids (AKIA)', () => {
    const out = redactSecrets('AWS_KEY=AKIAIOSFODNN7EXAMPLE');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts JWT-shaped strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const out = redactSecrets(`token=${jwt}`);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain(jwt);
  });

  it('does not mutate the input', () => {
    const input = 'api_key=secret123';
    redactSecrets(input);
    expect(input).toBe('api_key=secret123');
  });
});
