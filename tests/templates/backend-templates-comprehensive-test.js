const fs = require('fs');
const path = require('path');

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.9.0',
  templateTests: {},
  summary: {
    totalTemplates: 0,
    passedTemplates: 0,
    failedTemplates: 0,
    totalFeatures: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

const runTemplateTest = (templateName, templatePath) => {
  console.log(`\n🧪 Testing ${templateName} Template...`);
  
  const templateResult = {
    templateName,
    templatePath,
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  };

  try {
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    templateResult.exists = true;
    const content = fs.readFileSync(templatePath, 'utf8');
    
    // Define feature tests for each template
    const featureTests = getFeatureTests(templateName);
    
    featureTests.forEach(feature => {
      const passed = feature.test(content);
      templateResult.features[feature.name] = {
        passed,
        description: feature.description,
        critical: feature.critical || false
      };
      
      templateResult.featureCount++;
      testResults.summary.totalFeatures++;
      
      if (passed) {
        templateResult.passedFeatures++;
        testResults.summary.passedFeatures++;
        console.log(`  ✅ ${feature.name}`);
      } else {
        templateResult.failedFeatures++;
        testResults.summary.failedFeatures++;
        console.log(`  ❌ ${feature.name}`);
      }
    });

    testResults.summary.totalTemplates++;
    if (templateResult.failedFeatures === 0) {
      testResults.summary.passedTemplates++;
      console.log(`✅ ${templateName} Template - ALL FEATURES PASSED`);
    } else {
      testResults.summary.failedTemplates++;
      console.log(`⚠️ ${templateName} Template - ${templateResult.failedFeatures} features failed`);
    }

  } catch (error) {
    templateResult.error = error.message;
    testResults.summary.totalTemplates++;
    testResults.summary.failedTemplates++;
    console.log(`❌ ${templateName} Template - ERROR: ${error.message}`);
  }

  testResults.templateTests[templateName] = templateResult;
  return templateResult;
};

const getFeatureTests = (templateName) => {
  const commonFeatures = [
    {
      name: 'Template Export',
      description: 'Template properly exports itself',
      test: (content) => content.includes('export const') && content.includes('Template'),
      critical: true
    },
    {
      name: 'Framework Property',
      description: 'Template defines framework property',
      test: (content) => content.includes('framework:'),
      critical: true
    },
    {
      name: 'Language Property',
      description: 'Template defines language as typescript',
      test: (content) => content.includes("language: 'typescript'"),
      critical: true
    },
    {
      name: 'Dependencies',
      description: 'Template includes dependencies object',
      test: (content) => content.includes('dependencies:'),
      critical: true
    },
    {
      name: 'DevDependencies',
      description: 'Template includes devDependencies',
      test: (content) => content.includes('devDependencies:'),
      critical: true
    },
    {
      name: 'Package.json File',
      description: 'Template includes package.json configuration',
      test: (content) => content.includes("'package.json'"),
      critical: true
    },
    {
      name: 'TypeScript Config',
      description: 'Template includes TypeScript configuration',
      test: (content) => content.includes("'tsconfig.json'"),
      critical: true
    },
    {
      name: 'Main Entry Point',
      description: 'Template includes main entry point file',
      test: (content) => content.includes("'src/") && content.includes(".ts'"),
      critical: true
    },
    {
      name: 'Authentication',
      description: 'Template includes authentication features',
      test: (content) => content.includes('authentication') || content.includes('jwt') || content.includes('JWT'),
      critical: false
    },
    {
      name: 'Health Checks',
      description: 'Template includes health check endpoints',
      test: (content) => content.includes('health') || content.includes('/health'),
      critical: false
    },
    {
      name: 'Docker Support',
      description: 'Template includes Docker configuration',
      test: (content) => content.includes('Dockerfile') || content.includes('docker'),
      critical: false
    },
    {
      name: 'Environment Config',
      description: 'Template includes environment configuration',
      test: (content) => content.includes('.env') || content.includes('environment'),
      critical: false
    },
    {
      name: 'Testing Setup',
      description: 'Template includes testing configuration',
      test: (content) => content.includes('test') || content.includes('jest') || content.includes('tap'),
      critical: false
    },
    {
      name: 'README Documentation',
      description: 'Template includes README documentation',
      test: (content) => content.includes("'README.md'"),
      critical: false
    },
    {
      name: 'Post Install Commands',
      description: 'Template includes post-installation commands',
      test: (content) => content.includes('postInstall'),
      critical: false
    }
  ];

  // Framework-specific features
  const frameworkFeatures = {
    'Express.js': [
      {
        name: 'Express Framework',
        description: 'Uses Express.js framework',
        test: (content) => content.includes("'express'") && content.includes('express'),
        critical: true
      },
      {
        name: 'Middleware Support',
        description: 'Includes middleware configuration',
        test: (content) => content.includes('middleware') || content.includes('app.use'),
        critical: true
      },
      {
        name: 'Error Handling',
        description: 'Includes error handling middleware',
        test: (content) => content.includes('errorHandler') || content.includes('error'),
        critical: true
      }
    ],
    'Fastify': [
      {
        name: 'Fastify Framework',
        description: 'Uses Fastify framework',
        test: (content) => content.includes("'fastify'") && content.includes('fastify'),
        critical: true
      },
      {
        name: 'Schema Validation',
        description: 'Includes schema validation',
        test: (content) => content.includes('schema') || content.includes('Type.Object') || content.includes('@sinclair/typebox'),
        critical: true
      },
      {
        name: 'Plugin System',
        description: 'Includes plugin architecture',
        test: (content) => content.includes('plugin') || content.includes('fastify.register'),
        critical: true
      },
      {
        name: 'Async Support',
        description: 'Uses async/await patterns',
        test: (content) => content.includes('async') && content.includes('await'),
        critical: true
      }
    ],
    'NestJS': [
      {
        name: 'NestJS Framework',
        description: 'Uses NestJS framework',
        test: (content) => content.includes("'@nestjs/") && content.includes('nestjs'),
        critical: true
      },
      {
        name: 'Dependency Injection',
        description: 'Includes dependency injection patterns',
        test: (content) => content.includes('@Injectable') || content.includes('injection'),
        critical: true
      },
      {
        name: 'Modules',
        description: 'Includes modular architecture',
        test: (content) => content.includes('@Module') || content.includes('module'),
        critical: true
      },
      {
        name: 'Guards',
        description: 'Includes guards for authentication',
        test: (content) => content.includes('Guard') || content.includes('CanActivate'),
        critical: true
      },
      {
        name: 'Interceptors',
        description: 'Includes interceptors',
        test: (content) => content.includes('Interceptor') || content.includes('NestInterceptor'),
        critical: true
      }
    ],
    'Koa.js': [
      {
        name: 'Koa Framework',
        description: 'Uses Koa.js framework',
        test: (content) => content.includes("'koa'") && content.includes('koa'),
        critical: true
      },
      {
        name: 'Async/Await Patterns',
        description: 'Uses modern async/await patterns',
        test: (content) => content.includes('async') && content.includes('await'),
        critical: true
      },
      {
        name: 'Middleware Composition',
        description: 'Includes middleware composition',
        test: (content) => content.includes('middleware') || content.includes('app.use'),
        critical: true
      },
      {
        name: 'Context and Next',
        description: 'Uses Koa context and next patterns',
        test: (content) => content.includes('Context') && content.includes('Next'),
        critical: true
      }
    ],
    'Hapi.js': [
      {
        name: 'Hapi Framework',
        description: 'Uses Hapi.js framework',
        test: (content) => content.includes("'hapi'") && content.includes('@hapi/hapi'),
        critical: true
      },
      {
        name: 'Built-in Validation',
        description: 'Includes built-in Joi validation',
        test: (content) => content.includes('@hapi/joi') && content.includes('Joi.object'),
        critical: true
      },
      {
        name: 'Plugin Architecture',
        description: 'Includes plugin architecture',
        test: (content) => content.includes('server.register') && content.includes('plugin'),
        critical: true
      },
      {
        name: 'Caching System',
        description: 'Includes Redis caching system',
        test: (content) => content.includes('@hapi/catbox-redis') && content.includes('server.cache'),
        critical: true
      },
      {
        name: 'Security Features',
        description: 'Includes comprehensive security features',
        test: (content) => content.includes('@hapi/jwt') && content.includes('@hapi/basic'),
        critical: true
      },
      {
        name: 'Rate Limiting',
        description: 'Includes rate limiting functionality',
        test: (content) => content.includes('hapi-rate-limit') && content.includes('RateLimit'),
        critical: true
      },
      {
        name: 'Swagger Documentation',
        description: 'Includes auto-generated API documentation',
        test: (content) => content.includes('hapi-swagger') && content.includes('HapiSwagger'),
        critical: true
      },
      {
        name: 'Prisma ORM Integration',
        description: 'Includes Prisma ORM with schema and client',
        test: (content) => content.includes('@prisma/client') && content.includes('prisma/schema.prisma'),
        critical: true
      },
      {
        name: 'Database Seeding',
        description: 'Includes database seed functionality',
        test: (content) => content.includes('prisma/seed.ts') && content.includes('db:seed'),
        critical: true
      }
    ]
  };

  const templateKey = Object.keys(frameworkFeatures).find(key => 
    templateName.toLowerCase().includes(key.toLowerCase().replace('.js', ''))
  );

  return [
    ...commonFeatures,
    ...(frameworkFeatures[templateKey] || [])
  ];
};

// Main test execution
console.log('🚀 Re-Shell CLI Backend Templates Comprehensive Test Suite');
console.log('Version: 0.9.0');
console.log('Testing Date:', new Date().toISOString());
console.log('=' .repeat(80));

// Test all backend templates
const backendTemplatesPath = path.join(__dirname, '../src/templates/backend');
const templates = [
  { name: 'Express.js', file: 'express-ts.ts' },
  { name: 'Fastify', file: 'fastify-ts.ts' },
  { name: 'NestJS', file: 'nestjs-ts.ts' },
  { name: 'Koa.js', file: 'koa-ts.ts' },
  { name: 'Hapi.js', file: 'hapi-ts.ts' }
];

templates.forEach(template => {
  const templatePath = path.join(backendTemplatesPath, template.file);
  runTemplateTest(template.name, templatePath);
});

// Test template organization
console.log(`\n🧪 Testing Template Organization...`);
const frontendPath = path.join(__dirname, '../src/templates/frontend');
const backendPath = path.join(__dirname, '../src/templates/backend');

testResults.organization = {
  frontendFolderExists: fs.existsSync(frontendPath),
  backendFolderExists: fs.existsSync(backendPath),
  frontendTemplates: fs.existsSync(frontendPath) ? fs.readdirSync(frontendPath) : [],
  backendTemplates: fs.existsSync(backendPath) ? fs.readdirSync(backendPath) : []
};

if (testResults.organization.frontendFolderExists && testResults.organization.backendFolderExists) {
  console.log('✅ Template organization - Proper folder structure');
} else {
  console.log('❌ Template organization - Missing folder structure');
}

// Final results
console.log('\n' + '=' .repeat(80));
console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
console.log('=' .repeat(80));
console.log(`Total Templates Tested: ${testResults.summary.totalTemplates}`);
console.log(`Templates Passed: ${testResults.summary.passedTemplates}`);
console.log(`Templates Failed: ${testResults.summary.failedTemplates}`);
console.log(`Total Features Tested: ${testResults.summary.totalFeatures}`);
console.log(`Features Passed: ${testResults.summary.passedFeatures}`);
console.log(`Features Failed: ${testResults.summary.failedFeatures}`);
console.log(`Template Success Rate: ${((testResults.summary.passedTemplates / testResults.summary.totalTemplates) * 100).toFixed(1)}%`);
console.log(`Feature Success Rate: ${((testResults.summary.passedFeatures / testResults.summary.totalFeatures) * 100).toFixed(1)}%`);

// Save detailed results
const outputPath = path.join(__dirname, 'backend-templates-comprehensive-test-results.json');
fs.writeFileSync(outputPath, JSON.stringify(testResults, null, 2));
console.log(`\n📝 Detailed test results saved to: ${outputPath}`);

// Individual template summaries
console.log('\n📋 INDIVIDUAL TEMPLATE RESULTS:');
Object.entries(testResults.templateTests).forEach(([templateName, result]) => {
  const status = result.failedFeatures === 0 ? '✅ PASSED' : '❌ FAILED';
  const rate = ((result.passedFeatures / result.featureCount) * 100).toFixed(1);
  console.log(`  ${templateName}: ${status} (${result.passedFeatures}/${result.featureCount} features, ${rate}%)`);
});

console.log('\n🎉 Backend Templates Test Suite Complete!');
console.log('=' .repeat(80));

// Exit with appropriate code
process.exit(testResults.summary.failedTemplates > 0 ? 1 : 0);