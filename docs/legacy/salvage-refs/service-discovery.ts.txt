import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Service Discovery Generation
 *
 * Generate service discovery mechanisms with health checks,
 * registration, and load balancing across multiple platforms.
 */

export interface ServiceDefinition {
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'grpc' | 'ws';
  healthCheck: HealthCheck;
  metadata: Record<string, string>;
  tags: string[];
}

export interface HealthCheck {
  enabled: boolean;
  path: string;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

export interface ServiceRegistry {
  services: ServiceDefinition[];
  registryType: 'consul' | 'etcd' | 'zookeeper' | 'eureka' | 'redis';
}

export interface ServiceDiscoveryIntegration {
  platform: string;
  serviceCode: string;
  discoveryCode: string;
  healthCheckCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate service registry
 */
export async function generateServiceRegistry(
  services: ServiceDefinition[],
  registryType: ServiceRegistry['registryType'],
  projectPath: string = process.cwd()
): Promise<ServiceRegistry> {
  const registry: ServiceRegistry = {
    services,
    registryType,
  };

  return registry;
}

/**
 * Generate default service definitions
 */
export function generateServiceDefinitions(serviceName: string): ServiceDefinition[] {
  const normalizedName = toSnakeCase(serviceName);

  return [
    {
      name: serviceName,
      version: '1.0.0',
      host: 'localhost',
      port: 3000,
      protocol: 'http',
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: 10000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      },
      metadata: {
        environment: 'development',
        framework: 'express',
      },
      tags: ['api', 'rest', `${normalizedName}`],
    },
  ];
}

/**
 * Generate service discovery integration for language
 */
export async function generateServiceDiscoveryIntegration(
  registry: ServiceRegistry,
  language: string
): Promise<ServiceDiscoveryIntegration> {
  if (registry.registryType === 'consul') {
    return generateConsulIntegration(registry, language);
  } else if (registry.registryType === 'etcd') {
    return generateEtcdIntegration(registry, language);
  } else if (registry.registryType === 'redis') {
    return generateRedisDiscoveryIntegration(registry, language);
  } else {
    return generateGenericDiscoveryIntegration(registry, language);
  }
}

/**
 * Generate Consul integration
 */
function generateConsulIntegration(registry: ServiceRegistry, language: string): ServiceDiscoveryIntegration {
  switch (language) {
    case 'typescript':
      return generateTypeScriptConsul(registry);
    case 'python':
      return generatePythonConsul(registry);
    case 'go':
      return generateGoConsul(registry);
    default:
      return generateGenericDiscoveryIntegration(registry, language);
  }
}

function generateTypeScriptConsul(registry: ServiceRegistry): ServiceDiscoveryIntegration {
  return {
    platform: 'consul',
    serviceCode: generateTypeScriptConsulService(registry),
    discoveryCode: generateTypeScriptConsulDiscovery(registry),
    healthCheckCode: generateTypeScriptHealthCheck(registry),
    dependencies: ['consul'],
    buildInstructions: [
      'npm install consul',
      'Start Consul: docker-compose up -d consul',
      'Start service: npm run start',
      'Check Consul UI: http://localhost:8500',
    ],
  };
}

function generateTypeScriptConsulService(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `import Consul from 'consul';

export interface ServiceConfig {
  name: string;
  address: string;
  port: number;
  check: {
    http: string;
    interval: string;
    timeout: string;
    deregister_critical_service_after: string;
  };
  tags: string[];
  meta: Record<string, string>;
}

export class ConsulServiceRegistration {
  private consul: Consul.Consul;
  private serviceId: string;
  private config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: parseInt(process.env.CONSUL_PORT || '8500'),
    });

    this.config = config;
    this.serviceId = \`\${config.name}-\${config.port}\`;
  }

  async register(): Promise<void> {
    try {
      await this.consul.agent.service.register({
        id: this.serviceId,
        name: this.config.name,
        address: this.config.address,
        port: this.config.port,
        check: this.config.check,
        tags: this.config.tags,
        meta: this.config.meta,
      });

      console.log(\`Service \${this.config.name} registered with Consul (ID: \${this.serviceId})\`);
    } catch (error) {
      console.error('Failed to register service:', error);
      throw error;
    }
  }

  async deregister(): Promise<void> {
    try {
      await this.consul.agent.service.deregister(this.serviceId);
      console.log(\`Service \${this.serviceId} deregistered from Consul\`);
    } catch (error) {
      console.error('Failed to deregister service:', error);
      throw error;
    }
  }

  async startHealthCheck(): void {
    // Health check endpoint is handled by the service
    console.log('Health check endpoint enabled');
  }
}

// Usage example
async function main() {
  const config: ServiceConfig = {
    name: '${service?.name || 'my-service'}',
    address: '${service?.host || 'localhost'}',
    port: ${service?.port || 3000},
    check: {
      http: 'http://${service?.host || 'localhost'}:${service?.port || 3000}${service?.healthCheck.path || '/health'}',
      interval: '${service?.healthCheck.interval || 10000}ms',
      timeout: '${service?.healthCheck.timeout || 5000}ms',
      deregister_critical_service_after: '30s',
    },
    tags: [${(service?.tags || []).map(t => `'${t}'`).join(', ')}],
    meta: ${JSON.stringify(service?.metadata || {})},
  };

  const registration = new ConsulServiceRegistration(config);

  // Register service
  await registration.register();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\nDeregistering service...');
    await registration.deregister();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptConsulDiscovery(registry: ServiceRegistry): string {
  return `import Consul from 'consul';

export interface ServiceInstance {
  id: string;
  name: string;
  address: string;
  port: number;
  tags: string[];
  meta: Record<string, string>;
}

export class ConsulServiceDiscovery {
  private consul: Consul.Consul;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: parseInt(process.env.CONSUL_PORT || '8500'),
    });
  }

  async discoverService(serviceName: string): Promise<ServiceInstance[]> {
    try {
      const result = await this.consul.health.service(serviceName, { passing: true });

      const instances: ServiceInstance[] = result.map((entry: any) => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        address: entry.Service.Address || entry.Node.Address,
        port: entry.Service.Port,
        tags: entry.Service.Tags || [],
        meta: entry.Service.Meta || {},
      }));

      console.log(\`Found \${instances.length} healthy instances of \${serviceName}\`);
      return instances;
    } catch (error) {
      console.error(\`Failed to discover service \${serviceName}:\`, error);
      return [];
    }
  }

  async discoverAllServices(): Promise<Record<string, ServiceInstance[]>> {
    try {
      const services = await this.consul.catalog.service.list();
      const result: Record<string, ServiceInstance[]> = {};

      for (const serviceName of Object.keys(services)) {
        result[serviceName] = await this.discoverService(serviceName);
      }

      return result;
    } catch (error) {
      console.error('Failed to discover services:', error);
      return {};
    }
  }

  async watchService(
    serviceName: string,
    callback: (instances: ServiceInstance[]) => void
  ): Promise<void> {
    const options = {
      method: this.consul.health.service,
      params: { serviceName, passing: true },
    };

    const watch = this.consul.watch(options);

    watch.on('change', (data: any) => {
      const instances: ServiceInstance[] = data.map((entry: any) => ({
        id: entry.Service.ID,
        name: entry.Service.Service,
        address: entry.Service.Address || entry.Node.Address,
        port: entry.Service.Port,
        tags: entry.Service.Tags || [],
        meta: entry.Service.Meta || {},
      }));

      callback(instances);
    });

    console.log(\`Watching service \${serviceName} for changes...\`);
  }
}

// Usage example
async function main() {
  const discovery = new ConsulServiceDiscovery();

  // Discover service
  const instances = await discovery.discoverService('${registry.services[0]?.name || 'my-service'}');
  console.log('Service instances:', instances);

  // Watch for changes
  discovery.watchService('${registry.services[0]?.name || 'my-service'}', (instances) => {
    console.log(\`Service instances updated: \${instances.length} instances\`);
  });
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptHealthCheck(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `import express from 'express';

const app = express();
const PORT = process.env.PORT || ${service?.port || 3000};

// Health check endpoint
app.get('${service?.healthCheck.path || '/health'}', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'healthy',
      redis: 'healthy',
      external_api: 'healthy',
    },
  };

  // Add custom health checks
  // TODO: Implement actual health checks for dependencies

  res.status(200).json(health);
});

