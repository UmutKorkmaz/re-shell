/**
 * Polyglot Build and Deploy Commands
 * Unified commands for building and deploying multi-language applications
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { ProgressSpinner, flushOutput } from '../utils/spinner';
import {
  scanWorkspace,
  filterServices,
  buildServices,
  printBuildResults,
  PolyglotBuildOptions,
  ServiceInfo,
} from '../utils/polyglot-build';
import {
  DeploymentTarget,
  DeploymentEnvironment,
  DeploymentConfig,
  DeploymentOptions,
  generateDockerCompose,
  generateKubernetesManifests,
  generateAwsLambdaConfig,
  generateVercelConfig,
  generateNetlifyConfig,
  generateDeploymentScripts,
  deployService,
  printDeploymentResults,
} from '../utils/polyglot-deploy';

/**
 * Build all services in the workspace
 */
export async function buildAll(options: PolyglotBuildOptions = {}): Promise<void> {
  const { spinner, production = false } = options;

  try {
    if (spinner) {
      spinner.setText('Scanning workspace for services...');
    }

    // Scan workspace
    const allServices = scanWorkspace();
    const services = filterServices(allServices, options);

    if (services.length === 0) {
      if (spinner) {
        spinner.stop();
        flushOutput();
      }
      console.log(chalk.yellow('No services found to build.'));
      return;
    }

    if (spinner) {
      spinner.setText(
        `Building ${services.length} service${services.length > 1 ? 's' : ''} (${production ? 'production' : 'development'})...`
      );
    } else {
      console.log(
        chalk.cyan(
          `Building ${services.length} service${services.length > 1 ? 's' : ''} (${production ? 'production' : 'development'})...`
        )
      );
    }

    console.log(chalk.gray('\nServices to build:'));
    for (const service of services) {
      const framework = service.framework ? ` (${service.framework})` : '';
      console.log(chalk.gray(`  - ${service.name} [${service.language}]${framework}`));
    }
    console.log();

    // Build services
    const results = await buildServices(services, options);

    // Print summary
    if (spinner) {
      spinner.stop();
      flushOutput();
    }

    printBuildResults(results);

    // Exit with error if any build failed
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error building services: ${error.message}`));
    throw error;
  }
}

/**
 * Generate deployment configuration
 */
export async function generateDeploymentConfig(
  target: DeploymentTarget,
  environment: DeploymentEnvironment,
  options: any = {}
): Promise<void> {
  const { spinner, verbose = false } = options;

  try {
    if (spinner) {
      spinner.setText(`Scanning workspace for services...`);
    }

    // Scan workspace
    const allServices = scanWorkspace();
    const services = allServices.filter(s => {
      if (options.type) return options.type.includes(s.type);
      if (options.language) return options.language.includes(s.language);
      if (options.name) return options.name.includes(s.name);
      return true;
    });

    if (services.length === 0) {
      if (spinner) {
        spinner.stop();
        flushOutput();
      }
      console.log(chalk.yellow('No services found for deployment.'));
      return;
    }

    if (spinner) {
      spinner.setText(`Generating deployment config for ${target} (${environment})...`);
    }

    // Create deployment directory
    const deployDir = path.join(process.cwd(), 'deploy', environment);
    await fs.ensureDir(deployDir);

    const config: DeploymentConfig = {
      target,
      environment,
      region: options.region,
      domain: options.domain,
      envVars: options.env ? parseEnvFile(options.env) : undefined,
      resources: options.resources ? JSON.parse(options.resources) : undefined,
      scaling: options.scaling ? JSON.parse(options.scaling) : undefined,
    };

    // Generate configuration based on target
    switch (target) {
      case 'docker': {
        const dockerCompose = generateDockerCompose(services, config);
        const composePath = path.join(deployDir, 'docker-compose.yml');
        await fs.writeFile(composePath, dockerCompose);
        console.log(chalk.green(`✓ Generated ${composePath}`));
        break;
      }

      case 'kubernetes': {
        const manifests = generateKubernetesManifests(services, config);
        const k8sDir = path.join(deployDir, 'k8s');
        await fs.ensureDir(k8sDir);

        for (const [filename, content] of Object.entries(manifests)) {
          const manifestPath = path.join(k8sDir, filename);
          await fs.writeFile(manifestPath, content);
          console.log(chalk.green(`✓ Generated ${manifestPath}`));
        }
        break;
      }

      case 'aws-lambda': {
        for (const service of services) {
          const lambdaConfig = generateAwsLambdaConfig(service, config);
          const configPath = path.join(deployDir, `${service.name}-lambda.json`);
          await fs.writeJson(configPath, lambdaConfig, { spaces: 2 });
          console.log(chalk.green(`✓ Generated ${configPath}`));
        }
        break;
      }

      case 'vercel': {
        const vercelConfig = generateVercelConfig(services, config);
        const configPath = path.join(deployDir, 'vercel.json');
        await fs.writeJson(configPath, vercelConfig, { spaces: 2 });
        console.log(chalk.green(`✓ Generated ${configPath}`));
        break;
      }

      case 'netlify': {
        for (const service of services) {
          if (service.type === 'frontend') {
            const netlifyConfig = generateNetlifyConfig(service, config);
            const configPath = path.join(service.path, 'netlify.toml');
            await fs.writeJson(configPath, netlifyConfig, { spaces: 2 });
            console.log(chalk.green(`✓ Generated ${configPath}`));
          }
        }
        break;
      }

      default:
        throw new Error(`Deployment target ${target} configuration generation not yet implemented`);
    }

    // Generate deployment scripts
    const scripts = generateDeploymentScripts(services, config);
    for (const [filename, content] of Object.entries(scripts)) {
      const scriptPath = path.join(deployDir, filename);
      await fs.writeFile(scriptPath, content);
      await fs.chmod(scriptPath, '755');
      console.log(chalk.green(`✓ Generated ${scriptPath}`));
    }

    // Generate environment file template
    const envTemplatePath = path.join(deployDir, '.env.example');
    const envVars = config.envVars || {};
    await fs.writeFile(
      envTemplatePath,
      Object.entries(envVars)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n')
    );
    console.log(chalk.green(`✓ Generated ${envTemplatePath}`));

    if (spinner) {
      spinner.stop();
      flushOutput();
    }

    console.log(chalk.bold(`\n✅ Deployment configuration generated for ${target} (${environment})`));
    console.log(chalk.gray(`\nConfiguration files: ${deployDir}`));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray(`  1. Review and update .env.example with your values`));
    console.log(chalk.gray(`  2. Copy .env.example to .env and fill in values`));
    console.log(chalk.gray(`  3. Run deployment script: cd ${deployDir} && ./deploy-${target}.sh`));
  } catch (error: any) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error generating deployment config: ${error.message}`));
    throw error;
  }
}

