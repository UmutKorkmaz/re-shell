import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class PWAContainerTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Dockerfile for PWA
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Dockerfile for development
    files.push({
      path: 'Dockerfile.dev',
      content: this.generateDockerfileDev()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Nginx configuration optimized for PWA
    files.push({
      path: 'nginx/pwa.conf',
      content: this.generateNginxConfig()
    });

    // Nginx Dockerfile
    files.push({
      path: 'nginx/Dockerfile',
      content: this.generateNginxDockerfile()
    });

    // Service Worker (Workbox)
    files.push({
      path: 'src/service-worker.ts',
      content: this.generateServiceWorker()
    });

    // Service Worker registration
    files.push({
      path: 'src/sw-register.ts',
      content: this.generateSWRegister()
    });

    // Workbox configuration
    files.push({
      path: 'workbox-config.js',
      content: this.generateWorkboxConfig()
    });

    // Web App Manifest
    files.push({
      path: 'public/manifest.json',
      content: this.generateManifest()
    });

    // Offline fallback page
    files.push({
      path: 'public/offline.html',
      content: this.generateOfflinePage()
    });

    // Cache strategies utility
    files.push({
      path: 'src/pwa/cache-strategies.ts',
      content: this.generateCacheStrategies()
    });

    // Background sync
    files.push({
      path: 'src/pwa/background-sync.ts',
      content: this.generateBackgroundSync()
    });

    // Push notifications
    files.push({
      path: 'src/pwa/push-notifications.ts',
      content: this.generatePushNotifications()
    });

    // Kubernetes manifests
    files.push({
      path: 'k8s/deployment.yaml',
      content: this.generateK8sDeployment()
    });

    files.push({
      path: 'k8s/service.yaml',
      content: this.generateK8sService()
    });

    // Build script
    files.push({
      path: 'scripts/build-pwa.sh',
      content: this.generateBuildScript()
    });

    // Environment configuration
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // Types
    files.push({
      path: 'src/pwa/types.ts',
      content: this.generateTypes()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  private generateDockerfile(): string {
    return `# Multi-stage PWA Dockerfile with Service Worker optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build PWA with Workbox service worker
ARG NODE_ENV=production
ENV NODE_ENV=\${NODE_ENV}

RUN npm run build && \\
    npm run generate-sw

# Production stage - Nginx optimized for PWA
FROM nginx:alpine AS production

# Install necessary tools
RUN apk add --no-cache curl

# Copy built PWA assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx PWA configuration
COPY nginx/pwa.conf /etc/nginx/conf.d/default.conf

# Copy service worker and manifest
COPY --from=builder /app/dist/sw.js /usr/share/nginx/html/
COPY --from=builder /app/dist/manifest.json /usr/share/nginx/html/

# Create offline page if not exists
RUN test -f /usr/share/nginx/html/offline.html || \\
    echo '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1></body></html>' > /usr/share/nginx/html/offline.html

# Security: Non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \\
    chmod -R 755 /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerfileDev(): string {
    return `# Development Dockerfile for PWA with hot reload
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Expose dev server port
EXPOSE 3000

# Enable polling for file changes in Docker
ENV CHOKIDAR_USEPOLLING=true

# Start development server
CMD ["npm", "run", "dev"]
`;
  }

  private generateDockerCompose(): string {
    return `version: '3.8'

services:
  # Production PWA
  pwa:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "\${PWA_PORT:-80}:80"
      - "\${PWA_SSL_PORT:-443}:443"
    environment:
      - NODE_ENV=production
    volumes:
      - ./certs:/etc/nginx/certs:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - pwa-network

  # Development PWA with hot reload
  pwa-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
    networks:
      - pwa-network

  # Push notification service (optional)
  push-server:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./push-server:/app
    ports:
      - "3001:3001"
    environment:
      - VAPID_PUBLIC_KEY=\${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=\${VAPID_PRIVATE_KEY}
    command: node server.js
    networks:
      - pwa-network
    profiles:
      - push

networks:
  pwa-network:
    driver: bridge

volumes:
  nginx-cache:
`;
  }

  private generateNginxConfig(): string {
    return `# Nginx configuration optimized for PWA

server {
    listen 80;
    listen [::]:80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/manifest+json
        application/xml
        application/xml+rss
        font/woff
        font/woff2
        image/svg+xml;

    # Brotli compression (if module available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # PWA-specific headers
    add_header Service-Worker-Allowed "/" always;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\\n";
        add_header Content-Type text/plain;
    }

    # Service Worker - No cache, always fresh
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        add_header Service-Worker-Allowed "/";
        try_files $uri =404;
    }

    # Service Worker map file
    location = /sw.js.map {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        try_files $uri =404;
    }

    # Workbox chunks - Cache briefly for updates
    location ~* workbox-.*\\.js$ {
        add_header Cache-Control "public, max-age=3600";
        try_files $uri =404;
    }

    # Web App Manifest - Short cache
    location = /manifest.json {
        add_header Cache-Control "public, max-age=86400";
        add_header Content-Type "application/manifest+json";
        try_files $uri =404;
    }

    # Offline page - No cache
    location = /offline.html {
        add_header Cache-Control "no-cache";
        try_files $uri =404;
    }

    # Static assets - Long cache with immutable
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # HTML files - No cache for instant updates
    location ~* \\.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri =404;
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://api:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback - All routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /offline.html;
}

# HTTPS server (uncomment and configure for production)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name localhost;
#
#     ssl_certificate /etc/nginx/certs/cert.pem;
#     ssl_certificate_key /etc/nginx/certs/key.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
#     ssl_prefer_server_ciphers off;
#
#     # Include same location blocks as above
# }
`;
  }

  private generateNginxDockerfile(): string {
    return `FROM nginx:alpine

# Copy PWA-optimized nginx config
COPY pwa.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget -q --spider http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateServiceWorker(): string {
    return `/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, Route } from 'workbox-routing';
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
  NetworkOnly
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope;

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Cache names
const CACHE_NAMES = {
  PAGES: 'pages-cache-v1',
  IMAGES: 'images-cache-v1',
  STATIC: 'static-cache-v1',
  API: 'api-cache-v1',
  FONTS: 'fonts-cache-v1'
};

// Navigation requests - Network First with offline fallback
const navigationHandler = new NetworkFirst({
  cacheName: CACHE_NAMES.PAGES,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200]
    }),
    new ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 24 * 60 * 60 // 24 hours
    })
  ]
});

// Offline fallback for navigation
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/\\/api\\//]
});
registerRoute(navigationRoute);

// Images - Cache First with expiration
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE_NAMES.IMAGES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true
      })
    ]
  })
);

// Fonts - Cache First (fonts rarely change)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: CACHE_NAMES.FONTS,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
      })
    ]
  })
);

// Static assets (JS, CSS) - Stale While Revalidate
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STATIC,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
      })
    ]
  })
);

// API requests - Network First with background sync for POST/PUT/DELETE
const bgSyncPlugin = new BackgroundSyncPlugin('api-queue', {
  maxRetentionTime: 24 * 60 // Retry for 24 hours
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: CACHE_NAMES.API,
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60 // 5 minutes
      })
    ]
  }),
  'GET'
);

// Background sync for mutations
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'PUT'
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'DELETE'
);

// Offline fallback
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html') as Promise<Response>;
      })
    );
  }
});

// Push notification handling
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {
    title: 'Notification',
    body: 'New update available',
    icon: '/icons/icon-192x192.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge || '/icons/badge-72x72.png',
      data: data.data,
      actions: data.actions
    })
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Skip waiting and claim clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent(): Promise<void> {
  // Implement content synchronization logic
  console.log('Periodic sync: Refreshing content...');
}

export {};
`;
  }

  private generateSWRegister(): string {
    return `// Service Worker Registration
import { Workbox, messageSW } from 'workbox-window';

interface SWConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export function registerServiceWorker(config: SWConfig = {}): void {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported');
    return;
  }

  const wb = new Workbox('/sw.js');

  // Track if a new SW is waiting
  let registration: ServiceWorkerRegistration | null = null;

  // Handle successful registration
  wb.addEventListener('installed', (event) => {
    if (!event.isUpdate) {
      console.log('Service worker installed for the first time');
      config.onSuccess?.(event.sw?.state === 'activated' ? wb.active! : wb.controlling!);
    }
  });

  // Handle updates
  wb.addEventListener('waiting', (event) => {
    console.log('New service worker waiting to activate');

    // Show update prompt to user
    if (config.onUpdate && registration) {
      config.onUpdate(registration);
    }

    // Auto-update after user confirmation or timeout
    showUpdatePrompt(wb);
  });

  // Handle activation
  wb.addEventListener('activated', (event) => {
    if (event.isUpdate) {
      console.log('Service worker updated');
      // Optionally refresh the page
      // window.location.reload();
    }
  });

  // Handle controller change (new SW took over)
  wb.addEventListener('controlling', () => {
    console.log('New service worker controlling the page');
    // Reload to ensure fresh content
    window.location.reload();
  });

  // Register the service worker
  wb.register()
    .then((reg) => {
      registration = reg!;
      console.log('Service worker registered:', reg);

      // Check for updates periodically
      setInterval(() => {
        reg?.update();
      }, 60 * 60 * 1000); // Check every hour
    })
    .catch((error) => {
      console.error('Service worker registration failed:', error);
    });

  // Online/offline handlers
  window.addEventListener('online', () => {
    console.log('Back online');
    config.onOnline?.();
  });

  window.addEventListener('offline', () => {
    console.log('Gone offline');
    config.onOffline?.();
  });
}

function showUpdatePrompt(wb: Workbox): void {
  // Create update notification UI
  const updateBanner = document.createElement('div');
  updateBanner.id = 'sw-update-banner';
  updateBanner.innerHTML = \`
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 16px;
    ">
      <span>A new version is available!</span>
      <button id="sw-update-btn" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      ">Update Now</button>
      <button id="sw-dismiss-btn" style="
        background: transparent;
        color: #999;
        border: none;
        padding: 8px;
        cursor: pointer;
      ">Later</button>
    </div>
  \`;

  document.body.appendChild(updateBanner);

  // Update button handler
  document.getElementById('sw-update-btn')?.addEventListener('click', () => {
    wb.messageSkipWaiting();
    updateBanner.remove();
  });

  // Dismiss button handler
  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    updateBanner.remove();
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    updateBanner.remove();
  }, 30000);
}

// Force update service worker
export function forceUpdate(): void {
  navigator.serviceWorker.ready.then((registration) => {
    registration.update();
  });
}

// Unregister service worker
export function unregisterServiceWorker(): Promise<boolean> {
  return navigator.serviceWorker.ready.then((registration) => {
    return registration.unregister();
  });
}

// Check if app is installed (PWA)
export function isAppInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export default registerServiceWorker;
`;
  }

  private generateWorkboxConfig(): string {
    return `// Workbox configuration for PWA
module.exports = {
  globDirectory: 'dist/',
  globPatterns: [
    '**/*.{html,js,css,png,jpg,jpeg,gif,svg,ico,woff,woff2,json}'
  ],
  globIgnores: [
    '**/node_modules/**/*',
    'sw.js',
    'workbox-*.js'
  ],
  swDest: 'dist/sw.js',
  swSrc: 'src/service-worker.ts',
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB

  // Runtime caching rules (additional to sw.ts)
  runtimeCaching: [
    {
      // Google Fonts stylesheets
      urlPattern: /^https:\\/\\/fonts\\.googleapis\\.com/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets'
      }
    },
    {
      // Google Fonts webfont files
      urlPattern: /^https:\\/\\/fonts\\.gstatic\\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    {
      // CDN assets
      urlPattern: /^https:\\/\\/cdn\\./,
      handler: 'CacheFirst',
      options: {
        cacheName: 'cdn-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        }
      }
    }
  ],

  // Navigation preload
  navigationPreload: true,

  // Client claims
  clientsClaim: true,
  skipWaiting: false, // Manual control via message

  // Source map generation
  sourcemap: process.env.NODE_ENV !== 'production',

  // Module mode
  mode: process.env.NODE_ENV || 'production',

  // Inject manifest
  injectManifest: {
    injectionPoint: 'self.__WB_MANIFEST'
  }
};
`;
  }

  private generateManifest(): string {
    const { name, normalizedName } = this.context;
    return JSON.stringify({
      name: name,
      short_name: normalizedName,
      description: `${name} - Progressive Web Application`,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#667eea',
      orientation: 'portrait-primary',
      scope: '/',
      icons: [
        {
          src: '/icons/icon-72x72.png',
          sizes: '72x72',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-96x96.png',
          sizes: '96x96',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-128x128.png',
          sizes: '128x128',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-144x144.png',
          sizes: '144x144',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-152x152.png',
          sizes: '152x152',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-384x384.png',
          sizes: '384x384',
          type: 'image/png',
          purpose: 'maskable any'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable any'
        }
      ],
      screenshots: [
        {
          src: '/screenshots/desktop.png',
          sizes: '1280x720',
          type: 'image/png',
          form_factor: 'wide',
          label: 'Desktop view'
        },
        {
          src: '/screenshots/mobile.png',
          sizes: '750x1334',
          type: 'image/png',
          form_factor: 'narrow',
          label: 'Mobile view'
        }
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'Open dashboard',
          url: '/dashboard',
          icons: [{ src: '/icons/shortcut-dashboard.png', sizes: '96x96' }]
        }
      ],
      categories: ['productivity', 'utilities'],
      prefer_related_applications: false,
      related_applications: []
    }, null, 2);
  }

  private generateOfflinePage(): string {
    const { name } = this.context;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - ${name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }

    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    p {
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .retry-btn {
      background: white;
      color: #667eea;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .retry-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .cached-pages {
      margin-top: 2rem;
      text-align: left;
    }

    .cached-pages h3 {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 0.5rem;
    }

    .cached-pages ul {
      list-style: none;
    }

    .cached-pages a {
      color: white;
      text-decoration: none;
      display: block;
      padding: 8px 0;
      opacity: 0.9;
    }

    .cached-pages a:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Some features may be unavailable.</p>
    <button class="retry-btn" onclick="location.reload()">Try Again</button>

    <div class="cached-pages" id="cached-pages" style="display: none;">
      <h3>Available offline:</h3>
      <ul id="cached-list"></ul>
    </div>
  </div>

  <script>
    // Show cached pages if available
    if ('caches' in window) {
      caches.open('pages-cache-v1').then(cache => {
        cache.keys().then(requests => {
          if (requests.length > 0) {
            const container = document.getElementById('cached-pages');
            const list = document.getElementById('cached-list');
            container.style.display = 'block';

            requests.slice(0, 5).forEach(request => {
              const url = new URL(request.url);
              const li = document.createElement('li');
              const a = document.createElement('a');
              a.href = url.pathname;
              a.textContent = url.pathname === '/' ? 'Home' : url.pathname;
              li.appendChild(a);
              list.appendChild(li);
            });
          }
        });
      });
    }

    // Auto-retry when online
    window.addEventListener('online', () => {
      location.reload();
    });
  </script>
</body>
</html>
`;
  }

  private generateCacheStrategies(): string {
    return `// PWA Cache Strategies Utility

export interface CacheConfig {
  name: string;
  maxEntries?: number;
  maxAgeSeconds?: number;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  pages: {
    name: 'pages-cache-v1',
    maxEntries: 50,
    maxAgeSeconds: 24 * 60 * 60 // 24 hours
  },
  images: {
    name: 'images-cache-v1',
    maxEntries: 100,
    maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
  },
  api: {
    name: 'api-cache-v1',
    maxEntries: 100,
    maxAgeSeconds: 5 * 60 // 5 minutes
  },
  static: {
    name: 'static-cache-v1',
    maxEntries: 50,
    maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
  },
  fonts: {
    name: 'fonts-cache-v1',
    maxEntries: 20,
    maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
  }
};

// Clear specific cache
export async function clearCache(cacheName: string): Promise<boolean> {
  return caches.delete(cacheName);
}

// Clear all app caches
export async function clearAllCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(name => caches.delete(name))
  );
}

// Get cache storage usage
export async function getCacheStorageUsage(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: estimate.quota
        ? Math.round((estimate.usage || 0) / estimate.quota * 100)
        : 0
    };
  }
  return { usage: 0, quota: 0, percentage: 0 };
}

// Preload critical resources
export async function preloadResources(urls: string[]): Promise<void> {
  const cache = await caches.open(CACHE_CONFIGS.static.name);
  await cache.addAll(urls);
}

// Check if resource is cached
export async function isCached(url: string): Promise<boolean> {
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const response = await cache.match(url);
    if (response) return true;
  }
  return false;
}

