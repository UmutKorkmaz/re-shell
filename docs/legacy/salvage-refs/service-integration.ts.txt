import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Service Integration and Validation
 *
 * Automatically integrates new services with existing ones,
 * validates dependencies, and ensures proper configuration.
 */

export interface ServiceDependency {
  name: string;
  type: 'service' | 'database' | 'cache' | 'message-queue' | 'external-api';
  version?: string;
  required: boolean;
  installed: boolean;
  configuration?: Record<string, any>;
}

export interface ServiceIntegration {
  serviceName: string;
  dependencies: ServiceDependency[];
  exports: string[];
  imports: string[];
  environmentVariables: string[];
  configurationFiles: string[];
  validationErrors: ValidationError[];
  validationWarnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
  suggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface IntegrationPlan {
  serviceName: string;
  steps: IntegrationStep[];
  estimatedTime: number;
  risks: string[];
  rollbackSteps: string[];
}

export interface IntegrationStep {
  order: number;
  action: string;
  description: string;
  command?: string;
  files: string[];
  dependencies: string[];
}

/**
 * Analyze service dependencies and integration points
 */
export async function analyzeServiceIntegration(
  serviceName: string,
  servicePath: string,
  workspacePath: string = process.cwd()
): Promise<ServiceIntegration> {
  const integration: ServiceIntegration = {
    serviceName,
    dependencies: [],
    exports: [],
    imports: [],
    environmentVariables: [],
    configurationFiles: [],
    validationErrors: [],
    validationWarnings: [],
  };

  // Check if service exists
  if (!(await fs.pathExists(servicePath))) {
    integration.validationErrors.push({
      field: 'servicePath',
      message: `Service path does not exist: ${servicePath}`,
      severity: 'critical',
      suggestion: `Create the service first using: re-shell create ${serviceName}`,
    });
    return integration;
  }

  // Read package.json
  const pkgJsonPath = path.join(servicePath, 'package.json');
  if (await fs.pathExists(pkgJsonPath)) {
    const pkgJson = await fs.readJson(pkgJsonPath);
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    // Analyze dependencies
    for (const [depName, version] of Object.entries(deps)) {
      const depType = determineDependencyType(depName);
      integration.dependencies.push({
        name: depName,
        type: depType,
        version: version as string,
        required: !pkgJson.devDependencies?.[depName],
        installed: true,
      });
    }
  }

  // Scan source files for imports and exports
  const srcPath = path.join(servicePath, 'src');
  if (await fs.pathExists(srcPath)) {
    await scanSourceFiles(srcPath, integration);
  }

  // Detect configuration files
  const configFiles = [
    'config/default.json',
    'config/production.json',
    '.env.example',
    'docker-compose.yml',
    'Dockerfile',
    'terraform/main.tf',
    'kubernetes/deployment.yaml',
  ];

  for (const configFile of configFiles) {
    const fullPath = path.join(servicePath, configFile);
    if (await fs.pathExists(fullPath)) {
      integration.configurationFiles.push(configFile);
    }
  }

  // Detect environment variables
  const envExamplePath = path.join(servicePath, '.env.example');
  if (await fs.pathExists(envExamplePath)) {
    const envContent = await fs.readFile(envExamplePath, 'utf-8');
    const envVars = envContent.match(/^[A-Z_]+=/gm);
    if (envVars) {
      integration.environmentVariables = envVars.map(v => v.replace('=', ''));
    }
  }

  // Validate integration
  await validateServiceIntegration(integration, workspacePath);

  return integration;
}

/**
 * Determine dependency type based on package name
 */
function determineDependencyType(depName: string): ServiceDependency['type'] {
  // Database dependencies
  if (
    depName.includes('prisma') ||
    depName.includes('typeorm') ||
    depName.includes('mongoose') ||
    depName.includes('sequelize') ||
    depName.includes('mikro-orm')
  ) {
    return 'database';
  }

  // Cache dependencies
  if (
    depName.includes('redis') ||
    depName.includes('memcached') ||
    depName.includes('ioredis')
  ) {
    return 'cache';
  }

  // Message queue dependencies
  if (
    depName.includes('kafka') ||
    depName.includes('rabbitmq') ||
    depName.includes('amqplib') ||
    depName.includes('bull') ||
    depName.includes('bullmq')
  ) {
    return 'message-queue';
  }

  // Service dependencies (likely internal services)
  if (
    depName.startsWith('@re-shell/') ||
    depName.includes('microservice') ||
    depName.includes('service')
  ) {
    return 'service';
  }

  // Default to external API
  return 'external-api';
}

/**
 * Scan source files for imports and exports
 */
async function scanSourceFiles(
  srcPath: string,
  integration: ServiceIntegration
): Promise<void> {
  const entries = await fs.readdir(srcPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(srcPath, entry.name);

    if (entry.isDirectory()) {
      await scanSourceFiles(fullPath, integration);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const content = await fs.readFile(fullPath, 'utf-8');

      // Find exports
      const exportMatches = content.match(/export\s+(?:class|function|const|interface|type)\s+(\w+)/g);
      if (exportMatches) {
        for (const match of exportMatches) {
          const name = match.replace(/export\s+(?:class|function|const|interface|type)\s+/, '');
          if (!integration.exports.includes(name)) {
            integration.exports.push(name);
          }
        }
      }

      // Find imports from other services
      const importMatches = content.match(/from\s+['"](@re-shell\/[^'"]+|\.+\.[^'"]+)['"]/g);
      if (importMatches) {
        for (const match of importMatches) {
          const importPath = match.replace(/from\s+['"]([^'"]+)['"]/, '$1');
          if (importPath.startsWith('@re-shell/') && !integration.imports.includes(importPath)) {
            integration.imports.push(importPath);
          }
        }
      }
    }
  }
}

/**
 * Validate service integration
 */
async function validateServiceIntegration(
  integration: ServiceIntegration,
  workspacePath: string
): Promise<void> {
  // Check for missing required dependencies
  for (const dep of integration.dependencies) {
    if (dep.required && !dep.installed) {
      integration.validationErrors.push({
        field: 'dependencies',
        message: `Required dependency not installed: ${dep.name}`,
        severity: 'error',
        suggestion: `Run: npm install ${dep.name}${dep.version ? `@${dep.version}` : ''}`,
      });
    }
  }

  // Check for circular dependencies
  const appsPath = path.join(workspacePath, 'apps');
  if (await fs.pathExists(appsPath)) {
    for (const imp of integration.imports) {
      const impServiceName = imp.replace('@re-shell/', '');
      const impServicePath = path.join(appsPath, impServiceName);

      if (await fs.pathExists(impServicePath)) {
        // Check if imported service also imports this service
        const impPkgJsonPath = path.join(impServicePath, 'package.json');
        if (await fs.pathExists(impPkgJsonPath)) {
          const impPkgJson = await fs.readJson(impPkgJsonPath);
          const deps = { ...impPkgJson.dependencies, ...impPkgJson.devDependencies };

          if (deps[`@re-shell/${integration.serviceName}`]) {
            integration.validationWarnings.push({
              field: 'dependencies',
              message: `Circular dependency detected: ${integration.serviceName} <-> ${impServiceName}`,
              suggestion: 'Consider creating a shared package or using events to break the cycle',
            });
          }
        }
      }
    }
  }

  // Check for missing environment variables
  const envPath = path.join(workspacePath, '.env');
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, 'utf-8');
    for (const envVar of integration.environmentVariables) {
      if (!envContent.includes(`${envVar}=`)) {
        integration.validationWarnings.push({
          field: 'environment',
          message: `Environment variable not set in .env: ${envVar}`,
          suggestion: `Add ${envVar} to your .env file (see .env.example)`,
        });
      }
    }
  }

