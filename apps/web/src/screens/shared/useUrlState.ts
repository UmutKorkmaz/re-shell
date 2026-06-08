import { useCallback, useEffect, useState } from 'react';

/**
 * Read/write a set of string URL search params (route-as-URL), so view state
 * like filters is shareable and survives reload. Mirrors `useScreenRoute`'s
 * `pushState` + `popstate` approach but for an arbitrary key set.
 *
 * Empty-string values are removed from the URL (so a cleared filter does not
 * leave `?language=` noise). The returned record always has every requested
 * key present (empty string when unset) for easy controlled-input binding.
 */
export function useUrlState<K extends string>(
  keys: readonly K[]
): readonly [Record<K, string>, (next: Partial<Record<K, string>>) => void] {
  const read = useCallback((): Record<K, string> => {
    const params =
      typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const out = {} as Record<K, string>;
    for (const key of keys) {
      out[key] = params.get(key) ?? '';
    }
    return out;
    // keys is a stable literal array supplied by the caller; spread for deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, keys);

  const [state, setState] = useState<Record<K, string>>(read);

  useEffect(() => {
    const onPopState = (): void => setState(read());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [read]);

  const update = useCallback(
    (next: Partial<Record<K, string>>): void => {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(next) as [K, string | undefined][]) {
        if (value === undefined || value === '') {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      }
      window.history.pushState(null, '', url);
      setState(read());
    },
    [read]
  );

  return [state, update];
}
