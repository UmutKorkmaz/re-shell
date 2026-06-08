/**
 * Shared Configuration Server Backend Template
 * Provides a centralized configuration management service with WebSocket support
 */

import { BackendTemplate } from '../backend';

export const SharedConfigServerTemplate: BackendTemplate = {
  id: 'shared-config-server',
  name: 'shared-config-server',
  version: '1.0.0',
  displayName: 'Shared Configuration Server',
  description: 'Centralized configuration management with real-time updates via WebSocket',
  tags: ['configuration', 'websocket', 'hot-reload', 'real-time'],
  language: 'typescript',
  framework: 'Node.js',
  port: 3001,
  features: ['websockets', 'monitoring'],
  dependencies: {
    '@types/ws': '^8.5.10',
    '@types/node': '^20.11.0',
    'ws': '^8.16.0',
    'chokidar': '^3.5.3',
    'fs-extra': '^11.2.0',
    'express': '^4.18.2',
    '@types/express': '^4.17.21',
    'cors': '^2.8.5',
    '@types/cors': '^2.8.17',
  },
  devDependencies: {
    'typescript': '^5.3.3',
    'tsx': '^4.7.0',
    'nodemon': '^3.0.3',
  },

  files: {
    'src/index.ts': `import { ConfigServer } from './config/server';
import { configSchema } from './config/schema';

const PORT = process.env.PORT || 3001;
const CONFIG_PATH = process.env.CONFIG_PATH || './config/config.json';

const server = new ConfigServer(Number(PORT), CONFIG_PATH, configSchema);

server.start().then(() => {
  console.log(\`Configuration server started on port \${PORT}\`);
  console.log(\`Watching config file: \${CONFIG_PATH}\`);
}).catch((error) => {
  console.error('Failed to start configuration server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.stop().then(() => process.exit(0));
});
`,

    'src/config/server.ts': `import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { ConfigManager, ConfigChangeEvent, ConfigSchema } from './manager';

export class ConfigServer {
  private wss?: WebSocketServer;
  private httpServer?: ReturnType<typeof createServer>;
  private configManager: ConfigManager;
  private port: number;

  constructor(port: number, configPath: string, schema: ConfigSchema = {}) {
    this.port = port;
    this.configManager = new ConfigManager(configPath, schema);
    this.configManager.watch(); // Start watching config file
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => {
        this.handleHttpRequest(req, res);
      });

      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');

        // Send current configuration on connection
        ws.send(JSON.stringify({
          type: 'init',
          config: this.configManager.getAll(),
        }));

        // Handle incoming messages
        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleClientMessage(ws, message);
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Invalid JSON',
            }));
          }
        });

        // Subscribe to config changes and broadcast to clients
        const unsubscribe = this.configManager.onChange((event) => {
          this.broadcast({
            type: 'change',
            event,
          });
        });

        ws.on('close', () => {
          console.log('Client disconnected');
          unsubscribe();
        });
      });

      this.httpServer.listen(this.port, () => {
        console.log(\`Configuration server running on port \${this.port}\`);
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(200, corsHeaders);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

    const url = req.url || '';

    if (url === '/config' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(this.configManager.getAll()));
    } else if (url === '/config' && req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          this.configManager.setMany(data, 'server');
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      });
    } else if (url === '/schema' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(this.configManager.getSchema()));
    } else if (url === '/validate' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(this.configManager.validate()));
    } else if (url === '/health' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private handleClientMessage(ws: WebSocket, message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'get':
        ws.send(JSON.stringify({
          type: 'config',
          config: this.configManager.getAll(),
        }));
        break;

      case 'set':
        this.configManager.setMany(message.data as Record<string, unknown>, 'client');
        ws.send(JSON.stringify({
          type: 'success',
          message: 'Configuration updated',
        }));
        break;

      case 'validate':
        ws.send(JSON.stringify({
          type: 'validation',
          result: this.configManager.validate(),
        }));
        break;

      case 'reset':
        this.configManager.reset();
        ws.send(JSON.stringify({
          type: 'success',
          message: 'Configuration reset to defaults',
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: \`Unknown message type: \${message.type}\`,
        }));
    }
  }

  private broadcast(message: { type: string; [key: string]: unknown }): void {
    const data = JSON.stringify(message);
    this.wss?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss?.close();
      this.httpServer?.close(() => {
        console.log('Configuration server stopped');
        resolve();
      });
    });
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}
`,

    'src/config/manager.ts': `import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';

export interface ConfigValue {
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  validation?: (value: unknown) => boolean | string;
  description?: string;
  env?: string;
}

export interface ConfigSchema {
  [key: string]: ConfigValue;
}

export interface ConfigChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  source: 'server' | 'file' | 'client' | 'env';
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

export class ConfigManager {
  private config: Record<string, unknown> = {};
  private schema: ConfigSchema;
  private listeners: Set<ConfigChangeListener> = new Set();
  private fileWatcher?: chokidar.FSWatcher;
  private configPath: string;

  constructor(configPath: string, schema: ConfigSchema = {}) {
    this.configPath = configPath;
    this.schema = schema;
    this.loadConfig();
    this.loadEnvironmentOverrides();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
      } else {
        this.config = {};
      }
    } catch (error) {
      console.error(\`Failed to load config from \${this.configPath}:\`, error);
      this.config = {};
    }
  }

  private loadEnvironmentOverrides(): void {
    for (const [key, schema] of Object.entries(this.schema)) {
      if (schema.env && process.env[schema.env] !== undefined) {
        this.config[key] = this.parseValue(process.env[schema.env]!, schema.type);
      }
    }
  }

  private parseValue(value: string, type: ConfigValue['type']): unknown {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'object':
      case 'array':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  get<T = unknown>(key: string): T {
    if (key in this.config) {
      return this.config[key] as T;
    }

    if (key in this.schema && this.schema[key].defaultValue !== undefined) {
      return this.schema[key].defaultValue as T;
    }

    throw new Error(\`Configuration key "\${key}" not found\`);
  }

  set(key: string, value: unknown, source: ConfigChangeEvent['source'] = 'client'): void {
    const oldValue = this.config[key];
    const newValue = value;

    if (key in this.schema) {
      const schema = this.schema[key];
      const validation = schema.validation?.(newValue);
      if (validation !== true && validation !== undefined) {
        throw new Error(\`Validation failed for "\${key}": \${validation}\`);
      }
    }

    this.config[key] = newValue;

    const event: ConfigChangeEvent = {
      key,
      oldValue,
      newValue,
      timestamp: Date.now(),
      source,
    };
    this.notifyListeners(event);

    this.saveConfig();
  }

  setMany(values: Record<string, unknown>, source: ConfigChangeEvent['source'] = 'client'): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value, source);
    }
  }

  has(key: string): boolean {
    return key in this.config || key in this.schema;
  }

  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: ConfigChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(\`Config change listener error:\`, error);
      }
    });
  }

  private saveConfig(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(\`Failed to save config to \${this.configPath}:\`, error);
    }
  }

  watch(): void {
    if (this.fileWatcher) {
      return;
    }

    this.fileWatcher = chokidar.watch(this.configPath).on('change', () => {
      const oldConfig = { ...this.config };
      this.loadConfig();
      this.loadEnvironmentOverrides();

      for (const key of Object.keys({ ...oldConfig, ...this.config })) {
        if (oldConfig[key] !== this.config[key]) {
          const event: ConfigChangeEvent = {
            key,
            oldValue: oldConfig[key],
            newValue: this.config[key],
            timestamp: Date.now(),
            source: 'file',
          };
          this.notifyListeners(event);
        }
      }
    });
  }

  unwatch(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, schema] of Object.entries(this.schema)) {
      if (schema.required && !(key in this.config)) {
        errors.push(\`Required key "\${key}" is missing\`);
        continue;
      }

      if (key in this.config) {
        const validation = schema.validation?.(this.config[key]);
        if (validation !== true && validation !== undefined) {
          errors.push(\`Validation failed for "\${key}": \${validation}\`);
        }

        const actualType = Array.isArray(this.config[key]) ? 'array' : typeof this.config[key];
        if (actualType !== schema.type && schema.type !== 'array') {
          errors.push(\`Type mismatch for "\${key}": expected \${schema.type}, got \${actualType}\`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getSchema(): ConfigSchema {
    return { ...this.schema };
  }

  reset(): void {
    const defaults: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(this.schema)) {
      if (schema.defaultValue !== undefined) {
        defaults[key] = schema.defaultValue;
      }
    }
    this.config = defaults;
    this.saveConfig();
  }
}
`,

    'src/config/schema.ts': `import { ConfigSchema } from './manager';

export const configSchema: ConfigSchema = {
  // Application settings
  appName: {
    value: 'My App',
    type: 'string',
    required: true,
    defaultValue: 'My App',
    description: 'Application name',
  },
  environment: {
    value: 'development',
    type: 'string',
    required: true,
    defaultValue: 'development',
    validation: (value) => ['development', 'staging', 'production'].includes(value as string) || 'Must be one of: development, staging, production',
    description: 'Application environment',
  },

  // API settings
  apiUrl: {
    value: 'http://localhost:3000',
    type: 'string',
    required: true,
    defaultValue: 'http://localhost:3000',
    validation: (value) => typeof value === 'string' && value.startsWith('http') || 'Must be a valid URL',
    description: 'Base URL for API calls',
  },
  apiTimeout: {
    value: 30000,
    type: 'number',
    required: true,
    defaultValue: 30000,
    validation: (value) => typeof value === 'number' && value > 0 || 'Must be a positive number',
    description: 'API request timeout in milliseconds',
  },

  // Feature flags
  features: {
    value: {},
    type: 'object',
    required: false,
    defaultValue: {
      darkMode: true,
      notifications: true,
      analytics: false,
    },
    description: 'Feature flags',
  },

  // UI settings
  theme: {
    value: 'light',
    type: 'string',
    required: false,
    defaultValue: 'light',
    validation: (value) => ['light', 'dark', 'auto'].includes(value as string) || 'Must be one of: light, dark, auto',
    description: 'UI theme',
  },
  itemsPerPage: {
    value: 20,
    type: 'number',
    required: false,
    defaultValue: 20,
    validation: (value) => typeof value === 'number' && value > 0 && value <= 100 || 'Must be between 1 and 100',
    description: 'Number of items per page',
  },

  // Cache settings
  cacheEnabled: {
    value: true,
    type: 'boolean',
    required: false,
    defaultValue: true,
    description: 'Enable caching',
  },
  cacheTtl: {
    value: 300000,
    type: 'number',
    required: false,
    defaultValue: 300000,
    validation: (value) => typeof value === 'number' && value >= 0 || 'Must be a non-negative number',
    description: 'Cache TTL in milliseconds',
  },

  // Rate limiting
  rateLimitEnabled: {
    value: true,
    type: 'boolean',
    required: false,
    defaultValue: true,
    description: 'Enable rate limiting',
  },
  rateLimitMax: {
    value: 100,
    type: 'number',
    required: false,
    defaultValue: 100,
    validation: (value) => typeof value === 'number' && value > 0 || 'Must be a positive number',
    description: 'Maximum requests per window',
  },
  rateLimitWindow: {
    value: 60000,
    type: 'number',
    required: false,
    defaultValue: 60000,
    validation: (value) => typeof value === 'number' && value > 0 || 'Must be a positive number',
    description: 'Rate limit window in milliseconds',
  },

  // Logging
  logLevel: {
    value: 'info',
    type: 'string',
    required: false,
    defaultValue: 'info',
    validation: (value) => ['debug', 'info', 'warn', 'error'].includes(value as string) || 'Must be one of: debug, info, warn, error',
    description: 'Log level',
    env: 'LOG_LEVEL',
  },

  // Maintenance mode
  maintenanceMode: {
    value: false,
    type: 'boolean',
    required: false,
    defaultValue: false,
    description: 'Enable maintenance mode',
    env: 'MAINTENANCE_MODE',
  },
};
`,

    'src/config/index.ts': `export { ConfigServer } from './server';
export { ConfigManager, ConfigChangeEvent, ConfigChangeListener, ConfigSchema } from './manager';
export { configSchema } from './schema';
`,

    'config/config.json': `{
  "appName": "My App",
  "environment": "development",
  "apiUrl": "http://localhost:3000",
  "apiTimeout": 30000,
  "features": {
    "darkMode": true,
    "notifications": true,
    "analytics": false
  },
  "theme": "light",
  "itemsPerPage": 20,
  "cacheEnabled": true,
  "cacheTtl": 300000,
  "rateLimitEnabled": true,
  "rateLimitMax": 100,
  "rateLimitWindow": 60000,
  "logLevel": "info",
  "maintenanceMode": false
}
`,

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
}
`,

    'package.json': `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "Shared configuration server",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "nodemon --exec tsx src/index.ts",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "chokidar": "^3.5.3",
    "fs-extra": "^11.2.0",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.3"
  }
}
`,

    '.gitignore': `node_modules