  // Check for database configuration
  const hasDbDep = integration.dependencies.some(d => d.type === 'database');
  if (hasDbDep) {
    const hasDbConfig =
      integration.configurationFiles.some(f => f.includes('config')) ||
      integration.environmentVariables.some(v => v.includes('DATABASE') || v.includes('DB_'));

    if (!hasDbConfig) {
      integration.validationWarnings.push({
        field: 'configuration',
        message: 'Database dependency detected but no database configuration found',
        suggestion: 'Add database connection string to environment variables (e.g., DATABASE_URL)',
      });
    }
  }

  // Check for testing setup
  const hasTestingDep = integration.dependencies.some(d =>
    d.name.includes('jest') ||
    d.name.includes('vitest') ||
    d.name.includes('mocha') ||
    d.name.includes('pytest')
  );

  if (!hasTestingDep) {
    integration.validationWarnings.push({
      field: 'testing',
      message: 'No testing framework detected',
      suggestion: 'Add a testing framework using: re-shell test-setup',
    });
  }
}

/**
 * Create integration plan for a service
 */
export async function createIntegrationPlan(
  integration: ServiceIntegration,
  workspacePath: string
): Promise<IntegrationPlan> {
  const plan: IntegrationPlan = {
    serviceName: integration.serviceName,
    steps: [],
    estimatedTime: 0,
    risks: [],
    rollbackSteps: [],
  };

  let stepOrder = 1;

  // Step 1: Validate dependencies
  const missingDeps = integration.dependencies.filter(d => d.required && !d.installed);
  if (missingDeps.length > 0) {
    plan.steps.push({
      order: stepOrder++,
      action: 'install-dependencies',
      description: `Install ${missingDeps.length} missing dependencies`,
      command: `npm install ${missingDeps.map(d => d.name).join(' ')}`,
      files: ['package.json', 'package-lock.json'],
      dependencies: [],
    });
    plan.estimatedTime += 2; // 2 minutes to install
  }

  // Step 2: Configure environment variables
  const missingEnvVars = integration.environmentVariables.filter(async envVar => {
    const envPath = path.join(workspacePath, '.env');
    if (!(await fs.pathExists(envPath))) return true;
    const envContent = await fs.readFile(envPath, 'utf-8');
    return !envContent.includes(`${envVar}=`);
  });

  if (missingEnvVars.length > 0) {
    plan.steps.push({
      order: stepOrder++,
      action: 'configure-environment',
      description: `Configure ${missingEnvVars.length} environment variables`,
      files: ['.env'],
      dependencies: [],
    });
    plan.estimatedTime += 1; // 1 minute to configure
  }

  // Step 3: Link services
  if (integration.imports.length > 0) {
    const importSteps = integration.imports.map(imp => ({
      order: stepOrder++,
      action: 'link-service',
      description: `Link to service: ${imp}`,
      command: `re-shell services-link --from ${integration.serviceName} --to ${imp.replace('@re-shell/', '')}`,
      files: [],
      dependencies: [imp],
    }));
    plan.steps.push(...importSteps);
    plan.estimatedTime += integration.imports.length * 0.5; // 30 seconds per link
  }

  // Step 4: Validate configuration
  plan.steps.push({
    order: stepOrder++,
    action: 'validate',
    description: 'Validate service integration',
    command: `re-shell services-validate --service ${integration.serviceName}`,
    files: [],
    dependencies: integration.imports,
  });
  plan.estimatedTime += 1; // 1 minute to validate

  // Identify risks
  if (integration.validationErrors.length > 0) {
    plan.risks.push(`${integration.validationErrors.length} validation errors found`);
  }

  if (integration.imports.length > 5) {
    plan.risks.push('High number of service dependencies may impact performance');
  }

  const hasCircularDeps = integration.validationWarnings.some(w =>
    w.message.includes('Circular dependency')
  );
  if (hasCircularDeps) {
    plan.risks.push('Circular dependencies detected - may cause runtime issues');
  }

  // Create rollback steps
  plan.rollbackSteps = [
    'Unlink services: re-shell services-unlink --service ' + integration.serviceName,
    'Remove environment variables from .env',
    'Uninstall dependencies: npm uninstall ' + missingDeps.map(d => d.name).join(' '),
  ];

  return plan;
}

