import * as React from 'react';
import { Button } from '@re-shell/ui';
import { AlertTriangle, GitCompareArrows, Loader2, X } from 'lucide-react';
import type { WorkspaceGraphDiff } from '@re-shell/contracts';

interface DiffPanelProps {
  base: string;
  head: string;
  onCompare: (base: string, head: string) => void;
  onClose: () => void;
  diff: WorkspaceGraphDiff | null;
  error: string | null;
  isLoading: boolean;
}

export const DIFF_COLORS = { added: '#2da44e', removed: '#cf222e', changed: '#bf8700' } as const;

/**
 * Graph-diff controls and report for PR review: pick a base (and optional head)
 * git ref or graph JSON file, see the counts and every change, with the canvas
 * recoloured added / removed / changed. The head defaults to the working tree.
 */
export function DiffPanel({ base, head, onCompare, onClose, diff, error, isLoading }: DiffPanelProps): React.ReactElement {
  const [baseText, setBaseText] = React.useState(base);
  const [headText, setHeadText] = React.useState(head);
  React.useEffect(() => setBaseText(base), [base]);
  React.useEffect(() => setHeadText(head), [head]);

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    onCompare(baseText.trim(), headText.trim());
  };

  return (
    <div className="grid gap-3 border-b border-border bg-bg-0/40 px-5 py-3" data-testid="graph-diff-panel">
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <div className="grid gap-1">
          <label htmlFor="graph-diff-base" className="label-eyebrow normal-case">
            Base (git ref or .json)
          </label>
          <input
            id="graph-diff-base"
            data-testid="graph-diff-base"
            value={baseText}
            placeholder="main, HEAD~1, v1.2.0, graph.json"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setBaseText(event.target.value)}
            className="h-8 w-60 rounded-md border border-border bg-bg-0 px-2 font-mono text-xs outline-none focus-visible:border-signal"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="graph-diff-head" className="label-eyebrow normal-case">
            Head (empty = working tree)
          </label>
          <input
            id="graph-diff-head"
            data-testid="graph-diff-head"
            value={headText}
            placeholder="working tree"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setHeadText(event.target.value)}
            className="h-8 w-60 rounded-md border border-border bg-bg-0 px-2 font-mono text-xs outline-none focus-visible:border-signal"
          />
        </div>
        <Button type="submit" size="sm" className="h-8" disabled={baseText.trim() === ''} data-testid="graph-diff-run">
          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <GitCompareArrows className="size-3.5" />}
          Compare
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-8" onClick={onClose} data-testid="graph-diff-close">
          <X className="size-3.5" />
          Close diff
        </Button>
      </form>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical" data-testid="graph-diff-error">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : null}

      {diff ? <DiffReport diff={diff} /> : null}
      {!diff && !error && !isLoading && base === '' ? (
        <p className="text-xs text-muted-foreground">
          Enter a base to compare. Example: <code className="font-mono">main</code> compares the base branch to your working tree.
        </p>
      ) : null}
    </div>
  );
}

function DiffReport({ diff }: { diff: WorkspaceGraphDiff }): React.ReactElement {
  const s = diff.summary;
  return (
    <div className="grid gap-2" data-testid="graph-diff-report" data-has-changes={s.hasChanges}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-mono text-muted-foreground">
          {diff.base.ref}
          {diff.base.commit ? ` (${diff.base.commit.slice(0, 8)})` : ''} → {diff.head.ref}
          {diff.head.commit ? ` (${diff.head.commit.slice(0, 8)})` : ''}
        </span>
        <Legend />
        <span data-testid="graph-diff-summary">
          nodes <b style={{ color: DIFF_COLORS.added }}>+{s.nodesAdded}</b> <b style={{ color: DIFF_COLORS.removed }}>−{s.nodesRemoved}</b>{' '}
          <b style={{ color: DIFF_COLORS.changed }}>~{s.nodesChanged}</b> · edges <b style={{ color: DIFF_COLORS.added }}>+{s.edgesAdded}</b>{' '}
          <b style={{ color: DIFF_COLORS.removed }}>−{s.edgesRemoved}</b> <b style={{ color: DIFF_COLORS.changed }}>~{s.edgesChanged}</b>
        </span>
      </div>

      {!s.hasChanges ? (
        <p className="text-sm text-healthy" data-testid="graph-diff-empty">
          No differences: the two dependency graphs are identical.
        </p>
      ) : (
        <ul className="grid max-h-40 gap-0.5 overflow-y-auto font-mono text-xs" data-testid="graph-diff-list">
          {diff.nodes.added.map((n) => (
            <li key={`a:${n.id}`} style={{ color: DIFF_COLORS.added }}>+ node {n.id}</li>
          ))}
          {diff.nodes.removed.map((n) => (
            <li key={`r:${n.id}`} style={{ color: DIFF_COLORS.removed }}>− node {n.id}</li>
          ))}
          {diff.nodes.changed.map((c) => (
            <li key={`c:${c.id}`} style={{ color: DIFF_COLORS.changed }}>
              ~ node {c.id}: {c.fields.join(', ')}
            </li>
          ))}
          {diff.edges.added.map((e) => (
            <li key={`ea:${e.from}>${e.to}`} style={{ color: DIFF_COLORS.added }}>+ edge {e.from} → {e.to}</li>
          ))}
          {diff.edges.removed.map((e) => (
            <li key={`er:${e.from}>${e.to}`} style={{ color: DIFF_COLORS.removed }}>− edge {e.from} → {e.to}</li>
          ))}
          {diff.edges.changed.map((e) => (
            <li key={`ec:${e.from}>${e.to}`} style={{ color: DIFF_COLORS.changed }}>
              ~ edge {e.from} → {e.to}: {e.before} → {e.after}
            </li>
          ))}
        </ul>
      )}

      {diff.cyclesIntroduced.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-critical" data-testid="graph-diff-cycles">
          <AlertTriangle className="size-3.5" />
          {diff.cyclesIntroduced.length} new dependency {diff.cyclesIntroduced.length === 1 ? 'cycle' : 'cycles'}:{' '}
          {diff.cyclesIntroduced.map((c) => c.join(' ↔ ')).join('; ')}
        </p>
      ) : null}
    </div>
  );
}

/** Legend for the diff colouring (also shown on its own while the diff loads). */
export function Legend(): React.ReactElement {
  const item = (color: string, label: string, dashed = false): React.ReactElement => (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-3 rounded-sm"
        style={{ background: `${color}33`, border: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
      />
      {label}
    </span>
  );
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-xs" data-testid="graph-diff-legend">
      {item(DIFF_COLORS.added, 'Added')}
      {item(DIFF_COLORS.removed, 'Removed', true)}
      {item(DIFF_COLORS.changed, 'Changed')}
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block size-3 rounded-sm border border-border opacity-60" />
        Unchanged (context)
      </span>
    </span>
  );
}
