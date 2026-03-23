import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface Operation {
  id: string;
  type: OperationType;
  name: string;
  description: string;
  timestamp: Date;
  duration?: number;
  status: OperationStatus;
  context: OperationContext;
  steps: OperationStep[];
  rollbackSteps: RollbackStep[];
  metadata: {
    user?: string;
    workspace?: string;
    command: string;
    args: string[];
    version: string;
  };
}

export enum OperationType {
  CREATE_PROJECT = 'create_project',
  ADD_MICROFRONTEND = 'add_microfrontend',
  INSTALL_DEPENDENCIES = 'install_dependencies',
  UPDATE_CONFIGURATION = 'update_configuration',
  FILE_MODIFICATION = 'file_modification',
  GENERATE_CODE = 'generate_code',
  BUILD_OPERATION = 'build_operation',
  DEPLOY_OPERATION = 'deploy_operation',
  PLUGIN_INSTALL = 'plugin_install',
  WORKSPACE_INIT = 'workspace_init',
  TEMPLATE_APPLICATION = 'template_application',
  CUSTOM = 'custom'
}

export enum OperationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  ROLLBACK_FAILED = 'rollback_failed'
}

export interface OperationContext {
  workingDirectory: string;
  backupDirectory?: string;
  snapshotId?: string;
  environmentVariables?: Record<string, string>;
  dependencies?: string[];
  affectedFiles?: string[];
  createdFiles?: string[];
  modifiedFiles?: string[];
  deletedFiles?: string[];
  installedPackages?: string[];
  configurationChanges?: Array<{
    file: string;
    key: string;
    oldValue: any;
    newValue: any;
  }>;
}

export interface OperationStep {
  id: string;
  type: StepType;
  name: string;
  description: string;
  action: () => Promise<StepResult>;
  executed: boolean;
  result?: StepResult;
  timestamp?: Date;
  duration?: number;
  dependencies?: string[];
  rollbackInfo?: any;
}

export interface RollbackStep {
  id: string;
  name: string;
  description: string;
  action: () => Promise<void>;
  critical: boolean;
  timeout: number;
  dependencies?: string[];
  condition?: () => boolean;
}

export enum StepType {
  FILE_CREATE = 'file_create',
  FILE_MODIFY = 'file_modify',
  FILE_DELETE = 'file_delete',
  DIRECTORY_CREATE = 'directory_create',
  DIRECTORY_DELETE = 'directory_delete',
  PACKAGE_INSTALL = 'package_install',
  PACKAGE_UNINSTALL = 'package_uninstall',
  CONFIG_UPDATE = 'config_update',
  COMMAND_EXECUTE = 'command_execute',
  TEMPLATE_COPY = 'template_copy',
  DEPENDENCY_RESOLUTION = 'dependency_resolution',
  VALIDATION = 'validation',
  CLEANUP = 'cleanup'
}

export interface StepResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
  rollbackInfo?: {
    type: 'file_backup' | 'config_backup' | 'package_backup' | 'custom';
    data: any;
  };
}

export interface RollbackResult {
  success: boolean;
  completedSteps: number;
  failedSteps: number;
  errors: Array<{
    step: string;
    error: string;
  }>;
  warnings: string[];
  duration: number;
}

export interface RecoveryOptions {
  autoBackup: boolean;
  backupBeforeRollback: boolean;
  continueOnRollbackFailure: boolean;
  maxRollbackAttempts: number;
  rollbackTimeout: number;
  preserveUserFiles: boolean;
  confirmRollback: boolean;
}

export class OperationManager extends EventEmitter {
  private operations: Map<string, Operation> = new Map();
  private activeOperation?: Operation;
  private backupDirectory: string;
  private defaultOptions: RecoveryOptions = {
    autoBackup: true,
    backupBeforeRollback: true,
    continueOnRollbackFailure: false,
    maxRollbackAttempts: 3,
    rollbackTimeout: 300000, // 5 minutes
    preserveUserFiles: true,
    confirmRollback: true
  };

