import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createMiddlewareChainManager,
  MiddlewareChainManager,
  MiddlewareType,
  MiddlewareRegistration,
  builtinMiddleware
} from '../utils/plugin-command-middleware';
import { createPluginRegistry } from '../utils/plugin-system';

interface MiddlewareCommandOptions {
  verbose?: boolean;
  json?: boolean;
  type?: MiddlewareType;
  plugin?: string;
  active?: boolean;
}

// List registered middleware
export async function listMiddleware(
  options: MiddlewareCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, type, plugin, active } = options;

  try {
    // In a real implementation, this would be injected from the main CLI
    const middlewareManager = createMiddlewareChainManager();
    
    let middlewares = middlewareManager.getMiddlewares();

    // Apply filters
    if (type) {
      middlewares = middlewares.filter(m => m.type === type);
    }

    if (plugin) {
      middlewares = middlewares.filter(m => m.pluginName === plugin);
    }

    if (active !== undefined) {
      middlewares = middlewares.filter(m => m.isActive === active);
    }

    if (json) {
      console.log(JSON.stringify(middlewares, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🔗 Registered Middleware\n'));

    if (middlewares.length === 0) {
      console.log(chalk.yellow('No middleware found matching criteria.'));
      return;
    }

    // Group by type
    const middlewareByType = middlewares.reduce((acc, m) => {
      if (!acc[m.type]) {
        acc[m.type] = [];
      }
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, MiddlewareRegistration[]>);

    Object.entries(middlewareByType).forEach(([type, typeMiddlewares]) => {
      console.log(chalk.blue(`${type} (${typeMiddlewares.length})`));
      
      typeMiddlewares.forEach(m => {
        const statusIcon = m.isActive ? chalk.green('✓') : chalk.red('✗');
        
        console.log(`  ${statusIcon} ${chalk.white(m.id)}`);
        console.log(`    Plugin: ${chalk.gray(m.pluginName)}`);
        console.log(`    Priority: ${m.priority}`);
        
        if (m.options?.cache?.enabled) {
          console.log(`    ${chalk.yellow('📦 Caching enabled')} (TTL: ${m.options.cache.ttl}ms)`);
        }
        
        if (m.options?.rateLimit) {
          console.log(`    ${chalk.red('⏱️ Rate limiting')} (${m.options.rateLimit.maxRequests} req/${m.options.rateLimit.windowMs}ms)`);
        }
        
        if (verbose) {
          if (m.appliesTo) {
            console.log(`    Applies to:`);
            if (m.appliesTo.commands) {
              console.log(`      Commands: ${m.appliesTo.commands.join(', ')}`);
            }
            if (m.appliesTo.plugins) {
              console.log(`      Plugins: ${m.appliesTo.plugins.join(', ')}`);
            }
            if (m.appliesTo.categories) {
              console.log(`      Categories: ${m.appliesTo.categories.join(', ')}`);
            }
          }
          
          if (m.metadata) {
            console.log(`    Metadata: ${JSON.stringify(m.metadata)}`);
          }
        }
        
        console.log('');
      });
    });

    // Summary
    const stats = middlewareManager.getStats();
    console.log(chalk.yellow('Summary:'));
    console.log(`  Total middleware: ${stats.totalMiddlewares}`);
    console.log(`  Active: ${chalk.green(stats.activeMiddlewares)}`);
    console.log(`  Inactive: ${chalk.red(stats.totalMiddlewares - stats.activeMiddlewares)}`);
    
    if (stats.cacheSize > 0) {
      console.log(`  Cache entries: ${stats.cacheSize}`);
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to list middleware: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show middleware statistics
export async function showMiddlewareStats(
  options: MiddlewareCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const middlewareManager = createMiddlewareChainManager();
    const stats = middlewareManager.getStats();

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📊 Middleware Statistics\n'));

    // Overall stats
    console.log(chalk.yellow('Overview:'));
    console.log(`  Total middleware: ${stats.totalMiddlewares}`);
    console.log(`  Active middleware: ${chalk.green(stats.activeMiddlewares)}`);
    console.log(`  Cache size: ${stats.cacheSize}`);
    console.log(`  Rate limiters: ${stats.rateLimiters}`);

    // By type
    console.log(chalk.yellow('\nMiddleware by Type:'));
    Object.entries(stats.byType).forEach(([type, count]) => {
      if ((count as number) > 0) {
        console.log(`  ${type}: ${count}`);
      }
    });

    // By plugin
    if (Object.keys(stats.byPlugin).length > 0) {
      console.log(chalk.yellow('\nMiddleware by Plugin:'));
      Object.entries(stats.byPlugin).forEach(([plugin, count]) => {
        console.log(`  ${plugin}: ${count}`);
      });
    }

    if (verbose) {
      console.log(chalk.yellow('\nMiddleware Types:'));
      Object.values(MiddlewareType).forEach(type => {
        console.log(`  ${type}`);
      });

      console.log(chalk.yellow('\nBuilt-in Middleware:'));
      console.log('  • validation - Schema-based validation');
      console.log('  • authorization - Permission checking');
      console.log('  • rateLimit - Request rate limiting');
      console.log('  • cache - Response caching');
      console.log('  • logger - Command logging');
      console.log('  • transform - Argument/option transformation');
      console.log('  • errorHandler - Error handling');
      console.log('  • timing - Performance timing');
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show middleware statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Test middleware execution
export async function testMiddleware(
  middlewareType: string,
  testData: string,
  options: MiddlewareCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    // Parse test data
    let parsedData: { args?: any; options?: any };
    try {
      parsedData = JSON.parse(testData);
    } catch {
      throw new ValidationError('Test data must be valid JSON');
    }

    const spinner = createSpinner(`Testing ${middlewareType} middleware...`);
    spinner.start();

    // Create test context
    const testContext: any = {
      command: {
        name: 'test-command',
        description: 'Test command'
      },
      plugin: {
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          reshell: {
            permissions: ['filesystem', 'network']
          }
        }
      },
      logger: {
        debug: (msg: string) => verbose && console.log(chalk.gray(`[DEBUG] ${msg}`)),
        info: (msg: string) => console.log(chalk.blue(`[INFO] ${msg}`)),
        warn: (msg: string) => console.log(chalk.yellow(`[WARN] ${msg}`)),
        error: (msg: string) => console.log(chalk.red(`[ERROR] ${msg}`))
      },
      utils: {
        chalk,
        path: require('path')
      }
    };

    // Get middleware factory
    let middleware: any;
    
    switch (middlewareType) {
      case 'validation':
        middleware = builtinMiddleware.validation({
          args: { name: { required: true, type: 'string' } },
          options: { verbose: { type: 'boolean' } }
        });
        break;
      
      case 'authorization':
        middleware = builtinMiddleware.authorization(['filesystem']);
        break;
      
      case 'rateLimit':
        middleware = builtinMiddleware.rateLimit({
          maxRequests: 5,
          windowMs: 60000
        });
        break;
      
      case 'cache':
        middleware = builtinMiddleware.cache({
          ttl: 30000
        });
        break;
      
      case 'logger':
        middleware = builtinMiddleware.logger({ level: 'debug' });
        break;
      
      case 'transform':
        middleware = builtinMiddleware.transform({
          args: (args: any) => ({ ...args, transformed: true })
        });
        break;
      
      case 'timing':
        middleware = builtinMiddleware.timing();
        break;
      
      default:
        throw new ValidationError(`Unknown middleware type: ${middlewareType}`);
    }

    // Execute middleware
    const args = parsedData.args || {};
    const opts = parsedData.options || {};
    let executionComplete = false;

    await middleware(
      args,
      opts,
      testContext,
      async () => {
        executionComplete = true;
        console.log(chalk.green('\n✓ Middleware execution passed'));
      }
    );

    spinner.stop();

    if (verbose) {
      console.log(chalk.yellow('\nExecution details:'));
      console.log(`  Middleware type: ${middlewareType}`);
      console.log(`  Arguments: ${JSON.stringify(args)}`);
      console.log(`  Options: ${JSON.stringify(opts)}`);
      console.log(`  Execution complete: ${executionComplete}`);
    }

  } catch (error) {
    console.log(chalk.red(`\n✗ Middleware execution failed: ${error instanceof Error ? error.message : String(error)}`));
    
    if (verbose) {
      console.log(chalk.red('\nError details:'));
      console.log(error);
    }
  }
}

// Clear middleware cache
export async function clearMiddlewareCache(): Promise<void> {
  try {
    const middlewareManager = createMiddlewareChainManager();
    
    const spinner = createSpinner('Clearing middleware cache...');
    spinner.start();

    middlewareManager.clearCache();
    
    spinner.stop();
    
    console.log(chalk.green('✓ Middleware cache cleared'));

  } catch (error) {
    throw new ValidationError(
      `Failed to clear middleware cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show middleware chain for a command
export async function showMiddlewareChain(
  commandName: string,
  options: MiddlewareCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    console.log(chalk.cyan(`\n🔗 Middleware Chain for '${commandName}'\n`));

    // Show theoretical middleware execution order
    const middlewareTypes = [
      { type: MiddlewareType.PRE_VALIDATION, name: 'Pre-Validation' },
      { type: MiddlewareType.VALIDATION, name: 'Validation' },
      { type: MiddlewareType.AUTHORIZATION, name: 'Authorization' },
      { type: MiddlewareType.RATE_LIMITER, name: 'Rate Limiting' },
      { type: MiddlewareType.CACHE, name: 'Cache Check' },
      { type: MiddlewareType.TRANSFORM, name: 'Transform' },
      { type: MiddlewareType.PRE_EXECUTION, name: 'Pre-Execution' },
      { type: '-- COMMAND EXECUTION --', name: 'Command Handler' },
      { type: MiddlewareType.POST_EXECUTION, name: 'Post-Execution' },
      { type: MiddlewareType.LOGGER, name: 'Logging' },
      { type: MiddlewareType.ERROR_HANDLER, name: 'Error Handling' }
    ];

    if (json) {
      console.log(JSON.stringify(middlewareTypes, null, 2));
      return;
    }

    console.log(chalk.yellow('Execution Order:'));
    middlewareTypes.forEach((mw, index) => {
      if (mw.type === '-- COMMAND EXECUTION --') {
        console.log(chalk.green(`\n    ${mw.name}\n`));
      } else {
        console.log(`  ${index + 1}. ${mw.name} (${mw.type})`);
      }
    });

    if (verbose) {
      console.log(chalk.yellow('\nMiddleware Behavior:'));
      console.log('  • Each middleware can modify args and options');
      console.log('  • Middleware can skip remaining chain');
      console.log('  • Errors stop execution unless skipOnError is set');
      console.log('  • Cache middleware can bypass command execution');
      console.log('  • Rate limiting prevents excessive calls');
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show middleware chain: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Create example middleware
export async function createExampleMiddleware(
  type: string,
  options: MiddlewareCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const examples: Record<string, any> = {
      validation: {
        code: `builtinMiddleware.validation({
  args: {
    name: { required: true, type: 'string' },
    age: { type: 'number', min: 0, max: 120 }
  },
  options: {
    format: { type: 'string', choices: ['json', 'text'] }
  }
})`,
        description: 'Validates command arguments and options against a schema'
      },
      
      authorization: {
        code: `builtinMiddleware.authorization(['filesystem', 'network'])`,
        description: 'Checks if plugin has required permissions'
      },
      
      rateLimit: {
        code: `builtinMiddleware.rateLimit({
  maxRequests: 10,
  windowMs: 60000 // 1 minute
})`,
        description: 'Limits command execution rate'
      },
      
      cache: {
        code: `builtinMiddleware.cache({
  ttl: 300000, // 5 minutes
  key: (args, options) => \`\${args.id}:\${options.format}\`
})`,
        description: 'Caches command results'
      },
      
      logger: {
        code: `builtinMiddleware.logger({
  level: 'info',
  format: 'detailed'
})`,
        description: 'Logs command execution'
      },
      
      transform: {
        code: `builtinMiddleware.transform({
  args: (args) => ({
    ...args,
    name: args.name.toLowerCase()
  }),
  options: (options) => ({
    ...options,
    verbose: options.verbose || false
  })
})`,
        description: 'Transforms arguments and options'
      },
      
      custom: {
        code: `async (args, options, context, next) => {
  // Pre-execution logic
  context.logger.info('Starting custom middleware');
  
  try {
    // Modify args/options if needed
    args.timestamp = Date.now();
    
    // Call next middleware
    await next();
    
    // Post-execution logic
    context.logger.info('Custom middleware completed');
  } catch (error) {
    // Error handling
    context.logger.error(\`Error: \${error.message}\`);
    throw error;
  }
}`,
        description: 'Custom middleware implementation'
      }
    };

    const example = examples[type];
    if (!example) {
      console.log(chalk.red(`Unknown middleware type: ${type}`));
      console.log(chalk.yellow('\nAvailable types:'));
      Object.keys(examples).forEach(t => {
        console.log(`  • ${t}`);
      });
      return;
    }

    console.log(chalk.cyan(`\n📝 Example ${type} Middleware\n`));
    console.log(chalk.yellow('Description:'));
    console.log(`  ${example.description}\n`);
    console.log(chalk.yellow('Code:'));
    console.log(chalk.gray(example.code));

    if (verbose) {
      console.log(chalk.yellow('\nUsage in Plugin:'));
      console.log(chalk.gray(`// In your plugin's command definition
{
  name: 'my-command',
  description: 'My command description',
  middleware: [
    ${example.code.split('\n')[0]}
    // ... rest of the middleware code
  ],
  handler: async (args, options, context) => {
    // Command implementation
  }
}`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to create example middleware: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}