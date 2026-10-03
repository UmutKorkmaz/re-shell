import type {
  CommandSpecInput,
  HealthSummary,
  JobRecord,
  TemplateSummary,
  WorkspaceApp,
  WorkspaceService,
  WorkspaceSummary
} from '@re-shell/contracts';

/** Realistic domain fixtures shared by the unit tests and the Storybook stories. */

export const health: HealthSummary = {
  score: 92,
  status: 'pass',
  checks: [
    { id: 'c1', title: 'Lockfile present', level: 'pass', message: 'pnpm-lock.yaml found' },
    { id: 'c2', title: 'Outdated dependencies', level: 'warn', message: '3 packages are behind' },
    { id: 'c3', title: 'Build', level: 'fail', message: 'apps/web failed to compile' },
    { id: 'c4', title: 'Node version', level: 'info', message: 'Node 22.4.0' }
  ]
};

export const template: TemplateSummary = {
  id: 'fastapi',
  name: 'FastAPI service',
  description: 'Python async API with typed routers.',
  domain: 'backend',
  language: 'python',
  framework: 'fastapi',
  tier: 1,
  tags: ['python', 'async', 'rest'],
  command: ['re-shell', 'create', 'svc', '--template', 'fastapi'],
  database: 'postgres'
};

export const app: WorkspaceApp = {
  id: 'web',
  name: 'web',
  type: 'frontend',
  path: 'apps/web',
  framework: 'react',
  port: 3000,
  scripts: { dev: 'vite' },
  status: 'running'
};

export const service: WorkspaceService = {
  id: 'api',
  name: 'api',
  type: 'api',
  path: 'services/api',
  status: 'error'
};

export const workspace: WorkspaceSummary = {
  path: '/repo',
  name: 'demo-monorepo',
  packageManager: 'pnpm',
  nodeVersion: '22.4.0',
  git: { branch: 'main', dirty: true, ahead: 2, behind: 1 },
  apps: [app],
  services: [service],
  templates: [template],
  health
};

export const runningJob: JobRecord = {
  id: 'j1',
  commandId: 'doctor',
  command: ['re-shell', 'doctor', '--json'],
  cwd: '/repo',
  status: 'running',
  startedAt: '2026-01-01T00:00:00Z',
  exitCode: 0
};

export const jobLogs: string[] = [
  '$ re-shell doctor --json',
  'checking workspace manifest...',
  'checking package manager lockfile...',
  'ok 14 checks passed, 1 warning'
];

export const commandSpec: CommandSpecInput = {
  id: 'health',
  title: 'Workspace health',
  description: 'Run the health check',
  command: ['re-shell', 'workspace', 'health', '--json'],
  cwd: '/repo',
  dryRunSupported: true,
  destructive: false,
  requiresConfirmation: false
};
