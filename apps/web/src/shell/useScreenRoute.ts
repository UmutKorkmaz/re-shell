import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SCREEN, toScreenId, type ScreenId } from './screens';

const SCREEN_PARAM = 'screen';

function readScreenFromUrl(): ScreenId {
  if (typeof window === 'undefined') {
    return DEFAULT_SCREEN;
  }
  const params = new URLSearchParams(window.location.search);
  return toScreenId(params.get(SCREEN_PARAM));
}

/**
 * Route-as-URL: the active screen lives in the `?screen=` search param so it is
 * shareable and survives reloads. Navigation uses `history.pushState` (no full
 * reload) and back/forward is honored via the `popstate` event.
 */
export function useScreenRoute(): readonly [ScreenId, (next: ScreenId) => void] {
  const [screen, setScreen] = useState<ScreenId>(readScreenFromUrl);

  useEffect(() => {
    const onPopState = (): void => setScreen(readScreenFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: ScreenId): void => {
    const url = new URL(window.location.href);
    url.searchParams.set(SCREEN_PARAM, next);
    window.history.pushState(null, '', url);
    setScreen(next);
  }, []);

  return [screen, navigate];
}
