import { BackendFeature } from '../types';

export interface ComposerConfig {
  projectName: string;
  description?: string;
  type?: 'project' | 'library' | 'metapackage' | 'composer-plugin';
  license?: string;
  phpVersion?: string;
  framework?: 'laravel' | 'symfony' | 'slim' | 'codeigniter' | 'none';
  features?: BackendFeature[];
  autoloadPsr4?: Record<string, string>;
  autoloadDevPsr4?: Record<string, string>;
}

export class ComposerGenerator {
  generateComposerJson(config: ComposerConfig): string {
    const {
      projectName,
      description = 'A PHP project',
      type = 'project',
      license = 'MIT',
      phpVersion = '^8.1',
      framework = 'none',
      features = [],
      autoloadPsr4 = { 'App\\': 'src/' },
      autoloadDevPsr4 = { 'Tests\\': 'tests/' }
    } = config;

    const dependencies: Record<string, string> = {
      'php': phpVersion
    };

    const devDependencies: Record<string, string> = {};

    // Framework-specific dependencies
    switch (framework) {
      case 'laravel':
        Object.assign(dependencies, {
          'laravel/framework': '^10.0',
          'laravel/sanctum': '^3.3',
          'laravel/tinker': '^2.8'
        });
        break;
      case 'symfony':
        Object.assign(dependencies, {
          'symfony/console': '^6.4',
          'symfony/dotenv': '^6.4',
          'symfony/flex': '^2.4',
          'symfony/framework-bundle': '^6.4',
          'symfony/runtime': '^6.4',
          'symfony/yaml': '^6.4'
        });
        break;
      case 'slim':
        Object.assign(dependencies, {
          'slim/slim': '^4.12',
          'slim/psr7': '^1.6',
          'php-di/php-di': '^7.0'
        });
        break;
      case 'codeigniter':
        Object.assign(dependencies, {
          'codeigniter4/framework': '^4.4'
        });
        break;
    }

    // Common dependencies
    Object.assign(dependencies, {
      'vlucas/phpdotenv': '^5.6',
      'monolog/monolog': '^3.5',
      'ramsey/uuid': '^4.7',
      'guzzlehttp/guzzle': '^7.8'
    });

    // Feature-specific dependencies
    if (features.includes('database')) {
      Object.assign(dependencies, {
        'doctrine/dbal': '^3.7',
        'doctrine/orm': '^2.17'
      });
    }

    if (features.includes('authentication')) {
      Object.assign(dependencies, {
        'firebase/php-jwt': '^6.10',
        'lcobucci/jwt': '^5.2'
      });
    }

    if (features.includes('validation')) {
      Object.assign(dependencies, {
        'respect/validation': '^2.3',
        'symfony/validator': '^6.4'
      });
    }

    if (features.includes('caching')) {
      Object.assign(dependencies, {
        'symfony/cache': '^6.4',
        'predis/predis': '^2.2'
      });
    }

    if (features.includes('queue')) {
      Object.assign(dependencies, {
        'symfony/messenger': '^6.4',
        'php-amqplib/php-amqplib': '^3.5'
      });
    }

    if (features.includes('email')) {
      Object.assign(dependencies, {
        'symfony/mailer': '^6.4',
        'swiftmailer/swiftmailer': '^6.3'
      });
    }

    // Development dependencies
    Object.assign(devDependencies, {
      'phpunit/phpunit': '^10.5',
      'mockery/mockery': '^1.6',
      'fakerphp/faker': '^1.23',
      'phpstan/phpstan': '^1.10',
      'squizlabs/php_codesniffer': '^3.8',
      'friendsofphp/php-cs-fixer': '^3.45',
      'vimeo/psalm': '^5.18',
      'infection/infection': '^0.27',
      'phpmd/phpmd': '^2.14',
      'sebastian/phpcpd': '^6.0',
      'phpmetrics/phpmetrics': '^2.8'
    });

    const composerJson = {
      name: `re-shell/${projectName}`,
      type,
      description,
      keywords: this.getKeywords(framework, features),
      license,
      require: dependencies,
      'require-dev': devDependencies,
      autoload: {
        'psr-4': autoloadPsr4
      },
      'autoload-dev': {
        'psr-4': autoloadDevPsr4
      },
      scripts: this.getScripts(framework),
      config: {
        'optimize-autoloader': true,
        'preferred-install': 'dist',
        'sort-packages': true,
        'allow-plugins': {
          'php-http/discovery': true,
          'phpstan/extension-installer': true,
          'infection/extension-installer': true
        }
      },
      extra: this.getExtra(framework),
      'minimum-stability': 'stable',
      'prefer-stable': true
    };

    return JSON.stringify(composerJson, null, 2);
  }

