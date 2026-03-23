import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Automatic Documentation and API Specification Generation
 *
 * Generates documentation from code, OpenAPI specs, and README files
 */

export interface APISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, any>;
  };
}

export interface DocumentationSection {
  title: string;
  content: string;
  order: number;
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  parameters: Array<{
    name: string;
    in: 'path' | 'query' | 'body' | 'header';
    type: string;
    required: boolean;
    description: string;
  }>;
  responses: Record<string, {
    description: string;
    schema?: any;
  }>;
}

/**
 * Generate OpenAPI specification from code
 */
export async function generateOpenAPISpec(
  projectPath: string = process.cwd()
): Promise<APISpec> {
  const pkgJsonPath = path.join(projectPath, 'package.json');

  let title = 'API';
  let version = '1.0.0';
  let description = 'Generated API documentation';

  if (await fs.pathExists(pkgJsonPath)) {
    const pkgJson = await fs.readJson(pkgJsonPath);
    title = pkgJson.name || title;
    version = pkgJson.version || version;
    description = pkgJson.description || description;
  }

  const spec: APISpec = {
    openapi: '3.0.0',
    info: {
      title,
      version,
      description,
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: {},
    components: {
      schemas: {},
      responses: {},
      parameters: {},
    },
  };

  // Scan for API endpoints in source code
  const srcPath = path.join(projectPath, 'src');
  if (await fs.pathExists(srcPath)) {
    await scanForEndpoints(srcPath, spec);
  }

  return spec;
}

/**
 * Scan source files for API endpoints
 */
async function scanForEndpoints(
  dirPath: string,
  spec: APISpec
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'build' &&
        entry.name !== 'coverage'
      ) {
        await scanForEndpoints(fullPath, spec);
      }
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      await extractEndpointsFromFile(fullPath, spec);
    }
  }
}

/**
 * Extract API endpoints from file
 */
async function extractEndpointsFromFile(
  filePath: string,
  spec: APISpec
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);

  // Detect framework-specific patterns
  if (content.includes('@Controller') || content.includes('@Get') || content.includes('@Post')) {
    // NestJS
    extractNestJSEndpoints(content, spec);
  } else if (content.includes('router.') || content.includes('app.')) {
    // Express
    extractExpressEndpoints(content, spec);
  } else if (content.includes('app.get') || content.includes('app.post')) {
    // Generic Express
    extractGenericEndpoints(content, spec);
  }
}

/**
 * Extract NestJS endpoints
 */
function extractNestJSEndpoints(content: string, spec: APISpec): void {
  // Extract controller path
  const controllerMatch = content.match(/@Controller\(['"]([^'"]+)['"]\)/);
  const basePath = controllerMatch ? controllerMatch[1] : '';

  // Extract method decorators
  const methods = [
    { regex: /@Get\(['"]([^'"]+)['"]\)/g, method: 'GET' },
    { regex: /@Post\(['"]([^'"]+)['"]\)/g, method: 'POST' },
    { regex: /@Put\(['"]([^'"]+)['"]\)/g, method: 'PUT' },
    { regex: /@Patch\(['"]([^'"]+)['"]\)/g, method: 'PATCH' },
    { regex: /@Delete\(['"]([^'"]+)['"]\)/g, method: 'DELETE' },
  ];

  for (const { regex, method } of methods) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];
      const fullPath = basePath + path;

      if (!spec.paths[fullPath]) {
        spec.paths[fullPath] = {};
      }

      spec.paths[fullPath][method.toLowerCase()] = {
        summary: `${method} ${fullPath}`,
        description: `Auto-generated from NestJS controller`,
        tags: [basePath.replace(/^\//, '') || 'default'],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      };
    }
  }
}

/**
 * Extract Express endpoints
 */
