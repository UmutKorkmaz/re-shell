// Service Discovery and Registration with Health Monitoring
// Dynamic service registration, discovery, and health checking

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  healthCheckUrl?: string;
  metadata: Record<string, any>;
  tags: string[];
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: number;
  registeredAt: number;
}

export interface ServiceRegistration {
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  healthCheckUrl?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface HealthCheckResult {
  serviceId: string;
  serviceName: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

export interface DiscoveryOptions {
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  unhealthyThreshold?: number;
  enableHealthChecks?: boolean;
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance> = new Map();
  private servicesByName: Map<string, Set<string>> = new Map();
  private servicesByTag: Map<string, Set<string>> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<DiscoveryOptions>;

  constructor(options: DiscoveryOptions = {}) {
    super();

    this.options = {
      healthCheckInterval: options.healthCheckInterval ?? 30000, // 30 seconds
      healthCheckTimeout: options.healthCheckTimeout ?? 5000, // 5 seconds
      unhealthyThreshold: options.unhealthyThreshold ?? 3, // 3 failed checks
      enableHealthChecks: options.enableHealthChecks ?? true,
    };
  }

  /**
   * Register a service
   */
  register(registration: ServiceRegistration): ServiceInstance {
    const serviceId = this.generateServiceId(registration);

    const instance: ServiceInstance = {
      id: serviceId,
      name: registration.name,
      host: registration.host,
      port: registration.port,
      protocol: registration.protocol,
      healthCheckUrl: registration.healthCheckUrl,
      metadata: registration.metadata ?? {},
      tags: registration.tags ?? [],
      status: 'unknown',
      lastHealthCheck: Date.now(),
      registeredAt: Date.now(),
    };

    // Store service
    this.services.set(serviceId, instance);

    // Index by name
    if (!this.servicesByName.has(registration.name)) {
      this.servicesByName.set(registration.name, new Set());
    }
    this.servicesByName.get(registration.name)!.add(serviceId);

    // Index by tags
    for (const tag of instance.tags) {
      if (!this.servicesByTag.has(tag)) {
        this.servicesByTag.set(tag, new Set());
      }
      this.servicesByTag.get(tag)!.add(serviceId);
    }

    // Start health checks
    if (this.options.enableHealthChecks) {
      this.startHealthChecks(serviceId);
    }

    this.emit('registered', instance);
    return instance;
  }

  /**
   * Deregister a service
   */
  deregister(serviceId: string): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    // Stop health checks
    const interval = this.healthCheckIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceId);
    }

    // Remove from indexes
    this.servicesByName.get(service.name)?.delete(serviceId);
    for (const tag of service.tags) {
      this.servicesByTag.get(tag)?.delete(serviceId);
    }

    // Remove service
    this.services.delete(serviceId);