/**
 * Display service integration results
 */
export async function displayServiceIntegration(
  integration: ServiceIntegration
): Promise<void> {
  console.log(chalk.bold(`\n🔍 Service Integration Analysis: ${integration.serviceName}\n`));

  // Display dependencies
  if (integration.dependencies.length > 0) {
    console.log(chalk.cyan('Dependencies:'));
    const groupedDeps = integration.dependencies.reduce((acc, dep) => {
      if (!acc[dep.type]) acc[dep.type] = [];
      acc[dep.type].push(dep);
      return acc;
    }, {} as Record<string, ServiceDependency[]>);

    for (const [type, deps] of Object.entries(groupedDeps)) {
      console.log(`  ${chalk.yellow(type)}: ${deps.map(d => chalk.green(d.name)).join(', ')}`);
    }
    console.log('');
  }

  // Display exports
  if (integration.exports.length > 0) {
    console.log(chalk.cyan(`Exports (${integration.exports.length}):`));
    for (const exp of integration.exports.slice(0, 10)) {
      console.log(`  ${chalk.green('✓')} ${exp}`);
    }
    if (integration.exports.length > 10) {
      console.log(chalk.gray(`  ... and ${integration.exports.length - 10} more`));
    }
    console.log('');
  }

  // Display imports
  if (integration.imports.length > 0) {
    console.log(chalk.cyan(`Service Imports (${integration.imports.length}):`));
    for (const imp of integration.imports) {
      console.log(`  ${chalk.blue('→')} ${imp}`);
    }
    console.log('');
  }

  // Display environment variables
  if (integration.environmentVariables.length > 0) {
    console.log(chalk.cyan(`Environment Variables (${integration.environmentVariables.length}):`));
    for (const envVar of integration.environmentVariables.slice(0, 10)) {
      console.log(`  ${chalk.yellow('$')} ${envVar}`);
    }
    if (integration.environmentVariables.length > 10) {
      console.log(chalk.gray(`  ... and ${integration.environmentVariables.length - 10} more`));
    }
    console.log('');
  }

  // Display configuration files
  if (integration.configurationFiles.length > 0) {
    console.log(chalk.cyan(`Configuration Files:`));
    for (const configFile of integration.configurationFiles) {
      console.log(`  ${chalk.blue('📄')} ${configFile}`);
    }
    console.log('');
  }

  // Display validation errors
  if (integration.validationErrors.length > 0) {
    console.log(chalk.red(`Validation Errors (${integration.validationErrors.length}):`));
    for (const error of integration.validationErrors) {
      console.log(`  ${chalk.red('✗')} ${chalk.bold(error.field)}: ${error.message}`);
      if (error.suggestion) {
        console.log(chalk.gray(`    → ${error.suggestion}`));
      }
    }
    console.log('');
  }

  // Display validation warnings
  if (integration.validationWarnings.length > 0) {
    console.log(chalk.yellow(`Warnings (${integration.validationWarnings.length}):`));
    for (const warning of integration.validationWarnings) {
      console.log(`  ${chalk.yellow('⚠')} ${chalk.bold(warning.field)}: ${warning.message}`);
      if (warning.suggestion) {
        console.log(chalk.gray(`    → ${warning.suggestion}`));
      }
    }
    console.log('');
  }

  // Display summary
  if (integration.validationErrors.length === 0) {
    console.log(chalk.green('✓ Service integration is valid!\n'));
  } else {
    console.log(chalk.red(`✗ Service has ${integration.validationErrors.length} error(s) that need attention.\n`));
  }
}

