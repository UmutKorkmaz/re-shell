// The real `fix --ci` loop (R-3).
//
//   preconditions (git repo, clean tree) -> resolve gates -> baseline evaluation
//   -> (green? done) -> (no provider? report-only) -> new branch
//   -> iterate: propose patch -> validate -> apply -> re-evaluate gates
//        regression / rejected / failing-to-apply => roll the patch back
//   -> green: commit exactly the touched files; --no-dry-run also opens a PR
//   -> not green: roll every kept patch back and delete the work branch
//   -> always return to the branch the run started on.
//
// The loop never pushes to or merges into the starting/default branch.

import * as fs from 'fs';
import * as path from 'path';
import type { FixCiGateResult, FixCiResponse, FixLoopIteration } from '@re-shell/contracts';
import { proposeAndApply, rollbackPatch, type AttemptNote } from './applier';
import { resolveFixCiConfig } from './config';
import { killActiveChildren } from './exec';
import { allPassed, evaluateGates, failingGateNames, isRegression } from './gates';
import * as git from './git';
import type { PatchValidationContext } from './patch';
import { FIX_BRANCH_PREFIX, openPullRequestWithGh, type PrOpener } from './pr';
import type { FixProvider } from './provider';
import { FixCiError } from './types';

export const DEFAULT_MAX_ITERATIONS = 5;

export interface RealFixCiOptions {
  /** Workspace directory (must be inside a git work tree). */
  cwd: string;
  maxIterations?: number;
  /** Default true: never push or open a PR. */
  dryRun: boolean;
  allowDirty?: boolean;
  skipGates?: readonly string[];
  /** The fix applier. null => report-only mode (no fixes are attempted or claimed). */
  provider: FixProvider | null;
  openPr?: PrOpener;
  now?: () => Date;
}

