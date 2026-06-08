/**
 * API Gateway Integration Generator
 * Generates API gateway configurations for all supported backend frameworks
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Gateway type
export type GatewayType =
  | 'kong'
  | 'traefik'
  | 'nginx'
  | 'envoy'
  | 'aws-api-gateway'
  | 'azure-api-management'
  | 'gcp-api-gateway'
  | 'express-gateway'
  | 'krakenD';

// Gateway configuration interfaces
export interface GatewayConfig {
  name: string;
  type: GatewayType;
  routes: GatewayRoute[];
  services: GatewayService[];
  rateLimit?: RateLimitConfig;
  cors?: CORSConfig;
  auth?: AuthConfig;
}

export interface GatewayRoute {
  id: string;
  path: string;
  method: string[];
  service: string;
  stripPath?: boolean;
  timeout?: number;
}

export interface GatewayService {
  id: string;
  name: string;
  url: string;
  healthCheck?: HealthCheckConfig;
}

export interface HealthCheckConfig {
  path: string;
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  window: number;
  limit: number;
}

export interface CORSConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge: number;
}

export interface AuthConfig {
  type: 'none' | 'jwt' | 'oauth2' | 'api-key';
}

// Get gateway template info
export function getGatewayTemplate(type: GatewayType): GatewayTemplate | undefined {
  const templates: Record<GatewayType, GatewayTemplate> = {
    kong: {
      type: 'kong',
      format: 'yaml',
      configPath: './kong.yml',
      description: 'Kong Gateway - High-performance API gateway',
      docsUrl: 'https://docs.konghq.com/',
    },
    traefik: {
      type: 'traefik',
      format: 'yaml',
      configPath: './traefik.yml',
      description: 'Traefik - Cloud-native edge router',
      docsUrl: 'https://doc.traefik.io/traefik/',
    },
    nginx: {
      type: 'nginx',
      format: 'conf',
      configPath: './nginx.conf',
      description: 'NGINX - Load balancer and reverse proxy',
      docsUrl: 'https://docs.nginx.com/',
    },
    envoy: {
      type: 'envoy',
      format: 'yaml',
      configPath: './envoy.yaml',
      description: 'Envoy - Cloud-native edge/middleware proxy',
      docsUrl: 'https://www.envoyproxy.io/',
    },
    'aws-api-gateway': {
      type: 'aws-api-gateway',
      format: 'yaml',
      configPath: './serverless.yml',
      description: 'AWS API Gateway - Fully managed API service',
      docsUrl: 'https://docs.aws.amazon.com/apigateway/',
    },
    'azure-api-management': {
      type: 'azure-api-management',
      format: 'yaml',
      configPath: './apim.yaml',
      description: 'Azure API Management - Hybrid API management',
      docsUrl: 'https://docs.microsoft.com/azure/api-management/',
    },
    'gcp-api-gateway': {
      type: 'gcp-api-gateway',
      format: 'yaml',
      configPath: './gateway.yaml',
      description: 'Google Cloud API Gateway - Managed API gateway',
      docsUrl: 'https://cloud.google.com/api-gateway/docs',
    },
    'express-gateway': {
      type: 'express-gateway',
      format: 'yaml',
      configPath: './gateway.config.yml',
      description: 'Express Gateway - API gateway built on Express',
      docsUrl: 'https://www.express-gateway.io/',
    },
    krakenD: {
      type: 'krakenD',
      format: 'json',
      configPath: './krakend.json',
      description: 'KrakenD - Ultra performance API Gateway',
      docsUrl: 'https://www.krakend.io/',
    },
  };

  return templates[type];
}

export interface GatewayTemplate {
  type: GatewayType;
  format: 'yaml' | 'json' | 'conf';
  configPath: string;
  description: string;
  docsUrl: string;
}

// Generate Kong Gateway configuration
export function generateKongConfig(config: GatewayConfig): string {
  const lines: string[] = [];

  lines.push('_format_version: "3.0"');
  lines.push('_transform: true');
  lines.push('');

  // Services
  lines.push('services:');
  config.services.forEach(service => {
    lines.push(`  - name: ${service.name}`);
    lines.push(`    url: ${service.url}`);
    lines.push(`    connect_timeout: 60000`);
    lines.push(`    write_timeout: 60000`);
    lines.push(`    read_timeout: 60000`);
    lines.push('');
  });

  // Routes
  lines.push('routes:');
  config.routes.forEach(route => {
    const service = config.services.find(s => s.id === route.service);
    lines.push(`  - name: ${route.id}`);
    lines.push(`    service: ${service?.name || route.service}`);
    lines.push(`    paths:`);
    lines.push(`      - ${route.path}`);
    lines.push(`    methods:`);
    route.method.forEach(m => {
      lines.push(`      - ${m}`);
    });
    lines.push(`    strip_path: ${route.stripPath !== false}`);
    lines.push(`    protocols:`);
    lines.push(`      - http`);
    lines.push(`      - https`);
    lines.push('');
  });

  // Plugins
  if (config.cors?.enabled || config.rateLimit?.enabled || config.auth?.type !== 'none') {
    lines.push('plugins:');
  }

  if (config.cors?.enabled) {
    lines.push(`  - name: cors`);
    lines.push(`    config:`);
    lines.push(`      origins:`);
    config.cors.origins.forEach(o => {
      lines.push(`        - ${o}`);
    });
    lines.push(`      methods:`);
    config.cors.methods.forEach(m => {
      lines.push(`        - ${m}`);
    });
    lines.push('');
  }

  if (config.rateLimit?.enabled) {
    lines.push(`  - name: rate-limiting`);
    lines.push(`    config:`);
    lines.push(`      minute: ${config.rateLimit.limit}`);
    lines.push(`      policy: local`);
    lines.push('');
  }

  return lines.join('\n');
}

// Generate Traefik configuration
export function generateTraefikConfig(config: GatewayConfig): string {
  const lines: string[] = [];

  lines.push('# Traefik Configuration');
  lines.push('entryPoints:');
  lines.push('  web:');
  lines.push('    address: ":80"');
  lines.push('  websecure:');
  lines.push('    address: ":443"');
  lines.push('');

  lines.push('providers:');
  lines.push('  file:');
  lines.push('    filename: /etc/traefik/dynamic.yml');
  lines.push('');

  lines.push('api:');
  lines.push('  dashboard: true');
  lines.push('  insecure: false');
  lines.push('');

  lines.push('# Dynamic Configuration (dynamic.yml)');
  lines.push('http:');
  lines.push('  routers:');

  config.routes.forEach(route => {
    const service = config.services.find(s => s.id === route.service);
    const methods = route.method.join(',');
    lines.push(`    ${route.id}:`);
    lines.push(`      rule: "PathPrefix(\`${route.path}\`) && Method(\`${methods}\`)"`);
    lines.push(`      service: ${service?.name || route.service}`);
    lines.push('');
  });

  lines.push('  services:');
  config.services.forEach(service => {
    const url = new URL(service.url);
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    lines.push(`    ${service.name}:`);
    lines.push(`      loadBalancer:`);
    lines.push(`        servers:`);
    lines.push(`          - url: ${service.url}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Generate NGINX configuration
export function generateNginxConfig(config: GatewayConfig): string {
  const lines: string[] = [];

  lines.push('worker_processes auto;');
  lines.push('error_log /var/log/nginx/error.log warn;');
  lines.push('pid /var/run/nginx.pid;');
  lines.push('');
  lines.push('events {');
  lines.push('    worker_connections 1024;');
  lines.push('}');
  lines.push('');
  lines.push('http {');
  lines.push('    include /etc/nginx/mime.types;');
  lines.push('    default_type application/octet-stream;');
  lines.push('');

  // Upstream services
  config.services.forEach(service => {
    const url = new URL(service.url);
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    lines.push(`    upstream ${service.name} {`);
    lines.push(`        server ${url.hostname}:${port};`);
    lines.push('    }');
    lines.push('');
  });

  lines.push('    server {');
  lines.push('        listen 80;');
  lines.push('        server_name _;');
  lines.push('');

  if (config.cors?.enabled) {
    lines.push('        # CORS');
    config.cors.origins.forEach(o => {
      lines.push(`        add_header "Access-Control-Allow-Origin" "${o}";`);
    });
    config.cors.methods.forEach(m => {
      lines.push(`        add_header "Access-Control-Allow-Methods" "${m}";`);
    });
    lines.push('');
  }

  // Routes
  config.routes.forEach(route => {
    const service = config.services.find(s => s.id === route.service);
    lines.push(`        # ${route.id}`);
    lines.push(`        location ${route.path} {`);
    if (route.stripPath !== false) {
      lines.push(`            rewrite ^${route.path}(.*)$ /$1 break;`);
    }
    lines.push(`            proxy_pass http://${service?.name || route.service};`);
    lines.push(`        }`);
    lines.push('');
  });

  lines.push('    }');
  lines.push('}');

  return lines.join('\n');
}

// Generate Envoy configuration
export function generateEnvoyConfig(config: GatewayConfig): string {
  const lines: string[] = [];

  lines.push('static_resources:');
  lines.push('  listeners:');
  lines.push('  - name: listener_0');
  lines.push('    address:');
  lines.push('      socket_address:');
  lines.push('        protocol: TCP');
  lines.push('        address: 0.0.0.0');
  lines.push('        port_value: 8080');
  lines.push('    filter_chains:');
  lines.push('    - filters:');
  lines.push('      - name: envoy.filters.network.http_connection_manager');
  lines.push('        typed_config:');
  lines.push('          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager');
  lines.push('          stat_prefix: ingress_http');
  lines.push('          route_config:');
  lines.push('            name: local_route');
  lines.push('            virtual_hosts:');
  lines.push('            - name: backend');
  lines.push('              domains: ["*"]');
  lines.push('              routes:');

  config.routes.forEach(route => {
    const service = config.services.find(s => s.id === route.service);
    lines.push(`                - match:`);
    lines.push(`                    prefix: ${route.path}`);
    lines.push(`                  route:`);
    lines.push(`                    cluster: ${service?.name || route.service}`);
    lines.push(`                    timeout: ${route.timeout || 30}s`);
    lines.push(`                    auto_host_rewrite: true`);
    lines.push('');
  });

  lines.push('  clusters:');

  config.services.forEach(service => {
    const url = new URL(service.url);
    const port = parseInt(url.port || '80');
    lines.push('  - name: ' + service.name);
    lines.push('    type: STRICT_DNS');
    lines.push('    load_assignment:');
    lines.push('      cluster_name: ' + service.name);
    lines.push('      endpoints:');
    lines.push('      - lb_endpoints:');
    lines.push('          - endpoint:');
    lines.push('              address:');
    lines.push('                socket_address:');
    lines.push(`                  address: ${url.hostname}`);
    lines.push(`                  port_value: ${port}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Generate docker-compose for gateway
export function generateGatewayDockerCompose(type: GatewayType): string {
  const templates: Record<GatewayType, string> = {
    kong: `version: '3.8'
services:
  kong:
    image: kong:latest
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: "off"
    volumes:
      - ./kong.yml:/kong/default/kong.yml
networks:
  gateway:
    driver: bridge
`,
    traefik: `version: '3.8'
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
networks:
  gateway:
    driver: bridge
`,
    nginx: `version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
networks:
  gateway:
    driver: bridge
`,
    envoy: `version: '3.8'
services:
  envoy:
    image: envoyproxy/envoy:v1.27-latest
    command: ["envoy", "-c", "/etc/envoy/envoy.yaml"]
    ports:
      - "8080:8080"
      - "9901:9901"
    volumes:
      - ./envoy.yaml:/etc/envoy/envoy.yaml:ro
networks:
  gateway:
    driver: bridge
`,
    'aws-api-gateway': `# AWS API Gateway requires AWS deployment
# Use AWS CDK or Serverless Framework
`,
    'azure-api-management': `# Azure API Management requires Azure deployment
# Use Azure CLI or ARM templates
`,
    'gcp-api-gateway': `# GCP API Gateway requires GCP deployment
# Use gcloud CLI or Terraform
`,
    'express-gateway': `version: '3.8'
services:
  express-gateway:
    image: express-gateway:latest
    ports:
      - "8080:8080"
      - "9876:9876"
    volumes:
      - ./gateway.config.yml:/home/eg/gateway.config.yml
networks:
  gateway:
    driver: bridge
`,
    krakenD: `version: '3.8'
services:
  krakend:
    image: devopsfaith/krakend:latest
    ports:
      - "8080:8080"
      - "8090:8090"
    volumes:
      - ./krakend.json:/etc/krakend/krakend.json:ro
networks:
  gateway:
    driver: bridge
`,
  };

  return templates[type];
}

// Generate gateway configuration file
export function generateGatewayConfig(type: GatewayType, config: GatewayConfig): string {
  switch (type) {
    case 'kong':
      return generateKongConfig(config);
    case 'traefik':
      return generateTraefikConfig(config);
    case 'nginx':
      return generateNginxConfig(config);
    case 'envoy':
      return generateEnvoyConfig(config);
    default:
      return `# Configuration for ${type}\n# Coming soon`;
  }
}

// List supported gateway types
export function listGatewayTypes(): Array<{ type: GatewayType; description: string; docs: string }> {
  const types: GatewayType[] = [
    'kong',
    'traefik',
    'nginx',
    'envoy',
    'aws-api-gateway',
    'azure-api-management',
    'gcp-api-gateway',
    'express-gateway',
    'krakenD',
  ];

  return types.map(t => {
    const template = getGatewayTemplate(t);
    return {
      type: t,
      description: template?.description || t,
      docs: template?.docsUrl || '',
    };
  });
}

// Format for display
export function formatGatewayConfig(config: GatewayConfig): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n🚪 API Gateway Configuration'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\n${chalk.blue('Name:')} ${config.name}`);
  lines.push(`${chalk.blue('Type:')} ${config.type}`);

  lines.push(`\n${chalk.blue('Services:')} ${config.services.length}`);
  config.services.forEach(s => {
    lines.push(`  ${chalk.gray('•')} ${chalk.yellow(s.name)}: ${s.url}`);
  });

  lines.push(`\n${chalk.blue('Routes:')} ${config.routes.length}`);
  config.routes.forEach(r => {
    lines.push(`  ${chalk.gray('•')} ${chalk.yellow(r.path)} (${r.method.join(', ')}) -> ${r.service}`);
  });

  if (config.rateLimit?.enabled) {
    lines.push(`\n${chalk.blue('Rate Limit:')} ${config.rateLimit.limit} req/${config.rateLimit.window}s`);
  }

  if (config.cors?.enabled) {
    lines.push(`${chalk.blue('CORS:')} Enabled (${config.cors.origins.length} origins)`);
  }

  if (config.auth?.type !== 'none') {
    lines.push(`${chalk.blue('Auth:')} ${config.auth.type}`);
  }

  return lines.join('\n');
}