/**
 * Deploy services
 */
export async function deployServices(
  target: DeploymentTarget,
  environment: DeploymentEnvironment,
  options: DeploymentOptions = {}
): Promise<void> {
  const { spinner, skipBuild = false } = options;

  try {
    if (spinner) {
      spinner.setText(`Scanning workspace for services...`);
    }

    // Scan workspace
    const allServices = scanWorkspace();
    const services = allServices.filter(s => {
      if (options.filter?.type) return options.filter.type.includes(s.type);
      if (options.filter?.language) return options.filter.language.includes(s.language);
      if (options.filter?.name) return options.filter.name.includes(s.name);
      return true;
    });

    if (services.length === 0) {
      if (spinner) {
        spinner.stop();
        flushOutput();
      }
      console.log(chalk.yellow('No services found for deployment.'));
      return;
    }

    if (spinner) {
      spinner.setText(`Deploying ${services.length} service${services.length > 1 ? 's' : ''} to ${target} (${environment})...`);
    }

    console.log(chalk.gray('\nServices to deploy:'));
    for (const service of services) {
      const framework = service.framework ? ` (${service.framework})` : '';
      console.log(chalk.gray(`  - ${service.name} [${service.language}]${framework}`));
    }
    console.log();

    // Build services if not skipped
    if (!skipBuild) {
      console.log(chalk.cyan('Building services before deployment...\n'));
      await buildAll({
        ...options,
        spinner,
        filter: options.filter ? {
          type: options.filter.type as any,
          language: options.filter.language as any,
          name: options.filter.name,
        } : undefined,
      });
    }

    // Load deployment config
    const deployConfigPath = path.join(process.cwd(), 'deploy', environment, 'config.json');
    let config: DeploymentConfig = {
      target,
      environment,
    };

    if (fs.existsSync(deployConfigPath)) {
      config = await fs.readJson(deployConfigPath);
    }

    // Deploy services
    const results = await Promise.all(
      services.map(service => deployService(service, target, config, options))
    );

    if (spinner) {
      spinner.stop();
      flushOutput();
    }

    printDeploymentResults(results);

    // Exit with error if any deployment failed
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error deploying services: ${error.message}`));
    throw error;
  }
}

/**
 * List all services in the workspace
 */
export async function listServices(options: any = {}): Promise<void> {
  try {
    const services = scanWorkspace();

    if (services.length === 0) {
      console.log(chalk.yellow('No services found in workspace.'));
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(services, null, 2));
      return;
    }

    console.log(chalk.bold('\n📦 Services in Workspace\n'));

    // Group by type
    const byType = services.reduce((acc, service) => {
      if (!acc[service.type]) acc[service.type] = [];
      acc[service.type].push(service);
      return acc;
    }, {} as Record<string, ServiceInfo[]>);

    for (const [type, typeServices] of Object.entries(byType)) {
      console.log(chalk.cyan(`${type.toUpperCase()}:`));
      for (const service of typeServices) {
        const framework = service.framework ? ` (${service.framework})` : '';
        const buildable = service.hasBuildScript ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${buildable} ${service.name} [${service.language}]${framework}`);
      }
      console.log();
    }
  } catch (error: any) {
    console.error(chalk.red(`Error listing services: ${error.message}`));
    throw error;
  }
}

/**
 * Parse environment file
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return envVars;
}
