import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { findMonorepoRoot } from '../utils/monorepo';

interface GenerateOptions {
  spinner?: any;
  verbose?: boolean;
  type?: 'component' | 'hook' | 'service' | 'test' | 'config' | 'documentation' | 'backend';
  framework?: 'react' | 'vue' | 'svelte' | 'angular' | 'express' | 'fastapi' | 'django' | 'flask' | 'tornado' | 'sanic' | 'laravel' | 'symfony' | 'slim' | 'codeigniter';
  language?: 'typescript' | 'python' | 'php';
  features?: string[];
  workspace?: string;
  template?: string;
  export?: boolean;
  port?: string;
}

interface ComponentTemplate {
  name: string;
  files: { path: string; content: string }[];
  dependencies?: string[];
}

export async function generateCode(name: string, options: GenerateOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    if (options.spinner) {
      options.spinner.text = `Generating ${options.type || 'component'}...`;
    }

    const generator = getGenerator(options.type || 'component');
    await generator(monorepoRoot, name, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green(`${options.type || 'Component'} "${name}" generated successfully!`));
    }

    console.log('\n' + chalk.bold('Generated:'));
    console.log(`  Type: ${options.type || 'component'}`);
    console.log(`  Name: ${name}`);
    console.log(`  Framework: ${options.framework || 'react'}`);

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Code generation failed'));
    }
    throw error;
  }
}

export async function generateTests(workspace: string, options: GenerateOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo');
    }

    if (options.spinner) {
      options.spinner.text = 'Generating tests...';
    }

    const workspacePath = path.join(monorepoRoot, workspace);
    if (!await fs.pathExists(workspacePath)) {
      throw new Error(`Workspace not found: ${workspace}`);
    }

    await generateTestSuite(workspacePath, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Test suite generated successfully!'));
    }

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Test generation failed'));
    }
    throw error;
  }
}

export async function generateDocumentation(options: GenerateOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo');
    }

    if (options.spinner) {
      options.spinner.text = 'Generating documentation...';
    }

    await generateProjectDocs(monorepoRoot, options);
    await generateAPIDocumentation(monorepoRoot, options);
    await generateReadme(monorepoRoot, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Documentation generated successfully!'));
    }

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Documentation generation failed'));
    }
    throw error;
  }
}

function getGenerator(type: string) {
  const generators = {
    component: generateComponent,
    hook: generateHook,
    service: generateService,
    test: generateTestFile,
    config: generateConfig,
    documentation: generateDocs,
    backend: generateBackend
  };

  const generator = generators[type as keyof typeof generators];
  if (!generator) {
    throw new Error(`Unknown generator type: ${type}`);
  }

  return generator;
}

