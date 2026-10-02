import * as fs from 'node:fs';
import * as path from 'node:path';

import Mocha from 'mocha';

/**
 * Entry point VS Code calls inside the extension host (`extensionTestsPath`).
 * Compiled to dist-test/host/suite/index.js; it discovers the sibling
 * `*.test.js` files and runs them with Mocha, rejecting if any test fails so the
 * launcher's `runTests` rejects and the process exits non-zero.
 */
export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    // The first CLI call is slow (the CLI loads a large module graph), and the
    // activation refresh runs five of them at once.
    timeout: 180_000,
  });

  for (const file of fs.readdirSync(__dirname)) {
    if (file.endsWith('.test.js')) {
      mocha.addFile(path.join(__dirname, file));
    }
  }

  return new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} VS Code host test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
