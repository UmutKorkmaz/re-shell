import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CommandSpecInput,
  HealthSummary,
  JobRecord,
  TemplateSummary,
  WorkspaceApp,
  WorkspaceService,
  WorkspaceSummary,
} from '@umutkorkmaz/contracts';

import { CommandPreview } from './command-preview';
import { HealthStatus } from './health-status';
import { JobLogPanel } from './job-log-panel';
import { TemplateCatalogCard } from './template-catalog-card';
import { TopologyNodeCard } from './topology-node-card';
import { WorkspaceSummaryPanel } from './workspace-summary-panel';

const health: HealthSummary = {
  score: 92,
  status: 'pass',
  checks: [
    { id: 'c1', title: 'Lockfile present', level: 'pass', message: 'ok' },
    { id: 'c2', title: 'Outdated deps', level: 'warn', message: 'update soon' },
    { id: 'c3', title: 'Broken build', level: 'fail', message: 'compile error' },
    { id: 'c4', title: 'Note', level: 'info', message: '' },
  ],
};

const template: TemplateSummary = {
  id: 'fastapi',
  name: 'FastAPI service',
  description: 'Python async API',
  domain: 'backend',
  language: 'python',
  framework: 'fastapi',
  tier: 1,
  tags: ['python', 'async', 'rest'],
  command: ['re-shell', 'create', 'svc', '--template', 'fastapi'],
  database: 'postgres',
};

const app: WorkspaceApp = {
  id: 'web',
  name: 'web',
  type: 'frontend',
  path: 'apps/web',
  framework: 'react',
  port: 3000,
  scripts: { dev: 'vite' },
  status: 'running',
};

const service: WorkspaceService = {
  id: 'api',
  name: 'api',
  type: 'api',
  path: 'services/api',
  status: 'error',
};

const workspace: WorkspaceSummary = {
  path: '/repo',
  name: 'demo-monorepo',
  packageManager: 'pnpm',
  nodeVersion: '20.0.0',
  git: { branch: 'main', dirty: true, ahead: 2, behind: 1 },
  apps: [app],
  services: [service],
  templates: [template],
  health,
};

const job: JobRecord = {
  id: 'j1',
  commandId: 'doctor',
  command: ['re-shell', 'doctor', '--json'],
  cwd: '/repo',
  status: 'running',
  startedAt: '2026-01-01T00:00:00Z',
  exitCode: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HealthStatus', () => {
  it('renders score, status badge, and check levels', () => {
    render(<HealthStatus health={health} />);
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Lockfile present')).toBeInTheDocument();
    expect(screen.getByText('Broken build')).toBeInTheDocument();
  });

  it('maps warn and fail overall statuses', () => {
    const { rerender } = render(<HealthStatus health={{ ...health, status: 'warn' }} />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    rerender(<HealthStatus health={{ ...health, status: 'fail' }} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});

describe('TemplateCatalogCard', () => {
  it('renders template metadata and tags', () => {
    render(<TemplateCatalogCard template={template} />);
    expect(screen.getByText('FastAPI service')).toBeInTheDocument();
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('async')).toBeInTheDocument();
  });

  it('fires onSelect and onDryRun', () => {
    const onSelect = vi.fn();
    const onDryRun = vi.fn();
    render(<TemplateCatalogCard template={template} onSelect={onSelect} onDryRun={onDryRun} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }));
    expect(onSelect).toHaveBeenCalledWith(template);
    expect(onDryRun).toHaveBeenCalledWith(template);
  });

  it('omits the tier badge when not tier 1', () => {
    render(<TemplateCatalogCard template={{ ...template, tier: 2 }} />);
    expect(screen.queryByText('Tier 1')).not.toBeInTheDocument();
  });
});

describe('TopologyNodeCard', () => {
  it('renders an app node with framework and port', () => {
    render(<TopologyNodeCard item={app} kind="app" />);
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText(':3000')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders a service node with an error status', () => {
    render(<TopologyNodeCard item={service} kind="service" />);
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });
});