// Get all cached URLs
export async function getCachedUrls(): Promise<string[]> {
  const urls: string[] = [];
  const cacheNames = await caches.keys();

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    urls.push(...requests.map(req => req.url));
  }

  return urls;
}

export default CACHE_CONFIGS;
`;
  }

  private generateBackgroundSync(): string {
    return `// Background Sync for PWA

export interface SyncTask {
  id: string;
  tag: string;
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

const SYNC_STORE = 'sync-tasks';
const MAX_RETRIES = 5;

// IndexedDB helper
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pwa-sync', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
      }
    };
  });
}

// Queue a sync task
export async function queueSyncTask(
  tag: string,
  url: string,
  method: string,
  body?: any,
  headers?: Record<string, string>
): Promise<string> {
  const task: SyncTask = {
    id: \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
    tag,
    url,
    method,
    body,
    headers,
    timestamp: Date.now(),
    retries: 0
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    const request = store.add(task);

    request.onsuccess = () => {
      // Register background sync if supported
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          (registration as any).sync.register(tag);
        });
      }
      resolve(task.id);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get pending sync tasks
export async function getPendingSyncTasks(tag?: string): Promise<SyncTask[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const store = tx.objectStore(SYNC_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      let tasks = request.result as SyncTask[];
      if (tag) {
        tasks = tasks.filter(t => t.tag === tag);
      }
      resolve(tasks);
    };
    request.onerror = () => reject(request.error);
  });
}