    this.emit('deregistered', service);
    return true;
  }

  /**
   * Discover service by name
   */
  discover(serviceName: string): ServiceInstance[] {
    const serviceIds = this.servicesByName.get(serviceName);
    if (!serviceIds) {
      return [];
    }

    return Array.from(serviceIds)
      .map(id => this.services.get(id)!)
      .filter(s => s.status === 'healthy');
  }

  /**
   * Discover service by tags
   */
  discoverByTags(tags: string[]): ServiceInstance[] {
    const serviceIds = new Set<string>();

    for (const tag of tags) {
      const tagged = this.servicesByTag.get(tag);
      if (tagged) {
        for (const id of tagged) {
          serviceIds.add(id);
        }
      }
    }

    return Array.from(serviceIds)
      .map(id => this.services.get(id)!)
      .filter(s => s && s.status === 'healthy');
  }

  /**
   * Get service by ID
   */
  getService(serviceId: string): ServiceInstance | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values());
  }

  /**
   * Get services by status
   */
  getServicesByStatus(status: 'healthy' | 'unhealthy' | 'unknown'): ServiceInstance[] {
    return Array.from(this.services.values()).filter(s => s.status === status);
  }

  /**
   * Perform manual health check on a service
   */
  async checkHealth(serviceId: string): Promise<HealthCheckResult> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;

    try {
      if (service.healthCheckUrl) {
        // Perform HTTP health check
        const response = await fetch(
          `${service.protocol}://${service.host}:${service.port}${service.healthCheckUrl}`,
          {
            method: 'GET',
            signal: AbortSignal.timeout(this.options.healthCheckTimeout),
          }
        );
        healthy = response.ok;
      } else {
        // Default health check: try to connect
        const response = await fetch(
          `${service.protocol}://${service.host}:${service.port}/`,
          {
            method: 'GET',
            signal: AbortSignal.timeout(this.options.healthCheckTimeout),
          }
        );
        healthy = response.ok;
      }
    } catch (err) {
      healthy = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const responseTime = Date.now() - startTime;

    // Update service status
    const oldStatus = service.status;
    service.status = healthy ? 'healthy' : 'unhealthy';
    service.lastHealthCheck = Date.now();

    // Emit status change event
    if (oldStatus !== service.status) {
      this.emit('statusChanged', service);
    }

    const result: HealthCheckResult = {
      serviceId,
      serviceName: service.name,
      healthy,
      responseTime,
      error,
      timestamp: Date.now(),
    };

    this.emit('healthCheck', result);
    return result;
  }

  /**
   * Start health checks for a service
   */
  private startHealthChecks(serviceId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.checkHealth(serviceId);
      } catch (error) {
        // Log error but don't stop health checks
        this.emit('error', error);
      }
    }, this.options.healthCheckInterval);

    this.healthCheckIntervals.set(serviceId, interval);
  }

  /**
   * Generate unique service ID
   */
  private generateServiceId(registration: ServiceRegistration): string {
    const data = `${registration.name}:${registration.host}:${registration.port}:${Date.now()}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    unknownServices: number;
    servicesByType: Record<string, number>;
  } {
    const services = Array.from(this.services.values());

    const servicesByType: Record<string, number> = {};
    for (const service of services) {
      const type = service.protocol;
      servicesByType[type] = (servicesByType[type] ?? 0) + 1;
    }

    return {
      totalServices: services.length,
      healthyServices: services.filter(s => s.status === 'healthy').length,
      unhealthyServices: services.filter(s => s.status === 'unhealthy').length,
      unknownServices: services.filter(s => s.status === 'unknown').length,
      servicesByType,
    };
  }

  /**
   * Get healthy service instance for load balancing
   */
  getHealthyInstance(serviceName: string): ServiceInstance | null {
    const instances = this.discover(serviceName);

    if (instances.length === 0) {
      return null;
    }

    // Simple round-robin: return first instance
    // In production, use proper load balancing algorithm
    return instances[0];
  }

  /**
   * Shutdown registry and stop all health checks
   */
  shutdown(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    this.services.clear();
    this.servicesByName.clear();
    this.servicesByTag.clear();
    this.emit('shutdown');
  }

  /**
   * Update service metadata
   */
  updateMetadata(serviceId: string, metadata: Record<string, any>): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    service.metadata = { ...service.metadata, ...metadata };
    this.emit('updated', service);
    return true;
  }

  /**
   * Add tags to a service
   */
  addTags(serviceId: string, tags: string[]): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    for (const tag of tags) {
      if (!service.tags.includes(tag)) {
        service.tags.push(tag);

        if (!this.servicesByTag.has(tag)) {
          this.servicesByTag.set(tag, new Set());
        }
        this.servicesByTag.get(tag)!.add(serviceId);
      }
    }

    this.emit('updated', service);
    return true;
  }

  /**
   * Remove tags from a service
   */
  removeTags(serviceId: string, tags: string[]): boolean {
    const service = this.services.get(serviceId);
    if (!service) {
      return false;
    }

    for (const tag of tags) {
      const index = service.tags.indexOf(tag);
      if (index > -1) {
        service.tags.splice(index, 1);
        this.servicesByTag.get(tag)?.delete(serviceId);
      }
    }

    this.emit('updated', service);
    return true;
  }
}

export const serviceRegistry = new ServiceRegistry();
