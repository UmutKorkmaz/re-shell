/**
 * Compliance evidence report.
 *
 * Maps what the repository can PROVE (hash-chained audit log, `workspace policy
 * check` results, configuration and repository files) onto framework controls.
 * It never claims compliance: a control is `evidence` only when every check
 * this tool can perform for it passed, `partial` when some did, and
 * `no-evidence` when nothing observable supports it. Controls that depend on
 * systems outside the repository (IdP, HR, physical security, ...) are listed
 * under `notEvaluated` instead of being silently omitted.
 */
import * as fs from 'fs';
import * as path from 'path';
import { classifyCommand } from './classify';
import { readAuditEntries, verifyAuditLog, type AuditVerifyResult } from './log';
import { readAuditSettings, type AuditSettings } from './settings';
import type { AuditEntry } from './chain';

export type ComplianceFramework = 'soc2' | 'iso27001';
export type EvidenceStatus = 'evidence' | 'partial' | 'no-evidence';
export type ControlCategory = 'change-management' | 'access' | 'logging' | 'configuration';

export interface EvidenceItem {
  source: 'audit-log' | 'policy-check' | 'config' | 'repository';
  summary: string;
}

export interface ControlResult {
  id: string;
  title: string;
  category: ControlCategory;
  /** What the framework asks of this control, in one sentence. */
  objective: string;
  status: EvidenceStatus;
  evidence: EvidenceItem[];
  /** What is missing or weak. Empty only when status is `evidence`. */
  gaps: string[];
}

export interface PolicySummary {
  ran: boolean;
  pack?: string;
  score?: number;
  passedRules?: number;
  failedErrors?: number;
  failedWarnings?: number;
  error?: string;
}

export interface AuditSummary {
  present: boolean;
  enabled: boolean;
  disabledBy?: 'env' | 'config';
  chainValid: boolean;
  entriesTotal: number;
  entriesInWindow: number;
  actors: string[];
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  byCategory: Record<string, number>;
  failedCommands: number;
  verifyFailures: number;
}

export interface ComplianceReport {
  framework: ComplianceFramework;
  frameworkName: string;
  generatedAt: string;
  since: string | null;
  disclaimer: string;
  audit: AuditSummary;
  policy: PolicySummary;
  controls: ControlResult[];
  summary: { total: number; evidence: number; partial: number; noEvidence: number };
  notEvaluated: Array<{ id: string; title: string; reason: string }>;
}

const DISCLAIMER =
  'This report collects technical evidence available in this repository. It is not an attestation or ' +
  'certification: auditors decide whether evidence satisfies a control, and controls that depend on external ' +
  'systems are listed under notEvaluated.';

