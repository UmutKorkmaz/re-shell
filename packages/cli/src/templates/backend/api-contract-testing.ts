import { BackendTemplate } from '../types';

/**
 * API Contract Testing Template
 * Complete automated API contract testing system for frontend-backend integration
 */
export const apiContractTestingTemplate: BackendTemplate = {
  id: 'api-contract-testing',
  name: 'API Contract Testing',
  displayName: 'Automated API Contract Testing System',
  description: 'Complete automated API contract testing with OpenAPI spec generation, Pact contract testing, frontend-backend validation, and CI/CD integration',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['testing', 'api', 'contract-testing', 'openapi', 'pact', 'ci-cd'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'swagger-jsdoc': '^6.2.8',
    'swagger-ui-express': '^5.0.0',
    'yamljs': '^0.3.0',
    'jest': '^29.6.0',
    'supertest': '^6.3.0',
    '@pact-foundation/pact': '^12.0.0',
    'axios': '^1.5.0',
    'zod': '^3.22.4',
    'openapi-types': '^12.1.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/swagger-jsdoc': '^6.0.0',
    '@types/swagger-ui-express': '^4.1.3',
    '@types/yamljs': '^0.2.31',
    '@types/jest': '^29.5.0',
    '@types/supertest': '^2.0.12',
    'typescript': '^5.1.6',
    'ts-jest': '^29.1.0',
    'ts-node': '^10.9.1',
  },
  features: ['testing', 'documentation', 'rest-api'],

  files: {
    'package.json': `{
  "name": "{{name}}-contract-testing",
  "version": "1.0.0",
  "description": "{{name}} - API Contract Testing System",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:contracts": "jest --testPathPattern=contracts",
    "test:pacts": "jest --testPathPattern=pacts",
    "generate:spec": "ts-node scripts/generate-openapi-spec.ts",
    "publish:pacts": "ts-node scripts/publish-pacts.ts",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "yamljs": "^0.3.0",
    "jest": "^29.6.0",
    "supertest": "^6.3.0",
    "@pact-foundation/pact": "^12.0.0",
    "axios": "^1.5.0",
    "zod": "^3.22.4",
    "openapi-types": "^12.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/swagger-jsdoc": "^6.0.0",
    "@types/swagger-ui-express": "^4.1.3",
    "@types/yamljs": "^0.2.31",
    "@types/jest": "^29.5.0",
    "@types/supertest": "^2.0.12",
    "typescript": "^5.1.6",
    "ts-jest": "^29.1.0",
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

    'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
`,

    'src/index.ts': `// API Contract Testing Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { ContractValidator } from './contract/contract-validator';
import { PactPublisher } from './contract/pact-publisher';
import { apiRoutes } from './routes/api.routes';
import { userRoutes } from './routes/user.routes';
import { orderRoutes } from './routes/order.routes';

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

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '{{name}} API',
      version: '1.0.0',
      description: 'API with contract testing',
    },
    servers: [
      {
        url: \`http://localhost:\${process.env.PORT || 3000}\`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve OpenAPI spec
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-spec.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Contract validation middleware
const contractValidator = new ContractValidator(swaggerSpec);
app.use(contractValidator.validate());

// API Routes
app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);

// Contract testing endpoints
app.get('/contract/validate', (req, res) => {
  const violations = contractValidator.getViolations();
  res.json({
    valid: violations.length === 0,
    violations,
  });
});

app.post('/contract/test', async (req, res) => {
  const { endpoint, method, payload } = req.body;

  try {
    const result = await contractValidator.testEndpoint(endpoint, method, payload);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    contract: {
      valid: contractValidator.getViolations().length === 0,
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
  console.log(\`🚀 API Server running on port \${PORT}\`);
  console.log(\`📚 API Docs: http://localhost:\${PORT}/api-docs\`);
  console.log(\`📄 OpenAPI Spec: http://localhost:\${PORT}/api-spec.json\`);
});
`,

    'src/contract/contract-validator.ts': `// Contract Validator
// Validates API responses against OpenAPI contract

import { OpenAPIV3 } from 'openapi-types';
import axios from 'axios';
import { z } from 'zod';

export interface ContractViolation {
  path: string;
  method: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TestResult {
  endpoint: string;
  method: string;
  valid: boolean;
  violations: ContractViolation[];
  response?: any;
}

export class ContractValidator {
  private spec: OpenAPIV3.Document;
  private violations: ContractViolation[] = [];

  constructor(spec: OpenAPIV3.Document) {
    this.spec = spec;
  }

  validate() {
    return (req: any, res: any, next: any) => {
      const originalJson = res.json.bind(res);

      res.json = (data: any) => {
        const violations = this.validateResponse(
          req.path,
          req.method.toLowerCase(),
          data
        );

        if (violations.length > 0) {
          console.warn(\`Contract violations for \${req.method} \${req.path}:\`, violations);
        }

        return originalJson(data);
      };

      next();
    };
  }

  validateResponse(path: string, method: string, response: any): ContractViolation[] {
    const violations: ContractViolation[] = [];

    // Find the path in the spec
    const pathSpec = this.spec.paths[path];
    if (!pathSpec) {
      violations.push({
        path,
        method,
        field: 'path',
        message: \`Path \${path} not found in OpenAPI spec\`,
        severity: 'error',
      });
      return violations;
    }

    const methodSpec = pathSpec[method as keyof typeof pathSpec];
    if (!methodSpec) {
      violations.push({
        path,
        method,
        field: 'method',
        message: \`Method \${method} not found for path \${path}\`,
        severity: 'error',
      });
      return violations;
    }

    // Validate response schema
    const responses = (methodSpec as any).responses;
    if (responses && responses['200']) {
      const schema = responses['200'].content?.['application/json']?.schema;

      if (schema) {
        const schemaViolations = this.validateAgainstSchema(schema, response, path);
        violations.push(...schemaViolations);
      }
    }

    return violations;
  }

  private validateAgainstSchema(schema: any, data: any, path: string): ContractViolation[] {
    const violations: ContractViolation[] = [];

    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null) {
        violations.push({
          path,
          method: 'response',
          field: 'body',
          message: \`Expected object, got \${typeof data}\`,
          severity: 'error',
        });
        return violations;
      }

      // Validate required properties
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in data)) {
            violations.push({
              path,
              method: 'response',
              field: required,
              message: \`Required property '\${required}' is missing\`,
              severity: 'error',
            });
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in data) {
            const propViolations = this.validateAgainstSchema(
              propSchema,
              data[propName],
              \`\${path}.\${propName}\`
            );
            violations.push(...propViolations);
          }
        }
      }
    }

    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        violations.push({
          path,
          method: 'response',
          field: 'body',
          message: \`Expected array, got \${typeof data}\`,
          severity: 'error',
        });
        return violations;
      }

      if (schema.items) {
        for (let i = 0; i < data.length; i++) {
          const itemViolations = this.validateAgainstSchema(
            schema.items,
            data[i],
            \`\${path}[\${i}]\`
          );
          violations.push(...itemViolations);
        }
      }
    }

    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        violations.push({
          path,
          method: 'response',
          field: path,
          message: \`Expected string, got \${typeof data}\`,
          severity: 'error',
        });
      }
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      if (typeof data !== 'number') {
        violations.push({
          path,
          method: 'response',
          field: path,
          message: \`Expected number, got \${typeof data}\`,
          severity: 'error',
        });
      }
    }

    if (schema.type === 'boolean') {
      if (typeof data !== 'boolean') {
        violations.push({
          path,
          method: 'response',
          field: path,
          message: \`Expected boolean, got \${typeof data}\`,
          severity: 'error',
        });
      }
    }

    if (schema.enum) {
      if (!schema.enum.includes(data)) {
        violations.push({
          path,
          method: 'response',
          field: path,
          message: \`Expected one of [\${schema.enum.join(', ')}], got \${data}\`,
          severity: 'error',
        });
      }
    }

    return violations;
  }

  async testEndpoint(endpoint: string, method: string, payload?: any): Promise<TestResult> {
    try {
      const response = await axios({
        method,
        url: \`http://localhost:\${process.env.PORT || 3000}\${endpoint}\`,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const violations = this.validateResponse(endpoint, method, response.data);

      return {
        endpoint,
        method,
        valid: violations.length === 0,
        violations,
        response: response.data,
      };
    } catch (error: any) {
      return {
        endpoint,
        method,
        valid: false,
        violations: [{
          path: endpoint,
          method,
          field: 'request',
          message: error.message,
          severity: 'error',
        }],
      };
    }
  }

  getViolations(): ContractViolation[] {
    return this.violations;
  }

  clearViolations(): void {
    this.violations = [];
  }
}
`,

    'src/contract/pact-publisher.ts': `// Pact Publisher
// Publishes and verifies Pact contracts

import { Publisher, Verifier } from '@pact-foundation/pact';

export class PactPublisher {
  private pactBrokerUrl: string;
  private providerVersion: string;

  constructor(pactBrokerUrl: string, providerVersion: string) {
    this.pactBrokerUrl = pactBrokerUrl;
    this.providerVersion = providerVersion;
  }

  async publish(contracts: any[]): Promise<void> {
    const publisher = new Publisher({
      pactBrokerUrl: this.pactBrokerUrl,
      providerVersion: this.providerVersion,
    });

    try {
      await publisher.publish(contracts);
      console.log(\`✅ Published \${contracts.length} Pact contracts to \${this.pactBrokerUrl}\`);
    } catch (error) {
      console.error('❌ Failed to publish Pact contracts:', error);
      throw error;
    }
  }

  async verify(provider: string, consumerVersion?: string): Promise<void> {
    const verifier = new Verifier({
      providerBaseUrl: \`http://localhost:\${process.env.PORT || 3000}\`,
      provider,
      providerVersion: this.providerVersion,
      pactBrokerUrl: this.pactBrokerUrl,
      consumerVersionSelectors: consumerVersion
        ? [{ latest: true, version: consumerVersion }]
        : undefined,
    });

    try {
      await verifier.verifyProvider();
      console.log(\`✅ Verified Pact contracts for provider \${provider}\`);
    } catch (error) {
      console.error('❌ Pact verification failed:', error);
      throw error;
    }
  }

  async canIDeploy(): Promise<boolean> {
    // Check if deployment is safe based on contract verification
    const verifier = new Verifier({
      providerBaseUrl: \`http://localhost:\${process.env.PORT || 3000}\`,
      pactBrokerUrl: this.pactBrokerUrl,
      enablePending: true,
    });

    try {
      await verifier.verifyProvider();
      return true;
    } catch {
      return false;
    }
  }
}
`,

    'src/contract/openapi-generator.ts': `// OpenAPI Spec Generator
// Generates OpenAPI specification from code annotations

import swaggerJsdoc from 'swagger-jsdoc';

export class OpenAPIGenerator {
  private definitions: any[] = [];

  constructor() {}

  /**
   * Generate OpenAPI spec from JSDoc annotations
   */
  generate(): any {
    return swaggerJsdoc({
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'API',
          version: '1.0.0',
          description: 'API with contract testing',
        },
        servers: [
          {
            url: \`http://localhost:\${process.env.PORT || 3000}\`,
            description: 'Development server',
          },
        ],
        components: {
          schemas: {
            Error: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                },
                message: {
                  type: 'string',
                },
                statusCode: {
                  type: 'integer',
                },
              },
            },
            User: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                },
                name: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                  format: 'email',
                },
              },
              required: ['id', 'name', 'email'],
            },
            Order: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                },
                userId: {
                  type: 'string',
                  format: 'uuid',
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                  productId: {
                    type: 'string',
                  },
                  quantity: {
                    type: 'integer',
                  },
                },
                  },
                },
                total: {
                  type: 'number',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'processing', 'shipped', 'delivered'],
                },
              },
            },
          },
        },
      },
      apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
    });
  }

  /**
   * Generate TypeScript types from OpenAPI spec
   */
  generateTypes(spec: any): string {
    let types = '// Auto-generated types from OpenAPI spec\\n\\n';

    for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
      types += \`export interface \${name} {\\n\`;
      const schemaObj = schema as any;

      if (schemaObj.properties) {
        for (const [propName, propSchema] of Object.entries(schemaObj.properties)) {
          const propType = this.getTypescriptType(propSchema as any);
          const required = schemaObj.required?.includes(propName);
          types += \`  \${propName}\${required ? '' : '?'}: \${propType};\\n\`;
        }
      }

      types += \`}\\n\\n\`;
    }

    return types;
  }

  private getTypescriptType(schema: any): string {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      return refName || 'any';
    }

    if (schema.type === 'string') {
      if (schema.format === 'uuid' || schema.format === 'email') {
        return 'string';
      }
      return 'string';
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      return 'number';
    }

    if (schema.type === 'boolean') {
      return 'boolean';
    }

    if (schema.type === 'array') {
      const itemType = this.getTypescriptType(schema.items);
      return \`\${itemType}[]\`;
    }

    if (schema.type === 'object') {
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([name, prop]) => {
            const propType = this.getTypescriptType(prop as any);
            const required = (schema.required || []).includes(name);
            return \`  \${name}\${required ? '' : '?'}: \${propType}\`;
          })
          .join(';\\n');
        return \`{\\n\${props}\\n}\`;
      }
      return 'Record<string, any>';
    }

    return 'any';
  }
}
`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import * as express from 'express';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export { router as apiRoutes };
`,

    'src/routes/user.routes.ts': `// User Routes
import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  ]);
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (id === '1') {
    res.json({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    });
  } else {
    res.status(404).json({
      error: 'User not found',
    });
  }
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 */
router.post('/', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required',
    });
  }

  res.status(201).json({
    id: Date.now().toString(),
    name,
    email,
  });
});

