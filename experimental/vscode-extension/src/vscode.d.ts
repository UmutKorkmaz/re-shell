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

  export class TreeItem {
    constructor(label: string, collapsibleState?: TreeItemCollapsibleState);
    label?: string;
    description?: string;
    tooltip?: string;
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

  export interface OutputChannel extends Disposable {
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
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
    tooltip: string | undefined;
    command: string | undefined;
    show(): void;
    hide(): void;
  }

  /** A terminal in the integrated terminal panel. */
  export interface Terminal extends Disposable {
    readonly name: string;
    show(preserveFocus?: boolean): void;
    hide(): void;
    sendText(text: string, shouldExecute?: boolean): void;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string): T | undefined;
    get<T>(section: string, defaultValue: T): T;
  }

  export interface WorkspaceFolder {
    readonly uri: { readonly fsPath: string };
    readonly name: string;
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[];
  }

  export interface QuickPickItem {
    label: string;
    description?: string;
    detail?: string;
  }

  export namespace window {
    export function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showInputBox(options?: {
      prompt?: string;
      placeHolder?: string;
      value?: string;
    }): Thenable<string | undefined>;
    export function createOutputChannel(name: string): OutputChannel;
    export function registerTreeDataProvider<T>(viewId: string, provider: TreeDataProvider<T>): Disposable;
    export function createStatusBarItem(
      alignment?: StatusBarAlignment,
      priority?: number
    ): StatusBarItem;
    export function createTerminal(name?: string): Terminal;
    export const activeTerminal: Terminal | undefined;
  }

  export namespace workspace {
    export const workspaceFolders: readonly WorkspaceFolder[] | undefined;
    export function getConfiguration(section?: string): WorkspaceConfiguration;
  }

  export namespace commands {
    export function registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
    export function executeCommand<T>(command: string, ...rest: unknown[]): Thenable<T | undefined>;
  }
}
