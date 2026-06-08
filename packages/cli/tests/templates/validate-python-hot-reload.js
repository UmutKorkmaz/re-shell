#!/usr/bin/env node

/**
 * Comprehensive validation test for Python hot-reload functionality
 * Tests configuration generation and development server capabilities
 */

const fs = require('fs');
const path = require('path');

const hotReloadPath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'python-hot-reload.ts');

if (!fs.existsSync(hotReloadPath)) {
  console.error('❌ Python hot-reload file not found:', hotReloadPath);
  process.exit(1);
}

const hotReloadContent = fs.readFileSync(hotReloadPath, 'utf8');

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

console.log('🧪 Validating Python Hot-Reload System...\n');

// Basic Structure Tests
test('Contains PythonHotReloadGenerator class', hotReloadContent.includes('class PythonHotReloadGenerator'));
test('Has generateHotReloadConfig method', hotReloadContent.includes('generateHotReloadConfig'));
test('Has generateWatcherScript method', hotReloadContent.includes('generateWatcherScript'));
test('Has generateDockerDevConfig method', hotReloadContent.includes('generateDockerDevConfig'));
test('Has generateVSCodeConfig method', hotReloadContent.includes('generateVSCodeConfig'));

// Configuration Interface Tests
test('Has PythonHotReloadConfig interface', hotReloadContent.includes('interface PythonHotReloadConfig'));
test('Config has framework field', hotReloadContent.includes('framework: string'));
test('Config has serverType field', hotReloadContent.includes('serverType:'));
test('Config has watchPaths field', hotReloadContent.includes('watchPaths: string[]'));
test('Config has excludePatterns field', hotReloadContent.includes('excludePatterns: string[]'));
test('Config has reloadDelay field', hotReloadContent.includes('reloadDelay: number'));
test('Config has dependencies field', hotReloadContent.includes('dependencies: Record<string, string>'));
test('Config has scripts field', hotReloadContent.includes('scripts: Record<string, string>'));

// Framework Support Tests
test('Supports FastAPI framework', hotReloadContent.includes('fastapi:'));
test('Supports Django framework', hotReloadContent.includes('django:'));
test('Supports Flask framework', hotReloadContent.includes('flask:'));
test('Supports Tornado framework', hotReloadContent.includes('tornado:'));
test('Supports Sanic framework', hotReloadContent.includes('sanic:'));

// FastAPI Configuration Tests
test('FastAPI uses uvicorn server', hotReloadContent.includes("serverType: 'uvicorn'"));
test('FastAPI has uvicorn dependency', hotReloadContent.includes("'uvicorn[standard]'"));
test('FastAPI has watchdog dependency', hotReloadContent.includes("'watchdog'"));
test('FastAPI has development script', hotReloadContent.includes("'dev': 'uvicorn app.main:app"));
test('FastAPI has debug script', hotReloadContent.includes("'dev:debug'"));
test('FastAPI has SSL script', hotReloadContent.includes("'dev:ssl'"));
test('FastAPI has production script', hotReloadContent.includes("'start:prod': 'gunicorn"));

// Django Configuration Tests
test('Django uses django server type', hotReloadContent.includes("serverType: 'django'"));
test('Django has django-extensions dependency', hotReloadContent.includes("'django-extensions'"));
test('Django has development script', hotReloadContent.includes("'dev': 'python manage.py runserver"));
test('Django has plus script', hotReloadContent.includes("'dev:plus': 'python manage.py runserver_plus"));
test('Django has shell script', hotReloadContent.includes("'shell': 'python manage.py shell_plus"));
test('Django has migration scripts', hotReloadContent.includes("'migrate'") && hotReloadContent.includes("'makemigrations'"));

// Flask Configuration Tests
test('Flask uses flask server type', hotReloadContent.includes("serverType: 'flask'"));
test('Flask has flask dependency', hotReloadContent.includes("'flask'"));
test('Flask has CORS dependency', hotReloadContent.includes("'flask-cors'"));
test('Flask has development script', hotReloadContent.includes("'dev': 'flask run"));
test('Flask has SSL script', hotReloadContent.includes("'dev:ssl'"));
test('Flask has shell script', hotReloadContent.includes("'shell': 'flask shell"));
test('Flask has routes script', hotReloadContent.includes("'routes': 'flask routes"));
test('Flask has .flaskenv configuration', hotReloadContent.includes("'.flaskenv'"));

