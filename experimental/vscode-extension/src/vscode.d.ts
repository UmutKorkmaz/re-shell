/**
 * Minimal ambient declaration of the slice of the VS Code extension API used by
 * extension.ts.
 *
 * We intentionally do NOT depend on `@types/vscode` (its install pulls a large
 * package, and the full host download via @vscode/test-electron is out of scope
 * here). At runtime the real `vscode` module is injected by the editor host; at
 * build/typecheck time these declarations give us a typed, `any`-free surface.
 *
 * Keep this surface as small as the extension actually consumes. Extend it only
 * when extension.ts grows a new API call.
 */
declare module 'vscode' {
  export interface Disposable {
    dispose(): void;
  }

  export interface Event<T> {
    (listener: (e: T) => unknown): Disposable;
  }

  export class EventEmitter<T> {
    readonly event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }

  export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
  }

  export class ThemeIcon {
    constructor(id: string);
  }

  /** A themed color reference (e.g. `statusBarItem.warningBackground`). */
  export class ThemeColor {
    constructor(id: string);
  }

  export interface MarkdownString {
    readonly value: string;
  }

  export class TreeItem {
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState);
    label?: string;
    description?: string;
    tooltip?: string | MarkdownString;
    contextValue?: string;
    iconPath?: ThemeIcon;
    command?: Command;
  }

  export interface Command {
    title: string;
    command: string;
    arguments?: unknown[];
  }

  export interface TreeDataProvider<T> {
    onDidChangeTreeData?: Event<T | undefined | null | void>;
    getTreeItem(element: T): TreeItem | Thenable<TreeItem>;
    getChildren(element?: T): Thenable<T[]> | T[];
  }

  export interface TreeView<T> extends Disposable {
    readonly visible: boolean;
    onDidChangeVisibility: Event<TreeViewVisibilityChangeEvent>;
    reveal(
      element: T,
      options?: { select?: boolean; focus?: boolean; expand?: boolean | number }
    ): Thenable<void>;
  }

  export interface TreeViewVisibilityChangeEvent {
    readonly visible: boolean;
  }

  export interface OutputChannel extends Disposable {
    readonly name: string;
    append(value: string): void;
    appendLine(value: string): void;
    clear(): void;
    show(preserveFocus?: boolean): void;
    hide(): void;
  }

  /**
   * Alignment of a status bar item relative to other items. Only Left/Right are
   * used by the extension; the full enum exists for API parity with the host.
   */
  export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
  }

  export interface StatusBarItem extends Disposable {
    readonly alignment: StatusBarAlignment;
    readonly priority: number;
    text: string;
    tooltip: string | MarkdownString | undefined;
    command: string | undefined;
    backgroundColor: ThemeColor | undefined;
    color: string | undefined;
    show(): void;
    hide(): void;
  }

  /** A terminal in the integrated terminal panel. */
  export interface Terminal extends Disposable {
    readonly name: string;
    readonly processId: Thenable<number | undefined>;
    readonly exitStatus: TerminalExitStatus | undefined;
    show(preserveFocus?: boolean): void;
    hide(): void;
    sendText(text: string, shouldExecute?: boolean): void;
    dispose(): void;
  }

  export interface TerminalExitStatus {
    readonly code: number;
  }

  /**
   * Options for createTerminal(). Mirrors the host's ShellTerminalOptions slice
   * the extension actually uses (name + working directory). At runtime the host
   * accepts this object form; the positional createTerminal(name, shellPath,
   * cwd) form is NOT used because its 2nd arg is interpreted as the shell path.
   */
  export interface TerminalOptions {
    name?: string;
    cwd?: Uri | string;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string): T | undefined;
    get<T>(section: string, defaultValue: T): T;
    has(section: string): boolean;
    update(section: string, value: unknown, global?: boolean): Thenable<void>;
  }

  export interface Uri {
    readonly fsPath: string;
    readonly scheme: string;
    readonly path: string;
    readonly authority: string;
    readonly query: string;
    readonly fragment: string;
    with(change: {
      scheme?: string;
      authority?: string;
      path?: string;
      query?: string;
      fragment?: string;
    }): Uri;
    toString(): string;
  }

  export namespace Uri {
    export function file(path: string): Uri;
    export function parse(value: string): Uri;
  }

  export interface Clipboard {
    readText(): Thenable<string>;
    writeText(value: string): Thenable<void>;
  }

  export interface Env {
    readonly appName: string;
    readonly clipboard: Clipboard;
    readonly machineId: string;
    readonly sessionId: string;
    openExternal(target: Uri): Thenable<boolean>;
  }

  export const env: Env;

  export interface WorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
    readonly index: number;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
    readonly extensionUri: Uri;
    readonly extensionPath: string;
  }

  export interface QuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    picked?: boolean;
  }

  export interface QuickPickOptions {
    title?: string;
    placeHolder?: string;
    canPickMany?: boolean;
    ignoreFocusOut?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
  }

  export interface InputBoxOptions {
    prompt?: string;
    placeHolder?: string;
    value?: string;
    password?: boolean;
    ignoreFocusOut?: boolean;
    validateInput?: (value: string) => string | undefined | null;
  }

  export interface FileSystemWatcher extends Disposable {
    onDidChange: Event<Uri>;
    onDidCreate: Event<Uri>;
    onDidDelete: Event<Uri>;
  }

  export namespace window {
    export function showInformationMessage(
      message: string,
      ...items: string[]
    ): Thenable<string | undefined>;
    export function showWarningMessage(
      message: string,
      ...items: string[]
    ): Thenable<string | undefined>;
    export function showErrorMessage(
      message: string,
      ...items: string[]
    ): Thenable<string | undefined>;
    export function showInputBox(options?: InputBoxOptions): Thenable<string | undefined>;
    export function showQuickPick(
      items: readonly QuickPickItem[],
      options?: QuickPickOptions
    ): Thenable<QuickPickItem | undefined>;
    export function createOutputChannel(name: string): OutputChannel;
    export function registerTreeDataProvider<T>(
      viewId: string,
      provider: TreeDataProvider<T>
    ): Disposable;
    export function createTreeView<T>(
      viewId: string,
      options: { treeDataProvider: TreeDataProvider<T> }
    ): TreeView<T>;
    export function createStatusBarItem(
      alignment?: StatusBarAlignment,
      priority?: number
    ): StatusBarItem;
    export function createTerminal(options: TerminalOptions): Terminal;
    export function createTerminal(name?: string, cwd?: Uri | string): Terminal;
    export const activeTerminal: Terminal | undefined;
    export const terminals: readonly Terminal[];
  }

  export interface ConfigurationChangeEvent {
    affectsConfiguration(section: string, scope?: unknown): boolean;
  }

  export namespace workspace {
    export const workspaceFolders: readonly WorkspaceFolder[] | undefined;
    export const onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
    export function getConfiguration(section?: string): WorkspaceConfiguration;
    export function createFileSystemWatcher(pattern: string): FileSystemWatcher;
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;
    export function findFiles(include: string, exclude?: string): Thenable<Uri[]>;
    export namespace fs {
      export function exists(uri: Uri): Thenable<boolean>;
    }
  }

  export namespace commands {
    export function registerCommand(
      command: string,
      callback: (...args: unknown[]) => unknown
    ): Disposable;
    export function executeCommand<T>(command: string, ...rest: unknown[]): Thenable<T | undefined>;
  }
}
