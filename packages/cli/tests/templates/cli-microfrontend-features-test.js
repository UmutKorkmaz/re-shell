const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Test results will be stored here
const testResults = {
  timestamp: new Date().toISOString(),
  results: [],
  summary: {
    passed: 0,
    failed: 0,
    total: 0
  }
};

// Create a temporary directory for testing
const tempDir = path.join(os.tmpdir(), 'reshell-cli-test-' + Date.now());

const runTest = (testName, testFunction) => {
  console.log(`🧪 Running test: ${testName}`);
  
  try {
    const result = testFunction();
    testResults.results.push({
      name: testName,
      status: 'PASSED',
      result: result,
      timestamp: new Date().toISOString()
    });
    testResults.summary.passed++;
    console.log(`✅ ${testName} - PASSED`);
    return result;
  } catch (error) {
    testResults.results.push({
      name: testName,
      status: 'FAILED',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    testResults.summary.failed++;
    console.log(`❌ ${testName} - FAILED: ${error.message}`);
    return null;
  } finally {
    testResults.summary.total++;
  }
};

// Helper function to run CLI commands
const runCLICommand = (command, options = {}) => {
  try {
    const result = execSync(command, {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
      ...options
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      output: error.stdout ? error.stdout.trim() : '',
      stderr: error.stderr ? error.stderr.trim() : ''
    };
  }
};

// Test CLI availability
runTest('CLI Command Availability', () => {
  const result = runCLICommand('node dist/index.js --version');
  if (!result.success) {
    throw new Error('CLI not available or not built');
  }
  return {
    available: true,
    version: result.output
  };
});

// Test help command
runTest('CLI Help Command', () => {
  const result = runCLICommand('node dist/index.js --help');
  if (!result.success) {
    throw new Error('Help command failed');
  }
  return {
    helpAvailable: true,
    helpContent: result.output.substring(0, 500) + '...' // Truncate for readability
  };
});

// Test create command options
runTest('Create Command Help', () => {
  const result = runCLICommand('node dist/index.js create --help');
  if (!result.success) {
    throw new Error('Create command help failed');
  }
  return {
    createHelpAvailable: true,
    hasCreateOptions: result.output.includes('--framework') || result.output.includes('create')
  };
});

// Test workspace commands
runTest('Workspace Commands', () => {
  const result = runCLICommand('node dist/index.js workspace --help');
  return {
    workspaceCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test plugin commands
runTest('Plugin Commands', () => {
  const result = runCLICommand('node dist/index.js plugin --help');
  return {
    pluginCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test template commands
runTest('Template Commands', () => {
  const result = runCLICommand('node dist/index.js template --help');
  return {
    templateCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test analyze commands
runTest('Analyze Commands', () => {
  const result = runCLICommand('node dist/index.js analyze --help');
  return {
    analyzeCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test build commands
runTest('Build Commands', () => {
  const result = runCLICommand('node dist/index.js build --help');
  return {
    buildCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test doctor command
runTest('Doctor Command', () => {
  const result = runCLICommand('node dist/index.js doctor --help');
  return {
    doctorCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test config commands
runTest('Config Commands', () => {
  const result = runCLICommand('node dist/index.js config --help');
  return {
    configCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test generate commands
runTest('Generate Commands', () => {
  const result = runCLICommand('node dist/index.js generate --help');
  return {
    generateCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test migration commands
runTest('Migration Commands', () => {
  const result = runCLICommand('node dist/index.js migrate --help');
  return {
    migrateCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test backup commands
runTest('Backup Commands', () => {
  const result = runCLICommand('node dist/index.js backup --help');
  return {
    backupCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test CI/CD commands
runTest('CI/CD Commands', () => {
  const result = runCLICommand('node dist/index.js cicd --help');
  return {
    cicdCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test submodule commands
runTest('Submodule Commands', () => {
  const result = runCLICommand('node dist/index.js submodule --help');
  return {
    submoduleCommandAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test file watcher
runTest('File Watcher Commands', () => {
  const result = runCLICommand('node dist/index.js file-watcher --help');
  return {
    fileWatcherAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test workspace health
runTest('Workspace Health Commands', () => {
  const result = runCLICommand('node dist/index.js workspace-health --help');
  return {
    workspaceHealthAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test incremental build
runTest('Incremental Build Commands', () => {
  const result = runCLICommand('node dist/index.js incremental-build --help');
  return {
    incrementalBuildAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test change detection
runTest('Change Detection Commands', () => {
  const result = runCLICommand('node dist/index.js change-detector --help');
  return {
    changeDetectorAvailable: result.success,
    output: result.success ? result.output.substring(0, 300) + '...' : result.error
  };
});

// Test template availability (check if backend templates are accessible)
runTest('Backend Template Availability', () => {
  // Check if template files exist
  const templatesPath = path.join(process.cwd(), 'src/templates/backend');
  const backendTemplates = ['express-ts.ts', 'fastify-ts.ts', 'nestjs-ts.ts', 'koa-ts.ts'];
  
  const availableTemplates = backendTemplates.filter(template => {
    const templatePath = path.join(templatesPath, template);
    return fs.existsSync(templatePath);
  });

  return {
    templatesPath: templatesPath,
    expectedTemplates: backendTemplates,
    availableTemplates: availableTemplates,
    allTemplatesAvailable: availableTemplates.length === backendTemplates.length
  };
});

// Test frontend template availability
runTest('Frontend Template Availability', () => {
  const templatesPath = path.join(process.cwd(), 'src/templates/frontend');
  const frontendTemplates = ['react.ts', 'vue.ts', 'svelte.ts'];
  
  const availableTemplates = frontendTemplates.filter(template => {
    const templatePath = path.join(templatesPath, template);
    return fs.existsSync(templatePath);
  });

  return {
    templatesPath: templatesPath,
    expectedTemplates: frontendTemplates,
    availableTemplates: availableTemplates,
    allTemplatesAvailable: availableTemplates.length === frontendTemplates.length
  };
});

// Test types file availability
runTest('Template Types Availability', () => {
  const typesPath = path.join(process.cwd(), 'src/templates/types.ts');
  const typesExist = fs.existsSync(typesPath);
  
  if (typesExist) {
    const content = fs.readFileSync(typesPath, 'utf8');
    return {
      typesFileExists: true,
      hasBackendTemplate: content.includes('BackendTemplate'),
      hasFrontendTemplate: content.includes('FrontendTemplate'),
      hasBaseTemplate: content.includes('BaseTemplate'),
      contentLength: content.length
    };
  }
  
  return { typesFileExists: false };
});

// Test configuration structure
runTest('Configuration Structure', () => {
  const configFiles = [
    'src/config',
    'src/utils',
    'src/services'
  ];
  
  const structure = configFiles.map(dir => {
    const dirPath = path.join(process.cwd(), dir);
    return {
      path: dir,
      exists: fs.existsSync(dirPath),
      isDirectory: fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
    };
  });

  return {
    configStructure: structure,
    allDirectoriesExist: structure.every(item => item.exists && item.isDirectory)
  };
});

// Test package.json structure
runTest('Package.json Structure', () => {
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json not found');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  return {
    name: packageJson.name,
    version: packageJson.version,
    hasScripts: !!packageJson.scripts,
    hasBin: !!packageJson.bin,
    scriptCount: packageJson.scripts ? Object.keys(packageJson.scripts).length : 0,
    dependencies: packageJson.dependencies ? Object.keys(packageJson.dependencies).length : 0,
    devDependencies: packageJson.devDependencies ? Object.keys(packageJson.devDependencies).length : 0
  };
});

// Test build artifacts
runTest('Build Artifacts', () => {
  const distPath = path.join(process.cwd(), 'dist');
  const distExists = fs.existsSync(distPath);
  
  if (!distExists) {
    return {
      distExists: false,
      needsBuild: true
    };
  }

  const files = fs.readdirSync(distPath);
  return {
    distExists: true,
    fileCount: files.length,
    hasIndexJs: files.includes('index.js'),
    files: files.slice(0, 10) // First 10 files
  };
});

// Output final results
console.log('\n📊 Test Summary');
console.log(`Total tests: ${testResults.summary.total}`);
console.log(`Passed: ${testResults.summary.passed}`);
console.log(`Failed: ${testResults.summary.failed}`);
console.log(`Success rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);

// Save detailed results to file
const outputPath = path.join(__dirname, 'cli-microfrontend-test-results.json');
fs.writeFileSync(outputPath, JSON.stringify(testResults, null, 2));
console.log(`\n📝 Detailed results saved to: ${outputPath}`);

// Exit with appropriate code
process.exit(testResults.summary.failed > 0 ? 1 : 0);