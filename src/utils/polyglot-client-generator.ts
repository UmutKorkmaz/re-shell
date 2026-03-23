/**
 * Polyglot Client Library Generator
 *
 * Generates type-safe client libraries for REST APIs in multiple languages
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ClientLanguage = 'typescript' | 'python' | 'go';

export interface ServiceDefinition {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: any[];
  schemas: Record<string, any>;
}

export interface ClientConfig {
  serviceName: string;
  language: ClientLanguage;
  outputDir: string;
}

// Helper functions
function toCamelCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (_, g1, g2) => g1.toUpperCase() + g2);
}

// TypeScript Client Generator
export function generateTypeScriptClient(service: ServiceDefinition): string {
  const tsCode = `// Auto-generated TypeScript client for ${service.name} v${service.version}
// Generated at: ${new Date().toISOString()}

// Type Definitions
${Object.entries(service.schemas).map(([name, schema]) => {
  return `export interface ${name} {
${Object.entries(schema.properties || {}).map(([propName, prop]: [string, any]) => {
  const optional = !schema.required?.includes(propName) ? '?' : '';
  return `  ${propName}${optional}: ${prop.type};`;
}).join('\n')}
}`;
}).join('\n\n')}

/**
 * ${service.name} API Client
 * ${service.description}
 */
export class ${service.name}Client {
  private baseUrl: string;
  private apiKey?: string;
  private authToken?: string;

  constructor(config: any) {
    this.baseUrl = config.baseUrl || '${service.baseUrl}';
    this.apiKey = config.apiKey;
    this.authToken = config.authToken;
  }

  private async request(method: string, path: string, body?: any, headers?: any): Promise<any> {
    const url = String(this.baseUrl) + path;
    const requestHeaders: any = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = 'Bearer ' + this.authToken;
    } else if (this.apiKey) {
      requestHeaders['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }

    return response.json();
  }

${service.endpoints.map((endpoint: any) => {
  return `  /**
   * ${endpoint.description || endpoint.name}
   * ${endpoint.method} ${endpoint.path}
   */
  async ${toCamelCase(endpoint.name)}(): Promise<any> {
    return this.request('${endpoint.method}', '${endpoint.path}');
  }`;
}).join('\n\n')}
}

export default ${service.name}Client;
`;

  return tsCode;
}

// Python Client Generator
export function generatePythonClient(service: ServiceDefinition): string {
  const pythonCode = `# Auto-generated Python client for ${service.name} v${service.version}
# Generated at: ${new Date().toISOString()}

import httpx
from typing import Optional, Dict, Any

# Type Definitions
${Object.entries(service.schemas).map(([name, schema]) => {
  return `class ${name}:
${Object.entries(schema.properties || {}).map(([propName, prop]: [string, any]) => {
  return `    ${propName}: ${prop.type}`;
}).join('\n')}`;
}).join('\n\n')}

class ${service.name}Client:
    """${service.description}"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        auth_token: Optional[str] = None,
    ):
        self.base_url = base_url or "${service.baseUrl}"
        self.api_key = api_key
        self.auth_token = auth_token
        self.client = httpx.Client()

    async def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Make HTTP request"""
        url = self.base_url + path
        request_headers = {
            "Content-Type": "application/json",
            **(headers or {}),
        }

        if self.auth_token:
            request_headers["Authorization"] = "Bearer " + self.auth_token
        elif self.api_key:
            request_headers["X-API-Key"] = self.apiKey

        response = await self.client.request(
            method=method,
            url=url,
            json=body,
            headers=request_headers,
        )

        response.raise_for_status()
        return response.json()

${service.endpoints.map((endpoint: any) => {
  return `    def ${toSnakeCase(endpoint.name)}(self) -> Any:
        """
        ${endpoint.description || endpoint.name}
        ${endpoint.method} ${endpoint.path}
        """
        return self._request("${endpoint.method}", "${endpoint.path}")`;
}).join('\n\n')}

    def close(self):
        """Close the HTTP client"""
        self.client.close()
`;

  return pythonCode;
}

// Go Client Generator
export function generateGoClient(service: ServiceDefinition): string {
  const goCode = `// Package ${toSnakeCase(service.name)} provides a Go client for ${service.name}
// Auto-generated at: ${new Date().toISOString()}

package ${toSnakeCase(service.name)}

import (
    "context"
    "fmt"
    "net/http"
)

// Type Definitions
${Object.entries(service.schemas).map(([name, schema]) => {
  return `type ${name} struct {
${Object.entries(schema.properties || {}).map(([propName, prop]: [string, any]) => {
  return `    ${toPascalCase(propName)} ${prop.type} + \`json:"${propName}"\``;
}).join('\n')}
}`;
}).join('\n\n')}

// ${service.name}Client is a client for ${service.name}
type ${service.name}Client struct {
    baseURL   string
    apiKey    string
    authToken string
    client    *http.Client
}

// New${service.name}Client creates a new client
func New${service.name}Client(baseURL string) *${service.name}Client {
    return &${service.name}Client{
        baseURL: baseURL,
        client:  &http.Client{},
    }
}

// SetAPIKey sets the API key for authentication
func (c *${service.name}Client) SetAPIKey(apiKey string) {
    c.apiKey = apiKey
}

// SetAuthToken sets the auth token for authentication
func (c *${service.name}Client) SetAuthToken(token string) {
    c.authToken = token
}

${service.endpoints.map((endpoint: any) => {
  return `// ${endpoint.description || endpoint.name}
