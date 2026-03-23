#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const hapiTemplatePath = path.join(__dirname, '../src/templates/backend/hapi-ts.ts');

console.log('🧪 Testing Hapi.js TypeScript Template');
console.log('=====================================');

const results = {
  templateName: 'Hapi.js',
  templatePath: hapiTemplatePath,
  exists: false,
  features: {},
  featureCount: 0,
  passedFeatures: 0,
  failedFeatures: 0
};

// Check if template file exists
try {
  if (fs.existsSync(hapiTemplatePath)) {
    results.exists = true;
    console.log('✅ Template file exists');
  } else {
    console.log('❌ Template file not found');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error checking template file:', error.message);
  process.exit(1);
}

// Read and parse template
let templateContent = '';
let template = null;

try {
  templateContent = fs.readFileSync(hapiTemplatePath, 'utf8');
  
  // Use require to load the template (safer approach)
  const tempPath = path.join(__dirname, '../dist/templates/backend/hapi-ts.js');
  
  // Check if compiled version exists, otherwise analyze source
  if (fs.existsSync(tempPath)) {
    const compiledModule = require(tempPath);
    template = compiledModule.hapiTypeScriptTemplate;
  } else {
    // Basic property checks on source code
    template = {
      framework: templateContent.includes("framework: 'hapi'") ? 'hapi' : null,
      language: templateContent.includes("language: 'typescript'") ? 'typescript' : null,
      dependencies: templateContent.includes('dependencies: {') ? {} : null,
      devDependencies: templateContent.includes('devDependencies: {') ? {} : null,
      files: templateContent.includes('files: {') ? {} : null,
      postInstallCommands: templateContent.includes('postInstallCommands: [') ? [] : null
    };
    
    // Check for specific files and dependencies in source
    if (templateContent.includes("'package.json':")) {
      template.files['package.json'] = true;
    }
    if (templateContent.includes("'tsconfig.json':")) {
      template.files['tsconfig.json'] = true;
    }
    if (templateContent.includes("'src/server.ts':")) {
      template.files['src/server.ts'] = true;
    }
    if (templateContent.includes("'src/routes/auth.ts':")) {
      template.files['src/routes/auth.ts'] = (templateContent.includes('login') && templateContent.includes('register')) ? 'content' : true;
    }
    if (templateContent.includes("'src/routes/health.ts':")) {
      template.files['src/routes/health.ts'] = templateContent.includes('/health') ? 'content' : true;
    }
    if (templateContent.includes("'src/config/plugins.ts':")) {
      template.files['src/config/plugins.ts'] = templateContent.includes('server.register') ? 'content' : true;
    }
    if (templateContent.includes("'src/config/cache.ts':")) {
      template.files['src/config/cache.ts'] = templateContent.includes('server.cache') ? 'content' : true;
    }
    if (templateContent.includes("'src/auth/strategies.ts':")) {
      template.files['src/auth/strategies.ts'] = true;
    }
    if (templateContent.includes("'Dockerfile':")) {
      template.files['Dockerfile'] = true;
    }
    if (templateContent.includes("'.env.example':")) {
      template.files['.env.example'] = true;
    }
    if (templateContent.includes("'test/auth.test.ts':")) {
      template.files['test/auth.test.ts'] = templateContent.includes('@hapi/lab') ? 'content' : true;
    }
    if (templateContent.includes("'README.md':")) {
      template.files['README.md'] = true;
    }
    
    // Check dependencies
    template.dependencies = {
      '@hapi/hapi': templateContent.includes("'@hapi/hapi'"),
      '@hapi/joi': templateContent.includes("'@hapi/joi'"),
      '@hapi/catbox-redis': templateContent.includes("'@hapi/catbox-redis'"),
      '@hapi/jwt': templateContent.includes("'@hapi/jwt'"),
      '@hapi/basic': templateContent.includes("'@hapi/basic'"),
      'hapi-rate-limit': templateContent.includes("'hapi-rate-limit'"),
      'hapi-swagger': templateContent.includes("'hapi-swagger'")
    };
    
    template.devDependencies = {
      '@hapi/lab': templateContent.includes("'@hapi/lab'"),
      '@hapi/code': templateContent.includes("'@hapi/code'")
    };
  }
} catch (error) {
  console.log('❌ Error reading template:', error.message);
  process.exit(1);
}

// Define test cases
const testCases = [
  {
    name: 'Template Export',
    test: () => template !== null && typeof template === 'object',
    description: 'Template properly exports itself',
    critical: true
  },
  {
    name: 'Framework Property',
    test: () => template?.framework === 'hapi',
    description: 'Template defines framework property',
    critical: true
  },
  {
    name: 'Language Property',
    test: () => template?.language === 'typescript',
    description: 'Template defines language as typescript',
    critical: true
  },
  {
    name: 'Dependencies',
    test: () => template?.dependencies && typeof template.dependencies === 'object',
    description: 'Template includes dependencies object',
    critical: true
  },
  {
    name: 'DevDependencies',
    test: () => template?.devDependencies && typeof template.devDependencies === 'object',
    description: 'Template includes devDependencies',
    critical: true
  },
  {
    name: 'Package.json File',
    test: () => template?.files && template.files['package.json'],
    description: 'Template includes package.json configuration',
    critical: true
  },
  {
    name: 'TypeScript Config',
    test: () => template?.files && template.files['tsconfig.json'],
    description: 'Template includes TypeScript configuration',
    critical: true
  },
  {
    name: 'Main Entry Point',
    test: () => template?.files && template.files['src/server.ts'],
    description: 'Template includes main entry point file',
    critical: true
  },
  {
    name: 'Authentication',
    test: () => {
      const authContent = template?.files && template.files['src/routes/auth.ts'];
      return authContent === 'content' || (authContent && templateContent.includes('/auth/login'));
    },
    description: 'Template includes authentication features',
    critical: false
  },
  {
    name: 'Health Checks',
    test: () => {
      const healthContent = template?.files && template.files['src/routes/health.ts'];
      return healthContent === 'content' || (healthContent && templateContent.includes('/health'));
    },
    description: 'Template includes health check endpoints',
    critical: false
  },
  {
    name: 'Docker Support',
    test: () => template?.files && template.files['Dockerfile'],
    description: 'Template includes Docker configuration',
    critical: false
  },
  {
    name: 'Environment Config',
    test: () => template?.files && template.files['.env.example'],
    description: 'Template includes environment configuration',
    critical: false
  },
  {
    name: 'Testing Setup',
    test: () => {
      const testContent = template?.files && template.files['test/auth.test.ts'];
      return testContent === 'content' || (testContent && templateContent.includes('@hapi/lab'));
    },
    description: 'Template includes testing configuration',
    critical: false
  },
  {
    name: 'README Documentation',
    test: () => template?.files && template.files['README.md'],
    description: 'Template includes README documentation',
    critical: false
  },
  {
    name: 'Post Install Commands',
    test: () => template?.postInstallCommands && Array.isArray(template.postInstallCommands),
    description: 'Template includes post-installation commands',
    critical: false
  },
  // Hapi.js specific features
  {
    name: 'Hapi Framework',
    test: () => {
      const deps = template?.dependencies;
      return deps && deps['@hapi/hapi'];
    },
    description: 'Uses Hapi.js framework',
    critical: true
  },
  {
    name: 'Built-in Validation',
    test: () => {
      const deps = template?.dependencies;
      return deps && deps['@hapi/joi'] && templateContent.includes('Joi.object');
    },
    description: 'Includes built-in Joi validation',
    critical: true
  },
  {
    name: 'Plugin Architecture',
    test: () => {
      const pluginContent = template?.files && template.files['src/config/plugins.ts'];
      return pluginContent === 'content' || (pluginContent && templateContent.includes('server.register'));
    },
    description: 'Includes plugin architecture',
    critical: true
  },
  {
    name: 'Caching System',
    test: () => {
      const deps = template?.dependencies;
      const cacheContent = template?.files && template.files['src/config/cache.ts'];
      return deps && deps['@hapi/catbox-redis'] && (cacheContent === 'content' || (cacheContent && templateContent.includes('server.cache')));
    },
    description: 'Includes Redis caching system',
    critical: true
  },
  {
    name: 'Security Features',
    test: () => {
      const deps = template?.dependencies;
      const authContent = template?.files && template.files['src/auth/strategies.ts'];
      return deps && deps['@hapi/jwt'] && deps['@hapi/basic'] && authContent;
    },
    description: 'Includes comprehensive security features',
    critical: true
  },
  {
    name: 'Rate Limiting',
    test: () => {
      const deps = template?.dependencies;
      return deps && deps['hapi-rate-limit'] && templateContent.includes('RateLimit');
    },
    description: 'Includes rate limiting functionality',
    critical: true
  },
  {
    name: 'Swagger Documentation',
    test: () => {
      const deps = template?.dependencies;
      return deps && deps['hapi-swagger'] && templateContent.includes('HapiSwagger');
    },
    description: 'Includes auto-generated API documentation',
    critical: true
  },
  {
    name: 'Lab Testing Framework',
    test: () => {
      const devDeps = template?.devDependencies;
      const testContent = template?.files && template.files['test/auth.test.ts'];
      return devDeps && devDeps['@hapi/lab'] && devDeps['@hapi/code'] && testContent;
    },
    description: 'Uses Hapi Lab testing framework',
    critical: true
  }
];

// Run tests
console.log('\n🔍 Running feature tests...\n');

testCases.forEach((testCase, index) => {
  try {
    const passed = testCase.test();
    const status = passed ? '✅' : '❌';
    const critical = testCase.critical ? '🚨' : '💡';
    
    console.log(`${status} ${critical} ${testCase.name}: ${testCase.description}`);
    
    results.features[testCase.name] = {
      passed,
      description: testCase.description,
      critical: testCase.critical
    };
    
    if (passed) {
      results.passedFeatures++;
    } else {
      results.failedFeatures++;
    }
    
    results.featureCount++;
  } catch (error) {
    console.log(`❌ 🚨 ${testCase.name}: Error running test - ${error.message}`);
    results.features[testCase.name] = {
      passed: false,
      description: testCase.description,
      critical: testCase.critical,
      error: error.message
    };
    results.failedFeatures++;
    results.featureCount++;
  }
});

// Print summary
console.log('\n📊 Test Summary');
console.log('================');
console.log(`Total Features: ${results.featureCount}`);
console.log(`✅ Passed: ${results.passedFeatures}`);
console.log(`❌ Failed: ${results.failedFeatures}`);
console.log(`📈 Success Rate: ${((results.passedFeatures / results.featureCount) * 100).toFixed(1)}%`);

// Check critical features
const criticalFeatures = Object.entries(results.features).filter(([_, feature]) => feature.critical);
const failedCritical = criticalFeatures.filter(([_, feature]) => !feature.passed);

if (failedCritical.length > 0) {
  console.log('\n🚨 Critical Features Failed:');
  failedCritical.forEach(([name, _]) => {
    console.log(`   ❌ ${name}`);
  });
}

// Save results
const resultsPath = path.join(__dirname, 'validate-hapi-template-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = results.failedFeatures === 0;
console.log(`\n${success ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
process.exit(success ? 0 : 1);