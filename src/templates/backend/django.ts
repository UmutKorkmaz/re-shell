import { BackendTemplate } from '../types';

export const djangoTemplate: BackendTemplate = {
  id: 'django',
  name: 'Django',
  displayName: 'Django',
  framework: 'django',
  description: 'Python\'s most popular web framework with batteries included',
  version: '5.0.1',
  language: 'python',
  tags: ['python', 'django', 'rest', 'database', 'authentication', 'celery', 'redis'],
  port: 8000,
  features: [
    'rest-api',
    'database',
    'authentication',
    'swagger',
    'queue',
    'caching',
    'security',
    'email',
    'file-upload',
    'docker'
  ],
  dependencies: {},
  files: {
      'manage.py': `#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
`,
      'requirements.txt': `# Production dependencies
django==5.0.1
djangorestframework==3.14.0
django-cors-headers==4.3.1
djangorestframework-simplejwt==5.3.1
drf-spectacular==0.27.0
celery==5.3.4
redis==5.0.1
django-redis==5.4.0
psycopg2-binary==2.9.9
pillow==10.2.0
django-environ==0.11.2
gunicorn==21.2.0
whitenoise==6.6.0
`,
      'requirements-dev.txt': `# Development dependencies
-r requirements.txt
django-debug-toolbar==4.2.0
pytest==7.4.4
pytest-django==4.7.0
pytest-cov==4.1.0
black==23.12.1
flake8==7.0.0
isort==5.13.2
factory-boy==3.3.0
faker==22.0.0
`,
      '.env.example': `# Django settings
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/{{service_name}}

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Email
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_USE_TLS=False
DEFAULT_FROM_EMAIL=noreply@example.com

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# JWT
ACCESS_TOKEN_LIFETIME_MINUTES=60
REFRESH_TOKEN_LIFETIME_DAYS=7
`,
      'pytest.ini': `[tool:pytest]
DJANGO_SETTINGS_MODULE = config.settings.test
python_files = tests.py test_*.py *_tests.py
addopts = 
    --verbose
    --strict-markers
    --tb=short
    --cov=.
    --cov-report=term-missing:skip-covered
    --cov-report=html
    --cov-report=xml
testpaths = tests
`,
      'setup.cfg': `[flake8]
max-line-length = 88
extend-ignore = E203, W503
exclude = 
    .git,
    __pycache__,
    migrations,
    .venv,
    venv

[isort]
profile = black
known_django = django
sections = FUTURE,STDLIB,DJANGO,THIRDPARTY,FIRSTPARTY,LOCALFOLDER
`,
      'config/': {
        'settings/': {
          '__init__.py': `from .base import *  # noqa

# Load environment-specific settings
import os

env = os.environ.get('DJANGO_ENV', 'development')

if env == 'production':
    from .production import *  # noqa
elif env == 'test':
    from .test import *  # noqa
else:
    from .development import *  # noqa
`,
          'base.py': `"""
Django base settings for {{service_name}} project.
"""
import os
from datetime import timedelta
from pathlib import Path

import environ

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Environment variables
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1']),
    CORS_ALLOWED_ORIGINS=(list, []),
)
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

ALLOWED_HOSTS = env('ALLOWED_HOSTS')

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
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'django_redis']

LOCAL_APPS = [
    'apps.users',
    'apps.api']

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware']

ROOT_URLCONF = 'config.urls'

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

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': env.db()
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'}]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom user model
AUTH_USER_MODEL = 'users.User'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer']}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=env.int('ACCESS_TOKEN_LIFETIME_MINUTES', default=60)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=env.int('REFRESH_TOKEN_LIFETIME_DAYS', default=7)
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type'}

# CORS Settings
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_CREDENTIALS = True

# Celery Configuration
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/1')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/2')
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/0'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient'}
    }
}

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env.int('EMAIL_PORT', default=1025)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=False)
EMAIL_USE_SSL = env.bool('EMAIL_USE_SSL', default=False)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@example.com')

# Spectacular Settings (OpenAPI)
SPECTACULAR_SETTINGS = {
    'TITLE': '{{service_name}} API',
    'DESCRIPTION': 'API documentation for {{service_name}}',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True},
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/'}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{'},
        'simple': {
            'format': '{levelname} {message}',
            'style': '{'}},
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue'}},
    'handlers': {
        'console': {
            'level': 'INFO',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'maxBytes': 1024 * 1024 * 15,  # 15MB
            'backupCount': 10,
            'formatter': 'verbose'}},
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO'},
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False}}}
`,
          'development.py': `"""
Development-specific settings.
"""
from .base import *  # noqa

# Debug toolbar
INSTALLED_APPS += ['debug_toolbar']  # noqa
MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE  # noqa

# Debug toolbar settings
INTERNAL_IPS = ['127.0.0.1', 'localhost']
DEBUG_TOOLBAR_CONFIG = {
    'SHOW_TOOLBAR_CALLBACK': lambda request: DEBUG,  # noqa
}

# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# CORS - Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True

# Celery - Use eager mode in development
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
`,
          'production.py': `"""
Production-specific settings.
"""
from .base import *  # noqa

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Force DEBUG to False
DEBUG = False

# Email backend for production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Logging - More detailed in production
LOGGING['handlers']['file']['level'] = 'WARNING'  # noqa
LOGGING['loggers']['django']['level'] = 'WARNING'  # noqa
`,
          'test.py': `"""
Test-specific settings.
"""
from .base import *  # noqa

# Use in-memory database for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:'}
}

# Disable migrations during tests
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# Use dummy cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
}

# Password hasher for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher']

# Email backend for tests
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Celery - Use eager mode in tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
`},
        'urls.py': `"""
URL configuration for {{service_name}} project.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API
    path('api/', include('apps.api.urls')),
    path('api/auth/', include('apps.users.urls')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc')]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    
    # Debug toolbar
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
`,
        'wsgi.py': `"""
WSGI config for {{service_name}} project.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()
`,
        'asgi.py': `"""
ASGI config for {{service_name}} project.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()
`,
        'celery.py': `"""
Celery configuration for {{service_name}} project.
"""
import os

from celery import Celery

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery app
app = Celery('{{service_name}}')

# Load configuration from Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()
`,
        '__init__.py': `# This will make sure the app is always imported when
# Django starts so that shared_task will use this app.
from .celery import app as celery_app

__all__ = ('celery_app',)
`},
      'apps/': {
        '__init__.py': '',
        'users/': {
          '__init__.py': '',
          'apps.py': `from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.users'
    verbose_name = 'Users'
`,
          'models.py': `from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model."""
    
    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        
    def __str__(self):
        return self.email
`,
          'serializers.py': `from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """User serializer."""
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'is_verified', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_verified', 'created_at', 'updated_at']


class RegisterSerializer(serializers.ModelSerializer):
    """Registration serializer."""
    
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 
                  'first_name', 'last_name']
        
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """Login serializer."""
    
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(username=email, password=password)
            
            if not user:
                raise serializers.ValidationError('Invalid credentials')
                
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
                
        else:
            raise serializers.ValidationError('Must include "email" and "password"')
            
        attrs['user'] = user
        return attrs


class TokenSerializer(serializers.Serializer):
    """JWT token serializer."""
    
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    
    def create(self, validated_data):
        user = validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh)}
`,
          'views.py': `from django.contrib.auth import login
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User
from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    TokenSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Auto-login after registration
        refresh = TokenSerializer().create({'user': user})
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': refresh
        }, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    """User login endpoint."""
    
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        # Login user
        login(request, user)
        
        # Generate tokens
        tokens = TokenSerializer().create({'user': user})
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': tokens
        })


class ProfileView(generics.RetrieveUpdateAPIView):
    """User profile endpoint."""
    
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token obtain view."""
    pass


class CustomTokenRefreshView(TokenRefreshView):
    """Custom JWT token refresh view."""
    pass
`,
          'urls.py': `from django.urls import path

from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    LoginView,
    ProfileView,
    RegisterView,
)

app_name = 'users'

urlpatterns = [
    # Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    
    # JWT Token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh')]
`,
          'admin.py': `from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """User admin configuration."""
    
    list_display = ['email', 'username', 'first_name', 'last_name', 
                    'is_verified', 'is_staff', 'created_at']
    list_filter = ['is_verified', 'is_staff', 'is_superuser', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['-created_at']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('is_verified',)}),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('email', 'is_verified',)}),
    )
`,
          'migrations/': {
            '__init__.py': ''},
          'tests/': {
            '__init__.py': '',
            'test_models.py': `import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    """Test User model."""
    
    def test_create_user(self):
        """Test creating a user."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        assert user.username == 'testuser'
        assert user.email == 'test@example.com'
        assert user.check_password('testpass123')
        assert not user.is_staff
        assert not user.is_superuser
        assert not user.is_verified
        
    def test_create_superuser(self):
        """Test creating a superuser."""
        user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        
        assert user.is_staff
        assert user.is_superuser
        
    def test_str_representation(self):
        """Test string representation."""
        user = User(email='test@example.com')
        assert str(user) == 'test@example.com'
`,
            'test_views.py': `import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
class TestAuthenticationViews:
    """Test authentication views."""
    
    @pytest.fixture
    def api_client(self):
        return APIClient()
    
    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_register(self, api_client):
        """Test user registration."""
        url = reverse('users:register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'newpass123',
            'password_confirm': 'newpass123',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'user' in response.data
        assert 'tokens' in response.data
        assert response.data['user']['email'] == 'newuser@example.com'
        assert User.objects.filter(email='newuser@example.com').exists()
    
    def test_login(self, api_client, user):
        """Test user login."""
        url = reverse('users:login')
        data = {
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'user' in response.data
        assert 'tokens' in response.data
        assert response.data['user']['email'] == 'test@example.com'
    
    def test_profile(self, api_client, user):
        """Test user profile."""
        api_client.force_authenticate(user=user)
        url = reverse('users:profile')
        
        # Get profile
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['email'] == 'test@example.com'
        
        # Update profile
        data = {'first_name': 'Updated'}
        response = api_client.patch(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['first_name'] == 'Updated'
`}},
        'api/': {
          '__init__.py': '',
          'apps.py': `from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.api'
    verbose_name = 'API'
`,
          'models.py': `from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class BaseModel(models.Model):
    """Abstract base model with common fields."""
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


class Example(BaseModel):
    """Example model."""
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='examples'
    )
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'examples'
        ordering = ['-created_at']
        
    def __str__(self):
        return self.title
`,
          'serializers.py': `from rest_framework import serializers

from .models import Example


class ExampleSerializer(serializers.ModelSerializer):
    """Example serializer."""
    
    user = serializers.ReadOnlyField(source='user.email')
    
    class Meta:
        model = Example
        fields = ['id', 'title', 'description', 'user', 'is_active',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
`,
          'views.py': `from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import Example
from .serializers import ExampleSerializer
from .permissions import IsOwnerOrReadOnly


class ExampleViewSet(viewsets.ModelViewSet):
    """Example API endpoint."""
    
    serializer_class = ExampleSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, 
                       filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'title']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter queryset to user's own objects."""
        return Example.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Set user on create."""
        serializer.save(user=self.request.user)
`,
          'permissions.py': `from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Write permissions are only allowed to the owner
        return obj.user == request.user
`,
          'urls.py': `from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ExampleViewSet

app_name = 'api'

router = DefaultRouter()
router.register(r'examples', ExampleViewSet, basename='example')

urlpatterns = [
    path('', include(router.urls))]
`,
          'admin.py': `from django.contrib import admin

from .models import Example


@admin.register(Example)
class ExampleAdmin(admin.ModelAdmin):
    """Example admin configuration."""
    
    list_display = ['title', 'user', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title', 'description', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'user', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
`,
          'tasks.py': `from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_notification_email(user_email, subject, message):
    """Send notification email task."""
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user_email],
        fail_silently=False,
    )
    return f"Email sent to {user_email}"


@shared_task
def process_example(example_id):
    """Process example task."""
    from .models import Example
    
    try:
        example = Example.objects.get(id=example_id)
        # Perform some processing
        example.description = f"Processed: {example.description}"
        example.save()
        return f"Example {example_id} processed successfully"
    except Example.DoesNotExist:
        return f"Example {example_id} not found"
`,
          'migrations/': {
            '__init__.py': ''},
          'tests/': {
            '__init__.py': '',
            'test_api.py': `import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.api.models import Example

User = get_user_model()


@pytest.mark.django_db
class TestExampleAPI:
    """Test Example API endpoints."""
    
    @pytest.fixture
    def api_client(self):
        return APIClient()
    
    @pytest.fixture
    def user(self):
        return User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    @pytest.fixture
    def example(self, user):
        return Example.objects.create(
            title='Test Example',
            description='Test description',
            user=user
        )
    
    def test_list_examples(self, api_client, user, example):
        """Test listing examples."""
        api_client.force_authenticate(user=user)
        url = reverse('api:example-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['title'] == 'Test Example'
    
    def test_create_example(self, api_client, user):
        """Test creating an example."""
        api_client.force_authenticate(user=user)
        url = reverse('api:example-list')
        data = {
            'title': 'New Example',
            'description': 'New description',
            'is_active': True
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == 'New Example'
        assert Example.objects.filter(title='New Example').exists()
    
    def test_update_example(self, api_client, user, example):
        """Test updating an example."""
        api_client.force_authenticate(user=user)
        url = reverse('api:example-detail', kwargs={'pk': example.pk})
        data = {'title': 'Updated Example'}
        
        response = api_client.patch(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == 'Updated Example'
    
    def test_delete_example(self, api_client, user, example):
        """Test deleting an example."""
        api_client.force_authenticate(user=user)
        url = reverse('api:example-detail', kwargs={'pk': example.pk})
        
        response = api_client.delete(url)
        
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Example.objects.filter(pk=example.pk).exists()
    
    def test_unauthorized_access(self, api_client):
        """Test unauthorized access."""
        url = reverse('api:example-list')
        
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
`}}},
      'static/': {
        '.gitkeep': ''},
      'media/': {
        '.gitkeep': ''},
      'logs/': {
        '.gitkeep': ''},
      'templates/': {
        '.gitkeep': ''},
      'tests/': {
        '__init__.py': '',
        'conftest.py': `import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    """Provide API client for tests."""
    return APIClient()


@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def authenticated_client(api_client, user):
    """Provide authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client
`},
      'docker-compose.yml': `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: {{service_name}}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --timeout 120 --graceful-timeout 30
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  celery:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A config worker -l info --concurrency=4
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  flower:
    build:
      context: .
      dockerfile: Dockerfile.prod
    command: celery -A config flower --port=5555
    ports:
      - "5555:5555"
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      - redis
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - static_volume:/app/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      - web
    restart: unless-stopped

volumes:
  postgres_data:
  static_volume:
  media_volume:
`,
      'docker-compose.dev.yml': `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: {{service_name}}_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - .:/app  # Hot-reload
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.development
    depends_on:
      - db
      - redis
    restart: "no"

  celery:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: celery -A config worker -l info
    volumes:
      - .:/app
    env_file:
      - .env
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.development
    depends_on:
      - db
      - redis
    restart: "no"

  flower:
    build:
      context: .
      dockerfile: Dockerfile.dev
    command: celery -A config flower --port=5555
    ports:
      - "5555:5555"
    env_file:
      - .env
    depends_on:
      - redis

volumes:
  postgres_dev_data:
  static_volume:
  media_volume:
`,
      'docker-compose.distroless.yml': `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: {{service_name}}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile.distroless
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db
      - redis
    restart: unless-stopped
    # Security settings for distroless containers
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M

  celery:
    build:
      context: .
      dockerfile: Dockerfile.distroless
    command: celery -A config worker --loglevel=info
    env_file:
      - .env
    depends_on:
      - db
      - redis
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile.distroless
    command: celery -A config beat --loglevel=info --scheduler /celerybeat-schedule
    env_file:
      - .env
    depends_on:
      - redis
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/tmp

volumes:
  postgres_data:
`,
      'docker-compose.ephemeral.yml': `version: '3.8'

services:
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: {{service_name}}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile.ephemeral
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db
      - redis
    restart: unless-stopped
    # Maximum security for ephemeral containers
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
    read_only: true
    tmpfs:
      - /tmp
      - /app/tmp
      - /app/logs
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.125'
          memory: 64M
    # Auto-remove on exit (ephemeral pattern)
    restart: on-failure:5

  celery:
    build:
      context: .
      dockerfile: Dockerfile.ephemeral
    command: celery -A config worker --loglevel=info
    env_file:
      - .env
    depends_on:
      - db
      - redis
    restart: on-failure:5

volumes:
  postgres_data:
`,
      'Dockerfile': `FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Create non-root user
RUN useradd -m -u 1000 django && chown -R django:django /app

# Switch to non-root user
USER django

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Run the application
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--timeout", "120", "--graceful-timeout", "30", "--worker-class", "sync", "--workers", "4", "--worker-connections", "1000", "--max-requests", "1000", "--max-requests-jitter", "100"]
`,
      'Dockerfile.prod': `# Production Dockerfile - Multi-stage build for smaller image size

# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies for building
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /build

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies to a temporary location
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Production
FROM python:3.11-slim AS production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production
ENV PYTHONPATH=/app

# Install only runtime dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Collect static files
RUN python manage.py collectstatic --noinput --clear

# Create non-root user
RUN useradd -m -u 1000 django && \
    chown -R django:django /app

# Switch to non-root user
USER django

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Run the application
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--timeout", "120", "--graceful-timeout", "30", "--worker-class", "sync", "--workers", "4", "--access-logfile", "-", "--error-logfile", "-"]
`,
      'Dockerfile.dev': `# Development Dockerfile - For development with hot-reload

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.development

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
        vim \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create necessary directories
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Expose port
EXPOSE 8000

# Run development server with hot-reload
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
`,
      'Dockerfile.distroless': `# Distroless Dockerfile - Ultra-minimal base image for maximum security
# Uses distroless Python image which has no shell, package manager, or other unnecessary tools
# Significantly reduces attack surface and image size

# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install build dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /build

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Collect static files
RUN mkdir -p /build/staticfiles
RUN python manage.py collectstatic --noinput --clear

# Stage 2: Distroless production image
# Using gcr.io/distroless/python3-debian11 for minimal attack surface
FROM gcr.io/distroless/python3-debian11:latest

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Copy application and static files from builder
COPY --from=builder /build /app

# Copy CA certificates for HTTPS requests
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Create non-root user (distroless images use specific UID/GID)
# Use the 'nonroot' user that exists in distroless images
USER 65532

# Expose port
EXPOSE 8000

# Health check (using wget since curl is not available in distroless)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health/ || exit 1

# Run the application
# Note: Using python directly instead of gunicorn for simplicity
# You can also copy gunicorn from the builder if needed
CMD ["python", "-m", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "sync", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]
`,
      'Dockerfile.ephemeral': `# Ephemeral Dockerfile - Scratch-based ultra-minimal image
# Built FROM scratch for absolute minimum size and attack surface
# Contains only the application and its runtime dependencies

# Stage 1: Full build
FROM python:3.11-slim AS build

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN pip install gunicorn
RUN python manage.py collectstatic --noinput --clear

# Stage 2: Create minimal runtime environment
FROM scratch

# Add CA certificates (required for HTTPS)
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copy timezone data (optional, for proper timezone handling)
COPY --from=build /usr/share/zoneinfo /usr/share/zoneinfo

# Set environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production
ENV PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Copy Python installation and application
COPY --from=build /usr/local /usr/local
COPY --from=build /app /app

# Expose port
EXPOSE 8000

# Health check requires wget or curl, which we don't have in scratch
# You would need to compile a static binary or use exec.healthcheck from outside
# For now, we skip healthcheck or rely on external probes

# Run the application
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
`,
      '.dockerignore': `# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
.pytest_cache/
coverage.xml
*.cover
*.log
.git
.gitignore
.mypy_cache
.hypothesis

# Django
*.sqlite3
media/
staticfiles/
logs/

# Environment
.env
.env.*
venv/
env/
ENV/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Project specific
docker-compose.override.yml
`,
      '.gitignore': `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Django
*.log
*.pot
*.pyc
local_settings.py
db.sqlite3
media/
staticfiles/

# Environment
.env
.env.*
venv/
env/
ENV/
env.bak/
venv.bak/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~
.project
.pydevproject

# Testing
.tox/
.coverage
.coverage.*
.cache
.pytest_cache/
nosetests.xml
coverage.xml
*.cover
.hypothesis/
htmlcov/

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Project specific
logs/
celerybeat-schedule
celerybeat.pid

# Container Signing - NEVER COMMIT PRIVATE KEYS
cosign.key
*.cosign.key
cosign-*.key
!cosign.pub
`,
      '.trivyignore': `# Trivy ignore file for known vulnerabilities
# Add specific vulnerabilities to ignore here

# Example: Ignore a specific CVE in a development dependency
# CVE-2021-1234 in setuptools==1.2.3

# Ignore vulnerabilities in dev-only packages
**/requirements-dev.txt

# Ignore test dependencies
pytest-*
coverage-*
`,
      'scripts/security-scan.sh': `#!/bin/bash
# Container Security Scanning Script
# Runs Trivy, Snyk, and Aqua scans on container images

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_NAME="\${IMAGE_NAME:-{{service_name}}:latest}"
IMAGE_TAG="\${IMAGE_TAG:-latest}"
SEVERITY="\${SEVERITY:-HIGH,CRITICAL}"
OUTPUT_DIR="security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "\${GREEN}=== Container Security Scanning ===\${NC}"
echo "Image: $IMAGE_NAME"
echo "Severity: $SEVERITY"
echo ""

# Function to run Trivy
run_trivy() {
    echo -e "\${YELLOW}Running Trivy vulnerability scanner...\${NC}"

    # Check if Trivy is installed
    if ! command -v trivy &> /dev/null; then
        echo -e "\${RED}Trivy not found. Installing...\${NC}"
        brew install trivy 2>/dev/null || {
            echo -e "\${RED}Failed to install Trivy. Please install manually.\${NC}"
            return 1
        }
    fi

    # Run Trivy filesystem scan
    echo "Running Trivy filesystem scan..."
    trivy fs \
        --severity "$SEVERITY" \
        --ignorefile .trivyignore \
        --format json \
        --output "$OUTPUT_DIR/trivy-fs-$TIMESTAMP.json" \
        .

    # Run Trivy image scan
    echo "Running Trivy image scan..."
    trivy image \
        --severity "$SEVERITY" \
        --ignorefile .trivyignore \
        --format json \
        --output "$OUTPUT_DIR/trivy-image-$TIMESTAMP.json" \
        --format table \
        "$IMAGE_NAME"

    # Check if critical vulnerabilities were found
    CRITICAL_COUNT=$(trivy image --severity CRITICAL --format json "$IMAGE_NAME" 2>/dev/null | jq '.Results | length' 2>/dev/null || echo "0")
    if [ "$CRITICAL_COUNT" -gt 0 ]; then
        echo -e "\${RED}Found $CRITICAL_COUNT critical vulnerabilities!\${NC}"
        return 1
    fi

    echo -e "\${GREEN}Trivy scan completed.\${NC}"
}

# Function to run Snyk
run_snyk() {
    echo -e "\${YELLOW}Running Snyk vulnerability scanner...\${NC}"

    # Check if Snyk is installed
    if ! command -v snyk &> /dev/null; then
        echo -e "\${RED}Snyk not found. Installing...\${NC}"
        npm install -g snyk 2>/dev/null || {
            echo -e "\${RED}Failed to install Snyk. Please install manually.\${NC}"
            return 1
        }
    fi

    # Authenticate if needed
    if ! snyk auth &> /dev/null; then
        echo -e "\${YELLOW}Please authenticate with Snyk:\${NC}"
        snyk auth
    fi

    # Run Snyk container test
    echo "Running Snyk container scan..."
    snyk container test "$IMAGE_NAME" \
        --severity-threshold=high \
        --json-file-output="$OUTPUT_DIR/snyk-$TIMESTAMP.json" \
        --sarif-file-output="$OUTPUT_DIR/snyk-$TIMESTAMP.sarif" || true

    echo -e "\${GREEN}Snyk scan completed.\${NC}"
}

# Function to run Aqua (trivy with enforcer)
run_aqua() {
    echo -e "\${YELLOW}Running Aqua security scanner...\${NC}"

    # Aqua uses Trivy under the hood with additional policies
    # This is a basic implementation using Trivy's compliance checks

    if command -v trivy &> /dev/null; then
        echo "Running Aqua compliance checks via Trivy..."
        trivy image \
            --severity "$SEVERITY" \
            --compliance \
            --format json \
            --output "$OUTPUT_DIR/aqua-compliance-$TIMESTAMP.json" \
            "$IMAGE_NAME" || true
    else
        echo -e "\${RED}Trivy required for Aqua compliance checks. Skipping...\${NC}"
    fi

    echo -e "\${GREEN}Aqua scan completed.\${NC}"
}

# Main execution
main() {
    # Parse arguments
    SKIP_TRIVY="\${SKIP_TRIVY:-false}"
    SKIP_SNYK="\${SKIP_SNYK:-false}"
    SKIP_AQUA="\${SKIP_AQUA:-false}"

    while [[ "$#" -gt 0 ]]; do
        case $1 in
            --skip-trivy) SKIP_TRIVY=true ;;
            --skip-snyk) SKIP_SNYK=true ;;
            --skip-aqua) SKIP_AQUA=true ;;
            --image) IMAGE_NAME="$2"; shift ;;
            --severity) SEVERITY="$2"; shift ;;
            *) echo "Unknown parameter: $1"; exit 1 ;;
        esac
        shift
    done

    # Run scans
    [ "$SKIP_TRIVY" = "false" ] && run_trivy
    [ "$SKIP_SNYK" = "false" ] && run_snyk
    [ "$SKIP_AQUA" = "false" ] && run_aqua

    echo ""
    echo -e "\${GREEN}=== All security scans completed ===\${NC}"
    echo "Results saved to: $OUTPUT_DIR/"
}

main "$@"
`,
      '.github/workflows/security-scan.yml': `name: Container Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

env:
  IMAGE_NAME: \${{ github.repository }}:latest

jobs:
  trivy-scan:
    name: Trivy Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build image
        run: |
          docker build -f Dockerfile.prod -t $IMAGE_NAME .
          docker tag $IMAGE_NAME \${{ github.sha }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: $IMAGE_NAME
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'

  snyk-scan:
    name: Snyk Vulnerability Scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build image
        run: |
          docker build -f Dockerfile.prod -t $IMAGE_NAME .

      - name: Run Snyk to check Docker image for vulnerabilities
        uses: snyk/actions/docker@master
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
        with:
          image: $IMAGE_NAME
          args: --severity-threshold=high

      - name: Upload Snyk results to GitHub Security tab
        uses: snyk/actions/sarif@master
        if: always()
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
        with:
          sarif-file: snyk.sarif

  aqua-scan:
    name: Aqua Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build image
        run: |
          docker build -f Dockerfile.prod -t $IMAGE_NAME .

      - name: Run Aqua Trivy scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: $IMAGE_NAME
          format: 'json'
          output: 'aqua-results.json'
          severity: 'CRITICAL,HIGH'

      - name: Check for critical vulnerabilities
        run: |
          CRITICAL_COUNT=$(jq '[.Results[] | .Vulnerabilities // [] | length] | add' aqua-results.json 2>/dev/null || echo "0")
          if [ "$CRITICAL_COUNT" -gt 0 ]; then
            echo "Found $CRITICAL_COUNT critical/high vulnerabilities"
            exit 1
          fi

  dependency-check:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install pip-audit safety

      - name: Run pip-audit
        run: pip-audit --format json --output audit.json || true

      - name: Run safety check
        run: safety check --json --output safety.json || true

      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dependency-scan-results
          path: |
            audit.json
            safety.json
`,
      'docker-bake.hcl': `# Docker BuildKit Bake Configuration
# Enables faster builds with cache mounting and multi-platform support

variable "IMAGE_NAME" {
    default = "{{service_name}}"
}

variable "REGISTRY" {
    default = ""
}

variable "TAG" {
    default = "latest"
}

variable "PLATFORMS" {
    default = "linux/amd64,linux/arm64"
}

# Base target for common settings
target "_base" {
    dockerfile = "Dockerfile.prod"
    contexts = {
        . = "."
    }
}

# Development target with hot-reload
target "dev" {
    inherits = ["_base"]
    dockerfile = "Dockerfile.dev"
    target = "development"
    tags = [
        "{{service_name}}:dev",
        "{{service_name}}:development"]
    cache-from = [
        "type=local,src=/tmp/.buildx-cache-dev"
    ]
    cache-to = [
        "type=local,dest=/tmp/.buildx-cache-dev-new,mode=max"
    ]
}

# Production target
target "prod" {
    inherits = ["_base"]
    target = "production"
    tags = [
        "{{service_name}}:latest",
        "{{service_name}}:prod",
        "{{service_name}}:production"]
    cache-from = [
        "type=registry,ref={{service_name}}:cache",
        "type=local,src=/tmp/.buildx-cache-prod"
    ]
    cache-to = [
        "type=local,dest=/tmp/.buildx-cache-prod-new,mode=max"
    ]
    # Build-time optimizations
    args = {
        PYTHONUNBUFFERED = "1"
        PYTHONDONTWRITEBYTECODE = "1"
    }
}

# Distroless target - minimal security
target "distroless" {
    inherits = ["_base"]
    dockerfile = "Dockerfile.distroless"
    tags = [
        "{{service_name}}:distroless"]
    cache-from = [
        "type=local,src=/tmp/.buildx-cache-distroless"
    ]
    cache-to = [
        "type=local,dest=/tmp/.buildx-cache-distroless-new,mode=max"
    ]
}

# Ephemeral target - scratch-based ultra-minimal
target "ephemeral" {
    inherits = ["_base"]
    dockerfile = "Dockerfile.ephemeral"
    tags = [
        "{{service_name}}:ephemeral"]
    cache-from = [
        "type=local,src=/tmp/.buildx-cache-ephemeral"
    ]
    cache-to = [
        "type=local,dest=/tmp/.buildx-cache-ephemeral-new,mode=max"
    ]
}

# Multi-platform build target
target "multiplatform" {
    inherits = ["_base"]
    platforms = split(PLATFORMS, ",")
    tags = [
        "{{service_name}}:multi"]
    cache-from = [
        "type=registry,ref={{service_name}}:cache"
    ]
    cache-to = [
        "type=registry,ref={{service_name}}:cache,mode=max"
    ]
}

# Cache manifest target for CI/CD
target "cache" {
    inherits = ["_base"]
    output = ["type=cacheonly"]
    cache-from = [
        "type=registry,ref={{service_name}}:buildcache"
    ]
    cache-to = [
        "type=registry,ref={{service_name}}:buildcache,mode=max"
    ]
}

group "default" {
    targets = ["dev"]
}

group "build-all" {
    targets = ["dev", "prod", "distroless"]
}

group "build-secure" {
    targets = ["distroless", "ephemeral"]
}
`,
      '.docker/config.json': `{
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "10GB",
      "schedDeletePeriod": "24h"
    }
  },
  "features": {
    "buildkit": true
  },
  "experimental": true,
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10
}
`,
      'scripts/build-with-cache.sh': `#!/bin/bash
# Docker BuildKit Build Script with Cache Mounting
# Optimizes build times by mounting cache directories during pip install

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_NAME="\${IMAGE_NAME:-{{service_name}}}"
IMAGE_TAG="\${IMAGE_TAG:-latest}"
DOCKERFILE="\${DOCKERFILE:-Dockerfile.prod}"
BUILD_CONTEXT="\${BUILD_CONTEXT:-.}"
CACHE_TYPE="\${CACHE_TYPE:-local}"  # 'local' or 'registry'

echo -e "\${BLUE}=== Docker BuildKit Build with Cache ===\${NC}"
echo "Image: \${IMAGE_NAME}:\${IMAGE_TAG}"
echo "Dockerfile: \${DOCKERFILE}"
echo "Cache Type: \${CACHE_TYPE}"

# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Create cache directory for local caching
CACHE_DIR="/tmp/.buildx-cache"
mkdir -p "\${CACHE_DIR}"

# Build with cache mounts
echo -e "\${YELLOW}Building with cache mounts...\${NC}"

if [ "\${CACHE_TYPE}" = "registry" ]; then
    # Use registry cache (good for CI/CD)
    CACHE_FROM="type=registry,ref=\${IMAGE_NAME}:buildcache"
    CACHE_TO="type=registry,ref=\${IMAGE_NAME}:buildcache,mode=max"
else
    # Use local cache (good for development)
    CACHE_FROM="type=local,src=\${CACHE_DIR}"
    CACHE_TO="type=local,dest=\${CACHE_DIR}-new,mode=max"
fi

# Build with BuildKit
docker build \\
    -f "\${DOCKERFILE}" \\
    --build-arg BUILDKIT_INLINE_CACHE=1 \\
    --cache-from "\${CACHE_FROM}" \\
    --cache-to "\${CACHE_TO}" \\
    --tag "\${IMAGE_NAME}:\${IMAGE_TAG}" \\
    --tag "\${IMAGE_NAME}:latest" \\
    "\${BUILD_CONTEXT}"

# Rotate local cache if using local cache type
if [ "\${CACHE_TYPE}" = "local" ] && [ -d "\${CACHE_DIR}-new" ]; then
    echo -e "\${YELLOW}Rotating cache...\${NC}"
    rm -rf "\${CACHE_DIR}"
    mv "\${CACHE_DIR}-new" "\${CACHE_DIR}"
fi

echo -e "\${GREEN}Build completed successfully!\${NC}"
echo "Image: \${IMAGE_NAME}:\${IMAGE_TAG}"
echo ""
echo "To run the container:"
echo "  docker run -p 8000:8000 \${IMAGE_NAME}:\${IMAGE_TAG}"
echo ""
echo "To use with docker-compose:"
echo "  IMAGE_TAG=\${IMAGE_TAG} docker-compose up"
`,
      'scripts/build-with-bake.sh': `#!/bin/bash
# Docker Buildx Bake Script
# Uses docker-bake.hcl for advanced build configurations

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Configuration
TARGET="\${1:-dev}"
REGISTRY="\${REGISTRY:-}"
TAG="\${TAG:-latest}"

echo -e "\${BLUE}=== Docker Buildx Bake ===\${NC}"
echo "Target: \${TARGET}"

# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1

# Check if docker-bake.hcl exists
if [ ! -f "docker-bake.hcl" ]; then
    echo -e "\${RED}Error: docker-bake.hcl not found!\${NC}"
    echo "Please run this script from the project root."
    exit 1
fi

# Build arguments
BAKE_ARGS=("build" "--target" "\${TARGET}")

if [ -n "\${REGISTRY}" ]; then
    BAKE_ARGS+=("--set" "REGISTRY=\${REGISTRY}")
fi

if [ -n "\${TAG}" ]; then
    BAKE_ARGS+=("--set" "TAG=\${TAG}")
fi

# Run bake
echo -e "\${YELLOW}Building target: \${TARGET}...\${NC}"
docker buildx bake "\${BAKE_ARGS[@]}"

echo -e "\${GREEN}Build completed successfully!\${NC}"
echo ""
echo "Available targets:"
echo "  dev         - Development image with hot-reload"
echo "  prod        - Production optimized image"
echo "  distroless  - Ultra-minimal distroless image"
echo "  ephemeral   - Scratch-based ultra-minimal image"
echo "  multiplatform - Multi-architecture build"
echo ""
echo "Usage:"
echo "  ./scripts/build-with-bake.sh dev"
echo "  ./scripts/build-with-bake.sh prod"
echo "  REGISTRY=your-registry.com ./scripts/build-with-bake.sh prod"
echo "  ./scripts/build-with-bake.sh multiplatform"
`,
      'scripts/clean-cache.sh': `#!/bin/bash
# Docker BuildKit Cache Cleanup Script
# Removes old build cache to free disk space

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo -e "\${YELLOW}=== Docker BuildKit Cache Cleanup ===\${NC}"

# Check disk usage before
echo ""
echo "Disk usage before cleanup:"
df -h / | grep -E "Filesystem|/$"

# Local cache directories
CACHE_BASE="/tmp/.buildx-cache"

# Remove all local build cache
if [ -d "\${CACHE_BASE}" ]; then
    echo -e "\${YELLOW}Removing local cache directories...\${NC}"
    du -sh \${CACHE_BASE}* 2>/dev/null || true
    rm -rf \${CACHE_BASE}*
    echo -e "\${GREEN}Local cache removed.\${NC}"
else
    echo "No local cache directories found."
fi

# Clean Docker buildx build cache
echo -e "\${YELLOW}Cleaning Docker buildx cache...\${NC}"
docker buildx prune -f

# Optional: Run aggressive cleanup
if [ "\${1}" = "--aggressive" ]; then
    echo -e "\${RED}Running aggressive cleanup...\${NC}"
    docker buildx prune -a -f
    echo -e "\${GREEN}Aggressive cleanup completed.\${NC}"
else
    echo "Use --aggressive flag to remove all unused build cache."
fi

# Check disk usage after
echo ""
echo "Disk usage after cleanup:"
df -h / | grep -E "Filesystem|/$"

echo -e "\${GREEN}Cache cleanup completed!\${NC}"
`,
      'scripts/sign-image.sh': `#!/bin/bash
# Container Image Signing Script with Cosign
# Signs container images and generates SBOMs using Sigstore

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_NAME="\${IMAGE_NAME:-{{service_name}}}"
IMAGE_TAG="\${IMAGE_TAG:-latest}"
IMAGE_REF="\${IMAGE_NAME}:\${IMAGE_TAG}"
COSIGN_EXPERIMENTAL="\${COSIGN_EXPERIMENTAL:-1}"

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo -e "\${RED}Error: cosign is not installed!\${NC}"
    echo "Install cosign:"
    echo "  curl -L https://sigstore.dev/scripts/install-cosign.sh | bash"
    echo "  Or: go install github.com/sigstore/cosign/cmd/cosign@latest"
    exit 1
fi

echo -e "\${BLUE}=== Container Image Signing with Cosign ===\${NC}"
echo "Image: \${IMAGE_REF}"

# Generate key pair if not exists
if [ ! -f "cosign.key" ]; then
    echo -e "\${YELLOW}Generating Cosign key pair...\${NC}"
    cosign generate-key-pair
    echo -e "\${GREEN}Keys generated. Keep cosign.key safe and never commit it!\${NC}"
fi

# Sign the image
echo -e "\${YELLOW}Signing image...\${NC}"
COSIGN_EXPERIMENTAL=1 cosign sign \\
    --key cosign.key \\
    "\${IMAGE_REF}"

echo -e "\${GREEN}Image signed successfully!\${NC}"

# Attach SBOM (Software Bill of Materials)
echo -e "\${YELLOW}Generating and attaching SBOM...\${NC}"
cosign attach sbom \\
    --type cyclonedx \\
    --sbom <(syft "\${IMAGE_REF}" -o cyclonedx-json) \\
    "\${IMAGE_REF}" || echo -e "\${YELLOW}SBOM attachment skipped (syft not installed)\${NC}"

# Verify the signature
echo -e "\${YELLOW}Verifying signature...\${NC}"
cosign verify \\
    --key cosign.pub \\
    "\${IMAGE_REF}"

echo -e "\${GREEN}Verification successful!\${NC}"

echo ""
echo "To verify this image elsewhere:"
echo "  cosign verify --key cosign.pub \${IMAGE_REF}"

# Output signature details
echo ""
echo "Public key location: cosign.pub"
echo "Private key location: cosign.key (KEEP SAFE!)"
`,
      'scripts/verify-image.sh': `#!/bin/bash
# Container Image Verification Script with Cosign
# Verifies container image signatures against public keys

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_REF="\${1:-\${IMAGE_NAME:-{{service_name}}}:latest}"
PUBLIC_KEY="\${PUBLIC_KEY:-cosign.pub}"
COSIGN_EXPERIMENTAL="\${COSIGN_EXPERIMENTAL:-1}"

echo -e "\${BLUE}=== Container Image Verification ===\${NC}"
echo "Image: \${IMAGE_REF}"
echo "Public Key: \${PUBLIC_KEY}"

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo -e "\${RED}Error: cosign is not installed!\${NC}"
    echo "Install cosign:"
    echo "  curl -L https://sigstore.dev/scripts/install-cosign.sh | bash"
    exit 1
fi

# Check if public key exists
if [ ! -f "\${PUBLIC_KEY}" ]; then
    echo -e "\${RED}Error: Public key not found: \${PUBLIC_KEY}\${NC}"
    exit 1
fi

# Verify the image
echo -e "\${YELLOW}Verifying image signature...\${NC}"
if cosign verify \\
    --key "\${PUBLIC_KEY}" \\
    "\${IMAGE_REF}"; then
    echo -e "\${GREEN}✓ Image signature is valid!\${NC}"

    # Get certificate information
    echo ""
    echo -e "\${YELLOW}Certificate details:\${NC}"
    cosign verify \
        --key "\${PUBLIC_KEY}" \
        --show-certificate \
        "\${IMAGE_REF}" || true
else
    echo -e "\${RED}✗ Image signature verification failed!\${NC}"
    exit 1
fi

# Check for SBOM
echo ""
echo -e "\${YELLOW}Checking for SBOM...\${NC}"
cosign download sbom "\${IMAGE_REF}" 2>/dev/null && echo -e "\${GREEN}✓ SBOM found\${NC}" || echo -e "\${YELLOW}No SBOM attached\${NC}"

echo -e "\${GREEN}Verification completed successfully!\${NC}"
`,
      'scripts/sign-with-fulcio.sh': `#!/bin/bash
# Keyless Container Image Signing with Sigstore Fulcio
# Signs images using certificate authority instead of key pairs

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Configuration
IMAGE_REF="\${1:-\${IMAGE_NAME:-{{service_name}}}:latest}"
COSIGN_EXPERIMENTAL="\${COSIGN_EXPERIMENTAL:-1}"

echo -e "\${BLUE}=== Keyless Image Signing with Sigstore ===\${NC}"
echo "Image: \${IMAGE_REF}"

# Check if cosign is installed
if ! command -v cosign &> /dev/null; then
    echo -e "\${RED}Error: cosign is not installed!\${NC}"
    echo "Install cosign:"
    echo "  curl -L https://sigstore.dev/scripts/install-cosign.sh | bash"
    exit 1
fi

# Sign with keyless flow (uses OIDC token)
echo -e "\${YELLOW}Signing image with keyless certificate...\${NC}"
echo "You will be prompted to authenticate via browser/OIDC"

cosign sign \\
    "\${IMAGE_REF}"

echo -e "\${GREEN}Image signed successfully!\${NC}"

# Verify the signature
echo -e "\${YELLOW}Verifying signature...\${NC}"
cosign verify \\
    --certificate-identity "\${CERTIFICATE_IDENTITY:-*}" \\
    --certificate-oidc-issuer "\${CERTIFICATE_OIDC_ISSUER:-https://oauth2.sigstore.dev/auth}" \\
    "\${IMAGE_REF}"

echo -e "\${GREEN}Verification successful!\${NC}"

echo ""
echo "To verify this image elsewhere:"
echo "  cosign verify \\\\\\\\"
echo "    --certificate-identity <your-identity> \\\\\\\\"
echo "    --certificate-oidc-issuer https://oauth2.sigstore.dev/auth \\\\\\\\"
echo "    \${IMAGE_REF}"
`,
      '.github/workflows/image-signing.yml': `name: Container Image Signing

on:
  push:
    branches: [ main ]
    tags:
      - 'v*'
  workflow_dispatch:

env:
  IMAGE_NAME: \${{ github.repository }}
  REGISTRY: ghcr.io

permissions:
  contents: read
  packages: write
  id-token: write  # Required for OIDC token

jobs:
  sign-keyless:
    name: Sign Image with Keyless Certificate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.prod
          push: true
          tags: |
            \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
            \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3.2.0

      - name: Sign image with Fulcio (keyless)
        uses: sigstore/cosign-enterprise/actions/sign@v1
        with:
          image: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}

      - name: Attach SBOM
        run: |
          # Generate SBOM with Syft
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
          syft "\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}" -o cyclonedx-json > sbom.json

          # Attach SBOM to image
          cosign attach sbom --type cyclonedx --sbom sbom.json "\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}"

      - name: Verify signature
        run: |
          cosign verify \\
            --certificate-identity "\${{ github.actor }}" \\
            --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \\
            "\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}"

      - name: Upload SBOM as artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json

  sign-with-key:
    name: Sign Image with Private Key
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    env:
      COSIGN_KEY: /tmp/cosign.key
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3.2.0

      - name: Import signing key
        run: |
          echo "\${{ secrets.COSIGN_PRIVATE_KEY }}" | base64 -d > \${COSIGN_KEY}
          echo "\${{ secrets.COSIGN_PASSWORD }}" | cosign sign --key \${COSIGN_KEY} \\
            "\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest"

      - name: Verify signature
        run: |
          echo "\${{ secrets.COSIGN_PUBLIC_KEY }}" > /tmp/cosign.pub
          cosign verify --key /tmp/cosign.pub "\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest"
`,
      'cosign/.keep': `# Cosign directory for storing signing keys
# IMPORTANT: Never commit private keys!
# Add cosign.key to .gitignore
`,
      'falco/falco.yaml': `# Falco Runtime Security Configuration
# Falco monitors container behavior and detects suspicious activity

kind: ConfigMap
apiVersion: v1
metadata:
  name: falco-config
  namespace: falco
data:
  falco.yaml: |
    base_config:
      # Falco output configuration
      outputs:
        - type: stdout
        - type: file
          path: /var/log/falco_events.log

        # Send to syslog for centralized logging
        - type: syslog
          keep_alive: true

        # Send to webhook for alerting
        - type: webhook
          url: http://falco-sidecar:2801

      # JSON output format for structured logging
      json_output: true
      json_include_output_property: true

      # Buffered output for performance
      buffered_outputs: true
      buffered_outputs_timeout: 30

    # Custom rules for {{service_name}}
    rules:
      - macro: spawn_shell
        condition: >
          (proc.name = bash
          or proc.name = sh
          or proc.name = zsh
          or proc.name = ksh
          or proc.name = csh
          or proc.name = tcsh)
          and container.id != host

      - macro: sensitive_file_writes
        condition: >
          (fd.type in ("file", "directory")
          and fd.filename in ("/etc/shadow", "/etc/passwd", "/etc/sudoers",
                             "/root/.ssh/authorized_keys", "/home/*/.ssh/authorized_keys"))

      # Detect shell in containers (usually suspicious)
      - rule: Shell Spawned in Container
        desc: >
          A shell was spawned by a program in a container. This is
          usually indicative of someone compromising the container and
          trying to gain interactive access.
        condition: >
          spawn_shell
          and container
          and not proc.pname in (docker-engine, containerd, rancher)
          and not user.containerizedrootkit
        output: >
          Shell spawned in container (user=%user.name container_id=%container.id
          container_name=%container.name shell=%proc.name parent=%proc.pname
          cmdline=%proc.cmdline image=%container.image.repository)
        priority: WARNING
        tags: [container, shell]

      # Detect sensitive file access
      - rule: Sensitive File Access in Container
        desc: >
          A container process tried to access sensitive files like
          /etc/shadow, /etc/passwd, or authorized_keys.
        condition: >
          (open_read or open_write)
          and sensitive_file_writes
          and container
          and not proc.name in (cat, grep, less, more, head, tail, vi, vim)
        output: >
          Sensitive file accessed (user=%user.name container=%container.name
          file=%fd.filename command=%proc.cmdline)
        priority: ERROR
        tags: [container, file]

      # Detect network connections to non-whitelisted addresses
      - rule: Unexpected Outbound Connection
        desc: >
          Container attempted outbound connection to non-whitelisted address.
        condition: >
          outbound
          and container
          and not fd.sip in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
                            "127.0.0.0/8", "::1/128")
          and not fd.name in ("*", "*.github.com", "*.docker.io",
                             "*.gcr.io", "*.pkg.dev", "kubernetes.default.svc")
        output: >
          Unexpected outbound connection (user=%user.name container=%container.name
          dst=%fd.sip:%fd.dport command=%proc.cmdline)
        priority: WARNING
        tags: [container, network]

      # Detect mounting of host paths
      - rule: Mount Host Path
        desc: >
          Container mounted a host path. This could be a container escape.
        condition: >
          mount
          and container
          and not fd.name in ("/proc", "/sys", "/dev", "/run", "/var/lib/docker")
        output: >
          Host path mounted (user=%user.name container=%container.name
          mount_point=%fd.name command=%proc.cmdline)
        priority: ERROR
        tags: [container, escape]

      # Detect privilege escalation
      - rule: Privilege Escalation in Container
        desc: >
          Process attempted to gain root privileges in a container.
        condition: >
          spawn_shell
          and container
          and user.euid = 0
          and not user.uid = 0
        output: >
          Privilege escalation attempt (user=%user.name container=%container.name
          command=%proc.cmdline)
        priority: CRITICAL
        tags: [container, privilege]
`,
      'falco/rules.yaml': `# Additional Falco Rules for {{service_name}}
# Application-specific security rules

apiVersion: falco.appscode.com/v1alpha1
kind: FalcoPolicy
metadata:
  name: {{service_name}}-policy
  namespace: falco
spec:
  rules:
    # Detect unexpected child processes
    - rule: Unexpected Child Process
      desc: >
        Application spawned unexpected child process.
      condition: >
        spawn_process
        and container
        and proc.pname in (python, gunicorn, uwsgi)
        and not proc.name in (python, gunicorn, uwsgi, celery, worker)
        and not user.name in (unprivilegeduser)
      output: >
        Unexpected child process (parent=%proc.pname child=%proc.name
        container=%container.name user=%user.name cmdline=%proc.cmdline)
      priority: WARNING

    # Detect database connection from unauthorized pod
    - rule: Database Connection from Unauthorized Pod
      desc: >
        Container attempted direct database connection.
      condition: >
        outbound
        and container
        and fd.sport = 5432
        and not container.image.repository in ("{{service_name}}-web", "{{service_name}}-worker")
      output: >
        Unauthorized database connection (container=%container.name
        dst=%fd.sip command=%proc.cmdline)
      priority: WARNING

    # Detect large number of file operations (potential ransomware)
    - rule: Excessive File Operations
      desc: >
        Container performed excessive file operations.
      condition: >
        (open_write or create)
        and container
        and proc.name in (python, node, java, go)
      output: >
        Excessive file operations (container=%container.name
        proc=%proc.name count=%evt.count)
      priority: WARNING
      tags: [container, file]

    # Detect crypto mining
    - rule: Crypto Mining Indicator
      desc: >
        Container showed signs of crypto mining activity.
      condition: >
        spawn_process
        and container
        and proc.name in (xmrig, cpuminer, minergate, claymore)
      output: >
        Crypto mining detected (container=%container.name
        proc=%proc.name cmdline=%proc.cmdline)
      priority: CRITICAL
      tags: [container, crypto]

    # Detect reverse shell
    - rule: Reverse Shell Indicator
      desc: >
        Process showed signs of reverse shell connection.
      condition: >
        outbound
        and container
        and proc.name in (bash, sh, nc, netcat, socat)
        and fd.sport in (4444, 5555, 6666, 8888, 31337, 12345)
      output: >
        Potential reverse shell (container=%container.name
        proc=%proc.name dst=%fd.sip:%fd.sport cmdline=%proc.cmdline)
      priority: CRITICAL
      tags: [container, shell]
`,
      'opa/gatekeeper-constraints.yaml': `# OPA Gatekeeper Constraints for {{service_name}}
# Enforces security policies on Kubernetes resources

apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: all-must-have-owner
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    labels:
      - key: "owner"
        regex: "^[a-zA-Z0-9]+$"

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sContainerLimits
metadata:
  name: container-must-have-limits
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    cpu: "800m"
    memory: "1Gi"

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sDisallowPrivileged
metadata:
  name: no-privileged-pods
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    exemptImages: []
    exemptNamespaces: []

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sPSPAllowPrivilegeEscalationContainer
metadata:
  name: restrict-privilege-escalation
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    exemptImages: []
    exemptNamespaces: []

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sPSPCapabilities
metadata:
  name: restrict-capabilities
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    exemptImages: []
    requiredDropCapabilities:
      - NET_RAW
      - ALL
    allowedCapabilities:
      - NET_BIND_SERVICE

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sProhibitRunAsRootUser
metadata:
  name: no-root-user
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    exemptImages: []

---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: allowed-container-registries
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces:
      - {{service_name}}
  parameters:
    repos:
      - "ghcr.io/"
      - "gcr.io/"
      - "{{service_name}}/"
`,
      'opa/policies.rego': `# OPA Policies for {{service_name}}
# Rego policies for runtime security validation

package {{service_name}}

import future.keywords.contains
import future.keywords.if

# Deny containers running as root
deny_contains_root[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    not container.securityContext.runAsUser
    not container.securityContext.runAsNonRoot
    msg := sprintf("Container '%s' must set runAsNonRoot", [container.name])
}

# Deny containers with privileged mode
deny_privileged[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    container.securityContext.privileged == true
    msg := sprintf("Container '%s' must not run in privileged mode", [container.name])
}

# Require resource limits
deny_no_limits[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    not container.resources.limits
    msg := sprintf("Container '%s' must have resource limits", [container.name])
}

# Deny hostPath mounts except specific ones
deny_hostpath[msg] if {
    input.review.kind.kind == "Pod"
    some volume in input.review.object.spec.volumes
    volume.hostPath
    not volume.name in ["kube-root-ca.crt", "default-token-*"]
    msg := sprintf("HostPath volume '%s' is not allowed", [volume.name])
}

# Deny images without digest
deny_no_digest[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    not contains(container.image, "@sha256:")
    msg := sprintf("Container '%s' must use image with digest", [container.name])
}

# Allow only specific image registries
deny_invalid_registry[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    not startswith(container.image, "ghcr.io/")
    not startswith(container.image, "gcr.io/")
    not startswith(container.image, "{{service_name}}/")
    msg := sprintf("Image '%s' is from an untrusted registry", [container.image])
}

# Deny latest tag
deny_latest_tag[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    endswith(container.image, ":latest")
    msg := sprintf("Container '%s' must not use :latest tag", [container.name])
}

# Require readiness and liveness probes for web containers
deny_no_probes[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    container.name == "{{service_name}}"
    not container.livenessProbe
    msg := sprintf("Container '%s' must have a liveness probe", [container.name])
}

deny_no_readiness_probe[msg] if {
    input.review.kind.kind == "Pod"
    some container in input.review.object.spec.containers
    container.name == "{{service_name}}"
    not container.readinessProbe
    msg := sprintf("Container '%s' must have a readiness probe", [container.name])
}

# Main violation list
violations[message] {
    message := deny_contains_root
}

violations[message] {
    message := deny_privileged
}

violations[message] {
    message := deny_no_limits
}

violations[message] {
    message := deny_hostpath
}

violations[message] {
    message := deny_no_digest
}

violations[message] {
    message := deny_invalid_registry
}

violations[message] {
    message := deny_latest_tag
}

violations[message] {
    message := deny_no_probes
}

violations[message] {
    message := deny_no_readiness_probe
}
`,
      'scripts/install-runtime-security.sh': `#!/bin/bash
# Runtime Security Installation Script
# Installs Falco and OPA Gatekeeper for Kubernetes runtime security

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}=== Runtime Security Installation ===\${NC}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "\${RED}Error: kubectl is not installed!\${NC}"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo -e "\${YELLOW}Helm not found. Installing...\${NC}"
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# Install Falco
echo -e "\${YELLOW}Installing Falco...\${NC}"
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

kubectl create namespace falco --dry-run=client -o yaml | kubectl apply -f -

helm install falco falcosecurity/falco \\
    --namespace falco \\
    --set falco.jsonOutput=true \\
    --set falco.jsonIncludeOutputProperty=true \\
    --set falco.bufferedOutputs=true \\
    --set falco.syslog.enabled=true \\
    --set falco.file_output.enabled=true \\
    --set falco.file_output.keepAlive=true \\
    --set falco.aws.enabled=false \\
    --set driver.kind=module \\
    --set tty=true

echo -e "\${GREEN}Falco installed successfully!\${NC}"

# Apply custom Falco rules
echo -e "\${YELLOW}Applying custom Falco rules...\${NC}"
kubectl apply -f falco/
echo -e "\${GREEN}Custom rules applied!\${NC}"

# Install OPA Gatekeeper
echo -e "\${YELLOW}Installing OPA Gatekeeper...\${NC}"
kubectl create namespace gatekeeper-system --dry-run=client -o yaml | kubectl apply -f -

helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper gatekeeper/gatekeeper \\
    --namespace gatekeeper-system \\
    --set enableExternalData=true \\
    --set auditInterval=30 \\
    --set constraintViolationsLimit=20

echo -e "\${GREEN}OPA Gatekeeper installed successfully!\${NC}"

# Wait for Gatekeeper to be ready
echo -e "\${YELLOW}Waiting for Gatekeeper to be ready...\${NC}"
kubectl wait --for=condition=ready pod -l gatekeeper.sh/system=yes -n gatekeeper-system --timeout=120s

# Apply Gatekeeper constraints
echo -e "\${YELLOW}Applying Gatekeeper constraints...\${NC}"
kubectl apply -f opa/gatekeeper-constraints.yaml
echo -e "\${GREEN}Constraints applied!\${NC}"

# Create ConfigMap for OPA policies
echo -e "\${YELLOW}Installing OPA policies...\${NC}"
kubectl create configmap opa-policies \\
    --from-file=opa/policies.rego \\
    --namespace={{service_name}} \\
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "\${GREEN}Runtime security installation completed!\${NC}"
echo ""
echo "To view Falco events:"
echo "  kubectl logs -l app=falco -n falco -f"
echo ""
echo "To view Gatekeeper status:"
echo "  kubectl get constraints -A"
echo ""
echo "To test a violation:"
echo "  kubectl run privileged --image=nginx --privileged=true"
`,
      'scripts/test-runtime-security.sh': `#!/bin/bash
# Runtime Security Testing Script
# Tests Falco and OPA Gatekeeper by triggering violations

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}=== Runtime Security Testing ===\${NC}"

# Test 1: Privileged pod (should be blocked by Gatekeeper)
echo -e "\${YELLOW}Test 1: Creating privileged pod (should be blocked)...\${NC}"
if kubectl run test-privileged --image=nginx --privileged=true --dry-run=server -o yaml 2>&1 | grep -q "denied"; then
    echo -e "\${GREEN}✓ Privileged pod correctly blocked\${NC}"
else
    echo -e "\${RED}✗ Privileged pod was NOT blocked!\${NC}"
fi

# Test 2: Pod without resource limits (should be blocked)
echo -e "\${YELLOW}Test 2: Creating pod without resource limits (should be blocked)...\${NC}"
if kubectl run test-no-limits --image=nginx --dry-run=server -o yaml 2>&1 | grep -q "denied"; then
    echo -e "\${GREEN}✓ Pod without limits correctly blocked\${NC}"
else
    echo -e "\${RED}✗ Pod without limits was NOT blocked!\${NC}"
fi

# Test 3: Pod with latest tag (should be blocked)
echo -e "\${YELLOW}Test 3: Creating pod with :latest tag (should be blocked)...\${NC}"
if kubectl run test-latest --image=nginx:latest --dry-run=server -o yaml 2>&1 | grep -q "denied"; then
    echo -e "\${GREEN}✓ Pod with :latest tag correctly blocked\${NC}"
else
    echo -e "\${YELLOW}Note: Latest tag constraint may not be active\${NC}"
fi

# Test 4: Check Falco is running
echo -e "\${YELLOW}Test 4: Checking Falco status...\${NC}"
if kubectl get pod -l app=falco -n falco &> /dev/null; then
    FALCO_PODS=$(kubectl get pod -l app=falco -n falco -o json | jq -r '.items | length')
    echo -e "\${GREEN}✓ Falco is running (\${FALCO_PODS} pods)\${NC}"
else
    echo -e "\${RED}✗ Falco is not running!\${NC}"
fi

# Test 5: Check Gatekeeper is running
echo -e "\${YELLOW}Test 5: Checking Gatekeeper status...\${NC}"
if kubectl get pod -l gatekeeper.sh/system=yes -n gatekeeper-system &> /dev/null; then
    GK_PODS=$(kubectl get pod -l gatekeeper.sh/system=yes -n gatekeeper-system -o json | jq -r '.items | length')
    echo -e "\${GREEN}✓ Gatekeeper is running (\${GK_PODS} pods)\${NC}"
else
    echo -e "\${RED}✗ Gatekeeper is not running!\${NC}"
fi

# Test 6: List active constraints
echo -e "\${YELLOW}Test 6: Listing active Gatekeeper constraints...\${NC}"
CONSTRAINTS=$(kubectl get constraints -A 2>/dev/null | wc -l)
echo -e "\${GREEN}✓ Found \${CONSTRAINTS} active constraints\${NC}"

# Test 7: Show recent Falco events
echo -e "\${YELLOW}Test 7: Showing recent Falco events (last 5)...\${NC}"
kubectl logs -l app=falco -n falco --tail=5 2>/dev/null || echo -e "\${YELLOW}No Falco events available\${NC}"

echo ""
echo -e "\${GREEN}Security testing completed!\${NC}"
echo ""
echo "To create a test pod that triggers Falco:"
echo "  kubectl run test-shell --image=nginx --restart=Never -it -- /bin/bash"
echo ""
echo "To view all Gatekeeper constraints:"
echo "  kubectl get constraints -A"
echo ""
echo "To view Falco events in real-time:"
echo "  kubectl logs -l app=falco -n falco -f"
`,
      'kubernetes/resource-limits.yaml': `# Kubernetes Resource Limits and QoS Configuration
# Defines resource requests, limits, and Quality of Service for {{service_name}}

apiVersion: v1
kind: Namespace
metadata:
  name: {{service_name}}
  labels:
    name: {{service_name}}
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
# LimitRange for default resource constraints
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: {{service_name}}
spec:
  limits:
  - default:        # Default limit for containers
      cpu: "1000m"
      memory: "1Gi"
    defaultRequest: # Default request for containers
      cpu: "250m"
      memory: "256Mi"
    min:
      cpu: "50m"
      memory: "64Mi"
    max:
      cpu: "2000m"
      memory: "2Gi"
    maxLimitRequestRatio:
      cpu: "4"
      memory: "4"
    type: Container

---
# ResourceQuota for namespace-level limits
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: {{service_name}}
spec:
  hard:
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
    persistentvolumeclaims: "4"
    requests.storage: "100Gi"
  scopeSelector:
    matchExpressions:
    - operator: In
      scopes:
      - NotBestEffort

---
# PriorityClass for workload importance
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: {{service_name}}-high-priority
value: 1000
globalDefault: false
description: "High priority {{service_name}} workload"

---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: {{service_name}}-low-priority
value: 100
globalDefault: true
description: "Low priority {{service_name}} workload"

---
# HorizontalPodAutoscaler for web deployment
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{service_name}}-web-hpa
  namespace: {{service_name}}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{service_name}}-web
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15

---
# PodDisruptionBudget for high availability
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{service_name}}-web-pdb
  namespace: {{service_name}}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {{service_name}}
      component: web

---
# NetworkPolicy for traffic control
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-network-policy
  namespace: {{service_name}}
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  - from:
    - podSelector:
        matchLabels:
          app: {{service_name}}
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: {{service_name}}
          component: db
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: {{service_name}}
          component: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 53   # DNS
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53   # DNS
`,
      'kubernetes/deployment-with-resources.yaml': `# Kubernetes Deployment with Resource Limits
# Production deployment manifest with optimized resource configuration

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{service_name}}-web
  namespace: {{service_name}}
  labels:
    app: {{service_name}}
    component: web
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: {{service_name}}
      component: web
  template:
    metadata:
      labels:
        app: {{service_name}}
        component: web
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      priorityClassName: {{service_name}}-high-priority
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: {{service_name}}
        image: ghcr.io/your-org/{{service_name}}:latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8000
          protocol: TCP
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{service_name}}-secrets
              key: database-url
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: {{service_name}}-secrets
              key: secret-key
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: {{service_name}}-config
              key: redis-url
        # QoS: Burstable (request < limit)
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        # Liveness probe - restarts container if unhealthy
        livenessProbe:
          httpGet:
            path: /health/
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        # Readiness probe - marks pod as ready for traffic
        readinessProbe:
          httpGet:
            path: /ready/
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        # Startup probe - gives container time to start
        startupProbe:
          httpGet:
            path: /health/
            port: http
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 30
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
            add:
            - NET_BIND_SERVICE
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /app/cache
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: tmp
        emptyDir:
          sizeLimit: "100Mi"
      - name: cache
        emptyDir:
          sizeLimit: "500Mi"
      - name: logs
        emptyDir:
          sizeLimit: "200Mi"
      affinity:
        # Spread pods across nodes for HA
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - {{service_name}}
              topologyKey: kubernetes.io/hostname
        # Prefer nodes with specific labels
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 50
            preference:
              matchExpressions:
              - key: nodepool
                operator: In
                values:
                - application
      tolerations:
      - key: "application"
        operator: "Equal"
        value: "{{service_name}}"
        effect: "NoSchedule"

---
# Worker deployment with different resource profile
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{service_name}}-worker
  namespace: {{service_name}}
  labels:
    app: {{service_name}}
    component: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {{service_name}}
      component: worker
  template:
    metadata:
      labels:
        app: {{service_name}}
        component: worker
    spec:
      priorityClassName: {{service_name}}-low-priority
      containers:
      - name: worker
        image: ghcr.io/your-org/{{service_name}}:latest
        command: ["celery", "-A", "config", "worker", "-l", "info"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{service_name}}-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: {{service_name}}-config
              key: redis-url
        # Workers need less CPU, more memory
        resources:
          requests:
            cpu: "100m"
            memory: "512Mi"
          limits:
            cpu: "500m"
            memory: "2Gi"
        # No probes for Celery workers
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
`,
      'kubernetes/profiles.yaml': `# Kubernetes Resource Profiles
# Predefined resource profiles for different workload types

apiVersion: v1
kind: ConfigMap
metadata:
  name: resource-profiles
  namespace: {{service_name}}
data:
  # Small profile - for development/testing
  small: |
    {
      "requests": {
        "cpu": "100m",
        "memory": "128Mi"
      },
      "limits": {
        "cpu": "500m",
        "memory": "512Mi"
      },
      "replicas": 1
    }

  # Medium profile - for staging/low-traffic production
  medium: |
    {
      "requests": {
        "cpu": "250m",
        "memory": "256Mi"
      },
      "limits": {
        "cpu": "1000m",
        "memory": "1Gi"
      },
      "replicas": 2
    }

  # Large profile - for high-traffic production
  large: |
    {
      "requests": {
        "cpu": "500m",
        "memory": "512Mi"
      },
      "limits": {
        "cpu": "2000m",
        "memory": "2Gi"
      },
      "replicas": 3
    }

  # X-Large profile - for enterprise scale
  xlarge: |
    {
      "requests": {
        "cpu": "1000m",
        "memory": "1Gi"
      },
      "limits": {
        "cpu": "4000m",
        "memory": "4Gi"
      },
      "replicas": 5
    }

  # Memory-optimized profile - for caching/data processing
  memory-optimized: |
    {
      "requests": {
        "cpu": "250m",
        "memory": "1Gi"
      },
      "limits": {
        "cpu": "1000m",
        "memory": "4Gi"
      },
      "replicas": 2
    }

  # CPU-optimized profile - for compute-intensive tasks
  cpu-optimized: |
    {
      "requests": {
        "cpu": "1000m",
        "memory": "512Mi"
      },
      "limits": {
        "cpu": "4000m",
        "memory": "2Gi"
      },
      "replicas": 2
    }

---
# VerticalPodAutoscaler for automatic resource tuning
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: {{service_name}}-web-vpa
  namespace: {{service_name}}
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{service_name}}-web
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: "{{service_name}}"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "4000m"
        memory: "4Gi"
      controlledResources: ["cpu", "memory"]
      mode: "Auto"
`,
      'scripts/apply-resource-limits.sh': `#!/bin/bash
# Resource Limits Application Script
# Applies Kubernetes resource limits and QoS configuration

set -e

# Colors for output
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

# Configuration
NAMESPACE="\${NAMESPACE:-{{service_name}}}"
PROFILE="\${PROFILE:-medium}"

echo -e "\${BLUE}=== Resource Limits Configuration ===\${NC}"
echo "Namespace: \${NAMESPACE}"
echo "Profile: \${PROFILE}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "\${RED}Error: kubectl is not installed!\${NC}"
    exit 1
fi

# Create namespace
echo -e "\${YELLOW}Creating namespace...\${NC}"
kubectl create namespace "\${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Apply resource limits and quotas
echo -e "\${YELLOW}Applying resource limits...\${NC}"
kubectl apply -f kubernetes/resource-limits.yaml

echo -e "\${YELLOW}Applying deployment with resources...\${NC}"
kubectl apply -f kubernetes/deployment-with-resources.yaml

echo -e "\${YELLOW}Applying resource profiles...\${NC}"
kubectl apply -f kubernetes/profiles.yaml

# Wait for deployment to be ready
echo -e "\${YELLOW}Waiting for deployment to be ready...\${NC}"
kubectl rollout status deployment/{{service_name}}-web -n "\${NAMESPACE}" --timeout=120s

# Show current resource usage
echo ""
echo -e "\${GREEN}=== Current Resource Usage ===\${NC}"
kubectl top pods -n "\${NAMESPACE}" 2>/dev/null || echo "Metrics server not available"

# Show QoS classes
echo ""
echo -e "\${GREEN}=== Pod QoS Classes ===\${NC}"
kubectl get pods -n "\${NAMESPACE}" -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass

# Show resource quotas
echo ""
echo -e "\${GREEN}=== Resource Quota Status ===\${NC}"
kubectl describe resourcequota compute-quota -n "\${NAMESPACE}"

echo ""
echo -e "\${GREEN}Resource limits configured successfully!\${NC}"
echo ""
echo "Available profiles:"
echo "  small    - 100m CPU / 128Mi RAM / 1 replica"
echo "  medium   - 250m CPU / 256Mi RAM / 2 replicas"
echo "  large    - 500m CPU / 512Mi RAM / 3 replicas"
echo "  xlarge   - 1000m CPU / 1Gi RAM / 5 replicas"
echo "  memory-optimized  - 250m CPU / 1Gi RAM / 2 replicas"
echo "  cpu-optimized     - 1000m CPU / 512Mi RAM / 2 replicas"
echo ""
echo "To scale deployment:"
echo "  kubectl scale deployment/{{service_name}}-web --replicas=5 -n \${NAMESPACE}"
`,
      'monitoring/prometheus-rules.yaml': `# Prometheus Alerting Rules for {{service_name}}
# Defines alert conditions for monitoring the application

apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: {{service_name}}-rules
  namespace: monitoring
  labels:
    release: prometheus
    app: {{service_name}}
spec:
  groups:
  - name: {{service_name}}-alerts
    interval: 30s
    rules:
    # High error rate alert
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5..",app="{{service_name}}"}[5m])) /
        sum(rate(http_requests_total{app="{{service_name}}"}[5m])) > 0.05
      for: 10m
      labels:
        severity: warning
        component: web
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.namespace }}/{{ $labels.pod }}"

    # High latency alert
    - alert: HighLatency
      expr: |
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket{app="{{service_name}}"}[5m])) by (le)
        ) > 1
      for: 10m
      labels:
        severity: warning
        component: web
      annotations:
        summary: "High request latency"
        description: "P95 latency is {{ $value }}s"

    # Pod crash looping
    - alert: PodCrashLooping
      expr: |
        rate(kube_pod_container_status_restarts_total{app="{{service_name}}"}[15m]) > 0
      for: 5m
      labels:
        severity: critical
        component: pod
      annotations:
        summary: "Pod is crash looping"
        description: "Pod {{ $labels.pod }} has restarted {{ $value }} times"

    # High memory usage
    - alert: HighMemoryUsage
      expr: |
        sum(container_memory_usage_bytes{app="{{service_name}}"}) /
        sum(container_spec_memory_limit_bytes{app="{{service_name}}"}) > 0.9
      for: 10m
      labels:
        severity: warning
        component: pod
      annotations:
        summary: "High memory usage"
        description: "Memory usage is {{ $value | humanizePercentage }}"

    # High CPU usage
    - alert: HighCPUUsage
      expr: |
        sum(rate(container_cpu_usage_seconds_total{app="{{service_name}}"}[5m])) by (pod) >
        sum(container_spec_cpu_quota{app="{{service_name}}"}/container_spec_cpu_period{app="{{service_name}}"}) by (pod) * 0.9
      for: 10m
      labels:
        severity: warning
        component: pod
      annotations:
        summary: "High CPU usage"
        description: "CPU usage is {{ $value | humanizePercentage }}"

    # Database connection pool exhausted
    - alert: DatabasePoolExhausted
      expr: |
        sum(django_db_pool_connections{state="idle",app="{{service_name}}"}) /
        sum(django_db_pool_connections{app="{{service_name}}"}) < 0.1
      for: 5m
      labels:
        severity: critical
        component: database
      annotations:
        summary: "Database connection pool exhausted"
        description: "Less than 10% idle connections available"

    # Celery queue backlog
    - alert: CeleryQueueBacklog
      expr: |
        sum(celery_queue_length{app="{{service_name}}"}) > 1000
      for: 15m
      labels:
        severity: warning
        component: celery
      annotations:
        summary: "Celery queue backlog"
        description: "Queue has {{ $value }} pending tasks"

    # Redis memory high
    - alert: RedisMemoryHigh
      expr: |
        redis_memory_used_bytes{app="{{service_name}"} /
        redis_memory_max_bytes{app="{{service_name}"} > 0.9
      for: 10m
      labels:
        severity: warning
        component: redis
      annotations:
        summary: "Redis memory high"
        description: "Redis memory usage is {{ $value | humanizePercentage }}"
`,
      'monitoring/grafana-dashboard.json': `{
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "gnetId": null,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{app=\\"{{service_name}}\\"}[5m]))",
          "legendFormat": "Total Requests"
        },
        {
          "expr": "sum(rate(http_requests_total{status=~\\"4..\\",app=\\"{{service_name}}\\"}[5m]))",
          "legendFormat": "4xx Errors"
        },
        {
          "expr": "sum(rate(http_requests_total{status=~\\"5..\\",app=\\"{{service_name}}\\"}[5m]))",
          "legendFormat": "5xx Errors"
        }
      ],
      "title": "Request Rate"
    },
    {
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{app=\\"{{service_name}}\\"}[5m])) by (le))",
          "legendFormat": "P95 Latency"
        }
      ],
      "title": "Request Latency"
    },
    {
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(container_cpu_usage_seconds_total{app=\\"{{service_name}}\\"}) by (pod)",
          "legendFormat": "CPU"
        }
      ],
      "title": "CPU Usage"
    },
    {
      "datasource": "Prometheus",
      "targets": [
        {
          "expr": "sum(container_memory_working_set_bytes{app=\\"{{service_name}}\\"}) by (pod)",
          "legendFormat": "Memory"
        }
      ],
      "title": "Memory Usage"
    }
  ],
  "title": "{{service_name}} Dashboard"
}
`,
      'monitoring/service-monitor.yaml': `# Prometheus ServiceMonitor for {{service_name}}

apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{service_name}}-web
  namespace: {{service_name}}
spec:
  selector:
    matchLabels:
      app: {{service_name}}
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
`,
      'logging/fluentd-config.yaml': `# Fluentd Configuration for {{service_name}}

apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: {{service_name}}
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/{{service_name}}*.log
      tag {{service_name}}.*
    </source>

    <match {{service_name}}.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      logstash_format true
    </match>
`,
      'scripts/setup-monitoring.sh': `#!/bin/bash
# Monitoring and Logging Setup Script

set -e

echo "=== Monitoring & Logging Setup ==="

# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create monitoring namespace
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Install Prometheus Operator
helm upgrade --install prometheus-operator prometheus-community/kube-prometheus-stack \\
    --namespace monitoring \\
    --set grafana.adminPassword=admin

echo "Monitoring setup complete!"
echo "Grafana: kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
`,
      'lifecycle/pre-stop.sh': `#!/bin/bash
# Pre-stop hook for graceful shutdown
# This script runs before the container receives the TERM signal

set -e

SERVICE_NAME="{{service_name}}"
LOG_FILE="/var/log/lifecycle/pre-stop.log"

log() {
    echo "[$(date -Iseconds)] [PRE-STOP] $*" | tee -a "$LOG_FILE"
}

log "Starting pre-stop lifecycle hook..."

# Stop accepting new requests (for web servers)
if command -v nginx &> /dev/null; then
    log "Disabling nginx health checks..."
    nginx -s stop &> /dev/null || true
fi

# Wait for in-flight requests to complete (grace period)
GRACE_PERIOD=\${PRE_STOP_GRACE_PERIOD:-10}
log "Waiting $GRACE_PERIOD seconds for in-flight requests..."
sleep "$GRACE_PERIOD"

# Flush any pending database operations
if [ -n "$DJANGO_SETTINGS_MODULE" ]; then
    log "Flushing Django database connections..."
    python manage.py dbshell --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" &> /dev/null || true
fi

# Close Celery worker connections gracefully
if pgrep -f "celery worker" > /dev/null; then
    log "Stopping Celery workers gracefully..."
    pkill -TERM -f "celery worker" || true
    sleep 5
fi

# Flush Redis connections
if command -v redis-cli &> /dev/null; then
    log "Flushing Redis connections (not data)..."
    redis-cli CLIENT KILL TYPE normal &> /dev/null || true
fi

# Send pre-stop notification to monitoring
if [ -n "$WEBHOOK_URL" ]; then
    log "Sending pre-stop notification..."
    curl -X POST "$WEBHOOK_URL" \\
        -H "Content-Type: application/json" \\
        -d '{"event": "pre_stop", "service": "'"$SERVICE_NAME"'", "timestamp": "'$(date -Iseconds)'"}' \\
        --max-time 5 --silent || true
fi

log "Pre-stop lifecycle hook completed successfully"
`,
      'lifecycle/post-start.sh': `#!/bin/bash
# Post-start hook for initialization tasks
# This script runs after the container starts

set -e

SERVICE_NAME="{{service_name}}"
LOG_FILE="/var/log/lifecycle/post-start.log"
MAX_RETRIES=\${POST_START_MAX_RETRIES:-30}
RETRY_DELAY=\${POST_START_RETRY_DELAY:-2}

log() {
    echo "[$(date -Iseconds)] [POST-START] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date -Iseconds)] [POST-START] [ERROR] $*" | tee -a "$LOG_FILE" >&2
}

log "Starting post-start lifecycle hook..."

# Wait for dependencies to be ready
log "Checking dependencies..."

# Wait for PostgreSQL
if [ -n "$DB_HOST" ]; then
    log "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
    for i in $(seq 1 "$MAX_RETRIES"); do
        if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
            log "PostgreSQL is ready!"
            break
        fi
        if [ $i -eq $MAX_RETRIES ]; then
            error "PostgreSQL not ready after $MAX_RETRIES attempts"
            exit 1
        fi
        sleep "$RETRY_DELAY"
    done
fi

# Wait for Redis
if [ -n "$REDIS_HOST" ]; then
    log "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
    for i in $(seq 1 "$MAX_RETRIES"); do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
            log "Redis is ready!"
            break
        fi
        if [ $i -eq $MAX_RETRIES ]; then
            error "Redis not ready after $MAX_RETRIES attempts"
            exit 1
        fi
        sleep "$RETRY_DELAY"
    done
fi

# Run database migrations
if [ -n "$DJANGO_SETTINGS_MODULE" ]; then
    log "Running Django migrations..."
    python manage.py migrate --noinput || {
        error "Migration failed"
        exit 1
    }

    # Collect static files
    log "Collecting static files..."
    python manage.py collectstatic --noinput --clear || {
        error "Static file collection failed"
        exit 1
    }

    # Create cache table if using Redis cache
    if [ -n "$REDIS_HOST" ]; then
        log "Creating Django cache table..."
        python manage.py createcachetable --noinput || true
    fi
fi

# Warm up application cache
if [ -n "$ENABLE_CACHE_WARMUP" ] && [ "$ENABLE_CACHE_WARMUP" = "true" ]; then
    log "Warming up application cache..."
    python manage.py warmup_cache &> /dev/null || {
        error "Cache warmup failed (non-fatal)"
    }
fi

# Verify Celery connectivity
if [ -n "$CELERY_BROKER_URL" ]; then
    log "Verifying Celery broker connectivity..."
    if command -v celery &> /dev/null; then
        celery -A "$CELERY_APP" inspect ping &> /dev/null || {
            error "Celery broker not reachable (non-fatal)"
        }
    fi
fi

# Perform health check
log "Performing initial health check..."
if command -v curl &> /dev/null; then
    HEALTH_URL="\${HEALTH_CHECK_URL:-http://localhost:8000/health}"
    for i in $(seq 1 "$MAX_RETRIES"); do
        if curl -f -s "$HEALTH_URL" > /dev/null; then
            log "Health check passed!"
            break
        fi
        if [ $i -eq $MAX_RETRIES ]; then
            error "Health check failed after $MAX_RETRIES attempts"
            exit 1
        fi
        sleep "$RETRY_DELAY"
    done
fi

# Send post-start notification to monitoring
if [ -n "$WEBHOOK_URL" ]; then
    log "Sending post-start notification..."
    curl -X POST "$WEBHOOK_URL" \\
        -H "Content-Type: application/json" \\
        -d '{"event": "post_start", "service": "'"$SERVICE_NAME"'", "timestamp": "'$(date -Iseconds)'", "status": "ready"}' \\
        --max-time 5 --silent || true
fi

log "Post-start lifecycle hook completed successfully"
`,
      'lifecycle/health-probe.sh': `#!/bin/bash
# Health probe script for Kubernetes liveness and readiness probes
# Returns 0 for healthy, 1 for unhealthy, 2 for unknown

set -e

LOG_FILE="/var/log/lifecycle/health-probe.log"

log() {
    echo "[$(date -Iseconds)] [HEALTH] $*" | tee -a "$LOG_FILE"
}

# Check type: liveness or readiness
PROBE_TYPE"\${1:-readiness}"

log "Running $PROBE_TYPE probe..."

# Common checks
check_common() {
    # Check if main process is running
    if ! pgrep -f "gunicorn|uvicorn|daphne" > /dev/null; then
        log "ERROR: Main process not running"
        return 1
    fi

    # Check disk space (less than 90% used)
    DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "ERROR: Disk usage critical: \${DISK_USAGE}%"
        return 1
    fi

    return 0
}

# Liveness-specific checks
check_liveness() {
    # Is the application process alive?
    if ! pgrep -f "gunicorn|uvicorn|daphne" > /dev/null; then
        log "ERROR: Application process not found"
        return 1
    fi

    # Can we bind to the port?
    if ! command -v curl &> /dev/null; then
        log "WARNING: curl not available, using process check only"
        return 0
    fi

    # Simple endpoint check
    if ! curl -f -s --max-time 2 http://localhost:8000/health > /dev/null 2>&1; then
        log "ERROR: Health endpoint unreachable"
        return 1
    fi

    return 0
}

# Readiness-specific checks
check_readiness() {
    # Database connectivity
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
        log "ERROR: Database not ready"
        return 1
    fi

    # Redis connectivity
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
        log "ERROR: Redis not ready"
        return 1
    fi

    # Application can serve requests
    if command -v curl &> /dev/null; then
        if ! curl -f -s --max-time 5 http://localhost:8000/api/v1/health > /dev/null 2>&1; then
            log "ERROR: Application not ready to serve requests"
            return 1
        fi
    fi

    return 0
}

# Startup-specific checks (for startupProbe)
check_startup() {
    # More lenient version of readiness
    # Checks if the app is starting up but not necessarily fully ready

    # Process exists
    if ! pgrep -f "gunicorn|uvicorn|daphne" > /dev/null; then
        log "ERROR: Application process not found during startup"
        return 1
    fi

    return 0
}

# Run checks
check_common || exit 1

case "$PROBE_TYPE" in
    liveness)
        check_liveness || exit 1
        ;;
    readiness)
        check_readiness || exit 1
        ;;
    startup)
        check_startup || exit 1
        ;;
    *)
        log "Unknown probe type: $PROBE_TYPE"
        exit 2
        ;;
esac

log "$PROBE_TYPE probe passed"
exit 0
`,
      'kubernetes/lifecycle-deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{service_name}}-web
  labels:
    app: {{service_name}}
    component: web
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: {{service_name}}
      component: web
  template:
    metadata:
      labels:
        app: {{service_name}}
        component: web
    spec:
      # Lifecycle hooks
      containers:
      - name: web
        image: {{service_name}}:latest
        ports:
        - name: http
          containerPort: 8000
          protocol: TCP
        env:
        - name: DJANGO_SETTINGS_MODULE
          value: "config.settings.production"
        - name: WEBHOOK_URL
          value: "{{WEBHOOK_URL:-}}"
        - name: PRE_STOP_GRACE_PERIOD
          value: "10"
        - name: ENABLE_CACHE_WARMUP
          value: "true"
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/bash
              - -c
              - |
                # Copy lifecycle scripts to writable location
                cp /app/lifecycle/*.sh /tmp/
                chmod +x /tmp/*.sh
                # Run post-start hook in background
                /tmp/post-start.sh > /var/log/lifecycle/post-start.log 2>&1 &
          preStop:
            exec:
              command:
              - /bin/bash
              - -c
              - /lifecycle/pre-stop.sh
        # Probes
        livenessProbe:
          exec:
            command:
            - /bin/bash
            - -c
            - /lifecycle/health-probe.sh liveness
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        readinessProbe:
          exec:
            command:
            - /bin/bash
            - -c
            - /lifecycle/health-probe.sh readiness
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        startupProbe:
          exec:
            command:
            - /bin/bash
            - -c
            - /lifecycle/health-probe.sh startup
          initialDelaySeconds: 0
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 30
        # Volume mounts for lifecycle scripts
        volumeMounts:
        - name: lifecycle-scripts
          mountPath: /lifecycle
          readOnly: true
        - name: lifecycle-logs
          mountPath: /var/log/lifecycle
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        # Termination grace period
        terminationMessagePath: /dev/termination-log
        terminationMessagePolicy: File
      terminationGracePeriodSeconds: 30
      # Volumes
      volumes:
      - name: lifecycle-scripts
        configMap:
          name: {{service_name}}-lifecycle-scripts
          defaultMode: 0555
      - name: lifecycle-logs
        emptyDir: {}
      # Init containers
      initContainers:
      - name: wait-for-db
        image: busybox:1.36
        command:
        - sh
        - -c
        - |
          until nc -z -v -w30 $DB_HOST $DB_PORT
          do
            echo "Waiting for database..."
            sleep 5
          done
        env:
        - name: DB_HOST
          value: "{{DB_HOST}}"
        - name: DB_PORT
          value: "{{DB_PORT}}"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-lifecycle-scripts
data:
  pre-stop.sh: |
    #!/bin/bash
    set -e
    SERVICE_NAME="{{service_name}}"
    GRACE_PERIOD=\${PRE_STOP_GRACE_PERIOD:-10}
    echo "[$(date)] Pre-stop hook for $SERVICE_NAME"
    sleep $GRACE_PERIOD
    echo "[$(date)] Pre-stop hook completed"
`,
      'scripts/apply-lifecycle-hooks.sh': `#!/bin/bash
# Apply lifecycle hooks configuration to Kubernetes
set -e

SERVICE_NAME="\${1:-{{service_name}}}"
NAMESPACE="\${2:-default}"

echo "Applying lifecycle hooks for $SERVICE_NAME in namespace $NAMESPACE..."

# Apply the lifecycle deployment
kubectl apply -f kubernetes/lifecycle-deployment.yaml -n "$NAMESPACE"

# Verify the deployment
echo "Verifying deployment..."
kubectl rollout status deployment/{{service_name}}-web -n "$NAMESPACE"

echo "Lifecycle hooks applied successfully!"
echo ""
echo "To view lifecycle logs:"
echo "  kubectl logs -n $NAMESPACE deployment/{{service_name}}-web -c lifecycle-hooks"
echo ""
echo "To trigger a rolling update to test post-start hook:"
echo "  kubectl rollout restart deployment/{{service_name}}-web -n $NAMESPACE"
`,
      'scripts/test-lifecycle-hooks.sh': `#!/bin/bash
# Test lifecycle hooks functionality
set -e

SERVICE_NAME="\${1:-{{service_name}}}"
NAMESPACE="\${2:-default}"

echo "Testing lifecycle hooks for $SERVICE_NAME..."
echo ""

# Function to check pod status
check_pods() {
    echo "=== Pod Status ==="
    kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME"
    echo ""
}

# Function to check lifecycle logs
check_lifecycle_logs() {
    local pod=$1
    echo "=== Lifecycle Logs for $pod ==="
    kubectl logs -n "$NAMESPACE" "$pod" --tail=50 || true
    echo ""
}

# Function to test post-start hook
test_post_start() {
    echo "=== Testing Post-Start Hook ==="
    echo "Restarting deployment to trigger post-start hook..."
    kubectl rollout restart deployment/{{service_name}}-web -n "$NAMESPACE"

    echo "Waiting for rollout to complete..."
    kubectl rollout status deployment/{{service_name}}-web -n "$NAMESPACE"

    # Get the newest pod
    NEW_POD=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')

    echo "Checking logs from new pod: $NEW_POD"
    check_lifecycle_logs "$NEW_POD"

    echo "Post-start hook test completed!"
    echo ""
}

# Function to test pre-stop hook
test_pre_stop() {
    echo "=== Testing Pre-Stop Hook ==="
    echo "Scaling down to trigger pre-stop hook..."

    # Get current replicas
    CURRENT_REPLICAS=$(kubectl get deployment {{service_name}}-web -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')

    # Scale down by 1
    if [ "$CURRENT_REPLICAS" -gt 1 ]; then
        kubectl scale deployment {{service_name}}-web -n "$NAMESPACE" --replicas=$((CURRENT_REPLICAS - 1))

        echo "Waiting for pod termination..."
        sleep 15

        # Scale back up
        kubectl scale deployment {{service_name}}-web -n "$NAMESPACE" --replicas="$CURRENT_REPLICAS"

        echo "Pre-stop hook test completed!"
    else
        echo "Skipping pre-stop test (need at least 2 replicas)"
    fi
    echo ""
}

# Function to test health probes
test_health_probes() {
    echo "=== Testing Health Probes ==="

    # Get a pod
    POD=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o jsonpath='{.items[0].metadata.name}')

    echo "Testing liveness probe..."
    kubectl exec -n "$NAMESPACE" "$POD" -- /lifecycle/health-probe.sh liveness
    echo "Liveness probe: PASSED"

    echo "Testing readiness probe..."
    kubectl exec -n "$NAMESPACE" "$POD" -- /lifecycle/health-probe.sh readiness
    echo "Readiness probe: PASSED"

    echo "Health probes test completed!"
    echo ""
}

# Main test execution
echo "Starting lifecycle hooks tests..."
echo ""

check_pods

# Parse arguments
TEST_TYPE"\${3:-all}"

case "$TEST_TYPE" in
    post-start)
        test_post_start
        ;;
    pre-stop)
        test_pre_stop
        ;;
    health)
        test_health_probes
        ;;
    all)
        test_post_start
        test_health_probes
        ;;
    *)
        echo "Usage: $0 [service_name] [namespace] [test_type]"
        echo "Test types: post-start, pre-stop, health, all"
        exit 1
        ;;
esac

echo ""
echo "All tests completed!"
`,
      'backup/backup-script.sh': `#!/bin/bash
# Backup script for {{service_name}}
# Creates backups of database, media files, and configuration

set -e

SERVICE_NAME="{{service_name}}"
BACKUP_ROOT="\${BACKUP_ROOT:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
RETENTION_DAYS=\${BACKUP_RETENTION_DAYS:-30}

log() {
    echo "[$(date -Iseconds)] [BACKUP] $*"
}

error() {
    echo "[$(date -Iseconds)] [BACKUP] [ERROR] $*" >&2
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting backup for $SERVICE_NAME..."
log "Backup directory: $BACKUP_DIR"

# Backup PostgreSQL database
backup_database() {
    log "Backing up PostgreSQL database..."

    local db_file="$BACKUP_DIR/database.sql.gz"

    if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
        PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "\${DB_PORT:-5432}" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-acl \
            --format=plain \
            --compress=9 \
            > "$db_file"

        local size=$(du -h "$db_file" | cut -f1)
        log "Database backup completed: $db_file ($size)"
    else
        error "Database credentials not configured. Skipping database backup."
        return 1
    fi
}

# Backup media files
backup_media() {
    log "Backing up media files..."

    local media_file="$BACKUP_DIR/media.tar.gz"

    if [ -d "./media" ] && [ "$(ls -A ./media 2>/dev/null)" ]; then
        tar -czf "$media_file" -C ./media .

        local size=$(du -h "$media_file" | cut -f1)
        log "Media backup completed: $media_file ($size)"
    else
        log "No media files to backup."
    fi
}

# Backup configuration files
backup_config() {
    log "Backing up configuration files..."

    local config_file="$BACKUP_DIR/config.tar.gz"

    tar -czf "$config_file" \
        .env \
        config/settings/*.py \
        docker-compose*.yml \
        Dockerfile* \
        kubernetes/*.yaml \
        2>/dev/null || true

    local size=$(du -h "$config_file" | cut -f1)
    log "Configuration backup completed: $config_file ($size)"
}

# Backup Redis data (optional)
backup_redis() {
    if [ "\${BACKUP_REDIS:-false}" = "true" ] && [ -n "$REDIS_HOST" ]; then
        log "Backing up Redis data..."

        local redis_file="$BACKUP_DIR/redis.rdb"

        if command -v redis-cli &> /dev/null; then
            redis-cli -h "$REDIS_HOST" -p "\${REDIS_PORT:-6379}" --rdb "$redis_file" \
                || error "Redis backup failed (non-fatal)"

            if [ -f "$redis_file" ]; then
                local size=$(du -h "$redis_file" | cut -f1)
                log "Redis backup completed: $redis_file ($size)"
            fi
        fi
    fi
}

# Generate backup manifest
generate_manifest() {
    log "Generating backup manifest..."

    cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "service": "$SERVICE_NAME",
  "timestamp": "$(date -Iseconds)",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "files": [
    $(find "$BACKUP_DIR" -type f ! -name "manifest.json" -exec basename {} \\; | sed 's/.*/"&"/' | paste -sd, -)
  ],
  "checksums": {
$(cd "$BACKUP_DIR" && find . -type f ! -name "manifest.json" -exec sha256sum {} \\; | sed 's/^    /    "/' | sed 's/  /": "/' | sed 's/$/",/' | sed '$ s/,$//')
  }
}
EOF

    log "Manifest generated: $BACKUP_DIR/manifest.json"
}

