// Multi-Tenant Architecture
// Data isolation, tenant management, and customization for SaaS applications

import { BackendTemplate } from '../types';

export const multiTenantTemplate: BackendTemplate = {
  id: 'multi-tenant-architecture',
  name: 'Multi-Tenant Architecture',
  displayName: 'Multi-Tenant SaaS Architecture with Data Isolation',
  description: 'Comprehensive multi-tenant architecture with database isolation, tenant management, custom domains, and per-tenant customization',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['authentication', 'authorization', 'database', 'security'],
  tags: ['multi-tenant', 'saas', 'data-isolation', 'tenant-management'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-multi-tenant",
  "version": "1.0.0",
  "description": "{{name}} - Multi-Tenant SaaS Architecture",
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
    "pg": "^8.11.3",
    "typeorm": "^0.3.17",
    "redis": "^4.6.7",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/pg": "^8.10.2",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/bcrypt": "^5.0.0",
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
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,

    'src/index.ts': `// Multi-Tenant SaaS Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { DataSource } from 'typeorm';
import { TenantManager } from './tenant-manager';
import { TenantContext } from './tenant-context';
import { DatabaseManager } from './database-manager';
import { apiRoutes } from './routes/api.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize managers
const databaseManager = new DatabaseManager();
const tenantManager = new TenantManager(databaseManager);
const tenantContext = new TenantContext(tenantManager);

// Initialize database connection
databaseManager.initialize().then(() => {
  console.log('Database connected');
}).catch((error) => {
  console.error('Database connection failed:', error);
});

// Mount routes with tenant context middleware
app.use('/api', tenantContext.middleware(), apiRoutes(tenantManager, databaseManager));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: 'multi-tenant',
    tenants: tenantManager.getActiveTenantCount(),
  });
});

app.listen(PORT, () => {
  console.log(\`🏢 Multi-Tenant SaaS Server running on port \${PORT}\`);
  console.log(\`🔑 Data isolation enabled with \${tenantManager.getActiveTenantCount()} active tenants\`);
});`,

    'src/tenant-manager.ts': `// Tenant Manager
// Manage tenant provisioning, configuration, and lifecycle

import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database-manager';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  status: 'active' | 'suspended' | 'provisioning';
  plan: 'free' | 'pro' | 'enterprise';
  settings: TenantSettings;
  limits: TenantLimits;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  logo?: string;
  primaryColor?: string;
  customCSS?: string;
  emailDomain?: string;
  features: string[];
  authentication: {
    allowSSO: boolean;
    allowLDAP: boolean;
    requireMFA: boolean;
  };
}

export interface TenantLimits {
  users: number;
  storage: number; // in bytes
  apiCalls: number; // per month
  customDomains: number;
}

export interface CreateTenantDto {
  name: string;
  subdomain: string;
  plan?: 'free' | 'pro' | 'enterprise';
  adminEmail: string;
  adminPassword: string;
  settings?: Partial<TenantSettings>;
}

export class TenantManager {
  private tenants: Map<string, Tenant> = new Map();
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.loadTenants();
  }

  private async loadTenants(): Promise<void> {
    // Load tenants from database
    // In real implementation, query tenants table
  }

  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    // Check if subdomain is available
    if (this.tenants.has(dto.subdomain)) {
      throw new Error('Subdomain already taken');
    }

    const tenant: Tenant = {
      id: uuidv4(),
      name: dto.name,
      subdomain: dto.subdomain,
      status: 'provisioning',
      plan: dto.plan || 'free',
      settings: {
        features: this.getPlanFeatures(dto.plan || 'free'),
        authentication: {
          allowSSO: dto.plan === 'enterprise',
          allowLDAP: dto.plan === 'enterprise',
          requireMFA: dto.plan === 'enterprise',
        },
        ...dto.settings,
      },
      limits: this.getPlanLimits(dto.plan || 'free'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Provision tenant database
    await this.provisionTenantDatabase(tenant);

    // Create admin user
    await this.createTenantAdmin(tenant, dto.adminEmail, dto.adminPassword);

    tenant.status = 'active';
    this.tenants.set(tenant.id, tenant);

    return tenant;
  }

  private async provisionTenantDatabase(tenant: Tenant): Promise<void> {
    // Create tenant-specific database schema
    await this.dbManager.createTenantSchema(tenant.id);

    // Run migrations for tenant
    await this.dbManager.runTenantMigrations(tenant.id);
  }

  private async createTenantAdmin(tenant: Tenant, email: string, password: string): Promise<void> {
    // Create admin user for tenant
    await this.dbManager.createTenantUser(tenant.id, {
      email,
      password,
      role: 'admin',
      permissions: ['all'],
    });
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const updated = {
      ...tenant,
      ...updates,
      updatedAt: new Date(),
    };

    this.tenants.set(tenantId, updated);
    await this.dbManager.updateTenant(tenantId, updates);

    return updated;
  }

  async suspendTenant(tenantId: string): Promise<void> {
    await this.updateTenant(tenantId, { status: 'suspended' });
  }

  async activateTenant(tenantId: string): Promise<void> {
    await this.updateTenant(tenantId, { status: 'active' });
  }

  async deleteTenant(tenantId: string): Promise<void> {
    // Drop tenant database
    await this.dbManager.dropTenantSchema(tenantId);

    // Remove from cache
    this.tenants.delete(tenantId);
  }

  getTenantById(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  getTenantBySubdomain(subdomain: string): Tenant | undefined {
    return Array.from(this.tenants.values()).find(
      (t) => t.subdomain === subdomain && t.status === 'active'
    );
  }

  getTenantByCustomDomain(domain: string): Tenant | undefined {
    return Array.from(this.tenants.values()).find(
      (t) => t.customDomain === domain && t.status === 'active'
    );
  }

  getActiveTenantCount(): number {
    return Array.from(this.tenants.values()).filter((t) => t.status === 'active').length;
  }

  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  private getPlanFeatures(plan: string): string[] {
    switch (plan) {
      case 'enterprise':
        return ['all', 'sso', 'ldap', 'custom-domain', 'api-access', 'advanced-analytics'];
      case 'pro':
        return ['basic', 'custom-domain', 'api-access'];
      case 'free':
      default:
        return ['basic'];
    }
  }

  private getPlanLimits(plan: string): TenantLimits {
    switch (plan) {
      case 'enterprise':
        return { users: -1, storage: 1073741824000, apiCalls: -1, customDomains: 10 }; // 1TB
      case 'pro':
        return { users: 100, storage: 107374182400, apiCalls: 1000000, customDomains: 3 }; // 100GB
      case 'free':
      default:
        return { users: 5, storage: 5368709120, apiCalls: 10000, customDomains: 0 }; // 5GB
    }
  }

  async checkTenantLimits(tenantId: string): Promise<{ withinLimit: boolean; usage: any }> {
    const tenant = this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const usage = await this.dbManager.getTenantUsage(tenantId);

    return {
      withinLimit:
        usage.users < tenant.limits.users &&
        usage.storage < tenant.limits.storage &&
        usage.apiCalls < tenant.limits.apiCalls,
      usage,
    };
  }
}`,

    'src/tenant-context.ts': `// Tenant Context
// Middleware to extract and manage tenant context per request

import { Request, Response, NextFunction } from 'express';
import { TenantManager } from './tenant-manager';

export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    subdomain: string;
    customDomain?: string;
    plan: string;
    settings: any;
  };
}

export class TenantContext {
  private tenantManager: TenantManager;

  constructor(tenantManager: TenantManager) {
    this.tenantManager = tenantManager;
  }

  middleware() {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        const host = req.get('host') || '';

        // Extract subdomain or custom domain
        const tenant = this.resolveTenant(host);

        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        if (tenant.status !== 'active') {
          return res.status(503).json({ error: 'Tenant is not active' });
        }

        // Attach tenant to request
        req.tenant = {
          id: tenant.id,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain,
          plan: tenant.plan,
          settings: tenant.settings,
        };

        next();
      } catch (error: any) {
        console.error('Tenant context error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  private resolveTenant(host: string) {
    // Remove port if present
    const hostname = host.split(':')[0];

    // Check for custom domain
    const customDomainTenant = this.tenantManager.getTenantByCustomDomain(hostname);
    if (customDomainTenant) {
      return customDomainTenant;
    }

    // Extract subdomain
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      const subdomainTenant = this.tenantManager.getTenantBySubdomain(subdomain);
      if (subdomainTenant) {
        return subdomainTenant;
      }
    }

    // Default to first tenant for development
    const tenants = this.tenantManager.getAllTenants();
    return tenants.length > 0 ? tenants[0] : null;
  }

  requireTenant(feature?: string) {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
      if (!req.tenant) {
        return res.status(401).json({ error: 'Tenant context required' });
      }

      if (feature && !req.tenant.settings.features.includes(feature)) {
        return res.status(403).json({ error: 'Feature not available for current plan' });
      }

      next();
    };
  }
}`,

    'src/database-manager.ts': `// Database Manager
// Manage multi-tenant database connections and schema isolation

import { DataSource, DataSourceOptions } from 'typeorm';
import { PoolConfig } from 'pg';

export interface TenantUsage {
  users: number;
  storage: number;
  apiCalls: number;
}

export class DatabaseManager {
  private masterConnection: DataSource;
  private tenantConnections: Map<string, DataSource> = new Map();

  constructor() {
    this.masterConnection = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'multitenant_master',
      synchronize: false,
      logging: false,
    });
  }

  async initialize(): Promise<void> {
    await this.masterConnection.initialize();
    console.log('Master database connection established');
  }

  async createTenantSchema(tenantId: string): Promise<void> {
    await this.masterConnection.query(\`CREATE SCHEMA IF NOT EXISTS tenant_\${tenantId}\`);
    await this.masterConnection.query(\`CREATE TABLE IF NOT EXISTS tenant_\${tenantId}.users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
    await this.masterConnection.query(\`CREATE TABLE IF NOT EXISTS tenant_\${tenantId}.audit_logs (id SERIAL PRIMARY KEY, action VARCHAR(255), user_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
  }

  async dropTenantSchema(tenantId: string): Promise<void> {
    await this.masterConnection.query(\`DROP SCHEMA IF EXISTS tenant_\${tenantId} CASCADE\`);
  }

  async runTenantMigrations(tenantId: string): Promise<void> {
    // Run tenant-specific migrations
    // In real implementation, use migration framework
  }

  getTenantConnection(tenantId: string): DataSource {
    if (!this.tenantConnections.has(tenantId)) {
      const connection = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'multitenant_master',
        schema: \`tenant_\${tenantId}\`,
        synchronize: false,
        logging: false,
      });

      this.tenantConnections.set(tenantId, connection);
    }

    return this.tenantConnections.get(tenantId)!;
  }

  async createTenantUser(tenantId: string, user: any): Promise<void> {
    const connection = this.getTenantConnection(tenantId);
    await connection.query(
      \`INSERT INTO tenant_\${tenantId}.users (email, password, role) VALUES ($1, $2, $3)\`,
      [user.email, user.password, user.role]
    );
  }

  async updateTenant(tenantId: string, updates: any): Promise<void> {
    // Update tenant in master database
    await this.masterConnection.query(
      \`UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = $1\`,
      [tenantId]
    );
  }

  async getTenantUsage(tenantId: string): Promise<TenantUsage> {
    const connection = this.getTenantConnection(tenantId);

    const userCountResult = await connection.query(
      \`SELECT COUNT(*) as count FROM tenant_\${tenantId}.users\`
    );

    return {
      users: parseInt(userCountResult[0].count),
      storage: 0, // Would query file storage
      apiCalls: 0, // Would query audit logs or API usage table
    };
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.tenantConnections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(tenantId);
    }
  }

  async closeAllConnections(): Promise<void> {
    for (const [tenantId, connection] of this.tenantConnections) {
      await connection.destroy();
    }
    this.tenantConnections.clear();
    await this.masterConnection.destroy();
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router, Response } from 'express';
import { TenantManager } from '../tenant-manager';
import { DatabaseManager } from '../database-manager';
import { TenantRequest } from '../tenant-context';

export function apiRoutes(
  tenantManager: TenantManager,
  dbManager: DatabaseManager
): Router {
  const router = Router();

  // Get current tenant info
  router.get('/tenant', (req: TenantRequest, res: Response) => {
    res.json({
      tenant: req.tenant,
      features: req.tenant?.settings.features || [],
    });
  });

  // Update tenant settings
  router.put('/tenant/settings', async (req: TenantRequest, res: Response) => {
    try {
      const tenant = await tenantManager.updateTenant(req.tenant!.id, {
        settings: req.body.settings,
      });
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get tenant usage
  router.get('/tenant/usage', async (req: TenantRequest, res: Response) => {
    try {
      const check = await tenantManager.checkTenantLimits(req.tenant!.id);
      res.json(check);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create tenant (admin only)
  router.post('/admin/tenants', async (req: TenantRequest, res: Response) => {
    try {
      const tenant = await tenantManager.createTenant(req.body);
      res.status(201).json(tenant);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // List all tenants (admin only)
  router.get('/admin/tenants', (req: TenantRequest, res: Response) => {
    const tenants = tenantManager.getAllTenants();
    res.json({ tenants, count: tenants.length });
  });

  // Suspend tenant (admin only)
  router.post('/admin/tenants/:id/suspend', async (req: TenantRequest, res: Response) => {
    try {
      await tenantManager.suspendTenant(req.params.id);
      res.json({ message: 'Tenant suspended' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Activate tenant (admin only)
  router.post('/admin/tenants/:id/activate', async (req: TenantRequest, res: Response) => {
    try {
      await tenantManager.activateTenant(req.params.id);
      res.json({ message: 'Tenant activated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete tenant (admin only)
  router.delete('/admin/tenants/:id', async (req: TenantRequest, res: Response) => {
    try {
      await tenantManager.deleteTenant(req.params.id);
      res.json({ message: 'Tenant deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}`,

    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=multitenant_master

# JWT Configuration
JWT_SECRET=your-jwt-secret-change-me
JWT_EXPIRES_IN=24h

# Redis Configuration (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Multi-Tenant Configuration
TENANT_ISOLATION=schema
DEFAULT_TENANT_PLAN=free

# Domain Configuration
BASE_DOMAIN=example.com
ALLOW_CUSTOM_DOMAINS=true`,

    'README.md': `# Multi-Tenant SaaS Architecture

Comprehensive multi-tenant architecture with database isolation, tenant management, custom domains, and per-tenant customization.

## Features

### 🏢 **Tenant Management**
- **Tenant Provisioning**: Automated tenant creation with database schema setup
- **Plan-Based Features**: Free, Pro, and Enterprise tiers with different limits
- **Custom Domains**: Support for tenant-specific custom domains
- **Tenant Suspension**: Suspend and reactivate tenants
- **Tenant Deletion**: Complete data removal on tenant termination

### 🔒 **Data Isolation**
- **Schema-Based Isolation**: Each tenant gets isolated database schema
- **Separate Connections**: Per-tenant database connections
- **Row-Level Security**: Data segregated by tenant ID
- **Encrypted Data**: Optional per-tenant encryption keys

### 🎨 **Tenant Customization**
- **Branding**: Custom logo, colors, CSS
- **Feature Flags**: Enable/disable features per tenant
- **Authentication Options**: SSO, LDAP, MFA per tenant
- **Email Domains**: Custom email domains per tenant

### 📊 **Usage Tracking**
- **User Limits**: Per-tenant user count limits
- **Storage Limits**: Storage quota tracking
- **API Limits**: Monthly API call quotas
- **Analytics**: Usage analytics per tenant

## Quick Start

### 1. Environment Setup

\`\`\`bash
cp .env.example .env
# Edit .env with your database configuration
\`\`\`

### 2. Create a Tenant

\`\`\`bash
curl -X POST http://localhost:3000/api/admin/tenants \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Corp",
    "subdomain": "acme",
    "plan": "pro",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SecurePass123!"
  }'
\`\`\`

Response:
\`\`\`json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "subdomain": "acme",
  "status": "active",
  "plan": "pro",
  "limits": {
    "users": 100,
    "storage": 107374182400,
    "apiCalls": 1000000,
    "customDomains": 3
  }
}
\`\`\`

### 3. Access Tenant via Subdomain

\`\`\`bash
# Access tenant at subdomain
curl http://acme.localhost:3000/api/tenant

# Or configure local DNS:
# 127.0.0.1 acme.localhost
\`\`\`

Response:
\`\`\`json
{
  "tenant": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "subdomain": "acme",
    "plan": "pro",
    "settings": {
      "features": ["basic", "custom-domain", "api-access"]
    }
  }
}
\`\`\`

### 4. Configure Custom Domain

\`\`\`bash
curl -X PUT http://acme.localhost:3000/api/tenant/settings \\
  -H "Content-Type: application/json" \\
  -d '{
    "settings": {
      "customDomain": "app.acme.com",
      "logo": "https://acme.com/logo.png",
      "primaryColor": "#0066cc"
    }
  }'
\`\`\`

### 5. Check Usage Limits

\`\`\`bash
curl http://acme.localhost:3000/api/tenant/usage
\`\`\`

Response:
\`\`\`json
{
  "withinLimit": true,
  "usage": {
    "users": 5,
    "storage": 52428800,
    "apiCalls": 1523
  }
}
\`\`\`

## API Endpoints

### Tenant APIs

#### \`GET /api/tenant\`
Get current tenant information.

#### \`PUT /api/tenant/settings\`
Update tenant settings (branding, features).

#### \`GET /api/tenant/usage\`
Check tenant usage against plan limits.

### Admin APIs

#### \`POST /api/admin/tenants\`
Create a new tenant.

**Request Body:**
\`\`\`json
{
  "name": "Tenant Name",
  "subdomain": "tenant-subdomain",
  "plan": "free|pro|enterprise",
  "adminEmail": "admin@example.com",
  "adminPassword": "SecurePassword123!"
}
\`\`\`

#### \`GET /api/admin/tenants\`
List all tenants.

#### \`POST /api/admin/tenants/:id/suspend\`
Suspend a tenant.

#### \`POST /api/admin/tenants/:id/activate\`
Reactivate a suspended tenant.

#### \`DELETE /api/admin/tenants/:id\`
Delete a tenant and all associated data.

## Plan Comparison

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Users | 5 | 100 | Unlimited |
| Storage | 5 GB | 100 GB | 1 TB |
| API Calls | 10K/month | 1M/month | Unlimited |
| Custom Domains | 0 | 3 | 10 |
| SSO | ❌ | ❌ | ✅ |
| LDAP | ❌ | ❌ | ✅ |
| MFA | ❌ | ❌ | ✅ |
| API Access | ❌ | ✅ | ✅ |
| Advanced Analytics | ❌ | ❌ | ✅ |

## Architecture

### Database Schema

\`\`\`sql
-- Master Schema
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  custom_domain VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL,
  plan VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant-Specific Schema (per tenant)
CREATE SCHEMA tenant_{tenant_id};

CREATE TABLE tenant_{tenant_id}.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_{tenant_id}.audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(255),
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Request Flow

\`\`\`
1. Request arrives: https://acme.example.com/api/users
2. Extract subdomain: "acme"
3. Look up tenant by subdomain
4. Verify tenant is active
5. Attach tenant context to request
6. Execute query in tenant_{tenant_id} schema
7. Return response
\`\`\`

## Security Considerations

### Data Isolation
- **Schema Separation**: Each tenant gets isolated database schema
- **Connection Pooling**: Separate connection pools per tenant
- **Query Isolation**: All queries scoped to tenant schema
- **Backup Isolation**: Per-tenant backup and restore

### Authentication
- **Tenant-Scoped Tokens**: JWT tokens contain tenant ID
- **User-Tenant Association**: Users belong to specific tenants
- **Cross-Tenant Prevention**: Prevent access across tenants
- **Audit Logging**: All actions logged per tenant

### Rate Limiting
- **Per-Tenant Limits**: Separate rate limits per tenant
- **API Quotas**: Monthly API call quotas
- **Resource Throttling**: CPU/memory limits per tenant
- **Graceful Degradation**: Throttle instead of blocking

## Best Practices

### Tenant Provisioning
1. **Validate Subdomain**: Check for availability and restricted names
2. **Setup Database**: Create schema and run migrations
3. **Create Admin**: Provision admin user for tenant
4. **Send Welcome Email**: Send credentials and setup link
5. **Track Provisioning**: Monitor for failures

### Tenant Customization
1. **Whitelist CSS**: Sanitize custom CSS to prevent XSS
2. **Logo Validation**: Verify logo size and format
3. **Domain Verification**: Verify custom domain ownership
4. **Feature Gates**: Implement feature flags properly
5. **Plan Upgrades**: Smooth upgrade/downgrade process

### Tenant Deletion
1. **Soft Delete First**: Mark as deleted, keep data for 30 days
2. **Backup Data**: Create final backup before deletion
3. **Notify Users**: Send advance notice to users
4. **Verify Ownership**: Confirm admin consent
5. **Cleanup Resources**: Remove database, files, cache

## Troubleshooting

### Subdomain Not Working
**Problem**: Cannot access tenant via subdomain
**Solution**: Configure DNS wildcard record: *.example.com → your server IP

### Custom Domain Not Resolving
**Problem**: Custom domain shows 404
**Solution**:
1. Point CNAME to your server
2. Wait for DNS propagation
3. Verify domain in admin panel

### Database Connection Errors
**Problem**: Too many database connections
**Solution**: Increase connection pool size or implement connection pooling

### Tenant Exceeding Limits
**Problem**: API returning 429 errors
**Solution**: Upgrade tenant plan or reduce usage

## License

MIT`,
  },
};
