/**
 * Python Hot-Reload Configuration for All Framework Templates
 * Provides auto-restart functionality with uvicorn, gunicorn, and development servers
 */

export interface PythonHotReloadConfig {
  framework: string;
  serverType: 'uvicorn' | 'gunicorn' | 'django' | 'flask' | 'tornado' | 'sanic';
  watchPaths: string[];
  excludePatterns: string[];
  reloadDelay: number;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  environmentFiles: Record<string, string>;
}

export class PythonHotReloadGenerator {
  generateHotReloadConfig(framework: string): PythonHotReloadConfig {
    const configs: Record<string, PythonHotReloadConfig> = {
      fastapi: {
        framework: 'FastAPI',
        serverType: 'uvicorn',
        watchPaths: ['app/', 'src/', 'api/', 'models/', 'schemas/', 'routers/', 'core/'],
        excludePatterns: ['__pycache__/', '*.pyc', '*.pyo', '.git/', 'tests/', '.pytest_cache/'],
        reloadDelay: 250,
        dependencies: {
          'uvicorn[standard]': '^0.24.0',
          'watchdog': '^3.0.0',
          'python-dotenv': '^1.0.0',
          'aiofiles': '^23.2.1'
        },
        scripts: {
          'dev': 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-delay 0.25',
          'dev:debug': 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-delay 0.25 --log-level debug',
          'dev:ssl': 'uvicorn app.main:app --host 0.0.0.0 --port 8443 --reload --ssl-keyfile key.pem --ssl-certfile cert.pem',
          'watch': 'watchmedo auto-restart --patterns="*.py" --recursive --signal SIGTERM uvicorn -- app.main:app --host 0.0.0.0 --port 8000',
          'start': 'uvicorn app.main:app --host 0.0.0.0 --port 8000',
          'start:prod': 'gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000'
        },
        environmentFiles: {}
      },
      
      django: {
        framework: 'Django',
        serverType: 'django',
        watchPaths: ['app/', 'apps/', 'src/', 'config/', 'static/', 'templates/', 'locale/'],
        excludePatterns: ['__pycache__/', '*.pyc', '*.pyo', '.git/', 'media/', 'staticfiles/', 'migrations/__pycache__/'],
        reloadDelay: 500,
        dependencies: {
          'django-extensions': '^3.2.3',
          'watchdog': '^3.0.0',
          'python-dotenv': '^1.0.0',
          'django-debug-toolbar': '^4.2.0'
        },
        scripts: {
          'dev': 'python manage.py runserver 0.0.0.0:8000 --settings=config.settings.development',
          'dev:plus': 'python manage.py runserver_plus 0.0.0.0:8000 --cert-file cert.pem --key-file key.pem',
          'dev:debug': 'python manage.py runserver 0.0.0.0:8000 --settings=config.settings.development --verbosity=2',
          'watch': 'watchmedo auto-restart --patterns="*.py;*.html;*.css;*.js" --recursive --signal SIGTERM python -- manage.py runserver 0.0.0.0:8000',
          'shell': 'python manage.py shell_plus --ipython',
          'migrate': 'python manage.py migrate',
          'makemigrations': 'python manage.py makemigrations',
          'collectstatic': 'python manage.py collectstatic --noinput'
        },
        environmentFiles: {}
      },
      
      flask: {
        framework: 'Flask',
        serverType: 'flask',
        watchPaths: ['app/', 'src/', 'blueprints/', 'models/', 'templates/', 'static/'],
        excludePatterns: ['__pycache__/', '*.pyc', '*.pyo', '.git/', 'instance/', '.flask_session/'],
        reloadDelay: 300,
        dependencies: {
          'flask': '^3.0.0',
          'flask-cors': '^4.0.0',
          'python-dotenv': '^1.0.0',
          'watchdog': '^3.0.0',
          'gunicorn': '^21.2.0'
        },
        scripts: {
          'dev': 'flask run --host=0.0.0.0 --port=5000 --debug --reload',
          'dev:ssl': 'flask run --host=0.0.0.0 --port=5443 --debug --cert=adhoc',
          'dev:profile': 'flask run --host=0.0.0.0 --port=5000 --debug --with-threads --profile',
          'watch': 'watchmedo auto-restart --patterns="*.py;*.html;*.css;*.js" --recursive --signal SIGTERM flask -- run --host=0.0.0.0 --port=5000',
          'shell': 'flask shell',
          'routes': 'flask routes',
          'start': 'gunicorn -w 4 -b 0.0.0.0:5000 app:create_app()'
        },
        environmentFiles: {
          '.flaskenv': 'FLASK_APP=app\nFLASK_ENV=development\nFLASK_DEBUG=1\nFLASK_RUN_HOST=0.0.0.0\nFLASK_RUN_PORT=5000'
        }
      },
      
      tornado: {
        framework: 'Tornado',
        serverType: 'tornado',
        watchPaths: ['app/', 'handlers/', 'models/', 'templates/', 'static/'],
        excludePatterns: ['__pycache__/', '*.pyc', '*.pyo', '.git/', 'logs/'],
        reloadDelay: 200,
        dependencies: {
          'tornado': '^6.4',
          'watchdog': '^3.0.0',
          'python-dotenv': '^1.0.0',
          'aiofiles': '^23.2.1'
        },
        scripts: {
          'dev': 'python app/main.py --debug --autoreload --port=8888',
          'dev:ssl': 'python app/main.py --debug --autoreload --port=8443 --ssl',
          'dev:profile': 'python -m cProfile -o profile.stats app/main.py --debug --port=8888',
          'watch': 'watchmedo auto-restart --patterns="*.py;*.html;*.css;*.js" --recursive --signal SIGTERM python -- app/main.py --debug --port=8888',
          'start': 'python app/main.py --port=8888',
          'benchmark': 'python scripts/benchmark.py'
        },
        environmentFiles: {}
      },
      
      sanic: {
        framework: 'Sanic',
        serverType: 'sanic',
        watchPaths: ['app/', 'blueprints/', 'models/', 'middleware/', 'static/'],
        excludePatterns: ['__pycache__/', '*.pyc', '*.pyo', '.git/', 'logs/'],
        reloadDelay: 150,
        dependencies: {
          'sanic': '^23.12.1',
          'sanic-ext': '^23.12.0',
          'watchdog': '^3.0.0',
          'python-dotenv': '^1.0.0'
        },
        scripts: {
          'dev': 'sanic app.main:app --host=0.0.0.0 --port=8000 --debug --auto-reload --dev',
          'dev:workers': 'sanic app.main:app --host=0.0.0.0 --port=8000 --debug --auto-reload --workers=2',
          'dev:ssl': 'sanic app.main:app --host=0.0.0.0 --port=8443 --debug --auto-reload --tls=cert/',
          'watch': 'watchmedo auto-restart --patterns="*.py" --recursive --signal SIGTERM sanic -- app.main:app --host=0.0.0.0 --port=8000 --debug',
          'start': 'sanic app.main:app --host=0.0.0.0 --port=8000 --workers=4',
          'inspect': 'sanic app.main:app --inspect'
        },
        environmentFiles: {}
      }
    };
    
    return configs[framework] || configs.fastapi;
  }
  
