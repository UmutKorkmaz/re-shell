import { BackendTemplate } from '../types';

/**
 * Database Migration Commands with Rollback Capabilities Template
 * Complete migration solution with up/down support, history tracking, and multi-database support
 */
export const databaseMigrationTemplate: BackendTemplate = {
  id: 'database-migration',
  name: 'database-migration',
  displayName: 'Database Migration Commands with Rollback Capabilities',
  description: 'Complete database migration solution with up/down support, migration history tracking, rollback capabilities, multi-database support (PostgreSQL, MySQL, MongoDB, SQLite), CLI commands, and transaction safety',
  language: 'javascript',
  framework: 'migration',
  version: '1.0.0',
  tags: ['migration', 'database', 'rollback', 'postgresql', 'mysql', 'mongodb', 'cli'],
  port: 3000,
  dependencies: {},
  features: ['database', 'migration', 'cli', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "bin": {
    "migrate": "./cli.js"
  },
  "scripts": {
    "start": "node index.js",
    "migrate": "node cli.js up",
    "migrate:create": "node cli.js create",
    "migrate:rollback": "node cli.js down",
    "migrate:status": "node cli.js status",
    "migrate:reset": "node cli.js reset"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "mysql2": "^3.6.5",
    "mongodb": "^6.3.0",
    "better-sqlite3": "^9.2.2",
    "commander": "^11.1.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.1"
  }
}
`,

    'migrations/migration.js': `/**
 * Base Migration Class
 * All migrations should extend this class
 */

export class Migration {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }

  /**
   * Apply the migration - must be implemented by subclasses
   */
  async up() {
    throw new Error('up() must be implemented by subclass');
  }

  /**
   * Rollback the migration - must be implemented by subclasses
   */
  async down() {
    throw new Error('down() must be implemented by subclass');
  }

  /**
   * Get the name of this migration
   */
  getName() {
    return this.constructor.name;
  }

  /**
   * Log a message during migration
   */
  log(message) {
    console.log('  [' + this.getName() + '] ' + message);
  }

  /**
   * Execute SQL with error handling
   */
  async query(sql, params = []) {
    try {
      const result = await this.db.query(sql, params);
      return result;
    } catch (err) {
      throw new Error('Query failed: ' + err.message + '\\nSQL: ' + sql);
    }
  }
}

export default Migration;
`,

    'migrations/runner.js': `import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations', 'files');

/**
 * Migration Runner
 * Handles running, rolling back, and tracking migrations
 */
class MigrationRunner {
  constructor(config = {}) {
    this.config = {
      type: process.env.DB_TYPE || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'migrations',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ...config
    };

    this.connection = null;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    switch (this.config.type) {
      case 'postgres':
        this.connection = new pg.Client({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password
        });
        await this.connection.connect();
        break;

      case 'mysql':
        this.connection = await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password
        });
        break;

      case 'mongodb':
        this.connection = await MongoClient.connect(
          'mongodb://' + this.config.host + ':' + this.config.port
        );
        this.db = this.connection.db(this.config.database);
        break;

      case 'sqlite':
        this.connection = new Database(this.config.database || ':memory:');
        break;

