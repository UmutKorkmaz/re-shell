import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildComplianceReport,
  listFrameworks,
  parseSince,
  renderComplianceMarkdown,
  type PolicySummary,
} from '../../src/audit/compliance';
import { appendAuditEntry, type NewAuditEntry } from '../../src/audit/log';
import { complianceReportSchema } from '@re-shell/contracts';

let root: string;

const entry = (n: number, over: Partial<NewAuditEntry> = {}): NewAuditEntry => ({
  timestamp: new Date(Date.UTC(2026, 5, n, 12)).toISOString(),
  actor: 'dev@example.com',
  actorSource: 'git',
  command: 'plugin install',
  args: ['x'],
  cwd: '.',
  exitCode: 0,
  durationMs: 10,
  ...over,
});

const goodPolicy = async (): Promise<PolicySummary> => ({ ran: true, pack: 'recommended', score: 100, passedRules: 4, failedErrors: 0, failedWarnings: 0 });
const badPolicy = async (): Promise<PolicySummary> => ({ ran: true, pack: 'recommended', score: 40, passedRules: 1, failedErrors: 2, failedWarnings: 1 });
const noPolicy = async (): Promise<PolicySummary> => ({ ran: false, error: 'no workspace packages' });

const write = (rel: string, content = ''): void => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'compliance-'));
  write('package.json', JSON.stringify({ name: 'w', workspaces: ['packages/*'] }));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const control = (r: Awaited<ReturnType<typeof buildComplianceReport>>, id: string) => r.controls.find(c => c.id === id)!;