// Process sync tasks
export async function processSyncTasks(tag: string): Promise<void> {
  const tasks = await getPendingSyncTasks(tag);

  for (const task of tasks) {
    try {
      const response = await fetch(task.url, {
        method: task.method,
        headers: {
          'Content-Type': 'application/json',
          ...task.headers
        },
        body: task.body ? JSON.stringify(task.body) : undefined
      });

      if (response.ok) {
        await removeSyncTask(task.id);
      } else if (response.status >= 500) {
        // Server error - retry later
        await updateSyncTaskRetries(task.id);
      } else {
        // Client error - don't retry
        await removeSyncTask(task.id);
      }
    } catch (error) {
      // Network error - retry later
      await updateSyncTaskRetries(task.id);
    }
  }
}

// Remove completed sync task
async function removeSyncTask(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Update retry count
async function updateSyncTaskRetries(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    const store = tx.objectStore(SYNC_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const task = getRequest.result as SyncTask;
      if (task.retries >= MAX_RETRIES) {
        store.delete(id);
      } else {
        task.retries++;
        store.put(task);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Manual sync trigger
export async function triggerSync(tag: string): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register(tag);
  } else {
    // Fallback: process immediately
    await processSyncTasks(tag);
  }
}

export default {
  queueSyncTask,
  getPendingSyncTasks,
  processSyncTasks,
  triggerSync
};
`;
  }

  private generatePushNotifications(): string {
    return `// Push Notifications for PWA

export interface PushConfig {
  vapidPublicKey: string;
  endpoint?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Get notification permission status
export function getPermissionStatus(): NotificationPermission {
  return Notification.permission;
}

// Request notification permission
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush(config: PushConfig): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const registration = await navigator.serviceWorker.ready;

  // Convert VAPID key to Uint8Array
  const applicationServerKey = urlBase64ToUint8Array(config.vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  // Send subscription to server
  if (config.endpoint) {
    await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
  }

  return subscription;
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    return subscription.unsubscribe();
  }

  return false;
}

// Get current subscription
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// Show local notification
export async function showNotification(payload: NotificationPayload): Promise<void> {
  const permission = await requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    image: payload.image,
    tag: payload.tag,
    data: payload.data,
    actions: payload.actions,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    vibrate: payload.vibrate || [200, 100, 200]
  });
}

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// Request permission and subscribe in one call
export async function enablePushNotifications(config: PushConfig): Promise<PushSubscription | null> {
  try {
    if (!isPushSupported()) {
      console.warn('Push notifications not supported');
      return null;
    }

    return await subscribeToPush(config);
  } catch (error) {
    console.error('Failed to enable push notifications:', error);
    return null;
  }
}

