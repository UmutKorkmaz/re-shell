import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import { analyzeServices, DependencyGraph, ServiceDefinition } from './dependency-injection';

/**
 * Service Relationship Management
 * Manages relationships between services with automatic linking and dependency tracking
 */

export interface ServiceRelationship {
  source: string;
  target: string;
  type: 'api' | 'database' | 'cache' | 'message-queue' | 'service-discovery' | 'event-stream' | 'shared-state';
  strength: 'strong' | 'weak' | 'optional';
  protocol?: string;
  description?: string;
  autoWire?: boolean;
}

export interface ServiceLink {
  from: string;
  to: string;
  linkType: 'import' | 'http' | 'grpc' | 'websocket' | 'message-queue' | 'database' | 'cache' | 'service-discovery';
  config: Record<string, any>;
  status: 'pending' | 'linked' | 'error';
  error?: string;
}

export interface RelationshipManagerConfig {
  workspacePath: string;
  autoWire: boolean;
  validateLinks: boolean;
  generateClients: boolean;
}

export interface RelationshipAnalysis {
  services: ServiceDefinition[];
  relationships: ServiceRelationship[];
  links: ServiceLink[];
  circularDependencies: string[][];
  missingLinks: string[];
  recommendations: string[];
}

/**
 * Analyze service relationships in workspace
 */
export async function analyzeRelationships(
  workspacePath: string = process.cwd()
): Promise<RelationshipAnalysis> {
  console.log(chalk.cyan.bold('\n🔗 Analyzing Service Relationships\n'));

  // Get dependency graph from dependency injection analysis
  const graph = await analyzeServices(workspacePath);

  const services = Array.from(graph.nodes.values());
  const relationships: ServiceRelationship[] = [];
  const links: ServiceLink[] = [];

  // Build relationships from dependency graph
  for (const [serviceName, dependencies] of graph.edges) {
    const sourceService = graph.nodes.get(serviceName);
    if (!sourceService) continue;

    for (const depName of dependencies) {
      const targetService = graph.nodes.get(depName);
      if (!targetService) continue;

      // Determine relationship type based on service capabilities
      const relationshipType = determineRelationshipType(sourceService, targetService);
      const strength = determineRelationshipStrength(sourceService, targetService);

      relationships.push({
        source: serviceName,
        target: depName,
        type: relationshipType,
        strength,
        description: `${serviceName} depends on ${depName}`,
        autoWire: true,
      });

      // Create appropriate link configuration
      const link = buildServiceLinkConfig(serviceName, depName, relationshipType, sourceService, targetService);
      links.push(link);
    }
  }

  // Detect circular dependencies
  const circularDependencies = graph.cycles;

  // Find missing links (services that should be connected but aren't)
  const missingLinks = findMissingLinks(services, relationships);

  // Generate recommendations
  const recommendations = generateRecommendations(services, relationships, circularDependencies, missingLinks);

  // Display analysis
  displayRelationshipAnalysis(services, relationships, circularDependencies, recommendations);

  return {
    services,
    relationships,
    links,
    circularDependencies,
    missingLinks,
    recommendations,
  };
}

/**
 * Determine relationship type between two services
 */
function determineRelationshipType(
  source: ServiceDefinition,
  target: ServiceDefinition
): ServiceRelationship['type'] {
  // Check if target is a database/cache
  if (target.name.toLowerCase().includes('database') ||
      target.name.toLowerCase().includes('db') ||
      target.provides.some(p => p.includes('Database'))) {
    return 'database';
  }

  if (target.name.toLowerCase().includes('cache') ||
      target.name.toLowerCase().includes('redis')) {
    return 'cache';
  }

  if (target.name.toLowerCase().includes('queue') ||
      target.name.toLowerCase().includes('kafka') ||
      target.provides.some(p => p.includes('Message Queue'))) {
    return 'message-queue';
  }

  // If source consumes API from target
  if (source.consumes.some(c => c.includes('HTTP Client')) &&
      target.provides.some(p => p.includes('REST API') || p.includes('GraphQL API'))) {
    return 'api';
  }

  // Default to service discovery
  return 'service-discovery';
}