describe('compliance report', () => {
  it('lists the supported frameworks and rejects unknown ones', async () => {
    expect(listFrameworks()).toEqual(['soc2', 'iso27001']);
    await expect(buildComplianceReport(root, { framework: 'hipaa' as never })).rejects.toThrow(/Unknown framework/);
  });

  it('empty workspace: every control states what evidence is missing and none claims compliance', async () => {
    const r = await buildComplianceReport(root, { framework: 'soc2', policyRunner: noPolicy });
    expect(complianceReportSchema.safeParse(r).success).toBe(true);
    expect(r.audit).toMatchObject({ present: false, entriesInWindow: 0 });
    expect(r.summary.evidence).toBe(0); // nothing can be fully evidenced from an empty repo
    const cm = control(r, 'CC8.1');
    expect(cm.status).toBe('no-evidence');
    expect(cm.gaps.join(' ')).toMatch(/No audit log found/);
    expect(cm.gaps.join(' ')).toMatch(/Policy check could not be evaluated: no workspace packages/);
    expect(cm.gaps.join(' ')).toMatch(/No CI pipeline/);
    expect(r.disclaimer).toMatch(/not an attestation/);
    expect(r.notEvaluated.map(n => n.id)).toEqual(expect.arrayContaining(['CC6.2', 'CC7.3']));
  });

  it('change management reaches "evidence" only when audit log, policy result, CI and CODEOWNERS all exist', async () => {
    appendAuditEntry(root, entry(1));
    appendAuditEntry(root, entry(2, { command: 'service run up' }));
    write('.github/workflows/ci.yml', 'name: ci\n');
    write('.github/CODEOWNERS', '* @platform\n');
    const r = await buildComplianceReport(root, { framework: 'soc2', policyRunner: goodPolicy });
    const cm = control(r, 'CC8.1');
    expect(cm.status).toBe('evidence');
    expect(cm.gaps).toEqual([]);
    expect(cm.evidence.map(e => e.source).sort()).toEqual(['audit-log', 'policy-check', 'repository', 'repository']);
    expect(cm.evidence[0].summary).toMatch(/2 state-changing commands recorded .* by 1 actor \(dependency: 1, deploy: 1\)/);
  });

  it('partial when something is missing, and the gap says exactly what', async () => {
    appendAuditEntry(root, entry(1));
    const r = await buildComplianceReport(root, { framework: 'soc2', policyRunner: badPolicy });
    const cm = control(r, 'CC8.1');
    expect(cm.status).toBe('partial');
    expect(cm.gaps.join(' ')).toMatch(/error-severity failures/);
    expect(cm.gaps.join(' ')).toMatch(/No CODEOWNERS/);
    expect(cm.gaps.join(' ')).toMatch(/No CI pipeline/);
    expect(r.policy).toMatchObject({ failedErrors: 2, score: 40 });
  });

  it('access control is never fully evidenced from the repository alone and flags OS-only attribution', async () => {
    appendAuditEntry(root, entry(1));
    appendAuditEntry(root, entry(2, { actor: 'root', actorSource: 'os' }));
    write('CODEOWNERS', '* @a\n');
    const r = await buildComplianceReport(root, { framework: 'iso27001', policyRunner: goodPolicy });
    const access = control(r, 'A.5.15');
    expect(access.status).toBe('partial');
    expect(access.gaps.join(' ')).toMatch(/1 entry is attributed only to an OS user name/);
    expect(access.gaps.join(' ')).toMatch(/not observable from this repository/);
  });

  it('logging reports a tampered chain, a disabled audit, and a gitignored log', async () => {
    appendAuditEntry(root, entry(1));
    appendAuditEntry(root, entry(2));
    const logFile = path.join(root, '.re-shell', 'audit', 'audit.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const e = JSON.parse(lines[0]);
    e.args = ['tampered'];
    lines[0] = JSON.stringify(e);
    fs.writeFileSync(logFile, lines.join('\n') + '\n');
    write('.gitignore', 'node_modules\n.re-shell/\n');

    const r = await buildComplianceReport(root, { framework: 'soc2', policyRunner: goodPolicy, env: { RE_SHELL_AUDIT: '0' } });
    expect(r.audit).toMatchObject({ chainValid: false, enabled: false, disabledBy: 'env', verifyFailures: 1 });
    const logging = control(r, 'CC7.2');
    expect(logging.status).toBe('partial');
    const gaps = logging.gaps.join(' ');
    expect(gaps).toMatch(/Audit logging is disabled/);
    expect(gaps).toMatch(/Hash-chain verification failed/);
    expect(gaps).toMatch(/\.gitignore excludes the audit log/);
    // change management must not rely on a log that failed verification
    expect(control(r, 'CC8.1').gaps.join(' ')).toMatch(/failed hash-chain verification/);
  });

  it('--since limits the evidence window and is reflected in the report', async () => {
    appendAuditEntry(root, entry(1));
    appendAuditEntry(root, entry(20));
    const since = new Date(Date.UTC(2026, 5, 10));
    const r = await buildComplianceReport(root, { framework: 'soc2', since, policyRunner: goodPolicy });
    expect(r.since).toBe(since.toISOString());
    expect(r.audit).toMatchObject({ entriesTotal: 2, entriesInWindow: 1 });
    const none = await buildComplianceReport(root, { framework: 'soc2', since: new Date(Date.UTC(2030, 0, 1)), policyRunner: goodPolicy });
    expect(none.audit.entriesInWindow).toBe(0);
    expect(control(none, 'CC8.1').gaps.join(' ')).toMatch(/no state-changing commands in the selected window/);
  });

  it('counts failed commands and classifies change categories from the recorded commands', async () => {
    appendAuditEntry(root, entry(1, { command: 'config set', exitCode: 1 }));
    appendAuditEntry(root, entry(2, { command: 'remove' }));
    const r = await buildComplianceReport(root, { framework: 'soc2', policyRunner: goodPolicy });
    expect(r.audit.failedCommands).toBe(1);
    expect(r.audit.byCategory).toEqual({ modify: 1, delete: 1 });
  });

  it('uses the real policy engine by default', async () => {
    write('packages/a/package.json', JSON.stringify({ name: 'a', scripts: { build: 'x', test: 'y' } }));
    const r = await buildComplianceReport(root, { framework: 'soc2' });
    expect(r.policy.ran).toBe(true);
    expect(r.policy.pack).toBe('recommended');
    expect(typeof r.policy.score).toBe('number');
  });

  it('renders Markdown with statuses, evidence, gaps and the not-evaluated list', async () => {
    appendAuditEntry(root, entry(1));
    const md = renderComplianceMarkdown(await buildComplianceReport(root, { framework: 'iso27001', policyRunner: goodPolicy }));
    expect(md).toMatch(/^# Compliance evidence report: ISO\/IEC 27001:2022/m);
    expect(md).toMatch(/### A\.8\.32 Change management \(PARTIAL\)/);
    expect(md).toMatch(/^Evidence:$/m);
    expect(md).toMatch(/^Gaps:$/m);
    expect(md).toMatch(/## Not evaluated by this report/);
  });
});

describe('parseSince', () => {
  const now = new Date('2026-06-30T00:00:00Z');
  it('accepts ISO dates and relative day windows', () => {
    expect(parseSince('2026-06-01', now)!.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(parseSince('30d', now)!.toISOString()).toBe('2026-05-31T00:00:00.000Z');
    expect(parseSince(undefined, now)).toBeNull();
  });
  it('fails explicitly on garbage', () => {
    expect(() => parseSince('last tuesday', now)).toThrow(/Invalid --since/);
  });
});
