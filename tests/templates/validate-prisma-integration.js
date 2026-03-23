#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Prisma ORM Integration Across All Node.js Templates');
console.log('================================================================');

const templates = [
  { name: 'Express.js', file: 'express-ts.ts', id: 'express-ts' },
  { name: 'Fastify', file: 'fastify-ts.ts', id: 'fastify-ts' },
  { name: 'NestJS', file: 'nestjs-ts.ts', id: 'nestjs-ts' },
  { name: 'Koa.js', file: 'koa-ts.ts', id: 'koa-ts' },
  { name: 'Hapi.js', file: 'hapi-ts.ts', id: 'hapi-ts' }
];

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.10.0',
  prismaIntegrationTests: {},
  summary: {
    totalTemplates: 0,
    passedTemplates: 0,
    failedTemplates: 0,
    totalFeatures: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// Prisma integration test cases
const prismaTests = [
  {
    name: 'Prisma Client Dependency',
    test: (content) => content.includes('@prisma/client'),
    description: 'Template includes @prisma/client dependency',
    critical: true
  },
  {
    name: 'Prisma CLI Dependency',
    test: (content) => content.includes('"prisma"') || content.includes("'prisma'"),
    description: 'Template includes prisma CLI in devDependencies',
    critical: true
  },
  {
    name: 'Bcrypt Dependency',
    test: (content) => content.includes('bcrypt'),
    description: 'Template includes bcrypt for password hashing',
    critical: true
  },
  {
    name: 'UUID Dependency',
    test: (content) => content.includes('"uuid"') || content.includes("'uuid'"),
    description: 'Template includes uuid for unique identifiers',
    critical: true
  },
  {
    name: 'Database Generate Script',
    test: (content) => content.includes('db:generate') && content.includes('prisma generate'),
    description: 'Template includes database generation script',
    critical: true
  },
  {
    name: 'Database Push Script',
    test: (content) => content.includes('db:push') && content.includes('prisma db push'),
    description: 'Template includes database push script',
    critical: true
  },
  {
    name: 'Database Migration Script',
    test: (content) => content.includes('db:migrate') && content.includes('prisma migrate'),
    description: 'Template includes database migration scripts',
    critical: true
  },
  {
    name: 'Database Studio Script',
    test: (content) => content.includes('db:studio') && content.includes('prisma studio'),
    description: 'Template includes Prisma Studio script',
    critical: false
  },
  {
    name: 'Database Seed Script',
    test: (content) => content.includes('db:seed'),
    description: 'Template includes database seeding script',
    critical: true
  },
  {
    name: 'Prisma Schema File',
    test: (content) => content.includes('prisma/schema.prisma'),
    description: 'Template includes Prisma schema file',
    critical: true
  },
  {
    name: 'Prisma Schema Content',
    test: (content) => content.includes('generator client') && content.includes('datasource db'),
    description: 'Prisma schema has proper generator and datasource',
    critical: true
  },
  {
    name: 'User Model',
    test: (content) => content.includes('model User') && content.includes('@id') && content.includes('email'),
    description: 'Prisma schema includes User model with proper fields',
    critical: true
  },
  {
    name: 'Profile Model',
    test: (content) => content.includes('model Profile'),
    description: 'Prisma schema includes Profile model',
    critical: true
  },
  {
    name: 'Post Model',
    test: (content) => content.includes('model Post'),
    description: 'Prisma schema includes Post model',
    critical: true
  },
  {
    name: 'Role Enum',
    test: (content) => content.includes('enum Role') && content.includes('USER') && content.includes('ADMIN'),
    description: 'Prisma schema includes Role enum',
    critical: true
  },
  {
    name: 'Database Relations',
    test: (content) => content.includes('@relation') && content.includes('onDelete: Cascade'),
    description: 'Prisma schema includes proper relations',
    critical: true
  },
  {
    name: 'Prisma Seed File',
    test: (content) => content.includes('prisma/seed.ts'),
    description: 'Template includes Prisma seed file',
    critical: true
  },
  {
    name: 'Seed File Content',
    test: (content) => content.includes('PrismaClient') && content.includes('upsert') && content.includes('bcrypt.hash'),
    description: 'Seed file has proper Prisma operations and password hashing',
    critical: true
  },
  {
    name: 'Prisma Client Library',
    test: (content) => content.includes('src/lib/prisma.ts'),
    description: 'Template includes Prisma client library file',
    critical: true
  },
  {
    name: 'Prisma Client Singleton',
    test: (content) => content.includes('globalThis.__prisma') && content.includes('new PrismaClient'),
    description: 'Prisma client uses singleton pattern',
    critical: true
  },
  {
    name: 'Database URL Environment',
    test: (content) => content.includes('DATABASE_URL'),
    description: 'Template includes DATABASE_URL environment variable',
    critical: true
  },
  {
    name: 'PostgreSQL Support',
    test: (content) => content.includes('postgresql://'),
    description: 'Template supports PostgreSQL database',
    critical: true
  },
  {
    name: 'Prisma Generate PostInstall',
    test: (content) => content.includes('npx prisma generate'),
    description: 'Template includes Prisma generate in post-install',
    critical: true
  },
  {
    name: 'Database Setup Instructions',
    test: (content) => content.includes('Database setup') && content.includes('db:push'),
    description: 'Template includes database setup instructions',
    critical: false
  },
  {
    name: 'Graceful Disconnect',
    test: (content) => content.includes('$disconnect'),
    description: 'Prisma client includes graceful disconnect',
    critical: true
  }
];

function testTemplate(templateName, templateFile) {
  console.log(`\n🧪 Testing ${templateName} Template...`);
  
  const templatePath = path.join(__dirname, '../src/templates/backend', templateFile);
  const templateResult = {
    templateName,
    templateFile,
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  };

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return templateResult;
  }

  templateResult.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  // Run all Prisma tests
  prismaTests.forEach(test => {
    templateResult.featureCount++;
    
    try {
      const passed = test.test(content);
      const status = passed ? '✅' : '❌';
      const critical = test.critical ? '🚨' : '💡';
      
      console.log(`  ${status} ${critical} ${test.name}: ${test.description}`);
      
      templateResult.features[test.name] = {
        passed,
        description: test.description,
        critical: test.critical
      };
      
      if (passed) {
        templateResult.passedFeatures++;
      } else {
        templateResult.failedFeatures++;
      }
    } catch (error) {
      console.log(`❌ 🚨 ${test.name}: Error running test - ${error.message}`);
      templateResult.features[test.name] = {
        passed: false,
        description: test.description,
        critical: test.critical,
        error: error.message
      };
      templateResult.failedFeatures++;
    }
  });

  // Template summary
  const success = templateResult.failedFeatures === 0;
  const successRate = ((templateResult.passedFeatures / templateResult.featureCount) * 100).toFixed(1);
  
  console.log(`${success ? '✅' : '❌'} ${templateName} Template - ${successRate}% (${templateResult.passedFeatures}/${templateResult.featureCount} features)`);
  
  return templateResult;
}