/**
 * Determine relationship strength
 */
function determineRelationshipStrength(
  source: ServiceDefinition,
  target: ServiceDefinition
): 'strong' | 'weak' | 'optional' {
  // Strong if target is required infrastructure
  if (target.type === 'app' && target.provides.some(p => p.includes('Database'))) {
    return 'strong';
  }

  // Check if dependency is in required list
  if (source.dependencies.includes(target.name)) {
    return 'strong';
  }

  return 'weak';
}

/**
 * Build service link configuration object
 */
function buildServiceLinkConfig(
  sourceName: string,
  targetName: string,
  linkType: ServiceRelationship['type'],
  source: ServiceDefinition,
  target: ServiceDefinition
): ServiceLink {
  const config: Record<string, any> = {};

  switch (linkType) {
    case 'api':
      config.url = `${getProtocol(sourceName)}://${targetName}:${target.port || 3000}`;
      config.timeout = 30000;
      config.retryAttempts = 3;
      break;

    case 'database':
      config.connectionString = `${targetName}://${targetName}:${target.port || 5432}/${sourceName}`;
      config.poolSize = 10;
      config.ssl = true;
      break;

    case 'cache':
      config.host = targetName;
      config.port = target.port || 6379;
      config.ttl = 3600;
      break;

    case 'message-queue':
      config.broker = `${targetName}:${target.port || 5672}`;
      config.queue = `${sourceName}-queue`;
      config.durable = true;
      break;

    case 'service-discovery':
      config.serviceName = targetName;
      config.healthCheckInterval = 30000;
      break;
  }

  return {
    from: sourceName,
    to: targetName,
    linkType: (linkType === 'api' ? 'http' : linkType === 'service-discovery' ? 'http' : linkType) as any,
    config,
    status: 'pending',
  };
}

/**
 * Find missing links that should exist
 */
function findMissingLinks(
  services: ServiceDefinition[],
  relationships: ServiceRelationship[]
): string[] {
  const missing: string[] = [];
  const existingLinks = new Set(
    relationships.map(r => `${r.source}->${r.target}`)
  );

  // Check for common patterns that should be linked
  for (const service of services) {
    // If service has frontend, it should link to backend API
    if (service.framework?.includes('react') || service.framework?.includes('vue')) {
      const backendService = services.find(s =>
        s.framework?.includes('express') ||
        s.framework?.includes('nestjs') ||
        s.framework?.includes('fastify')
      );

      if (backendService) {
        const linkKey = `${service.name}->${backendService.name}`;
        if (!existingLinks.has(linkKey)) {
          missing.push(linkKey);
        }
      }
    }

    // If service uses database, it should link to db service
    if (service.consumes.some(c => c.includes('Database Client'))) {
      const dbService = services.find(s =>
        s.name.toLowerCase().includes('database') ||
        s.name.toLowerCase().includes('postgres') ||
        s.name.toLowerCase().includes('mongodb')
      );

      if (dbService) {
        const linkKey = `${service.name}->${dbService.name}`;
        if (!existingLinks.has(linkKey)) {
          missing.push(linkKey);
        }
      }
    }
  }

  return missing;
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  services: ServiceDefinition[],
  relationships: ServiceRelationship[],
  circularDeps: string[][],
  missingLinks: string[]
): string[] {
  const recommendations: string[] = [];

  // Check for orphaned services
  const connectedServices = new Set();
  relationships.forEach(r => {
    connectedServices.add(r.source);
    connectedServices.add(r.target);
  });

  const orphaned = services.filter(s => !connectedServices.has(s.name));
  if (orphaned.length > 0) {
    recommendations.push(
      `Found ${orphaned.length} orphaned service(s) with no connections: ${orphaned.map(s => s.name).join(', ')}`
    );
  }

  // Check for circular dependencies
  if (circularDeps.length > 0) {
    recommendations.push(
      `⚠️  Found ${circularDeps.length} circular dependency chain(s). Consider refactoring to break cycles.`
    );
  }

  // Check for missing links
  if (missingLinks.length > 0) {
    recommendations.push(
      `Detected ${missingLinks.length} potential missing link(s): ${missingLinks.slice(0, 3).join(', ')}${missingLinks.length > 3 ? '...' : ''}`
    );
  }

  // Check for service mesh recommendations
  if (services.length > 5) {
    recommendations.push(
      'Consider implementing service mesh (Istio/Linkerd) for better traffic management and observability'
    );
  }

  // Check for API gateway
  const apiServices = services.filter(s => s.provides.some(p => p.includes('REST API')));
  if (apiServices.length > 3) {
    recommendations.push(
      'Consider implementing API Gateway for unified entry point and cross-cutting concerns'
    );
  }

  return recommendations;
}