// ${endpoint.method} ${endpoint.path}
func (c *${service.name}Client) ${toPascalCase(endpoint.name)}(ctx context.Context) (interface{}, error) {
    // TODO: Implement endpoint
    return nil, fmt.Errorf("not implemented")
}`;
}).join('\n\n')}
`;

  return goCode;
}

// Display configuration
export function displayConfig(config: ClientConfig, service: ServiceDefinition): void {
  console.log(chalk.cyan('\n✨ Polyglot Client Generator Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`${chalk.yellow('Service Name:')} ${chalk.white(service.name)}`);
  console.log(`${chalk.yellow('Service Version:')} ${chalk.white(service.version)}`);
  console.log(`${chalk.yellow('Client Language:')} ${chalk.white(config.language)}`);
  console.log(`${chalk.yellow('Base URL:')} ${chalk.white(service.baseUrl)}`);
  console.log(`${chalk.yellow('Endpoints:')} ${chalk.white(service.endpoints.length)}`);
  console.log(`${chalk.yellow('Schemas:')} ${chalk.white(Object.keys(service.schemas).length)}`);

  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.cyan('\n📋 Supported Languages:\n'));
  const languages = [
    { name: 'typescript', desc: 'TypeScript with full type definitions' },
    { name: 'python', desc: 'Python with type hints' },
    { name: 'go', desc: 'Go with structs' },
  ];

  languages.forEach(lang => {
    console.log(`  ${chalk.cyan(lang.name.padEnd(12))} ${chalk.gray(lang.desc)}`);
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: ClientConfig, service: ServiceDefinition): string {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';

  return `# Polyglot Client Library for ${service.name}

This is an auto-generated type-safe client library for **${service.name}** v${service.version} in **${config.language}**.

## 📋 Configuration

- **Service**: ${service.name}
- **Version**: ${service.version}
- **Language**: ${config.language}
- **Base URL**: ${service.baseUrl}
- **Endpoints**: ${service.endpoints.length}

## 🚀 Installation

\`\`\`bash
# TODO: Add installation instructions for ${config.language}
\`\`\`

## 💻 Usage

\`\`\`${ext}
import ${service.name}Client from './${service.name}Client';

// Initialize client
const client = new ${service.name}Client({
  baseUrl: '${service.baseUrl}',
  apiKey: process.env.API_KEY,
});

// Make API calls
const result = await client.getEndpoint();
console.log(result);
\`\`\`

## 📚 API Reference

### Endpoints

${service.endpoints.map((ep: any) => `
#### ${ep.name}
- **Method**: ${ep.method}
- **Path**: ${ep.path}
- **Description**: ${ep.description || 'No description'}
`).join('')}

### Schemas

${Object.keys(service.schemas).map(schemaName => `
#### ${schemaName}
Type definition for ${schemaName}.
`).join('')}

## 🔑 Authentication

No authentication configured.

## 🧪 Testing

\`\`\`bash
# TODO: Add test instructions
\`\`\`

## 📝 Examples

See the \`examples/\` directory for usage examples.

## 🔗 Links

- Service Documentation: ${service.baseUrl}/docs
- API Specification: ${service.baseUrl}/openapi.json
`;
}

// Write files
export async function writeClientFiles(
  service: ServiceDefinition,
  config: ClientConfig
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = `${service.name}Client.${ext}`;
  const filePath = path.join(config.outputDir, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptClient(service);
  } else if (config.language === 'python') {
    content = generatePythonClient(service);
  } else if (config.language === 'go') {
    content = generateGoClient(service);
  } else {
    throw new Error(`Unsupported language: ${config.language}`);
  }

  await fs.ensureDir(config.outputDir);
  await fs.writeFile(filePath, content);
  console.log(chalk.green(`✅ Generated: ${fileName}`));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config, service);
  const buildMDPath = path.join(config.outputDir, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green(`✅ Generated: BUILD.md`));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: toSnakeCase(service.name),
      version: service.version,
      description: `TypeScript client for ${service.name}`,
      main: `${fileName}`,
      types: `${fileName}`,
      dependencies: {
        'node-fetch': '^18.0.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(config.outputDir, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green(`✅ Generated: package.json`));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'httpx>=0.24.0',
    ];

    const requirementsPath = path.join(config.outputDir, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green(`✅ Generated: requirements.txt`));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = `module ${toSnakeCase(service.name)}

go 1.21

require (
    github.com/google/uuid v1.3.0
)
`;

    const goModPath = path.join(config.outputDir, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green(`✅ Generated: go.mod`));
  }
}
