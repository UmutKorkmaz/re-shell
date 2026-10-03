// Terraform process helpers: binary discovery, a bounded runner, and the
// validation pipeline (fmt -check, init -backend=false, validate, HCL structure).

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { findExecutable } from '../pkg/exec';
import { checkHclStructure } from './hcl';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Spawn error (e.g. ENOENT). */
  error?: string;
  durationMs: number;
}

/** Run a process with no shell and a hard timeout. */
export function runProcess(
  file: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<RunResult> {
  return new Promise(resolve => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(file, args, { cwd: opts.cwd, env: opts.env ?? process.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : null;
    child.stdout.on('data', (d: Buffer) => {
      if (stdout.length < 8 * 1024 * 1024) stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < 8 * 1024 * 1024) stderr += d.toString('utf8');
    });
    child.on('error', err => {
      if (timer) clearTimeout(timer);
      resolve({ code: null, stdout, stderr, timedOut, error: err.message, durationMs: Date.now() - started });
    });
    child.on('close', code => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - started });
    });
  });
}

/** Resolve the terraform binary: `RESHELL_TERRAFORM_BIN`, else `terraform` on PATH. */
export function findTerraform(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.RESHELL_TERRAFORM_BIN;
  if (override) return fs.existsSync(override) ? override : null;
  return findExecutable('terraform', env);
}

export function terraformEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, TF_IN_AUTOMATION: '1', TF_INPUT: '0', CHECKPOINT_DISABLE: '1' };
}

export interface ValidationStep {
  name: 'version' | 'fmt' | 'init' | 'validate' | 'hcl-structure';
  ran: boolean;
  /** null when the step did not run. */
  ok: boolean | null;
  exitCode: number | null;
  output: string;
  /** Why the step did not run or failed in a non-obvious way. */
  reason?: string;
}

export interface ValidationReport {
  terraform: { found: boolean; path?: string; version?: string };
  steps: ValidationStep[];
  /** True only when `terraform init -backend=false` AND `terraform validate` both ran and passed. */
  validated: boolean;
  /** `terraform fmt -check` result; null when it did not run. */
  formatted: boolean | null;
  /** Whether provider plugins could be installed by init; null when init did not run. */
  providersInstalled: boolean | null;
  summary: string;
}

const tail = (s: string, n = 8000): string => (s.length > n ? '…' + s.slice(-n) : s);

function structureStep(dir: string): ValidationStep {
  const issues: string[] = [];
  let count = 0;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.tf')).sort()) {
    count++;
    for (const i of checkHclStructure(fs.readFileSync(path.join(dir, f), 'utf8'))) issues.push(`${f}:${i.line}: ${i.message}`);
  }
  return {
    name: 'hcl-structure',
    ran: true,
    ok: issues.length === 0 && count > 0,
    exitCode: null,
    output: count === 0 ? 'no .tf files found' : issues.length === 0 ? `${count} file(s) structurally sound (balanced blocks, terminated strings; NOT a full HCL parse)` : issues.join('\n'),
  };
}

const PROVIDER_FETCH_ERROR = /(Failed to query available provider packages|Failed to install provider|could not connect to registry|Error while installing|registry\.terraform\.io|no available releases match|dial tcp|i\/o timeout|TLS handshake|connection refused|Could not retrieve the list of available versions)/i;

/**
 * Validate a Terraform directory: `fmt -check`, `init -backend=false`,
 * `validate`, plus a structural HCL check. Runs in a temp copy unless
 * `inPlace` (so `.terraform/` never pollutes the output directory).
 * Every step reports whether it actually ran; nothing is assumed.
 */
