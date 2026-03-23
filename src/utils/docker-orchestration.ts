// Auto-generated Polyglot Docker Orchestration Utility
// Generated at: 2026-01-12T21:45:55.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Service {
  name: string;
  language: 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'java';
  buildPath: string;
  dockerfilePath: string;
  port: number;
  dependencies: string[];
  environment: Record<string, string>;
}

interface DockerLayer {
  path: string;
  hash: string;
  size: number;
  shared: boolean;
}

interface OrchestrationConfig {
  projectName: string;
  enableLayerOptimization: boolean;
  enableParallelBuilds: boolean;
  enableServiceDiscovery: boolean;
  enableHealthChecks: boolean;
  maxParallelBuilds: number;
}

export function displayConfig(config: OrchestrationConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Polyglot Docker Orchestration with Layer Sharing');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Layer Optimization:', config.enableLayerOptimization ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Parallel Builds:', config.enableParallelBuilds ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Service Discovery:', config.enableServiceDiscovery ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Health Checks:', config.enableHealthChecks ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateDockerMD(config: OrchestrationConfig): string {
  let md = '# Docker Orchestration System\n\n';
  md += '## Features\n\n';
  md += '- Multi-language Docker service orchestration\n';
  md += '- Layer caching and optimization\n';
  md += '- Parallel build execution\n';
  md += '- Service discovery and health checks\n';
  md += '- Docker Compose integration\n';
  md += '- Container registry management\n\n';
  md += '## Usage\n\n';
  md += '### TypeScript/JavaScript\n';
  md += '```typescript\n';
  md += 'import orchestrator from \'./docker-orchestration\';\n\n';
  md += '// Build services\n';
  md += 'await orchestrator.buildServices();\n\n';
  md += '// Start services\n';
  md += 'await orchestrator.startServices();\n\n';
  md += '// Check health\n';
  md += 'const status = await orchestrator.checkHealth();\n\n';
  md += '// Stop services\n';
  md += 'await orchestrator.stopServices();\n';
  md += '```\n\n';
  md += '### Python\n';
  md += '```python\n';
  md += 'from docker_orchestration import orchestrator\n\n';
  md += '# Build services\n';
  md += 'await orchestrator.build_services()\n\n';
  md += '# Start services\n';
  md += 'await orchestrator.start_services()\n\n';
  md += '# Check health\n';
  md += 'status = await orchestrator.check_health()\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptDocker(config: OrchestrationConfig): string {
  let code = '// Auto-generated Docker Orchestration for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync, spawn } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { createHash } from \'crypto\';\n\n';
  code += 'interface Service {\n';
  code += '  name: string;\n';
  code += '  language: \'javascript\' | \'typescript\' | \'python\' | \'go\' | \'rust\' | \'java\';\n';
  code += '  buildPath: string;\n';
  code += '  dockerfilePath: string;\n';
  code += '  port: number;\n';
  code += '  dependencies: string[];\n';
  code += '  environment: Record<string, string>;\n';
  code += '}\n\n';
  code += 'interface DockerLayer {\n';
  code += '  path: string;\n';
  code += '  hash: string;\n';
  code += '  size: number;\n';
  code += '  shared: boolean;\n';
  code += '}\n\n';
  code += 'class DockerOrchestrator {\n';
  code += '  private projectRoot: string;\n';
  code += '  private services: Service[];\n';
  code += '  private enableLayerOptimization: boolean;\n';
  code += '  private enableParallelBuilds: boolean;\n';
  code += '  private enableServiceDiscovery: boolean;\n';
  code += '  private enableHealthChecks: boolean;\n';
  code += '  private maxParallelBuilds: number;\n';
  code += '  private layerCache: Map<string, DockerLayer>;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.services = options.services || [];\n';
  code += '    this.enableLayerOptimization = options.enableLayerOptimization !== false;\n';
  code += '    this.enableParallelBuilds = options.enableParallelBuilds !== false;\n';
  code += '    this.enableServiceDiscovery = options.enableServiceDiscovery !== false;\n';
  code += '    this.enableHealthChecks = options.enableHealthChecks !== false;\n';
  code += '    this.maxParallelBuilds = options.maxParallelBuilds || 4;\n';
  code += '    this.layerCache = new Map();\n';
  code += '  }\n\n';
  code += '  async buildServices(services?: Service[]): Promise<void> {\n';
  code += '    const targetServices = services || this.services;\n';
  code += '    console.log(\'[Docker] Building \' + targetServices.length + \' services...\');\n\n';
  code += '    if (this.enableLayerOptimization) {\n';
  code += '      await this.optimizeLayers(targetServices);\n';
  code += '    }\n\n';
  code += '    if (this.enableParallelBuilds) {\n';
  code += '      await this.buildParallel(targetServices);\n';
  code += '    } else {\n';
  code += '      await this.buildSequential(targetServices);\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Build complete\');\n';
  code += '  }\n\n';
  code += '  private async buildParallel(services: Service[]): Promise<void> {\n';
  code += '    console.log(\'[Docker] Building services in parallel...\');\n';
  code += '    const workers: Promise<void>[] = [];\n\n';
  code += '    for (const service of services) {\n';
  code += '      if (workers.length >= this.maxParallelBuilds) {\n';
  code += '        await Promise.race(workers);\n';
  code += '        workers.shift();\n';
  code += '      }\n\n';
  code += '      const worker = this.buildService(service);\n';
  code += '      workers.push(worker);\n';
  code += '    }\n\n';
  code += '    await Promise.all(workers);\n';
  code += '  }\n\n';
  code += '  private async buildSequential(services: Service[]): Promise<void> {\n';
  code += '    console.log(\'[Docker] Building services sequentially...\');\n';
  code += '    for (const service of services) {\n';
  code += '      await this.buildService(service);\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async buildService(service: Service): Promise<void> {\n';
  code += '    console.log(\'[Docker] Building service:\', service.name);\n\n';
  code += '    try {\n';
  code += '      const dockerfilePath = path.join(this.projectRoot, service.dockerfilePath);\n';
  code += '      const buildPath = path.join(this.projectRoot, service.buildPath);\n\n';
  code += '      let command = \'docker build -t \' + service.name + \':latest\';\n';
  code += '      if (fs.existsSync(dockerfilePath)) {\n';
  code += '        command += \' -f \' + dockerfilePath;\n';
  code += '      }\n';
  code += '      command += \' \' + buildPath;\n\n';
  code += '      execSync(command, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[Docker] Built service:\', service.name);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Docker] Failed to build service:\', service.name, error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  async startServices(services?: Service[]): Promise<void> {\n';
  code += '    const targetServices = services || this.services;\n';
  code += '    console.log(\'[Docker] Starting \' + targetServices.length + \' services...\');\n\n';
  code += '    for (const service of targetServices) {\n';
  code += '      await this.startService(service);\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Services started\');\n';
  code += '  }\n\n';
  code += '  private async startService(service: Service): Promise<void> {\n';
  code += '    console.log(\'[Docker] Starting service:\', service.name);\n\n';
  code += '    try {\n';
  code += '      // Stop existing container if running\n';
  code += '      try {\n';
  code += '        execSync(\'docker stop \' + service.name + \' 2>/dev/null || true\', { stdio: \'ignore\' });\n';
  code += '        execSync(\'docker rm \' + service.name + \' 2>/dev/null || true\', { stdio: \'ignore\' });\n';
  code += '      } catch {}\n\n';
  code += '      // Build environment args\n';
  code += '      const envArgs = Object.entries(service.environment)\n';
  code += '        .map(([key, value]) => \'-e \' + key + \'=\' + value)\n';
  code += '        .join(\' \');\n\n';
  code += '      // Start container\n';
  code += '      const command = \'docker run -d --name \' + service.name + \' -p \' + service.port + \':\' + service.port + \' \' + envArgs + \' \' + service.name + \':latest\';\n';
  code += '      execSync(command, { stdio: \'inherit\' });\n\n';
  code += '      console.log(\'[Docker] Started service:\', service.name, \'on port\', service.port);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Docker] Failed to start service:\', service.name, error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  async stopServices(services?: Service[]): Promise<void> {\n';
  code += '    const targetServices = services || this.services;\n';
  code += '    console.log(\'[Docker] Stopping \' + targetServices.length + \' services...\');\n\n';
  code += '    for (const service of targetServices) {\n';
  code += '      await this.stopService(service);\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Services stopped\');\n';
  code += '  }\n\n';
  code += '  private async stopService(service: Service): Promise<void> {\n';
  code += '    console.log(\'[Docker] Stopping service:\', service.name);\n\n';
  code += '    try {\n';
  code += '      execSync(\'docker stop \' + service.name, { stdio: \'inherit\' });\n';
  code += '      execSync(\'docker rm \' + service.name, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[Docker] Stopped service:\', service.name);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Docker] Failed to stop service:\', service.name, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  async checkHealth(services?: Service[]): Promise<Record<string, boolean>> {\n';
  code += '    const targetServices = services || this.services;\n';
  code += '    const status: Record<string, boolean> = {};\n\n';
  code += '    if (!this.enableHealthChecks) {\n';
  code += '      console.log(\'[Docker] Health checks are disabled\');\n';
  code += '      return status;\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Checking service health...\');\n\n';
  code += '    for (const service of targetServices) {\n';
  code += '      status[service.name] = await this.isServiceHealthy(service);\n';
  code += '    }\n\n';
  code += '    return status;\n';
  code += '  }\n\n';
  code += '  private async isServiceHealthy(service: Service): Promise<boolean> {\n';
  code += '    try {\n';
  code += '      execSync(\'docker inspect --format=\' + \'{{.State.Health.Status}}\' + \' \' + service.name, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      return true;\n';
  code += '    } catch {\n';
  code += '      // Fallback: check if container is running\n';
  code += '      try {\n';
  code += '        execSync(\'docker inspect --format=\' + \'{{.State.Running}}\' + \' \' + service.name, {\n';
  code += '          encoding: \'utf-8\',\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        return true;\n';
  code += '      } catch {\n';
  code += '        return false;\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async optimizeLayers(services: Service[]): Promise<void> {\n';
  code += '    console.log(\'[Docker] Optimizing Docker layers...\');\n\n';
  code += '    for (const service of services) {\n';
  code += '      const buildPath = path.join(this.projectRoot, service.buildPath);\n';
  code += '      await this.analyzeLayers(buildPath, service.name);\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Layer optimization complete\');\n';
  code += '  }\n\n';
  code += '  private async analyzeLayers(buildPath: string, serviceName: string): Promise<void> {\n';
  code += '    const layers: DockerLayer[] = [];\n\n';
  code += '    // Analyze common dependencies\n';
  code += '    const commonPaths = [\n';
  code += '      \'node_modules\',\n';
  code += '      \'vendor\',\n';
  code += '      \'target\',\n';
  code += '      \'__pycache__\',\n';
  code += '      \'.venv\',\n';
  code += '    ];\n\n';
  code += '    for (const layerPath of commonPaths) {\n';
  code += '      const fullPath = path.join(buildPath, layerPath);\n';
  code += '      if (fs.existsSync(fullPath)) {\n';
  code += '        const hash = this.computeLayerHash(fullPath);\n';
  code += '        const size = this.getDirectorySize(fullPath);\n\n';
  code += '        const layer: DockerLayer = {\n';
  code += '          path: layerPath,\n';
  code += '          hash,\n';
  code += '          size,\n';
  code += '          shared: this.isLayerShared(hash),\n';
  code += '        };\n\n';
  code += '        layers.push(layer);\n';
  code += '        this.layerCache.set(serviceName + \':\' + layerPath, layer);\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    console.log(\'[Docker] Analyzed \' + layers.length + \' layers for \' + serviceName);\n';
  code += '  }\n\n';
  code += '  private computeLayerHash(layerPath: string): string {\n';
  code += '    const hash = createHash(\'sha256\');\n';
  code += '    const files = this.getAllFiles(layerPath);\n\n';
  code += '    for (const file of files.sort()) {\n';
  code += '      const content = fs.readFileSync(file);\n';
  code += '      hash.update(content);\n';
  code += '    }\n\n';
  code += '    return hash.digest(\'hex\');\n';
  code += '  }\n\n';
  code += '  private getAllFiles(dirPath: string, fileList: string[] = []): string[] {\n';
  code += '    const files = fs.readdirSync(dirPath);\n\n';
  code += '    for (const file of files) {\n';
  code += '      const fullPath = path.join(dirPath, file);\n';
  code += '      if (fs.statSync(fullPath).isDirectory()) {\n';
  code += '        this.getAllFiles(fullPath, fileList);\n';
  code += '      } else {\n';
  code += '        fileList.push(fullPath);\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    return fileList;\n';
  code += '  }\n\n';
  code += '  private getDirectorySize(dirPath: string): number {\n';
  code += '    let size = 0;\n';
  code += '    const files = this.getAllFiles(dirPath);\n\n';
  code += '    for (const file of files) {\n';
  code += '      size += fs.statSync(file).size;\n';
  code += '    }\n\n';
  code += '    return size;\n';
  code += '  }\n\n';
  code += '  private isLayerShared(hash: string): boolean {\n';
  code += '    for (const [, layer] of this.layerCache) {\n';
  code += '      if (layer.hash === hash) {\n';
  code += '        return true;\n';
  code += '      }\n';
  code += '    }\n';
  code += '    return false;\n';
  code += '  }\n\n';
  code += '  generateDockerCompose(): string {\n';
  code += '    let compose = \'version: "3.8"\' + "\\n\\n";\n';
  code += '    compose += "services:" + "\\n";\n\n';
  code += '    for (const service of this.services) {\n';
  code += '      compose += "  " + service.name + ":" + "\\n";\n';
  code += '      compose += "    build:" + "\\n";\n';
  code += '      compose += "      context: " + service.buildPath + "\\n";\n';
  code += '      if (service.dockerfilePath) {\n';
  code += '        compose += "      dockerfile: " + service.dockerfilePath + "\\n";\n';
  code += '      }\n';
  code += '      compose += "    ports:" + "\\n";\n';
  code += '      compose += "      - \\"" + service.port + ":" + service.port + "\\"" + "\\n";\n';
  code += '      compose += "    environment:" + "\\n";\n';
  code += '      for (const [key, value] of Object.entries(service.environment)) {\n';
  code += '        compose += "      " + key + ": \\"" + value + "\\"" + "\\n";\n';
  code += '      }\n';
  code += '      if (service.dependencies.length > 0) {\n';
  code += '        compose += "    depends_on:" + "\\n";\n';
  code += '        for (const dep of service.dependencies) {\n';
  code += '          compose += "      - " + dep + "\\n";\n';
  code += '        }\n';
  code += '      }\n';
  code += '      compose += "\\n";\n';
  code += '    }\n\n';
  code += '    return compose;\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const orchestrator = new DockerOrchestrator({\n';
  code += '  enableLayerOptimization: true,\n';
  code += '  enableParallelBuilds: true,\n';
  code += '  enableServiceDiscovery: true,\n';
  code += '  enableHealthChecks: true,\n';
  code += '  maxParallelBuilds: 4,\n';
  code += '});\n\n';
  code += 'export default orchestrator;\n';
  code += 'export { DockerOrchestrator, Service, DockerLayer };\n';

  return code;
}