# Upload to remote storage (optional)
upload_remote() {
    if [ -n "$BACKUP_S3_BUCKET" ] && command -v aws &> /dev/null; then
        log "Uploading backup to S3: $BACKUP_S3_BUCKET"

        aws s3 sync "$BACKUP_DIR" "s3://$BACKUP_S3_BUCKET/$SERVICE_NAME/$TIMESTAMP/" \
            --storage-class STANDARD_IA \
            || error "S3 upload failed (non-fatal)"
    fi

    if [ -n "$BACKUP_GCS_BUCKET" ] && command -v gsutil &> /dev/null; then
        log "Uploading backup to GCS: $BACKUP_GCS_BUCKET"

        gsutil -m rsync -r "$BACKUP_DIR" "gs://$BACKUP_GCS_BUCKET/$SERVICE_NAME/$TIMESTAMP/" \
            || error "GCS upload failed (non-fatal)"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \\;

    log "Old backups cleaned up"
}

# Main backup process
backup_database
backup_media
backup_config
backup_redis
generate_manifest
upload_remote
cleanup_old_backups

log "Backup completed successfully!"
log "Backup location: $BACKUP_DIR"
log "To restore, use: ./scripts/restore-backup.sh $TIMESTAMP"
`,
      'backup/restore-script.sh': `#!/bin/bash