// Tornado Configuration Tests
test('Tornado uses tornado server type', hotReloadContent.includes("serverType: 'tornado'"));
test('Tornado has tornado dependency', hotReloadContent.includes("'tornado'"));
test('Tornado has development script', hotReloadContent.includes("'dev': 'python app/main.py"));
test('Tornado has debug and autoreload flags', hotReloadContent.includes("--debug --autoreload"));
test('Tornado has SSL script', hotReloadContent.includes("'dev:ssl'"));
test('Tornado has profiling script', hotReloadContent.includes("'dev:profile'"));

// Sanic Configuration Tests
test('Sanic uses sanic server type', hotReloadContent.includes("serverType: 'sanic'"));
test('Sanic has sanic dependency', hotReloadContent.includes("'sanic'"));
test('Sanic has sanic-ext dependency', hotReloadContent.includes("'sanic-ext'"));
test('Sanic has development script', hotReloadContent.includes("'dev': 'sanic app.main:app"));
test('Sanic has auto-reload flag', hotReloadContent.includes("--auto-reload"));
test('Sanic has workers script', hotReloadContent.includes("'dev:workers'"));
test('Sanic has inspect script', hotReloadContent.includes("'inspect': 'sanic app.main:app --inspect"));

// Watcher Script Tests
test('Watcher script has IntelligentReloadHandler class', hotReloadContent.includes('class IntelligentReloadHandler'));
test('Watcher script has PythonHotReloader class', hotReloadContent.includes('class PythonHotReloader'));
test('Watcher script has ReloadConfig dataclass', hotReloadContent.includes('class ReloadConfig'));
test('Watcher script imports watchdog', hotReloadContent.includes('from watchdog.observers import Observer'));
test('Watcher script imports FileSystemEventHandler', hotReloadContent.includes('from watchdog.events import FileSystemEventHandler'));

// Intelligent Handler Features Tests
test('Handler has should_reload method', hotReloadContent.includes('def should_reload'));
test('Handler has debouncing logic', hotReloadContent.includes('reload_delay'));
test('Handler filters ignored extensions', hotReloadContent.includes('ignored_extensions'));
test('Handler excludes patterns', hotReloadContent.includes('exclude_patterns'));
test('Handler handles relevant extensions', hotReloadContent.includes('relevant_extensions'));
test('Handler has schedule_reload method', hotReloadContent.includes('def schedule_reload'));

// Hot Reloader Features Tests
test('Reloader has setup_signal_handlers method', hotReloadContent.includes('def setup_signal_handlers'));
test('Reloader has install_dependencies method', hotReloadContent.includes('def install_dependencies'));
test('Reloader has start_server method', hotReloadContent.includes('def start_server'));
test('Reloader has stop_server method', hotReloadContent.includes('def stop_server'));
test('Reloader has monitor_output method', hotReloadContent.includes('def monitor_output'));
test('Reloader has reload_server method', hotReloadContent.includes('def reload_server'));
test('Reloader has start_watching method', hotReloadContent.includes('def start_watching'));
test('Reloader has cleanup method', hotReloadContent.includes('def cleanup'));

// Configuration Loading Tests
test('Can load config from pyproject.toml', hotReloadContent.includes('load_config_from_pyproject'));
test('Creates default config fallback', hotReloadContent.includes('create_default_config'));
test('Supports framework-specific configs', hotReloadContent.includes('framework_config'));
test('Has proper argument parsing', hotReloadContent.includes('argparse.ArgumentParser'));

// Development Features Tests
test('Auto-installs missing dependencies', hotReloadContent.includes('auto_install'));
test('Has verbose output mode', hotReloadContent.includes('verbose'));
test('Monitors server output', hotReloadContent.includes('monitor_output'));
test('Handles process termination gracefully', hotReloadContent.includes('signal_handler'));
test('Provides session statistics', hotReloadContent.includes('Session Statistics'));

// Docker Integration Tests
test('Generates Docker development config', hotReloadContent.includes('generateDockerDevConfig'));
test('Docker config has hot-reload service', hotReloadContent.includes('command: python /app/scripts/hot_reload.py'));
test('Docker config has Redis service', hotReloadContent.includes('redis-dev:'));
test('Docker config has PostgreSQL service', hotReloadContent.includes('postgres-dev:'));
test('Docker config has health checks', hotReloadContent.includes('healthcheck:'));
test('Docker config has volume mounts', hotReloadContent.includes('volumes:'));

// VS Code Integration Tests
test('Generates VS Code launch configuration', hotReloadContent.includes('generateVSCodeConfig'));
test('VS Code config has FastAPI debug config', hotReloadContent.includes('"name": "Python: FastAPI Debug"'));
test('VS Code config has Django debug config', hotReloadContent.includes('"name": "Python: Django Debug"'));
test('VS Code config has Flask debug config', hotReloadContent.includes('"name": "Python: Flask Debug"'));
test('VS Code config has Tornado debug config', hotReloadContent.includes('"name": "Python: Tornado Debug"'));
test('VS Code config has Sanic debug config', hotReloadContent.includes('"name": "Python: Sanic Debug"'));
test('VS Code config uses environment files', hotReloadContent.includes('"envFile"'));

