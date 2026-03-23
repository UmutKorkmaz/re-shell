import { BackendTemplate } from '../types';

export const middyTemplate: BackendTemplate = {
  id: 'middy',
  name: 'middy',
  displayName: 'Middy AWS Lambda',
  description: 'Middleware engine for AWS Lambda with TypeScript, built-in middlewares, error handling, and AWS SDK integration',
  language: 'typescript',
  framework: 'middy',
  version: '5.2.0',
  tags: ['aws', 'lambda', 'serverless', 'middleware', 'typescript', 'api', 'cloud'],
  port: 3000,
  dependencies: {},
  features: [
    'middleware',
    'docker',
    'middleware',
    'validation',
    'cors',
    'authentication',
    'logging',
    'microservices',
    'docker',
    'docker'
  ],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "AWS Lambda functions with Middy middleware engine",
  "main": "dist/index.js",
  "scripts": {
    "dev": "serverless offline start --reloadHandler",
    "build": "tsc",
    "deploy": "serverless deploy",
    "deploy:prod": "serverless deploy --stage production",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "logs": "serverless logs -f",
    "invoke:local": "serverless invoke local -f",
    "package": "serverless package",
    "remove": "serverless remove"
  },
  "dependencies": {
    "@middy/core": "^5.2.0",
    "@middy/http-json-body-parser": "^5.2.0",
    "@middy/http-error-handler": "^5.2.0",
    "@middy/http-cors": "^5.2.0",
    "@middy/http-security-headers": "^5.2.0",
    "@middy/http-event-normalizer": "^5.2.0",
    "@middy/http-header-normalizer": "^5.2.0",
    "@middy/validator": "^5.2.0",
    "@middy/input-output-logger": "^5.2.0",
    "@middy/secrets-manager": "^5.2.0",
    "@middy/ssm": "^5.2.0",
    "@middy/warmup": "^5.2.0",
    "@middy/http-response-serializer": "^5.2.0",
    "@aws-sdk/client-dynamodb": "^3.540.0",
    "@aws-sdk/lib-dynamodb": "^3.540.0",
    "@aws-sdk/client-s3": "^3.540.0",
    "@aws-sdk/s3-request-presigner": "^3.540.0",
    "@aws-sdk/client-sqs": "^3.540.0",
    "@aws-sdk/client-sns": "^3.540.0",
    "@aws-sdk/client-secrets-manager": "^3.540.0",
    "@aws-sdk/client-ssm": "^3.540.0",
    "@aws-sdk/client-cloudwatch": "^3.540.0",
    "docker": "^1.0.7",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "winston": "^3.13.0",
    "winston-cloudwatch": "^6.2.0",
    "uuid": "^9.0.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "http-errors": "^2.0.0",
    "aws-xray-sdk-core": "^3.5.4"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.136",
    "@types/node": "^20.12.7",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/bcryptjs": "^2.4.6",
    "@types/uuid": "^9.0.8",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "serverless": "^3.38.0",
    "serverless-offline": "^13.3.3",
    "serverless-plugin-typescript": "^2.1.5",
    "serverless-dotenv-plugin": "^6.0.0",
    "serverless-iam-roles-per-function": "^3.2.0",
    "serverless-plugin-aws-alerts": "^1.7.5",
    "serverless-prune-plugin": "^2.0.2",
    "serverless-plugin-tracing": "^2.0.0",
    "@serverless/typescript": "^3.30.1",
    "esbuild": "^0.20.2"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage", "**/*.test.ts"]
}`,

    // Serverless configuration
    'serverless.ts': `import type { AWS } from '@serverless/typescript';

const serverlessConfiguration: AWS = {
  service: '{{projectName}}',
  frameworkVersion: '3',
  plugins: [
    'serverless-plugin-typescript',
    'serverless-offline',
    'serverless-dotenv-plugin',
    'serverless-iam-roles-per-function',
    'serverless-plugin-aws-alerts',
    'serverless-prune-plugin',
    'serverless-plugin-tracing'
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs20.x',
    region: 'us-east-1',
    stage: '\${opt:stage, "dev"}',
    memorySize: 256,
    timeout: 30,
    tracing: {
      lambda: true,
      apiGateway: true
    },
    environment: {
      NODE_ENV: '\${self:provider.stage}',
      REGION: '\${self:provider.region}',
      SERVICE_NAME: '\${self:service}',
      DYNAMODB_TABLE: '\${self:service}-\${self:provider.stage}-items',
      S3_BUCKET: '\${self:service}-\${self:provider.stage}-uploads',
      SQS_QUEUE_URL: { Ref: 'EventQueue' },
      JWT_SECRET: '\${ssm:/\${self:service}/\${self:provider.stage}/jwt-secret}',
      LOG_LEVEL: '\${self:custom.logLevel.\${self:provider.stage}, "info"}'
    },
    logs: {
      restApi: {
        accessLogging: true,
        executionLogging: true,
        level: 'INFO',
        fullExecutionData: true
      }
    },
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
      metrics: true
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: [
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem'
            ],
            Resource: [
              { 'Fn::GetAtt': ['DynamoDBTable', 'Arn'] },
              { 'Fn::Join': ['/', [{ 'Fn::GetAtt': ['DynamoDBTable', 'Arn'] }, 'index/*']] }
            ]
          },
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
              's3:ListBucket'
            ],
            Resource: [
              { 'Fn::GetAtt': ['S3Bucket', 'Arn'] },
              { 'Fn::Join': ['', [{ 'Fn::GetAtt': ['S3Bucket', 'Arn'] }, '/*']] }
            ]
          },
          {
            Effect: 'Allow',
            Action: [
              'sqs:SendMessage',
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes'
            ],
            Resource: { 'Fn::GetAtt': ['EventQueue', 'Arn'] }
          },
          {
            Effect: 'Allow',
            Action: [
              'ssm:GetParameter',
              'ssm:GetParameters',
              'ssm:GetParametersByPath'
            ],
            Resource: 'arn:aws:ssm:\${self:provider.region}:*:parameter/\${self:service}/\${self:provider.stage}/*'
          },
          {
            Effect: 'Allow',
            Action: [
              'secretsmanager:GetSecretValue'
            ],
            Resource: 'arn:aws:secretsmanager:\${self:provider.region}:*:secret:\${self:service}/\${self:provider.stage}/*'
          },
          {
            Effect: 'Allow',
            Action: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents'
            ],
            Resource: 'arn:aws:logs:\${self:provider.region}:*:*'
          },
          {
            Effect: 'Allow',
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords'
            ],
            Resource: '*'
          }
        ]
      }
    }
  },
  functions: {
    // HTTP API endpoints
    createItem: {
      handler: 'src/handlers/items.create',
      events: [
        {
          http: {
            method: 'post',
            path: 'items',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    getItem: {
      handler: 'src/handlers/items.get',
      events: [
        {
          http: {
            method: 'get',
            path: 'items/{id}',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    updateItem: {
      handler: 'src/handlers/items.update',
      events: [
        {
          http: {
            method: 'put',
            path: 'items/{id}',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    deleteItem: {
      handler: 'src/handlers/items.remove',
      events: [
        {
          http: {
            method: 'delete',
            path: 'items/{id}',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    listItems: {
      handler: 'src/handlers/items.list',
      events: [
        {
          http: {
            method: 'get',
            path: 'items',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    // Auth endpoints
    register: {
      handler: 'src/handlers/auth.register',
      events: [
        {
          http: {
            method: 'post',
            path: 'auth/register',
            cors: true
          }
        }
      ]
    },
    login: {
      handler: 'src/handlers/auth.login',
      events: [
        {
          http: {
            method: 'post',
            path: 'auth/login',
            cors: true
          }
        }
      ]
    },
    // Lambda authorizer
    authorizer: {
      handler: 'src/handlers/auth.authorize',
      environment: {
        JWT_SECRET: '\${ssm:/\${self:service}/\${self:provider.stage}/jwt-secret}'
      }
    },
    // File upload
    uploadFile: {
      handler: 'src/handlers/files.upload',
      events: [
        {
          http: {
            method: 'post',
            path: 'files/upload',
            cors: true,
            authorizer: {
              name: 'authorizer',
              resultTtlInSeconds: 300
            }
          }
        }
      ]
    },
    // SQS event processor
    processEvent: {
      handler: 'src/handlers/events.process',
      events: [
        {
          sqs: {
            arn: { 'Fn::GetAtt': ['EventQueue', 'Arn'] },
            batchSize: 10,
            maximumBatchingWindowInSeconds: 5
          }
        }
      ],
      reservedConcurrency: 5
    },
    // Scheduled task
    cleanupTask: {
      handler: 'src/handlers/scheduled.cleanup',
      events: [
        {
          schedule: {
            rate: 'rate(1 hour)',
            enabled: true
          }
        }
      ]
    },
    // Health check
    health: {
      handler: 'src/handlers/health.check',
      events: [
        {
          http: {
            method: 'get',
            path: 'health',
            cors: true
          }
        }
      ]
    }
  },
  custom: {
    logLevel: {
      dev: 'debug',
      staging: 'info',
      production: 'warn'
    },
    prune: {
      automatic: true,
      number: 3
    },
    alerts: {
      stages: ['staging', 'production'],
      topics: {
        alarm: '\${self:service}-\${opt:stage}-alerts-alarm',
        ok: '\${self:service}-\${opt:stage}-alerts-ok'
      },
      alarms: [
        {
          functionName: '\${self:service}-\${opt:stage}-createItem',
          metricName: 'Errors',
          threshold: 1,
          statistic: 'Sum',
          period: 60,
          evaluationPeriods: 1,
          datapointsToAlarm: 1,
          comparisonOperator: 'GreaterThanOrEqualToThreshold'
        }
      ]
    },
    'serverless-offline': {
      httpPort: 3000,
      lambdaPort: 3002,
      noPrependStageInUrl: true,
      useChildProcesses: true
    }
  },
  resources: {
    Resources: {
      DynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '\${self:provider.environment.DYNAMODB_TABLE}',
          AttributeDefinitions: [
            {
              AttributeName: 'id',
              AttributeType: 'S'
            },
            {
              AttributeName: 'userId',
              AttributeType: 'S'
            },
            {
              AttributeName: 'createdAt',
              AttributeType: 'S'
            }
          ],
          KeySchema: [
            {
              AttributeName: 'id',
              KeyType: 'HASH'
            }
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'UserIdIndex',
              KeySchema: [
                {
                  AttributeName: 'userId',
                  KeyType: 'HASH'
                },
                {
                  AttributeName: 'createdAt',
                  KeyType: 'RANGE'
                }
              ],
              Projection: {
                ProjectionType: 'ALL'
              },
              ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
              }
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          StreamSpecification: {
            StreamViewType: 'NEW_AND_OLD_IMAGES'
          },
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true
          },
          SSESpecification: {
            SSEEnabled: true
          }
        }
      },
      S3Bucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: '\${self:provider.environment.S3_BUCKET}',
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true
          },
          BucketEncryption: {
            ServerSideEncryptionConfiguration: [
              {
                ServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256'
                }
              }
            ]
          },
          LifecycleConfiguration: {
            Rules: [
              {
                Id: 'DeleteOldFiles',
                Status: 'Enabled',
                ExpirationInDays: 30
              }
            ]
          },
          CorsConfiguration: {
            CorsRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
                AllowedOrigins: ['*'],
                MaxAge: 3000
              }
            ]
          }
        }
      },
      EventQueue: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: '\${self:service}-\${self:provider.stage}-events',
          VisibilityTimeout: 300,
          MessageRetentionPeriod: 1209600,
          ReceiveMessageWaitTimeSeconds: 20,
          RedrivePolicy: {
            deadLetterTargetArn: { 'Fn::GetAtt': ['EventDLQ', 'Arn'] },
            maxReceiveCount: 3
          }
        }
      },
      EventDLQ: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: '\${self:service}-\${self:provider.stage}-events-dlq',
          MessageRetentionPeriod: 1209600
        }
      },
      GatewayResponseDefault4XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'"
          },
          ResponseType: 'DEFAULT_4XX',
          RestApiId: { Ref: 'ApiGatewayRestApi' }
        }
      },
      GatewayResponseDefault5XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'"
          },
          ResponseType: 'DEFAULT_5XX',
          RestApiId: { Ref: 'ApiGatewayRestApi' }
        }
      }
    },
    Outputs: {
      ApiGatewayUrl: {
        Description: 'API Gateway URL',
        Value: {
          'Fn::Join': [
            '',
            [
              'https://',
              { Ref: 'ApiGatewayRestApi' },
              '.execute-api.\${self:provider.region}.amazonaws.com/\${self:provider.stage}'
            ]
          ]
        }
      },
      DynamoDBTableName: {
        Description: 'DynamoDB Table Name',
        Value: { Ref: 'DynamoDBTable' }
      },
      S3BucketName: {
        Description: 'S3 Bucket Name',
        Value: { Ref: 'S3Bucket' }
      },
      EventQueueUrl: {
        Description: 'SQS Queue URL',
        Value: { Ref: 'EventQueue' }
      }
    }
  }
};

module.exports = serverlessConfiguration;`,

    // Environment configuration
    '.env.example': `# Environment variables
NODE_ENV=development
LOG_LEVEL=debug

# AWS Configuration (for local development)
AWS_REGION=us-east-1
AWS_PROFILE=default

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Database
DYNAMODB_ENDPOINT=http://localhost:8000

# S3 (for local development with LocalStack)
S3_ENDPOINT=http://localhost:4566

# SQS (for local development with LocalStack)
SQS_ENDPOINT=http://localhost:4566

# API Keys
API_KEY=your-api-key

# External Services
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SENDGRID_API_KEY=your-sendgrid-api-key`,

    // Main handler with Middy middleware
    'src/handlers/items.ts': `import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import httpSecurityHeaders from '@middy/http-security-headers';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import validator from '@middy/validator';
import inputOutputLogger from '@middy/input-output-logger';
import { transpileSchema } from '@middy/validator/transpile';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'docker';
import { v4 as uuidv4 } from 'uuid';
import createError from 'http-errors';
import { logger } from '../utils/logger';
import { dynamoClient } from '../services/dynamodb';
import { authMiddleware } from '../middleware/auth';
import { errorLogger } from '../middleware/error-logger';
import { metricsMiddleware } from '../middleware/metrics';
import { rateLimiter } from '../middleware/rate-limiter';
import { sanitizer } from '../middleware/sanitizer';
import { cacheMiddleware } from '../middleware/cache';

// Input validation schemas
const createItemSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', maxLength: 500 },
        category: { type: 'string', enum: ['electronics', 'books', 'clothing', 'food', 'other'] },
        price: { type: 'number', minimum: 0, maximum: 1000000 },
        quantity: { type: 'integer', minimum: 0 },
        tags: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10
        }
      },
      required: ['name', 'category', 'price'],
      additionalProperties: false
    }
  }
};

const updateItemSchema = {
  type: 'object',
  properties: {
    pathParameters: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      },
      required: ['id']
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', maxLength: 500 },
        category: { type: 'string', enum: ['electronics', 'books', 'clothing', 'food', 'other'] },
        price: { type: 'number', minimum: 0, maximum: 1000000 },
        quantity: { type: 'integer', minimum: 0 },
        tags: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 10
        }
      },
      additionalProperties: false
    }
  }
};

// Create item handler
const createItemHandler = async (
  event: APIGatewayProxyEvent & { user?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  
  const item = {
    id,
    userId: event.user.id,
    ...event.body,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await dynamoClient.putItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)'
    });

    logger.info('Item created successfully', { itemId: id, userId: event.user.id });

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Item created successfully',
        item
      })
    };
  } catch (error) {
    logger.error('Failed to create item', { error, userId: event.user.id });
    throw createError(500, 'Failed to create item');
  }
};

// Get item handler
const getItemHandler = async (
  event: APIGatewayProxyEvent & { user?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { id } = event.pathParameters!;

  try {
    const result = await dynamoClient.getItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id }
    });

    if (!result.Item) {
      throw createError(404, 'Item not found');
    }

    // Check if user owns the item
    if (result.Item.userId !== event.user.id) {
      throw createError(403, 'Access denied');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        item: result.Item
      })
    };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('Failed to get item', { error, itemId: id });
    throw createError(500, 'Failed to get item');
  }
};

// Update item handler
const updateItemHandler = async (
  event: APIGatewayProxyEvent & { user?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { id } = event.pathParameters!;
  const updates = event.body as any;

  try {
    // First, check if item exists and user owns it
    const existingItem = await dynamoClient.getItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id }
    });

    if (!existingItem.Item) {
      throw createError(404, 'Item not found');
    }

    if (existingItem.Item.userId !== event.user.id) {
      throw createError(403, 'Access denied');
    }

    // Update item
    const updatedItem = {
      ...existingItem.Item,
      ...updates,
      id, // Ensure ID cannot be changed
      userId: event.user.id, // Ensure userId cannot be changed
      updatedAt: new Date().toISOString()
    };

    await dynamoClient.putItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Item: updatedItem
    });

    logger.info('Item updated successfully', { itemId: id, userId: event.user.id });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Item updated successfully',
        item: updatedItem
      })
    };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('Failed to update item', { error, itemId: id });
    throw createError(500, 'Failed to update item');
  }
};

// Delete item handler
const deleteItemHandler = async (
  event: APIGatewayProxyEvent & { user?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { id } = event.pathParameters!;

  try {
    // First, check if item exists and user owns it
    const existingItem = await dynamoClient.getItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id }
    });

    if (!existingItem.Item) {
      throw createError(404, 'Item not found');
    }

    if (existingItem.Item.userId !== event.user.id) {
      throw createError(403, 'Access denied');
    }

    // Delete item
    await dynamoClient.deleteItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id }
    });

    logger.info('Item deleted successfully', { itemId: id, userId: event.user.id });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Item deleted successfully'
      })
    };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('Failed to delete item', { error, itemId: id });
    throw createError(500, 'Failed to delete item');
  }
};

// List items handler
const listItemsHandler = async (
  event: APIGatewayProxyEvent & { user?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { limit = '20', lastKey } = event.queryStringParameters || {};

  try {
    const result = await dynamoClient.query({
      TableName: process.env.DYNAMODB_TABLE!,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': event.user.id
      },
      Limit: parseInt(limit),
      ExclusiveStartKey: lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined,
      ScanIndexForward: false // Sort by newest first
    });

    const response: any = {
      items: result.Items || [],
      count: result.Count
    };

    if (result.LastEvaluatedKey) {
      response.nextKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    logger.error('Failed to list items', { error, userId: event.user.id });
    throw createError(500, 'Failed to list items');
  }
};

// Export handlers with Middy middleware
export const create = middy(createItemHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(createItemSchema) }))
  .use(cors())
  .use(httpSecurityHeaders())
  .use(inputOutputLogger({ logger }))
  .use(authMiddleware())
  .use(sanitizer())
  .use(rateLimiter({ maxRequests: 100, windowMs: 60000 }))
  .use(metricsMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());

export const get = middy(getItemHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(cors())
  .use(httpSecurityHeaders())
  .use(inputOutputLogger({ logger }))
  .use(authMiddleware())
  .use(cacheMiddleware({ ttl: 300 }))
  .use(metricsMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());

export const update = middy(updateItemHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(updateItemSchema) }))
  .use(cors())
  .use(httpSecurityHeaders())
  .use(inputOutputLogger({ logger }))
  .use(authMiddleware())
  .use(sanitizer())
  .use(rateLimiter({ maxRequests: 50, windowMs: 60000 }))
  .use(metricsMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());

export const remove = middy(deleteItemHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(cors())
  .use(httpSecurityHeaders())
  .use(inputOutputLogger({ logger }))
  .use(authMiddleware())
  .use(rateLimiter({ maxRequests: 20, windowMs: 60000 }))
  .use(metricsMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());

export const list = middy(listItemsHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(cors())
  .use(httpSecurityHeaders())
  .use(inputOutputLogger({ logger }))
  .use(authMiddleware())
  .use(cacheMiddleware({ ttl: 60 }))
  .use(metricsMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());`,

    // Authentication handlers
    'src/handlers/auth.ts': `import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import httpSecurityHeaders from '@middy/http-security-headers';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import validator from '@middy/validator';
import { transpileSchema } from '@middy/validator/transpile';
import ssm from '@middy/ssm';
import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayAuthorizerResult, Context } from 'docker';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import createError from 'http-errors';
import { logger } from '../utils/logger';
import { dynamoClient } from '../services/dynamodb';
import { errorLogger } from '../middleware/error-logger';
import { sanitizer } from '../middleware/sanitizer';

// Validation schemas
const registerSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8, maxLength: 100 },
        name: { type: 'string', minLength: 1, maxLength: 100 }
      },
      required: ['email', 'password', 'name'],
      additionalProperties: false
    }
  }
};

const loginSchema = {
  type: 'object',
  properties: {
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' }
      },
      required: ['email', 'password'],
      additionalProperties: false
    }
  }
};

// Register handler
const registerHandler = async (
  event: APIGatewayProxyEvent & { secrets?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { email, password, name } = event.body as any;

  try {
    // Check if user already exists
    const existingUser = await dynamoClient.query({
      TableName: process.env.DYNAMODB_TABLE!,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    });

    if (existingUser.Items && existingUser.Items.length > 0) {
      throw createError(409, 'User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const timestamp = new Date().toISOString();
    const user = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
      emailVerified: false,
      isActive: true
    };

    await dynamoClient.putItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Item: user
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, email },
      event.secrets.jwtSecret || process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('User registered successfully', { userId, email });

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'User registered successfully',
        user: {
          id: userId,
          email,
          name
        },
        token
      })
    };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('Failed to register user', { error, email });
    throw createError(500, 'Failed to register user');
  }
};

// Login handler
const loginHandler = async (
  event: APIGatewayProxyEvent & { secrets?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  const { email, password } = event.body as any;

  try {
    // Find user by email
    const result = await dynamoClient.query({
      TableName: process.env.DYNAMODB_TABLE!,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    });

    if (!result.Items || result.Items.length === 0) {
      throw createError(401, 'Invalid credentials');
    }

    const user = result.Items[0];

    // Check if user is active
    if (!user.isActive) {
      throw createError(403, 'Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError(401, 'Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      event.secrets.jwtSecret || process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    await dynamoClient.updateItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id: user.id },
      UpdateExpression: 'SET lastLogin = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': new Date().toISOString()
      }
    });

    logger.info('User logged in successfully', { userId: user.id, email });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      })
    };
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('Failed to login user', { error, email });
    throw createError(500, 'Failed to login');
  }
};

// Lambda authorizer
export const authorize = async (
  event: any,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get user from database to check if still active
    const result = await dynamoClient.getItem({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: { id: decoded.id }
    });

    if (!result.Item || !result.Item.isActive) {
      throw new Error('Unauthorized');
    }

    return {
      principalId: decoded.id,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      },
      context: {
        userId: decoded.id,
        email: decoded.email
      }
    };
  } catch (error) {
    logger.error('Authorization failed', { error, token: token.substring(0, 10) + '...' });
    throw new Error('Unauthorized');
  }
};

// Export handlers with Middy middleware
export const register = middy(registerHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(registerSchema) }))
  .use(cors())
  .use(httpSecurityHeaders())
  .use(sanitizer())
  .use(ssm({
    fetchData: {
      jwtSecret: '\${ssm:/\${self:service}/\${self:provider.stage}/jwt-secret}'
    },
    setToContext: false,
    setToEnv: false
  }))
  .use(errorLogger())
  .use(httpErrorHandler());

export const login = middy(loginHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(validator({ eventSchema: transpileSchema(loginSchema) }))
  .use(cors())
  .use(httpSecurityHeaders())
  .use(sanitizer())
  .use(ssm({
    fetchData: {
      jwtSecret: '\${ssm:/\${self:service}/\${self:provider.stage}/jwt-secret}'
    },
    setToContext: false,
    setToEnv: false
  }))
  .use(errorLogger())
  .use(httpErrorHandler());`,

    // Custom middleware - Authentication
    'src/middleware/auth.ts': `import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import { logger } from '../utils/logger';

export const authMiddleware = () => ({
  before: async (request: any) => {
    const { event } = request;
    const token = event.headers?.Authorization?.replace('Bearer ', '') || 
                   event.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw createError(401, 'No token provided');
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Add user info to event
      event.user = {
        id: decoded.id,
        email: decoded.email
      };

      // Add user context to Lambda context
      if (event.requestContext) {
        event.requestContext.authorizer = {
          principalId: decoded.id,
          ...decoded
        };
      }
    } catch (error) {
      logger.error('Invalid token', { error });
      throw createError(401, 'Invalid token');
    }
  }
});`,

    // Custom middleware - Error Logger
    'src/middleware/error-logger.ts': `import { logger } from '../utils/logger';

export const errorLogger = () => ({
  onError: async (request: any) => {
    const { error, event, context } = request;
    
    // Log error details
    logger.error('Lambda execution error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode
      },
      event: {
        path: event.path,
        method: event.httpMethod,
        headers: event.headers,
        queryStringParameters: event.queryStringParameters,
        pathParameters: event.pathParameters
      },
      context: {
        requestId: context.requestId,
        functionName: context.functionName,
        remainingTimeInMillis: context.getRemainingTimeInMillis()
      }
    });

    // Don't swallow the error
    return request.error;
  }
});`,

    // Custom middleware - Metrics
    'src/middleware/metrics.ts': `import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export const metricsMiddleware = () => {
  let startTime: number;

  return {
    before: async (request: any) => {
      startTime = Date.now();
    },
    after: async (request: any) => {
      const duration = Date.now() - startTime;
      const { event, context } = request;

      try {
        await cloudwatch.send(new PutMetricDataCommand({
          Namespace: 'Lambda/Performance',
          MetricData: [
            {
              MetricName: 'Duration',
              Value: duration,
              Unit: 'Milliseconds',
              Dimensions: [
                {
                  Name: 'FunctionName',
                  Value: context.functionName
                },
                {
                  Name: 'Path',
                  Value: event.path || 'unknown'
                }
              ]
            },
            {
              MetricName: 'SuccessCount',
              Value: 1,
              Unit: 'Count',
              Dimensions: [
                {
                  Name: 'FunctionName',
                  Value: context.functionName
                }
              ]
            }
          ]
        }));
      } catch (error) {
        // Don't fail the request if metrics fail
        console.error('Failed to send metrics', error);
      }
    },
    onError: async (request: any) => {
      const { context, error } = request;

      try {
        await cloudwatch.send(new PutMetricDataCommand({
          Namespace: 'Lambda/Performance',
          MetricData: [
            {
              MetricName: 'ErrorCount',
              Value: 1,
              Unit: 'Count',
              Dimensions: [
                {
                  Name: 'FunctionName',
                  Value: context.functionName
                },
                {
                  Name: 'ErrorType',
                  Value: error.name || 'Unknown'
                }
              ]
            }
          ]
        }));
      } catch (metricsError) {
        console.error('Failed to send error metrics', metricsError);
      }
    }
  };
};`,

    // Custom middleware - Rate Limiter
    'src/middleware/rate-limiter.ts': `import createError from 'http-errors';
import { logger } from '../utils/logger';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

// In-memory store for rate limiting (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (options: RateLimiterOptions) => ({
  before: async (request: any) => {
    const { event } = request;
    const now = Date.now();
    
    // Get client identifier (IP or user ID)
    const clientId = event.user?.id || 
                    event.requestContext?.identity?.sourceIp || 
                    'anonymous';
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // New window
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + options.windowMs
      });
    } else {
      // Existing window
      clientData.count++;
      
      if (clientData.count > options.maxRequests) {
        logger.warn('Rate limit exceeded', {
          clientId,
          count: clientData.count,
          limit: options.maxRequests
        });
        
        throw createError(429, 'Too many requests', {
          headers: {
            'Retry-After': Math.ceil((clientData.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': options.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
          }
        });
      }
    }
    
    // Add rate limit headers to response
    if (!request.response) {
      request.response = {};
    }
    if (!request.response.headers) {
      request.response.headers = {};
    }
    
    const remaining = options.maxRequests - (clientData?.count || 1);
    request.response.headers['X-RateLimit-Limit'] = options.maxRequests.toString();
    request.response.headers['X-RateLimit-Remaining'] = remaining.toString();
    request.response.headers['X-RateLimit-Reset'] = new Date(
      clientData?.resetTime || now + options.windowMs
    ).toISOString();
  }
});`,

    // Custom middleware - Sanitizer
    'src/middleware/sanitizer.ts': `export const sanitizer = () => ({
  before: async (request: any) => {
    const { event } = request;
    
    // Sanitize body
    if (event.body && typeof event.body === 'object') {
      event.body = sanitizeObject(event.body);
    }
    
    // Sanitize query parameters
    if (event.queryStringParameters) {
      event.queryStringParameters = sanitizeObject(event.queryStringParameters);
    }
    
    // Sanitize path parameters
    if (event.pathParameters) {
      event.pathParameters = sanitizeObject(event.pathParameters);
    }
  }
});

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeValue(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
}

function sanitizeValue(value: any): any {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove potential XSS patterns
  let sanitized = value
    .replace(/<script[^>]*>.*?</script>/gi, '')
    .replace(/<iframe[^>]*>.*?</iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/onw+s*=/gi, '');
  
  // Remove SQL injection patterns
  sanitized = sanitized
    .replace(/(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi, '')
    .replace(/[';]--/g, '')
    .replace(//*.*?*//g, '');
  
  // Trim whitespace
  return sanitized.trim();
}`,

    // Custom middleware - Cache
    'src/middleware/cache.ts': `import { logger } from '../utils/logger';