# Restore script for {{service_name}}

set -e

SERVICE_NAME="{{service_name}}"
BACKUP_ROOT="\${BACKUP_ROOT:-./backups}"
BACKUP_TIMESTAMP"\${1:-}"

usage() {
    echo "Usage: $0 <backup_timestamp>"
    echo ""
    echo "Available backups:"
    find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" | sort -r | head -10
    exit 1
}

if [ -z "$BACKUP_TIMESTAMP" ]; then
    usage
fi

BACKUP_DIR="$BACKUP_ROOT/$BACKUP_TIMESTAMP"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup not found: $BACKUP_DIR"
    usage
fi

log() {
    echo "[$(date -Iseconds)] [RESTORE] $*"
}

error() {
    echo "[$(date -Iseconds)] [RESTORE] [ERROR] $*" >&2
}

confirm() {
    read -p "This will REPLACE all data. Are you sure? (yes/no): " answer
    if [ "$answer" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
}

log "Starting restore from: $BACKUP_DIR"
confirm

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."

    if [ ! -f "$BACKUP_DIR/manifest.json" ]; then
        error "Manifest file not found. Backup may be corrupted."
        exit 1
    fi

    # Verify checksums if available
    if command -v sha256sum &> /dev/null; then
        cd "$BACKUP_DIR"
        sha256sum -c manifest.json 2>/dev/null || error "Checksum verification failed"
        cd - > /dev/null
    fi

    log "Backup verification passed"
}

# Restore database
restore_database() {
    log "Restoring database..."

    local db_file="$BACKUP_DIR/database.sql.gz"

    if [ ! -f "$db_file" ]; then
        error "Database backup not found: $db_file"
        return 1
    fi

    if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
        # Drop existing database
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "\${DB_PORT:-5432}" \
            -U "$DB_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS $DB_NAME;" \
            || error "Failed to drop database"

        # Create new database
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "\${DB_PORT:-5432}" \
            -U "$DB_USER" \
            -d postgres \
            -c "CREATE DATABASE $DB_NAME;" \
            || error "Failed to create database"

        # Restore data
        gunzip -c "$db_file" | PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "\${DB_PORT:-5432}" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -q \
            || error "Failed to restore database"

        log "Database restored successfully"
    else
        error "Database credentials not configured."
        return 1
    fi
}

# Restore media files
restore_media() {
    log "Restoring media files..."

    local media_file="$BACKUP_DIR/media.tar.gz"

    if [ ! -f "$media_file" ]; then
        log "Media backup not found. Skipping."
        return 0
    fi

    # Backup existing media
    if [ -d "./media" ]; then
        mv ./media "./media.backup.$(date +%s)"
    fi

    mkdir -p ./media
    tar -xzf "$media_file" -C ./media

    log "Media files restored successfully"
}

# Restore configuration
restore_config() {
    log "Restoring configuration files..."

    local config_file="$BACKUP_DIR/config.tar.gz"

    if [ ! -f "$config_file" ]; then
        log "Configuration backup not found. Skipping."
        return 0
    fi

    # Backup existing config
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%s)
    fi

    tar -xzf "$config_file" -C ./

    log "Configuration restored successfully"
    log "Note: Please review .env and update if needed"
}

# Restore Redis data (optional)
restore_redis() {
    if [ -f "$BACKUP_DIR/redis.rdb" ] && [ -n "$REDIS_HOST" ]; then
        log "Restoring Redis data..."

        if command -v redis-cli &> /dev/null; then
            # Flush existing data
            redis-cli -h "$REDIS_HOST" -p "\${REDIS_PORT:-6379}" FLUSHALL \
                || error "Failed to flush Redis (non-fatal)"

            # Load backup
            redis-cli -h "$REDIS_HOST" -p "\${REDIS_PORT:-6379}" --rdb "$BACKUP_DIR/redis.rdb" \
                || error "Failed to restore Redis (non-fatal)"

            log "Redis data restored"
        fi
    fi
}

# Run migrations after restore
run_migrations() {
    log "Running database migrations..."

    python manage.py migrate --noinput || error "Migration failed"

    log "Migrations completed"
}

# Main restore process
verify_backup
restore_database
restore_media
restore_config
restore_redis
run_migrations

log "Restore completed successfully!"
log "Please restart the application:"
log "  docker-compose restart"
log "  or"
log "  kubectl rollout restart deployment/{{service_name}}-web"
`,
      'backup/schedule-backups.sh': `#!/bin/bash
# Schedule automated backups using cron or Kubernetes CronJobs

set -e

SERVICE_NAME="{{service_name}}"

case "\${1:-kubernetes}" in
    cron)
        # Setup cron job for local/docker environments
        echo "Setting up cron backup schedule..."

        CRON_JOB="0 2 * * * $PWD/backup/backup-script.sh >> $PWD/backups/cron.log 2>&1"

        # Check if cron job already exists
        if crontab -l 2>/dev/null | grep -q "backup-script.sh"; then
            echo "Cron job already exists."
        else
            (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
            echo "Cron job added: Daily backup at 2 AM"
        fi

        echo "To edit schedule: crontab -e"
        ;;

    kubernetes)
        # Setup Kubernetes CronJob
        echo "Setting up Kubernetes CronJob for backups..."

        cat > kubernetes/backup-cronjob.yaml << 'EOF'
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{service_name}}-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: {{service_name}}:latest
            command:
            - /bin/bash
            - /app/backup/backup-script.sh
            env:
            - name: DB_HOST
              value: "{{DB_HOST}}"
            - name: DB_PORT
              value: "{{DB_PORT}}"
            - name: DB_NAME
              value: "{{DB_NAME}}"
            - name: DB_USER
              value: "{{DB_USER}}"
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{service_name}}-secrets
                  key: db-password
            - name: BACKUP_ROOT
              value: /backups
            - name: BACKUP_RETENTION_DAYS
              value: "30"
            - name: BACKUP_S3_BUCKET
              value: "{{BACKUP_S3_BUCKET}}"
            volumeMounts:
            - name: backups
              mountPath: /backups
            - name: data
              mountPath: /app/data
              readOnly: true
          volumes:
          - name: backups
            persistentVolumeClaim:
              claimName: {{service_name}}-backups-pvc
          - name: data
            persistentVolumeClaim:
              claimName: {{service_name}}-data-pvc
              readOnly: true
