import { BackendTemplate } from '../types';

/**
 * Progressive Web App Features Template
 * Complete PWA implementation with service workers, offline support, and push notifications
 */
export const pwaFeaturesTemplate: BackendTemplate = {
  id: 'pwa-features',
  name: 'PWA Features',
  displayName: 'Progressive Web App Features',
  description: 'Complete Progressive Web App implementation with service workers, offline support, push notifications, background sync, and app shell architecture',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['pwa', 'service-worker', 'offline', 'push-notifications', 'progressive-web-app'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'socket.io': '^4.7.2',
    'web-push': '^3.6.0',
    'workbox-background-sync': '^7.0.0',
    'workbox-routing': '^7.0.0',
    'workbox-strategies': '^7.0.0',
    'workbox-expiration': '^7.0.0',
    'workbox-precaching': '^7.0.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/web-push': '^3.6.0',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
    'vite': '^5.0.0',
    'vite-plugin-pwa': '^0.17.0',
    'workbox-window': '^7.0.0',
  },
  features: ['rest-api', 'documentation'],

  files: {
    'package.json': `{
  "name": "{{name}}-pwa",
  "version": "1.0.0",
  "description": "{{name}} - Progressive Web App",
  "main": "dist/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "start": "node dist/index.js",
    "preview": "vite preview",
    "generate-sw": "workbox generateSW workbox-config.js",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "socket.io": "^4.7.2",
    "web-push": "^3.6.0",
    "workbox-background-sync": "^7.0.0",
    "workbox-routing": "^7.0.0",
    "workbox-strategies": "^7.0.0",
    "workbox-expiration": "^7.0.0",
    "workbox-precaching": "^7.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/web-push": "^3.6.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0",
    "workbox-window": "^7.0.0"
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
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: '{{name}} PWA',
        short_name: '{{name}}',
        description: 'Progressive Web App with offline support',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\\/\\/api\\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/push': 'http://localhost:3000',
    }
  }
});
`,

    'src/server/index.ts': `// PWA Backend Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import webpush from 'web-push';
import { PushSubscriptionManager } from './push-subscription-manager';
import { OfflineSyncManager } from './offline-sync-manager';
import { apiRoutes } from './routes/api.routes';
import { pushRoutes } from './routes/push.routes';
import { manifestRoutes } from './routes/manifest.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure web-push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'BP_x1C8vZaWvTtjzX2s9JdJjWZvZ9Z9Z9Z9Z9Z9Z9Z9Z9Z';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'private_key_here';

webpush.setVapidDetails(
  \`mailto:\${process.env.VAPID_EMAIL || 'admin@example.com'}\`,
  publicVapidKey,
  privateVapidKey
);

// Initialize managers
const pushManager = new PushSubscriptionManager(webpush);
const syncManager = new OfflineSyncManager();

// Initialize
await pushManager.initialize();
await syncManager.initialize();

// Make managers available globally
app.set('pushManager', pushManager);
app.set('syncManager', syncManager);

// Serve static files with service worker
app.use(express.static('dist/public'));

// Routes
app.use('/api', apiRoutes);
app.use('/push', pushRoutes(pushManager));
app.use('/manifest', manifestRoutes);

// Service worker endpoint
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(\`\${__dirname}/../public/sw.js\`);
});

// Push notification keys endpoint
app.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pwa: {
      enabled: true,
      pushNotifications: pushManager.isEnabled(),
      offlineSync: syncManager.isEnabled(),
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
app.listen(PORT, () => {
  console.log(\`🚀 PWA Server running on port \${PORT}\`);
  console.log(\`📱 Progressive Web App features enabled\`);
  console.log(\`🔑 VAPID Public Key: \${publicVapidKey}\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pushManager.shutdown();
  await syncManager.shutdown();
  process.exit(0);
});
`,

    'src/server/push-subscription-manager.ts': `// Push Subscription Manager
// Manages push notification subscriptions and sending

import webpush from 'web-push';
import { EventEmitter } from 'events';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
}

export class PushSubscriptionManager extends EventEmitter {
  private webpush: typeof webpush;
  private subscriptions: Map<string, PushSubscription> = new Map();
  private enabled = true;
  private initialized = false;

  constructor(webpushInstance: typeof webpush) {
    super();
    this.webpush = webpushInstance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load subscriptions from storage (Redis, database, etc.)
    // For now, start empty
    this.initialized = true;
    console.log('✅ Push Subscription Manager initialized');
  }

  async subscribe(userId: string, subscription: PushSubscription): Promise<void> {
    this.subscriptions.set(userId, subscription);
    this.emit('subscribed', { userId, subscription });
    console.log(\`✅ User \${userId} subscribed to push notifications\`);
  }

  async unsubscribe(userId: string): Promise<void> {
    this.subscriptions.delete(userId);
    this.emit('unsubscribed', { userId });
    console.log(\`❌ User \${userId} unsubscribed from push notifications\`);
  }

  async sendNotification(
    userId: string,
    payload: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      data?: any;
    }
  ): Promise<void> {
    const subscription = this.subscriptions.get(userId);

    if (!subscription) {
      console.warn(\`No subscription found for user \${userId}\`);
      return;
    }

    try {
      await this.webpush.sendNotification(
        subscription,
        JSON.stringify(payload)
      );
      this.emit('notification:sent', { userId, payload });
      console.log(\`📤 Notification sent to user \${userId}\`);
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Subscription expired, remove it
        await this.unsubscribe(userId);
        console.warn(\`⚠️  Subscription expired for user \${userId}\`);
      } else {
        console.error(\`❌ Failed to send notification to \${userId}:\`, error);
      }
      this.emit('notification:failed', { userId, error });
    }
  }

  async broadcast(payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  }): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.subscriptions.entries()).map(([userId]) =>
        this.sendNotification(userId, payload)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(\`📊 Broadcast complete: \${successful} successful, \${failed} failed\`);
  }

  getSubscriptions(): Map<string, PushSubscription> {
    return this.subscriptions;
  }

  getSubscription(userId: string): PushSubscription | undefined {
    return this.subscriptions.get(userId);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async shutdown(): Promise<void> {
    this.subscriptions.clear();
    this.enabled = false;
    this.initialized = false;
    console.log('✅ Push Subscription Manager shut down');
  }
}
`,

    'src/server/offline-sync-manager.ts': `// Offline Sync Manager
// Manages offline operations and background sync

import { EventEmitter } from 'events';

export interface OfflineOperation {
  id: string;
  userId: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: any;
  timestamp: number;
  synced: boolean;
}

export class OfflineSyncManager extends EventEmitter {
  private operations: Map<string, OfflineOperation> = new Map();
  private enabled = true;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load pending operations from storage
    // For now, start empty
    this.initialized = true;
    console.log('✅ Offline Sync Manager initialized');
  }

  async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'synced'>): Promise<string> {
    const id = this.generateId();

    const offlineOp: OfflineOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      synced: false,
    };

    this.operations.set(id, offlineOp);
    this.emit('operation:queued', offlineOp);
    console.log(\`📝 Operation queued: \${operation.method} \${operation.url}\`);

    return id;
  }

  async syncOperations(userId: string): Promise<{
    successful: number;
    failed: number;
  }> {
    const userOps = Array.from(this.operations.values())
      .filter(op => op.userId === userId && !op.synced);

    let successful = 0;
    let failed = 0;

    for (const op of userOps) {
      try {
        await this.executeOperation(op);
        op.synced = true;
        this.operations.delete(op.id);
        successful++;
        console.log(\`✅ Synced operation: \${op.id}\`);
      } catch (error) {
        failed++;
        console.error(\`❌ Failed to sync operation \${op.id}:\`, error);
      }
    }

    this.emit('sync:complete', { userId, successful, failed });

    return { successful, failed };
  }

  private async executeOperation(operation: OfflineOperation): Promise<void> {
    const response = await fetch(operation.url, {
      method: operation.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: operation.body ? JSON.stringify(operation.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
  }

  getPendingOperations(userId?: string): OfflineOperation[] {
    const ops = Array.from(this.operations.values());

    return userId
      ? ops.filter(op => op.userId === userId && !op.synced)
      : ops.filter(op => !op.synced);
  }

  clearOperations(userId?: string): void {
    if (userId) {
      const userOps = Array.from(this.operations.entries())
        .filter(([_, op]) => op.userId === userId);

      for (const [id] of userOps) {
        this.operations.delete(id);
      }
    } else {
      this.operations.clear();
    }

    this.emit('operations:cleared', { userId });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private generateId(): string {
    return \`op-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  async shutdown(): Promise<void> {
    this.operations.clear();
    this.enabled = false;
    this.initialized = false;
    console.log('✅ Offline Sync Manager shut down');
  }
}
`,

    'src/server/routes/api.routes.ts': `// API Routes
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
  res.json({
    message: 'Hello from PWA backend!',
    timestamp: new Date().toISOString(),
    data: [
      { id: 1, name: 'Item 1', synced: true },
      { id: 2, name: 'Item 2', synced: true },
      { id: 3, name: 'Item 3', synced: true },
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
    synced: true,
    createdAt: new Date().toISOString(),
  });
});

export { router as apiRoutes };
`,

    'src/server/routes/push.routes.ts': `// Push Notification Routes
import { Router } from 'express';
import { PushSubscriptionManager } from '../push-subscription-manager';

export function pushRoutes(pushManager: PushSubscriptionManager): Router {
  const router = Router();

  // Subscribe to push notifications
  router.post('/subscribe', async (req, res) => {
    const { userId, subscription } = req.body;

    try {
      await pushManager.subscribe(userId, subscription);
      res.json({ success: true, message: 'Subscribed to push notifications' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Unsubscribe from push notifications
  router.post('/unsubscribe', async (req, res) => {
    const { userId } = req.body;

    try {
      await pushManager.unsubscribe(userId);
      res.json({ success: true, message: 'Unsubscribed from push notifications' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send notification to user
  router.post('/send', async (req, res) => {
    const { userId, title, body, icon, badge, data } = req.body;

    try {
      await pushManager.sendNotification(userId, {
        title,
        body,
        icon,
        badge,
        data,
      });

      res.json({ success: true, message: 'Notification sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Broadcast notification to all users
  router.post('/broadcast', async (req, res) => {
    const { title, body, icon, badge, data } = req.body;

    try {
      await pushManager.broadcast({
        title,
        body,
        icon,
        badge,
        data,
      });

      res.json({ success: true, message: 'Broadcast sent' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get subscriptions
  router.get('/subscriptions', (req, res) => {
    const subscriptions = pushManager.getSubscriptions();
    const subscriptionList = Array.from(subscriptions.entries()).map(([userId, sub]) => ({
      userId,
      endpoint: sub.endpoint,
    }));

    res.json({ subscriptions: subscriptionList });
  });

  return router;
}
`,

    'src/server/routes/manifest.routes.ts': `// Web App Manifest Routes
import { Router } from 'express';

const router = Router();

// Serve web app manifest
router.get('/web-app-manifest.json', (req, res) => {
  res.json({
    name: '{{name}} PWA',
    short_name: '{{name}}',
    description: 'Progressive Web App with offline support',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1976d2',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  });
});

export { router as manifestRoutes };
`,

    // Frontend: Service Worker Registration
    'src/frontend/sw.ts': `// Service Worker with Workbox
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache API calls with NetworkFirst
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// Cache images with CacheFirst
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Background sync for offline POST requests
const bgSyncPlugin = new BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        console.log('Background sync success:', entry.request);
      } catch (error) {
        console.error('Background sync failed:', error);
        await queue.unshiftRequest(entry);
      }
    }
  },
});

// Handle POST/PUT/DELETE with background sync
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// App shell with NetworkFirst
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  allowlist: [/^\\/index\\.html$/, /^\\/$/],
});
registerRoute(navigationRoute);

// Skip waiting for immediate updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
      },
      actions: [
        {
          action: 'explore',
          title: 'Explore',
          icon: '/icons/icon-72x72.png',
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/icon-72x72.png',
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/explore')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('🔧 Service Worker loaded');
`,

    // Frontend: PWA Registration
    'src/frontend/pwa.ts': `// PWA Registration and Management
import { Workbox } from 'workbox-window';

let wb: Workbox | null = null;

export async function registerSW() {
  if ('serviceWorker' in navigator) {
    wb = new Workbox('/sw.js');

    // Show update prompt
    wb.addEventListener('waiting', (event) => {
      const prompt = confirm(
        'A new version is available. Would you like to update?'
      );

      if (prompt) {
        wb?.messageSkipWaiting();
      }
    });

    // Handle activated service worker
    wb.addEventListener('controlling', () => {
      console.log('Service Worker activated - refreshing page');
      window.location.reload();
    });

    // Handle installed service worker
    wb.addEventListener('installed', (event) => {
      if (!event.isUpdate) {
        console.log('Service Worker installed for the first time');
      } else {
        console.log('Service Worker updated');
      }
    });

    await wb.register();
    console.log('✅ Service Worker registered');
  } else {
    console.warn('❌ Service Workers not supported');
  }
}

export async function unregisterSW() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      await registration.unregister();
      console.log('❌ Service Worker unregistered');
    }
  }
}

export function getSWInstance(): Workbox | null {
  return wb;
}

// Push notification subscription
export async function subscribeToPush(
  userId: string,
  applicationServerKey: string
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('❌ Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    });

    // Send subscription to backend
    await fetch('/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        subscription,
      }),
    });

    console.log('✅ Subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('❌ Failed to subscribe to push notifications:', error);
    return null;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Notify backend
      await fetch('/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      console.log('❌ Unsubscribed from push notifications');
    }
  } catch (error) {
    console.error('❌ Failed to unsubscribe:', error);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('❌ Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    console.log('✅ Notification permission granted');
  } else {
    console.warn('❌ Notification permission denied');
  }

  return permission;
}

export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

export function isPushNotificationSupported(): boolean {
  return 'PushManager' in window && 'Notification' in window;
}

export function isNotificationsGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
`,

    // Frontend: React App with PWA
    'src/frontend/App.tsx': `// React PWA App
import { useState, useEffect } from 'react';
import { registerSW, subscribeToPush, requestNotificationPermission, isServiceWorkerSupported } from './pwa';

interface DataItem {
  id: number;
  name: string;
  synced: boolean;
}

function App() {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId] = useState(() => \`user-\${Math.random().toString(36).substr(2, 9)}\`);
  const [swReady, setSwReady] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    initializePWA();
    fetchData();
  }, []);

  const initializePWA = async () => {
    // Register service worker
    if (isServiceWorkerSupported()) {
      await registerSW();
      setSwReady(true);
    }

    // Request notification permission
    const permission = await requestNotificationPermission();

    if (permission === 'granted') {
      setPushEnabled(true);
    }
  };

  const enablePushNotifications = async () => {
    try {
      const vapidKeyResponse = await fetch('/push/vapid-public-key');
      const { publicKey } = await vapidKeyResponse.json();

      await subscribeToPush(userId, publicKey);
      alert('Push notifications enabled! You\\'ll receive updates even when the app is closed.');
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      alert('Failed to enable push notifications. Please try again.');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (name: string) => {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const item = await response.json();
      setData([...data, item]);
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const testNotification = async () => {
    try {
      await fetch('/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: 'Test Notification',
          body: 'This is a test notification from the PWA!',
          icon: '/icons/icon-192x192.png',
        }),
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #1976d2' }}>
        <h1 style={{ color: '#1976d2', margin: 0 }}>🚀 {{name}} PWA</h1>
        <p style={{ color: '#666', marginTop: '10px' }}>
          Progressive Web App with offline support and push notifications
        </p>
      </header>

      {/* PWA Status */}
      <div style={{
        padding: '16px',
        background: swReady ? '#d4edda' : '#f8d7da',
        borderRadius: '4px',
        marginBottom: '20px',
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>PWA Status</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Service Worker: {swReady ? '✅ Registered' : '❌ Not Supported'}</li>
          <li>Push Notifications: {pushEnabled ? '✅ Enabled' : '⏸️ Disabled'}</li>
          <li>Offline Support: ✅ Enabled</li>
        </ul>

        {!pushEnabled && swReady && (
          <button
            onClick={enablePushNotifications}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Enable Push Notifications
          </button>
        )}

        {pushEnabled && (
          <button
            onClick={testNotification}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Send Test Notification
          </button>
        )}
      </div>

      {/* Data Section */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#333' }}>Data from Backend</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {data.map((item) => (
              <li key={item.id}>
                {item.name} {item.synced && '✅'}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Item Form */}
      <div style={{
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '4px',
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Add New Item</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const name = formData.get('name') as string;

            if (name) {
              await createItem(name);
              (e.target as HTMLFormElement).reset();
            }
          }}
        >
          <input
            type="text"
            name="name"
            placeholder="Item name"
            required
            style={{
              padding: '10px',
              marginRight: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Add
          </button>
        </form>
      </div>

      {/* Features Section */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#e3f2fd',
        borderRadius: '4px',
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>✨ PWA Features</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>📱 <strong>Installable</strong> - Add to home screen</li>
          <li>📴 <strong>Offline Support</strong> - Works without internet</li>
          <li>🔔 <strong>Push Notifications</strong> - Receive updates</li>
          <li>⚡ <strong>Fast Loading</strong> - Cached assets</li>
          <li>🔄 <strong>Background Sync</strong> - Sync when online</li>
          <li>🎨 <strong>Native Feel</strong> - App shell architecture</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
`,

    // Documentation
    'README.md': `# Progressive Web App Features

Complete Progressive Web App implementation with service workers, offline support, and push notifications.

## Features

- **Service Worker**: Automatic caching with Workbox
- **Offline Support**: Network-first strategy for API, cache-first for assets
- **Push Notifications**: Web Push API with VAPID
- **Background Sync**: Queue offline requests and sync when online
- **App Shell**: Fast loading with shell architecture
- **Installable**: Add to home screen on supported devices

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Set environment variables:

\`\`\`bash
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_EMAIL=admin@example.com
\`\`\`

Generate VAPID keys:

\`\`\`bash
npx web-push generate-vapid-keys
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Building

\`\`\`bash
npm run build
\`\`\`

## PWA Features

### Service Worker

The service worker automatically:
- Precaches static assets
- Caches API responses (24 hours)
- Caches images (30 days)
- Syncs offline requests when back online
- Handles push notifications

### Push Notifications

1. Request permission
2. Subscribe with VAPID key
3. Send notifications from backend

### Offline Support

- API calls use NetworkFirst strategy
- Assets use CacheFirst strategy
- Failed POST requests queued with BackgroundSync

## API Endpoints

### Push Notifications

- \`POST /push/subscribe\` - Subscribe to notifications
- \`POST /push/unsubscribe\` - Unsubscribe
- \`POST /push/send\` - Send to user
- \`POST /push/broadcast\` - Send to all users
- \`GET /push/vapid-public-key\` - Get VAPID key

### Data

- \`GET /api/data\` - Get data
- \`POST /api/data\` - Create data

### Manifest

- \`GET /manifest/web-app-manifest.json\` - App manifest
- \`GET /sw.js\` - Service worker
`,
  },
};