interface CacheOptions {
  ttl: number; // Time to live in seconds
}

// Simple in-memory cache (use Redis or ElastiCache in production)
const cache = new Map<string, { data: any; expires: number }>();

export const cacheMiddleware = (options: CacheOptions) => ({
  before: async (request: any) => {
    const { event } = request;
    
    // Only cache GET requests
    if (event.httpMethod !== 'GET') {
      return;
    }
    
    const cacheKey = generateCacheKey(event);
    const cached = cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
      logger.info('Cache hit', { cacheKey });
      
      // Return cached response
      request.response = {
        statusCode: 200,
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': \`public, max-age=\${options.ttl}\`
        },
        body: cached.data
      };
      
      return request.response;
    }
  },
  
  after: async (request: any) => {
    const { event, response } = request;
    
    // Only cache successful GET requests
    if (event.httpMethod !== 'GET' || response.statusCode !== 200) {
      return;
    }
    
    const cacheKey = generateCacheKey(event);
    const expires = Date.now() + (options.ttl * 1000);
    
    cache.set(cacheKey, {
      data: response.body,
      expires
    });
    
    // Add cache headers
    if (!response.headers) {
      response.headers = {};
    }
    response.headers['X-Cache'] = 'MISS';
    response.headers['Cache-Control'] = \`public, max-age=\${options.ttl}\`;
    
    logger.info('Response cached', { cacheKey, ttl: options.ttl });
  }
});

function generateCacheKey(event: any): string {
  const parts = [
    event.path,
    event.httpMethod,
    JSON.stringify(event.queryStringParameters || {}),
    event.user?.id || 'anonymous'
  ];
  
  return parts.join(':');
}`,

    // DynamoDB service
    'src/services/dynamodb.ts': `import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  ...(process.env.DYNAMODB_ENDPOINT && {
    endpoint: process.env.DYNAMODB_ENDPOINT
  })
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true
  }
});

export const dynamoClient = {
  async putItem(params: any) {
    try {
      const command = new PutCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB putItem error', { error, params });
      throw error;
    }
  },

  async getItem(params: any) {
    try {
      const command = new GetCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB getItem error', { error, params });
      throw error;
    }
  },

  async updateItem(params: any) {
    try {
      const command = new UpdateCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB updateItem error', { error, params });
      throw error;
    }
  },

  async deleteItem(params: any) {
    try {
      const command = new DeleteCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB deleteItem error', { error, params });
      throw error;
    }
  },

  async query(params: any) {
    try {
      const command = new QueryCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB query error', { error, params });
      throw error;
    }
  },

  async scan(params: any) {
    try {
      const command = new ScanCommand(params);
      const result = await docClient.send(command);
      return result;
    } catch (error) {
      logger.error('DynamoDB scan error', { error, params });
      throw error;
    }
  }
};`,

    // S3 service
    'src/services/s3.ts': `import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

const client = new S3Client({
  region: process.env.AWS_REGION,
  ...(process.env.S3_ENDPOINT && {
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true
  })
});

export const s3Client = {
  async putObject(bucket: string, key: string, body: any, contentType?: string) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('S3 putObject error', { error, bucket, key });
      throw error;
    }
  },

  async getObject(bucket: string, key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('S3 getObject error', { error, bucket, key });
      throw error;
    }
  },

  async deleteObject(bucket: string, key: string) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('S3 deleteObject error', { error, bucket, key });
      throw error;
    }
  },

  async listObjects(bucket: string, prefix?: string, maxKeys?: number) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: maxKeys
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('S3 listObjects error', { error, bucket, prefix });
      throw error;
    }
  },

  async getSignedUploadUrl(bucket: string, key: string, expiresIn = 3600) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error('S3 getSignedUploadUrl error', { error, bucket, key });
      throw error;
    }
  },

  async getSignedDownloadUrl(bucket: string, key: string, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      logger.error('S3 getSignedDownloadUrl error', { error, bucket, key });
      throw error;
    }
  }
};`,

    // SQS service
    'src/services/sqs.ts': `import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger';

const client = new SQSClient({
  region: process.env.AWS_REGION,
  ...(process.env.SQS_ENDPOINT && {
    endpoint: process.env.SQS_ENDPOINT
  })
});

export const sqsClient = {
  async sendMessage(queueUrl: string, message: any, attributes?: Record<string, any>) {
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: attributes ? Object.entries(attributes).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: {
            DataType: 'String',
            StringValue: String(value)
          }
        }), {}) : undefined
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('SQS sendMessage error', { error, queueUrl });
      throw error;
    }
  },

  async receiveMessages(queueUrl: string, maxMessages = 10, waitTime = 20) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTime,
        MessageAttributeNames: ['All']
      });
      const result = await client.send(command);
      return result.Messages || [];
    } catch (error) {
      logger.error('SQS receiveMessages error', { error, queueUrl });
      throw error;
    }
  },

  async deleteMessage(queueUrl: string, receiptHandle: string) {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle
      });
      const result = await client.send(command);
      return result;
    } catch (error) {
      logger.error('SQS deleteMessage error', { error, queueUrl });
      throw error;
    }
  },

  async getQueueAttributes(queueUrl: string) {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      });
      const result = await client.send(command);
      return result.Attributes;
    } catch (error) {
      logger.error('SQS getQueueAttributes error', { error, queueUrl });
      throw error;
    }
  }
};`,

    // Logger utility
    'src/utils/logger.ts': `import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';

const logLevel = process.env.LOG_LEVEL || 'info';

// Console transport for local development
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...rest
      }, null, 2);
    })
  )
});

// Create logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME,
    stage: process.env.NODE_ENV
  },
  transports: [consoleTransport]
});

// Add CloudWatch transport in production
if (process.env.NODE_ENV === 'production' && process.env.AWS_REGION) {
  const cloudWatchTransport = new WinstonCloudWatch({
    logGroupName: \`/aws/lambda/\${process.env.AWS_LAMBDA_FUNCTION_NAME}\`,
    logStreamName: new Date().toISOString().split('T')[0],
    awsRegion: process.env.AWS_REGION,
    messageFormatter: ({ level, message, ...rest }) => {
      return JSON.stringify({
        level,
        message,
        ...rest
      });
    }
  });

  logger.add(cloudWatchTransport);
}

// Log unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});`,

    // File upload handler
    'src/handlers/files.ts': `import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import httpSecurityHeaders from '@middy/http-security-headers';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import httpMultipartBodyParser from '@middy/http-multipart-body-parser';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'docker';
import { v4 as uuidv4 } from 'uuid';
import createError from 'http-errors';
import { logger } from '../utils/logger';
import { s3Client } from '../services/s3';
import { authMiddleware } from '../middleware/auth';
import { errorLogger } from '../middleware/error-logger';

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadHandler = async (
  event: APIGatewayProxyEvent & { user?: any; files?: any },
  context: Context
): Promise<APIGatewayProxyResult> => {
  if (!event.files || Object.keys(event.files).length === 0) {
    throw createError(400, 'No file uploaded');
  }

  const file = Object.values(event.files)[0] as any;

  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    throw createError(400, 'Invalid file type');
  }

  // Validate file size
  if (file.content.length > MAX_FILE_SIZE) {
    throw createError(400, 'File size exceeds limit');
  }

  try {
    const fileId = uuidv4();
    const fileExtension = file.filename.split('.').pop();
    const key = \`uploads/\${event.user.id}/\${fileId}.\${fileExtension}\`;

    // Upload to S3
    await s3Client.putObject(
      process.env.S3_BUCKET!,
      key,
      file.content,
      file.mimetype
    );

    // Generate signed URL for download
    const downloadUrl = await s3Client.getSignedDownloadUrl(
      process.env.S3_BUCKET!,
      key,
      3600 // 1 hour
    );

    logger.info('File uploaded successfully', {
      userId: event.user.id,
      fileId,
      key,
      size: file.content.length
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'File uploaded successfully',
        file: {
          id: fileId,
          name: file.filename,
          size: file.content.length,
          type: file.mimetype,
          url: downloadUrl
        }
      })
    };
  } catch (error) {
    logger.error('Failed to upload file', { error, userId: event.user.id });
    throw createError(500, 'Failed to upload file');
  }
};

export const upload = middy(uploadHandler)
  .use(httpEventNormalizer())
  .use(httpHeaderNormalizer())
  .use(httpMultipartBodyParser())
  .use(cors())
  .use(httpSecurityHeaders())
  .use(authMiddleware())
  .use(errorLogger())
  .use(httpErrorHandler());`,

    // Event processor handler
    'src/handlers/events.ts': `import { SQSEvent, Context } from 'docker';
import { logger } from '../utils/logger';
import { sqsClient } from '../services/sqs';

export const process = async (event: SQSEvent, context: Context): Promise<void> => {
  logger.info('Processing SQS events', { count: event.Records.length });

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      
      logger.info('Processing event', {
        messageId: record.messageId,
        eventType: message.type
      });

      // Process different event types
      switch (message.type) {
        case 'user.registered':
          await handleUserRegistered(message.data);
          break;
        case 'item.created':
          await handleItemCreated(message.data);
          break;
        case 'file.uploaded':
          await handleFileUploaded(message.data);
          break;
        default:
          logger.warn('Unknown event type', { type: message.type });
      }

      // Message processed successfully - it will be automatically deleted
    } catch (error) {
      logger.error('Failed to process event', {
        error,
        messageId: record.messageId,
        body: record.body
      });
      
      // Throw error to trigger retry (message will go to DLQ after max retries)
      throw error;
    }
  }
};

async function handleUserRegistered(data: any) {
  logger.info('Handling user registered event', { userId: data.userId });
  
  // Send welcome email
  // Update analytics
  // Create default settings
  // etc.
}

async function handleItemCreated(data: any) {
  logger.info('Handling item created event', { itemId: data.itemId });
  
  // Update search index
  // Send notifications
  // Update statistics
  // etc.
}

async function handleFileUploaded(data: any) {
  logger.info('Handling file uploaded event', { fileId: data.fileId });
  
  // Generate thumbnails
  // Scan for viruses
  // Extract metadata
  // etc.
}`,

    // Scheduled task handler
    'src/handlers/scheduled.ts': `import { ScheduledEvent, Context } from 'docker';
import { logger } from '../utils/logger';
import { dynamoClient } from '../services/dynamodb';
import { s3Client } from '../services/s3';

export const cleanup = async (event: ScheduledEvent, context: Context): Promise<void> => {
  logger.info('Running cleanup task');

  try {
    // Clean up expired sessions
    await cleanupExpiredSessions();
    
    // Clean up old temporary files
    await cleanupOldFiles();
    
    // Clean up orphaned records
    await cleanupOrphanedRecords();
    
    logger.info('Cleanup task completed successfully');
  } catch (error) {
    logger.error('Cleanup task failed', { error });
    throw error;
  }
};

async function cleanupExpiredSessions() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Scan for old sessions and delete them
  const result = await dynamoClient.scan({
    TableName: process.env.DYNAMODB_TABLE!,
    FilterExpression: 'entityType = :type AND lastAccessed < :timestamp',
    ExpressionAttributeValues: {
      ':type': 'session',
      ':timestamp': oneWeekAgo
    }
  });
  
  if (result.Items && result.Items.length > 0) {
    logger.info(\`Found \${result.Items.length} expired sessions to clean up\`);
    
    for (const item of result.Items) {
      await dynamoClient.deleteItem({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: { id: item.id }
      });
    }
  }
}

async function cleanupOldFiles() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // List and delete old temporary files
  const result = await s3Client.listObjects(
    process.env.S3_BUCKET!,
    'temp/',
    1000
  );
  
  if (result.Contents && result.Contents.length > 0) {
    const oldFiles = result.Contents.filter(
      file => file.LastModified && file.LastModified < thirtyDaysAgo
    );
    
    logger.info(\`Found \${oldFiles.length} old temporary files to clean up\`);
    
    for (const file of oldFiles) {
      if (file.Key) {
        await s3Client.deleteObject(process.env.S3_BUCKET!, file.Key);
      }
    }
  }
}

async function cleanupOrphanedRecords() {
  // Implement cleanup logic for orphaned records
  // This could include items without users, incomplete uploads, etc.
}`,

    // Health check handler
    'src/handlers/health.ts': `import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import httpSecurityHeaders from '@middy/http-security-headers';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'docker';
import { dynamoClient } from '../services/dynamodb';
import { s3Client } from '../services/s3';
import { sqsClient } from '../services/sqs';
import { logger } from '../utils/logger';

const healthHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const checks = {
    lambda: 'healthy',
    dynamodb: 'unknown',
    s3: 'unknown',
    sqs: 'unknown'
  };

  // Check DynamoDB
  try {
    await dynamoClient.scan({
      TableName: process.env.DYNAMODB_TABLE!,
      Limit: 1
    });
    checks.dynamodb = 'healthy';
  } catch (error) {
    checks.dynamodb = 'unhealthy';
    logger.error('DynamoDB health check failed', { error });
  }

  // Check S3
  try {
    await s3Client.listObjects(process.env.S3_BUCKET!, '', 1);
    checks.s3 = 'healthy';
  } catch (error) {
    checks.s3 = 'unhealthy';
    logger.error('S3 health check failed', { error });
  }

  // Check SQS
  try {
    await sqsClient.getQueueAttributes(process.env.SQS_QUEUE_URL!);
    checks.sqs = 'healthy';
  } catch (error) {
    checks.sqs = 'unhealthy';
    logger.error('SQS health check failed', { error });
  }

  const allHealthy = Object.values(checks).every(status => status === 'healthy');

  return {
    statusCode: allHealthy ? 200 : 503,
    body: JSON.stringify({
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME,
      stage: process.env.NODE_ENV,
      functionName: context.functionName,
      requestId: context.requestId,
      checks
    })
  };
};

export const check = middy(healthHandler)
  .use(cors())
  .use(httpSecurityHeaders())
  .use(httpErrorHandler());`,

    // Jest configuration
    'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000
};`,

    // Test setup
    'src/__tests__/setup.ts': `import { jest } from '@jest/globals';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sqs');