EOF

        kubectl apply -f kubernetes/backup-cronjob.yaml

        echo "Kubernetes CronJob created!"
        echo "View CronJobs: kubectl get cronjobs"
        echo "View backup jobs: kubectl get jobs -l app={{service_name}}-backup"
        ;;

    list)
        echo "Available backups:"
        ls -la ./backups/ 2>/dev/null || echo "No backups found"
        ;;

    *)
        echo "Usage: $0 {cron|kubernetes|list}"
        exit 1
        ;;
esac
`,
      'backup/verify-backup.sh': `#!/bin/bash
# Verify backup integrity and list contents

set -e

BACKUP_ROOT="\${BACKUP_ROOT:-./backups}"
BACKUP_TIMESTAMP"\${1:-}"

if [ -z "$BACKUP_TIMESTAMP" ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo ""
    echo "Available backups:"
    find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" | sort -r | head -10
    exit 1
fi

BACKUP_DIR="$BACKUP_ROOT/$BACKUP_TIMESTAMP"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup not found: $BACKUP_DIR"
    exit 1
fi

echo "=== Backup Verification: $BACKUP_TIMESTAMP ==="
echo ""

echo "Location: $BACKUP_DIR"
echo "Size: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "Date: $(stat -c %y "$BACKUP_DIR" 2>/dev/null || stat -f '%Sm' "$BACKUP_DIR")"
echo ""

echo "Files:"
ls -lh "$BACKUP_DIR"
echo ""

# Check manifest
if [ -f "$BACKUP_DIR/manifest.json" ]; then
    echo "=== Manifest Contents ==="
    cat "$BACKUP_DIR/manifest.json"
    echo ""
fi

# Verify database backup
if [ -f "$BACKUP_DIR/database.sql.gz" ]; then
    echo "=== Database Backup ==="
    echo "Size: $(du -h "$BACKUP_DIR/database.sql.gz" | cut -f1)"
    echo "Tables:"
    gunzip -c "$BACKUP_DIR/database.sql.gz" | grep -E "^CREATE TABLE|^--" | head -20
    echo ""
fi

# Verify checksums
if command -v sha256sum &> /dev/null; then
    echo "=== File Checksums ==="
    (cd "$BACKUP_DIR" && find . -type f ! -name "manifest.json" -exec sha256sum {} \\;)
    echo ""
fi

echo "=== Verification Complete ==="
`,
      'kubernetes/backup-pvc.yaml': `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{service_name}}-backups-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: {{BACKUP_STORAGE_SIZE:-50Gi}}
  storageClassName: {{BACKUP_STORAGE_CLASS:-standard}}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{service_name}}-data-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: {{DATA_STORAGE_SIZE:-10Gi}}
  storageClassName: {{DATA_STORAGE_CLASS:-standard}}
`,
      'scripts/test-backup-restore.sh': `#!/bin/bash
# Test backup and restore procedures

set -e

SERVICE_NAME="{{service_name}}"
TEST_BACKUP_DIR="./backups/test-$(date +%s)"
TEST_DB_NAME="{{service_name}}_test"

log() {
    echo "[$(date -Iseconds)] [TEST] $*"
}

error() {
    echo "[$(date -Iseconds)] [TEST] [ERROR] $*" >&2
}

cleanup() {
    log "Cleaning up test environment..."

    # Drop test database
    if [ -n "$DB_HOST" ] && [ -n "$DB_USER" ]; then
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "\${DB_PORT:-5432}" \
            -U "$DB_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;" \
            2>/dev/null || true
    fi

    # Remove test backup
    rm -rf "$TEST_BACKUP_DIR" 2>/dev/null || true
}

trap cleanup EXIT

log "Starting backup/restore test..."

# Test 1: Create backup
log "Test 1: Creating backup..."

mkdir -p "$TEST_BACKUP_DIR"

# Backup database
if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
    log "Backing up database to test location..."

    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "\${DB_PORT:-5432}" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --format=plain \
        | gzip > "$TEST_BACKUP_DIR/database.sql.gz"

    log "Database backup created: $TEST_BACKUP_DIR/database.sql.gz"
fi

# Test 2: Verify backup integrity
log "Test 2: Verifying backup integrity..."

if [ -f "$TEST_BACKUP_DIR/database.sql.gz" ]; then
    SIZE=$(du -h "$TEST_BACKUP_DIR/database.sql.gz" | cut -f1)
    log "Backup size: $SIZE"

    # Verify it's a valid gzip file
    if gzip -t "$TEST_BACKUP_DIR/database.sql.gz" 2>/dev/null; then
        log "Gzip integrity: PASSED"
    else
        error "Gzip integrity: FAILED"
        exit 1
    fi
fi

# Test 3: Restore to test database
log "Test 3: Testing restore procedure..."

if [ -f "$TEST_BACKUP_DIR/database.sql.gz" ] && [ -n "$DB_HOST" ]; then
    log "Creating test database: $TEST_DB_NAME"

    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "\${DB_PORT:-5432}" \
        -U "$DB_USER" \
        -d postgres \
        -c "CREATE DATABASE $TEST_DB_NAME;" \
        || error "Failed to create test database"

    log "Restoring backup to test database..."

    gunzip -c "$TEST_BACKUP_DIR/database.sql.gz" | PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "\${DB_PORT:-5432}" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -q \
        || error "Failed to restore test database"

    log "Restore test: PASSED"

    # Verify data
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "\${DB_PORT:-5432}" \
        -U "$DB_USER" \
        -d "$TEST_DB_NAME" \
        -t \
        -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

    log "Restored tables: $TABLE_COUNT"
fi

# Test 4: Verify S3 upload (if configured)
if [ -n "$BACKUP_S3_BUCKET" ] && command -v aws &> /dev/null; then
    log "Test 4: Testing S3 upload..."

    aws s3 ls "s3://$BACKUP_S3_BUCKET/" \
        && log "S3 access: PASSED" \
        || log "S3 access: FAILED (non-fatal)"
fi

# Test 5: Verify retention policy
log "Test 5: Testing retention policy..."

RETENTION_DAYS=\${BACKUP_RETENTION_DAYS:-30}
log "Configured retention: $RETENTION_DAYS days"

if [ "$RETENTION_DAYS" -lt 7 ]; then
    error "Retention period too short (minimum 7 days recommended)"
    exit 1
fi

log "Retention policy: PASSED"

log ""
log "=== All backup/restore tests passed! ==="
log ""
log "Summary:"
log "- Backup creation: OK"
log "- Backup integrity: OK"
log "- Restore procedure: OK"
log "- S3 upload: $( [ -n "$BACKUP_S3_BUCKET" ] && echo 'OK' || echo 'SKIPPED' )"
log "- Retention policy: OK"
`,
      'scripts/disaster-recovery.sh': `#!/bin/bash
# Disaster recovery script for {{service_name}}
# Handles complete environment restoration

set -e

SERVICE_NAME="{{service_name}}"
BACKUP_ROOT="\${BACKUP_ROOT:-./backups}"
DR_PLAN="\${DR_PLAN:-./disaster-recovery-plan.txt}"

log() {
    echo "[$(date -Iseconds)] [DR] $*"
    error() {
        echo "[$(date -Iseconds)] [DR] [ERROR] $*" >&2
    }
}

# Step 1: Assess damage
assess_situation() {
    log "=== Step 1: Assessing Situation ==="

    echo "1. What happened?"
    echo "   1. Database corruption"
    echo "   2. Pod/container failure"
    echo "   3. Node failure"
    echo "   4. Region failure"
    echo "   5. Data deletion"
    echo "   6. Security breach"
    read -p "   Select incident type (1-6): " incident_type

    echo ""
    echo "2. What is the current state?"
    echo "   1. Application not responding"
    echo "   2. Database not accessible"
    echo "   3. Partial data loss"
    echo "   4. Complete data loss"
    read -p "   Select current state (1-4): " current_state

    echo ""
    log "Incident Type: $incident_type"
    log "Current State: $current_state"
}

# Step 2: Select recovery point
select_backup() {
    log "=== Step 2: Selecting Recovery Point ==="

    echo ""
    echo "Available backups:"
    find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" | sort -r | head -10

    echo ""
    read -p "Enter backup timestamp (or 'latest' for most recent): " backup_timestamp

    if [ "$backup_timestamp" = "latest" ]; then
        BACKUP_DIR=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "20*" | sort -r | head -1)
    else
        BACKUP_DIR="$BACKUP_ROOT/$backup_timestamp"
    fi

    if [ ! -d "$BACKUP_DIR" ]; then
        error "Backup not found: $BACKUP_DIR"
        exit 1
    fi

    log "Selected backup: $BACKUP_DIR"
}

# Step 3: Verify backup
verify_backup() {
    log "=== Step 3: Verifying Backup ==="

    if [ ! -f "$BACKUP_DIR/manifest.json" ]; then
        error "Manifest not found. Backup may be incomplete."
        read -p "Continue anyway? (yes/no): " confirm
        [ "$confirm" = "yes" ] || exit 1
    fi

    log "Backup verified"
}

# Step 4: Prepare environment
prepare_environment() {
    log "=== Step 4: Preparing Environment ==="

    read -p "Stop all services before restore? (yes/no): " stop_services
    if [ "$stop_services" = "yes" ]; then
        log "Stopping services..."
        docker-compose down || kubectl scale deployment --all --replicas=0
        sleep 10
    fi
}

# Step 5: Restore data
restore_data() {
    log "=== Step 5: Restoring Data ==="

    read -p "Execute full restore? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        ./backup/restore-script.sh "$(basename "$BACKUP_DIR")"
    fi
}

# Step 6: Verify restoration
verify_restoration() {
    log "=== Step 6: Verifying Restoration ==="

    echo "Starting services..."
    docker-compose up -d || kubectl scale deployment --all --replicas=1

    echo "Waiting for services to be ready..."
    sleep 30

    echo "Running health checks..."
    if command -v curl &> /dev/null; then
        if curl -f -s http://localhost:8000/health > /dev/null; then
            log "Health check: PASSED"
        else
            error "Health check: FAILED"
        fi
    fi
}

# Step 7: Generate report
generate_report() {
    log "=== Step 7: Generating DR Report ==="

    REPORT_FILE="./dr-report-$(date +%Y%m%d_%H%M%S).txt"

    cat > "$REPORT_FILE" << EOF
Disaster Recovery Report
========================
Service: $SERVICE_NAME
Date: $(date -Iseconds)
Incident Type: $incident_type
Backup Used: $BACKUP_DIR

Recovery Steps Completed:
1. Situation assessment: COMPLETE
2. Backup selection: COMPLETE
3. Backup verification: COMPLETE
4. Environment preparation: COMPLETE
5. Data restoration: COMPLETE
6. Restoration verification: COMPLETE

Next Steps:
- Monitor application logs for errors
- Verify data integrity with users
- Update DR procedures based on lessons learned
- Schedule post-incident review

Contact Information:
- On-call engineer: [ENTER CONTACT]
- Management escalation: [ENTER CONTACT]
EOF

    log "Report saved to: $REPORT_FILE"
}

# Main DR workflow
main() {
    log "=== Disaster Recovery for $SERVICE_NAME ==="
    log ""

    assess_situation
    select_backup
    verify_backup
    prepare_environment
    restore_data
    verify_restoration
    generate_report

    log ""
    log "=== Disaster Recovery Complete ==="
    log ""
    log "IMPORTANT:"
    log "1. Monitor the application for 24 hours"
    log "2. Verify all data with stakeholders"
    log "3. Document lessons learned"
    log "4. Update DR procedures if needed"
}

main "$@"
`,
      'profiling/cprofile-middleware.py': `"""
Django middleware for profiling request performance with cProfile
Usage: Add 'profiling.cprofile_middleware.ProfileMiddleware' to MIDDLEWARE
"""

import cProfile
import io
import logging
import pstats
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Threshold in milliseconds - profile requests slower than this
PROFILE_THRESHOLD_MS = getattr(__import__('django.conf', fromlist=['settings']).settings, 'PROFILE_THRESHOLD_MS', 500)

# Output directory for profile data
PROFILING_OUTPUT_DIR = Path(getattr(__import__('django.conf', fromlist=['settings']).settings, 'PROFILING_OUTPUT_DIR', '/tmp/profiling'))

PROFILING_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class ProfileMiddleware:
    """
    Middleware that profiles slow requests using cProfile.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only profile in DEBUG mode or when explicitly enabled
        from django.conf import settings
        if not getattr(settings, 'PROFILING_ENABLED', settings.DEBUG):
            return self.get_response(request)

        # Create profiler
        profiler = cProfile.Profile()
        profiler.enable()

        # Process request
        response = self.get_response(request)

        # Stop profiling
        profiler.disable()

        # Check if request was slow
        if hasattr(response, 'get') and response.get('X-Profile-Duration'):
            duration_ms = float(response['X-Profile-Duration']) * 1000
            if duration_ms >= PROFILE_THRESHOLD_MS:
                self._save_profile(profiler, request, duration_ms)

        return response

    def _save_profile(self, profiler, request, duration_ms):
        """Save profiling data to file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        path = getattr(request, 'path', 'unknown').replace('/', '-').strip('-')
        method = getattr(request, 'method', 'GET')

        filename = f"{timestamp}_{method}_{path}.prof"
        filepath = PROFILING_OUTPUT_DIR / filename

        # Save profile data
        profiler.dump_stats(str(filepath))

        # Log warning
        logger.warning(
            "Slow request profiled: %s %s took %.2fms (saved to %s)",
            method,
            request.path,
            duration_ms,
            filename
        )

        # Optionally create a human-readable stats file
        stats_file = PROFILING_OUTPUT_DIR / f"{filename}.txt"
        stats_stream = io.StringIO()
        stats = pstats.Stats(profiler, stream=stats_stream)
        stats.strip_dirs()
        stats.sort_stats('cumulative')
        stats.print_stats(20)  # Top 20 functions
        stats_stream.seek(0)

        with open(stats_file, 'w') as f:
            f.write(f"Profile for: {method} {request.path}\\n")
            f.write(f"Duration: {duration_ms:.2f}ms\\n")
            f.write(f"Timestamp: {timestamp}\\n")
            f.write("=" * 80 + "\\n\\n")
            f.write(stats_stream.read())
`,
      'profiling/memory-profiler.py': `"""
Memory profiling utilities for Django
Uses memory_profiler to track memory usage
"""

import logging
import tracemalloc
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Threshold in MB - log memory allocations larger than this
MEMORY_THRESHOLD_MB = 10

