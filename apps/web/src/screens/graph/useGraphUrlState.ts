import { useCallback, useEffect, useState } from 'react';

/** Every piece of graph-explorer state kept in the URL (see {@link graphParam} for the param names). */
export const GRAPH_URL_KEYS = [
  'q',
  'language',
  'framework',
  'type',
  'status',
  /** `1` hides non-matching nodes instead of dimming them. */
  'hide',
  /** Selected node (drives upstream/downstream highlight). */
  'sel',
  /** Second node for the shortest-path highlight. */
  'to',
  /** Live status poll interval in seconds; `0` = off. */
  'poll',
  /** Diff base ref (git ref or graph json path); presence turns diff mode on. */
  'diffBase',
  /** Diff head ref; empty = working tree. */
  'diffHead',
] as const;
export type GraphUrlKey = (typeof GRAPH_URL_KEYS)[number];
export type GraphUrlState = Record<GraphUrlKey, string>;

/**
 * URL param name for a state key. Every param is prefixed so graph filters can
 * never leak into another screen: navigation keeps the search string, and the
 * Templates screen already owns `?language=` and `?framework=`.
 */
export const graphParam = (key: GraphUrlKey): string => `g_${key}`;

function readUrl(): GraphUrlState {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const out = {} as GraphUrlState;
  for (const key of GRAPH_URL_KEYS) out[key] = params.get(graphParam(key)) ?? '';
  return out;
}

/**
 * Route-as-URL state for the graph explorer, so a filtered / selected / diffed
 * view is shareable and survives reload (same idea as the Templates screen's
 * `useUrlState`). Updates use `replaceState`: typing a search or clicking
 * through nodes must not flood the back button with one entry per keystroke.
 * Empty values are removed from the URL.
 */
export function useGraphUrlState(): readonly [GraphUrlState, (next: Partial<GraphUrlState>) => void] {
  const [state, setState] = useState<GraphUrlState>(readUrl);

  useEffect(() => {
    const onPopState = (): void => setState(readUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const update = useCallback((next: Partial<GraphUrlState>): void => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(next) as [GraphUrlKey, string | undefined][]) {
      if (value === undefined || value === '') url.searchParams.delete(graphParam(key));
      else url.searchParams.set(graphParam(key), value);
    }
    window.history.replaceState(window.history.state, '', url);
    setState(readUrl());
  }, []);

  return [state, update];
}

/** Poll intervals offered in the UI (seconds). `0` disables polling. */
export const POLL_OPTIONS_SECONDS = [0, 2, 5, 15, 30, 60] as const;
export const DEFAULT_POLL_SECONDS = 5;

export function parsePollSeconds(raw: string): number {
  if (raw === '') return DEFAULT_POLL_SECONDS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 3600 ? Math.floor(n) : DEFAULT_POLL_SECONDS;
}
