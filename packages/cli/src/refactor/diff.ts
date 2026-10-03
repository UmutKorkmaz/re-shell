// Git-style unified diff rendering for refactor plans.

import { createTwoFilesPatch, structuredPatch } from 'diff';

export interface FileDiff {
  /** Path before the refactor (POSIX, workspace-relative). */
  from: string;
  /** Path after the refactor. */
  to: string;
  /** Text diff; empty for a pure rename. */
  patch: string;
  /** Number of added + removed lines. */
  changedLines: number;
}

/** Render one file's diff (content and/or rename) in git style. */
export function renderFileDiff(from: string, to: string, before: string, after: string): FileDiff {
  const header = [`diff --git a/${from} b/${to}`];
  if (from !== to) {
    header.push('similarity index ' + (before === after ? '100%' : '90%'), `rename from ${from}`, `rename to ${to}`);
  }
  if (before === after) return { from, to, patch: header.join('\n') + '\n', changedLines: 0 };

  const full = createTwoFilesPatch(`a/${from}`, `b/${to}`, before, after, '', '', { context: 3 });
  // drop jsdiff's optional "Index:" + "====" preamble; keep from the --- line
  const fullLines = full.split('\n');
  const body = fullLines.slice(Math.max(0, fullLines.findIndex(l => l.startsWith('--- ')))).join('\n');
  const sp = structuredPatch(from, to, before, after, '', '', { context: 0 });
  const changedLines = sp.hunks.reduce(
    (n, h) => n + h.lines.filter(l => l.startsWith('+') || l.startsWith('-')).length,
    0
  );
  return { from, to, patch: header.join('\n') + '\n' + body, changedLines };
}
