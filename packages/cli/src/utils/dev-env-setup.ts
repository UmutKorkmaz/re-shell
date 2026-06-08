/**
 * Development Environment Setup with Container Port Forwarding
 * Provides IDE integration and port management for containerized development
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import chalk from 'chalk';

// Port allocation and management
export interface PortMapping {
  localPort: number;
  containerPort: number;
  service: string;
  protocol: 'tcp' | 'udp';
  description?: string;
}

export interface PortRange {
  start: number;
  end: number;
  reserved: boolean;
}

// Development environment configuration
export interface DevEnvConfig {
  projectPath: string;
  projectName: string;
  ports: PortMapping[];
  containers: string[];
  ide?: 'vscode' | 'jetbrains' | 'vim' | 'emacs' | 'generic';
  containerRuntime?: 'docker' | 'podman';
  enablePortForwarding: boolean;
  enableServiceDiscovery: boolean;
  autoStartContainers: boolean;
}

// Container information
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused' | 'exited';
  ports: Array<{ container: number; host?: number; protocol: string }>;
  labels: Record<string, string>;
}

// Forwarded port status
export interface ForwardStatus {
  localPort: number;
  containerPort: number;
  service: string;
  active: boolean;
  pid?: number;
  url?: string;
}

// IDE-specific configuration
export interface IDEConfig {
  type: 'vscode' | 'jetbrains' | 'vim' | 'emacs' | 'generic';
  launchConfig?: Record<string, unknown>;
  portForwardingEnabled: boolean;
  remoteDevelopment: boolean;
  workspacePath: string;
}

// Port manager class
export class PortManager extends EventEmitter {
  private allocatedPorts: Set<number> = new Set();
  private portRanges: PortRange[] = [
    { start: 3000, end: 3999, reserved: false }, // Web apps
    { start: 5000, end: 5999, reserved: false }, // Dev servers
    { start: 8000, end: 8999, reserved: false }, // API servers
    { start: 9000, end: 9999, reserved: false }, // Services
  ];
  private forwardedPorts: Map<string, ForwardStatus> = new Map();

  /**
   * Allocate a port for a service
   */
  allocatePort(preferredPort?: number, service = 'service'): number {
    // If preferred port is available and not allocated, use it
    if (preferredPort && !this.allocatedPorts.has(preferredPort)) {
      this.allocatedPorts.add(preferredPort);
      return preferredPort;
    }

    // Find next available port in ranges
    for (const range of this.portRanges) {
      for (let port = range.start; port <= range.end; port++) {
        if (!this.allocatedPorts.has(port)) {
          this.allocatedPorts.add(port);
          this.emit('port-allocated', { port, service });
          return port;
        }
      }
    }

    // Fallback to any available port above 10000
    for (let port = 10000; port < 65000; port++) {
      if (!this.allocatedPorts.has(port)) {
        this.allocatedPorts.add(port);
        return port;
      }
    }

    throw new Error('No available ports');
  }

  /**
   * Release a port
   */
  releasePort(port: number): void {
    if (this.allocatedPorts.has(port)) {
      this.allocatedPorts.delete(port);
      this.emit('port-released', { port });
    }
  }

  /**
   * Check if port is in use
   */
  async isPortInUse(port: number, host = 'localhost'): Promise<boolean> {
    const net = await import('net');
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(true); // Port is in use
      });
      server.once('listening', () => {
        server.close();
        resolve(false); // Port is available
      });
      server.listen(port, host);
    });
  }

  /**
   * Get allocated ports
   */
  getAllocatedPorts(): number[] {
    return Array.from(this.allocatedPorts).sort((a, b) => a - b);
  }

  /**
   * Get next available port in range
   */
  getNextAvailablePort(start = 3000, end = 9000): number {
    for (let port = start; port <= end; port++) {
      if (!this.allocatedPorts.has(port)) {
        return port;
      }
    }
    return -1;
  }
}

// Development environment manager
export class DevEnvManager extends EventEmitter {
  private config: DevEnvConfig;
  private portManager: PortManager;
  private containerRuntime: 'docker' | 'podman';
  private activeForwarders: Map<string, { process: any; port: number }> = new Map();
  private forwardedPortsStatus: Map<string, ForwardStatus> = new Map();