  generateWatcherScript(): string {
    return `#!/usr/bin/env python3
"""
Advanced Python Hot-Reload Development Server
Provides intelligent file watching and auto-restart for all Python frameworks
"""

import os
import sys
import time
import signal
import subprocess
import argparse
import json
from pathlib import Path
from typing import List, Set, Optional, Dict, Any
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ReloadConfig:
    """Configuration for hot-reload functionality."""
    watch_paths: List[str]
    exclude_patterns: List[str]
    reload_delay: float
    command: List[str]
    env_vars: Dict[str, str]
    framework: str
    auto_install: bool = True
    verbose: bool = False


class IntelligentReloadHandler(FileSystemEventHandler):
    """Intelligent file system event handler with debouncing and filtering."""
    
    def __init__(self, config: ReloadConfig, callback):
        super().__init__()
        self.config = config
        self.callback = callback
        self.last_reload = 0
        self.pending_files: Set[str] = set()
        self.ignored_extensions = {'.pyc', '.pyo', '.pyd', '__pycache__'}
        
    def should_reload(self, event: FileSystemEvent) -> bool:
        """Determine if file change should trigger reload."""
        if event.is_directory:
            return False
            
        file_path = Path(event.src_path)
        
        # Skip ignored extensions
        if file_path.suffix in self.ignored_extensions:
            return False
            
        # Skip excluded patterns
        for pattern in self.config.exclude_patterns:
            if pattern in str(file_path):
                return False
                
        # Only reload for Python files and templates
        relevant_extensions = {'.py', '.html', '.jinja2', '.j2', '.txt', '.yml', '.yaml', '.json'}
        if file_path.suffix not in relevant_extensions:
            return False
            
        return True
        
    def on_any_event(self, event: FileSystemEvent):
        """Handle file system events with intelligent filtering."""
        if not self.should_reload(event):
            return
            
        current_time = time.time()
        self.pending_files.add(event.src_path)
        
        # Debounce multiple file changes
        if current_time - self.last_reload > self.config.reload_delay:
            self.schedule_reload()
            
    def schedule_reload(self):
        """Schedule a reload after the debounce period."""
        def delayed_reload():
            time.sleep(self.config.reload_delay)
            if self.pending_files:
                files = list(self.pending_files)
                self.pending_files.clear()
                self.last_reload = time.time()
                
                if self.config.verbose:
                    print(f"\\n🔄 Reloading due to changes in {len(files)} files:")
                    for file_path in files[:5]:  # Show max 5 files
                        print(f"   📝 {Path(file_path).relative_to(Path.cwd())}")
                    if len(files) > 5:
                        print(f"   ... and {len(files) - 5} more files")
                        
                self.callback(files)
                
        import threading
        threading.Thread(target=delayed_reload, daemon=True).start()


class PythonHotReloader:
    """Advanced Python hot-reload development server."""
    
    def __init__(self, config: ReloadConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.observer: Optional[Observer] = None
        self.reload_count = 0
        self.start_time = datetime.now()
        
    def setup_signal_handlers(self):
        """Setup graceful shutdown signal handlers."""
        def signal_handler(signum, frame):
            print("\\n🛑 Shutting down hot-reload server...")
            self.cleanup()
            sys.exit(0)
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
    def install_dependencies(self):
        """Auto-install missing dependencies."""
        if not self.config.auto_install:
            return
            
        required_packages = ['watchdog', 'python-dotenv']
        
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
            except ImportError:
                print(f"📦 Installing missing dependency: {package}")
                subprocess.run([sys.executable, '-m', 'pip', 'install', package], 
                             check=True, capture_output=True)
                
    def start_server(self):
        """Start the development server process."""
        if self.process:
            self.stop_server()
            
        env = os.environ.copy()
        env.update(self.config.env_vars)
        
        try:
            self.process = subprocess.Popen(
                self.config.command,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            self.reload_count += 1
            uptime = datetime.now() - self.start_time
            
            print(f"\\n🚀 Started {self.config.framework} server (reload #{self.reload_count})")
            print(f"⏱️  Uptime: {uptime.total_seconds():.1f}s")
            print(f"🔍 Watching: {', '.join(self.config.watch_paths)}")
            print(f"⚡ Process ID: {self.process.pid}")
            
            # Monitor server output in background
            import threading
            threading.Thread(target=self.monitor_output, daemon=True).start()
            
        except Exception as e:
            print(f"❌ Failed to start server: {e}")
            
    def stop_server(self):
        """Stop the current server process."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            except Exception as e:
                print(f"⚠️  Error stopping server: {e}")
            finally:
                self.process = None
                
    def monitor_output(self):
        """Monitor server output and display relevant messages."""
        if not self.process:
            return
            
        try:
            for line in iter(self.process.stdout.readline, ''):
                if line.strip():
                    # Filter and format server output
                    if any(keyword in line.lower() for keyword in 
                          ['error', 'exception', 'traceback', 'failed']):
                        print(f"❌ {line.strip()}")
                    elif any(keyword in line.lower() for keyword in 
                           ['starting', 'running', 'listening', 'serving']):
                        print(f"✅ {line.strip()}")
                    elif self.config.verbose:
                        print(f"📋 {line.strip()}")
                        
        except Exception as e:
            if self.config.verbose:
                print(f"⚠️  Output monitoring error: {e}")
                
    def reload_server(self, changed_files: List[str]):
        """Reload the server when files change."""
        print(f"\\n🔄 Reloading {self.config.framework} server...")
        
        # Stop current server
        self.stop_server()
        
        # Brief pause to ensure clean shutdown
        time.sleep(0.1)
        
        # Start new server
        self.start_server()
        
    def start_watching(self):
        """Start file system watching."""
        self.observer = Observer()
        handler = IntelligentReloadHandler(self.config, self.reload_server)
        
        for watch_path in self.config.watch_paths:
            if os.path.exists(watch_path):
                self.observer.schedule(handler, watch_path, recursive=True)
                print(f"👁️  Watching: {watch_path}")
            else:
                print(f"⚠️  Path not found: {watch_path}")
                
        self.observer.start()
        
    def cleanup(self):
        """Clean up resources."""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            
        self.stop_server()
        
        uptime = datetime.now() - self.start_time
        print(f"\\n📊 Session Statistics:")
        print(f"   ⏱️  Total uptime: {uptime.total_seconds():.1f}s")
        print(f"   🔄 Reloads: {self.reload_count}")
        print(f"   ✅ Average time between reloads: {uptime.total_seconds() / max(1, self.reload_count):.1f}s")
        
    def run(self):
        """Run the hot-reload development server."""
        print(f"🔥 Python Hot-Reload Server for {self.config.framework}")
        print(f"📁 Working directory: {os.getcwd()}")
        
        self.setup_signal_handlers()
        self.install_dependencies()
        
        # Start initial server
        self.start_server()
        
        # Start file watching
        self.start_watching()
        
        try:
            # Keep the main thread alive
            while True:
                time.sleep(1)
                
                # Check if process is still running
                if self.process and self.process.poll() is not None:
                    print("⚠️  Server process died, restarting...")
                    self.start_server()
                    
        except KeyboardInterrupt:
            pass
        finally:
            self.cleanup()


def load_config_from_pyproject(framework: str) -> Optional[ReloadConfig]:
    """Load hot-reload configuration from pyproject.toml."""
    try:
        import tomli
        
        with open('pyproject.toml', 'rb') as f:
            data = tomli.load(f)
            
        tool_config = data.get('tool', {}).get(, {})
        
        return ReloadConfig(
            watch_paths=tool_config.get('watch_paths', ['app/', 'src/']),
            exclude_patterns=tool_config.get('exclude_patterns', ['__pycache__/', '*.pyc']),
            reload_delay=tool_config.get('reload_delay', 0.25),
            command=tool_config.get('command', []),
            env_vars=tool_config.get('env_vars', {}),
            framework=framework,
            auto_install=tool_config.get('auto_install', True),
            verbose=tool_config.get('verbose', False)
        )
    except (ImportError, FileNotFoundError, KeyError):
        return None


def create_default_config(framework: str, command: List[str]) -> ReloadConfig:
    """Create default configuration for the framework."""
    configs = {
        'fastapi': {
            'watch_paths': ['app/', 'src/', 'api/', 'models/', 'schemas/'],
            'exclude_patterns': ['__pycache__/', '*.pyc', '.git/', 'tests/'],
            'reload_delay': 0.25,
            'env_vars': {'PYTHONPATH': '.'}
        },
        'django': {
            'watch_paths': ['app/', 'apps/', 'config/', 'static/', 'templates/'],
            'exclude_patterns': ['__pycache__/', '*.pyc', 'media/', 'staticfiles/'],
            'reload_delay': 0.5,
            'env_vars': {'DJANGO_SETTINGS_MODULE': 'config.settings.development'}
        },
        'flask': {
            'watch_paths': ['app/', 'blueprints/', 'templates/', 'static/'],
            'exclude_patterns': ['__pycache__/', '*.pyc', 'instance/', '.flask_session/'],
            'reload_delay': 0.3,
            'env_vars': {'FLASK_ENV': 'development', 'FLASK_DEBUG': '1'}
        },
        'tornado': {
            'watch_paths': ['app/', 'handlers/', 'templates/', 'static/'],
            'exclude_patterns': ['__pycache__/', '*.pyc', 'logs/'],
            'reload_delay': 0.2,
            'env_vars': {'PYTHONPATH': '.'}
        },
        'sanic': {
            'watch_paths': ['app/', 'blueprints/', 'middleware/', 'static/'],
            'exclude_patterns': ['__pycache__/', '*.pyc', 'logs/'],
            'reload_delay': 0.15,
            'env_vars': {'SANIC_ENV': 'development'}
        }
    }
    
    framework_config = configs.get(framework, configs['fastapi'])
    
    return ReloadConfig(
        watch_paths=framework_config['watch_paths'],
        exclude_patterns=framework_config['exclude_patterns'],
        reload_delay=framework_config['reload_delay'],
        command=command,
        env_vars=framework_config['env_vars'],
        framework=framework,
        auto_install=True,
        verbose=False
    )


def main():
    """Main entry point for the hot-reload server."""
    parser = argparse.ArgumentParser(description='Python Hot-Reload Development Server')
    parser.add_argument('--framework', default='fastapi', 
                       choices=['fastapi', 'django', 'flask', 'tornado', 'sanic'],
                       help='Python framework to use')
    parser.add_argument('--command', nargs='+', required=True,
                       help='Command to run the development server')
    parser.add_argument('--watch', nargs='*', default=[],
                       help='Additional paths to watch')
    parser.add_argument('--exclude', nargs='*', default=[],
                       help='Additional patterns to exclude')
    parser.add_argument('--delay', type=float, default=None,
                       help='Reload delay in seconds')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('--no-auto-install', action='store_true',
                       help='Disable automatic dependency installation')
    
    args = parser.parse_args()
    
    # Try to load config from pyproject.toml first
    config = load_config_from_pyproject(args.framework)
    
    # Create default config if not found
    if not config:
        config = create_default_config(args.framework, args.command)
    else:
        config.command = args.command
    
    # Override with command line arguments
    if args.watch:
        config.watch_paths.extend(args.watch)
    if args.exclude:
        config.exclude_patterns.extend(args.exclude)
    if args.delay is not None:
        config.reload_delay = args.delay
    if args.verbose:
        config.verbose = True
    if args.no_auto_install:
        config.auto_install = False
        
    # Start the hot-reload server
    reloader = PythonHotReloader(config)
    reloader.run()


if __name__ == '__main__':
    main()
`;
  }
  
