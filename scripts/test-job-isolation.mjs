#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
if (process.version !== 'v22.22.3') throw new Error('Use Node 22.22.3.');
for (const name of ['CONTROL_PLANE_DOCKER_HOST', 'CONTROL_PLANE_JOB_IMAGE']) {
  if (!process.env[name]) throw new Error(`Set ${name} for the dedicated local test daemon and pinned real job image.`);
}
const result = spawnSync('corepack', ['pnpm@9.15.9', '--filter', '@re-shell/control-plane', 'exec', 'vitest', 'run', 'src/worker/docker.integration.test.ts'], {
  env: { ...process.env, RE_SHELL_TEST_DOCKER: '1' }, stdio: 'inherit', shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
