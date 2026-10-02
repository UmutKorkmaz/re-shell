import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Create a tiny but real pnpm workspace on disk (one app depending on one
 * package) for tests to point the CLI, the hub and the extension at. It is
 * recognised by the extension's workspace detection (`pnpm-workspace.yaml` +
 * `apps/`) and by `re-shell workspace summary|graph|health|list`.
 *
 * Returns the realpath'd root (macOS `/var` -> `/private/var`, etc.), which is
 * what the CLI reports as `root` and what the hub contains jobs to.
 */
export function createFixtureWorkspace(): string {
  // Keep the path short: it ends up inside Unix-domain-socket paths for VS Code.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rs-fx-')));
  const write = (rel: string, content: string): void => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  write('pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n  - "packages/*"\n');
  write('package.json', `${JSON.stringify({ name: 'fixture-root', version: '1.0.0', private: true }, null, 2)}\n`);
  write(
    'apps/demo-app/package.json',
    `${JSON.stringify(
      {
        name: 'demo-app',
        version: '1.0.0',
        dependencies: { 'demo-lib': 'workspace:*', react: '^18.0.0' },
      },
      null,
      2
    )}\n`
  );
  write(
    'packages/demo-lib/package.json',
    `${JSON.stringify({ name: 'demo-lib', version: '1.0.0' }, null, 2)}\n`
  );
  return root;
}

/** Remove a fixture workspace created by {@link createFixtureWorkspace}. */
export function removeFixtureWorkspace(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
