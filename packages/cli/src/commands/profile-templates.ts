import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { EnvironmentProfile, ProfileConfig } from './profile';

/**
 * Profile templates for common deployment scenarios
 * Pre-configured profiles that can be applied instantly
 */

export interface ProfileTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'staging' | 'production' | 'testing' | 'custom';
  framework?: string;
  profile: EnvironmentProfile;
}

/**
 * Built-in profile templates
 */
export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  // Development templates
  {
    id: 'dev-local',
    name: 'Local Development',
    description: 'Optimized for local development with fast builds and HMR',
    category: 'development',
    profile: {
      name: 'dev-local',
      environment: 'development',
      config: {
        dev: {
          port: 3000,
          host: 'localhost',
          hmr: true,
          cors: true,
        },
        build: {
          target: 'esnext',
          optimize: false,
          sourcemap: true,
          minify: false,
        },
        env: {
          NODE_ENV: 'development',
          LOG_LEVEL: 'debug',
          HOT_RELOAD: 'true',
        },
      },
    },
  },
  {
    id: 'dev-docker',
    name: 'Docker Development',
    description: 'Development environment with Docker containers',
    category: 'development',
    profile: {
      name: 'dev-docker',
      environment: 'development',
      config: {
        dev: {
          port: 3000,
          host: '0.0.0.0',
          hmr: true,
          cors: true,
        },
        build: {
          target: 'es2020',
          optimize: false,
          sourcemap: true,
          minify: false,
        },
        env: {
          NODE_ENV: 'development',
          DOCKER: 'true',
          LOG_LEVEL: 'debug',
        },
      },
    },
  },

  // Staging templates
  {
    id: 'staging-standard',
    name: 'Standard Staging',
    description: 'Production-like environment for testing before deployment',
    category: 'staging',
    profile: {
      name: 'staging-standard',
      environment: 'staging',
      config: {
        dev: {
          port: 3001,
          host: '0.0.0.0',
          hmr: false,
          cors: true,
        },
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: true,
          minify: true,
        },
        env: {
          NODE_ENV: 'staging',
          LOG_LEVEL: 'info',
          API_URL: 'https://staging-api.example.com',
        },
      },
    },
  },
  {
    id: 'staging-minimal',
    name: 'Minimal Staging',
    description: 'Lightweight staging environment for quick testing',
    category: 'staging',
    profile: {
      name: 'staging-minimal',
      environment: 'staging',
      config: {
        dev: {
          port: 3001,
          hmr: false,
          cors: true,
        },
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: false,
          minify: true,
        },
        env: {
          NODE_ENV: 'staging',
          LOG_LEVEL: 'warn',
        },
      },
    },
  },

  // Production templates
  {
    id: 'prod-standard',
    name: 'Standard Production',
    description: 'Production-ready configuration with optimizations',
    category: 'production',
    profile: {
      name: 'prod-standard',
      environment: 'production',
      config: {
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: false,
          minify: true,
        },
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'error',
          CACHE: 'true',
        },
      },
    },
  },
  {
    id: 'prod-cdn',
    name: 'Production with CDN',
    description: 'Production configuration optimized for CDN delivery',
    category: 'production',
    profile: {
      name: 'prod-cdn',
      environment: 'production',
      config: {
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: false,
          minify: true,
        },
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'error',
          CDN_URL: 'https://cdn.example.com',
          CACHE_STATIC: 'true',
        },
      },
    },
  },
  {
    id: 'prod-serverless',
    name: 'Serverless Production',
    description: 'Optimized for serverless platforms (AWS Lambda, Vercel, etc.)',
    category: 'production',
    profile: {
      name: 'prod-serverless',
      environment: 'production',
      config: {
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: false,
          minify: true,
        },
        env: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
          SERVERLESS: 'true',
        },
      },
    },
  },

  // Framework-specific templates
  {
    id: 'react-dev',
    name: 'React Development',
    description: 'React development with fast refresh',
    category: 'development',
    framework: 'react',
    profile: {
      name: 'react-dev',
      environment: 'development',
      framework: 'react',
      config: {
        dev: {
          port: 3000,
          host: 'localhost',
          hmr: true,
          cors: true,
        },
        build: {
          target: 'esnext',
          optimize: false,
          sourcemap: true,
          minify: false,
        },
        env: {
          NODE_ENV: 'development',
          FAST_REFRESH: 'true',
        },
      },
    },
  },
  {
    id: 'react-prod',
    name: 'React Production',
    description: 'Optimized React production build',
    category: 'production',
    framework: 'react',
    profile: {
      name: 'react-prod',
      environment: 'production',
      framework: 'react',
      config: {
        build: {
          target: 'es2020',
          optimize: true,
          sourcemap: false,
          minify: true,
        },
        env: {
          NODE_ENV: 'production',
        },
      },
    },
  },
  {
    id: 'nextjs-dev',
    name: 'Next.js Development',
    description: 'Next.js with all dev features enabled',
    category: 'development',
    framework: 'nextjs',
    profile: {
      name: 'nextjs-dev',
      environment: 'development',
      framework: 'nextjs',
      config: {
        dev: {
          port: 3000,
          host: 'localhost',
          hmr: true,
          cors: true,
        },
        build: {
          target: 'es2020',
          optimize: false,
          sourcemap: true,
          minify: false,
        },
        env: {
          NODE_ENV: 'development',
          NEXT_TELEMETRY_DISABLED: '1',
        },
      },
    },
  },
  {
    id: 'nestjs-dev',
    name: 'NestJS Development',
    description: 'NestJS API development environment',
    category: 'development',
    framework: 'nestjs',
    profile: {
      name: 'nestjs-dev',
      environment: 'development',
      framework: 'nestjs',
      config: {
        dev: {
          port: 3000,
          host: 'localhost',
          hmr: true,
          cors: true,
        },
        build: {
          target: 'es2020',
          sourcemap: true,
        },
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
        },
      },
    },
  },

  // Testing templates
  {
    id: 'test-unit',
    name: 'Unit Testing',
    description: 'Configuration for unit test execution',
    category: 'testing',
    profile: {
      name: 'test-unit',
      environment: 'custom',
      config: {
        build: {
          target: 'esnext',
          optimize: false,
          sourcemap: true,
        },
        env: {
          NODE_ENV: 'test',
          LOG_LEVEL: 'error',
        },
      },
    },
  },
  {
    id: 'test-e2e',
    name: 'E2E Testing',
    description: 'Configuration for end-to-end testing',
    category: 'testing',
    profile: {
      name: 'test-e2e',
      environment: 'custom',
      config: {
        dev: {
          port: 3000,
          hmr: false,
        },
        build: {
          target: 'es2020',
          optimize: false,
          sourcemap: true,
        },
        env: {
          NODE_ENV: 'test',
          HEADLESS: 'true',
        },
      },
    },
  },
];

