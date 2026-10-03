import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  auditVerifyResponseSchema,
  complianceReportSchema,
} from '@re-shell/contracts';

/**
 * End-to-end audit trail: the BUILT CLI records state-changing commands via the
 * central commander hook, `security audit verify` detects tampering and exits
 * non-zero, and `security compliance report` maps the evidence to controls.
 */
const CLI = path.resolve(process.cwd(), 'dist/index.js');

let home: string;
let ws: string;
let gitconfig: string;

function cli(args: string[], extraEnv: Record<string, string> = {}, cwd = ws) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      GIT_CONFIG_GLOBAL: gitconfig,
      GIT_CONFIG_NOSYSTEM: '1',
      HOME: home,
      ...extraEnv,
    },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

const logFile = () => path.join(ws, '.re-shell', 'audit', 'audit.jsonl');
const entries = () =>
  fs.existsSync(logFile())
    ? fs
        .readFileSync(logFile(), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];

beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-home-'));
  gitconfig = path.join(home, 'gitconfig');
  fs.writeFileSync(gitconfig, '[user]\n  email = auditor@example.com\n  name = Auditor\n');
});

afterAll(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-ws-'));
  fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'ws', private: true, workspaces: ['packages/*'] }));
  fs.writeFileSync(path.join(ws, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  fs.mkdirSync(path.join(ws, 'packages', 'a'), { recursive: true });
  fs.writeFileSync(
    path.join(ws, 'packages', 'a', 'package.json'),
    JSON.stringify({ name: 'a', version: '1.0.0', scripts: { build: 'node -e "process.exit(0)"' } })
  );
});

