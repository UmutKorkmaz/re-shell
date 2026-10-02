import { describe, it, expect } from 'vitest';

import { isJsEntry, toCliInvocation, toTerminalPrefix } from '../../src/core/cli-invocation.js';

describe('isJsEntry', () => {
  it('recognises JavaScript entry points', () => {
    expect(isJsEntry('/repo/packages/cli/dist/index.js')).toBe(true);
    expect(isJsEntry('C:\\repo\\cli\\index.CJS')).toBe(true);
    expect(isJsEntry('./cli.mjs')).toBe(true);
  });

  it('does not treat launchers or bare names as JS entries', () => {
    expect(isJsEntry('re-shell')).toBe(false);
    expect(isJsEntry('/usr/local/bin/re-shell')).toBe(false);
    expect(isJsEntry('/opt/tools/re-shell.cmd')).toBe(false);
    expect(isJsEntry('/opt/js-tools/re-shell')).toBe(false);
  });
});

describe('toCliInvocation', () => {
  it('spawns a native launcher directly with no extra args or env', () => {
    expect(toCliInvocation('/usr/local/bin/re-shell', '/opt/code/code')).toEqual({
      command: '/usr/local/bin/re-shell',
      prefixArgs: [],
      env: {},
    });
  });

  it('runs a JS entry under the current runtime with ELECTRON_RUN_AS_NODE', () => {
    // Inside the extension host process.execPath is the editor binary; without
    // ELECTRON_RUN_AS_NODE it would open another editor window.
    expect(toCliInvocation('/repo/packages/cli/dist/index.js', '/opt/code/code')).toEqual({
      command: '/opt/code/code',
      prefixArgs: ['/repo/packages/cli/dist/index.js'],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    });
  });
});

describe('toTerminalPrefix', () => {
  it('uses the bin as-is when it has no whitespace', () => {
    expect(toTerminalPrefix('re-shell')).toBe('re-shell');
  });

  it('quotes a path that contains whitespace', () => {
    expect(toTerminalPrefix('/Applications/My Tools/re-shell')).toBe('"/Applications/My Tools/re-shell"');
  });

  it('runs a JS entry with node, quoting when needed', () => {
    expect(toTerminalPrefix('/repo/cli/dist/index.js')).toBe('node /repo/cli/dist/index.js');
    expect(toTerminalPrefix('/my repo/cli/dist/index.js')).toBe('node "/my repo/cli/dist/index.js"');
  });
});