  generateDockerDevConfig(framework: string): string {
    return `# Development Docker configuration with hot-reload for ${framework}
version: '3.8'

services:
  ${framework}-dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
      - "5678:5678"  # debugpy port
    volumes:
      - .:/app
      - /app/__pycache__
      - /app/.pytest_cache
    environment:
      - PYTHONPATH=/app
      - PYTHONUNBUFFERED=1
      - DEVELOPMENT=1
      - HOT_RELOAD=1
    command: python /app/scripts/hot_reload.py --framework ${framework} --command ${this.getDockerCommand(framework)}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  redis-dev:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  postgres-dev:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=devdb
      - POSTGRES_USER=devuser
      - POSTGRES_PASSWORD=devpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  redis_data:
  postgres_data:
`;
  }
  
  private getDockerCommand(framework: string): string {
    const commands: Record<string, string> = {
      fastapi: 'uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload',
      django: 'python manage.py runserver 0.0.0.0:8000',
      flask: 'flask run --host=0.0.0.0 --port=8000 --debug',
      tornado: 'python app/main.py --port=8000 --debug --autoreload',
      sanic: 'sanic app.main:app --host=0.0.0.0 --port=8000 --debug --auto-reload'
    };
    
    return commands[framework] || commands.fastapi;
  }
  