// Ready check endpoint (for Kubernetes)
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

// Live check endpoint (for Kubernetes)
app.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.listen(PORT, () => {
  console.log(\`Service listening on port \${PORT}\`);
  console.log(\`Health check available at http://localhost:\${PORT}${service?.healthCheck.path || '/health'}\`);
});

export default app;
`;
}

function generatePythonConsul(registry: ServiceRegistry): ServiceDiscoveryIntegration {
  return {
    platform: 'consul',
    serviceCode: generatePythonConsulService(registry),
    discoveryCode: generatePythonConsulDiscovery(registry),
    healthCheckCode: generatePythonHealthCheck(registry),
    dependencies: ['python-consul'],
    buildInstructions: [
      'pip install python-consul',
      'Start Consul: docker-compose up -d consul',
      'Start service: python service.py',
      'Check Consul UI: http://localhost:8500',
    ],
  };
}

function generatePythonConsulService(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `import consul
import asyncio
import os

class ConsulServiceRegistration:
    def __init__(self, service_name, service_port, service_host='localhost'):
        self.consul = consul.Consul(
            host=os.environ.get('CONSUL_HOST', 'localhost'),
            port=int(os.environ.get('CONSUL_PORT', '8500'))
        )

        self.service_id = f"{service_name}-{service_port}"
        self.service_name = service_name
        self.service_port = service_port
        self.service_host = service_host

    async def register(self):
        try:
            self.consul.agent.service.register(
                name=self.service_name,
                service_id=self.service_id,
                address=self.service_host,
                port=self.service_port,
                check=consul.Check.http(
                    f"http://{self.service_host}:{self.service_port}${service?.healthCheck.path || '/health'}",
                    interval="${service?.healthCheck.interval || 10}s",
                    timeout="${service?.healthCheck.timeout || 5}s",
                    deregister="${service?.healthCheck.unhealthyThreshold * service?.healthCheck.interval || 30}s"
                ),
                tags=[${(service?.tags || []).map(t => `'${t}'`).join(', ')}],
                meta=${JSON.stringify(service?.metadata || {})}
            )
            print(f"Service {self.service_name} registered with Consul (ID: {self.service_id})")
        except Exception as error:
            print(f"Failed to register service: {error}")
            raise

    async def deregister(self):
        try:
            self.consul.agent.service.deregister(self.service_id)
            print(f"Service {self.service_id} deregistered from Consul")
        except Exception as error:
            print(f"Failed to deregister service: {error}")
            raise

async def main():
    registration = ConsulServiceRegistration(
        service_name='${service?.name || 'my-service'}',
        service_port=${service?.port || 3000},
        service_host='${service?.host || 'localhost'}'
    )

    await registration.register()

    # Handle graceful shutdown
    import signal
    import sys

    def signal_handler(sig, frame):
        print('\\nDeregistering service...')
        asyncio.run(registration.deregister())
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    # Keep service running
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
`;
}

function generatePythonConsulDiscovery(registry: ServiceRegistry): string {
  return `import consul
import os

class ConsulServiceDiscovery:
    def __init__(self):
        self.consul = consul.Consul(
            host=os.environ.get('CONSUL_HOST', 'localhost'),
            port=int(os.environ.get('CONSUL_PORT', '8500'))
        )

    def discover_service(self, service_name):
        try:
            _, services = self.consul.health.service(service_name, passing=True)

            instances = [
                {
                    'id': s['Service']['ID'],
                    'name': s['Service']['Service'],
                    'address': s['Service']['Address'] or s['Node']['Address'],
                    'port': s['Service']['Port'],
                    'tags': s['Service'].get('Tags', []),
                    'meta': s['Service'].get('Meta', {}),
                }
                for s in services
            ]

            print(f"Found {len(instances)} healthy instances of {service_name}")
            return instances
        except Exception as error:
            print(f"Failed to discover service {service_name}: {error}")
            return []

    def discover_all_services(self):
        try:
            _, services = self.consul.catalog.services()
            result = {}

            for service_name in services.keys():
                result[service_name] = self.discover_service(service_name)

            return result
        except Exception as error:
            print(f"Failed to discover services: {error}")
            return {}

def main():
    discovery = ConsulServiceDiscovery()

    # Discover service
    instances = discovery.discover_service('${registry.services[0]?.name || 'my-service'}')
    print("Service instances:", instances)

if __name__ == '__main__':
    main()
`;
}

function generatePythonHealthCheck(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `from flask import Flask, jsonify
from datetime import datetime
import time

app = Flask(__name__)
start_time = time.time()

@app.route('${service?.healthCheck.path || '/health'}')
def health_check():
    health = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime': time.time() - start_time,
        'checks': {
            'database': 'healthy',
            'redis': 'healthy',
            'external_api': 'healthy',
        }
    }

    # TODO: Implement actual health checks
    return jsonify(health), 200

@app.route('/ready')
def ready_check():
    return jsonify({'status': 'ready'}), 200

@app.route('/live')
def live_check():
    return jsonify({'status': 'alive'}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', ${service?.port || 3000}))
    app.run(host='0.0.0.0', port=port)
`;
}

function generateGoConsul(registry: ServiceRegistry): ServiceDiscoveryIntegration {
  return {
    platform: 'consul',
    serviceCode: generateGoConsulService(registry),
    discoveryCode: generateGoConsulDiscovery(registry),
    healthCheckCode: generateGoHealthCheck(registry),
    dependencies: [
      'github.com/hashicorp/consul/api',
    ],
    buildInstructions: [
      'go get github.com/hashicorp/consul/api',
      'Start Consul: docker-compose up -d consul',
      'Start service: go run service.go',
      'Check Consul UI: http://localhost:8500',
    ],
  };
}

function generateGoConsulService(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `package main

import (
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    consulapi "github.com/hashicorp/consul/api"
)

type ServiceConfig struct {
    Name    string
    Address string
    Port    int
    Tags    []string
    Meta    map[string]string
}

type ConsulServiceRegistration struct {
    consul   *consulapi.Client
    serviceID string
    config   ServiceConfig
}

func NewConsulServiceRegistration(config ServiceConfig) *ConsulServiceRegistration {
    consul, err := consulapi.NewClient(consulapi.DefaultConfig())
    if err != nil {
        log.Fatal(err)
    }

    serviceID := fmt.Sprintf("%s-%d", config.Name, config.Port)

    return &ConsulServiceRegistration{
        consul:    consul,
        serviceID: serviceID,
        config:    config,
    }
}

func (r *ConsulServiceRegistration) Register() error {
    registration := &consulapi.AgentServiceRegistration{
        ID:      r.serviceID,
        Name:    r.config.Name,
        Address: r.config.Address,
        Port:    r.config.Port,
        Check: &consulapi.AgentServiceCheck{
            HTTP:                           fmt.Sprintf("http://%s:%d${service?.healthCheck.path || '/health'}", r.config.Address, r.config.Port),
            Interval:                       "${service?.healthCheck.interval || 10}s",
            Timeout:                        "${service?.healthCheck.timeout || 5}s",
            DeregisterCriticalServiceAfter: "30s",
        },
        Tags: r.config.Tags,
        Meta: r.config.Meta,
    }

    err := r.consul.Agent().ServiceRegister(registration)
    if err != nil {
        return fmt.Errorf("failed to register service: %w", err)
    }

    log.Printf("Service %s registered with Consul (ID: %s)", r.config.Name, r.serviceID)
    return nil
}

func (r *ConsulServiceRegistration) Deregister() error {
    err := r.consul.Agent().ServiceDeregister(r.serviceID)
    if err != nil {
        return fmt.Errorf("failed to deregister service: %w", err)
    }

    log.Printf("Service %s deregistered from Consul", r.serviceID)
    return nil
}

func main() {
    config := ServiceConfig{
        Name:    "${service?.name || 'my-service'}",
        Address: "${service?.host || 'localhost'}",
        Port:    ${service?.port || 3000},
        Tags:    [${(service?.tags || []).map(t => `"` + t + `"`).join(', ')}],
        Meta:    map[string]string${JSON.stringify(service?.metadata || {})},
    }

    registration := NewConsulServiceRegistration(config)

    err := registration.Register()
    if err != nil {
        log.Fatal(err)
    }

    // Handle graceful shutdown
    sigchan := make(chan os.Signal, 1)
    signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-sigchan
        log.Println("Deregistering service...")
        registration.Deregister()
        os.Exit(0)
    }()

    log.Println("Service running. Press Ctrl+C to stop.")
    select {}
}
`;
}

function generateGoConsulDiscovery(registry: ServiceRegistry): string {
  return `package main

import (
    "fmt"
    "log"

    consulapi "github.com/hashicorp/consul/api"
)

type ServiceInstance struct {
    ID      string
    Name    string
    Address string
    Port    int
    Tags    []string
    Meta    map[string]string
}

type ConsulServiceDiscovery struct {
    consul *consulapi.Client
}

func NewConsulServiceDiscovery() *ConsulServiceDiscovery {
    consul, err := consulapi.NewClient(consulapi.DefaultConfig())
    if err != nil {
        log.Fatal(err)
    }

    return &ConsulServiceDiscovery{consul: consul}
}

func (d *ConsulServiceDiscovery) DiscoverService(serviceName string) ([]ServiceInstance, error) {
    services, _, err := d.consul.Health().Service(serviceName, "", true, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to discover service %s: %w", serviceName, err)
    }

    instances := make([]ServiceInstance, len(services))
    for i, s := range services {
        address := s.Service.Address
        if address == "" {
            address = s.Node.Address
        }

        instances[i] = ServiceInstance{
            ID:      s.Service.ID,
            Name:    s.Service.Service,
            Address: address,
            Port:    s.Service.Port,
            Tags:    s.Service.Tags,
            Meta:    s.Service.Meta,
        }
    }

    log.Printf("Found %d healthy instances of %s", len(instances), serviceName)
    return instances, nil
}

func (d *ConsulServiceDiscovery) DiscoverAllServices() (map[string][]ServiceInstance, error) {
    services, _, err := d.consul.Catalog().Services(nil)
    if err != nil {
        return nil, fmt.Errorf("failed to discover services: %w", err)
    }

    result := make(map[string][]ServiceInstance)
    for serviceName := range services {
        instances, err := d.DiscoverService(serviceName)
        if err != nil {
            log.Printf("Error discovering %s: %v", serviceName, err)
            continue
        }
        result[serviceName] = instances
    }

    return result, nil
}

func main() {
    discovery := NewConsulServiceDiscovery()

    instances, err := discovery.DiscoverService("${registry.services[0]?.name || 'my-service'}")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Service instances: %+v\\n", instances)
}
`;
}

function generateGoHealthCheck(registry: ServiceRegistry): string {
  const service = registry.services[0];

  return `package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "time"
)

type HealthResponse struct {
    Status    string            \`json:"status"\`
    Timestamp string            \`json:"timestamp"\`
    Uptime    float64           \`json:"uptime"\`
    Checks    map[string]string \`json:"checks"\`
}

var startTime = time.Now()

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
    health := HealthResponse{
        Status:    "healthy",
        Timestamp: time.Now().Format(time.RFC3339),
        Uptime:    time.Since(startTime).Seconds(),
        Checks: map[string]string{
            "database":     "healthy",
            "redis":        "healthy",
            "external_api": "healthy",
        },
    }

    // TODO: Implement actual health checks
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(health)
}

func readyCheckHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func liveCheckHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
}

func main() {
    port := os.Getenv("PORT")
    if port == "" {
        port = "${service?.port?.toString() || '3000'}"
    }

    http.HandleFunc("${service?.healthCheck.path || '/health'}", healthCheckHandler)
    http.HandleFunc("/ready", readyCheckHandler)
    http.HandleFunc("/live", liveCheckHandler)

    log.Printf("Service listening on port %s", port)
    log.Printf("Health check available at http://localhost:%s${service?.healthCheck.path || '/health'}", port)

    if err := http.ListenAndServe(":"+port, nil); err != nil {
        log.Fatal(err)
    }
}
`;
}

/**
 * Generate etcd integration
 */
function generateEtcdIntegration(registry: ServiceRegistry, language: string): ServiceDiscoveryIntegration {
  return {
    platform: 'etcd',
    serviceCode: `// TODO: Implement etcd service registration for ${language}`,
    discoveryCode: `// TODO: Implement etcd service discovery for ${language}`,
    healthCheckCode: generateTypeScriptHealthCheck(registry),
    dependencies: language === 'typescript' ? ['etcd3'] : [],
    buildInstructions: [
      'Install etcd client library for ' + language,
      'Start etcd: docker-compose up -d etcd',
      'Implement service registration and discovery',
    ],
  };
}

/**
 * Generate Redis service discovery integration
 */
function generateRedisDiscoveryIntegration(registry: ServiceRegistry, language: string): ServiceDiscoveryIntegration {
  return {
    platform: 'redis',
    serviceCode: `// TODO: Implement Redis service registration for ${language}`,
    discoveryCode: `// TODO: Implement Redis service discovery for ${language}`,
    healthCheckCode: generateTypeScriptHealthCheck(registry),
    dependencies: language === 'typescript' ? ['ioredis', '@types/ioredis'] : [],
    buildInstructions: [
      'Install Redis client library for ' + language,
      'Start Redis: docker-compose up -d redis',
      'Implement service registration and discovery',
    ],
  };
}

/**
 * Generate generic discovery integration
 */
function generateGenericDiscoveryIntegration(registry: ServiceRegistry, language: string): ServiceDiscoveryIntegration {
  return {
    platform: registry.registryType,
    serviceCode: `// TODO: Implement ${registry.registryType} service registration for ${language}`,
    discoveryCode: `// TODO: Implement ${registry.registryType} service discovery for ${language}`,
    healthCheckCode: `// TODO: Implement health check for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Install ${registry.registryType} client library for ${language}`,
      `Implement service registration`,
      `Implement service discovery`,
      `Implement health checks`,
    ],
  };
}

/**
 * Write service discovery files
 */
export async function writeServiceDiscoveryFiles(
  serviceName: string,
  integration: ServiceDiscoveryIntegration,
  outputPath: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  // Write service code
  if (integration.serviceCode) {
    const serviceFile = path.join(outputPath, `${serviceName}-service.${getFileExtension(language)}`);
    await fs.writeFile(serviceFile, integration.serviceCode);
  }

  // Write discovery code
  if (integration.discoveryCode) {
    const discoveryFile = path.join(outputPath, `${serviceName}-discovery.${getFileExtension(language)}`);
    await fs.writeFile(discoveryFile, integration.discoveryCode);
  }

  // Write health check code
  if (integration.healthCheckCode) {
    const healthFile = path.join(outputPath, `${serviceName}-health.${getFileExtension(language)}`);
    await fs.writeFile(healthFile, integration.healthCheckCode);
  }

  // Write docker-compose for Consul
  if (integration.platform === 'consul') {
    const composeFile = path.join(outputPath, 'docker-compose.yml');
    await fs.writeFile(composeFile, generateConsulDockerCompose());
  }

  // Write build instructions
  const readmeFile = path.join(outputPath, 'BUILD.md');
  const readmeContent = generateBuildREADME(serviceName, integration);
  await fs.writeFile(readmeFile, readmeContent);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    csharp: 'cs',
  };
  return extensions[language] || 'txt';
}

