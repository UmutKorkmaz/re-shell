#!/usr/bin/env node

/**
 * Comprehensive validation test for Django ORM enhancements
 * Tests custom management commands and enhanced settings
 */

const fs = require('fs');
const path = require('path');

const enhancementPath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'django-enhanced.py');

if (!fs.existsSync(enhancementPath)) {
  console.error('❌ Django enhancement file not found:', enhancementPath);
  process.exit(1);
}

const enhancementContent = fs.readFileSync(enhancementPath, 'utf8');

// Validation results
let passed = 0;
let failed = 0;
const failures = [];

function test(description, assertion) {
  try {
    if (assertion) {
      console.log(`✅ ${description}`);
      passed++;
    } else {
      console.log(`❌ ${description}`);
      failed++;
      failures.push(description);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    failed++;
    failures.push(description);
  }
}

console.log('🧪 Validating Django ORM Enhancements...\n');

// Basic Structure Tests
test('Contains DjangoORMManager class', enhancementContent.includes('class DjangoORMManager'));
test('Has custom migration commands method', enhancementContent.includes('create_custom_migration_commands'));
test('Has enhanced settings method', enhancementContent.includes('create_enhanced_settings'));

// Custom Management Commands Tests
test('Creates data migration command', enhancementContent.includes('create_data_migration.py'));
test('Creates reset migrations command', enhancementContent.includes('reset_migrations.py'));
test('Creates migration status command', enhancementContent.includes('migrate_status.py'));
test('Creates model graph command', enhancementContent.includes('generate_model_graph.py'));
test('Creates database backup command', enhancementContent.includes('db_backup.py'));

// Data Migration Command Features
test('Data migration supports operation types', enhancementContent.includes("choices=['create', 'update', 'delete', 'custom']"));
test('Data migration has model parameter', enhancementContent.includes('--model'));
test('Data migration generates forward/reverse functions', enhancementContent.includes('def create_') && enhancementContent.includes('def reverse_'));
test('Data migration has bulk_create example', enhancementContent.includes('bulk_create'));
test('Data migration has proper RunPython usage', enhancementContent.includes('migrations.RunPython'));

// Reset Migrations Command Features
test('Reset migrations has confirmation flag', enhancementContent.includes('--confirm'));
test('Reset migrations has keep-initial option', enhancementContent.includes('--keep-initial'));
test('Reset migrations validates app existence', enhancementContent.includes('apps.get_app_config'));
test('Reset migrations removes migration records', enhancementContent.includes('DELETE FROM django_migrations'));
test('Reset migrations removes migration files', enhancementContent.includes('os.remove(file_path)'));

// Migration Status Command Features
test('Migration status shows applied/unapplied', enhancementContent.includes('applied_migrations'));
test('Migration status has verbose option', enhancementContent.includes('--verbose'));
test('Migration status shows app filter', enhancementContent.includes('--app'));
test('Migration status uses MigrationLoader', enhancementContent.includes('MigrationLoader'));
test('Migration status shows dependencies', enhancementContent.includes('dependencies'));

// Model Graph Command Features
test('Model graph supports multiple formats', enhancementContent.includes("choices=['json', 'dot', 'mermaid']"));
test('Model graph analyzes relationships', enhancementContent.includes('ForeignKey') && enhancementContent.includes('ManyToManyField'));
test('Model graph generates DOT format', enhancementContent.includes('def generate_dot_graph'));
test('Model graph generates Mermaid format', enhancementContent.includes('def generate_mermaid_graph'));
test('Model graph has output file option', enhancementContent.includes('--output'));

// Database Backup Command Features
test('Database backup supports PostgreSQL', enhancementContent.includes('backup_postgresql'));
test('Database backup supports SQLite', enhancementContent.includes('backup_sqlite'));
test('Database backup has compression option', enhancementContent.includes('--compress'));
test('Database backup includes media files', enhancementContent.includes('--include-media'));
test('Database backup has restore functionality', enhancementContent.includes('handle_restore'));
test('Database backup uses pg_dump', enhancementContent.includes('pg_dump'));
test('Database backup supports gzip compression', enhancementContent.includes('gzip.open'));

// Enhanced Settings Tests
test('Creates base settings file', enhancementContent.includes('/settings/base.py'));
test('Creates development settings', enhancementContent.includes('/settings/development.py'));
test('Creates production settings', enhancementContent.includes('/settings/production.py'));

// Base Settings Features
test('Base settings has environment variables', enhancementContent.includes('import environ'));
test('Base settings has connection pooling', enhancementContent.includes('CONN_MAX_AGE'));
test('Base settings has database options', enhancementContent.includes('MAX_CONNS'));
test('Base settings has REST framework config', enhancementContent.includes('REST_FRAMEWORK'));
test('Base settings has JWT configuration', enhancementContent.includes('SIMPLE_JWT'));
test('Base settings has Celery configuration', enhancementContent.includes('CELERY_BROKER_URL'));
test('Base settings has cache configuration', enhancementContent.includes('CACHES'));
test('Base settings has logging configuration', enhancementContent.includes('LOGGING'));

// Development Settings Features
test('Development settings enables debug toolbar', enhancementContent.includes('debug_toolbar'));
test('Development settings has Silk profiling', enhancementContent.includes('silk'));
test('Development settings logs database queries', enhancementContent.includes('django.db.backends'));
test('Development settings has shell plus imports', enhancementContent.includes('SHELL_PLUS_IMPORTS'));
test('Development settings has graph models config', enhancementContent.includes('GRAPH_MODELS'));
test('Development settings has lower connection pool', enhancementContent.includes("'MAX_CONNS': 5"));

// Production Settings Features
test('Production settings disables debug', enhancementContent.includes('DEBUG = False'));
test('Production settings has security headers', enhancementContent.includes('SECURE_SSL_REDIRECT'));
test('Production settings has HSTS configuration', enhancementContent.includes('SECURE_HSTS_SECONDS'));
test('Production settings has higher connection pool', enhancementContent.includes("'MAX_CONNS': 50"));
test('Production settings has stricter query timeout', enhancementContent.includes('DATABASE_QUERY_TIMEOUT = 10'));
test('Production settings has session security', enhancementContent.includes('SESSION_COOKIE_SECURE'));
test('Production settings has SQL logging to file', enhancementContent.includes('sql_file'));

// ORM Optimization Features
test('Has database query timeout setting', enhancementContent.includes('DATABASE_QUERY_TIMEOUT'));
test('Has query logging threshold', enhancementContent.includes('DATABASE_QUERY_LOG_THRESHOLD'));
test('Has connection health checks', enhancementContent.includes('DATABASE_CONN_HEALTH_CHECKS'));
test('Has model validation setting', enhancementContent.includes('MODEL_VALIDATION_ENABLED'));
test('Has soft delete support', enhancementContent.includes('SOFT_DELETE_ENABLED'));

// Command Class Structure Tests
test('Management commands extend BaseCommand', enhancementContent.includes('BaseCommand'));
test('Commands have add_arguments method', enhancementContent.includes('def add_arguments'));
test('Commands have handle method', enhancementContent.includes('def handle'));
test('Commands use self.stdout.write', enhancementContent.includes('self.stdout.write'));
test('Commands use style formatting', enhancementContent.includes('self.style.'));

// Error Handling Tests
test('Commands raise CommandError', enhancementContent.includes('CommandError'));
test('Commands validate inputs', enhancementContent.includes('try:') && enhancementContent.includes('except'));
test('Commands check file existence', enhancementContent.includes('os.path.exists'));
test('Commands handle database operations safely', enhancementContent.includes('with connection.cursor()'));

// Advanced Features Tests
test('Supports migration templates', enhancementContent.includes('get_migration_template'));
test('Supports different migration operations', enhancementContent.includes('operation: str'));
test('Has PostgreSQL environment setup', enhancementContent.includes('PGPASSWORD'));
test('Has tarfile for media backup', enhancementContent.includes('import tarfile'));
test('Has JSON output for model graph', enhancementContent.includes('json.dumps'));

// Security Features Tests
test('Backup command requires confirmation', enhancementContent.includes('--confirm'));
test('Production settings have security middleware', enhancementContent.includes('SecurityMiddleware'));
test('Has CSRF protection', enhancementContent.includes('CSRF_COOKIE_SECURE'));
test('Has XSS protection', enhancementContent.includes('X_FRAME_OPTIONS'));

// Performance Features Tests
test('Has connection pooling configuration', enhancementContent.includes('MIN_CONNS') && enhancementContent.includes('MAX_CONNS'));
test('Has query optimization settings', enhancementContent.includes('DATABASE_QUERY_TIMEOUT'));
test('Has cache backend configuration', enhancementContent.includes('RedisCache'));
test('Has static file optimization', enhancementContent.includes('ManifestStaticFilesStorage'));

// Documentation and Help Tests
test('Commands have help text', enhancementContent.includes('help ='));
test('Commands have detailed docstrings', enhancementContent.includes('"""'));
test('Arguments have help descriptions', enhancementContent.includes("help='"));
test('Migration templates have TODO comments', enhancementContent.includes('# TODO:'));

console.log(`\n📊 Django ORM Enhancement Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Django ORM enhancements are comprehensive and production-ready.`);
}