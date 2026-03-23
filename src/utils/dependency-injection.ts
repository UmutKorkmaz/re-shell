import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { analyzeProject, DetectedFramework } from './framework-detection';

/**
 * Dependency Injection and Service Auto-Wiring
 * Analyzes existing services and generates dependency injection code
 */

export interface ServiceDefinition {
  name: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  path: string;
  port?: number;
  framework?: string;
  language: string;
  exports: string[];
  imports: string[];
  dependencies: string[]; // Other services this depends on
  dependents: string[]; // Services that depend on this one
  provides: string[]; // Interfaces/features this service provides
  consumes: string[]; // Interfaces/features this service needs
  healthCheck?: string;
  exposedPorts?: number[];
  envVars?: Record<string, string>;
}

export interface DependencyGraph {
  nodes: Map<string, ServiceDefinition>;
  edges: Map<string, Set<string>>; // service -> dependencies
  reverseEdges: Map<string, Set<string>>; // service -> dependents
  cycles: string[][]; // Detected circular dependencies
}

export interface InjectionPattern {
  framework: string;
  language: string;
  providerDecorator: string;
  injectDecorator: string;
  modulePattern: string;
  example: string;
}

// Dependency injection patterns per framework
const INJECTION_PATTERNS: Record<string, InjectionPattern> = {
  nestjs: {
    framework: 'nestjs',
    language: 'typescript',
    providerDecorator: '@Injectable()',
    injectDecorator: 'constructor(private readonly serviceName: ServiceName)',
    modulePattern: '@Module({ providers: [Service], exports: [Service] })',
    example: `import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(id: string) {
    return this.databaseService.findOne('users', id);
  }
}`,
  },
  angular: {
    framework: 'angular',
    language: 'typescript',
    providerDecorator: '@Injectable({ providedIn: "root" })',
    injectDecorator: 'constructor(private serviceName: ServiceName)',
    modulePattern: '@NgModule({ providers: [Service] })',
    example: `import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private http: HttpClient) {}

  getData() {
    return this.http.get('/api/data');
  }
}`,
  },
  spring: {
    framework: 'spring',
    language: 'java',
    providerDecorator: '@Service or @Component',
    injectDecorator: '@Autowired private ServiceName serviceName',
    modulePattern: '@Configuration or @ComponentScan',
    example: `@Service
public class UserService {
    @Autowired
    private DatabaseService databaseService;

    public User findById(String id) {
        return databaseService.findOne("users", id);
    }
}`,
  },
  express: {
    framework: 'express',
    language: 'javascript',
    providerDecorator: 'N/A - Manual DI',
    injectDecorator: 'Constructor injection or dependency container',
    modulePattern: 'Container registration',
    example: `class UserService {
  constructor(databaseService) {
    this.databaseService = databaseService;
  }

  async findById(id) {
    return this.databaseService.findOne('users', id);
  }
}

// Manual DI
const databaseService = new DatabaseService();
const userService = new UserService(databaseService);`,
  },
  fastify: {
    framework: 'fastify',
    language: 'javascript',
    providerDecorator: 'fastify-plugin',
    injectDecorator: 'via fastify instance decoration',
    modulePattern: 'fastify.register(plugin)',
    example: `const userServicePlugin = async (fastify, options) => {
  fastify.decorate('userService', {
    findById: async (id) => {
      return fastify.databaseService.findOne('users', id);
    }
  });
};

module.exports = fp(userServicePlugin);`,
  },
};

/**
 * Analyze workspace for services and their dependencies
 */
export async function analyzeServices(cwd: string = process.cwd()): Promise<DependencyGraph> {
  console.log(chalk.cyan.bold('\n🔍 Analyzing Services for Dependency Injection\n'));

  const services: ServiceDefinition[] = [];
  const workspaceConfigPath = path.join(cwd, 're-shell.workspaces.yaml');

  if (!(await fs.pathExists(workspaceConfigPath))) {
    console.log(chalk.yellow('No workspace configuration found. Analyzing current directory...\n'));
    const analysis = await analyzeProject(cwd);
    const service = await analyzeSingleService(cwd, analysis);
    if (service) {
      services.push(service);
    }
  } else {
    // Load workspace configuration and analyze all services
    const workspaceContent = await fs.readFile(workspaceConfigPath, 'utf8');
    const workspaceConfig = parseWorkspaceConfig(workspaceContent);

    for (const [name, workspace] of Object.entries(workspaceConfig.workspaces || {})) {
      const workspaceEntry = workspace as any;
      const servicePath = path.join(cwd, workspaceEntry.path);
      if (await fs.pathExists(servicePath)) {
        const analysis = await analyzeProject(servicePath);
        const service = await analyzeSingleService(servicePath, analysis);
        if (service) {
          service.name = name;
          services.push(service);
        }
      }
    }
  }

  // Build dependency graph
  const graph = buildDependencyGraph(services);

  // Display results
  displayDependencyGraph(graph);

  return graph;
}