  constructor(
    private workspaceRoot: string,
    private options: Partial<RecoveryOptions> = {}
  ) {
    super();
    this.backupDirectory = path.join(workspaceRoot, '.re-shell', 'backups');
    this.options = { ...this.defaultOptions, ...options };
    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory(): void {
    try {
      fs.ensureDirSync(this.backupDirectory);
    } catch (error) {
      console.warn('Failed to create backup directory:', error);
    }
  }

  async startOperation(
    type: OperationType,
    name: string,
    description: string,
    command: string,
    args: string[]
  ): Promise<string> {
    if (this.activeOperation) {
      throw new Error('Another operation is already in progress');
    }

    const operationId = this.generateOperationId();
    const timestamp = new Date();

    const operation: Operation = {
      id: operationId,
      type,
      name,
      description,
      timestamp,
      status: OperationStatus.PENDING,
      context: {
        workingDirectory: process.cwd(),
        backupDirectory: this.createBackupDirectory(operationId),
        environmentVariables: { ...process.env },
        affectedFiles: [],
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
        installedPackages: [],
        configurationChanges: []
      },
      steps: [],
      rollbackSteps: [],
      metadata: {
        command,
        args,
        version: this.getCliVersion(),
        workspace: this.workspaceRoot
      }
    };

    this.operations.set(operationId, operation);
    this.activeOperation = operation;

    // Create backup if enabled
    if (this.options.autoBackup) {
      await this.createWorkspaceBackup(operation);
    }

    this.emit('operation:started', operation);
    return operationId;
  }

  addStep(step: Omit<OperationStep, 'id' | 'executed'>): string {
    if (!this.activeOperation) {
      throw new Error('No active operation');
    }

    const stepId = this.generateStepId();
    const operationStep: OperationStep = {
      ...step,
      id: stepId,
      executed: false
    };

    this.activeOperation.steps.push(operationStep);
    this.emit('step:added', { operation: this.activeOperation, step: operationStep });

    return stepId;
  }

  addRollbackStep(step: Omit<RollbackStep, 'id'>): string {
    if (!this.activeOperation) {
      throw new Error('No active operation');
    }

    const stepId = this.generateStepId();
    const rollbackStep: RollbackStep = {
      ...step,
      id: stepId
    };

    this.activeOperation.rollbackSteps.unshift(rollbackStep); // Add to beginning for reverse order
    return stepId;
  }

  async executeStep(stepId: string): Promise<StepResult> {
    if (!this.activeOperation) {
      throw new Error('No active operation');
    }

    const step = this.activeOperation.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    if (step.executed) {
      throw new Error(`Step ${stepId} already executed`);
    }

    // Check dependencies
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depStep = this.activeOperation.steps.find(s => s.id === depId);
        if (!depStep || !depStep.executed || !depStep.result?.success) {
          throw new Error(`Dependency step ${depId} not completed successfully`);
        }
      }
    }

    this.activeOperation.status = OperationStatus.RUNNING;
    step.timestamp = new Date();

    this.emit('step:start', { operation: this.activeOperation, step });

