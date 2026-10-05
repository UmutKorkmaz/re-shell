/**
 * Small, dependency-free unified-diff generator used by the `create --dry-run`
 * preview to show what a re-scaffold would change in an existing file.
 *
 * It diffs line-by-line with a longest-common-subsequence on the part of the
 * file between the shared head and tail, groups the changes into hunks with
 * context, and prints the standard `--- / +++ / @@ -a,b +c,d @@` format
 * (including the "\ No newline at end of file" marker) so the output reads like
 * `diff -u` and can be fed to `patch`.
 */

/** Options for {@link createUnifiedDiff}. */
export interface UnifiedDiffOptions {
  /** Label for the "old" side header (default `a`). */
  oldLabel?: string;
  /** Label for the "new" side header (default `b`). */
  newLabel?: string;
  /** Lines of unchanged context around each hunk (default 3). */
  context?: number;
  /** Cap on emitted diff lines; the remainder is summarised (default 400). */
  maxLines?: number;
}

type Op = { type: ' ' | '-' | '+'; text: string; noEol: boolean };

/** Beyond this many LCS cells the middle of the file is treated as fully replaced. */
const MAX_LCS_CELLS = 4_000_000;

interface SplitText {
  lines: string[];
  /** True when the text is non-empty and does not end with a newline. */
  noEol: boolean;
}

function splitLines(text: string): SplitText {
  if (text === '') return { lines: [], noEol: false };
  const noEol = !text.endsWith('\n');
  const body = noEol ? text : text.slice(0, -1);
  return { lines: body.split('\n'), noEol };
}

/** Compute the edit script between two line arrays (each line carries its EOL flag). */
function diffLines(a: Op[], b: Op[]): Op[] {
  let head = 0;
  while (head < a.length && head < b.length && same(a[head], b[head])) head++;

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    same(a[a.length - 1 - tail], b[b.length - 1 - tail])
  ) {
    tail++;
  }

  const ops: Op[] = [];
  for (let i = 0; i < head; i++) ops.push({ type: ' ', text: a[i].text, noEol: a[i].noEol });

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  ops.push(...diffMiddle(midA, midB));

  for (let i = a.length - tail; i < a.length; i++) {
    ops.push({ type: ' ', text: a[i].text, noEol: a[i].noEol });
  }
  return ops;
}

function same(x: Op, y: Op): boolean {
  return x.text === y.text && x.noEol === y.noEol;
}

function diffMiddle(a: Op[], b: Op[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map(l => ({ type: '+' as const, text: l.text, noEol: l.noEol }));
  if (m === 0) return a.map(l => ({ type: '-' as const, text: l.text, noEol: l.noEol }));

  if ((n + 1) * (m + 1) > MAX_LCS_CELLS) {
    return [
      ...a.map(l => ({ type: '-' as const, text: l.text, noEol: l.noEol })),
      ...b.map(l => ({ type: '+' as const, text: l.text, noEol: l.noEol })),
    ];
  }

  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] = same(a[i], b[j])
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(a[i], b[j])) {
      ops.push({ type: ' ', text: a[i].text, noEol: a[i].noEol });
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      ops.push({ type: '-', text: a[i].text, noEol: a[i].noEol });
      i++;
    } else {
      ops.push({ type: '+', text: b[j].text, noEol: b[j].noEol });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: '-', text: a[i].text, noEol: a[i].noEol });
    i++;
  }
  while (j < m) {
    ops.push({ type: '+', text: b[j].text, noEol: b[j].noEol });
    j++;
  }
  return ops;
}

function toOps(split: SplitText): Op[] {
  return split.lines.map((text, idx) => ({
    type: ' ' as const,
    text,
    noEol: split.noEol && idx === split.lines.length - 1,
  }));
}

function formatRange(start: number, count: number): string {
  // Unified diff: an empty range is reported as the line *before* the change.
  if (count === 0) return `${start},0`;
  if (count === 1) return `${start}`;
  return `${start},${count}`;
}

/**
 * Produce a unified diff turning `oldText` into `newText`.
 *
 * @param oldText - The existing content.
 * @param newText - The content that would replace it.
 * @param options - Labels, context size and output cap.
 * @returns The diff text, or an empty string when the inputs are identical.
 */
export function createUnifiedDiff(
  oldText: string,
  newText: string,
  options: UnifiedDiffOptions = {}
): string {
  if (oldText === newText) return '';

  const context = options.context ?? 3;
  const maxLines = options.maxLines ?? 400;
  const oldLabel = options.oldLabel ?? 'a';
  const newLabel = options.newLabel ?? 'b';

  const ops = diffLines(toOps(splitLines(oldText)), toOps(splitLines(newText)));

  // Locate changed op indices, then merge them into hunks separated by > 2*context unchanged lines.
  const changed: number[] = [];
  ops.forEach((op, idx) => {
    if (op.type !== ' ') changed.push(idx);
  });
  if (changed.length === 0) return '';

  const hunks: Array<{ start: number; end: number }> = [];
  for (const idx of changed) {
    const start = Math.max(0, idx - context);
    const end = Math.min(ops.length - 1, idx + context);
    const last = hunks[hunks.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      hunks.push({ start, end });
    }
  }

  // Precompute the 1-based old/new line number at the start of each op.
  const oldLineAt: number[] = [];
  const newLineAt: number[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (const op of ops) {
    oldLineAt.push(oldLine);
    newLineAt.push(newLine);
    if (op.type !== '+') oldLine++;
    if (op.type !== '-') newLine++;
  }

  const out: string[] = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  for (const hunk of hunks) {
    const slice = ops.slice(hunk.start, hunk.end + 1);
    const oldCount = slice.filter(op => op.type !== '+').length;
    const newCount = slice.filter(op => op.type !== '-').length;
    const oldStart = oldCount === 0 ? oldLineAt[hunk.start] - 1 : oldLineAt[hunk.start];
    const newStart = newCount === 0 ? newLineAt[hunk.start] - 1 : newLineAt[hunk.start];
    out.push(`@@ -${formatRange(oldStart, oldCount)} +${formatRange(newStart, newCount)} @@`);
    for (const op of slice) {
      out.push(`${op.type}${op.text}`);
      if (op.noEol) out.push('\\ No newline at end of file');
    }
  }

  if (out.length > maxLines) {
    const hidden = out.length - maxLines;
    return [...out.slice(0, maxLines), `... diff truncated (${hidden} more lines)`].join('\n') + '\n';
  }
  return out.join('\n') + '\n';
}