  generateVSCodeConfig(): string {
    return `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI Debug",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/scripts/hot_reload.py",
      "args": [
        "--framework", "fastapi",
        "--command", "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--verbose"
      ],
      "console": "integratedTerminal",
      "envFile": "\${workspaceFolder}/.env",
      "cwd": "\${workspaceFolder}",
      "autoReload": {
        "enable": true
      }
    },
    {
      "name": "Python: Django Debug",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/scripts/hot_reload.py",
      "args": [
        "--framework", "django",
        "--command", "python", "manage.py", "runserver", "0.0.0.0:8000",
        "--verbose"
      ],
      "console": "integratedTerminal",
      "envFile": "\${workspaceFolder}/.env",
      "cwd": "\${workspaceFolder}",
      "django": true
    },
    {
      "name": "Python: Flask Debug",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/scripts/hot_reload.py",
      "args": [
        "--framework", "flask",
        "--command", "flask", "run", "--host=0.0.0.0", "--port=5000", "--debug",
        "--verbose"
      ],
      "console": "integratedTerminal",
      "envFile": "\${workspaceFolder}/.env",
      "cwd": "\${workspaceFolder}"
    },
    {
      "name": "Python: Tornado Debug",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/scripts/hot_reload.py",
      "args": [
        "--framework", "tornado",
        "--command", "python", "app/main.py", "--port=8888", "--debug", "--autoreload",
        "--verbose"
      ],
      "console": "integratedTerminal",
      "envFile": "\${workspaceFolder}/.env",
      "cwd": "\${workspaceFolder}"
    },
    {
      "name": "Python: Sanic Debug",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/scripts/hot_reload.py",
      "args": [
        "--framework", "sanic",
        "--command", "sanic", "app.main:app", "--host=0.0.0.0", "--port=8000", "--debug", "--auto-reload",
        "--verbose"
      ],
      "console": "integratedTerminal",
      "envFile": "\${workspaceFolder}/.env",
      "cwd": "\${workspaceFolder}"
    }
  ]
}`;
  }
  
