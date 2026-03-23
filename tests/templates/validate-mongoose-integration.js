#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Mongoose Integration in Express.js Template');
console.log('===================================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.13.0',
  mongooseIntegrationTest: {
    templateName: 'Express.js',
    templateFile: 'express-ts.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// Mongoose integration test cases
const mongooseTests = [
  {
    name: 'Mongoose Core Dependency',
    test: (content) => content.includes('"mongoose"') || content.includes("'mongoose'"),
    description: 'Template includes Mongoose core dependency',
    critical: true
  },
  {
    name: 'Validator Package',
    test: (content) => content.includes('validator:') || content.includes("'validator'"),
    description: 'Template includes validator package for data validation',
    critical: true
  },
  {
    name: 'Slugify Package',
    test: (content) => content.includes('slugify:') || content.includes("'slugify'"),
    description: 'Template includes slugify package for URL generation',
    critical: true
  },
  {
    name: 'BCrypt Integration',
    test: (content) => content.includes('bcrypt:') && content.includes('@types/bcrypt'),
    description: 'Template includes bcrypt for password hashing',
    critical: true
  },
  {
    name: 'Database Configuration',
    test: (content) => content.includes('src/config/database.ts'),
    description: 'Template includes MongoDB database configuration',
    critical: true
  },
  {
    name: 'User Model',
    test: (content) => content.includes('src/models/User.ts'),
    description: 'Template includes User model definition',
    critical: true
  },
  {
    name: 'Post Model',
    test: (content) => content.includes('src/models/Post.ts'),
    description: 'Template includes Post model definition',
    critical: true
  },
  {
    name: 'User Role Enum',
    test: (content) => content.includes('UserRole') && content.includes('ADMIN'),
    description: 'Includes role-based access control',
    critical: true
  },
  {
    name: 'Post Status Enum',
    test: (content) => content.includes('PostStatus') && content.includes('PUBLISHED'),
    description: 'Includes post status management',
    critical: true
  },
  {
    name: 'Schema Validation',
    test: (content) => content.includes('@IsEmail') || content.includes('validate: [validator.isEmail'),
    description: 'Models include comprehensive validation',
    critical: true
  },
  {
    name: 'Password Hashing Middleware',
    test: (content) => content.includes('pre(\'save\'') && content.includes('bcrypt.hash'),
    description: 'Includes automatic password hashing',
    critical: true
  },
  {
    name: 'Schema Indexes',
    test: (content) => content.includes('index: true') || content.includes('.index('),
    description: 'Models include performance indexes',
    critical: true
  },
  {
    name: 'Instance Methods',
    test: (content) => content.includes('comparePassword') && content.includes('generatePasswordResetToken'),
    description: 'Models include useful instance methods',
    critical: true
  },
  {
    name: 'Static Methods',
    test: (content) => content.includes('findByEmail') && content.includes('getUserStats'),
    description: 'Models include static query methods',
    critical: true
  },
  {
    name: 'Connection Management',
    test: (content) => content.includes('connectToDatabase') && content.includes('disconnectFromDatabase'),
    description: 'Template includes connection management',
    critical: true
  },
  {
    name: 'Health Check Integration',
    test: (content) => content.includes('checkDatabaseConnection') || content.includes('mongoose.connection.db?.admin().ping()'),
    description: 'Template includes database health checks',
    critical: true
  },
  {
    name: 'Environment Configuration',
    test: (content) => content.includes('MONGODB_URL') && content.includes('DB_POOL_SIZE'),
    description: 'Template includes MongoDB environment configuration',
    critical: true
  },
  {
    name: 'Database Seeding',
    test: (content) => content.includes('src/database/seeds/index.ts'),
    description: 'Template includes database seeding functionality',
    critical: true
  },
  {
    name: 'User Service',
    test: (content) => content.includes('src/services/userService.ts') || content.includes('UserService'),
    description: 'Template includes user service implementation',
    critical: true
  },
  {
    name: 'Mongoose Scripts',
    test: (content) => content.includes('db:mongoose:seed') && content.includes('db:mongoose:drop'),
    description: 'Template includes Mongoose management scripts',
    critical: true
  },
  {
    name: 'Data Aggregation',
    test: (content) => content.includes('aggregate([') || content.includes('$group'),
    description: 'Models include aggregation capabilities',
    critical: true
  },
  {
    name: 'Text Search',
    test: (content) => content.includes("'text'") || content.includes('$text: { $search') || content.includes('text\': \'text\''),
    description: 'Template includes full-text search functionality',
    critical: true
  },
  {
    name: 'Security Features',
    test: (content) => content.includes('loginAttempts') && content.includes('lockUntil'),
    description: 'Template includes security features like account locking',
    critical: true
  },
  {
    name: 'Mongoose Documentation',
    test: (content) => content.includes('Mongoose') && content.includes('MongoDB'),
    description: 'Template includes Mongoose documentation',
    critical: false
  },
  {
    name: 'ORM Comparison',
    test: (content) => content.includes('Database Integration') && content.includes('choice'),
    description: 'Template explains database integration choices',
    critical: false
  },
  {
    name: 'Production Configuration',
    test: (content) => content.includes('NODE_ENV === "production"') || content.includes("NODE_ENV === 'production'") || content.includes('production-safe'),
    description: 'Template includes production-safe configuration',
    critical: true
  }
];

function testExpressTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/express-ts.ts');
  const result = testResults.mongooseIntegrationTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running Mongoose integration tests...\n');

  // Run all Mongoose tests
  mongooseTests.forEach(test => {
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
const result = testExpressTemplate();

// Print summary
console.log('\n📊 MONGOOSE INTEGRATION TEST SUMMARY');
console.log('====================================');
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
const resultsPath = path.join(__dirname, 'validate-mongoose-integration-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All Mongoose integration tests passed!' : '⚠️  Some Mongoose integration tests failed'}`);

if (success) {
  console.log('\n🏆 Express.js template now supports Prisma, TypeORM, and Mongoose!');
  console.log('Users can choose their preferred database integration approach.');
}

process.exit(success ? 0 : 1);