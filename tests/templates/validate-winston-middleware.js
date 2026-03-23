#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📊 Testing Enhanced Winston Logging & Middleware in Express.js Template');
console.log('=======================================================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.13.0',
  middlewareTest: {
    templateName: 'Express.js',
    templateFile: 'express-ts.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// Enhanced middleware and logging test cases
const middlewareTests = [
  // Winston Logging Tests
  {
    name: 'Winston Core Dependency',
    test: (content) => content.includes("winston: '^3.11.0'"),
    description: 'Template includes Winston for structured logging',
    critical: true
  },
  {
    name: 'Winston Daily Rotate File',
    test: (content) => content.includes("'winston-daily-rotate-file'"),
    description: 'Template includes winston-daily-rotate-file for log rotation',
    critical: true
  },
  {
    name: 'Custom Log Levels',
    test: (content) => content.includes('logLevels') && content.includes('error: 0') && content.includes('debug: 5'),
    description: 'Defines custom log levels with priorities',
    critical: true
  },
  {
    name: 'Log Colors Configuration',
    test: (content) => content.includes('logColors') && content.includes('winston.addColors'),
    description: 'Configures colored console output for different log levels',
    critical: true
  },
  {
    name: 'Daily Log Rotation',
    test: (content) => content.includes('DailyRotateFile') && content.includes('datePattern'),
    description: 'Implements daily log file rotation',
    critical: true
  },
  {
    name: 'Log Size Management',
    test: (content) => content.includes('maxSize') && content.includes('maxFiles'),
    description: 'Configures log file size limits and retention',
    critical: true
  },
  {
    name: 'Separate Error Logs',
    test: (content) => content.includes('error-%DATE%.log') && content.includes("level: 'error'"),
    description: 'Creates separate error log files',
    critical: true
  },
  {
    name: 'HTTP Request Logs',
    test: (content) => content.includes('http-%DATE%.log') && content.includes("level: 'http'"),
    description: 'Creates separate HTTP request log files',
    critical: true
  },
  {
    name: 'Exception Handling',
    test: (content) => content.includes('exceptionHandlers') && content.includes('exceptions-%DATE%.log'),
    description: 'Handles uncaught exceptions in logs',
    critical: true
  },
  {
    name: 'Promise Rejection Handling',
    test: (content) => content.includes('rejectionHandlers') && content.includes('rejections-%DATE%.log'),
    description: 'Handles unhandled promise rejections in logs',
    critical: true
  },
  {
    name: 'Environment-Based Console Logging',
    test: (content) => content.includes('!isProduction') && content.includes('Console'),
    description: 'Adds console logging only in non-production environments',
    critical: true
  },
  {
    name: 'HTTP Logger Middleware',
    test: (content) => content.includes('httpLogger') && content.includes('res.on(\'finish\''),
    description: 'Provides HTTP request logging middleware',
    critical: true
  },
  {
    name: 'Performance Monitoring',
    test: (content) => content.includes('LOG_PERFORMANCE') && content.includes('performance-%DATE%.log'),
    description: 'Optional performance monitoring logs',
    critical: false
  },
  {
    name: 'Request Duration Tracking',
    test: (content) => content.includes('Date.now() - start') && content.includes('duration'),
    description: 'Tracks and logs request processing time',
    critical: true
  },
  
  // Security & Middleware Tests
  {
    name: 'Helmet Security',
    test: (content) => content.includes("helmet: '^7.1.0'") && content.includes('app.use(helmet())'),
    description: 'Implements Helmet.js security middleware',
    critical: true
  },
  {
    name: 'CORS Configuration',
    test: (content) => content.includes("cors: '^2.8.5'") && content.includes('ALLOWED_ORIGINS'),
    description: 'Configures CORS with environment-based origins',
    critical: true
  },
  {
    name: 'Rate Limiting',
    test: (content) => content.includes("'express-rate-limit'") && content.includes('windowMs'),
    description: 'Implements rate limiting to prevent abuse',
    critical: true
  },
  {
    name: 'Compression Middleware',
    test: (content) => content.includes("compression: '^1.7.4'") && content.includes('app.use(compression())'),
    description: 'Enables gzip compression for responses',
    critical: true
  },
  {
    name: 'Request Body Parsing',
    test: (content) => content.includes('express.json') && content.includes('express.urlencoded'),
    description: 'Configures request body parsing with size limits',
    critical: true
  },
  {
    name: 'Error Handling Middleware',
    test: (content) => content.includes('express-async-errors') && content.includes('errorHandler'),
    description: 'Handles async errors and provides error middleware',
    critical: true
  },
  
  // Environment Configuration Tests
  {
    name: 'Environment Variables',
    test: (content) => content.includes('LOG_LEVEL') && content.includes('LOG_PERFORMANCE'),
    description: 'Includes logging environment configuration',
    critical: true
  },
  {
    name: 'Graceful Shutdown',
    test: (content) => content.includes('SIGTERM') && content.includes('SIGINT') && content.includes('server.close'),
    description: 'Implements graceful server shutdown',
    critical: true
  },
  {
    name: 'Production Safety',
    test: (content) => content.includes('NODE_ENV === \'production\'') || content.includes('NODE_ENV === "production"'),
    description: 'Has production-specific configurations',
    critical: true
  }
];

function testExpressTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/express-ts.ts');
  const result = testResults.middlewareTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running enhanced middleware and logging tests...\n');

  // Run all middleware tests
  middlewareTests.forEach(test => {
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
console.log('\n📊 ENHANCED MIDDLEWARE & LOGGING TEST SUMMARY');
console.log('==============================================');
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
const resultsPath = path.join(__dirname, 'validate-winston-middleware-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All middleware and logging tests passed!' : '⚠️  Some middleware and logging tests failed'}`);

if (success) {
  console.log('\n📊 Express.js template now includes enterprise-grade middleware:');
  console.log('  • Winston with daily log rotation and structured logging');
  console.log('  • Helmet.js security headers and protection');
  console.log('  • Express rate limiting with IP-based controls');
  console.log('  • CORS with environment-based origin configuration');
  console.log('  • Gzip compression for improved performance');
  console.log('  • Comprehensive error handling and graceful shutdown');
  console.log('  • HTTP request logging with performance metrics');
  console.log('  • Separate log files for errors, HTTP, and performance');
}

process.exit(success ? 0 : 1);