describe('WorkspaceSummaryPanel', () => {
  it('renders metrics and git state', () => {
    render(<WorkspaceSummaryPanel workspace={workspace} />);
    expect(screen.getByText('demo-monorepo')).toBeInTheDocument();
    expect(screen.getByText('Apps')).toBeInTheDocument();
    expect(screen.getByText('Dirty workspace')).toBeInTheDocument();
    expect(screen.getByText('ahead 2')).toBeInTheDocument();
    expect(screen.getByText('behind 1')).toBeInTheDocument();
  });

  it('fires health and settings actions', () => {
    const onRunHealth = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <WorkspaceSummaryPanel
        workspace={workspace}
        onRunHealth={onRunHealth}
        onOpenSettings={onOpenSettings}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Health/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(onRunHealth).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('renders a clean workspace without git when omitted', () => {
    const { git, nodeVersion, ...rest } = workspace;
    render(<WorkspaceSummaryPanel workspace={rest as WorkspaceSummary} />);
    expect(screen.getByText('unknown')).toBeInTheDocument(); // node fallback
    expect(screen.queryByText('Dirty workspace')).not.toBeInTheDocument();
  });
});

describe('JobLogPanel', () => {
  it('renders job status, command, and logs', () => {
    render(<JobLogPanel job={job} logs={['line 1', 'line 2']} />);
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('exit 0')).toBeInTheDocument();
    expect(screen.getByText(/line 1/)).toBeInTheDocument();
  });

  it('shows a cancel button while running and fires onCancel', () => {
    const onCancel = vi.fn();
    render(<JobLogPanel job={job} logs={[]} onCancel={onCancel} />);
    expect(screen.getByText('No logs yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onCancel).toHaveBeenCalledWith(job);
  });

  it('hides the cancel button when the job is finished', () => {
    render(<JobLogPanel job={{ ...job, status: 'success' }} logs={['done']} />);
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
  });
});

describe('CommandPreview', () => {
  const spec: CommandSpecInput = {
    id: 'health',
    title: 'Workspace health',
    description: 'Run the health check',
    command: ['re-shell', 'workspace', 'health', '--json'],
    cwd: '/repo',
    dryRunSupported: true,
    destructive: false,
    requiresConfirmation: false,
  };

  it('renders the formatted command text', () => {
    render(<CommandPreview spec={spec} />);
    expect(screen.getByText('re-shell workspace health --json')).toBeInTheDocument();
    expect(screen.getByText('Run the health check')).toBeInTheDocument();
  });

  it('copies the command and toggles the copied label', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const onCopy = vi.fn();
    render(<CommandPreview spec={spec} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole('button', { name: /Copy command/ }));
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('re-shell workspace health --json');
    expect(onCopy).toHaveBeenCalledWith('re-shell workspace health --json');
  });

  it('fires dry-run and run actions', () => {
    const onDryRun = vi.fn();
    const onRun = vi.fn();
    render(<CommandPreview spec={spec} onDryRun={onDryRun} onRun={onRun} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dry run' }));
    fireEvent.click(screen.getByRole('button', { name: /Run/ }));
    expect(onDryRun).toHaveBeenCalled();
    expect(onRun).toHaveBeenCalled();
  });

  it('shows a confirmation badge for destructive specs', () => {
    render(
      <CommandPreview
        spec={{ ...spec, destructive: true, requiresConfirmation: true, dryRunSupported: false }}
      />
    );
    expect(screen.getByText('Confirmation required')).toBeInTheDocument();
  });

  it('shows a plain destructive badge when no confirmation is required', () => {
    render(<CommandPreview spec={{ ...spec, destructive: true, requiresConfirmation: false }} />);
    expect(screen.getByText('Destructive')).toBeInTheDocument();
  });
});