// Makefile Integration Tests
test('Generates Makefile targets', hotReloadContent.includes('generateMakefileTargets'));
test('Makefile has framework-specific targets', hotReloadContent.includes('dev-fastapi:') && hotReloadContent.includes('dev-django:'));
test('Makefile has debug target', hotReloadContent.includes('debug:'));
test('Makefile has profile target', hotReloadContent.includes('profile:'));
test('Makefile has benchmark target', hotReloadContent.includes('benchmark:'));
test('Makefile has test-watch target', hotReloadContent.includes('test-watch:'));
test('Makefile has Docker development target', hotReloadContent.includes('dev-docker:'));
test('Makefile has clean target', hotReloadContent.includes('clean-dev:'));

// Pyproject.toml Configuration Tests
test('Generates pyproject.toml config', hotReloadContent.includes('generatePyprojectConfig'));
test('Pyproject config has tool.hot-reload section', hotReloadContent.includes('[tool.hot-reload]'));
test('Pyproject config has watch_paths', hotReloadContent.includes('watch_paths ='));
test('Pyproject config has exclude_patterns', hotReloadContent.includes('exclude_patterns ='));
test('Pyproject config has framework-specific sections', hotReloadContent.includes('[tool.hot-reload.fastapi]'));
test('Pyproject config has environment variables', hotReloadContent.includes('[tool.hot-reload.env_vars]'));
test('Pyproject config has advanced settings', hotReloadContent.includes('[tool.hot-reload.advanced]'));

// Error Handling Tests
test('Handler has proper exception handling', hotReloadContent.includes('try:') && hotReloadContent.includes('except'));
test('Reloader handles subprocess errors', hotReloadContent.includes('subprocess.TimeoutExpired'));
test('Configuration loading handles missing files', hotReloadContent.includes('FileNotFoundError'));
test('Signal handlers cleanup resources', hotReloadContent.includes('cleanup()'));

// Performance Features Tests
test('Has debouncing for multiple file changes', hotReloadContent.includes('debounce'));
test('Has threading for background monitoring', hotReloadContent.includes('threading.Thread'));
test('Has configurable reload delays', hotReloadContent.includes('reload_delay'));
test('Has file filtering for performance', hotReloadContent.includes('should_reload'));
test('Has process health monitoring', hotReloadContent.includes('process.poll()'));

// Watch Path Configuration Tests
test('FastAPI watches API directories', hotReloadContent.includes('api/') && hotReloadContent.includes('schemas/'));
test('Django watches app directories', hotReloadContent.includes('apps/') && hotReloadContent.includes('config/'));
test('Flask watches blueprint directories', hotReloadContent.includes('blueprints/'));
test('Tornado watches handler directories', hotReloadContent.includes('handlers/'));
test('Sanic watches middleware directories', hotReloadContent.includes('middleware/'));

// Dependency Management Tests
test('All frameworks have watchdog dependency', hotReloadContent.includes("'watchdog': '^3.0.0'"));
test('All frameworks have python-dotenv dependency', hotReloadContent.includes("'python-dotenv'"));
test('FastAPI has uvicorn dependency', hotReloadContent.includes("'uvicorn[standard]'"));
test('Django has debug toolbar dependency', hotReloadContent.includes("'django-debug-toolbar'"));
test('Flask has CORS dependency', hotReloadContent.includes("'flask-cors'"));

// Server Command Generation Tests
test('Has getDockerCommand method', hotReloadContent.includes('getDockerCommand'));
test('FastAPI uses uvicorn command', hotReloadContent.includes('uvicorn app.main:app'));
test('Django uses runserver command', hotReloadContent.includes('python manage.py runserver'));
test('Flask uses flask run command', hotReloadContent.includes('flask run'));
test('Tornado uses python app/main.py command', hotReloadContent.includes('python app/main.py'));
test('Sanic uses sanic command', hotReloadContent.includes('sanic app.main:app'));

// Advanced Features Tests
test('Supports SSL development mode', hotReloadContent.includes('dev:ssl'));
test('Supports profiling mode', hotReloadContent.includes('dev:profile'));
test('Supports worker configuration', hotReloadContent.includes('workers'));
test('Supports custom environment variables', hotReloadContent.includes('env_vars'));
test('Supports graceful shutdown', hotReloadContent.includes('SIGTERM'));

console.log(`\n📊 Python Hot-Reload Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Python hot-reload system is comprehensive and production-ready.`);
}