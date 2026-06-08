import chalk from 'chalk';
import { Command } from 'commander';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import {
  createCommandValidator,
  PluginCommandValidator,
  ValidationSchema,
  ValidationRule,
  ParameterTransformation,
  ValidationRuleType,
  TransformationType,
  ValidationSeverity,
  formatValidationResult,
  createValidationSchema
} from '../utils/plugin-command-validation';
import { createPluginCommandRegistry } from '../utils/plugin-command-registry';

interface ValidationCommandOptions {
  verbose?: boolean;
  json?: boolean;
  schema?: string;
  testData?: string;
  dryRun?: boolean;
  commandId?: string;
  strict?: boolean;
}

// Test command validation with sample data
export async function testCommandValidation(
  commandName: string,
  testData: string,
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, dryRun = false, strict = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const validator = createCommandValidator();
    const commands = commandRegistry.getCommands();
    
    const command = commands.find(cmd => 
      cmd.definition.name === commandName || 
      (cmd.definition.aliases && cmd.definition.aliases.includes(commandName))
    );

    if (!command) {
      throw new ValidationError(`Command '${commandName}' not found`);
    }

    // Parse test data
    let parsedTestData: { args?: Record<string, any>; options?: Record<string, any> };
    try {
      parsedTestData = JSON.parse(testData);
    } catch (error) {
      throw new ValidationError(`Invalid test data JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const args = parsedTestData.args || {};
    const cmdOptions = parsedTestData.options || {};

    // Create a basic validation schema for testing
    const schema = createValidationSchema({
      strict,
      arguments: {},
      options: {},
      globalRules: []
    });

    // Register schema for the command
    validator.registerSchema(command.id, schema);

    // Create mock context
    const context = {
      command: command.definition,
      plugin: { manifest: { name: command.pluginName } },
      cli: { program: tempProgram, rootPath: process.cwd(), configPath: '', version: '1.0.0' },
      logger: {
        debug: (msg: string) => console.debug(chalk.gray(msg)),
        info: (msg: string) => console.info(chalk.blue(msg)),
        warn: (msg: string) => console.warn(chalk.yellow(msg)),
        error: (msg: string) => console.error(chalk.red(msg))
      },
      utils: { path: require('path'), chalk, spinner: null }
    } as any;

    const actionText = dryRun ? 'Simulating validation' : 'Validating';
    const spinner = createSpinner(`${actionText} for command '${commandName}'...`);
    spinner.start();

    const result = await validator.validateAndTransform(command.id, args, cmdOptions, context);

    spinner.stop();

    if (json) {
      console.log(JSON.stringify({
        command: commandName,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
        transformedArgs: result.transformedArgs,
        transformedOptions: result.transformedOptions
      }, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n🧪 Validation Test Results for '${commandName}'\n`));

    // Overall result
    const statusIcon = result.valid ? chalk.green('✓') : chalk.red('✗');
    const statusText = result.valid ? 'PASSED' : 'FAILED';
    console.log(`${statusIcon} ${statusText}`);

    // Input data
    console.log(chalk.yellow('\nInput Data:'));
    console.log(`  Arguments: ${JSON.stringify(args)}`);
    console.log(`  Options: ${JSON.stringify(cmdOptions)}`);

    // Validation issues
    if (result.errors.length > 0 || result.warnings.length > 0 || result.info.length > 0) {
      console.log(chalk.yellow('\nValidation Issues:'));
      console.log(formatValidationResult(result));
    } else {
      console.log(chalk.green('\nNo validation issues found.'));
    }

    // Transformed data
    if (verbose) {
      console.log(chalk.yellow('\nTransformed Data:'));
      console.log(`  Arguments: ${JSON.stringify(result.transformedArgs)}`);
      console.log(`  Options: ${JSON.stringify(result.transformedOptions)}`);
    }

    if (!result.valid) {
      console.log(chalk.red(`\n💡 Fix the ${result.errors.length} error(s) above to make the command valid`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to test command validation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Create validation schema for a command
export async function createCommandValidationSchema(
  commandName: string,
  schemaDefinition: string,
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, dryRun = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const validator = createCommandValidator();
    const commands = commandRegistry.getCommands();
    
    const command = commands.find(cmd => 
      cmd.definition.name === commandName || 
      (cmd.definition.aliases && cmd.definition.aliases.includes(commandName))
    );

    if (!command) {
      throw new ValidationError(`Command '${commandName}' not found`);
    }

    // Parse schema definition
    let parsedSchema: ValidationSchema;
    try {
      parsedSchema = JSON.parse(schemaDefinition);
    } catch (error) {
      throw new ValidationError(`Invalid schema JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (dryRun) {
      console.log(chalk.blue('🔍 Schema Validation (Dry Run)'));
      console.log(chalk.yellow('\nSchema would be registered for:'));
      console.log(`  Command: ${commandName}`);
      console.log(`  Plugin: ${command.pluginName}`);
      console.log(`  Arguments: ${Object.keys(parsedSchema.arguments || {}).length}`);
      console.log(`  Options: ${Object.keys(parsedSchema.options || {}).length}`);
      console.log(`  Global rules: ${(parsedSchema.globalRules || []).length}`);
      console.log(`  Transformations: ${(parsedSchema.transformations || []).length}`);
      return;
    }

    // Register the schema
    validator.registerSchema(command.id, parsedSchema);

    console.log(chalk.green(`✓ Created validation schema for '${commandName}'`));

    if (verbose) {
      console.log(chalk.yellow('\nSchema Details:'));
      console.log(`  Strict mode: ${parsedSchema.strict || false}`);
      console.log(`  Allow unknown: ${parsedSchema.allowUnknown !== false}`);
      console.log(`  Fail fast: ${parsedSchema.failFast || false}`);
      
      if (parsedSchema.arguments && Object.keys(parsedSchema.arguments).length > 0) {
        console.log(chalk.yellow('\n  Arguments:'));
        Object.entries(parsedSchema.arguments).forEach(([name, config]) => {
          console.log(`    ${name}: ${config.rules.length} rule(s)`);
        });
      }
      
      if (parsedSchema.options && Object.keys(parsedSchema.options).length > 0) {
        console.log(chalk.yellow('\n  Options:'));
        Object.entries(parsedSchema.options).forEach(([name, config]) => {
          console.log(`    ${name}: ${config.rules.length} rule(s)`);
        });
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to create validation schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// List available validation rules
export async function listValidationRules(
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const validator = createCommandValidator();
    const builtInRules = validator.getBuiltInRules();

    const ruleDescriptions = {
      required: 'Ensures field has a value (not undefined, null, or empty)',
      type: 'Validates field type (string, number, boolean, array, object)',
      minLength: 'Ensures string field meets minimum length requirement',
      maxLength: 'Ensures string field does not exceed maximum length',
      min: 'Ensures numeric field meets minimum value requirement',
      max: 'Ensures numeric field does not exceed maximum value',
      pattern: 'Validates field against regular expression pattern',
      enum: 'Ensures field value is one of specified allowed values',
      email: 'Validates field as properly formatted email address',
      url: 'Validates field as properly formatted URL',
      path: 'Validates field as file system path, optionally checking existence',
      json: 'Validates field as valid JSON string',
      custom: 'Uses custom validation function'
    };

    if (json) {
      const rules = Object.keys(builtInRules).map(name => ({
        name,
        description: ruleDescriptions[name as keyof typeof ruleDescriptions] || 'No description available',
        type: ValidationRuleType.CUSTOM
      }));
      console.log(JSON.stringify(rules, null, 2));
      return;
    }

    console.log(chalk.cyan('📋 Available Validation Rules\n'));

    Object.keys(builtInRules).forEach(ruleName => {
      const description = ruleDescriptions[ruleName as keyof typeof ruleDescriptions] || 'No description available';
      
      console.log(chalk.yellow(ruleName));
      console.log(`  ${description}`);
      
      if (verbose) {
        // Show example usage
        switch (ruleName) {
          case 'required':
            console.log(chalk.gray('  Example: rules.required("Field is required")'));
            break;
          case 'type':
            console.log(chalk.gray('  Example: rules.type("string", "Must be a string")'));
            break;
          case 'minLength':
            console.log(chalk.gray('  Example: rules.minLength(3, "Must be at least 3 characters")'));
            break;
          case 'pattern':
            console.log(chalk.gray('  Example: rules.pattern(/^[a-z]+$/, "Must be lowercase letters only")'));
            break;
          case 'enum':
            console.log(chalk.gray('  Example: rules.enum(["red", "green", "blue"], "Must be a valid color")'));
            break;
        }
      }
      
      console.log('');
    });

    console.log(chalk.gray(`Total: ${Object.keys(builtInRules).length} built-in rule(s)`));

  } catch (error) {
    throw new ValidationError(
      `Failed to list validation rules: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// List available transformations
export async function listTransformations(
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const validator = createCommandValidator();
    const builtInTransformations = validator.getBuiltInTransformations();

    const transformationDescriptions = {
      trim: 'Removes whitespace from start and/or end of string',
      lowercase: 'Converts string to lowercase',
      uppercase: 'Converts string to uppercase',
      camelCase: 'Converts string to camelCase format',
      kebabCase: 'Converts string to kebab-case format',
      snakeCase: 'Converts string to snake_case format',
      parseNumber: 'Converts string to number (integer or float)',
      parseBoolean: 'Converts string to boolean value',
      parseJSON: 'Parses JSON string to object',
      expandPath: 'Expands path shortcuts (~ to home directory)',
      resolvePath: 'Resolves path to absolute path',
      sanitizeHtml: 'Removes HTML tags from string',
      normalizeUrl: 'Normalizes URL format',
      custom: 'Uses custom transformation function'
    };

    if (json) {
      const transformations = Object.keys(builtInTransformations).map(name => ({
        name,
        description: transformationDescriptions[name as keyof typeof transformationDescriptions] || 'No description available',
        type: TransformationType.CUSTOM
      }));
      console.log(JSON.stringify(transformations, null, 2));
      return;
    }

    console.log(chalk.cyan('🔄 Available Parameter Transformations\n'));

    Object.keys(builtInTransformations).forEach(transformationName => {
      const description = transformationDescriptions[transformationName as keyof typeof transformationDescriptions] || 'No description available';
      
      console.log(chalk.yellow(transformationName));
      console.log(`  ${description}`);
      
      if (verbose) {
        // Show example usage
        switch (transformationName) {
          case 'trim':
            console.log(chalk.gray('  Example: transforms.trim({ start: true, end: true })'));
            break;
          case 'parseNumber':
            console.log(chalk.gray('  Example: transforms.parseNumber({ float: true, base: 10 })'));
            break;
          case 'expandPath':
            console.log(chalk.gray('  Example: transforms.expandPath({ relative: "/home/user" })'));
            break;
        }
      }
      
      console.log('');
    });

    console.log(chalk.gray(`Total: ${Object.keys(builtInTransformations).length} built-in transformation(s)`));

  } catch (error) {
    throw new ValidationError(
      `Failed to list transformations: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show validation schema for a command
export async function showCommandValidationSchema(
  commandName: string,
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const validator = createCommandValidator();
    const commands = commandRegistry.getCommands();
    
    const command = commands.find(cmd => 
      cmd.definition.name === commandName || 
      (cmd.definition.aliases && cmd.definition.aliases.includes(commandName))
    );

    if (!command) {
      throw new ValidationError(`Command '${commandName}' not found`);
    }

    // For now, show that no schema is registered (would be expanded when schemas are actually stored)
    const mockSchema = {
      commandId: command.id,
      commandName: command.definition.name,
      plugin: command.pluginName,
      hasSchema: false,
      arguments: {},
      options: {},
      globalRules: [],
      transformations: [],
      strict: false,
      allowUnknown: true,
      failFast: false
    };

    if (json) {
      console.log(JSON.stringify(mockSchema, null, 2));
      return;
    }

    console.log(chalk.cyan(`📝 Validation Schema for '${commandName}'\n`));

    console.log(chalk.yellow('Command Information:'));
    console.log(`  Name: ${command.definition.name}`);
    console.log(`  Plugin: ${command.pluginName}`);
    console.log(`  Description: ${command.definition.description}`);
    console.log(`  ID: ${command.id}`);

    console.log(chalk.yellow('\nSchema Status:'));
    const statusIcon = mockSchema.hasSchema ? chalk.green('✓') : chalk.red('✗');
    const statusText = mockSchema.hasSchema ? 'Registered' : 'Not registered';
    console.log(`  ${statusIcon} ${statusText}`);

    if (!mockSchema.hasSchema) {
      console.log(chalk.blue('\n💡 No validation schema registered for this command'));
      console.log(chalk.gray('Use "plugin create-schema" to create one'));
      return;
    }

    if (verbose) {
      console.log(chalk.yellow('\nSchema Configuration:'));
      console.log(`  Strict mode: ${mockSchema.strict}`);
      console.log(`  Allow unknown: ${mockSchema.allowUnknown}`);
      console.log(`  Fail fast: ${mockSchema.failFast}`);
      console.log(`  Arguments: ${Object.keys(mockSchema.arguments).length}`);
      console.log(`  Options: ${Object.keys(mockSchema.options).length}`);
      console.log(`  Global rules: ${mockSchema.globalRules.length}`);
      console.log(`  Transformations: ${mockSchema.transformations.length}`);
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show validation schema: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show validation statistics
export async function showValidationStats(
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const validator = createCommandValidator();
    const stats = validator.getValidationStats();

    if (json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(chalk.cyan('📊 Validation System Statistics\n'));

    console.log(chalk.yellow('Overview:'));
    console.log(`  Total schemas: ${stats.totalSchemas}`);
    console.log(`  Cache size: ${stats.cacheSize}`);
    console.log(`  Cache hit rate: ${Math.round(stats.cacheHitRate * 100)}%`);

    if (verbose) {
      console.log(chalk.yellow('\nPerformance:'));
      console.log(`  Total validations: ${stats.validationCount}`);
      console.log(`  Total errors: ${stats.errorCount}`);
      console.log(`  Total warnings: ${stats.warningCount}`);
      console.log(`  Average validation time: ${stats.averageValidationTime}ms`);

      console.log(chalk.yellow('\nRule Types:'));
      Object.values(ValidationRuleType).forEach(ruleType => {
        console.log(`  ${ruleType}: Available`);
      });

      console.log(chalk.yellow('\nTransformation Types:'));
      Object.values(TransformationType).forEach(transformType => {
        console.log(`  ${transformType}: Available`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show validation statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Generate validation schema template
export async function generateValidationTemplate(
  commandName: string,
  options: ValidationCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {

    const tempProgram = new Command();
    const commandRegistry = createPluginCommandRegistry(tempProgram);
    await commandRegistry.initialize();

    const commands = commandRegistry.getCommands();
    
    const command = commands.find(cmd => 
      cmd.definition.name === commandName || 
      (cmd.definition.aliases && cmd.definition.aliases.includes(commandName))
    );

    if (!command) {
      throw new ValidationError(`Command '${commandName}' not found`);
    }

    // Generate template based on command definition
    const template: ValidationSchema = {
      strict: false,
      allowUnknown: true,
      failFast: false,
      arguments: {},
      options: {},
      globalRules: [],
      transformations: []
    };

    // Add argument schemas
    if (command.definition.arguments) {
      command.definition.arguments.forEach(arg => {
        template.arguments![arg.name] = {
          rules: [
            ...(arg.required ? [{ 
              type: ValidationRuleType.REQUIRED,
              severity: ValidationSeverity.ERROR,
              message: `${arg.name} is required`
            } as ValidationRule] : []),
            ...(arg.type ? [{
              type: ValidationRuleType.TYPE,
              severity: ValidationSeverity.ERROR,
              message: `${arg.name} must be of type ${arg.type}`
            } as ValidationRule] : [])
          ],
          transformations: []
        };
      });
    }

    // Add option schemas
    if (command.definition.options) {
      command.definition.options.forEach(opt => {
        const optionName = opt.flag.replace(/^-+/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        template.options![optionName] = {
          rules: [
            ...(opt.required ? [{
              type: ValidationRuleType.REQUIRED,
              severity: ValidationSeverity.ERROR,
              message: `${opt.flag} is required`
            } as ValidationRule] : []),
            ...(opt.type ? [{
              type: ValidationRuleType.TYPE,
              severity: ValidationSeverity.ERROR,
              message: `${opt.flag} must be of type ${opt.type}`
            } as ValidationRule] : [])
          ],
          transformations: []
        };
      });
    }

    if (json) {
      console.log(JSON.stringify(template, null, 2));
      return;
    }

    console.log(chalk.cyan(`📄 Validation Schema Template for '${commandName}'\n`));

    console.log(chalk.yellow('Generated template:'));
    console.log('```json');
    console.log(JSON.stringify(template, null, 2));
    console.log('```');

    if (verbose) {
      console.log(chalk.blue('\n💡 Usage:'));
      console.log('1. Copy the template above');
      console.log('2. Customize rules and transformations as needed');
      console.log('3. Use "plugin create-schema" to register the schema');
      
      console.log(chalk.blue('\n📖 Available rule types:'));
      console.log('  - required, type, minLength, maxLength, min, max');
      console.log('  - pattern, enum, email, url, path, json, custom');
      
      console.log(chalk.blue('\n🔄 Available transformations:'));
      console.log('  - trim, lowercase, uppercase, camelCase, kebabCase');
      console.log('  - parseNumber, parseBoolean, parseJSON, expandPath');
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to generate validation template: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}