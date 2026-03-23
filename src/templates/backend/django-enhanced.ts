import { BackendTemplate } from '../types';

export const djangoEnhancedTemplate: BackendTemplate = {
  id: 'django-enhanced',
  name: 'django-enhanced',
  displayName: 'Django Enhanced',
  description: 'Django with enhanced ORM management commands and migration utilities',
  version: '1.0.0',
  tags: ['django', 'python', 'database', 'management', 'commands', 'migrations'],
  framework: 'django',
  language: 'python',
  dependencies: {
    'Django': '>=4.2.0,<5.0',
    'django-extensions': '^3.2.3',
    'djangorestframework': '^3.14.0',
    'django-filter': '^23.2',
    'python-decouple': '^3.8',
    'psycopg2-binary': '^2.9.7',
    'redis': '^4.6.0',
    'celery': '^5.3.1',
    'flower': '^2.0.1',
    'gunicorn': '^21.2.0',
    'whitenoise': '^6.5.0'},
  devDependencies: {
    'pytest': '^7.4.0',
    'pytest-django': '^4.5.2',
    'pytest-cov': '^4.1.0',
    'factory-boy': '^3.3.0',
    'black': '^23.7.0',
    'isort': '^5.12.0',
    'flake8': '^6.0.0',
    'mypy': '^1.5.0',
    'django-debug-toolbar': '^4.1.0',
    'django-silk': '^5.0.3'},
  features: ['authentication', 'authorization', 'database', 'caching', 'testing', 'documentation'],
  postInstall: [
    'python manage.py makemigrations',
    'python manage.py migrate',
    'python manage.py collectstatic --noinput',
    'python manage.py shell -c "from django.contrib.auth.models import User; User.objects.create_superuser(\'admin\', \'admin@example.com\', \'admin\') if not User.objects.filter(username=\'admin\').exists() else None"'
  ],
  files: {
    // Django ORM Enhancement Manager
    '{{projectName}}/management/__init__.py': '',
    '{{projectName}}/management/commands/__init__.py': '',

    // Requirements file
    'requirements.txt': `Django>=4.2.0,<5.0
django-extensions>=3.2.3
djangorestframework>=3.14.0
django-filter>=23.2
python-decouple>=3.8
psycopg2-binary>=2.9.7
redis>=4.6.0
celery>=5.3.1
flower>=2.0.1
gunicorn>=21.2.0
whitenoise>=6.5.0
pytest>=7.4.0
pytest-django>=4.5.2
pytest-cov>=4.1.0
factory-boy>=3.3.0
black>=23.7.0
isort>=5.12.0
flake8>=6.0.0
mypy>=1.5.0
django-debug-toolbar>=4.1.0
django-silk>=5.0.3`,

    // Create Data Migration Command
    '{{projectName}}/management/commands/create_data_migration.py': `"""
Custom management command to create data migration with template.
"""
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.apps import apps
import os


class Command(BaseCommand):
    help = 'Create a data migration with enhanced template'

    def add_arguments(self, parser):
        parser.add_argument('app_label', type=str, help='App label for the migration')
        parser.add_argument('migration_name', type=str, help='Name of the migration')
        parser.add_argument(
            '--model',
            type=str,
            help='Model name to include in migration template'
        )
        parser.add_argument(
            '--operation',
            choices=['create', 'update', 'delete', 'custom'],
            default='custom',
            help='Type of data operation'
        )

    def handle(self, *args, **options):
        app_label = options['app_label']
        migration_name = options['migration_name']
        model_name = options.get('model', '')
        operation = options['operation']

        # Validate app exists
        try:
            apps.get_app_config(app_label)
        except LookupError:
            raise CommandError(f'App "{app_label}" not found')

        # Create empty migration
        call_command('makemigrations', app_label, '--empty', '--name', migration_name)

        self.stdout.write(
            self.style.SUCCESS(
                f'Created data migration for {app_label}\\n'
                f'Operation type: {operation}\\n'
                f'Remember to implement the forward and reverse operations!'
            )
        )
`,

    // Enhanced Settings
    '{{projectName}}/settings/__init__.py': '',
    
    '{{projectName}}/settings/base.py': `"""
Base Django settings for {{projectName}} project.
"""
import os
from pathlib import Path
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='your-secret-key-here')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

# Application definition
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles']

THIRD_PARTY_APPS = [
    'rest_framework',
    'django_filters',
    'django_extensions']

LOCAL_APPS = [
    '{{projectName}}']

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware']

ROOT_URLCONF = '{{projectName}}.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages']}}]

WSGI_APPLICATION = '{{projectName}}.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=BASE_DIR / 'db.sqlite3'),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
        'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=60, cast=int),
        'CONN_HEALTH_CHECKS': True}
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter']}

# Celery Configuration
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://127.0.0.1:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient'}
    }
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'static']

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
`,

    '{{projectName}}/settings/development.py': `"""
Development settings for {{projectName}} project.
"""
from .base import *

# Debug settings
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# Development apps
INSTALLED_APPS += [
    'debug_toolbar',
    'django_silk']

# Development middleware
MIDDLEWARE = [
    'debug_toolbar.middleware.DebugToolbarMiddleware',
    'silk.middleware.SilkyMiddleware'] + MIDDLEWARE

# Debug toolbar configuration
INTERNAL_IPS = [
    '127.0.0.1',
    'localhost']

# Development email backend
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
`,

    '{{projectName}}/settings/production.py': `"""
Production settings for {{projectName}} project.
"""
from .base import *

# Security settings
DEBUG = False
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True, cast=bool)
SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=True, cast=bool)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# Session security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Strict'

# Static files optimization
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
`,

    // Docker configuration
    'Dockerfile': `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "{{projectName}}.wsgi:application"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=True
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/{{projectName}}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB={{projectName}}
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  celery:
    build: .
    command: celery -A {{projectName}} worker -l info
    environment:
      - DEBUG=True
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/{{projectName}}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app

volumes:
  postgres_data:
  redis_data:
`,

    '.env.example': `# Django Configuration
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DB_ENGINE=django.db.backends.postgresql
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379/1

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Email Configuration (Production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
`,

    'README.md': `# {{projectName}}

Django Enhanced project with comprehensive ORM management commands and enterprise features.

## Features

- 🐍 Django 4.2+ with enhanced ORM management
- 🔧 Custom management commands for data migrations
- 🗄️ PostgreSQL with optimized settings
- 🚀 Redis caching and session management
- ⚡ Celery background task processing
- 🧪 Comprehensive testing setup
- 🐳 Docker containerization
- 🔒 Production-ready security settings

## Quick Start

### Local Development

\`\`\`bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
\`\`\`

### Docker Development

\`\`\`bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec web python manage.py migrate

# Create superuser
docker-compose exec web python manage.py createsuperuser
\`\`\`

## Custom Management Commands

### Create Data Migration
\`\`\`bash
python manage.py create_data_migration app_name migration_name --model ModelName --operation create
\`\`\`

## Project Structure

\`\`\`
{{projectName}}/
├── {{projectName}}/
│   ├── management/
│   │   └── commands/
│   │       └── create_data_migration.py
│   └── settings/
│       ├── __init__.py
│       ├── base.py
│       ├── development.py
│       └── production.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
\`\`\`

## Environment Settings

- **Development**: Use \`{{projectName}}.settings.development\`
- **Production**: Use \`{{projectName}}.settings.production\`

## Testing

\`\`\`bash
pytest
\`\`\`

## Deployment

1. Set production environment variables
2. Run migrations: \`python manage.py migrate\`
3. Collect static files: \`python manage.py collectstatic\`
4. Start with Gunicorn: \`gunicorn {{projectName}}.wsgi:application\`

Generated with [Re-Shell CLI](https://github.com/your-repo/re-shell)
`
  }
};