/**
 * Display relationship analysis
 */
function displayRelationshipAnalysis(
  services: ServiceDefinition[],
  relationships: ServiceRelationship[],
  circularDeps: string[][],
  recommendations: string[]
): void {
  console.log(chalk.cyan.bold('📊 Service Relationships\n'));

  // Display relationships
  console.log(chalk.white.bold('Connections:'));
  for (const rel of relationships) {
    const icon = {
      api: '🌐',
      database: '🗄️ ',
      cache: '⚡',
      'message-queue': '📨',
      'service-discovery': '🔍',
      'event-stream': '📡',
      'shared-state': '🔄',
    }[rel.type];

    const strengthIcon = rel.strength === 'strong' ? chalk.red('●') : rel.strength === 'weak' ? chalk.yellow('○') : chalk.gray('○');

    console.log(`  ${icon} ${chalk.cyan(rel.source)} → ${chalk.cyan(rel.target)}`);
    console.log(chalk.gray(`    Type: ${rel.type} | Strength: ${strengthIcon} ${rel.strength}`));
    console.log('');
  }

  // Display circular dependencies
  if (circularDeps.length > 0) {
    console.log(chalk.red.bold('\n⚠️  Circular Dependencies:\n'));
    for (const cycle of circularDeps) {
      console.log(chalk.red(`  ${cycle.join(' → ')}`));
    }
    console.log('');
  }

  // Display recommendations
  if (recommendations.length > 0) {
    console.log(chalk.yellow.bold('💡 Recommendations:\n'));
    for (const rec of recommendations) {
      console.log(chalk.yellow(`  • ${rec}`));
    }
    console.log('');
  }
}

/**
 * Auto-link services based on relationships
 */
export async function linkServices(
  config: RelationshipManagerConfig
): Promise<ServiceLink[]> {
  console.log(chalk.cyan.bold('\n🔗 Auto-Linking Services\n'));

  const analysis = await analyzeRelationships(config.workspacePath);

  const linkedServices: ServiceLink[] = [];

  for (const link of analysis.links) {
    try {
      if (config.autoWire) {
        await createServiceLink(link, config);
        link.status = 'linked';
        linkedServices.push(link);
        console.log(chalk.green(`  ✓ Linked: ${link.from} → ${link.to}`));
      } else {
        console.log(chalk.gray(`  Skipped: ${link.from} → ${link.to} (auto-wire disabled)`));
      }
    } catch (error: any) {
      link.status = 'error';
      link.error = error.message;
      console.log(chalk.red(`  ✗ Failed: ${link.from} → ${link.to} - ${error.message}`));
    }
  }

  // Generate service mesh configuration if many services
  if (analysis.services.length > 5) {
    await generateServiceMeshConfig(analysis, config);
  }

  return linkedServices;
}

/**
 * Create service link in configuration
 */
async function createServiceLink(
  link: ServiceLink,
  config: RelationshipManagerConfig
): Promise<void> {
  const sourceServicePath = path.join(config.workspacePath, 'apps', link.from);
  const targetServicePath = path.join(config.workspacePath, 'apps', link.to);

  // Update source service configuration
  const sourceConfigPath = path.join(sourceServicePath, 'config/services.yaml');

  let serviceConfig: any = {};
  if (await fs.pathExists(sourceConfigPath)) {
    const content = await fs.readFile(sourceConfigPath, 'utf8');
    serviceConfig = yaml.parse(content);
  }

  // Add link configuration
  if (!serviceConfig.links) {
    serviceConfig.links = [];
  }

  serviceConfig.links.push({
    service: link.to,
    type: link.linkType,
    config: link.config,
  });

  // Write updated configuration
  await fs.ensureDir(path.dirname(sourceConfigPath));
  await fs.writeFile(sourceConfigPath, yaml.stringify(serviceConfig));

  // Generate client code if requested
  if (config.generateClients) {
    await generateClientCode(link, sourceServicePath, targetServicePath);
  }
}