export default {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  showNotification,
  enablePushNotifications
};
`;
  }

  private generateK8sDeployment(): string {
    const { normalizedName } = this.context;
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${normalizedName}-pwa
  labels:
    app: ${normalizedName}
    component: pwa
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${normalizedName}
  template:
    metadata:
      labels:
        app: ${normalizedName}
        component: pwa
    spec:
      containers:
        - name: pwa
          image: ${normalizedName}-pwa:latest
          ports:
            - containerPort: 80
              name: http
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            runAsUser: 101
            readOnlyRootFilesystem: true
          volumeMounts:
            - name: cache-volume
              mountPath: /var/cache/nginx
            - name: run-volume
              mountPath: /var/run
      volumes:
        - name: cache-volume
          emptyDir: {}
        - name: run-volume
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: ${normalizedName}
                topologyKey: kubernetes.io/hostname
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${normalizedName}-pwa-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${normalizedName}-pwa
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
`;
  }

  private generateK8sService(): string {
    const { normalizedName } = this.context;
    return `apiVersion: v1
kind: Service
metadata:
  name: ${normalizedName}-pwa
  labels:
    app: ${normalizedName}
spec:
  selector:
    app: ${normalizedName}
  ports:
    - port: 80
      targetPort: 80
      name: http
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${normalizedName}-pwa-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: "on"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      # Service Worker headers
      location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
      }
      # Manifest
      location = /manifest.json {
        add_header Cache-Control "public, max-age=86400";
      }
spec:
  ingressClassName: nginx
  rules:
    - host: pwa.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${normalizedName}-pwa
                port:
                  number: 80
  tls:
    - hosts:
        - pwa.example.com
      secretName: pwa-tls-secret
`;
  }

  private generateBuildScript(): string {
    return `#!/bin/bash
set -e

# PWA Build Script

echo "Building PWA..."

# Install dependencies
npm ci

# Build application
npm run build

# Generate service worker with Workbox
echo "Generating service worker..."
npx workbox generateSW workbox-config.js

# Verify build
echo "Verifying build..."

# Check for required files
required_files=(
  "dist/index.html"
  "dist/sw.js"
  "dist/manifest.json"
)

for file in "\${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Missing required file: $file"
    exit 1
  fi
done

# Check service worker size
sw_size=$(wc -c < dist/sw.js)
if [ "$sw_size" -gt 500000 ]; then
  echo "WARNING: Service worker is large ($sw_size bytes)"
fi

echo "Build complete!"
echo "Files:"
ls -la dist/

# Docker build (optional)
if [ "$1" = "--docker" ]; then
  echo "Building Docker image..."
  docker build -t pwa-app:latest .
  echo "Docker image built: pwa-app:latest"
fi
`;
  }

  private generateEnvExample(): string {
    return `# PWA Configuration

# Server
PWA_PORT=80
PWA_SSL_PORT=443
NODE_ENV=production

# Push Notifications (VAPID keys)
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@example.com

# API
API_URL=https://api.example.com

# Analytics (optional)
GA_TRACKING_ID=UA-XXXXXXXX-X
`;
  }

  private generateTypes(): string {
    return `// PWA Types

export interface ServiceWorkerConfig {
  scope?: string;
  updateViaCache?: 'imports' | 'all' | 'none';
}

export interface CacheConfig {
  name: string;
  maxEntries?: number;
  maxAgeSeconds?: number;
}

export interface SyncTask {
  id: string;
  tag: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
}

export interface PushSubscriptionConfig {
  vapidPublicKey: string;
  endpoint?: string;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  percentage: number;
}

export interface PWAInstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Extend Window interface
declare global {
  interface Window {
    deferredPrompt?: PWAInstallEvent;
  }

  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  }
}

export {};
`;
  }

  protected generateReadme(): string {
    const { name } = this.context;
    return `# PWA Container Setup

Production-ready containerization for Progressive Web Applications.

## Features

- **Docker** - Multi-stage builds with Nginx
- **Service Worker** - Workbox caching strategies
- **Offline Support** - Fallback pages and cached content
- **Push Notifications** - Web Push API integration
- **Background Sync** - Offline-first data synchronization
- **Kubernetes** - Production deployments with HPA

## Quick Start

### Development

\`\`\`bash
# Start dev server with hot reload
docker-compose up pwa-dev

# Access at http://localhost:3000
\`\`\`

### Production

\`\`\`bash
# Build and run
./scripts/build-pwa.sh --docker
docker-compose up -d pwa
\`\`\`

## Service Worker

The service worker uses Workbox with these strategies:

| Resource | Strategy | Cache Duration |
|----------|----------|----------------|
| Pages | Network First | 24 hours |
| Images | Cache First | 30 days |
| Fonts | Cache First | 1 year |
| Static (JS/CSS) | Stale While Revalidate | 7 days |
| API GET | Network First | 5 minutes |
| API POST/PUT/DELETE | Background Sync | 24 hour retry |

### Registration

\`\`\`typescript
import { registerServiceWorker } from './sw-register';

registerServiceWorker({
  onSuccess: (reg) => console.log('SW registered'),
  onUpdate: (reg) => console.log('Update available'),
  onOffline: () => console.log('Offline'),
  onOnline: () => console.log('Online')
});
\`\`\`

## Push Notifications

\`\`\`typescript
import { enablePushNotifications, showNotification } from './pwa/push-notifications';

// Subscribe to push
await enablePushNotifications({
  vapidPublicKey: 'your-vapid-public-key',
  endpoint: '/api/push/subscribe'
});

// Show local notification
await showNotification({
  title: 'Hello',
  body: 'This is a notification',
  icon: '/icons/icon-192x192.png'
});
\`\`\`

## Background Sync

\`\`\`typescript
import { queueSyncTask, triggerSync } from './pwa/background-sync';

// Queue a task for offline sync
await queueSyncTask('api-sync', '/api/data', 'POST', { data: 'value' });

// Manually trigger sync
await triggerSync('api-sync');
\`\`\`

## Nginx Configuration

The nginx config is optimized for PWA:

- Service Worker: No cache (always fresh)
- Manifest: 24-hour cache
- Static assets: 1-year cache with immutable
- HTML: No cache for instant updates
- Gzip/Brotli compression enabled

## Kubernetes

\`\`\`bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=${name}
\`\`\`

## Environment Variables

| Variable | Description |
|----------|-------------|
| PWA_PORT | HTTP port (default: 80) |
| PWA_SSL_PORT | HTTPS port (default: 443) |
| VAPID_PUBLIC_KEY | Push notification public key |
| VAPID_PRIVATE_KEY | Push notification private key |

## Generate VAPID Keys

\`\`\`bash
npx web-push generate-vapid-keys
\`\`\`

## PWA Checklist

- [ ] Web App Manifest configured
- [ ] Service Worker registered
- [ ] Offline page available
- [ ] Icons in all required sizes
- [ ] HTTPS enabled
- [ ] Push notifications configured
- [ ] Background sync implemented

## License

MIT
`;
  }
}
