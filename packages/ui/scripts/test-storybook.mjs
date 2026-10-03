// `pnpm test-storybook`: run the Storybook test runner (interaction + a11y + visual)
// against the STATIC Storybook build, serving it from an ephemeral local port.
//
//   pnpm test-storybook            builds storybook-static/ if missing, then tests
//   pnpm test-storybook --build    always rebuild first
//   pnpm test-storybook -u         refresh the visual baselines in __image_snapshots__/
//
// Everything else is forwarded to `test-storybook` (e.g. `--maxWorkers=2`).
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = resolve(root, 'storybook-static');
const bin = (name) => join(root, 'node_modules', '.bin', name);

const forwarded = process.argv.slice(2);
const rebuild = forwarded.includes('--build');
const runnerArgs = forwarded.filter((arg) => arg !== '--build');

if (rebuild || !existsSync(join(staticDir, 'index.json'))) {
  console.log('[test-storybook] building Storybook...');
  const build = spawnSync(bin('storybook'), ['build', '-o', 'storybook-static', '--quiet'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.map': 'application/json'
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = resolve(staticDir, `.${decodeURIComponent(url.pathname)}`);
  if (file !== staticDir && !file.startsWith(staticDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
console.log(`[test-storybook] serving storybook-static on http://127.0.0.1:${port}`);

const child = spawn(bin('test-storybook'), ['--index-json', '--url', `http://127.0.0.1:${port}`, ...runnerArgs], {
  cwd: root,
  stdio: 'inherit',
  env: process.env
});
child.on('exit', (code, signal) => {
  server.close();
  process.exit(code ?? (signal ? 1 : 0));
});