/**
 * Generate client code for service link
 */
async function generateClientCode(
  link: ServiceLink,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  const clientPath = path.join(sourcePath, 'src/clients', `${link.to}.ts`);

  let clientCode = '';

  switch (link.linkType) {
    case 'http':
      clientCode = generateHTTPClient(link);
      break;
    case 'grpc':
      clientCode = generateGRPCClient(link);
      break;
    case 'database':
      clientCode = generateDatabaseClient(link);
      break;
    case 'cache':
      clientCode = generateCacheClient(link);
      break;
    case 'message-queue':
      clientCode = generateMessageQueue(link);
      break;
  }

  if (clientCode) {
    await fs.ensureDir(path.dirname(clientPath));
    await fs.writeFile(clientPath, clientCode);
  }
}

/**
 * Generate HTTP client code
 */
function generateHTTPClient(link: ServiceLink): string {
  const className = toPascalCase(link.to);
  const clientName = toCamelCase(link.to);

  return `import axios, { AxiosInstance } from 'axios';

/**
 * HTTP Client for ${link.to}
 */
export class ${className}Client {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '${link.config.url}',
      timeout: ${link.config.timeout || 30000},
    });
  }

  async get<T = any>(path: string, params?: any): Promise<T> {
    const response = await this.client.get(path, { params });
    return response.data;
  }

  async post<T = any>(path: string, data: any): Promise<T> {
    const response = await this.client.post(path, data);
    return response.data;
  }

  async put<T = any>(path: string, data: any): Promise<T> {
    const response = await this.client.put(path, data);
    return response.data;
  }

  async delete<T = any>(path: string): Promise<T> {
    const response = await this.client.delete(path);
    return response.data;
  }
}

export const ${clientName}Client = new ${className}Client();
`;
}

/**
 * Generate gRPC client code
 */
function generateGRPCClient(link: ServiceLink): string {
  return `import * as grpc from '@grpc/grpc-js';

/**
 * gRPC Client for ${link.to}
 */
export class ${toPascalCase(link.to)}GrpcClient {
  private client: any;

  constructor() {
    this.client = new grpc.Client(
      '${link.config.url || link.to}:${link.config.port || 50051}',
      grpc.credentials.createInsecure()
    );
  }

  async call(method: string, request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client[method](request, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}
`;
}

/**
 * Generate database client code
 */
function generateDatabaseClient(link: ServiceLink): string {
  return `import { Pool, PoolConfig } from 'pg';

/**
 * Database Client for ${link.to}
 */
export class ${toPascalCase(link.to)}Database {
  private pool: Pool;

  constructor() {
    const config: PoolConfig = {
      connectionString: '${link.config.connectionString}',
      max: ${link.config.poolSize || 10},
      ssl: ${link.config.ssl !== false},
    };
    this.pool = new Pool(config);
  }

  async query(text: string, params?: any[]): Promise<any> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const ${toCamelCase(link.to)}Database = new ${toPascalCase(link.to)}Database();
`;
}

/**
 * Generate cache client code
 */
function generateCacheClient(link: ServiceLink): string {
  return `import { createClient } from 'redis';

/**
 * Cache Client for ${link.to}
 */
export class ${toPascalCase(link.to)}Cache {
  private client: any;

  constructor() {
    this.client = createClient({
      host: '${link.config.host || link.to}',
      port: ${link.config.port || 6379},
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.client.hGetAll(key);
  }
}

export const ${toCamelCase(link.to)}Cache = new ${toPascalCase(link.to)}Cache();
`;
}

/**
 * Generate message queue client code
 */
