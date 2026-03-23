const fs = require('fs');
const path = require('path');

// Load the Flask template
const templatePath = path.join(__dirname, '../src/templates/backend/flask-py.ts');
const templateContent = fs.readFileSync(templatePath, 'utf-8');

// Extract the template object
const templateMatch = templateContent.match(/export const flaskTemplate: BackendTemplate = ({[\s\S]*});/);
if (!templateMatch) {
  console.error('❌ Failed to extract Flask template from file');
  process.exit(1);
}

// Use eval to parse the template (in a real scenario, we'd use a proper parser)
let template;
try {
  eval(`template = ${templateMatch[1]}`);
} catch (error) {
  console.error('❌ Failed to parse Flask template:', error.message);
  process.exit(1);
}

// Define expected features for Flask template
const expectedFeatures = {
  // Basic structure
  'Template ID': () => template.id === 'flask-py',
  'Template Name': () => template.name === 'Flask + SQLAlchemy',
  'Framework': () => template.framework === 'flask',
  'Language': () => template.language === 'python',
  
  // Core dependencies
  'Flask': () => template.dependencies.flask === '^3.0.0',
  'Flask-SQLAlchemy': () => template.dependencies['flask-sqlalchemy'] === '^3.1.1',
  'Flask-Migrate': () => template.dependencies['flask-migrate'] === '^4.0.5',
  'Flask-JWT-Extended': () => template.dependencies['flask-jwt-extended'] === '^4.6.0',
  'Flask-CORS': () => template.dependencies['flask-cors'] === '^4.0.0',
  'Flask-Marshmallow': () => template.dependencies['flask-marshmallow'] === '^0.15.0',
  'Flask-Admin': () => template.dependencies['flask-admin'] === '^1.6.1',
  'Flask-Limiter': () => template.dependencies['flask-limiter'] === '^3.5.0',
  'Flask-Caching': () => template.dependencies['flask-caching'] === '^2.1.0',
  'PostgreSQL Driver': () => template.dependencies.psycopg2 === '^2.9.9',
  'Redis': () => template.dependencies.redis === '^5.0.1',
  'Celery': () => template.dependencies.celery === '^5.3.4',
  
  // Dev dependencies
  'Pytest': () => template.devDependencies.pytest === '^7.4.3',
  'Pytest-Flask': () => template.devDependencies['pytest-flask'] === '^1.3.0',
  'Black Formatter': () => template.devDependencies.black === '^23.11.0',
  'MyPy': () => template.devDependencies.mypy === '^1.7.1',
  
  // Core files
  'Requirements.txt': () => template.files['requirements.txt'] !== undefined,
  'App Entry Point': () => template.files['app.py'] !== undefined,
  'WSGI Entry': () => template.files['wsgi.py'] !== undefined,
  'Application Factory': () => template.files['app/__init__.py'] !== undefined,
  'Configuration': () => template.files['app/config.py'] !== undefined,
  
  // Models
  'Base Model': () => template.files['app/models/base.py'] !== undefined,
  'User Model': () => template.files['app/models/user.py'] !== undefined,
  'Blog Models': () => template.files['app/models/blog.py'] !== undefined,
  
  // Schemas
  'User Schema': () => template.files['app/schemas/user.py'] !== undefined,
  'Blog Schemas': () => template.files['app/schemas/blog.py'] !== undefined,
  
  // Blueprints
  'Auth Blueprint': () => template.files['app/auth/__init__.py'] !== undefined,
  'Auth Routes': () => template.files['app/auth/routes.py'] !== undefined,
  'Auth Utils': () => template.files['app/auth/utils.py'] !== undefined,
  'Auth Handlers': () => template.files['app/auth/handlers.py'] !== undefined,
  'Users Blueprint': () => template.files['app/users/routes.py'] !== undefined,
  'Blog Blueprint': () => template.files['app/blog/routes.py'] !== undefined,
  'Main Blueprint': () => template.files['app/main/routes.py'] !== undefined,
  
  // Additional features
  'Admin Views': () => template.files['app/admin_views.py'] !== undefined,
  'Error Handlers': () => template.files['app/errors.py'] !== undefined,
  'CLI Commands': () => template.files['app/cli.py'] !== undefined,
  'Celery Tasks': () => template.files['app/tasks.py'] !== undefined,
  
  // Testing
  'Test Config': () => template.files['tests/conftest.py'] !== undefined,
  'Auth Tests': () => template.files['tests/test_auth.py'] !== undefined,
  'User Tests': () => template.files['tests/test_users.py'] !== undefined,
  'Blog Tests': () => template.files['tests/test_blog.py'] !== undefined,
  'Model Tests': () => template.files['tests/test_models.py'] !== undefined,
  
  // Configuration files
  'Environment Example': () => template.files['.env.example'] !== undefined,
  'Docker Compose': () => template.files['docker-compose.yml'] !== undefined,
  'Dockerfile': () => template.files['Dockerfile'] !== undefined,
  'Pytest Config': () => template.files['pytest.ini'] !== undefined,
  'PyProject.toml': () => template.files['pyproject.toml'] !== undefined,
  'Git Ignore': () => template.files['.gitignore'] !== undefined,
  'README': () => template.files['README.md'] !== undefined,
  
  // Content validations
  'JWT Authentication': () => {
    const authContent = template.files['app/auth/routes.py'];
    return authContent.includes('create_access_token') && authContent.includes('create_refresh_token');
  },
  'SQLAlchemy Models': () => {
    const modelContent = template.files['app/models/base.py'];
    return modelContent.includes('BaseModel') && modelContent.includes('db.Model');
  },
  'Marshmallow Schemas': () => {
    const schemaContent = template.files['app/schemas/user.py'];
    return schemaContent.includes('SQLAlchemyAutoSchema') && schemaContent.includes('marshmallow');
  },
  'Blueprint Registration': () => {
    const appContent = template.files['app/__init__.py'];
    return appContent.includes('register_blueprint') && appContent.includes('url_prefix');
  },
  'Flask-Admin Integration': () => {
    const adminContent = template.files['app/admin_views.py'];
    return adminContent.includes('SecureModelView') && adminContent.includes('Flask-Admin');
  },
  'Celery Configuration': () => {
    const appContent = template.files['app/__init__.py'];
    return appContent.includes('create_celery') && appContent.includes('CELERY_BROKER_URL');
  },
  'Database Migrations': () => {
    const appContent = template.files['app/__init__.py'];
    return appContent.includes('flask_migrate') && appContent.includes('migrate.init_app');
  },
  'Rate Limiting': () => {
    const authContent = template.files['app/auth/routes.py'];
    return authContent.includes('@limiter.limit') && authContent.includes('per minute');
  },
  'Error Handling': () => {
    const errorContent = template.files['app/errors.py'];
    return errorContent.includes('errorhandler') && errorContent.includes('ValidationError');
  },
  'Testing Fixtures': () => {
    const testContent = template.files['tests/conftest.py'];
    return testContent.includes('@pytest.fixture') && testContent.includes('auth_headers');
  },
  'Docker Support': () => {
    const dockerContent = template.files['Dockerfile'];
    return dockerContent.includes('python:3.11-slim') && dockerContent.includes('requirements.txt');
  },
  'Code Quality Tools': () => {
    const pyprojectContent = template.files['pyproject.toml'];
    return pyprojectContent.includes('[tool.black]') && pyprojectContent.includes('[tool.mypy]');
  }
};

// Run validations
console.log('🔍 Validating Flask Template...\n');

let passed = 0;
let failed = 0;

for (const [feature, test] of Object.entries(expectedFeatures)) {
  try {
    if (test()) {
      console.log(`✅ ${feature}`);
      passed++;
    } else {
      console.log(`❌ ${feature}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${feature} - Error: ${error.message}`);
    failed++;
  }
}

// Summary
console.log('\n📊 Summary:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);
console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

// Exit with appropriate code
if (failed > 0) {
  console.log('\n❌ Flask template validation failed!');
  process.exit(1);
} else {
  console.log('\n✅ Flask template validation passed!');
  process.exit(0);
}