/**
 * Analyze a single service
 */
async function analyzeSingleService(
  servicePath: string,
  projectAnalysis: any
): Promise<ServiceDefinition | null> {
  const packageJsonPath = path.join(servicePath, 'package.json');
  let packageJson: any = {};

  if (await fs.pathExists(packageJsonPath)) {
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    } catch (error) {
      // Invalid package.json
    }
  }

  const primaryFramework = projectAnalysis.primaryFramework;
  const primaryLanguage = projectAnalysis.primaryLanguage;

  // Detect what this service provides
  const provides = detectServiceCapabilities(servicePath, packageJson, primaryFramework);

  // Detect what this service consumes (imports)
  const consumes = detectServiceDependencies(packageJson);

  // Find dependencies on other workspace services
  const serviceDependencies = detectWorkspaceServiceDependencies(packageJson);

  // Find health check endpoint
  const healthCheck = detectHealthEndpoint(servicePath, primaryFramework);

  // Find exposed ports
  const exposedPorts = detectExposedPorts(servicePath, packageJson, primaryFramework);

  return {
    name: path.basename(servicePath),
    type: detectServiceType(packageJson),
    path: servicePath,
    port: detectServicePort(servicePath, packageJson, primaryFramework),
    framework: primaryFramework,
    language: primaryLanguage,
    exports: Object.keys(packageJson.exports || {}),
    imports: Object.keys(packageJson.imports || {}),
    dependencies: serviceDependencies,
    dependents: [], // Will be filled when building graph
    provides,
    consumes,
    healthCheck,
    exposedPorts,
    envVars: extractEnvVars(servicePath),
  };
}

/**
 * Detect what a service provides (capabilities/features)
 */
function detectServiceCapabilities(
  servicePath: string,
  packageJson: any,
  framework?: string
): string[] {
  const capabilities: string[] = [];

  // Check for API endpoints
  if (framework === 'express' || framework === 'fastify' || framework === 'nestjs' || framework === 'hapi') {
    capabilities.push('REST API');
  }

  if (framework === 'graphql' || packageJson.dependencies?.['graphql']) {
    capabilities.push('GraphQL API');
  }

  if (packageJson.dependencies?.['socket.io'] || packageJson.dependencies?.['ws']) {
    capabilities.push('WebSocket');
  }

  if (packageJson.dependencies?.['ioredis'] || packageJson.dependencies?.['redis']) {
    capabilities.push('Redis Client');
  }

  if (packageJson.dependencies?.['pg'] || packageJson.dependencies?.['mongoose']) {
    capabilities.push('Database Access');
  }

  if (packageJson.dependencies?.['@nestjs/microservices'] || packageJson.dependencies?.['nats']) {
    capabilities.push('Message Queue');
  }

  // Check for exported types/interfaces
  const srcPath = path.join(servicePath, 'src');
  if (fs.existsSync(srcPath)) {
    const hasTypes = fs.readdirSync(srcPath).some(file =>
      file.endsWith('.d.ts') || file.endsWith('.interface.ts') || file.endsWith('.types.ts')
    );
    if (hasTypes) {
      capabilities.push('Type Definitions');
    }
  }

  return capabilities;
}

/**
 * Detect what a service consumes from other services
 */
