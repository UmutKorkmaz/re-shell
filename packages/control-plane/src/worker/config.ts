import type { Env } from '../config.js';
import { validateIsolation, type DockerIsolation, type Isolation } from './isolation.js';

/** An omitted mode is an error at the operator CLI boundary. SDK defaults stay local. */
export function loadWorkerIsolation(env: Env, modeOverride?: string): Isolation {
  const mode = modeOverride ?? env.CONTROL_PLANE_WORKER_MODE;
  if (mode === 'process') return { mode };
  if (mode !== 'docker') throw new Error('Choose CONTROL_PLANE_WORKER_MODE=docker (isolated staging) or process (trusted local development).');
  const config: DockerIsolation = {
    mode, host: env.CONTROL_PLANE_DOCKER_HOST ?? '', image: env.CONTROL_PLANE_JOB_IMAGE ?? '',
    workerId: env.CONTROL_PLANE_WORKER_ID ?? '',
    cpus: Number(env.CONTROL_PLANE_JOB_CPUS ?? 1), memoryMb: Number(env.CONTROL_PLANE_JOB_MEMORY_MB ?? 512),
    pids: Number(env.CONTROL_PLANE_JOB_PIDS ?? 128), uid: Number(env.CONTROL_PLANE_JOB_UID ?? 1000), gid: Number(env.CONTROL_PLANE_JOB_GID ?? 1000),
  };
  validateIsolation(config);
  return config;
}