function extractExpressEndpoints(content: string, spec: APISpec): void {
  const routes = [
    { regex: /\.get\(['"]([^'"]+)['"]/g, method: 'GET' },
    { regex: /\.post\(['"]([^'"]+)['"]/g, method: 'POST' },
    { regex: /\.put\(['"]([^'"]+)['"]/g, method: 'PUT' },
    { regex: /\.patch\(['"]([^'"]+)['"]/g, method: 'PATCH' },
    { regex: /\.delete\(['"]([^'"]+)['"]/g, method: 'DELETE' },
  ];

  for (const { regex, method } of routes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];

      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      spec.paths[path][method.toLowerCase()] = {
        summary: `${method} ${path}`,
        description: 'Auto-generated from Express route',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      };
    }
  }
}

/**
 * Extract generic endpoints
 */
function extractGenericEndpoints(content: string, spec: APISpec): void {
  const patterns = [
    { regex: /app\.get\(['"]([^'"]+)['"]/g, method: 'GET' },
    { regex: /app\.post\(['"]([^'"]+)['"]/g, method: 'POST' },
    { regex: /app\.put\(['"]([^'"]+)['"]/g, method: 'PUT' },
    { regex: /app\.delete\(['"]([^'"]+)['"]/g, method: 'DELETE' },
  ];

  for (const { regex, method } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const path = match[1];

      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      spec.paths[path][method.toLowerCase()] = {
        summary: `${method} ${path}`,
        description: 'Auto-generated endpoint',
        responses: {
          '200': {
            description: 'Success',
          },
        },
      };
    }
  }
}

/**
 * Generate README documentation
 */
export async function generateREADME(
  projectPath: string = process.cwd()
): Promise<string> {
  const pkgJsonPath = path.join(projectPath, 'package.json');

  let name = 'Project';
  let version = '1.0.0';
  let description = 'Generated documentation';
  let author = '';

  if (await fs.pathExists(pkgJsonPath)) {
    const pkgJson = await fs.readJson(pkgJsonPath);
    name = pkgJson.name || name;
    version = pkgJson.version || version;
    description = pkgJson.description || description;
    author = pkgJson.author || '';
  }

  const readme = `# ${name}

> ${description}

**Version:** ${version}
**Author:** ${author}

## 📋 Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Installation

\`\`\`bash
# Install dependencies
npm install

# or
pnpm install

# or
yarn install
\`\`\`

## 💻 Usage

\`\`\`bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## 📚 API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /health  | Health check |
| GET    | /api     | API entry point |

### Response Format

All API responses follow this format:

\`\`\`json
{
  "success": true,
  "data": {},
  "message": "Success"
}
\`\`\`

## 🔧 Development

\`\`\`bash
# Run linter
npm run lint

# Run tests
npm test

# Watch mode
npm run dev:watch
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

---

Generated with ❤️ by [Re-Shell](https://github.com/re-shell/re-shell)
`;

  return readme;
}

/**
 * Generate JSDoc comments for functions
 */
export async function generateJSDoc(
  functionName: string,
  params: Array<{ name: string; type: string; description: string }>,
  returnType: string,
  description: string
): Promise<string> {
  let jsdoc = '/**\n';
  jsdoc += ` * ${description}\n`;

  if (params.length > 0) {
    jsdoc += ' *\n';
    for (const param of params) {
      jsdoc += ` * @param {${param.type}} ${param.name} - ${param.description}\n`;
    }
  }

  if (returnType) {
    jsdoc += ' *\n';
    jsdoc += ` * @returns {${returnType}} - Function result\n`;
  }

  jsdoc += ' */';

  return jsdoc;
}

/**
 * Generate API documentation from OpenAPI spec
 */
export async function generateAPIDocumentation(
  spec: APISpec
): Promise<string> {
  let doc = `# ${spec.info.title} API Documentation\n\n`;
  doc += `**Version:** ${spec.info.version}\n\n`;
  doc += `${spec.info.description}\n\n`;

  doc += `## Base URL\n\n`;
  if (spec.servers.length > 0) {
    for (const server of spec.servers) {
      doc += `- ${server.url} - ${server.description}\n`;
    }
  }
  doc += `\n`;

  // Group endpoints by tag
  const endpointsByTag: Record<string, APIEndpoint[]> = {};

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const endpoint = operation as any;
      const tag = endpoint.tags?.[0] || 'default';

      if (!endpointsByTag[tag]) {
        endpointsByTag[tag] = [];
      }

      endpointsByTag[tag].push({
        path,
        method: method.toUpperCase() as any,
        description: endpoint.summary || endpoint.description || '',
        parameters: [],
        responses: endpoint.responses || {},
      });
    }
  }

  // Generate documentation for each tag
  for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
    doc += `## ${tag.charAt(0).toUpperCase() + tag.slice(1)}\n\n`;

    for (const endpoint of endpoints) {
      doc += `### ${endpoint.method} ${endpoint.path}\n\n`;
      doc += `${endpoint.description}\n\n`;

      // Parameters
      if (endpoint.parameters.length > 0) {
        doc += `**Parameters:**\n\n`;
        doc += `| Name | Type | In | Required | Description |\n`;
        doc += `|------|------|-----|----------|-------------|\n`;

        for (const param of endpoint.parameters) {
          doc += `| ${param.name} | ${param.type} | ${param.in} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
        }
        doc += `\n`;
      }

      // Responses
      doc += `**Responses:**\n\n`;
      for (const [statusCode, response] of Object.entries(endpoint.responses)) {
        const resp = response as any;
        doc += `- **${statusCode}**: ${resp.description}\n`;
      }
      doc += `\n`;
      doc += `---\n\n`;
    }
  }

  return doc;
}

/**
 * Write documentation files
 */
export async function writeDocumentation(
  projectPath: string,
  outputDir = 'docs'
): Promise<void> {
  const docsPath = path.join(projectPath, outputDir);
  await fs.ensureDir(docsPath);

  // Generate OpenAPI spec
  const spec = await generateOpenAPISpec(projectPath);
  await fs.writeJson(path.join(docsPath, 'openapi.json'), spec, { spaces: 2 });

  // Generate API documentation
  const apiDoc = await generateAPIDocumentation(spec);
  await fs.writeFile(path.join(docsPath, 'api.md'), apiDoc);

  // Generate README (if it doesn't exist)
  const readmePath = path.join(projectPath, 'README.md');
  if (!(await fs.pathExists(readmePath))) {
    const readme = await generateREADME(projectPath);
    await fs.writeFile(readmePath, readme);
  }

  console.log(chalk.green(`\n✓ Documentation written to ${docsPath}\n`));
}

/**
 * Display documentation summary
 */
export async function displayDocumentationSummary(
  spec: APISpec
): Promise<void> {
  console.log(chalk.bold('\n📚 API Documentation Summary\n'));

  console.log(chalk.cyan(`Title: ${spec.info.title}`));
  console.log(chalk.cyan(`Version: ${spec.info.version}`));
  console.log(chalk.cyan(`Description: ${spec.info.description}\n`));

  const endpointCount = Object.keys(spec.paths).length;
  console.log(chalk.cyan(`Total Endpoints: ${endpointCount}\n`));

  if (endpointCount > 0) {
    console.log(chalk.bold('Endpoints:\n'));

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const op = operation as any;
        const methodUpper = method.toUpperCase();
        const color =
          methodUpper === 'GET'
            ? chalk.blue
            : methodUpper === 'POST'
            ? chalk.green
            : methodUpper === 'PUT'
            ? chalk.yellow
            : methodUpper === 'DELETE'
            ? chalk.red
            : chalk.gray;

        console.log(`  ${color(methodUpper.padEnd(7))} ${path}`);
        if (op.summary) {
          console.log(chalk.gray(`          ${op.summary}`));
        }
      }
    }
    console.log('');
  }
}
