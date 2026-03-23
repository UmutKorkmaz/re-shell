import { BackendTemplate } from '../types';

/**
 * Unified Dev Environment Template
 * Complete unified development environment with hot-reload across full stack
 */
export const unifiedDevEnvironmentTemplate: BackendTemplate = {
  id: 'unified-dev-environment',
  name: 'Unified Development Environment',
  displayName: 'Unified Development Environment with Hot-Reload',
  description: 'Complete unified development environment with hot-reload across frontend and backend, file watching, shared state, and WebSocket live updates',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['dev-tools', 'hot-reload', 'full-stack', 'development', 'vite'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'socket.io': '^4.7.2',
    'chokidar': '^3.5.3',
    'vite': '^5.0.0',
    'ws': '^8.14.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/ws': '^8.5.0',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
    'tsx': '^4.0.0',
    'nodemon': '^3.0.0',
    '@vitejs/plugin-react': '^4.0.0',
    'concurrently': '^8.2.0',
    'npm-run-all': '^4.1.5',
  },
  features: ['rest-api', 'documentation'],

  files: {
    'package.json': `{
  "name": "{{name}}-dev-env",
  "version": "1.0.0",
  "description": "{{name}} - Unified Development Environment",
  "main": "dist/index.js",
  "scripts": {
    "dev": "concurrently \\"npm run dev:backend\\" \\"npm run dev:frontend\\"",
    "dev:backend": "nodemon --exec tsx src/server/index.ts",
    "dev:frontend": "vite",
    "build": "tsc && vite build",
    "build:backend": "tsc",
    "build:frontend": "vite build",
    "start": "node dist/index.js",
    "start:frontend": "vite preview",
    "preview": "npm run build && npm run start:frontend",
    "lint": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "socket.io": "^4.7.2",
    "chokidar": "^3.5.3",
    "vite": "^5.0.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "tsx": "^4.0.0",
    "nodemon": "^3.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^8.2.0",
    "npm-run-all": "^4.1.5"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
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
    "sourceMap": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "build"]
}`,

    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  publicDir: 'src/frontend/public',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
    watch: {
      usePolling: false,
      interval: 100,
    },
    hmr: {
      overlay: true,
      port: 5174,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`,

    'nodemon.json': `{
  "watch": ["src/server"],
  "ext": "ts,tsx,js,jsx,json",
  "ignore": ["src/frontend", "dist", "build", "node_modules"],
  "exec": "tsx src/server/index.ts",
  "env": {
    "NODE_ENV": "development",
    "HOT_RELOAD": "true"
  }
}`,

    'src/server/index.ts': `// Unified Dev Server - Backend
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HotReloadManager } from './hot-reload-manager';
import { FileWatcher } from './file-watcher';
import { apiRoutes } from './routes/api.routes';
import { devToolsRoutes } from './routes/devtools.routes';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for dev
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize hot reload manager
const hotReloadManager = new HotReloadManager(io);
await hotReloadManager.initialize();

// Initialize file watcher
const fileWatcher = new FileWatcher(hotReloadManager);
await fileWatcher.initialize();

// Routes
app.use('/api', apiRoutes);
app.use('/devtools', devToolsRoutes(hotReloadManager, fileWatcher));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    hotReload: hotReloadManager.isEnabled(),
    watchedFiles: fileWatcher.getWatchedCount(),
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
  console.log(\`🚀 Unified Dev Server running on port \${PORT}\`);
  console.log(\`📡 WebSocket server ready for hot-reload\`);
  console.log(\`📁 Watching for file changes...\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await hotReloadManager.shutdown();
  await fileWatcher.shutdown();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
`,

    'src/server/hot-reload-manager.ts': `// Hot Reload Manager
// Manages hot-reload functionality for both frontend and backend

import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';

export interface ReloadEvent {
  type: 'backend' | 'frontend' | 'shared';
  path: string;
  timestamp: number;
}

export class HotReloadManager extends EventEmitter {
  private io: Server as SocketIOServer;
  private clients: Set<string> = new Set();
  private reloadHistory: ReloadEvent[] = [];
  private maxHistorySize = 100;
  private enabled = true;
  private initialized = false;

  constructor(io: Server) {
    super();
    this.io = io;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.io.on('connection', (socket) => {
      console.log(\`📱 Client connected: \${socket.id}\`);
      this.clients.add(socket.id);

      socket.on('disconnect', () => {
        console.log(\`📱 Client disconnected: \${socket.id}\`);
        this.clients.delete(socket.id);
      });

      socket.on('reload:complete', () => {
        console.log(\`✅ Reload complete for client \${socket.id}\`);
      });

      // Send current state
      socket.emit('reload:connected', {
        enabled: this.enabled,
        clientsCount: this.clients.size,
      });
    });

    this.initialized = true;
    console.log('✅ Hot Reload Manager initialized');
  }

  triggerReload(event: Omit<ReloadEvent, 'timestamp'>): void {
    if (!this.enabled) return;

    const reloadEvent: ReloadEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.addToHistory(reloadEvent);
    this.broadcast(reloadEvent);

    console.log(\`🔄 \${event.type.toUpperCase()} reload triggered: \${event.path}\`);
  }

  triggerBackendReload(filePath: string): void {
    this.triggerReload({
      type: 'backend',
      path: filePath,
    });
  }

  triggerFrontendReload(filePath: string): void {
    this.triggerReload({
      type: 'frontend',
      path: filePath,
    });
  }

  triggerSharedReload(filePath: string): void {
    this.triggerReload({
      type: 'shared',
      path: filePath,
    });
  }

  broadcast(event: ReloadEvent): void {
    this.io.emit('reload:event', event);
  }

  sendToClient(clientId: string, event: ReloadEvent): void {
    this.io.to(clientId).emit('reload:event', event);
  }

  addToHistory(event: ReloadEvent): void {
    this.reloadHistory.push(event);

    if (this.reloadHistory.length > this.maxHistorySize) {
      this.reloadHistory.shift();
    }
  }

  getHistory(): ReloadEvent[] {
    return [...this.reloadHistory];
  }

  clearHistory(): void {
    this.reloadHistory = [];
  }

  enable(): void {
    this.enabled = true;
    this.emit('enabled');
    this.io.emit('reload:enabled', true);
    console.log('✅ Hot reload enabled');
  }

  disable(): void {
    this.enabled = false;
    this.emit('disabled');
    this.io.emit('reload:enabled', false);
    console.log('⏸️  Hot reload disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients);
  }

  getClientsCount(): number {
    return this.clients.size;
  }

  async shutdown(): Promise<void> {
    this.clients.clear();
    this.reloadHistory = [];
    this.enabled = false;
    this.io.close();
    this.initialized = false;
    console.log('✅ Hot Reload Manager shut down');
  }
}
`,

    'src/server/file-watcher.ts': `// File Watcher
// Watches for file changes and triggers hot-reload

import chokidar from 'chokidar';
import path from 'path';
import { HotReloadManager } from './hot-reload-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class FileWatcher {
  private hotReloadManager: HotReloadManager;
  private watcher?: chokidar.FSWatcher;
  private watchPaths: string[] = [];
  private initialized = false;

  constructor(hotReloadManager: HotReloadManager) {
    this.hotReloadManager = hotReloadManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const projectRoot = process.cwd();

    this.watchPaths = [
      path.join(projectRoot, 'src/server'),
      path.join(projectRoot, 'src/shared'),
      path.join(projectRoot, 'src/types'),
    ];

    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: /(^|[\\/\\\\])\\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 10,
      },
    });

    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileDelete(filePath));

    this.initialized = true;
    console.log('✅ File Watcher initialized');
    console.log(\`📁 Watching: \${this.watchPaths.join(', ')}\`);
  }

  private async handleFileAdd(filePath: string): Promise<void> {
    console.log(\`➕ File added: \${filePath}\`);
    this.triggerReload(filePath);
  }

  private async handleFileChange(filePath: string): Promise<void> {
    console.log(\`✏️  File changed: \${filePath}\`);

    // If it's a TypeScript file, we might need to restart the server
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      console.log('🔄 TypeScript file changed, triggering reload...');

      // Type check on change (optional, can be disabled for faster reload)
      if (process.env.ENABLE_TYPE_CHECK === 'true') {
        try {
          await execAsync('tsc --noEmit');
          console.log('✅ Type check passed');
        } catch (error) {
          console.error('❌ Type check failed:', error);
          // Don't reload if type check fails
          return;
        }
      }

      this.triggerReload(filePath);
    } else {
      this.triggerReload(filePath);
    }
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    console.log(\`🗑️  File deleted: \${filePath}\`);
    this.triggerReload(filePath);
  }

  private triggerReload(filePath: string): void {
    const relativePath = path.relative(process.cwd(), filePath);

    if (relativePath.startsWith('src/server')) {
      this.hotReloadManager.triggerBackendReload(relativePath);
    } else if (relativePath.startsWith('src/shared')) {
      this.hotReloadManager.triggerSharedReload(relativePath);
    } else if (relativePath.startsWith('src/types')) {
      this.hotReloadManager.triggerSharedReload(relativePath);
    }
  }

  getWatchedCount(): number {
    return this.watcher?.getWatched().length || 0;
  }

  getWatchedPaths(): string[] {
    return [...this.watchPaths];
  }

  async shutdown(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }

    this.watchPaths = [];
    this.initialized = false;
    console.log('✅ File Watcher shut down');
  }
}
`,

    'src/server/routes/api.routes.ts': `// API Routes with hot-reload support
import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    hotReload: process.env.HOT_RELOAD === 'true',
  });
});

/**
 * @swagger
 * /api/data:
 *   get:
 *     summary: Get sample data
 *     tags: [Data]
 *     responses:
 *       200:
 *         description: Sample data
 */
router.get('/data', (req, res) => {
  // Simulate data fetching
  res.json({
    message: 'Hello from the backend!',
    timestamp: new Date().toISOString(),
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ],
  });
});

/**
 * @swagger
 * /api/data:
 *   post:
 *     summary: Create new data
 *     tags: [Data]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Data created
 */
router.post('/data', (req, res) => {
  const { name } = req.body;

  res.status(201).json({
    id: Date.now(),
    name: name || 'Untitled',
    createdAt: new Date().toISOString(),
  });
});

export { router as apiRoutes };
`,

    'src/server/routes/devtools.routes.ts': `// DevTools Routes
import { Router } from 'express';
import { HotReloadManager } from '../hot-reload-manager';
import { FileWatcher } from '../file-watcher';

export function devToolsRoutes(hotReloadManager: HotReloadManager, fileWatcher: FileWatcher): Router {
  const router = Router();

  // Get hot-reload status
  router.get('/status', (req, res) => {
    res.json({
      enabled: hotReloadManager.isEnabled(),
      connectedClients: hotReloadManager.getClientsCount(),
      watchedFiles: fileWatcher.getWatchedCount(),
      watchedPaths: fileWatcher.getWatchedPaths(),
    });
  });

  // Get reload history
  router.get('/history', (req, res) => {
    res.json({
      history: hotReloadManager.getHistory(),
    });
  });

  // Enable hot-reload
  router.post('/enable', (req, res) => {
    hotReloadManager.enable();
    res.json({ enabled: true });
  });

  // Disable hot-reload
  router.post('/disable', (req, res) => {
    hotReloadManager.disable();
    res.json({ enabled: false });
  });

  // Clear history
  router.post('/clear-history', (req, res) => {
    hotReloadManager.clearHistory();
    res.json({ message: 'History cleared' });
  });

  // Trigger manual reload
  router.post('/reload', (req, res) => {
    const { type, path } = req.body;

    if (type === 'backend') {
      hotReloadManager.triggerBackendReload(path || 'manual');
    } else if (type === 'frontend') {
      hotReloadManager.triggerFrontendReload(path || 'manual');
    } else if (type === 'shared') {
      hotReloadManager.triggerSharedReload(path || 'manual');
    } else {
      hotReloadManager.triggerReload({ type: 'backend', path: 'manual' });
    }

    res.json({ message: 'Reload triggered' });
  });

  return router;
}
`,

    // Frontend with hot-reload
    'src/frontend/main.tsx': `// Frontend Entry Point with Hot-Reload
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize WebSocket connection for hot-reload
const ws = new WebSocket(\`ws://localhost:3000\`);

ws.onopen = () => {
  console.log('📡 Connected to dev server for hot-reload');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'reload:event') {
    console.log('🔄 Reload event received:', data);
    handleReloadEvent(data);
  }
};

function handleReloadEvent(event: any) {
  const { type, path } = event;

  // Show notification
  showNotification(\`\${type.toUpperCase()} reload: \${path}\`);

  // If it's a backend change, we might want to refetch data
  if (type === 'backend') {
    console.log('🔄 Backend changed, refetching data...');
    window.dispatchEvent(new CustomEvent('backend-changed', { detail: event }));
  }

  // Frontend changes are handled by Vite HMR
  // Shared changes might need full reload
  if (type === 'shared') {
    console.log('🔄 Shared code changed, reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

function showNotification(message: string) {
  // Create notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  \`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add styles for animations
const style = document.createElement('style');
style.textContent = \`
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
\`;
document.head.appendChild(style);

// Render app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,

    'src/frontend/App.tsx': `// React App with Hot-Reload Support
import { useState, useEffect } from 'react';
import axios from 'axios';

interface DataItem {
  id: number;
  name: string;
}

function App() {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotReloadStatus, setHotReloadStatus] = useState(true);

  useEffect(() => {
    fetchData();

    // Listen for backend changes
    window.addEventListener('backend-changed', handleBackendChange);

    return () => {
      window.removeEventListener('backend-changed', handleBackendChange);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/data');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackendChange = () => {
    console.log('🔄 Backend changed, refetching data...');
    fetchData();
  };

  const toggleHotReload = async () => {
    try {
      const method = hotReloadStatus ? 'disable' : 'enable';
      await axios.post(\`/devtools/\${method}\`);
      setHotReloadStatus(!hotReloadStatus);
    } catch (error) {
      console.error('Failed to toggle hot-reload:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 Unified Dev Environment</h1>

      <div style={{
        padding: '16px',
        background: hotReloadStatus ? '#d4edda' : '#f8d7da',
        borderRadius: '4px',
        marginBottom: '20px',
      }}>
        <strong>Hot-Reload Status:</strong> {hotReloadStatus ? '✅ Enabled' : '⏸️ Disabled'}
        <button
          onClick={toggleHotReload}
          style={{ marginLeft: '10px', padding: '8px 16px', cursor: 'pointer' }}
        >
          {hotReloadStatus ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Data from Backend</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {data.map((item) => (
              <li key={item.id}>
                {item.id}: {item.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2>Add New Item</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const name = formData.get('name') as string;

            try {
              await axios.post('/api/data', { name });
              await fetchData();
              (e.target as HTMLFormElement).reset();
            } catch (error) {
              console.error('Failed to create item:', error);
            }
          }}
        >
          <input
            type="text"
            name="name"
            placeholder="Item name"
            required
            style={{ padding: '8px', marginRight: '10px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Add
          </button>
        </form>
      </div>

      <div style={{ marginTop: '20px', padding: '16px', background: '#f0f0f0', borderRadius: '4px' }}>
        <h3>💡 Hot-Reload Features:</h3>
        <ul>
          <li>✅ Backend changes automatically trigger frontend data refresh</li>
          <li>✅ Frontend changes use Vite HMR for instant updates</li>
          <li>✅ Shared code changes trigger smart reloads</li>
          <li>✅ WebSocket connection keeps everything in sync</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
`,

    'src/frontend/index.css': `/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

#root {
  min-height: 100vh;
}

/* Hot-reload notification animation */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
`,

    'src/frontend/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Unified Dev Environment</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`,

    // Documentation
    'README.md': `# Unified Development Environment

Complete unified development environment with hot-reload across frontend and backend.

## Features

- **Hot-Reload**: Automatic reloading for frontend, backend, and shared code
- **File Watching**: Intelligent file watching with debouncing
- **WebSocket Sync**: Real-time communication between dev server and clients
- **Vite Integration**: Lightning-fast frontend build with HMR
- **TypeScript Support**: Full TypeScript with type checking
- **Concurrent Dev**: Run frontend and backend in single command

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

Start the unified development environment:

\`\`\`bash
npm run dev
\`\`\`

This starts both frontend (port 5173) and backend (port 3000) with hot-reload enabled.

### Individual Services

- Backend only: \`npm run dev:backend\`
- Frontend only: \`npm run dev:frontend\`

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│              Unified Dev Environment                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ Frontend      │  │ Backend       │  │ File       │ │
│  │ (Vite + React)│◄─┤ (Express)     │◄─┤ Watcher    │ │
│  │  :5173        │  │  :3000        │  │            │ │
│  └───────────────┘  └───────────────┘  └────────────┘ │
│         ▲                   ▲                             │
│         │                   │                             │
│         └─────────┬─────────┘                             │
│                   │                                       │
│           ┌───────┴────────┐                            │
│           │ Hot-Reload      │                            │
│           │ Manager         │                            │
│           │ (WebSocket)     │                            │
│           └─────────────────┘                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Hot-Reload Behavior

### Frontend Changes
- Vite HMR updates instantly
- No full page reload
- State preserved

### Backend Changes
- WebSocket notification sent
- Frontend can refetch data automatically
- Manual restart may be needed for some changes

### Shared Code Changes
- Smart reload based on file type
- Type checking before reload (optional)
- Full reload for TypeScript files

## API Endpoints

### DevTools

- \`GET /devtools/status\` - Get hot-reload status
- \`GET /devtools/history\` - Get reload history
- \`POST /devtools/enable\` - Enable hot-reload
- \`POST /devtools/disable\` - Disable hot-reload
- \`POST /devtools/reload\` - Trigger manual reload

### Health

- \`GET /health\` - Server health check

### Data

- \`GET /api/data\` - Get sample data
- \`POST /api/data\` - Create new data

## Environment Variables

\`\`\`bash
PORT=3000                          # Backend port
FRONTEND_URL=http://localhost:5173 # Frontend URL
NODE_ENV=development               # Environment
HOT_RELOAD=true                    # Enable hot-reload
ENABLE_TYPE_CHECK=true             # Enable type checking on reload
\`\`\`

## Building

\`\`\`bash
npm run build          # Build all
npm run build:backend  # Build backend only
npm run build:frontend # Build frontend only
\`\`\`

## Production

\`\`\`bash
npm run preview        # Preview production build
\`\`\`
`,
  },
};