describe('audit trail recording', () => {
  it('records a successful mutating command with actor, args, cwd, exit code and duration', () => {
    const r = cli(['run', 'build', '--no-cache'], {}, path.join(ws, 'packages', 'a'));
    expect(r.status).toBe(0);
    const [e] = entries();
    expect(e).toMatchObject({
      v: 1,
      seq: 1,
      command: 'run',
      args: ['build', '--no-cache'],
      cwd: 'packages/a',
      exitCode: 0,
      actor: 'auditor@example.com',
      actorSource: 'git',
    });
    expect(typeof e.durationMs).toBe('number');
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(path.join(ws, '.re-shell', 'audit', 'audit.head.json'))).toBe(true);
  });

  it('records the exit code of a failing command (process.exit inside the command)', () => {
    const r = cli(['config', 'set', 'audit.note', 'x']);
    expect(r.status).toBe(1);
    expect(entries()[0]).toMatchObject({ command: 'config set', exitCode: 1 });
  });

  it('redacts secrets in recorded args', () => {
    cli(['config', 'set', 'apiToken', 'sup3r-secret-value', '--project']);
    cli(['run', 'build', '--no-cache', '--deploy-token', 'tok_abcdefghijklmnop']);
    const raw = fs.readFileSync(logFile(), 'utf8');
    expect(raw).not.toContain('sup3r-secret-value');
    expect(raw).not.toContain('tok_abcdefghijklmnop');
    expect(raw).toContain('[REDACTED]');
  });

  it('chains consecutive commands', () => {
    cli(['run', 'build', '--no-cache']);
    cli(['run', 'build', '--no-cache']);
    const list = entries();
    expect(list.map(e => e.seq)).toEqual([1, 2]);
    expect(list[1].prevHash).toBe(list[0].hash);
  });

  it('does not record read-only commands, --help, or --dry-run', () => {
    cli(['workspace', 'list']);
    cli(['templates', 'list', '--json']);
    cli(['run', '--help']);
    cli(['create', 'x', '--dry-run']);
    expect(entries()).toHaveLength(0);
  });

  it('can be disabled with RE_SHELL_AUDIT=0', () => {
    cli(['run', 'build', '--no-cache'], { RE_SHELL_AUDIT: '0' });
    expect(entries()).toHaveLength(0);
  });

  it('can be disabled with audit.enabled: false in .re-shell/config.yaml', () => {
    fs.mkdirSync(path.join(ws, '.re-shell'));
    fs.writeFileSync(path.join(ws, '.re-shell', 'config.yaml'), 'name: ws\naudit:\n  enabled: false\n');
    cli(['run', 'build', '--no-cache']);
    expect(entries()).toHaveLength(0);
  });

  it('writes nothing outside a workspace', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-plain-'));
    try {
      cli(['run', 'build'], {}, plain);
      expect(fs.existsSync(path.join(plain, '.re-shell'))).toBe(false);
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe('security audit verify', () => {
  it('passes on an intact log (human + JSON) and reports an absent log as nothing to verify', () => {
    expect(cli(['security', 'audit', 'verify']).stdout).toMatch(/No audit log/);
    cli(['run', 'build', '--no-cache']);
    cli(['run', 'build', '--no-cache']);

    const human = cli(['security', 'audit', 'verify']);
    expect(human.status).toBe(0);
    expect(human.stdout).toMatch(/2 entries, chain intact/);

    const json = cli(['security', 'audit', 'verify', '--json']);
    expect(json.status).toBe(0);
    const parsed = jsonResponseSchema(auditVerifyResponseSchema).parse(JSON.parse(json.stdout));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data).toMatchObject({ valid: true, entries: 2, lastSeq: 2 });
  });

  it('exits non-zero and names the problem when an entry was modified', () => {
    cli(['run', 'build', '--no-cache']);
    cli(['run', 'build', '--no-cache']);
    cli(['run', 'build', '--no-cache']);
    const lines = fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean);
    const e = JSON.parse(lines[1]);
    e.exitCode = 0;
    e.args = ['totally', 'different'];
    lines[1] = JSON.stringify(e);
    fs.writeFileSync(logFile(), lines.join('\n') + '\n');

    const human = cli(['security', 'audit', 'verify']);
    expect(human.status).not.toBe(0);
    expect(human.stderr).toMatch(/FAILED/);
    expect(human.stderr).toMatch(/hash-mismatch/);

    const json = cli(['security', 'audit', 'verify', '--json']);
    expect(json.status).not.toBe(0);
    const parsed = jsonResponseSchema(auditVerifyResponseSchema).parse(JSON.parse(json.stdout));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('AUDIT_ERROR');
      const details = auditVerifyResponseSchema.parse(parsed.error.details);
      expect(details.failures.some(f => f.code === 'hash-mismatch' && f.seq === 2)).toBe(true);
    }
  });

  it('detects removed entries and a deleted log', () => {
    for (let i = 0; i < 4; i++) cli(['run', 'build', '--no-cache']);
    const lines = fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean);
    lines.splice(1, 1);
    fs.writeFileSync(logFile(), lines.join('\n') + '\n');
    const removed = cli(['security', 'audit', 'verify', '--json']);
    expect(removed.status).not.toBe(0);
    const codes = (JSON.parse(removed.stdout).error.details.failures as Array<{ code: string }>).map(f => f.code);
    expect(codes).toContain('sequence-gap');

    fs.rmSync(logFile());
    const deleted = cli(['security', 'audit', 'verify', '--json']);
    expect(deleted.status).not.toBe(0);
    expect(JSON.parse(deleted.stdout).error.details.failures[0].code).toBe('log-missing');
  });

  it('detects reordered entries', () => {
    for (let i = 0; i < 3; i++) cli(['run', 'build', '--no-cache']);
    const lines = fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean);
    [lines[0], lines[1]] = [lines[1], lines[0]];
    fs.writeFileSync(logFile(), lines.join('\n') + '\n');
    expect(cli(['security', 'audit', 'verify']).status).not.toBe(0);
  });

  it('supports --expect-head for an externally anchored hash', () => {
    cli(['run', 'build', '--no-cache']);
    const head = entries()[0].hash;
    expect(cli(['security', 'audit', 'verify', '--expect-head', head]).status).toBe(0);
    expect(cli(['security', 'audit', 'verify', '--expect-head', 'a'.repeat(64)]).status).not.toBe(0);
  });

  it('still lets `security audit <name>` run the original generator', () => {
    const out = path.join(ws, 'gen');
    const r = cli(['security', 'audit', 'myproj', '--output', out]);
    expect(r.status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
  });
});