    try {
      const startTime = Date.now();
      const result = await step.action();
      step.duration = Date.now() - startTime;
      step.executed = true;
      step.result = result;

      // Track context changes
      this.updateOperationContext(step, result);

      // Auto-generate rollback step if possible
      if (result.success && result.rollbackInfo) {
        this.generateAutoRollbackStep(step, result.rollbackInfo);
      }

      this.emit('step:complete', { operation: this.activeOperation, step, result });
      return result;

    } catch (error: any) {
      step.duration = Date.now() - (step.timestamp?.getTime() || Date.now());
      step.executed = true;
      step.result = {
        success: false,
        message: `Step failed: ${error.message}`,
        errors: [error.message]
      };

      this.emit('step:error', { operation: this.activeOperation, step, error });
      throw error;
    }
  }

  private updateOperationContext(step: OperationStep, result: StepResult): void {
    if (!this.activeOperation || !result.data) return;

    const context = this.activeOperation.context;

    switch (step.type) {
      case StepType.FILE_CREATE:
        if (result.data.filePath) {
          context.createdFiles!.push(result.data.filePath);
        }
        break;

      case StepType.FILE_MODIFY:
        if (result.data.filePath) {
          context.modifiedFiles!.push(result.data.filePath);
        }
        break;

      case StepType.FILE_DELETE:
        if (result.data.filePath) {
          context.deletedFiles!.push(result.data.filePath);
        }
        break;

      case StepType.PACKAGE_INSTALL:
        if (result.data.packages) {
          context.installedPackages!.push(...result.data.packages);
        }
        break;

      case StepType.CONFIG_UPDATE:
        if (result.data.changes) {
          context.configurationChanges!.push(...result.data.changes);
        }
        break;
    }
  }

  private generateAutoRollbackStep(step: OperationStep, rollbackInfo: any): void {
    if (!this.activeOperation) return;

    let rollbackStep: RollbackStep;

    switch (rollbackInfo.type) {
      case 'file_backup':
        rollbackStep = {
          id: this.generateStepId(),
          name: `Rollback ${step.name}`,
          description: `Restore file from backup: ${rollbackInfo.data.originalPath}`,
          critical: false,
          timeout: 30000,
          action: async () => {
            await fs.copy(rollbackInfo.data.backupPath, rollbackInfo.data.originalPath);
          }
        };
        break;

      case 'config_backup':
        rollbackStep = {
          id: this.generateStepId(),
          name: `Rollback ${step.name}`,
          description: `Restore configuration: ${rollbackInfo.data.configPath}`,
          critical: false,
          timeout: 30000,
          action: async () => {
            await fs.writeJson(rollbackInfo.data.configPath, rollbackInfo.data.originalValue, { spaces: 2 });
          }
        };
        break;

      default:
        return; // Skip unknown rollback types
    }

    this.activeOperation.rollbackSteps.unshift(rollbackStep);
  }

  async completeOperation(): Promise<void> {
    if (!this.activeOperation) {
      throw new Error('No active operation');
    }

    // Check if all steps were executed successfully
    const failedSteps = this.activeOperation.steps.filter(s => s.executed && !s.result?.success);
    
    if (failedSteps.length > 0) {
      this.activeOperation.status = OperationStatus.FAILED;
      this.emit('operation:failed', { operation: this.activeOperation, failedSteps });
    } else {
      this.activeOperation.status = OperationStatus.COMPLETED;
      this.activeOperation.duration = Date.now() - this.activeOperation.timestamp.getTime();
      this.emit('operation:completed', this.activeOperation);
    }

    this.activeOperation = undefined;
  }

  async rollbackOperation(operationId: string, options: Partial<RecoveryOptions> = {}): Promise<RollbackResult> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    if (operation.status === OperationStatus.ROLLED_BACK) {
      throw new Error(`Operation ${operationId} already rolled back`);
    }

    const opts = { ...this.defaultOptions, ...this.options, ...options };
    
    this.emit('rollback:start', operation);

    // Create backup before rollback if enabled
    if (opts.backupBeforeRollback) {
      await this.createRollbackBackup(operation);
    }

    const result: RollbackResult = {
      success: true,
      completedSteps: 0,
      failedSteps: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Execute rollback steps in reverse order
      for (const rollbackStep of operation.rollbackSteps) {
        // Check condition if present
        if (rollbackStep.condition && !rollbackStep.condition()) {
          result.warnings.push(`Skipped rollback step: ${rollbackStep.name} (condition not met)`);
          continue;
        }

        this.emit('rollback:step:start', { operation, step: rollbackStep });

        try {
          await this.withTimeout(rollbackStep.action(), rollbackStep.timeout);
          result.completedSteps++;
          this.emit('rollback:step:success', { operation, step: rollbackStep });
        } catch (error: any) {
          result.failedSteps++;
          result.errors.push({
            step: rollbackStep.name,
            error: error.message
          });

          this.emit('rollback:step:error', { operation, step: rollbackStep, error });

          if (rollbackStep.critical && !opts.continueOnRollbackFailure) {
            result.success = false;
            break;
          }
        }
      }

      // Additional automatic rollback for tracked changes
      await this.performAutomaticRollback(operation, result, opts);

      operation.status = result.success ? OperationStatus.ROLLED_BACK : OperationStatus.ROLLBACK_FAILED;
      result.duration = Date.now() - startTime;

      this.emit('rollback:complete', { operation, result });
      return result;

    } catch (error: any) {
      result.success = false;
      result.errors.push({ step: 'rollback_process', error: error.message });
      result.duration = Date.now() - startTime;
      
      operation.status = OperationStatus.ROLLBACK_FAILED;
      this.emit('rollback:error', { operation, error });
      
      return result;
    }
  }

  private async performAutomaticRollback(
    operation: Operation,
    result: RollbackResult,
    options: RecoveryOptions
  ): Promise<void> {
    const context = operation.context;

    // Remove created files
    for (const filePath of context.createdFiles || []) {
      try {
        if (await fs.pathExists(filePath)) {
          if (options.preserveUserFiles && await this.isUserModified(filePath, operation)) {
            result.warnings.push(`Preserved user-modified file: ${filePath}`);
            continue;
          }
          await fs.remove(filePath);
          result.completedSteps++;
        }
      } catch (error: any) {
        result.errors.push({ step: `remove_file_${filePath}`, error: error.message });
        result.failedSteps++;
      }
    }

    // Restore from backup if available
    if (context.backupDirectory && await fs.pathExists(context.backupDirectory)) {
      try {
        for (const filePath of context.modifiedFiles || []) {
          const backupPath = path.join(context.backupDirectory, path.relative(context.workingDirectory, filePath));
          if (await fs.pathExists(backupPath)) {
            await fs.copy(backupPath, filePath);
            result.completedSteps++;
          }
        }
      } catch (error: any) {
        result.errors.push({ step: 'restore_from_backup', error: error.message });
        result.failedSteps++;
      }
    }

    // Uninstall packages
    if (context.installedPackages && context.installedPackages.length > 0) {
      try {
        await this.uninstallPackages(context.installedPackages);
        result.completedSteps++;
      } catch (error: any) {
        result.errors.push({ step: 'uninstall_packages', error: error.message });
        result.failedSteps++;
      }
    }
  }

  private async isUserModified(filePath: string, operation: Operation): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime > operation.timestamp;
    } catch {
      return false;
    }
  }

  private async uninstallPackages(packages: string[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process');
    const packageManager = this.detectPackageManager();
    
    let command: string;
    switch (packageManager) {
      case 'yarn':
        command = `yarn remove ${packages.join(' ')}`;
        break;
      case 'pnpm':
        command = `pnpm remove ${packages.join(' ')}`;
        break;
      case 'bun':
        command = `bun remove ${packages.join(' ')}`;
        break;
      default:
        command = `npm uninstall ${packages.join(' ')}`;
    }

    execSync(command, { stdio: 'inherit' });
  }

  private detectPackageManager(): string {
    if (fs.existsSync('yarn.lock')) return 'yarn';
    if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
    if (fs.existsSync('bun.lockb')) return 'bun';
    return 'npm';
  }

  private async createWorkspaceBackup(operation: Operation): Promise<void> {
    const backupDir = operation.context.backupDirectory!;
    await fs.ensureDir(backupDir);

    // Backup critical files
    const criticalFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      '.re-shell/config.yaml',
      're-shell.workspaces.yaml'
    ];

    for (const file of criticalFiles) {
      const filePath = path.join(operation.context.workingDirectory, file);
      if (await fs.pathExists(filePath)) {
        const backupPath = path.join(backupDir, file);
        await fs.ensureDir(path.dirname(backupPath));
        await fs.copy(filePath, backupPath);
      }
    }
  }

  private async createRollbackBackup(operation: Operation): Promise<void> {
    const rollbackBackupDir = path.join(this.backupDirectory, `rollback_${operation.id}_${Date.now()}`);
    await fs.ensureDir(rollbackBackupDir);

    // Backup current state before rollback
    const workspaceFiles = await this.getWorkspaceFiles(operation.context.workingDirectory);
    
    for (const file of workspaceFiles.slice(0, 100)) { // Limit to prevent huge backups
      const relativePath = path.relative(operation.context.workingDirectory, file);
      const backupPath = path.join(rollbackBackupDir, relativePath);
      await fs.ensureDir(path.dirname(backupPath));
      await fs.copy(file, backupPath);
    }
  }

  private async getWorkspaceFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.re-shell') continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.getWorkspaceFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private createBackupDirectory(operationId: string): string {
    return path.join(this.backupDirectory, `operation_${operationId}_${Date.now()}`);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private getCliVersion(): string {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = fs.readJsonSync(packagePath);
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Query methods
  getOperation(id: string): Operation | undefined {
    return this.operations.get(id);
  }

  getActiveOperation(): Operation | undefined {
    return this.activeOperation;
  }

  getAllOperations(): Operation[] {
    return Array.from(this.operations.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getOperationsByStatus(status: OperationStatus): Operation[] {
    return Array.from(this.operations.values())
      .filter(op => op.status === status)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getFailedOperations(): Operation[] {
    return this.getOperationsByStatus(OperationStatus.FAILED);
  }

  getOperationStats(): {
    total: number;
    completed: number;
    failed: number;
    rolledBack: number;
    pending: number;
    running: number;
  } {
    const operations = Array.from(this.operations.values());
    
    return {
      total: operations.length,
      completed: operations.filter(op => op.status === OperationStatus.COMPLETED).length,
      failed: operations.filter(op => op.status === OperationStatus.FAILED).length,
      rolledBack: operations.filter(op => op.status === OperationStatus.ROLLED_BACK).length,
      pending: operations.filter(op => op.status === OperationStatus.PENDING).length,
      running: operations.filter(op => op.status === OperationStatus.RUNNING).length
    };
  }

  // Cleanup methods
  cleanupOldOperations(maxAge: number = 30 * 24 * 60 * 60 * 1000): number { // 30 days default
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [id, operation] of this.operations) {
      if (operation.timestamp < cutoff && operation.status !== OperationStatus.RUNNING) {
        this.operations.delete(id);
        cleaned++;

        // Cleanup backup directory
        if (operation.context.backupDirectory) {
          fs.remove(operation.context.backupDirectory).catch(() => { /* ignore */ });
        }
      }
    }

    return cleaned;
  }

  async cleanupBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> { // 7 days default
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    try {
      const backupDirs = await fs.readdir(this.backupDirectory, { withFileTypes: true });
      
      for (const dir of backupDirs) {
        if (dir.isDirectory()) {
          const dirPath = path.join(this.backupDirectory, dir.name);
          const stats = await fs.stat(dirPath);
          
          if (stats.birthtime < cutoff) {
            await fs.remove(dirPath);
            cleaned++;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup backups:', error);
    }

    return cleaned;
  }
}

// Global operation manager
let globalOperationManager: OperationManager | null = null;

export function createOperationManager(
  workspaceRoot: string,
  options?: Partial<RecoveryOptions>
): OperationManager {
  return new OperationManager(workspaceRoot, options);
}

export function getGlobalOperationManager(): OperationManager {
  if (!globalOperationManager) {
    globalOperationManager = new OperationManager(process.cwd());
  }
  return globalOperationManager;
}

export function setGlobalOperationManager(manager: OperationManager): void {
  globalOperationManager = manager;
}