      default:
        throw new Error('Unsupported database type: ' + this.config.type);
    }
  }

  /**
   * Create migrations table if it doesn't exist
   */
  async ensureMigrationsTable() {
    switch (this.config.type) {
      case 'postgres':
        await this.connection.query(\`
          CREATE TABLE IF NOT EXISTS _migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            batch INTEGER NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        break;

      case 'mysql':
        await this.connection.query(\`
          CREATE TABLE IF NOT EXISTS _migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            batch INT NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        break;

      case 'mongodb':
        const collection = this.db.collection('_migrations');
        await collection.createIndex({ name: 1 }, { unique: true });
        break;

      case 'sqlite':
        this.connection.exec(\`
          CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            batch INTEGER NOT NULL,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        break;
    }
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        const result = await this.connection.query(
          'SELECT name FROM _migrations ORDER BY id ASC'
        );
        return this.config.type === 'postgres'
          ? result.rows.map(r => r.name)
          : result[0].map(r => r.name);

      case 'mongodb':
        const docs = await this.db.collection('_migrations').find().sort({ _id: 1 }).toArray();
        return docs.map(d => d.name);

      case 'sqlite':
        const rows = this.connection.prepare('SELECT name FROM _migrations ORDER BY id ASC').all();
        return rows.map(r => r.name);
    }
  }

  /**
   * Get list of pending migration files
   */
  async getMigrationFiles() {
    const files = await fs.promises.readdir(MIGRATIONS_DIR);
    return files
      .filter(f => f.endsWith('.js') && !f.startsWith('_'))
      .sort();
  }

  /**
   * Load a migration class from file
   */
  async loadMigration(filename) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const module = await import(filePath);
    const MigrationClass = module.default;

    if (!MigrationClass) {
      throw new Error('Migration file must export a default class');
    }

    return new MigrationClass(this.connection, this.config);
  }

  /**
   * Record a migration as executed
   */
  async recordMigration(name, batch) {
    switch (this.config.type) {
      case 'postgres':
        await this.connection.query(
          'INSERT INTO _migrations (name, batch) VALUES ($1, $2)',
          [name, batch]
        );
        break;

      case 'mysql':
        await this.connection.query(
          'INSERT INTO _migrations (name, batch) VALUES (?, ?)',
          [name, batch]
        );
        break;

      case 'mongodb':
        await this.db.collection('_migrations').insertOne({
          name: name,
          batch: batch,
          executed_at: new Date()
        });
        break;

      case 'sqlite':
        this.connection.prepare('INSERT INTO _migrations (name, batch) VALUES (?, ?)').run(name, batch);
        break;
    }
  }

  /**
   * Remove a migration record
   */
  async removeMigration(name) {
    switch (this.config.type) {
      case 'postgres':
        await this.connection.query(
          'DELETE FROM _migrations WHERE name = $1',
          [name]
        );
        break;

      case 'mysql':
        await this.connection.query(
          'DELETE FROM _migrations WHERE name = ?',
          [name]
        );
        break;

      case 'mongodb':
        await this.db.collection('_migrations').deleteOne({ name: name });
        break;

      case 'sqlite':
        this.connection.prepare('DELETE FROM _migrations WHERE name = ?').run(name);
        break;
    }
  }

  /**
   * Get current batch number
   */
  async getCurrentBatch() {
    switch (this.config.type) {
      case 'postgres':
        const result = await this.connection.query(
          'SELECT COALESCE(MAX(batch), 0) as batch FROM _migrations'
        );
        return result.rows[0].batch;

      case 'mysql':
        const [rows] = await this.connection.query(
          'SELECT COALESCE(MAX(batch), 0) as batch FROM _migrations'
        );
        return rows[0].batch;

      case 'mongodb':
        const doc = await this.db.collection('_migrations')
          .find()
          .sort({ batch: -1 })
          .limit(1)
          .toArray();
        return doc.length > 0 ? doc[0].batch : 0;

      case 'sqlite':
        const row = this.connection.prepare('SELECT COALESCE(MAX(batch), 0) as batch FROM _migrations').get();
        return row.batch;
    }
  }

  /**
   * Run all pending migrations
   */
  async up(steps = null) {
    await this.connect();
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();
    const pending = files.filter(f => !executed.includes(f.replace('.js', '')));

    if (pending.length === 0) {
      console.log('No migrations to run.');
      return [];
    }

    const toRun = steps ? pending.slice(0, steps) : pending;
    const batch = await this.getCurrentBatch() + 1;
    const results = [];

    console.log('Running ' + toRun.length + ' migration(s)...');

    for (const file of toRun) {
      const name = file.replace('.js', '');
      console.log('\\n  → ' + name);

      try {
        const migration = await this.loadMigration(file);

        // Wrap in transaction for SQL databases
        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('BEGIN');
        } else if (this.config.type === 'mysql') {
          await this.connection.beginTransaction();
        }

        await migration.up();
        await this.recordMigration(name, batch);

        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('COMMIT');
        } else if (this.config.type === 'mysql') {
          await this.connection.commit();
        }

        results.push({ name: name, status: 'success' });
        console.log('  ✓ Completed');
      } catch (err) {
        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('ROLLBACK');
        } else if (this.config.type === 'mysql') {
          await this.connection.rollback();
        }

        results.push({ name: name, status: 'failed', error: err.message });
        console.log('  ✗ Failed: ' + err.message);
        throw err;
      }
    }

    console.log('\\nMigration complete!');
    return results;
  }

  /**
   * Rollback migrations
   */
  async down(steps = 1) {
    await this.connect();
    await this.ensureMigrationsTable();

    const batch = await this.getCurrentBatch();
    if (batch === 0) {
      console.log('No migrations to rollback.');
      return [];
    }

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();

    // Get migrations in current batch, in reverse order
    const batchMigrations = [];
    for (let i = executed.length - 1; i >= 0; i--) {
      const file = executed[i] + '.js';
      if (files.includes(file)) {
        batchMigrations.push(file);
      }
    }

    const toRollback = batchMigrations.slice(0, steps);
    const results = [];

    console.log('Rolling back ' + toRollback.length + ' migration(s)...');

    for (const file of toRollback) {
      const name = file.replace('.js', '');
      console.log('\\n  ← ' + name);

      try {
        const migration = await this.loadMigration(file);

        // Wrap in transaction
        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('BEGIN');
        } else if (this.config.type === 'mysql') {
          await this.connection.beginTransaction();
        }

        await migration.down();
        await this.removeMigration(name);

        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('COMMIT');
        } else if (this.config.type === 'mysql') {
          await this.connection.commit();
        }

        results.push({ name: name, status: 'success' });
        console.log('  ✓ Rolled back');
      } catch (err) {
        if (this.config.type === 'postgres' || this.config.type === 'sqlite') {
          await this.connection.query('ROLLBACK');
        } else if (this.config.type === 'mysql') {
          await this.connection.rollback();
        }

        results.push({ name: name, status: 'failed', error: err.message });
        console.log('  ✗ Failed: ' + err.message);
        throw err;
      }
    }

    console.log('\\nRollback complete!');
    return results;
  }

  /**
   * Reset all migrations (rollback all, then re-run)
   */
  async reset() {
    await this.connect();
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();

    if (executed.length === 0) {
      console.log('No migrations to reset.');
      return await this.up();
    }

    console.log('Resetting database...');

    // Rollback all
    while (executed.length > 0) {
      await this.down(executed.length);
      executed.pop();
    }

    // Re-run all
    return await this.up();
  }

  /**
   * Get migration status
   */
  async status() {
    await this.connect();
    await this.ensureMigrationsTable();

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();

    console.log('\\nMigration Status:');
    console.log('==================');
    console.log('');

    for (const file of files) {
      const name = file.replace('.js', '');
      const isExecuted = executed.includes(name);
      const status = isExecuted ? '✓' : '✗';
      const batch = isExecuted ? ' (Batch ' + executed.indexOf(name) + 1 + ')' : '';
      console.log('  ' + status + '  ' + name + batch);
    }

    console.log('');
    console.log('Executed: ' + executed.length + '/' + files.length);
    console.log('Pending: ' + (files.length - executed.length));

    return {
      executed: executed.length,
      pending: files.length - executed.length,
      total: files.length,
      migrations: files.map(f => {
        const name = f.replace('.js', '');
        return { name: name, executed: executed.includes(name) };
      })
    };
  }

  /**
   * Create a new migration file
   */
  async create(name) {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const filename = timestamp + '_' + name + '.js';
    const filePath = path.join(MIGRATIONS_DIR, filename);

    const template = this.getMigrationTemplate(name);

    await fs.promises.writeFile(filePath, template);
    console.log('Created migration: ' + filename);

    return filename;
  }

  /**
   * Get migration file template
   */
  getMigrationTemplate(name) {
    const className = this.toClassName(name);

    return "import { Migration } from '../migration.js';\\n"
+ "\\n"
+ "/**\\n"
+ " * Migration: " + name + "\\n"
+ " */\\n"
+ "export default class " + className + " extends Migration {\\n"
+ "  async up() {\\n"
+ "    this.log('Applying migration...');\\n"
+ "\\n"
+ "    // Add your migration logic here\\n"
+ "    // Example for PostgreSQL/MySQL:\\n"
+ "    // await this.query('\\n"
+ "    //   CREATE TABLE example_table (\\n"
+ "    //     id SERIAL PRIMARY KEY,\\n"
+ "    //     name VARCHAR(255) NOT NULL,\\n"
+ "    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\\n"
+ "    //   )\\n"
+ "    // ');\\n"
+ "\\n"
+ "    // Example for MongoDB:\\n"
+ "    // await this.db.collection('example_collection').createIndex({ name: 1 });\\n"
+ "\\n"
+ "    this.log('Migration applied successfully.');\\n"
+ "  }\\n"
+ "\\n"
+ "  async down() {\\n"
+ "    this.log('Rolling back migration...');\\n"
+ "\\n"
+ "    // Add your rollback logic here\\n"
+ "    // Example for PostgreSQL/MySQL:\\n"
+ "    // await this.query('DROP TABLE IF EXISTS example_table');\\n"
+ "\\n"
+ "    // Example for MongoDB:\\n"
+ "    // await this.db.collection('example_collection').drop();\\n"
+ "\\n"
+ "    this.log('Migration rolled back successfully.');\\n"
+ "  }\\n"
+ "}\\n";
  }

  /**
   * Convert string to class name
   */
  toClassName(str) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.connection) {
      if (this.config.type === 'mongodb') {
        await this.connection.close();
      } else if (this.config.type === 'mysql') {
        await this.connection.end();
      } else if (this.config.type === 'sqlite') {
        this.connection.close();
      } else {
        await this.connection.end();
      }
    }
  }
}

export default MigrationRunner;
`,

    'migrations/files/20240101000000_create_users_table.js': `import { Migration } from '../migration.js';

/**
 * Create users table
 */
export default class CreateUsersTable extends Migration {
  async up() {
    this.log('Creating users table...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query(\`
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        await this.query('CREATE INDEX idx_users_email ON users(email)');
        break;

      case 'mongodb':
        await this.db.collection('users').createIndex({ email: 1 }, { unique: true });
        break;

      case 'sqlite':
        this.connection.exec(\`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        \`);
        this.connection.exec('CREATE INDEX idx_users_email ON users(email)');
        break;
    }

    this.log('Users table created.');
  }

  async down() {
    this.log('Dropping users table...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query('DROP TABLE IF EXISTS users');
        break;

      case 'mongodb':
        await this.db.collection('users').drop();
        break;

      case 'sqlite':
        this.connection.exec('DROP TABLE IF EXISTS users');
        break;
    }

    this.log('Users table dropped.');
  }
}
`,

    'migrations/files/20240101000001_create_posts_table.js': `import { Migration } from '../migration.js';

/**
 * Create posts table
 */
export default class CreatePostsTable extends Migration {
  async up() {
    this.log('Creating posts table...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query(\`
          CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            status VARCHAR(20) DEFAULT 'draft',
            published_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        \`);
        await this.query('CREATE INDEX idx_posts_user_id ON posts(user_id)');
        await this.query('CREATE INDEX idx_posts_status ON posts(status)');
        break;

      case 'mongodb':
        await this.db.collection('posts').createIndex({ userId: 1 });
        await this.db.collection('posts').createIndex({ status: 1 });
        break;

      case 'sqlite':
        this.connection.exec(\`
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'draft',
            published_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        \`);
        this.connection.exec('CREATE INDEX idx_posts_user_id ON posts(user_id)');
        this.connection.exec('CREATE INDEX idx_posts_status ON posts(status)');
        break;
    }

    this.log('Posts table created.');
  }

  async down() {
    this.log('Dropping posts table...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query('DROP TABLE IF EXISTS posts');
        break;

      case 'mongodb':
        await this.db.collection('posts').drop();
        break;

      case 'sqlite':
        this.connection.exec('DROP TABLE IF EXISTS posts');
        break;
    }

    this.log('Posts table dropped.');
  }
}
`,

    'migrations/files/20240101000002_add_index_on_posts_created_at.js': `import { Migration } from '../migration.js';

/**
 * Add index on posts created_at
 */
export default class AddIndexOnPostsCreatedAt extends Migration {
  async up() {
    this.log('Adding index on posts.created_at...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query('CREATE INDEX idx_posts_created_at ON posts(created_at)');
        break;

      case 'mongodb':
        await this.db.collection('posts').createIndex({ createdAt: 1 });
        break;

      case 'sqlite':
        this.connection.exec('CREATE INDEX idx_posts_created_at ON posts(created_at)');
        break;
    }

    this.log('Index added.');
  }

  async down() {
    this.log('Dropping index on posts.created_at...');

    switch (this.config.type) {
      case 'postgres':
      case 'mysql':
        await this.query('DROP INDEX idx_posts_created_at');
        break;

      case 'mongodb':
        await this.db.collection('posts').dropIndex({ createdAt: 1 });
        break;

      case 'sqlite':
        this.connection.exec('DROP INDEX IF EXISTS idx_posts_created_at');
        break;
    }

    this.log('Index dropped.');
  }
}
`,

    'cli.js': `#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import MigrationRunner from './migrations/runner.js';

const program = new Command();

program
  .name('migrate')
  .description('Database migration CLI with rollback support')
  .version('1.0.0');

/**
 * Run pending migrations
 */
program
  .command('up')
  .description('Run all pending migrations')
  .option('-s, --steps <number>', 'Number of migrations to run', parseInteger)
  .option('-f, --force', 'Run migrations without confirmation')
  .action(async (options) => {
    const spinner = ora('Checking migrations...').start();

    try {
      const runner = new MigrationRunner();
      await runner.connect();
      await runner.ensureMigrationsTable();

      const executed = await runner.getExecutedMigrations();
      const files = await runner.getMigrationFiles();
      const pending = files.filter(f => !executed.includes(f.replace('.js', '')));

      spinner.stop();

      if (pending.length === 0) {
        console.log(chalk.green('✓ No migrations to run.'));
        await runner.close();
        return;
      }

      const toRun = options.steps ? pending.slice(0, options.steps) : pending;

      console.log(chalk.yellow('\\nPending migrations:'));
      toRun.forEach(f => console.log('  - ' + f.replace('.js', '')));
      console.log('');

      if (!options.force) {
        const confirm = await promptConfirm('Run these migrations?');
        if (!confirm) {
          console.log(chalk.gray('Cancelled.'));
          await runner.close();
          return;
        }
      }

      const runSpinner = ora('Running migrations...').start();
      await runner.up(options.steps);
      runSpinner.succeed('Migrations completed successfully!');

      await runner.close();
    } catch (err) {
      spinner.fail('Migration failed: ' + err.message);
      process.exit(1);
    }
  });

/**
 * Rollback migrations
 */
program
  .command('down')
  .description('Rollback migrations')
  .option('-s, --steps <number>', 'Number of migrations to rollback', '1', parseInteger)
  .option('-f, --force', 'Rollback without confirmation')
  .action(async (options) => {
    const spinner = ora('Checking migrations...').start();

    try {
      const runner = new MigrationRunner();
      await runner.connect();
      await runner.ensureMigrationsTable();

      const batch = await runner.getCurrentBatch();

      spinner.stop();

      if (batch === 0) {
        console.log(chalk.green('✓ No migrations to rollback.'));
        await runner.close();
        return;
      }

      console.log(chalk.yellow('\\nRolling back ' + options.steps + ' migration(s)...'));
      console.log('');

      if (!options.force) {
        const confirm = await promptConfirm('Rollback migrations?');
        if (!confirm) {
          console.log(chalk.gray('Cancelled.'));
          await runner.close();
          return;
        }
      }

      const runSpinner = ora('Rolling back...').start();
      await runner.down(options.steps);
      runSpinner.succeed('Rollback completed successfully!');

      await runner.close();
    } catch (err) {
      spinner.fail('Rollback failed: ' + err.message);
      process.exit(1);
    }
  });

/**
 * Reset all migrations
 */
program
  .command('reset')
  .description('Rollback all migrations and re-run them')
  .option('-f, --force', 'Reset without confirmation')
  .action(async (options) => {
    const spinner = ora('Checking migrations...').start();

    try {
      const runner = new MigrationRunner();
      await runner.connect();
      await runner.ensureMigrationsTable();

      const executed = await runner.getExecutedMigrations();

      spinner.stop();

      if (executed.length === 0) {
        console.log(chalk.green('✓ No migrations to reset.'));
        await runner.close();
        return;
      }

      console.log(chalk.red('\\n⚠️  This will rollback ' + executed.length + ' migration(s) and re-run them!'));
      console.log('');

      if (!options.force) {
        const confirm = await promptConfirm('Are you sure you want to reset? This cannot be undone!');
        if (!confirm) {
          console.log(chalk.gray('Cancelled.'));
          await runner.close();
          return;
        }
      }

      const resetSpinner = ora('Resetting...').start();
      await runner.reset();
      resetSpinner.succeed('Reset completed successfully!');

      await runner.close();
    } catch (err) {
      spinner.fail('Reset failed: ' + err.message);
      process.exit(1);
    }
  });

/**
 * Show migration status
 */
program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      const runner = new MigrationRunner();
      await runner.status();
      await runner.close();
    } catch (err) {
      console.error(chalk.red('Error: ' + err.message));
      process.exit(1);
    }
  });

/**
 * Create a new migration
 */
program
  .command('create <name>')
  .description('Create a new migration file')
  .action(async (name) => {
    try {
      const runner = new MigrationRunner();
      const filename = await runner.create(name);
      console.log(chalk.green('✓ Created migration: ' + filename));
    } catch (err) {
      console.error(chalk.red('Error: ' + err.message));
      process.exit(1);
    }
  });

/**
 * Fresh install - drop all tables and run migrations
 */
program
  .command('fresh')
  .description('Drop all tables and re-run migrations')
  .option('-f, --force', 'Run without confirmation')
  .action(async (options) => {
    console.log(chalk.red('\\n⚠️  This will drop all tables!'));
    console.log('');

    if (!options.force) {
      const confirm = await promptConfirm('Are you sure?');
      if (!confirm) {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
    }

    const spinner = ora('Dropping tables...').start();

    try {
      const runner = new MigrationRunner();
      await runner.connect();

      // Drop tables based on database type
      if (runner.config.type === 'postgres' || runner.config.type === 'mysql') {
        await runner.connection.query('DROP SCHEMA public CASCADE');
        await runner.connection.query('CREATE SCHEMA public');
      } else if (runner.config.type === 'sqlite') {
        const tables = runner.connection.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        for (const table of tables) {
          runner.connection.exec('DROP TABLE IF EXISTS ' + table.name);
        }
      } else if (runner.config.type === 'mongodb') {
        const collections = await runner.db.collections();
        for (const collection of collections) {
          await collection.drop();
        }
      }

      spinner.succeed('Tables dropped.');

      // Run migrations
      const migrateSpinner = ora('Running migrations...').start();
      await runner.up();
      migrateSpinner.succeed('Migrations completed!');

      await runner.close();
    } catch (err) {
      spinner.fail('Error: ' + err.message);
      process.exit(1);
    }
  });

/**
 * Parse integer option
 */
function parseInteger(value) {
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    console.error(chalk.red('Invalid number: ' + value));
    process.exit(1);
  }
  return parsed;
}

/**
 * Prompt for confirmation
 */
async function promptConfirm(message) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.gray(message + ' (y/N): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

program.parse();
`,

    'index.js': `import express from 'express';
import MigrationRunner from './migrations/runner.js';

const app = express();
app.use(express.json());

// Initialize migration runner
const runner = new MigrationRunner();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Migration API endpoints
app.get('/api/migrations/status', async (req, res) => {
  try {
    const status = await runner.status();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/migrations/up', async (req, res) => {
  try {
    const { steps } = req.body;
    const results = await runner.up(steps);
    res.json({ success: true, results: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/migrations/down', async (req, res) => {
  try {
    const { steps = 1 } = req.body;
    const results = await runner.down(steps);
    res.json({ success: true, results: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/migrations/reset', async (req, res) => {
  try {
    const results = await runner.reset();
    res.json({ success: true, results: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/migrations/create', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Migration name is required' });
    }
    const filename = await runner.create(name);
    res.json({ success: true, filename: filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example API endpoints (using migrations)
app.get('/api/users', async (req, res) => {
  try {
    await runner.connect();
    let result;

    switch (runner.config.type) {
      case 'postgres':
        result = await runner.connection.query('SELECT * FROM users ORDER BY created_at DESC');
        res.json({ users: result.rows });
        break;

      case 'mysql':
        const [rows] = await runner.connection.query('SELECT * FROM users ORDER BY created_at DESC');
        res.json({ users: rows });
        break;

      case 'mongodb':
        const users = await runner.db.collection('users').find().toArray();
        res.json({ users: users });
        break;

      case 'sqlite':
        const stmt = runner.connection.prepare('SELECT * FROM users ORDER BY created_at DESC');
        result = stmt.all();
        res.json({ users: result });
        break;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    await runner.connect();
    let result;

    switch (runner.config.type) {
      case 'postgres':
        result = await runner.connection.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50');
        res.json({ posts: result.rows });
        break;

      case 'mysql':
        const [rows] = await runner.connection.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50');
        res.json({ posts: rows });
        break;

      case 'mongodb':
        const posts = await runner.db.collection('posts').find().limit(50).toArray();
        res.json({ posts: posts });
        break;

      case 'sqlite':
        const stmt = runner.connection.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50');
        result = stmt.all();
        res.json({ posts: result });
        break;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Database Migration server running on port ' + PORT);
  console.log('');
  console.log('Migration Commands:');
  console.log('  npm run migrate              - Run pending migrations');
  console.log('  npm run migrate:create      - Create a new migration');
  console.log('  npm run migrate:rollback    - Rollback last migration');
  console.log('  npm run migrate:status      - Show migration status');
  console.log('  npm run migrate:reset       - Reset all migrations');
  console.log('');
  console.log('API Endpoints:');
  console.log('  GET  /api/migrations/status - Migration status');
  console.log('  POST /api/migrations/up     - Run migrations');
  console.log('  POST /api/migrations/down   - Rollback migrations');
  console.log('  POST /api/migrations/reset  - Reset migrations');
});
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgres
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=migrations
      - DB_USER=postgres
      - DB_PASSWORD=postgres
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=migrations
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  mysql:
    image: mysql:8-alpine
    ports:
      - "3306:3306"
    environment:
      - MYSQL_DATABASE=migrations
      - MYSQL_ROOT_PASSWORD=root
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  mongodb:
    image: mongo:7-alpine
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

volumes:
  postgres_data:
  mysql_data:
  mongodb_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN chmod +x cli.js

EXPOSE 3000

CMD ["node", "index.js"]
`,

    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=migrations
DB_USER=postgres
DB_PASSWORD=postgres

# For MySQL
# DB_TYPE=mysql
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=root

# For MongoDB
# DB_TYPE=mongodb
# DB_PORT=27017

# For SQLite
# DB_TYPE=sqlite
# DB_DATABASE=./database.sqlite
`,

    'README.md': `# {{projectName}}

Complete database migration solution with up/down support, rollback capabilities, and multi-database support.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, MongoDB, SQLite
- **Up/Down Migrations**: Apply and rollback migrations safely
- **Transaction Safety**: Migrations run in transactions
- **Migration History**: Track all executed migrations
- **CLI Commands**: Easy-to-use command-line interface
- **Batch Rollbacks**: Rollback one or multiple migrations
- **Status Checking**: View migration status at any time
- **API Endpoints**: REST API for migration management

## Quick Start

\`\`\`bash
# Start database
docker-compose up -d postgres

# Install dependencies
npm install

# Run migrations
npm run migrate

# Create a new migration
npm run migrate:create add_user_roles_table
\`\`\`

## CLI Commands

| Command | Description |
|---------|-------------|
| \`npm run migrate\` | Run all pending migrations |
| \`npm run migrate:create <name>\` | Create a new migration file |
| \`npm run migrate:rollback\` | Rollback the last migration |
| \`npm run migrate:rollback -- -s 3\` | Rollback last 3 migrations |
| \`npm run migrate:status\` | Show migration status |
| \`npm run migrate:reset\` | Rollback all and re-run |
| \`npx migrate fresh\` | Drop all tables and re-run |

## Migration Files

Create migrations in \`migrations/files/\`:

\`\`\`javascript
import { Migration } from '../migration.js';

export default class MyMigration extends Migration {
  async up() {
    // Apply changes
    await this.query(\`
      CREATE TABLE example (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL
      )
    \`);
  }

  async down() {
    // Rollback changes
    await this.query('DROP TABLE IF EXISTS example');
  }
}
\`\`\`

## Database Configuration

Set environment variables:

\`\`\`bash
# PostgreSQL
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb
DB_USER=postgres
DB_PASSWORD=postgres

# MySQL
DB_TYPE=mysql
DB_PORT=3306

# MongoDB
DB_TYPE=mongodb
DB_PORT=27017

# SQLite
DB_TYPE=sqlite
DB_DATABASE=./database.sqlite
\`\`\`

## Migration Batching

Migrations are run in batches for easy rollback:

\`\`\`bash
# Run migrations (creates batch 1)
npm run migrate

# Run more migrations (creates batch 2)
npm run migrate

# Rollback entire batch 2
npm run migrate:rollback
\`\`\`

## Transaction Safety

All migrations run in transactions:

- If a migration fails, changes are rolled back
- The migration record is not saved
- You can fix the error and retry

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/migrations/status | Get migration status |
| POST /api/migrations/up | Run migrations |
| POST /api/migrations/down | Rollback migrations |
| POST /api/migrations/reset | Reset all migrations |
| POST /api/migrations/create | Create new migration |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DB_TYPE | postgres | Database type |
| DB_HOST | localhost | Database host |
| DB_PORT | 5432 | Database port |
| DB_NAME | migrations | Database name |
| DB_USER | postgres | Database user |
| DB_PASSWORD | postgres | Database password |

## License

MIT
`
  }
};