jest.mock('@aws-sdk/client-secrets-manager');
jest.mock('@aws-sdk/client-ssm');
jest.mock('@aws-sdk/client-cloudwatch');

// Mock environment variables
process.env.AWS_REGION = 'us-east-1';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DYNAMODB_TABLE = 'test-table';
process.env.S3_BUCKET = 'test-bucket';
process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
process.env.JWT_SECRET = 'test-secret';
process.env.SERVICE_NAME = 'test-service';

// Mock logger to reduce noise in tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));`,

    // Unit tests for items handler
    'src/__tests__/handlers/items.test.ts': `import { APIGatewayProxyEvent, Context } from 'docker';
import { create, get, update, remove, list } from '../../handlers/items';
import { dynamoClient } from '../../services/dynamodb';

jest.mock('../../services/dynamodb');

describe('Items Handler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    memoryLimitInMB: '128',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn()
  };

  const mockEvent: APIGatewayProxyEvent = {
    body: JSON.stringify({ name: 'Test Item', category: 'electronics', price: 99.99 }),
    headers: { Authorization: 'Bearer test-token' },
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/items',
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '/items'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const mockPutItem = jest.fn().mockResolvedValue({});
      (dynamoClient.putItem as jest.Mock) = mockPutItem;

      const response = await create.handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(201);
      expect(mockPutItem).toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Item created successfully');
      expect(responseBody.item).toHaveProperty('id');
      expect(responseBody.item.name).toBe('Test Item');
    });

    it('should return 400 for invalid input', async () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({ invalid: 'data' })
      };

      const response = await create.handler(invalidEvent, mockContext);
      
      expect(response.statusCode).toBe(400);
    });
  });

  describe('get', () => {
    it('should retrieve an item', async () => {
      const mockGetItem = jest.fn().mockResolvedValue({
        Item: {
          id: 'test-id',
          name: 'Test Item',
          userId: 'test-user-id'
        }
      });
      (dynamoClient.getItem as jest.Mock) = mockGetItem;

      const eventWithId = {
        ...mockEvent,
        pathParameters: { id: 'test-id' },
        httpMethod: 'GET'
      };

      const response = await get.handler(eventWithId, mockContext);

      expect(response.statusCode).toBe(200);
      expect(mockGetItem).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-id' }
      });
    });

    it('should return 404 for non-existent item', async () => {
      const mockGetItem = jest.fn().mockResolvedValue({ Item: null });
      (dynamoClient.getItem as jest.Mock) = mockGetItem;

      const eventWithId = {
        ...mockEvent,
        pathParameters: { id: 'non-existent-id' },
        httpMethod: 'GET'
      };

      const response = await get.handler(eventWithId, mockContext);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('update', () => {
    it('should update an existing item', async () => {
      const mockGetItem = jest.fn().mockResolvedValue({
        Item: {
          id: 'test-id',
          name: 'Old Name',
          userId: 'test-user-id'
        }
      });
      const mockPutItem = jest.fn().mockResolvedValue({});
      
      (dynamoClient.getItem as jest.Mock) = mockGetItem;
      (dynamoClient.putItem as jest.Mock) = mockPutItem;

      const eventWithUpdate = {
        ...mockEvent,
        pathParameters: { id: 'test-id' },
        body: JSON.stringify({ name: 'Updated Name' }),
        httpMethod: 'PUT'
      };

      const response = await update.handler(eventWithUpdate, mockContext);

      expect(response.statusCode).toBe(200);
      expect(mockGetItem).toHaveBeenCalled();
      expect(mockPutItem).toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.item.name).toBe('Updated Name');
    });
  });

  describe('remove', () => {
    it('should delete an item', async () => {
      const mockGetItem = jest.fn().mockResolvedValue({
        Item: {
          id: 'test-id',
          userId: 'test-user-id'
        }
      });
      const mockDeleteItem = jest.fn().mockResolvedValue({});
      
      (dynamoClient.getItem as jest.Mock) = mockGetItem;
      (dynamoClient.deleteItem as jest.Mock) = mockDeleteItem;

      const eventWithId = {
        ...mockEvent,
        pathParameters: { id: 'test-id' },
        httpMethod: 'DELETE'
      };

      const response = await remove.handler(eventWithId, mockContext);

      expect(response.statusCode).toBe(200);
      expect(mockDeleteItem).toHaveBeenCalledWith({
        TableName: 'test-table',
        Key: { id: 'test-id' }
      });
    });
  });

  describe('list', () => {
    it('should list items for a user', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        Items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' }
        ],
        Count: 2
      });
      (dynamoClient.query as jest.Mock) = mockQuery;

      const response = await list.handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      expect(mockQuery).toHaveBeenCalled();
      
      const responseBody = JSON.parse(response.body);
      expect(responseBody.items).toHaveLength(2);
      expect(responseBody.count).toBe(2);
    });
  });
});`,

    // README
    'README.md': `# Middy AWS Lambda Project

A serverless AWS Lambda project using Middy middleware engine with TypeScript.

## Features

- **Middy Middleware Engine**: Composable middleware for Lambda functions
- **AWS Lambda with TypeScript**: Type-safe serverless functions
- **Built-in Middlewares**: JSON parsing, error handling, CORS, security headers
- **Custom Middlewares**: Authentication, rate limiting, caching, metrics
- **AWS SDK v3 Integration**: DynamoDB, S3, SQS, Secrets Manager, SSM
- **Serverless Framework**: Infrastructure as code with automatic deployments
- **Environment Management**: Secure secrets and configuration
- **Request/Response Validation**: Schema validation with AJV
- **Comprehensive Logging**: Winston with CloudWatch integration
- **Unit Testing**: Jest with full test coverage
- **Local Development**: Serverless Offline for local testing

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with credentials
- Serverless Framework CLI

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

1. Copy \`.env.example\` to \`.env\` and configure your environment variables
2. Update \`serverless.ts\` with your AWS region and service name
3. Create SSM parameters for secrets:
   \`\`\`bash
   aws ssm put-parameter --name "/your-service/dev/jwt-secret" --value "your-secret" --type SecureString
   \`\`\`

## Development

Start local development server:

\`\`\`bash
npm run dev
\`\`\`

This starts Serverless Offline on http://localhost:3000

## Testing

Run unit tests:

\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## Deployment

Deploy to AWS:

\`\`\`bash
npm run deploy        # Deploy to dev stage
npm run deploy:prod   # Deploy to production
\`\`\`

## API Endpoints

### Authentication
- \`POST /auth/register\` - Register new user
- \`POST /auth/login\` - Login user

### Items
- \`GET /items\` - List items (authenticated)
- \`GET /items/{id}\` - Get item (authenticated)
- \`POST /items\` - Create item (authenticated)
- \`PUT /items/{id}\` - Update item (authenticated)
- \`DELETE /items/{id}\` - Delete item (authenticated)

### Files
- \`POST /files/upload\` - Upload file (authenticated)

### Health
- \`GET /health\` - Health check

## Middleware Stack

Each handler uses a combination of built-in and custom Middy middlewares:

1. **httpEventNormalizer**: Normalizes API Gateway events
2. **httpHeaderNormalizer**: Normalizes HTTP headers
3. **jsonBodyParser**: Parses JSON request bodies
4. **validator**: Validates requests against JSON schemas
5. **cors**: Adds CORS headers
6. **httpSecurityHeaders**: Adds security headers
7. **authMiddleware**: JWT authentication (custom)
8. **sanitizer**: Input sanitization (custom)
9. **rateLimiter**: Rate limiting (custom)
10. **cacheMiddleware**: Response caching (custom)
11. **metricsMiddleware**: CloudWatch metrics (custom)
12. **errorLogger**: Error logging (custom)
13. **httpErrorHandler**: HTTP error responses

## Custom Middleware Examples

### Authentication Middleware
\`\`\`typescript
export const authMiddleware = () => ({
  before: async (request) => {
    const token = extractToken(request.event);
    const user = await verifyToken(token);
    request.event.user = user;
  }
});
\`\`\`

### Rate Limiting Middleware
\`\`\`typescript
handler.use(rateLimiter({ 
  maxRequests: 100, 
  windowMs: 60000 
}));
\`\`\`

## Project Structure

\`\`\`
.
├── src/
│   ├── handlers/         # Lambda function handlers
│   ├── middleware/       # Custom Middy middlewares
│   ├── services/         # AWS service clients
│   ├── utils/           # Utility functions
│   └── __tests__/       # Unit tests
├── serverless.ts        # Serverless Framework config
├── tsconfig.json        # TypeScript config
├── jest.config.js       # Jest test config
└── package.json         # Dependencies
\`\`\`

## Security Features

- JWT authentication with refresh tokens
- Request input sanitization
- Rate limiting per user/IP
- CORS configuration
- Security headers (CSP, HSTS, etc.)
- Encrypted secrets with SSM
- IAM role with least privileges

## Monitoring & Debugging

- CloudWatch Logs with structured logging
- X-Ray tracing enabled
- Custom CloudWatch metrics
- Error alerting with SNS
- Request/response logging

## Best Practices

1. **Middleware Composition**: Build complex behaviors from simple middlewares
2. **Error Handling**: Use http-errors and centralized error handling
3. **Validation**: Validate all inputs with JSON schemas
4. **Security**: Always authenticate and authorize requests
5. **Monitoring**: Log all important events and metrics
6. **Testing**: Write unit tests for handlers and middlewares
7. **Performance**: Use caching and connection pooling

## License

MIT
  }
};`,

    // Custom middleware - Request ID
    'src/middleware/request-id.ts': `import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = () => ({
  before: async (request: any) => {
    const requestId = request.event.headers?.['X-Request-ID'] || uuidv4();
    
    // Add to event
    request.event.requestId = requestId;
    
    // Add to context
    request.context.requestId = requestId;
    
    // Ensure response headers exist
    if (!request.response) {
      request.response = {};
    }
    if (!request.response.headers) {
      request.response.headers = {};
    }
    
    // Add to response headers
    request.response.headers['X-Request-ID'] = requestId;
  }
});`,

    // Custom middleware - Warmup
    'src/middleware/warmup.ts': `export const warmupMiddleware = () => ({
  before: async (request: any) => {
    const { event } = request;
    
    // Check if this is a warmup request
    if (event.source === 'serverless-plugin-warmup') {
      console.log('WarmUp - Lambda is warm!');
      
      // Return early to skip handler execution
      request.response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'Lambda is warm!' })
      };
      
      return request.response;
    }
  }
});`,

    // Docker configuration
    'Dockerfile': `FROM public.ecr.aws/lambda/nodejs:20

# Copy function code
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

# Set the CMD to your handler
CMD [ "dist/handlers/items.create" ]`,

    '.dockerignore': `node_modules
npm-debug.log
.env
.env.*
!.env.example
coverage
.nyc_output
.serverless
.git
.gitignore
README.md
.eslintrc*
.prettierrc*
jest.config.js
tsconfig.json
*.test.ts
*.spec.ts
__tests__
.vscode
.idea
*.swp
*.swo
*~
.DS_Store`,

    // ESLint configuration
    '.eslintrc.js': `module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
};`,

    // Prettier configuration
    '.prettierrc': `{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}`,

    '.gitignore': `# Dependencies
node_modules/

# Build output
dist/
.build/

# Serverless
.serverless/

# Environment
.env
.env.*
!.env.example

# AWS
.aws-sam/

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
*.pid
*.seed
*.pid.lock`
  }
};