  private getKeywords(framework: string, features: BackendFeature[]): string[] {
    const keywords = ['php', 'api', 'rest'];
    
    if (framework !== 'none') {
      keywords.push(framework);
    }

    if (features.includes('microservices')) {
      keywords.push('microservices');
    }

    if (features.includes('graphql')) {
      keywords.push('graphql');
    }

    return keywords;
  }

  private getScripts(framework: string): Record<string, string | string[]> {
    const scripts: Record<string, string | string[]> = {
      'test': 'phpunit',
      'test:coverage': 'phpunit --coverage-html coverage',
      'test:unit': 'phpunit --testsuite unit',
      'test:integration': 'phpunit --testsuite integration',
      'test:mutation': 'infection --min-msi=80 --min-covered-msi=80',
      'analyze': [
        '@analyze:phpstan',
        '@analyze:psalm',
        '@analyze:phpmd'
      ],
      'analyze:phpstan': 'phpstan analyse --memory-limit=2G',
      'analyze:psalm': 'psalm --show-info=true',
      'analyze:phpmd': 'phpmd src text phpmd.xml',
      'cs': 'phpcs',
      'cs:fix': 'php-cs-fixer fix',
      'cs:check': 'php-cs-fixer fix --dry-run --diff',
      'metrics': 'phpmetrics --report-html=metrics src',
      'check-style': 'phpcs -p --standard=PSR12 src tests',
      'fix-style': 'phpcbf -p --standard=PSR12 src tests',
      'quality': [
        '@cs:check',
        '@analyze',
        '@test:coverage'
      ]
    };

    // Framework-specific scripts
    switch (framework) {
      case 'laravel':
        Object.assign(scripts, {
          'post-root-package-install': [
            '@php -r "file_exists(\'.env\') || copy(\'.env.example\', \'.env\');"'
          ],
          'post-create-project-cmd': [
            '@php artisan key:generate --ansi'
          ],
          'post-autoload-dump': [
            'Illuminate\\Foundation\\ComposerScripts::postAutoloadDump',
            '@php artisan package:discover --ansi'
          ]
        });
        break;
      case 'symfony':
        Object.assign(scripts, {
          'auto-scripts': {
            'cache:clear': 'symfony-cmd',
            'assets:install %PUBLIC_DIR%': 'symfony-cmd'
          },
          'post-install-cmd': [
            '@auto-scripts'
          ],
          'post-update-cmd': [
            '@auto-scripts'
          ]
        });
        break;
      case 'codeigniter':
        Object.assign(scripts, {
          'serve': 'php spark serve'
        });
        break;
    }

    return scripts;
  }

  private getExtra(framework: string): Record<string, any> {
    const extra: Record<string, any> = {};

    switch (framework) {
      case 'laravel':
        extra['laravel'] = {
          'dont-discover': []
        };
        break;
      case 'symfony':
        extra['symfony'] = {
          'allow-contrib': false,
          'require': '6.4.*'
        };
        break;
    }

    return extra;
  }

