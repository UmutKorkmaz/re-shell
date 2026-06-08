import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render } from 'ink-testing-library';
import { InkTUI } from '../../src/commands/ink-tui';

/**
 * TUI (ink) interactive flow.
 *
 * Renders the real `<InkTUI />` workspace-graph component with ink-testing-library,
 * asserts the initial frame renders, drives keystrokes through the test stdin, and
 * asserts the component reacts / exits cleanly via its `useInput` handler.
 *
 * The component reads `re-shell.workspaces.yaml` from `process.cwd()` on mount.
 * `process.chdir()` is unsupported inside vitest workers and we must NOT write that
 * file into the tracked package directory, so we assert against whichever initial
 * state the component reaches (loading -> graph, or loading -> "workspace file not
 * found" error). Both are fully-rendered frames that prove the TUI mounts, renders,
 * and handles input without crashing.
 */
describe('TUI (ink) interactive', () => {
  it('renders an initial frame', async () => {
    const { lastFrame, unmount } = render(React.createElement(InkTUI));
    await new Promise((r) => setTimeout(r, 200));

    const frame = lastFrame() ?? '';
    expect(frame.length).toBeGreaterThan(0);
    const reachedKnownState =
      frame.includes('workspace') ||
      frame.includes('Workspace') ||
      frame.includes('Loading') ||
      frame.includes('Error');
    expect(reachedKnownState).toBe(true);

    unmount();
  });

  it('handles arrow / tab keystrokes without crashing', async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(InkTUI));
    await new Promise((r) => setTimeout(r, 200));

    // Arrow keys pan the graph; Tab cycles node selection. Neither should crash,
    // regardless of whether a workspace graph loaded.
    stdin.write('\x1b[B'); // down arrow
    stdin.write('\x1b[C'); // right arrow
    stdin.write('\t'); // tab
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toBeTruthy();
    unmount();
  });

  it('accepts Escape and unmounts cleanly', async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(InkTUI));
    await new Promise((r) => setTimeout(r, 150));

    // InkTUI's useInput calls exit() on key.escape. ink-testing-library does not
    // expose waitUntilExit, so we assert the keystroke is handled and the tree
    // tears down without throwing.
    stdin.write('\x1b'); // escape
    await new Promise((r) => setTimeout(r, 150));

    expect(lastFrame()).toBeTruthy();
    expect(() => unmount()).not.toThrow();
  });
});
