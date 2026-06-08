// Database Query Optimization and Indexing Recommendations
// ORM-specific query optimization and indexing strategies

import { BackendTemplate } from '../types';

export const databaseOptimizationOrmTemplate: BackendTemplate = {
  id: 'database-optimization-orm',
  name: 'Database Query Optimization & Indexing for ORMs',
  displayName: 'ORM-Specific Database Query Optimization and Indexing Recommendations',
  description: 'Advanced query optimization and indexing recommendations for Prisma, TypeORM, Mongoose, Sequelize, and other ORMs',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['database', 'performance', 'rest-api'],
  tags: ['database', 'orm', 'optimization', 'indexing', 'query'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-database-optimization-orm",
  "version": "1.0.0",
  "description": "{{name}} - Database Query Optimization & Indexing for ORMs",
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
    "@prisma/client": "^5.3.1",
    "typeorm": "^0.3.17",
    "mongoose": "^7.5.0",
    "sequelize": "^6.33.0",
    "pg": "^8.11.3",
    "mysql2": "^3.6.0",
    "mongodb": "^6.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "prisma": "^5.3.1"
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

    'src/index.ts': `// Database Query Optimization & Indexing Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ORMQueryOptimizer } from './orm-query-optimizer';
import { IndexingAdvisor } from './indexing-advisor';
import { QueryAnalyzer } from './query-analyzer';
import { apiRoutes } from './routes/api.routes';
import { ormRoutes } from './routes/orm.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize optimization components
const ormOptimizer = new ORMQueryOptimizer();
const indexingAdvisor = new IndexingAdvisor();
const queryAnalyzer = new QueryAnalyzer();

// Mount routes
app.use('/api', apiRoutes(ormOptimizer, indexingAdvisor, queryAnalyzer));
app.use('/orm', ormRoutes(ormOptimizer));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🗄️ Database Query Optimization Server running on port \${PORT}\`);
  console.log(\`📊 Supported ORMs: Prisma, TypeORM, Mongoose, Sequelize\`);
});`,

    'src/orm-query-optimizer.ts': `// ORM Query Optimizer
// ORM-specific query optimization strategies

export interface ORMQueryOptimization {
  orm: 'prisma' | 'typeorm' | 'mongoose' | 'sequelize';
  query: string;
  originalQuery: string;
  optimizedQuery: string;
  recommendations: string[];
  indexes: string[];
  performance: {
    originalTime: number;
    optimizedTime: number;
    improvement: string;
  };
}

export class ORMQueryOptimizer {
  optimizePrismaQuery(query: string): ORMQueryOptimization {
    const recommendations: string[] = [];
    const indexes: string[] = [];
    let optimizedQuery = query;

    // Check for N+1 queries
    if (query.includes('.findMany') && query.includes('.include')) {
      recommendations.push('Use select instead of include for better performance');
      recommendations.push('Consider using select with relation for nested data');
    }

    // Check for missing where clauses
    if (query.includes('.findMany') && !query.includes('.where')) {
      recommendations.push('Add a .where clause to limit results');
      recommendations.push('Consider using cursor-based pagination for large datasets');
    }

    // Check for missing select
    if (query.includes('.findFirst') && !query.includes('.select')) {
      recommendations.push('Use .select to only fetch required fields');
      indexes.push('Add index on frequently queried fields');
    }

    // Check for lack of pagination
    if (query.includes('.findMany') && !query.includes('.take') && !query.includes('.skip')) {
      recommendations.push('Add pagination with .take and .skip');
      recommendations.push('Consider cursor-based pagination for better performance');
    }

    return {
      orm: 'prisma',
      query,
      originalQuery: query,
      optimizedQuery,
      recommendations,
      indexes,
      performance: {
        originalTime: 0,
        optimizedTime: 0,
        improvement: '0%',
      },
    };
  }

  optimizeTypeORMQuery(query: string): ORMQueryOptimization {
    const recommendations: string[] = [];
    const indexes: string[] = [];
    let optimizedQuery = query;

    // Check for N+1 queries with relations
    if (query.includes('.find(') && query.includes('.relations')) {
      recommendations.push('Use join instead of separate relation queries');
      recommendations.push('Consider using QueryBuilder for complex queries');
    }

    // Check for missing select
    if (query.includes('.findOne') || query.includes('.find(')) {
      if (!query.includes('.select')) {
        recommendations.push('Use .select() to specify required columns');
        optimizedQuery = query.replace(/\\.find\\(([^)]+)\\)/, '.find($1).select([])');
      }
    }

    // Check for query builder usage
    if (!query.includes('createQueryBuilder')) {
      recommendations.push('Consider using createQueryBuilder for complex queries');
      recommendations.push('Use leftJoinAndSelect instead of relations for better control');
    }

    // Check for caching opportunities
    if (query.includes('.findOne') && !query.includes('.cache')) {
      recommendations.push('Add .cache() for frequently accessed entities');
    }

    return {
      orm: 'typeorm',
      query,
      originalQuery: query,
      optimizedQuery,
      recommendations,
      indexes,
      performance: {
        originalTime: 0,
        optimizedTime: 0,
        improvement: '0%',
      },
    };
  }

  optimizeMongooseQuery(query: string): ORMQueryOptimization {
    const recommendations: string[] = [];
    const indexes: string[] = [];
    let optimizedQuery = query;

    // Check for lean() usage
    if (query.includes('.find(') || query.includes('.findOne(')) {
      if (!query.includes('.lean()')) {
        recommendations.push('Use .lean() to return plain JavaScript objects');
        optimizedQuery = query.replace(/\\.find\\(([^)]+)\\)/, '.find($1).lean()');
      }
    }

    // Check for projection
    if (query.includes('.find(')) {
      if (!query.includes(', ') && !query.includes('.select(')) {
        recommendations.push('Use field selection to limit returned data');
        recommendations.push('Example: .find({}, { name: 1, email: 1 })');
      }
    }

    // Check for missing indexes
    if (query.includes('.findOne(')) {
      const fieldMatch = query.match(/\\.findOne\\(\\s*\\{\\s*(\\w+):/);
      if (fieldMatch) {
        indexes.push(\`Create compound index on { \${fieldMatch[1]}: 1 }\`);
      }
    }

    // Check for population
    if (query.includes('.populate(')) {
      recommendations.push('Use lean() with populate for better performance');
      recommendations.push('Consider virtual population instead of ref/populate');
    }

    // Check for pagination
    if (query.includes('.find(') && !query.includes('.limit(') && !query.includes('.skip(')) {
      recommendations.push('Add pagination with .limit() and .skip()');
      recommendations.push('Consider using cursor-based pagination for large datasets');
    }

    return {
      orm: 'mongoose',
      query,
      originalQuery: query,
      optimizedQuery,
      recommendations,
      indexes,
      performance: {
        originalTime: 0,
        optimizedTime: 0,
        improvement: '0%',
      },
    };
  }

  optimizeSequelizeQuery(query: string): ORMQueryOptimization {
    const recommendations: string[] = [];
    const indexes: string[] = [];
    let optimizedQuery = query;

    // Check for attributes
    if (query.includes('.findAll(') || query.includes('.findOne(')) {
      if (!query.includes('attributes:')) {
        recommendations.push('Specify attributes to limit returned columns');
        recommendations.push('Example: { attributes: ["id", "name"] }');
      }
    }

    // Check for raw queries
    if (query.includes('.sequelize.query(')) {
      recommendations.push('Prefer ORM methods over raw queries for security');
      recommendations.push('Use parameterized queries if raw SQL is necessary');
    }

    // Check for includes
    if (query.includes('include:')) {
      recommendations.push('Use required: false for optional associations');
      recommendations.push('Use attributes in include to limit nested data');
    }

    // Check for caching
    if (!query.includes('.cache(')) {
      recommendations.push('Enable query caching for frequently accessed data');
    }

    // Check for subqueries
    if (query.includes('WHERE') && query.includes('IN')) {
      recommendations.push('Consider using Sequelize.literal() for complex subqueries');
    }

    return {
      orm: 'sequelize',
      query,
      originalQuery: query,
      optimizedQuery,
      recommendations,
      indexes,
      performance: {
        originalTime: 0,
        optimizedTime: 0,
        improvement: '0%',
      },
    };
  }

  optimize(orm: string, query: string): ORMQueryOptimization {
    switch (orm) {
      case 'prisma':
        return this.optimizePrismaQuery(query);
      case 'typeorm':
        return this.optimizeTypeORMQuery(query);
      case 'mongoose':
        return this.optimizeMongooseQuery(query);
      case 'sequelize':
        return this.optimizeSequelizeQuery(query);
      default:
        throw new Error(\`Unsupported ORM: \${orm}\`);
    }
  }
}`,

    'src/indexing-advisor.ts': `// Indexing Advisor
// Database indexing recommendations for all ORMs

export interface IndexRecommendation {
  tableName: string;
  columnName: string;
  indexType: 'single' | 'compound' | 'unique' | 'fulltext' | 'spatial';
  reason: string;
  priority: 'high' | 'medium' | 'low';
  orm: 'prisma' | 'typeorm' | 'mongoose' | 'sequelize';
  definition: string;
}

export class IndexingAdvisor {
  analyzePrismaSchema(schema: string): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Analyze Prisma schema for indexing opportunities
    const lines = schema.split('\\n');
    let currentModel = '';

    for (const line of lines) {
      // Track current model
      if (line.trim().startsWith('model ')) {
        currentModel = line.match(/model\\s+(\\w+)/)?.[1] || '';
        continue;
      }

      // Check for foreign keys
      if (line.includes('@relation(')) {
        const field = line.match(/(\\w+)\\s+/)?.[1];
        if (field) {
          recommendations.push({
            tableName: currentModel,
            columnName: field,
            indexType: 'single',
            reason: 'Foreign key should be indexed for join performance',
            priority: 'high',
            orm: 'prisma',
            definition: \`@@index([\${field}])\`,
          });
        }
      }

      // Check for unique fields without explicit index
      if (line.includes('@unique') && !line.includes('@id')) {
        const field = line.match(/(\\w+)\\s+/)?.[1];
        if (field) {
          recommendations.push({
            tableName: currentModel,
            columnName: field,
            indexType: 'unique',
            reason: 'Unique constraint automatically creates index',
            priority: 'low',
            orm: 'prisma',
            definition: \`@@unique([\${field}])\`,
          });
        }
      }
    }

    return recommendations;
  }

  analyzeTypeORMEntity(entityCode: string): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Check for @OneToMany without index
    if (entityCode.includes('@OneToMany') && !entityCode.includes('@Index')) {
      recommendations.push({
        tableName: 'entity',
        columnName: 'relation_column',
        indexType: 'single',
        reason: 'Add index on foreign key columns for join performance',
        priority: 'high',
        orm: 'typeorm',
        definition: '@Index()',
      });
    }

    // Check for @Column without index
    const columnMatches = entityCode.matchAll(/@Column\\(\\{[^}]*\\}\\)\\s+(\\w+)/g);
    for (const match of columnMatches) {
      const columnName = match[2];
      if (columnName.endsWith('Id') || columnName.endsWith('_id')) {
        recommendations.push({
          tableName: 'entity',
          columnName,
          indexType: 'single',
          reason: 'Foreign key column should be indexed',
          priority: 'high',
          orm: 'typeorm',
          definition: \`@Index(['\${columnName}'])\`,
        });
      }
    }

    return recommendations;
  }

  analyzeMongooseSchema(schemaCode: string): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Check for fields without indexes
    const fieldMatches = schemaCode.matchAll(/(\\w+):\\s*\\{[^}]*\\}/g);
    for (const match of fieldMatches) {
      const fieldName = match[1];

      // Suggest index for email fields
      if (fieldName === 'email') {
        recommendations.push({
          tableName: 'collection',
          columnName: fieldName,
          indexType: 'unique',
          reason: 'Email should be unique and indexed for lookups',
          priority: 'high',
          orm: 'mongoose',
          definition: \`schema.index({ \${fieldName}: 1 }, { unique: true })\`,
        });
      }

      // Suggest index for foreign keys
      if (fieldName.endsWith('Id') || fieldName.endsWith('_id')) {
        recommendations.push({
          tableName: 'collection',
          columnName: fieldName,
          indexType: 'single',
          reason: 'Foreign key should be indexed',
          priority: 'high',
          orm: 'mongoose',
          definition: \`schema.index({ \${fieldName}: 1 })\`,
        });
      }

      // Suggest index for date fields
      if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('created')) {
        recommendations.push({
          tableName: 'collection',
          columnName: fieldName,
          indexType: 'single',
          reason: 'Date fields benefit from indexes for range queries',
          priority: 'medium',
          orm: 'mongoose',
          definition: \`schema.index({ \${fieldName}: -1 })\`,
        });
      }
    }

    // Check for text search fields
    if (schemaCode.includes('String') && !schemaCode.includes('text: true')) {
      recommendations.push({
        tableName: 'collection',
        columnName: 'searchable_field',
        indexType: 'fulltext',
        reason: 'Consider text index for full-text search',
        priority: 'medium',
        orm: 'mongoose',
        definition: 'schema.index({ field: "text" })',
      });
    }

    return recommendations;
  }

  analyzeSequelizeModel(modelCode: string): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Check for foreign keys
    const fkMatches = modelCode.matchAll(/(\\w+):\\s*\\{[^}]*references[^}]*\\}/g);
    for (const match of fkMatches) {
      const fieldName = match[1];
      recommendations.push({
        tableName: 'table',
        columnName: fieldName,
        indexType: 'single',
        reason: 'Foreign key should be indexed for join performance',
        priority: 'high',
        orm: 'sequelize',
        definition: \`indexes: [
          { fields: ['\${fieldName}'] }
        ]\`,
      });
    }

    // Check for unique constraints
    if (modelCode.includes('unique: true') && !modelCode.includes('indexes:')) {
      recommendations.push({
        tableName: 'table',
        columnName: 'unique_field',
        indexType: 'unique',
        reason: 'Unique constraint should have an index',
        priority: 'medium',
        orm: 'sequelize',
        definition: \`indexes: [
          { unique: true, fields: ['field'] }
        ]\`,
      });
    }

    return recommendations;
  }

  generatePrismaIndex(recommendation: IndexRecommendation): string {
    return \`// Prisma schema index
model \${recommendation.tableName} {
  // ... fields
  \${recommendation.definition}
}
\`;
  }

  generateTypeORMIndex(recommendation: IndexRecommendation): string {
    return \`// TypeORM entity index
@Entity()
@Index(['\${recommendation.columnName}'])
export class Entity {
  // ... fields
}
\`;
  }

  generateMongooseIndex(recommendation: IndexRecommendation): string {
    return \`// Mongoose schema index
\${recommendation.definition}
\`;
  }

  generateSequelizeIndex(recommendation: IndexRecommendation): string {
    return \`// Sequelize model index
\${recommendation.definition}
\`;
  }
}`,

    'src/query-analyzer.ts': `// Query Analyzer
// Analyze queries for performance issues

export interface QueryAnalysis {
  query: string;
  orm: string;
  issues: QueryIssue[];
  suggestions: string[];
  estimatedImprovement: string;
}

export interface QueryIssue {
  type: 'n-plus-one' | 'missing-index' | 'cartesian-product' | 'select-star' | 'missing-pagination' | 'inefficient-join';
  severity: 'high' | 'medium' | 'low';
  message: string;
  location: string;
}

export class QueryAnalyzer {
  analyze(query: string, orm: string): QueryAnalysis {
    const issues: QueryIssue[] = [];
    const suggestions: string[] = [];

    // Check for N+1 queries
    if (this.detectNPlusOne(query, orm)) {
      issues.push({
        type: 'n-plus-one',
        severity: 'high',
        message: 'Potential N+1 query detected',
        location: 'query execution',
      });
      suggestions.push('Use eager loading with include/select');
      suggestions.push('Consider using dataloader pattern');
    }

    // Check for SELECT * equivalent
    if (this.detectSelectStar(query, orm)) {
      issues.push({
        type: 'select-star',
        severity: 'medium',
        message: 'Query selects all columns',
        location: 'projection',
      });
      suggestions.push('Specify only required fields');
      suggestions.push('Use .select() or projection');
    }

    // Check for missing pagination
    if (this.detectMissingPagination(query, orm)) {
      issues.push({
        type: 'missing-pagination',
        severity: 'medium',
        message: 'Query lacks pagination',
        location: 'result limiting',
      });
      suggestions.push('Add .limit()/.take()');
      suggestions.push('Implement cursor-based pagination');
    }

    // Check for inefficient joins
    if (this.detectInefficientJoins(query, orm)) {
      issues.push({
        type: 'inefficient-join',
        severity: 'high',
        message: 'Potential inefficient join detected',
        location: 'join operation',
      });
      suggestions.push('Use leftJoinAndSelect for better control');
      suggestions.push('Add indexes on join columns');
    }

    const estimatedImprovement = this.calculateImprovement(issues);

    return {
      query,
      orm,
      issues,
      suggestions,
      estimatedImprovement,
    };
  }

  private detectNPlusOne(query: string, orm: string): boolean {
    // Look for patterns that indicate N+1 queries
    const patterns = [
      /forEach.*find/,
      /map.*find/,
      /for.*of.*find/,
      /\\.find\\(.*\\.find\\(/,
      /include.*include/,
      /populate.*populate/,
    ];

    return patterns.some((pattern) => pattern.test(query));
  }

  private detectSelectStar(query: string, orm: string): boolean {
    if (orm === 'prisma') {
      return query.includes('.findMany(') && !query.includes('.select');
    }
    if (orm === 'typeorm') {
      return (query.includes('.find(') || query.includes('.findBy(')) && !query.includes('.select');
    }
    if (orm === 'mongoose') {
      return query.includes('.find(') && !query.includes('.lean()') && !query.includes(', ');
    }
    if (orm === 'sequelize') {
      return (query.includes('.findAll(') || query.includes('.findOne(')) && !query.includes('attributes:');
    }
    return false;
  }

  private detectMissingPagination(query: string, orm: string): boolean {
    if (orm === 'prisma') {
      return query.includes('.findMany(') && !query.includes('.take') && !query.includes('.skip');
    }
    if (orm === 'typeorm') {
      return query.includes('.find(') && !query.includes('.take') && !query.includes('.skip');
    }
    if (orm === 'mongoose') {
      return query.includes('.find(') && !query.includes('.limit(') && !query.includes('.skip(');
    }
    if (orm === 'sequelize') {
      return query.includes('.findAll(') && !query.includes('.limit') && !query.includes('.offset');
    }
    return false;
  }

  private detectInefficientJoins(query: string, orm: string): boolean {
    const inefficientPatterns = [
      /join.*where.*or/i,
      /join.*join.*join/,
      /include.*include.*include/,
      /populate.*populate.*populate/,
    ];

    return inefficientPatterns.some((pattern) => pattern.test(query));
  }

  private calculateImprovement(issues: QueryIssue[]): string {
    const highSeverityIssues = issues.filter((i) => i.severity === 'high').length;
    const mediumSeverityIssues = issues.filter((i) => i.severity === 'medium').length;

    if (highSeverityIssues > 0) {
      return \`50-80% improvement possible (\${highSeverityIssues} critical issues)\`;
    } else if (mediumSeverityIssues > 2) {
      return \`20-50% improvement possible (\${mediumSeverityIssues} issues)\`;
    } else if (mediumSeverityIssues > 0) {
      return \`10-30% improvement possible\`;
    }
    return 'Minor improvements possible';
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { ORMQueryOptimizer } from '../orm-query-optimizer';
import { IndexingAdvisor } from '../indexing-advisor';
import { QueryAnalyzer } from '../query-analyzer';

export function apiRoutes(
  ormOptimizer: ORMQueryOptimizer,
  indexingAdvisor: IndexingAdvisor,
  queryAnalyzer: QueryAnalyzer
): Router {
  const router = Router();

  // Optimize query
  router.post('/optimize', (req, res) => {
    const { orm, query } = req.body;

    if (!orm || !query) {
      return res.status(400).json({ error: 'orm and query are required' });
    }

    try {
      const optimization = ormOptimizer.optimize(orm, query);
      res.json(optimization);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Analyze schema for indexing
  router.post('/analyze/schema', (req, res) => {
    const { orm, schema } = req.body;

    if (!orm || !schema) {
      return res.status(400).json({ error: 'orm and schema are required' });
    }

    let recommendations;

    switch (orm) {
      case 'prisma':
        recommendations = indexingAdvisor.analyzePrismaSchema(schema);
        break;
      case 'typeorm':
        recommendations = indexingAdvisor.analyzeTypeORMEntity(schema);
        break;
      case 'mongoose':
        recommendations = indexingAdvisor.analyzeMongooseSchema(schema);
        break;
      case 'sequelize':
        recommendations = indexingAdvisor.analyzeSequelizeModel(schema);
        break;
      default:
        return res.status(400).json({ error: \`Unsupported ORM: \${orm}\` });
    }

    res.json({ orm, recommendations });
  });

  // Analyze query
  router.post('/analyze/query', (req, res) => {
    const { query, orm } = req.body;

    if (!query || !orm) {
      return res.status(400).json({ error: 'query and orm are required' });
    }

    const analysis = queryAnalyzer.analyze(query, orm);
    res.json(analysis);
  });

  // Generate index code
  router.post('/generate/index', (req, res) => {
    const { recommendation } = req.body;

    if (!recommendation) {
      return res.status(400).json({ error: 'recommendation is required' });
    }

    let code;

    switch (recommendation.orm) {
      case 'prisma':
        code = indexingAdvisor.generatePrismaIndex(recommendation);
        break;
      case 'typeorm':
        code = indexingAdvisor.generateTypeORMIndex(recommendation);
        break;
      case 'mongoose':
        code = indexingAdvisor.generateMongooseIndex(recommendation);
        break;
      case 'sequelize':
        code = indexingAdvisor.generateSequelizeIndex(recommendation);
        break;
      default:
        return res.status(400).json({ error: \`Unsupported ORM: \${recommendation.orm}\` });
    }

    res.json({ code, recommendation });
  });

  return router;
}`,

    'src/routes/orm.routes.ts': `// ORM Routes
import { Router } from 'express';
import { ORMQueryOptimizer } from '../orm-query-optimizer';

export function ormRoutes(ormOptimizer: ORMQueryOptimizer): Router {
  const router = Router();

  // Prisma optimization
  router.post('/prisma/optimize', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const optimization = ormOptimizer.optimizePrismaQuery(query);
    res.json(optimization);
  });

  // TypeORM optimization
  router.post('/typeorm/optimize', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const optimization = ormOptimizer.optimizeTypeORMQuery(query);
    res.json(optimization);
  });

  // Mongoose optimization
  router.post('/mongoose/optimize', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const optimization = ormOptimizer.optimizeMongooseQuery(query);
    res.json(optimization);
  });

  // Sequelize optimization
  router.post('/sequelize/optimize', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const optimization = ormOptimizer.optimizeSequelizeQuery(query);
    res.json(optimization);
  });

  return router;
}`,

    'README.md': `# Database Query Optimization & Indexing for ORMs

ORM-specific database query optimization and indexing recommendations for Prisma, TypeORM, Mongoose, and Sequelize.

## Features

### 🔍 **Query Analysis**
- **N+1 Query Detection**: Identify queries that cause N+1 problems
- **SELECT* Detection**: Find queries fetching all columns
- **Missing Pagination**: Detect queries without result limiting
- **Inefficient Join Detection**: Identify problematic join operations
- **Performance Estimation**: Calculate potential improvements

### 📊 **ORM-Specific Optimization**
- **Prisma**: Optimize .findMany(), .findFirst(), include, select
- **TypeORM**: Optimize find(), relations, QueryBuilder usage
- **Mongoose**: Optimize find(), lean(), populate(), projection
- **Sequelize**: Optimize findAll(), include, attributes, raw queries

### 📈 **Indexing Advisor**
- **Foreign Key Indexing**: Automatically suggest indexes for foreign keys
- **Unique Field Indexing**: Recommend indexes for frequently queried fields
- **Compound Indexes**: Suggest multi-column indexes for common query patterns
- **Full-Text Search**: Identify fields suitable for text indexing
- **Code Generation**: Generate index definitions for each ORM

## Quick Start

### 1. Optimize Prisma Query

\`\`\`bash
curl -X POST http://localhost:3000/orm/prisma/optimize \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "prisma.user.findMany({ include: { posts: true } })"
  }'
\`\`\`

Response:
\`\`\`json
{
  "orm": "prisma",
  "query": "...",
  "originalQuery": "...",
  "optimizedQuery": "...",
  "recommendations": [
    "Use select instead of include for better performance",
    "Consider using select with relation for nested data"
  ],
  "indexes": [],
  "performance": {
    "originalTime": 0,
    "optimizedTime": 0,
    "improvement": "0%"
  }
}
\`\`\`

### 2. Analyze Schema for Indexes

**Prisma Schema:**
\`\`\`bash
curl -X POST http://localhost:3000/api/analyze/schema \\
  -H "Content-Type: application/json" \\
  -d '{
    "orm": "prisma",
    "schema": "model User { id Int @id @default(autoincrement()) email String posts Post[] }"
  }'
\`\`\`

### 3. Analyze Query for Issues

\`\`\`bash
curl -X POST http://localhost:3000/api/analyze/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "users.forEach(u => prisma.post.findMany({ where: { userId: u.id } }))",
    "orm": "prisma"
  }'
\`\`\`

Response:
\`\`\`json
{
  "query": "...",
  "orm": "prisma",
  "issues": [
    {
      "type": "n-plus-one",
      "severity": "high",
      "message": "Potential N+1 query detected",
      "location": "query execution"
    }
  ],
  "suggestions": [
    "Use eager loading with include/select",
    "Consider using dataloader pattern"
  ],
  "estimatedImprovement": "50-80% improvement possible (1 critical issues)"
}
\`\`\`

## API Endpoints

### Query Optimization

#### \`POST /orm/:orm/optimize\`
Optimize a query for a specific ORM (prisma, typeorm, mongoose, sequelize).

#### \`POST /api/optimize\`
Optimize a query with automatic ORM detection.

### Schema Analysis

#### \`POST /api/analyze/schema\`
Analyze schema code and generate indexing recommendations.

#### \`POST /api/generate/index\`
Generate index code from a recommendation.

### Query Analysis

#### \`POST /api/analyze/query\`
Analyze query for performance issues.

## ORM-Specific Best Practices

### Prisma

\`\`\`typescript
// ✅ Good: Use select for specific fields
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true }
});

// ✅ Good: Use cursor-based pagination
const users = await prisma.user.findMany({
  take: 20,
  cursor: { id: lastId }
});

// ❌ Bad: N+1 query
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { userId: user.id } });
}

// ✅ Good: Eager loading
const users = await prisma.user.findMany({
  include: { posts: { take: 10 } }
});
\`\`\`

### TypeORM

\`\`\`typescript
// ✅ Good: Use QueryBuilder
const users = await connection.createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .select(['user.id', 'user.name', 'post.title'])
  .limit(20)
  .getMany();

// ❌ Bad: Separate relation queries
const users = await connection.find(User);
for (const user of users) {
  user.posts = await connection.find(Post, { where: { userId: user.id } });
}

// ✅ Good: Cache frequently accessed data
const user = await connection.findOne(User, {
  where: { id },
  cache: true
});
\`\`\`

### Mongoose

\`\`\`typescript
// ✅ Good: Use lean() for plain objects
const users = await User.find({}).lean();

// ✅ Good: Projection
const users = await User.find({}, { name: 1, email: 1 });

// ✅ Good: Indexed queries
const user = await User.findOne({ email }).lean();

// ❌ Bad: Missing pagination
const users = await User.find({});

// ✅ Good: With pagination
const users = await User.find({})
  .limit(20)
  .skip(page * 20);
\`\`\`

### Sequelize

\`\`\`typescript
// ✅ Good: Specify attributes
const users = await User.findAll({
  attributes: ['id', 'name', 'email']
});

// ✅ Good: Use include with attributes
const users = await User.findAll({
  include: [{
    model: Post,
    attributes: ['id', 'title'],
    required: false
  }]
});

// ✅ Good: Add indexes
User.init({
  // ... fields
}, {
  sequelize,
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['userId'] }
  ]
});
\`\`\`

## Index Recommendations

| Field Type | Recommended Index | Priority |
|------------|-------------------|----------|
| Foreign Keys | Single column index | High |
| Emails | Unique index | High |
| Date fields | Single column index (DESC) | Medium |
| Frequently queried | Compound index | Medium |
| Searchable text | Full-text index | Low |

## Environment Variables

\`\`\`bash
PORT=3000    # Server port
\`\`\`

## Dependencies

- **@prisma/client** - Prisma ORM client
- **typeorm** - TypeORM
- **mongoose** - Mongoose ODM
- **sequelize** - Sequelize ORM
- **pg** - PostgreSQL driver
- **mysql2** - MySQL driver
- **mongodb** - MongoDB driver

## License

MIT`,
  },
};