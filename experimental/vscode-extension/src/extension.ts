import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  fetchCommandCatalogRaw,
  fetchDoctorRaw,
  fetchTemplatesListRaw,
  fetchWorkspaceGraphRaw,
  fetchWorkspaceHealthRaw,
  fetchWorkspaceSummaryRaw,
  resolveCliBin,
} from './cli.js';
import {
  groupTemplatesByLanguage,
  healthToOverallStatus,
  parseCommandCatalog,
  parseDoctor,
  parseTemplatesList,
  parseWorkspaceGraph,
  parseWorkspaceHealth,
  parseWorkspaceSummary,
  toProjectNodes,
  type CatalogEntry,
  type DoctorCheck,
  type ProjectNode,
  type TemplateSummary,
  type TemplatesByLanguage,
} from './core/index.js';

/**
 * VS Code host layer. Deliberately THIN: every decision (envelope parsing,
 * grouping, status rollup) lives in src/core, which is pure and unit-tested
 * without the VS Code host. This file only wires those pure functions to editor
 * surfaces (3 tree views + status bar + commands) and performs I/O.
 *
 * ARCHITECTURE: the extension is a RENDERER. ALL data comes from the CLI JSON
 * commands via fixed-argv `spawn(..., { shell: false })`. We never parse
 * package.json or scan the filesystem ourselves — the CLI is the source of
 * truth.
 */

const VIEW_PROJECTS = 'reShell.projects';
const VIEW_COMMANDS = 'reShell.commands';
const VIEW_TEMPLATES = 'reShell.templates';

// ---------------------------------------------------------------------------
// Config + cwd helpers
// ---------------------------------------------------------------------------

function getWorkspaceCwd(): string {
  const folders = vscode.workspace.workspaceFolders;
  const root = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
  // Check if the root itself is a re-shell workspace
  if (isReShellWorkspace(root)) return root;
  // Search one level deep — user may have opened a parent folder
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const sub = path.join(root, entry.name);
      if (isReShellWorkspace(sub)) return sub;
    }
  } catch {
    // ignore read errors
  }
  return root;
}

/**
 * Detect a re-shell workspace by the markers it creates: pnpm-workspace.yaml
 * + apps/ dir, or a re-shell.workspaces.yaml file, or a package.json with a
 * workspaces field + apps/ dir.
 */
function isReShellWorkspace(dir: string): boolean {
  try {
    const hasApps = fs.existsSync(path.join(dir, 'apps'));
    const hasPackages = fs.existsSync(path.join(dir, 'packages'));
    const hasPnpmWorkspace = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
    const hasReShellYaml = fs.existsSync(path.join(dir, 're-shell.workspaces.yaml'));
    // Standard re-shell monorepo: pnpm-workspace.yaml + apps/ dir
    if (hasPnpmWorkspace && hasApps) return true;
    // Alternative: re-shell.workspaces.yaml
    if (hasReShellYaml) return true;
    // Created by `re-shell create`: has apps/ + packages/ + package.json
    if (hasApps && hasPackages && fs.existsSync(path.join(dir, 'package.json'))) return true;
    return false;
  } catch {
    return false;
  }
}

function getCliBin(): string {
  return vscode.workspace.getConfiguration('reShell').get<string>('cliBin', 're-shell');
}

/** Sanitizer matching the CLI's safe-identifier charset (no shell metachars). */
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// ---------------------------------------------------------------------------
// Shared runtime context (the single mutable cache the views read from)
// ---------------------------------------------------------------------------

interface WorkspaceSnapshot {
  readonly detected: boolean;
  readonly apps: readonly ProjectNode[];
  readonly packages: readonly ProjectNode[];
  readonly overallStatus: 'pass' | 'warn' | 'fail' | null;
  readonly warnCount: number;
  readonly failCount: number;
}

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  detected: false,
  apps: [],
  packages: [],
  overallStatus: null,
  warnCount: 0,
  failCount: 0,
};

/**
 * Owns the cached workspace snapshot + command catalog + templates list. The
 * three tree providers read from this single source; `refreshAll` repopulates
 * it from the CLI and fires change events to every provider.
 */
class ReShellContext {
  private snapshot: WorkspaceSnapshot = EMPTY_SNAPSHOT;
  private commands: CatalogEntry[] = [];
  private templates: TemplateSummary[] = [];
  private lastTemplatesError: string | null = null;
  private lastResolvedBin = '';

  constructor(
    private readonly output: vscode.OutputChannel,
    private readonly onSnapshot: vscode.EventEmitter<WorkspaceSnapshot>
  ) {}

  current(): WorkspaceSnapshot {
    return this.snapshot;
  }

  listCommands(): CatalogEntry[] {
    return this.commands;
  }

  listTemplates(): TemplateSummary[] {
    return this.templates;
  }

  /** The most recent templates-load error, or null when templates loaded OK. */
  templatesError(): string | null {
    return this.lastTemplatesError;
  }

  /** The resolved CLI binary path from the last refresh. */
  resolvedBin(): string {
    return this.lastResolvedBin;
  }