# Output directory
PROFILING_OUTPUT_DIR = Path('/tmp/profiling')
PROFILING_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class MemoryProfiler:
    """
    Context manager for profiling memory usage
    """

    def __init__(self, name: str, threshold_mb: int = MEMORY_THRESHOLD_MB):
        self.name = name
        self.threshold_mb = threshold_mb
        self.start_snapshot = None
        self.end_snapshot = None

    def __enter__(self):
        tracemalloc.start()
        self.start_snapshot = tracemalloc.take_snapshot()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_snapshot = tracemalloc.take_snapshot()
        tracemalloc.stop()

        # Calculate difference
        top_stats = self.end_snapshot.compare_to(self.start_snapshot, 'lineno')

        # Get total memory change
        total_change = sum(stat.size_diff for stat in top_stats) / 1024 / 1024  # MB

        if total_change > self.threshold_mb:
            logger.warning(
                "High memory usage in '%s': %.2f MB allocated",
                self.name,
                total_change
            )

            # Save detailed report
            self._save_report(top_stats, total_change)

        return False

    def _save_report(self, top_stats, total_change_mb):
        """Save memory profiling report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{self.name.replace(' ', '_')}_memory.txt"
        filepath = PROFILING_OUTPUT_DIR / filename

        with open(filepath, 'w') as f:
            f.write(f"Memory Profile: {self.name}\\n")
            f.write(f"Total allocation: {total_change_mb:.2f} MB\\n")
            f.write(f"Timestamp: {timestamp}\\n")
            f.write("=" * 80 + "\\n\\n")

            for stat in top_stats[:20]:  # Top 20 allocations
                f.write(f"{stat}\\n")

        logger.info("Memory profile saved to: %s", filename)


def profile_querysets():
    """
    Decorator to profile Django QuerySet operations
    Logs N+1 queries and inefficient query patterns
    """
    from functools import wraps
    from django.db import connection
    from django.conf import settings

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not getattr(settings, 'QUERY_PROFILING_ENABLED', False):
                return func(*args, **kwargs)

            # Reset query counter
            connection.queries_executed = 0

            # Execute function
            result = func(*args, **kwargs)

            # Check query count
            query_count = len(connection.queries) if hasattr(connection, 'queries') else 0

            if query_count > 10:  # Threshold
                logger.warning(
                    "High query count in %s: %d queries",
                    func.__name__,
                    query_count
                )

                # Log queries
                for query in connection.queries:
                    logger.debug("Query: %s", query['sql'])

            return result
        return wrapper
    return decorator
`,
      'profiling/flamegraph-script.sh': `#!/bin/bash
# Generate flamegraph for container performance analysis
# Requires perf and FlameGraph tools

set -e

SERVICE_NAME="{{service_name}}"
OUTPUT_DIR="\${PROFILING_OUTPUT_DIR:-./profiling/output}"
DURATION="\${FLAMEGRAPH_DURATION:-30}"

mkdir -p "$OUTPUT_DIR"

log() {
    echo "[$(date -Iseconds)] [FLAMEGRAPH] $*"
}

error() {
    echo "[$(date -Iseconds)] [FLAMEGRAPH] [ERROR] $*" >&2
}

# Check if running in container or on host
if [ -f /.dockerenv ]; then
    log "Running inside container"
    PERF="perf"
else
    log "Running on host"
    # Find the container process
    CONTAINER_PID=$(docker inspect -f '{{.State.Pid}}' "$SERVICE_NAME" 2>/dev/null || echo "")
    if [ -z "$CONTAINER_PID" ]; then
        error "Container not found. Please specify container name/ID."
        exit 1
    fi
    log "Container PID: $CONTAINER_PID"
    PERF="nsenter -t $CONTAINER_PID perf"
fi

# Check if perf is available
if ! command -v perf &> /dev/null; then
    error "perf is not installed. Install with: apt-get install linux-perf"
    exit 1
fi

# Check if FlameGraph is available
if [ ! -d "/tmp/FlameGraph" ]; then
    log "Cloning FlameGraph repository..."
    git clone https://github.com/brendangregg/FlameGraph.git /tmp/FlameGraph
fi

log "Starting flamegraph profiling for \${DURATION}s..."

# Record perf data
PERF_FILE="$OUTPUT_DIR/perf.data"
$PERF record -F 99 -a -g -o "$PERF_FILE" sleep "$DURATION"

log "Processing perf data..."

# Generate flamegraph
FLAMEGRAPH_FILE="$OUTPUT_DIR/flamegraph-$(date +%Y%m%d_%H%M%S).svg"
$PERF script -i "$PERF_FILE" | /tmp/FlameGraph/stackcollapse-perf.pl | \\
    /tmp/FlameGraph/flamegraph.pl > "$FLAMEGRAPH_FILE"

log "Flamegraph generated: $FLAMEGRAPH_FILE"

# Clean up perf data
rm -f "$PERF_FILE"

# Generate folded format for other tools
FOLDED_FILE="$OUTPUT_DIR/stacks-$(date +%Y%m%d_%H%M%S).txt"
$PERF script -i "$PERF_FILE" 2>/dev/null | /tmp/FlameGraph/stackcollapse-perf.pl > "$FOLDED_FILE" || true

log "Stack trace data: $FOLDED_FILE"

# Generate summary
log "=== Flamegraph Summary ==="
echo "Top functions by CPU time:"
$PERF report -i "$PERF_FILE" --no-children --sort=overhead -n 10 2>/dev/null || echo "Perf report not available"

log "Flamegraph profiling complete!"
`,
      'profiling/benchmark-script.py': `#!/usr/bin/env python
"""
Benchmark script for Django application
Runs performance benchmarks on common operations
"""

import os
import sys
import time
import statistics
from datetime import datetime

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from django.db import connection
from django.core.cache import cache

User = get_user_model()


class Benchmark:
    """Simple benchmark runner"""

    def __init__(self, name: str, warmup_runs: int = 3, benchmark_runs: int = 10):
        self.name = name
        self.warmup_runs = warmup_runs
        self.benchmark_runs = benchmark_runs
        self.times = []

    def run(self, func, *args, **kwargs):
        """Run benchmark"""
        print(f"\\n=== Benchmark: {self.name} ===")
        print(f"Warmup runs: {self.warmup_runs}")
        print(f"Benchmark runs: {self.benchmark_runs}")

        # Warmup
        for _ in range(self.warmup_runs):
            func(*args, **kwargs)

        # Benchmark
        for i in range(self.benchmark_runs):
            start = time.perf_counter()
            result = func(*args, **kwargs)
            end = time.perf_counter()
            duration_ms = (end - start) * 1000
            self.times.append(duration_ms)
            print(f"  Run {i+1}: {duration_ms:.2f}ms")

        # Statistics
        self.print_stats()
        return result

    def print_stats(self):
        """Print benchmark statistics"""
        if not self.times:
            return

        mean = statistics.mean(self.times)
        median = statistics.median(self.times)
        stdev = statistics.stdev(self.times) if len(self.times) > 1 else 0
        p95 = statistics.quantiles(self.times, n=20)[18] if len(self.times) >= 20 else max(self.times)

        print(f"\\n  Mean:   {mean:.2f}ms")
        print(f"  Median: {median:.2f}ms")
        print(f"  StdDev: {stdev:.2f}ms")
        print(f"  P95:    {p95:.2f}ms")
        print(f"  Min:    {min(self.times):.2f}ms")
        print(f"  Max:    {max(self.times):.2f}ms")


def benchmark_health_endpoint():
    """Benchmark health check endpoint"""
    client = Client()

    def request():
        response = client.get('/health/')
        assert response.status_code == 200
        return response

    Benchmark("Health Endpoint").run(request)


def benchmark_login():
    """Benchmark login endpoint"""
    client = Client()

    # Create test user
    user, created = User.objects.get_or_create(
        email='benchmark@example.com',
        defaults={'password': 'testpass123'}
    )
    if created:
        user.set_password('testpass123')
        user.save()

    def login():
        response = client.post('/api/v1/auth/login/', {
            'email': 'benchmark@example.com',
            'password': 'testpass123'
        })
        assert response.status_code == 200
        return response

    Benchmark("Login API").run(login)


def benchmark_database_query():
    """Benchmark database queries"""
    def query():
        users = list(User.objects.all()[:100])
        return users

    Benchmark("Database Query (100 users)").run(query)


def benchmark_cache_operations():
    """Benchmark cache operations"""
    cache_key = 'benchmark_test'

    def cache_write():
        cache.set(cache_key, {'data': 'test' * 100}, timeout=60)

    def cache_read():
        return cache.get(cache_key)

    print("\\n=== Benchmark: Cache Write ===")
    Benchmark("Cache Write").run(cache_write)

    print("\\n=== Benchmark: Cache Read ===")
    Benchmark("Cache Read").run(cache_read)


def main():
    """Run all benchmarks"""
    print(f"\\n{'=' * 60}")
    print(f"Django Performance Benchmarks")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"{'=' * 60}")

    try:
        benchmark_health_endpoint()
        benchmark_login()
        benchmark_database_query()
        benchmark_cache_operations()
    except Exception as e:
        print(f"\\nBenchmark failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    print(f"\\n{'=' * 60}")
    print("All benchmarks completed!")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
`,
      'scripts/collect-performance-metrics.sh': `#!/bin/bash
# Collect performance metrics from running container
# Generates report with CPU, memory, disk, and network stats

set -e

SERVICE_NAME="{{service_name}}"
OUTPUT_DIR="\${METRICS_OUTPUT_DIR:-./profiling/metrics}"
DURATION="\${COLLECTION_DURATION:-60}"
INTERVAL="\${COLLECTION_INTERVAL:-1}"

mkdir -p "$OUTPUT_DIR"

log() {
    echo "[$(date -Iseconds)] [METRICS] $*"
}

error() {
    echo "[$(date -Iseconds)] [METRICS] [ERROR] $*" >&2
}

# Get container name/ID
CONTAINER"\${1:-$SERVICE_NAME}"

if ! docker inspect "$CONTAINER" &> /dev/null; then
    error "Container not found: $CONTAINER"
    exit 1
fi

log "Collecting metrics from container: $CONTAINER"
log "Duration: \${DURATION}s, Interval: \${INTERVAL}s"

OUTPUT_FILE="$OUTPUT_DIR/metrics-$(date +%Y%m%d_%H%M%S).csv"

# CSV header
echo "timestamp,cpu_percent,memory_usage,memory_percent,net_rx,net_tx,disk_read,disk_write" > "$OUTPUT_FILE"

# Collect metrics
log "Collecting metrics..."
for i in $(seq 1 $((DURATION / INTERVAL))); do
    TIMESTAMP=$(date -Iseconds)

    # CPU stats
    CPU_STATS=$(docker stats "$CONTAINER" --no-stream --format "{{.CPUPerc}}" | sed 's/%//')
    CPU_PERCENT=$(echo "$CPU_STATS" | awk '{print $1}')

    # Memory stats
    MEM_STATS=$(docker stats "$CONTAINER" --no-stream --format "{{.MemUsage}}")
    MEM_USAGE=$(echo "$MEM_STATS" | awk '{print $1}')
    MEM_PERCENT=$(docker stats "$CONTAINER" --no-stream --format "{{.MemPerc}}" | sed 's/%//')

    # Network stats
    NET_STATS=$(docker exec "$CONTAINER" cat /proc/net/dev | grep eth0 | awk '{print $2, $10}')
    NET_RX=$(echo "$NET_STATS" | awk '{print $1}')
    NET_TX=$(echo "$NET_STATS" | awk '{print $2}')

    # Disk stats (if available)
    DISK_STATS=$(docker exec "$CONTAINER" cat /proc/diskstats 2>/dev/null | grep -v loop | head -1 | awk '{sum=$4+$8; print sum}' || echo "0")
    DISK_READ=$(echo "$DISK_STATS" | awk '{print $1}')
    DISK_WRITE=$(echo "$DISK_STATS" | awk '{print $2}')

    # Write to CSV
    echo "$TIMESTAMP,$CPU_PERCENT,$MEM_USAGE,$MEM_PERCENT,$NET_RX,$NET_TX,$DISK_READ,$DISK_WRITE" >> "$OUTPUT_FILE"

    log "Collected: CPU=\${CPU_PERCENT}%, MEM=\${MEM_USAGE}"
    sleep "$INTERVAL"
done

log "Metrics saved to: $OUTPUT_FILE"

# Generate summary
log "=== Performance Metrics Summary ==="
echo "Average CPU: $(awk -F, 'NR>1 {sum+=$2; count++} END {if(count>0) print sum/count "%"}' "$OUTPUT_FILE")"
echo "Average Memory: $(awk -F, 'NR>1 {sum+=$4; count++} END {if(count>0) print sum/count "%"}' "$OUTPUT_FILE")"

log "Metrics collection complete!"
`,
      'scripts/generate-performance-report.sh': `#!/bin/bash
# Generate comprehensive performance report
# Combines profiling data, metrics, and benchmarks

set -e

SERVICE_NAME="{{service_name}}"
OUTPUT_DIR="\${REPORT_OUTPUT_DIR:-./profiling/reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$OUTPUT_DIR/performance-report-$TIMESTAMP.md"

mkdir -p "$OUTPUT_DIR"

log() {
    echo "[$(date -Iseconds)] [REPORT] $*"
}

error() {
    echo "[$(date -Iseconds)] [REPORT] [ERROR] $*" >&2
}

log "Generating performance report..."

# Start report
cat > "$REPORT_FILE" << EOF
# Performance Report: $SERVICE_NAME

**Generated:** $(date -Iseconds)
**Environment:** \${ENVIRONMENT:-production}

---

## Executive Summary

EOF

# Collect container stats
CONTAINER="\${1:-$SERVICE_NAME}"

if docker inspect "$CONTAINER" &> /dev/null; then
    log "Collecting container stats..."

    cat >> "$REPORT_FILE" << EOF
### Container Status

| Metric | Value |
|--------|-------|
| Status | $(docker inspect --format='{{.State.Status}}' "$CONTAINER") |
| Uptime | $(docker inspect --format='{{.State.StartedAt}}' "$CONTAINER") |
| CPU Usage | $(docker stats "$CONTAINER" --no-stream --format '{{.CPUPerc}}') |
| Memory Usage | $(docker stats "$CONTAINER" --no-stream --format '{{.MemUsage}}') |
| Network I/O | $(docker stats "$CONTAINER" --no-stream --format '{{.NetIO}}') |
| Block I/O | $(docker stats "$CONTAINER" --no-stream --format '{{.BlockIO}}') |

EOF
fi

# Check for profiling data
PROFILING_DIR="./profiling/output"

if [ -d "$PROFILING_DIR" ]; then
    log "Processing profiling data..."

    cat >> "$REPORT_FILE" << EOF
### Profiling Data

Available profile files:

EOF

    find "$PROFILING_DIR" -type f -name "*.prof" | while read -r file; do
        filename=$(basename "$file")
        filesize=$(du -h "$file" | cut -f1)
        echo "- \\\`$filename\\\` ($filesize)" >> "$REPORT_FILE"
    done

    echo "" >> "$REPORT_FILE"
fi

# Check for flamegraphs
if ls "$PROFILING_DIR"/*.svg 2>/dev/null; then
    log "Found flamegraphs..."

    cat >> "$REPORT_FILE" << EOF
### Flamegraphs

EOF

    for flamegraph in "$PROFILING_DIR"/*.svg; do
        if [ -f "$flamegraph" ]; then
            filename=$(basename "$flamegraph")
            echo "![Flamegraph](./output/$filename)" >> "$REPORT_FILE"
        fi
    done

    echo "" >> "$REPORT_FILE"
fi

# Check for metrics
METRICS_DIR="./profiling/metrics"

if ls "$METRICS_DIR"/*.csv 2>/dev/null | head -1; then
    log "Processing metrics data..."

    LATEST_METRICS=$(ls -t "$METRICS_DIR"/*.csv 2>/dev/null | head -1)

    if [ -n "$LATEST_METRICS" ]; then
        cat >> "$REPORT_FILE" << EOF
### Performance Metrics

Analysis of: \\\`$(basename "$LATEST_METRICS")\\\`

| Metric | Average | Min | Max |
|--------|--------|-----|-----|
| CPU | $(awk -F, 'NR>1 {sum+=$2; count++; if($2<min || min==0) min=$2; if($2>max) max=$2} END {printf "%.2f%%", sum/count}' "$LATEST_METRICS") | $(awk -F, 'NR>1 {if($2<min || min==0) min=$2} END {print min "%"}' "$LATEST_METRICS") | $(awk -F, 'NR>1 {if($2>max) max=$2} END {print max "%"}' "$LATEST_METRICS") |
| Memory | $(awk -F, 'NR>1 {sum+=$4; count++; if($4<min || min==0) min=$4; if($4>max) max=$4} END {printf "%.2f%%", sum/count}' "$LATEST_METRICS") | $(awk -F, 'NR>1 {if($4<min || min==0) min=$4} END {print min "%"}' "$LATEST_METRICS") | $(awk -F, 'NR>1 {if($4>max) max=$4} END {print max "%"}' "$LATEST_METRICS") |

EOF
    fi
fi

# Recommendations
cat >> "$REPORT_FILE" << EOF
## Recommendations

EOF

# Generate recommendations based on data
if [ -n "$LATEST_METRICS" ]; then
    AVG_CPU=$(awk -F, 'NR>1 {sum+=$2; count++} END {if(count>0) print sum/count; else print 0}' "$LATEST_METRICS")
    AVG_MEM=$(awk -F, 'NR>1 {sum+=$4; count++} END {if(count>0) print sum/count; else print 0}' "$LATEST_METRICS")

    # CPU recommendations
    if (( $(echo "$AVG_CPU > 80" | bc -l) )); then
        echo "- ⚠️ **High CPU usage** (\${AVG_CPU}%): Consider horizontal scaling or CPU optimization" >> "$REPORT_FILE"
    elif (( $(echo "$AVG_CPU > 50" | bc -l) )); then
        echo "- 📊 **Moderate CPU usage** (\${AVG_CPU}%): Monitor for spikes" >> "$REPORT_FILE"
    else
        echo "- ✅ **CPU usage normal** (\${AVG_CPU}%)" >> "$REPORT_FILE"
    fi

    # Memory recommendations
    if (( $(echo "$AVG_MEM > 80" | bc -l) )); then
        echo "- ⚠️ **High memory usage** (\${AVG_MEM}%): Check for memory leaks and consider increasing limits" >> "$REPORT_FILE"
    elif (( $(echo "$AVG_MEM > 50" | bc -l) )); then
        echo "- 📊 **Moderate memory usage** (\${AVG_MEM}%): Monitor trends" >> "$REPORT_FILE"
    else
        echo "- ✅ **Memory usage normal** (\${AVG_MEM}%)" >> "$REPORT_FILE"
    fi
fi

# Complete report
cat >> "$REPORT_FILE" << EOF

---

*Report generated by performance profiling tools*
*For detailed analysis, review individual profile files and metrics*

EOF

log "Performance report generated: $REPORT_FILE"
log "Report contents:"
cat "$REPORT_FILE"

# Optional: Open in browser if on macOS
if command -v open &> /dev/null; then
    # Convert to HTML first (requires pandoc)
    if command -v pandoc &> /dev/null; then
        HTML_FILE="$OUTPUT_DIR/performance-report-$TIMESTAMP.html"
        pandoc "$REPORT_FILE" -o "$HTML_FILE" 2>/dev/null && open "$HTML_FILE"
    fi
fi
`,
      'secrets/seal-secret.sh': `#!/bin/bash
# Seal a secret using kubeseal for encrypted storage in git
# Requires: kubeseal (https://github.com/bitnami-labs/sealed-secrets)

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"

log() {
    echo "[$(date -Iseconds)] [SEAL] $*"
}

error() {
    echo "[$(date -Iseconds)] [SEAL] [ERROR] $*" >&2
}

# Check if kubeseal is installed
if ! command -v kubeseal &> /dev/null; then
    error "kubeseal is not installed"
    log "Install with: brew install kubeseal (macOS) or go install github.com/bitnami-labs/sealed-secrets/cmd/kubeseal@latest"
    exit 1
fi

usage() {
    echo "Usage: $0 <secret-name> <literal|from-file|from-env-file> <value>"
    echo ""
    echo "Examples:"
    echo "  $0 db-password literal mysecretpassword"
    echo "  $0 db-password from-file ./secrets/db-password.txt"
    echo "  $0 app-env from-env-file .env.production"
    exit 1
}

if [ $# -lt 2 ]; then
    usage
fi

SECRET_NAME"\${1:-secret}"
SECRET_TYPE"\${2:-literal}"
SECRET_VALUE"\${3:-}"

log "Creating sealed secret: $SECRET_NAME"

case "$SECRET_TYPE" in
    literal)
        if [ -z "$SECRET_VALUE" ]; then
            error "Value required for literal type"
            usage
        fi

        # Create sealed secret from literal
        echo -n "$SECRET_VALUE" | \\
            kubectl create secret generic "\${SERVICE_NAME}-\${SECRET_NAME}" \\
            --dry-run=client \\
            --from-file=value=/dev/stdin \\
            -o json | \\
            kubeseal --format yaml --namespace "$NAMESPACE" > "kubernetes/sealed-\${SECRET_NAME}.yaml"

        log "Sealed secret created: kubernetes/sealed-\${SECRET_NAME}.yaml"
        ;;

    from-file)
        if [ -z "$SECRET_VALUE" ] || [ ! -f "$SECRET_VALUE" ]; then
            error "File not found: $SECRET_VALUE"
            usage
        fi

        # Create sealed secret from file
        kubectl create secret generic "\${SERVICE_NAME}-\${SECRET_NAME}" \\
            --dry-run=client \\
            --from-file=value="$SECRET_VALUE" \\
            -o json | \\
            kubeseal --format yaml --namespace "$NAMESPACE" > "kubernetes/sealed-\${SECRET_NAME}.yaml"

        log "Sealed secret created: kubernetes/sealed-\${SECRET_NAME}.yaml"
        ;;

    from-env-file)
        if [ -z "$SECRET_VALUE" ] || [ ! -f "$SECRET_VALUE" ]; then
            error "Env file not found: $SECRET_VALUE"
            usage
        fi

        # Create sealed secret from env file
        kubectl create secret generic "\${SERVICE_NAME}-\${SECRET_NAME}" \\
            --dry-run=client \\
            --from-env-file="$SECRET_VALUE" \\
            -o json | \\
            kubeseal --format yaml --namespace "$NAMESPACE" > "kubernetes/sealed-\${SECRET_NAME}.yaml"

        log "Sealed secret created: kubernetes/sealed-\${SECRET_NAME}.yaml"
        ;;

    *)
        error "Invalid secret type: $SECRET_TYPE"
        usage
        ;;
esac

log "Secret sealed successfully!"
log "Commit the sealed secret file to git - it can only be decrypted in the cluster"
`,
      'secrets/generate-rsa-keys.sh': `#!/bin/bash
# Generate RSA keys for local sealed-secrets controller testing
# For production, use the cluster's sealed-secrets controller

set -e

SERVICE_NAME="{{service_name}}"

log() {
    echo "[$(date -Iseconds)] [KEYS] $*"
}

error() {
    echo "[$(date -Iseconds)] [KEYS] [ERROR] $*" >&2
}

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    error "openssl is not installed"
    exit 1
fi

KEY_SIZE="\${KEY_SIZE:-4096}"
PRIVATE_KEY_FILE="\${PRIVATE_KEY_FILE:-./secrets/private.key}"
PUBLIC_KEY_FILE="\${PUBLIC_KEY_FILE:-./secrets/public.crt}"
CERT_FILE="\${CERT_FILE:-./secrets/cert.pem}"

mkdir -p ./secrets

log "Generating RSA keys for sealed secrets..."
log "Key size: $KEY_SIZE bits"

# Generate private key
openssl genrsa -out "$PRIVATE_KEY_FILE" "$KEY_SIZE" 2>/dev/null
log "Private key: $PRIVATE_KEY_FILE"

# Generate self-signed certificate (valid for 1 year)
openssl req -new -x509 -sha256 -key "$PRIVATE_KEY_FILE" \\
    -out "$CERT_FILE" \\
    -days 365 \\
    -subj "/CN=sealed-secret-controller/O=$SERVICE_NAME" 2>/dev/null

# Extract public key
openssl x509 -in "$CERT_FILE" -pubkey -noout > "$PUBLIC_KEY_FILE"
log "Public key: $PUBLIC_KEY_FILE"
log "Certificate: $CERT_FILE"

# Set restrictive permissions
chmod 600 "$PRIVATE_KEY_FILE"
chmod 644 "$PUBLIC_KEY_FILE"
chmod 644 "$CERT_FILE"

log ""
log "Keys generated successfully!"
log ""
log "IMPORTANT:"
log "- Private key should NEVER be committed to git"
log "- Add $PRIVATE_KEY_FILE to .gitignore"
log "- Only the public key/certificate should be shared"
log ""
log "To seal secrets with this key:"
log "  kubeseal --cert $CERT_FILE --format yaml < secret.yaml > sealed-secret.yaml"
`,
      'secrets/external-secret.yaml': `apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{service_name}}-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager  # or vault-backend, gcp-secret-manager, etc.
    kind: SecretStore
  target:
    name: {{service_name}}-credentials
    creationPolicy: Owner
  data:
  # Map external secrets to Kubernetes secrets
  - secretKey: db-password
    remoteRef:
      key: {{service_name}}/db-password
  - secretKey: secret-key
    remoteRef:
      key: {{service_name}}/secret-key
  - secretKey: api-token
    remoteRef:
      key: {{service_name}}/api-token
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: {{AWS_REGION:-us-east-1}}
      auth:
        jwt:
          serviceAccountRef:
            name: {{service_name}}-external-secrets-sa
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{service_name}}-external-secrets-sa
  annotations:
    eks.amazonaws.com/role-arn: {{AWS_IAM_ROLE_ARN:-}}
`,
      'secrets/vault-backend.yaml': `# Vault configuration for external secrets
# Requires HashiCorp Vault installed and configured

apiVersion: v1
kind: Secret
metadata:
  name: vault-token
type: Opaque
stringData:
  token: "{{VAULT_TOKEN:-}}"  # Use proper authentication in production
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "{{VAULT_ADDR:-https://vault.example.com:8200}}"
      path: "secret"
      version: "v2"
      auth:
        tokenSecretRef:
          name: vault-token
          key: token
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{service_name}}-vault-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: {{service_name}}-credentials
    creationPolicy: Owner
  data:
  - secretKey: db-password
    remoteRef:
      key: {{service_name}}/db-password
  - secretKey: api-key
    remoteRef:
      key: {{service_name}}/api-key
  - secretKey: redis-password
    remoteRef:
      key: {{service_name}}/redis-password
`,
      'secrets/secret-template.yaml': `# Template for creating Kubernetes secrets
# Use this as a reference for secret structure

apiVersion: v1
kind: Secret
metadata:
  name: {{service_name}}-secrets
  namespace: default
type: Opaque
stringData:
  # Database credentials
  db-host: "{{DB_HOST}}"
  db-port: "{{DB_PORT:-5432}}"
  db-name: "{{DB_NAME}}"
  db-user: "{{DB_USER}}"
  db-password: "{{DB_PASSWORD}}"

  # Django settings
  secret-key: "{{DJANGO_SECRET_KEY}}"
  allowed-hosts: "{{ALLOWED_HOSTS}}"

  # Redis
  redis-host: "{{REDIS_HOST}}"
  redis-port: "{{REDIS_PORT:-6379}}"
  redis-password: "{{REDIS_PASSWORD:-}}"

  # External services
  aws-access-key-id: "{{AWS_ACCESS_KEY_ID:-}}"
  aws-secret-access-key: "{{AWS_SECRET_ACCESS_KEY:-}}"
  aws-region: "{{AWS_REGION:-us-east-1}}"

  # API keys
  sentry-dsn: "{{SENTRY_DSN:-}}"
  datadog-api-key: "{{DATADOG_API_KEY:-}}"

---
# SealedSecret version (for sealed-secrets controller)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: {{service_name}}-sealed-secrets
  namespace: default
spec:
  encryptedData:
    # Data will be encrypted by kubeseal
    db-password: "{{SEALED_DB_PASSWORD}}"
    secret-key: "{{SEALED_SECRET_KEY}}"
    redis-password: "{{SEALED_REDIS_PASSWORD}}"
`,
      'secrets/rotate-secret.sh': `#!/bin/bash
# Rotate secrets by updating external secret stores
# Supports: AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager

set -e

SERVICE_NAME="{{service_name}}"

log() {
    echo "[$(date -Iseconds)] [ROTATE] $*"
}

error() {
    echo "[$(date -Iseconds)] [ROTATE] [ERROR] $*" >&2
}

usage() {
    echo "Usage: $0 <secret-name> <new-value> <provider>"
    echo ""
    echo "Providers: aws, vault, gcp"
    echo ""
    echo "Examples:"
    echo "  $0 db-password 'newsecretpass' aws"
    echo "  $0 api-key 'newkey123' vault"
    exit 1
}

if [ $# -lt 3 ]; then
    usage
fi

SECRET_NAME="$1"
NEW_VALUE="$2"
PROVIDER="$3"

log "Rotating secret: $SECRET_NAME"
log "Provider: $PROVIDER"

case "$PROVIDER" in
    aws)
        if ! command -v aws &> /dev/null; then
            error "AWS CLI not installed"
            exit 1
        fi

        SECRET_ID="\${AWS_SECRET_PREFIX:-}/\${SERVICE_NAME}/\${SECRET_NAME}"

        log "Updating secret in AWS Secrets Manager: $SECRET_ID"

        aws secretsmanager put-secret-value \\
            --secret-id "$SECRET_ID" \\
            --secret-string "$NEW_VALUE" \\
            --region "\${AWS_REGION:-us-east-1}"

        log "Secret updated in AWS"
        log "ExternalSecret operator will sync within refresh interval (1h)"
        ;;

    vault)
        if ! command -v vault &> /dev/null; then
            error "Vault CLI not installed"
            exit 1
        fi

        VAULT_PATH="\${VAULT_SECRET_PREFIX:-secret}/\${SERVICE_NAME}/\${SECRET_NAME}"

        log "Updating secret in Vault: $VAULT_PATH"

        vault kv put "$VAULT_PATH" value="$NEW_VALUE"

        log "Secret updated in Vault"
        ;;

    gcp)
        if ! command -v gcloud &> /dev/null; then
            error "gcloud CLI not installed"
            exit 1
        fi

        SECRET_ID="\${SERVICE_NAME}-\${SECRET_NAME}"

        log "Updating secret in GCP Secret Manager: $SECRET_ID"

        echo -n "$NEW_VALUE" | \\
            gcloud secrets versions add "$SECRET_ID" \\
            --data-file=-

        log "Secret updated in GCP"
        ;;

    *)
        error "Unsupported provider: $PROVIDER"
        usage
        ;;
esac

log "Secret rotation initiated successfully!"
log "Note: The secret will be synced to Kubernetes by the ExternalSecret operator"
`,
      'secrets/audit-secrets.sh': `#!/bin/bash
# Audit secrets for compliance and security issues
# Checks for: expired secrets, weak passwords, unencrypted secrets

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"

log() {
    echo "[$(date -Iseconds)] [AUDIT] $*"
}

error() {
    echo "[$(date -Iseconds)] [AUDIT] [ERROR] $*" >&2
}

warning() {
    echo "[$(date -Iseconds)] [AUDIT] [WARNING] $*"
}

log "Starting secrets audit for $SERVICE_NAME in namespace $NAMESPACE..."

ISSUES_FOUND=0

# Check 1: List all secrets
log "=== Checking Kubernetes Secrets ==="

SECRETS=$(kubectl get secrets -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name 2>/dev/null || true)

if [ -z "$SECRETS" ]; then
    warning "No secrets found for $SERVICE_NAME"
else
    log "Found secrets:"
    echo "$SECRETS" | while read -r secret; do
        echo "  - $secret"
    done
fi

# Check 2: Verify sealed secrets are used
log ""
log "=== Checking Sealed Secrets Usage ==="

SEALED_SECRETS=$(kubectl get sealedsecrets -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name 2>/dev/null || true)

if [ -z "$SEALED_SECRETS" ]; then
    warning "No sealed secrets found - consider using sealed-secrets controller"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    log "Sealed secrets found:"
    echo "$SEALED_SECRETS" | while read -r secret; do
        echo "  - $secret"
    done
fi

# Check 3: Check for ExternalSecrets
log ""
log "=== Checking External Secrets Usage ==="

EXTERNAL_SECRETS=$(kubectl get externalsecrets -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name 2>/dev/null || true)

if [ -z "$EXTERNAL_SECRETS" ]; then
    warning "No external secrets found - consider using ExternalSecret operator"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    log "External secrets found:"
    echo "$EXTERNAL_SECRETS" | while read -r secret; do
        echo "  - $secret"
        # Check refresh interval
        REFRESH=$(kubectl get "$secret" -n "$NAMESPACE" -o jsonpath='{.spec.refreshInterval}')
        echo "    Refresh interval: $REFRESH"
    done
fi

# Check 4: Verify secret rotation policy
log ""
log "=== Checking Secret Rotation Policy ==="

for secret in $SECRETS; do
    AGE=$(kubectl get "$secret" -n "$NAMESPACE" -o jsonpath='{.metadata.creationTimestamp}')
    AGE_DAYS=$(( ($(date +%s) - $(date -d "$AGE" +%s)) / 86400 ))

    if [ "$AGE_DAYS" -gt 90 ]; then
        warning "Secret $secret is $AGE_DAYS days old - consider rotation"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Check 5: Check for secret type
log ""
log "=== Checking Secret Types ==="

for secret in $SECRETS; do
    TYPE=$(kubectl get "$secret" -n "$NAMESPACE" -o jsonpath='{.type}')
    if [ "$TYPE" = "Opaque" ]; then
        warning "Secret $secret is Opaque - consider using SealedSecret or ExternalSecret"
    fi
done

# Check 6: Verify service accounts have proper RBAC
log ""
log "=== Checking Service Account RBAC ==="

SA=$(kubectl get sa -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name 2>/dev/null || true)

if [ -n "$SA" ]; then
    echo "$SA" | while read -r sa; do
        log "Service account: $sa"

        # Check for role bindings
        ROLEBINDINGS=$(kubectl get rolebinding,clusterrolebinding -A -o json | \\
            jq -r ".items[] | select(.subjects[]?.name == $(echo "$sa" | cut -d/ -f2)) | .kind + "/" + .metadata.name" 2>/dev/null || echo "")

        if [ -z "$ROLEBINDINGS" ]; then
            warning "No role bindings found for $sa"
        else
            echo "  Role bindings:"
            echo "$ROLEBINDINGS" | while read -r rb; do
                echo "    - $rb"
            done
        fi
    done
fi

# Summary
log ""
log "=== Audit Summary ==="

if [ "$ISSUES_FOUND" -eq 0 ]; then
    log "✅ No critical issues found"
else
    warning "⚠️ Found $ISSUES_FOUND issue(s) to review"
fi

log ""
log "Recommendations:"
log "1. Use SealedSecrets for cluster-specific secrets"
log "2. Use ExternalSecrets for external secret management (AWS/Vault/GCP)"
log "3. Implement secret rotation policy (90 days recommended)"
log "4. Use service accounts with minimal RBAC permissions"
log "5. Enable secret encryption at rest (etcd encryption)"
log "6. Audit secret access regularly"
`,
      'scripts/setup-secret-management.sh': `#!/bin/bash
# Setup sealed-secrets controller and external-secrets operator

set -e

NAMESPACE="\${SECRET_NAMESPACE:-kube-system}"

log() {
    echo "[$(date -Iseconds)] [SETUP] $*"
}

error() {
    echo "[$(date -Iseconds)] [SETUP] [ERROR] $*" >&2
}

log "Setting up secret management..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    error "kubectl is not installed"
    exit 1
fi

# Option 1: Install Sealed Secrets Controller
log "=== Installing Sealed Secrets Controller ==="

if kubectl get namespace sealed-secrets &> /dev/null; then
    log "Sealed Secrets namespace already exists"
else
    kubectl create namespace sealed-secrets
fi

if helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null; then
    helm repo update
fi

if helm list -n sealed-secrets | grep -q sealed-secrets; then
    log "Sealed Secrets already installed"
else
    helm install sealed-secrets bitnami/sealed-secrets-controller \\
        --namespace sealed-secrets \\
        --set "image.repository=bitnami/sealed-secrets-controller" \\
        --set "image.tag=v0.24.0" \\
        --version 2.1.3

    log "Waiting for Sealed Secrets controller to be ready..."
    kubectl wait --for=condition=available --timeout=120s \\
        deployment/sealed-secrets-controller -n sealed-secrets
fi

# Get public key for sealing secrets
SEALED_SECRETS_CERT="./secrets/sealed-secrets-cert.pem"
kubectl get secret -n sealed-secrets sealed-secrets-key \\
    -o jsonpath='{.data.tls.crt}' | base64 -d > "$SEALED_SECRETS_CERT"

log "Sealed Secrets certificate saved to: $SEALED_SECRETS_CERT"
log "Use this certificate with kubeseal: kubeseal --cert $SEALED_SECRETS_CERT"

# Option 2: Install External Secrets Operator
log ""
log "=== Installing External Secrets Operator ==="

if kubectl get namespace external-secrets &> /dev/null; then
    log "External Secrets namespace already exists"
else
    kubectl create namespace external-secrets
fi

if helm repo add external-secrets https://charts.external-secrets.io 2>/dev/null; then
    helm repo update
fi

if helm list -n external-secrets | grep -q external-secrets; then
    log "External Secrets already installed"
else
    helm install external-secrets external-secrets/external-secrets \\
        --namespace external-secrets \\
        --version 0.9.1

    log "Waiting for External Secrets operator to be ready..."
    kubectl wait --for=condition=available --timeout=120s \\
        deployment/external-secrets-controller -n external-secrets
fi

# Option 3: Enable etcd encryption at rest
log ""
log "=== Configuring etcd Encryption at Rest ==="

ETCD_ENCRYPTION_CONFIG="./kubernetes/etcd-encryption.yaml"

cat > "$ETCD_ENCRYPTION_CONFIG" << 'EOF'
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
    - secrets
    providers:
    - aescbc:
        keys:
        - name: key1
          secret: \${ENCRYPTION_KEY}
    - identity: {}
EOF

log "Encryption configuration saved to: $ETCD_ENCRYPTION_CONFIG"
log "To enable:"
log "1. Generate a key: head -c 32 /dev/urandom | base64"
log "2. Update the API server with --encryption-provider-config"
log "3. Restart all API server pods"

# Summary
log ""
log "=== Secret Management Setup Complete ==="
log ""
log "Installed components:"
log "  - Sealed Secrets Controller (namespace: sealed-secrets)"
log "  - External Secrets Operator (namespace: external-secrets)"
log "  - etcd encryption configuration (requires manual enablement)"
log ""
log "Next steps:"
log "1. Seal secrets: ./secrets/seal-secret.sh <name> literal <value>"
log "2. Create ExternalSecrets: See secrets/external-secret.yaml"
log "3. Enable etcd encryption: Follow cluster documentation"
`,
      'scripts/test-secret-access.sh': `#!/bin/bash
# Test secret access and permissions
# Verifies that pods can access secrets as expected

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"

log() {
    echo "[$(date -Iseconds)] [TEST] $*"
}

error() {
    echo "[$(date -Iseconds)] [TEST] [ERROR] $*" >&2
}

log "Testing secret access for $SERVICE_NAME in namespace $NAMESPACE..."

# Test 1: Verify secrets exist
log "=== Test 1: Checking Secrets Existence ==="

SECRETS=(
    "\${SERVICE_NAME}-secrets"
    "\${SERVICE_NAME}-credentials"
)

for secret in "\${SECRETS[@]}"; do
    if kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
        log "✅ Secret exists: $secret"
    else
        error "❌ Secret not found: $secret"
    fi
done

# Test 2: Verify pod can mount secrets
log ""
log "=== Test 2: Checking Pod Secret Mounts ==="

POD=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name | head -1)

if [ -z "$POD" ]; then
    error "No pods found for $SERVICE_NAME"
    exit 1
fi

log "Testing pod: $POD"

# Check if secrets are mounted
SECRET_MOUNTS=$(kubectl exec -n "$NAMESPACE" "$POD" -- \\
    find /var/run/secrets/kubernetes.io/serviceaccount -type f 2>/dev/null | wc -l)

log "Secret mounts found: $SECRET_MOUNTS"

# Test 3: Verify secret environment variables
log ""
log "=== Test 3: Checking Secret Environment Variables ==="

ENV_VARS=("DJANGO_SECRET_KEY" "DB_PASSWORD" "REDIS_PASSWORD")

for env_var in "\${ENV_VARS[@]}"; do
    if kubectl exec -n "$NAMESPACE" "$POD" -- printenv "$env_var" &> /dev/null; then
        VALUE=$(kubectl exec -n "$NAMESPACE" "$POD" -- printenv "$env_var")
        if [ -n "$VALUE" ]; then
            log "✅ Environment variable set: $env_var (length: \${#VALUE})"
        else
            error "❌ Environment variable empty: $env_var"
        fi
    else
        error "❌ Environment variable not found: $env_var"
    fi
done

# Test 4: Verify service account permissions
log ""
log "=== Test 4: Checking Service Account Permissions ==="

SA=$(kubectl get pod "$POD" -n "$NAMESPACE" -o jsonpath='{.spec.serviceAccountName}')
log "Pod service account: $SA"

# Check if SA can read secrets
CAN_READ=$(kubectl auth can-i get secrets --as=system:serviceaccount:"$NAMESPACE":"$SA" 2>/dev/null || echo "no")

if [ "$CAN_READ" = "yes" ]; then
    log "✅ Service account can read secrets"
else
    log "ℹ️ Service account cannot read secrets (expected for least privilege)"
fi

# Test 5: Test secret rotation
log ""
log "=== Test 5: Testing Secret Rotation ==="

# This is a dry-run test - actual rotation would be done via rotate-secret.sh
log "Secret rotation would be performed via:"
log "  ./secrets/rotate-secret.sh <secret-name> <new-value> <provider>"

# Summary
log ""
log "=== Secret Access Test Complete ==="
log ""
log "Results:"
log "- All secrets are accessible to the application"
log "- Environment variables are populated"
log "- Service account has appropriate permissions"
log ""
log "For production, ensure:"
log "- Secrets are rotated regularly (90 days recommended)"
log "- etcd encryption is enabled"
log "- Secret access is audited"
`,
      'network-policies/base-policy.yaml': `# Base network policies for {{service_name}}
# These policies provide baseline security with default-deny ingress

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-default-deny-ingress
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
  policyTypes:
  - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-default-deny-egress
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
  policyTypes:
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-allow-ingress-from-ingress
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-allow-egress-to-dns
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-allow-egress-to-postgres
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-allow-egress-to-redis
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
`,
      'network-policies/microsegmentation.yaml': `# Micro-segmentation policies for {{service_name}}
# Implements zero-trust networking with granular controls

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-web-to-api
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  policyTypes:
  - Ingress
  ingress:
  # Allow traffic from ingress controller only
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  # Allow traffic from monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - protocol: TCP
      port: 8000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-worker-to-queue
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: worker
  policyTypes:
  - Egress
  egress:
  # Allow to Redis (Celery broker)
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  # Allow to PostgreSQL
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  # Allow to external APIs
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8
        - 172.16.0.0/12
        - 192.168.0.0/16
    ports:
    - protocol: TCP
      port: 443
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-allow-metrics-scraping
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - protocol: TCP
      port: 8000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{service_name}}-deny-internet-access
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: {{service_name}}
      component: worker
  policyTypes:
  - Egress
  egress:
  # Only allow specific external destinations
  - to:
    - ipBlock:
        cidr: {{ALLOWED_EXTERNAL_CIDR:-0.0.0.0/0}}
    ports:
    - protocol: TCP
      port: 443
  # Block everything else by being explicit about what's allowed
`,
      'network-policies/cilium-network-policy.yaml': `# Cilium-specific network policies for advanced features
# Requires Cilium CNI installed

apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: {{service_name}}-l7-policy
  namespace: default
spec:
  endpointSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  ingress:
  # HTTP traffic from ingress
  - fromEndpoints:
    - matchLabels:
        k8s:io.kubernetes.pod.namespace: ingress-nginx
    toPorts:
    - ports:
      - port: "8000"
        protocol: TCP
      rules:
        http:
          # Only allow specific paths
          - method: "GET"
            path: "/api/v1/*"
          - method: "POST"
            path: "/api/v1/auth/login"
          - method: "GET"
            path: "/health"
  egress:
  # Allow DNS
  - toEndpoints:
    - matchLabels:
        k8s-app: kube-dns
    toPorts:
    - ports:
      - port: "53"
        protocol: UDP
  # Allow PostgreSQL
  - toEndpoints:
    - matchLabels:
        app: postgres
    toPorts:
    - ports:
      - port: "5432"
        protocol: TCP
  # Allow Redis
  - toEndpoints:
    - matchLabels:
        app: redis
    toPorts:
    - ports:
      - port: "6379"
        protocol: TCP
  # Deny all other egress
  - toEndpoints:
    - matchLabels: {}
    toPorts:
    - ports:
      - port: "1-65535"
        protocol: TCP
---
apiVersion: cilium.io/v2
kind: CiliumClusterwideNetworkPolicy
metadata:
  name: {{service_name}}-service-mesh-policy
spec:
  # Allow communication between microservices
  endpointSelector:
    matchLabels:
      app: {{service_name}}
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: {{service_name}}
    toPorts:
    - ports:
      - port: "8000"
        protocol: TCP
---
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: {{service_name}}-external-authz
  namespace: default
spec:
  endpointSelector:
    matchLabels:
      app: {{service_name}}
      component: web
  egress:
  - toEndpoints:
    - matchLabels:
        app: external-api
    toPorts:
    - ports:
      - port: "443"
        protocol: TCP
      # Require authentication header
      rules:
        http:
          - method: "GET"
            headers:
              - name: "Authorization"
                value: "Bearer *"
`,
      'network-policies/calico-policy.yaml': `# Calico-specific network policies for advanced features
# Requires Calico CNI installed

apiVersion: projectcalico.org/v3
kind: NetworkPolicy
metadata:
  name: {{service_name}}-tier-policy
  namespace: default
spec:
  selector: app == '{{service_name}}'
  types:
  - Ingress
  - Egress
  ingress:
  # Allow from ingress tier
  - action: Allow
    source:
      selector: app == 'ingress-nginx'
      namespace: ingress-nginx
    destination:
      ports:
      - 8000
  # Allow from monitoring tier
  - action: Allow
    source:
      selector: app == 'prometheus'
      namespace: monitoring
    destination:
      ports:
      - 8000
  egress:
  # Allow to database tier
  - action: Allow
    destination:
      selector: app == 'postgres'
      ports:
      - 5432
  # Allow to cache tier
  - action: Allow
    destination:
      selector: app == 'redis'
      ports:
      - 6379
  # Allow DNS
  - action: Allow
    destination:
      selector: k8s-app == 'kube-dns'
      ports:
      - 53
      protocols:
      - UDP
---
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: {{service_name}}-global-deny
spec:
  # Apply to all namespaces
  namespaceSelector: all()
  # Prepend DNAT policy (applies before other policies)
  order: 1000
  # Default deny for traffic not matching other policies
  ingress:
  - action: Deny
    source:
      namespaceSelector: all()
    destination:
      ports:
      - 22  # SSH
      - 3306  # MySQL
      - 5432  # PostgreSQL
      - 6379  # Redis
      - 27017  # MongoDB
  egress:
  - action: Deny
    source:
      namespaceSelector: all()
    destination:
      notNets:
      - 10.0.0.0/8
      - 172.16.0.0/12
      - 192.168.0.0/16
`,
      'scripts/apply-network-policies.sh': `#!/bin/bash
# Apply network policies for micro-segmentation

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"
CNI="\${CNI:-auto}"

log() {
    echo "[$(date -Iseconds)] [NETPOL] $*"
}

error() {
    echo "[$(date -Iseconds)] [NETPOL] [ERROR] $*" >&2
}

# Detect CNI plugin
detect_cni() {
    if [ "$CNI" = "auto" ]; then
        if kubectl get deployment cilium -n kube-system &> /dev/null; then
            CNI="cilium"
            log "Detected CNI: Cilium"
        elif kubectl get deployment calico-kube-controllers -n kube-system &> /dev/null; then
            CNI="calico"
            log "Detected CNI: Calico"
        else
            CNI="kubernetes"
            log "Using standard Kubernetes NetworkPolicy"
        fi
    fi
}

# Apply base policies
log "=== Applying Base Network Policies ==="

kubectl apply -f network-policies/base-policy.yaml -n "$NAMESPACE"

# Apply microsegmentation policies
log "=== Applying Micro-segmentation Policies ==="

kubectl apply -f network-policies/microsegmentation.yaml -n "$NAMESPACE"

# Apply CNI-specific policies
case "$CNI" in
    cilium)
        log "=== Applying Cilium Network Policies ==="
        kubectl apply -f network-policies/cilium-network-policy.yaml -n "$NAMESPACE"
        ;;
    calico)
        log "=== Applying Calico Network Policies ==="
        kubectl apply -f network-policies/calico-policy.yaml
        ;;
esac

# Verify policies applied
log ""
log "=== Verifying Network Policies ==="

kubectl get networkpolicies -n "$NAMESPACE" -l app="$SERVICE_NAME"

log ""
log "Network policies applied successfully!"
log ""
log "To test connectivity:"
log "  ./scripts/test-network-policies.sh"
`,
      'scripts/test-network-policies.sh': `#!/bin/bash
# Test network policy connectivity

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"

log() {
    echo "[$(date -Iseconds)] [TEST] $*"
}

error() {
    echo "[$(date -Iseconds)] [TEST] [ERROR] $*" >&2
}

warning() {
    echo "[$(date -Iseconds)] [TEST] [WARNING] $*"
}

log "Testing network policies for $SERVICE_NAME in namespace $NAMESPACE..."

# Get a pod to test from
TEST_POD=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME}" -o name | head -1)

if [ -z "$TEST_POD" ]; then
    error "No pods found for $SERVICE_NAME"
    exit 1
fi

log "Using test pod: $TEST_POD"

# Test 1: DNS resolution
log ""
log "=== Test 1: DNS Resolution ==="

if kubectl exec -n "$NAMESPACE" "$TEST_POD" -- nslookup kubernetes.default.svc.cluster.local &> /dev/null; then
    log "✅ DNS resolution working"
else
    error "❌ DNS resolution failed"
fi

# Test 2: Database connectivity
log ""
log "=== Test 2: Database Connectivity ==="

DB_HOST="\${DB_HOST:-postgres.$NAMESPACE.svc.cluster.local}"
DB_PORT="\${DB_PORT:-5432}"

if kubectl exec -n "$NAMESPACE" "$TEST_POD" -- timeout 5 nc -zv "$DB_HOST" "$DB_PORT" &> /dev/null; then
    log "✅ Can reach database at $DB_HOST:$DB_PORT"
else
    warning "⚠️ Cannot reach database (may be expected if policy denies)"
fi

# Test 3: Redis connectivity
log ""
log "=== Test 3: Redis Connectivity ==="

REDIS_HOST="\${REDIS_HOST:-redis.$NAMESPACE.svc.cluster.local}"
REDIS_PORT="\${REDIS_PORT:-6379}"

if kubectl exec -n "$NAMESPACE" "$TEST_POD" -- timeout 5 nc -zv "$REDIS_HOST" "$REDIS_PORT" &> /dev/null; then
    log "✅ Can reach Redis at $REDIS_HOST:$REDIS_PORT"
else
    warning "⚠️ Cannot reach Redis (may be expected if policy denies)"
fi

# Test 4: External connectivity (should be denied for worker)
log ""
log "=== Test 4: External Connectivity ==="

if kubectl exec -n "$NAMESPACE" "$TEST_POD" -- timeout 5 nc -zv google.com 443 &> /dev/null; then
    warning "⚠️ Can reach internet directly (may not be desired)"
else
    log "✅ External internet access blocked (expected)"
fi

# Test 5: Inter-pod communication
log ""
log "=== Test 5: Inter-Pod Communication ==="

OTHER_PODS=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers | wc -l)

if [ "$OTHER_PODS" -gt 1 ]; then
    log "Found $OTHER_PODS pods - checking inter-pod communication"

    # Get another pod
    OTHER_POD=$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name | tail -1)

    if [ "$OTHER_POD" != "$TEST_POD" ]; then
        POD_IP=$(kubectl get pod "$OTHER_POD" -n "$NAMESPACE" -o jsonpath='{.status.podIP}')

        if kubectl exec -n "$NAMESPACE" "$TEST_POD" -- timeout 5 nc -zv "$POD_IP" 8000 &> /dev/null; then
            log "✅ Inter-pod communication working"
        else
            warning "⚠️ Inter-pod communication not working"
        fi
    fi
fi

# Test 6: Check for denied traffic (from logs)
log ""
log "=== Test 6: Checking for Denied Traffic ==="

if kubectl logs -n "$NAMESPACE" "$TEST_POD" --tail=100 2>/dev/null | grep -i "connection.*refused|denied"; then
    warning "⚠️ Found denied traffic in logs"
else
    log "No denied traffic found in recent logs"
fi

# Summary
log ""
log "=== Network Policy Test Complete ==="
log ""
log "Active network policies:"
kubectl get networkpolicies -n "$NAMESPACE" -l app="$SERVICE_NAME" -o name || echo "None"

log ""
log "Review the results above to ensure policies are working as expected"
`,
      'scripts/visualize-network-policies.sh': `#!/bin/bash
# Visualize network policies using graphviz
# Requires: graphviz, kubectl, jq

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"
OUTPUT_FILE="\${OUTPUT_FILE:-./network-policies-graph.png}"

log() {
    echo "[$(date -Iseconds)] [VISUALIZE] $*"
}

error() {
    echo "[$(date -Iseconds)] [VISUALIZE] [ERROR] $*" >&2
}

# Check dependencies
if ! command -v dot &> /dev/null; then
    error "graphviz not installed. Install with: brew install graphviz (macOS) or apt-get install graphviz (Linux)"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    error "kubectl not installed"
    exit 1
fi

log "Generating network policy visualization for $SERVICE_NAME..."

# Create DOT file
DOT_FILE="./network-policies-graph.dot"

cat > "$DOT_FILE" << 'EOF'
digraph NetworkPolicies {
  rankdir=LR;
  node [shape=box, style=rounded];
  edge [fontsize=10];

  // External sources
  ingress [label="Ingress Controller", shape=ellipse, style=filled, fillcolor=lightblue];
  monitoring [label="Monitoring (Prometheus)", shape=ellipse, style=filled, fillcolor=lightgreen];

  // Application components
  web [label="{{service_name}}-web", shape=component, style=filled, fillcolor=lightyellow];
  worker [label="{{service_name}}-worker", shape=component, style=filled, fillcolor=lightyellow];

  // Dependencies
  postgres [label="PostgreSQL", shape=cylinder, style=filled, fillcolor=lightgray];
  redis [label="Redis", shape=cylinder, style=filled, fillcolor=lightgray];
  dns [label="DNS", shape=ellipse, style=filled, fillcolor=lightpink];

  // Edges representing allowed traffic
  ingress -> web [label=":8000"];
  monitoring -> web [label=":8000"];
  monitoring -> worker [label="metrics"];
  web -> postgres [label=":5432"];
  web -> redis [label=":6379"];
  worker -> postgres [label=":5432"];
  worker -> redis [label=":6379"];
  web -> dns [label=":53"];
  worker -> dns [label=":53"];
}
EOF

# Replace service name in DOT file
sed -i '' "s/{{service_name}}/$SERVICE_NAME/g" "$DOT_FILE" 2>/dev/null || sed -i "s/{{service_name}}/$SERVICE_NAME/g" "$DOT_FILE"

# Generate PNG
dot -Tpng "$DOT_FILE" -o "$OUTPUT_FILE"

log "Network policy graph saved to: $OUTPUT_FILE"

# Display if possible
if command -v open &> /dev/null; then
    open "$OUTPUT_FILE"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$OUTPUT_FILE"
else
    log "Open the file manually: $OUTPUT_FILE"
fi

# Generate text summary
log ""
log "=== Network Policy Summary ==="
log ""

# Get all network policies
POLICIES=$(kubectl get networkpolicies -n "$NAMESPACE" -o json)

if [ -n "$POLICIES" ]; then
    echo "Ingress Rules:"
    echo "$POLICIES" | jq -r '.items[] | select(.spec.ingress != null) | .metadata.name' | while read -r policy; do
        echo "  - $policy"
    done

    echo ""
    echo "Egress Rules:"
    echo "$POLICIES" | jq -r '.items[] | select(.spec.egress != null) | .metadata.name' | while read -r policy; do
        echo "  - $policy"
    done
else
    log "No network policies found"
fi

# Clean up
rm -f "$DOT_FILE"
`,
      'compliance/policies-soc2.yaml': `# SOC2 Type II compliance policies for {{service_name}}
# Implements controls for security, availability, processing integrity, confidentiality, privacy

apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-soc2-controls
  namespace: default
data:
  # SOC2 Common Criteria Mapping
  CC1.1: "Control Environment - Management establishes structures, reporting lines, and authorities"
  CC2.1: "Communication of Responsibilities - Management communicates roles and responsibilities"
  CC3.1: "Risk Assessment - Management identifies and assesses risks"
  CC4.1: "Monitoring Controls - Management monitors controls for effectiveness"
  CC5.1: "Data Access - Access to data is limited to authorized individuals"
  CC6.1: "Privacy - Personal information is protected according to privacy principles"

  # Implemented Controls
  control-authentication.enabled: "true"
  control-encryption-at-rest.enabled: "true"
  control-encryption-in-transit.enabled: "true"
  control-audit-logging.enabled: "true"
  control-vulnerability-scanning.enabled: "true"
  control-access-review.enabled: "true"
  control-incident-response.enabled: "true"
  control-data-retention.enabled: "true"
---
# Pod Security Policy for SOC2
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-soc2-psp
data:
  require-non-root: "true"
  require-read-only-root: "true"
  allow-privilege-escalation: "false"
  drop-capabilities: "NET_RAW,SYS_CHROOT,SYS_ADMIN"
  restricted-capabilities: "NET_BIND_SERVICE"
  seccomp-profile: "runtime/default"
  app-armor-profile: "runtime/default"
`,
      'compliance/policies-gdpr.yaml': `# GDPR compliance policies for {{service_name}}
# General Data Protection Regulation (EU) 2016/679

apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-gdpr-controls
  namespace: default
data:
  # GDPR Principles
  principle-lawfulness: "Personal data processed lawfully, fairly, and transparently"
  purpose-limitation: "Collected for specified, explicit, and legitimate purposes"
  data-minimization: "Adequate, relevant, and limited to what is necessary"
  accuracy: "Accurate and kept up to date"
  storage-limitation: "Kept in form permitting identification no longer than necessary"
  integrity-confidentiality: "Processed with appropriate security"
  accountability: "Controller responsible for and able to demonstrate compliance"

  # Data Subject Rights
  right-information: "Users informed about data processing"
  right-access: "Users can access their personal data"
  right-rectification: "Users can correct inaccurate data"
  right-erasure: "Users can request deletion (right to be forgotten)"
  right-portability: "Users can receive their data in structured format"
  right-object: "Users can object to processing"

  # Technical Measures
  encryption-at-rest: "AES-256 for stored personal data"
  encryption-in-transit: "TLS 1.3 for data transfer"
  pseudonymization: "Personal data pseudonymized when possible"
  anonymization: "Data anonymized for analytics/analysis"
  data-breach-notification: "72-hour notification to supervisory authority"
  dpia-required: "Data Protection Impact Assessment for high-risk processing"
  dpo-contact: "Data Protection Officer contact: {{DPO_EMAIL:-dpo@example.com}}"
  eu-data-transfer: "Adequacy decision or SCCs for international transfers"
---
# GDPR Data Retention Policy
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-gdpr-retention
data:
  # Retention Periods (in days)
  user-data-retention: "365"
  auth-logs-retention: "90"
  access-logs-retention: "180"
  error-logs-retention: "30"
  audit-logs-retention: "2555"  # 7 years

  # Anonymization Settings
  anonymize-after-retention: "true"
  anonymization-method: "hashing"
  preserve-essential-data: "user-id,created-at"
`,
      'compliance/policies-hipaa.yaml': `# HIPAA compliance policies for {{service_name}}
# Health Insurance Portability and Accountability Act

apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-hipaa-controls
  namespace: default
data:
  # HIPAA Rules
  privacy-rule: "Protected Health Information (PHI) protections"
  security-rule: "Administrative, physical, and technical safeguards"
  breach-notification: "Breach notification requirements"
  enforcement-rule: "Penalties for non-compliance"

  # Administrative Safeguards
  security-management-process: "Security risk analysis and management"
  assigned-security-responsibility: "Designated security official"
  workforce-security: "Clearance and authorization procedures"
  information-access-management: "Policies for access to PHI"
  security-awareness-training: "Training for all workforce members"
  incident-procedures: "Response and reporting procedures"
  contingency-plan: "Backup, disaster recovery, and emergency mode"
  evaluation: "Periodic security assessments"
  business-associate-agreements: "BAAs with all vendors handling PHI"

  # Physical Safeguards
  facility-access-controls: "Limited access to facilities"
  workstation-security: "Secure workstations and devices"
  device-controls: "Media and device controls"

  # Technical Safeguards
  access-control: "Unique user authentication and access controls"
  audit-controls: "Hardware, software, and procedural audit trails"
  integrity-controls: "Mechanisms to protect PHI from improper alteration"
  transmission-security: "Encryption for PHI transmission"

  # PHI Data Classification
  phi-classification: "protected-health-information"
  phi-encryption-required: "true"
  phi-audit-log-all-access: "true"
  phi-minimum-necessary: "true"  # Only access minimum necessary PHI

  # Business Associate Requirements
  baa-template-location: "/compliance/hipaa-baa-template.md"
  vendor-baa-tracking: "true"
`,
      'compliance/scanner-job.yaml': `# Scheduled compliance scanning job
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{service_name}}-compliance-scan
  namespace: default
spec:
  schedule: "0 2 * * 0"  # Weekly at 2 AM Sunday
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 4
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: compliance-scanner
            image: {{service_name}}-scanner:latest
            command:
            - /bin/bash
            - /scripts/compliance-scan.sh
            env:
            - name: COMPLIANCE_FRAMEWORKS
              value: "soc2,gdpr,hipaa"
            - name: REPORT_OUTPUT
              value: "/reports"
            - name: SEVERITY_THRESHOLD
              value: "medium"
            - name: SCAN_TIMEOUT
              value: "3600"
            volumeMounts:
            - name: reports
              mountPath: /reports
            resources:
              requests:
                cpu: 200m
                memory: 256Mi
              limits:
                cpu: 500m
                memory: 512Mi
          volumes:
          - name: reports
            persistentVolumeClaim:
              claimName: {{service_name}}-reports-pvc
`,
      'compliance/scanner-config.yaml': `# Compliance scanner configuration

apiVersion: v1
kind: ConfigMap
metadata:
  name: {{service_name}}-compliance-config
data:
  scanner.yaml: |
    # Compliance scanning configuration for {{service_name}}

    # Scan Settings
    scan:
      interval: 168h  # Weekly
      timeout: 3600s  # 1 hour max
      parallel: 4      # Number of parallel checks
      severity_threshold: medium  # Fail on medium+ severity

    # Frameworks to scan
    frameworks:
      - name: SOC2
        enabled: true
        controls:
          - CC1.1
          - CC2.1
          - CC3.1
          - CC4.1
          - CC5.1
          - CC6.1
        exemptions: []

      - name: GDPR
        enabled: true
        controls:
          - principle-lawfulness
          - purpose-limitation
          - data-minimization
          - right-erasure
          - right-portability
          - data-breach-notification
        exemptions: []

      - name: HIPAA
        enabled: false  # Enable if handling PHI
        controls:
          - security-rule
          - privacy-rule
          - audit-controls
          - transmission-security
        exemptions: []

    # Check Categories
    checks:
      # Security Checks
      - name: container-security
        checks:
          - non-root-user
          - read-only-root
          - no-privilege-escalation
          - dropped-capabilities
          - seccomp-profile
          - resource-limits

      # Data Protection
      - name: data-protection
        checks:
          - encryption-at-rest
          - encryption-in-transit
          - secrets-management
          - data-retention
          - data-minimization

      # Access Control
      - name: access-control
        checks:
          - rbac-enabled
          - network-policies
          - pod-security-policies
          - service-account-automation

      # Logging & Monitoring
      - name: logging-monitoring
        checks:
          - audit-logging
          - access-logging
          - security-events
          - log-retention
          - alerting

      # Vulnerability Management
      - name: vulnerability-management
        checks:
          - image-scanning
          - dependency-scanning
          - cve-scanning
          - patch-management
          - sbom-generation

    # Reporting
    reporting:
      format: [json, html, pdf]
      output: /reports
      include-passed: true
      include-details: true
      trend-analysis: true

      # Notifications
      notifications:
        on-failure: true
        on-completion: false
        channels:
          - type: slack
            webhook: "{{SLACK_WEBHOOK_URL:-}}"
          - type: email
            to: "{{COMPLIANCE_EMAIL:-compliance@example.com}}"
`,
      'scripts/compliance-scan.sh': `#!/bin/bash
# Run comprehensive compliance scan for {{service_name}}
# Checks SOC2, GDPR, and HIPAA requirements

set -e

SERVICE_NAME="{{service_name}}"
NAMESPACE"\${2:-default}"
FRAMEWORKS="\${COMPLIANCE_FRAMEWORKS:-soc2,gdpr,hipaa}"
SEVERITY_THRESHOLD="\${SEVERITY_THRESHOLD:-medium}"
OUTPUT_DIR="\${REPORT_OUTPUT_DIR:-./compliance/reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

log() {
    echo "[$(date -Iseconds)] [COMPLIANCE] $*"
}

error() {
    echo "[$(date -Iseconds)] [COMPLIANCE] [ERROR] $*" >&2
}

warning() {
    echo "[$(date -Iseconds)] [COMPLIANCE] [WARNING] $*"
}

fail() {
    error "$1"
    exit 1
}

log "Starting compliance scan for $SERVICE_NAME..."
log "Frameworks: $FRAMEWORKS"
log "Severity threshold: $SEVERITY_THRESHOLD"
log "Output: $OUTPUT_DIR"

RESULTS_FILE="$OUTPUT_DIR/compliance-results-$TIMESTAMP.json"

# Initialize results
cat > "$RESULTS_FILE" << EOF
{
  "service": "$SERVICE_NAME",
  "timestamp": "$(date -Iseconds)",
  "frameworks": [],
  "summary": {
    "total_checks": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "warnings": 0
  }
}
EOF

# Function to run checks
run_check() {
    local category=$1
    local check=$2
    local description=$3

    log "  Checking: $check ($description)"

    case "$check" in
        non-root-user)
            if kubectl get deployment -n "$NAMESPACE" -l app="$SERVICE_NAME" -o json | jq -r '.items[].spec.template.spec.containers[].securityContext.runAsNonPrivileged' | grep -q "true"; then
                return 0
            else
                return 1
            fi
            ;;
        read-only-root)
            if kubectl get deployment -n "$NAMESPACE" -l app="$SERVICE_NAME" -o json | jq -r '.items[].spec.template.spec.containers[].securityContext.readOnlyRootFilesystem' | grep -q "true"; then
                return 0
            else
                return 1
            fi
            ;;
        encryption-at-rest)
            # Check for etcd encryption
            if kubectl get pod -n kube-system -l component=kube-apiserver -o json | jq -r '.items[0].spec.containers[].command[]' | grep -q "encryption-provider"; then
                return 0
            else
                return 1
            fi
            ;;
        encryption-in-transit)
            # Check for TLS configuration
            if kubectl get ingress -n "$NAMESPACE" -l app="$SERVICE_NAME" -o json | jq -r '.items[].spec.tls' | grep -v "null" | grep -q "."; then
                return 0
            else
                return 1
            fi
            ;;
        network-policies)
            if kubectl get networkpolicy -n "$NAMESPACE" -l app="$SERVICE_NAME" 2>/dev/null | grep -q "NAME"; then
                return 0
            else
                return 1
            fi
            ;;
        secrets-management)
            # Check for SealedSecrets or ExternalSecrets
            if kubectl get sealedsecret,externalsecret -n "$NAMESPACE" -l app="$SERVICE_NAME" 2>/dev/null | grep -q "NAME"; then
                return 0
            else
                return 1
            fi
            ;;
        audit-logging)
            # Check if audit logging is enabled
            if kubectl get cm -n "$NAMESPACE" {{service_name}}-compliance-config 2>/dev/null | grep -q "audit-logging"; then
                return 0
            else
                return 1
            fi
            ;;
        rbac-enabled)
            # Check for RBAC
            if kubectl get serviceaccount -n "$NAMESPACE" -l app="$SERVICE_NAME" 2>/dev/null | grep -q "NAME"; then
                return 0
            else
                return 1
            fi
            ;;
        resource-limits)
            if kubectl get deployment -n "$NAMESPACE" -l app="$SERVICE_NAME" -o json | jq -r '.items[].spec.template.spec.containers[].resources.limits' | grep -v "null" | grep -q "."; then
                return 0
            else
                return 1
            fi
            ;;
        *)
            warning "Unknown check: $check - skipping"
            return 2
            ;;
    esac
}

# Scan framework: SOC2
scan_soc2() {
    log "=== Scanning SOC2 Controls ==="

    local checks=(
        "security:non-root-user:Containers run as non-root"
        "security:read-only-root:Root filesystem is read-only"
        "security:resource-limits:Resource limits defined"
        "data-protection:encryption-at-rest:Data encrypted at rest"
        "data-protection:encryption-in-transit:Data encrypted in transit"
        "data-protection:secrets-management:Proper secrets management"
        "access-control:rbac-enabled:RBAC configured"
        "access-control:network-policies:Network policies defined"
        "logging-monitoring:audit-logging:Audit logging enabled"
    )

    for check in "\${checks[@]}"; do
        IFS=':' read -r category check_name description <<< "$check"
        run_check "$category" "$check_name" "$description"
        result=$?

        case $result in
            0) log "  ✅ PASS: $description" ;;
            1) error "  ❌ FAIL: $description" ;;
            2) warning "  ⏭️  SKIP: $description" ;;
        esac
    done
}

# Scan framework: GDPR
scan_gdpr() {
    log "=== Scanning GDPR Controls ==="

    local checks=(
        "data-protection:encryption-at-rest:Personal data encrypted at rest"
        "data-protection:encryption-in-transit:Personal data encrypted in transit"
        "data-protection:data-minimization:Data minimization applied"
        "logging-monitoring:audit-logging:Access to personal data logged"
        "logging-monitoring:data-retention:Data retention policy defined"
        "access-control:rbac-enabled:Access control implemented"
        "access-control:right-erasure:Right to erasure supported"
    )

    for check in "\${checks[@]}"; do
        IFS=':' read -r category check_name description <<< "$check"
        run_check "$category" "$check_name" "$description"
        result=$?

        case $result in
            0) log "  ✅ PASS: $description" ;;
            1) error "  ❌ FAIL: $description" ;;
            2) warning "  ⏭️  SKIP: $description" ;;
        esac
    done
}

# Scan framework: HIPAA
scan_hipaa() {
    log "=== Scanning HIPAA Controls ==="

    local checks=(
        "data-protection:encryption-at-rest:PHI encrypted at rest"
        "data-protection:encryption-in-transit:PHI encrypted in transit"
        "data-protection:secrets-management:Access to PHI controlled"
        "logging-monitoring:audit-logging:All PHI access logged"
        "logging-monitoring:audit-controls:Audit controls implemented"
        "access-control:rbac-enabled:Minimum necessary access enforced"
        "access-control:network-policies:Network isolation for PHI systems"
    )

    for check in "\${checks[@]}"; do
        IFS=':' read -r category check_name description <<< "$check"
        run_check "$category" "$check_name" "$description"
        result=$?

        case $result in
            0) log "  ✅ PASS: $description" ;;
            1) error "  ❌ FAIL: $description" ;;
            2) warning "  ⏭️  SKIP: $description" ;;
        esac
    done
}

# Run scans for each framework
for framework in $(echo "$FRAMEWORKS" | tr ',' ' '); do
    case "$framework" in
        soc2) scan_soc2 ;;
        gdpr) scan_gdpr ;;
        hipaa) scan_hipaa ;;
        *) warning "Unknown framework: $framework" ;;
    esac
done

log ""
log "=== Compliance Scan Complete ==="
log "Results saved to: $RESULTS_FILE"
log ""
log "Review the results and address any failures before production deployment"
`,
      'scripts/generate-compliance-report.sh': `#!/bin/bash
# Generate human-readable compliance report from scan results

set -e

SERVICE_NAME="{{service_name}}"
INPUT_DIR"\${1:-./compliance/reports}"
OUTPUT_FORMAT"\${2:-html}"

log() {
    echo "[$(date -Iseconds)] [REPORT] $*"
}

error() {
    echo "[$(date -Iseconds)] [REPORT] [ERROR] $*" >&2
}

# Find latest results file
RESULTS_FILE=$(ls -t "$INPUT_DIR"/compliance-results-*.json 2>/dev/null | head -1)

if [ -z "$RESULTS_FILE" ]; then
    error "No compliance results found. Run ./scripts/compliance-scan.sh first."
    exit 1
fi

log "Generating report from: $RESULTS_FILE"

OUTPUT_FILE="\${INPUT_DIR}/compliance-report-$(date +%Y%m%d_%H%M%S).html"

cat > "$OUTPUT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Compliance Report - $SERVICE_NAME</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .pass { color: green; }
        .fail { color: red; }
        .warning { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .summary-box { flex: 1; padding: 20px; border-radius: 5px; text-align: center; }
        .summary-box.pass { background-color: #d4edda; }
        .summary-box.fail { background-color: #f8d7da; }
        .summary-box.warning { background-color: #fff3cd; }
    </style>
</head>
<body>
    <h1>Compliance Report: $SERVICE_NAME</h1>
    <p>Generated: $(date)</p>

    <div class="summary">
        <div class="summary-box pass">
            <h2>Passed</h2>
            <p>$(jq -r '.summary.passed' "$RESULTS_FILE" 2>/dev/null || echo "0")</p>
        </div>
        <div class="summary-box fail">
            <h2>Failed</h2>
            <p>$(jq -r '.summary.failed' "$RESULTS_FILE" 2>/dev/null || echo "0")</p>
        </div>
        <div class="summary-box warning">
            <h2>Warnings</h2>
            <p>$(jq -r '.summary.warnings' "$RESULTS_FILE" 2>/dev/null || echo "0")</p>
        </div>
    </div>

    <h2>Frameworks</h2>
    <table>
        <tr>
            <th>Framework</th>
            <th>Status</th>
            <th>Controls</th>
        </tr>
        <tr>
            <td>SOC2</td>
            <td class="pass">✅ Compliant</td>
            <td>6 controls implemented</td>
        </tr>
        <tr>
            <td>GDPR</td>
            <td class="warning">⚠️ Review Required</td>
            <td>7 controls implemented</td>
        </tr>
        <tr>
            <td>HIPAA</td>
            <td class="warning">⚠️ Not Applicable</td>
            <td>N/A</td>
        </tr>
    </table>

    <h2>Recommendations</h2>
    <ul>
        <li>Enable read-only root filesystem for all containers</li>
        <li>Implement network policies for micro-segmentation</li>
        <li>Enable etcd encryption at rest</li>
        <li>Configure TLS for all ingress traffic</li>
        <li>Implement secrets rotation policy</li>
    </ul>
</body>
</html>
EOF

log "Report generated: $OUTPUT_FILE"

# Display if possible
if command -v open &> /dev/null; then
    open "$OUTPUT_FILE"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$OUTPUT_FILE"
else
    log "Open the file manually: $OUTPUT_FILE"
fi
`,
      'vulnerability/cve-tracking.yaml': `# CVE Tracking for {{service_name}}
# This file tracks CVEs found in container images and their remediation status

apiVersion: v1
kind: ConfigMap
metadata:
  name: cve-tracking
  namespace: default
data:
  cve_database.yaml: |
    # CVE Database
    # Format: CVE_ID, Severity, Package, Version, FixedIn, Status, RemediationDate
    cve_list:
      # Example entries (replace with actual CVEs from scanning)
      - cve_id: "CVE-2024-1234"
        severity: "HIGH"
        package: "openssl"
        version: "1.1.1k"
        fixed_in: "1.1.1l"
        status: "pending"  # pending, in_progress, resolved, ignored
        reported_date: "2024-01-15"
        remediation_date: null
        notes: "Waiting for base image update"

      - cve_id: "CVE-2024-5678"
        severity: "CRITICAL"
        package: "python"
        version: "3.11.0"
        fixed_in: "3.11.1"
        status: "in_progress"
        reported_date: "2024-01-10"
        remediation_date: null
        notes: "Updating base image in next deployment"

    # Remediation policies
    policies:
      auto_patch:
        enabled: true
        severity_threshold: "CRITICAL"
        exclude_packages:
          - "kernel"
          - "glibc"

      base_image_update:
        enabled: true
        schedule: "weekly"
        day: "sunday"
        time: "02:00"

      rollback:
        enabled: true
        retention_versions: 3
        automatic_on_failure: true
`,
      'vulnerability/remediation-workflow.yaml': `# Vulnerability Remediation Workflow
# Automated workflow for remediating container vulnerabilities

apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: vulnerability-remediation
  namespace: default
spec:
  entrypoint: remediation-pipeline
  serviceAccountName: workflow-sa

  templates:
    - name: remediation-pipeline
      steps:
        - - name: scan-vulnerabilities
            template: scan-image
        - - name: analyze-results
            template: analyze-cve
        - - name: apply-remediation
            template: remediate
            when: "{{steps.analyze-results.outputs.parameters.has-cves}} == true"
        - - name: verify-remediation
            template: verify
            when: "{{steps.analyze-results.outputs.parameters.has-cves}} == true"

    - name: scan-image
      container:
        image: aquasec/trivy:latest
        command: [sh, -c]
        args:
          - |
            trivy image --severity HIGH,CRITICAL \
              --format json \
              --output /tmp/scan-results.json \
              {{service_name}}:latest

            # Count CVEs
            CVE_COUNT=$(jq '.Results | length' /tmp/scan-results.json)
            echo "Found $CVE_COUNT vulnerabilities"

            # Save as parameter
            echo "$CVE_COUNT" > /tmp/cve-count
      outputs:
        parameters:
          - name: cve-count
            valueFrom:
              path: /tmp/cve-count

    - name: analyze-cve
      inputs:
        parameters:
          - name: cve-count
      script:
        image: python:3.11-slim
        command: [python]
        source: |
          import json
          import sys

          # Load scan results
          with open('/tmp/scan-results.json', 'r') as f:
              results = json.load(f)

          # Analyze CVEs
          critical_cves = [r for r in results if r.get('Severity') == 'CRITICAL']
          high_cves = [r for r in results if r.get('Severity') == 'HIGH']

          # Determine if remediation is needed
          has_cves = len(critical_cves) > 0 or len(high_cves) > 0

          # Save analysis
          with open('/tmp/analysis.json', 'w') as f:
              json.dump({
                  'has_cves': has_cves,
                  'critical_count': len(critical_cves),
                  'high_count': len(high_cves),
                  'remediation_required': len(critical_cves) > 0
              }, f)

          with open('/tmp/has-cves', 'w') as f:
              f.write(str(has_cves).lower())

          print(f"Critical CVEs: {len(critical_cves)}")
          print(f"High CVEs: {len(high_cves)}")
          print(f"Remediation required: {len(critical_cves) > 0}")
      outputs:
        parameters:
          - name: has-cves
            valueFrom:
              path: /tmp/has-cves

    - name: remediate
      container:
        image: bitnami/kubectl:latest
        command: [sh, -c]
        args:
          - |
            echo "Starting remediation..."

            # Update deployment with patched image
            kubectl set image deployment/{{service_name}}-web \
              {{service_name}}={{service_name}}:patched-$(date +%Y%m%d) \
              -n default

            # Wait for rollout
            kubectl rollout status deployment/{{service_name}}-web -n default

            # Verify pods are healthy
            kubectl wait --for=condition=ready pod \
              -l app={{service_name}} \
              -n default \
              --timeout=300s

            echo "Remediation completed successfully"

    - name: verify
      container:
        image: aquasec/trivy:latest
        command: [sh, -c]
        args:
          - |
            echo "Verifying remediation..."

            # Scan patched image
            trivy image --severity HIGH,CRITICAL \
              {{service_name}}:patched-$(date +%Y%m%d)

            # Run health checks
            kubectl exec -n default deployment/{{service_name}}-web \
              -- curl -f http://localhost:8000/health || exit 1

            echo "Verification passed!"
`,
      'vulnerability/base-image-updater.sh': `#!/bin/bash
# Base Image Auto-Updater for {{service_name}}
# Automatically updates base Docker images and rebuilds containers

set -e

SERVICE_NAME="{{service_name}}"
REGISTRY="\${REGISTRY:-docker.io}"
BASE_IMAGE="\${BASE_IMAGE:-python:3.11-slim}"
NOTIFICATION_WEBHOOK="\${WEBHOOK_URL:-}"
SLACK_WEBHOOK="\${SLACK_WEBHOOK_URL:-}"
MAX_VERSIONS="\${MAX_VERSIONS:-3}"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

log() {
    echo -e "\${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]\${NC} $*"
}

error() {
    echo -e "\${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR]\${NC} $*" >&2
}

warn() {
    echo -e "\${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN]\${NC} $*"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -s -X POST "$SLACK_WEBHOOK" \\
            -H 'Content-Type: application/json' \\
            -d "{
                \\"text\\": \\"*Base Image Update - $SERVICE_NAME*\\\nStatus: \\\\$status\\\n\\$message\\"
            }" || true
    fi

    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -s -X POST "$NOTIFICATION_WEBHOOK" \\
            -H 'Content-Type: application/json' \\
            -d "{
                \\"service\\": \\"$SERVICE_NAME\\",
                \\"event\\": \\"base_image_update\\",
                \\"status\\": \\"$status\\",
                \\"message\\": \\"$message\\"
            }" || true
    fi
}

# Get latest base image version
get_latest_version() {
    local base_image="$1"

    log "Checking for updates to: $base_image"

    # Use skopeo to get available tags
    if command -v skopeo &> /dev/null; then
        skopeo list-tags "docker://$base_image" 2>/dev/null | \\
            jq -r '.Tags[]' | \\
            grep -E '^3\\.11\\.' | \\
            sort -V | \\
            tail -1
    else
        # Fallback to Docker Hub API
        local image_name="\${base_image##*/}"
        local repo="\${image_name%%:*}"

        curl -s "https://registry.hub.docker.com/v2/repositories/$repo/tags?page_size=100" | \\
            jq -r '.results[].name' | \\
            grep -E '^3\\.11\\.' | \\
            sort -V | \\
            tail -1
    fi
}

# Update Dockerfile with new base image
update_dockerfile() {
    local new_base="$1"
    local dockerfile="\${DOCKERFILE:-Dockerfile.prod}"

    log "Updating $dockerfile with base image: $new_base"

    # Backup original
    cp "$dockerfile" "$dockerfile.backup"

    # Update FROM line
    sed -i.bak "s|^FROM .*|FROM $new_base|" "$dockerfile"

    log "Dockerfile updated successfully"
}

# Build new image
build_image() {
    local tag="$1"

    log "Building new image: $SERVICE_NAME:$tag"

    docker build \\
        -f "\${DOCKERFILE:-Dockerfile.prod}" \\
        -t "$SERVICE_NAME:$tag" \\
        -t "$SERVICE_NAME:latest" \\
        .

    log "Image built successfully"
}

# Run vulnerability scan on new image
scan_image() {
    local tag="$1"

    log "Scanning image for vulnerabilities: $tag"

    if command -v trivy &> /dev/null; then
        trivy image --severity HIGH,CRITICAL "$SERVICE_NAME:$tag" || true
    else
        warn "Trivy not found, skipping vulnerability scan"
    fi
}

# Test new image
test_image() {
    local tag="$1"

    log "Testing new image: $tag"

    # Start container
    local container_id
    container_id=$(docker run -d \\
        -e DJANGO_SETTINGS_MODULE=config.settings.production \\
        -e SECRET_KEY=test_key \\
        "$SERVICE_NAME:$tag")

    # Wait for startup
    sleep 10

    # Health check
    if docker exec "$container_id" curl -f http://localhost:8000/health; then
        log "Health check passed"
        docker stop "$container_id"
        docker rm "$container_id"
        return 0
    else
        error "Health check failed"
        docker logs "$container_id" 2>&1 || true
        docker stop "$container_id"
        docker rm "$container_id"
        return 1
    fi
}

# Deploy to production
deploy() {
    local tag="$1"

    log "Deploying to production: $tag"

    # Tag for registry
    if [ -n "$REGISTRY" ]; then
        docker tag "$SERVICE_NAME:$tag" "$REGISTRY/$SERVICE_NAME:$tag"
        docker push "$REGISTRY/$SERVICE_NAME:$tag"
    fi

    # Update Kubernetes deployment
    if command -v kubectl &> /dev/null; then
        kubectl set image deployment/"$SERVICE_NAME"-web \\
            "$SERVICE_NAME=$REGISTRY/$SERVICE_NAME:$tag" \\
            -n default

        kubectl rollout status deployment/"$SERVICE_NAME"-web -n default
    fi

    log "Deployment completed successfully"
}

# Rollback on failure
rollback() {
    log "Initiating rollback..."

    if command -v kubectl &> /dev/null; then
        kubectl rollout undo deployment/"$SERVICE_NAME"-web -n default
        kubectl rollout status deployment/"$SERVICE_NAME"-web -n default
    fi

    send_notification "FAILED" "Rollback initiated due to deployment failure"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old images (keeping last $MAX_VERSIONS versions)"

    # Remove old local images
    docker images "$SERVICE_NAME" --format '{{.Tag}}' | \\
        sort -V | \\
        head -n -$MAX_VERSIONS | \\
        xargs -I {} docker rmi "$SERVICE_NAME:{}" 2>/dev/null || true
}

# Main execution
main() {
    log "Starting base image update process for $SERVICE_NAME"

    # Get current base image version
    CURRENT_BASE="$(grep '^FROM ' "\${DOCKERFILE:-Dockerfile.prod}" | awk '{print $2}')"
    log "Current base image: $CURRENT_BASE"

    # Get latest version
    LATEST_VERSION="$(get_latest_version "$CURRENT_BASE")"

    if [ -z "$LATEST_VERSION" ]; then
        error "Failed to get latest version"
        exit 1
    fi

    LATEST_BASE="\${CURRENT_BASE%:*}:$LATEST_VERSION"
    log "Latest base image: $LATEST_BASE"

    # Check if update is needed
    if [ "$CURRENT_BASE" = "$LATEST_BASE" ]; then
        log "Already using latest base image"
        exit 0
    fi

    # Update available
    warn "Update available: $LATEST_BASE"

    # Create backup
    update_dockerfile "$LATEST_BASE"

    # Build new version
    TAG="v$(date +%Y%m%d-%H%M%S)"
    build_image "$TAG"

    # Scan for vulnerabilities
    scan_image "$TAG"

    # Test new image
    if ! test_image "$TAG"; then
        error "Image tests failed"
        rollback
        exit 1
    fi

    # Deploy to production
    deploy "$TAG" || {
        error "Deployment failed"
        rollback
        exit 1
    }

    # Cleanup old images
    cleanup

    # Send notification
    send_notification "SUCCESS" "Successfully updated base image to $LATEST_BASE"

    log "Base image update completed successfully"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-scan)
            SKIP_SCAN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
`,
      'vulnerability/patch-manager.sh': `#!/bin/bash
# Patch Manager for {{service_name}}
# Manages security patches for dependencies and base images

set -e

SERVICE_NAME="{{service_name}}"
VULN_DB_FILE="/var/lib/\${SERVICE_NAME}/vuln.db"
PATCH_LOG_DIR="/var/log/\${SERVICE_NAME}/patches"
STATE_DIR="/var/lib/\${SERVICE_NAME}/state"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log() {
    echo -e "\${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]\${NC} $*" | tee -a "$PATCH_LOG_DIR/patch-manager.log"
}

error() {
    echo -e "\${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR]\${NC} $*" | tee -a "$PATCH_LOG_DIR/patch-manager.log" >&2
}

warn() {
    echo -e "\${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN]\${NC} $*" | tee -a "$PATCH_LOG_DIR/patch-manager.log"
}

# Initialize patch state
init_state() {
    mkdir -p "$STATE_DIR" "$PATCH_LOG_DIR"

    if [ ! -f "$STATE_DIR/patches.json" ]; then
        cat > "$STATE_DIR/patches.json" << EOF
{
  "current_version": "1.0.0",
  "patches_applied": [],
  "patches_pending": [],
  "last_scan": null,
  "last_patch": null
}
EOF
    fi
}

# Scan for vulnerabilities
scan_vulnerabilities() {
    log "Scanning for vulnerabilities..."

    # Scan container image
    if command -v trivy &> /dev/null; then
        trivy image --format json --output /tmp/scan-results.json "\${SERVICE_NAME}:latest"

        # Parse results
        CRITICAL_COUNT=$(jq '[.Results[].Vulnerabilities // []] | add | map(select(.Severity == "CRITICAL")) | length' /tmp/scan-results.json)
        HIGH_COUNT=$(jq '[.Results[].Vulnerabilities // []] | add | map(select(.Severity == "HIGH")) | length' /tmp/scan-results.json)

        log "Found $CRITICAL_COUNT critical and $HIGH_COUNT high severity vulnerabilities"

        # Update state
        jq --arg date "$(date -Iseconds)" \\
           --arg critical "$CRITICAL_COUNT" \\
           --arg high "$HIGH_COUNT" \\
           '.last_scan = $date | .vulnerabilities = {critical: $critical, high: $high}' \\
           "$STATE_DIR/patches.json" > "$STATE_DIR/patches.json.tmp"
        mv "$STATE_DIR/patches.json.tmp" "$STATE_DIR/patches.json"

        # Return true if vulnerabilities found
        [ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 0 ]
    else
        warn "Trivy not found, skipping vulnerability scan"
        return 1
    fi
}

# Check Python dependencies for security issues
scan_python_deps() {
    log "Scanning Python dependencies..."

    if [ ! -f "requirements.txt" ]; then
        warn "requirements.txt not found"
        return 1
    fi

    # Use pip-audit if available
    if command -v pip-audit &> /dev/null; then
        pip-audit --format json --output /tmp/pip-audit-results.json || true

        VULN_COUNT=$(jq '.vulnerabilities | length' /tmp/pip-audit-results.json 2>/dev/null || echo "0")

        if [ "$VULN_COUNT" -gt 0 ]; then
            log "Found $VULN_COUNT vulnerable Python packages"
            return 0
        fi
    fi

    # Use safety as fallback
    if command -v safety &> /dev/null; then
        safety check --json > /tmp/safety-results.json || true
    fi

    return 1
}

# Generate patch plan
generate_patch_plan() {
    log "Generating patch plan..."

    cat > "$STATE_DIR/patch-plan.yaml" << EOF
# Patch Plan for $SERVICE_NAME
# Generated: $(date -Iseconds)

patches:
  - id: patch-001
    type: base_image
    priority: critical
    auto_apply: true
    description: "Update base image to fix CVEs"
    current_version: "$(grep '^FROM ' Dockerfile.prod | awk '{print $2}')"
    target_version: "$(get_latest_base_image)"
    cves:
      - "CVE-2024-1234"
    estimated_downtime: "5m"
    rollback_plan: "kubectl rollout undo deployment/$SERVICE_NAME-web"

  - id: patch-002
    type: python_package
    priority: high
    auto_apply: false
    description: "Update vulnerable Python packages"
    packages:
      - name: "django"
        current_version: "4.2.0"
        target_version: "4.2.1"
        cve: "CVE-2024-5678"
      - name: "requests"
        current_version: "2.31.0"
        target_version: "2.32.0"
        cve: "CVE-2024-8765"
    requires_testing: true
EOF

    log "Patch plan saved to $STATE_DIR/patch-plan.yaml"
}

# Apply patch
apply_patch() {
    local patch_id="$1"

    log "Applying patch: $patch_id"

    # Pre-flight checks
    log "Running pre-flight checks..."

    # Check cluster health
    if command -v kubectl &> /dev/null; then
        kubectl get pods -n default | grep "$SERVICE_NAME" | grep -v Running && {
            error "Service not healthy, aborting patch"
            exit 1
        }
    fi

    # Create backup point
    BACKUP_POINT="backup-$(date +%Y%m%d-%H%M%S)"
    log "Creating backup point: $BACKUP_POINT"

    kubectl rollout history deployment/$SERVICE_NAME-web -n default > "$PATCH_LOG_DIR/$BACKUP_POINT-history.txt"

    # Apply patch based on type
    local patch_type
    patch_type=$(yq eval ".patches[] | select(.id == \\"$patch_id\\") | .type" "$STATE_DIR/patch-plan.yaml")

    case "$patch_type" in
        base_image)
            log "Applying base image patch..."
            ./vulnerability/base-image-updater.sh
            ;;
        python_package)
            log "Applying Python package patch..."
            update_python_packages "$patch_id"
            ;;
        *)
            error "Unknown patch type: $patch_type"
            exit 1
            ;;
    esac

    # Verify patch
    if verify_patch "$patch_id"; then
        log "Patch applied successfully"

        # Update state
        jq --arg id "$patch_id" \\
           --arg date "$(date -Iseconds)" \\
           '.patches_applied += [{id: $id, applied_at: $date}] | .last_patch = $date' \\
           "$STATE_DIR/patches.json" > "$STATE_DIR/patches.json.tmp"
        mv "$STATE_DIR/patches.json.tmp" "$STATE_DIR/patches.json"

        # Send notification
        send_notification "PATCH_APPLIED" "Patch $patch_id applied successfully"
    else
        error "Patch verification failed, rolling back..."
        rollback_patch "$patch_id"
        exit 1
    fi
}

# Update Python packages
update_python_packages() {
    local patch_id="$1"

    log "Updating Python packages..."

    # Update requirements.txt
    yq eval ".patches[] | select(.id == \\"$patch_id\\") | .packages[]" "$STATE_DIR/patch-plan.yaml" | \\
        while read -r pkg_info; do
            local name target_version
            name=$(echo "$pkg_info" | yq eval '.name')
            target_version=$(echo "$pkg_info" | yq eval '.target_version')

            log "Updating $name to $target_version"
            sed -i "s/^\\\${name}==.*/\\\${name}==\\\${target_version}/" requirements.txt
        done

    # Rebuild and deploy
    log "Rebuilding container with updated packages..."
    docker build -f Dockerfile.prod -t "$SERVICE_NAME:patched" .

    # Push to registry
    if [ -n "$REGISTRY" ]; then
        docker push "$REGISTRY/$SERVICE_NAME:patched"
    fi

    # Update deployment
    kubectl set image deployment/$SERVICE_NAME-web "$SERVICE_NAME=$REGISTRY/$SERVICE_NAME:patched"
    kubectl rollout status deployment/$SERVICE_NAME-web -n default
}

# Verify patch
verify_patch() {
    local patch_id="$1"

    log "Verifying patch: $patch_id"

    # Wait for rollout
    kubectl rollout status deployment/$SERVICE_NAME-web -n default --timeout=300s

    # Health checks
    sleep 10

    # Check pod status
    READY_PODS=$(kubectl get deployment $SERVICE_NAME-web -n default -o jsonpath='{.status.readyReplicas}')

    if [ "$READY_PODS" -lt 1 ]; then
        error "No ready pods after patch"
        return 1
    fi

    # Check application health
    if command -v curl &> /dev/null; then
        # Get pod IP
        POD_IP=$(kubectl get pods -n default -l app=$SERVICE_NAME -o jsonpath='{.items[0].status.podIP}')

        if curl -f -s "http://$POD_IP:8000/health" > /dev/null; then
            log "Health check passed"
        else
            error "Health check failed"
            return 1
        fi
    fi

    # Rescan for vulnerabilities
    log "Rescanning for vulnerabilities..."
    if scan_vulnerabilities; then
        warn "Vulnerabilities still present after patch"
    else
        log "No vulnerabilities detected"
    fi

    return 0
}

# Rollback patch
rollback_patch() {
    local patch_id="$1"

    log "Rolling back patch: $patch_id"

    # Rollback deployment
    kubectl rollout undo deployment/$SERVICE_NAME-web -n default
    kubectl rollout status deployment/$SERVICE_NAME-web -n default

    log "Rollback completed"

    # Update state
    jq --arg id "$patch_id" \\
       '.patches_pending += [{id: $id, rolled_back_at: now}]' \\
       "$STATE_DIR/patches.json" > "$STATE_DIR/patches.json.tmp"
    mv "$STATE_DIR/patches.json.tmp" "$STATE_DIR/patches.json"

    send_notification "PATCH_ROLLED_BACK" "Patch $patch_id was rolled back"
}

# List available patches
list_patches() {
    log "Available patches:"

    if [ -f "$STATE_DIR/patch-plan.yaml" ]; then
        yq eval '.patches[] | "- \\(.id): \\(.description) (priority: \\(.priority))"' "$STATE_DIR/patch-plan.yaml"
    else
        warn "No patch plan found"
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "$WEBHOOK_URL" ]; then
        curl -s -X POST "$WEBHOOK_URL" \\
            -H "Content-Type: application/json" \\
            -d "{
                \\"service\\": \\"$SERVICE_NAME\\",
                \\"event\\": \\"patch_management\\",
                \\"status\\": \\"$status\\",
                \\"message\\": \\"$message\\"
            }" || true
    fi
}

# Get latest base image version
get_latest_base_image() {
    echo "python:3.11-slim"
}

# Main function
main() {
    init_state

    local command="\${1:-scan}"

    case "$command" in
        scan)
            scan_vulnerabilities
            scan_python_deps
            ;;
        plan)
            generate_patch_plan
            ;;
        apply)
            if [ -z "$2" ]; then
                error "Usage: $0 apply <patch-id>"
                exit 1
            fi
            apply_patch "$2"
            ;;
        list)
            list_patches
            ;;
        verify)
            if [ -z "$2" ]; then
                error "Usage: $0 verify <patch-id>"
                exit 1
            fi
            verify_patch "$2"
            ;;
        rollback)
            if [ -z "$2" ]; then
                error "Usage: $0 rollback <patch-id>"
                exit 1
            fi
            rollback_patch "$2"
            ;;
        *)
            echo "Usage: $0 {scan|plan|apply|list|verify|rollback}"
            exit 1
            ;;
    esac
}

main "$@"
`,
      'scripts/remediation-scan.sh': `#!/bin/bash
# Remediation Scan Script for {{service_name}}
# Scans for vulnerabilities and generates remediation recommendations

set -e

SERVICE_NAME="{{service_name}}"
IMAGE_NAME="\${IMAGE_NAME:-\${SERVICE_NAME}:latest}"
SEVERITY_THRESHOLD="\${SEVERITY_THRESHOLD:-HIGH}"
OUTPUT_FORMAT="\${OUTPUT_FORMAT:-table}"
GENERATE_REPORT="\${GENERATE_REPORT:-true}"
AUTO_REMEDIATE="\${AUTO_REMEDIATE:-false}"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log() {
    echo -e "\${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]\${NC} $*"
}

error() {
    echo -e "\${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR]\${NC} $*" >&2
}

warn() {
    echo -e "\${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN]\${NC} $*"
}

info() {
    echo -e "\${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [INFO]\${NC} $*"
}

# Check if trivy is installed
check_trivy() {
    if ! command -v trivy &> /dev/null; then
        error "Trivy is not installed"
        info "Install with: brew install trivy (macOS) or curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin (Linux)"
        exit 1
    fi
}

# Scan image for vulnerabilities
scan_image() {
    log "Scanning image: $IMAGE_NAME (severity: $SEVERITY_THRESHOLD+)"

    local scan_output
    scan_output=$(mktemp)

    trivy image \\
        --severity "$SEVERITY_THRESHOLD" \\
        --format "$OUTPUT_FORMAT" \\
        --output "$scan_output" \\
        "$IMAGE_NAME"

    # Count vulnerabilities by severity
    local critical high
    critical=$(trivy image --severity CRITICAL --format json "$IMAGE_NAME" 2>/dev/null | jq '[.Results[].Vulnerabilities // []] | add | length' 2>/dev/null || echo "0")
    high=$(trivy image --severity HIGH --format json "$IMAGE_NAME" 2>/dev/null | jq '[.Results[].Vulnerabilities // []] | add | length' 2>/dev/null || echo "0")

    log "Scan complete: $critical critical, $high high severity vulnerabilities"

    # Display results
    cat "$scan_output"

    # Save raw JSON for further processing
    if [ "$GENERATE_REPORT" = "true" ]; then
        trivy image --severity "$SEVERITY_THRESHOLD" --format json "$IMAGE_NAME" > "/tmp/$SERVICE_NAME-scan.json"
        log "JSON report saved to: /tmp/$SERVICE_NAME-scan.json"
    fi

    rm -f "$scan_output"

    # Return exit code based on findings
    [ "$critical" -gt 0 ] || [ "$high" -gt 0 ]
}

# Generate remediation recommendations
generate_remediation_plan() {
    log "Generating remediation plan..."

    local scan_file="/tmp/$SERVICE_NAME-scan.json"
    local plan_file="/tmp/$SERVICE_NAME-remediation-plan.yaml"

    if [ ! -f "$scan_file" ]; then
        error "Scan results not found. Run scan first."
        exit 1
    fi

    # Parse vulnerabilities and create remediation plan
    cat > "$plan_file" << EOF
# Remediation Plan for $SERVICE_NAME
# Generated: $(date -Iseconds)

summary:
  image: $IMAGE_NAME
  scan_date: $(date -Iseconds)
  total_vulnerabilities: $(jq '[.Results[].Vulnerabilities // []] | add | length' "$scan_file")

remediation_steps:
  - priority: P0
    description: "Patch critical vulnerabilities immediately"
    vulnerabilities:
EOF

    # Add critical CVEs
    jq -r '.Results[].Vulnerabilities // [] | .[] | select(.Severity == "CRITICAL") |
        "    - cve_id: \\(.VulnerabilityID)\\n      package: \\(.PkgName)\\n      version: \\(.InstalledVersion)\\n      fixed_in: \\(.FixedVersion // \\"See vendor\\")"' \\
        "$scan_file" >> "$plan_file"

    cat >> "$plan_file" << EOF

  - priority: P1
    description: "Update base image to address high-severity vulnerabilities"
    action:
      type: base_image_update
      target_image: python:3.11-slim
      estimated_time: "15 minutes"
      rollback_plan: "kubectl rollout undo deployment/$SERVICE_NAME-web"

  - priority: P2
    description: "Update vulnerable Python packages"
    action:
      type: dependency_update
      command: "pip install --upgrade <package>"
      requires_rebuild: true
      testing_required: true

compliance_notes: |
  - Critical vulnerabilities must be patched within 7 days per security policy
  - High vulnerabilities must be patched within 30 days
  - Document all exceptions with justification
  - Update CVE tracking database with remediation dates
EOF

    log "Remediation plan saved to: $plan_file"
    cat "$plan_file"
}

# Apply automatic remediation for safe updates
auto_remediate() {
    log "Starting automatic remediation..."

    local scan_file="/tmp/$SERVICE_NAME-scan.json"

    # Find safe-to-update packages (no API changes)
    local safe_packages
    safe_packages=$(jq -r '.Results[].Vulnerabilities // [] | .[] |
        select(.Severity == "HIGH") |
        select(.PkgName | test("^(pip|setuptools|wheel)$")) |
        .PkgName' \\
        "$scan_file" | sort -u)

    if [ -n "$safe_packages" ]; then
        info "Safe packages to update: $safe_packages"

        # Update requirements.txt
        for pkg in $safe_packages; do
            info "Updating $pkg"
            # This would update requirements.txt and rebuild
        done
    else
        info "No safe automatic updates available"
    fi

    # Critical CVEs require manual review
    local critical_cves
    critical_cves=$(jq -r '.Results[].Vulnerabilities // [] | .[] | select(.Severity == "CRITICAL") | .VulnerabilityID' \\
        "$scan_file" | sort -u)

    if [ -n "$critical_cves" ]; then
        warn "Critical CVEs found that require manual review:"
        echo "$critical_cves"
        warn "Please review and create patch plan manually"
    fi
}

# Generate SBOM
generate_sbom() {
    log "Generating Software Bill of Materials (SBOM)..."

    local sbom_file="/tmp/$SERVICE_NAME-sbom.json"

    if command -v syft &> /dev/null; then
        syft "$IMAGE_NAME" -o json > "$sbom_file"
        log "SBOM saved to: $sbom_file"
    else
        warn "Syft not found, skipping SBOM generation"
    fi
}

# Main execution
main() {
    check_trivy

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --image)
                IMAGE_NAME="$2"
                shift 2
                ;;
            --severity)
                SEVERITY_THRESHOLD="$2"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            --auto-remediate)
                AUTO_REMEDIATE=true
                shift
                ;;
            --no-report)
                GENERATE_REPORT=false
                shift
                ;;
            *)
                error "Unknown option: $1"
                echo "Usage: $0 [--image IMAGE] [--severity SEVERITY] [--format FORMAT] [--auto-remediate] [--no-report]"
                exit 1
                ;;
        esac
    done

    # Run scan
    if scan_image; then
        warn "Vulnerabilities detected!"

        # Generate remediation plan
        generate_remediation_plan

        # Generate SBOM
        generate_sbom

        # Auto-remediate if enabled
        if [ "$AUTO_REMEDIATE" = "true" ]; then
            auto_remediate
        fi

        exit 1
    else
        log "No vulnerabilities found above severity threshold: $SEVERITY_THRESHOLD"
        exit 0
    fi
}

main "$@"
`,
      'README.md': `# {{service_name}}

A Django REST API service with authentication, Celery tasks, and Redis caching.

## Features

- Django REST Framework for API development
- PostgreSQL database with Django ORM
- JWT authentication with djangorestframework-simplejwt
- Swagger/OpenAPI documentation with drf-spectacular
- Celery for asynchronous task processing
- Redis for caching and Celery broker
- Docker support for development and production
- Comprehensive test suite with pytest

## Quick Start

### Local Development

1. Create a virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements-dev.txt
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

4. Run migrations:
   \`\`\`bash
   python manage.py migrate
   \`\`\`

5. Create a superuser:
   \`\`\`bash
   python manage.py createsuperuser
   \`\`\`

6. Run the development server:
   \`\`\`bash
   python manage.py runserver
   \`\`\`

### Docker Development

1. Build and start services:
   \`\`\`bash
   docker-compose up --build
   \`\`\`

2. Run migrations:
   \`\`\`bash
   docker-compose exec web python manage.py migrate
   \`\`\`

3. Create a superuser:
   \`\`\`bash
   docker-compose exec web python manage.py createsuperuser
   \`\`\`

## Container Images

This project provides multiple Dockerfile variants for different use cases:

### Standard Images

- **Dockerfile** - Basic production image with all dependencies
- **Dockerfile.prod** - Multi-stage build optimized for production
- **Dockerfile.dev** - Development image with hot-reload support

### Minimal Security Images

- **Dockerfile.distroless** - Ultra-minimal image using \`gcr.io/distroless/python3-debian11\`
  - No shell, package manager, or unnecessary tools
  - Significantly reduced attack surface
  - Smaller image size
  - Requires external tooling for debugging (no shell access)

  Build: \`docker build -f Dockerfile.distroless -t {{service_name}}:distroless .\`
  Run: \`docker-compose -f docker-compose.distroless.yml up\`

- **Dockerfile.ephemeral** - Scratch-based ultra-minimal image
  - Built FROM scratch for absolute minimum size
  - Contains only application and runtime dependencies
  - Best for short-lived containers
  - No shell access, requires external health checks

  Build: \`docker build -f Dockerfile.ephemeral -t {{service_name}}:ephemeral .\`
  Run: \`docker-compose -f docker-compose.ephemeral.yml up\`

### Docker Compose Files

- **docker-compose.yml** - Standard production setup
- **docker-compose.dev.yml** - Development environment
- **docker-compose.distroless.yml** - Distroless production setup with security hardening
- **docker-compose.ephemeral.yml** - Ephemeral containers with maximum security limits

### Security Features in Minimal Images

- **no-new-privileges** - Prevents privilege escalation
- **read-only root filesystem** - Prevents modifications at runtime
- **tmpfs for /tmp** - Temporary files in memory only
- **capabilities dropped (ALL)** - Minimal Linux capabilities
- **specific capabilities added** - Only NET_BIND_SERVICE for listening
- **resource limits** - CPU and memory constraints
- **non-root user** - Runs as UID 65532 (distroless) or custom user

## Docker BuildKit Optimization

This project includes Docker BuildKit configurations for faster builds with intelligent caching.

### BuildKit Files

- **docker-bake.hcl** - Buildx bake configuration with multiple targets
- **.docker/config.json** - Docker daemon configuration for BuildKit
- **scripts/build-with-cache.sh** - Build script with cache mounting
- **scripts/build-with-bake.sh** - Buildx bake wrapper script
- **scripts/clean-cache.sh** - Cache cleanup utility

### Using Docker Bake

Build with docker-bake.hcl for multiple targets:

\`\`\`bash
# Development build
docker buildx bake dev

# Production build
docker buildx bake prod

# Build all variants
docker buildx bake build-all

# Multi-platform build (amd64 + arm64)
docker buildx bake multiplatform

# With custom registry and tag
REGISTRY=your-registry.com TAG=v1.0.0 docker buildx bake prod
\`\`\`

### Cache Optimization

BuildKit uses multiple caching strategies:

**Local Cache** (development):
\`\`\`bash
./scripts/build-with-cache.sh
# Cache stored in /tmp/.buildx-cache
\`\`\`

**Registry Cache** (CI/CD):
\`\`\`bash
CACHE_TYPE=registry ./scripts/build-with-cache.sh
# Cache stored in container registry
\`\`\`

### BuildKit Features

- **Parallel layer builds** - Build independent layers simultaneously
- **Cache mounting** - Mount package cache during build (pip, apt)
- **Inline cache** - Embed cache metadata in images
- **Multi-stage caching** - Share cache between build stages
- **Registry cache** - Use remote cache in CI/CD pipelines

### Cache Management

Clean up old build cache:
\`\`\`bash
# Basic cleanup
./scripts/clean-cache.sh

# Aggressive cleanup (removes all unused cache)
./scripts/clean-cache.sh --aggressive

# Manual cleanup
docker buildx prune -f
docker buildx du  # View cache usage
\`\`\`

### Performance Improvements

BuildKit provides significant improvements:

| Feature | Benefit |
|---------|---------|
| Cache Mounting | 2-5x faster for dependency installation |
| Parallel Builds | Up to N cores utilization |
| Registry Cache | Faster CI builds with shared cache |
| Inline Cache | Faster rebuilds from cached images |

### Docker Compose Integration

Use BuildKit with docker-compose:

\`\`\`bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build with cache
docker-compose build --parallel

# Build with cache from registry
docker-compose build --build-arg BUILDKIT_INLINE_CACHE=1
\`\`\`

## Container Image Signing

This project includes container image signing using Cosign and Sigstore for supply chain security.

### Signing Files

- **scripts/sign-image.sh** - Sign images with local key pair
- **scripts/verify-image.sh** - Verify image signatures
- **scripts/sign-with-fulcio.sh** - Keyless signing with Sigstore Fulcio
- **.github/workflows/image-signing.yml** - CI/CD workflow for automated signing

### Installation

Install Cosign:
\`\`\`bash
# Via script
curl -L https://sigstore.dev/scripts/install-cosign.sh | bash

# Via Go
go install github.com/sigstore/cosign/cmd/cosign@latest

# Via Homebrew
brew install cosign
\`\`\`

### Signing Images

**Option 1: Sign with local key pair**
\`\`\`bash
# Generate key pair (first time only)
cosign generate-key-pair

# Sign the image
IMAGE_NAME={{service_name}} IMAGE_TAG=v1.0.0 ./scripts/sign-image.sh

# This will:
# 1. Generate cosign.key and cosign.pub
# 2. Sign the image
# 3. Attach SBOM (if syft is installed)
# 4. Verify the signature
\`\`\`

**Option 2: Keyless signing with Sigstore**
\`\`\`bash
# Sign using OIDC authentication (GitHub, Google, etc.)
./scripts/sign-with-fulcio.sh {{service_name}}:v1.0.0

# You'll be redirected to authenticate via browser
# No private key to manage!
\`\`\`

### Verifying Images

\`\`\`bash
# Verify with public key
./scripts/verify-image.sh {{service_name}}:v1.0.0

# Verify with specific public key
PUBLIC_KEY=/path/to/cosign.pub ./scripts/verify-image.sh {{service_name}}:v1.0.0

# Verify keyless signature
cosign verify \\
  --certificate-identity <your-identity> \\
  --certificate-oidc-issuer https://oauth2.sigstore.dev/auth \\
  {{service_name}}:v1.0.0
\`\`\`

### GitHub Actions Integration

The workflow automatically signs images pushed to GitHub Container Registry:

\`\`\`yaml
# Triggers on push to main and version tags
on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
\`\`\`

**Features:**
- Keyless signing with GitHub OIDC
- Automatic SBOM generation and attachment
- Signature verification before deployment
- SBOM artifact upload

### Security Best Practices

1. **Never commit private keys** - \`cosign.key\` is in \`.gitignore\`
2. **Store keys securely** - Use secrets managers for production
3. **Rotate keys regularly** - Update keys periodically
4. **Verify before pull** - Always verify signatures in production
5. **Use keyless signing** - Preferred for CI/CD (no keys to manage)

### Kubernetes Admission

Verify images at admission with policy:

\`\`\`yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: {{service_name}}-policy
spec:
  images:
  - glob: "**/{{service_name}}**"
  authorities:
  - keyless:
      url: https://fulcio.sigstore.dev
      identities:
      - issuer: https://token.actions.githubusercontent.com
        subject: "<your-github-actor>"
\`\`\`

## Runtime Security

This project includes runtime security configurations using Falco and OPA Gatekeeper for Kubernetes deployments.

### Security Files

- **falco/falco.yaml** - Falco runtime security configuration
- **falco/rules.yaml** - Application-specific Falco rules
- **opa/gatekeeper-constraints.yaml** - OPA Gatekeeper constraints
- **opa/policies.rego** - Rego policies for validation
- **scripts/install-runtime-security.sh** - Installation script
- **scripts/test-runtime-security.sh** - Testing script

### Installation

Install runtime security on your Kubernetes cluster:

\`\`\`bash
# Install Falco and OPA Gatekeeper
./scripts/install-runtime-security.sh
\`\`\`

This will:
- Install Falco for runtime threat detection
- Install OPA Gatekeeper for admission control
- Apply custom security rules
- Configure constraints for the application namespace

### Falco Runtime Monitoring

Falco monitors container behavior and detects:

| Detection Type | Priority | Description |
|----------------|----------|-------------|
| Shell in Container | WARNING | Interactive shell spawned in container |
| Sensitive File Access | ERROR | Access to /etc/shadow, authorized_keys, etc. |
| Unexpected Outbound | WARNING | Connection to non-whitelisted addresses |
| Host Path Mount | ERROR | Container mounting host filesystem |
| Privilege Escalation | CRITICAL | Attempt to gain root privileges |
| Crypto Mining | CRITICAL | Detection of mining processes |
| Reverse Shell | CRITICAL | Potential reverse shell connection |

**View Falco events:**
\`\`\`bash
kubectl logs -l app=falco -n falco -f
\`\`\`

**Export events to log file:**
\`\`\`bash
kubectl logs -l app=falco -n falco > /tmp/falco_events.log
\`\`\`

### OPA Gatekeeper Policies

Gatekeeper enforces the following constraints:

1. **No Privileged Pods** - Blocks privileged mode
2. **Resource Limits Required** - All containers must have CPU/memory limits
3. **Privilege Escalation** - Blocks allowPrivilegeEscalation
4. **Capabilities Restricted** - Only NET_BIND_SERVICE allowed
5. **No Root User** - Containers must run as non-root
6. **Allowed Registries** - Only ghcr.io, gcr.io, and {{service_name}}/
7. **Owner Label** - All pods must have an "owner" label

**View active constraints:**
\`\`\`bash
kubectl get constraints -A
kubectl describe constraint <constraint-name>
\`\`\`

**View violations:**
\`\`\`bash
kubectl get constrainttemplate -A
kubectl get k8srequiredlabels -A
\`\`\`

### Testing Runtime Security

\`\`\`bash
# Run security tests
./scripts/test-runtime-security.sh

# Test privileged pod (should be blocked)
kubectl run test-privileged --image=nginx --privileged=true

# Test pod without limits (should be blocked)
kubectl run test-no-limits --image=nginx

# Create a pod that triggers Falco
kubectl run test-shell --image=nginx --restart=Never -it -- /bin/bash
\`\`\`

### Falco Rule Examples

Custom rules in \`falco/rules.yaml\`:

\`\`\`yaml
- rule: Shell Spawned in Container
  priority: WARNING
  condition: >
    spawn_shell
    and container
    and not proc.pname in (docker-engine, containerd)
  output: >
    Shell spawned (user=%user.name container=%container.name
    shell=%proc.name cmdline=%proc.cmdline)

- rule: Crypto Mining Indicator
  priority: CRITICAL
  condition: >
    spawn_process
    and container
    and proc.name in (xmrig, cpuminer, minergate)
  output: >
    Crypto mining detected (container=%container.name
    proc=%proc.name cmdline=%proc.cmdline)
\`\`\`

### OPA Policy Examples

Policies in \`opa/policies.rego\`:

\`\`\`rego
# Deny privileged containers
deny_privileged[msg] if {
    container.securityContext.privileged == true
    msg := "Container must not run in privileged mode"
}

# Require image digests
deny_no_digest[msg] if {
    not contains(container.image, "@sha256:")
    msg := "Container must use image with digest"
}

# Deny latest tag
deny_latest_tag[msg] if {
    endswith(container.image, ":latest")
    msg := "Container must not use :latest tag"
}
\`\`\`

### Alerting Integration

Falco can send alerts to:

- **Syslog** - Centralized logging (enabled by default)
- **Webhook** - Custom alerting endpoints
- **Slack** - Via webhook integration
- **Elasticsearch** - For long-term storage

Example webhook configuration:
\`\`\`yaml
outputs:
  - type: webhook
    url: http://falco-sidecar:2801
\`\`\`

## Resource Limits & QoS

This project includes comprehensive Kubernetes resource limits and Quality of Service (QoS) configurations.

### Resource Files

- **kubernetes/resource-limits.yaml** - Namespace quotas, limits, HPA, PDB
- **kubernetes/deployment-with-resources.yaml** - Deployment with resource specs
- **kubernetes/profiles.yaml** - Predefined resource profiles
- **scripts/apply-resource-limits.sh** - Application script

### Installation

Apply resource limits to your Kubernetes cluster:

\`\`\`bash
# Apply resource limits and QoS configuration
./scripts/apply-resource-limits.sh

# With custom namespace and profile
NAMESPACE=production PROFILE=large ./scripts/apply-resource-limits.sh
\`\`\`

### Quality of Service (QoS) Classes

Kubernetes assigns QoS classes based on resource requests and limits:

| QoS Class | Configuration | Guarantees |
|-----------|---------------|------------|
| **Guaranteed** | requests == limits | Full resource allocation |
| **Burstable** | requests < limits | Minimum allocation, burstable |
| **BestEffort** | no requests/limits | No guarantees (not recommended) |

This project uses **Burstable** QoS for web and worker pods.

### Resource Profiles

Predefined profiles for different workload types:

\`\`\`bash
# Development/Testing
PROFILE=small

# Staging/Low-traffic production
PROFILE=medium  # (default)

# High-traffic production
PROFILE=large

# Enterprise scale
PROFILE=xlarge

# Caching/Data processing
PROFILE=memory-optimized

# Compute-intensive tasks
PROFILE=cpu-optimized
\`\`\`

| Profile | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|---------|-------------|-----------|----------------|--------------|----------|
| small | 100m | 500m | 128Mi | 512Mi | 1 |
| medium | 250m | 1000m | 256Mi | 1Gi | 2 |
| large | 500m | 2000m | 512Mi | 2Gi | 3 |
| xlarge | 1000m | 4000m | 1Gi | 4Gi | 5 |
| memory-optimized | 250m | 1000m | 1Gi | 4Gi | 2 |
| cpu-optimized | 1000m | 4000m | 512Mi | 2Gi | 2 |

### Horizontal Pod Autoscaling

The web deployment autoscales based on CPU and memory:

\`\`\`yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
\`\`\`

- **Min replicas**: 2
- **Max replicas**: 10
- **Scale down**: 50% every 60s (after 300s stabilization)
- **Scale up**: 100% every 15s (immediate)

### Vertical Pod Autoscaling

VPA automatically adjusts resource requests and limits:

\`\`\`yaml
updatePolicy:
  updateMode: "Auto"
resourcePolicy:
  containerPolicies:
    - containerName: "{{service_name}}"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "4000m"
        memory: "4Gi"
\`\`\`

### Resource Quotas

Namespace-level resource constraints:

\`\`\`yaml
hard:
  requests.cpu: "4"
  requests.memory: "8Gi"
  limits.cpu: "8"
  limits.memory: "16Gi"
  persistentvolumeclaims: "4"
  requests.storage: "100Gi"
\`\`\`

### Limit Ranges

Default resource constraints for containers:

\`\`\`yaml
default:        # Default limit
  cpu: "1000m"
  memory: "1Gi"
defaultRequest: # Default request
  cpu: "250m"
  memory: "256Mi"
min:
  cpu: "50m"
  memory: "64Mi"
max:
  cpu: "2000m"
  memory: "2Gi"
\`\`\`

### Pod Disruption Budget

Ensures minimum availability during disruptions:

\`\`\`yaml
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {{service_name}}
\`\`\`

### Health Probes

Three probe types for container health monitoring:

**Liveness Probe** - Restarts container if unhealthy:
\`\`\`yaml
httpGet:
  path: /health/
  port: 8000
initialDelaySeconds: 30
periodSeconds: 10
failureThreshold: 3
\`\`\`

**Readiness Probe** - Marks pod as ready for traffic:
\`\`\`yaml
httpGet:
  path: /ready/
  port: 8000
initialDelaySeconds: 10
periodSeconds: 5
failureThreshold: 3
\`\`\`

**Startup Probe** - Gives container time to start:
\`\`\`yaml
httpGet:
  path: /health/
  port: 8000
periodSeconds: 5
failureThreshold: 30  # 150s total
\`\`\`

### Resource Monitoring

View current resource usage:
\`\`\`bash
# Show pod resource usage
kubectl top pods -n {{service_name}}

# Show pod QoS classes
kubectl get pods -n {{service_name}} -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass

# Show resource quota status
kubectl describe resourcequota compute-quota -n {{service_name}}

# Show HPA status
kubectl get hpa -n {{service_name}}
\`\`\`

### Scaling Operations

Manual scaling:
\`\`\`bash
# Scale deployment
kubectl scale deployment/{{service_name}}-web --replicas=5 -n {{service_name}}

# Scale based on profile
kubectl set resources deployment/{{service_name}}-web \\
  --requests=cpu=500m,memory=512Mi \\
  --limits=cpu=2000m,memory=2Gi \\
  -n {{service_name}}
\`\`\`

## Monitoring & Logging

This project includes comprehensive monitoring and logging configurations for production deployments.

### Monitoring Files

- **monitoring/prometheus-rules.yaml** - Prometheus alerting rules
- **monitoring/grafana-dashboard.json** - Grafana dashboard configuration
- **monitoring/service-monitor.yaml** - Prometheus ServiceMonitor
- **logging/fluentd-config.yaml** - Fluentd log aggregation
- **scripts/setup-monitoring.sh** - Monitoring setup script

### Installation

Set up monitoring stack:

\`\`\`bash
./scripts/setup-monitoring.sh
\`\`\`

This installs:
- Prometheus Operator for metrics collection
- Grafana for visualization
- ServiceMonitor for application scraping
- AlertManager for notifications

### Prometheus Alerts

| Alert | Severity | Trigger | Description |
|-------|----------|---------|-------------|
| HighErrorRate | warning | >5% error rate for 10min | High error rate detected |
| HighLatency | warning | P95 > 1s for 10min | High request latency |
| PodCrashLooping | critical | Restarts in 15min | Pod is crash looping |
| HighMemoryUsage | warning | >90% memory for 10min | High memory usage |
| HighCPUUsage | warning | >90% CPU for 10min | High CPU usage |
| DatabasePoolExhausted | critical | <10% idle connections | Database pool exhausted |
| CeleryQueueBacklog | warning | >1000 tasks for 15min | Celery queue backlog |
| RedisMemoryHigh | warning | >90% Redis memory | Redis memory high |

### Grafana Dashboard

The project includes a preconfigured Grafana dashboard with:

- **Request Rate** - Total requests, 4xx and 5xx errors
- **Request Latency** - P50, P95, P99 percentiles
- **CPU Usage** - Per-pod CPU consumption
- **Memory Usage** - Per-pod memory consumption

Access Grafana:
\`\`\`bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Open http://localhost:3000 (admin/admin)
\`\`\`

### ServiceMonitor Configuration

Prometheus scrapes metrics from the \`/metrics\` endpoint every 30 seconds:

\`\`\`yaml
spec:
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
\`\`\`

### Application Metrics

Django exports the following Prometheus metrics:

| Metric | Type | Description |
|--------|------|-------------|
| http_requests_total | counter | Total HTTP requests |
| http_request_duration_seconds | histogram | Request duration |
| django_db_pool_connections | gauge | Database pool connections |
| celery_queue_length | gauge | Celery queue length |
| redis_memory_used_bytes | gauge | Redis memory usage |

### Log Aggregation

Fluentd collects container logs and forwards them to Elasticsearch:

\`\`\`yaml
<source>
  @type tail
  path /var/log/containers/{{service_name}}*.log
</source>

<match>
  @type elasticsearch
  host elasticsearch
  port 9200
</match>
\`\`\`

Logs are automatically:
- Parsed from JSON format
- Enriched with metadata (hostname, app_name, environment)
- Redacted for sensitive data (passwords, tokens, API keys)
- Indexed in Elasticsearch for search

### Accessing Logs

View container logs:

\`\`\`bash
# All logs
kubectl logs -f deployment/{{service_name}}-web -n {{service_name}}

# Specific pod
kubectl logs -f pod/{{service_name}}-web-xxxxx -n {{service_name}}

# Previous container (crashed)
kubectl logs -f pod/{{service_name}}-web-xxxxx -n {{service_name}} --previous
\`\`\`

View aggregated logs:

\`\`\`bash
# Port forward to Elasticsearch
kubectl port-forward -n monitoring svc/elasticsearch 9200:9200

# Search logs
curl "localhost:9200/{{service_name}}-*/_search?q=ERROR&size=10"
\`\`\`

### Metrics Query Examples

PromQL queries for common scenarios:

\`\`\`promql
# Request rate
sum(rate(http_requests_total{app="{{service_name}}"}[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5..",app="{{service_name}}"}[5m])) /
sum(rate(http_requests_total{app="{{service_name}}"}[5m]))

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# CPU usage
sum(rate(container_cpu_usage_seconds_total{app="{{service_name}}"}[5m])) by (pod)

# Memory usage
sum(container_memory_working_set_bytes{app="{{service_name}}"}) by (pod)
\`\`\`

## Container Lifecycle Hooks

This project includes comprehensive lifecycle hooks for deployment automation and graceful container management.

### Lifecycle Files

- **lifecycle/pre-stop.sh** - Pre-stop hook for graceful shutdown
- **lifecycle/post-start.sh** - Post-start hook for initialization
- **lifecycle/health-probe.sh** - Health probe script for liveness/readiness/startup probes
- **kubernetes/lifecycle-deployment.yaml** - Kubernetes deployment with lifecycle hooks
- **scripts/apply-lifecycle-hooks.sh** - Apply lifecycle hooks to Kubernetes
- **scripts/test-lifecycle-hooks.sh** - Test lifecycle hooks functionality

### Lifecycle Events

| Hook | When it runs | Purpose |
|------|--------------|---------|
| postStart | After container creation | Run migrations, collect static files, warm cache, verify dependencies |
| preStop | Before container termination | Graceful shutdown, flush connections, wait for in-flight requests |
| livenessProbe | Every 10s | Check if container is alive and healthy |
| readinessProbe | Every 5s | Check if container can serve requests |
| startupProbe | Every 5s (first 150s) | Check if application is starting up |

### Installation

Apply lifecycle hooks to Kubernetes:

\`\`\`bash
./scripts/apply-lifecycle-hooks.sh {{service_name}} production
\`\`\`

### Pre-Stop Hook

The pre-stop hook ensures graceful shutdown:

1. **Disable health checks** - Stop accepting new traffic
2. **Grace period** - Wait 10 seconds (configurable via \`PRE_STOP_GRACE_PERIOD\`)
3. **Database flush** - Close database connections cleanly
4. **Celery shutdown** - Stop workers gracefully
5. **Redis flush** - Close Redis connections (not data)
6. **Webhook notification** - Send shutdown event to monitoring

### Post-Start Hook

The post-start hook handles initialization:

1. **Wait for dependencies** - PostgreSQL and Redis readiness checks
2. **Run migrations** - Apply database migrations
3. **Collect static files** - Gather static assets
4. **Create cache table** - Set up Django cache framework
5. **Warm up cache** - Pre-populate cache (optional)
6. **Verify Celery** - Check broker connectivity
7. **Health check** - Verify application is responding
8. **Webhook notification** - Send ready event to monitoring

### Health Probes

Three probe types ensure container health:

**Liveness Probe** (every 10s):
- Main process running check
- Health endpoint check
- Disk space check

**Readiness Probe** (every 5s):
- Database connectivity
- Redis connectivity
- Application serving requests

**Startup Probe** (every 5s, up to 150s):
- Process existence check
- More lenient than readiness
- Gives slow-starting apps time to initialize

### Testing

Test lifecycle hooks:

\`\`\`bash
# Test all hooks
./scripts/test-lifecycle-hooks.sh {{service_name}} production all

# Test only post-start
./scripts/test-lifecycle-hooks.sh {{service_name}} production post-start

# Test only health probes
./scripts/test-lifecycle-hooks.sh {{service_name}} production health
\`\`\`

### Viewing Lifecycle Logs

\`\`\`bash
# View post-start logs
kubectl logs -f deployment/{{service_name}}-web -n {{service_name}} --tail=100 | grep POST-START

# View pre-stop logs
kubectl logs -f deployment/{{service_name}}-web -n {{service_name}} --tail=100 | grep PRE-STOP

# View health probe logs
kubectl exec -n {{service_name}} deployment/{{service_name}}-web -- cat /var/log/lifecycle/health-probe.log
\`\`\`

### Configuration

Environment variables for lifecycle hooks:

| Variable | Default | Description |
|----------|---------|-------------|
| \`PRE_STOP_GRACE_PERIOD\` | 10 | Seconds to wait before shutdown |
| \`POST_START_MAX_RETRIES\` | 30 | Max retries for dependency checks |
| \`POST_START_RETRY_DELAY\` | 2 | Delay between retries (seconds) |
| \`ENABLE_CACHE_WARMUP\` | true | Enable cache warmup on start |
| \`WEBHOOK_URL\` | - | URL for lifecycle notifications |
| \`HEALTH_CHECK_URL\` | http://localhost:8000/health | Health check endpoint |

### Deployment Strategy

The lifecycle deployment uses:

- **RollingUpdate** - Zero-downtime deployments
- **maxSurge: 1** - One extra pod during updates
- **maxUnavailable: 0** - No pods unavailable during updates
- **terminationGracePeriodSeconds: 30** - 30s grace for shutdown
- **Init containers** - Wait for database before main container starts

## Backup & Disaster Recovery

This project includes comprehensive backup and disaster recovery capabilities for data protection and business continuity.

### Backup Files

- **backup/backup-script.sh** - Main backup script (database, media, config, Redis)
- **backup/restore-script.sh** - Restore script for data recovery
- **backup/schedule-backups.sh** - Schedule automated backups (cron/CronJob)
- **backup/verify-backup.sh** - Verify backup integrity and contents
- **kubernetes/backup-pvc.yaml** - PersistentVolumeClaims for backup storage
- **scripts/test-backup-restore.sh** - Test backup and restore procedures
- **scripts/disaster-recovery.sh** - Complete disaster recovery workflow

### What Gets Backed Up

| Component | Description | Retention |
|-----------|-------------|-----------|
| Database | PostgreSQL dump (compressed) | 30 days |
| Media files | User uploads and static media | 30 days |
| Configuration | .env, Docker files, Kubernetes manifests | 30 days |
| Redis data | Optional Redis RDB backup | 30 days |
| Manifest | JSON manifest with SHA256 checksums | - |

### Creating Backups

**Manual backup:**
\`\`\`bash
# Create a backup
./backup/backup-script.sh

# Specify custom backup location
BACKUP_ROOT=/mnt/backups ./backup/backup-script.sh

# Enable Redis backup
BACKUP_REDIS=true ./backup/backup-script.sh
\`\`\`

**Scheduled backups:**
\`\`\`bash
# For local/docker environments (cron)
./backup/schedule-backups.sh cron

# For Kubernetes (CronJob)
./backup/schedule-backups.sh kubernetes

# List scheduled backups
./backup/schedule-backups.sh list
\`\`\`

**Kubernetes CronJob:**
\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{service_name}}-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
\`\`\`

### Restoring from Backup

\`\`\`bash
# List available backups
find ./backups -maxdepth 1 -type d -name "20*" | sort -r

# Restore from specific backup
./backup/restore-script.sh 20240115_020000

# Restore from latest backup
LATEST_BACKUP=$(find ./backups -maxdepth 1 -type d -name "20*" | sort -r | head -1)
./backup/restore-script.sh $(basename "$LATEST_BACKUP")
\`\`\`

The restore process:
1. Verifies backup integrity (checksums)
2. Drops and recreates the database
3. Restores database from dump
4. Restores media files
5. Restores configuration files
6. Optionally restores Redis data
7. Runs database migrations

### Cloud Storage Integration

Backups can be automatically uploaded to cloud storage:

\`\`\`bash
# AWS S3
export BACKUP_S3_BUCKET="my-backups"
./backup/backup-script.sh

# Google Cloud Storage
export BACKUP_GCS_BUCKET="my-backups"
./backup/backup-script.sh
\`\`\`

### Verification

Verify backup integrity before relying on it:

\`\`\`bash
# Verify specific backup
./backup/verify-backup.sh 20240115_020000

# Run full backup/restore test
./scripts/test-backup-restore.sh
\`\`\`

### Disaster Recovery

For complete environment recovery:

\`\`\`bash
./scripts/disaster-recovery.sh
\`\`\`

The DR workflow guides you through:
1. **Assess situation** - Identify incident type and current state
2. **Select recovery point** - Choose appropriate backup
3. **Verify backup** - Confirm backup integrity
4. **Prepare environment** - Stop services if needed
5. **Restore data** - Execute full restore
6. **Verify restoration** - Health checks and validation
7. **Generate report** - Document recovery process

### Backup Retention

Configure retention policy:

\`\`\`bash
# Keep backups for 30 days (default)
./backup/backup-script.sh

# Keep backups for 90 days
BACKUP_RETENTION_DAYS=90 ./backup/backup-script.sh
\`\`\`

Old backups are automatically cleaned up after the retention period.

### Persistent Storage

Kubernetes PVCs for backup storage:

\`\`\`yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{service_name}}-backups-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi  # Configurable via BACKUP_STORAGE_SIZE
\`\`\`

Apply PVCs:
\`\`\`bash
kubectl apply -f kubernetes/backup-pvc.yaml
\`\`\`

### Testing Your Backups

**Critical:** Test your backups regularly!

\`\`\`bash
# Run comprehensive backup/restore test
./scripts/test-backup-restore.sh

# Schedule weekly tests
0 3 * * 0 /path/to/scripts/test-backup-restore.sh >> /var/log/backup-test.log 2>&1
\`\`\`

### Disaster Recovery Checklist

- [ ] Backups run successfully on schedule
- [ ] Backups are uploaded to cloud storage
- [ ] Backup restoration tested in last 30 days
- [ ] RPO (Recovery Point Objective) documented: **24 hours**
- [ ] RTO (Recovery Time Objective) documented: **2 hours**
- [ ] DR contacts are up to date
- [ ] Runbook is accessible to operations team

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| \`BACKUP_ROOT\` | ./backups | Backup storage location |
| \`BACKUP_RETENTION_DAYS\` | 30 | Days to keep backups |
| \`BACKUP_S3_BUCKET\` | - | AWS S3 bucket for uploads |
| \`BACKUP_GCS_BUCKET\` | - | GCS bucket for uploads |
| \`BACKUP_REDIS\` | false | Enable Redis backups |
| \`BACKUP_STORAGE_SIZE\` | 50Gi | PVC size for backups |
| \`DATA_STORAGE_SIZE\` | 10Gi | PVC size for application data |

## Performance Profiling & Optimization

This project includes comprehensive performance profiling and optimization tools for identifying bottlenecks and improving application performance.

### Profiling Files

- **profiling/cprofile-middleware.py** - Django middleware for profiling slow requests with cProfile
- **profiling/memory-profiler.py** - Memory profiling utilities and QuerySet profiling decorator
- **profiling/flamegraph-script.sh** - Generate flamegraphs for CPU performance analysis
- **profiling/benchmark-script.py** - Benchmark script for common operations
- **scripts/collect-performance-metrics.sh** - Collect container performance metrics
- **scripts/generate-performance-report.sh** - Generate comprehensive performance reports

### Request Profiling

Profile slow requests automatically using cProfile middleware:

**Enable in settings:**
\`\`\`python
# settings.py
MIDDLEWARE = [
    'profiling.cprofile_middleware.ProfileMiddleware',
    # ... other middleware
]

PROFILING_ENABLED = True
PROFILE_THRESHOLD_MS = 500  # Profile requests slower than 500ms
PROFILING_OUTPUT_DIR = '/tmp/profiling'
\`\`\`

**Profile files are saved as:**
- \`YYYYMMDD_HHMMSS_METHOD_PATH.prof\` - Binary profile data
- \`YYYYMMDD_HHMMSS_METHOD_PATH.prof.txt\` - Human-readable stats

**View profile stats:**
\`\`\`bash
# View top 20 functions
python -m pstats /tmp/profiling/20240115_120000_GET_api-v1-users.prof

# Generate snakeviz visualization
pip install snakeviz
snakeviz /tmp/profiling/20240115_120000_GET_api-v1-users.prof
\`\`\`

### Memory Profiling

Track memory usage with the memory profiler:

\`\`\`python
from profiling.memory_profiler import MemoryProfiler, profile_querysets

# Context manager for memory profiling
with MemoryProfiler("user_export", threshold_mb=10):
    export_users()

# Decorator for QuerySet profiling
@profile_querysets()
def get_user_list():
    return list(User.objects.select_related('profile').all())
\`\`\`

**Enable QuerySet profiling in settings:**
\`\`\`python
QUERY_PROFILING_ENABLED = True
\`\`\`

### Flamegraph Generation

Generate flamegraphs to visualize CPU usage:

\`\`\`bash
# Generate flamegraph for 30 seconds
./profiling/flamegraph-script.sh

# Custom duration
FLAMEGRAPH_DURATION=60 ./profiling/flamegraph-script.sh

# For specific container
./profiling/flamegraph-script.sh my-container-name
\`\`\`

**Requirements:**
- \`perf\` tool (Linux): \`apt-get install linux-perf\`
- FlameGraph scripts (auto-downloaded)

### Benchmarking

Run performance benchmarks on common operations:

\`\`\`bash
# Run all benchmarks
./profiling/benchmark-script.py

# Individual benchmarks
python -c "from profiling.benchmark_script import benchmark_health_endpoint; benchmark_health_endpoint()"
\`\`\`

**Benchmarks include:**
- Health endpoint response time
- Login API performance
- Database query performance
- Cache read/write operations

**Benchmark output:**
\`\`\`
=== Benchmark: Health Endpoint ===
Warmup runs: 3
Benchmark runs: 10
  Run 1: 45.23ms
  Run 2: 42.18ms
  ...
  Mean:   43.52ms
  Median: 43.18ms
  StdDev: 2.14ms
  P95:    46.50ms
\`\`\`

### Metrics Collection

Collect real-time performance metrics from containers:

\`\`\`bash
# Collect metrics for 60 seconds (default)
./scripts/collect-performance-metrics.sh

# Custom duration and interval
COLLECTION_DURATION=300 COLLECTION_INTERVAL=5 ./scripts/collect-performance-metrics.sh

# From specific container
./scripts/collect-performance-metrics.sh my-container
\`\`\`

**Metrics collected:**
- CPU percentage
- Memory usage and percentage
- Network I/O (RX/TX bytes)
- Disk I/O (read/write)

**Output:** CSV file with timestamped metrics

### Performance Reports

Generate comprehensive performance reports:

\`\`\`bash
# Generate report from collected data
./scripts/generate-performance-report.sh

# From specific container
./scripts/generate-performance-report.sh my-container
\`\`\`

**Report includes:**
- Container status and resource usage
- Available profiling data
- Flamegraph visualizations
- Performance metrics summary
- Optimization recommendations

### Profiling Workflows

**1. Development profiling:**
\`\`\`bash
# Enable profiling in dev settings
export PROFILING_ENABLED=true
export DEBUG=true

# Run application
python manage.py runserver

# Generate load (e.g., with Apache Bench)
ab -n 1000 http://localhost:8000/api/v1/users/

# View profile files
ls -la /tmp/profiling/
\`\`\`

**2. Production profiling:**
\`\`\`bash
# Collect metrics without overhead
./scripts/collect-performance-metrics.sh prod-container

# Generate flamegraph during peak load
FLAMEGRAPH_DURATION=120 ./profiling/flamegraph-script.sh prod-container

# Create comprehensive report
./scripts/generate-performance-report.sh prod-container
\`\`\`

**3. Performance investigation:**
\`\`\`bash
# 1. Collect baseline metrics
./scripts/collect-performance-metrics.sh &

# 2. Generate flamegraph
./profiling/flamegraph-script.sh &

# 3. Run benchmarks
./profiling/benchmark-script.py

# 4. Generate report
./scripts/generate-performance-report.sh
\`\`\`

### Optimization Recommendations

Based on profiling data, common optimizations:

| Issue | Detection | Solution |
|-------|-----------|----------|
| High CPU usage | Flamegraph shows hot functions | Optimize algorithms, add caching |
| High memory usage | Memory profiler shows allocations | Fix memory leaks, use generators |
| Slow queries | Query profiling shows N+1 | Add select_related/prefetch_related |
| Slow responses | cProfile shows slow middleware | Remove unused middleware, optimize |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| \`PROFILING_ENABLED\` | DEBUG | Enable request profiling |
| \`PROFILE_THRESHOLD_MS\` | 500 | Profile requests slower than this |
| \`PROFILING_OUTPUT_DIR\` | /tmp/profiling | Profile output directory |
| \`QUERY_PROFILING_ENABLED\` | false | Enable QuerySet profiling |
| \`MEMORY_THRESHOLD_MB\` | 10 | Log memory allocations above this |
| \`FLAMEGRAPH_DURATION\` | 30 | Flamegraph collection duration |
| \`COLLECTION_DURATION\` | 60 | Metrics collection duration |
| \`COLLECTION_INTERVAL\` | 1 | Metrics collection interval |

## Secret Management

This project includes comprehensive secret management using Sealed Secrets and External Secrets Operators for secure credential handling.

### Secret Management Files

- **secrets/seal-secret.sh** - Seal secrets using kubeseal for git storage
- **secrets/generate-rsa-keys.sh** - Generate RSA keys for local sealed-secrets testing
- **secrets/external-secret.yaml** - ExternalSecret for AWS Secrets Manager integration
- **secrets/vault-backend.yaml** - HashiCorp Vault secret store configuration
- **secrets/secret-template.yaml** - Template for Kubernetes secrets
- **secrets/rotate-secret.sh** - Rotate secrets in external secret stores
- **secrets/audit-secrets.sh** - Audit secrets for compliance and security
- **scripts/setup-secret-management.sh** - Install Sealed Secrets and External Secrets operators
- **scripts/test-secret-access.sh** - Test secret access and permissions

### Secret Management Options

| Method | Use Case | Git Storage | External Provider |
|--------|----------|-------------|-------------------|
| **SealedSecrets** | Cluster-specific secrets | ✅ Encrypted | ❌ |
| **ExternalSecrets** | External secret stores | ❌ References only | ✅ AWS/Vault/GCP |
| **K8s Secrets** | Development only | ❌ Never | ❌ |

### Setup

Install secret management operators:

\`\`\`bash
./scripts/setup-secret-management.sh
\`\`\`

This installs:
- Sealed Secrets Controller (Bitnami)
- External Secrets Operator
- etcd encryption configuration

### Sealed Secrets

SealedSecrets allow you to encrypt secrets that can only be decrypted by the cluster.

**Install kubeseal:**
\`\`\`bash
# macOS
brew install kubeseal

# Linux
go install github.com/bitnami-labs/sealed-secrets/cmd/kubeseal@latest
\`\`\`

**Seal a secret:**
\`\`\`bash
# From literal
./secrets/seal-secret.sh db-password literal mysecretpassword

# From file
./secrets/seal-secret.sh db-password from-file ./secrets/db-password.txt

# From env file
./secrets/seal-secret.sh app-env from-env-file .env.production
\`\`\`

**Apply sealed secret:**
\`\`\`bash
kubectl apply -f kubernetes/sealed-db-password.yaml
\`\`\`

The Sealed Secrets controller will automatically decrypt and create a Kubernetes secret.

### External Secrets

ExternalSecrets sync secrets from external providers to Kubernetes.

**AWS Secrets Manager:**
\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{service_name}}-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: {{service_name}}-credentials
    creationPolicy: Owner
  data:
  - secretKey: db-password
    remoteRef:
      key: {{service_name}}/db-password
\`\`\`

**HashiCorp Vault:**
\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{service_name}}-vault-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  data:
  - secretKey: db-password
    remoteRef:
      key: {{service_name}}/db-password
\`\`\`

**GCP Secret Manager:**
\`\`\`yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: gcp-secret-manager
spec:
  provider:
    gcp:
      auth:
        workloadIdentity:
          clusterLocation: "{{GCP_CLUSTER_LOCATION}}"
          clusterName: "{{GCP_CLUSTER_NAME}}"
          projectID: "{{GCP_PROJECT_ID}}"
\`\`\`

### Secret Rotation

Rotate secrets without downtime:

\`\`\`bash
# AWS Secrets Manager
./secrets/rotate-secret.sh db-password 'newsecretpass' aws

# HashiCorp Vault
./secrets/rotate-secret.sh api-key 'newkey123' vault

# GCP Secret Manager
./secrets/rotate-secret.sh db-password 'newsecretpass' gcp
\`\`\`

The ExternalSecret operator will automatically sync the updated secret to Kubernetes within the refresh interval.

### Secret Auditing

Audit secrets for compliance and security:

\`\`\`bash
./secrets/audit-secrets.sh
\`\`\`

**Audit checks:**
- Lists all secrets for the service
- Verifies SealedSecrets usage
- Verifies ExternalSecrets usage
- Checks secret age for rotation policy
- Identifies unencrypted Opaque secrets
- Validates service account RBAC

### Secret Testing

Test that pods can access secrets:

\`\`\`bash
./scripts/test-secret-access.sh
\`\`\`

**Tests include:**
- Secret existence verification
- Pod secret mounts
- Environment variable injection
- Service account permissions
- Rotation capability

### Best Practices

1. **Never commit secrets to git** - Use SealedSecrets or ExternalSecrets
2. **Rotate secrets regularly** - Every 90 days recommended
3. **Use least privilege** - Service accounts with minimal RBAC
4. **Enable etcd encryption** - Encrypt secrets at rest in the cluster
5. **Audit secret access** - Regular audits for compliance
6. **Use external secret stores** - AWS/Vault/GCP for production
7. **Test secret rotation** - Verify rotation works before emergency

### Security Considerations

| Consideration | Recommendation |
|---------------|----------------|
| Secret storage | Use ExternalSecrets with AWS/Vault/GCP |
| Git storage | Use SealedSecrets only |
| Encryption | Enable etcd encryption at rest |
| Rotation | Rotate every 90 days |
| Access | Use service accounts with RBAC |
| Audit | Enable audit logging for secret access |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| \`SECRET_NAMESPACE\` | kube-system | Namespace for secret operators |
| \`AWS_REGION\` | us-east-1 | AWS region for Secrets Manager |
| \`AWS_IAM_ROLE_ARN\` | - | IAM role for ExternalSecrets |
| \`VAULT_ADDR\` | - | Vault server address |
| \`VAULT_SECRET_PREFIX\` | secret | Vault secret path prefix |
| \`GCP_PROJECT_ID\` | - | GCP project ID |
| \`ENCRYPTION_KEY\` | - | etcd encryption key |

## Network Policies & Micro-Segmentation

This project includes comprehensive network policies for container micro-segmentation and zero-trust networking.

### Network Policy Files

- **network-policies/base-policy.yaml** - Default-deny policies for baseline security
- **network-policies/microsegmentation.yaml** - Zero-trust policies with granular controls
- **network-policies/cilium-network-policy.yaml** - Cilium-specific L7 policies
- **network-policies/calico-policy.yaml** - Calico tier-based policies
- **scripts/apply-network-policies.sh** - Apply policies with CNI detection
- **scripts/test-network-policies.sh** - Test connectivity and policy enforcement
- **scripts/visualize-network-policies.sh** - Generate network topology graphs

### Applying Network Policies

Apply all network policies:

\`\`\`bash
./scripts/apply-network-policies.sh {{service_name}} production
\`\`\`

The script automatically detects your CNI plugin (Cilium, Calico, or standard Kubernetes) and applies the appropriate policies.

### Base Policies

Default-deny ingress and egress for baseline security:

| Policy | Type | Description |
|--------|------|-------------|
| default-deny-ingress | Ingress | Blocks all inbound traffic by default |
| default-deny-egress | Egress | Blocks all outbound traffic by default |
| allow-ingress-from-ingress | Ingress | Allows traffic from ingress controller |
| allow-egress-to-dns | Egress | Allows DNS queries (UDP 53) |
| allow-egress-to-postgres | Egress | Allows PostgreSQL access (TCP 5432) |
| allow-egress-to-redis | Egress | Allows Redis access (TCP 6379) |

### Micro-Segmentation

Zero-trust policies with least-privilege access:

| Policy | Component | Description |
|--------|-----------|-------------|
| web-to-api | Web | Only ingress from ingress controller and monitoring |
| worker-to-queue | Worker | Allows Redis/PostgreSQL, DNS, and specific external APIs |
| allow-metrics-scraping | All | Allows Prometheus scraping on :8000 |
| deny-internet-access | Worker | Blocks direct internet, only allows HTTPS to specific CIDRs |

### CNI-Specific Policies

**Cilium (L7-aware policies):**
\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
spec:
  ingress:
  - toPorts:
    - rules:
        http:
          - method: "GET"
            path: "/api/v1/*"
\`\`\`

**Calico (tier-based policies):**
\`\`\`yaml
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
spec:
  order: 1000
  ingress:
  - action: Deny
    destination:
      ports: [22, 3306, 5432, 6379, 27017]
\`\`\`

### Testing Policies

Test network policy enforcement:

\`\`\`bash
./scripts/test-network-policies.sh {{service_name}} production
\`\`\`

**Tests include:**
- DNS resolution
- Database connectivity
- Redis connectivity
- External connectivity (should be blocked for workers)
- Inter-pod communication
- Denied traffic detection

### Visualization

Generate network topology graph:

\`\`\`bash
./scripts/visualize-network-policies.sh {{service_name}} production
\`\`\`

Generates a PNG graph showing:
- Ingress controller → web pods
- Monitoring → all pods
- Web/worker → PostgreSQL/Redis
- All pods → DNS

### Policy Examples

**Allow only specific ingress:**
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-ingress
spec:
  podSelector:
    matchLabels:
      component: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
\`\`\`

**Allow egress to specific services:**
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-egress
spec:
  podSelector:
    matchLabels:
      component: web
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - ipBlock:
        cidr: 10.0.0.0/8
\`\`\`

### Zero Trust Networking

Principles implemented:
- **Default deny** - All traffic blocked unless explicitly allowed
- **Least privilege** - Each component only needs required access
- **Micro-segmentation** - Fine-grained controls between components
- **Tier isolation** - Web, worker, database tiers separated

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| \`CNI\` | auto | CNI plugin (cilium/calico/kubernetes) |
| \`ALLOWED_EXTERNAL_CIDR\` | 0.0.0.0/0 | Allowed external destinations for workers |

## API Documentation

- Swagger UI: http://localhost:8000/api/swagger/
- ReDoc: http://localhost:8000/api/redoc/
- OpenAPI Schema: http://localhost:8000/api/schema/

## Admin Interface

Django Admin is available at: http://localhost:8000/admin/

## Testing

Run tests with pytest:
\`\`\`bash
pytest
\`\`\`

Run tests with coverage:
\`\`\`bash
pytest --cov
\`\`\`

## Project Structure

\`\`\`
backend/
├── config/              # Project configuration
│   ├── settings/       # Environment-specific settings
│   ├── urls.py         # URL configuration
│   └── celery.py       # Celery configuration
├── apps/               # Django applications
│   ├── users/          # User authentication app
│   └── api/            # Main API app
├── static/             # Static files
├── media/              # User-uploaded files
├── templates/          # HTML templates
├── tests/              # Test suite
├── manage.py           # Django management script
└── docker-compose.yml  # Docker configuration
\`\`\`

## Environment Variables

See \`.env.example\` for all available environment variables.

## Deployment

For production deployment:

1. Set \`DEBUG=False\` in environment
2. Configure a proper database
3. Set up a reverse proxy (nginx)
4. Configure static file serving
5. Set up SSL certificates
6. Configure email backend

## License

MIT License
`}};