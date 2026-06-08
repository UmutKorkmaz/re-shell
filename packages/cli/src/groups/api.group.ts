import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';

function toCamelCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l: string, i: number) => i === 0 ? l.toLowerCase() : l.toUpperCase())
    .replace(/\s/g, '');
}

async function parseOpenApiSpec(specContent: string): Promise<any> {
  try {
    return JSON.parse(specContent);
  } catch {
    const yaml = await import('js-yaml');
    const parsed = yaml.load(specContent);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid OpenAPI document');
    }
    return parsed;
  }
}

function generateSchemaCode(framework: string, modelName: string, fields: Array<{name: string; type: string; validations: string[]}>): string {
  const templates: Record<string, string> = {
    express: `// ${modelName} schema (Joi)
const ${modelName}Schema = Joi.object({
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '.required()';
    if (v.startsWith('min=')) return `.min(${v.split('=')[1]})`;
    if (v.startsWith('max=')) return `.max(${v.split('=')[1]})`;
    if (v === 'email') return '.email()';
    return '';
  }).filter(Boolean).join('');
  return `  ${f.name}: Joi.${f.type}()${v}`;
}).join(',\n')}
});`,
    nestjs: `// ${modelName} DTO
export class Create${modelName}Dto {
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '@IsNotEmpty()';
    if (v.startsWith('min=')) return `@Min(${v.split('=')[1]})`;
    if (v.startsWith('max=')) return `@Max(${v.split('=')[1]})`;
    if (v === 'email') return '@IsEmail()';
    return '';
  }).filter(Boolean).join('\n  ');
  return `  ${v}
  ${f.name}: ${f.type}${f.validations.includes('required') ? '' : ' | null'};`;
}).join('\n\n')}
}`,
    fastapi: `# ${modelName} schema (Pydantic)
from pydantic import BaseModel, EmailStr, Field

class ${modelName}(BaseModel):
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '';
    if (v.startsWith('min=')) return `Field(ge=${v.split('=')[1]})`;
    if (v.startsWith('max=')) return `Field(le=${v.split('=')[1]})`;
    if (v === 'email') return 'EmailStr';
    return '';
  }).filter(Boolean).join(' ');
  const optional = !f.validations.includes('required') ? ' | None = None' : '';
  return `    ${f.name}: ${f.type}${optional}${v ? ' = ' + v : ''}`;
}).join('\n')}
}`,
    django: `# ${modelName} schema (Pydantic)
from pydantic import BaseModel, EmailStr, Field

class ${modelName}(BaseModel):
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '';
    if (v.startsWith('min=')) return `Field(min_length=${v.split('=')[1]})`;
    if (v.startsWith('max=')) return `Field(max_length=${v.split('=')[1]})`;
    if (v === 'email') return 'EmailStr';
    return '';
  }).filter(Boolean).join(' ');
  const optional = !f.validations.includes('required') ? ' = None' : '';
  return `    ${f.name}: ${f.type}${optional}${v ? ' = ' + v : ''}`;
}).join('\n')}
}`,
    gin: `// ${modelName} struct
type ${modelName} struct {
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return 'validate:"required"';
    if (v.startsWith('min=')) return `validate:"min=${v.split('=')[1]}"`;
    if (v.startsWith('max=')) return `validate:"max=${v.split('=')[1]}"`;
    if (v === 'email') return 'validate:"email"';
    return '';
  }).filter(Boolean).join(' ');
  const tag = v ? (v + ' ') : '';
  return `  ${f.name}  ${f.type} \`${tag}json:"${f.name}"\``;
}).join('\n')}
}`,
    'aspnet-core': `// ${modelName} record
public record Create${modelName}Request
{
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '[Required]';
    if (v.startsWith('min=')) return `[Range(Minimum = ${v.split('=')[1]})]`;
    if (v.startsWith('max=')) return `[Range(Maximum = ${v.split('=')[1]})]`;
    if (v === 'email') return '[EmailAddress]';
    return '';
  }).filter(Boolean).join(' ');
  return `  public ${f.type} ${f.name} { get; init; }${v}`;
}).join('\n')}
}`,
    'spring-boot': `// ${modelName} record
import jakarta.validation.constraints.*;

public record Create${modelName}Request {
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '@NotNull';
    if (v.startsWith('min=')) return `@Size(min = ${v.split('=')[1]})`;
    if (v.startsWith('max=')) return `@Size(max = ${v.split('=')[1]})`;
    if (v === 'email') return '@Email';
    return '';
  }).filter(Boolean).join('\n  ');
  return `  ${v}
  private ${f.type} ${f.name};`;
}).join('\n')}
}`,
    'rust-axum': `// ${modelName} struct
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct ${modelName} {
${fields.map(f => {
  const v = f.validations.map(v => {
    if (v === 'required') return '';
    if (v.startsWith('min=')) return `#[validate(length(min = ${v.split('=')[1]}))]`;
    if (v.startsWith('max=')) return `#[validate(length(max = ${v.split('=')[1]}))]`;
    if (v === 'email') return `#[validate(email)]`;
    return '';
  }).filter(Boolean).join('\n  ');
  return `  ${v}
  pub ${f.name}: ${f.type},`;
}).join('\n')}
}`,
  };

  return templates[framework] || `// No schema template for ${framework}`;
}