function generateConsulDockerCompose(): string {
  return `version: '3.8'

services:
  consul:
    image: consul:latest
    ports:
      - "8500:8500"
      - "8600:8600/udp"
    environment:
      CONSUL_BIND_INTERFACE: eth0
      CONSUL_CLIENT_INTERFACE: eth0
    volumes:
      - consul-data:/consul/data

volumes:
  consul-data:
`;
}

function generateBuildREADME(serviceName: string, integration: ServiceDiscoveryIntegration): string {
  return `# Service Discovery Build Instructions for ${serviceName}

## Platform: ${integration.platform.toUpperCase()}

## Architecture

This setup includes:
- **Service Registration**: Automatic service registration with health checks
- **Service Discovery**: Find and connect to registered services
- **Health Checks**: Monitor service health and availability
- **Load Balancing**: Distribute requests across healthy instances

## Dependencies

\`\`\`bash
${integration.dependencies.map((dep) => dep).join('\n')}
\`\`\`

## Build Steps

${integration.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Service Registration
\`\`\`bash
node ${serviceName}-service.${getFileExtension('typescript')}
\`\`\`

### Service Discovery
\`\`\`bash
node ${serviceName}-discovery.${getFileExtension('typescript')}
\`\`\`

### Health Check Endpoint
\`\`\`bash
curl http://localhost:3000/health
\`\`\`

## Health Check Endpoints

- **GET /health**: Main health check endpoint
- **GET /ready**: Readiness check (for Kubernetes)
- **GET /live**: Liveness check (for Kubernetes)

## Service Discovery Flow

1. Service starts and registers with discovery platform
2. Health checks run periodically (default: 10s)
3. Unhealthy services are marked as critical after threshold
4. Clients discover healthy services through discovery API
5. Load balancer distributes requests across instances

## Monitoring

Monitor service metrics:
- **Registration Status**: Service registered/deregistered
- **Health Check Status**: Passing/failing checks
- **Service Instances**: Number of healthy instances
- **Discovery Latency**: Time to discover services

## Example Service Response

\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600.5,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "external_api": "healthy"
  }
}
\`\`\`
`;
}

/**
 * Display service registry info
 */
export async function displayServiceRegistry(registry: ServiceRegistry): Promise<void> {
  console.log(chalk.bold(`\n🔍 Service Registry: ${registry.registryType.toUpperCase()}\n`));
  console.log(chalk.cyan(`Services: ${registry.services.length}\n`));

  console.log(chalk.bold('Registered Services:\n'));

  for (const service of registry.services) {
    console.log(`  ${chalk.green('✓')} ${service.name} (v${service.version})`);
    console.log(chalk.gray(`      ${service.protocol.toUpperCase()}://${service.host}:${service.port}`));
    console.log(chalk.gray(`      Health Check: ${service.healthCheck.enabled ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`      Tags: ${service.tags.join(', ')}`));
    console.log('');
  }
}

/**
 * Helper functions
 */
function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return (
    str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  );
}