/** Parse `--since`: ISO date/time, or `<n>d` for the last n days. */
export function parseSince(value: string | undefined, now: Date = new Date()): Date | null {
  if (!value) return null;
  const rel = /^(\d+)d$/.exec(value.trim());
  if (rel) return new Date(now.getTime() - Number(rel[1]) * 86_400_000);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --since value "${value}". Use an ISO date (2026-01-31) or a relative window like 30d.`);
  }
  return parsed;
}

interface RepoFacts {
  codeowners: string | null;
  ciWorkflows: string[];
  lockfile: string | null;
  projectConfig: boolean;
  auditLogIgnored: boolean;
}

function gatherRepoFacts(root: string): RepoFacts {
  const exists = (rel: string) => fs.existsSync(path.join(root, rel));
  const codeowners = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'].find(exists) ?? null;

  const ciWorkflows: string[] = [];
  try {
    for (const f of fs.readdirSync(path.join(root, '.github', 'workflows'))) {
      if (/\.ya?ml$/.test(f)) ciWorkflows.push(`.github/workflows/${f}`);
    }
  } catch {
    /* no workflows dir */
  }
  for (const f of ['.gitlab-ci.yml', 'azure-pipelines.yml', '.circleci/config.yml', 'Jenkinsfile']) {
    if (exists(f)) ciWorkflows.push(f);
  }

  const lockfile = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb'].find(exists) ?? null;

  let auditLogIgnored = false;
  try {
    const gi = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    auditLogIgnored = gi.split('\n').some(l => {
      const t = l.trim();
      return t === '.re-shell' || t === '.re-shell/' || t === '.re-shell/audit' || t === '.re-shell/audit/' || t.includes('audit.jsonl');
    });
  } catch {
    /* no .gitignore */
  }

  return { codeowners, ciWorkflows, lockfile, projectConfig: exists('.re-shell/config.yaml'), auditLogIgnored };
}

interface Context {
  audit: AuditSummary;
  verify: AuditVerifyResult;
  settings: AuditSettings;
  window: AuditEntry[];
  policy: PolicySummary;
  repo: RepoFacts;
  since: Date | null;
}

type Builder = (ctx: Context) => { evidence: EvidenceItem[]; gaps: string[] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function auditWindowText(ctx: Context): string {
  const a = ctx.audit;
  return a.firstTimestamp ? `between ${a.firstTimestamp} and ${a.lastTimestamp}` : 'in the selected window';
}

/** Change management: were changes recorded, attributable, and checked? */
const changeManagement: Builder = ctx => {
  const evidence: EvidenceItem[] = [];
  const gaps: string[] = [];
  const a = ctx.audit;

  if (a.entriesInWindow > 0) {
    const cats = Object.entries(a.byCategory)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    evidence.push({
      source: 'audit-log',
      summary: `${plural(a.entriesInWindow, 'state-changing command')} recorded ${auditWindowText(ctx)} by ${plural(a.actors.length, 'actor')} (${cats}).`,
    });
    if (!a.chainValid) {
      gaps.push('The audit log failed hash-chain verification, so these change records cannot be relied on (run `re-shell security audit verify`).');
    }
  } else if (ctx.verify.logExists) {
    gaps.push('The audit log has no state-changing commands in the selected window.');
  } else {
    gaps.push('No audit log found: changes made through the CLI are not recorded (.re-shell/audit/audit.jsonl).');
  }

  if (ctx.policy.ran) {
    evidence.push({
      source: 'policy-check',
      summary: `Policy pack "${ctx.policy.pack}" readiness score ${ctx.policy.score}% (${plural(ctx.policy.failedErrors ?? 0, 'error-severity failure')}, ${plural(ctx.policy.failedWarnings ?? 0, 'warning')}).`,
    });
    if ((ctx.policy.failedErrors ?? 0) > 0) gaps.push('Policy check reports error-severity failures that block release readiness.');
  } else {
    gaps.push(`Policy check could not be evaluated${ctx.policy.error ? `: ${ctx.policy.error}` : '.'}`);
  }

  if (ctx.repo.ciWorkflows.length > 0) {
    evidence.push({ source: 'repository', summary: `Automated pipeline definition(s): ${ctx.repo.ciWorkflows.join(', ')}.` });
  } else {
    gaps.push('No CI pipeline definition found (.github/workflows, .gitlab-ci.yml, ...): automated testing of changes is not evidenced.');
  }
  if (ctx.repo.codeowners) {
    evidence.push({ source: 'repository', summary: `Code ownership for review routing: ${ctx.repo.codeowners}.` });
  } else {
    gaps.push('No CODEOWNERS file: reviewer assignment cannot be evidenced. Pull-request approvals themselves are not visible from the repository.');
  }
  return { evidence, gaps };
};

/** Logical access: who acted, and is there an access policy in the repo? */
const accessControl: Builder = ctx => {
  const evidence: EvidenceItem[] = [];
  const gaps: string[] = [];
  const entries = ctx.window;

  if (entries.length > 0) {
    const git = entries.filter(e => e.actorSource === 'git').length;
    evidence.push({
      source: 'audit-log',
      summary: `Every recorded change is attributed to an actor (${plural(ctx.audit.actors.length, 'distinct actor')}); ${git} of ${entries.length} entries use a git identity.`,
    });
    if (git < entries.length) {
      gaps.push(`${entries.length - git} entr${entries.length - git === 1 ? 'y is' : 'ies are'} attributed only to an OS user name, which is not a verified identity (configure git user.email).`);
    }
  } else {
    gaps.push('No audit entries in the window, so actor attribution is not evidenced.');
  }
  if (ctx.repo.codeowners) {
    evidence.push({ source: 'repository', summary: `CODEOWNERS defines who owns and reviews which paths (${ctx.repo.codeowners}).` });
  } else {
    gaps.push('No CODEOWNERS file: path-level ownership is not evidenced.');
  }
  gaps.push('Role-based access and MFA are enforced by your VCS/IdP and are not observable from this repository.');
  return { evidence, gaps };
};

/** Logging and monitoring: is the trail present, enabled, intact? */
const logging: Builder = ctx => {
  const evidence: EvidenceItem[] = [];
  const gaps: string[] = [];
  const a = ctx.audit;

  if (!a.enabled) {
    gaps.push(`Audit logging is disabled (${a.disabledBy === 'env' ? 'RE_SHELL_AUDIT environment variable' : 'audit.enabled: false in .re-shell/config.yaml'}).`);
  } else {
    evidence.push({ source: 'config', summary: 'Audit logging is enabled (no opt-out in environment or .re-shell/config.yaml).' });
  }

  if (ctx.verify.logExists) {
    evidence.push({
      source: 'audit-log',
      summary: `${plural(a.entriesTotal, 'entry')} in ${ctx.verify.logPath}; hash chain ${a.chainValid ? 'verified intact' : `FAILED verification (${plural(a.verifyFailures, 'failure')})`}.`,
    });
    if (!a.chainValid) gaps.push('Hash-chain verification failed: the log may have been tampered with.');
    if (a.entriesInWindow === 0) gaps.push('No entries inside the selected window.');
  } else {
    gaps.push('No audit log has been written yet.');
  }

  if (ctx.repo.auditLogIgnored) {
    gaps.push('.gitignore excludes the audit log, so it is not retained with the repository history.');
  } else if (ctx.verify.logExists) {
    evidence.push({ source: 'repository', summary: 'The audit log is not gitignored and can be retained with repository history.' });
  }
  gaps.push('Log retention periods and off-host forwarding are not configured by this tool: anchor the head hash externally (`audit verify --expect-head`) for stronger tamper evidence.');
  return { evidence, gaps };
};

/** Configuration management: baseline policy + pinned inputs. */
const configManagement: Builder = ctx => {
  const evidence: EvidenceItem[] = [];
  const gaps: string[] = [];

  if (ctx.policy.ran) {
    evidence.push({
      source: 'policy-check',
      summary: `Policy pack "${ctx.policy.pack}": ${plural(ctx.policy.passedRules ?? 0, 'rule')} passed, score ${ctx.policy.score}%.`,
    });
    if ((ctx.policy.failedErrors ?? 0) + (ctx.policy.failedWarnings ?? 0) > 0) {
      gaps.push(`${plural((ctx.policy.failedErrors ?? 0) + (ctx.policy.failedWarnings ?? 0), 'policy rule failure')} outstanding (run \`re-shell workspace policy check\`).`);
    }
  } else {
    gaps.push(`Policy check could not be evaluated${ctx.policy.error ? `: ${ctx.policy.error}` : '.'}`);
  }
  if (ctx.repo.lockfile) {
    evidence.push({ source: 'repository', summary: `Dependency versions are locked (${ctx.repo.lockfile}).` });
  } else {
    gaps.push('No lockfile found: dependency versions are not pinned.');
  }
  if (ctx.repo.projectConfig) {
    evidence.push({ source: 'config', summary: 'Project configuration is versioned in .re-shell/config.yaml.' });
  } else {
    gaps.push('No .re-shell/config.yaml: workspace configuration is not centrally recorded.');
  }
  return { evidence, gaps };
};

