#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔥 Testing Hot-Reload Implementation in Express.js Template');
console.log('=======================================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.13.0',
  hotReloadTest: {
    templateName: 'Express.js',
    templateFile: 'express-ts.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// Hot-reload test cases
const hotReloadTests = [
  {
    name: 'TSX Dependency',
    test: (content) => content.includes("tsx: '^4.7.0'") || content.includes('tsx:'),
    description: 'Template includes tsx for ultra-fast TypeScript compilation',
    critical: true
  },
  {
    name: 'Nodemon Dependency',
    test: (content) => content.includes("'nodemon'") || content.includes('"nodemon"'),
    description: 'Template includes nodemon for file watching',
    critical: true
  },
  {
    name: 'Standard Dev Script',
    test: (content) => content.includes("dev: 'nodemon'") || content.includes('dev: "nodemon"'),
    description: 'Template includes standard dev script with nodemon',
    critical: true
  },
  {
    name: 'TSX Dev Script',
    test: (content) => content.includes("'dev:tsx'") && content.includes('tsx watch'),
    description: 'Template includes tsx-based dev script',
    critical: true
  },
  {
    name: 'Fast Dev Script',
    test: (content) => content.includes("'dev:fast'") && content.includes('--clear-screen=false'),
    description: 'Template includes fast dev script option',
    critical: true
  },
  {
    name: 'Debug Dev Script',
    test: (content) => content.includes("'dev:debug'") && content.includes('--inspect'),
    description: 'Template includes debugging dev script',
    critical: true
  },
  {
    name: 'Nodemon Configuration',
    test: (content) => content.includes("'nodemon.json'") && content.includes('watch'),
    description: 'Template includes nodemon configuration file',
    critical: true
  },
  {
    name: 'File Extensions Watching',
    test: (content) => content.includes("'ts,js,json'") || content.includes('"ts,js,json"'),
    description: 'Nodemon watches TypeScript, JavaScript, and JSON files',
    critical: true
  },
  {
    name: 'Environment Watching',
    test: (content) => content.includes("'.env'") && content.includes('watch'),
    description: 'Nodemon watches environment file changes',
    critical: true
  },
  {
    name: 'Test File Ignore',
    test: (content) => content.includes('*.test.ts') || content.includes('*.spec.ts'),
    description: 'Nodemon ignores test files for performance',
    critical: true
  },
  {
    name: 'Transpile Only Option',
    test: (content) => content.includes('--transpile-only'),
    description: 'Uses transpile-only mode for faster compilation',
    critical: true
  },
  {
    name: 'Development Environment',
    test: (content) => content.includes('NODE_ENV') && content.includes('development'),
    description: 'Sets development environment for nodemon',
    critical: true
  },
  {
    name: 'Debug Log Level',
    test: (content) => content.includes('LOG_LEVEL') && content.includes('debug'),
    description: 'Configures debug logging for development',
    critical: true
  },
  {
    name: 'Restart Delay',
    test: (content) => content.includes('delay') && content.includes('1000'),
    description: 'Includes restart delay to prevent rapid restarts',
    critical: true
  },
  {
    name: 'Verbose Output',
    test: (content) => content.includes('verbose') && content.includes('true'),
    description: 'Enables verbose nodemon output',
    critical: false
  },
  {
    name: 'Manual Restart',
    test: (content) => content.includes('restartable') && content.includes("'rs'"),
    description: 'Supports manual restart with rs command',
    critical: false
  },
  {
    name: 'Color Output',
    test: (content) => content.includes('colours') && content.includes('true'),
    description: 'Enables colored output in development',
    critical: false
  },
  {
    name: 'Hot-Reload Documentation',
    test: (content) => content.includes('Hot-Reload') && content.includes('Development'),
    description: 'Includes comprehensive hot-reload documentation',
    critical: true
  },
  {
    name: 'Environment Variables Doc',
    test: (content) => content.includes('DEBUG=app:*') && content.includes('LOG_LEVEL=debug'),
    description: 'Documents development environment variables',
    critical: true
  },
  {
    name: 'Multiple Dev Options',
    test: (content) => content.includes('Ultra-Fast Development') && content.includes('Debugging Mode'),
    description: 'Documents multiple development server options',
    critical: true
  }
];

function testExpressTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/express-ts.ts');
  const result = testResults.hotReloadTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running hot-reload implementation tests...\n');

  // Run all hot-reload tests
  hotReloadTests.forEach(test => {
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
console.log('\n📊 HOT-RELOAD IMPLEMENTATION TEST SUMMARY');
console.log('==========================================');
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
const resultsPath = path.join(__dirname, 'validate-hot-reload-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All hot-reload implementation tests passed!' : '⚠️  Some hot-reload implementation tests failed'}`);

if (success) {
  console.log('\n🔥 Express.js template now includes comprehensive hot-reload capabilities!');
  console.log('Developers can choose from multiple development server options:');
  console.log('  • npm run dev (nodemon + ts-node with full type-checking)');
  console.log('  • npm run dev:tsx (ultra-fast tsx compilation)');
  console.log('  • npm run dev:fast (tsx without screen clearing)');
  console.log('  • npm run dev:debug (Node.js debugging enabled)');
}

process.exit(success ? 0 : 1);