  constructor(config: DevEnvConfig) {
    super();
    this.config = config;
    this.portManager = new PortManager();
    this.containerRuntime = config.containerRuntime || 'docker';

    // Allocate ports from config
    for (const mapping of config.ports) {
      this.portManager.allocatePort(mapping.localPort, mapping.service);
    }
  }

  /**
   * Detect available containers
   */
  async detectContainers(): Promise<ContainerInfo[]> {
    const runtime = this.containerRuntime;
    const containers: ContainerInfo[] = [];

    try {
      const args = ['ps', '-a', '--format', '{{json .}}'];
      const output = await this.runCommand(runtime, args);
      const lines = output.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const info = JSON.parse(line);
          containers.push({
            id: info.ID,
            name: info.Names.replace(/^\//, ''),
            image: info.Image,
            status: info.State as ContainerInfo['status'],
            ports: this.parsePorts(info.Ports),
            labels: this.parseLabels(info.Labels),
          });
        } catch {
          // Skip invalid lines
        }
      }
    } catch (error) {
      const msg = (error as Error).message || String(error);
      if (msg.includes('connect') || msg.includes('docker') || msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
        console.error(chalk.yellow('Docker is not available. Please ensure Docker is running.'));
      } else {
        console.error(chalk.red(`Failed to list containers: ${msg}`));
      }
    }

