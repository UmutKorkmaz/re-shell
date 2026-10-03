import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { AlertTriangle, Crosshair, Eraser, Route, X } from 'lucide-react';
import type { CycleReport, DependencyPath } from '@re-shell/contracts';

interface GraphInspectorProps {
  selected: string | null;
  target: string;
  nodeIds: readonly string[];
  upstreamCount: number;
  downstreamCount: number;
  path: DependencyPath | null;
  /** True once both endpoints are set but no dependency path exists. */
  noPath: boolean;
  cycles: CycleReport;
  showCycles: boolean;
  onShowCycles: (on: boolean) => void;
  pickTarget: boolean;
  onPickTarget: (on: boolean) => void;
  onTarget: (id: string) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
}

/** Autocomplete list for the path-target field. Memoized: thousands of <option>s must not re-render on every state change. */
const NodeOptions = React.memo(function NodeOptions({ ids }: { ids: readonly string[] }): React.ReactElement {
  return <datalist id="graph-node-options">{ids.length <= 3000 ? ids.map((id) => <option key={id} value={id} />) : null}</datalist>;
});

/**
 * Selection panel: upstream/downstream counts for the selected node, the
 * shortest-path picker, and the cycle banner. Rendered between the toolbar and
 * the canvas; collapses to a one-line hint when nothing is selected.
 */
export function GraphInspector(props: GraphInspectorProps): React.ReactElement {
  const { selected, path, cycles } = props;
  const cycleCount = cycles.cycles.length;

  return (
    <div className="grid gap-2 border-b border-border px-5 py-2.5 text-sm" data-testid="graph-inspector">
      {cycleCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-1.5 text-xs text-critical"
          data-testid="graph-cycles"
          data-cycle-count={cycleCount}
        >
          <AlertTriangle className="size-3.5" />
          <span className="font-medium">
            {cycleCount} dependency {cycleCount === 1 ? 'cycle' : 'cycles'} across {cycles.nodeIds.size} nodes
          </span>
          <span className="text-muted-foreground">
            e.g.{' '}
            {cycles.cycles[0].slice(0, 4).join(' ↔ ')}
            {cycles.cycles[0].length > 4 ? ' …' : ''}
          </span>
          <label className="ml-auto flex items-center gap-1.5 text-foreground">
            <input
              type="checkbox"
              data-testid="graph-show-cycles"
              checked={props.showCycles}
              onChange={(event) => props.onShowCycles(event.target.checked)}
            />
            Highlight cycles
          </label>
          <select
            aria-label="Jump to a cycle member"
            data-testid="graph-cycle-jump"
            value=""
            onChange={(event) => event.target.value && props.onSelect(event.target.value)}
            className="h-7 rounded border border-border bg-bg-0 px-1.5 font-mono text-xs text-foreground"
          >
            <option value="">Jump to…</option>
            {cycles.cycles.map((c, i) => (
              <option key={i} value={c[0]}>
                {`#${i + 1}: ${c.length} nodes (${c[0]}…)`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selected === null ? (
        <p className="text-xs text-muted-foreground" data-testid="graph-inspector-hint">
          Click a node to highlight its upstream dependencies and its downstream dependents. Shift-click a second node, or use
          “Pick on canvas”, to highlight the shortest dependency path between them.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="graph-selection" data-selected={selected}>
          <span className="inline-flex items-center gap-2">
            <Crosshair className="size-4 text-signal" />
            <span className="font-mono font-medium">{selected}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full" style={{ background: 'var(--status-info)' }} />
            <span data-testid="graph-upstream-count" className="font-semibold tabular-nums">{props.upstreamCount}</span>
            <span className="text-muted-foreground">upstream · dependencies</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full" style={{ background: 'var(--status-warn)' }} />
            <span data-testid="graph-downstream-count" className="font-semibold tabular-nums">{props.downstreamCount}</span>
            <span className="text-muted-foreground">downstream · dependents</span>
          </span>

          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <div className="flex items-center gap-1.5">
            <Route className="size-4 text-muted-foreground" />
            <label htmlFor="graph-path-target" className="label-eyebrow normal-case">
              Find path to
            </label>
            <input
              id="graph-path-target"
              data-testid="graph-path-target"
              list="graph-node-options"
              value={props.target}
              placeholder="node name"
              autoComplete="off"
              onChange={(event) => props.onTarget(event.target.value)}
              className="h-7 w-48 rounded border border-border bg-bg-0 px-2 font-mono text-xs outline-none focus-visible:border-signal"
            />
            <NodeOptions ids={props.nodeIds} />
            <Button
              type="button"
              variant={props.pickTarget ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              data-testid="graph-pick-target"
              aria-pressed={props.pickTarget}
              onClick={() => props.onPickTarget(!props.pickTarget)}
            >
              {props.pickTarget ? 'Click a node…' : 'Pick on canvas'}
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              data-testid="graph-clear-selection"
              onClick={props.onClear}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>

          {props.target && path ? (
            <div className="basis-full text-xs" data-testid="graph-path" data-hops={path.path.length - 1}>
              <span className="font-semibold text-[#c084fc]">
                Shortest path, {path.path.length - 1} {path.path.length === 2 ? 'hop' : 'hops'}
                {path.dependent === 'a' ? '' : ' (reverse direction)'}:
              </span>{' '}
              <span className="font-mono">
                {path.path.map((id, i) => (
                  <React.Fragment key={id + i}>
                    {i > 0 ? <span className="text-muted-foreground"> → </span> : null}
                    <button
                      type="button"
                      className={cn('underline-offset-2 hover:underline', i === 0 || i === path.path.length - 1 ? 'font-semibold' : '')}
                      onClick={() => props.onSelect(id)}
                    >
                      {id}
                    </button>
                  </React.Fragment>
                ))}
              </span>
            </div>
          ) : null}
          {props.target && props.noPath ? (
            <div className="flex basis-full items-center gap-1.5 text-xs text-warn" data-testid="graph-no-path">
              <X className="size-3.5" />
              No dependency path between {selected} and {props.target} in either direction.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
