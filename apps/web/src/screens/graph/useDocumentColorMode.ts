import * as React from 'react';

export type DocumentColorMode = 'light' | 'dark';

/** Dark is the default (plain `:root`); the settings store adds `.light` to opt out. */
function readColorMode(): DocumentColorMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/**
 * The dashboard theme as applied to `<html>`, kept live while the user toggles it.
 *
 * React Flow stamps its own `light`/`dark` class on the canvas root (default
 * `light`). Our design tokens are keyed on those same class names, so the canvas
 * must be told the app's mode or it resolves the light tokens under a dark app
 * (light cards with inherited light text).
 */
export function useDocumentColorMode(): DocumentColorMode {
  const [mode, setMode] = React.useState<DocumentColorMode>(readColorMode);
  React.useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setMode(readColorMode()));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    setMode(readColorMode());
    return () => observer.disconnect();
  }, []);
  return mode;
}