  findCommand(path: string): CatalogEntry | undefined {
    return this.commands.find((c) => c.path === path);
  }

  /** The status-bar snapshot stream. */
  get onSnapshotChange(): vscode.Event<WorkspaceSnapshot> {
    return this.onSnapshot.event;
  }

  /**
   * Re-fetch all data sources from the CLI and notify every consumer. Errors
   * are surfaced to the output channel + status bar but never throw — a missing
   * workspace just yields an empty tree (and the viewsWelcome content takes
   * over).
   */
  async refreshAll(cliBin: string, cwd: string): Promise<void> {
    this.lastResolvedBin = cliBin;
    const [summaryRes, graphRes, healthRes, commandsRes, templatesRes] = await Promise.all([
      fetchWorkspaceSummaryRaw(cliBin, cwd).catch(toErrorResult),
      fetchWorkspaceGraphRaw(cliBin, cwd).catch(toErrorResult),
      fetchWorkspaceHealthRaw(cliBin, cwd).catch(toErrorResult),
      fetchCommandCatalogRaw(cliBin, cwd).catch(toErrorResult),
      fetchTemplatesListRaw(cliBin, cwd).catch(toErrorResult),
    ]);

    // Workspace snapshot: graph drives the project tree; health drives the dots
    // + status bar. We prefer the graph, but fall back to the summary's apps/
    // services when the graph command is unavailable.
    const graphParsed = parseWorkspaceGraph(graphRes.stdout);
    const summaryParsed = parseWorkspaceSummary(summaryRes.stdout);
    const healthParsed = parseWorkspaceHealth(healthRes.stdout);

    let apps: readonly ProjectNode[] = [];
    let packages: readonly ProjectNode[] = [];
    let detected = false;

    const healthSummary = healthParsed.ok ? healthParsed.health : undefined;

    if (graphParsed.ok) {
      const grouped = toProjectNodes(graphParsed.graph, healthSummary);
      apps = grouped.apps;
      packages = grouped.packages;
      detected = true;
    } else if (summaryParsed.ok) {
      // Fall back to the summary's apps/services (no graph edges, but the
      // summary carries the same node identity).
      const fallbackGraph = {
        apps: summaryParsed.summary.apps.map((a) => ({
          name: a.name,
          path: a.path,
          framework: a.framework ?? null,
          dependencies: [] as string[],
        })),
        services: summaryParsed.summary.services.map((s) => ({
          name: s.name,
          path: s.path,
          framework: s.framework ?? null,
          dependencies: [] as string[],
        })),
      };
      const grouped = toProjectNodes(fallbackGraph, healthSummary);
      apps = grouped.apps;
      packages = grouped.packages;
      detected = true;
    }

    // Surface parse/spawn errors to the output channel without throwing.
    for (const res of [summaryRes, graphRes, healthRes]) {
      if (res.stderr.trim()) {
        this.output.appendLine(`[re-shell] stderr: ${res.stderr.trim()}`);
      }
    }
    if (!detected && (graphParsed.ok === false || summaryParsed.ok === false)) {
      const err = graphParsed.ok ? summaryParsed : graphParsed;
      if (!err.ok) {
        this.output.appendLine(`[re-shell] workspace unavailable: ${err.error}`);
      }
    }

    const overall = healthToOverallStatus(healthSummary);
    this.snapshot = {
      detected,
      apps,
      packages,
      overallStatus: overall?.status ?? null,
      warnCount: overall?.warnCount ?? 0,
      failCount: overall?.failCount ?? 0,
    };

    // Commands catalog.
    const commandsParsed = parseCommandCatalog(commandsRes.stdout);
    if (commandsParsed.ok) {
      this.commands = commandsParsed.entries;
    } else {
      this.commands = [];
      if (commandsParsed.ok === false) {
        this.output.appendLine(`[re-shell] commands unavailable: ${commandsParsed.error}`);
      }
    }

    // Templates list.
    const templatesParsed = parseTemplatesList(templatesRes.stdout);
    if (templatesParsed.ok) {
      this.templates = templatesParsed.templates;
      this.lastTemplatesError = null;
    } else {
      this.templates = [];
      this.lastTemplatesError = templatesParsed.ok === false ? templatesParsed.error : 'unknown';
      // A stripped PATH (GUI-launched editor) is the most common cause: the
      // CLI binary exists but the host can't spawn it. Surface a clearer cause.
      if (templatesRes.stderr.trim()) {
        this.lastTemplatesError += ` (stderr: ${templatesRes.stderr.trim()})`;
      }
      this.output.appendLine(`[re-shell] templates unavailable: ${this.lastTemplatesError}`);
    }

    this.onSnapshot.fire(this.snapshot);
  }
}

/** Convert a thrown spawn error into a RunCliResult-shaped object. */
function toErrorResult(err: unknown): { code: number | null; stdout: string; stderr: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: null, stdout: '', stderr: `Failed to spawn the CLI: ${message}` };
}