  generateComposerLock(): string {
    return `{
    "_readme": [
        "This file locks the dependencies of your project to a known state",
        "Read more about it at https://getcomposer.org/doc/01-basic-usage.md#installing-dependencies",
        "This file is @generated automatically"
    ],
    "content-hash": "placeholder",
    "packages": [],
    "packages-dev": [],
    "aliases": [],
    "minimum-stability": "stable",
    "stability-flags": [],
    "prefer-stable": true,
    "prefer-lowest": false,
    "platform": {
        "php": "^8.1"
    },
    "platform-dev": [],
    "plugin-api-version": "2.6.0"
}`;
  }

  generateAutoloadFiles(): { path: string; content: string }[] {
    return [
      {
        path: 'composer-autoload.php',
        content: `<?php
/**
 * Custom autoload file for additional functionality
 */

// Register custom error handler
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// Register custom exception handler
set_exception_handler(function ($exception) {
    error_log($exception->getMessage());
    
    if (php_sapi_name() !== 'cli') {
        http_response_code(500);
        echo json_encode([
            'error' => 'Internal Server Error',
            'message' => $exception->getMessage()
        ]);
    } else {
        echo "Error: " . $exception->getMessage() . PHP_EOL;
    }
});

// Load environment variables if .env exists
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv\\\\Dotenv::createImmutable(__DIR__);
    $dotenv->safeLoad();
}

// Define helper functions
if (!function_exists('env')) {
    function env($key, $default = null) {
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        
        if ($value === false) {
            return $default;
        }
        
        switch (strtolower($value)) {
            case 'true':
            case '(true)':
                return true;
            case 'false':
            case '(false)':
                return false;
            case 'empty':
            case '(empty)':
                return '';
            case 'null':
            case '(null)':
                return null;
        }
        
        if (preg_match('/\\\\A(['"])(.*)\\\\1\\\\z/', $value, $matches)) {
            return $matches[2];
        }
        
        return $value;
    }
}

if (!function_exists('dd')) {
    function dd(...$args) {
        foreach ($args as $arg) {
            var_dump($arg);
        }
        die(1);
    }
}

if (!function_exists('dump')) {
    function dump(...$args) {
        foreach ($args as $arg) {
            var_dump($arg);
        }
    }
}`
      },
      {
        path: 'bootstrap/app.php',
        content: `<?php
/**
 * Application bootstrap file
 */

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../composer-autoload.php';

// Initialize application container
$container = new DI\\\\Container();

// Configure error reporting
error_reporting(E_ALL);
ini_set('display_errors', env('APP_DEBUG', false) ? '1' : '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../logs/php-error.log');

// Set timezone
date_default_timezone_set(env('APP_TIMEZONE', 'UTC'));

// Set memory limit
ini_set('memory_limit', env('MEMORY_LIMIT', '256M'));

// Set execution time
set_time_limit(env('MAX_EXECUTION_TIME', 30));

return $container;`
      }
    ];
  }
}