interface ControlSpec {
  id: string;
  title: string;
  category: ControlCategory;
  objective: string;
  build: Builder;
}

const FRAMEWORKS: Record<
  ComplianceFramework,
  { name: string; controls: ControlSpec[]; notEvaluated: Array<{ id: string; title: string; reason: string }> }
> = {
  soc2: {
    name: 'SOC 2 (AICPA Trust Services Criteria, Common Criteria)',
    controls: [
      {
        id: 'CC8.1',
        title: 'Change management',
        category: 'change-management',
        objective: 'Changes to infrastructure and software are authorized, tested and recorded.',
        build: changeManagement,
      },
      {
        id: 'CC6.1',
        title: 'Logical access security',
        category: 'access',
        objective: 'Access to systems is restricted and actions are attributable to identified users.',
        build: accessControl,
      },
      {
        id: 'CC7.2',
        title: 'System monitoring and logging',
        category: 'logging',
        objective: 'Security-relevant events are logged, protected from alteration and monitored.',
        build: logging,
      },
      {
        id: 'CC7.1',
        title: 'Configuration and baseline monitoring',
        category: 'configuration',
        objective: 'Configuration baselines are defined and deviations are detected.',
        build: configManagement,
      },
    ],
    notEvaluated: [
      { id: 'CC6.2', title: 'User provisioning and deprovisioning', reason: 'Identity lifecycle lives in your IdP/HR systems, not in the repository.' },
      { id: 'CC6.6', title: 'Boundary protection', reason: 'Network controls are not observable from the workspace.' },
      { id: 'CC7.3', title: 'Security incident evaluation', reason: 'Incident records are not captured by the CLI audit trail.' },
      { id: 'CC9.1', title: 'Risk mitigation and business continuity', reason: 'Requires organisational evidence outside this repository.' },
    ],
  },
  iso27001: {
    name: 'ISO/IEC 27001:2022 (Annex A)',
    controls: [
      {
        id: 'A.8.32',
        title: 'Change management',
        category: 'change-management',
        objective: 'Changes to information processing facilities and systems follow change management procedures.',
        build: changeManagement,
      },
      {
        id: 'A.5.15',
        title: 'Access control',
        category: 'access',
        objective: 'Rules to control physical and logical access are established and attributable.',
        build: accessControl,
      },
      {
        id: 'A.8.15',
        title: 'Logging',
        category: 'logging',
        objective: 'Logs recording activities, exceptions and events are produced, protected and analysed.',
        build: logging,
      },
      {
        id: 'A.8.9',
        title: 'Configuration management',
        category: 'configuration',
        objective: 'Configurations, including security configurations, are established, documented and reviewed.',
        build: configManagement,
      },
    ],
    notEvaluated: [
      { id: 'A.5.18', title: 'Access rights provisioning', reason: 'Managed in your IdP/VCS, not observable from the repository.' },
      { id: 'A.8.8', title: 'Management of technical vulnerabilities', reason: 'No vulnerability-scan results are captured by the audit trail.' },
      { id: 'A.8.13', title: 'Information backup', reason: 'Backup execution is infrastructure-level evidence.' },
      { id: 'A.5.24', title: 'Incident management planning', reason: 'Requires process documentation outside the repository.' },
    ],
  },
};

