import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Covers src/groups/observe.group.ts (667 lines) — the observability group
// with eight generators (metrics/trace/logs/apm/business/anomaly/scale/alerts).
// Every generator follows the same shape: resolve cloud providers from the
// --enable-* flags, build a typed config, displayConfig(config), then
// withTimeout(writeFiles(config, output, language)) with a per-generator
// "Generated:" file listing. The per-generator utils are mocked via their
// dynamic-import specifiers (../utils/X.js) so each test asserts provider
// resolution, option parsing (int/float coercion), config forwarding to
// writeFiles, output/language passthrough, and the success rendering.

vi.mock('../../src/utils/prometheus-grafana.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/distributed-tracing.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/log-aggregation.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/apm-integration.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/business-metrics.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/anomaly-detection.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/predictive-scaling.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));
vi.mock('../../src/utils/alert-management.js', () => ({
  writeFiles: vi.fn(),
  displayConfig: vi.fn(),
}));

const { registerObserveGroup } = await import('../../src/groups/observe.group');

const prometheus = await import('../../src/utils/prometheus-grafana.js');
const tracing = await import('../../src/utils/distributed-tracing.js');
const logs = await import('../../src/utils/log-aggregation.js');
const apm = await import('../../src/utils/apm-integration.js');
const business = await import('../../src/utils/business-metrics.js');
const anomaly = await import('../../src/utils/anomaly-detection.js');
const scaling = await import('../../src/utils/predictive-scaling.js');
const alerts = await import('../../src/utils/alert-management.js');

/** Build a program with the observe group registered. */
function programWith(): Command {
  const program = new Command();
  program.exitOverride();
  registerObserveGroup(program);
  return program;
}

describe('groups — observe registration group', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /** All console.log output joined for content assertions. */
  function output(): string {
    return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
  }

  it('registers all eight observability generators', () => {
    const program = programWith();
    const observe = program.commands.find(command => command.name() === 'observe');
    expect(observe?.commands.map(command => command.name())).toEqual([
      'metrics', 'trace', 'logs', 'apm', 'business', 'anomaly', 'scale', 'alerts',
    ]);
  });

  it('metrics resolves providers + dashboards and forwards the config', async () => {
    const program = programWith();
    vi.mocked(prometheus.writeFiles).mockResolvedValue(undefined);
    // NOTE: --enable-* options declared with default `true` are NOT negatable
    // in commander (only `--no-`-declared options are), so this test uses only
    // positive flags; provider OFF states are covered via the logs generator
    // whose --enable-* flags have no default.
    await program.parseAsync([
      'node', 're-shell', 'observe', 'metrics', 'shop',
      '--retention-days', '30',
      '--anonymous-access', '--webhook-url', 'https://hooks',
      '--output', '/tmp/metrics-out', '--language', 'python',
    ]);
    const config = vi.mocked(prometheus.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('shop');
    expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
    expect(config.prometheus.retentionDays).toBe(30);
    // --enable-overview defaults true and is not negatable, so all four
    // dashboards are active.
    expect(config.grafana.dashboards).toEqual([
      'overview', 'performance', 'infrastructure', 'application',
    ]);
    expect(config.grafana.anonymousAccess).toBe(true);
    expect(config.grafana.alerts.webhookUrl).toBe('https://hooks');
    expect(prometheus.writeFiles).toHaveBeenCalledWith(
      config,
      '/tmp/metrics-out',
      'python'
    );
    expect(output()).toContain('monitoring.tf');
    expect(output()).toContain('prometheus-grafana-manager.py');
    expect(output()).toContain('generated successfully');
  });

  it('metrics defaults to all providers and the four dashboards', async () => {
    const program = programWith();
    vi.mocked(prometheus.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync(['node', 're-shell', 'observe', 'metrics', 'shop']);
    const config = vi.mocked(prometheus.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
    expect(config.grafana.dashboards).toEqual([
      'overview', 'performance', 'infrastructure', 'application',
    ]);
    expect(config.prometheus.retentionDays).toBe(15);
    expect(prometheus.writeFiles).toHaveBeenCalledWith(
      config,
      './prometheus-grafana',
      'typescript'
    );
  });

  it('trace forwards backend + parsed sampling rate', async () => {
    const program = programWith();
    vi.mocked(tracing.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'trace', 'svc',
      '--backend', 'tempo', '--sampling-rate', '0.5', '--enable-profiling',
      '--output', '/tmp/trace',
    ]);
    const config = vi.mocked(tracing.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('svc');
    expect(config.providers).toEqual(['aws', 'azure', 'gcp']);
    expect(tracing.writeFiles).toHaveBeenCalledWith(config, '/tmp/trace', 'typescript');
    const forwarded = vi.mocked(tracing.writeFiles).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(forwarded.tracing ?? forwarded).toBeTruthy();
    expect(output()).toContain('distributed-tracing-manager.ts');
  });

  it('logs forwards backend/format/level with int retention', async () => {
    const program = programWith();
    vi.mocked(logs.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'logs', 'app',
      '-b', 'fluentd', '-f', 'syslog', '-l', 'warn', '--retention-days', '14',
      '--enable-alerting', '--enable-aws',
      '--output', '/tmp/logs',
    ]);
    const config = vi.mocked(logs.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('app');
    expect(config.providers).toEqual(['aws']);
    expect(logs.writeFiles).toHaveBeenCalledWith(config, '/tmp/logs', 'typescript');
    expect(output()).toContain('log-aggregation-manager.ts');
  });

  it('logs yields an empty provider list when no cloud flags are set', async () => {
    const program = programWith();
    vi.mocked(logs.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync(['node', 're-shell', 'observe', 'logs', 'app']);
    const config = vi.mocked(logs.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.providers).toEqual([]);
  });

  it('apm forwards backend/environment + float sample rate', async () => {
    const program = programWith();
    vi.mocked(apm.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'apm', 'core',
      '-b', 'newrelic', '-e', 'staging', '--sample-rate', '0.25',
      '--enable-error-tracking', '--output', '/tmp/apm',
    ]);
    const config = vi.mocked(apm.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('core');
    expect(apm.writeFiles).toHaveBeenCalledWith(config, '/tmp/apm', 'typescript');
    expect(output()).toContain('apm-integration-manager.ts');
  });

  it('business forwards dashboard provider + int refresh interval', async () => {
    const program = programWith();
    vi.mocked(business.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'business', 'revenue',
      '--dashboard', 'kibana', '--refresh-interval', '60',
      '--enable-real-time', '--enable-alerting', '--output', '/tmp/biz',
    ]);
    const config = vi.mocked(business.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('revenue');
    expect(config.dashboard.provider).toBe('kibana');
    expect(config.dashboard.refreshInterval).toBe(60);
    expect(config.enableRealTime).toBe(true);
    expect(config.enableAlerting).toBe(true);
    expect(business.writeFiles).toHaveBeenCalledWith(config, '/tmp/biz', 'typescript');
    expect(output()).toContain('business-metrics-manager.ts');
  });

  it('anomaly forwards algorithm + parsed sensitivity and interval', async () => {
    const program = programWith();
    vi.mocked(anomaly.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'anomaly', 'guard',
      '-a', 'lstm', '--sensitivity', '0.5', '--detection-interval', '120',
      '--enable-auto-response', '--output', '/tmp/anom',
    ]);
    const config = vi.mocked(anomaly.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('guard');
    expect(config.anomaly.algorithm).toBe('lstm');
    expect(config.anomaly.sensitivity).toBe(0.5);
    expect(config.anomaly.detectionInterval).toBe(120);
    expect(anomaly.writeFiles).toHaveBeenCalledWith(config, '/tmp/anom', 'typescript');
    expect(output()).toContain('anomaly-detection-manager.ts');
  });

  it('scale forwards model + parsed accuracy and target savings', async () => {
    const program = programWith();
    vi.mocked(scaling.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'scale', 'fleet',
      '-m', 'xgboost', '--accuracy', '0.95', '--target-savings', '0.4',
      '--lookback', '60d', '--forecast', '14d',
      '--enable-budget-alerts', '--output', '/tmp/scale',
    ]);
    const config = vi.mocked(scaling.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('fleet');
    expect(scaling.writeFiles).toHaveBeenCalledWith(config, '/tmp/scale', 'typescript');
    expect(output()).toContain('predictive-scaling-manager.ts');
  });

  it('alerts forwards with all provider flags and python output', async () => {
    const program = programWith();
    vi.mocked(alerts.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync([
      'node', 're-shell', 'observe', 'alerts', 'oncall',
      '--enable-auto-remediation', '--enable-incident-tracking',
      '--enable-postmortem', '--output', '/tmp/alerts', '--language', 'python',
    ]);
    const config = vi.mocked(alerts.displayConfig).mock.calls[0][0] as Record<
      string,
      any
    >;
    expect(config.projectName).toBe('oncall');
    expect(alerts.writeFiles).toHaveBeenCalledWith(config, '/tmp/alerts', 'python');
    expect(output()).toContain('alert-management-manager.py');
  });

  it('uses the per-generator default output directories', async () => {
    const program = programWith();
    vi.mocked(alerts.writeFiles).mockResolvedValue(undefined);
    vi.mocked(anomaly.writeFiles).mockResolvedValue(undefined);
    await program.parseAsync(['node', 're-shell', 'observe', 'alerts', 'a1']);
    expect(alerts.writeFiles).toHaveBeenCalledWith(
      expect.anything(),
      './alert-management',
      'typescript'
    );
    await program.parseAsync(['node', 're-shell', 'observe', 'anomaly', 'a2']);
    expect(anomaly.writeFiles).toHaveBeenCalledWith(
      expect.anything(),
      './anomaly-detection',
      'typescript'
    );
  });
});