// Test all templates
templates.forEach(template => {
  const result = testTemplate(template.name, template.file);
  testResults.prismaIntegrationTests[template.id] = result;
  
  testResults.summary.totalTemplates++;
  if (result.failedFeatures === 0) {
    testResults.summary.passedTemplates++;
  } else {
    testResults.summary.failedTemplates++;
  }
  
  testResults.summary.totalFeatures += result.featureCount;
  testResults.summary.passedFeatures += result.passedFeatures;
  testResults.summary.failedFeatures += result.failedFeatures;
});

// Print summary
console.log('\n📊 PRISMA INTEGRATION TEST SUMMARY');
console.log('===================================');
console.log(`Total Templates: ${testResults.summary.totalTemplates}`);
console.log(`✅ Passed: ${testResults.summary.passedTemplates}`);
console.log(`❌ Failed: ${testResults.summary.failedTemplates}`);
console.log(`Total Features: ${testResults.summary.totalFeatures}`);
console.log(`✅ Features Passed: ${testResults.summary.passedFeatures}`);
console.log(`❌ Features Failed: ${testResults.summary.failedFeatures}`);
console.log(`📈 Success Rate: ${((testResults.summary.passedFeatures / testResults.summary.totalFeatures) * 100).toFixed(1)}%`);

// Check critical features
const allTemplatesResults = Object.values(testResults.prismaIntegrationTests);
const criticalFailures = [];

allTemplatesResults.forEach(result => {
  Object.entries(result.features).forEach(([featureName, feature]) => {
    if (feature.critical && !feature.passed) {
      criticalFailures.push(`${result.templateName}: ${featureName}`);
    }
  });
});

if (criticalFailures.length > 0) {
  console.log('\n🚨 Critical Features Failed:');
  criticalFailures.forEach(failure => {
    console.log(`   ❌ ${failure}`);
  });
}

// Save results
const resultsPath = path.join(__dirname, 'validate-prisma-integration-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = testResults.summary.failedFeatures === 0;
console.log(`\n${success ? '🎉 All Prisma integration tests passed!' : '⚠️  Some Prisma integration tests failed'}`);
process.exit(success ? 0 : 1);