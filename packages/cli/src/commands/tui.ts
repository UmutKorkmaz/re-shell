import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';

interface TUIOptions {
  project?: string;
  mode?: 'dashboard' | 'init' | 'manage' | 'config';
  debug?: boolean;
}

interface IPCMessage {
  type: string;
  id: string;
  data: any;
}

class IPCBridge {
  private process: ChildProcess;
  private messageHandlers: Map<string, (data: any) => Promise<any>> = new Map();
  private responseHandlers: Map<string, (data: any) => void> = new Map();

  constructor(process: ChildProcess) {
    this.process = process;
    this.setupMessageHandling();
  }

  private setupMessageHandling() {
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const message: IPCMessage = JSON.parse(line);
            this.handleMessage(message);
          } catch (e) {
            // Not a JSON message, probably debug output
            if (process.env.DEBUG) {
              console.log('TUI:', line);
            }
          }
        }
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        if (process.env.DEBUG) {
          console.error('TUI Error:', data.toString());
        }
      });
    }
  }

  private async handleMessage(message: IPCMessage) {
    if (message.type === 'response') {
      const handler = this.responseHandlers.get(message.id);
      if (handler) {
        handler(message.data);
        this.responseHandlers.delete(message.id);
      }
      return;
    }

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        const result = await handler(message.data);
        this.send('response', result, message.id);
      } catch (error) {
        this.send('error', { message: error instanceof Error ? error.message : 'Unknown error' }, message.id);
      }
    }
  }

  public on(type: string, handler: (data: any) => Promise<any>) {
    this.messageHandlers.set(type, handler);
  }

  public send(type: string, data: any, id?: string) {
    const message: IPCMessage = {
      type,
      id: id || Math.random().toString(36).substring(7),
      data
    };

    if (this.process.stdin) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  public async request(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      
      this.responseHandlers.set(id, (responseData) => {
        resolve(responseData);
      });

      setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error('Request timeout'));
      }, 30000);

      this.send(type, data, id);
    });
  }
}

export async function launchTUI(options: TUIOptions): Promise<void> {
  const spinner = createSpinner('Initializing TUI interface...');
  
  try {
    // Check if Go is installed
    await checkGoInstallation();
    
    // Ensure TUI directory exists
    const tuiDir = path.join(__dirname, '../tui');
    await fs.ensureDir(tuiDir);
    
    // Check if TUI binary exists or needs building
    await ensureTUIBinary(tuiDir);
    
    spinner.succeed('TUI ready');
    
    // Launch the TUI process
    console.log(chalk.cyan('\n🚀 Launching Re-Shell TUI...\n'));
    
    const tuiProcess = spawn('go', ['run', '.'], {
      cwd: tuiDir,
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        RESHELL_PROJECT_PATH: options.project || process.cwd(),
        RESHELL_TUI_MODE: options.mode || 'dashboard',
        RESHELL_DEBUG: options.debug ? 'true' : 'false'
      }
    });

    // Set up IPC bridge
    const ipc = new IPCBridge(tuiProcess);
    
    // Register command handlers
    setupIPCHandlers(ipc, options);
    
    // Wait for process to exit
    await new Promise<void>((resolve, reject) => {
      tuiProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TUI process exited with code ${code}`));
        }
      });

      tuiProcess.on('error', (error) => {
        reject(error);
      });
    });

  } catch (error) {
    spinner.fail('Failed to launch TUI');
    console.error(chalk.red('Error:', error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}

async function checkGoInstallation(): Promise<void> {
  return new Promise((resolve, reject) => {
    const goProcess = spawn('go', ['version'], { stdio: 'ignore' });
    goProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Go is not installed. Please install Go from https://golang.org/dl/'));
      }
    });
    goProcess.on('error', () => {
      reject(new Error('Go is not installed. Please install Go from https://golang.org/dl/'));
    });
  });
}

async function ensureTUIBinary(tuiDir: string): Promise<void> {
  const mainGoPath = path.join(tuiDir, 'main.go');
  
  if (!await fs.pathExists(mainGoPath)) {
    throw new Error('TUI source code not found. Please ensure the TUI module is properly installed.');
  }

  // Check if go.mod exists
  const goModPath = path.join(tuiDir, 'go.mod');
  if (!await fs.pathExists(goModPath)) {
    // Initialize Go module
    const initProcess = spawn('go', ['mod', 'init', 'reshell-tui'], {
      cwd: tuiDir,
      stdio: 'ignore'
    });
    
    await new Promise<void>((resolve, reject) => {
      initProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to initialize Go module'));
      });
    });

    // Install dependencies
    const tidyProcess = spawn('go', ['mod', 'tidy'], {
      cwd: tuiDir,
      stdio: 'ignore'
    });
    
    await new Promise<void>((resolve, reject) => {
      tidyProcess.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to install Go dependencies'));
      });
    });
  }
}

function setupIPCHandlers(ipc: IPCBridge, options: TUIOptions): void {
  // Handle project information requests
  ipc.on('get-project-info', async (data) => {
    const projectPath = data.path || options.project || process.cwd();
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      return {
        name: packageJson.name || path.basename(projectPath),
        version: packageJson.version || '0.0.0',
        description: packageJson.description || '',
        path: projectPath,
        type: 're-shell' // TODO: Detect project type
      };
    } catch (error) {
      return {
        name: path.basename(projectPath),
        version: '0.0.0',
        description: 'Re-Shell Project',
        path: projectPath,
        type: 'unknown'
      };
    }
  });

  // Handle file system operations
  ipc.on('list-directory', async (data) => {
    try {
      const entries = await fs.readdir(data.path);
      const result = [];
      
      for (const entry of entries) {
        const entryPath = path.join(data.path, entry);
        const stats = await fs.stat(entryPath);
        result.push({
          name: entry,
          path: entryPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        });
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Handle CLI command execution
  ipc.on('execute-command', async (data) => {
    const { command, args } = data;
    
    // Import the appropriate command handler
    try {
      switch (command) {
        case 'init':
          {
          const { initMonorepo } = await import('./init');
          return await initMonorepo(args.name || 'new-project', args);
        
          }
        case 'add':
          {
          const { addMicrofrontend } = await import('./add');
          return await addMicrofrontend(args.name || 'new-app', args);
        
          }
        case 'list':
          {
          const { listMicrofrontends } = await import('./list');
          return await listMicrofrontends(args);
        
          }
        case 'build':
          {
          const { buildMicrofrontend } = await import('./build');
          return await buildMicrofrontend(args);
        
          }
        case 'serve':
          {
          const { serveMicrofrontend } = await import('./serve');
          return await serveMicrofrontend(args);
        
          }
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Handle configuration operations
  ipc.on('get-config', async (data) => {
    const { getMergedConfig } = await import('../utils/config');
    return await getMergedConfig(data.projectPath);
  });

  ipc.on('set-config', async (data) => {
    const { ConfigManager } = await import('../utils/config');
    const configManager = new ConfigManager();
    await configManager.updateGlobalConfig({ [data.key]: data.value });
    return { success: true };
  });
}