import * as vscode from 'vscode';

import { fetchCommandCatalogRaw } from './cli.js';
import {
  parseCommandCatalog,
  buildCommand,
  isHubRunnable,
  toHubRunRequest,
  buildEventsRequest,
  type CatalogEntry,
  type CommandParams,
  type HubConfig,
} from './core/index.js';

/**
 * VS Code host layer. Deliberately THIN: every decision (envelope parsing,
 * argv assembly, hub request shaping) lives in src/core, which is pure and
 * unit-tested without the VS Code host. This file only wires those pure
 * functions to editor surfaces (tree view + commands) and performs I/O.
 */

const VIEW_ID = 'reShell.commands';

function getWorkspaceCwd(): string {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
}

function getCliBin(): string {
  return vscode.workspace.getConfiguration('reShell').get<string>('cliBin', 're-shell');
}

function getHubConfig(): HubConfig {
  const cfg = vscode.workspace.getConfiguration('reShell');
  return {
    baseUrl: cfg.get<string>('hub.url', 'http://127.0.0.1:5179'),
    token: cfg.get<string>('hub.token', ''),
  };
}

/** Tree provider sourced from `re-shell commands list --json`. */
class CommandsTreeProvider implements vscode.TreeDataProvider<CatalogEntry> {
  private readonly emitter = new vscode.EventEmitter<CatalogEntry | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private entries: CatalogEntry[] = [];

  constructor(private readonly output: vscode.OutputChannel) {}

  async refresh(): Promise<void> {
    const cliBin = getCliBin();
    const cwd = getWorkspaceCwd();
    try {
      const result = await fetchCommandCatalogRaw(cliBin, cwd);
      const parsed = parseCommandCatalog(result.stdout);
      if (!parsed.ok) {
        this.entries = [];
        this.output.appendLine(`[re-shell] catalog error: ${parsed.error}`);
        if (result.stderr.trim()) {
          this.output.appendLine(`[re-shell] stderr: ${result.stderr.trim()}`);
        }
        void vscode.window.showErrorMessage(`Re-Shell: ${parsed.error}`);
      } else {
        this.entries = parsed.entries;
        for (const w of parsed.warnings) {
          this.output.appendLine(`[re-shell] warning: ${w}`);
        }
      }
    } catch (err) {
      this.entries = [];
      const message = err instanceof Error ? err.message : String(err);
      this.output.appendLine(`[re-shell] failed to run "${cliBin} commands list --json": ${message}`);
      void vscode.window.showErrorMessage(`Re-Shell: could not run the CLI (${message}).`);
    }
    this.emitter.fire();
  }

  getTreeItem(element: CatalogEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(element.path, vscode.TreeItemCollapsibleState.None);
    item.description = element.destructive ? 'destructive' : element.description;
    item.tooltip = element.description;
    item.contextValue = 'reShellCommand';
    item.iconPath = new vscode.ThemeIcon(isHubRunnable(element) ? 'play' : 'terminal');
    item.command = {
      command: 'reShell.buildCommand',
      title: 'Re-Shell: Build Command',
      arguments: [element],
    };
    return item;
  }

  getChildren(): CatalogEntry[] {
    return this.entries;
  }

  find(path: string): CatalogEntry | undefined {
    return this.entries.find((e) => e.path === path);
  }
}

/**
 * Prompt for required args/value-flags of an entry, then assemble argv via the
 * pure builder. Returns undefined if the user cancels.
 */
async function promptParams(entry: CatalogEntry): Promise<CommandParams | undefined> {
  const args: Record<string, string> = {};
  for (const arg of entry.args) {
    const value = await vscode.window.showInputBox({
      prompt: `Argument "${arg.name}"${arg.required ? ' (required)' : ' (optional)'}`,
      placeHolder: arg.name,
    });
    if (value === undefined) {
      return undefined;
    }
    if (value !== '') {
      args[arg.name] = value;
    }
  }
  const switches = entry.supportsJson ? ['--json'] : [];
  return { args, switches };
}

async function buildCommandHandler(entry: CatalogEntry, output: vscode.OutputChannel): Promise<void> {
  const params = await promptParams(entry);
  if (params === undefined) {
    return;
  }
  const built = buildCommand(entry, params);
  if (!built.ok) {
    void vscode.window.showErrorMessage(`Re-Shell: ${built.error}`);
    return;
  }
  output.appendLine(`[re-shell] built: ${built.commandText}`);
  output.show(true);
  void vscode.window.showInformationMessage(`Re-Shell command: ${built.commandText}`);
}

async function runViaHubHandler(entry: CatalogEntry, output: vscode.OutputChannel): Promise<void> {
  const mapped = toHubRunRequest(entry, getWorkspaceCwd());
  if (!mapped.ok) {
    void vscode.window.showWarningMessage(`Re-Shell: ${mapped.error}`);
    return;
  }
  const hub = getHubConfig();
  if (!hub.token) {
    void vscode.window.showErrorMessage('Re-Shell: set "reShell.hub.token" before running via the hub.');
    return;
  }
  const request = buildEventsRequest(hub, mapped.commandId, mapped.params);
  output.appendLine(`[re-shell] hub run: ${mapped.params.subcommand} -> ${request.method} ${request.url}`);
  output.show(true);

  // The thin layer performs the actual SSE fetch; the descriptor was shaped by
  // the pure hub-client. Stream chunks to the output channel.
  try {
    const response = await fetch(request.url, { method: request.method, headers: request.headers });
    if (!response.ok || !response.body) {
      void vscode.window.showErrorMessage(`Re-Shell: hub returned ${response.status}.`);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      output.appendLine(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Re-Shell: hub request failed (${message}).`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Re-Shell');
  const provider = new CommandsTreeProvider(output);

  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider(VIEW_ID, provider),
    vscode.commands.registerCommand('reShell.refreshCommands', () => provider.refresh()),
    vscode.commands.registerCommand('reShell.buildCommand', (entry: unknown) => {
      const resolved = resolveEntryArg(entry, provider);
      if (resolved) {
        void buildCommandHandler(resolved, output);
      }
    }),
    vscode.commands.registerCommand('reShell.runViaHub', (entry: unknown) => {
      const resolved = resolveEntryArg(entry, provider);
      if (resolved) {
        void runViaHubHandler(resolved, output);
      }
    })
  );

  void provider.refresh();
}

/**
 * Commands may be invoked with a tree node (the CatalogEntry) or, from the
 * palette, with no argument. Resolve to a concrete entry, warning when one
 * cannot be determined.
 */
function resolveEntryArg(entry: unknown, provider: CommandsTreeProvider): CatalogEntry | undefined {
  if (entry && typeof entry === 'object' && 'path' in entry && typeof (entry as { path: unknown }).path === 'string') {
    const found = provider.find((entry as { path: string }).path);
    if (found) {
      return found;
    }
  }
  void vscode.window.showWarningMessage('Re-Shell: select a command from the Re-Shell view first.');
  return undefined;
}

export function deactivate(): void {
  // Subscriptions registered on context are disposed by the host automatically.
}