function timestamp(d: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

async function uniqueBranchName(root: string, now: Date): Promise<string> {
  const base = `${FIX_BRANCH_PREFIX}${timestamp(now)}`;
  let name = base;
  for (let n = 2; await git.branchExists(root, name); n++) name = `${base}-${n}`;
  return name;
}

function failingSummary(results: readonly FixCiGateResult[]): string {
  const names = failingGateNames(results);
  return names.length === 0 ? 'none' : names.join(', ');
}

/**
 * Run the real loop. Throws {@link FixCiError} for precondition/config
 * failures; every other outcome (green, red, report-only) is returned as a
 * {@link FixCiResponse} whose `verdict` decides the exit code.
 */
export async function runRealFixCi(options: RealFixCiOptions): Promise<FixCiResponse> {
  const now = options.now ?? (() => new Date());
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const warnings: string[] = [];
  const workspaceRoot = path.resolve(options.cwd);

  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new FixCiError('FIX_CI_CONFIG_INVALID', '--max-iterations must be a positive integer');
  }

  // 1. git repo + clean tree.
  const repoRoot = await git.repoRoot(workspaceRoot);
  if (!repoRoot) {
    throw new FixCiError('FIX_CI_NOT_A_REPO', `${workspaceRoot} is not inside a git work tree; fix --ci needs git to roll back safely`);
  }
  const realRepo = fs.realpathSync(repoRoot);
  const realWorkspace = fs.realpathSync(workspaceRoot);
  const workspaceRel = path.relative(realRepo, realWorkspace).split(path.sep).join('/');
  const dirty = await git.dirtyFiles(repoRoot);
  if (dirty.length > 0 && !options.allowDirty) {
    throw new FixCiError(
      'FIX_CI_DIRTY_TREE',
      `the git work tree has ${dirty.length} uncommitted change(s); commit or stash them first, or pass --allow-dirty`,
      { files: dirty.slice(0, 50) }
    );
  }
  if (dirty.length > 0) warnings.push(`--allow-dirty: ${dirty.length} pre-existing uncommitted change(s) will not be touched or committed`);
  const dirtyPaths = new Set(dirty);

  // 2. gates.
  const config = resolveFixCiConfig(workspaceRoot, { skipGates: options.skipGates });
  warnings.push(...config.warnings);
  const gateDefs = config.gates;
  const gatesInfo = {
    source: config.source,
    definitions: gateDefs.map(g => ({ name: g.name, kind: g.kind, locked: g.locked, command: [...g.command] })),
  };

  const baseBranch = await git.currentBranch(repoRoot);
  const baseSha = await git.headSha(repoRoot);

  // 3. baseline evaluation on the starting branch.
  const baseline = await evaluateGates(gateDefs, workspaceRoot);
  const provider = options.provider;
  const iterations: FixLoopIteration[] = [];
  const baseResponse = {
    prOpened: false,
    prUrl: '',
    pr: null,
    warnings,
    gates: gatesInfo,
    provider: provider ? provider.name : null,
    baseBranch,
    branch: null as string | null,
  };

  if (allPassed(baseline)) {
    return {
      ...baseResponse,
      outcome: 'already-green',
      verdict: 'green',
      gatesPassed: true,
      iterations: [
        {
          iteration: 1,
          gatesBefore: { passed: true, failingGates: [] },
          gateResultsBefore: baseline,
        },
      ],
      appliedFixes: [],
      summary: 'All gates already green; nothing to fix.',
      finalGates: baseline,
    };
  }

  if (!provider) {
    return {
      ...baseResponse,
      outcome: 'report-only',
      verdict: 'red',
      gatesPassed: false,
      iterations: [
        {
          iteration: 1,
          gatesBefore: { passed: false, failingGates: failingGateNames(baseline) },
          gateResultsBefore: baseline,
        },
      ],
      appliedFixes: [],
      summary:
        `Gates are red (${failingSummary(baseline)}) and no fix provider is configured, so no fix was attempted. ` +
        'Set ANTHROPIC_API_KEY to enable the AI fix applier. This run is report-only and never claims a fix.',
      finalGates: baseline,
    };
  }

  // 4. work on a new branch.
  const branch = await uniqueBranchName(repoRoot, now());
  await git.createBranch(repoRoot, branch);

  const validation: PatchValidationContext = {
    repoRoot,
    workspaceRel,
    limits: config.limits,
    protectedGlobs: config.protectedPaths,
    dirtyPaths,
  };

  const kept: Array<{ patch: string; files: string[] }> = [];
  const appliedFixes: FixCiResponse['appliedFixes'] = [];
  const attempts: AttemptNote[] = [];
  let current = baseline;
  let green = false;
  let providerError: string | null = null;
  let declined = false;
  let lastIterationKept = false;
  const prevPatches = new Set<string>();

  // Ctrl-C / SIGTERM mid-run: stop the gates, undo kept patches, leave the
  // starting branch exactly as it was. (Gates run in their own process groups,
  // so the terminal's signal does not reach them.)
  let committed = false;
  const onSignal = (signal: NodeJS.Signals): void => {
    killActiveChildren();
    // After the commit the fix is safe on its branch: just return to the start.
    git.emergencyRestoreSync(
      repoRoot,
      committed ? [] : [...kept].reverse().map(k => k.patch),
      baseBranch,
      baseSha,
      branch,
      committed
    );
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    for (let i = 1; i <= maxIterations; i++) {
      lastIterationKept = false;
      const entry: FixLoopIteration = {
        iteration: i,
        gatesBefore: { passed: false, failingGates: failingGateNames(current) },
        gateResultsBefore: current,
      };
      iterations.push(entry);

      const attempt = await proposeAndApply({
        provider,
        gates: current,
        previousAttempts: attempts,
        workspaceRoot,
        validation,
      });

      if (attempt.kind === 'provider-error') {
        providerError = attempt.message;
        entry.fix = { fixId: `provider-error-${i}`, description: attempt.message, changed: false };
        entry.rolledBack = true;
        break;
      }
      if (attempt.kind === 'declined') {
        declined = true;
        entry.fix = { fixId: `declined-${i}`, description: attempt.explanation, changed: false };
        entry.rolledBack = true;
        break;
      }
      if (attempt.kind === 'rejected') {
        attempts.push({ iteration: i, note: `patch rejected: ${attempt.reason}` });
        entry.patch = {
          accepted: false,
          files: [],
          filesChanged: 0,
          additions: 0,
          deletions: 0,
          rejectedReason: attempt.reason,
          ...(attempt.explanation ? { explanation: attempt.explanation } : {}),
        };
        entry.fix = {
          fixId: `patch-${i}`,
          description: `rejected: ${attempt.reason}`,
          changed: false,
        };
        entry.rolledBack = true;
        continue;
      }

      // Applied. Track the patch as kept right away so a signal or an error
      // while the gates run still rolls it back; it is popped if it regresses.
      kept.push({ patch: attempt.patch, files: attempt.files.map(f => f.path) });
      const after = await evaluateGates(gateDefs, workspaceRoot);
      entry.gatesAfter = { passed: allPassed(after), failingGates: failingGateNames(after) };
      entry.gateResultsAfter = after;
      entry.patch = {
        accepted: true,
        files: attempt.files,
        filesChanged: attempt.files.length,
        additions: attempt.additions,
        deletions: attempt.deletions,
        ...(attempt.explanation ? { explanation: attempt.explanation } : {}),
      };

      if (isRegression(current, after) || prevPatches.has(attempt.patch)) {
        const why = isRegression(current, after)
          ? `made things worse (failing: ${failingSummary(after)})`
          : 'repeated an earlier patch';
        await rollbackPatch(repoRoot, attempt.patch);
        kept.pop();
        attempts.push({ iteration: i, note: `patch ${why}; it was reverted` });
        entry.fix = { fixId: `patch-${i}`, description: `reverted: ${why}`, changed: false };
        entry.rolledBack = true;
        continue;
      }
      prevPatches.add(attempt.patch);

      lastIterationKept = true;
      entry.fix = {
        fixId: `patch-${i}`,
        description: attempt.explanation || `applied patch touching ${attempt.files.map(f => f.path).join(', ')}`,
        changed: true,
      };
      appliedFixes.push(entry.fix);
      entry.rolledBack = false;
      current = after;
      if (allPassed(after)) {
        green = true;
        break;
      }
      attempts.push({
        iteration: i,
        note: `patch applied but gates still failing (${failingSummary(after)}); it was kept, continue from the new state`,
      });
    }

    const finalGates = current;
    const common = {
      ...baseResponse,
      iterations,
      appliedFixes,
      finalGates,
      branch: null as string | null,
    };

    if (green) {
      // Commit exactly the files the kept patches touched.
      const files = [...new Set(kept.flatMap(k => k.files))];
      const message = `fix(ci): make gates pass (re-shell fix --ci)\n\n${appliedFixes
        .map(f => `- ${f.description}`)
        .join('\n')}`;
      try {
        await git.commitFiles(repoRoot, files, message);
        committed = true;
      } catch (err) {
        throw new FixCiError(
          'FIX_CI_ERROR',
          `gates are green but the commit failed: ${(err as Error).message}. The verified changes are left uncommitted on branch ${branch}.`,
          { branch }
        );
      }

      let prUrl = '';
      let pr: FixCiResponse['pr'] = null;
      let manualSteps: string[] | undefined;
      if (!options.dryRun) {
        const prBase = baseBranch ?? (await git.defaultBranch(repoRoot)) ?? 'main';
        const opener = options.openPr ?? openPullRequestWithGh;
        const result = await opener({
          repoRoot,
          branch,
          base: prBase,
          title: 'fix(ci): make failing gates pass',
          body: renderPrBody(appliedFixes, iterations, finalGates),
        });
        warnings.push(...result.warnings);
        if (result.pr) {
          pr = result.pr;
          prUrl = result.pr.url;
        } else {
          manualSteps = result.manualSteps;
        }
      }
      await git.switchBack(repoRoot, baseBranch, baseSha);
      const summaryTail = pr
        ? `PR opened: ${prUrl}.`
        : options.dryRun
          ? `Dry run: the fix is committed locally on branch ${branch} (not pushed); use --no-dry-run to push it and open a PR.`
          : `No PR was opened; the fix is committed locally on branch ${branch}. See manualSteps.`;
      return {
        ...common,
        branch,
        outcome: 'pr-ready',
        verdict: 'green',
        gatesPassed: true,
        prOpened: Boolean(pr),
        prUrl,
        pr,
        ...(manualSteps ? { manualSteps } : {}),
        summary: `All gates passed after ${appliedFixes.length} patch(es). ${summaryTail} Merging stays human-controlled.`,
      };
    }

    // Not green: undo everything and drop the work branch.
    for (const k of [...kept].reverse()) {
      await rollbackPatch(repoRoot, k.patch);
    }
    for (const it of iterations) {
      if (it.fix?.changed) it.rolledBack = true;
    }
    await git.switchBack(repoRoot, baseBranch, baseSha);
    await git.deleteBranch(repoRoot, branch);

    let outcome: FixCiResponse['outcome'];
    let summary: string;
    if (providerError) {
      outcome = 'provider-error';
      summary = `The fix provider failed at iteration ${iterations.length}: ${providerError}. All changes were rolled back; gates are still red (${failingSummary(baseline)}).`;
    } else if (declined) {
      outcome = 'no-progress';
      summary = `The provider proposed no safe fix at iteration ${iterations.length}. All changes were rolled back; gates are still red (${failingSummary(baseline)}).`;
    } else if (kept.length > 0 && lastIterationKept) {
      outcome = 'bounded-out';
      summary = `Iteration budget (${maxIterations}) exhausted with gates still red (${failingSummary(finalGates)}). All changes were rolled back.`;
    } else if (kept.length > 0) {
      outcome = 'no-progress';
      summary = `Stopped after ${iterations.length} iteration(s) without reaching green (still failing: ${failingSummary(finalGates)}). All changes were rolled back.`;
    } else {
      outcome = 'no-progress';
      summary = `No acceptable patch in ${iterations.length} iteration(s) (every proposal was rejected or made things worse). Nothing was changed; gates are still red (${failingSummary(baseline)}).`;
    }
    return {
      ...common,
      outcome,
      verdict: 'red',
      gatesPassed: false,
      summary,
    };
  } catch (err) {
    // A failed commit leaves the verified fix uncommitted on the work branch on purpose.
    if (err instanceof FixCiError && err.code === 'FIX_CI_ERROR' && err.details?.branch === branch) {
      throw err;
    }
    // Unexpected failure: restore the starting point as far as possible.
    for (const k of [...kept].reverse()) {
      try {
        await rollbackPatch(repoRoot, k.patch);
      } catch {
        /* best effort */
      }
    }
    try {
      await git.switchBack(repoRoot, baseBranch, baseSha);
      await git.deleteBranch(repoRoot, branch);
    } catch {
      /* best effort */
    }
    throw err;
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

function renderPrBody(
  fixes: FixCiResponse['appliedFixes'],
  iterations: readonly FixLoopIteration[],
  gates: readonly FixCiGateResult[]
): string {
  const lines = [
    'Automated CI fix generated by `re-shell fix --ci`. All gates passed locally after the changes below.',
    '',
    '## Changes',
    ...fixes.map(f => `- ${f.description}`),
    '',
    '## Patches',
    ...iterations
      .filter(it => it.patch?.accepted && it.fix?.changed)
      .map(
        it =>
          `- iteration ${it.iteration}: ${it.patch!.filesChanged} file(s), +${it.patch!.additions}/-${it.patch!.deletions}: ` +
          it.patch!.files.map(f => f.path).join(', ')
      ),
    '',
    '## Gates',
    ...gates.map(g => `- ${g.name}${g.locked ? ' (locked)' : ''}: ${g.passed ? 'pass' : 'FAIL'}`),
    '',
    'Please review before merging. re-shell never merges or pushes to protected branches.',
  ];
  return lines.join('\n');
}