async function generateComponent(monorepoRoot: string, name: string, options: GenerateOptions) {
  const framework = options.framework || 'react';
  const workspace = options.workspace || findBestWorkspace(monorepoRoot, 'component');

  if (!workspace) {
    console.error('No workspace found. Run "re-shell create" to create an app first, or use --workspace to specify a target directory.');
    process.exit(1);
  }

  const workspacePath = path.join(monorepoRoot, workspace);

  if (!await fs.pathExists(workspacePath)) {
    throw new Error(`Workspace not found: ${workspace}. Use --workspace to specify an existing workspace.`);
  }

  const template = getComponentTemplate(name, framework, options);
  
  for (const file of template.files) {
    const filePath = path.join(workspacePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
    
    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${file.path}`));
    }
  }

  // Update exports if requested
  if (options.export) {
    await updateExports(workspacePath, name, template);
  }
}

async function generateHook(monorepoRoot: string, name: string, options: GenerateOptions) {
  const framework = options.framework || 'react';

  if (framework !== 'react') {
    throw new Error('Hooks are currently only supported for React');
  }

  const workspace = options.workspace || findBestWorkspace(monorepoRoot, 'hook');

  if (!workspace) {
    console.error('No workspace found. Run "re-shell create" to create an app first, or use --workspace to specify a target directory.');
    process.exit(1);
  }

  const workspacePath = path.join(monorepoRoot, workspace);

  const hookName = name.startsWith('use') ? name : `use${name.charAt(0).toUpperCase() + name.slice(1)}`;
  
  const hookContent = `import { useState, useEffect } from 'react';

export interface ${hookName.charAt(3).toUpperCase() + hookName.slice(4)}Options {
  // Add your options here
}

export function ${hookName}(options?: ${hookName.charAt(3).toUpperCase() + hookName.slice(4)}Options) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Implement your hook logic here
    setLoading(true);
    
    // Example async operation
    const performOperation = async () => {
      try {
        // Your logic here
        setState(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    performOperation();
  }, []);

  return {
    state,
    loading,
    error,
    // Add your return values here
  };
}
`;

  const testContent = `import { renderHook } from '@testing-library/react';
import { ${hookName} } from './${hookName}';

describe('${hookName}', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => ${hookName}());
    
    expect(result.current.state).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle options', () => {
    const options = { /* your options */ };
    const { result } = renderHook(() => ${hookName}(options));
    
    // Add your assertions here
  });
});
`;

  const hooksDir = path.join(workspacePath, 'src', 'hooks');
  await fs.ensureDir(hooksDir);
  
  await fs.writeFile(path.join(hooksDir, `${hookName}.ts`), hookContent);
  await fs.writeFile(path.join(hooksDir, `${hookName}.test.ts`), testContent);

  if (options.verbose) {
    console.log(chalk.green(`  ✓ Created src/hooks/${hookName}.ts`));
    console.log(chalk.green(`  ✓ Created src/hooks/${hookName}.test.ts`));
  }
}

async function generateService(monorepoRoot: string, name: string, options: GenerateOptions) {
  const workspace = options.workspace || findBestWorkspace(monorepoRoot, 'service');

  if (!workspace) {
    console.error('No workspace found. Run "re-shell create" to create an app first, or use --workspace to specify a target directory.');
    process.exit(1);
  }

  const workspacePath = path.join(monorepoRoot, workspace);

  const serviceName = `${name.charAt(0).toUpperCase() + name.slice(1)}Service`;
  
  const serviceContent = `export interface ${serviceName}Config {
  baseURL?: string;
  timeout?: number;
  retries?: number;
}

export class ${serviceName} {
  private config: ${serviceName}Config;

