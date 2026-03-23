#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing TypeORM Integration in Express.js Template');
console.log('====================================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.11.0',
  typeormIntegrationTest: {
    templateName: 'Express.js',
    templateFile: 'express-ts.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// TypeORM integration test cases
const typeormTests = [
  {
    name: 'TypeORM Core Dependency',
    test: (content) => content.includes('"typeorm"') || content.includes("'typeorm'"),
    description: 'Template includes TypeORM core dependency',
    critical: true
  },
  {
    name: 'Reflect Metadata',
    test: (content) => content.includes('reflect-metadata'),
    description: 'Template includes reflect-metadata for decorators',
    critical: true
  },
  {
    name: 'Class Validator',
    test: (content) => content.includes('class-validator'),
    description: 'Template includes class-validator for entity validation',
    critical: true
  },
  {
    name: 'Class Transformer',
    test: (content) => content.includes('class-transformer'),
    description: 'Template includes class-transformer for serialization',
    critical: true
  },
  {
    name: 'Database Drivers',
    test: (content) => content.includes('pg:') && content.includes('mysql2:') && content.includes('sqlite3:'),
    description: 'Template includes multiple database drivers',
    critical: true
  },
  {
    name: 'TypeORM Config',
    test: (content) => content.includes('src/config/typeorm.config.ts') || content.includes('ormconfig.ts'),
    description: 'Template includes TypeORM configuration file',
    critical: true
  },
  {
    name: 'User Entity',
    test: (content) => content.includes('src/entities/User.ts'),
    description: 'Template includes User entity definition',
    critical: true
  },
  {
    name: 'Profile Entity',
    test: (content) => content.includes('src/entities/Profile.ts'),
    description: 'Template includes Profile entity definition',
    critical: true
  },
  {
    name: 'Post Entity',
    test: (content) => content.includes('src/entities/Post.ts'),
    description: 'Template includes Post entity definition',
    critical: true
  },
  {
    name: 'Entity Decorators',
    test: (content) => content.includes('@Entity') && content.includes('@PrimaryGeneratedColumn'),
    description: 'Entities use proper TypeORM decorators',
    critical: true
  },
  {
    name: 'Entity Relationships',
    test: (content) => content.includes('@OneToOne') && content.includes('@ManyToOne'),
    description: 'Entities define proper relationships',
    critical: true
  },
  {
    name: 'Entity Validation',
    test: (content) => content.includes('@IsEmail') && content.includes('@IsNotEmpty'),
    description: 'Entities include validation decorators',
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
    name: 'Migration Scripts',
    test: (content) => content.includes('typeorm:migration:generate') && content.includes('typeorm:migration:run'),
    description: 'Template includes migration management scripts',
    critical: true
  },
  {
    name: 'Schema Sync Script',
    test: (content) => content.includes('typeorm:schema:sync'),
    description: 'Template includes schema synchronization script',
    critical: true
  },
  {
    name: 'Database Seeding',
    test: (content) => content.includes('src/seeds/seed.ts') && content.includes('typeorm:seed'),
    description: 'Template includes database seeding functionality',
    critical: true
  },
  {
    name: 'TypeORM Service',
    test: (content) => content.includes('UserService.typeorm.ts') || content.includes('Repository<User>'),
    description: 'Template includes TypeORM service implementation',
    critical: true
  },
  {
    name: 'TypeORM Routes',
    test: (content) => content.includes('auth.typeorm.ts') || content.includes('users.typeorm.ts'),
    description: 'Template includes TypeORM-specific routes',
    critical: true
  },
  {
    name: 'Database Connection',
    test: (content) => content.includes('AppDataSource') || content.includes('createConnection'),
    description: 'Template includes database connection management',
    critical: true
  },
  {
    name: 'Entity Hooks',
    test: (content) => content.includes('@BeforeInsert') || content.includes('@BeforeUpdate'),
    description: 'Entities include lifecycle hooks',
    critical: true
  },
  {
    name: 'Password Hashing',
    test: (content) => content.includes('bcrypt.hash') && content.includes('@BeforeInsert'),
    description: 'Includes automatic password hashing',
    critical: true
  },
  {
    name: 'Database Environment',
    test: (content) => content.includes('TYPEORM_CONNECTION') && content.includes('TYPEORM_HOST'),
    description: 'Template includes database environment configuration',
    critical: true
  },
  {
    name: 'TypeORM Documentation',
    test: (content) => content.includes('TypeORM') && content.includes('Entity-first approach'),
    description: 'Template includes TypeORM documentation',
    critical: false
  },
  {
    name: 'ORM Comparison',
    test: (content) => content.includes('Prisma vs TypeORM') || content.includes('choose between'),
    description: 'Template explains choice between ORMs',
    critical: false
  },
  {
    name: 'Production Configuration',
    test: (content) => content.includes('synchronize: false') || content.includes('NODE_ENV === "production"'),
    description: 'Template includes production-safe configuration',
    critical: true
  }
];

function testExpressTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/express-ts.ts');
  const result = testResults.typeormIntegrationTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running TypeORM integration tests...\n');

  // Run all TypeORM tests
  typeormTests.forEach(test => {
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
console.log('\n📊 TYPEORM INTEGRATION TEST SUMMARY');
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
const resultsPath = path.join(__dirname, 'validate-typeorm-integration-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All TypeORM integration tests passed!' : '⚠️  Some TypeORM integration tests failed'}`);

if (success) {
  console.log('\n🏆 Express.js template now supports both Prisma and TypeORM!');
  console.log('Users can choose their preferred ORM for database integration.');
}

process.exit(success ? 0 : 1);