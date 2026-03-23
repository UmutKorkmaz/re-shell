#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🐍 Testing Django REST Framework Template Implementation');
console.log('=====================================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.15.0',
  djangoRestTest: {
    templateName: 'Django REST Framework',
    templateFile: 'django-rest-py.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// Django REST template test cases
const djangoRestTests = [
  // Core Framework Tests
  {
    name: 'Django Framework',
    test: (content) => content.includes("django: '^4.2.7'"),
    description: 'Template includes Django framework',
    critical: true
  },
  {
    name: 'Django REST Framework',
    test: (content) => content.includes("djangorestframework: '^3.14.0'"),
    description: 'Template includes Django REST Framework',
    critical: true
  },
  {
    name: 'JWT Authentication',
    test: (content) => content.includes("'djangorestframework-simplejwt'") || content.includes("djangorestframework-simplejwt=="),
    description: 'Template includes JWT authentication',
    critical: true
  },
  {
    name: 'CORS Headers',
    test: (content) => content.includes("'django-cors-headers'") || content.includes("django-cors-headers=="),
    description: 'Template includes CORS support',
    critical: true
  },
  {
    name: 'Django Filter',
    test: (content) => content.includes("'django-filter'") || content.includes("django-filter=="),
    description: 'Template includes advanced filtering',
    critical: true
  },

  // Project Structure Tests
  {
    name: 'Project Settings Structure',
    test: (content) => content.includes('{{projectName}}/settings/base.py') && content.includes('development.py') && content.includes('production.py'),
    description: 'Template includes structured settings configuration',
    critical: true
  },
  {
    name: 'Django Apps Structure',
    test: (content) => content.includes('apps/core/') && content.includes('apps/users/') && content.includes('apps/blog/'),
    description: 'Template includes organized app structure',
    critical: true
  },
  {
    name: 'URL Configuration',
    test: (content) => content.includes('{{projectName}}/urls.py') && content.includes('DefaultRouter'),
    description: 'Template includes URL routing configuration',
    critical: true
  },
  {
    name: 'WSGI and ASGI',
    test: (content) => content.includes('wsgi.py') && content.includes('asgi.py'),
    description: 'Template includes WSGI and ASGI configuration',
    critical: true
  },

  // User Management Tests
  {
    name: 'Custom User Model',
    test: (content) => content.includes('AbstractUser') && content.includes('AUTH_USER_MODEL'),
    description: 'Template includes custom user model',
    critical: true
  },
  {
    name: 'User Profile Model',
    test: (content) => content.includes('UserProfile') && content.includes('OneToOneField'),
    description: 'Template includes user profile extension',
    critical: true
  },
  {
    name: 'User Serializers',
    test: (content) => content.includes('UserSerializer') && content.includes('UserCreateSerializer'),
    description: 'Template includes user serializers',
    critical: true
  },
  {
    name: 'User ViewSets',
    test: (content) => content.includes('UserViewSet') && content.includes('ModelViewSet'),
    description: 'Template includes user ViewSets',
    critical: true
  },

  // Authentication Tests
  {
    name: 'Custom JWT Views',
    test: (content) => content.includes('CustomTokenObtainPairView') && content.includes('TokenObtainPairSerializer'),
    description: 'Template includes custom JWT authentication views',
    critical: true
  },
  {
    name: 'Password Validation',
    test: (content) => content.includes('validate_password') && content.includes('ChangePasswordSerializer'),
    description: 'Template includes password validation',
    critical: true
  },
  {
    name: 'JWT Configuration',
    test: (content) => content.includes('SIMPLE_JWT') && content.includes('ACCESS_TOKEN_LIFETIME'),
    description: 'Template includes JWT configuration',
    critical: true
  },

  // Blog System Tests
  {
    name: 'Blog Models',
    test: (content) => content.includes('apps/blog/models.py') && content.includes('Post') && content.includes('Category'),
    description: 'Template includes comprehensive blog models',
    critical: true
  },
  {
    name: 'Blog Serializers',
    test: (content) => content.includes('PostListSerializer') && content.includes('PostDetailSerializer'),
    description: 'Template includes blog serializers',
    critical: true
  },
  {
    name: 'Blog ViewSets',
    test: (content) => content.includes('PostViewSet') && content.includes('CategoryViewSet'),
    description: 'Template includes blog ViewSets',
    critical: true
  },
  {
    name: 'Comment System',
    test: (content) => content.includes('Comment') && content.includes('CommentViewSet'),
    description: 'Template includes comment system',
    critical: true
  },

  // API Features Tests
  {
    name: 'Pagination',
    test: (content) => content.includes('StandardResultsSetPagination') && content.includes('PageNumberPagination'),
    description: 'Template includes pagination classes',
    critical: true
  },
  {
    name: 'Filtering and Search',
    test: (content) => content.includes('DjangoFilterBackend') && content.includes('SearchFilter'),
    description: 'Template includes filtering and search',
    critical: true
  },
  {
    name: 'Custom Permissions',
    test: (content) => content.includes('IsOwnerOrReadOnly') && content.includes('IsAuthorOrReadOnly'),
    description: 'Template includes custom permissions',
    critical: true
  },
  {
    name: 'API Throttling',
    test: (content) => content.includes('DEFAULT_THROTTLE_CLASSES') && content.includes('DEFAULT_THROTTLE_RATES'),
    description: 'Template includes API throttling',
    critical: true
  },

  // Database Tests
  {
    name: 'PostgreSQL Configuration',
    test: (content) => content.includes('postgresql') && content.includes('psycopg2'),
    description: 'Template includes PostgreSQL database configuration',
    critical: true
  },
  {
    name: 'Database Connection Settings',
    test: (content) => content.includes('CONN_MAX_AGE') && content.includes('DB_HOST'),
    description: 'Template includes database connection optimization',
    critical: true
  },
  {
    name: 'Timestamped Models',
    test: (content) => content.includes('TimestampedModel') && content.includes('created_at'),
    description: 'Template includes timestamped base model',
    critical: true
  },

  // Cache and Performance Tests
  {
    name: 'Redis Cache',
    test: (content) => content.includes('RedisCache') && content.includes('CACHES'),
    description: 'Template includes Redis caching',
    critical: true
  },
  {
    name: 'Session Configuration',
    test: (content) => content.includes('SESSION_ENGINE') && content.includes('SESSION_CACHE_ALIAS'),
    description: 'Template includes session configuration',
    critical: true
  },

  // Background Tasks Tests
  {
    name: 'Celery Integration',
    test: (content) => content.includes('celery:') && content.includes('django-celery-beat'),
    description: 'Template includes Celery for background tasks',
    critical: true
  },
  {
    name: 'Celery Configuration',
    test: (content) => content.includes('CELERY_BROKER_URL') && content.includes('celery_app.py'),
    description: 'Template includes Celery configuration',
    critical: true
  },

  // Testing Tests
  {
    name: 'Pytest Framework',
    test: (content) => content.includes("pytest: '^7.4.3'") && content.includes('pytest-django'),
    description: 'Template includes pytest testing framework',
    critical: true
  },
  {
    name: 'Test Configuration',
    test: (content) => content.includes('conftest.py') && content.includes('testing.py'),
    description: 'Template includes test configuration',
    critical: true
  },
  {
    name: 'Factory Boy',
    test: (content) => content.includes('factory-boy') && content.includes('test_users.py'),
    description: 'Template includes factory-boy for test data',
    critical: true
  },

  // Code Quality Tests
  {
    name: 'Code Formatting',
    test: (content) => content.includes('black:') && content.includes('isort:'),
    description: 'Template includes code formatting tools',
    critical: true
  },
  {
    name: 'Type Checking',
    test: (content) => content.includes('mypy:') && content.includes('django-stubs'),
    description: 'Template includes type checking',
    critical: true
  },
  {
    name: 'Linting',
    test: (content) => content.includes('flake8:') && content.includes('flake8-django'),
    description: 'Template includes linting tools',
    critical: true
  },

  // Development Tools Tests
  {
    name: 'Debug Toolbar',
    test: (content) => content.includes('django-debug-toolbar') && content.includes('debug_toolbar'),
    description: 'Template includes debug toolbar for development',
    critical: false
  },
  {
    name: 'Django Extensions',
    test: (content) => content.includes('django-extensions'),
    description: 'Template includes Django extensions',
    critical: false
  },
  {
    name: 'Silk Profiling',
    test: (content) => content.includes('django-silk') && content.includes('SILKY_PYTHON_PROFILER'),
    description: 'Template includes Silk profiling tool',
    critical: false
  },

  // Deployment Tests
  {
    name: 'Docker Configuration',
    test: (content) => content.includes('Dockerfile') && content.includes('docker-compose.yml'),
    description: 'Template includes Docker configuration',
    critical: true
  },
  {
    name: 'Production Settings',
    test: (content) => content.includes('SECURE_SSL_REDIRECT') && content.includes('SECURE_HSTS_SECONDS'),
    description: 'Template includes production security settings',
    critical: true
  },
  {
    name: 'Static Files',
    test: (content) => content.includes('STATIC_URL') && content.includes('STATICFILES_STORAGE'),
    description: 'Template includes static file configuration',
    critical: true
  },

  // Admin Interface Tests
  {
    name: 'Django Admin',
    test: (content) => content.includes('admin.py') && content.includes('UserAdmin'),
    description: 'Template includes Django admin configuration',
    critical: true
  },
  {
    name: 'Admin Customization',
    test: (content) => content.includes('list_display') && content.includes('search_fields'),
    description: 'Template includes admin interface customization',
    critical: true
  },

  // Logging Tests
  {
    name: 'Logging Configuration',
    test: (content) => content.includes('LOGGING') && content.includes('formatters'),
    description: 'Template includes logging configuration',
    critical: true
  },

  // Environment Tests
  {
    name: 'Environment Configuration',
    test: (content) => content.includes('django-environ') && content.includes('.env.example'),
    description: 'Template includes environment configuration',
    critical: true
  }
];

function testDjangoRestTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/django-rest-py.ts');
  const result = testResults.djangoRestTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running Django REST Framework template tests...\n');

  // Run all Django REST tests
  djangoRestTests.forEach(test => {
    result.featureCount++;
    
    try {
      const passed = test.test(content);
      const status = passed ? '✅' : '❌';
      const critical = test.critical ? '🚨' : '💡';
      
      console.log(`  ${status} ${critical} ${test.name}: ${test.description}`);
      
      result.features[test.name] = {
        passed,
        description: test.description,
        critical: test.critical
      };
      
      if (passed) {
        result.passedFeatures++;
      } else {
        result.failedFeatures++;
      }
    } catch (error) {
      console.log(`❌ 🚨 ${test.name}: Error running test - ${error.message}`);
      result.features[test.name] = {
        passed: false,
        description: test.description,
        critical: test.critical,
        error: error.message
      };
      result.failedFeatures++;
    }
  });

  return result;
}

// Run the test
const result = testDjangoRestTemplate();

// Print summary
console.log('\n📊 DJANGO REST FRAMEWORK TEMPLATE TEST SUMMARY');
console.log('===============================================');
console.log(`Template: ${result.templateName}`);
console.log(`Total Features: ${result.featureCount}`);
console.log(`✅ Passed: ${result.passedFeatures}`);
console.log(`❌ Failed: ${result.failedFeatures}`);
console.log(`📈 Success Rate: ${((result.passedFeatures / result.featureCount) * 100).toFixed(1)}%`);

// Check critical features
const criticalFeatures = Object.entries(result.features).filter(([_, feature]) => feature.critical);
const failedCritical = criticalFeatures.filter(([_, feature]) => !feature.passed);

if (failedCritical.length > 0) {
  console.log('\n🚨 Critical Features Failed:');
  failedCritical.forEach(([name, _]) => {
    console.log(`   ❌ ${name}`);
  });
}

// Save results
const resultsPath = path.join(__dirname, 'validate-django-rest-template-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All Django REST Framework template tests passed!' : '⚠️  Some Django REST Framework template tests failed'}`);

if (success) {
  console.log('\n🐍 Django REST Framework template includes enterprise features:');
  console.log('  • Django REST Framework with ViewSets and Serializers');
  console.log('  • JWT authentication with custom user model');
  console.log('  • Comprehensive blog system with categories, tags, and comments');
  console.log('  • Advanced filtering, searching, and pagination');
  console.log('  • Custom permissions and API throttling');
  console.log('  • PostgreSQL with optimized connection settings');
  console.log('  • Redis caching and session management');
  console.log('  • Celery background task processing');
  console.log('  • Docker containerization and production configuration');
  console.log('  • Comprehensive testing with pytest and factory-boy');
  console.log('  • Code quality tools (Black, mypy, isort, flake8)');
  console.log('  • Enhanced Django admin interface');
}

process.exit(success ? 0 : 1);