export { router as userRoutes };
`,

    'src/routes/order.routes.ts': `// Order Routes
import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 */
router.get('/', (req, res) => {
  res.json([
    {
      id: '1',
      userId: '1',
      items: [
        {
          productId: 'p1',
          quantity: 2,
        },
      ],
      total: 99.99,
      status: 'pending',
    },
  ]);
});

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 */
router.post('/', (req, res) => {
  const { userId, items, total } = req.body;

  res.status(201).json({
    id: Date.now().toString(),
    userId,
    items: items || [],
    total: total || 0,
    status: 'pending',
  });
});

export { router as orderRoutes };
`,

    // Contract tests
    '__tests__/contracts/api-contract.test.ts': `// API Contract Tests
import request from 'supertest';
import { ContractValidator } from '../../src/contract/contract-validator';
import { createApp } from '../../src/app';

describe('API Contract Tests', () => {
  let app: any;
  let validator: ContractValidator;

  beforeAll(() => {
    app = createApp();
    validator = new ContractValidator(app.get('swaggerSpec'));
  });

  describe('GET /health', () => {
    it('should return valid health response', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const violations = validator.validateResponse('/health', 'get', response.body);

      expect(violations).toHaveLength(0);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /users', () => {
    it('should return valid users list', async () => {
      const response = await request(app)
        .get('/users')
        .expect(200);

      const violations = validator.validateResponse('/users', 'get', response.body);

      expect(violations).toHaveLength(0);
      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const user = response.body[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
      }
    });
  });

  describe('POST /users', () => {
    it('should create user with valid data', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/users')
        .send(newUser)
        .expect(201);

      const violations = validator.validateResponse('/users', 'post', response.body);

      expect(violations).toHaveLength(0);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', newUser.name);
      expect(response.body).toHaveProperty('email', newUser.email);
    });

    it('should reject user without name', async () => {
      const invalidUser = {
        email: 'test@example.com',
      };

      const response = await request(app)
        .post('/users')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /users/:id', () => {
    it('should return valid user for existing ID', async () => {
      const response = await request(app)
        .get('/users/1')
        .expect(200);

      const violations = validator.validateResponse('/users/:id', 'get', response.body);

      expect(violations).toHaveLength(0);
      expect(response.body).toHaveProperty('id', '1');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /orders', () => {
    it('should return valid orders list', async () => {
      const response = await request(app)
        .get('/orders')
        .expect(200);

      const violations = validator.validateResponse('/orders', 'get', response.body);

      expect(violations).toHaveLength(0);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
`,

    '__tests__/pacts/user-service-pact.test.ts': `// Pact Contract Tests for User Service
import { Pact } from '@pact-foundation/pact';
import { resolve } from 'path';
import axios from 'axios';

describe('User Service Pact', () => {
  const provider = new Pact({
    consumer: 'FrontendApp',
    provider: 'UserService',
    port: 3001,
    log: resolve(process.cwd(), 'logs', 'pact.log'),
    dir: resolve(process.cwd(), 'pacts'),
    logLevel: 'INFO',
  });

  const BASE_URL = \`http://localhost:\${provider.port}\`;

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('GET /users', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'users exist',
        uponReceiving: 'a request for users',
        withRequest: {
          method: 'GET',
          path: '/users',
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: [
            {
              id: '1',
              name: 'John Doe',
              email: 'john@example.com',
            },
            {
              id: '2',
              name: 'Jane Smith',
              email: 'jane@example.com',
            },
          ],
        },
      });
    });

    it('should return a list of users', async () => {
      const response = await axios.get(\`\${BASE_URL}/users\`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(2);
      expect(response.data[0]).toHaveProperty('id', '1');
      expect(response.data[0]).toHaveProperty('name', 'John Doe');
    });
  });

  describe('GET /users/:id', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'user 1 exists',
        uponReceiving: 'a request for user 1',
        withRequest: {
          method: 'GET',
          path: '/users/1',
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            id: '1',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      });
    });

    it('should return user 1', async () => {
      const response = await axios.get(\`\${BASE_URL}/users/1\`);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id', '1');
      expect(response.data).toHaveProperty('name', 'John Doe');
      expect(response.data).toHaveProperty('email', 'john@example.com');
    });
  });

  describe('POST /users', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        uponReceiving: 'a request to create a user',
        withRequest: {
          method: 'POST',
          path: '/users',
          body: {
            name: 'New User',
            email: 'new@example.com',
          },
          headers: {
            'Content-Type': 'application/json',
          },
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            id: Pact.like('1'),
            name: 'New User',
            email: 'new@example.com',
          },
        },
      });
    });

    it('should create a new user', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@example.com',
      };

      const response = await axios.post(\`\${BASE_URL}/users\`, newUser);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name', newUser.name);
      expect(response.data).toHaveProperty('email', newUser.email);
    });
  });
});
`,

    // Frontend contract validation
    'client-sdk/contract-validator.ts': `// Frontend Contract Validator
// Validates frontend API calls against backend contract

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { z } from 'zod';

export interface ContractTest {
  endpoint: string;
  method: string;
  requestSchema?: z.ZodType<any>;
  responseSchema: z.ZodType<any>;
}

export class FrontendContractValidator {
  private apiBaseUrl: string;
  private tests: Map<string, ContractTest> = new Map();

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  registerTest(key: string, test: ContractTest): void {
    this.tests.set(key, test);
  }

  async validateRequest(key: string, payload?: any): Promise<{ valid: boolean; errors: string[] }> {
    const test = this.tests.get(key);

    if (!test) {
      return {
        valid: false,
        errors: [\`No contract test found for key: \${key}\`],
      };
    }

    const errors: string[] = [];

    // Validate request payload
    if (test.requestSchema && payload) {
      try {
        test.requestSchema.parse(payload);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map(e => e.message));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateResponse(key: string, response: any): Promise<{ valid: boolean; errors: string[] }> {
    const test = this.tests.get(key);

    if (!test) {
      return {
        valid: false,
        errors: [\`No contract test found for key: \${key}\`],
      };
    }

    const errors: string[] = [];

    // Validate response
    try {
      test.responseSchema.parse(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => e.message));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async testEndpoint(key: string, payload?: any): Promise<{
    valid: boolean;
    requestErrors: string[];
    responseErrors: string[];
    response?: any;
  }> {
    const test = this.tests.get(key);

    if (!test) {
      return {
        valid: false,
        requestErrors: [\`No contract test found for key: \${key}\`],
        responseErrors: [],
      };
    }

    // Validate request
    const requestValidation = await this.validateRequest(key, payload);

    if (!requestValidation.valid) {
      return {
        valid: false,
        requestErrors: requestValidation.errors,
        responseErrors: [],
      };
    }

    // Make request
    const config: AxiosRequestConfig = {
      method: test.method as any,
      url: \`\${this.apiBaseUrl}\${test.endpoint}\`,
      data: payload,
    };

    try {
      const response: AxiosResponse = await axios(config);
      const responseValidation = await this.validateResponse(key, response.data);

      return {
        valid: responseValidation.valid,
        requestErrors: [],
        responseErrors: responseValidation.errors,
        response: response.data,
      };
    } catch (error: any) {
      return {
        valid: false,
        requestErrors: [],
        responseErrors: [error.message],
      };
    }
  }

  async runAllTests(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [key] of this.tests.entries()) {
      const result = await this.testEndpoint(key);
      results.set(key, result.valid);
    }

    return results;
  }
}

// Example usage with Zod schemas
export const userSchemas = {
  userList: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
    })
  ),

  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),

  createUserRequest: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
};

export const orderSchemas = {
  orderList: z.array(
    z.object({
      id: z.string().uuid(),
      userId: z.string().uuid(),
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
        })
      ),
      total: z.number().nonnegative(),
      status: z.enum(['pending', 'processing', 'shipped', 'delivered']),
    })
  ),

  order: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    ),
    total: z.number().nonnegative(),
    status: z.enum(['pending', 'processing', 'shipped', 'delivered']),
  }),
};
`,

    // CI/CD Scripts
    'scripts/generate-openapi-spec.ts': `// Generate OpenAPI Spec
import { OpenAPIGenerator } from '../src/contract/openapi-generator';
import fs from 'fs';
import path from 'path';

async function generate() {
  const generator = new OpenAPIGenerator();
  const spec = generator.generate();

  const outputPath = path.resolve(process.cwd(), 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

  console.log(\`✅ OpenAPI spec generated: \${outputPath}\`);

  // Generate TypeScript types
  const types = generator.generateTypes(spec);
  const typesPath = path.resolve(process.cwd(), 'src/types/api.generated.ts');
  fs.writeFileSync(typesPath, types);

  console.log(\`✅ TypeScript types generated: \${typesPath}\`);
}

generate().catch(console.error);
`,

    'scripts/publish-pacts.ts': `// Publish Pact Contracts
import { PactPublisher } from '../src/contract/pact-publisher';
import fs from 'fs';
import path from 'path';

async function publish() {
  const pactBrokerUrl = process.env.PACT_BROKER_URL || 'http://localhost:9292';
  const providerVersion = process.env.PROVIDER_VERSION || '1.0.0';

  const publisher = new PactPublisher(pactBrokerUrl, providerVersion);

  // Read Pact files from pacts directory
  const pactsDir = path.resolve(process.cwd(), 'pacts');
  const pactFiles = fs.readdirSync(pactsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = fs.readFileSync(path.join(pactsDir, f), 'utf-8');
      return JSON.parse(content);
    });

  await publisher.publish(pactFiles);
  console.log(\`✅ Published \${pactFiles.length} Pact contracts\`);
}

publish().catch(console.error);
`,

    '.github/workflows/contract-testing.yml': `# CI/CD Workflow for Contract Testing
name: Contract Testing

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test-contracts:
    runs-on: ubuntu-latest

    services:
      pact-broker:
        image: pactfoundation/pact-broker
        ports:
          - 9292:9292
        env:
          PACT_BROKER_DATABASE_ADAPTER: 'sqlite'
          PACT_BROKER_DATABASE_NAME: 'pact.sqlite'

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Generate OpenAPI spec
        run: npm run generate:spec

      - name: Run contract tests
        run: npm run test:contracts

      - name: Run Pact tests
        run: npm run test:pacts
        env:
          PACT_BROKER_URL: http://localhost:9292

      - name: Publish Pact contracts
        run: npm run publish:pacts
        env:
          PACT_BROKER_URL: http://localhost:9292
          PROVIDER_VERSION: \${{ github.sha }}

      - name: Can I Deploy?
        run: npm run can-i-deploy
        env:
          PACT_BROKER_URL: http://localhost:9292

      - name: Upload contract results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: contract-test-results
          path: |
            pacts/
            openapi.json
            coverage/
`,

    // Documentation
    'README.md': `# API Contract Testing System

Complete automated API contract testing with OpenAPI specification, Pact contract testing, and CI/CD integration.

## Features

- **OpenAPI Spec Generation**: Automatic generation from JSDoc annotations
- **Contract Validation**: Runtime validation of API responses
- **Pact Testing**: Consumer-driven contract testing
- **Frontend Validation**: TypeScript/Zod schemas for frontend validation
- **CI/CD Integration**: GitHub Actions workflow for automated testing

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

### Start Server

\`\`\`bash
npm run dev
\`\`\`

Server runs on port 3000:
- API: http://localhost:3000/api
- API Docs: http://localhost:3000/api-docs
- OpenAPI Spec: http://localhost:3000/api-spec.json

### Generate OpenAPI Spec

\`\`\`bash
npm run generate:spec
\`\`\`

Generates:
- \`openapi.json\` - OpenAPI 3.0 specification
- \`src/types/api.generated.ts\` - TypeScript types from spec

### Run Contract Tests

\`\`\`bash
npm run test:contracts
\`\`\`

Tests all API endpoints against the OpenAPI contract.

### Run Pact Tests

\`\`\`bash
npm run test:pacts
\`\`\`

Runs Pact contract tests and generates Pact files.

### Publish Pact Contracts

\`\`\`bash
npm run publish:pacts
\`\`\`

Publishes Pact contracts to Pact Broker.

## API Endpoints

### Users

- \`GET /api/users\` - Get all users
- \`GET /api/users/:id\` - Get user by ID
- \`POST /api/users\` - Create new user

### Orders

- \`GET /api/orders\` - Get all orders
- \`POST /api/orders\` - Create new order

## Frontend Integration

\`\`\`typescript
import { FrontendContractValidator, userSchemas } from '@re-shell/contract-validator';

const validator = new FrontendContractValidator('http://localhost:3000');

// Register contract tests
validator.registerTest('getUsers', {
  endpoint: '/users',
  method: 'GET',
  responseSchema: userSchemas.userList,
});

validator.registerTest('createUser', {
  endpoint: '/users',
  method: 'POST',
  requestSchema: userSchemas.createUserRequest,
  responseSchema: userSchemas.user,
});

// Test endpoints
const result = await validator.testEndpoint('getUsers');

if (!result.valid) {
  console.error('Contract violations:', result.responseErrors);
}
\`\`\`

## CI/CD Pipeline

The GitHub Actions workflow:

1. Generates OpenAPI spec
2. Runs contract tests
3. Runs Pact tests
4. Publishes Pact contracts to broker
5. Checks if deployment is safe (can-i-deploy)

## Contract Validation at Runtime

Every API response is validated against the OpenAPI contract:

\`\`\`typescript
GET /api/contract/validate
\`\`\`

Returns:
\`\`\`json
{
  "valid": true | false,
  "violations": [...]
}
\`\`\`
`,
  },
};
