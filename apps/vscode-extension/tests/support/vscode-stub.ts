/**
 * A recording stand-in for the `vscode` module, used ONLY by the vitest
 * integration tests (`vitest.integration.config.ts` aliases `vscode` here) so
 * that `src/extension.ts` can be activated outside an editor.
 *
 * It implements just the slice of the API the extension consumes, with simple
 * real behaviour (an in-memory command registry, settings store, event
 * emitters). It is NOT a substitute for the real editor: the genuine host is
 * covered by `tests/host` via `@vscode/test-electron`.
 */

type Listener<T> = (e: T) => unknown;

export class EventEmitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  readonly event = (listener: Listener<T>): { dispose(): void } => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  fire(e?: T): void {
    for (const listener of [...this.listeners]) {
      listener(e as T);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  description?: string | boolean;
  tooltip?: string;
  contextValue?: string;
  iconPath?: unknown;
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(
    public label: string,
    public collapsibleState?: TreeItemCollapsibleState
  ) {}
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export const Uri = {
  file: (fsPath: string) => ({ fsPath, scheme: 'file', path: fsPath }),
};

// ---------------------------------------------------------------------------
// Controllable state
// ---------------------------------------------------------------------------

export interface StubTerminal {
  readonly name: string;
  readonly cwd: unknown;
  readonly sent: string[];
}

/**
 * Everything a test may set up or inspect. `reset()` restores a clean slate
 * between tests.
 */
export const stubState = {
  /** Settings by full key, e.g. `reShell.cliBin`. */
  settings: new Map<string, unknown>(),
  workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
  /** Messages shown, in order. */
  messages: [] as { level: 'info' | 'warning' | 'error'; text: string; actions: string[] }[],
  terminals: [] as StubTerminal[],
  /** Answers handed to quick picks / input boxes, consumed in order. */
  quickPickAnswers: [] as unknown[],
  inputAnswers: [] as (string | undefined)[],
  /** Choice handed to the next message with actions (e.g. a modal confirmation). */
  messageChoice: undefined as string | undefined,
  clipboard: '',
  output: [] as string[],
  reset(): void {
    this.settings.clear();
    this.workspaceFolders = undefined;
    this.messages.length = 0;
    this.terminals.length = 0;
    this.quickPickAnswers.length = 0;
    this.inputAnswers.length = 0;
    this.messageChoice = undefined;
    this.clipboard = '';
    this.output.length = 0;
    commandHandlers.clear();
  },
};

const commandHandlers = new Map<string, (...args: unknown[]) => unknown>();
const configChange = new EventEmitter<{ affectsConfiguration(section: string): boolean }>();

// ---------------------------------------------------------------------------
// API namespaces
// ---------------------------------------------------------------------------

export const workspace = {
  get workspaceFolders() {
    return stubState.workspaceFolders;
  },
  getConfiguration(section?: string) {
    const prefix = section ? `${section}.` : '';
    return {
      get<T>(key: string, defaultValue?: T): T | undefined {
        const full = `${prefix}${key}`;
        return (stubState.settings.has(full) ? stubState.settings.get(full) : defaultValue) as T | undefined;
      },
    };
  },
  createFileSystemWatcher() {
    const noop = () => ({ dispose() {} });
    return { onDidChange: noop, onDidCreate: noop, onDidDelete: noop, dispose() {} };
  },
  onDidChangeConfiguration: configChange.event,
};

function record(level: 'info' | 'warning' | 'error', text: string, rest: unknown[]): Promise<string | undefined> {
  const actions = rest.filter((r): r is string => typeof r === 'string');
  stubState.messages.push({ level, text, actions });
  const choice = stubState.messageChoice;
  stubState.messageChoice = undefined;
  return Promise.resolve(choice !== undefined && actions.includes(choice) ? choice : undefined);
}

export const window = {
  createOutputChannel(name: string) {
    return {
      name,
      appendLine: (line: string) => stubState.output.push(line),
      show() {},
      dispose() {},
    };
  },
  createTreeView() {
    return { dispose() {} };
  },
  createStatusBarItem() {
    return { text: '', tooltip: '', command: undefined, backgroundColor: undefined, show() {}, dispose() {} };
  },
  createTerminal(options: { name: string; cwd?: unknown }): StubTerminal & {
    show(): void;
    sendText(text: string): void;
    dispose(): void;
  } {
    const terminal = {
      name: options.name,
      cwd: options.cwd,
      sent: [] as string[],
      show() {},
      sendText(text: string) {
        terminal.sent.push(text);
      },
      dispose() {},
    };
    stubState.terminals.push(terminal);
    return terminal;
  },
  showInformationMessage: (text: string, ...rest: unknown[]) => record('info', text, rest),
  showWarningMessage: (text: string, ...rest: unknown[]) => record('warning', text, rest),
  showErrorMessage: (text: string, ...rest: unknown[]) => record('error', text, rest),
  async showQuickPick(items: readonly unknown[]): Promise<unknown> {
    const answer = stubState.quickPickAnswers.shift();
    if (typeof answer === 'function') {
      return (answer as (items: readonly unknown[]) => unknown)(items);
    }
    return answer;
  },
  async showInputBox(): Promise<string | undefined> {
    return stubState.inputAnswers.shift();
  },
  async withProgress<T>(
    _options: unknown,
    task: (progress: { report(): void }, token: { onCancellationRequested: (l: () => void) => { dispose(): void } }) => Thenable<T>
  ): Promise<T> {
    return task(
      { report() {} },
      { onCancellationRequested: () => ({ dispose() {} }) }
    );
  },
};

export const commands = {
  registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
    commandHandlers.set(id, handler);
    return { dispose: () => commandHandlers.delete(id) };
  },
  async executeCommand(id: string, ...args: unknown[]): Promise<unknown> {
    if (id === 'setContext') return undefined; // context keys have no observable effect here
    const handler = commandHandlers.get(id);
    if (!handler) {
      throw new Error(`command '${id}' not found`);
    }
    return handler(...args);
  },
};

export const env = {
  clipboard: {
    async writeText(text: string): Promise<void> {
      stubState.clipboard = text;
    },
  },
};

/** Minimal `ExtensionContext`: only `subscriptions` is consumed. */
export function createExtensionContext(): { subscriptions: { dispose(): unknown }[] } {
  return { subscriptions: [] };
}