function detectServiceDependencies(packageJson: any): string[] {
  const consumes: string[] = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Check for typical service client dependencies
  if (allDeps['@grpc/grpc-js'] || allDeps['grpc']) {
    consumes.push('gRPC Client');
  }

  if (allDeps['axios'] || allDeps['node-fetch'] || allDeps['got']) {
    consumes.push('HTTP Client');
  }

  if (allDeps['amqplib'] || allDeps['kafkajs']) {
    consumes.push('Message Queue Client');
  }

  if (allDeps['ioredis'] || allDeps['redis']) {
    consumes.push('Redis Client');
  }

  if (allDeps['pg'] || allDeps['mongodb'] || allDeps['mongoose']) {
    consumes.push('Database Client');
  }

  return consumes;
}

/**
 * Detect dependencies on other workspace services
 */
function detectWorkspaceServiceDependencies(packageJson: any): string[] {
  const serviceDeps: string[] = [];

  // Check workspace dependencies
  if (packageJson.workspaceDependencies) {
    serviceDeps.push(...Object.keys(packageJson.workspaceDependencies));
  }

  // Check for monorepo workspace references
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const dep of Object.keys(allDeps)) {
    // Workspace packages typically start with the org scope
    if (dep.startsWith('@') && allDeps[dep].startsWith('workspace:')) {
      serviceDeps.push(dep);
    }
  }

  return serviceDeps;
}

/**
 * Detect health check endpoint
 */
function detectHealthEndpoint(servicePath: string, framework?: string): string | undefined {
  const commonPaths = [
    'src/health.ts',
    'src/health.js',
    'src/health/index.ts',
    'src/controllers/health.controller.ts',
    'src/routes/health.ts',
  ];

  for (const healthPath of commonPaths) {
    const fullPath = path.join(servicePath, healthPath);
    if (fs.existsSync(fullPath)) {
      return '/health';
    }
  }

  return undefined;
}

/**
 * Detect exposed ports
 */
function detectExposedPorts(servicePath: string, packageJson: any, framework?: string): number[] {
  const ports: number[] = [];

  // Check package.json for port configuration
  if (packageJson.config?.port) {
    ports.push(packageJson.config.port);
  }

  if (packageJson.config?.devPort) {
    ports.push(packageJson.config.devPort);
  }

  // Framework-specific defaults
  const frameworkPorts: Record<string, number> = {
    nestjs: 3000,
    express: 3000,
    fastify: 3000,
    hapi: 3000,
    nextjs: 3000,
    react: 3000,
    vue: 5173,
    angular: 4200,
    svelte: 5173,
  };

  if (framework && frameworkPorts[framework]) {
    ports.push(frameworkPorts[framework]);
  }

  // Check for common port files
  const portFile = path.join(servicePath, '.port');
  if (fs.existsSync(portFile)) {
    const portContent = fs.readFileSync(portFile, 'utf8').trim();
    const port = parseInt(portContent, 10);
    if (!isNaN(port)) {
      ports.push(port);
    }
  }

  return [...new Set(ports)]; // Remove duplicates
}

/**
 * Detect service type
 */
function detectServiceType(packageJson: any): 'app' | 'package' | 'lib' | 'tool' {
  if (packageJson.bin) {
    return 'tool';
  }

  if (packageJson.main && !packageJson.scripts?.start && !packageJson.scripts?.dev) {
    return 'lib';
  }

  if (packageJson.scripts?.start || packageJson.scripts?.dev) {
    return 'app';
  }

  return 'package';
}

/**
 * Detect service port
 */
function detectServicePort(servicePath: string, packageJson: any, framework?: string): number | undefined {
  // Check package.json config
  if (typeof packageJson.config?.port === 'number') {
    return packageJson.config.port;
  }

  // Framework defaults
  const defaults: Record<string, number> = {
    nestjs: 3000,
    express: 3000,
    fastify: 3000,
    hapi: 3000,
    nextjs: 3000,
    react: 5173,
    vue: 5173,
    angular: 4200,
  };

  if (framework && defaults[framework]) {
    return defaults[framework];
  }

  return undefined;
}

/**
 * Extract environment variables from service
 */
function extractEnvVars(servicePath: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  // Check for .env file
  const envPath = path.join(servicePath, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  }

  // Check for .env.example
  const envExamplePath = path.join(servicePath, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    for (const line of envContent.split('\n')) {
      if (line.trim() && !line.startsWith('#')) {
        const [key] = line.split('=');
        if (key && !envVars[key]) {
          envVars[key.trim()] = '';
        }
      }
    }
  }

  return envVars;
}