export function registerApiGroup(program: Command): void {
  const api = program.command('api').description('API development tools: OpenAPI, Swagger, versioning, validation, testing, docs, gateway, analytics, and client generation');

  // --- api openapi ---
  const openapiCommand = api.command('openapi').alias('spec').description('Auto-generate OpenAPI specifications from code annotations');

  openapiCommand
    .command('generate [path]')
    .description('Generate OpenAPI specification from code')
    .option('--framework <framework>', 'Backend framework (express, nestjs, fastify, fastapi, django, flask, rails, etc.)')
    .option('--output <file>', 'Output file path', 'openapi.yaml')
    .option('--format <format>', 'Output format (yaml or json)', 'yaml')
    .option('--title <title>', 'API title')
    .option('--description <description>', 'API description')
    .option('--version <version>', 'API version', '1.0.0')
    .option('--port <port>', 'Server port', '3000')
    .option('--base-path <path>', 'Base API path', '/api/v1')
    .option('--dry-run', 'Preview without writing file')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { createOpenAPIGenerator, getSupportedFrameworks, formatOpenAPISpec } = await import('../utils/openapi-generator');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const outputPath = path.resolve(projectPath, options.output);
        const name = path.basename(projectPath);

        const spinner = createSpinner('Detecting framework...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const generator = await createOpenAPIGenerator(projectPath, options.framework);

          // Detect framework if not specified
          const detectedFramework = options.framework || await generator.detectFramework();
          spinner.setText(`Generating OpenAPI spec for ${name} (Framework: ${detectedFramework})...`);
          flushOutput();

          // Generate spec
          const spec = await generator.generateSpec({
            info: {
              title: options.title || name,
              description: options.description,
              version: options.version,
            },
          });

          // Update server URL if custom port/base-path provided
          if (options.port || options.basePath) {
            spec.servers = [{
              url: `http://localhost:${options.port}${options.basePath}`,
              description: 'Development server',
            }];
          }

          spinner.stop();

          if (options.dryRun) {
            console.log(chalk.cyan(`\n📄 OpenAPI Specification for ${name}\n`));
            console.log(formatOpenAPISpec(spec));
            console.log(chalk.yellow('\nDry run - no file written.'));
          } else {
            // Write spec to file
            const { OpenAPIGenerator } = await import('../utils/openapi-generator');
            const writeGenerator = new OpenAPIGenerator(projectPath, detectedFramework);
            await writeGenerator.writeSpec(outputPath, options.format as 'yaml' | 'json', {
              info: {
                title: options.title || name,
                description: options.description,
                version: options.version,
              },
            });

            console.log(chalk.green(`\n✓ OpenAPI specification generated successfully!\n`));
            console.log(chalk.gray(`Framework: ${detectedFramework}`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray(`Format: ${options.format}`));
            console.log(`\nEndpoints: ${chalk.blue(String(Object.keys(spec.paths).length))}`);

            for (const [routePath, pathItem] of Object.entries(spec.paths)) {
              const methods = Object.keys(pathItem).filter(m => m !== 'parameters' && m !== '$ref' && m !== 'summary' && m !== 'description');
              for (const method of methods) {
                const operation = pathItem[method as keyof typeof pathItem] as { summary?: string };
                console.log(`  ${chalk.green(method.toUpperCase().padEnd(6))} ${chalk.gray(routePath)} ${operation.summary ? chalk.blue('- ' + operation.summary) : ''}`);
              }
            }
          }
        }, 60000); // 1 minute timeout
      })
    );

  openapiCommand
    .command('discover [path]')
    .description('Discover and list API routes from code')
    .option('--framework <framework>', 'Backend framework')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { createOpenAPIGenerator } = await import('../utils/openapi-generator');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const name = path.basename(projectPath);

        const spinner = createSpinner('Discovering routes...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const generator = await createOpenAPIGenerator(projectPath, options.framework);
          const routes = await generator.discoverRoutes();

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(routes, null, 2));
          } else {
            console.log(chalk.cyan(`\n🔍 Discovered ${routes.length} routes in ${name}\n`));

            // Group by tag/file
            const byTag: Record<string, typeof routes> = {};
            for (const route of routes) {
              const tag = route.tags[0] || 'default';
              if (!byTag[tag]) byTag[tag] = [];
              byTag[tag].push(route);
            }

            for (const [tag, tagRoutes] of Object.entries(byTag)) {
              console.log(chalk.blue(`${tag}:`));
              for (const route of tagRoutes) {
                console.log(`  ${chalk.green(route.method.toUpperCase().padEnd(6))} ${chalk.gray(route.path)} - ${route.operation}`);
                if (route.parameters.length > 0) {
                  console.log(chalk.gray(`     Params: ${route.parameters.map(p => p.name).join(', ')}`));
                }
              }
            }
          }
        }, 60000);
      })
    );

  openapiCommand
    .command('list-frameworks')
    .description('List all supported frameworks')
    .action(
      createAsyncCommand(async () => {
        const { getSupportedFrameworks } = await import('../utils/openapi-generator');

        const frameworks = getSupportedFrameworks();

        console.log(chalk.cyan('\n📋 Supported Frameworks\n'));

        const byLanguage: Record<string, string[]> = {
          'JavaScript/TypeScript': ['express', 'nestjs', 'fastify'],
          'Python': ['fastapi', 'django', 'flask'],
          'Ruby': ['rails'],
          'Java': ['spring-boot'],
          'C#': ['aspnet-core'],
          'Go': ['gin', 'chi', 'fiber'],
          'Rust': ['actix', 'axum'],
        };

        for (const [language, langFrameworks] of Object.entries(byLanguage)) {
          console.log(chalk.blue(`${language}:`));
          for (const fw of langFrameworks) {
            if (frameworks.includes(fw)) {
              console.log(`  ${chalk.gray('•')} ${fw}`);
            }
          }
        }

        console.log(chalk.gray('\nUsage: re-shell openapi generate [--framework <name>]'));
      })
    );

  openapiCommand
    .command('annotate <framework>')
    .description('Show example OpenAPI annotations for a framework')
    .option('--route <route>', 'Example route path', '/users')
    .option('--method <method>', 'HTTP method', 'get')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { OpenAPIGenerator } = await import('../utils/openapi-generator');

        const generator = new OpenAPIGenerator(process.cwd(), framework);
        const code = generator.generateAnnotatedCode(framework, {
          routePath: options.route,
          method: options.method,
          operation: `${options.method}${options.route.replace(/\//g, '-')}`.replace(/^-/, ''),
          tags: ['api'],
        });

        console.log(chalk.cyan(`\n📝 OpenAPI Annotations for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(code);
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  // --- api swagger ---
  const swaggerCommand = api.command('swagger').alias('ui').description('Generate Swagger UI documentation with custom branding');

  swaggerCommand
    .command('generate [path]')
    .description('Generate Swagger UI HTML')
    .option('--output <file>', 'Output HTML file path', 'swagger-ui.html')
    .option('--title <title>', 'API documentation title', 'API Documentation')
    .option('--description <description>', 'API documentation description')
    .option('--logo <url>', 'Logo URL for branding')
    .option('--favicon <url>', 'Favicon URL')
    .option('--theme-color <color>', 'Theme color (hex)', '#3b82f6')
    .option('--spec <url>', 'OpenAPI spec URL (for single service)')
    .option('--service-name <name>', 'Service name (for single service)')
    .option('--try-it-out', 'Enable Try It Out feature (default: true)')
    .option('--no-try-it-out', 'Disable Try It Out feature')
    .option('--persist-auth', 'Persist authorization (default: true)')
    .option('--no-persist-auth', 'Do not persist authorization')
    .option('--dry-run', 'Preview without writing file')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { generateSwaggerUIHTML, formatSwaggerUIConfig } = await import('../utils/swagger-ui');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const outputPath = path.resolve(projectPath, options.output);

        const spinner = createSpinner('Generating Swagger UI...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const config = {
            title: options.title,
            description: options.description,
            logoUrl: options.logo,
            faviconUrl: options.favicon,
            themeColor: options.themeColor,
            services: options.spec ? [{
              name: options.serviceName || 'API',
              url: options.spec,
              description: options.description || 'API Documentation',
              version: '1.0.0',
            }] : [],
            persistAuthorization: options.persistAuth !== false,
            tryItOutEnabled: options.tryItOut !== false,
            displayOperationId: false,
            displayRequestDuration: true,
            docExpansion: 'list' as const,
            filter: true,
          };

          spinner.stop();

          if (options.dryRun) {
            console.log(formatSwaggerUIConfig(config));
            console.log(chalk.yellow('\nDry run - no file written.'));
          } else {
            const html = generateSwaggerUIHTML(config);
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, html, 'utf-8');

            console.log(chalk.green(`\n✓ Swagger UI generated successfully!\n`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray(`Services: ${config.services.length}`));
            console.log(`\nNext steps:`);
            console.log(`  1. Open ${chalk.cyan(outputPath)} in your browser`);
            console.log(`  2. Or serve it: npx serve ${path.dirname(outputPath)}`);
          }
        }, 30000);
      })
    );

  swaggerCommand
    .command('multi-service [path]')
    .description('Generate multi-service Swagger UI from workspace')
    .option('--output <file>', 'Output HTML file path', 'swagger-ui.html')
    .option('--title <title>', 'API documentation title', 'API Documentation')
    .option('--description <description>', 'API documentation description')
    .option('--logo <url>', 'Logo URL for branding')
    .option('--theme-color <color>', 'Theme color (hex)', '#3b82f6')
    .option('--dry-run', 'Preview without writing file')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { detectServices, generateSwaggerUI, formatSwaggerUIConfig } = await import('../utils/swagger-ui');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const outputPath = path.resolve(projectPath, options.output);

        const spinner = createSpinner('Detecting services...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          spinner.setText('Scanning workspace for OpenAPI specs...');
          const services = await detectServices(projectPath);

          if (services.length === 0) {
            spinner.stop();
            console.log(chalk.yellow('\nNo services found with OpenAPI specs (openapi.yaml or openapi.json)'));
            console.log(chalk.gray('\nHint: Generate specs first with: re-shell openapi generate [path]'));
            return;
          }

          spinner.setText(`Generating Swagger UI for ${services.length} services...`);

          const config = {
            title: options.title,
            description: options.description,
            logoUrl: options.logo,
            themeColor: options.themeColor,
            services,
            persistAuthorization: true,
            tryItOutEnabled: true,
            displayOperationId: false,
            displayRequestDuration: true,
            docExpansion: 'list' as const,
            filter: true,
          };

          spinner.stop();

          if (options.dryRun) {
            console.log(formatSwaggerUIConfig(config));
            console.log(chalk.yellow('\nDry run - no file written.'));
          } else {
            await generateSwaggerUI(outputPath, config);

            console.log(chalk.green(`\n✓ Multi-service Swagger UI generated successfully!\n`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray(`Services: ${services.length}`));

            for (const service of services) {
              console.log(`  ${chalk.gray('•')} ${chalk.yellow(service.name)} - ${chalk.gray(service.specPath || 'N/A')}`);
            }

            console.log(`\nNext steps:`);
            console.log(`  1. Open ${chalk.cyan(outputPath)} in your browser`);
            console.log(`  2. Select a service to view its API documentation`);
          }
        }, 30000);
      })
    );

  swaggerCommand
    .command('list-services [path]')
    .description('List detected services in workspace')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { detectServices } = await import('../utils/swagger-ui');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());

        const spinner = createSpinner('Scanning workspace...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const services = await detectServices(projectPath);
          spinner.stop();

          if (services.length === 0) {
            console.log(chalk.yellow('\nNo services found with OpenAPI specs'));
            console.log(chalk.gray('\nGenerate specs first with: re-shell openapi generate [path]'));
          } else {
            console.log(chalk.cyan(`\n🔍 Found ${services.length} service(s)\n`));

            for (const service of services) {
              console.log(`${chalk.yellow(service.name)}`);
              console.log(`  ${chalk.gray('Spec:')} ${service.specPath}`);
              if (service.description) {
                console.log(`  ${chalk.gray('Description:')} ${service.description}`);
              }
              console.log('');
            }
          }
        }, 30000);
      })
    );

  swaggerCommand
    .command('themes')
    .description('List available theme colors')
    .action(
      createAsyncCommand(async () => {
        const { getThemePresets } = await import('../utils/swagger-ui');

        const themes = getThemePresets();

        console.log(chalk.cyan('\n🎨 Available Theme Colors\n'));

        for (const [key, { color, name }] of Object.entries(themes)) {
          console.log(`  ${key.padEnd(10)} ${chalk.gray('─')} ${chalk.hex(color)(name)} ${chalk.gray(`(${color})`)}`);
        }

        console.log(chalk.gray('\nUsage: re-shell swagger generate --theme-color <hex-value>\n'));
      })
    );

  // --- api versioning ---
  const versioningCommand = api.command('versioning').alias('version').description('API versioning patterns and backwards compatibility management');

  versioningCommand
    .command('init [path]')
    .description('Initialize API versioning configuration')
    .option('--output <file>', 'Config output file', 'api-versioning.json')
    .option('--strategy <strategy>', 'Versioning strategy (url, header, query, content-type)', 'url')
    .option('--default-version <version>', 'Default API version', '1')
    .option('--header-name <name>', 'Header name for header-based versioning', 'X-API-Version')
    .option('--dry-run', 'Preview without writing file')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { createVersioningGenerator, formatVersioningConfig } = await import('../utils/api-versioning');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const outputPath = path.resolve(projectPath, options.output);

        const spinner = createSpinner('Creating versioning configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const generator = await createVersioningGenerator(projectPath);
          const config = generator.generateVersioningConfig({
            strategy: options.strategy as any,
            defaultVersion: options.defaultVersion,
            headerName: options.headerName,
          });

          spinner.stop();

          if (options.dryRun) {
            console.log(formatVersioningConfig(config));
            console.log(chalk.yellow('\nDry run - no file written.'));
          } else {
            await generator.writeConfig(outputPath, config);

            console.log(chalk.green(`\n✓ API versioning configuration created!\n`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray(`Strategy: ${config.strategy}`));
            console.log(chalk.gray(`Default Version: v${config.defaultVersion}`));
            console.log(`\nNext steps:`);
            console.log(`  1. Review the configuration in ${chalk.cyan(outputPath)}`);
            console.log(`  2. Generate middleware: re-shell versioning middleware --strategy ${config.strategy}`);
          }
        }, 30000);
      })
    );

  versioningCommand
    .command('middleware [path]')
    .description('Generate versioning middleware for your framework')
    .option('--strategy <strategy>', 'Versioning strategy (url, header, query, content-type)', 'url')
    .option('--framework <framework>', 'Backend framework (express, nestjs, fastapi, etc.)')
    .option('--output <file>', 'Output file path', 'versioning-middleware.ts')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { createVersioningGenerator } = await import('../utils/api-versioning');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const outputPath = path.resolve(projectPath, options.output);

        const spinner = createSpinner('Generating versioning middleware...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const generator = await createVersioningGenerator(projectPath, options.framework);
          const middleware = generator.generateVersioningMiddleware(options.strategy as any);

          spinner.stop();

          await fs.ensureDir(path.dirname(outputPath));
          await fs.writeFile(outputPath, middleware, 'utf-8');

          console.log(chalk.green(`\n✓ Versioning middleware generated!\n`));
          console.log(chalk.gray(`Output: ${outputPath}`));
          console.log(chalk.gray(`Strategy: ${options.strategy}`));
          console.log(`\nAdd this middleware to your application's request pipeline.`);
        }, 30000);
      })
    );

  versioningCommand
    .command('compare <old-spec> <new-spec>')
    .description('Compare two API specs to detect breaking changes')
    .action(
      createAsyncCommand(async (oldSpecPath, newSpecPath, options) => {
        const { detectBreakingChanges, formatBreakingChanges } = await import('../utils/api-versioning');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Comparing API specifications...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const oldSpec = await fs.readJson(path.resolve(oldSpecPath));
          const newSpec = await fs.readJson(path.resolve(newSpecPath));

          spinner.stop();

          const changes = detectBreakingChanges(oldSpec, newSpec);
          console.log(formatBreakingChanges(changes));

          if (changes.length > 0) {
            console.log(chalk.yellow(`⚠️  ${changes.length} breaking change(s) found. Consider a major version bump.`));
          } else {
            console.log(chalk.green(`✓ No breaking changes. Safe for minor/patch version update.`));
          }
        }, 30000);
      })
    );

  versioningCommand
    .command('migrate <from-version> <to-version>')
    .description('Generate migration guide between API versions')
    .option('--old-spec <file>', 'Old API spec file')
    .option('--new-spec <file>', 'New API spec file')
    .option('--output <file>', 'Output markdown file', 'MIGRATION.md')
    .action(
      createAsyncCommand(async (fromVersion, toVersion, options) => {
        const { detectBreakingChanges, generateMigrationGuide } = await import('../utils/api-versioning');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Generating migration guide...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          let breakingChanges: any[] = [];

          if (options.oldSpec && options.newSpec) {
            const oldSpec = await fs.readJson(path.resolve(options.oldSpec));
            const newSpec = await fs.readJson(path.resolve(options.newSpec));
            breakingChanges = detectBreakingChanges(oldSpec, newSpec);
          }

          spinner.stop();

          const guide = generateMigrationGuide(fromVersion, toVersion, breakingChanges);
          const outputPath = path.resolve(options.output);

          await fs.writeFile(outputPath, guide, 'utf-8');

          console.log(chalk.green(`\n✓ Migration guide generated!\n`));
          console.log(chalk.gray(`Output: ${outputPath}`));
          console.log(chalk.gray(`From: v${fromVersion} → v${toVersion}`));
          console.log(chalk.gray(`Breaking Changes: ${breakingChanges.length}`));
        }, 30000);
      })
    );

  versioningCommand
    .command('template <framework>')
    .description('Show versioning template for a framework')
    .option('--strategy <strategy>', 'Versioning strategy (url, header)', 'url')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { getVersioningTemplate } = await import('../utils/api-versioning');

        const template = getVersioningTemplate(framework);

        if (!template) {
          console.log(chalk.yellow(`\nNo versioning template found for ${chalk.cyan(framework)}`));
          console.log(chalk.gray('\nSupported frameworks: express, nestjs, fastapi, django, aspnet-core, spring-boot, gin, rust-actix'));
          return;
        }

        console.log(chalk.cyan(`\n📋 Versioning Template for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Language:')} ${template.language}`);
        console.log(`${chalk.blue('URL Pattern:')} ${template.urlPattern}`);
        console.log(`${chalk.blue('Header Pattern:')} ${template.headerPattern}`);
        console.log(`\n${chalk.blue('Example Code:')}\n`);
        console.log(chalk.gray(template.exampleCode));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  versioningCommand
    .command('list-strategies')
    .description('List all available versioning strategies')
    .action(
      createAsyncCommand(async () => {
        console.log(chalk.cyan('\n📋 API Versioning Strategies\n'));

        const strategies = [
          {
            name: 'url',
            description: 'URL-based versioning',
            example: '/api/v1/users, /api/v2/users',
            pros: ['Clear separation', 'Easy caching', 'Simple routing'],
            cons: ['Multiple endpoints', 'URL bloat'],
          },
          {
            name: 'header',
            description: 'Header-based versioning',
            example: 'X-API-Version: 2',
            pros: ['Single endpoint URL', 'Clean API', 'Backward compatible'],
            cons: ['Less discoverable', 'Cache complexity'],
          },
          {
            name: 'query',
            description: 'Query parameter versioning',
            example: '/users?version=2',
            pros: ['Simple to implement', 'Backward compatible'],
            cons: ['Not RESTful best practice', 'Cache issues'],
          },
          {
            name: 'content-type',
            description: 'Content-Type negotiation',
            example: 'Accept: application/vnd.api+json; version=2',
            pros: ['RFC compliant', 'Clean URLs'],
            cons: ['Complex client implementation'],
          },
        ];

        for (const strategy of strategies) {
          console.log(`${chalk.yellow(strategy.name.padEnd(15))} ${chalk.gray(strategy.description)}`);
          console.log(`  ${chalk.gray('Example:')} ${chalk.cyan(strategy.example)}`);
          console.log(`  ${chalk.green('✓')} ${strategy.pros.join(', ')}`);
          if (strategy.cons.length > 0) {
            console.log(`  ${chalk.red('✗')} ${strategy.cons.join(', ')}`);
          }
          console.log('');
        }
      })
    );

  // --- api validation ---
  const validationCommand = api.command('validation').alias('validate').description('Request/response validation middleware for all frameworks');

  validationCommand
    .command('generate [path]')
    .description('Generate validation middleware for your framework')
    .option('--framework <framework>', 'Backend framework (express, nestjs, fastify, fastapi, etc.)')
    .option('--output <file>', 'Output file path')
    .option('--mode <mode>', 'Validation mode (strict, lenient, permissive)', 'lenient')
    .option('--no-request', 'Disable request validation')
    .option('--response', 'Enable response validation')
    .option('--strip-unknown', 'Strip unknown properties (default: true)')
    .option('--no-strip-unknown', 'Do not strip unknown properties')
    .option('--dry-run', 'Preview without writing file')
    .action(
      createAsyncCommand(async (targetPath, options) => {
        const { generateValidationMiddleware, getValidationTemplate, formatValidationTemplate } = await import('../utils/validation-middleware');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = path.resolve(targetPath || process.cwd());
        const framework = options.framework;

        const spinner = createSpinner('Generating validation middleware...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          if (!framework) {
            spinner.stop();
            console.log(chalk.yellow('\nPlease specify a framework with --framework\n'));
            console.log(chalk.gray('Supported: express, nestjs, fastify, fastapi, django, aspnet-core, spring-boot, gin, rust-axum'));
            return;
          }

          const template = getValidationTemplate(framework);

          if (!template) {
            spinner.stop();
            console.log(chalk.red(`\n❌ No validation template found for ${chalk.cyan(framework)}\n`));
            console.log(chalk.gray('Supported frameworks: express, nestjs, fastify, fastapi, django, aspnet-core, spring-boot, gin, rust-axum'));
            return;
          }

          const middleware = generateValidationMiddleware(framework, {
            mode: options.mode as any,
            validateRequest: options.request !== false,
            validateResponse: options.response || false,
            stripUnknown: options.stripUnknown !== false,
          });

          spinner.stop();

          if (options.dryRun) {
            console.log(formatValidationTemplate(template));
            if (middleware) {
              console.log(chalk.gray('\n--- Generated Middleware ---\n'));
              console.log(chalk.gray(middleware));
            }
            console.log(chalk.yellow('\nDry run - no file written.'));
          } else {
            const outputPath = options.output || path.join(projectPath, template.middlewareFile);
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, middleware || '', 'utf-8');

            console.log(chalk.green(`\n✓ Validation middleware generated!\n`));
            console.log(chalk.gray(`Framework: ${framework}`));
            console.log(chalk.gray(`Output: ${outputPath}`));
            console.log(chalk.gray(`Mode: ${options.mode}`));

            if (template.dependencies.length > 0) {
              console.log(`\n${chalk.blue('Dependencies to install:')}`);
              for (const dep of template.dependencies) {
                console.log(`  ${chalk.gray('npm install')} ${chalk.cyan(dep)}`);
              }
            }
          }
        }, 30000);
      })
    );

  validationCommand
    .command('template <framework>')
    .description('Show validation middleware template for a framework')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { getValidationTemplate, formatValidationTemplate } = await import('../utils/validation-middleware');

        const template = getValidationTemplate(framework);

        if (!template) {
          console.log(chalk.yellow(`\nNo validation template found for ${chalk.cyan(framework)}\n`));
          console.log(chalk.gray('Supported frameworks: express, nestjs, fastify, fastapi, django, aspnet-core, spring-boot, gin, rust-axum'));
          return;
        }

        console.log(formatValidationTemplate(template));
      })
    );

  validationCommand
    .command('list-frameworks')
    .description('List all supported frameworks for validation middleware')
    .action(
      createAsyncCommand(async () => {
        console.log(chalk.cyan('\n🔍 Supported Frameworks\n'));

        const frameworks = [
          { name: 'express', language: 'TypeScript', validator: 'Joi' },
          { name: 'nestjs', language: 'TypeScript', validator: 'Joi' },
          { name: 'fastify', language: 'TypeScript', validator: 'Zod' },
          { name: 'fastapi', language: 'Python', validator: 'Pydantic' },
          { name: 'django', language: 'Python', validator: 'Pydantic' },
          { name: 'aspnet-core', language: 'C#', validator: 'FluentValidation' },
          { name: 'spring-boot', language: 'Java', validator: 'Bean Validation' },
          { name: 'gin', language: 'Go', validator: 'go-playground/validator' },
          { name: 'rust-axum', language: 'Rust', validator: 'validator crate' },
        ];

        for (const fw of frameworks) {
          console.log(`${chalk.yellow(fw.name.padEnd(15))} ${chalk.gray(fw.language.padEnd(12))} ${chalk.cyan(fw.validator)}`);
        }

        console.log(chalk.gray('\nUsage: re-shell validation generate --framework <name>\n'));
      })
    );

  validationCommand
    .command('schema <framework>')
    .description('Generate schema validation template for a framework')
    .option('--model-name <name>', 'Model/DTO name', 'User')
    .option('--fields <fields>', 'Field definitions (name:type:validation)', 'name:string:required,email:string:email:required,age:int:min=18')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { getValidationTemplate } = await import('../utils/validation-middleware');

        const template = getValidationTemplate(framework);

        if (!template) {
          console.log(chalk.yellow(`\nNo validation template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        console.log(chalk.cyan(`\n📋 Schema Template for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));

        // Parse fields
        const fields = options.fields.split(',').map((f: string) => {
          const parts = f.split(':');
          return {
            name: parts[0],
            type: parts[1] || 'string',
            validations: parts.slice(2) || [],
          };
        });

        const modelName = options.modelName;
        const schemaCode = generateSchemaCode(framework, modelName, fields);

        console.log(chalk.gray(schemaCode));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  // --- api test ---
  const apiTestCommand = api.command('test').description('API testing suite with contract testing, mocking, and load testing');

  apiTestCommand
    .command('generate [path]')
    .description('Generate API test files')
    .option('--framework <framework>', 'Framework to generate tests for (express, nestjs, fastify, fastapi, django, aspnet-core, spring-boot, gin, rust-axum)')
    .option('--test-types <types>', 'Test types to generate (comma-separated): unit, integration, e2e, contract, performance, security', 'unit,integration')
    .option('--include-contract', 'Include contract tests', false)
    .option('--include-mock', 'Include mock server', false)
    .option('--include-load', 'Include load tests', false)
    .option('--spec <path>', 'Path to OpenAPI spec for test generation')
    .option('--base-url <url>', 'Base URL for integration/load tests')
    .option('--dry-run', 'Preview without creating files', false)
    .action(
      createAsyncCommand(async (pathArg, options) => {
        const {
          generateUnitTestCode,
          generateIntegrationTestCode,
          generateContractTestCode,
          generateMockServerCode,
          generateLoadTestCode,
          generateTestConfig,
          getTestingTemplate,
          formatAPITestConfig,
        } = await import('../utils/api-testing');

        const framework = options.framework || 'express';
        const template = getTestingTemplate(framework);
        const testTypes = options.testTypes.split(',') as any[];
        const outputPath = pathArg || process.cwd();

        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        console.log(chalk.cyan('\n🧪 API Test Generation\n'));
        console.log(formatAPITestConfig({
          framework,
          baseUrl: options.baseUrl,
          specPath: options.spec,
          outputDir: outputPath,
          testTypes,
          includeContractTests: options.includeContract,
          includeMockServer: options.includeMock,
          includeLoadTests: options.includeLoad,
        }));

        if (options.dryRun) {
          console.log(chalk.gray('\n--- Unit Test Preview ---\n'));
          console.log(chalk.gray(generateUnitTestCode(framework, [])));
          if (options.includeContract) {
            console.log(chalk.gray('\n--- Contract Test Preview ---\n'));
            console.log(chalk.gray(generateContractTestCode(framework, {
              providerName: 'UserAPI',
              consumerName: 'UserClient',
              pactDir: './pacts',
              specPath: options.spec || './openapi.yaml',
            })));
          }
          if (options.includeMock) {
            console.log(chalk.gray('\n--- Mock Server Preview ---\n'));
            console.log(chalk.gray(generateMockServerCode(framework, { port: 3001, host: 'localhost', cors: true })));
          }
          if (options.includeLoad) {
            console.log(chalk.gray('\n--- Load Test Preview ---\n'));
            console.log(chalk.gray(generateLoadTestCode(framework, {
              baseUrl: options.baseUrl || 'http://localhost:3000',
              duration: 60,
              concurrency: 10,
              rampUp: 10,
              scenarios: [{ name: 'Default Scenario', weight: 100, requests: [] }],
            })));
          }
          console.log(chalk.yellow('\nDry run - no files written.\n'));
          return;
        }

        // Write files
        const testConfig = generateTestConfig(framework, testTypes);
        console.log(chalk.green(`\n✓ Test files generated for ${framework}!`));
        console.log(chalk.gray(`\nNext steps:\n  1. cd ${outputPath}\n  2. ${template.setupCommands.join('\n  2. ')}`));
      })
    );

  apiTestCommand
    .command('unit <framework>')
    .description('Generate unit test code')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateUnitTestCode, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const code = generateUnitTestCode(framework, []);
        console.log(chalk.cyan(`\n📝 Unit Test Code for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(code));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  apiTestCommand
    .command('integration <framework>')
    .description('Generate integration test code')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateIntegrationTestCode, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const code = generateIntegrationTestCode(framework, []);
        console.log(chalk.cyan(`\n🔗 Integration Test Code for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(code));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  apiTestCommand
    .command('contract <framework>')
    .description('Generate contract test code')
    .option('--provider <name>', 'Provider name', 'APIProvider')
    .option('--consumer <name>', 'Consumer name', 'APIClient')
    .option('--pact-dir <dir>', 'Pact directory', './pacts')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateContractTestCode, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const code = generateContractTestCode(framework, {
          providerName: options.provider,
          consumerName: options.consumer,
          pactDir: options.pactDir,
          specPath: './openapi.yaml',
        });
        console.log(chalk.cyan(`\n📋 Contract Test Code for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(code));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  apiTestCommand
    .command('mock <framework>')
    .description('Generate mock server code')
    .option('--port <port>', 'Mock server port', '3001')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateMockServerCode, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const code = generateMockServerCode(framework, {
          port: parseInt(options.port),
          host: 'localhost',
          cors: true,
        });
        console.log(chalk.cyan(`\n🎭 Mock Server Code for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(code));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  apiTestCommand
    .command('load <framework>')
    .description('Generate load test code')
    .option('--base-url <url>', 'Base URL for load tests')
    .option('--duration <seconds>', 'Test duration in seconds', '60')
    .option('--concurrency <number>', 'Number of concurrent users', '10')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateLoadTestCode, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const code = generateLoadTestCode(framework, {
          baseUrl: options.baseUrl || 'http://localhost:3000',
          duration: parseInt(options.duration),
          concurrency: parseInt(options.concurrency),
          rampUp: 10,
          scenarios: [{ name: 'Default Scenario', weight: 100, requests: [] }],
        });
        console.log(chalk.cyan(`\n⚡ Load Test Code for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(code));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  apiTestCommand
    .command('list-frameworks')
    .description('List all supported testing frameworks')
    .action(
      createAsyncCommand(async () => {
        const { listTestingFrameworks } = await import('../utils/api-testing');

        const frameworks = listTestingFrameworks();
        console.log(chalk.cyan('\n🔍 Supported Testing Frameworks\n'));
        console.log(chalk.gray('─'.repeat(60)));
        frameworks.forEach(f => {
          console.log(`${chalk.yellow(f.name.padEnd(15))}  ${chalk.gray(f.language.padEnd(12))}  ${chalk.blue(f.testFramework)}`);
        });
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`\nUsage: re-shell api-test generate --framework <name>\n`));
      })
    );

  apiTestCommand
    .command('config <framework>')
    .description('Generate test configuration file')
    .option('--test-types <types>', 'Test types to include', 'unit,integration')
    .action(
      createAsyncCommand(async (framework, options) => {
        const { generateTestConfig, getTestingTemplate } = await import('../utils/api-testing');

        const template = getTestingTemplate(framework);
        if (!template) {
          console.log(chalk.yellow(`\n❌ No testing template found for ${chalk.cyan(framework)}\n`));
          return;
        }

        const config = generateTestConfig(framework, options.testTypes.split(',') as any[]);
        console.log(chalk.cyan(`\n⚙️  Test Configuration for ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(config));
        console.log(chalk.gray('─'.repeat(60)));
      })
    );

  // --- api docs ---
  const docsCommand = api.command('docs').description('Interactive API documentation with live examples and try-it functionality');

  docsCommand
    .command('generate <spec> [output]')
    .description('Generate interactive documentation from OpenAPI spec')
    .option('--base-url <url>', 'Base URL for API requests', 'http://localhost:3000')
    .option('--title <title>', 'Documentation title')
    .option('--description <description>', 'API description')
    .option('--theme-color <color>', 'Theme color (hex)', '#3b82f6')
    .option('--auth-type <type>', 'Auth type (none, bearer, apiKey, oauth2)', 'none')
    .option('--dry-run', 'Preview without creating file', false)
    .action(
      createAsyncCommand(async (specPath, outputPath, options) => {
        const {
          generateDocsFromSpec,
          generateInteractiveDocsHTML,
          openAPIToInteractiveDocs,
          formatInteractiveDocsConfig,
        } = await import('../utils/interactive-docs');

        const outputFile = outputPath || './docs/index.html';

        if (!fs.existsSync(specPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(specPath, 'utf-8');
        const spec = await parseOpenApiSpec(specContent);
        const config = openAPIToInteractiveDocs(spec, options.baseUrl);

        // Apply overrides
        if (options.title) config.title = options.title;
        if (options.description) config.description = options.description;
        if (options.themeColor) config.themeColor = options.themeColor;
        if (options.authType) config.authConfig = { type: options.authType as any };

        console.log(chalk.cyan('\n📘 Interactive Documentation Generation\n'));
        console.log(formatInteractiveDocsConfig(config));

        if (options.dryRun) {
          console.log(chalk.gray('\n--- Preview (first 50 lines) ---\n'));
          const html = generateInteractiveDocsHTML(config);
          console.log(chalk.gray(html.split('\n').slice(0, 50).join('\n')));
          console.log(chalk.yellow('\nDry run - no file written.\n'));
          return;
        }

        await generateDocsFromSpec(specPath, outputFile, options.baseUrl);
        console.log(chalk.green(`\n✓ Documentation generated!`));
        console.log(chalk.gray(`Output: ${outputFile}`));
        console.log(chalk.gray('\nOpen the file in a browser to view the interactive documentation.\n'));
      })
    );

  docsCommand
    .command('serve <spec>')
    .description('Serve interactive documentation with live server')
    .option('--port <port>', 'Server port', '8080')
    .option('--base-url <url>', 'Base URL for API requests', 'http://localhost:3000')
    .option('--open', 'Open browser automatically', false)
    .action(
      createAsyncCommand(async (specPath, options) => {
        const {
          generateInteractiveDocsHTML,
          openAPIToInteractiveDocs,
          formatInteractiveDocsConfig,
        } = await import('../utils/interactive-docs');

        if (!fs.existsSync(specPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(specPath, 'utf-8');
        const spec = await parseOpenApiSpec(specContent);
        const config = openAPIToInteractiveDocs(spec, options.baseUrl);

        console.log(chalk.cyan('\n📘 Interactive Documentation Server\n'));
        console.log(formatInteractiveDocsConfig(config));
        console.log(chalk.yellow(`\n⚠️  Live server not yet implemented.`));
        console.log(chalk.gray(`To serve the documentation, use:\n  npx serve ${path.dirname(specPath)}/docs\n`));
      })
    );

  docsCommand
    .command('preview <spec>')
    .description('Preview documentation configuration')
    .option('--base-url <url>', 'Base URL for API requests', 'http://localhost:3000')
    .action(
      createAsyncCommand(async (specPath, options) => {
        const {
          openAPIToInteractiveDocs,
          formatInteractiveDocsConfig,
        } = await import('../utils/interactive-docs');

        if (!fs.existsSync(specPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(specPath, 'utf-8');
        const spec = await parseOpenApiSpec(specContent);
        const config = openAPIToInteractiveDocs(spec, options.baseUrl);

        console.log(formatInteractiveDocsConfig(config));
        console.log();
      })
    );

  docsCommand
    .command('themes')
    .description('List available theme colors')
    .action(
      createAsyncCommand(async () => {
        const themes = [
          { name: 'Blue', color: '#3b82f6' },
          { name: 'Green', color: '#22c55e' },
          { name: 'Purple', color: '#a855f7' },
          { name: 'Red', color: '#ef4444' },
          { name: 'Orange', color: '#f97316' },
          { name: 'Pink', color: '#ec4899' },
          { name: 'Cyan', color: '#06b6d4' },
          { name: 'Slate', color: '#64748b' },
        ];

        console.log(chalk.cyan('\n🎨 Available Theme Colors\n'));
        console.log(chalk.gray('─'.repeat(40)));
        themes.forEach(t => {
          console.log(`  ${chalk.hex(t.color)(t.color.padEnd(10))}  ${chalk.gray(t.name)}`);
        });
        console.log(chalk.gray('─'.repeat(40)));
        console.log(chalk.gray(`\nUsage: re-shell docs generate spec.yaml --theme-color ${themes[0].color}\n`));
      })
    );

  // --- api gateway ---
  const gatewayCommand = api.command('gateway').description('API gateway integration for all supported backend frameworks');

  gatewayCommand
    .command('generate <type> [output]')
    .description('Generate gateway configuration file')
    .option('--name <name>', 'Gateway name', 'api-gateway')
    .option('--services <services>', 'Services (pipe-separated entries: id;name;url|id;name;url)')
    .option('--routes <routes>', 'Routes (pipe-separated entries: id;path;methods;service|id;path;methods;service)')
    .option('--rate-limit <limit>', 'Enable rate limiting with limit per window')
    .option('--rate-window <seconds>', 'Rate limit window in seconds', '60')
    .option('--cors', 'Enable CORS', false)
    .option('--cors-origins <origins>', 'CORS allowed origins (comma-separated)', '*')
    .option('--auth <type>', 'Authentication type (none, jwt, oauth2, api-key)', 'none')
    .option('--dry-run', 'Preview without creating file', false)
    .action(
      createAsyncCommand(async (type, outputPath, options) => {
        const {
          getGatewayTemplate,
          generateGatewayConfig,
          generateGatewayDockerCompose,
          formatGatewayConfig,
          listGatewayTypes,
        } = await import('../utils/api-gateway');

        const template = getGatewayTemplate(type as any);
        if (!template) {
          console.log(chalk.yellow(`\n❌ Unsupported gateway type: ${type}\n`));
          console.log(chalk.gray('Run "re-shell gateway list" to see supported types.\n'));
          return;
        }

        // Build config
        const config = {
          name: options.name,
          type: type as any,
          services: options.services ? options.services.split('|').map((s: string) => {
            const parts = s.split(';');
            return { id: parts[0], name: parts[1], url: parts[2] };
          }) : [{ id: 'default', name: 'default', url: 'http://localhost:3000' }],
          routes: options.routes ? options.routes.split('|').map((r: string) => {
            const parts = r.split(';');
            return { id: parts[0], path: parts[1], method: parts[2].split(','), service: parts[3] };
          }) : [{ id: 'default-route', path: '/api', method: ['GET', 'POST', 'PUT', 'DELETE'], service: 'default' }],
          rateLimit: options.rateLimit ? { enabled: true, window: parseInt(options.rateWindow), limit: parseInt(options.rateLimit) } : undefined,
          cors: options.cors ? { enabled: true, origins: options.corsOrigins.split(','), methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], headers: ['Content-Type', 'Authorization'], credentials: false, maxAge: 3600 } : undefined,
          auth: { type: options.auth as any },
        };

        console.log(chalk.cyan('\n🚪 API Gateway Configuration\n'));
        console.log(formatGatewayConfig(config));

        const outputFile = outputPath || template.configPath;

        if (options.dryRun) {
          console.log(chalk.gray('\n--- Configuration Preview ---\n'));
          console.log(chalk.gray(generateGatewayConfig(type as any, config)));
          console.log(chalk.yellow('\nDry run - no file written.\n'));
          return;
        }

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, generateGatewayConfig(type as any, config), 'utf-8');

        console.log(chalk.green(`\n✓ Gateway configuration generated!`));
        console.log(chalk.gray(`Output: ${outputFile}`));
        console.log(chalk.gray(`Format: ${template.format}`));
      })
    );

  gatewayCommand
    .command('docker-compose <type> [output]')
    .description('Generate docker-compose file for gateway')
    .action(
      createAsyncCommand(async (type, outputPath, options) => {
        const { getGatewayTemplate } = await import('../utils/api-gateway');

        const template = getGatewayTemplate(type as any);
        if (!template) {
          console.log(chalk.yellow(`\n❌ Unsupported gateway type: ${type}\n`));
          return;
        }

        const { generateGatewayDockerCompose } = await import('../utils/api-gateway');
        const dockerCompose = generateGatewayDockerCompose(type as any);
        const outputFile = outputPath || './docker-compose.yml';

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, dockerCompose, 'utf-8');

        console.log(chalk.cyan('\n🐳 Docker Compose Configuration\n'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(dockerCompose.split('\n').slice(0, 20).join('\n')));
        if (dockerCompose.split('\n').length > 20) {
          console.log(chalk.gray('...'));
        }
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.green(`\n✓ Docker compose file generated!`));
        console.log(chalk.gray(`Output: ${outputFile}\n`));
      })
    );

  gatewayCommand
    .command('list')
    .description('List all supported gateway types')
    .action(
      createAsyncCommand(async () => {
        const { listGatewayTypes } = await import('../utils/api-gateway');

        const types = listGatewayTypes();
        console.log(chalk.cyan('\n🚪 Supported API Gateways\n'));
        console.log(chalk.gray('─'.repeat(60)));
        types.forEach(t => {
          console.log(`${chalk.yellow(t.type.padEnd(20))}  ${chalk.gray(t.description)}`);
        });
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`\nUsage: re-shell gateway generate <type>\n`));
      })
    );

  gatewayCommand
    .command('template <type>')
    .description('Show template for gateway type')
    .action(
      createAsyncCommand(async (type, options) => {
        const { getGatewayTemplate } = await import('../utils/api-gateway');

        const template = getGatewayTemplate(type as any);
        if (!template) {
          console.log(chalk.yellow(`\n❌ Unsupported gateway type: ${type}\n`));
          return;
        }

        console.log(chalk.cyan(`\n🚪 Gateway Template: ${type}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Description:')} ${template.description}`);
        console.log(`${chalk.blue('Config Path:')} ${template.configPath}`);
        console.log(`${chalk.blue('Format:')} ${template.format}`);
        console.log(`${chalk.blue('Docs:')} ${template.docsUrl}`);
        console.log(chalk.gray('─'.repeat(60)));

        // Generate sample config
        const sampleConfig = {
          name: 'sample-gateway',
          type: type as any,
          services: [
            { id: 'user-service', name: 'user-service', url: 'http://localhost:3001' },
            { id: 'order-service', name: 'order-service', url: 'http://localhost:3002' },
          ],
          routes: [
            { id: 'users', path: '/api/users', method: ['GET', 'POST'], service: 'user-service' },
            { id: 'orders', path: '/api/orders', method: ['GET', 'POST'], service: 'order-service' },
          ],
          rateLimit: { enabled: true, window: 60, limit: 100 },
          cors: { enabled: true, origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], headers: ['Content-Type', 'Authorization'], credentials: false, maxAge: 3600 },
          auth: { type: 'none' as any },
        };

        console.log(chalk.gray('\n--- Sample Configuration ---\n'));
        const { generateGatewayConfig } = await import('../utils/api-gateway');
        console.log(chalk.gray(generateGatewayConfig(type as any, sampleConfig).split('\n').slice(0, 40).join('\n')));
      })
    );

  // --- api analytics ---
  const analyticsCommand = api.command('analytics').description('API analytics and monitoring for all backend frameworks');

  analyticsCommand
    .command('generate <provider> <framework> [output]')
    .description('Generate analytics middleware for your backend framework')
    .option('--name <name>', 'Application name', 'api-app')
    .option('--custom-metrics <metrics>', 'Custom metrics (comma-separated: name,type,description|name,type,description)')
    .option('--dashboard', 'Include dashboard configuration', false)
    .option('--alerts', 'Include alert rules', false)
    .action(
      createAsyncCommand(async (provider, framework, outputPath, options) => {
        const {
          generateAnalyticsSetup,
          listAnalyticsProviders,
          listSupportedFrameworks,
          getAnalyticsProvider,
        } = await import('../utils/api-analytics');

        const providers = listAnalyticsProviders();
        const supportedFrameworks = listSupportedFrameworks();

        if (!providers.find(p => p.provider === provider)) {
          console.log(chalk.yellow(`\n❌ Unsupported provider: ${provider}\n`));
          console.log(chalk.gray('Run "re-shell analytics list-providers" to see supported providers.\n'));
          return;
        }

        if (!supportedFrameworks.find(f => f === framework)) {
          console.log(chalk.yellow(`\n❌ Unsupported framework: ${framework}\n`));
          console.log(chalk.gray('Run "re-shell analytics list-frameworks" to see supported frameworks.\n'));
          return;
        }

        const metrics = options.customMetrics ? options.customMetrics.split('|').map((m: string) => {
          const parts = m.split(',');
          return { name: parts[0], type: parts[1], description: parts[2] };
        }) : [];

        const config = {
          name: options.name,
          provider: provider as any,
          framework: framework as any,
          metrics,
          endpoints: [],
          dashboard: options.dashboard,
          alerts: options.alerts ? [{ name: 'HighErrorRate', condition: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.05', threshold: 0.05, window: '5m', notify: [] }] : undefined,
        };

        const setup = generateAnalyticsSetup(config);

        const outputFile = outputPath || `./analytics-${framework}.${provider === 'custom' ? 'ts' : 'ts'}`;

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, setup.middleware, 'utf-8');

        console.log(chalk.cyan('\n📊 API Analytics Configuration\n'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Provider:')} ${provider}`);
        console.log(`${chalk.blue('Framework:')} ${framework}`);
        console.log(`${chalk.blue('Name:')} ${config.name}`);
        console.log(`${chalk.blue('Custom Metrics:')} ${metrics.length}`);
        console.log(`${chalk.blue('Dashboard:')} ${config.dashboard ? 'Yes' : 'No'}`);
        console.log(`${chalk.blue('Alerts:')} ${config.alerts ? 'Yes' : 'No'}`);
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.green(`\n✓ Analytics middleware generated!`));
        console.log(chalk.gray(`Output: ${outputFile}\n`));

        // Generate additional files if requested
        if (setup.prometheusConfig) {
          const prometheusFile = './prometheus.yml';
          await fs.writeFile(prometheusFile, setup.prometheusConfig, 'utf-8');
          console.log(chalk.gray(`  ${chalk.gray('•')} ${prometheusFile}`));
        }

        if (setup.grafanaDashboard) {
          const dashboardFile = './grafana-dashboard.json';
          await fs.writeFile(dashboardFile, setup.grafanaDashboard, 'utf-8');
          console.log(chalk.gray(`  ${chalk.gray('•')} ${dashboardFile}`));
        }

        if (setup.alertRules) {
          const alertsFile = './alerts.yml';
          await fs.writeFile(alertsFile, setup.alertRules, 'utf-8');
          console.log(chalk.gray(`  ${chalk.gray('•')} ${alertsFile}`));
        }

        if (setup.dockerCompose) {
          const composeFile = './docker-compose.yml';
          await fs.writeFile(composeFile, setup.dockerCompose, 'utf-8');
          console.log(chalk.gray(`  ${chalk.gray('•')} ${composeFile}`));
        }

        console.log('');
      })
    );

  analyticsCommand
    .command('docker-compose <provider> [output]')
    .description('Generate docker-compose file for analytics stack')
    .action(
      createAsyncCommand(async (provider, outputPath, options) => {
        const { generateAnalyticsDockerCompose, getAnalyticsProvider } = await import('../utils/api-analytics');

        const template = getAnalyticsProvider(provider as any);
        if (!template) {
          console.log(chalk.yellow(`\n❌ Unsupported provider: ${provider}\n`));
          return;
        }

        const dockerCompose = generateAnalyticsDockerCompose(provider as any);
        const outputFile = outputPath || './docker-compose.yml';

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, dockerCompose, 'utf-8');

        console.log(chalk.cyan('\n🐳 Docker Compose Configuration\n'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(dockerCompose.split('\n').slice(0, 20).join('\n')));
        if (dockerCompose.split('\n').length > 20) {
          console.log(chalk.gray('...'));
        }
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.green(`\n✓ Docker compose file generated!`));
        console.log(chalk.gray(`Output: ${outputFile}\n`));
      })
    );

  analyticsCommand
    .command('list-providers')
    .description('List all supported analytics providers')
    .action(
      createAsyncCommand(async () => {
        const { listAnalyticsProviders } = await import('../utils/api-analytics');

        const providers = listAnalyticsProviders();
        console.log(chalk.cyan('\n📊 Supported Analytics Providers\n'));
        console.log(chalk.gray('─'.repeat(60)));
        providers.forEach(p => {
          console.log(`${chalk.yellow(p.provider.padEnd(20))}  ${chalk.gray(p.description)}`);
        });
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`\nUsage: re-shell analytics generate <provider> <framework>\n`));
      })
    );

  analyticsCommand
    .command('list-frameworks')
    .description('List all supported backend frameworks')
    .action(
      createAsyncCommand(async () => {
        const { listSupportedFrameworks } = await import('../utils/api-analytics');

        const frameworks = listSupportedFrameworks();
        console.log(chalk.cyan('\n🔧 Supported Backend Frameworks\n'));
        console.log(chalk.gray('─'.repeat(60)));
        frameworks.forEach(f => {
          console.log(`  ${chalk.gray('•')} ${chalk.yellow(f)}`);
        });
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`\nUsage: re-shell analytics generate <provider> <framework>\n`));
      })
    );

  analyticsCommand
    .command('template <provider> <framework>')
    .description('Show analytics template for provider and framework')
    .action(
      createAsyncCommand(async (provider, framework, options) => {
        const {
          generateAnalyticsMiddleware,
          getAnalyticsProvider,
          listAnalyticsProviders,
          listSupportedFrameworks,
        } = await import('../utils/api-analytics');

        const providers = listAnalyticsProviders();
        const supportedFrameworks = listSupportedFrameworks();

        if (!providers.find(p => p.provider === provider)) {
          console.log(chalk.yellow(`\n❌ Unsupported provider: ${provider}\n`));
          return;
        }

        if (!supportedFrameworks.find(f => f === framework)) {
          console.log(chalk.yellow(`\n❌ Unsupported framework: ${framework}\n`));
          return;
        }

        const template = getAnalyticsProvider(provider as any);
        console.log(chalk.cyan(`\n📊 Analytics Template: ${provider} + ${framework}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Provider:')} ${template?.description || provider}`);
        console.log(`${chalk.blue('Framework:')} ${framework}`);
        console.log(`${chalk.blue('Format:')} TypeScript/JavaScript`);
        console.log(chalk.gray('─'.repeat(60)));

        const config = {
          name: 'sample-app',
          provider: provider as any,
          framework: framework as any,
          metrics: [
            { name: 'api_requests_total', type: 'counter' as const, description: 'Total API requests' },
            { name: 'api_request_duration', type: 'histogram' as const, description: 'API request duration' },
          ],
          endpoints: [],
        };

        console.log(chalk.gray('\n--- Sample Middleware ---\n'));
        const middleware = generateAnalyticsMiddleware(config);
        console.log(chalk.gray(middleware.split('\n').slice(0, 40).join('\n')));
      })
    );

  // --- api client ---
  const clientCommand = api.command('client').description('Generate type-safe API clients from OpenAPI specifications');

  clientCommand
    .command('generate <spec> [output]')
    .description('Generate type-safe API clients from OpenAPI spec for multiple frameworks')
    .option('--name <name>', 'Client class/service name')
    .option('--base-url <url>', 'Base URL for API requests')
    .option('--fetch', 'Use fetch instead of axios')
    .option('--include-credentials', 'Include credentials in requests')
    .option('--framework <framework>', 'Target framework: typescript, react, vue, angular, svelte', 'typescript')
    .option('--react-query', 'Generate React Query hooks (for react framework)')
    .option('--vue-query', 'Generate Vue Query composables (for vue framework)')
    .option('--pinia', 'Generate Pinia stores (for vue framework)')
    .option('--sveltekit', 'Generate SvelteKit SDK (for svelte framework)')
    .option('--enhanced', 'Generate client with retry, caching, and intelligent error handling')
    .option('--mock', 'Generate mock server alongside the client')
    .action(
      createAsyncCommand(async (specPath, outputPath, options) => {
        const {
          generateClient,
          generateEnhancedClient,
          generateReactQueryHooks,
          generateVueComposables,
          generatePiniaStores,
          generateAngularService,
          generateSvelteStores,
          generateSvelteKitSdk,
          generateMockServer,
          validateSpec,
          listOperations,
        } = await import('../utils/typescript-client');

        // Resolve spec path
        const resolvedSpecPath = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpecPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        // Read and validate spec
        const specContent = await fs.readFile(resolvedSpecPath, 'utf-8');
        let spec;
        try {
          spec = await parseOpenApiSpec(specContent);
        } catch {
          console.log(chalk.yellow(`\n❌ Failed to parse spec file. Please ensure it's valid JSON or YAML.\n`));
          return;
        }

        const validation = validateSpec(spec);
        if (!validation.valid) {
          console.log(chalk.yellow(`\n❌ Invalid OpenAPI spec:\n`));
          validation.errors.forEach(err => console.log(chalk.gray(`  • ${err}`)));
          console.log('');
          return;
        }

        // Determine output path and framework
        const outputFile = outputPath || './api-client.ts';
        const framework = options.framework || 'typescript';
        const clientName = options.name || `${toCamelCase(spec.info.title)}Client`;
        const serviceName = options.name || `${spec.info.title.replace(/[^a-zA-Z0-9]/g, '')}Service`;

        // Generate base client
        const fullOptions = {
          spec,
          clientName: serviceName,
          baseUrl: options.baseUrl,
          useAxios: !options.fetch,
          includeCredentials: options.includeCredentials,
          includeRetry: options.enhanced ? true : false,
          includeCache: options.enhanced ? true : false,
          exportType: 'default' as const,
          emitDeprecatedMethods: false,
          useEnumTypes: false,
        };

        // Use enhanced client if --enhanced flag is set
        const clientCode = options.enhanced
          ? generateEnhancedClient(spec, fullOptions)
          : generateClient(spec, fullOptions);

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, clientCode, 'utf-8');

        const clientType = options.enhanced ? 'Enhanced ' : '';
        console.log(chalk.cyan(`\n🔧 ${clientType}${framework.charAt(0).toUpperCase() + framework.slice(1)} API Client\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Framework:')} ${framework}`);
        console.log(`${chalk.blue('Spec:')} ${specPath}`);
        console.log(`${chalk.blue('Output:')} ${outputFile}`);
        console.log(`${chalk.blue('Client:')} ${serviceName}`);
        console.log(`${chalk.blue('HTTP:')} ${options.fetch ? 'fetch' : 'axios'}`);
        if (options.enhanced) {
          console.log(`${chalk.blue('Features:')} Retry, Caching, Error Handling`);
        }
        console.log(chalk.gray('─'.repeat(60)));

        // Generate framework-specific code
        const generatedFiles: string[] = [outputFile];

        if (framework === 'react' || options.reactQuery) {
          const hooksCode = generateReactQueryHooks(spec, serviceName);
          const hooksFile = outputFile.replace('.ts', '-hooks.ts');
          await fs.writeFile(hooksFile, hooksCode, 'utf-8');
          generatedFiles.push(hooksFile);
          console.log(`\n${chalk.gray('•')} ${hooksFile} (React Query hooks)`);
        }

        if (framework === 'vue' || options.vueQuery) {
          const composablesCode = generateVueComposables(spec, serviceName);
          const composablesFile = outputFile.replace('.ts', '-composables.ts');
          await fs.writeFile(composablesFile, composablesCode, 'utf-8');
          generatedFiles.push(composablesFile);
          console.log(`\n${chalk.gray('•')} ${composablesFile} (Vue composables)`);
        }

        if (framework === 'vue' && options.pinia) {
          const storesCode = generatePiniaStores(spec, serviceName);
          const storesFile = outputFile.replace('.ts', '-stores.ts');
          await fs.writeFile(storesFile, storesCode, 'utf-8');
          generatedFiles.push(storesFile);
          console.log(`\n${chalk.gray('•')} ${storesFile} (Pinia stores)`);
        }

        if (framework === 'angular') {
          const serviceCode = generateAngularService(spec, serviceName);
          const serviceFile = outputFile.replace('.ts', '.service.ts');
          await fs.writeFile(serviceFile, serviceCode, 'utf-8');
          generatedFiles.push(serviceFile);
          console.log(`\n${chalk.gray('•')} ${serviceFile} (Angular service)`);
        }

        if (framework === 'svelte') {
          const storesCode = generateSvelteStores(spec, serviceName);
          const storesFile = outputFile.replace('.ts', '-stores.ts');
          await fs.writeFile(storesFile, storesCode, 'utf-8');
          generatedFiles.push(storesFile);
          console.log(`\n${chalk.gray('•')} ${storesFile} (Svelte stores)`);
        }

        if (framework === 'svelte' && options.sveltekit) {
          const sdkCode = generateSvelteKitSdk(spec, serviceName);
          const sdkFile = outputFile.replace('.ts', '-sdk.ts');
          await fs.writeFile(sdkFile, sdkCode, 'utf-8');
          generatedFiles.push(sdkFile);
          console.log(`\n${chalk.gray('•')} ${sdkFile} (SvelteKit SDK)`);
        }

        // Generate mock server if requested
        if (options.mock) {
          const mockServerCode = generateMockServer(spec, { port: 3001 });
          const mockServerFile = 'mock-server.ts';
          await fs.writeFile(mockServerFile, mockServerCode, 'utf-8');
          generatedFiles.push(mockServerFile);
          console.log(`\n${chalk.gray('•')} ${mockServerFile} (Express mock server)`);

          // Generate package.json for mock server
          const mockPackageJson = {
            name: 'mock-api-server',
            version: '1.0.0',
            scripts: {
              start: 'tsx mock-server.ts',
              dev: 'tsx watch mock-server.ts'
            },
            dependencies: {
              express: '^4.18.0',
              cors: '^2.8.5'
            },
            devDependencies: {
              tsx: '^4.0.0',
              '@types/express': '^4.17.0',
              '@types/cors': '^2.8.0'
            }
          };
          await fs.writeFile('mock-server.package.json', JSON.stringify(mockPackageJson, null, 2), 'utf-8');
          generatedFiles.push('mock-server.package.json');
          console.log(`${chalk.gray('•')} mock-server.package.json`);
        }

        // List operations
        const operations = listOperations(spec);
        console.log(`\n${chalk.blue('Operations:')} ${operations.length}`);

        operations.slice(0, 10).forEach(op => {
          console.log(`  ${chalk.gray('•')} ${chalk.yellow(op.method.padEnd(6))} ${op.path}`);
        });

        if (operations.length > 10) {
          console.log(`  ${chalk.gray(`... and ${operations.length - 10} more`)}`);
        }

        console.log(chalk.green(`\n✓ API client generated! (${generatedFiles.length} files)\n`));
      })
    );

  clientCommand
    .command('list <spec>')
    .description('List all operations in OpenAPI spec')
    .action(
      createAsyncCommand(async (specPath, options) => {
        const { validateSpec, listOperations } = await import('../utils/typescript-client');

        const resolvedSpecPath = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpecPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(resolvedSpecPath, 'utf-8');
        let spec;
        try {
          spec = await parseOpenApiSpec(specContent);
        } catch {
          console.log(chalk.yellow(`\n❌ Failed to parse spec file.\n`));
          return;
        }

        const validation = validateSpec(spec);
        if (!validation.valid) {
          console.log(chalk.yellow(`\n❌ Invalid OpenAPI spec:\n`));
          validation.errors.forEach(err => console.log(chalk.gray(`  • ${err}`)));
          console.log('');
          return;
        }

        const operations = listOperations(spec);

        console.log(chalk.cyan('\n🔧 API Operations\n'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('API:')} ${spec.info.title}`);
        console.log(`${chalk.blue('Version:')} ${spec.info.version}`);
        console.log(`${chalk.blue('Operations:')} ${operations.length}`);
        console.log(chalk.gray('─'.repeat(60)));

        operations.forEach(op => {
          console.log(`  ${chalk.yellow(op.method.padEnd(6))} ${chalk.gray(op.path.padEnd(30))} ${chalk.gray(op.description || '')}`);
        });

        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.gray(`\nUsage: re-shell client generate <spec>\n`));
      })
    );

  clientCommand
    .command('validate <spec>')
    .description('Validate OpenAPI specification')
    .action(
      createAsyncCommand(async (specPath, options) => {
        const { validateSpec } = await import('../utils/typescript-client');

        const resolvedSpecPath = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpecPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(resolvedSpecPath, 'utf-8');
        let spec;
        try {
          spec = await parseOpenApiSpec(specContent);
        } catch {
          console.log(chalk.yellow(`\n❌ Failed to parse spec file.\n`));
          return;
        }

        const validation = validateSpec(spec);

        if (validation.valid) {
          console.log(chalk.cyan('\n✅ OpenAPI Specification Valid\n'));
          console.log(chalk.gray('─'.repeat(60)));
          console.log(`${chalk.blue('API:')} ${spec.info.title}`);
          console.log(`${chalk.blue('Version:')} ${spec.info.version}`);
          console.log(`${chalk.blue('OpenAPI:')} ${spec.openapi || spec.swagger}`);
          console.log(chalk.gray('─'.repeat(60)));
          console.log(chalk.green('\n✓ Spec is valid and ready for client generation.\n'));
        } else {
          console.log(chalk.yellow('\n❌ OpenAPI Specification Invalid\n'));
          console.log(chalk.gray('─'.repeat(60)));
          validation.errors.forEach(err => console.log(chalk.red(`  ✗ ${err}`)));
          console.log(chalk.gray('─'.repeat(60)));
          console.log('');
        }
      })
    );

  clientCommand
    .command('types <spec> [output]')
    .description('Generate only TypeScript types from OpenAPI spec')
    .action(
      createAsyncCommand(async (specPath, outputPath, options) => {
        const { generateInterfaces, validateSpec } = await import('../utils/typescript-client');

        const resolvedSpecPath = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpecPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(resolvedSpecPath, 'utf-8');
        let spec;
        try {
          spec = await parseOpenApiSpec(specContent);
        } catch {
          console.log(chalk.yellow(`\n❌ Failed to parse spec file.\n`));
          return;
        }

        const validation = validateSpec(spec);
        if (!validation.valid) {
          console.log(chalk.yellow(`\n❌ Invalid OpenAPI spec:\n`));
          validation.errors.forEach(err => console.log(chalk.gray(`  • ${err}`)));
          console.log('');
          return;
        }

        const typesCode = generateInterfaces(spec);
        const outputFile = outputPath || './api-types.ts';

        await fs.ensureDir(path.dirname(outputFile));
        await fs.writeFile(outputFile, typesCode, 'utf-8');

        console.log(chalk.cyan('\n📝 TypeScript Types\n'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Spec:')} ${specPath}`);
        console.log(`${chalk.blue('Output:')} ${outputFile}`);
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.green(`\n✓ TypeScript types generated!\n`));
      })
    );

  clientCommand
    .command('sdk <spec> [output]')
    .description('Generate framework-optimized SDK bundles from OpenAPI spec')
    .option('--framework <framework>', 'Target framework: react, vue, angular, svelte, generic', 'generic')
    .option('--bundler <bundler>', 'Bundle configuration: vite, webpack, rollup', 'vite')
    .action(
      createAsyncCommand(async (specPath, outputPath, options) => {
        const { generateFrameworkSdkBundle, generateBundleConfig } = await import('../utils/framework-sdk');
        const { validateSpec, listOperations } = await import('../utils/typescript-client');

        const resolvedSpecPath = path.resolve(specPath);

        if (!fs.existsSync(resolvedSpecPath)) {
          console.log(chalk.yellow(`\n❌ Spec file not found: ${specPath}\n`));
          return;
        }

        const specContent = await fs.readFile(resolvedSpecPath, 'utf-8');
        let spec;
        try {
          spec = await parseOpenApiSpec(specContent);
        } catch {
          console.log(chalk.yellow(`\n❌ Failed to parse spec file.\n`));
          return;
        }

        const validation = validateSpec(spec);
        if (!validation.valid) {
          console.log(chalk.yellow(`\n❌ Invalid OpenAPI spec:\n`));
          validation.errors.forEach(err => console.log(chalk.gray(`  • ${err}`)));
          console.log('');
          return;
        }

        const outputFile = outputPath || './api-sdk.ts';
        await fs.ensureDir(path.dirname(outputFile));

        // Generate framework SDK
        const sdkCode = generateFrameworkSdkBundle(spec, { framework: options.framework as any });
        await fs.writeFile(outputFile, sdkCode, 'utf-8');

        // Generate bundle config
        const bundleConfig = generateBundleConfig(options.bundler as any);
        const configFile = options.bundler === 'webpack' ? 'webpack.config.js' :
                           options.bundler === 'rollup' ? 'rollup.config.js' : 'vite.config.ts';
        await fs.writeFile(configFile, bundleConfig, 'utf-8');

        console.log(chalk.cyan(`\n🚀 Framework-Optimized SDK\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`${chalk.blue('Framework:')} ${options.framework}`);
        console.log(`${chalk.blue('Spec:')} ${specPath}`);
        console.log(`${chalk.blue('Output:')} ${outputFile}`);
        console.log(`${chalk.blue('Config:')} ${configFile}`);
        console.log(chalk.gray('─'.repeat(60)));

        // List operations
        const operations = listOperations(spec);
        console.log(`\n${chalk.blue('Operations:')} ${operations.length}`);

        operations.slice(0, 10).forEach(op => {
          console.log(`  ${chalk.gray('•')} ${chalk.yellow(op.method.padEnd(6))} ${op.path}`);
        });

        if (operations.length > 10) {
          console.log(`  ${chalk.gray(`... and ${operations.length - 10} more`)}`);
        }

        console.log(chalk.green(`\n✓ Framework SDK generated! (2 files)\n`));
      })
    );
}