  generateMakefileTargets(): string {
    return `# Python Hot-Reload Development Targets

.PHONY: dev dev-fastapi dev-django dev-flask dev-tornado dev-sanic
.PHONY: debug profile benchmark test install-dev

# Default development server
dev: dev-fastapi

# Framework-specific development servers
dev-fastapi:
	@echo "🚀 Starting FastAPI development server with hot-reload..."
	python scripts/hot_reload.py --framework fastapi --command uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-django:
	@echo "🚀 Starting Django development server with hot-reload..."
	python scripts/hot_reload.py --framework django --command python manage.py runserver 0.0.0.0:8000

dev-flask:
	@echo "🚀 Starting Flask development server with hot-reload..."
	python scripts/hot_reload.py --framework flask --command flask run --host=0.0.0.0 --port=5000 --debug

dev-tornado:
	@echo "🚀 Starting Tornado development server with hot-reload..."
	python scripts/hot_reload.py --framework tornado --command python app/main.py --port=8888 --debug --autoreload

dev-sanic:
	@echo "🚀 Starting Sanic development server with hot-reload..."
	python scripts/hot_reload.py --framework sanic --command sanic app.main:app --host=0.0.0.0 --port=8000 --debug --auto-reload

# Debug mode with verbose output
debug:
	python scripts/hot_reload.py --framework $(FRAMEWORK) --verbose --command $(CMD)

# Performance profiling mode
profile:
	@echo "📊 Starting server with performance profiling..."
	python -m cProfile -o profile.stats scripts/hot_reload.py --framework $(FRAMEWORK) --command $(CMD)

# Benchmarking with wrk
benchmark:
	@echo "⚡ Running performance benchmark..."
	wrk -t12 -c400 -d30s http://localhost:8000/

# Install development dependencies
install-dev:
	pip install -r requirements-dev.txt
	pip install watchdog python-dotenv

# Run tests with hot-reload for test files
test-watch:
	python scripts/hot_reload.py --framework pytest --watch tests/ --command pytest tests/ --verbose --tb=short

# Development with Docker
dev-docker:
	docker-compose -f docker-compose.dev.yml up --build

# Clean development artifacts
clean-dev:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "profile.stats" -delete
`;
  }
  
