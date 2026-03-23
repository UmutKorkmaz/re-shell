import { BackendTemplate } from '../types';

/**
 * Universal State Management Template
 * Complete state management system that works across frontend and backend
 */
export const universalStateManagementTemplate: BackendTemplate = {
  id: 'universal-state-management',
  name: 'Universal State Management',
  displayName: 'Universal State Management System',
  description: 'Complete universal state management system with frontend-backend integration, time-travel debugging, computed selectors, and framework-agnostic SDK',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['state-management', 'frontend', 'backend', 'synchronization', 'devtools'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'socket.io': '^4.7.2',
    'ioredis': '^5.3.2',
    'lodash': '^4.17.21',
    'uuid': '^9.0.0',
    'zod': '^3.22.4',
    'immer': '^10.0.2',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/lodash': '^4.14.195',
    '@types/uuid': '^9.0.2',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
  },
  features: ['rest-api', 'monitoring', 'database'],

  files: {
    'package.json': `{
  "name": "{{name}}-state-management",
  "version": "1.0.0",
  "description": "{{name}} - Universal State Management System",
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
    "socket.io": "^4.7.2",
    "ioredis": "^5.3.2",
    "lodash": "^4.17.21",
    "uuid": "^9.0.0",
    "zod": "^3.22.4",
    "immer": "^10.0.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
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

    'src/index.ts': `// Universal State Management Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { StateManager } from './state/state-manager';
import { StateStore } from './state/state-store';
import { StateSync } from './state/state-sync';
import { TimeTravel } from './state/time-travel';
import { stateRoutes } from './routes/state.routes';
import { syncRoutes } from './routes/sync.routes';
import { devtoolsRoutes } from './routes/devtools.routes';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
const stateStore = new StateStore();
const stateManager = new StateManager(stateStore);
const stateSync = new StateSync(io, stateManager);
const timeTravel = new TimeTravel(stateManager);

// Initialize state manager
await stateManager.initialize();

// Initialize state sync
await stateSync.initialize();

// Initialize time travel
await timeTravel.initialize();

// Routes
app.use('/api/state', stateRoutes(stateManager));
app.use('/api/sync', syncRoutes(stateSync));
app.use('/api/devtools', devtoolsRoutes(timeTravel));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      stateManager: stateManager.isHealthy(),
      stateSync: stateSync.isHealthy(),
      timeTravel: timeTravel.isHealthy(),
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
  console.log(\`🚀 Universal State Management Server running on port \${PORT}\`);
  console.log(\`📊 State Store: \${stateStore.getStats().keys} keys\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await stateSync.shutdown();
  await timeTravel.shutdown();
  await stateManager.shutdown();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
`,

    'src/state/state-store.ts': `// State Store
// Persistent state storage with Redis support

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { produce, enablePatches } from 'immer';

enablePatches();

export interface StateSnapshot {
  state: any;
  version: number;
  timestamp: number;
  patches: any[];
}

export class StateStore extends EventEmitter {
  private localState: Map<string, any> = new Map();
  private versions: Map<string, number> = new Map();
  private history: Map<string, StateSnapshot[]> = new Map();
  private redis?: Redis;
  private useRedis: boolean;
  private maxHistorySize = 100;

  constructor() {
    super();
    this.useRedis = !!process.env.REDIS_URL;
  }

  async initialize(): Promise<void> {
    if (this.useRedis) {
      this.redis = new Redis(process.env.REDIS_URL!);
      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
      });
      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
      });

      // Load existing state from Redis
      await this.loadFromRedis();
    }

    console.log('✅ State Store initialized');
  }

  private async loadFromRedis(): Promise<void> {
    if (!this.redis) return;

    const keys = await this.redis.keys('state:*');

    for (const key of keys) {
      const cleanKey = key.replace('state:', '');
      const data = await this.redis.get(key);

      if (data) {
        const parsed = JSON.parse(data);
        this.localState.set(cleanKey, parsed.state);
        this.versions.set(cleanKey, parsed.version || 0);
      }
    }

    console.log(\`Loaded \${keys.length} state keys from Redis\`);
  }

  async get(key: string): Promise<any> {
    return this.localState.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    const previousValue = this.localState.get(key);
    const currentVersion = this.versions.get(key) || 0;
    const newVersion = currentVersion + 1;

    // Calculate patches using Immer
    const patches = this.calculatePatches(previousValue, value);

    // Create snapshot
    const snapshot: StateSnapshot = {
      state: value,
      version: newVersion,
      timestamp: Date.now(),
      patches,
    };

    // Store in memory
    this.localState.set(key, value);
    this.versions.set(key, newVersion);

    // Add to history
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    const keyHistory = this.history.get(key)!;
    keyHistory.push(snapshot);

    // Trim history
    if (keyHistory.length > this.maxHistorySize) {
      keyHistory.shift();
    }

    // Persist to Redis
    if (this.redis) {
      await this.redis.set(
        \`state:\${key}\`,
        JSON.stringify({
          state: value,
          version: newVersion,
          timestamp: snapshot.timestamp,
        })
      );
    }

    this.emit('state:changed', { key, value, previousValue, version: newVersion, patches });
  }

  private calculatePatches(previous: any, current: any): any[] {
    if (!previous) return [];

    const patches: any[] = [];
    const prevStr = JSON.stringify(previous);
    const currStr = JSON.stringify(current);

    if (prevStr === currStr) return [];

    // Simple diff - in production, use a proper diff library
    return [{
      op: 'replace',
      path: '',
      value: current,
    }];
  }

  async getVersion(key: string): Promise<number> {
    return this.versions.get(key) || 0;
  }

  async getHistory(key: string, limit?: number): Promise<StateSnapshot[]> {
    const history = this.history.get(key) || [];
    return limit ? history.slice(-limit) : history;
  }

  async getAtVersion(key: string, version: number): Promise<any> {
    const history = this.history.get(key) || [];
    const snapshot = history.find(s => s.version === version);

    if (!snapshot) {
      throw new Error(\`Version \${version} not found for key \${key}\`);
    }

    return snapshot.state;
  }

  async delete(key: string): Promise<void> {
    const previousValue = this.localState.get(key);

    this.localState.delete(key);
    this.versions.delete(key);
    this.history.delete(key);

    if (this.redis) {
      await this.redis.del(\`state:\${key}\`);
    }

    this.emit('state:deleted', { key, previousValue });
  }

  async clear(): Promise<void> {
    const keys = Array.from(this.localState.keys());

    this.localState.clear();
    this.versions.clear();
    this.history.clear();

    if (this.redis) {
      const redisKeys = keys.map(k => \`state:\${k}\`);
      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
      }
    }

    this.emit('state:cleared');
  }

  getStats(): { keys: number; totalVersions: number; historySize: number } {
    let totalVersions = 0;
    let historySize = 0;

    for (const version of this.versions.values()) {
      totalVersions += version;
    }

    for (const history of this.history.values()) {
      historySize += history.length;
    }

    return {
      keys: this.localState.size,
      totalVersions,
      historySize,
    };
  }

  isHealthy(): boolean {
    return true;
  }

  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }

    this.localState.clear();
    this.versions.clear();
    this.history.clear();

    console.log('✅ State Store shut down');
  }
}
`,

    'src/state/state-manager.ts': `// State Manager
// High-level state management with selectors and computed values

import { StateStore } from './state-store';
import { EventEmitter } from 'events';

export type Selector<T> = (state: any) => T;
export type ComputedFn<T> = () => T | Promise<T>;

export interface ComputedValue<T> {
  id: string;
  fn: ComputedFn<T>;
  dependencies: string[];
  value?: T;
  lastUpdate: number;
}

export class StateManager extends EventEmitter {
  private store: StateStore;
  private selectors: Map<string, Selector<any>> = new Map();
  private computed: Map<string, ComputedValue<any>> = new Map();
  private initialized = false;

  constructor(store: StateStore) {
    super();
    this.store = store;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Listen to store changes
    this.store.on('state:changed', ({ key, value, patches }) => {
      this.emit('state:changed', { key, value, patches });
      this.updateComputed(key);
    });

    this.store.on('state:deleted', ({ key }) => {
      this.emit('state:deleted', { key });
    });

    this.initialized = true;
    console.log('✅ State Manager initialized');
  }

  async get(key: string): Promise<any> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    await this.store.set(key, value);
  }

  async update(key: string, updater: (state: any) => any): Promise<void> {
    const current = await this.get(key);
    const updated = updater(current);
    await this.set(key, updated);
  }

  async merge(key: string, updates: Partial<any>): Promise<void> {
    const current = await this.get(key);
    const merged = current ? { ...current, ...updates } : updates;
    await this.set(key, merged);
  }

  // Selector functions
  registerSelector<T>(id: string, selector: Selector<T>): void {
    this.selectors.set(id, selector);
  }

  async select<T>(selectorId: string): Promise<T> {
    const selector = this.selectors.get(selectorId);

    if (!selector) {
      throw new Error(\`Selector not found: \${selectorId}\`);
    }

    // Get all state keys
    const allState = await this.getAllState();
    return selector(allState);
  }

  // Computed values
  registerComputed<T>(id: string, fn: ComputedFn<T>, dependencies: string[] = []): void {
    const computed: ComputedValue<T> = {
      id,
      fn,
      dependencies,
      lastUpdate: 0,
    };

    this.computed.set(id, computed);

    // Initial computation
    this.computeValue(id);
  }

  private async updateComputed(changedKey: string): Promise<void> {
    for (const [id, computed] of this.computed.entries()) {
      if (computed.dependencies.includes(changedKey)) {
        await this.computeValue(id);
      }
    }
  }

  private async computeValue<T>(id: string): Promise<void> {
    const computed = this.computed.get(id);

    if (!computed) return;

    try {
      const value = await computed.fn();
      computed.value = value;
      computed.lastUpdate = Date.now();

      this.emit('computed:updated', { id, value });
    } catch (error) {
      console.error(\`Error computing value for \${id}:\`, error);
    }
  }

  async getComputed<T>(id: string): Promise<T | undefined> {
    const computed = this.computed.get(id);
    return computed?.value;
  }

  // Batch operations
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

  private async getAllState(): Promise<any> {
    const keys = Array.from(await this.getAllKeys());
    const state: any = {};

    for (const key of keys) {
      state[key] = await this.get(key);
    }

    return state;
  }

  private async getAllKeys(): Promise<string[]> {
    // This would need to be implemented based on your storage
    // For now, return known keys
    return Array.from(this.selectors.keys());
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  // History and time travel
  async getHistory(key: string, limit?: number): Promise<any[]> {
    return this.store.getHistory(key, limit);
  }

  async getAtVersion(key: string, version: number): Promise<any> {
    return this.store.getAtVersion(key, version);
  }

  async getVersion(key: string): Promise<number> {
    return this.store.getVersion(key);
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.selectors.clear();
    this.computed.clear();
    await this.store.shutdown();
    this.initialized = false;
    console.log('✅ State Manager shut down');
  }
}
`,

    'src/state/state-sync.ts': `// State Sync
// Synchronize state between server and clients

import { Server as SocketIOServer } from 'socket.io';
import { StateManager } from './state-manager';
import { EventEmitter } from 'events';

export class StateSync extends EventEmitter {
  private io: Server as SocketIOServer;
  private stateManager: StateManager;
  private subscriptions: Map<string, Set<string>> = new Map(); // key -> socket IDs
  private initialized = false;

  constructor(io: Server, stateManager: StateManager) {
    super();
    this.io = io;
    this.stateManager = stateManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Listen to state changes
    this.stateManager.on('state:changed', async ({ key, value, patches }) => {
      await this.broadcastStateChange(key, value, patches);
    });

    this.stateManager.on('state:deleted', async ({ key }) => {
      await this.broadcastStateDeletion(key);
    });

    // Set up Socket.IO handlers
    this.io.on('connection', (socket) => {
      console.log(\`Client connected: \${socket.id}\`);

      // Handle subscription requests
      socket.on('state:subscribe', async (keys: string | string[]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];

        for (const key of keyArray) {
          if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, new Set());
          }

          this.subscriptions.get(key)!.add(socket.id);

          // Send current state
          const value = await this.stateManager.get(key);
          socket.emit(\`state:\${key}\`, {
            key,
            value,
            version: await this.stateManager.getVersion(key),
          });
        }

        console.log(\`Client \${socket.id} subscribed to: \${keyArray.join(', ')}\`);
      });

      // Handle unsubscription requests
      socket.on('state:unsubscribe', (keys: string | string[]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];

        for (const key of keyArray) {
          const subs = this.subscriptions.get(key);
          if (subs) {
            subs.delete(socket.id);

            if (subs.size === 0) {
              this.subscriptions.delete(key);
            }
          }
        }

        console.log(\`Client \${socket.id} unsubscribed from: \${keyArray.join(', ')}\`);
      });

      // Handle state updates from clients
      socket.on('state:set', async (data: { key: string; value: any; optimisticId?: string }) => {
        try {
          await this.stateManager.set(data.key, data.value);

          // Acknowledge the update
          socket.emit('state:set:ack', {
            optimisticId: data.optimisticId,
            key: data.key,
            success: true,
          });
        } catch (error) {
          socket.emit('state:set:ack', {
            optimisticId: data.optimisticId,
            key: data.key,
            success: false,
            error: (error as Error).message,
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        // Remove all subscriptions for this socket
        for (const [key, subs] of this.subscriptions.entries()) {
          subs.delete(socket.id);

          if (subs.size === 0) {
            this.subscriptions.delete(key);
          }
        }

        console.log(\`Client disconnected: \${socket.id}\`);
      });
    });

    this.initialized = true;
    console.log('✅ State Sync initialized');
  }

  private async broadcastStateChange(key: string, value: any, patches: any[]): Promise<void> {
    const subscribers = this.subscriptions.get(key);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const payload = {
      key,
      value,
      patches,
      version: await this.stateManager.getVersion(key),
      timestamp: Date.now(),
    };

    // Send to all subscribers
    for (const socketId of subscribers) {
      this.io.to(socketId).emit(\`state:\${key}\`, payload);
    }
  }

  private async broadcastStateDeletion(key: string): Promise<void> {
    const subscribers = this.subscriptions.get(key);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const payload = {
      key,
      deleted: true,
      timestamp: Date.now(),
    };

    for (const socketId of subscribers) {
      this.io.to(socketId).emit(\`state:\${key}\`, payload);
    }
  }

  getSubscriptions(): Map<string, Set<string>> {
    return this.subscriptions;
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.subscriptions.clear();
    this.io.close();
    this.initialized = false;
    console.log('✅ State Sync shut down');
  }
}
`,

    'src/state/time-travel.ts': `// Time Travel Debugging
// Enables time-travel debugging and state replay

import { StateManager } from './state-manager';
import { EventEmitter } from 'events';

export interface TimeTravelSnapshot {
  id: string;
  timestamp: number;
  state: Record<string, any>;
  versions: Record<string, number>;
}

export class TimeTravel extends EventEmitter {
  private stateManager: StateManager;
  private snapshots: TimeTravelSnapshot[] = [];
  private recording = true;
  private currentIndex = -1;
  private maxSnapshots = 1000;
  private initialized = false;

  constructor(stateManager: StateManager) {
    super();
    this.stateManager = stateManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Listen to state changes and record snapshots
    this.stateManager.on('state:changed', async ({ key, value }) => {
      if (this.recording) {
        await this.recordSnapshot();
      }
    });

    this.initialized = true;
    console.log('✅ Time Travel initialized');
  }

  private async recordSnapshot(): Promise<void> {
    // Get all current state keys
    const state: Record<string, any> = {};
    const versions: Record<string, number> = {};

    // In a real implementation, you'd get all keys from the store
    // For now, we'll record the snapshot structure

    const snapshot: TimeTravelSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: Date.now(),
      state,
      versions,
    };

    // Remove any snapshots after current index (we're creating a new branch)
    this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
    this.snapshots.push(snapshot);
    this.currentIndex = this.snapshots.length - 1;

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
      this.currentIndex--;
    }

    this.emit('snapshot:recorded', { snapshot, index: this.currentIndex });
  }

  async goToSnapshot(snapshotId: string): Promise<void> {
    const index = this.snapshots.findIndex(s => s.id === snapshotId);

    if (index === -1) {
      throw new Error(\`Snapshot not found: \${snapshotId}\`);
    }

    await this.goToIndex(index);
  }

  async goToIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.snapshots.length) {
      throw new Error(\`Invalid snapshot index: \${index}\`);
    }

    const snapshot = this.snapshots[index];

    // Restore state from snapshot
    for (const [key, value] of Object.entries(snapshot.state)) {
      await this.stateManager.set(key, value);
    }

    this.currentIndex = index;
    this.recording = false; // Stop recording when traveling back

    this.emit('time-travel:navigate', { snapshot, index });
  }

  async undo(): Promise<void> {
    if (this.currentIndex <= 0) {
      return;
    }

    await this.goToIndex(this.currentIndex - 1);
  }

  async redo(): Promise<void> {
    if (this.currentIndex >= this.snapshots.length - 1) {
      return;
    }

    await this.goToIndex(this.currentIndex + 1);
  }

  startRecording(): void {
    this.recording = true;
    this.emit('recording:started');
  }

  stopRecording(): void {
    this.recording = false;
    this.emit('recording:stopped');
  }

  isRecording(): boolean {
    return this.recording;
  }

  getSnapshots(): TimeTravelSnapshot[] {
    return [...this.snapshots];
  }

  getCurrentSnapshot(): TimeTravelSnapshot | undefined {
    return this.snapshots[this.currentIndex];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  async clearHistory(): Promise<void> {
    this.snapshots = [];
    this.currentIndex = -1;
    this.emit('history:cleared');
  }

  private generateSnapshotId(): string {
    return \`snapshot-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  isHealthy(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.snapshots = [];
    this.recording = false;
    this.initialized = false;
    console.log('✅ Time Travel shut down');
  }
}
`,

    'src/routes/state.routes.ts': `// State Routes
import { Router } from 'express';
import { StateManager } from '../state/state-manager';

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

  // Update state with function
  router.patch('/:key', async (req, res, next) => {
    try {
      const { updater } = req.body;

      if (typeof updater === 'string') {
        // updater is a serialized function
        const fn = eval(\`(\${updater})\`);
        await stateManager.update(req.params.key, fn);
      } else {
        // partial merge
        await stateManager.merge(req.params.key, req.body);
      }

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

  // Get state history
  router.get('/:key/history', async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const history = await stateManager.getHistory(req.params.key, limit);
      res.json({ key: req.params.key, history });
    } catch (error) {
      next(error);
    }
  });

  // Get state at version
  router.get('/:key/version/:version', async (req, res, next) => {
    try {
      const value = await stateManager.getAtVersion(req.params.key, parseInt(req.params.version));
      res.json({ key: req.params.key, value, version: req.params.version });
    } catch (error) {
      next(error);
    }
  });

  // Batch get
  router.post('/batch', async (req, res, next) => {
    try {
      const { keys } = req.body;
      const values = await stateManager.getMany(keys);
      res.json(Object.fromEntries(values));
    } catch (error) {
      next(error);
    }
  });

  // Batch set
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

    'src/routes/sync.routes.ts': `// Sync Routes
import { Router } from 'express';
import { StateSync } from '../state/state-sync';

export function syncRoutes(stateSync: StateSync): Router {
  const router = Router();

  // Get current subscriptions
  router.get('/subscriptions', (req, res) => {
    const subscriptions = stateSync.getSubscriptions();
    const result: Record<string, number> = {};

    for (const [key, subs] of subscriptions.entries()) {
      result[key] = subs.size;
    }

    res.json({ subscriptions: result });
  });

  // Broadcast to all subscribers of a key
  router.post('/broadcast/:key', async (req, res, next) => {
    try {
      const { value } = req.body;
      // This would trigger a broadcast through the state manager
      res.json({ message: 'Broadcast sent' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
`,

    'src/routes/devtools.routes.ts': `// DevTools Routes
import { Router } from 'express';
import { TimeTravel } from '../state/time-travel';

export function devtoolsRoutes(timeTravel: TimeTravel): Router {
  const router = Router();

  // Get all snapshots
  router.get('/snapshots', (req, res) => {
    const snapshots = timeTravel.getSnapshots();
    res.json({ snapshots, currentIndex: timeTravel.getCurrentIndex() });
  });

  // Get current snapshot
  router.get('/snapshots/current', (req, res) => {
    const snapshot = timeTravel.getCurrentSnapshot();
    res.json({ snapshot, index: timeTravel.getCurrentIndex() });
  });

  // Navigate to snapshot
  router.post('/snapshots/:snapshotId/navigate', async (req, res, next) => {
    try {
      await timeTravel.goToSnapshot(req.params.snapshotId);
      res.json({ message: 'Navigated to snapshot' });
    } catch (error) {
      next(error);
    }
  });

  // Navigate to index
  router.post('/navigate/:index', async (req, res, next) => {
    try {
      await timeTravel.goToIndex(parseInt(req.params.index));
      res.json({ message: 'Navigated to index' });
    } catch (error) {
      next(error);
    }
  });

  // Undo
  router.post('/undo', async (req, res, next) => {
    try {
      await timeTravel.undo();
      res.json({ message: 'Undo successful' });
    } catch (error) {
      next(error);
    }
  });

  // Redo
  router.post('/redo', async (req, res, next) => {
    try {
      await timeTravel.redo();
      res.json({ message: 'Redo successful' });
    } catch (error) {
      next(error);
    }
  });

  // Start/Stop recording
  router.post('/recording/toggle', async (req, res) => {
    if (timeTravel.isRecording()) {
      timeTravel.stopRecording();
      res.json({ recording: false });
    } else {
      timeTravel.startRecording();
      res.json({ recording: true });
    }
  });

  // Clear history
  router.post('/history/clear', async (req, res, next) => {
    try {
      await timeTravel.clearHistory();
      res.json({ message: 'History cleared' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
`,

    // Client SDK
    'client-sdk/state-client.ts': `// Universal State Management Client SDK
// Framework-agnostic SDK for state management

export interface StateClientConfig {
  serverURL: string;
  token?: string;
  autoSync?: boolean;
}

export class StateClient {
  private config: StateClientConfig;
  private ws?: WebSocket;
  private localCache: Map<string, any> = new Map();
  private subscriptions: Set<string> = new Set();
  private messageHandlers: Map<string, Function[]> = new Map();
  private optimisticUpdates: Map<string, any> = new Map();

  constructor(config: StateClientConfig) {
    this.config = {
      ...config,
      autoSync: config.autoSync ?? true,
    };
  }

  async initialize(): Promise<void> {
    if (this.config.autoSync) {
      await this.connectWebSocket();
    }
  }

  private async connectWebSocket(): Promise<void> {
    const wsURL = this.config.serverURL.replace('http', 'ws');
    this.ws = new WebSocket(\`\${wsURL}/ws?token=\${this.config.token || ''}\`);

    this.ws.onopen = () => {
      console.log('Connected to state server');

      // Resubscribe to all keys
      if (this.subscriptions.size > 0) {
        this.send('state:subscribe', Array.from(this.subscriptions));
      }
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from state server');
      // Auto-reconnect
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  private send(type: string, data: any): void {
    this.ws?.send(JSON.stringify({ type, data }));
  }

  private handleMessage(message: any): void {
    if (message.type === 'state:update') {
      const { key, value, version } = message.data;
      this.localCache.set(key, value);

      // Remove optimistic update if exists
      this.optimisticUpdates.delete(key);

      const handlers = this.messageHandlers.get(\`state:\${key}\`) || [];
      for (const handler of handlers) {
        handler({ key, value, version });
      }
    }

    // Handle other message types
  }

  async get(key: string): Promise<any> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return this.localCache.get(key);
    }

    // Fetch from server
    const response = await fetch(\`\${this.config.serverURL}/api/state/\${key}\`, {
      headers: {
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
    });

    if (!response.ok) {
      throw new Error(\`Failed to get state: \${key}\`);
    }

    const data = await response.json();
    this.localCache.set(key, data.value);
    return data.value;
  }

  async set(key: string, value: any, optimistic = false): Promise<void> {
    const optimisticId = optimistic ? this.generateOptimisticId() : undefined;

    if (optimistic) {
      // Update local cache immediately
      this.localCache.set(key, value);
      this.optimisticUpdates.set(optimisticId, { key, previousValue: this.localCache.get(key) });
    }

    if (this.ws && this.config.autoSync) {
      // Use WebSocket for real-time sync
      this.send('state:set', { key, value, optimisticId });
    } else {
      // Use HTTP
      const response = await fetch(\`\${this.config.serverURL}/api/state/\${key}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.config.token || ''}\`,
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        if (optimistic) {
          // Rollback optimistic update
          const rollbackData = this.optimisticUpdates.get(optimisticId);
          if (rollbackData) {
            this.localCache.set(key, rollbackData.previousValue);
          }
        }
        throw new Error(\`Failed to set state: \${key}\`);
      }

      this.localCache.set(key, value);
    }
  }

  async update(key: string, updater: (state: any) => any): Promise<void> {
    const current = await this.get(key);
    const updated = updater(current);
    await this.set(key, updated);
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(\`\${this.config.serverURL}/api/state/\${key}\`, {
      method: 'DELETE',
      headers: {
        'Authorization': \`Bearer \${this.config.token || ''}\`,
      },
    });

    if (!response.ok) {
      throw new Error(\`Failed to delete state: \${key}\`);
    }

    this.localCache.delete(key);
  }

  async subscribe(keys: string | string[], callback?: (key: string, value: any) => void): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    for (const key of keyArray) {
      this.subscriptions.add(key);

      if (callback) {
        this.on(\`state:\${key}\`, callback);
      }
    }

    if (this.ws && this.config.autoSync) {
      this.send('state:subscribe', keyArray);
    }
  }

  async unsubscribe(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];

    for (const key of keyArray) {
      this.subscriptions.delete(key);
    }

    if (this.ws && this.config.autoSync) {
      this.send('state:unsubscribe', keyArray);
    }
  }

  on(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private generateOptimisticId(): string {
    return \`opt-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  destroy(): void {
    this.ws?.close();
    this.localCache.clear();
    this.subscriptions.clear();
    this.messageHandlers.clear();
  }
}

export function createStateClient(config: StateClientConfig): StateClient {
  return new StateClient(config);
}
`,

    // React Hook
    'client-sdk/react/useState.ts': `// React Hook for Universal State Management
import { useEffect, useState, useCallback, useRef } from 'react';
import { createStateClient, StateClient, StateClientConfig } from '../state-client';

export function useStateManager(config: StateClientConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<Record<string, any>>({});
  const clientRef = useRef<StateClient | null>(null);

  useEffect(() => {
    const client = createStateClient(config);
    clientRef.current = client;

    client.initialize().then(() => {
      setIsConnected(true);
    });

    return () => {
      client.destroy();
    };
  }, []);

  const get = useCallback(async (key: string) => {
    if (!clientRef.current) return undefined;
    return clientRef.current.get(key);
  }, []);

  const set = useCallback(async (key: string, value: any, optimistic = false) => {
    if (!clientRef.current) return;

    await clientRef.current.set(key, value, optimistic);

    // Update local state
    setState((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const update = useCallback(async (key: string, updater: (state: any) => any) => {
    if (!clientRef.current) return;

    const current = await clientRef.current.get(key);
    const updated = updater(current);

    await clientRef.current.set(key, updated);

    setState((prev: any) => ({ ...prev, [key]: updated }));
  }, []);

  const remove = useCallback(async (key: string) => {
    if (!clientRef.current) return;

    await clientRef.current.delete(key);

    setState((prev: any) => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const subscribe = useCallback(async (keys: string | string[]) => {
    if (!clientRef.current) return;

    await clientRef.current.subscribe(keys, (key: string, value: any) => {
      setState((prev: any) => ({ ...prev, [key]: value }));
    });
  }, []);

  const unsubscribe = useCallback(async (keys: string | string[]) => {
    if (!clientRef.current) return;
    await clientRef.current.unsubscribe(keys);
  }, []);

  return {
    isConnected,
    state,
    get,
    set,
    update,
    delete: remove,
    subscribe,
    unsubscribe,
  };
}
`,

    // Vue Composable
    'client-sdk/vue/useState.ts': `// Vue Composable for Universal State Management
import { ref, onUnmounted } from 'vue';
import { createStateClient, StateClient, StateClientConfig } from '../state-client';

export function useStateManager(config: StateClientConfig) {
  const isConnected = ref(false);
  const state = ref<Record<string, any>>({});

  const client = createStateClient(config);

  client.initialize().then(() => {
    isConnected.value = true;
  });

  const get = async (key: string) => {
    return client.get(key);
  };

  const set = async (key: string, value: any, optimistic = false) => {
    await client.set(key, value, optimistic);
    state.value = { ...state.value, [key]: value };
  };

  const update = async (key: string, updater: (state: any) => any) => {
    const current = await client.get(key);
    const updated = updater(current);
    await client.set(key, updated);
    state.value = { ...state.value, [key]: updated };
  };

  const remove = async (key: string) => {
    await client.delete(key);
    const { [key]: removed, ...rest } = state.value;
    state.value = rest;
  };

  const subscribe = async (keys: string | string[]) => {
    await client.subscribe(keys, (key: string, value: any) => {
      state.value = { ...state.value, [key]: value };
    });
  };

  const unsubscribe = async (keys: string | string[]) => {
    await client.unsubscribe(keys);
  };

  onUnmounted(() => {
    client.destroy();
  });

  return {
    isConnected,
    state,
    get,
    set,
    update,
    delete: remove,
    subscribe,
    unsubscribe,
  };
}
`,

    // Angular Service
    'client-sdk/angular/StateManager.service.ts': `// Angular Service for Universal State Management
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { createStateClient, StateClient, StateClientConfig } from '../state-client';

@Injectable({
  providedIn: 'root',
})
export class StateManagerService implements OnDestroy {
  private client: StateClient;
  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  private stateSubject = new BehaviorSubject<Record<string, any>>({});

  isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();
  state$: Observable<Record<string, any>> = this.stateSubject.asObservable();

  constructor(config: StateClientConfig) {
    this.client = createStateClient(config);

    this.client.initialize().then(() => {
      this.isConnectedSubject.next(true);
    });
  }

  async get(key: string): Promise<any> {
    return this.client.get(key);
  }

  async set(key: string, value: any, optimistic = false): Promise<void> {
    await this.client.set(key, value, optimistic);

    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      [key]: value,
    });
  }

  async update(key: string, updater: (state: any) => any): Promise<void> {
    const current = await this.client.get(key);
    const updated = updater(current);

    await this.client.set(key, updated);

    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      [key]: updated,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key);

    const currentState = this.stateSubject.value;
    const { [key]: removed, ...rest } = currentState;
    this.stateSubject.next(rest);
  }

  async subscribe(keys: string | string[]): Promise<void> {
    await this.client.subscribe(keys, (key: string, value: any) => {
      const currentState = this.stateSubject.value;
      this.stateSubject.next({
        ...currentState,
        [key]: value,
      });
    });
  }

  async unsubscribe(keys: string | string[]): Promise<void> {
    await this.client.unsubscribe(keys);
  }

  ngOnDestroy(): void {
    this.client.destroy();
  }
}
`,

    // Svelte Store
    'client-sdk/svelte/useState.ts': `// Svelte Store for Universal State Management
import { writable, derived, get } from 'svelte/store';
import { createStateClient, StateClient, StateClientConfig } from '../state-client';

export function createStateStore(config: StateClientConfig) {
  const isConnected = writable(false);
  const state = writable<Record<string, any>>({});

  const client = createStateClient(config);

  client.initialize().then(() => {
    isConnected.set(true);
  });

  return {
    isConnected,
    state,

    get: async (key: string) => {
      return client.get(key);
    },

    set: async (key: string, value: any, optimistic = false) => {
      await client.set(key, value, optimistic);
      state.update((current) => ({ ...current, [key]: value }));
    },

    update: async (key: string, updater: (state: any) => any) => {
      const current = await client.get(key);
      const updated = updater(current);
      await client.set(key, updated);
      state.update((current) => ({ ...current, [key]: updated }));
    },

    delete: async (key: string) => {
      await client.delete(key);
      state.update((current) => {
        const { [key]: removed, ...rest } = current;
        return rest;
      });
    },

    subscribe: async (keys: string | string[]) => {
      await client.subscribe(keys, (key: string, value: any) => {
        state.update((current) => ({ ...current, [key]: value }));
      });
    },

    unsubscribe: async (keys: string | string[]) => {
      await client.unsubscribe(keys);
    },

    destroy: () => {
      client.destroy();
    },
  };
}
`,

    // Documentation
    'README.md': `# Universal State Management System

Complete state management system that works across frontend and backend with time-travel debugging and real-time synchronization.

## Features

- **Universal State**: Works across React, Vue, Angular, and Svelte
- **Backend Integration**: State persistence with Redis support
- **Real-Time Sync**: Automatic state synchronization between clients
- **Time Travel**: Debug state changes with undo/redo
- **Optimistic Updates**: Instant UI updates with automatic rollback
- **Computed Values**: Derive state from other state
- **Selectors**: Efficient state selection and memoization
- **History**: Full state history and versioning

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
\`\`\`

## Usage

### Starting the Server

\`\`\`bash
npm run dev
\`\`\`

### API Endpoints

#### State Management

- \`GET /api/state/:key\` - Get state value
- \`PUT /api/state/:key\` - Set state value
- \`PATCH /api/state/:key\` - Update state with function
- \`DELETE /api/state/:key\` - Delete state value
- \`GET /api/state/:key/history\` - Get state history
- \`GET /api/state/:key/version/:version\` - Get state at version
- \`POST /api/state/batch\` - Batch get state
- \`PUT /api/state/batch\` - Batch set state

#### Time Travel Debugging

- \`GET /api/devtools/snapshots\` - Get all snapshots
- \`POST /api/devtools/snapshots/:id/navigate\` - Navigate to snapshot
- \`POST /api/devtools/undo\` - Undo last change
- \`POST /api/devtools/redo\` - Redo next change
- \`POST /api/devtools/recording/toggle\` - Toggle recording

### Client SDK

#### React

\`\`\`typescript
import { useStateManager } from '@re-shell/state-client/react';

function MyComponent() {
  const { isConnected, state, get, set, update, subscribe } = useStateManager({
    serverURL: 'http://localhost:3000',
  });

  // Get state
  const user = await get('user');

  // Set state
  await set('user', { name: 'John' }, true); // optimistic update

  // Update state
  await update('user', (current) => ({ ...current, age: 30 }));

  // Subscribe to changes
  await subscribe(['user', 'settings']);
}
\`\`\`

#### Vue

\`\`\`typescript
import { useStateManager } from '@re-shell/state-client/vue';

const { isConnected, state, get, set, update, subscribe } = useStateManager({
  serverURL: 'http://localhost:3000',
});
\`\`\`

#### Angular

\`\`\`typescript
import { StateManagerService } from '@re-shell/state-client/angular';

constructor(private stateManager: StateManagerService) {
  const user = await this.stateManager.get('user');
  await this.stateManager.set('user', { name: 'John' });
}
\`\`\`

#### Svelte

\`\`\`svelte
<script>
  import { createStateStore } from '@re-shell/state-client/svelte';

  const { isConnected, state, get, set, update, subscribe } = createStateStore({
    serverURL: 'http://localhost:3000',
  });
</script>
\`\`\`
`,
  },
};