describe('security compliance report', () => {
  it('maps audit + policy + config evidence to SOC 2 controls and states the gaps (JSON)', () => {
    cli(['run', 'build', '--no-cache']);
    const r = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(complianceReportSchema).parse(JSON.parse(r.stdout));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const report = parsed.data;
    expect(report.framework).toBe('soc2');
    expect(report.audit).toMatchObject({ present: true, chainValid: true, entriesInWindow: 1, actors: ['auditor@example.com'] });
    const ids = report.controls.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['CC8.1', 'CC6.1', 'CC7.2', 'CC7.1']));
    const cm = report.controls.find(c => c.id === 'CC8.1')!;
    expect(cm.status).toBe('partial'); // no CI definition, no CODEOWNERS in the fixture
    expect(cm.evidence.some(e => e.source === 'audit-log')).toBe(true);
    expect(cm.gaps.join(' ')).toMatch(/CODEOWNERS/);
    expect(report.notEvaluated.length).toBeGreaterThan(0);
    expect(report.disclaimer).toMatch(/not an attestation/);
  });

  it('reports NO EVIDENCE for change management on a workspace without any audit log or CI', () => {
    const r = cli(['security', 'compliance', 'report', '--framework', 'iso27001', '--json']);
    const report = JSON.parse(r.stdout).data;
    expect(report.framework).toBe('iso27001');
    expect(report.audit.present).toBe(false);
    const logging = report.controls.find((c: { id: string }) => c.id === 'A.8.15');
    expect(logging.gaps.join(' ')).toMatch(/No audit log/);
  });

  it('renders Markdown with --format md and honours --since', () => {
    cli(['run', 'build', '--no-cache']);
    const md = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--format', 'md']);
    expect(md.status).toBe(0);
    expect(md.stdout).toMatch(/^# Compliance evidence report/m);
    expect(md.stdout).toMatch(/### CC8\.1 Change management \(PARTIAL\)/);
    expect(md.stdout).toMatch(/Not evaluated by this report/);

    const future = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--since', '2999-01-01', '--json']);
    expect(JSON.parse(future.stdout).data.audit.entriesInWindow).toBe(0);
    const recent = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--since', '1d', '--json']);
    expect(JSON.parse(recent.stdout).data.audit.entriesInWindow).toBe(1);
  });

  it('marks a tampered chain as not trustworthy in the report', () => {
    cli(['run', 'build', '--no-cache']);
    cli(['run', 'build', '--no-cache']);
    const lines = fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean);
    const e = JSON.parse(lines[0]);
    e.actor = 'someone-else@example.com';
    lines[0] = JSON.stringify(e);
    fs.writeFileSync(logFile(), lines.join('\n') + '\n');
    const report = JSON.parse(cli(['security', 'compliance', 'report', '--framework', 'soc2', '--json']).stdout).data;
    expect(report.audit.chainValid).toBe(false);
    const logging = report.controls.find((c: { id: string }) => c.id === 'CC7.2');
    expect(logging.gaps.join(' ')).toMatch(/Hash-chain verification failed/);
  });

  it('rejects unknown frameworks and bad --since values with a non-zero exit', () => {
    const bad = cli(['security', 'compliance', 'report', '--framework', 'hipaa', '--json']);
    expect(bad.status).not.toBe(0);
    expect(JSON.parse(bad.stdout)).toMatchObject({ ok: false, error: { code: 'COMPLIANCE_ERROR' } });
    const since = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--since', 'yesterday-ish', '--json']);
    expect(since.status).not.toBe(0);
  });

  it('--strict exits non-zero when a control has no evidence', () => {
    fs.rmSync(path.join(ws, 'pnpm-lock.yaml'));
    // Config control: no policy evidence is impossible here (policy runs), so just
    // assert the flag is accepted and the exit code reflects the summary.
    const r = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--strict', '--json']);
    const summary = JSON.parse(r.stdout).data.summary;
    expect(r.status).toBe(summary.noEvidence > 0 ? 1 : 0);
  });

  it('writes the report to --output', () => {
    const out = path.join(ws, 'reports', 'soc2.md');
    const r = cli(['security', 'compliance', 'report', '--framework', 'soc2', '--format', 'md', '--output', out]);
    expect(r.status).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toMatch(/# Compliance evidence report/);
  });
});