/**
 * List all available templates
 */
export function listTemplates(): void {
  console.log(chalk.cyan.bold('\n📋 Available Profile Templates\n'));

  const categories = Array.from(new Set(PROFILE_TEMPLATES.map(t => t.category)));

  for (const category of categories) {
    console.log(chalk.bold(chalk.yellow(`\n${category.toUpperCase()}\n`)));

    const templates = PROFILE_TEMPLATES.filter(t => t.category === category);
    for (const template of templates) {
      const framework = template.framework ? chalk.gray(`(${template.framework})`) : '';
      console.log(chalk.white(`  ${template.id}`));
      console.log(chalk.gray(`    ${template.name} ${framework}`));
      console.log(chalk.gray(`    ${template.description}`));
    }
  }

  console.log(chalk.gray('\nUse: re-shell profile template apply <id> [name]\n'));
}

/**
 * Get template by ID
 */
export function getTemplate(id: string): ProfileTemplate | null {
  return PROFILE_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Apply template to create a new profile
 */
export async function applyTemplate(
  templateId: string,
  profileName: string,
  options: {
    overwrite?: boolean;
  } = {}
): Promise<void> {
  const template = getTemplate(templateId);

  if (!template) {
    console.log(chalk.red(`\n✗ Template "${templateId}" not found\n`));
    console.log(chalk.gray('Run "re-shell profile template list" to see available templates\n'));
    return;
  }

  const vaultPath = path.join(process.cwd(), 're-shell.profiles.yaml');

  // Load existing profiles
  let profiles: Record<string, any> = {};
  if (await fs.pathExists(vaultPath)) {
    const content = await fs.readFile(vaultPath, 'utf8');
    const yaml = await import('yaml');
    profiles = yaml.parse(content) || {};
  }

  // Check if profile exists
  if (profiles.profiles && profiles.profiles[profileName] && !options.overwrite) {
    console.log(chalk.yellow(`\n⚠ Profile "${profileName}" already exists\n`));
    console.log(chalk.gray('Use --overwrite to replace it\n'));
    return;
  }

  // Create profile from template
  const newProfile = {
    ...template.profile,
    name: profileName,
    description: `Created from template: ${template.name}`,
  };

  // Save profile
  if (!profiles.profiles) {
    profiles.profiles = {};
  }
  profiles.profiles[profileName] = newProfile;

  const yaml = await import('yaml');
  await fs.writeFile(vaultPath, yaml.stringify(profiles), 'utf8');

  console.log(chalk.green(`\n✓ Profile "${profileName}" created from template "${template.name}"\n`));
  console.log(chalk.gray(`Category: ${template.category}`));
  console.log(chalk.gray(`Environment: ${template.profile.environment}`));
  if (template.framework) {
    console.log(chalk.gray(`Framework: ${template.framework}`));
  }
  console.log(chalk.gray(`\nActivate with: re-shell profile activate ${profileName}\n`));
}

/**
 * Show template details
 */
export function showTemplate(id: string): void {
  const template = getTemplate(id);

  if (!template) {
    console.log(chalk.red(`\n✗ Template "${id}" not found\n`));
    return;
  }

  console.log(chalk.cyan.bold(`\n📄 Template: ${template.name}\n`));
  console.log(chalk.gray(`ID: ${template.id}`));
  console.log(chalk.gray(`Description: ${template.description}`));
  console.log(chalk.gray(`Category: ${template.category}`));
  if (template.framework) {
    console.log(chalk.gray(`Framework: ${template.framework}`));
  }
  console.log(chalk.gray(`Environment: ${template.profile.environment}`));

  if (template.profile.config.build) {
    console.log(chalk.cyan('\nBuild Configuration:'));
    console.log(chalk.gray(`  Target: ${template.profile.config.build.target}`));
    console.log(chalk.gray(`  Optimize: ${template.profile.config.build.optimize}`));
    console.log(chalk.gray(`  Sourcemap: ${template.profile.config.build.sourcemap}`));
    console.log(chalk.gray(`  Minify: ${template.profile.config.build.minify}`));
  }

  if (template.profile.config.dev) {
    console.log(chalk.cyan('\nDevelopment Server:'));
    console.log(chalk.gray(`  Port: ${template.profile.config.dev.port}`));
    console.log(chalk.gray(`  Host: ${template.profile.config.dev.host}`));
    console.log(chalk.gray(`  HMR: ${template.profile.config.dev.hmr}`));
    console.log(chalk.gray(`  CORS: ${template.profile.config.dev.cors}`));
  }

  if (template.profile.config.env) {
    console.log(chalk.cyan('\nEnvironment Variables:'));
    Object.entries(template.profile.config.env).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}=${value}`));
    });
  }

  console.log('');
}

/**
 * Search templates by keyword
 */
export function searchTemplates(keyword: string): void {
  const lowerKeyword = keyword.toLowerCase();
  const matches = PROFILE_TEMPLATES.filter(t =>
    t.id.toLowerCase().includes(lowerKeyword) ||
    t.name.toLowerCase().includes(lowerKeyword) ||
    t.description.toLowerCase().includes(lowerKeyword) ||
    t.category.toLowerCase().includes(lowerKeyword) ||
    (t.framework && t.framework.toLowerCase().includes(lowerKeyword))
  );

  if (matches.length === 0) {
    console.log(chalk.yellow(`\n⚠ No templates found matching "${keyword}"\n`));
    return;
  }

  console.log(chalk.cyan.bold(`\n🔍 Templates matching "${keyword}"\n`));

  for (const template of matches) {
    const framework = template.framework ? chalk.gray(`(${template.framework})`) : '';
    console.log(chalk.white(`  ${template.id}: ${template.name} ${framework}`));
    console.log(chalk.gray(`    ${template.description}\n`));
  }
}
