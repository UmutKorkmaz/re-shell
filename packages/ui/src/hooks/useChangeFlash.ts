import * as React from 'react';

/** Class that plays the design system's `log-flash` keyframes once. */
export const LOG_FLASH_CLASS = 'animate-log-flash';

/**
 * Brief highlight when a value CHANGES (never on the first render).
 *
 * Returns the class to apply and a `key` to put on the element: re-keying
 * remounts it so the CSS animation restarts for every change. The animation is
 * disabled globally under `prefers-reduced-motion`.
 */
export function useChangeFlash(value: unknown): { className: string; key: number } {
  const previous = React.useRef(value);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!Object.is(previous.current, value)) {
      previous.current = value;
      setTick((current) => current + 1);
    }
  }, [value]);

  return { className: tick > 0 ? LOG_FLASH_CLASS : '', key: tick };
}
