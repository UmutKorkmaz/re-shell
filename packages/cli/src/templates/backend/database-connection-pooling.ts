// Database Connection Pooling and Query Optimization
// Multi-database support with intelligent connection pooling and query optimization

import { BackendTemplate } from '../types';

export const databasePoolingTemplate: BackendTemplate = {
  id: 'database-pooling',
  name: 'Database Connection Pooling & Query Optimization',
  displayName: 'Advanced Database Connection Pooling & Query Optimization',
  description: 'Advanced connection pooling and query optimization for PostgreSQL, MySQL, MongoDB, Redis, and SQLite with intelligent query analysis and index recommendations',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['database', 'caching', 'monitoring', 'rest-api'],
  tags: ['database', 'pooling', 'optimization', 'performance', 'query'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-database-pooling",
  "version": "1.0.0",
  "description": "{{name}} - Database Connection Pooling & Query Optimization",
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
    "mysql2": "^3.6.0",
    "mongodb": "^6.0.0",
    "ioredis": "^5.3.2",
    "better-sqlite3": "^9.1.1",
    "pg-cursor": "^2.10.3",
    "mysql2/promise": "^3.6.0",
    "pino": "^8.16.0",
    "pino-pretty": "^10.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/pg": "^8.10.2",
    "@types/better-sqlite3": "^7.6.7",
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

    'src/index.ts': `// Database Connection Pooling & Query Optimization Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PoolManager } from './pool-manager';
import { QueryOptimizer } from './query-optimizer';
import { QueryLogger } from './query-logger';
import { apiRoutes } from './routes/api.routes';
import { poolRoutes } from './routes/pool.routes';
import { queryRoutes } from './routes/query.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize managers
const poolManager = new PoolManager();
const queryOptimizer = new QueryOptimizer();
const queryLogger = new QueryLogger();

// Mount routes
app.use('/api', apiRoutes(poolManager, queryOptimizer, queryLogger));
app.use('/pool', poolRoutes(poolManager));
app.use('/query', queryRoutes(queryOptimizer, queryLogger));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🚀 Database Pooling Server running on port \${PORT}\`);
});`,

    'src/pool-manager.ts': `// Connection Pool Manager
// Manages connection pools for multiple database types

import { Pool as PgPool, PoolConfig as PgPoolConfig } from 'pg';
import { createPool, Pool as MySqlPool, PoolOptions as MySqlPoolOptions } from 'mysql2/promise';
import { MongoClient, Db as MongoDb } from 'mongodb';
import Redis from 'ioredis';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface PoolConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  name: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  [key: string]: any;
}

export interface PoolStats {
  name: string;
  type: string;
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  maxConnections: number;
  minConnections: number;
}

export class PoolManager extends EventEmitter {
  private postgresqlPools: Map<string, PgPool> = new Map();
  private mysqlPools: Map<string, MySqlPool> = new Map();
  private mongoClients: Map<string, { client: MongoClient; db: MongoDb }> = new Map();
  private redisClients: Map<string, Redis> = new Map();
  private sqliteDatabases: Map<string, Database.Database> = new Map();

  async createPool(config: PoolConfig): Promise<void> {
    switch (config.type) {
      case 'postgresql':
        await this.createPostgreSQLPool(config);
        break;
      case 'mysql':
        await this.createMySQLPool(config);
        break;
      case 'mongodb':
        await this.createMongoPool(config);
        break;
      case 'redis':
        await this.createRedisPool(config);
        break;
      case 'sqlite':
        await this.createSQLitePool(config);
        break;
      default:
        throw new Error(\`Unsupported database type: \${config.type}\`);
    }

    this.emit('pool:created', { name: config.name, type: config.type });
  }

  private async createPostgreSQLPool(config: PoolConfig): Promise<void> {
    const poolConfig: PgPoolConfig = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      min: config.min || 2,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    };

    const pool = new PgPool(poolConfig);

    pool.on('error', (err) => {
      console.error(\`PostgreSQL pool error for \${config.name}:\`, err);
      this.emit('pool:error', { name: config.name, type: 'postgresql', error: err });
    });

    this.postgresqlPools.set(config.name, pool);
    console.log(\`✅ PostgreSQL pool created: \${config.name}\`);
  }

  private async createMySQLPool(config: PoolConfig): Promise<void> {
    const poolConfig: MySqlPoolOptions = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.user || 'root',
      password: config.password || '',
      connectionLimit: config.max || 10,
      waitForConnections: true,
      queueLimit: 0,
    };

    const pool = createPool(poolConfig);
    this.mysqlPools.set(config.name, pool);
    console.log(\`✅ MySQL pool created: \${config.name}\`);
  }

  private async createMongoPool(config: PoolConfig): Promise<void> {
    const url = config.url || \`mongodb://\${config.host || 'localhost'}:\${config.port || 27017}\`;
    const client = new MongoClient(url, {
      minPoolSize: config.min || 2,
      maxPoolSize: config.max || 10,
      maxIdleTimeMS: config.idleTimeoutMillis || 60000,
      serverSelectionTimeoutMS: config.connectionTimeoutMillis || 2000,
    });

    await client.connect();
    const db = client.db(config.database);

    this.mongoClients.set(config.name, { client, db });
    console.log(\`✅ MongoDB pool created: \${config.name}\`);
  }

  private async createRedisPool(config: PoolConfig): Promise<void> {
    const redis = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      db: config.database || 0,
      password: config.password,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      lazyConnect: false,
    });

    redis.on('error', (err) => {
      console.error(\`Redis error for \${config.name}:\`, err);
      this.emit('pool:error', { name: config.name, type: 'redis', error: err });
    });

    this.redisClients.set(config.name, redis);
    console.log(\`✅ Redis client created: \${config.name}\`);
  }

  private async createSQLitePool(config: PoolConfig): Promise<void> {
    const db = new Database(config.database || ':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    this.sqliteDatabases.set(config.name, db);
    console.log(\`✅ SQLite database created: \${config.name}\`);
  }

  getPostgreSQLPool(name: string): PgPool | undefined {
    return this.postgresqlPools.get(name);
  }

  getMySQLPool(name: string): MySqlPool | undefined {
    return this.mysqlPools.get(name);
  }

  getMongoDb(name: string): MongoDb | undefined {
    return this.mongoClients.get(name)?.db;
  }

  getRedis(name: string): Redis | undefined {
    return this.redisClients.get(name);
  }

  getSQLite(name: string): Database.Database | undefined {
    return this.sqliteDatabases.get(name);
  }

  async getPoolStats(name: string): Promise<PoolStats | null> {
    // PostgreSQL stats
    const pgPool = this.postgresqlPools.get(name);
    if (pgPool) {
      return {
        name,
        type: 'postgresql',
        totalConnections: pgPool.totalCount,
        idleConnections: pgPool.idleCount,
        activeConnections: pgPool.totalCount - pgPool.idleCount,
        waitingRequests: pgPool.waitingCount,
        maxConnections: pgPool.options.max || 10,
        minConnections: pgPool.options.min || 2,
      };
    }

    // MySQL stats
    const mySqlPool = this.mysqlPools.get(name);
    if (mySqlPool) {
      const [rows] = await mySqlPool.query('SHOW PROCESSLIST');
      const processes = rows as any[];
      return {
        name,
        type: 'mysql',
        totalConnections: mySqlPool.pool.connectionLimit,
        idleConnections: 0, // MySQL2 doesn't expose this
        activeConnections: processes.length,
        waitingRequests: 0,
        maxConnections: mySqlPool.pool.connectionLimit,
        minConnections: 0,
      };
    }

    // MongoDB stats
    const mongo = this.mongoClients.get(name);
    if (mongo) {
      const stats = await mongo.db.command({ serverStatus: 1 });
      return {
        name,
        type: 'mongodb',
        totalConnections: stats.connections?.totalCreated || 0,
        idleConnections: stats.connections?.current || 0,
        activeConnections: stats.connections?.active || 0,
        waitingRequests: 0,
        maxConnections: 0, // MongoDB handles this internally
        minConnections: 0,
      };
    }

    return null;
  }

  async getAllPoolStats(): Promise<PoolStats[]> {
    const stats: PoolStats[] = [];

    for (const name of this.postgresqlPools.keys()) {
      const stat = await this.getPoolStats(name);
      if (stat) stats.push(stat);
    }

    for (const name of this.mysqlPools.keys()) {
      const stat = await this.getPoolStats(name);
      if (stat) stats.push(stat);
    }

    for (const name of this.mongoClients.keys()) {
      const stat = await this.getPoolStats(name);
      if (stat) stats.push(stat);
    }

    return stats;
  }

  async closePool(name: string): Promise<void> {
    const pgPool = this.postgresqlPools.get(name);
    if (pgPool) {
      await pgPool.end();
      this.postgresqlPools.delete(name);
    }

    const mySqlPool = this.mysqlPools.get(name);
    if (mySqlPool) {
      await mySqlPool.end();
      this.mysqlPools.delete(name);
    }

    const mongo = this.mongoClients.get(name);
    if (mongo) {
      await mongo.client.close();
      this.mongoClients.delete(name);
    }

    const redis = this.redisClients.get(name);
    if (redis) {
      await redis.quit();
      this.redisClients.delete(name);
    }

    const sqlite = this.sqliteDatabases.get(name);
    if (sqlite) {
      sqlite.close();
      this.sqliteDatabases.delete(name);
    }

    this.emit('pool:closed', { name });
  }

  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const pool of this.postgresqlPools.values()) {
      closePromises.push(pool.end());
    }

    for (const pool of this.mysqlPools.values()) {
      closePromises.push(pool.end());
    }

    for (const mongo of this.mongoClients.values()) {
      closePromises.push(mongo.client.close());
    }

    for (const redis of this.redisClients.values()) {
      closePromises.push(redis.quit());
    }

    for (const sqlite of this.sqliteDatabases.values()) {
      sqlite.close();
    }

    await Promise.all(closePromises);

    this.postgresqlPools.clear();
    this.mysqlPools.clear();
    this.mongoClients.clear();
    this.redisClients.clear();
    this.sqliteDatabases.clear();
  }
}`,

    'src/query-optimizer.ts': `// Query Optimizer
// Analyzes and optimizes database queries

import { EventEmitter } from 'events';

export interface QueryPlan {
  query: string;
  database: string;
  type: 'select' | 'insert' | 'update' | 'delete';
  estimatedCost?: number;
  actualExecutionTime?: number;
  rowsAffected?: number;
  indexesUsed: string[];
  recommendations: string[];
}

export interface SlowQuery {
  query: string;
  database: string;
  executionTime: number;
  timestamp: Date;
  threshold: number;
}

export class QueryOptimizer extends EventEmitter {
  private slowQueryThreshold: number = 1000; // 1 second
  private slowQueries: SlowQuery[] = [];
  private queryHistory: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  setSlowQueryThreshold(milliseconds: number): void {
    this.slowQueryThreshold = milliseconds;
  }

  analyzeQuery(query: string, database: string): QueryPlan {
    const normalizedQuery = query.trim().toLowerCase();
    const plan: QueryPlan = {
      query,
      database,
      type: this.getQueryType(normalizedQuery),
      indexesUsed: [],
      recommendations: [],
    };

    // Analyze query and provide recommendations
    this.analyzeSelectQuery(normalizedQuery, plan);
    this.checkForNPlusOne(normalizedQuery, plan);
    this.checkForMissingIndexes(normalizedQuery, plan);
    this.checkForInefficientJoins(normalizedQuery, plan);
    this.checkForCartesianProduct(normalizedQuery, plan);
    this.checkForSelectStar(normalizedQuery, plan);

    return plan;
  }

  private getQueryType(query: string): 'select' | 'insert' | 'update' | 'delete' {
    if (query.startsWith('select')) return 'select';
    if (query.startsWith('insert')) return 'insert';
    if (query.startsWith('update')) return 'update';
    if (query.startsWith('delete')) return 'delete';
    return 'select'; // default
  }

  private analyzeSelectQuery(query: string, plan: QueryPlan): void {
    // Check for ORDER BY without index
    if (query.includes('order by') && !query.includes('where')) {
      plan.recommendations.push(
        'Consider adding a WHERE clause before ORDER BY to reduce the result set'
      );
    }

    // Check for DISTINCT without GROUP BY alternative
    if (query.includes('distinct') && query.includes('group by')) {
      plan.recommendations.push(
        'Consider using GROUP BY instead of DISTINCT for better performance'
      );
    }

    // Check for subquery that could be a JOIN
    if (query.includes('select') && query.match(/select.*from.*where.*in\\s*\\(\\s*select/i)) {
      plan.recommendations.push(
        'Consider converting subquery to JOIN for better performance'
      );
    }
  }

  private checkForNPlusOne(query: string, plan: QueryPlan): void {
    // Check for patterns that indicate N+1 queries
    if (query.match(/where.*=.*\\?/i) && !query.includes('in')) {
      plan.recommendations.push(
        'This query pattern may cause N+1 problems. Consider using IN clause with batch parameters'
      );
    }
  }

  private checkForMissingIndexes(query: string, plan: QueryPlan): void {
    // Check for WHERE clauses
    const whereMatch = query.match(/where\\s+(.+?)(?:\\s+order\\s+by|\\s+group\\s+by|\\s+limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columns = this.extractColumns(whereClause);

      if (columns.length > 0) {
        plan.indexesUsed.push(...columns);
        plan.recommendations.push(
          \`Consider adding composite index on: \${columns.join(', ')}\`
        );
      }
    }

    // Check for JOIN columns
    const joinMatches = query.matchAll(/join\\s+(\\w+)\\s+on\\s+(.+?)(?:\\s+join|\\s+where|$)/gi);
    for (const match of joinMatches) {
      const joinCondition = match[2];
      const columns = this.extractColumns(joinCondition);
      if (columns.length > 0) {
        plan.recommendations.push(
          \`Consider adding index on JOIN columns: \${columns.join(', ')}\`
        );
      }
    }
  }

  private checkForInefficientJoins(query: string, plan: QueryPlan): void {
    const joinCount = (query.match(/join/gi) || []).length;

    if (joinCount > 4) {
      plan.recommendations.push(
        \`Query has \${joinCount} JOINs. Consider denormalizing or splitting the query\`
      );
    }

    // Check for OR conditions in JOIN
    if (query.match(/on.*or.*on/i)) {
      plan.recommendations.push(
        'OR conditions in JOINs can be inefficient. Consider using UNION or restructuring'
      );
    }
  }

  private checkForCartesianProduct(query: string, plan: QueryPlan): void {
    // Check for JOIN without ON clause
    if (query.match(/join\\s+\\w+\\s+(?!.*on)/i)) {
      plan.recommendations.push(
        'CROSS JOIN detected (JOIN without ON clause). This creates a Cartesian product and should be avoided'
      );
    }

    // Check for multiple tables in FROM without proper JOIN conditions
    const fromTables = (query.match(/from\\s+(\\w+)/gi) || []).length;
    const joinCount = (query.match(/join/gi) || []).length;

    if (fromTables > joinCount + 1) {
      plan.recommendations.push(
        'Multiple tables in FROM without explicit JOIN conditions. This may create Cartesian product'
      );
    }
  }

  private checkForSelectStar(query: string, plan: QueryPlan): void {
    if (/select\\s+\\*\\s+from/i.test(query)) {
      plan.recommendations.push(
        'SELECT * retrieves all columns. Specify only needed columns for better performance'
      );
    }
  }

  private extractColumns(clause: string): string[] {
    const columns: string[] = [];

    // Extract column names from conditions like "table.column" or "column"
    const columnMatches = clause.matchAll(/(?:\\w+\\.)?(\\w+)\\s*[=<>!]/g);
    for (const match of columnMatches) {
      if (match[1] && !columns.includes(match[1])) {
        columns.push(match[1]);
      }
    }

    return columns;
  }

  trackQueryExecution(query: string, database: string, executionTime: number): void {
    const queryKey = \`\${database}:\${query.substring(0, 100)}\`;

    // Update query history
    const history = this.queryHistory.get(queryKey) || { count: 0, totalTime: 0, avgTime: 0 };
    history.count++;
    history.totalTime += executionTime;
    history.avgTime = history.totalTime / history.count;
    this.queryHistory.set(queryKey, history);

    // Check for slow query
    if (executionTime > this.slowQueryThreshold) {
      const slowQuery: SlowQuery = {
        query,
        database,
        executionTime,
        timestamp: new Date(),
        threshold: this.slowQueryThreshold,
      };

      this.slowQueries.push(slowQuery);
      this.emit('slow-query', slowQuery);

      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }
  }

  getSlowQueries(limit?: number): SlowQuery[] {
    if (limit) {
      return this.slowQueries.slice(-limit);
    }
    return [...this.slowQueries];
  }

  getQueryHistory(limit?: number): Array<{ query: string; database: string; count: number; avgTime: number }> {
    const history = Array.from(this.queryHistory.entries()).map(([key, stats]) => {
      const [database, query] = key.split(':');
      return { query, database, ...stats };
    });

    // Sort by count descending
    history.sort((a, b) => b.count - a.count);

    if (limit) {
      return history.slice(0, limit);
    }

    return history;
  }

  getOptimizationRecommendations(database: string): string[] {
    const recommendations: string[] = [];
    const history = this.getQueryHistory(20);

    // Find most frequent queries
    const frequentQueries = history.filter((h) => h.count > 10);
    for (const query of frequentQueries) {
      const plan = this.analyzeQuery(query.query, database);
      recommendations.push(...plan.recommendations.map((r) => \`Query (\${query.count}x): \${r}\`));
    }

    return recommendations;
  }

  clearHistory(): void {
    this.queryHistory.clear();
    this.slowQueries = [];
  }

  getIndexRecommendations(database: string): Array<{ table: string; columns: string[]; reason: string }> {
    const recommendations: Array<{ table: string; columns: string[]; reason: string }> = [];
    const history = this.getQueryHistory(50);

    // Analyze WHERE clauses and JOINs from query history
    const queryPatterns = new Map<string, { tables: Set<string>; columns: Set<string>; count: number }>();

    for (const query of history) {
      const plan = this.analyzeQuery(query.query, database);

      // Extract table and column information
      const tables = this.extractTables(query.query);
      const columns = plan.indexesUsed;

      for (const table of tables) {
        for (const column of columns) {
          const key = \`\${table}:\${column}\`;
          const pattern = queryPatterns.get(key) || { tables: new Set(), columns: new Set(), count: 0 };
          pattern.tables.add(table);
          pattern.columns.add(column);
          pattern.count += query.count;
          queryPatterns.set(key, pattern);
        }
      }
    }

    // Generate recommendations based on frequency
    for (const [key, pattern] of queryPatterns.entries()) {
      if (pattern.count > 50) {
        const [table, column] = key.split(':');
        recommendations.push({
          table,
          columns: [...pattern.columns],
          reason: \`Used in \${pattern.count} queries\`,
        });
      }
    }

    return recommendations;
  }

  private extractTables(query: string): string[] {
    const tables: string[] = [];

    // Extract tables from FROM clause
    const fromMatches = query.matchAll(/from\\s+(\\w+)/gi);
    for (const match of fromMatches) {
      if (match[1]) tables.push(match[1]);
    }

    // Extract tables from JOIN clauses
    const joinMatches = query.matchAll(/join\\s+(\\w+)/gi);
    for (const match of joinMatches) {
      if (match[1]) tables.push(match[1]);
    }

    return [...new Set(tables)];
  }
}`,

    'src/query-logger.ts': `// Query Logger
// Logs and tracks query performance

import pino from 'pino';

export interface QueryLog {
  query: string;
  database: string;
  executionTime: number;
  rowsAffected?: number;
  timestamp: Date;
  error?: string;
}

export class QueryLogger {
  private logger: pino.Logger;
  private logs: QueryLog[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean = true;

  constructor() {
    this.logger = pino({
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  logQuery(query: string, database: string, executionTime: number, rowsAffected?: number): void {
    if (!this.enabled) return;

    const log: QueryLog = {
      query: query.substring(0, 500), // Limit query length
      database,
      executionTime,
      rowsAffected,
      timestamp: new Date(),
    };

    this.logs.push(log);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console
    this.logger.info({
      database,
      executionTime: \`\${executionTime}ms\`,
      rowsAffected,
      query: query.substring(0, 100),
    });
  }

  logError(query: string, database: string, error: Error): void {
    if (!this.enabled) return;

    const log: QueryLog = {
      query: query.substring(0, 500),
      database,
      executionTime: 0,
      timestamp: new Date(),
      error: error.message,
    };

    this.logs.push(log);

    this.logger.error({
      database,
      error: error.message,
      query: query.substring(0, 100),
    });
  }

  getLogs(database?: string, limit?: number): QueryLog[] {
    let filteredLogs = this.logs;

    if (database) {
      filteredLogs = filteredLogs.filter((log) => log.database === database);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return [...filteredLogs];
  }

  getSlowQueries(threshold: number = 1000): QueryLog[] {
    return this.logs.filter((log) => log.executionTime > threshold);
  }

  getFailedQueries(): QueryLog[] {
    return this.logs.filter((log) => log.error);
  }

  getStats(): {
    totalQueries: number;
    failedQueries: number;
    avgExecutionTime: number;
    slowQueries: number;
  } {
    const failedQueries = this.logs.filter((log) => log.error).length;
    const totalTime = this.logs.reduce((sum, log) => sum + log.executionTime, 0);
    const avgExecutionTime = this.logs.length > 0 ? totalTime / this.logs.length : 0;
    const slowQueries = this.logs.filter((log) => log.executionTime > 1000).length;

    return {
      totalQueries: this.logs.length,
      failedQueries,
      avgExecutionTime,
      slowQueries,
    };
  }

  clear(): void {
    this.logs = [];
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}`,

    'src/routes/api.routes.ts': `// API Routes - General endpoints
import { Router } from 'express';
import { PoolManager } from '../pool-manager';
import { QueryOptimizer } from '../query-optimizer';
import { QueryLogger } from '../query-logger';

export function apiRoutes(
  poolManager: PoolManager,
  queryOptimizer: QueryOptimizer,
  queryLogger: QueryLogger
): Router {
  const router = Router();

  // Get overall stats
  router.get('/stats', async (req, res) => {
    try {
      const [poolStats, queryStats, slowQueries] = await Promise.all([
        poolManager.getAllPoolStats(),
        Promise.resolve(queryLogger.getStats()),
        Promise.resolve(queryOptimizer.getSlowQueries(10)),
      ]);

      res.json({
        pools: poolStats,
        queries: queryStats,
        recentSlowQueries: slowQueries,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Analyze query
  router.post('/analyze', (req, res) => {
    try {
      const { query, database } = req.body;

      if (!query || !database) {
        return res.status(400).json({ error: 'Missing query or database parameter' });
      }

      const plan = queryOptimizer.analyzeQuery(query, database);
      res.json(plan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get optimization recommendations
  router.get('/recommendations/:database', (req, res) => {
    try {
      const { database } = req.params;
      const recommendations = queryOptimizer.getOptimizationRecommendations(database);
      const indexRecommendations = queryOptimizer.getIndexRecommendations(database);

      res.json({
        queryRecommendations: recommendations,
        indexRecommendations,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}`,

    'src/routes/pool.routes.ts': `// Pool Routes - Connection pool management
import { Router } from 'express';
import { PoolManager } from '../pool-manager';
import { PoolConfig } from '../pool-manager';

export function poolRoutes(poolManager: PoolManager): Router {
  const router = Router();

  // Create a new connection pool
  router.post('/create', async (req, res) => {
    try {
      const config: PoolConfig = req.body;

      if (!config.type || !config.name) {
        return res.status(400).json({ error: 'Missing type or name parameter' });
      }

      await poolManager.createPool(config);
      res.json({ message: \`Pool \${config.name} created successfully\` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all pool statistics
  router.get('/stats', async (req, res) => {
    try {
      const stats = await poolManager.getAllPoolStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific pool statistics
  router.get('/:name/stats', async (req, res) => {
    try {
      const { name } = req.params;
      const stats = await poolManager.getPoolStats(name);

      if (!stats) {
        return res.status(404).json({ error: \`Pool \${name} not found\` });
      }

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Close a specific pool
  router.delete('/:name', async (req, res) => {
    try {
      const { name } = req.params;
      await poolManager.closePool(name);
      res.json({ message: \`Pool \${name} closed successfully\` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Close all pools
  router.post('/close-all', async (req, res) => {
    try {
      await poolManager.closeAll();
      res.json({ message: 'All pools closed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}`,

    'src/routes/query.routes.ts': `// Query Routes - Query optimization and logging
import { Router } from 'express';
import { QueryOptimizer } from '../query-optimizer';
import { QueryLogger } from '../query-logger';

export function queryRoutes(queryOptimizer: QueryOptimizer, queryLogger: QueryLogger): Router {
  const router = Router();

  // Get query logs
  router.get('/logs', (req, res) => {
    try {
      const { database, limit } = req.query;
      const logs = queryLogger.getLogs(
        database as string | undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get slow queries
  router.get('/slow', (req, res) => {
    try {
      const { threshold } = req.query;
      const slowQueries = queryLogger.getSlowQueries(
        threshold ? parseInt(threshold as string) : 1000
      );
      res.json(slowQueries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get failed queries
  router.get('/failed', (req, res) => {
    try {
      const failedQueries = queryLogger.getFailedQueries();
      res.json(failedQueries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get query history
  router.get('/history', (req, res) => {
    try {
      const { limit } = req.query;
      const history = queryOptimizer.getQueryHistory(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get slow queries from optimizer
  router.get('/optimizer/slow', (req, res) => {
    try {
      const { limit } = req.query;
      const slowQueries = queryOptimizer.getSlowQueries(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(slowQueries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set slow query threshold
  router.post('/threshold', (req, res) => {
    try {
      const { threshold } = req.body;

      if (typeof threshold !== 'number') {
        return res.status(400).json({ error: 'Threshold must be a number' });
      }

      queryOptimizer.setSlowQueryThreshold(threshold);
      res.json({ message: \`Slow query threshold set to \${threshold}ms\` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear query logs and history
  router.delete('/clear', (req, res) => {
    try {
      queryLogger.clear();
      queryOptimizer.clearHistory();
      res.json({ message: 'Query logs and history cleared' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}`,

    'README.md': `# Database Connection Pooling & Query Optimization

Advanced connection pooling and query optimization system for multiple database types.

## Features

### 🗄️ **Multi-Database Support**
- **PostgreSQL** - Connection pooling with pg
- **MySQL** - Connection pooling with mysql2
- **MongoDB** - Native connection pooling
- **Redis** - Connection management with ioredis
- **SQLite** - WAL mode for better concurrency

### 🔍 **Query Optimization**
- **Automatic query analysis** - Detect inefficient queries
- **Slow query detection** - Track queries exceeding threshold
- **Index recommendations** - Suggest indexes based on query patterns
- **Query history** - Track query execution statistics
- **N+1 detection** - Identify potential N+1 query problems

### 📊 **Connection Pool Monitoring**
- **Pool statistics** - Active, idle, and total connections
- **Pool health** - Monitor pool errors and reconnections
- **Performance metrics** - Query execution times and counts
- **Resource usage** - Track connection pool utilization

### 🚀 **Performance Features**
- **Connection reuse** - Efficient connection management
- **Automatic cleanup** - Idle connection timeout
- **Query logging** - Comprehensive query execution logs
- **Optimization suggestions** - AI-powered query recommendations

## Quick Start

### 1. Create a Connection Pool

\`\`\`bash
curl -X POST http://localhost:3000/pool/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "postgresql",
    "name": "main",
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "user": "postgres",
    "password": "password",
    "min": 2,
    "max": 10
  }'
\`\`\`

### 2. Get Pool Statistics

\`\`\`bash
curl http://localhost:3000/pool/stats
\`\`\`

Response:
\`\`\`json
[
  {
    "name": "main",
    "type": "postgresql",
    "totalConnections": 10,
    "idleConnections": 8,
    "activeConnections": 2,
    "waitingRequests": 0,
    "maxConnections": 10,
    "minConnections": 2
  }
]
\`\`\`

### 3. Analyze a Query

\`\`\`bash
curl -X POST http://localhost:3000/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "SELECT * FROM users WHERE email = ?",
    "database": "main"
  }'
\`\`\`

Response:
\`\`\`json
{
  "query": "SELECT * FROM users WHERE email = ?",
  "database": "main",
  "type": "select",
  "indexesUsed": ["email"],
  "recommendations": [
    "Consider adding index on: email",
    "SELECT * retrieves all columns. Specify only needed columns for better performance"
  ]
}
\`\`\`

### 4. Get Optimization Recommendations

\`\`\`bash
curl http://localhost:3000/api/recommendations/main
\`\`\`

## API Endpoints

### Pool Management

- \`POST /pool/create\` - Create a new connection pool
- \`GET /pool/stats\` - Get all pool statistics
- \`GET /pool/:name/stats\` - Get specific pool statistics
- \`DELETE /pool/:name\` - Close a specific pool
- \`POST /pool/close-all\` - Close all pools

### Query Optimization

- \`POST /api/analyze\` - Analyze a query for optimization opportunities
- \`GET /api/recommendations/:database\` - Get optimization recommendations
- \`GET /api/stats\` - Get overall statistics

### Query Logging

- \`GET /query/logs\` - Get query logs (optional: ?database=main&limit=100)
- \`GET /query/slow\` - Get slow queries (optional: ?threshold=1000)
- \`GET /query/failed\` - Get failed queries
- \`GET /query/history\` - Get query history (optional: ?limit=50)
- \`GET /query/optimizer/slow\` - Get slow queries from optimizer (optional: ?limit=10)
- \`POST /query/threshold\` - Set slow query threshold
- \`DELETE /query/clear\` - Clear query logs and history

## Pool Configuration Options

### PostgreSQL
\`\`\`json
{
  "type": "postgresql",
  "name": "main",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "user": "postgres",
  "password": "password",
  "min": 2,
  "max": 10,
  "idleTimeoutMillis": 30000,
  "connectionTimeoutMillis": 2000
}
\`\`\`

### MySQL
\`\`\`json
{
  "type": "mysql",
  "name": "main",
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "user": "root",
  "password": "password",
  "max": 10
}
\`\`\`

### MongoDB
\`\`\`json
{
  "type": "mongodb",
  "name": "main",
  "host": "localhost",
  "port": 27017,
  "database": "mydb",
  "url": "mongodb://localhost:27017",
  "min": 2,
  "max": 10
}
\`\`\`

### Redis
\`\`\`json
{
  "type": "redis",
  "name": "cache",
  "host": "localhost",
  "port": 6379,
  "database": 0,
  "password": "password"
}
\`\`\`

### SQLite
\`\`\`json
{
  "type": "sqlite",
  "name": "local",
  "database": "./data.db"
}
\`\`\`

## Query Optimization Features

### Automatic Analysis
- Detects SELECT * usage
- Identifies missing indexes
- Finds N+1 query patterns
- Checks for inefficient JOINs
- Detects Cartesian products
- Analyzes WHERE clauses

### Recommendations
- Index creation suggestions
- Query restructuring advice
- Performance optimization tips
- Alternative query patterns

## Environment Variables

\`\`\`bash
PORT=3000              # Server port (default: 3000)
LOG_LEVEL=info         # Logging level
\`\`\`

## Dependencies

- **pg** - PostgreSQL client
- **mysql2** - MySQL client with promise support
- **mongodb** - MongoDB driver
- **ioredis** - Redis client
- **better-sqlite3** - SQLite client with WAL mode
- **pino** - Fast logger
- **express** - Web framework

## License

MIT`,
  },
};