/**
 * Display integration plan
 */
export async function displayIntegrationPlan(plan: IntegrationPlan): Promise<void> {
  console.log(chalk.bold('\n📋 Integration Plan\n'));
  console.log(chalk.cyan(`Service: ${plan.serviceName}`));
  console.log(chalk.cyan(`Estimated Time: ${chalk.yellow(plan.estimatedTime + ' minutes')}\n`));

  if (plan.steps.length > 0) {
    console.log(chalk.bold('Steps:'));
    for (const step of plan.steps) {
      console.log(chalk.gray(`${step.order}.`));
      console.log(`  ${chalk.green(step.action)}: ${step.description}`);
      if (step.command) {
        console.log(chalk.gray(`  Command: ${step.command}`));
      }
      if (step.dependencies.length > 0) {
        console.log(chalk.gray(`  Dependencies: ${step.dependencies.join(', ')}`));
      }
      console.log('');
    }
  }

  if (plan.risks.length > 0) {
    console.log(chalk.yellow('Risks:'));
    for (const risk of plan.risks) {
      console.log(`  ${chalk.yellow('⚠')} ${risk}`);
    }
    console.log('');
  }

  if (plan.rollbackSteps.length > 0) {
    console.log(chalk.cyan('Rollback Steps:'));
    for (const step of plan.rollbackSteps) {
      console.log(`  ${chalk.gray('→')} ${step}`);
    }
    console.log('');
  }
}
