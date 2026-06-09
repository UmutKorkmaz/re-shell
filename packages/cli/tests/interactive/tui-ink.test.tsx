import { beforeAll, describe, it, expect } from 'vitest';
import * as React from 'react';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { render } from 'ink-testing-library';
import { InkTUI, loadInkRuntime } from '../../src/commands/ink-tui';

/**
 * Poll the rendered frame until `predicate` is satisfied (or timeout). The TUI
 * loads workspace data asynchronously, so a fixed delay is flaky under load;
 * polling makes the data-dependent assertions robust regardless of scheduling.
 */
async function waitForFrame(
  getFrame: () => string | undefined,
  predicate: (frame: string) => boolean,
  timeoutMs = 5000
): Promise<string> {
  const start = Date.now();
  let frame = getFrame() ?? '';
  while (!predicate(frame)) {
    if (Date.now() - start > timeoutMs) break;
    await new Promise((r) => setTimeout(r, 25));
    frame = getFrame() ?? '';
  }
  return frame;
}

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
  const fixtureWorkspace = path.resolve(__dirname, '../fixtures/k8s-workspace');

  beforeAll(async () => {
    await loadInkRuntime();
  });

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

  it('loads a workspace from the supplied project path', async () => {
    const { lastFrame, unmount } = render(React.createElement(InkTUI, { projectPath: fixtureWorkspace }));

    // Real workspace name + node count derived from the fixture's
    // re-shell.workspaces.yaml (k8s-demo, services: api + worker).
    const frame = await waitForFrame(
      lastFrame,
      (f) => f.includes('k8s-demo') && f.includes('Nodes: 2/2')
    );
    expect(frame).toContain('k8s-demo');
    expect(frame).toContain('Nodes: 2/2');

    unmount();
  });

  it('renders the fixture\'s real service data, not mock placeholders', async () => {
    const { lastFrame, stdin, unmount } = render(
      React.createElement(InkTUI, { projectPath: fixtureWorkspace }),
    );
    // Wait for the graph to actually load before navigating.
    await waitForFrame(lastFrame, (f) => f.includes('k8s-demo') && f.includes('Nodes: 2/2'));

    // Select a node (Tab) then open its details view (Enter). The details view
    // echoes the service's real name/language/framework parsed from the fixture
    // YAML, proving the TUI is wired to real producers rather than the old
    // Math.random()/hardcoded-version mocks. Under CI's simulated stdin a single
    // keystroke can be dropped, so drive Tab+Enter repeatedly until the details
    // view appears (or time out).
    let frame = '';
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      stdin.write('\t'); // tab -> select a node
      await new Promise((r) => setTimeout(r, 120));
      stdin.write('\r'); // enter -> details
      await new Promise((r) => setTimeout(r, 200));
      frame = lastFrame() ?? '';
      if (frame.includes('Service Details:')) break;
    }
    expect(frame).toContain('Service Details:');
    // The fixture defines exactly two services: api (typescript/express)
    // and worker (python/celery). Whichever node is selected first, its
    // real name must appear in the details view.
    const showsRealService = frame.includes('api') || frame.includes('worker');
    expect(showsRealService).toBe(true);
    // Real, parsed metadata (no hardcoded '4.17.0' / Math.random() values).
    const showsRealLanguage = frame.includes('typescript') || frame.includes('python');
    expect(showsRealLanguage).toBe(true);
    expect(frame).not.toContain('4.17.0');

    unmount();
  });

  it('shows a clear error for non-workspace directories', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-tui-'));
    const { lastFrame, unmount } = render(React.createElement(InkTUI, { projectPath: tempDir }));
    const frame = await waitForFrame(lastFrame, (f) => f.includes('Not a Re-Shell workspace'));
    // W10-1 empty state: a clear "not a workspace" message scoped to the
    // resolved path, NOT a placeholder graph with Version 0.0.0 / Type unknown.
    expect(frame).toContain('Not a Re-Shell workspace');
    expect(frame).toContain('NOT_IN_MONOREPO');
    expect(frame).toContain(tempDir);
    expect(frame).not.toContain('0.0.0');
    expect(frame).not.toContain('Nodes:');

    unmount();
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('opens help with h without crashing (regression for the raw-string render crash)', async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(InkTUI, { projectPath: fixtureWorkspace }));
    await waitForFrame(lastFrame, (f) => f.includes('k8s-demo') || f.includes('Workspace'));

    stdin.write('h');
    const frame = await waitForFrame(lastFrame, (f) => f.includes('Keyboard Shortcuts'));
    expect(frame).toContain('Keyboard Shortcuts');
    expect(frame).toContain('Navigation:');

    unmount();
  });

  it('opens help with ? without crashing', async () => {
    const { lastFrame, stdin, unmount } = render(React.createElement(InkTUI, { projectPath: fixtureWorkspace }));
    await waitForFrame(lastFrame, (f) => f.includes('k8s-demo') || f.includes('Workspace'));

    stdin.write('?');
    const frame = await waitForFrame(lastFrame, (f) => f.includes('Keyboard Shortcuts'));
    expect(frame).toContain('Keyboard Shortcuts');
    expect(frame).toContain('Navigation:');

    unmount();
  });

  it('exits cleanly on quit (Escape) — handler runs and tree tears down', async () => {
    let exitedCleanly = false;
    const { lastFrame, stdin, unmount } = render(React.createElement(InkTUI));
    await new Promise((r) => setTimeout(r, 150));

    // InkTUI's useInput calls exit() on key.escape / Ctrl+C (graph-mode quit).
    // ink-testing-library does not expose waitUntilExit, so we assert the
    // keystroke is handled and the tree tears down without throwing.
    stdin.write('\x1b'); // escape -> exit()
    await new Promise((r) => setTimeout(r, 150));

    expect(lastFrame()).toBeTruthy();
    try {
      unmount();
      exitedCleanly = true;
    } catch {
      exitedCleanly = false;
    }
    expect(exitedCleanly).toBe(true);
  });
});