export async function validateTerraformDir(
  dir: string,
  options: { inPlace?: boolean; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<ValidationReport> {
  const env = terraformEnv(options.env ?? process.env);
  const steps: ValidationStep[] = [];
  const bin = findTerraform(env);
  const report: ValidationReport = {
    terraform: { found: bin !== null, ...(bin ? { path: bin } : {}) },
    steps,
    validated: false,
    formatted: null,
    providersInstalled: null,
    summary: '',
  };

  let work = dir;
  let cleanup: (() => void) | null = null;
  if (!options.inPlace) {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-iac-validate-'));
    for (const f of fs.readdirSync(dir)) {
      const src = path.join(dir, f);
      if (f === '.terraform' || !fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(work, f));
    }
    cleanup = () => fs.rmSync(work, { recursive: true, force: true });
  }

  try {
    steps.push(structureStep(work));
    if (!bin) {
      steps.unshift({
        name: 'version',
        ran: false,
        ok: null,
        exitCode: null,
        output: '',
        reason: 'terraform was not found on PATH (set RESHELL_TERRAFORM_BIN or install terraform)',
      });
      report.summary = 'terraform not found: only the structural HCL check ran; fmt, init and validate were NOT run';
      return report;
    }

    const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
    const ver = await runProcess(bin, ['version'], { cwd: work, env, timeoutMs: 60_000 });
    report.terraform.version = /Terraform v(\S+)/.exec(ver.stdout)?.[1];
    steps.push({ name: 'version', ran: true, ok: ver.code === 0, exitCode: ver.code, output: tail(ver.stdout.trim()) });

    const fmt = await runProcess(bin, ['fmt', '-check', '-diff', '-no-color'], { cwd: work, env, timeoutMs: 120_000 });
    report.formatted = fmt.code === 0;
    steps.push({ name: 'fmt', ran: true, ok: fmt.code === 0, exitCode: fmt.code, output: tail((fmt.stdout + fmt.stderr).trim()) });

    const init = await runProcess(bin, ['init', '-backend=false', '-input=false', '-no-color'], { cwd: work, env, timeoutMs });
    const initOut = (init.stdout + init.stderr).trim();
    const providerIssue = init.code !== 0 && (init.timedOut || PROVIDER_FETCH_ERROR.test(initOut));
    report.providersInstalled = init.code === 0;
    steps.push({
      name: 'init',
      ran: true,
      ok: init.code === 0,
      exitCode: init.code,
      output: tail(initOut),
      ...(providerIssue
        ? { reason: 'provider plugins could not be downloaded (registry unreachable or blocked); validate was not run. CI (iac-validate.yml) runs the full init + validate.' }
        : {}),
    });
    if (init.code !== 0) {
      steps.push({ name: 'validate', ran: false, ok: null, exitCode: null, output: '', reason: 'terraform init failed' });
      report.summary = providerIssue
        ? 'init could not fetch providers: fmt and structural checks ran, but terraform validate was NOT run'
        : 'terraform init failed; validate was NOT run';
      return report;
    }

    const val = await runProcess(bin, ['validate', '-json', '-no-color'], { cwd: work, env, timeoutMs: 300_000 });
    let valid = val.code === 0;
    let rendered = (val.stdout + val.stderr).trim();
    try {
      const parsed = JSON.parse(val.stdout) as { valid?: boolean; diagnostics?: Array<{ severity: string; summary: string; detail?: string; range?: { filename: string; start: { line: number } } }> };
      valid = parsed.valid === true;
      rendered = (parsed.diagnostics ?? [])
        .map(d => `${d.severity}: ${d.summary}${d.range ? ` (${d.range.filename}:${d.range.start.line})` : ''}${d.detail ? `\n  ${d.detail}` : ''}`)
        .join('\n') || (valid ? 'The configuration is valid.' : rendered);
    } catch {
      /* keep raw output */
    }
    steps.push({ name: 'validate', ran: true, ok: valid, exitCode: val.code, output: tail(rendered) });
    report.validated = valid;
    const structure = steps.find(s => s.name === 'hcl-structure');
    report.summary = valid
      ? `terraform ${report.terraform.version ?? ''} init -backend=false + validate passed${report.formatted ? ', fmt clean' : ', fmt reported differences'}${structure?.ok === false ? ', structural check failed' : ''}`
      : 'terraform validate reported errors';
    return report;
  } finally {
    cleanup?.();
  }
}