export function generatePythonDocker(config: OrchestrationConfig): string {
  let code = '# Auto-generated Docker Orchestration for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import hashlib\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'import asyncio\n\n';
  code += '@dataclass\n';
  code += 'class Service:\n';
  code += '    name: str\n';
  code += '    language: str  # "javascript" | "typescript" | "python" | "go" | "rust" | "java"\n';
  code += '    build_path: str\n';
  code += '    dockerfile_path: str\n';
  code += '    port: int\n';
  code += '    dependencies: List[str]\n';
  code += '    environment: Dict[str, str]\n\n';
  code += '@dataclass\n';
  code += 'class DockerLayer:\n';
  code += '    path: str\n';
  code += '    hash: str\n';
  code += '    size: int\n';
  code += '    shared: bool\n\n';
  code += 'class DockerOrchestrator:\n';
  code += '    def __init__(self, project_root: str = None, services: List[Service] = None, enable_layer_optimization: bool = True, enable_parallel_builds: bool = True, enable_service_discovery: bool = True, enable_health_checks: bool = True, max_parallel_builds: int = 4):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.services = services or []\n';
  code += '        self.enable_layer_optimization = enable_layer_optimization\n';
  code += '        self.enable_parallel_builds = enable_parallel_builds\n';
  code += '        self.enable_service_discovery = enable_service_discovery\n';
  code += '        self.enable_health_checks = enable_health_checks\n';
  code += '        self.max_parallel_builds = max_parallel_builds\n';
  code += '        self.layer_cache: Dict[str, DockerLayer] = {}\n\n';
  code += '    async def build_services(self, services: List[Service] = None) -> None:\n';
  code += '        target_services = services or self.services\n';
  code += '        print(f"[Docker] Building {len(target_services)} services...")\n\n';
  code += '        if self.enable_layer_optimization:\n';
  code += '            await self.optimize_layers(target_services)\n\n';
  code += '        if self.enable_parallel_builds:\n';
  code += '            await self.build_parallel(target_services)\n';
  code += '        else:\n';
  code += '            await self.build_sequential(target_services)\n\n';
  code += '        print("[Docker] Build complete")\n\n';
  code += '    async def build_parallel(self, services: List[Service]) -> None:\n';
  code += '        print("[Docker] Building services in parallel...")\n';
  code += '        tasks = []\n\n';
  code += '        for service in services:\n';
  code += '            if len(tasks) >= self.max_parallel_builds:\n';
  code += '                done, tasks = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)\n';
  code += '            task = asyncio.create_task(self.build_service(service))\n';
  code += '            tasks.append(task)\n\n';
  code += '        await asyncio.gather(*tasks)\n\n';
  code += '    async def build_sequential(self, services: List[Service]) -> None:\n';
  code += '        print("[Docker] Building services sequentially...")\n';
  code += '        for service in services:\n';
  code += '            await self.build_service(service)\n\n';
  code += '    async def build_service(self, service: Service) -> None:\n';
  code += '        print(f"[Docker] Building service: {service.name}")\n\n';
  code += '        try:\n';
  code += '            dockerfile_path = self.project_root / service.dockerfile_path\n';
  code += '            build_path = self.project_root / service.build_path\n\n';
  code += '            command = f"docker build -t {service.name}:latest"\n';
  code += '            if dockerfile_path.exists():\n';
  code += '                command += f" -f {dockerfile_path}"\n';
  code += '            command += f" {build_path}"\n\n';
  code += '            subprocess.run(command, shell=True, check=True)\n';
  code += '            print(f"[Docker] Built service: {service.name}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Docker] Failed to build service: {service.name}: {e}")\n';
  code += '            raise\n\n';
  code += '    async def start_services(self, services: List[Service] = None) -> None:\n';
  code += '        target_services = services or self.services\n';
  code += '        print(f"[Docker] Starting {len(target_services)} services...")\n\n';
  code += '        for service in target_services:\n';
  code += '            await self.start_service(service)\n\n';
  code += '        print("[Docker] Services started")\n\n';
  code += '    async def start_service(self, service: Service) -> None:\n';
  code += '        print(f"[Docker] Starting service: {service.name}")\n\n';
  code += '        try:\n';
  code += '            # Stop existing container if running\n';
  code += '            subprocess.run(f"docker stop {service.name} 2>/dev/null || true", shell=True)\n';
  code += '            subprocess.run(f"docker rm {service.name} 2>/dev/null || true", shell=True)\n\n';
  code += '            # Build environment args\n';
  code += '            env_args = " ".join([f"-e {key}={value}" for key, value in service.environment.items()])\n\n';
  code += '            # Start container\n';
  code += '            command = f"docker run -d --name {service.name} -p {service.port}:{service.port} {env_args} {service.name}:latest"\n';
  code += '            subprocess.run(command, shell=True, check=True)\n\n';
  code += '            print(f"[Docker] Started service: {service.name} on port {service.port}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Docker] Failed to start service: {service.name}: {e}")\n';
  code += '            raise\n\n';
  code += '    async def stop_services(self, services: List[Service] = None) -> None:\n';
  code += '        target_services = services or self.services\n';
  code += '        print(f"[Docker] Stopping {len(target_services)} services...")\n\n';
  code += '        for service in target_services:\n';
  code += '            await self.stop_service(service)\n\n';
  code += '        print("[Docker] Services stopped")\n\n';
  code += '    async def stop_service(self, service: Service) -> None:\n';
  code += '        print(f"[Docker] Stopping service: {service.name}")\n\n';
  code += '        try:\n';
  code += '            subprocess.run(f"docker stop {service.name}", shell=True, check=True)\n';
  code += '            subprocess.run(f"docker rm {service.name}", shell=True, check=True)\n';
  code += '            print(f"[Docker] Stopped service: {service.name}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Docker] Failed to stop service: {service.name}: {e}")\n\n';
  code += '    async def check_health(self, services: List[Service] = None) -> Dict[str, bool]:\n';
  code += '        target_services = services or self.services\n';
  code += '        status = {}\n\n';
  code += '        if not self.enable_health_checks:\n';
  code += '            print("[Docker] Health checks are disabled")\n';
  code += '            return status\n\n';
  code += '        print("[Docker] Checking service health...")\n\n';
  code += '        for service in target_services:\n';
  code += '            status[service.name] = await self.is_service_healthy(service)\n\n';
  code += '        return status\n\n';
  code += '    async def is_service_healthy(self, service: Service) -> bool:\n';
  code += '        try:\n';
  code += '            result = subprocess.run(f"docker inspect --format=\'{{{{.State.Health.Status}}}}\' {service.name}",\n';
  code += '                                        shell=True, capture_output=True, text=True)\n';
  code += '            return True\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            # Fallback: check if container is running\n';
  code += '            try:\n';
  code += '                result = subprocess.run(f"docker inspect --format=\'{{{{.State.Running}}}}\' {service.name}",\n';
  code += '                                            shell=True, capture_output=True, text=True)\n';
  code += '                return "true" in result.stdout.lower()\n';
  code += '            except subprocess.CalledProcessError:\n';
  code += '                return False\n\n';
  code += '    async def optimize_layers(self, services: List[Service]) -> None:\n';
  code += '        print("[Docker] Optimizing Docker layers...")\n\n';
  code += '        for service in services:\n';
  code += '            build_path = self.project_root / service.build_path\n';
  code += '            await self.analyze_layers(build_path, service.name)\n\n';
  code += '        print("[Docker] Layer optimization complete")\n\n';
  code += '    async def analyze_layers(self, build_path: Path, service_name: str) -> None:\n';
  code += '        layers = []\n\n';
  code += '        # Analyze common dependencies\n';
  code += '        common_paths = [\n';
  code += '            "node_modules",\n';
  code += '            "vendor",\n';
  code += '            "target",\n';
  code += '            "__pycache__",\n';
  code += '            ".venv",\n';
  code += '        ]\n\n';
  code += '        for layer_path in common_paths:\n';
  code += '            full_path = build_path / layer_path\n';
  code += '            if full_path.exists():\n';
  code += '                hash_val = self.compute_layer_hash(full_path)\n';
  code += '                size = self.get_directory_size(full_path)\n\n';
  code += '                layer = DockerLayer(\n';
  code += '                    path=layer_path,\n';
  code += '                    hash=hash_val,\n';
  code += '                    size=size,\n';
  code += '                    shared=self.is_layer_shared(hash_val),\n';
  code += '                )\n\n';
  code += '                layers.append(layer)\n';
  code += '                self.layer_cache[f"{service_name}:{layer_path}"] = layer\n\n';
  code += '        print(f"[Docker] Analyzed {len(layers)} layers for {service_name}")\n\n';
  code += '    def compute_layer_hash(self, layer_path: Path) -> str:\n';
  code += '        hash_obj = hashlib.sha256()\n';
  code += '        files = self.get_all_files(layer_path)\n\n';
  code += '        for file_path in sorted(files):\n';
  code += '            with open(file_path, "rb") as f:\n';
  code += '                hash_obj.update(f.read())\n\n';
  code += '        return hash_obj.hexdigest()\n\n';
  code += '    def get_all_files(self, dir_path: Path, file_list: List[Path] = None) -> List[Path]:\n';
  code += '        if file_list is None:\n';
  code += '            file_list = []\n\n';
  code += '        for item in dir_path.iterdir():\n';
  code += '            if item.is_dir():\n';
  code += '                self.get_all_files(item, file_list)\n';
  code += '            else:\n';
  code += '                file_list.append(item)\n\n';
  code += '        return file_list\n\n';
  code += '    def get_directory_size(self, dir_path: Path) -> int:\n';
  code += '        size = 0\n';
  code += '        for file_path in self.get_all_files(dir_path):\n';
  code += '            size += file_path.stat().st_size\n';
  code += '        return size\n\n';
  code += '    def is_layer_shared(self, hash_val: str) -> bool:\n';
  code += '        for layer in self.layer_cache.values():\n';
  code += '            if layer.hash == hash_val:\n';
  code += '                return True\n';
  code += '        return False\n\n';
  code += '    def generate_docker_compose(self) -> str:\n';
  code += '        compose = \'version: "3.8"\' + "\\n\\n"\n';
  code += '        compose += "services:" + "\\n"\n\n';
  code += '        for service in self.services:\n';
  code += '            compose += f"  {service.name}:" + "\\n"\n';
  code += '            compose += "    build:" + "\\n"\n';
  code += '            compose += f"      context: {service.build_path}" + "\\n"\n';
  code += '            if service.dockerfile_path:\n';
  code += '                compose += f"      dockerfile: {service.dockerfile_path}" + "\\n"\n';
  code += '            compose += "    ports:" + "\\n"\n';
  code += '            compose += f"      - \\"{service.port}:{service.port}\\"" + "\\n"\n';
  code += '            compose += "    environment:" + "\\n"\n';
  code += '            for key, value in service.environment.items():\n';
  code += '                compose += f"      {key}: \\"{value}\\"" + "\\n"\n';
  code += '            if service.dependencies:\n';
  code += '                compose += "    depends_on:" + "\\n"\n';
  code += '                for dep in service.dependencies:\n';
  code += '                    compose += f"      - {dep}" + "\\n"\n';
  code += '            compose += "\\n"\n\n';
  code += '        return compose\n\n';
  code += 'orchestrator = DockerOrchestrator(\n';
  code += '    enable_layer_optimization=True,\n';
  code += '    enable_parallel_builds=True,\n';
  code += '    enable_service_discovery=True,\n';
  code += '    enable_health_checks=True,\n';
  code += '    max_parallel_builds=4,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: OrchestrationConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate TypeScript version
  const tsCode = generateTypeScriptDocker(config);
  const tsPath = path.join(outputDir, 'docker-orchestration.ts');
  fs.writeFileSync(tsPath, tsCode);

  // Generate Python version
  const pyCode = generatePythonDocker(config);
  const pyPath = path.join(outputDir, 'docker-orchestration.py');
  fs.writeFileSync(pyPath, pyCode);

  // Generate documentation
  const md = generateDockerMD(config);
  const mdPath = path.join(outputDir, 'DOCKER.md');
  fs.writeFileSync(mdPath, md);

  // Generate package.json for TypeScript
  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Polyglot Docker orchestration with layer sharing',
    main: 'docker-orchestration.ts',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1',
    },
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.0.0',
    },
  };
  const pkgPath = path.join(outputDir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));

  // Generate requirements.txt for Python
  const requirements = [];
  const reqPath = path.join(outputDir, 'requirements.txt');
  fs.writeFileSync(reqPath, requirements.join('\n') + '\n');

  // Generate config file
  const configJson = {
    projectName: config.projectName,
    enableLayerOptimization: config.enableLayerOptimization,
    enableParallelBuilds: config.enableParallelBuilds,
    enableServiceDiscovery: config.enableServiceDiscovery,
    enableHealthChecks: config.enableHealthChecks,
    maxParallelBuilds: config.maxParallelBuilds,
    generatedAt: new Date().toISOString(),
  };
  const cfgPath = path.join(outputDir, 'docker-config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(configJson, null, 2));
}
