import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ModuleFederationContainerTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Docker Compose for Module Federation orchestration
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Docker Compose for development
    files.push({
      path: 'docker-compose.dev.yml',
      content: this.generateDockerComposeDev()
    });

    // Docker Compose for production
    files.push({
      path: 'docker-compose.prod.yml',
      content: this.generateDockerComposeProd()
    });

    // Host application Dockerfile
    files.push({
      path: 'host/Dockerfile',
      content: this.generateHostDockerfile()
    });

    // Remote application Dockerfile template
    files.push({
      path: 'remote/Dockerfile',
      content: this.generateRemoteDockerfile()
    });

    // Nginx reverse proxy for Module Federation
    files.push({
      path: 'nginx/nginx.conf',
      content: this.generateNginxConfig()
    });

    // Nginx Dockerfile
    files.push({
      path: 'nginx/Dockerfile',
      content: this.generateNginxDockerfile()
    });

    // Traefik configuration
    files.push({
      path: 'traefik/traefik.yml',
      content: this.generateTraefikConfig()
    });

    // Traefik dynamic configuration
    files.push({
      path: 'traefik/dynamic.yml',
      content: this.generateTraefikDynamic()
    });

    // Kubernetes manifests
    files.push({
      path: 'k8s/namespace.yaml',
      content: this.generateK8sNamespace()
    });

    files.push({
      path: 'k8s/host-deployment.yaml',
      content: this.generateK8sHostDeployment()
    });

    files.push({
      path: 'k8s/remote-deployment.yaml',
      content: this.generateK8sRemoteDeployment()
    });

    files.push({
      path: 'k8s/ingress.yaml',
      content: this.generateK8sIngress()
    });

    files.push({
      path: 'k8s/configmap.yaml',
      content: this.generateK8sConfigMap()
    });

    // Service mesh configuration (Istio)
    files.push({
      path: 'istio/virtual-service.yaml',
      content: this.generateIstioVirtualService()
    });

    files.push({
      path: 'istio/destination-rule.yaml',
      content: this.generateIstioDestinationRule()
    });

    // Scripts
    files.push({
      path: 'scripts/deploy.sh',
      content: this.generateDeployScript()
    });

    files.push({
      path: 'scripts/build-all.sh',
      content: this.generateBuildAllScript()
    });

    files.push({
      path: 'scripts/health-check.sh',
      content: this.generateHealthCheckScript()
    });

    // Environment files
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // Webpack shared config for Module Federation
    files.push({
      path: 'shared/webpack.federation.js',
      content: this.generateSharedWebpackConfig()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  private generateDockerCompose(): string {
    return `version: '3.8'

services:
  # Reverse proxy for routing
  nginx:
    build: ./nginx
    ports:
      - "\${NGINX_PORT:-80}:80"
      - "\${NGINX_SSL_PORT:-443}:443"
    depends_on:
      - host
      - remote-header
      - remote-footer
      - remote-sidebar
    networks:
      - mf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Host/Shell application
  host:
    build:
      context: ./host
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=\${NODE_ENV:-production}
      - REMOTE_HEADER_URL=http://remote-header:3001
      - REMOTE_FOOTER_URL=http://remote-footer:3002
      - REMOTE_SIDEBAR_URL=http://remote-sidebar:3003
    expose:
      - "3000"
    networks:
      - mf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.host.rule=Host(\`localhost\`)"

  # Remote: Header microfrontend
  remote-header:
    build:
      context: ./remotes/header
      dockerfile: ../../remote/Dockerfile
    environment:
      - NODE_ENV=\${NODE_ENV:-production}
      - MF_NAME=header
      - MF_PORT=3001
    expose:
      - "3001"
    networks:
      - mf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Remote: Footer microfrontend
  remote-footer:
    build:
      context: ./remotes/footer
      dockerfile: ../../remote/Dockerfile
    environment:
      - NODE_ENV=\${NODE_ENV:-production}
      - MF_NAME=footer
      - MF_PORT=3002
    expose:
      - "3002"
    networks:
      - mf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Remote: Sidebar microfrontend
  remote-sidebar:
    build:
      context: ./remotes/sidebar
      dockerfile: ../../remote/Dockerfile
    environment:
      - NODE_ENV=\${NODE_ENV:-production}
      - MF_NAME=sidebar
      - MF_PORT=3003
    expose:
      - "3003"
    networks:
      - mf-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  mf-network:
    driver: bridge

volumes:
  nginx-cache:
`;
  }

  private generateDockerComposeDev(): string {
    return `version: '3.8'

services:
  # Host with hot reload
  host:
    build:
      context: ./host
      dockerfile: Dockerfile.dev
    volumes:
      - ./host/src:/app/src
      - ./host/public:/app/public
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - REMOTE_HEADER_URL=http://localhost:3001
      - REMOTE_FOOTER_URL=http://localhost:3002
      - REMOTE_SIDEBAR_URL=http://localhost:3003
    networks:
      - mf-network-dev

  # Remote: Header with hot reload
  remote-header:
    build:
      context: ./remotes/header
      dockerfile: Dockerfile.dev
    volumes:
      - ./remotes/header/src:/app/src
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - MF_NAME=header
      - MF_PORT=3001
    networks:
      - mf-network-dev

  # Remote: Footer with hot reload
  remote-footer:
    build:
      context: ./remotes/footer
      dockerfile: Dockerfile.dev
    volumes:
      - ./remotes/footer/src:/app/src
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - MF_NAME=footer
      - MF_PORT=3002
    networks:
      - mf-network-dev

  # Remote: Sidebar with hot reload
  remote-sidebar:
    build:
      context: ./remotes/sidebar
      dockerfile: Dockerfile.dev
    volumes:
      - ./remotes/sidebar/src:/app/src
    ports:
      - "3003:3003"
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true
      - MF_NAME=sidebar
      - MF_PORT=3003
    networks:
      - mf-network-dev

networks:
  mf-network-dev:
    driver: bridge
`;
  }

  private generateDockerComposeProd(): string {
    return `version: '3.8'

services:
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      host:
        condition: service_healthy
      remote-header:
        condition: service_healthy
      remote-footer:
        condition: service_healthy
      remote-sidebar:
        condition: service_healthy
    networks:
      - mf-network-prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  host:
    build:
      context: ./host
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
    environment:
      - NODE_ENV=production
    expose:
      - "3000"
    networks:
      - mf-network-prod
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 512M
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  remote-header:
    build:
      context: ./remotes/header
      dockerfile: ../../remote/Dockerfile
      args:
        - NODE_ENV=production
    environment:
      - NODE_ENV=production
      - MF_NAME=header
    expose:
      - "3001"
    networks:
      - mf-network-prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  remote-footer:
    build:
      context: ./remotes/footer
      dockerfile: ../../remote/Dockerfile
      args:
        - NODE_ENV=production
    environment:
      - NODE_ENV=production
      - MF_NAME=footer
    expose:
      - "3002"
    networks:
      - mf-network-prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3002/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  remote-sidebar:
    build:
      context: ./remotes/sidebar
      dockerfile: ../../remote/Dockerfile
      args:
        - NODE_ENV=production
    environment:
      - NODE_ENV=production
      - MF_NAME=sidebar
    expose:
      - "3003"
    networks:
      - mf-network-prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3003/remoteEntry.js"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  mf-network-prod:
    driver: overlay
    attachable: true

secrets:
  ssl_cert:
    file: ./certs/cert.pem
  ssl_key:
    file: ./certs/key.pem
`;
  }

  private generateHostDockerfile(): string {
    return `# Multi-stage build for Module Federation Host
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source
COPY . .

# Build with Module Federation
ARG NODE_ENV=production
ENV NODE_ENV=\${NODE_ENV}

RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for Module Federation
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

# Security: Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \\
    chmod -R 755 /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateRemoteDockerfile(): string {
    return `# Multi-stage build for Module Federation Remote
FROM node:20-alpine AS builder

WORKDIR /app

ARG MF_NAME=remote
ARG MF_PORT=3001

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build with Module Federation
ENV NODE_ENV=production
ENV MF_NAME=\${MF_NAME}
ENV MF_PORT=\${MF_PORT}

RUN npm run build

# Production stage with minimal nginx
FROM nginx:alpine AS production

ARG MF_PORT=3001

# Copy built assets including remoteEntry.js
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx configuration for Module Federation remote
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 3001;
    server_name localhost;
    root /usr/share/nginx/html;

    # Enable gzip
    gzip on;
    gzip_types text/plain application/javascript application/json text/css;

    # CORS headers for Module Federation
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type' always;

    # Cache control for remoteEntry.js (short cache for updates)
    location = /remoteEntry.js {
        add_header Cache-Control "public, max-age=60";
        add_header 'Access-Control-Allow-Origin' '*' always;
    }

    # Long cache for hashed assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header 'Access-Control-Allow-Origin' '*' always;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Health check
RUN echo "OK" > /usr/share/nginx/html/health

# Security
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget -q --spider http://localhost:3001/remoteEntry.js || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateNginxConfig(): string {
    return `# Nginx configuration for Module Federation Gateway
upstream host_upstream {
    server host:3000;
    keepalive 32;
}

upstream header_upstream {
    server remote-header:3001;
    keepalive 16;
}

upstream footer_upstream {
    server remote-footer:3002;
    keepalive 16;
}

upstream sidebar_upstream {
    server remote-sidebar:3003;
    keepalive 16;
}

# Cache configuration
proxy_cache_path /var/cache/nginx/mf levels=1:2 keys_zone=mf_cache:10m max_size=100m inactive=60m;

server {
    listen 80;
    server_name localhost;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\\n";
        add_header Content-Type text/plain;
    }

    # Host application (main shell)
    location / {
        proxy_pass http://host_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Header microfrontend
    location /mf/header/ {
        rewrite ^/mf/header/(.*) /$1 break;
        proxy_pass http://header_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        # CORS for Module Federation
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;

        # Cache remoteEntry.js briefly, assets longer
        location ~* remoteEntry\\.js$ {
            proxy_pass http://header_upstream;
            proxy_cache mf_cache;
            proxy_cache_valid 200 1m;
            add_header X-Cache-Status $upstream_cache_status;
            add_header 'Access-Control-Allow-Origin' '*' always;
        }
    }

    # Footer microfrontend
    location /mf/footer/ {
        rewrite ^/mf/footer/(.*) /$1 break;
        proxy_pass http://footer_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header 'Access-Control-Allow-Origin' '*' always;

        location ~* remoteEntry\\.js$ {
            proxy_pass http://footer_upstream;
            proxy_cache mf_cache;
            proxy_cache_valid 200 1m;
            add_header X-Cache-Status $upstream_cache_status;
            add_header 'Access-Control-Allow-Origin' '*' always;
        }
    }

    # Sidebar microfrontend
    location /mf/sidebar/ {
        rewrite ^/mf/sidebar/(.*) /$1 break;
        proxy_pass http://sidebar_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header 'Access-Control-Allow-Origin' '*' always;

        location ~* remoteEntry\\.js$ {
            proxy_pass http://sidebar_upstream;
            proxy_cache mf_cache;
            proxy_cache_valid 200 1m;
            add_header X-Cache-Status $upstream_cache_status;
            add_header 'Access-Control-Allow-Origin' '*' always;
        }
    }

    # Static assets caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header 'Access-Control-Allow-Origin' '*' always;
    }
}
`;
  }

  private generateNginxDockerfile(): string {
    return `FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create cache directory
RUN mkdir -p /var/cache/nginx/mf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget -q --spider http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateTraefikConfig(): string {
    return `# Traefik configuration for Module Federation
api:
  dashboard: true
  insecure: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: mf-network
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

log:
  level: INFO

accessLog:
  filePath: "/var/log/traefik/access.log"
  bufferingSize: 100

metrics:
  prometheus:
    buckets:
      - 0.1
      - 0.3
      - 1.2
      - 5.0
`;
  }

  private generateTraefikDynamic(): string {
    return `# Traefik dynamic configuration for Module Federation
http:
  routers:
    host:
      rule: "Host(\`localhost\`)"
      service: host
      entryPoints:
        - web
      middlewares:
        - cors-headers
        - compress

    header-mf:
      rule: "Host(\`localhost\`) && PathPrefix(\`/mf/header\`)"
      service: header
      entryPoints:
        - web
      middlewares:
        - strip-mf-prefix
        - cors-headers

    footer-mf:
      rule: "Host(\`localhost\`) && PathPrefix(\`/mf/footer\`)"
      service: footer
      entryPoints:
        - web
      middlewares:
        - strip-mf-prefix
        - cors-headers

    sidebar-mf:
      rule: "Host(\`localhost\`) && PathPrefix(\`/mf/sidebar\`)"
      service: sidebar
      entryPoints:
        - web
      middlewares:
        - strip-mf-prefix
        - cors-headers

  services:
    host:
      loadBalancer:
        servers:
          - url: "http://host:3000"
        healthCheck:
          path: /health
          interval: "10s"
          timeout: "3s"

    header:
      loadBalancer:
        servers:
          - url: "http://remote-header:3001"
        healthCheck:
          path: /remoteEntry.js
          interval: "10s"
          timeout: "3s"

    footer:
      loadBalancer:
        servers:
          - url: "http://remote-footer:3002"
        healthCheck:
          path: /remoteEntry.js
          interval: "10s"
          timeout: "3s"

    sidebar:
      loadBalancer:
        servers:
          - url: "http://remote-sidebar:3003"
        healthCheck:
          path: /remoteEntry.js
          interval: "10s"
          timeout: "3s"

  middlewares:
    cors-headers:
      headers:
        accessControlAllowMethods:
          - GET
          - OPTIONS
        accessControlAllowOriginList:
          - "*"
        accessControlAllowHeaders:
          - Content-Type
        accessControlMaxAge: 100
        addVaryHeader: true

    strip-mf-prefix:
      stripPrefix:
        prefixes:
          - "/mf/header"
          - "/mf/footer"
          - "/mf/sidebar"

    compress:
      compress: {}

    rate-limit:
      rateLimit:
        average: 100
        burst: 50
`;
  }

  private generateK8sNamespace(): string {
    return `apiVersion: v1
kind: Namespace
metadata:
  name: module-federation
  labels:
    app.kubernetes.io/name: module-federation
    app.kubernetes.io/component: microfrontend
`;
  }

  private generateK8sHostDeployment(): string {
    return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: mf-host
  namespace: module-federation
  labels:
    app: mf-host
    component: shell
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mf-host
  template:
    metadata:
      labels:
        app: mf-host
        component: shell
    spec:
      containers:
        - name: host
          image: mf-host:latest
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: "production"
            - name: REMOTE_URLS
              valueFrom:
                configMapKeyRef:
                  name: mf-config
                  key: remote-urls
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
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            readOnlyRootFilesystem: true
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: mf-host
                topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: Service
metadata:
  name: mf-host
  namespace: module-federation
spec:
  selector:
    app: mf-host
  ports:
    - port: 3000
      targetPort: 3000
      name: http
  type: ClusterIP
`;
  }

  private generateK8sRemoteDeployment(): string {
    return `# Template for remote microfrontend deployments
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mf-header
  namespace: module-federation
  labels:
    app: mf-header
    component: remote
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mf-header
  template:
    metadata:
      labels:
        app: mf-header
        component: remote
    spec:
      containers:
        - name: header
          image: mf-header:latest
          ports:
            - containerPort: 3001
              name: http
          env:
            - name: MF_NAME
              value: "header"
            - name: MF_PORT
              value: "3001"
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
---
apiVersion: v1
kind: Service
metadata:
  name: mf-header
  namespace: module-federation
spec:
  selector:
    app: mf-header
  ports:
    - port: 3001
      targetPort: 3001
      name: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mf-footer
  namespace: module-federation
  labels:
    app: mf-footer
    component: remote
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mf-footer
  template:
    metadata:
      labels:
        app: mf-footer
        component: remote
    spec:
      containers:
        - name: footer
          image: mf-footer:latest
          ports:
            - containerPort: 3002
              name: http
          env:
            - name: MF_NAME
              value: "footer"
            - name: MF_PORT
              value: "3002"
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3002
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3002
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mf-footer
  namespace: module-federation
spec:
  selector:
    app: mf-footer
  ports:
    - port: 3002
      targetPort: 3002
      name: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mf-sidebar
  namespace: module-federation
  labels:
    app: mf-sidebar
    component: remote
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mf-sidebar
  template:
    metadata:
      labels:
        app: mf-sidebar
        component: remote
    spec:
      containers:
        - name: sidebar
          image: mf-sidebar:latest
          ports:
            - containerPort: 3003
              name: http
          env:
            - name: MF_NAME
              value: "sidebar"
            - name: MF_PORT
              value: "3003"
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3003
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /remoteEntry.js
              port: 3003
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mf-sidebar
  namespace: module-federation
spec:
  selector:
    app: mf-sidebar
  ports:
    - port: 3003
      targetPort: 3003
      name: http
`;
  }

  private generateK8sIngress(): string {
    return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mf-ingress
  namespace: module-federation
  annotations:
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/proxy-buffering: "on"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: SAMEORIGIN";
      more_set_headers "X-Content-Type-Options: nosniff";
spec:
  ingressClassName: nginx
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mf-host
                port:
                  number: 3000
          - path: /mf/header
            pathType: Prefix
            backend:
              service:
                name: mf-header
                port:
                  number: 3001
          - path: /mf/footer
            pathType: Prefix
            backend:
              service:
                name: mf-footer
                port:
                  number: 3002
          - path: /mf/sidebar
            pathType: Prefix
            backend:
              service:
                name: mf-sidebar
                port:
                  number: 3003
  tls:
    - hosts:
        - app.example.com
      secretName: mf-tls-secret
`;
  }

  private generateK8sConfigMap(): string {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: mf-config
  namespace: module-federation
data:
  remote-urls: |
    {
      "header": "http://mf-header:3001/remoteEntry.js",
      "footer": "http://mf-footer:3002/remoteEntry.js",
      "sidebar": "http://mf-sidebar:3003/remoteEntry.js"
    }
  webpack-shared: |
    {
      "react": { "singleton": true, "requiredVersion": false },
      "react-dom": { "singleton": true, "requiredVersion": false }
    }
`;
  }

  private generateIstioVirtualService(): string {
    return `apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: mf-virtual-service
  namespace: module-federation
spec:
  hosts:
    - "app.example.com"
  gateways:
    - mf-gateway
  http:
    # Header microfrontend
    - match:
        - uri:
            prefix: /mf/header
      rewrite:
        uri: /
      route:
        - destination:
            host: mf-header
            port:
              number: 3001
      corsPolicy:
        allowOrigins:
          - exact: "*"
        allowMethods:
          - GET
          - OPTIONS
        allowHeaders:
          - Content-Type
        maxAge: "24h"

    # Footer microfrontend
    - match:
        - uri:
            prefix: /mf/footer
      rewrite:
        uri: /
      route:
        - destination:
            host: mf-footer
            port:
              number: 3002
      corsPolicy:
        allowOrigins:
          - exact: "*"
        allowMethods:
          - GET
          - OPTIONS

    # Sidebar microfrontend
    - match:
        - uri:
            prefix: /mf/sidebar
      rewrite:
        uri: /
      route:
        - destination:
            host: mf-sidebar
            port:
              number: 3003
      corsPolicy:
        allowOrigins:
          - exact: "*"
        allowMethods:
          - GET
          - OPTIONS

    # Host application (default)
    - match:
        - uri:
            prefix: /
      route:
        - destination:
            host: mf-host
            port:
              number: 3000
      retries:
        attempts: 3
        perTryTimeout: 2s
---
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: mf-gateway
  namespace: module-federation
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "app.example.com"
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: mf-tls-credential
      hosts:
        - "app.example.com"
`;
  }

  private generateIstioDestinationRule(): string {
    return `apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: mf-destination-rules
  namespace: module-federation
spec:
  host: "*.module-federation.svc.cluster.local"
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    loadBalancer:
      simple: ROUND_ROBIN
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: mf-host-dr
  namespace: module-federation
spec:
  host: mf-host
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 500
    loadBalancer:
      simple: LEAST_CONN
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: mf-remotes-dr
  namespace: module-federation
spec:
  host: "mf-*"
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 25
        http2MaxRequests: 250
    loadBalancer:
      simple: ROUND_ROBIN
`;
  }

  private generateDeployScript(): string {
    return `#!/bin/bash
set -e

# Module Federation Container Deployment Script

ENVIRONMENT=\${1:-development}
REGISTRY=\${DOCKER_REGISTRY:-""}
TAG=\${IMAGE_TAG:-latest}

echo "Deploying Module Federation containers..."
echo "Environment: $ENVIRONMENT"
echo "Registry: $REGISTRY"
echo "Tag: $TAG"

# Build all images
./scripts/build-all.sh "$TAG"

# Deploy based on environment
case $ENVIRONMENT in
  development)
    echo "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    ;;

  staging)
    echo "Deploying to staging..."
    docker-compose -f docker-compose.yml up -d
    ;;

  production)
    echo "Deploying to production..."
    docker-compose -f docker-compose.prod.yml up -d
    ;;

  kubernetes)
    echo "Deploying to Kubernetes..."
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/host-deployment.yaml
    kubectl apply -f k8s/remote-deployment.yaml
    kubectl apply -f k8s/ingress.yaml
    ;;

  istio)
    echo "Deploying with Istio service mesh..."
    kubectl apply -f k8s/namespace.yaml
    kubectl label namespace module-federation istio-injection=enabled --overwrite
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/host-deployment.yaml
    kubectl apply -f k8s/remote-deployment.yaml
    kubectl apply -f istio/virtual-service.yaml
    kubectl apply -f istio/destination-rule.yaml
    ;;

  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo "Usage: ./deploy.sh [development|staging|production|kubernetes|istio]"
    exit 1
    ;;
esac

# Health check
echo "Waiting for services to be healthy..."
sleep 10
./scripts/health-check.sh

echo "Deployment complete!"
`;
  }

  private generateBuildAllScript(): string {
    return `#!/bin/bash
set -e

# Build all Module Federation containers

TAG=\${1:-latest}
REGISTRY=\${DOCKER_REGISTRY:-""}

echo "Building Module Federation containers with tag: $TAG"

# Build host
echo "Building host application..."
docker build -t \${REGISTRY}mf-host:$TAG ./host

# Build remotes
echo "Building header remote..."
docker build -t \${REGISTRY}mf-header:$TAG -f remote/Dockerfile ./remotes/header

echo "Building footer remote..."
docker build -t \${REGISTRY}mf-footer:$TAG -f remote/Dockerfile ./remotes/footer

echo "Building sidebar remote..."
docker build -t \${REGISTRY}mf-sidebar:$TAG -f remote/Dockerfile ./remotes/sidebar

# Build nginx
echo "Building nginx gateway..."
docker build -t \${REGISTRY}mf-nginx:$TAG ./nginx

# Push to registry if configured
if [ -n "$REGISTRY" ]; then
  echo "Pushing images to registry..."
  docker push \${REGISTRY}mf-host:$TAG
  docker push \${REGISTRY}mf-header:$TAG
  docker push \${REGISTRY}mf-footer:$TAG
  docker push \${REGISTRY}mf-sidebar:$TAG
  docker push \${REGISTRY}mf-nginx:$TAG
fi

echo "Build complete!"
docker images | grep mf-
`;
  }

  private generateHealthCheckScript(): string {
    return `#!/bin/bash

# Health check script for Module Federation containers

HOST_URL=\${HOST_URL:-http://localhost:3000}
HEADER_URL=\${HEADER_URL:-http://localhost:3001}
FOOTER_URL=\${FOOTER_URL:-http://localhost:3002}
SIDEBAR_URL=\${SIDEBAR_URL:-http://localhost:3003}

check_health() {
  local name=$1
  local url=$2
  local endpoint=$3

  echo -n "Checking $name at $url$endpoint... "

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url$endpoint" 2>/dev/null)

  if [ "$response" = "200" ]; then
    echo "OK"
    return 0
  else
    echo "FAILED (HTTP $response)"
    return 1
  fi
}

echo "Module Federation Health Check"
echo "=============================="

failures=0

check_health "Host" "$HOST_URL" "/health" || ((failures++))
check_health "Header Remote" "$HEADER_URL" "/remoteEntry.js" || ((failures++))
check_health "Footer Remote" "$FOOTER_URL" "/remoteEntry.js" || ((failures++))
check_health "Sidebar Remote" "$SIDEBAR_URL" "/remoteEntry.js" || ((failures++))

echo ""
if [ $failures -eq 0 ]; then
  echo "All services healthy!"
  exit 0
else
  echo "$failures service(s) unhealthy"
  exit 1
fi
`;
  }

  private generateEnvExample(): string {
    return `# Module Federation Container Configuration

# Environment
NODE_ENV=production

# Ports
NGINX_PORT=80
NGINX_SSL_PORT=443
HOST_PORT=3000

# Docker Registry
DOCKER_REGISTRY=
IMAGE_TAG=latest

# Remote URLs (for host configuration)
REMOTE_HEADER_URL=http://remote-header:3001
REMOTE_FOOTER_URL=http://remote-footer:3002
REMOTE_SIDEBAR_URL=http://remote-sidebar:3003

# Kubernetes
K8S_NAMESPACE=module-federation
K8S_INGRESS_HOST=app.example.com
`;
  }

  private generateSharedWebpackConfig(): string {
    return `// Shared Webpack Module Federation configuration
// Use this in all microfrontends for consistent setup

const deps = require('../package.json').dependencies;

/**
 * Creates Module Federation plugin configuration
 * @param {Object} options - Configuration options
 * @param {string} options.name - Unique name for this microfrontend
 * @param {string} options.filename - Remote entry filename (default: remoteEntry.js)
 * @param {Object} options.exposes - Components to expose
 * @param {Object} options.remotes - Remote microfrontends to consume
 * @param {number} options.port - Development server port
 */
function createModuleFederationConfig(options) {
  const {
    name,
    filename = 'remoteEntry.js',
    exposes = {},
    remotes = {},
    port = 3000
  } = options;

  return {
    name,
    filename,
    exposes,
    remotes,
    shared: {
      react: {
        singleton: true,
        requiredVersion: deps.react,
        eager: true
      },
      'react-dom': {
        singleton: true,
        requiredVersion: deps['react-dom'],
        eager: true
      },
      'react-router-dom': {
        singleton: true,
        requiredVersion: deps['react-router-dom']
      }
    }
  };
}

/**
 * Creates runtime remote URL based on environment
 * @param {string} name - Remote name
 * @param {string} devUrl - Development URL
 * @param {string} prodUrl - Production URL
 */
function createRemoteUrl(name, devUrl, prodUrl) {
  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev ? devUrl : (process.env[\`REMOTE_\${name.toUpperCase()}_URL\`] || prodUrl);
  return \`\${name}@\${url}/remoteEntry.js\`;
}

/**
 * Dynamic remote loading for runtime configuration
 */
function loadRemote(scope, module) {
  return async () => {
    await __webpack_init_sharing__('default');
    const container = window[scope];
    await container.init(__webpack_share_scopes__.default);
    const factory = await container.get(module);
    return factory();
  };
}

module.exports = {
  createModuleFederationConfig,
  createRemoteUrl,
  loadRemote
};
`;
  }

  protected generateReadme(): string {
    const { name } = this.context;
    return `# Module Federation Container Setup

Container orchestration for Webpack Module Federation microfrontends.

## Overview

This template provides production-ready container setup for Module Federation:

- **Docker Compose** - Development and production orchestration
- **Nginx** - Reverse proxy with CORS and caching for remoteEntry.js
- **Traefik** - Alternative load balancer with automatic service discovery
- **Kubernetes** - Production deployments with HPA and health checks
- **Istio** - Service mesh integration for advanced traffic management

## Quick Start

### Development

\`\`\`bash
# Start all services with hot reload
docker-compose -f docker-compose.dev.yml up

# Access
# Host: http://localhost:3000
# Header: http://localhost:3001
# Footer: http://localhost:3002
# Sidebar: http://localhost:3003
\`\`\`

### Production

\`\`\`bash
# Build and deploy
./scripts/deploy.sh production

# Or with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

### Kubernetes

\`\`\`bash
# Deploy to Kubernetes
./scripts/deploy.sh kubernetes

# Or with Istio service mesh
./scripts/deploy.sh istio
\`\`\`

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    Nginx/Traefik                        │
│                   (Reverse Proxy)                       │
└─────────────┬───────────┬───────────┬──────────────────┘
              │           │           │
    ┌─────────▼───┐ ┌─────▼───┐ ┌─────▼───┐
    │    Host     │ │ Header  │ │ Footer  │ ...
    │   (Shell)   │ │ Remote  │ │ Remote  │
    │   :3000     │ │ :3001   │ │ :3002   │
    └─────────────┘ └─────────┘ └─────────┘
\`\`\`

## Remote Entry URLs

| Service | Development | Production |
|---------|-------------|------------|
| Host | http://localhost:3000 | http://mf-host:3000 |
| Header | http://localhost:3001/remoteEntry.js | /mf/header/remoteEntry.js |
| Footer | http://localhost:3002/remoteEntry.js | /mf/footer/remoteEntry.js |
| Sidebar | http://localhost:3003/remoteEntry.js | /mf/sidebar/remoteEntry.js |

## CORS Configuration

Module Federation requires CORS headers for remote loading:

\`\`\`nginx
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
\`\`\`

## Caching Strategy

- **remoteEntry.js**: Short cache (1 minute) for quick updates
- **Hashed assets**: Long cache (1 year) with immutable flag
- **HTML**: No cache for instant updates

## Health Checks

All containers include health checks:

- Host: \`/health\`
- Remotes: \`/remoteEntry.js\` (validates Module Federation entry)

\`\`\`bash
# Run health check script
./scripts/health-check.sh
\`\`\`

## Shared Dependencies

Use \`shared/webpack.federation.js\` for consistent configuration:

\`\`\`javascript
const { createModuleFederationConfig } = require('../shared/webpack.federation');

new ModuleFederationPlugin(createModuleFederationConfig({
  name: 'header',
  exposes: { './Header': './src/Header' },
  port: 3001
}));
\`\`\`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | production |
| REMOTE_*_URL | Remote service URLs | Internal Docker network |
| DOCKER_REGISTRY | Registry for pushing images | (empty) |
| IMAGE_TAG | Docker image tag | latest |

## Scripts

- \`./scripts/build-all.sh\` - Build all container images
- \`./scripts/deploy.sh\` - Deploy to environment
- \`./scripts/health-check.sh\` - Verify service health

## Security

- Non-root container users
- Read-only filesystems where possible
- Security headers (X-Frame-Options, CSP)
- Resource limits in production

## License

MIT
`;
  }
}