// ---------------------------------------------------------------------------
// Projects tree
// ---------------------------------------------------------------------------

type ProjectsElement =
  | { readonly type: 'group'; readonly kind: 'app' | 'package'; readonly label: string }
  | { readonly type: 'project'; readonly node: ProjectNode };

class ProjectsTreeProvider implements vscode.TreeDataProvider<ProjectsElement> {
  private readonly emitter = new vscode.EventEmitter<ProjectsElement | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly ctx: ReShellContext) {}

  fire(): void {
    this.emitter.fire();
  }

  getTreeItem(element: ProjectsElement): vscode.TreeItem {
    if (element.type === 'group') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'reShellProjectGroup';
      item.iconPath = new vscode.ThemeIcon(element.kind === 'app' ? 'window' : 'package');
      return item;
    }
    return projectTreeItem(element.node);
  }

  getChildren(element?: ProjectsElement): ProjectsElement[] {
    const snap = this.ctx.current();
    if (!element) {
      const groups: ProjectsElement[] = [];
      if (snap.apps.length > 0) {
        groups.push({ type: 'group', kind: 'app', label: 'Apps' });
      }
      if (snap.packages.length > 0) {
        groups.push({ type: 'group', kind: 'package', label: 'Packages' });
      }
      return groups;
    }
    if (element.type === 'group') {
      const list = element.kind === 'app' ? snap.apps : snap.packages;
      return list.map((node) => ({ type: 'project', node }));
    }
    return [];
  }
}

function healthIcon(status: ProjectNode['health']): vscode.ThemeIcon {
  if (status === 'pass') return new vscode.ThemeIcon('circle-filled');
  if (status === 'warn') return new vscode.ThemeIcon('warning');
  if (status === 'fail') return new vscode.ThemeIcon('error');
  return new vscode.ThemeIcon('circle-outline');
}

function projectTreeItem(node: ProjectNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
  const fw = node.framework ?? 'unknown';
  const depSuffix =
    node.dependencies.length > 0
      ? ` · ${node.dependencies.length} dep${node.dependencies.length > 1 ? 's' : ''}`
      : '';
  item.description = `${fw}${depSuffix}`;
  item.tooltip = `${node.name} (${node.kind})\nframework: ${fw}\npath: ${node.path}${
    node.dependencies.length > 0 ? `\ndependencies: ${node.dependencies.join(', ')}` : ''
  }`;
  item.contextValue = 'reShellProject';
  item.iconPath = healthIcon(node.health);
  return item;
}

// ---------------------------------------------------------------------------
// Commands tree (grouped by category)
// ---------------------------------------------------------------------------

type CommandsElement =
  | { readonly type: 'category'; readonly label: string; readonly entries: CatalogEntry[] }
  | { readonly type: 'command'; readonly entry: CatalogEntry };