/**
 * Build dependency graph from services
 */
function buildDependencyGraph(services: ServiceDefinition[]): DependencyGraph {
  const nodes = new Map<string, ServiceDefinition>();
  const edges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();

  // Add all nodes
  for (const service of services) {
    nodes.set(service.name, service);
    edges.set(service.name, new Set());
    reverseEdges.set(service.name, new Set());
  }

  // Build edges
  for (const service of services) {
    for (const dep of service.dependencies) {
      // Extract service name from package name
      const depName = dep.replace(/^@[^/]+\//, '').replace(/^@/, '');
      if (nodes.has(depName)) {
        edges.get(service.name)?.add(depName);
        reverseEdges.get(depName)?.add(service.name);
      }
    }
  }

  // Detect cycles
  const cycles = detectCycles(edges);

  return { nodes, edges, reverseEdges, cycles };
}

/**
 * Detect circular dependencies
 */
function detectCycles(edges: Map<string, Set<string>>): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of edges.get(node) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    recursionStack.delete(node);
  }

  for (const node of edges.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Display dependency graph
 */
function displayDependencyGraph(graph: DependencyGraph): void {
  console.log(chalk.cyan.bold('📊 Dependency Graph\n'));

  // Display services
  console.log(chalk.white.bold('Services:'));
  for (const [name, service] of graph.nodes) {
    console.log(chalk.cyan(`\n  ${name}`));
    console.log(chalk.gray(`    Type: ${service.type}`));
    console.log(chalk.gray(`    Language: ${service.language}`));
    if (service.framework) {
      console.log(chalk.gray(`    Framework: ${service.framework}`));
    }
    if (service.port) {
      console.log(chalk.gray(`    Port: ${service.port}`));
    }
    if (service.provides.length > 0) {
      console.log(chalk.gray(`    Provides: ${service.provides.join(', ')}`));
    }
    if (service.consumes.length > 0) {
      console.log(chalk.gray(`    Consumes: ${service.consumes.join(', ')}`));
    }
  }

  // Display dependencies
  console.log(chalk.white.bold('\n\nDependencies:'));
  for (const [service, deps] of graph.edges) {
    if (deps.size > 0) {
      console.log(chalk.cyan(`\n  ${service} →`));
      for (const dep of deps) {
        console.log(chalk.gray(`    - ${dep}`));
      }
    }
  }

  // Display cycles
  if (graph.cycles.length > 0) {
    console.log(chalk.red.bold('\n\n⚠️  Circular Dependencies Detected:'));
    for (const cycle of graph.cycles) {
      console.log(chalk.red(`  ${cycle.join(' → ')}`));
    }
  }

  console.log('');
}

/**
 * Generate dependency injection code for a service
 */
export async function generateInjectionCode(
  serviceName: string,
  graph: DependencyGraph,
  targetLanguage?: string,
  targetFramework?: string
): Promise<string> {
  const service = graph.nodes.get(serviceName);
  if (!service) {
    throw new Error(`Service ${serviceName} not found in dependency graph`);
  }

  const dependencies = Array.from(graph.edges.get(serviceName) || [])
    .map(depName => graph.nodes.get(depName))
    .filter((dep): dep is ServiceDefinition => !!dep);

  // Determine best injection pattern
  const pattern = selectInjectionPattern(service, targetLanguage, targetFramework);

  // Generate code based on pattern
  return generateInjectionTemplate(service, dependencies, pattern);
}

/**
 * Select the best injection pattern for a service
 */
function selectInjectionPattern(
  service: ServiceDefinition,
  targetLanguage?: string,
  targetFramework?: string
): InjectionPattern {
  const framework = targetFramework || service.framework || 'express';
  const language = targetLanguage || service.language;

  // Direct match
  const directKey = `${framework}-${language}`;
  if (INJECTION_PATTERNS[framework]) {
    return INJECTION_PATTERNS[framework];
  }

  // Language fallback
  for (const [key, pattern] of Object.entries(INJECTION_PATTERNS)) {
    if (pattern.language === language) {
      return pattern;
    }
  }

  // Default to express pattern
  return INJECTION_PATTERNS.express;
}

/**
 * Generate injection template code
 */
function generateInjectionTemplate(
  service: ServiceDefinition,
  dependencies: ServiceDefinition[],
  pattern: InjectionPattern
): string {
  let code = `// Dependency Injection Setup for ${service.name}\n`;
  code += `// Framework: ${pattern.framework}\n`;
  code += `// Language: ${pattern.language}\n\n`;

  // Generate service class with injected dependencies
  code += generateServiceClass(service, dependencies, pattern);

  // Generate module/configuration registration
  code += generateModuleConfig(service, dependencies, pattern);

  return code;
}

/**
 * Generate service class with constructor injection
 */
function generateServiceClass(
  service: ServiceDefinition,
  dependencies: ServiceDefinition[],
  pattern: InjectionPattern
): string {
  let code = '';

  if (pattern.language === 'typescript') {
    code += `${pattern.providerDecorator}\n`;
    code += `export class ${toPascalCase(service.name)}Service {\n`;
    code += `  constructor(\n`;

    // Inject dependencies
    for (const dep of dependencies) {
      const depName = toCamelCase(dep.name);
      code += `    private readonly ${depName}Service: ${toPascalCase(dep.name)}Service,\n`;
    }

    code += `  ) {}\n\n`;

    // Example methods
    code += `  // Example method using injected dependencies\n`;
    if (dependencies.length > 0) {
      const firstDep = toCamelCase(dependencies[0].name);
      code += `  async getData() {\n`;
      code += `    return this.${firstDep}Service.findAll();\n`;
      code += `  }\n`;
    }

    code += `}\n\n`;
  } else if (pattern.language === 'java') {
    code += `${pattern.providerDecorator}\n`;
    code += `public class ${toPascalCase(service.name)}Service {\n\n`;

    // Inject dependencies
    for (const dep of dependencies) {
      const depName = toCamelCase(dep.name);
      code += `    @Autowired\n`;
      code += `    private ${toPascalCase(dep.name)}Service ${depName}Service;\n\n`;
    }

    code += `    public void exampleMethod() {\n`;
    if (dependencies.length > 0) {
      const firstDep = toCamelCase(dependencies[0].name);
      code += `        ${firstDep}Service.findAll();\n`;
    }
    code += `    }\n`;
    code += `}\n\n`;
  } else {
    // JavaScript/manual DI
    code += `class ${toPascalCase(service.name)}Service {\n`;
    code += `  constructor(`;

    const depParams = dependencies.map(dep => toCamelCase(dep.name) + 'Service').join(', ');
    code += depParams;

    code += `) {\n`;
    for (const dep of dependencies) {
      const depName = toCamelCase(dep.name);
      code += `    this.${depName}Service = ${depName}Service;\n`;
    }
    code += `  }\n\n`;

    code += `  async getData() {\n`;
    if (dependencies.length > 0) {
      const firstDep = toCamelCase(dependencies[0].name);
      code += `    return this.${firstDep}Service.findAll();\n`;
    }
    code += `  }\n`;
    code += `}\n\n`;
  }

  return code;
}

/**
 * Generate module/configuration for dependency registration
 */
function generateModuleConfig(
  service: ServiceDefinition,
  dependencies: ServiceDefinition[],
  pattern: InjectionPattern
): string {
  let code = '';

  if (pattern.framework === 'nestjs') {
    code += `@Module({\n`;
    code += `  providers: [\n`;
    code += `    ${toPascalCase(service.name)}Service,\n`;

    for (const dep of dependencies) {
      code += `    ${toPascalCase(dep.name)}Service,\n`;
    }

    code += `  ],\n`;
    code += `  exports: [${toPascalCase(service.name)}Service],\n`;
    code += `  imports: [\n`;

    for (const dep of dependencies) {
      code += `    ${toPascalCase(dep.name)}Module,\n`;
    }

    code += `  ],\n`;
    code += `})\n`;
    code += `export class ${toPascalCase(service.name)}Module {}\n`;
  } else if (pattern.framework === 'fastify') {
    code += `const ${toPascalCase(service.name)}Plugin = async (fastify, options) => {\n`;
    code += `  // Register dependencies\n`;

    for (const dep of dependencies) {
      const depName = toCamelCase(dep.name);
      code += `  fastify.register(require('./${dep.name}/${depName}.plugin'));\n`;
    }

    code += `  \n`;
    code += `  // Decorate fastify instance with this service\n`;
    code += `  fastify.decorate('${toCamelCase(service.name)}Service', new ${toPascalCase(service.name)}Service(\n`;
    code += `    fastify.${toCamelCase(dependencies[0]?.name || '')}Service\n`;
    code += `  ));\n`;
    code += `};\n\n`;
    code += `module.exports = fp(${toPascalCase(service.name)}Plugin);\n`;
  } else {
    // Manual DI container
    code += `// Manual Dependency Injection Container\n`;
    code += `class DIContainer {\n`;
    code += `  constructor() {\n`;
    code += `    this.services = new Map();\n`;
    code += `  }\n\n`;

    code += `  register(name, instance) {\n`;
    code += `    this.services.set(name, instance);\n`;
    code += `  }\n\n`;

    code += `  get(name) {\n`;
    code += `    return this.services.get(name);\n`;
    code += `  }\n`;

    for (const dep of dependencies) {
      const depName = toCamelCase(dep.name);
      code += `  get${toPascalCase(dep.name)}Service() {\n`;
      code += `    return this.get('${depName}Service');\n`;
      code += `  }\n`;
    }

    code += `}\n\n`;

    code += `// Initialize container\n`;
    code += `const container = new DIContainer();\n`;
    code += `const ${toCamelCase(service.name)}Service = new ${toPascalCase(service.name)}Service(\n`;

    const depParams = dependencies.map(dep => `container.get${toPascalCase(dep.name)}Service()`).join(',\n  ');
    code += `  ${depParams}\n`;
    code += `);\n`;
    code += `container.register('${toCamelCase(service.name)}Service', ${toCamelCase(service.name)}Service);\n`;
  }

  return code;
}

/**
 * Generate auto-wiring configuration file
 */
export async function generateAutoWiringConfig(
  graph: DependencyGraph,
  outputPath: string
): Promise<void> {
  const config = {
    version: '1.0.0',
    services: {} as Record<string, any>,
    wiring: [] as any[],
  };

  // Add service definitions
  for (const [name, service] of graph.nodes) {
    const dependencies = Array.from(graph.edges.get(name) || []);

    config.services[name] = {
      type: service.type,
      framework: service.framework,
      language: service.language,
      path: service.path,
      port: service.port,
      provides: service.provides,
      consumes: service.consumes,
      dependencies,
      healthCheck: service.healthCheck,
      envVars: service.envVars,
    };
  }

  // Generate wiring rules
  for (const [serviceName, deps] of graph.edges) {
    if (deps.size > 0) {
      config.wiring.push({
        service: serviceName,
        inject: Array.from(deps),
      });
    }
  }

  // Add warnings for cycles
  if (graph.cycles.length > 0) {
    (config as any).warnings = {
      circularDependencies: graph.cycles,
    };
  }

  // Write configuration
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeJson(outputPath, config, { spaces: 2 });

  console.log(chalk.green(`\n✓ Auto-wiring configuration written to: ${outputPath}\n`));
}

/**
 * Helper: Convert to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\s/g, '');
}

/**
 * Helper: Convert to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Parse workspace configuration from YAML
 */
function parseWorkspaceConfig(content: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('yaml');
    return yaml.parse(content);
  } catch (error) {
    return {};
  }
}

/**
 * Display recommended injection patterns
 */
export async function showInjectionRecommendations(
  graph: DependencyGraph
): Promise<void> {
  console.log(chalk.cyan.bold('\n💡 Injection Recommendations\n'));

  for (const [name, service] of graph.nodes) {
    const dependencies = Array.from(graph.edges.get(name) || []);

    if (dependencies.length === 0) {
      console.log(chalk.gray(`${name}: No dependencies detected`));
      continue;
    }

    const pattern = selectInjectionPattern(service);
    console.log(chalk.cyan.bold(`\n${name} (${service.framework || 'unknown'}):`));
    console.log(chalk.gray(`  Pattern: ${pattern.framework} (${pattern.language})`));
    console.log(chalk.gray(`  Dependencies: ${dependencies.join(', ')}`));

    if (graph.cycles.some(cycle => cycle.includes(name))) {
      console.log(chalk.yellow(`  ⚠️  Warning: Part of circular dependency chain`));
    }
  }

  console.log('');
}