    return containers;
  }

  /**
   * Parse port string from docker/podman output
   */
  private parsePorts(portsStr: string): Array<{ container: number; host?: number; protocol: string }> {
    const ports: Array<{ container: number; host?: number; protocol: string }> = [];

    if (!portsStr || portsStr === '') {
      return ports;
    }

    const portMatches = portsStr.split(',').map(p => p.trim());
    for (const port of portMatches) {
      const match = port.match(/(\d+)(?:\/(tcp|udp))?(?:->(?:0\.0\.0\.0:)?(\d+))?/);
      if (match) {
        ports.push({
          container: parseInt(match[1]),
          host: match[3] ? parseInt(match[3]) : undefined,
          protocol: match[2] || 'tcp',
        });
      }
    }

    return ports;
  }

  /**
   * Parse labels string
   */
  private parseLabels(labelsStr: string): Record<string, string> {
    const labels: Record<string, string> = {};

    if (!labelsStr || labelsStr === '') {
      return labels;
    }

    const pairs = labelsStr.split(',').map(l => l.trim().split('='));
    for (const [key, value] of pairs) {
      if (key && value !== undefined) {
        labels[key] = value;
      }
    }

    return labels;
  }

  /**
   * Setup port forwarding for a container
   */
  async setupPortForwarding(containerName: string, containerPort: number, localPort?: number): Promise<ForwardStatus> {
    const allocatedPort = localPort || this.portManager.allocatePort(undefined, containerName);

    const status: ForwardStatus = {
      localPort: allocatedPort,
      containerPort,
      service: containerName,
      active: false,
    };

    try {
      const containers = await this.detectContainers();
      const container = containers.find(c => c.name === containerName || c.id.startsWith(containerName));

      if (!container) {
        throw new Error(`Container not found: ${containerName}`);
      }

      if (container.status !== 'running') {
        await this.startContainer(container.name);
      }

      // Setup port forwarding using docker/podman
      const args = ['port-forward', container.name, `${allocatedPort}:${containerPort}`];

      // For Docker Desktop, we need a different approach
      const dockerArgs = ['run', '-d', '--publish', `${allocatedPort}:${containerPort}`,
        '--name', `${containerName}-pf-${allocatedPort}`,
        '--link', `${containerName}:${containerName}`,
        'alpine/socat', `tcp-listen:${allocatedPort},fork,reuseaddr`, `tcp-connect:${containerName}:${containerPort}`
      ];

      // Check if using docker or podman
      const runtime = this.containerRuntime;

      // Try to use socat container for port forwarding
      try {
        await this.runCommand(runtime, dockerArgs);

        // Wait a moment for the forwarder to start
        await new Promise(resolve => setTimeout(resolve, 500));

        status.active = true;
        status.url = `http://localhost:${allocatedPort}`;

        this.forwardedPortsStatus.set(`${containerName}:${containerPort}`, status);
        this.emit('port-forwarded', status);
      } catch (error) {
        // Fallback: assume container already has port mapping
        status.active = true;
        status.url = `http://localhost:${allocatedPort}`;
        this.emit('port-forward-existing', status);
      }

    } catch (error) {
      console.error(chalk.red(`Port forwarding failed: ${(error as Error).message}`));
    }

    return status;
  }

  /**
   * Start a container
   */
  async startContainer(containerName: string): Promise<void> {
    const args = ['start', containerName];
    await this.runCommand(this.containerRuntime, args);
    this.emit('container-started', { container: containerName });
  }

  /**
   * Stop a container
   */
  async stopContainer(containerName: string): Promise<void> {
    const args = ['stop', containerName];
    await this.runCommand(this.containerRuntime, args);
    this.emit('container-stopped', { container: containerName });
  }

  /**
   * Run a command
   */
  private runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`${command} ${args.join(' ')} exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get forwarded port status
   */
  getForwardedPorts(): ForwardStatus[] {
    return Array.from(this.forwardedPortsStatus.values());
  }

  /**
   * Stop port forwarding
   */
  async stopPortForwarding(containerName: string, port: number): Promise<void> {
    const key = `${containerName}:${port}`;
    const forwarder = this.forwardedPortsStatus.get(key);

    if (forwarder) {
      // Stop the forwarder container
      try {
        const args = ['stop', `${containerName}-pf-${port}`];
        await this.runCommand(this.containerRuntime, args);

        const removeArgs = ['rm', `${containerName}-pf-${port}`];
        await this.runCommand(this.containerRuntime, removeArgs);
      } catch {
        // Ignore errors
      }

      this.forwardedPortsStatus.delete(key);
      this.portManager.releasePort(port);
      this.emit('port-unforwarded', { container: containerName, port });
    }
  }

  /**
   * Setup IDE configuration
   */
  async setupIDE(ideType: DevEnvConfig['ide'] = 'vscode'): Promise<IDEConfig | null> {
    const projectPath = this.config.projectPath;

    if (ideType === 'vscode') {
      return await this.setupVSCode(projectPath);
    }

    if (ideType === 'jetbrains') {
      return await this.setupJetBrains(projectPath);
    }

    return null;
  }

  /**
   * Setup VS Code workspace for container development
   */
  private async setupVSCode(projectPath: string): Promise<IDEConfig> {
    const vscodeDir = path.join(projectPath, '.vscode');

    await fs.ensureDir(vscodeDir);

    // Create or update launch.json with container port forwarding
    const launchPath = path.join(vscodeDir, 'launch.json');
    const launchConfig: Record<string, unknown> = {
      version: '0.2.0',
      configurations: [
        {
          name: 'Docker: Attach to Node',
          type: 'node',
          request: 'attach',
          port: 9229,
          address: 'localhost',
          localRoot: '${workspaceFolder}',
          remoteRoot: '/app',
          protocol: 'inspector',
        },
        {
          name: 'Docker: Python Debug',
          type: 'debugpy',
          request: 'attach',
          connect: {
            host: 'localhost',
            port: 5678,
          },
          pathMappings: [
            {
              localRoot: '${workspaceFolder}',
              remoteRoot: '/app',
            },
          ],
        },
      ],
    };

    await fs.writeJson(launchPath, launchConfig, { spaces: 2 });

    // Create settings.json for container development
    const settingsPath = path.join(vscodeDir, 'settings.json');
    const settings = {
      'docker.showExplorer': true,
      'docker.composeFormServiceName': true,
      'devContainers.containers': this.config.containers,
      'terminal.integrated.env.linux': {
        'DOCKER_HOST': this.getDockerHost(),
      },
    };

    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    // Create devcontainer.json for VS Code Dev Containers
    const devcontainerPath = path.join(projectPath, '.devcontainer', 'devcontainer.json');
    await fs.ensureDir(path.dirname(devcontainerPath));

    const devcontainerConfig = {
      name: `${this.config.projectName} Development Container`,
      dockerComposeFile: 'docker-compose.yml',
      service: 'app',
      workspaceFolder: '/workspace',
      customizations: {
        vscode: {
          extensions: [
            'ms-azuretools.vscode-docker',
            'ms-vscode-remote.remote-containers',
          ],
          settings: {
            'terminal.integrated.defaultProfile.linux': 'bash',
          },
        },
      },
      forwardPorts: this.config.ports.map(p => p.containerPort),
      portAttributes: this.config.ports.reduce((acc, p) => {
        acc[p.containerPort] = {
          label: p.service,
          onAutoForward: 'openBrowser',
        };
        return acc;
      }, {} as Record<number, { label: string; onAutoForward: string }>),
    };

    await fs.writeJson(devcontainerPath, devcontainerConfig, { spaces: 2 });

    return {
      type: 'vscode',
      launchConfig,
      portForwardingEnabled: true,
      remoteDevelopment: true,
      workspacePath: projectPath,
    };
  }

  /**
   * Setup JetBrains IDE configuration
   */
  private async setupJetBrains(projectPath: string): Promise<IDEConfig> {
    const ideaDir = path.join(projectPath, '.idea');
    await fs.ensureDir(ideaDir);

    // Create run configurations for Docker services
    const runConfigPath = path.join(ideaDir, 'runConfigurations');
    await fs.ensureDir(runConfigPath);

    for (const container of this.config.containers) {
      const configPath = path.join(runConfigPath, `${container}.xml`);
      const configXml = `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="${container}" type="docker-deploy" factoryName="docker-file-deploy" nameIsGenerated="true">
    <deployment type="docker-file-deploy" sourcePath="$PROJECT_DIR$/Dockerfile">
      <settings>
        <option name="containerPort" value="${this.getPortForService(container)}" />
        <option name="portBindings" value="${this.getPortForService(container)}:${this.getPortForService(container)}" />
      </settings>
    </deployment>
    <method v="2" />
  </configuration>
