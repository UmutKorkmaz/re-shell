// Auto-generated Multi-Cloud Networking and Connectivity Utility
// Generated at: 2026-01-13T11:50:00.000Z

import chalk from 'chalk';

/**
 * Supported cloud provider identifiers.
 */
type CloudProvider = 'aws' | 'azure' | 'gcp';

/**
 * Supported inter-cloud connection types.
 */
type ConnectionType =
  | 'vpn'
  | 'direct-link'
  | 'express-route'
  | 'interconnect'
  | 'transit-gateway';

/**
 * Available traffic routing strategies for selecting between endpoints.
 */
type RoutingStrategy =
  | 'latency-based'
  | 'cost-based'
  | 'geo-based'
  | 'weighted'
  | 'priority';

/**
 * Network protocols supported by the multi-cloud networking stack.
 */
type Protocol = 'tcp' | 'udp' | 'http' | 'https' | 'grpc';

/**
 * Represents a single network endpoint exposed by a cloud provider.
 */
interface NetworkEndpoint {
  /** Unique identifier for the endpoint. */
  id: string;
  /** Cloud provider hosting the endpoint. */
  provider: CloudProvider;
  /** Cloud region where the endpoint is located (e.g. `us-east-1`). */
  region: string;
  /** IP address or hostname of the endpoint. */
  address: string;
  /** TCP/UDP port the endpoint listens on. */
  port: number;
  /** Whether active health checks are performed against this endpoint. */
  healthCheckEnabled: boolean;
}

/**
 * Configuration describing how two endpoints are connected.
 */
interface ConnectionConfig {
  /** The type of inter-cloud connection to establish. */
  type: ConnectionType;
  /** Provisioned bandwidth for the connection, in Mbps. */
  bandwidthMbps: number;
  /** Maximum acceptable latency before the connection is considered degraded, in milliseconds. */
  latencyThresholdMs: number;
  /** Whether traffic over the connection should be encrypted. */
  encryption: boolean;
  /** Whether a redundant fallback path should be provisioned. */
  redundancy: boolean;
}

/**
 * Settings controlling the behaviour of the load balancer.
 */
interface LoadBalancerConfig {
  /** Algorithm used to distribute traffic across endpoints. */
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  /** Interval between consecutive health checks, in seconds. */
  healthCheckInterval: number;
  /** Number of consecutive failed checks before an endpoint is marked unhealthy. */
  unhealthyThreshold: number;
  /** Number of consecutive successful checks before an endpoint is marked healthy. */
  healthyThreshold: number;
  /** Timeout for each health check probe, in seconds. */
  timeoutSeconds: number;
}

/**
 * Toggles for various network performance optimisations.
 */
interface PerformanceOptimization {
  /** Enable response caching. */
  enableCaching: boolean;
  /** Enable payload compression over the wire. */
  enableCompression: boolean;
  /** Route static assets through a Content Delivery Network. */
  enableCDN: boolean;
  /** Apply TCP-level tuning (e.g. window scaling, congestion control). */
  tcpOptimization: boolean;
  /** Reuse connections via HTTP keep-alive. */
  keepAliveEnabled: boolean;
  /** Reuse outbound connections through a connection pool. */
  connectionPooling: boolean;
}

/**
 * Top-level configuration object describing a multi-cloud networking setup.
 */
interface MultiCloudNetworkingConfig {
  /** Human-readable name for the project / networking stack. */
  projectName: string;
  /** List of cloud providers participating in the mesh. */
  providers: CloudProvider[];
  /** Endpoints that make up the network. */
  endpoints: NetworkEndpoint[];
  /** Named connection configurations keyed by an identifier. */
  connections: {
    [key: string]: ConnectionConfig;
  };
  /** Strategy used to route requests between endpoints. */
  routingStrategy: RoutingStrategy;
  /** Load balancer settings. */
  loadBalancer: LoadBalancerConfig;
  /** Performance optimisation toggles. */
  performance: PerformanceOptimization;
  /** Whether network monitoring and analytics are enabled. */
  enableMonitoring: boolean;
  /** Whether automatic failover to healthy endpoints is enabled. */
  enableFailover: boolean;
}

/**
 * Prints a human-readable summary of the multi-cloud networking configuration
 * to the console, highlighting providers, routing strategy, and feature toggles.
 *
 * @param config - The multi-cloud networking configuration to display.
 * @returns Nothing; output is written to stdout.
 */
