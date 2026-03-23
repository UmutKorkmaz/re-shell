import { BackendTemplate } from '../types';

/**
 * Microfrontend Orchestration Template
 * Complete microfrontend orchestration system with backend service integration
 */
export const microfrontendOrchestrationTemplate: BackendTemplate = {
  id: 'microfrontend-orchestration',
  name: 'Microfrontend Orchestration',
  displayName: 'Microfrontend Orchestration Service',
  description: 'Complete microfrontend orchestration system with backend service integration, component registry, shared state management, and communication hub',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['microfrontend', 'orchestration', 'backend', 'state-management', 'communication'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'jsonwebtoken': '^9.0.2',
    'axios': '^1.5.0',
    'socket.io': '^4.7.2',
    'ioredis': '^5.3.2',
    'lodash': '^4.17.21',
    'uuid': '^9.0.0',
    'zod': '^3.22.4',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/jsonwebtoken': '^9.0.2',
    '@types/lodash': '^4.14.195',
    '@types/uuid': '^9.0.2',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
  },
  features: ['microservices', 'rest-api', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{name}}-orchestrator",
  "version": "1.0.0",
  "description": "{{name}} - Microfrontend Orchestration Service",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "jsonwebtoken": "^9.0.2",
    "axios": "^1.5.0",
    "socket.io": "^4.7.2",
    "ioredis": "^5.3.2",
    "lodash": "^4.17.21",
    "uuid": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/lodash": "^4.14.195",
    "@types/uuid": "^9.0.2",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

    'src/index.ts': `// Microfrontend Orchestration Service
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { MicrofrontendOrchestrator } from './orchestrator/microfrontend-orchestrator';
import { ComponentRegistry } from './orchestrator/component-registry';
import { StateManager } from './orchestrator/state-manager';
import { CommunicationHub } from './orchestrator/communication-hub';
import { BackendServiceIntegration } from './orchestrator/backend-integration';
import { orchestratorRoutes } from './routes/orchestrator.routes';
import { componentRoutes } from './routes/component.routes';
import { stateRoutes } from './routes/state.routes';
import { serviceRoutes } from './routes/service.routes';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
const componentRegistry = new ComponentRegistry();
const stateManager = new StateManager();
const communicationHub = new CommunicationHub(io);
const backendIntegration = new BackendServiceIntegration();

const orchestrator = new MicrofrontendOrchestrator({
  componentRegistry,
  stateManager,
  communicationHub,
  backendIntegration,
});

// Initialize orchestrator
await orchestrator.initialize();

// Routes
app.use('/api/orchestrator', orchestratorRoutes(orchestrator));
app.use('/api/components', componentRoutes(componentRegistry));
app.use('/api/state', stateRoutes(stateManager));
app.use('/api/services', serviceRoutes(backendIntegration));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      orchestrator: orchestrator.isHealthy(),
      registry: componentRegistry.isHealthy(),
      state: stateManager.isHealthy(),
      communication: communicationHub.isHealthy(),
      backend: backendIntegration.isHealthy(),
    },
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString(),
    },
  });
});

// Start server
const PORT = process.env.PORT || {{port}};
httpServer.listen(PORT, () => {
  console.log(\`🚀 Microfrontend Orchestrator running on port \${PORT}\`);
  console.log(\`📦 Component Registry: \${componentRegistry.getComponents().length} components registered\`);
  console.log(\`🔗 Backend Services: \${backendIntegration.getServices().length} services integrated\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await orchestrator.shutdown();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
`,

    'src/orchestrator/microfrontend-orchestrator.ts': `// Microfrontend Orchestrator
// Main orchestrator that coordinates all services

import { ComponentRegistry } from './component-registry';
import { StateManager } from './state-manager';
import { CommunicationHub } from './communication-hub';
import { BackendServiceIntegration } from './backend-integration';
import { EventEmitter } from 'events';

export interface OrchestratorConfig {
  componentRegistry: ComponentRegistry;
  stateManager: StateManager;
  communicationHub: CommunicationHub;
  backendIntegration: BackendServiceIntegration;
}

export class MicrofrontendOrchestrator extends EventEmitter {
  private componentRegistry: ComponentRegistry;
  private stateManager: StateManager;
  private communicationHub: CommunicationHub;
  private backendIntegration: BackendServiceIntegration;
  private initialized = false;

  constructor(private config: OrchestratorConfig) {
    super();
    this.componentRegistry = config.componentRegistry;
    this.stateManager = config.stateManager;
    this.communicationHub = config.communicationHub;
    this.backendIntegration = config.backendIntegration;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Microfrontend Orchestrator...');

    // Initialize component registry
    await this.componentRegistry.initialize();
    this.setupComponentEvents();

    // Initialize state manager
    await this.stateManager.initialize();

    // Initialize communication hub
    await this.communicationHub.initialize();
    this.setupCommunicationEvents();

    // Initialize backend integration
    await this.backendIntegration.initialize();
    this.setupBackendEvents();

    this.initialized = true;
    this.emit('initialized');

    console.log('✅ Microfrontend Orchestrator initialized');
  }

  private setupComponentEvents(): void {
    this.componentRegistry.on('component:registered', (component) => {
      console.log(\`Component registered: \${component.id}\`);
      this.emit('component:registered', component);
    });

    this.componentRegistry.on('component:unregistered', (componentId) => {
      console.log(\`Component unregistered: \${componentId}\`);
      this.emit('component:unregistered', componentId);
    });

    this.componentRegistry.on('component:updated', (component) => {
      console.log(\`Component updated: \${component.id}\`);
      this.emit('component:updated', component);
    });
  }

  private setupCommunicationEvents(): void {
    this.communicationHub.on('message:received', async (message) => {
      // Handle communication between microfrontends
      await this.handleInterMicrofrontendMessage(message);
    });

    this.communicationHub.on('user:connected', (userId) => {
      console.log(\`User connected: \${userId}\`);
      this.emit('user:connected', userId);
    });

    this.communicationHub.on('user:disconnected', (userId) => {
      console.log(\`User disconnected: \${userId}\`);
      this.emit('user:disconnected', userId);
    });
  }

  private setupBackendEvents(): void {
    this.backendIntegration.on('service:registered', (service) => {
      console.log(\`Backend service registered: \${service.id}\`);
      this.emit('service:registered', service);
    });

    this.backendIntegration.on('service:unavailable', (serviceId) => {
      console.warn(\`Backend service unavailable: \${serviceId}\`);
      this.emit('service:unavailable', serviceId);
    });

    this.backendIntegration.on('data:received', async (data) => {
      // Broadcast data to relevant microfrontends
      await this.stateManager.update(data.key, data.value);
    });
  }

  private async handleInterMicrofrontendMessage(message: any): Promise<void> {
    const { from, to, type, payload } = message;

    // Route message to target microfrontend
    if (to) {
      this.communicationHub.sendToMicrofrontend(to, {
        from,
        type,
        payload,
      });
    } else {
      // Broadcast to all microfrontends
      this.communicationHub.broadcast({
        from,
        type,
        payload,
      });
    }
  }

  async loadMicrofrontend(componentId: string): Promise<any> {
    const component = await this.componentRegistry.getComponent(componentId);

    if (!component) {
      throw new Error(\`Component not found: \${componentId}\`);
    }

    if (!component.active) {
      throw new Error(\`Component not active: \${componentId}\`);
    }

    // Load component state
    const state = await this.stateManager.get(\`component:\${componentId}\`);

    // Load backend data if configured
    if (component.backendService) {
      const backendData = await this.backendIntegration.fetchData(
        component.backendService,
        component.backendEndpoint || '/'
      );
      return {
        component,
        state,
        backendData,
      };
    }

    return {
      component,
      state,
    };
  }

  async registerMicrofrontend(component: any): Promise<void> {
    // Validate component
    const validated = await this.componentRegistry.validateComponent(component);

    // Register component
    await this.componentRegistry.register(validated);

    // Initialize component state
    await this.stateManager.set(\`component:\${validated.id}\`, validated.initialState || {});

    // Notify backend service if needed
    if (validated.backendService) {
      await this.backendIntegration.notifyService(validated.backendService, {
        type: 'component:registered',
        component: validated.id,
      });
    }
  }

  isHealthy(): boolean {
    return (
      this.initialized &&
      this.componentRegistry.isHealthy() &&
      this.stateManager.isHealthy() &&
      this.communicationHub.isHealthy() &&
      this.backendIntegration.isHealthy()
    );
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Microfrontend Orchestrator...');

    await this.communicationHub.shutdown();
    await this.stateManager.shutdown();
    await this.backendIntegration.shutdown();
    await this.componentRegistry.shutdown();

    this.initialized = false;
    console.log('✅ Orchestrator shut down');
  }
}
`,

    'src/orchestrator/component-registry.ts': `// Component Registry
// Registry for managing microfrontend components

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface MicrofrontendComponent {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry: string; // URL to component bundle
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'web-component';
  active: boolean;
  routes: string[];
  permissions?: string[];
  backendService?: string; // Backend service ID
  backendEndpoint?: string;
  initialState?: any;
  dependencies?: string[]; // Other component IDs this depends on
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ComponentRegistry extends EventEmitter {
  private components: Map<string, MicrofrontendComponent> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load components from storage or configuration
    // For now, start with empty registry

    this.initialized = true;
    console.log('✅ Component Registry initialized');
  }

  async register(component: Omit<MicrofrontendComponent, 'id' | 'createdAt' | 'updatedAt'>): Promise<MicrofrontendComponent> {
    const id = component.name.toLowerCase().replace(/\\s+/g, '-');
    const now = new Date();

    const newComponent: MicrofrontendComponent = {
      ...component,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Check for duplicate
    if (this.components.has(id)) {
      throw new Error(\`Component already exists: \${id}\`);
    }

    // Validate dependencies
    if (newComponent.dependencies) {
      for (const depId of newComponent.dependencies) {
        if (!this.components.has(depId)) {
          throw new Error(\`Dependency not found: \${depId}\`);
        }
      }
    }

    this.components.set(id, newComponent);
    this.emit('component:registered', newComponent);

    return newComponent;
  }

  async unregister(componentId: string): Promise<void> {
    const component = this.components.get(componentId);

    if (!component) {
      throw new Error(\`Component not found: \${componentId}\`);
    }

    // Check if other components depend on this one
    for (const [id, comp] of this.components.entries()) {
      if (comp.dependencies?.includes(componentId)) {
        throw new Error(\`Cannot unregister: component \${id} depends on \${componentId}\`);
      }
    }

    this.components.delete(componentId);
    this.emit('component:unregistered', componentId);
  }

  async update(componentId: string, updates: Partial<MicrofrontendComponent>): Promise<MicrofrontendComponent> {
    const component = this.components.get(componentId);

    if (!component) {
      throw new Error(\`Component not found: \${componentId}\`);
    }

    const updated: MicrofrontendComponent = {
      ...component,
      ...updates,
      id: componentId, // Preserve ID
      createdAt: component.createdAt, // Preserve creation time
      updatedAt: new Date(),
    };

    this.components.set(componentId, updated);
    this.emit('component:updated', updated);

    return updated;
  }

  getComponent(componentId: string): MicrofrontendComponent | undefined {
    return this.components.get(componentId);
  }

  getComponents(): MicrofrontendComponent[] {
    return Array.from(this.components.values());
  }

  getActiveComponents(): MicrofrontendComponent[] {
    return this.getComponents().filter(c => c.active);
  }

  getComponentsByFramework(framework: MicrofrontendComponent['framework']): MicrofrontendComponent[] {
    return this.getComponents().filter(c => c.framework === framework);
  }

  getComponentsByRoute(route: string): MicrofrontendComponent[] {
    return this.getComponents().filter(c =>
      c.routes.some(r => this.matchRoute(r, route))
    );
  }

  private matchRoute(pattern: string, route: string): boolean {
    // Simple route matching (can be enhanced with proper routing logic)
    if (pattern === route) {
      return true;
    }

    // Handle wildcards
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return route.startsWith(prefix);
    }

    // Handle parameters
    const patternRegex = pattern.replace(/:([^/]+)/g, '([^/]+)');
    const regex = new RegExp(\`^\${patternRegex}$\`);
    return regex.test(route);
  }

  async validateComponent(component: any): Promise<MicrofrontendComponent> {
    // Validate required fields
    if (!component.name || typeof component.name !== 'string') {
      throw new Error('Component name is required');
    }

    if (!component.version || typeof component.version !== 'string') {
      throw new Error('Component version is required');
    }

    if (!component.entry || typeof component.entry !== 'string') {
      throw new Error('Component entry URL is required');
    }

    if (!component.framework || !['react', 'vue', 'angular', 'svelte', 'web-component'].includes(component.framework)) {
      throw new Error('Component framework must be one of: react, vue, angular, svelte, web-component');
    }

    if (!Array.isArray(component.routes)) {
      throw new Error('Component routes must be an array');
    }

    return component as MicrofrontendComponent;
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.components.clear();
    this.initialized = false;
    console.log('✅ Component Registry shut down');
  }
}
`,

    'src/orchestrator/state-manager.ts': `// State Manager
// Shared state management for microfrontends

import { EventEmitter } from 'events';
import Redis from 'ioredis';

export class StateManager extends EventEmitter {
  private localState: Map<string, any> = new Map();
  private redis?: Redis;
  private initialized = false;
  private useRedis: boolean;

  constructor() {
    super();
    this.useRedis = !!process.env.REDIS_URL;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.useRedis) {
      this.redis = new Redis(process.env.REDIS_URL!);
      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
      });
      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });

      // Subscribe to state updates
      const pubClient = new Redis(process.env.REDIS_URL!);
      await pubClient.subscribe('state-updates');
      pubClient.on('message', (channel, message) => {
        if (channel === 'state-updates') {
          const { key, value } = JSON.parse(message);
          this.localState.set(key, value);
          this.emit('state:updated', { key, value });
        }
      });
    }

    this.initialized = true;
    console.log('✅ State Manager initialized');
  }

  async get(key: string): Promise<any> {
    if (this.useRedis && this.redis) {
      const value = await this.redis.get(\`state:\${key}\`);
      return value ? JSON.parse(value) : undefined;
    }

    return this.localState.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.useRedis && this.redis) {
      await this.redis.set(\`state:\${key}\`, serialized);
      // Publish update
      await this.redis.publish('state-updates', JSON.stringify({ key, value }));
    }

    this.localState.set(key, value);
    this.emit('state:updated', { key, value });
  }

  async update(key: string, updates: Partial<any>): Promise<void> {
    const current = await this.get(key);
    const updated = current ? { ...current, ...updates } : updates;
    await this.set(key, updated);
  }

  async delete(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      await this.redis.del(\`state:\${key}\`);
    }

    this.localState.delete(key);
    this.emit('state:deleted', { key });
  }

  async getMany(keys: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();

    for (const key of keys) {
      const value = await this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }

    return result;
  }

  async setMany(entries: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }

  async clear(prefix?: string): Promise<void> {
    if (prefix) {
      // Clear all keys with prefix
      const keys = this.useRedis && this.redis
        ? await this.redis.keys(\`state:\${prefix}*\`)
        : Array.from(this.localState.keys()).filter(k => k.startsWith(prefix));

      if (this.useRedis && this.redis && keys.length > 0) {
        await this.redis.del(...keys);
      }

      for (const key of keys) {
        const cleanKey = key.replace('state:', '');
        this.localState.delete(cleanKey);
        this.emit('state:deleted', { key: cleanKey });
      }
    } else {
      // Clear all
      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys('state:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      this.localState.clear();
      this.emit('state:cleared');
    }
  }

  onStateUpdate(callback: (key: string, value: any) => void): void {
    this.on('state:updated', ({ key, value }) => callback(key, value));
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }

    this.localState.clear();
    this.initialized = false;
    console.log('✅ State Manager shut down');
  }
}
`,

    'src/orchestrator/communication-hub.ts': `// Communication Hub
// Real-time communication between microfrontends and backend

import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';

export interface Message {
  id: string;
  from: string; // Microfrontend ID or 'backend'
  to?: string; // Target microfrontend ID (optional for broadcast)
  type: string;
  payload: any;
  timestamp: Date;
}

export class CommunicationHub extends EventEmitter {
  private io: SocketIOServer;
  private connections: Map<string, any> = new Map();
  private initialized = false;

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.io.on('connection', (socket) => {
      const { userId, microfrontendId } = socket.handshake.auth || {};

      if (userId) {
        this.connections.set(userId, { socket, microfrontendId });
        console.log(\`User connected: \${userId} (microfrontend: \${microfrontendId || 'none'})\`);
        this.emit('user:connected', userId);

        // Handle incoming messages
        socket.on('message', async (data) => {
          await this.handleMessage(userId, data);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          this.connections.delete(userId);
          console.log(\`User disconnected: \${userId}\`);
          this.emit('user:disconnected', userId);
        });
      }
    });

    this.initialized = true;
    console.log('✅ Communication Hub initialized');
  }

  private async handleMessage(userId: string, data: any): Promise<void> {
    const connection = this.connections.get(userId);

    if (!connection) {
      return;
    }

    const message: Message = {
      id: this.generateMessageId(),
      from: connection.microfrontendId || userId,
      to: data.to,
      type: data.type,
      payload: data.payload,
      timestamp: new Date(),
    };

    this.emit('message:received', message);

    // Route message to target
    if (message.to) {
      await this.sendToMicrofrontend(message.to, message);
    } else {
      await this.broadcast(message);
    }
  }

  async sendToMicrofrontend(microfrontendId: string, data: any): Promise<void> {
    // Find all connections for this microfrontend
    const targetConnections = Array.from(this.connections.values())
      .filter(conn => conn.microfrontendId === microfrontendId);

    for (const conn of targetConnections) {
      conn.socket.emit('message', data);
    }
  }

  async broadcast(data: any): Promise<void> {
    this.io.emit('message', data);
  }

  async sendToUser(userId: string, data: any): Promise<void> {
    const connection = this.connections.get(userId);

    if (connection) {
      connection.socket.emit('message', data);
    }
  }

  async sendToBackend(data: any): Promise<void> {
    this.emit('backend:message', data);
  }

  private generateMessageId(): string {
    return \`msg-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }

  getConnectionsForMicrofrontend(microfrontendId: string): any[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.microfrontendId === microfrontendId);
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.io.close();
    this.connections.clear();
    this.initialized = false;
    console.log('✅ Communication Hub shut down');
  }
}
`,

    'src/orchestrator/backend-integration.ts': `// Backend Service Integration
// Integration with backend services for microfrontends

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

export interface BackendService {
  id: string;
  name: string;
  baseURL: string;
  healthPath?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retryAttempts?: number;
  circuitBreakerThreshold?: number;
}

export class BackendServiceIntegration extends EventEmitter {
  private services: Map<string, BackendService> = new Map();
  private axiosInstances: Map<string, AxiosInstance> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: number; openUntil: number }> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load services from environment or configuration
    await this.loadServicesFromConfig();

    // Start health check interval
    this.startHealthCheckInterval();

    this.initialized = true;
    console.log('✅ Backend Service Integration initialized');
  }

  private async loadServicesFromConfig(): Promise<void> {
    // Load from environment variables
    // Format: BACKEND_SERVICE_<ID>_URL, BACKEND_SERVICE_<ID>_NAME, etc.
    const backendServices = process.env.BACKEND_SERVICES?.split(',') || [];

    for (const serviceId of backendServices) {
      const url = process.env[\`BACKEND_SERVICE_\${serviceId.toUpperCase()}_URL\`];
      const name = process.env[\`BACKEND_SERVICE_\${serviceId.toUpperCase()}_NAME\`] || serviceId;

      if (url) {
        await this.registerService({
          id: serviceId,
          name,
          baseURL: url,
          healthPath: '/health',
          timeout: 30000,
          retryAttempts: 3,
          circuitBreakerThreshold: 5,
        });
      }
    }
  }

  async registerService(service: BackendService): Promise<void> {
    this.services.set(service.id, service);

    // Create axios instance for this service
    const axiosInstance = axios.create({
      baseURL: service.baseURL,
      timeout: service.timeout || 30000,
      headers: service.headers || {},
    });

    this.axiosInstances.set(service.id, axiosInstance);
    this.emit('service:registered', service);

    console.log(\`Backend service registered: \${service.name} (\${service.id})\`);
  }

  async unregisterService(serviceId: string): Promise<void> {
    this.services.delete(serviceId);
    this.axiosInstances.delete(serviceId);
    this.circuitBreakers.delete(serviceId);
    this.emit('service:unregistered', serviceId);
  }

  async fetchData(serviceId: string, endpoint: string, config?: any): Promise<any> {
    const axiosInstance = this.axiosInstances.get(serviceId);

    if (!axiosInstance) {
      throw new Error(\`Service not found: \${serviceId}\`);
    }

    const service = this.services.get(serviceId)!;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(serviceId)) {
      throw new Error(\`Circuit breaker is open for service: \${serviceId}\`);
    }

    try {
      const response = await axiosInstance.get(endpoint, config);
      this.resetCircuitBreaker(serviceId);
      return response.data;
    } catch (error: any) {
      await this.recordFailure(serviceId);
      throw error;
    }
  }

  async sendData(serviceId: string, endpoint: string, data: any, config?: any): Promise<any> {
    const axiosInstance = this.axiosInstances.get(serviceId);

    if (!axiosInstance) {
      throw new Error(\`Service not found: \${serviceId}\`);
    }

    const service = this.services.get(serviceId)!;

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(serviceId)) {
      throw new Error(\`Circuit breaker is open for service: \${serviceId}\`);
    }

    try {
      const response = await axiosInstance.post(endpoint, data, config);
      this.resetCircuitBreaker(serviceId);
      return response.data;
    } catch (error: any) {
      await this.recordFailure(serviceId);
      throw error;
    }
  }

  async checkHealth(serviceId: string): Promise<boolean> {
    const service = this.services.get(serviceId);

    if (!service) {
      return false;
    }

    try {
      const axiosInstance = this.axiosInstances.get(serviceId);
      await axiosInstance?.get(service.healthPath || '/health');
      return true;
    } catch {
      return false;
    }
  }

  private async recordFailure(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) return;

    const breaker = this.circuitBreakers.get(serviceId) || { failures: 0, lastFailure: 0, openUntil: 0 };
    breaker.failures++;
    breaker.lastFailure = Date.now();

    if (breaker.failures >= (service.circuitBreakerThreshold || 5)) {
      breaker.openUntil = Date.now() + 60000; // Open for 1 minute
      this.emit('circuit-breaker:opened', { serviceId, failures: breaker.failures });
    }

    this.circuitBreakers.set(serviceId, breaker);
  }

  private resetCircuitBreaker(serviceId: string): void {
    this.circuitBreakers.delete(serviceId);
  }

  private isCircuitBreakerOpen(serviceId: string): boolean {
    const breaker = this.circuitBreakers.get(serviceId);
    if (!breaker) return false;

    if (Date.now() > breaker.openUntil) {
      this.circuitBreakers.delete(serviceId);
      return false;
    }

    return true;
  }

  async notifyService(serviceId: string, data: any): Promise<void> {
    try {
      await this.sendData(serviceId, '/notify', data);
    } catch (error) {
      console.error(\`Failed to notify service \${serviceId}:\`, error);
    }
  }

  getService(serviceId: string): BackendService | undefined {
    return this.services.get(serviceId);
  }

  getServices(): BackendService[] {
    return Array.from(this.services.values());
  }

  private startHealthCheckInterval(): void {
    setInterval(async () => {
      for (const [serviceId, service] of this.services.entries()) {
        const isHealthy = await this.checkHealth(serviceId);

        if (!isHealthy) {
          console.warn(\`Backend service unhealthy: \${service.name} (\${serviceId})\`);
          this.emit('service:unavailable', serviceId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  isHealthy(): boolean {
    return this.initialized && this.services.size > 0;
  }

  async shutdown(): Promise<void> {
    this.services.clear();
    this.axiosInstances.clear();
    this.circuitBreakers.clear();
    this.initialized = false;
    console.log('✅ Backend Service Integration shut down');
  }
}
`,

    'src/routes/orchestrator.routes.ts': `// Orchestrator Routes
import { Router } from 'express';
import { MicrofrontendOrchestrator } from '../orchestrator/microfrontend-orchestrator';

export function orchestratorRoutes(orchestrator: MicrofrontendOrchestrator): Router {
  const router = Router();

  // Load microfrontend
  router.get('/load/:componentId', async (req, res, next) => {
    try {
      const { componentId } = req.params;
      const result = await orchestrator.loadMicrofrontend(componentId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Register microfrontend
  router.post('/register', async (req, res, next) => {
    try {
      const component = req.body;
      await orchestrator.registerMicrofrontend(component);
      res.status(201).json({ message: 'Component registered successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      healthy: orchestrator.isHealthy(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
`,

    'src/routes/component.routes.ts': `// Component Registry Routes
import { Router } from 'express';
import { ComponentRegistry } from '../orchestrator/component-registry';

export function componentRoutes(registry: ComponentRegistry): Router {
  const router = Router();

  // List all components
  router.get('/', (req, res) => {
    const components = registry.getComponents();
    res.json(components);
  });

  // Get active components
  router.get('/active', (req, res) => {
    const components = registry.getActiveComponents();
    res.json(components);
  });

  // Get components by framework
  router.get('/framework/:framework', (req, res) => {
    const { framework } = req.params;
    const components = registry.getComponentsByFramework(framework as any);
    res.json(components);
  });

  // Get components by route
  router.get('/route/:route', (req, res) => {
    const { route } = req.params;
    const components = registry.getComponentsByRoute(route);
    res.json(components);
  });

  // Get single component
  router.get('/:id', (req, res, next) => {
    const component = registry.getComponent(req.params.id);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(component);
  });

  // Register component
  router.post('/', async (req, res, next) => {
    try {
      const component = await registry.register(req.body);
      res.status(201).json(component);
    } catch (error) {
      next(error);
    }
  });

  // Update component
  router.put('/:id', async (req, res, next) => {
    try {
      const component = await registry.update(req.params.id, req.body);
      res.json(component);
    } catch (error) {
      next(error);
    }
  });

  // Unregister component
  router.delete('/:id', async (req, res, next) => {
    try {
      await registry.unregister(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
`,

    'src/routes/state.routes.ts': `// State Manager Routes
import { Router } from 'express';
import { StateManager } from '../orchestrator/state-manager';

export function stateRoutes(stateManager: StateManager): Router {
  const router = Router();

  // Get state value
  router.get('/:key', async (req, res, next) => {
    try {
      const value = await stateManager.get(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (error) {
      next(error);
    }
  });

  // Set state value
  router.put('/:key', async (req, res, next) => {
    try {
      await stateManager.set(req.params.key, req.body.value);
      res.json({ message: 'State updated successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Update state value
  router.patch('/:key', async (req, res, next) => {
    try {
      await stateManager.update(req.params.key, req.body);
      res.json({ message: 'State updated successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Delete state value
  router.delete('/:key', async (req, res, next) => {
    try {
      await stateManager.delete(req.params.key);
      res.json({ message: 'State deleted successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Get multiple state values
  router.post('/batch', async (req, res, next) => {
    try {
      const { keys } = req.body;
      const values = await stateManager.getMany(keys);
      res.json(Object.fromEntries(values));
    } catch (error) {
      next(error);
    }
  });

  // Set multiple state values
  router.put('/batch', async (req, res, next) => {
    try {
      await stateManager.setMany(req.body);
      res.json({ message: 'Batch state updated successfully' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
`,

    'src/routes/service.routes.ts': `// Backend Service Routes
import { Router } from 'express';
import { BackendServiceIntegration } from '../orchestrator/backend-integration';

export function serviceRoutes(backendIntegration: BackendServiceIntegration): Router {
  const router = Router();

  // List all services
  router.get('/', (req, res) => {
    const services = backendIntegration.getServices();
    res.json(services);
  });

  // Get single service
  router.get('/:id', (req, res, next) => {
    const service = backendIntegration.getService(req.params.id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  });

  // Register service
  router.post('/', async (req, res, next) => {
    try {
      await backendIntegration.registerService(req.body);
      res.status(201).json({ message: 'Service registered successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Unregister service
  router.delete('/:id', async (req, res, next) => {
    try {
      await backendIntegration.unregisterService(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Check service health
  router.get('/:id/health', async (req, res, next) => {
    try {
      const isHealthy = await backendIntegration.checkHealth(req.params.id);
      res.json({ serviceId: req.params.id, healthy: isHealthy });
    } catch (error) {
      next(error);
    }
  });

  // Fetch data from service
  router.get('/:id/fetch/*', async (req, res, next) => {
    try {
      const endpoint = req.params[0] || '/';
      const data = await backendIntegration.fetchData(req.params.id, endpoint);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  // Send data to service
  router.post('/:id/send/*', async (req, res, next) => {
    try {
      const endpoint = req.params[0] || '/';
      const data = await backendIntegration.sendData(req.params.id, endpoint, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
`,

    // Frontend SDKs
    'client-sdk/microfrontend-client.ts': `// Microfrontend Client SDK
// Framework-agnostic SDK for microfrontends to communicate with orchestrator

export interface MicrofrontendClientConfig {
  orchestratorURL: string;
  microfrontendId: string;
  token?: string;
}

export class MicrofrontendClient {
  private config: MicrofrontendClientConfig;
  private ws?: WebSocket;
  private messageHandlers: Map<string, Function[]> = new Map();

  constructor(config: MicrofrontendClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Connect to orchestrator via WebSocket
    const wsURL = this.config.orchestratorURL.replace('http', 'ws');
    this.ws = new WebSocket(\`\${wsURL}/ws?token=\${this.config.token || ''}\`);

    this.ws.onopen = () => {
      console.log('Connected to orchestrator');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from orchestrator');
    };
  }

  async loadComponent(componentId: string): Promise<any> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/orchestrator/load/\${componentId}\`, {
      headers: {
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
    });

    if (!response.ok) {
      throw new Error(\`Failed to load component: \${componentId}\`);
    }

    return response.json();
  }

  async getState(key: string): Promise<any> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/state/\${key}\`, {
      headers: {
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
    });

    if (!response.ok) {
      throw new Error(\`Failed to get state: \${key}\`);
    }

    const data = await response.json();
    return data.value;
  }

  async setState(key: string, value: any): Promise<void> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/state/\${key}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      throw new Error(\`Failed to set state: \${key}\`);
    }
  }

  async updateState(key: string, updates: any): Promise<void> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/state/\${key}\`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(\`Failed to update state: \${key}\`);
    }
  }

  async fetchFromBackend(serviceId: string, endpoint: string): Promise<any> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/services/\${serviceId}/fetch/\${endpoint.replace(/^\\//, '')}\`, {
      headers: {
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
    });

    if (!response.ok) {
      throw new Error(\`Failed to fetch from backend: \${serviceId}\`);
    }

    return response.json();
  }

  async sendToBackend(serviceId: string, endpoint: string, data: any): Promise<any> {
    const response = await fetch(\`\${this.config.orchestratorURL}/api/services/\${serviceId}/send/\${endpoint.replace(/^\\//, '')}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(\`Failed to send to backend: \${serviceId}\`);
    }

    return response.json();
  }

  sendToMicrofrontend(targetId: string, type: string, payload: any): void {
    const message = {
      to: targetId,
      from: this.config.microfrontendId,
      type,
      payload,
    };

    this.ws?.send(JSON.stringify(message));
  }

  broadcast(type: string, payload: any): void {
    const message = {
      from: this.config.microfrontendId,
      type,
      payload,
    };

    this.ws?.send(JSON.stringify(message));
  }

  on(type: string, handler: Function): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)?.push(handler);
  }

  off(type: string, handler: Function): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: any): void {
    const handlers = this.messageHandlers.get(message.type) || [];
    for (const handler of handlers) {
      handler(message);
    }
  }

  destroy(): void {
    this.ws?.close();
    this.messageHandlers.clear();
  }
}

export function createMicrofrontendClient(config: MicrofrontendClientConfig): MicrofrontendClient {
  return new MicrofrontendClient(config);
}
`,

    // React Hook
    'client-sdk/react/useMicrofrontend.ts': `// React Hook for Microfrontend Integration
import { useEffect, useState, useCallback, useRef } from 'react';
import { createMicrofrontendClient, MicrofrontendClient, MicrofrontendClientConfig } from '../microfrontend-client';

export function useMicrofrontend(config: MicrofrontendClientConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<Record<string, any>>({});
  const clientRef = useRef<MicrofrontendClient | null>(null);

  useEffect(() => {
    const client = createMicrofrontendClient(config);
    clientRef.current = client;

    client.initialize().then(() => {
      setIsConnected(true);
    });

    // Set up message handlers
    client.on('state-update', (message: any) => {
      setState((prev: any) => ({
        ...prev,
        [message.key]: message.value,
      }));
    });

    return () => {
      client.destroy();
    };
  }, []);

  const loadComponent = useCallback(async (componentId: string) => {
    if (!clientRef.current) return null;
    return clientRef.current.loadComponent(componentId);
  }, []);

  const getState = useCallback(async (key: string) => {
    if (!clientRef.current) return undefined;
    return clientRef.current.getState(key);
  }, []);

  const setStateValue = useCallback(async (key: string, value: any) => {
    if (!clientRef.current) return;
    await clientRef.current.setState(key, value);
    setState((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const updateState = useCallback(async (key: string, updates: any) => {
    if (!clientRef.current) return;
    await clientRef.current.updateState(key, updates);
  }, []);

  const fetchFromBackend = useCallback(async (serviceId: string, endpoint: string) => {
    if (!clientRef.current) return null;
    return clientRef.current.fetchFromBackend(serviceId, endpoint);
  }, []);

  const sendToBackend = useCallback(async (serviceId: string, endpoint: string, data: any) => {
    if (!clientRef.current) return null;
    return clientRef.current.sendToBackend(serviceId, endpoint, data);
  }, []);

  const sendToMicrofrontend = useCallback((targetId: string, type: string, payload: any) => {
    clientRef.current?.sendToMicrofrontend(targetId, type, payload);
  }, []);

  const broadcast = useCallback((type: string, payload: any) => {
    clientRef.current?.broadcast(type, payload);
  }, []);

  return {
    isConnected,
    state,
    loadComponent,
    getState,
    setState: setStateValue,
    updateState,
    fetchFromBackend,
    sendToBackend,
    sendToMicrofrontend,
    broadcast,
  };
}
`,

    // Vue Composable
    'client-sdk/vue/useMicrofrontend.ts': `// Vue Composable for Microfrontend Integration
import { ref, onUnmounted } from 'vue';
import { createMicrofrontendClient, MicrofrontendClient, MicrofrontendClientConfig } from '../microfrontend-client';

export function useMicrofrontend(config: MicrofrontendClientConfig) {
  const isConnected = ref(false);
  const state = ref<Record<string, any>>({});

  const client = createMicrofrontendClient(config);

  client.initialize().then(() => {
    isConnected.value = true;
  });

  client.on('state-update', (message: any) => {
    state.value = {
      ...state.value,
      [message.key]: message.value,
    };
  });

  const loadComponent = async (componentId: string) => {
    return client.loadComponent(componentId);
  };

  const getState = async (key: string) => {
    return client.getState(key);
  };

  const setStateValue = async (key: string, value: any) => {
    await client.setState(key, value);
    state.value = { ...state.value, [key]: value };
  };

  const updateState = async (key: string, updates: any) => {
    await client.updateState(key, updates);
  };

  const fetchFromBackend = async (serviceId: string, endpoint: string) => {
    return client.fetchFromBackend(serviceId, endpoint);
  };

  const sendToBackend = async (serviceId: string, endpoint: string, data: any) => {
    return client.sendToBackend(serviceId, endpoint, data);
  };

  const sendToMicrofrontend = (targetId: string, type: string, payload: any) => {
    client.sendToMicrofrontend(targetId, type, payload);
  };

  const broadcast = (type: string, payload: any) => {
    client.broadcast(type, payload);
  };

  onUnmounted(() => {
    client.destroy();
  });

  return {
    isConnected,
    state,
    loadComponent,
    getState,
    setState: setStateValue,
    updateState,
    fetchFromBackend,
    sendToBackend,
    sendToMicrofrontend,
    broadcast,
  };
}
`,

    // Angular Service
    'client-sdk/angular/Microfrontend.service.ts': `// Angular Service for Microfrontend Integration
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { createMicrofrontendClient, MicrofrontendClient, MicrofrontendClientConfig } from '../microfrontend-client';

@Injectable({
  providedIn: 'root',
})
export class MicrofrontendService implements OnDestroy {
  private client: MicrofrontendClient;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private stateSubject = new BehaviorSubject<Record<string, any>>({});

  isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();
  state$: Observable<Record<string, any>> = this.stateSubject.asObservable();

  constructor(config: MicrofrontendClientConfig) {
    this.client = createMicrofrontendClient(config);

    this.client.initialize().then(() => {
      this.isConnectedSubject.next(true);
    });

    this.client.on('state-update', (message: any) => {
      const currentState = this.stateSubject.value;
      this.stateSubject.next({
        ...currentState,
        [message.key]: message.value,
      });
    });
  }

  async loadComponent(componentId: string): Promise<any> {
    return this.client.loadComponent(componentId);
  }

  async getState(key: string): Promise<any> {
    return this.client.getState(key);
  }

  async setState(key: string, value: any): Promise<void> {
    await this.client.setState(key, value);

    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      [key]: value,
    });
  }

  async updateState(key: string, updates: any): Promise<void> {
    await this.client.updateState(key, updates);
  }

  async fetchFromBackend(serviceId: string, endpoint: string): Promise<any> {
    return this.client.fetchFromBackend(serviceId, endpoint);
  }

  async sendToBackend(serviceId: string, endpoint: string, data: any): Promise<any> {
    return this.client.sendToBackend(serviceId, endpoint, data);
  }

  sendToMicrofrontend(targetId: string, type: string, payload: any): void {
    this.client.sendToMicrofrontend(targetId, type, payload);
  }

  broadcast(type: string, payload: any): void {
    this.client.broadcast(type, payload);
  }

  ngOnDestroy(): void {
    this.client.destroy();
  }
}
`,

    // Svelte Store
    'client-sdk/svelte/useMicrofrontend.ts': `// Svelte Store for Microfrontend Integration
import { writable, derived, get } from 'svelte/store';
import { createMicrofrontendClient, MicrofrontendClient, MicrofrontendClientConfig } from '../microfrontend-client';

export function createMicrofrontendStore(config: MicrofrontendClientConfig) {
  const isConnected = writable(false);
  const state = writable<Record<string, any>>({});

  const client = createMicrofrontendClient(config);

  client.initialize().then(() => {
    isConnected.set(true);
  });

  client.on('state-update', (message: any) => {
    state.update((current) => ({
      ...current,
      [message.key]: message.value,
    }));
  });

  return {
    isConnected,
    state,

    loadComponent: async (componentId: string) => {
      return client.loadComponent(componentId);
    },

    getState: async (key: string) => {
      return client.getState(key);
    },

    setState: async (key: string, value: any) => {
      await client.setState(key, value);
      state.update((current) => ({ ...current, [key]: value }));
    },

    updateState: async (key: string, updates: any) => {
      await client.updateState(key, updates);
    },

    fetchFromBackend: async (serviceId: string, endpoint: string) => {
      return client.fetchFromBackend(serviceId, endpoint);
    },

    sendToBackend: async (serviceId: string, endpoint: string, data: any) => {
      return client.sendToBackend(serviceId, endpoint, data);
    },

    sendToMicrofrontend: (targetId: string, type: string, payload: any) => {
      client.sendToMicrofrontend(targetId, type, payload);
    },

    broadcast: (type: string, payload: any) => {
      client.broadcast(type, payload);
    },

    destroy: () => {
      client.destroy();
    },
  };
}
`,

    // Documentation
    'README.md': `# Microfrontend Orchestration Service

Complete microfrontend orchestration system with backend service integration.

## Features

- **Component Registry**: Register and manage microfrontend components
- **Shared State**: Distributed state management with Redis support
- **Communication Hub**: Real-time communication between microfrontends
- **Backend Integration**: Seamless integration with backend services
- **Framework Support**: React, Vue, Angular, Svelte
- **Circuit Breaker**: Fault tolerance for backend services
- **Health Monitoring**: Automatic health checks

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Set environment variables:

\`\`\`bash
PORT=3000
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379

# Backend services
BACKEND_SERVICES=api-service,user-service
BACKEND_SERVICE_API_SERVICE_URL=http://api-service:3000
BACKEND_SERVICE_USER_SERVICE_URL=http://user-service:3000
\`\`\`

## Usage

### Starting the Server

\`\`\`bash
npm run dev
\`\`\`

### API Endpoints

#### Orchestrator

- \`GET /api/orchestrator/load/:componentId\` - Load a microfrontend
- \`POST /api/orchestrator/register\` - Register a new microfrontend
- \`GET /api/orchestrator/health\` - Health check

#### Components

- \`GET /api/components\` - List all components
- \`GET /api/components/active\` - Get active components
- \`GET /api/components/:id\` - Get component details
- \`POST /api/components\` - Register component
- \`PUT /api/components/:id\` - Update component
- \`DELETE /api/components/:id\` - Unregister component

#### State

- \`GET /api/state/:key\` - Get state value
- \`PUT /api/state/:key\` - Set state value
- \`PATCH /api/state/:key\` - Update state value
- \`DELETE /api/state/:key\` - Delete state value

#### Backend Services

- \`GET /api/services\` - List all services
- \`GET /api/services/:id\` - Get service details
- \`POST /api/services\` - Register service
- \`GET /api/services/:id/health\` - Check service health

### Frontend SDK

#### React

\`\`\`typescript
import { useMicrofrontend } from '@re-shell/microfrontend-client/react';

function MyComponent() {
  const { isConnected, state, loadComponent, setState, fetchFromBackend } = useMicrofrontend({
    orchestratorURL: 'http://localhost:3000',
    microfrontendId: 'my-mfe',
  });

  // Load another microfrontend
  const handleLoad = async () => {
    const component = await loadComponent('other-mfe');
  };

  // Update shared state
  const handleUpdateState = async () => {
    await setState('user.preferences', { theme: 'dark' });
  };

  // Fetch from backend
  const handleFetch = async () => {
    const data = await fetchFromBackend('api-service', '/users');
  };
}
\`\`\`

#### Vue

\`\`\`typescript
import { useMicrofrontend } from '@re-shell/microfrontend-client/vue';

const { isConnected, state, loadComponent, setState, fetchFromBackend } = useMicrofrontend({
  orchestratorURL: 'http://localhost:3000',
  microfrontendId: 'my-mfe',
});
\`\`\`

#### Angular

\`\`\`typescript
import { MicrofrontendService } from '@re-shell/microfrontend-client/angular';

constructor(private microfrontend: MicrofrontendService) {
  const data = await this.microfrontend.fetchFromBackend('api-service', '/users');
}
\`\`\`

#### Svelte

\`\`\`svelte
<script>
  import { createMicrofrontendStore } from '@re-shell/microfrontend-client/svelte';

  const { isConnected, state, loadComponent, setState, fetchFromBackend } = createMicrofrontendStore({
    orchestratorURL: 'http://localhost:3000',
    microfrontendId: 'my-mfe',
  });
</script>
\`\`\`

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│           Microfrontend Orchestrator Service           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ Component     │  │ State         │  │ Communi-   │ │
│  │ Registry      │  │ Manager       │  │ cation Hub │ │
│  └───────────────┘  └───────────────┘  └────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │      Backend Service Integration                 │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend Services                       │
├─────────────────────────────────────────────────────────┤
│  API Service  │  User Service  │  Product Service       │
└─────────────────────────────────────────────────────────┘
\`\`\`
`,
  },
};