  constructor(config: ${serviceName}Config = {}) {
    this.config = {
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      timeout: 10000,
      retries: 3,
      ...config
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = \`\${this.config.baseURL}\${endpoint}\`;
    
    const requestConfig: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      requestConfig.body = JSON.stringify(data);
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt < (this.config.retries || 1); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const response = await fetch(url, {
          ...requestConfig,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < (this.config.retries || 1) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const ${name}Service = new ${serviceName}();
`;

  const testContent = `import { ${serviceName} } from './${serviceName}';

// Mock fetch
global.fetch = jest.fn();

describe('${serviceName}', () => {
  let service: ${serviceName};

  beforeEach(() => {
    service = new ${serviceName}();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('should make GET requests', async () => {
    const mockResponse = { id: 1, name: 'test' };
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await service.get('/api/test');
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should make POST requests', async () => {
    const mockData = { name: 'test' };
    const mockResponse = { id: 1, ...mockData };
    
    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await service.post('/api/test', mockData);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(mockData)
      })
    );
  });

  it('should handle errors', async () => {
    (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(service.get('/api/test')).rejects.toThrow('Network error');
  });
});
`;

  const servicesDir = path.join(workspacePath, 'src', 'services');
  await fs.ensureDir(servicesDir);
  
  await fs.writeFile(path.join(servicesDir, `${serviceName}.ts`), serviceContent);
  await fs.writeFile(path.join(servicesDir, `${serviceName}.test.ts`), testContent);

  if (options.verbose) {
    console.log(chalk.green(`  ✓ Created src/services/${serviceName}.ts`));
    console.log(chalk.green(`  ✓ Created src/services/${serviceName}.test.ts`));
  }
}

async function generateTestFile(monorepoRoot: string, name: string, options: GenerateOptions) {
  const workspace = options.workspace || findBestWorkspace(monorepoRoot, 'test');

  if (!workspace) {
    console.error('No workspace found. Run "re-shell create" to create an app first, or use --workspace to specify a target directory.');
    process.exit(1);
  }

  const workspacePath = path.join(monorepoRoot, workspace);

  const testContent = `describe('${name}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should work correctly', () => {
    // Your test implementation
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    // Edge case testing
    expect(true).toBe(true);
  });

  it('should handle errors gracefully', () => {
    // Error handling tests
    expect(true).toBe(true);
  });
});
`;

  const testsDir = path.join(workspacePath, 'src', '__tests__');
  await fs.ensureDir(testsDir);
  
  await fs.writeFile(path.join(testsDir, `${name}.test.ts`), testContent);

  if (options.verbose) {
    console.log(chalk.green(`  ✓ Created src/__tests__/${name}.test.ts`));
  }
}

async function generateConfig(monorepoRoot: string, name: string, options: GenerateOptions) {
  const configContent = `export interface ${name.charAt(0).toUpperCase() + name.slice(1)}Config {
  // Add your configuration properties here
  environment: 'development' | 'staging' | 'production';
  apiUrl: string;
  features: {
    [key: string]: boolean;
  };
}

const config: ${name.charAt(0).toUpperCase() + name.slice(1)}Config = {
  environment: (process.env.NODE_ENV as any) || 'development',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  features: {
    // Feature flags
    newFeature: process.env.ENABLE_NEW_FEATURE === 'true',
  },
};

export default config;
`;

  const configDir = path.join(monorepoRoot, 'config');
  await fs.ensureDir(configDir);
  
  await fs.writeFile(path.join(configDir, `${name}.config.ts`), configContent);

  if (options.verbose) {
    console.log(chalk.green(`  ✓ Created config/${name}.config.ts`));
  }
}

async function generateDocs(monorepoRoot: string, name: string, options: GenerateOptions) {
  const docsContent = `# ${name.charAt(0).toUpperCase() + name.slice(1)}

## Overview

Brief description of ${name}.

## Installation

\`\`\`bash
pnpm install
\`\`\`

## Usage

\`\`\`typescript
// Example usage
import { ${name} } from './${name}';

const result = ${name}();
\`\`\`

## API Reference

### Functions

#### \`${name}()\`

Description of the function.

**Parameters:**
- \`param1\` (string): Description of parameter 1
- \`param2\` (number): Description of parameter 2

**Returns:**
- \`ReturnType\`: Description of return value

**Example:**
\`\`\`typescript
const result = ${name}('example', 42);
\`\`\`

## Examples

### Basic Example

\`\`\`typescript
// Basic usage example
\`\`\`

### Advanced Example

\`\`\`typescript
// Advanced usage example
\`\`\`

## Contributing

Please read our [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
`;

  const docsDir = path.join(monorepoRoot, 'docs');
  await fs.ensureDir(docsDir);
  
  await fs.writeFile(path.join(docsDir, `${name}.md`), docsContent);

  if (options.verbose) {
    console.log(chalk.green(`  ✓ Created docs/${name}.md`));
  }
}

async function generateBackend(monorepoRoot: string, name: string, options: GenerateOptions) {
  const language = options.language || 'typescript';
  const framework = options.framework || (language === 'python' ? 'fastapi' : language === 'php' ? 'laravel' : 'express');
  const workspace = options.workspace || `services/${name}`;
  const workspacePath = path.join(monorepoRoot, workspace);
  const features = options.features || [];

  if (!await fs.pathExists(path.dirname(workspacePath))) {
    await fs.ensureDir(path.dirname(workspacePath));
  }

  // Check if we have a template for this framework
  if (framework === 'laravel' || framework === 'symfony' || framework === 'slim' || framework === 'codeigniter') {
    const { backendTemplates } = await import('../templates/backend');
    const template = backendTemplates[framework];
    
    if (template) {
      // Generate files from template
      for (const [filePath, content] of Object.entries(template.files)) {
        const processedContent = content
          .replace(/{{serviceName}}/g, name)
          .replace(/{{projectName}}/g, name)
          .replace(/{{PORT}}/g, options.port || '8000');
        
        const fullPath = path.join(workspacePath, filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, processedContent);
        
        if (options.verbose) {
          console.log(chalk.green(`  ✓ Created ${filePath}`));
        }
      }
      return;
    }
  }

  if (language === 'python') {
    // Import Python generators
    const { PythonCodeQualityGenerator } = await import('../templates/backend/python-code-quality');
    const { CeleryTaskGenerator } = await import('../templates/backend/python-celery-tasks');
    const { RedisIntegrationGenerator } = await import('../templates/backend/python-redis');
    
    const codeQualityGen = new PythonCodeQualityGenerator();
    const celeryGen = new CeleryTaskGenerator();
    const redisGen = new RedisIntegrationGenerator();

    // Generate code quality configuration if requested
    if (features.includes('code-quality')) {
      const qualityConfig = {
        framework,
        enableStrict: true,
        enableAutofix: true,
        enablePreCommit: true,
        enableVSCode: true,
        pythonVersion: '3.11'
      };

      const qualityFiles = codeQualityGen.generateCodeQualityConfig(qualityConfig);
      
      for (const file of qualityFiles) {
        const filePath = path.join(workspacePath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
        
        if (options.verbose) {
          console.log(chalk.green(`  ✓ Created ${file.path}`));
        }
      }
    }

    // Generate Celery configuration if requested
    if (features.includes('celery')) {
      const celeryConfig = {
        framework,
        enableScheduling: true,
        enableMonitoring: true,
        enableRetries: true,
        enablePriority: true,
        enableRouting: true,
        enableResultBackend: true
      };

      const celeryFiles = celeryGen.generateCeleryConfig(celeryConfig);
      
      for (const file of celeryFiles) {
        const filePath = path.join(workspacePath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
        
        if (options.verbose) {
          console.log(chalk.green(`  ✓ Created ${file.path}`));
        }
      }
    }

    // Generate Redis integration if requested
    if (features.includes('redis')) {
      const redisConfig = {
        projectName: name,
        framework: framework as 'fastapi' | 'django' | 'flask' | 'tornado' | 'sanic',
        hasTypeScript: false
      };

      const redisFiles = redisGen.generateRedisConfig(redisConfig);
      
      for (const file of redisFiles) {
        const filePath = path.join(workspacePath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
        
        if (options.verbose) {
          console.log(chalk.green(`  ✓ Created ${file.path}`));
        }
      }
    }

    // Generate basic Python project structure
    await generatePythonBackend(workspacePath, name, framework, options);
  } else {
    // Generate TypeScript/JavaScript backend
    await generateTypeScriptBackend(workspacePath, name, framework, options);
  }

  console.log('\n' + chalk.bold('Backend service generated successfully!'));
  console.log(chalk.gray(`Location: ${workspace}`));
  console.log(chalk.gray(`Language: ${language}`));
  console.log(chalk.gray(`Framework: ${framework}`));
  if (features.length > 0) {
    console.log(chalk.gray(`Features: ${features.join(', ')}`));
  }
}

async function generatePythonBackend(workspacePath: string, name: string, framework: string, options: GenerateOptions) {
  // Create basic Python project structure
  const projectFiles = {
    'README.md': `# ${name}

A ${framework} backend service.

## Installation

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Development

\`\`\`bash
# Run development server
python -m uvicorn main:app --reload
\`\`\`

## Testing

\`\`\`bash
pytest
\`\`\`
`,
    'requirements.txt': getPythonRequirements(framework, options.features || []),
    '.gitignore': `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
.env
.coverage
htmlcov/
.pytest_cache/
.mypy_cache/
.ruff_cache/
`,
    'main.py': getPythonMainFile(framework, name),
    'config.py': `import os
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    app_name: str = "${name}"
    debug: bool = False
    port: int = ${options.port || '8000'}
    database_url: Optional[str] = None
    redis_url: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
`
  };

  for (const [filePath, content] of Object.entries(projectFiles)) {
    const fullPath = path.join(workspacePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    
    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }
}

async function generateTypeScriptBackend(workspacePath: string, name: string, framework: string, options: GenerateOptions) {
  // Generate TypeScript backend (Express, NestJS, etc.)
  const projectFiles = {
    'package.json': `{
  "name": "${name}",
  "version": "1.0.0",
  "description": "A ${framework} backend service",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "nodemon": "^3.0.0",
    "ts-node": "^10.9.0"
  }
}`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
    'src/index.ts': `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || ${options.port || '8000'};

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '${name}' });
});

app.listen(port, () => {
  console.log(\`${name} service running on port \${port}\`);
});
`
  };

  for (const [filePath, content] of Object.entries(projectFiles)) {
    const fullPath = path.join(workspacePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    
    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }
}

function getPythonRequirements(framework: string, features: string[] = []): string {
  const base = `python-dotenv==1.0.0
pydantic==2.5.0
pytest==7.4.0
pytest-asyncio==0.21.0
pytest-cov==4.1.0
`;

  const frameworkDeps = {
    fastapi: `fastapi==0.104.0
uvicorn[standard]==0.24.0
sqlalchemy==2.0.0
alembic==1.12.0
httpx==0.25.0`,
    django: `django==4.2.0
djangorestframework==3.14.0
django-cors-headers==4.3.0
gunicorn==21.2.0`,
    flask: `flask==3.0.0
flask-cors==4.0.0
flask-sqlalchemy==3.1.0
flask-migrate==4.0.0
gunicorn==21.2.0`,
    tornado: `tornado==6.3.0
tornado-sqlalchemy==0.8.0`,
    sanic: `sanic==23.6.0
sanic-cors==2.2.0
sanic-openapi==21.12.0`
  };

  let requirements = base + (frameworkDeps[framework as keyof typeof frameworkDeps] || '');

  // Add feature-specific dependencies
  if (features.includes('redis')) {
    requirements += `\n# Redis dependencies
redis==5.0.1
hiredis==2.2.3
`;
  }

  if (features.includes('celery')) {
    requirements += `\n# Celery dependencies
celery==5.3.4
flower==2.0.1
redis==5.0.1
`;
  }

  if (features.includes('code-quality')) {
    requirements += `\n# Code quality tools
black==23.11.0
isort==5.12.0
mypy==1.7.0
ruff==0.1.5
pre-commit==3.5.0
`;
  }

  return requirements;
}

function getPythonMainFile(framework: string, name: string): string {
  const templates = {
    fastapi: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name}

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.app_name}"}
`,
    django: `"""
Django settings for ${name} project.
"""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-key')

DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = '${name}.urls'

CORS_ALLOW_ALL_ORIGINS = True
`,
    flask: `from flask import Flask, jsonify
from flask_cors import CORS
from config import settings

app = Flask(__name__)
CORS(app)

@app.route('/health')
def health_check():
    return jsonify({"status": "ok", "service": settings.app_name})

@app.route('/')
def root():
    return jsonify({"message": f"Welcome to {settings.app_name}"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=settings.port, debug=settings.debug)
`
  };

  return templates[framework as keyof typeof templates] || templates.fastapi;
}

function getComponentTemplate(name: string, framework: string, options: GenerateOptions): ComponentTemplate {
  const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
  
  switch (framework) {
    case 'react':
      return {
        name: pascalName,
        files: [
          {
            path: `src/components/${pascalName}/${pascalName}.tsx`,
            content: `import React from 'react';
import './${pascalName}.css';

export interface ${pascalName}Props {
  children?: React.ReactNode;
  className?: string;
}

export const ${pascalName}: React.FC<${pascalName}Props> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={\`${name.toLowerCase()} \${className}\`} {...props}>
      {children || <p>Hello from ${pascalName}!</p>}
    </div>
  );
};
`
          },
          {
            path: `src/components/${pascalName}/${pascalName}.css`,
            content: `.${name.toLowerCase()} {
  /* Add your styles here */
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
`
          },
          {
            path: `src/components/${pascalName}/${pascalName}.test.tsx`,
            content: `import React from 'react';
import { render, screen } from '@testing-library/react';
import { ${pascalName} } from './${pascalName}';

describe('${pascalName}', () => {
  it('renders without crashing', () => {
    render(<${pascalName} />);
    expect(screen.getByText('Hello from ${pascalName}!')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(<${pascalName}>Custom content</${pascalName}>);
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<${pascalName} className="custom-class" />);
    expect(container.firstChild).toHaveClass('${name.toLowerCase()}', 'custom-class');
  });
});
`
          },
          {
            path: `src/components/${pascalName}/index.ts`,
            content: `export { ${pascalName} } from './${pascalName}';
export type { ${pascalName}Props } from './${pascalName}';
`
          }
        ]
      };

    case 'vue':
      return {
        name: pascalName,
        files: [
          {
            path: `src/components/${pascalName}.vue`,
            content: `<template>
  <div class="${name.toLowerCase()}">
    <slot>Hello from ${pascalName}!</slot>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: any;
}

defineProps<Props>();
defineEmits<{
  'update:modelValue': [value: any];
}>();
</script>

<style scoped>
.${name.toLowerCase()} {
  /* Add your styles here */
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
`
          }
        ]
      };

    case 'svelte':
      return {
        name: pascalName,
        files: [
          {
            path: `src/components/${pascalName}.svelte`,
            content: `<script lang="ts">
  export let className: string = '';
</script>

<div class="${name.toLowerCase()} {className}">
  <slot>Hello from ${pascalName}!</slot>
</div>

<style>
  .${name.toLowerCase()} {
    /* Add your styles here */
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
`
          }
        ]
      };

    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

async function generateTestSuite(workspacePath: string, options: GenerateOptions) {
  // Generate Jest configuration
  const jestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapping: {
    '\\\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
`;

  await fs.writeFile(path.join(workspacePath, 'jest.config.js'), jestConfig);

  // Generate test setup
  const setupTests = `import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
`;

  await fs.writeFile(path.join(workspacePath, 'src', 'setupTests.ts'), setupTests);

  // Generate example test utilities
  const testUtils = `import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Add providers here if needed
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
`;

  const testUtilsDir = path.join(workspacePath, 'src', 'test-utils');
  await fs.ensureDir(testUtilsDir);
  await fs.writeFile(path.join(testUtilsDir, 'index.ts'), testUtils);
}

async function generateProjectDocs(monorepoRoot: string, options: GenerateOptions) {
  const packageJson = await fs.readJson(path.join(monorepoRoot, 'package.json'));
  
  const readme = `# ${packageJson.name || 'Re-Shell Project'}

${packageJson.description || 'A Re-Shell monorepo project'}

## 📁 Project Structure

\`\`\`
${packageJson.name || 'project'}/
├── apps/                 # Applications
├── packages/             # Shared packages  
├── libs/                 # Libraries
├── tools/                # Build tools and scripts
├── docs/                 # Documentation
└── README.md
\`\`\`

## 🚀 Quick Start

1. **Install dependencies**
   \`\`\`bash
   pnpm install
   \`\`\`

2. **Start development**
   \`\`\`bash
   pnpm run dev
   \`\`\`

3. **Build all packages**
   \`\`\`bash
   pnpm run build
   \`\`\`

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| \`pnpm run dev\` | Start development servers |
| \`pnpm run build\` | Build all packages |
| \`pnpm run test\` | Run all tests |
| \`pnpm run lint\` | Lint all packages |
| \`re-shell doctor\` | Health check |
| \`re-shell analyze\` | Bundle analysis |

## 🏗️ Development

### Adding New Packages

\`\`\`bash
re-shell create my-package --type package
\`\`\`

### Running Tests

\`\`\`bash
# Run all tests
pnpm run test

# Run tests for specific package
pnpm --filter my-package test
\`\`\`

### Health Check

\`\`\`bash
re-shell doctor --verbose
\`\`\`

## 📚 Documentation

- [Architecture](./docs/architecture.md)
- [Contributing](./CONTRIBUTING.md)
- [Deployment](./docs/deployment.md)

## 🤝 Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
`;

  await fs.writeFile(path.join(monorepoRoot, 'README.md'), readme);
}

async function generateAPIDocumentation(monorepoRoot: string, options: GenerateOptions) {
  // Generate TypeDoc configuration
  const typeDocConfig = `{
  "entryPoints": ["packages/*/src/index.ts"],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "excludePrivate": true,
  "excludeProtected": true,
  "hideGenerator": true,
  "sort": ["source-order"],
  "gitRevision": "main",
  "readme": "README.md"
}
`;

  await fs.writeFile(path.join(monorepoRoot, 'typedoc.json'), typeDocConfig);
}

async function generateReadme(monorepoRoot: string, options: GenerateOptions) {
  // This is handled by generateProjectDocs
}

function findBestWorkspace(monorepoRoot: string, type: string): string | null {
  // Priority-ordered candidate directories based on type
  const workspaceCandidates: Record<string, string[]> = {
    component: ['apps/web', 'apps/frontend', 'apps/client', 'apps/app', 'packages/ui', 'packages/components'],
    hook: ['packages/hooks', 'packages/ui', 'apps/web', 'apps/frontend', 'apps/client', 'apps/app'],
    service: ['packages/services', 'packages/api', 'apps/web', 'apps/frontend', 'apps/client'],
    test: ['apps/web', 'apps/frontend', 'apps/client', 'apps/app', 'packages/ui'],
    config: ['packages/config', 'packages/core'],
    documentation: ['docs'],
  };

  const candidates = workspaceCandidates[type] || ['apps/web'];

  // Return the first candidate that actually exists on disk
  for (const candidate of candidates) {
    const candidatePath = path.join(monorepoRoot, candidate);
    if (fs.existsSync(candidatePath)) {
      return candidate;
    }
  }

  // Fall back: scan apps/ and packages/ directories for any existing workspace
  for (const baseDir of ['apps', 'packages']) {
    const basePath = path.join(monorepoRoot, baseDir);
    if (fs.existsSync(basePath)) {
      try {
        const entries = fs.readdirSync(basePath);
        if (entries.length > 0) {
          return path.join(baseDir, entries[0]);
        }
      } catch (_) {
        // ignore read errors
      }
    }
  }

  return null;
}

async function updateExports(workspacePath: string, name: string, template: ComponentTemplate) {
  const indexPath = path.join(workspacePath, 'src', 'index.ts');
  
  if (await fs.pathExists(indexPath)) {
    const content = await fs.readFile(indexPath, 'utf8');
    const exportLine = `export { ${template.name} } from './components/${template.name}';`;
    
    if (!content.includes(exportLine)) {
      await fs.appendFile(indexPath, `\n${exportLine}\n`);
    }
  } else {
    const content = `export { ${template.name} } from './components/${template.name}';\n`;
    await fs.writeFile(indexPath, content);
  }
}