import { describe, expect, it } from 'vitest';
import { createUnifiedDiff } from '../../src/utils/unified-diff';

/**
 * Apply a unified diff produced by createUnifiedDiff back onto `oldText`. Used
 * to prove the diff is a faithful patch (old -> new), not just plausible text.
 */
function applyDiff(oldText: string, diff: string): string {
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const hadTrailingNewline = oldText.endsWith('\n');
  if (hadTrailingNewline) oldLines.pop();

  const out: string[] = [];
  let cursor = 0; // index into oldLines
  const lines = diff.split('\n');
  let newEndsWithNewline = hadTrailingNewline;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@$/.exec(line);
    if (!header) continue;

    const oldStart = Number(header[1]);
    const oldCount = header[2] === undefined ? 1 : Number(header[2]);
    const hunkStart = oldCount === 0 ? oldStart : oldStart - 1;
    while (cursor < hunkStart) out.push(oldLines[cursor++]);

    for (i = i + 1; i < lines.length; i++) {
      const body = lines[i];
      if (body.startsWith('@@') || body === '') {
        i--;
        break;
      }
      if (body.startsWith('\\ No newline')) {
        // The marker applies to the previous line's side.
        const previous = lines[i - 1];
        if (previous.startsWith('+') || previous.startsWith(' ')) newEndsWithNewline = false;
        continue;
      }
      const tag = body[0];
      const text = body.slice(1);
      if (tag === ' ') {
        out.push(oldLines[cursor++]);
      } else if (tag === '-') {
        cursor++;
      } else if (tag === '+') {
        out.push(text);
        newEndsWithNewline = true;
      }
    }
  }
  while (cursor < oldLines.length) out.push(oldLines[cursor++]);
  return out.join('\n') + (newEndsWithNewline && out.length > 0 ? '\n' : '');
}

describe('createUnifiedDiff', () => {
  it('returns an empty string for identical input', () => {
    expect(createUnifiedDiff('a\nb\n', 'a\nb\n')).toBe('');
    expect(createUnifiedDiff('', '')).toBe('');
  });

  it('renders a single changed line with headers and a hunk', () => {
    const diff = createUnifiedDiff('one\ntwo\nthree\n', 'one\n2\nthree\n', {
      oldLabel: 'a/f.txt',
      newLabel: 'b/f.txt',
    });
    expect(diff).toBe(
      ['--- a/f.txt', '+++ b/f.txt', '@@ -1,3 +1,3 @@', ' one', '-two', '+2', ' three', ''].join('\n')
    );
  });

  it('shows pure insertions and pure deletions', () => {
    const insert = createUnifiedDiff('a\nc\n', 'a\nb\nc\n');
    expect(insert).toContain('+b');
    expect(insert).not.toMatch(/^-[^-]/m);

    const remove = createUnifiedDiff('a\nb\nc\n', 'a\nc\n');
    expect(remove).toContain('-b');
    expect(remove).not.toMatch(/^\+[^+]/m);
  });

  it('diffs against an empty file (all additions) and to an empty file (all deletions)', () => {
    const added = createUnifiedDiff('', 'x\ny\n');
    expect(added).toContain('@@ -0,0 +1,2 @@');
    expect(added).toContain('+x\n+y\n');

    const removed = createUnifiedDiff('x\ny\n', '');
    expect(removed).toContain('@@ -1,2 +0,0 @@');
    expect(removed).toContain('-x\n-y\n');
  });

  it('limits context and splits distant changes into separate hunks', () => {
    const base = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const changed = [...base];
    changed[2] = 'CHANGED 3';
    changed[36] = 'CHANGED 37';
    const diff = createUnifiedDiff(base.join('\n') + '\n', changed.join('\n') + '\n', { context: 2 });

    const hunks = diff.split('\n').filter(l => l.startsWith('@@'));
    expect(hunks).toHaveLength(2);
    // Unchanged lines far from a change are not echoed.
    expect(diff).not.toContain(' line 20');
  });

  it('merges nearby changes into one hunk', () => {
    const diff = createUnifiedDiff('1\n2\n3\n4\n5\n6\n', '1\nX\n3\n4\nY\n6\n', { context: 3 });
    expect(diff.split('\n').filter(l => l.startsWith('@@'))).toHaveLength(1);
  });

  it('marks a missing newline at end of file', () => {
    const diff = createUnifiedDiff('a\nb', 'a\nb\n');
    expect(diff).toContain('-b');
    expect(diff).toContain('\\ No newline at end of file');
    expect(diff).toContain('+b');
  });

  it('caps very long diffs and says how many lines were dropped', () => {
    const oldText = Array.from({ length: 300 }, (_, i) => `old ${i}`).join('\n') + '\n';
    const newText = Array.from({ length: 300 }, (_, i) => `new ${i}`).join('\n') + '\n';
    const diff = createUnifiedDiff(oldText, newText, { maxLines: 50 });
    expect(diff.split('\n').length).toBeLessThanOrEqual(53);
    expect(diff).toMatch(/\.\.\. diff truncated \(\d+ more lines\)/);
  });

  it('handles files too large for the LCS table by replacing the changed middle', () => {
    const big = (tag: string) => Array.from({ length: 2500 }, (_, i) => `${tag} ${i}`).join('\n') + '\n';
    const diff = createUnifiedDiff(`head\n${big('a')}tail\n`, `head\n${big('b')}tail\n`, { maxLines: 20 });
    expect(diff).toContain('--- a');
    expect(diff).toContain('+++ b');
    expect(diff).toContain('truncated');
  });

  it('produces a faithful patch: applying the diff to the old text yields the new text', () => {
    const cases: Array<[string, string]> = [
      ['alpha\nbeta\ngamma\ndelta\n', 'alpha\nBETA\ngamma\nepsilon\nzeta\n'],
      ['x\n', 'x\ny\nz\n'],
      ['a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n', 'a\nB\nc\nd\ne\nf\ng\nh\nI\nj\n'],
      ['keep\n', 'keep\n\n\nmore\n'],
    ];
    for (const [oldText, newText] of cases) {
      const diff = createUnifiedDiff(oldText, newText);
      expect(applyDiff(oldText, diff)).toBe(newText);
    }
  });
});