export function listFrameworks(): ComplianceFramework[] {
  return Object.keys(FRAMEWORKS) as ComplianceFramework[];
}

export interface ComplianceOptions {
  framework: ComplianceFramework;
  since?: Date | null;
  /** Policy pack name or path; defaults to the built-in `recommended` pack. */
  pack?: string;
  now?: () => Date;
  /** Injectable for tests; defaults to the real policy engine. */
  policyRunner?: (root: string, pack?: string) => Promise<PolicySummary>;
  env?: NodeJS.ProcessEnv;
}

async function defaultPolicyRunner(root: string, packRef?: string): Promise<PolicySummary> {
  try {
    const { evaluatePolicyPack, resolvePolicyPack } = await import('../utils/policy-engine');
    const pack = await resolvePolicyPack(packRef);
    const result = await evaluatePolicyPack(pack, root);
    return {
      ran: true,
      pack: result.pack,
      score: result.score,
      passedRules: result.passed.length,
      failedErrors: result.failed.filter(f => f.severity === 'error').length,
      failedWarnings: result.failed.filter(f => f.severity === 'warning').length,
    };
  } catch (error) {
    return { ran: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Build a compliance evidence report for `root`. */
export async function buildComplianceReport(root: string, options: ComplianceOptions): Promise<ComplianceReport> {
  const spec = FRAMEWORKS[options.framework];
  if (!spec) throw new Error(`Unknown framework "${options.framework}". Supported: ${listFrameworks().join(', ')}.`);
  const now = (options.now ?? (() => new Date()))();
  const since = options.since ?? null;

  const verify = verifyAuditLog(root);
  const all = readAuditEntries(root);
  const window = since ? all.filter(e => Date.parse(e.timestamp) >= since.getTime()) : all;
  const settings = readAuditSettings(root, options.env);

  const byCategory: Record<string, number> = {};
  for (const e of window) {
    const cat = classifyCommand({ path: e.command.split(' '), args: e.args }).category;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  const audit: AuditSummary = {
    present: verify.logExists,
    enabled: settings.enabled,
    ...(settings.disabledBy ? { disabledBy: settings.disabledBy } : {}),
    chainValid: verify.valid,
    entriesTotal: verify.entries,
    entriesInWindow: window.length,
    actors: [...new Set(window.map(e => e.actor))].sort(),
    firstTimestamp: window.length ? window[0].timestamp : null,
    lastTimestamp: window.length ? window[window.length - 1].timestamp : null,
    byCategory,
    failedCommands: window.filter(e => e.exitCode !== 0).length,
    verifyFailures: verify.failures.length,
  };

  const policy = await (options.policyRunner ?? defaultPolicyRunner)(root, options.pack);
  const ctx: Context = { audit, verify, settings, window, policy, repo: gatherRepoFacts(root), since };

  const controls: ControlResult[] = spec.controls.map(c => {
    const { evidence, gaps } = c.build(ctx);
    const status: EvidenceStatus = evidence.length === 0 ? 'no-evidence' : gaps.length === 0 ? 'evidence' : 'partial';
    return { id: c.id, title: c.title, category: c.category, objective: c.objective, status, evidence, gaps };
  });

  return {
    framework: options.framework,
    frameworkName: spec.name,
    generatedAt: now.toISOString(),
    since: since ? since.toISOString() : null,
    disclaimer: DISCLAIMER,
    audit,
    policy,
    controls,
    summary: {
      total: controls.length,
      evidence: controls.filter(c => c.status === 'evidence').length,
      partial: controls.filter(c => c.status === 'partial').length,
      noEvidence: controls.filter(c => c.status === 'no-evidence').length,
    },
    notEvaluated: spec.notEvaluated,
  };
}

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  evidence: 'EVIDENCE',
  partial: 'PARTIAL',
  'no-evidence': 'NO EVIDENCE',
};

/** Render the report as Markdown. */
export function renderComplianceMarkdown(r: ComplianceReport): string {
  const lines: string[] = [];
  lines.push(`# Compliance evidence report: ${r.frameworkName}`, '');
  lines.push(`- Generated: ${r.generatedAt}`);
  lines.push(`- Window: ${r.since ? `since ${r.since}` : 'all recorded history'}`);
  lines.push(`- Controls with evidence: ${r.summary.evidence}/${r.summary.total}, partial: ${r.summary.partial}, no evidence: ${r.summary.noEvidence}`);
  lines.push('', `> ${r.disclaimer}`, '');
  lines.push('## Controls', '');
  for (const c of r.controls) {
    lines.push(`### ${c.id} ${c.title} (${STATUS_LABEL[c.status]})`, '', `*${c.objective}*`, '');
    if (c.evidence.length) {
      lines.push('Evidence:');
      for (const e of c.evidence) lines.push(`- [${e.source}] ${e.summary}`);
      lines.push('');
    }
    if (c.gaps.length) {
      lines.push('Gaps:');
      for (const g of c.gaps) lines.push(`- ${g}`);
      lines.push('');
    }
  }
  lines.push('## Not evaluated by this report', '');
  for (const n of r.notEvaluated) lines.push(`- ${n.id} ${n.title}: ${n.reason}`);
  lines.push('');
  return lines.join('\n');
}