class CommandsTreeProvider implements vscode.TreeDataProvider<CommandsElement> {
  private readonly emitter = new vscode.EventEmitter<CommandsElement | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly ctx: ReShellContext) {}

  fire(): void {
    this.emitter.fire();
  }

  getTreeItem(element: CommandsElement): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.entries.length}`;
      item.contextValue = 'reShellCommandCategory';
      item.iconPath = new vscode.ThemeIcon('folder');
      return item;
    }
    const entry = element.entry;
    const item = new vscode.TreeItem(entry.path, vscode.TreeItemCollapsibleState.None);
    item.description = entry.destructive ? 'destructive' : entry.description;
    item.tooltip = entry.description;
    item.contextValue = 'reShellCommand';
    item.iconPath = new vscode.ThemeIcon('terminal');
    item.command = {
      command: 'reShell.runCommandFromTree',
      title: 'Re-Shell: Run Command',
      arguments: [entry],
    };
    return item;
  }

  getChildren(element?: CommandsElement): CommandsElement[] {
    const grouped = groupCommandsByCategory(this.ctx.listCommands());
    if (!element) {
      return grouped.map((g) => ({ type: 'category', label: g.category, entries: g.entries }));
    }
    if (element.type === 'category') {
      return element.entries.map((entry) => ({ type: 'command', entry }));
    }
    return [];
  }
}

interface CommandCategory {
  readonly category: string;
  readonly entries: CatalogEntry[];
}

/**
 * Group a flat command catalog into named categories. The category is the FIRST
 * path segment (e.g. `workspace health` → "Workspace"); unknown top-level
 * commands land in "General". Sorted by category name then path; "General"
 * sorts last.
 */
function groupCommandsByCategory(entries: readonly CatalogEntry[]): CommandCategory[] {
  const byCat = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const segs = entry.path.split(' ').filter((s) => s.length > 0);
    const cat = segs.length > 1 ? titleCase(segs[0]) : 'General';
    let bucket = byCat.get(cat);
    if (!bucket) {
      bucket = [];
      byCat.set(cat, bucket);
    }
    bucket.push(entry);
  }
  return [...byCat.keys()]
    .sort((a, b) => {
      if (a === 'General') return 1;
      if (b === 'General') return -1;
      return a.localeCompare(b);
    })
    .map((category) => ({
      category,
      entries: [...byCat.get(category)!].sort((a, b) => a.path.localeCompare(b.path)),
    }));
}

const UPPERCASE_WORDS: Record<string, string> = {
  ai: 'AI', api: 'API', ci: 'CI', cd: 'CD', db: 'DB', ui: 'UI', k8s: 'K8s',
  grpc: 'gRPC', graphql: 'GraphQL', ssl: 'SSL', tls: 'TLS', http: 'HTTP',
  ssh: 'SSH', dns: 'DNS', cdn: 'CDN', jwt: 'JWT', oauth: 'OAuth',
};

function titleCase(value: string): string {
  if (value.length === 0) return value;
  return UPPERCASE_WORDS[value.toLowerCase()] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Templates tree (grouped by language → framework)
// ---------------------------------------------------------------------------

type TemplatesElement =
  | { readonly type: 'language'; readonly group: TemplatesByLanguage }
  | {
      readonly type: 'framework';
      readonly language: string;
      readonly framework: string;
      readonly templates: readonly TemplateSummary[];
    }
  | { readonly type: 'template'; readonly template: TemplateSummary };

class TemplatesTreeProvider implements vscode.TreeDataProvider<TemplatesElement> {
  private readonly emitter = new vscode.EventEmitter<TemplatesElement | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly ctx: ReShellContext) {}

  fire(): void {
    this.emitter.fire();
  }

  getTreeItem(element: TemplatesElement): vscode.TreeItem {
    if (element.type === 'language') {
      const item = new vscode.TreeItem(element.group.label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.group.frameworks.reduce((n, f) => n + f.templates.length, 0)}`;
      item.contextValue = 'reShellTemplateLanguage';
      item.iconPath = new vscode.ThemeIcon('symbol-namespace');
      return item;
    }
    if (element.type === 'framework') {
      const item = new vscode.TreeItem(element.framework, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = `${element.templates.length}`;
      item.contextValue = 'reShellTemplateFramework';
      item.iconPath = new vscode.ThemeIcon('layers');
      return item;
    }
    const t = element.template;
    const item = new vscode.TreeItem(
      t.displayName || t.name,
      vscode.TreeItemCollapsibleState.None
    );
    // Show version/port as the leaf subtitle; the CLI feed has no `domain`.
    item.description = [t.version ? `v${t.version}` : '', t.port ? `:${t.port}` : '']
      .filter((s) => s.length > 0)
      .join(' ');
    item.tooltip =
      `${t.displayName || t.name}\nid: ${t.id}\nframework: ${t.framework}\nlanguage: ${t.language}` +
      (t.version ? `\nversion: ${t.version}` : '') +
      (t.port ? `\nport: ${t.port}` : '') +
      (t.database ? `\ndatabase: ${t.database}` : '') +
      (t.tags.length > 0 ? `\ntags: ${t.tags.join(', ')}` : '');
    item.contextValue = 'reShellTemplate';
    item.iconPath = new vscode.ThemeIcon('file-code');
    item.command = {
      command: 'reShell.createProjectFromTemplate',
      title: 'Re-Shell: Create Project from Template',
      arguments: [t],
    };
    return item;
  }

  getChildren(element?: TemplatesElement): TemplatesElement[] {
    const grouped = groupTemplatesByLanguage(this.ctx.listTemplates());
    if (!element) {
      return grouped.map((group) => ({ type: 'language', group }));
    }
    if (element.type === 'language') {
      return element.group.frameworks.map((f) => ({
        type: 'framework',
        language: element.group.language,
        framework: f.framework,
        templates: f.templates,
      }));
    }
    if (element.type === 'framework') {
      return element.templates.map((template) => ({ type: 'template', template }));
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function renderStatusBar(bar: vscode.StatusBarItem, snap: WorkspaceSnapshot): void {
  if (!snap.detected) {
    bar.text = '$(package) re-shell: No workspace';
    bar.tooltip = 'No re-shell workspace detected. Click to refresh.';
    bar.backgroundColor = undefined;
    bar.show();
    return;
  }
  if (snap.overallStatus === 'pass') {
    bar.text = '$(package) re-shell: Healthy';
    bar.tooltip = 'Re-Shell workspace is healthy. Click to refresh.';
    bar.backgroundColor = undefined;
  } else if (snap.overallStatus === 'fail') {
    bar.text = `$(error) re-shell: ${snap.failCount} error${snap.failCount > 1 ? 's' : ''}`;
    bar.tooltip = `Re-Shell health: ${snap.failCount} error(s), ${snap.warnCount} warning(s). Click to refresh.`;
    bar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (snap.overallStatus === 'warn') {
    bar.text = `$(warning) re-shell: ${snap.warnCount} warning${snap.warnCount > 1 ? 's' : ''}`;
    bar.tooltip = `Re-Shell health: ${snap.warnCount} warning(s). Click to refresh.`;
    bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    bar.text = '$(package) re-shell: Ready';
    bar.tooltip = 'Re-Shell workspace ready. Click to refresh.';
    bar.backgroundColor = undefined;
  }
  bar.show();
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/** Run a vetted argv in the integrated terminal. Argv is fixed-literal. */
function runInTerminal(
  cliBin: string,
  cwd: string,
  argv: readonly string[],
  name = 'Re-Shell'
): void {
  const terminal = vscode.window.createTerminal({ name, cwd });
  terminal.show(true);
  // cliBin may be an absolute path resolved by resolveCliBin; quote it for the
  // terminal if it could otherwise split on whitespace. argv tokens are fixed
  // literals or sanitized values (SAFE_VALUE upstream).
  const quotedBin = cliBin.includes(' ') ? `"${cliBin}"` : cliBin;
  terminal.sendText([quotedBin, ...argv].join(' '), true);
}

async function refreshHandler(ctx: ReShellContext, resolveBin: () => string): Promise<void> {
  await ctx.refreshAll(resolveBin(), getWorkspaceCwd());
}

async function runDoctorHandler(
  cliBin: string,
  cwd: string,
  output: vscode.OutputChannel
): Promise<void> {
  output.appendLine(`[re-shell] running: ${cliBin} doctor --json`);
  output.show(true);
  try {
    const result = await fetchDoctorRaw(cliBin, cwd);
    if (result.stderr.trim()) {
      output.appendLine(`[re-shell] stderr: ${result.stderr.trim()}`);
    }
    const parsed = parseDoctor(result.stdout);
    if (!parsed.ok) {
      output.appendLine(`[re-shell] doctor error: ${parsed.error}`);
      void vscode.window.showErrorMessage(`Re-Shell: ${parsed.error}`);
      return;
    }
    renderDoctorResults(parsed.doctor.checks, output);
    const fails = parsed.doctor.checks.filter((c) => c.status === 'error').length;
    const warns = parsed.doctor.checks.filter((c) => c.status === 'warning').length;
    if (fails > 0) {
      void vscode.window.showErrorMessage(
        `Re-Shell doctor: ${fails} error(s), ${warns} warning(s). See output.`
      );
    } else if (warns > 0) {
      void vscode.window.showWarningMessage(`Re-Shell doctor: ${warns} warning(s). See output.`);
    } else {
      void vscode.window.showInformationMessage('Re-Shell doctor: all checks passed.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output.appendLine(`[re-shell] failed to run doctor: ${message}`);
    void vscode.window.showErrorMessage(`Re-Shell: could not run doctor (${message}).`);
  }
}

function renderDoctorResults(checks: readonly DoctorCheck[], output: vscode.OutputChannel): void {
  output.appendLine('');
  output.appendLine('Re-Shell doctor results');
  output.appendLine('─────────────────────────────────────────────');
  const pass = checks.filter((c) => c.status === 'success').length;
  const warn = checks.filter((c) => c.status === 'warning').length;
  const err = checks.filter((c) => c.status === 'error').length;
  output.appendLine(`summary: ${pass} passed, ${warn} warning(s), ${err} error(s)`);
  output.appendLine('');
  for (const check of checks) {
    const tag =
      check.status === 'success' ? '[PASS]' : check.status === 'warning' ? '[WARN]' : '[FAIL]';
    output.appendLine(`${tag} ${check.name}`);
    output.appendLine(`      ${check.message}`);
    if (check.suggestion) {
      output.appendLine(`      suggestion: ${check.suggestion}`);
    }
  }
  output.appendLine('');
  output.show(true);
}

async function runCommandHandler(
  ctx: ReShellContext,
  cliBin: string,
  cwd: string
): Promise<void> {
  const grouped = groupCommandsByCategory(ctx.listCommands());
  if (grouped.length === 0) {
    void vscode.window.showWarningMessage('Re-Shell: no commands available. Is the CLI installed?');
    return;
  }
  const categoryPick = await vscode.window.showQuickPick(
    grouped.map((g) => ({
      label: g.category,
      description: `${g.entries.length} command${g.entries.length > 1 ? 's' : ''}`,
      detail: g.entries.map((e) => e.path).join(', '),
    })),
    { title: 'Re-Shell: select a category', placeHolder: 'Command category' }
  );
  if (!categoryPick) return;
  const category = grouped.find((g) => g.category === categoryPick.label);
  if (!category) return;

  const commandPick = await vscode.window.showQuickPick(
    category.entries.map((e) => ({
      label: e.path,
      description: e.destructive ? 'destructive' : '',
      detail: e.description,
    })),
    { title: 'Re-Shell: select a command', placeHolder: 'Command' }
  );
  if (!commandPick) return;
  const entry = ctx.findCommand(commandPick.label);
  if (!entry) return;
  await runCommandFromTreeHandler(cliBin, cwd, entry);
}

/**
 * Prompt the user for required arguments and optional flags. Returns the
 * assembled argv tokens (args in order, then --flag value pairs), or undefined
 * if the user cancelled any required prompt.
 */
async function collectCommandArgs(
  entry: CatalogEntry
): Promise<string[] | undefined> {
  const argv: string[] = [];
  const requiredArgs = entry.args.filter((a) => a.required);
  const optionalArgs = entry.args.filter((a) => !a.required);

  // Prompt for each required arg sequentially.
  for (const arg of requiredArgs) {
    const value = await vscode.window.showInputBox({
      prompt: `${entry.path}: ${arg.name} (required)`,
      placeHolder: arg.name,
      validateInput: (v) => (v.trim().length === 0 ? `${arg.name} is required` : undefined),
    });
    if (value === undefined) return undefined;
    argv.push(value.trim());
  }

  // Prompt for optional args (one combined step).
  for (const arg of optionalArgs) {
    const value = await vscode.window.showInputBox({
      prompt: `${entry.path}: ${arg.name} (optional, press Enter to skip)`,
      placeHolder: `${arg.name} (optional)`,
    });
    if (value === undefined) return undefined;
    if (value.trim().length > 0) {
      argv.push(value.trim());
    }
  }

  // Prompt for value-taking flags (show a multi-select of available flags).
  const valueFlags = entry.flags.filter((f) => f.takesValue && f.name !== '--json');
  if (valueFlags.length > 0) {
    const picked = await vscode.window.showQuickPick(
      valueFlags.map((f) => ({
        label: f.name,
        description: f.description,
        detail: f.default !== undefined ? `default: ${String(f.default)}` : undefined,
        picked: false,
      })),
      {
        title: `${entry.path}: optional flags`,
        placeHolder: 'Select flags to set (or press Enter to skip)',
        canPickMany: true,
      }
    );
    if (picked && picked.length > 0) {
      for (const flag of picked) {
        const flagDef = valueFlags.find((f) => f.name === flag.label);
        const value = await vscode.window.showInputBox({
          prompt: `Value for ${flag.label}`,
          placeHolder: flagDef?.description ?? flag.label,
          value: flagDef?.default !== undefined ? String(flagDef.default) : undefined,
        });
        if (value === undefined) return undefined;
        if (value.trim().length > 0) {
          argv.push(flag.label, value.trim());
        }
      }
    }
  }

  return argv;
}

async function runCommandFromTreeHandler(
  cliBin: string,
  cwd: string,
  entry: CatalogEntry
): Promise<void> {
  const hasRequiredArgs = entry.args.some((a) => a.required);
  const baseArgv = entry.path.split(' ').filter((s) => s.length > 0);

  if (hasRequiredArgs) {
    const extraArgv = await collectCommandArgs(entry);
    if (!extraArgv) return;
    runInTerminal(cliBin, cwd, [...baseArgv, ...extraArgv], `Re-Shell: ${entry.path}`);
  } else {
    runInTerminal(cliBin, cwd, baseArgv, `Re-Shell: ${entry.path}`);
  }
}

function copyCommandHandler(entry: CatalogEntry): void {
  void vscode.env.clipboard
    .writeText(['re-shell', ...entry.path.split(' ')].join(' '))
    .then(() => {
      void vscode.window.showInformationMessage(`Re-Shell: copied "${entry.path}" to clipboard.`);
    });
}

// Project actions (right-click). The project name is sanitized before it ever
// reaches the terminal argv.
function buildProjectHandler(cliBin: string, cwd: string, node: ProjectNode): void {
  runInTerminal(cliBin, cwd, ['build', sanitize(node.name)], `Re-Shell: build ${node.name}`);
}

function serveProjectHandler(cliBin: string, cwd: string, node: ProjectNode): void {
  runInTerminal(cliBin, cwd, ['serve', sanitize(node.name)], `Re-Shell: serve ${node.name}`);
}

function testProjectHandler(cliBin: string, cwd: string, node: ProjectNode): void {
  runInTerminal(cliBin, cwd, ['test', sanitize(node.name)], `Re-Shell: test ${node.name}`);
}

function openTerminalHandler(cwd: string, node: ProjectNode): void {
  const terminal = vscode.window.createTerminal({ name: `Re-Shell: ${node.name}`, cwd });
  terminal.show(true);
}

function revealInExplorerHandler(node: ProjectNode): void {
  const uri = vscode.Uri.file(node.path);
  void vscode.commands.executeCommand('revealFileInOS', uri);
}

/** Sanitize a project/node name to the safe-identifier charset. */
function sanitize(value: string): string {
  return SAFE_VALUE.test(value) ? value : '';
}

// ---------------------------------------------------------------------------
// Create project (template-aware)
// ---------------------------------------------------------------------------

async function createProjectHandler(
  cliBin: string,
  cwd: string,
  ctx: ReShellContext,
  preset?: TemplateSummary
): Promise<void> {
  const templates = preset ? [preset] : ctx.listTemplates();
  if (templates.length === 0) {
    void vscode.window.showWarningMessage(
      'Re-Shell: no templates available. Run "Re-Shell: Refresh" or verify the CLI is installed.'
    );
    return;
  }

  // 1. Pick a backend framework (from the templates list).
  let backend: string;
  if (preset) {
    backend = preset.framework;
  } else {
    const frameworkPick = await vscode.window.showQuickPick(
      dedupeFrameworks(templates).map((t) => ({
        label: t.framework,
        description: t.language,
        detail: t.name,
      })),
      { title: 'Re-Shell: select a backend framework', placeHolder: 'Backend framework' }
    );
    if (!frameworkPick) return;
    backend = frameworkPick.label;
  }

  // 2. Project name (sanitized).
  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    placeHolder: 'my-app',
    validateInput: (value) =>
      value === '' || !SAFE_VALUE.test(value)
        ? 'Use letters, digits, ".", "_" or "-" (must start alphanumeric).'
        : undefined,
  });
  if (name === undefined) return;

  // 3. Optional database (only when the chosen template declares one).
  let db: string | undefined;
  const chosen = templates.find((t) => t.framework === backend);
  if (chosen?.database) {
    const dbPick = await vscode.window.showQuickPick(
      ['none', chosen.database, 'prisma', 'typeorm', 'mongoose']
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((d) => ({ label: d })),
      { title: 'Re-Shell: select a database ORM', placeHolder: 'Database (optional)' }
    );
    if (!dbPick) return;
    db = dbPick.label === 'none' ? undefined : dbPick.label;
  }

  // 4. Assemble + run. argv tokens are fixed; only sanitized values interpolate.
  const argv = ['create', name, '--backend', backend];
  if (db) {
    argv.push('--db', db);
  }
  runInTerminal(cliBin, cwd, argv, `Re-Shell: create ${name}`);
}

/** Deduplicate templates by framework for the framework quick-pick. */
function dedupeFrameworks(templates: readonly TemplateSummary[]): TemplateSummary[] {
  const seen = new Set<string>();
  const out: TemplateSummary[] = [];
  for (const t of templates) {
    if (seen.has(t.framework)) continue;
    seen.add(t.framework);
    out.push(t);
  }
  return out.sort((a, b) => a.framework.localeCompare(b.framework));
}

function openTerminalPaletteHandler(cwd: string): void {
  const terminal = vscode.window.createTerminal({ name: 'Re-Shell', cwd });
  terminal.show(true);
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Re-Shell');
  const snapshotEmitter = new vscode.EventEmitter<WorkspaceSnapshot>();
  const ctx = new ReShellContext(output, snapshotEmitter);

  const projectsProvider = new ProjectsTreeProvider(ctx);
  const commandsProvider = new CommandsTreeProvider(ctx);
  const templatesProvider = new TemplatesTreeProvider(ctx);

  const projectsView = vscode.window.createTreeView(VIEW_PROJECTS, {
    treeDataProvider: projectsProvider,
  });
  const commandsView = vscode.window.createTreeView(VIEW_COMMANDS, {
    treeDataProvider: commandsProvider,
  });
  const templatesView = vscode.window.createTreeView(VIEW_TEMPLATES, {
    treeDataProvider: templatesProvider,
  });

  // Status bar: reflects the workspace health snapshot. Click → refresh.
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  statusBar.command = 'reShell.refresh';
  renderStatusBar(statusBar, ctx.current());
  context.subscriptions.push(
    snapshotEmitter.event((snap) => {
      renderStatusBar(statusBar, snap);
      // Drive the viewsWelcome `when` clauses. These context keys toggle the
      // welcome content shown when a view is empty.
      void vscode.commands.executeCommand('setContext', 'reShell.workspaceDetected', snap.detected);
      void vscode.commands.executeCommand(
        'setContext',
        'reShell.hasProjects',
        snap.apps.length > 0 || snap.packages.length > 0
      );
      void vscode.commands.executeCommand(
        'setContext',
        'reShell.templatesLoaded',
        ctx.listTemplates().length > 0
      );
    })
  );

  // Wire snapshot changes to each provider's fire().
  context.subscriptions.push(
    snapshotEmitter.event(() => {
      projectsProvider.fire();
      commandsProvider.fire();
      templatesProvider.fire();
    })
  );

  const cwd = getWorkspaceCwd();
  // Resolve the CLI to an absolute path each call. GUI-launched VS Code inherits
  // a minimal PATH; resolveCliBin probes common global bin dirs + the login
  // shell so the extension works even when `re-shell` isn't on the host PATH.
  // Re-reads config (reShell.cliBin) live, so config changes apply immediately.
  const resolveBin = (): string => resolveCliBin(getCliBin(), (m) => output.appendLine(m));

  // --- Argument resolvers for tree-node right-click / palette invocations ---
  const resolveProject = (arg: unknown): ProjectNode | undefined => {
    if (arg && typeof arg === 'object' && 'kind' in arg && 'name' in arg) {
      return arg as ProjectNode;
    }
    void vscode.window.showWarningMessage(
      'Re-Shell: select a project from the Projects view first.'
    );
    return undefined;
  };
  const resolveCommand = (arg: unknown): CatalogEntry | undefined => {
    if (arg && typeof arg === 'object' && 'path' in arg) {
      return ctx.findCommand((arg as { path: string }).path) ?? (arg as CatalogEntry);
    }
    void vscode.window.showWarningMessage(
      'Re-Shell: select a command from the Commands view first.'
    );
    return undefined;
  };
  const resolveTemplate = (arg: unknown): TemplateSummary | undefined => {
    if (arg && typeof arg === 'object' && 'id' in arg) {
      return arg as TemplateSummary;
    }
    void vscode.window.showWarningMessage(
      'Re-Shell: select a template from the Templates view first.'
    );
    return undefined;
  };

  context.subscriptions.push(
    output,
    statusBar,
    projectsView,
    commandsView,
    templatesView,

    vscode.commands.registerCommand('reShell.refresh', () => refreshHandler(ctx, resolveBin)),
    vscode.commands.registerCommand('reShell.runDoctor', () =>
      runDoctorHandler(resolveBin(), cwd, output)
    ),
    vscode.commands.registerCommand('reShell.runCommand', () =>
      runCommandHandler(ctx, resolveBin(), cwd)
    ),
    vscode.commands.registerCommand('reShell.openTerminal', () =>
      openTerminalPaletteHandler(cwd)
    ),
    vscode.commands.registerCommand('reShell.createProject', () =>
      createProjectHandler(resolveBin(), cwd, ctx)
    ),
    vscode.commands.registerCommand('reShell.createProjectFromTemplate', (arg: unknown) => {
      const t = resolveTemplate(arg);
      if (t) void createProjectHandler(resolveBin(), cwd, ctx, t);
    }),

    // Commands-view actions
    vscode.commands.registerCommand('reShell.runCommandFromTree', (arg: unknown) => {
      const entry = resolveCommand(arg);
      if (entry) runCommandFromTreeHandler(resolveBin(), cwd, entry);
    }),
    vscode.commands.registerCommand('reShell.copyCommand', (arg: unknown) => {
      const entry = resolveCommand(arg);
      if (entry) copyCommandHandler(entry);
    }),

    // Project right-click actions
    vscode.commands.registerCommand('reShell.buildProject', (arg: unknown) => {
      const node = resolveProject(arg);
      if (node) buildProjectHandler(resolveBin(), cwd, node);
    }),
    vscode.commands.registerCommand('reShell.serveProject', (arg: unknown) => {
      const node = resolveProject(arg);
      if (node) serveProjectHandler(resolveBin(), cwd, node);
    }),
    vscode.commands.registerCommand('reShell.testProject', (arg: unknown) => {
      const node = resolveProject(arg);
      if (node) testProjectHandler(resolveBin(), cwd, node);
    }),
    vscode.commands.registerCommand('reShell.openProjectTerminal', (arg: unknown) => {
      const node = resolveProject(arg);
      if (node) openTerminalHandler(cwd, node);
    }),
    vscode.commands.registerCommand('reShell.revealProject', (arg: unknown) => {
      const node = resolveProject(arg);
      if (node) revealInExplorerHandler(node);
    }),

    vscode.commands.registerCommand('reShell.showOutput', () => output.show(true))
  );

  // File watcher: refresh when workspace.yaml / package.json changes. The CLI
  // is still the source of truth; the watcher just triggers a re-fetch.
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{workspace.yaml,workspace.yml,package.json,pnpm-workspace.yaml}'
  );
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(() => void refreshHandler(ctx, resolveBin)),
    watcher.onDidCreate(() => void refreshHandler(ctx, resolveBin)),
    watcher.onDidDelete(() => void refreshHandler(ctx, resolveBin)),
    // Re-resolve the CLI binary when the user edits its config path.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('reShell.cliBin')) {
        void refreshHandler(ctx, resolveBin);
      }
    })
  );

  // Initial load + startup diagnostic. If the CLI can't be resolved or run,
  // surface a visible error (with a Show Output action) so the cause isn't
  // buried in the output channel — a stripped PATH is the usual suspect.
  void refreshHandler(ctx, resolveBin).then(() => {
    const resolved = ctx.resolvedBin();
    output.appendLine(`[re-shell] activation: cwd=${cwd} resolved CLI=${resolved}`);
    if (ctx.listTemplates().length === 0) {
      const err = ctx.templatesError() ?? 'unknown error';
      void vscode.window
        .showErrorMessage(
          `Re-Shell: templates failed to load. CLI resolved to "${resolved}". ` +
            `Set "reShell.cliBin" to an absolute path if wrong. ` +
            `Error: ${err}`,
          'Show Output'
        )
        .then((choice: string | undefined) => {
          if (choice === 'Show Output') output.show(true);
        });
    } else {
      output.appendLine(
        `[re-shell] CLI OK: ${ctx.listTemplates().length} templates loaded from ${resolved}`
      );
    }
  });
}

export function deactivate(): void {
  // Subscriptions registered on context are disposed by the host automatically.
}
