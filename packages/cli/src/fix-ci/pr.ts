// Pull-request opening for `fix --ci --no-dry-run` (R-3).
//
// Pushes ONLY the new `re-shell/fix-ci-*` branch (never the default/base
// branch, never --force) and opens a PR with the `gh` CLI. When gh is missing
// or unauthenticated, there is no remote, or a step fails, nothing is claimed:
// the exact manual steps are returned and the PR is null. Merging is never done.

import { runProcess } from './exec';
import * as git from './git';

export interface OpenPrInput {
  repoRoot: string;
  branch: string;
  base: string;
  title: string;
  body: string;
}

export interface OpenPrResult {
  pr: { url: string; branch: string; base: string } | null;
  manualSteps: string[];
  warnings: string[];
}

/** Injectable PR opener (the default shells out to git + gh). */
export type PrOpener = (input: OpenPrInput) => Promise<OpenPrResult>;

export const FIX_BRANCH_PREFIX = 're-shell/fix-ci-';

function manualSteps(input: OpenPrInput, remote: string | null): string[] {
  const quoted = JSON.stringify(input.title);
  return [
    `git push -u ${remote ?? '<remote>'} ${input.branch}`,
    `gh pr create --base ${input.base} --head ${input.branch} --title ${quoted} --body-file <file with your description>`,
    'or open a pull request from the pushed branch on your git host. Review before merging; re-shell never merges.',
  ];
}

/** Default PR opener. */
export const openPullRequestWithGh: PrOpener = async input => {
  const warnings: string[] = [];
  // Hard safety rails: only ever push our own fix branch, never the base.
  if (!input.branch.startsWith(FIX_BRANCH_PREFIX) || input.branch === input.base) {
    return {
      pr: null,
      manualSteps: [],
      warnings: [`refusing to push "${input.branch}": only ${FIX_BRANCH_PREFIX}* branches are pushed`],
    };
  }
  const remotes = await git.listRemotes(input.repoRoot);
  const remote = remotes.includes('origin') ? 'origin' : (remotes[0] ?? null);
  const steps = manualSteps(input, remote);
  if (!remote) {
    warnings.push('no git remote configured; cannot push or open a PR automatically');
    return { pr: null, manualSteps: steps, warnings };
  }

  const auth = await runProcess(['gh', 'auth', 'status'], { cwd: input.repoRoot, timeoutMs: 30_000 });
  if (auth.spawnError) {
    warnings.push('gh CLI not found; cannot open a PR automatically');
    return { pr: null, manualSteps: steps, warnings };
  }
  if (auth.exitCode !== 0) {
    warnings.push('gh CLI is not authenticated (run `gh auth login`); cannot open a PR automatically');
    return { pr: null, manualSteps: steps, warnings };
  }

  const push = await git.git(input.repoRoot, ['push', '-u', remote, input.branch]);
  if (!push.ok) {
    warnings.push(`git push failed: ${push.stderr.trim().slice(0, 300)}`);
    return { pr: null, manualSteps: steps, warnings };
  }

  const create = await runProcess(
    ['gh', 'pr', 'create', '--base', input.base, '--head', input.branch, '--title', input.title, '--body', input.body],
    { cwd: input.repoRoot, timeoutMs: 60_000 }
  );
  if (create.exitCode !== 0) {
    warnings.push(`gh pr create failed: ${(create.stderr || create.stdout).trim().slice(0, 300)}`);
    return { pr: null, manualSteps: [`gh pr create --base ${input.base} --head ${input.branch} --title ${JSON.stringify(input.title)} --fill`], warnings };
  }
  const url = /https?:\/\/\S+/.exec(create.stdout)?.[0] ?? '';
  if (!url) {
    warnings.push('gh pr create succeeded but printed no URL');
    return { pr: null, manualSteps: [], warnings };
  }
  return { pr: { url, branch: input.branch, base: input.base }, manualSteps: [], warnings };
};
