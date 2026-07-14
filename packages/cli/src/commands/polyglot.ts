/**
 * Polyglot Build and Deploy Commands
 *
 * Unified commands for building and deploying multi-language applications.
 *
 * This module exposes high-level orchestration functions used by the Re-Shell
 * CLI to scan a workspace for polyglot services, build them with their native
 * toolchains, generate deployment configuration for multiple targets
 * (Docker, Kubernetes, AWS Lambda, Vercel, Netlify), and deploy them to a
 * chosen environment.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { flushOutput } from '../utils/spinner';
import {
  scanWorkspace,
  filterServices,
  buildServices,
  printBuildResults,
  PolyglotBuildOptions,
  ServiceInfo,
  BuildTarget,
  LanguageType,
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
 * Build all (or a filtered subset of) services discovered in the current workspace.
 *
 * The function scans the workspace for polyglot services, optionally filters them
 * based on the provided options, invokes each service's native build toolchain,
 * prints a build summary, and exits with a non-zero status code if any build failed.
 *
 * @param options - Optional build configuration. Supports a `spinner` for progress
 *   reporting, a `production` flag to toggle production vs. development builds,
 *   and filter criteria (language, type, name) to scope which services are built.
 *   Defaults to `{}` which builds all discovered services in development mode.
 * @returns A promise that resolves once all builds have completed. The process
 *   will exit with code `1` if one or more builds fail.
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
  } catch (error: unknown) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error building services: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * Generate deployment configuration files for the given target and environment.
 *
 * Scans the workspace for services, optionally filters them, then writes
 * target-specific configuration artifacts (for example `docker-compose.yml`,
 * Kubernetes manifests, AWS Lambda JSON configs, `vercel.json`, or
 * `netlify.toml`) into a `deploy/<environment>` directory. Also emits shared
 * deployment shell scripts and an `.env.example` template derived from the
 * supplied environment file.
 *
 * @param target - The deployment target to generate configuration for
 *   (e.g. `docker`, `kubernetes`, `aws-lambda`, `vercel`, `netlify`).
 * @param environment - The target deployment environment identifier
 *   (e.g. `staging`, `production`).
 * @param options - Additional generation options. May include `spinner` for
 *   progress reporting, `verbose` for detailed logs, `region`, `domain`,
 *   `env` (path to an env file), `resources` and `scaling` (JSON strings),
 *   and filter criteria (`type`, `language`, `name`). Defaults to `{}`.
 * @returns A promise that resolves once all configuration files have been
 *   written to disk.
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
  } catch (error: unknown) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error generating deployment config: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * Deploy services to the specified target and environment.
 *
 * Scans the workspace for services, optionally filters them, and unless
 * `skipBuild` is set, runs {@link buildAll} first to ensure the latest
 * artifacts are deployed. It then loads any existing deployment config from
 * `deploy/<environment>/config.json` (falling back to a minimal config), and
 * invokes {@link deployService} for each service in parallel. A deployment
 * summary is printed and the process exits with code `1` on any failure.
 *
 * @param target - The deployment target to deploy to (e.g. `docker`,
 *   `kubernetes`, `aws-lambda`, `vercel`, `netlify`).
 * @param environment - The target deployment environment identifier
 *   (e.g. `staging`, `production`).
 * @param options - Deployment options. Supports `spinner` for progress
 *   reporting, `skipBuild` to skip the pre-deploy build step, and a `filter`
 *   object (`type`, `language`, `name`) to scope which services are deployed.
 *   Defaults to `{}`.
 * @returns A promise that resolves once all deployments have completed. The
 *   process exits with code `1` if one or more deployments fail.
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
          type: options.filter.type as BuildTarget[],
          language: options.filter.language as LanguageType[],
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
  } catch (error: unknown) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    console.error(chalk.red(`Error deploying services: ${(error as Error).message}`));
    throw error;
  }
}

/**
 * List all services discovered in the current workspace.
 *
 * Scans the workspace for polyglot services and either emits them as JSON
 * (when `options.json` is set) or prints a human-readable, type-grouped
 * summary that indicates whether each service exposes a build script.
 *
 * @param options - Listing options. When `options.json` is truthy, the
 *   services are printed as a pretty-printed JSON array instead of the
 *   formatted table. Defaults to `{}`.
 * @returns A promise that resolves once the services have been listed.
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
  } catch (error: unknown) {
    console.error(chalk.red(`Error listing services: ${(error as Error).message}`));
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
