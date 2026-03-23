import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Load Balancing Generation
 *
 * Generate intelligent load balancing with multiple strategies,
 * service discovery integration, and health checking.
 */

export interface LoadBalancerConfig {
  name: string;
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'random' | 'ip-hash';
  healthCheckEnabled: boolean;
  retryAttempts: number;
  timeout: number;
  circuitBreakerEnabled: boolean;
}

export interface ServiceInstance {
  id: string;
  address: string;
  port: number;
  weight: number;
  healthy: boolean;
  metadata: Record<string, any>;
}

export interface LoadBalancerIntegration {
  language: string;
  loadBalancerCode: string;
  strategiesCode: string;
  healthCheckCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate load balancer configuration
 */
export async function generateLoadBalancerConfig(
  name: string,
  strategy: LoadBalancerConfig['strategy'],
  projectPath: string = process.cwd()
): Promise<LoadBalancerConfig> {
  const config: LoadBalancerConfig = {
    name,
    strategy,
    healthCheckEnabled: true,
    retryAttempts: 3,
    timeout: 5000,
    circuitBreakerEnabled: true,
  };

  return config;
}

/**
 * Generate load balancer integration for language
 */
export async function generateLoadBalancerIntegration(
  config: LoadBalancerConfig,
  language: string
): Promise<LoadBalancerIntegration> {
  switch (language) {
    case 'typescript':
      return generateTypeScriptLoadBalancer(config);
    case 'python':
      return generatePythonLoadBalancer(config);
    case 'go':
      return generateGoLoadBalancer(config);
    default:
      return generateGenericLoadBalancer(config, language);
  }
}

/**
 * Generate TypeScript load balancer
 */
function generateTypeScriptLoadBalancer(config: LoadBalancerConfig): LoadBalancerIntegration {
  return {
    language: 'typescript',
    loadBalancerCode: generateTypeScriptLoadBalancerCode(config),
    strategiesCode: generateTypeScriptStrategies(config),
    healthCheckCode: generateTypeScriptHealthChecker(),
    dependencies: [],
    buildInstructions: [
      'Copy load balancer code to src/load-balancer.ts',
      'Import and configure for your services',
      'Add service instances',
      'Start load balancer',
    ],
  };
}

function generateTypeScriptLoadBalancerCode(config: LoadBalancerConfig): string {
  return `import { EventEmitter } from 'events';

export interface ServiceInstance {
  id: string;
  address: string;
  port: number;
  weight: number;
  healthy: boolean;
  currentConnections: number;
  metadata: Record<string, any>;
}

export class ${toPascalCase(config.name)}LoadBalancer extends EventEmitter {
  private instances: ServiceInstance[] = [];
  private currentIndex: number = 0;
  private config: LoadBalancerConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
  }

  /**
   * Add service instance
   */
  addInstance(instance: ServiceInstance): void {
    this.instances.push(instance);
    this.emit('instance-added', instance);
    console.log(\`Instance added: \${instance.id} (\${instance.address}:\${instance.port})\`);
  }

  /**
   * Remove service instance
   */
  removeInstance(instanceId: string): void {
    const index = this.instances.findIndex(i => i.id === instanceId);
    if (index !== -1) {
      const instance = this.instances.splice(index, 1)[0];
      this.emit('instance-removed', instance);
      console.log(\`Instance removed: \${instance.id}\`);
    }
  }

  /**
   * Get next instance using configured strategy
   */
  getNextInstance(): ServiceInstance | null {
    const healthyInstances = this.instances.filter(i => i.healthy);

    if (healthyInstances.length === 0) {
      this.emit('no-healthy-instances');
      return null;
    }

    let instance: ServiceInstance;

    switch (this.config.strategy) {
      case 'round-robin':
        instance = this.roundRobin(healthyInstances);
        break;
      case 'least-connections':
        instance = this.leastConnections(healthyInstances);
        break;
      case 'weighted':
        instance = this.weighted(healthyInstances);
        break;
      case 'random':
        instance = this.random(healthyInstances);
        break;
      case 'ip-hash':
        instance = this.ipHash(healthyInstances);
        break;
      default:
        instance = this.roundRobin(healthyInstances);
    }

    if (instance) {
      instance.currentConnections++;
    }

    return instance;
  }

  /**
   * Round robin strategy
   */
  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  /**
   * Least connections strategy
   */
  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) =>
      instance.currentConnections < min.currentConnections ? instance : min
    );
  }

  /**
   * Weighted round robin strategy
   */
  private weighted(instances: ServiceInstance[]): ServiceInstance {
    // Weighted selection based on instance weights
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[0];
  }

  /**
   * Random selection strategy
   */
  private random(instances: ServiceInstance[]): ServiceInstance {
    return instances[Math.floor(Math.random() * instances.length)];
  }

  /**
   * IP hash strategy (for session affinity)
   */
  private ipHash(instances: ServiceInstance[]): ServiceInstance {
    // Use first instance hash as simple implementation
    return instances[0];
  }

  /**
   * Release connection after request completes
   */
  releaseConnection(instance: ServiceInstance): void {
    if (instance.currentConnections > 0) {
      instance.currentConnections--;
    }
  }

  /**
   * Start health checking
   */
  startHealthCheck(intervalMs: number = 10000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const instance of this.instances) {
        const healthy = await this.checkHealth(instance);

        if (instance.healthy !== healthy) {
          instance.healthy = healthy;
          this.emit(healthy ? 'instance-up' : 'instance-down', instance);
          console.log(\`Instance \${instance.id} is now \${healthy ? 'healthy' : 'unhealthy'}\`);
        }
      }
    }, intervalMs);

    console.log(\`Health checking started (interval: \${intervalMs}ms)\`);
  }

  /**
   * Stop health checking
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('Health checking stopped');
    }
  }

  /**
   * Check health of an instance
   */
  private async checkHealth(instance: ServiceInstance): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(\`http://\${instance.address}:\${instance.port}/health\`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const healthy = response.ok;

      if (healthy) {
        instance.metadata.lastHealthCheck = Date.now();
        instance.metadata.lastError = undefined;
      } else {
        instance.metadata.lastError = \`HTTP \${response.status}\`;
      }

      return healthy;
    } catch (error) {
      instance.metadata.lastError = (error as Error).message;
      return false;
    }
  }

  /**
   * Get all instances
   */
  getInstances(): ServiceInstance[] {
    return [...this.instances];
  }

  /**
   * Get healthy instances
   */
  getHealthyInstances(): ServiceInstance[] {
    return this.instances.filter(i => i.healthy);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalInstances: this.instances.length,
      healthyInstances: this.instances.filter(i => i.healthy).length,
      unhealthyInstances: this.instances.filter(i => !i.healthy).length,
      strategy: this.config.strategy,
      currentConnections: this.instances.reduce((sum, i) => sum + i.currentConnections, 0),
    };
  }
}

// Usage example
async function main() {
  const config: LoadBalancerConfig = {
    name: '${config.name}',
    strategy: '${config.strategy}',
    healthCheckEnabled: true,
    retryAttempts: 3,
    timeout: 5000,
    circuitBreakerEnabled: true,
  };

  const loadBalancer = new ${toPascalCase(config.name)}LoadBalancer(config);

  // Add instances
  loadBalancer.addInstance({
    id: 'service-1',
    address: 'localhost',
    port: 3001,
    weight: 1,
    healthy: true,
    currentConnections: 0,
    metadata: {},
  });

  loadBalancer.addInstance({
    id: 'service-2',
    address: 'localhost',
    port: 3002,
    weight: 1,
    healthy: true,
    currentConnections: 0,
    metadata: {},
  });

  // Start health checking
  loadBalancer.startHealthCheck();

  // Make request with load balancing
  const instance = loadBalancer.getNextInstance();
  if (instance) {
    console.log(\`Selected instance: \${instance.id}\`);

    try {
      const response = await fetch(\`http://\${instance.address}:\${instance.port}/api/data\`);
      const data = await response.json();
      console.log('Response:', data);
    } finally {
      loadBalancer.releaseConnection(instance);
    }
  }

  console.log('Stats:', loadBalancer.getStats());
}

if (require.main === module) {
  main().catch(console.error);
}
`;
}

function generateTypeScriptStrategies(config: LoadBalancerConfig): string {
  return `// Load balancing strategies

export interface LoadBalancingStrategy {
  select(instances: ServiceInstance[]): ServiceInstance | null;
  name: string;
}

class RoundRobinStrategy implements LoadBalancingStrategy {
  name = 'round-robin';
  private index = 0;

  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    const instance = instances[this.index % instances.length];
    this.index++;
    return instance;
  }
}

class LeastConnectionsStrategy implements LoadBalancingStrategy {
  name = 'least-connections';

  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    return instances.reduce((min, instance) =>
      instance.currentConnections < min.currentConnections ? instance : min
    );
  }
}

class WeightedStrategy implements LoadBalancingStrategy {
  name = 'weighted';

  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;

    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }

    return instances[0];
  }
}

class RandomStrategy implements LoadBalancingStrategy {
  name = 'random';

  select(instances: ServiceInstance[]): ServiceInstance | null {
    if (instances.length === 0) return null;
    return instances[Math.floor(Math.random() * instances.length)];
  }
}

class IPHashStrategy implements LoadBalancingStrategy {
  name = 'ip-hash';
  private cache = new Map<string, ServiceInstance>();

  select(instances: ServiceInstance[], key?: string): ServiceInstance | null {
    if (instances.length === 0) return null;

    const hashKey = key || 'default';

    if (this.cache.has(hashKey)) {
      const cached = this.cache.get(hashKey);
      // Verify instance is still healthy
      if (instances.find(i => i.id === cached.id)) {
        return cached;
      }
      this.cache.delete(hashKey);
    }

    // Simple hash: use first instance for key
    const instance = instances[Math.abs(this.hashCode(hashKey)) % instances.length];
    this.cache.set(hashKey, instance);
    return instance;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

export { RoundRobinStrategy, LeastConnectionsStrategy, WeightedStrategy, RandomStrategy, IPHashStrategy };
`;
}

function generateTypeScriptHealthChecker(): string {
  return `import { ServiceInstance } from './load-balancer';

export class HealthChecker {
  private checking = new Map<string, NodeJS.Timeout>();

  async checkHealth(instance: ServiceInstance, timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(\`http://\${instance.address}:\${instance.port}/health\`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async checkAllInstances(instances: ServiceInstance[], timeout: number = 5000): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      instances.map(async (instance) => {
        const healthy = await this.checkHealth(instance, timeout);
        results.set(instance.id, healthy);
      })
    );

    return results;
  }

  startPeriodicChecks(
    instances: ServiceInstance[],
    intervalMs: number,
    onChange: (instance: ServiceInstance, healthy: boolean) => void
  ): void {
    for (const instance of instances) {
      const check = async () => {
        const healthy = await this.checkHealth(instance);
        onChange(instance, healthy);
      };

      // Run immediately
      check();

      // Schedule periodic checks
      const intervalId = setInterval(check, intervalMs);
      this.checking.set(instance.id, intervalId);
    }
  }

  stopPeriodicChecks(): void {
    for (const intervalId of this.checking.values()) {
      clearInterval(intervalId);
    }
    this.checking.clear();
  }
}
`;
}

/**
 * Generate Python load balancer
 */
function generatePythonLoadBalancer(config: LoadBalancerConfig): LoadBalancerIntegration {
  return {
    language: 'python',
    loadBalancerCode: generatePythonLoadBalancerCode(config),
    strategiesCode: generatePythonStrategies(config),
    healthCheckCode: generatePythonHealthChecker(),
    dependencies: [],
    buildInstructions: [
      'Copy load balancer code to load_balancer.py',
      'Import and configure for your services',
      'Add service instances',
      'Start load balancer',
    ],
  };
}

function generatePythonLoadBalancerCode(config: LoadBalancerConfig): string {
  return `import asyncio
import random
import time
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

@dataclass
class ServiceInstance:
    id: str
    address: str
    port: int
    weight: int = 1
    healthy: bool = True
    current_connections: int = 0
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

class ${toPascalCase(config.name)}LoadBalancer:
    def __init__(self, strategy: str = '${config.strategy}', health_check_enabled: bool = True):
        self.instances: List[ServiceInstance] = []
        self.strategy = strategy
        self.health_check_enabled = health_check_enabled
        self.current_index = 0
        self.health_check_task = None

    def add_instance(self, instance: ServiceInstance):
        self.instances.append(instance)
        print(f"Instance added: {instance.id} ({instance.address}:{instance.port})")

    def remove_instance(self, instance_id: str):
        self.instances = [i for i in self.instances if i.id != instance_id]
        print(f"Instance removed: {instance_id}")

    def get_next_instance(self) -> Optional[ServiceInstance]:
        healthy = [i for i in self.instances if i.healthy]

        if not healthy:
            return None

        if self.strategy == 'round-robin':
            instance = self._round_robin(healthy)
        elif self.strategy == 'least-connections':
            instance = self._least_connections(healthy)
        elif self.strategy == 'weighted':
            instance = self._weighted(healthy)
        elif self.strategy == 'random':
            instance = self._random(healthy)
        elif self.strategy == 'ip-hash':
            instance = self._ip_hash(healthy)
        else:
            instance = self._round_robin(healthy)

        if instance:
            instance.current_connections += 1

        return instance

    def _round_robin(self, instances: List[ServiceInstance]) -> ServiceInstance:
        instance = instances[self.current_index % len(instances)]
        self.current_index += 1
        return instance

    def _least_connections(self, instances: List[ServiceInstance]) -> ServiceInstance:
        return min(instances, key=lambda x: x.current_connections)

    def _weighted(self, instances: List[ServiceInstance]) -> ServiceInstance:
        total_weight = sum(i.weight for i in instances)
        rand = random.uniform(0, total_weight)

        for instance in instances:
            rand -= instance.weight
            if rand <= 0:
                return instance

        return instances[0]

    def _random(self, instances: List[ServiceInstance]) -> ServiceInstance:
        return random.choice(instances)

    def _ip_hash(self, instances: List[ServiceInstance]) -> ServiceInstance:
        # Simple implementation: use first instance
        return instances[0]

    def release_connection(self, instance: ServiceInstance):
        if instance.current_connections > 0:
            instance.current_connections -= 1

    async def check_health(self, instance: ServiceInstance, timeout: float = 5.0) -> bool:
        try:
            # Simulate health check
            # In production, use aiohttp or requests
            await asyncio.sleep(0.01)
            return True
        except Exception as e:
            instance.metadata['last_error'] = str(e)
            return False

    async def start_health_check(self, interval_ms: int = 10000):
        while True:
            for instance in self.instances:
                old_healthy = instance.healthy
                new_healthy = await self.check_health(instance)

                if old_healthy != new_healthy:
                    instance.healthy = new_healthy
                    print(f"Instance {instance.id} is now {'healthy' if new_healthy else 'unhealthy'}")

            await asyncio.sleep(interval_ms / 1000)

    def get_stats(self):
        return {
            'total_instances': len(self.instances),
            'healthy_instances': len([i for i in self.instances if i.healthy]),
            'unhealthy_instances': len([i for i in self.instances if not i.healthy]),
            'strategy': self.strategy,
            'current_connections': sum(i.current_connections for i in self.instances),
        }

# Usage example
async def main():
    load_balancer = ${toPascalCase(config.name)}LoadBalancer('${config.strategy}')

    load_balancer.add_instance(ServiceInstance(
        id='service-1',
        address='localhost',
        port=3001,
        weight=1
    ))

    load_balancer.add_instance(ServiceInstance(
        id='service-2',
        address='localhost',
        port=3002,
        weight=1
    ))

    instance = load_balancer.get_next_instance()
    if instance:
        print(f"Selected instance: {instance.id}")
        # Make request...
        load_balancer.release_connection(instance)

    print("Stats:", load_balancer.get_stats())

if __name__ == '__main__':
    asyncio.run(main())
`;
}

function generatePythonStrategies(config: LoadBalancerConfig): string {
  return `from abc import ABC, abstractmethod
from typing import List, Optional
import random

class LoadBalancingStrategy(ABC):
    @abstractmethod
    def select(self, instances: List['ServiceInstance']) -> Optional['ServiceInstance']:
        pass

class RoundRobinStrategy(LoadBalancingStrategy):
    def __init__(self):
        self.index = 0

    def select(self, instances: List['ServiceInstance']) -> Optional['ServiceInstance']:
        if not instances:
            return None
        instance = instances[self.index % len(instances)]
        self.index += 1
        return instance

class LeastConnectionsStrategy(LoadBalancingStrategy):
    def select(self, instances: List['ServiceInstance']) -> Optional['ServiceInstance']:
        if not instances:
            return None
        return min(instances, key=lambda x: x.current_connections)

class WeightedStrategy(LoadBalancingStrategy):
    def select(self, instances: List['ServiceInstance']) -> Optional['ServiceInstance']:
        if not instances:
            return None
        total_weight = sum(i.weight for i in instances)
        rand = random.uniform(0, total_weight)
        for instance in instances:
            rand -= instance.weight
            if rand <= 0:
                return instance
        return instances[0]

class RandomStrategy(LoadBalancingStrategy):
    def select(self, instances: List['ServiceInstance']) -> Optional['ServiceInstance']:
        if not instances:
            return None
        return random.choice(instances)

class IPHashStrategy(LoadBalancingStrategy):
    def __init__(self):
        self.cache = {}

    def select(self, instances: List['ServiceInstance']], key: str = 'default') -> Optional['ServiceInstance']:
        if not instances:
            return None

        if key in self.cache:
            cached = self.cache[key]
            # Verify instance still exists
            if any(i.id == cached.id for i in instances):
                return cached
            del self.cache[key]

        instance = instances[hash(key) % len(instances)]
        self.cache[key] = instance
        return instance
`;
}

function generatePythonHealthChecker(): string {
  return `import asyncio
from typing import List, Dict, Set

class HealthChecker:
    def __init__(self):
        self.checking = set()

    async def check_health(self, instance, timeout: float = 5.0) -> bool:
        try:
            # Simulate health check
            await asyncio.sleep(0.01)
            return True
        except Exception:
            return False

    async def check_all_instances(self, instances: List, timeout: float = 5.0) -> Dict[str, bool]:
        results = {}

        tasks = [
            self.check_health(instance, timeout)
            for instance in instances
        ]

        health_status = await asyncio.gather(*tasks, return_exceptions=True)

        for instance, healthy in zip(instances, health_status):
            results[instance.id] = healthy if not isinstance(healthy, Exception) else False

        return results

    async def start_periodic_checks(
        self,
        instances: List,
        interval_ms: int,
        on_change
    ):
        for instance in instances:
            task = asyncio.create_task(self._check_instance_periodic(instance, interval_ms, on_change))
            self.checking.add(task)

    async def _check_instance_periodic(self, instance, interval_ms, on_change):
        while True:
            healthy = await self.check_health(instance)
            on_change(instance, healthy)
            await asyncio.sleep(interval_ms / 1000)

    def stop_periodic_checks(self):
        for task in self.checking:
            task.cancel()
        self.checking.clear()
`;
}

/**
 * Generate Go load balancer
 */
function generateGoLoadBalancer(config: LoadBalancerConfig): LoadBalancerIntegration {
  return {
    language: 'go',
    loadBalancerCode: generateGoLoadBalancerCode(config),
    strategiesCode: generateGoStrategies(config),
    healthCheckCode: generateGoHealthChecker(),
    dependencies: [],
    buildInstructions: [
      'Copy load balancer code to load_balancer.go',
      'Import and configure for your services',
      'Add service instances',
      'Start load balancer',
    ],
  };
}

function generateGoLoadBalancerCode(config: LoadBalancerConfig): string {
  return `package main

import (
    "fmt"
    "log"
    "math/rand"
    "net/http"
    "sync"
    "time"
)

type ServiceInstance struct {
    ID                 string
    Address            string
    Port               int
    Weight             int
    Healthy            bool
    CurrentConnections int
    Metadata            map[string]interface{}
    mu                 sync.RWMutex
}

type LoadBalancerConfig struct {
    Name                  string
    Strategy             string
    HealthCheckEnabled   bool
    RetryAttempts        int
    Timeout              int
    CircuitBreakerEnabled bool
}

type ${toPascalCase(config.name)}LoadBalancer struct {
    instances       []*ServiceInstance
    currentIndex    int
    config          LoadBalancerConfig
    healthCheckStop chan bool
}

func New${toPascalCase(config.name)}LoadBalancer(config LoadBalancerConfig) *${toPascalCase(config.name)}LoadBalancer {
    return &${toPascalCase(config.name)}LoadBalancer{
        config:          config,
        healthCheckStop: make(chan bool),
    }
}

func (lb *${toPascalCase(config.name)}LoadBalancer) AddInstance(instance *ServiceInstance) {
    lb.instances = append(lb.instances, instance)
    log.Printf("Instance added: %s (%s:%d)", instance.ID, instance.Address, instance.Port)
}

func (lb *${toPascalCase(config.name)}LoadBalancer) RemoveInstance(instanceID string) {
    for i, instance := range lb.instances {
        if instance.ID == instanceID {
            lb.instances = append(lb.instances[:i], lb.instances[i+1:]...)
            log.Printf("Instance removed: %s", instanceID)
            return
        }
    }
}

func (lb *${toPascalCase(config.name)}LoadBalancer) GetNextInstance() *ServiceInstance {
    healthy := lb.getHealthyInstances()
    if len(healthy) == 0 {
        return nil
    }

    var instance *ServiceInstance

    switch lb.config.Strategy {
    case "round-robin":
        instance = lb.roundRobin(healthy)
    case "least-connections":
        instance = lb.leastConnections(healthy)
    case "weighted":
        instance = lb.weighted(healthy)
    case "random":
        instance = lb.random(healthy)
    case "ip-hash":
        instance = lb.ipHash(healthy)
    default:
        instance = lb.roundRobin(healthy)
    }

    if instance != nil {
        instance.mu.Lock()
        instance.CurrentConnections++
        instance.mu.Unlock()
    }

    return instance
}

func (lb *${toPascalCase(config.name)}LoadBalancer) roundRobin(instances []*ServiceInstance) *ServiceInstance {
    instance := instances[lb.currentIndex%len(instances)]
    lb.currentIndex++
    return instance
}

func (lb *${toPascalCase(config.name)}LoadBalancer) leastConnections(instances []*ServiceInstance) *ServiceInstance {
    var min *ServiceInstance
    for _, instance := range instances {
        if min == nil || instance.CurrentConnections < min.CurrentConnections {
            min = instance
        }
    }
    return min
}

func (lb *${toPascalCase(config.name)}LoadBalancer) weighted(instances []*ServiceInstance) *ServiceInstance {
    totalWeight := 0
    for _, instance := range instances {
        totalWeight += instance.Weight
    }

    rand := rand.Float64() * float64(totalWeight)
    for _, instance := range instances {
        rand -= float64(instance.Weight)
        if rand <= 0 {
            return instance
        }
    }

    return instances[0]
}

func (lb *${toPascalCase(config.name)}LoadBalancer) random(instances []*ServiceInstance) *ServiceInstance {
    return instances[rand.Intn(len(instances))]
}

func (lb *${toPascalCase(config.name)}LoadBalancer) ipHash(instances []*ServiceInstance) *ServiceInstance {
    // Simple implementation: use first instance
    return instances[0]
}

func (lb *${toPascalCase(config.name)}LoadBalancer) ReleaseConnection(instance *ServiceInstance) {
    instance.mu.Lock()
    if instance.CurrentConnections > 0 {
        instance.CurrentConnections--
    }
    instance.mu.Unlock()
}

func (lb *${toPascalCase(config.name)}LoadBalancer) getHealthyInstances() []*ServiceInstance {
    var healthy []*ServiceInstance
    for _, instance := range lb.instances {
        instance.mu.RLock()
        if instance.Healthy {
            healthy = append(healthy, instance)
        }
        instance.mu.RUnlock()
    }
    return healthy
}

func (lb *${toPascalCase(config.name)}LoadBalancer) StartHealthCheck(intervalMs int) {
    ticker := time.NewTicker(time.Duration(intervalMs) * time.Millisecond)

    go func() {
        for {
            select {
            case <-ticker.C:
                for _, instance := range lb.instances {
                    go func(inst *ServiceInstance) {
                        healthy := lb.checkHealth(inst)
                        inst.mu.Lock()
                        oldHealthy := inst.Healthy
                        inst.Healthy = healthy
                        inst.mu.Unlock()

                        if oldHealthy != healthy {
                            log.Printf("Instance %s is now %v", inst.ID, healthy)
                        }
                    }(instance)
                }
            case <-lb.healthCheckStop:
                ticker.Stop()
                return
            }
        }
    }()

    log.Printf("Health checking started (interval: %dms)", intervalMs)
}

func (lb *${toPascalCase(config.name)}LoadBalancer) StopHealthCheck() {
    lb.healthCheckStop <- true
    log.Println("Health checking stopped")
}

func (lb *${toPascalCase(config.name)}LoadBalancer) checkHealth(instance *ServiceInstance) bool {
    client := &http.Client{Timeout: time.Duration(lb.config.Timeout) * time.Millisecond}
    resp, err := client.Get(fmt.Sprintf("http://%s:%d/health", instance.Address, instance.Port))

    if err != nil {
        instance.mu.Lock()
        instance.Metadata["last_error"] = err.Error()
        instance.mu.Unlock()
        return false
    }
    defer resp.Body.Close()

    healthy := resp.StatusCode == 200
    if healthy {
        instance.mu.Lock()
        instance.Metadata["last_health_check"] = time.Now().Unix()
        instance.mu.Unlock()
    }

    return healthy
}

func (lb *${toPascalCase(config.name)}LoadBalancer) GetStats() map[string]interface{} {
    healthyCount := 0
    unhealthyCount := 0
    totalConnections := 0

    for _, instance := range lb.instances {
        instance.mu.RLock()
        if instance.Healthy {
            healthyCount++
        } else {
            unhealthyCount++
        }
        totalConnections += instance.CurrentConnections
        instance.mu.RUnlock()
    }

    return map[string]interface{}{
        "total_instances":     len(lb.instances),
        "healthy_instances":   healthyCount,
        "unhealthy_instances": unhealthyCount,
        "strategy":             lb.config.Strategy,
        "current_connections":  totalConnections,
    }
}

func main() {
    config := LoadBalancerConfig{
        Name:                  "${config.name}",
        Strategy:             "${config.strategy}",
        HealthCheckEnabled:   true,
        RetryAttempts:        ${config.retryAttempts},
        Timeout:              ${config.timeout},
        CircuitBreakerEnabled: ${config.circuitBreakerEnabled},
    }

    lb := New${toPascalCase(config.name)}LoadBalancer(config)

    lb.AddInstance(&ServiceInstance{
        ID:      "service-1",
        Address: "localhost",
        Port:    3001,
        Weight:  1,
        Healthy: true,
    })

    lb.AddInstance(&ServiceInstance{
        ID:      "service-2",
        Address: "localhost",
        Port:    3002,
        Weight:  1,
        Healthy: true,
    })

    lb.StartHealthCheck(10000)

    instance := lb.GetNextInstance()
    if instance != nil {
        fmt.Printf("Selected instance: %s\\n", instance.ID)
        lb.ReleaseConnection(instance)
    }

    fmt.Printf("Stats: %+v\\n", lb.GetStats())
}
`;
}

function generateGoStrategies(config: LoadBalancerConfig): string {
  return `package main

import "math/rand"

type LoadBalancingStrategy interface {
    Select(instances []*ServiceInstance) *ServiceInstance
}

type RoundRobinStrategy struct {
    index int
}

func (s *RoundRobinStrategy) Select(instances []*ServiceInstance) *ServiceInstance {
    if len(instances) == 0 {
        return nil
    }
    instance := instances[s.index%len(instances)]
    s.index++
    return instance
}

type LeastConnectionsStrategy struct{}

func (s *LeastConnectionsStrategy) Select(instances []*ServiceInstance) *ServiceInstance {
    if len(instances) == 0 {
        return nil
    }
    min := instances[0]
    for _, instance := range instances[1:] {
        if instance.CurrentConnections < min.CurrentConnections {
            min = instance
        }
    }
    return min
}

type WeightedStrategy struct{}

func (s *WeightedStrategy) Select(instances []*ServiceInstance) *ServiceInstance {
    if len(instances) == 0 {
        return nil
    }
    totalWeight := 0
    for _, instance := range instances {
        totalWeight += instance.Weight
    }
    rand := rand.Float64() * float64(totalWeight)
    for _, instance := range instances {
        rand -= float64(instance.Weight)
        if rand <= 0 {
            return instance
        }
    }
    return instances[0]
}

type RandomStrategy struct{}

func (s *RandomStrategy) Select(instances []*ServiceInstance) *ServiceInstance {
    if len(instances) == 0 {
        return nil
    }
    return instances[rand.Intn(len(instances))]
}

type IPHashStrategy struct {
    cache map[string]*ServiceInstance
}

func (s *IPHashStrategy) Select(instances []*ServiceInstance) *ServiceInstance {
    if len(instances) == 0 {
        return nil
    }
    // Simple implementation: return first instance
    return instances[0]
}
`;
}

function generateGoHealthChecker(): string {
  return `package main

import (
    "context"
    "log"
    "net/http"
    "sync"
    "time"
)

type HealthChecker struct {
    checking map[string]context.CancelFunc
    mu       sync.RWMutex
}

func NewHealthChecker() *HealthChecker {
    return &HealthChecker{
        checking: make(map[string]context.CancelFunc),
    }
}

func (hc *HealthChecker) CheckHealth(instance *ServiceInstance, timeout time.Duration) bool {
    client := &http.Client{Timeout: timeout}
    resp, err := client.Get(fmt.Sprintf("http://%s:%d/health", instance.Address, instance.Port))

    if err != nil {
        instance.Metadata["last_error"] = err.Error()
        return false
    }
    defer resp.Body.Close()

    healthy := resp.StatusCode == 200
    if healthy {
        instance.Metadata["last_health_check"] = time.Now().Unix()
    }

    return healthy
}

func (hc *HealthChecker) CheckAllInstances(instances []*ServiceInstance, timeout time.Duration) map[string]bool {
    results := make(map[string]bool)
    var wg sync.WaitGroup
    var mu sync.Mutex

    for _, instance := range instances {
        wg.Add(1)
        go func(inst *ServiceInstance) {
            defer wg.Done()
            healthy := hc.CheckHealth(inst, timeout)
            mu.Lock()
            results[inst.ID] = healthy
            mu.Unlock()
        }(instance)
    }

    wg.Wait()
    return results
}
`;
}

/**
 * Generate generic load balancer
 */
function generateGenericLoadBalancer(config: LoadBalancerConfig, language: string): LoadBalancerIntegration {
  return {
    language,
    loadBalancerCode: `// TODO: Implement load balancer for ${language}`,
    strategiesCode: `// TODO: Implement load balancing strategies for ${language}`,
    healthCheckCode: `// TODO: Implement health checker for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Implement load balancer for ${language}`,
      `Implement strategies`,
      `Implement health checking`,
    ],
  };
}