  generatePyprojectConfig(): string {
    return `[tool.hot-reload]
# Python Hot-Reload Configuration
# Customize these settings for your project needs

# Paths to watch for changes
watch_paths = [
    "app/",
    "src/",
    "api/",
    "models/",
    "schemas/",
    "routers/",
    "blueprints/",
    "handlers/",
    "middleware/",
    "templates/",
    "static/"
]

# Patterns to exclude from watching
exclude_patterns = [
    "__pycache__/",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    ".git/",
    ".pytest_cache/",
    "tests/",
    "migrations/__pycache__/",
    "media/",
    "staticfiles/",
    "logs/",
    "instance/",
    ".flask_session/"
]

# Delay before reloading (in seconds)
reload_delay = 0.25

# Environment variables for development
[tool.hot-reload.env_vars]
PYTHONPATH = "."
PYTHONUNBUFFERED = "1"
DEVELOPMENT = "1"

# Framework-specific configurations
[tool.hot-reload.fastapi]
command = ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
reload_delay = 0.25

[tool.hot-reload.django]
command = ["python", "manage.py", "runserver", "0.0.0.0:8000"]
reload_delay = 0.5
env_vars = {DJANGO_SETTINGS_MODULE = "config.settings.development"}

[tool.hot-reload.flask]
command = ["flask", "run", "--host=0.0.0.0", "--port=5000", "--debug"]
reload_delay = 0.3
env_vars = {FLASK_ENV = "development", FLASK_DEBUG = "1"}

[tool.hot-reload.tornado]
command = ["python", "app/main.py", "--port=8888", "--debug", "--autoreload"]
reload_delay = 0.2

[tool.hot-reload.sanic]
command = ["sanic", "app.main:app", "--host=0.0.0.0", "--port=8000", "--debug", "--auto-reload"]
reload_delay = 0.15

# Auto-install missing dependencies
auto_install = true

# Enable verbose output
verbose = false

# Advanced settings
[tool.hot-reload.advanced]
# Maximum number of reload attempts before giving up
max_reload_attempts = 5

# Cooldown period between reloads (prevents reload storms)
reload_cooldown = 1.0

# Enable process monitoring and automatic restart
process_monitoring = true

# Enable file change batching (group multiple changes)
batch_changes = true

# Batch timeout (wait for more changes before reloading)
batch_timeout = 0.1
`;
  }
}

export const pythonHotReloadGenerator = new PythonHotReloadGenerator();