export function generateComposerFiles(config: ComposerConfig): { path: string; content: string }[] {
  const generator = new ComposerGenerator();
  const files: { path: string; content: string }[] = [];

  // Generate composer.json
  files.push({
    path: 'composer.json',
    content: generator.generateComposerJson(config)
  });

  // Generate autoload files
  files.push(...generator.generateAutoloadFiles());

  // Generate additional configuration files
  files.push({
    path: '.gitignore',
    content: `/vendor/
/node_modules/
/.env
/.env.local
/.env.*.local
/composer.lock
/package-lock.json
/yarn.lock
/.phpunit.cache/
/.phpunit.result.cache
/phpunit.xml
/coverage/
/metrics/
/.php-cs-fixer.cache
/.phpstan/
/psalm.xml
/.idea/
/.vscode/
*.log
*.cache
.DS_Store
Thumbs.db`
  });

  files.push({
    path: 'phpstan.neon',
    content: `parameters:
    level: 8
    paths:
        - src
        - tests
    excludePaths:
        - vendor
    treatPhpDocTypesAsCertain: false
    checkGenericClassInNonGenericObjectType: false
    checkMissingIterableValueType: false
    reportUnmatchedIgnoredErrors: false`
  });

  files.push({
    path: '.php-cs-fixer.php',
    content: `<?php

$finder = PhpCsFixer\\\\Finder::create()
    ->in(__DIR__)
    ->exclude(['vendor', 'storage', 'bootstrap/cache'])
    ->notPath('*.blade.php')
    ->notName('*.php')
    ->notName('_ide_helper*');

$config = new PhpCsFixer\\\\Config();

return $config
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'binary_operator_spaces' => [
            'default' => 'single_space',
            'operators' => ['=>' => 'align_single_space_minimal']
        ],
        'blank_line_after_namespace' => true,
        'blank_line_after_opening_tag' => true,
        'blank_line_before_statement' => [
            'statements' => ['return']
        ],
        'cast_spaces' => true,
        'class_attributes_separation' => [
            'elements' => ['method' => 'one']
        ],
        'concat_space' => ['spacing' => 'one'],
        'declare_equal_normalize' => true,
        'function_typehint_space' => true,
        'single_line_comment_style' => ['comment_types' => ['hash']],
        'include' => true,
        'lowercase_cast' => true,
        'lowercase_static_reference' => true,
        'magic_constant_casing' => true,
        'magic_method_casing' => true,
        'method_argument_space' => true,
        'native_function_casing' => true,
        'native_function_type_declaration_casing' => true,
        'no_blank_lines_after_class_opening' => true,
        'no_blank_lines_after_phpdoc' => true,
        'no_empty_phpdoc' => true,
        'no_empty_statement' => true,
        'no_extra_blank_lines' => [
            'tokens' => [
                'curly_brace_block',
                'extra',
                'parenthesis_brace_block',
                'square_brace_block',
                'throw',
                'use']
        ],
        'no_leading_namespace_whitespace' => true,
        'no_mixed_echo_print' => ['use' => 'echo'],
        'no_multiline_whitespace_around_double_arrow' => true,
        'no_short_bool_cast' => true,
        'no_singleline_whitespace_before_semicolons' => true,
        'no_spaces_around_offset' => true,
        'no_trailing_comma_in_singleline_array' => true,
        'no_unneeded_control_parentheses' => true,
        'no_unneeded_curly_braces' => true,
        'no_unneeded_final_method' => true,
        'no_unused_imports' => true,
        'no_whitespace_before_comma_in_array' => true,
        'no_whitespace_in_blank_line' => true,
        'normalize_index_brace' => true,
        'object_operator_without_whitespace' => true,
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'php_unit_fqcn_annotation' => true,
        'phpdoc_align' => ['align' => 'vertical'],
        'phpdoc_annotation_without_dot' => true,
        'phpdoc_indent' => true,
        'phpdoc_no_access' => true,
        'phpdoc_no_alias_tag' => true,
        'phpdoc_no_package' => true,
        'phpdoc_no_useless_inheritdoc' => true,
        'phpdoc_return_self_reference' => true,
        'phpdoc_scalar' => true,
        'phpdoc_separation' => true,
        'phpdoc_single_line_var_spacing' => true,
        'phpdoc_summary' => true,
        'phpdoc_trim' => true,
        'phpdoc_types' => true,
        'phpdoc_types_order' => [
            'null_adjustment' => 'always_last',
            'sort_algorithm' => 'none'
        ],
        'phpdoc_var_without_name' => true,
        'return_type_declaration' => true,
        'semicolon_after_instruction' => true,
        'short_scalar_cast' => true,
        'single_blank_line_before_namespace' => true,
        'single_class_element_per_statement' => true,
        'single_line_comment_spacing' => true,
        'single_quote' => true,
        'space_after_semicolon' => [
            'remove_in_empty_for_expressions' => true
        ],
        'standardize_increment' => true,
        'standardize_not_equals' => true,
        'ternary_operator_spaces' => true,
        'trailing_comma_in_multiline' => ['elements' => ['arrays']],
        'trim_array_spaces' => true,
        'types_spaces' => true,
        'unary_operator_spaces' => true,
        'whitespace_after_comma_in_array' => true])
    ->setFinder($finder);`
  });

  return files;
}