function generateMessageQueue(link: ServiceLink): string {
  return `import { connect, Channel } from 'amqplib';

/**
 * Message Queue Client for ${link.to}
 */
export class ${toPascalCase(link.to)}Queue {
  private connection: any;
  private channel: Channel | null = null;

  async connect(): Promise<void> {
    this.connection = await connect('${link.config.broker || link.to}');
    this.channel = await this.connection.createChannel();
  }

  async publish(queue: string, message: any): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    await this.channel.assertQueue(queue, { durable: ${link.config.durable !== false} });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }

  async consume(queue: string, callback: (msg: any) => void): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }
    await this.channel.assertQueue(queue, { durable: ${link.config.durable !== false} });
    await this.channel.consume(queue, (msg: any) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        callback(content);
        this.channel!.ack(msg);
      }
    });
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

export const ${toCamelCase(link.to)}Queue = new ${toPascalCase(link.to)}Queue();
`;
}

/**
 * Generate service mesh configuration
 */
async function generateServiceMeshConfig(
  analysis: RelationshipAnalysis,
  config: RelationshipManagerConfig
): Promise<void> {
  const meshConfigPath = path.join(config.workspacePath, 'servicemesh.yaml');

  const meshConfig = {
    version: 'v1alpha1',
    services: analysis.services.map(s => ({
      name: s.name,
      port: s.port || 3000,
      framework: s.framework,
    })),
    connections: analysis.links.map(l => ({
      from: l.from,
      to: l.to,
      type: l.linkType,
    })),
  };

  await fs.writeFile(meshConfigPath, yaml.stringify(meshConfig));
  console.log(chalk.green(`\n  ✓ Created service mesh configuration\n`));
}

/**
 * Validate service links
 */
export async function validateLinks(
  workspacePath: string = process.cwd()
): Promise<{
  valid: ServiceLink[];
  invalid: Array<{ link: ServiceLink; error: string }>;
  warnings: string[];
}> {
  console.log(chalk.cyan.bold('\n✅ Validating Service Links\n'));

  const analysis = await analyzeRelationships(workspacePath);
  const valid: ServiceLink[] = [];
  const invalid: Array<{ link: ServiceLink; error: string }> = [];
  const warnings: string[] = [];

  for (const link of analysis.links) {
    try {
      // Check if target service exists
      if (!analysis.services.find(s => s.name === link.to)) {
        invalid.push({
          link,
          error: `Target service '${link.to}' not found`,
        });
        continue;
      }

      // Check if source service exists
      if (!analysis.services.find(s => s.name === link.from)) {
        invalid.push({
          link,
          error: `Source service '${link.from}' not found`,
        });
        continue;
      }

      // Validate link configuration
      if (!link.config || Object.keys(link.config).length === 0) {
        warnings.push(`Link ${link.from} → ${link.to} has no configuration`);
      }

      // Check for circular dependencies
      const isInCycle = analysis.circularDependencies.some(cycle =>
        cycle.includes(link.from) && cycle.includes(link.to)
      );

      if (isInCycle) {
        warnings.push(`Link ${link.from} → ${link.to} is part of circular dependency`);
      }

      valid.push(link);
      console.log(chalk.green(`  ✓ Valid: ${link.from} → ${link.to}`));
    } catch (error: any) {
      invalid.push({
        link,
        error: error.message,
      });
      console.log(chalk.red(`  ✗ Invalid: ${link.from} → ${link.to} - ${error.message}`));
    }
  }

  console.log(chalk.cyan(`\n✅ Validation Results:\n`));
  console.log(chalk.green(`  Valid: ${valid.length}`));
  console.log(chalk.red(`  Invalid: ${invalid.length}`));
  console.log(chalk.yellow(`  Warnings: ${warnings.length}\n`));

  return { valid, invalid, warnings };
}

/**
 * Helper functions
 */

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\s/g, '');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function getProtocol(serviceName: string): string {
  // Determine protocol based on service name
  const name = serviceName.toLowerCase();
  if (name.includes('grpc') || name.includes('rpc')) {
    return 'grpc';
  }
  return 'http';
}