dist
.env
config/config.json
*.log
.DS_Store
`,

    'README.md': `# Shared Configuration Server

Centralized configuration management with real-time updates via WebSocket.

## Features

- **Real-time updates**: Configuration changes are immediately broadcast to all connected clients via WebSocket
- **Hot-reload**: Configuration file changes are automatically detected and propagated
- **Type-safe schema**: Define configuration schema with validation
- **Environment overrides**: Override configuration with environment variables
- **HTTP API**: RESTful API for configuration management
- **WebSocket API**: Real-time bidirectional communication
- **Validation**: Automatic validation against schema

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

The server will start on port 3001 by default.

## API Endpoints

### HTTP

- \`GET /config\` - Get all configuration
- \`PUT /config\` - Update configuration
- \`GET /schema\` - Get configuration schema
- \`GET /validate\` - Validate current configuration
- \`GET /health\` - Health check

### WebSocket

Connect to \`ws://localhost:3001\` and send JSON messages:

\`\`\`json
{"type": "get"}
{"type": "set", "data": {"key": "value"}}
{"type": "validate"}
{"type": "reset"}
\`\`\`

## Configuration Schema

Edit \`src/config/schema.ts\` to define your configuration schema:

\`\`\`typescript
export const configSchema: ConfigSchema = {
  apiKey: {
    type: 'string',
    required: true,
    defaultValue: '',
    validation: (value) => typeof value === 'string' && value.length > 0 || 'API key is required',
  },
};
\`\`\`

## Client Integration

### JavaScript/TypeScript

\`\`\`typescript
import { ConfigClient } from '@re-shell/config-client';

const client = new ConfigClient('ws://localhost:3001');
await client.connect();

// Get value
const apiUrl = client.get('apiUrl');

// Set value
client.set('theme', 'dark');

// Listen for changes
client.onChange((event) => {
  console.log(\`Config changed: \${event.key}\`, event.newValue);
});
\`\`\`

### React

\`\`\`typescript
import { useConfig } from '@re-shell/config-react';

function App() {
  const { config, get, set } = useConfig(client);

  return (
    <div>
      <h1>{get('appName')}</h1>
      <button onClick={() => set('theme', 'dark')}>Dark Mode</button>
    </div>
  );
}
\`\`\`

## Environment Variables

- \`PORT\` - Server port (default: 3001)
- \`CONFIG_PATH\` - Configuration file path (default: ./config/config.json)
- \`LOG_LEVEL\` - Log level (default: info)
- \`MAINTENANCE_MODE\` - Enable maintenance mode (default: false)

## Docker

\`\`\`bash
docker build -t config-server .
docker run -p 3001:3001 -v ./config:/app/config config-server
\`\`\`
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
`,
  },
};