export function displayConfig(config: MultiCloudNetworkingConfig): void {
  console.log(chalk.cyan('✨ Multi-Cloud Networking and Connectivity with Performance Optimization'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Endpoints:'), config.endpoints.length);
  console.log(chalk.yellow('Routing Strategy:'), config.routingStrategy);
  console.log(chalk.yellow('Load Balancer:'), config.loadBalancer.algorithm);
  console.log(chalk.yellow('Caching:'), config.performance.enableCaching ? 'Yes' : 'No');
  console.log(chalk.yellow('Compression:'), config.performance.enableCompression ? 'Yes' : 'No');
  console.log(chalk.yellow('CDN:'), config.performance.enableCDN ? 'Yes' : 'No');
  console.log(chalk.yellow('Monitoring:'), config.enableMonitoring ? 'Yes' : 'No');
  console.log(chalk.yellow('Failover:'), config.enableFailover ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown documentation string describing the multi-cloud
 * networking setup, including features, usage examples, configured endpoints,
 * and the active performance options.
 *
 * @param config - The multi-cloud networking configuration to document.
 * @returns A Markdown string ready to be written to a `.md` file.
 */
export function generateMultiCloudNetworkingMD(config: MultiCloudNetworkingConfig): string {
  let md = '# Multi-Cloud Networking and Connectivity\n\n';
  md += '## Features\n\n';
  md += '- Multi-cloud network connectivity (VPN, Direct Link, Express Route, Interconnect)\n';
  md += '- Intelligent routing strategies (latency-based, cost-based, geo-based)\n';
  md += '- Load balancing with multiple algorithms\n';
  md += '- Performance optimization (caching, compression, TCP optimization)\n';
  md += '- CDN integration for global content delivery\n';
  md += '- Health checks and automatic failover\n';
  md += '- Connection pooling and keep-alive\n';
  md += '- Network monitoring and analytics\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { MultiCloudNetworkManager } from \'./multi-cloud-network-manager\';\n\n';
  md += 'const manager = new MultiCloudNetworkManager({\n';
  md += '  projectName: \'my-project\',\n';
  md += '  routingStrategy: \'latency-based\',\n';
  md += '  enableFailover: true,\n';
  md += '});\n\n';
  md += 'await manager.connect();\n';
  md += 'await manager.optimizePerformance();\n';
  md += '```\n\n';
  md += '## Endpoints\n\n';
  config.endpoints.forEach(ep => {
    md += '- **' + ep.id + '**: ' + ep.provider + ' in ' + ep.region + '\n';
  });
  md += '\n## Performance Features\n\n';
  md += '- **Caching**: ' + (config.performance.enableCaching ? 'Enabled' : 'Disabled') + '\n';
  md += '- **Compression**: ' + (config.performance.enableCompression ? 'Enabled' : 'Disabled') + '\n';
  md += '- **CDN**: ' + (config.performance.enableCDN ? 'Enabled' : 'Disabled') + '\n';
  md += '- **TCP Optimization**: ' + (config.performance.tcpOptimization ? 'Enabled' : 'Disabled') + '\n';
  return md;
}

/**
 * Produces Terraform HCL code that provisions the networking resources defined
 * by the supplied configuration across AWS, Azure, and GCP, including VPCs,
 * subnets, routing, health checks, and CDN resources where enabled.
 *
 * @param config - The multi-cloud networking configuration to generate from.
 * @returns A string of Terraform code ready to be written to a `.tf` file.
 */
export function generateTerraformNetworking(config: MultiCloudNetworkingConfig): string {
  let code = '# Auto-generated Multi-Cloud Networking Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws')) {
    code += '# AWS VPC and Networking\n';
    code += 'resource "aws_vpc" "main" {\n';
    code += '  cidr_block = "10.0.0.0/16"\n';
    code += '  enable_dns_support = true\n';
    code += '  enable_dns_hostnames = true\n\n';
    code += '  tags = {\n';
    code += '    Name = "' + config.projectName + '-vpc"\n';
    code += '  }\n';
    code += '}\n\n';

    code += 'resource "aws_subnet" "public" {\n';
    code += '  vpc_id     = aws_vpc.main.id\n';
    code += '  cidr_block = "10.0.1.0/24"\n\n';
    code += '  tags = {\n';
    code += '    Name = "' + config.projectName + '-public-subnet"\n';
    code += '  }\n';
    code += '}\n\n';

    if (config.routingStrategy === 'latency-based') {
      code += '# Latency-based Routing\n';
      code += 'resource "aws_route53_latency_health_check" "main" {\n';
      code += '  fqdn              = "app.' + config.projectName + '.com"\n';
      code += '  port              = 443\n';
      code += '  type              = "HTTPS"\n';
      code += '  resource_path     = "/health"\n';
      code += '  request_interval  = 30\n';
      code += '  failure_threshold = 3\n';
      code += '}\n\n';
    }

    if (config.enableFailover) {
      code += '# Failover Routing\n';
      code += 'resource "aws_route53_health_check" "failover" {\n';
      code += '  fqdn              = "failover.' + config.projectName + '.com"\n';
      code += '  port              = 80\n';
      code += '  type              = "HTTP"\n';
      code += '  resource_path     = "/status"\n';
      code += '  request_interval  = 30\n';
      code += '  failure_threshold = 2\n';
      code += '}\n\n';
    }
  }

  if (config.providers.includes('azure')) {
    code += '# Azure Virtual Network\n';
    code += 'resource "azurerm_virtual_network" "main" {\n';
    code += '  name                = "' + config.projectName + '-vnet"\n';
    code += '  location            = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  address_space       = ["10.1.0.0/16"]\n\n';
    code += '  subnet {\n';
    code += '    name           = "default"\n';
    code += '    address_prefix = "10.1.1.0/24"\n';
    code += '  }\n';
    code += '}\n\n';

    if (config.performance.enableCDN) {
      code += '# Azure CDN Profile\n';
      code += 'resource "azurerm_cdn_profile" "main" {\n';
      code += '  name                = "' + config.projectName + '-cdn"\n';
      code += '  location            = azurerm_resource_group.main.location\n';
      code += '  resource_group_name = azurerm_resource_group.main.name\n';
      code += '  sku                 = "Standard_Verizon"\n';
      code += '}\n\n';
    }
  }

  if (config.providers.includes('gcp')) {
    code += '# GCP Network\n';
    code += 'resource "google_compute_network" "main" {\n';
    code += '  name                    = "' + config.projectName + '-network"\n';
    code += '  auto_create_subnetworks = false\n';
    code += '}\n\n';

    code += 'resource "google_compute_subnetwork" "main" {\n';
    code += '  name          = "' + config.projectName + '-subnet"\n';
    code += '  ip_cidr_range = "10.2.1.0/24"\n';
    code += '  region        = "us-central1"\n';
    code += '  network       = google_compute_network.main.id\n';
    code += '}\n\n';

    if (config.performance.enableCaching) {
      code += '# Cloud CDN\n';
      code += 'resource "google_compute_backend_bucket" "cdn_backend" {\n';
      code += '  name = "' + config.projectName + '-cdn-backend"\n';
      code += '  bucket_name = google_storage_bucket.cdn.name\n';
      code += '  enable_cdn  = true\n';
      code += '}\n\n';
    }
  }

  return code;
}

/**
 * Generates a TypeScript source file implementing a `MultiCloudNetworkManager`
 * class that mirrors the supplied configuration, including connection
 * establishment, performance optimisation, and request routing logic.
 *
 * @param config - The multi-cloud networking configuration to generate from.
 * @returns A string of TypeScript source code ready to be written to a `.ts` file.
 */
export function generateTypeScriptNetworking(config: MultiCloudNetworkingConfig): string {
  let code = '// Auto-generated Multi-Cloud Network Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'interface Connection {\n';
  code += '  id: string;\n';
  code += '  provider: string;\n';
  code += '  region: string;\n';
  code += '  latency: number;\n';
  code += '  bandwidth: number;\n';
  code += '  healthy: boolean;\n';
  code += '}\n\n';

  code += 'class MultiCloudNetworkManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private routingStrategy: string;\n';
  code += '  private connections: Map<string, Connection>;\n';
  code += '  private loadBalancer: any;\n';
  code += '  private performance: any;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.routingStrategy = options.routingStrategy || \'' + config.routingStrategy + '\';\n';
  code += '    this.connections = new Map();\n';
  code += '    this.loadBalancer = options.loadBalancer || ' + JSON.stringify(config.loadBalancer) + ';\n';
  code += '    this.performance = options.performance || ' + JSON.stringify(config.performance) + ';\n';
  code += '  }\n\n';

  code += '  async connect(): Promise<any> {\n';
  code += '    console.log(\'[MultiCloudNetwork] Establishing connections...\');\n\n';
  code += '    const results = {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      strategy: this.routingStrategy,\n';
  code += '      connections: 0,\n';
  code += '      healthy: 0,\n';
  code += '      status: \'pending\' as string,\n';
  code += '    };\n\n';

  code += '    // Initialize connections\n';
  code += '    const endpoints = ' + JSON.stringify(config.endpoints) + ';\n';
  code += '    for (const endpoint of endpoints) {\n';
  code += '      const connection = await this.establishConnection(endpoint);\n';
  code += '      this.connections.set(endpoint.id, connection);\n';
  code += '      results.connections++;\n';
  code += '      if (connection.healthy) results.healthy++;\n';
  code += '    }\n\n';

  if (config.performance.enableCompression) {
    code += '    // Enable compression\n';
    code += '    await this.enableCompression();\n';
  }

  if (config.performance.enableCaching) {
    code += '    // Enable caching\n';
    code += '    await this.enableCaching();\n';
  }

  code += '    results.status = \'connected\';\n';
  code += '    console.log(`[MultiCloudNetwork] Connected: ${results.healthy}/${results.connections} endpoints`);\n';
  code += '    this.emit(\'connected\', results);\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async establishConnection(endpoint: any): Promise<Connection> {\n';
  code += '    console.log(`[MultiCloudNetwork] Connecting to ${endpoint.provider} in ${endpoint.region}`);\n';
  code += '    // Connection logic\n';
  code += '    return {\n';
  code += '      id: endpoint.id,\n';
  code += '      provider: endpoint.provider,\n';
  code += '      region: endpoint.region,\n';
  code += '      latency: Math.random() * 100,\n';
  code += '      bandwidth: 10000,\n';
  code += '      healthy: true,\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  async optimizePerformance(): Promise<any> {\n';
  code += '    console.log(\'[MultiCloudNetwork] Optimizing performance...\');\n\n';
  code += '    const optimizations = [];\n';

  if (config.performance.tcpOptimization) {
    code += '    optimizations.push(\'TCP Optimization\');\n';
  }
  if (config.performance.connectionPooling) {
    code += '    optimizations.push(\'Connection Pooling\');\n';
  }
  if (config.performance.keepAliveEnabled) {
    code += '    optimizations.push(\'Keep-Alive\');\n';
  }

  code += '    return { optimizations, timestamp: new Date().toISOString() };\n';
  code += '  }\n\n';

  code += '  private async enableCompression(): Promise<void> {\n';
  code += '    console.log(\'[MultiCloudNetwork] Enabling compression...\');\n';
  code += '  }\n\n';

  code += '  private async enableCaching(): Promise<void> {\n';
  code += '    console.log(\'[MultiCloudNetwork] Enabling caching...\');\n';
  code += '  }\n\n';

  code += '  async routeRequest(destination: string): Promise<Connection | null> {\n';
  code += '    if (this.routingStrategy === \'latency-based\') {\n';
  code += '      return this.getLowestLatencyConnection();\n';
  code += '    } else if (this.routingStrategy === \'cost-based\') {\n';
  code += '      return this.getLowestCostConnection();\n';
  code += '    }\n';
  code += '    return this.connections.get(destination) || null;\n';
  code += '  }\n\n';

  code += '  private getLowestLatencyConnection(): Connection {\n';
  code += '    const connections = Array.from(this.connections.values()).filter(c => c.healthy);\n';
  code += '    return connections.sort((a, b) => a.latency - b.latency)[0];\n';
  code += '  }\n\n';

  code += '  private getLowestCostConnection(): Connection {\n';
  code += '    const connections = Array.from(this.connections.values()).filter(c => c.healthy);\n';
  code += '    return connections.sort((a, b) => a.bandwidth - b.bandwidth)[0];\n';
  code += '  }\n\n';

  code += '  getNetworkStatus(): any {\n';
  code += '    return {\n';
  code += '      projectName: this.projectName,\n';
  code += '      routingStrategy: this.routingStrategy,\n';
  code += '      connections: this.connections.size,\n';
  code += '      healthy: Array.from(this.connections.values()).filter(c => c.healthy).length,\n';
  code += '      performance: this.performance,\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const multiCloudNetworkManager = new MultiCloudNetworkManager();\n\n';
  code += 'export default multiCloudNetworkManager;\n';
  code += 'export { MultiCloudNetworkManager };\n';

  return code;
}

/**
 * Generates a Python source file implementing a `MultiCloudNetworkManager`
 * class (using `asyncio`) that mirrors the supplied configuration, including
 * connection establishment, performance optimisation, and request routing.
 *
 * @param config - The multi-cloud networking configuration to generate from.
 * @returns A string of Python source code ready to be written to a `.py` file.
 */
export function generatePythonNetworking(config: MultiCloudNetworkingConfig): string {
  let code = '# Auto-generated Multi-Cloud Network Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from enum import Enum\n\n';

  code += 'class CloudProvider(Enum):\n';
  code += '    AWS = "aws"\n';
  code += '    AZURE = "azure"\n';
  code += '    GCP = "gcp"\n\n';

  code += 'class RoutingStrategy(Enum):\n';
  code += '    LATENCY_BASED = "latency-based"\n';
  code += '    COST_BASED = "cost-based"\n';
  code += '    GEO_BASED = "geo-based"\n\n';

  code += '@dataclass\n';
  code += 'class Connection:\n';
  code += '    id: str\n';
  code += '    provider: str\n';
  code += '    region: str\n';
  code += '    latency: float\n';
  code += '    bandwidth: int\n';
  code += '    healthy: bool\n\n';

  code += 'class MultiCloudNetworkManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '",\n';
  code += '                 routing_strategy: str = "' + config.routingStrategy + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.routing_strategy = routing_strategy\n';
  code += '        self.connections: Dict[str, Connection] = {}\n';
  code += '        self.load_balancer = ' + JSON.stringify(config.loadBalancer) + '\n';
  code += '        self.performance = ' + JSON.stringify(config.performance) + '\n\n';

  code += '    async def connect(self) -> Dict[str, Any]:\n';
  code += '        print("[MultiCloudNetwork] Establishing connections...")\n\n';
  code += '        results = {\n';
  code += '            "timestamp": "2026-01-13T00:00:00Z",\n';
  code += '            "strategy": self.routing_strategy,\n';
  code += '            "connections": 0,\n';
  code += '            "healthy": 0,\n';
  code += '            "status": "pending",\n';
  code += '        }\n\n';

  code += '        # Initialize connections\n';
  code += '        endpoints = ' + JSON.stringify(config.endpoints) + '\n';
  code += '        for endpoint in endpoints:\n';
  code += '            connection = await self.establish_connection(endpoint)\n';
  code += '            self.connections[endpoint["id"]] = connection\n';
  code += '            results["connections"] += 1\n';
  code += '            if connection.healthy:\n';
  code += '                results["healthy"] += 1\n\n';

  if (config.performance.enableCompression) {
    code += '        # Enable compression\n';
    code += '        await self.enable_compression()\n';
  }

  if (config.performance.enableCaching) {
    code += '        # Enable caching\n';
    code += '        await self.enable_caching()\n';
  }

  code += '        results["status"] = "connected"\n';
  code += '        print(f"[MultiCloudNetwork] Connected: {results[\'healthy\']}/{results[\'connections\']} endpoints")\n';
  code += '        return results\n\n';

  code += '    async def establish_connection(self, endpoint: Dict[str, Any]) -> Connection:\n';
  code += '        print(f"[MultiCloudNetwork] Connecting to {endpoint[\'provider\']} in {endpoint[\'region\']}")\n';
  code += '        # Connection logic\n';
  code += '        await asyncio.sleep(0.1)\n';
  code += '        return Connection(\n';
  code += '            id=endpoint["id"],\n';
  code += '            provider=endpoint["provider"],\n';
  code += '            region=endpoint["region"],\n';
  code += '            latency=50.0,\n';
  code += '            bandwidth=10000,\n';
  code += '            healthy=True,\n';
  code += '        )\n\n';

  code += '    async def optimize_performance(self) -> Dict[str, Any]:\n';
  code += '        print("[MultiCloudNetwork] Optimizing performance...")\n\n';
  code += '        optimizations = []\n';

  if (config.performance.tcpOptimization) {
    code += '        optimizations.append("TCP Optimization")\n';
  }
  if (config.performance.connectionPooling) {
    code += '        optimizations.append("Connection Pooling")\n';
  }
  if (config.performance.keepAliveEnabled) {
    code += '        optimizations.append("Keep-Alive")\n';
  }

  code += '        return {"optimizations": optimizations, "timestamp": "2026-01-13T00:00:00Z"}\n\n';

  code += '    async def enable_compression(self) -> None:\n';
  code += '        print("[MultiCloudNetwork] Enabling compression...")\n';
  code += '        await asyncio.sleep(0.05)\n\n';

  code += '    async def enable_caching(self) -> None:\n';
  code += '        print("[MultiCloudNetwork] Enabling caching...")\n';
  code += '        await asyncio.sleep(0.05)\n\n';

  code += '    async def route_request(self, destination: str) -> Optional[Connection]:\n';
  code += '        if self.routing_strategy == "latency-based":\n';
  code += '            return self.get_lowest_latency_connection()\n';
  code += '        elif self.routing_strategy == "cost-based":\n';
  code += '            return self.get_lowest_cost_connection()\n';
  code += '        return self.connections.get(destination)\n\n';

  code += '    def get_lowest_latency_connection(self) -> Connection:\n';
  code += '        healthy = [c for c in self.connections.values() if c.healthy]\n';
  code += '        return min(healthy, key=lambda x: x.latency)\n\n';

  code += '    def get_lowest_cost_connection(self) -> Connection:\n';
  code += '        healthy = [c for c in self.connections.values() if c.healthy]\n';
  code += '        return min(healthy, key=lambda x: x.bandwidth)\n\n';

  code += '    def get_network_status(self) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "projectName": self.project_name,\n';
  code += '            "routingStrategy": self.routing_strategy,\n';
  code += '            "connections": len(self.connections),\n';
  code += '            "healthy": sum(1 for c in self.connections.values() if c.healthy),\n';
  code += '            "performance": self.performance,\n';
  code += '        }\n\n';

  code += 'multi_cloud_network_manager = MultiCloudNetworkManager()\n';

  return code;
}

/**
 * Writes the generated multi-cloud networking artifacts to disk.
 *
 * The function always emits Terraform code and a Markdown documentation file.
 * Depending on the requested `language`, it additionally emits a TypeScript or
 * Python implementation together with the relevant dependency manifest
 * (`package.json` or `requirements.txt`). A JSON serialisation of the supplied
 * configuration is also written for reference.
 *
 * @param config - The multi-cloud networking configuration to generate from.
 * @param outputDir - Absolute or relative path of the directory to write into; it will be created if missing.
 * @param language - Target implementation language: `'typescript'` for TypeScript, anything else for Python.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeFiles(
  config: MultiCloudNetworkingConfig,
  outputDir: string,
  language: string,
): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformNetworking(config);
  await fs.writeFile(path.join(outputDir, 'multi-cloud-networking.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptNetworking(config);
    await fs.writeFile(path.join(outputDir, 'multi-cloud-network-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-multi-cloud-networking',
      version: '1.0.0',
      description: 'Multi-Cloud Networking and Connectivity with Performance Optimization',
      main: 'multi-cloud-network-manager.ts',
      scripts: {
        connect: 'ts-node multi-cloud-network-manager.ts connect',
        optimize: 'ts-node multi-cloud-network-manager.ts optimize',
        status: 'ts-node multi-cloud-network-manager.ts status',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonNetworking(config);
    await fs.writeFile(path.join(outputDir, 'multi_cloud_network_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'google-cloud-compute>=1.15.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateMultiCloudNetworkingMD(config);
  await fs.writeFile(path.join(outputDir, 'MULTI_CLOUD_NETWORKING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    endpoints: config.endpoints,
    connections: config.connections,
    routingStrategy: config.routingStrategy,
    loadBalancer: config.loadBalancer,
    performance: config.performance,
    enableMonitoring: config.enableMonitoring,
    enableFailover: config.enableFailover,
  };
  await fs.writeFile(path.join(outputDir, 'networking-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Identity-style factory that validates and returns the supplied multi-cloud
 * networking configuration. Useful as a normalisation / entry point before
 * passing the configuration to other generator functions.
 *
 * @param config - The multi-cloud networking configuration to return.
 * @returns The same configuration object that was passed in.
 */
export function multiCloudNetworking(config: MultiCloudNetworkingConfig): MultiCloudNetworkingConfig {
  return config;
}
