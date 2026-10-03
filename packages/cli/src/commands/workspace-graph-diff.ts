/**
 * `re-shell workspace graph diff --base <git-ref|file.json> [--head <git-ref|file.json>]`
 *
 * Computes added / removed / changed workspaces and dependency edges between
 * two graphs, for PR review. A git ref is read from git history (manifest files
 * only, see utils/graph-source.ts); a `.json` argument is a saved graph
 * document; an omitted head is the working tree.
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { diffGraphs, diffToMermaid } from '@re-shell/contracts';
import type { ErrorCode, WorkspaceGraphDiff } from '@re-shell/contracts';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { GraphSourceError, loadGraphSide, requireMonorepoRoot } from '../utils/graph-source';

export interface WorkspaceGraphDiffOptions {
  base: string;
  head?: string;
  json?: boolean;
  /** `text` (default), `json` (same as --json) or `mermaid`. */
  format?: string;
  output?: string;
  /** Directory to start the monorepo-root search from. Defaults to the cwd. */
  cwd?: string;
}

const FORMATS = new Set(['text', 'json', 'mermaid']);

/** Compute the diff payload (shared by the command and tests). */
export async function computeWorkspaceGraphDiff(
  options: Pick<WorkspaceGraphDiffOptions, 'base' | 'head' | 'cwd'>
): Promise<WorkspaceGraphDiff> {
  const root = await requireMonorepoRoot(options.cwd ?? process.cwd());
  const [base, head] = await Promise.all([
    loadGraphSide(root, options.base),
    loadGraphSide(root, options.head),
  ]);
  return { ...diffGraphs(base.graph, head.graph), base: base.side, head: head.side };
}

/** Human-readable report. */
export function renderGraphDiffText(diff: WorkspaceGraphDiff): string {
  const lines: string[] = [];
  const s = diff.summary;
  lines.push(chalk.bold(`Workspace graph diff: ${diff.base.ref} -> ${diff.head.ref}`));
  lines.push(
    chalk.gray(
      `  base: ${diff.base.nodeCount} nodes, ${diff.base.edgeCount} edges   head: ${diff.head.nodeCount} nodes, ${diff.head.edgeCount} edges`
    )
  );
  if (!s.hasChanges) {
    lines.push('', chalk.green('No differences: the dependency graphs are identical.'));
    return lines.join('\n');
  }
  lines.push(
    '',
    `Nodes: ${chalk.green(`+${s.nodesAdded}`)} ${chalk.red(`-${s.nodesRemoved}`)} ${chalk.yellow(`~${s.nodesChanged}`)}   ` +
      `Edges: ${chalk.green(`+${s.edgesAdded}`)} ${chalk.red(`-${s.edgesRemoved}`)} ${chalk.yellow(`~${s.edgesChanged}`)}`
  );
  const section = (title: string, rows: string[]): void => {
    if (rows.length === 0) return;
    lines.push('', chalk.bold(title), ...rows.map((r) => `  ${r}`));
  };
  section('Added nodes', diff.nodes.added.map((n) => chalk.green(`+ ${n.id} (${n.type})`)));
  section('Removed nodes', diff.nodes.removed.map((n) => chalk.red(`- ${n.id} (${n.type})`)));
  section(
    'Changed nodes',
    diff.nodes.changed.map((c) =>
      chalk.yellow(
        `~ ${c.id}: ` +
          c.fields
            .map((f) => `${f} ${String((c.before as Record<string, unknown>)[f] ?? '-')} -> ${String((c.after as Record<string, unknown>)[f] ?? '-')}`)
            .join(', ')
      )
    )
  );
  section('Added edges', diff.edges.added.map((e) => chalk.green(`+ ${e.from} -> ${e.to} (${e.type})`)));
  section('Removed edges', diff.edges.removed.map((e) => chalk.red(`- ${e.from} -> ${e.to} (${e.type})`)));
  section(
    'Changed edges',
    diff.edges.changed.map((e) => chalk.yellow(`~ ${e.from} -> ${e.to}: ${e.before} -> ${e.after}`))
  );
  section('Cycles introduced', diff.cyclesIntroduced.map((c) => chalk.red(`! ${[...c, c[0]].join(' -> ')}`)));
  return lines.join('\n');
}

function errorCodeOf(error: unknown): ErrorCode {
  if (error instanceof GraphSourceError) return error.code;
  return 'GRAPH_DIFF_ERROR';
}

/** Entry point for the command. Sets a non-zero exit code on any failure. */
export async function runWorkspaceGraphDiff(options: WorkspaceGraphDiffOptions): Promise<void> {
  const format = options.json ? 'json' : (options.format ?? 'text');
  const wantsMermaid = options.format === 'mermaid';
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    if (!FORMATS.has(format) && !options.json) {
      throw new GraphSourceError(
        'GRAPH_DIFF_INVALID_INPUT',
        `Unsupported --format "${options.format}". Use text, json or mermaid.`
      );
    }
    if (!options.base) {
      throw new GraphSourceError('GRAPH_DIFF_INVALID_INPUT', '--base <git-ref|file.json> is required');
    }

    const diff = await computeWorkspaceGraphDiff(options);

    if (options.json) {
      ok(wantsMermaid ? { ...diff, mermaid: diffToMermaid(diff) } : diff);
      return;
    }

    const body = format === 'mermaid' ? diffToMermaid(diff) : format === 'json' ? JSON.stringify(diff, null, 2) : renderGraphDiffText(diff);
    if (options.output) {
      const out = path.resolve(options.output);
      await fs.mkdirp(path.dirname(out));
      await fs.writeFile(out, body.endsWith('\n') ? body : `${body}\n`);
      console.log(chalk.green(`Graph diff written to ${options.output}`));
    } else {
      console.log(body);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      fail(errorCodeOf(error), message);
    } else {
      console.error(chalk.red(`Error: ${message}`));
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}