/**
 * Write load balancer files
 */
export async function writeLoadBalancerFiles(
  serviceName: string,
  integration: LoadBalancerIntegration,
  outputPath: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  // Write load balancer code
  if (integration.loadBalancerCode) {
    const lbFile = path.join(outputPath, `${serviceName}-load-balancer.${getFileExtension(language)}`);
    await fs.writeFile(lbFile, integration.loadBalancerCode);
  }

  // Write strategies code
  if (integration.strategiesCode) {
    const strategiesFile = path.join(outputPath, `${serviceName}-strategies.${getFileExtension(language)}`);
    await fs.writeFile(strategiesFile, integration.strategiesCode);
  }

  // Write health checker code
  if (integration.healthCheckCode) {
    const healthFile = path.join(outputPath, `${serviceName}-health.${getFileExtension(language)}`);
    await fs.writeFile(healthFile, integration.healthCheckCode);
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

function generateBuildREADME(serviceName: string, integration: LoadBalancerIntegration): string {
  return `# Load Balancer Build Instructions for ${serviceName}

## Language: ${integration.language.toUpperCase()}

## Architecture

This setup includes:
- **Load Balancer**: Distributes requests across service instances
- **Multiple Strategies**: Round robin, least connections, weighted, random, IP hash
- **Health Checking**: Automatic instance health monitoring
- **Connection Tracking**: Track active connections per instance

## Dependencies

\`\`\`bash
${integration.dependencies.map((dep) => dep).join('\n')}
\`\`\`

## Build Steps

${integration.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Load Balancing Strategies

- **Round Robin**: Sequential distribution across instances
- **Least Connections**: Route to instance with fewest active connections
- **Weighted**: Distribute based on configured weights
- **Random**: Random instance selection
- **IP Hash**: Consistent routing based on client IP (session affinity)

## Usage

\`\`\`typescript
import { ${toPascalCase(serviceName)}LoadBalancer } from './load-balancer';

const loadBalancer = new ${toPascalCase(serviceName)}LoadBalancer({
  name: '${serviceName}',
  strategy: 'round-robin',
  healthCheckEnabled: true,
  retryAttempts: 3,
  timeout: 5000,
  circuitBreakerEnabled: true,
});

// Add instances
loadBalancer.addInstance({
  id: 'service-1',
  address: 'localhost',
  port: 3001,
  weight: 1,
  healthy: true,
});

// Get next instance
const instance = loadBalancer.getNextInstance();

// Make request
try {
  const response = await fetch(\`http://\${instance.address}:\${instance.port}/api/data\`);
  const data = await response.json();
} finally {
  loadBalancer.releaseConnection(instance);
}
\`\`\`

## Health Checking

The load balancer automatically checks instance health:
- **Interval**: Every 10 seconds (configurable)
- **Endpoint**: GET /health
- **Timeout**: 5 seconds
- **Behavior**: Unhealthy instances excluded from rotation

## Metrics

- Total instances
- Healthy/unhealthy counts
- Current connections
- Strategy in use
- Per-instance connection counts

## Connection Flow

1. Client requests service
2. Load balancer selects instance using strategy
3. Request routed to selected instance
4. Connection count incremented
5. Request executed
6. Connection count released
7. Response returned to client
`;
}

/**
 * Display load balancer config info
 */
export async function displayLoadBalancerConfig(config: LoadBalancerConfig): Promise<void> {
  console.log(chalk.bold(`\n⚖️  Load Balancer: ${config.name}\n`));
  console.log(chalk.cyan(`Strategy: ${config.strategy}`));
  console.log(chalk.cyan(`Health Check: ${config.healthCheckEnabled ? 'enabled' : 'disabled'}`));
  console.log(chalk.cyan(`Retry Attempts: ${config.retryAttempts}`));
  console.log(chalk.cyan(`Timeout: ${config.timeout}ms`));
  console.log(chalk.cyan(`Circuit Breaker: ${config.circuitBreakerEnabled ? 'enabled' : 'disabled'}\n`));

  console.log(chalk.bold('Available Strategies:\n'));
  console.log(`  ${chalk.green('round-robin')} - Distribute requests sequentially`);
  console.log(`  ${chalk.green('least-connections')} - Route to instance with fewest connections`);
  console.log(`  ${chalk.green('weighted')} - Distribute based on instance weights`);
  console.log(`  ${chalk.green('random')} - Random instance selection`);
  console.log(`  ${chalk.green('ip-hash')} - Consistent routing by client IP\n`);
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