</component>`;
      await fs.writeFile(configPath, configXml);
    }

    return {
      type: 'jetbrains',
      portForwardingEnabled: true,
      remoteDevelopment: true,
      workspacePath: projectPath,
    };
  }

  /**
   * Get port for service
   */
  private getPortForService(serviceName: string): number {
    const mapping = this.config.ports.find(p => p.service === serviceName);
    return mapping?.localPort || 3000;
  }

  /**
   * Get Docker host
   */
  private getDockerHost(): string {
    if (process.env.DOCKER_HOST) {
      return process.env.DOCKER_HOST;
    }

    // Check if running on macOS/Windows with Docker Desktop
    if (process.platform === 'darwin' || process.platform === 'win32') {
      return 'unix:///var/run/docker.sock';
    }

    // Linux
    return 'unix:///var/run/docker.sock';
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Stop all port forwarders
    for (const [key, status] of this.forwardedPortsStatus) {
      await this.stopPortForwarding(status.service, status.localPort);
    }

    this.emit('cleaned-up');
  }
}

// Utility functions

/**
 * Create development environment manager
 */
export async function createDevEnv(config: DevEnvConfig): Promise<DevEnvManager> {
  const manager = new DevEnvManager(config);

  // Auto-detect containers if enabled
  if (config.enableServiceDiscovery) {
    const containers = await manager.detectContainers();
    if (containers.length > 0) {
      config.containers = containers.map(c => c.name);
    }
  }

  return manager;
}

/**
 * Detect Docker/Podman availability
 */
export async function detectContainerRuntime(): Promise<'docker' | 'podman' | null> {
  const { execSync } = await import('child_process');

  try {
    execSync('docker --version', { stdio: 'ignore' });
    return 'docker';
  } catch {
    try {
      execSync('podman --version', { stdio: 'ignore' });
      return 'podman';
    } catch {
      return null;
    }
  }
}

/**
 * Generate port forwarding configuration
 */
export function generatePortForwardingConfig(ports: PortMapping[]): string {
  const lines: string[] = [];

  lines.push('# Port Forwarding Configuration');
  lines.push('# Generated by Re-Shell CLI');

  for (const port of ports) {
    lines.push(`# ${port.description || port.service}`);
    lines.push(`# localhost:${port.localPort} -> ${port.service}:${port.containerPort}`);
  }

  return lines.join('\n');
}

/**
 * Get recommended ports for common services
 */
export function getServicePorts(): Record<string, number> {
  return {
    'web': 3000,
    'api': 8000,
    'graphql': 4000,
    'db': 5432,
    'redis': 6379,
    'mongo': 27017,
    'elastic': 9200,
    'kibana': 5601,
    'rabbitmq': 5672,
    'postgres': 5432,
    'mysql': 3306,
    'adminer': 8080,
    'nginx': 80,
    'traefik': 8080,
    'vault': 8200,
    'consul': 8500,
    'jaeger': 16686,
    'prometheus': 9090,
    'grafana': 3000,
  };
}
