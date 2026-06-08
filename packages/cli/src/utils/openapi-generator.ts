/**
 * OpenAPI Specification Generator for All Backend Frameworks
 * Auto-generates OpenAPI specs from code annotations and patterns
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// OpenAPI 3.0 specification types
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
}

export interface OpenAPIInfo {
  title: string;
  description?: string;
  version: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

export interface OpenAPIContact {
  name?: string;
  email?: string;
  url?: string;
}

export interface OpenAPILicense {
  name: string;
  url?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, OpenAPIServerVariable>;
}

export interface OpenAPIServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  $ref?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  servers?: OpenAPIServer[];
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  callbacks?: Record<string, OpenAPICallback>;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  servers?: OpenAPIServer[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'matrix' | 'label' | 'form' | 'simple' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPISchema {
  $ref?: string;
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  additionalProperties?: boolean | OpenAPISchema;
  discriminator?: {
    propertyName: string;
    mapping?: Record<string, string>;
  };
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: OpenAPIXML;
  externalDocs?: OpenAPIExternalDocumentation;
  example?: unknown;
}

export interface OpenAPIDiscrimriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface OpenAPIXML {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface OpenAPIExternalDocumentation {
  description?: string;
  url: string;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  description?: string;
  headers?: Record<string, OpenAPIHeader | OpenAPISchema>;
  content?: Record<string, OpenAPIMediaType>;
  links?: Record<string, OpenAPILink>;
}

export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: 'simple' | 'query' | 'matrix' | 'label' | 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode?: boolean;
  allowReserved?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
  encoding?: Record<string, OpenAPIEncoding>;
}

export interface OpenAPIEncoding {
  contentType?: string;
  headers?: Record<string, OpenAPIHeader | OpenAPISchema>;
  style?: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject';
  explode?: boolean;
  allowReserved?: boolean;
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface OpenAPILink {
  operationRef?: string;
  operationId?: string;
  description?: string;
  server?: OpenAPIServer;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

export interface OpenAPICallback {
  expression?: string;
  $ref?: string;
}

export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocumentation;
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  examples?: Record<string, OpenAPIExample>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  links?: Record<string, OpenAPILink>;
  callbacks?: Record<string, OpenAPICallback>;
}

export interface OpenAPISecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, OpenAPIOAuthFlow>;
  openIdConnectUrl?: string;
}

export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes?: Record<string, string>;
}

// Framework-specific annotation patterns
export interface FrameworkAnnotationPattern {
  framework: string;
  language: string;
  decorators: string[];
  patterns: RegExp[];
  commentStyle: 'line' | 'block';
  exampleAnnotations: string[];
}

// Route discovery result
export interface DiscoveredRoute {
  path: string;
  method: string;
  operation: string;
  tags: string[];
  parameters: DiscoveredParameter[];
  requestBody?: {
    contentType: string;
    schema: string;
  };
  responses: Record<number, {
    description: string;
    schema?: string;
  }>;
  file: string;
  line: number;
}

export interface DiscoveredParameter {
  name: string;
  type: string;
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  description?: string;
}

// OpenAPI generator class
export class OpenAPIGenerator {
  private projectPath: string;
  private framework?: string;
  private basePath = '/api/v1';
  private port = 3000;

  constructor(projectPath: string, framework?: string) {
    this.projectPath = projectPath;
    this.framework = framework;
  }

  // Detect framework from project files
  async detectFramework(): Promise<string> {
    const frameworkFiles: Record<string, string[]> = {
      'express': ['package.json'],
      'nestjs': ['package.json', 'nest-cli.json'],
      'fastify': ['package.json'],
      'spring-boot': ['pom.xml', 'build.gradle'],
      'fastapi': ['requirements.txt', 'main.py'],
      'django': ['manage.py', 'settings.py'],
      'flask': ['app.py', 'wsgi.py'],
      'rails': ['Gemfile', 'config/routes.rb'],
      'laravel': ['composer.json', 'app/Http/Controllers'],
      'aspnet-core': ['*.csproj', 'Startup.cs', 'Program.cs'],
      'go-gin': ['go.mod', 'main.go'],
      'go-chi': ['go.mod', 'main.go'],
      'go-fiber': ['go.mod', 'main.go'],
      'rust-actix': ['Cargo.toml', 'src/main.rs'],
      'rust-axum': ['Cargo.toml', 'src/main.rs'],
    };

    for (const [framework, files] of Object.entries(frameworkFiles)) {
      for (const file of files) {
        const filePath = path.join(this.projectPath, file);
        if (file.startsWith('*.') || file.includes('/')) {
          // Check directory or specific file
          const dirPath = path.join(this.projectPath, file.replace(/[^/]+$/, ''));
          if (await fs.pathExists(dirPath)) {
            return framework;
          }
        } else if (await fs.pathExists(filePath)) {
          // Check package.json content for framework hints
          if (file === 'package.json') {
            const pkgJson = await fs.readJson(filePath);
            const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
            if (deps.express && framework === 'express') return framework;
            if (deps['@nestjs/core'] && framework === 'nestjs') return framework;
            if (deps.fastify && framework === 'fastify') return framework;
            return framework;
          }
        }
      }
    }

    return 'express'; // Default fallback
  }

  // Discover routes from code
  async discoverRoutes(): Promise<DiscoveredRoute[]> {
    const framework = this.framework || await this.detectFramework();
    const routes: DiscoveredRoute[] = [];

    switch (framework) {
      case 'nestjs':
        await this.scanNestJSRoutes(routes);
        break;
      case 'express':
        await this.scanExpressRoutes(routes);
        break;
      case 'fastify':
        await this.scanFastifyRoutes(routes);
        break;
      case 'fastapi':
        await this.scanFastAPIRoutes(routes);
        break;
      case 'django':
        await this.scanDjangoRoutes(routes);
        break;
      case 'flask':
        await this.scanFlaskRoutes(routes);
        break;
      case 'rails':
        await this.scanRailsRoutes(routes);
        break;
      case 'spring-boot':
        await this.scanSpringBootRoutes(routes);
        break;
      case 'aspnet-core':
        await this.scanAspNetRoutes(routes);
        break;
      case 'go-gin':
      case 'go-chi':
      case 'go-fiber':
        await this.scanGoRoutes(routes, framework);
        break;
      case 'rust-actix':
      case 'rust-axum':
        await this.scanRustRoutes(routes, framework);
        break;
      default:
        await this.scanExpressRoutes(routes);
    }

    return routes;
  }

  // Scan NestJS routes
  private async scanNestJSRoutes(routes: DiscoveredRoute[]): Promise<void> {
    await this.scanTypeScriptRoutes(routes, {
      filePattern: /\.controller\.ts$/,
      decorators: ['@Get', '@Post', '@Put', '@Patch', '@Delete'],
      pathPatterns: [/'([^']+)'/, /@Controller\('([^']+)'\)/],
    });
  }

  // Scan Express routes
  private async scanExpressRoutes(routes: DiscoveredRoute[]): Promise<void> {
    await this.scanJavaScriptRoutes(routes, {
      patterns: [
        /app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
        /router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
      ],
    });
  }

  // Scan Fastify routes
  private async scanFastifyRoutes(routes: DiscoveredRoute[]): Promise<void> {
    await this.scanJavaScriptRoutes(routes, {
      patterns: [
        /fastify\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g,
      ],
    });
  }

  // Scan FastAPI routes
  private async scanPythonRoutes(routes: DiscoveredRoute[], patterns: RegExp[]): Promise<void> {
    const srcPath = path.join(this.projectPath, 'src');
    const appPath = path.join(this.projectPath, 'app');

    for (const scanPath of [srcPath, appPath]) {
      if (!(await fs.pathExists(scanPath))) continue;

      const files = await this.glob(scanPath, '**/*.py');
      for (const file of files) {
        const content = await fs.readFile(path.join(scanPath, file), 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // @app.get, @app.post, etc.
          const decoratorMatch = line.match(/@app\.(get|post|put|patch|delete)\('([^']+)'/);
          if (decoratorMatch) {
            const method = decoratorMatch[1];
            const routePath = decoratorMatch[2];
            const funcMatch = lines[i + 1]?.match(/def\s+(\w+)\(/);
            const operation = funcMatch ? funcMatch[1] : routePath.split('/').pop();

            routes.push({
              path: routePath.startsWith('/') ? routePath : `/${routePath}`,
              method,
              operation,
              tags: [routePath.split('/')[1] || 'default'],
              parameters: this.extractPythonParameters(lines, i),
              responses: {
                200: { description: 'Success' },
              },
              file: file,
              line: i + 1,
            });
          }
        }
      }
    }
  }

  // Extract Python parameters from function definition
  private extractPythonParameters(lines: string[], decoratorLine: number): DiscoveredParameter[] {
    const params: DiscoveredParameter[] = [];
    const funcLine = lines[decoratorLine + 1] || '';
    const funcMatch = funcLine.match(/def\s+\w+\(([^)]+)\)/);

    if (funcMatch) {
      const args = funcMatch[1].split(',').map(a => a.trim().split(':')[0].split('=')[0]);
      const pathParams = lines[decoratorLine].match(/:\s*\w+/g) || [];

      for (const arg of args) {
        if (arg === 'self') continue;
        params.push({
          name: arg,
          type: 'string',
          in: pathParams.some((p: string) => p.includes(arg)) ? 'path' : 'query',
          required: true,
        });
      }
    }

    return params;
  }

  // Scan FastAPI routes specifically
  private async scanFastAPIRoutes(routes: DiscoveredRoute[]): Promise<void> {
    await this.scanPythonRoutes(routes, [/@app\.(get|post|put|patch|delete)\('([^']+)'/]);
  }

  // Scan Django routes
  private async scanDjangoRoutes(routes: DiscoveredRoute[]): Promise<void> {
    const urlsPath = path.join(this.projectPath, 'urls.py');
    if (!(await fs.pathExists(urlsPath))) {
      const nestedPath = path.join(this.projectPath, 'config', 'urls.py');
      if (await fs.pathExists(nestedPath)) {
        await this.scanDjangoUrlsRoutes(nestedPath, routes);
      }
      return;
    }
    await this.scanDjangoUrlsRoutes(urlsPath, routes);
  }

  // Scan Django URLs
  private async scanDjangoUrlsRoutes(urlsPath: string, routes: DiscoveredRoute[]): Promise<void> {
    const content = await fs.readFile(urlsPath, 'utf-8');

    // Match path() patterns
    const pathPattern = /path\(['"]([^'"]+)['"],\s*(\w+)\.views/ig;
    let match;

    while ((match = pathPattern.exec(content)) !== null) {
      const routePath = match[1];
      const viewFunc = match[2];
      const operation = routePath.split('/').pop() || viewFunc;

      routes.push({
        path: routePath,
        method: 'get',
        operation,
        tags: [viewFunc],
        parameters: [],
        responses: { 200: { description: 'Success' } },
        file: 'urls.py',
        line: 0,
      });
    }
  }

  // Scan Flask routes
  private async scanFlaskRoutes(routes: DiscoveredRoute[]): Promise<void> {
    await this.scanPythonRoutes(routes, [/@app\.route\(['"]([^'"]+)['"]\)/, /@app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]\)/]);
  }

  // Scan Rails routes
  private async scanRailsRoutes(routes: DiscoveredRoute[]): Promise<void> {
    const routesPath = path.join(this.projectPath, 'config', 'routes.rb');
    if (!(await fs.pathExists(routesPath))) return;

    const content = await fs.readFile(routesPath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match: get '/path', resources, post '/path', etc.
      const routeMatch = line.match(/\s*(get|post|put|patch|delete)\s+['"]([^'"`]+)['"]/);
      if (routeMatch) {
        const method = routeMatch[1];
        const routePath = routeMatch[2];
        const operation = routePath.split('/').pop() || 'index';

        routes.push({
          path: routePath,
          method,
          operation,
          tags: [routePath.split('/')[1] || 'default'],
          parameters: [],
          responses: { 200: { description: 'Success' } },
          file: 'routes.rb',
          line: i + 1,
        });
      }
    }
  }

  // Scan Spring Boot routes
  private async scanSpringBootRoutes(routes: DiscoveredRoute[]): Promise<void> {
    const javaPath = path.join(this.projectPath, 'src', 'main', 'java');
    if (!(await fs.pathExists(javaPath))) return;

    const files = await this.glob(javaPath, '**/*.java');
    for (const file of files) {
      const content = await fs.readFile(path.join(javaPath, file), 'utf-8');

      // Match: @GetMapping("/path"), @RequestMapping
      const mappingPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)\s*\(\s*['"]([^'"]+)['"]\)/g;
      let match;

      while ((match = mappingPattern.exec(content)) !== null) {
        const methodMap: Record<string, string> = {
          'GetMapping': 'get',
          'PostMapping': 'post',
          'PutMapping': 'put',
          'PatchMapping': 'patch',
          'DeleteMapping': 'delete',
          'RequestMapping': 'get',
        };
        const method = methodMap[match[1]] || 'get';
        const routePath = match[2];

        // Extract method name from nearby context
        const funcMatch = content.substring(match.index).match(/\s+(public\s+\w+\s+(\w+)\s*\(\))/);
        const operation = funcMatch ? funcMatch[1] : routePath.split('/').pop();

        routes.push({
          path: routePath,
          method,
          operation,
          tags: [routePath.split('/')[1] || 'default'],
          parameters: [],
          responses: { 200: { description: 'Success' } },
          file: file,
          line: 0,
        });
      }
    }
  }

  // Scan ASP.NET routes
  private async scanAspNetRoutes(routes: DiscoveredRoute[]): Promise<void> {
    const controllerPattern = /\*Controller\.cs$/;
    await this.scanCSharpRoutes(routes, controllerPattern);
  }

  // Scan C# routes
  private async scanCSharpRoutes(routes: DiscoveredRoute[], filePattern: RegExp): Promise<void> {
    const files = await this.glob(this.projectPath, '**/*.cs');
    for (const file of files) {
      if (!filePattern.test(file)) continue;

      const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');

      // Match: [HttpGet("/path")]
      const httpMethodPattern = /\[Http(Get|Post|Put|Patch|Delete)\]\(['"]([^'"]+)['"]\)/g;
      let match;

      while ((match = httpMethodPattern.exec(content)) !== null) {
        const method = match[1].toLowerCase();
        const routePath = match[2];

        routes.push({
          path: routePath,
          method,
          operation: routePath.split('/').pop() || 'index',
          tags: [routePath.split('/')[1] || 'default'],
          parameters: [],
          responses: { 200: { description: 'Success' } },
          file: file,
          line: 0,
        });
      }
    }
  }

  // Scan Go routes
  private async scanGoRoutes(routes: DiscoveredRoute[], framework: string): Promise<void> {
    const files = await this.glob(this.projectPath, '**/*.go');

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');

      if (framework === 'go-gin') {
        // Match: router.GET("/path", handler)
        const ginPattern = /router\.(GET|POST|PUT|PATCH|DELETE)\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = ginPattern.exec(content)) !== null) {
          routes.push(this.createGoRoute(match[1], match[2], file));
        }
      } else if (framework === 'go-chi') {
        // Match: r.Get("/path", handler)
        const chiPattern = /r\.(Get|Post|Put|Patch|Delete)\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = chiPattern.exec(content)) !== null) {
          routes.push(this.createGoRoute(match[1], match[2], file));
        }
      } else if (framework === 'go-fiber') {
        // Match: app.Get("/path", handler)
        const fiberPattern = /app\.(Get|Post|Put|Patch|Delete)\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = fiberPattern.exec(content)) !== null) {
          routes.push(this.createGoRoute(match[1], match[2], file));
        }
      }
    }
  }

  private createGoRoute(method: string, routePath: string, file: string): DiscoveredRoute {
    return {
      path: routePath,
      method: method.toLowerCase(),
      operation: routePath.split('/').pop() || 'index',
      tags: [routePath.split('/')[1] || 'default'],
      parameters: [],
      responses: { 200: { description: 'Success' } },
      file,
      line: 0,
    };
  }

  // Scan Rust routes
  private async scanRustRoutes(routes: DiscoveredRoute[], framework: string): Promise<void> {
    const files = await this.glob(this.projectPath, '**/*.rs');

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');

      if (framework === 'rust-actix') {
        // Match: .route("/path", get())
        const actixPattern = /\.route\(['"]([^'"]+)['"]\),\s*(get|post|put|patch|delete)\(\)/g;
        let match;
        while ((match = actixPattern.exec(content)) !== null) {
          routes.push({
            path: match[1],
            method: match[2],
            operation: match[1].split('/').pop() || 'index',
            tags: [match[1].split('/')[1] || 'default'],
            parameters: [],
            responses: { 200: { description: 'Success' } },
            file,
            line: 0,
          });
        }
      } else if (framework === 'rust-axum') {
        // Match: .route("/path", get(handler))
        const axumPattern = /\.route\(['"]([^'"]+)['"]\),\s*([a-z_]+)\(/g;
        let match;
        while ((match = axumPattern.exec(content)) !== null) {
          routes.push({
            path: match[1],
            method: match[2] === 'get' ? 'get' : 'post',
            operation: match[1].split('/').pop() || 'index',
            tags: [match[1].split('/')[1] || 'default'],
            parameters: [],
            responses: { 200: { description: 'Success' } },
            file,
            line: 0,
          });
        }
      }
    }
  }

  // Scan TypeScript routes (generic)
  private async scanTypeScriptRoutes(routes: DiscoveredRoute[], options: {
    filePattern?: RegExp;
    decorators: string[];
    pathPatterns: RegExp[];
  }): Promise<void> {
    const pattern = options.filePattern || /\.ts$/;
    const files = await this.glob(this.projectPath, '**/*.ts');

    for (const file of files) {
      if (!pattern.test(file)) continue;

      const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for decorators
        for (const decorator of options.decorators) {
          if (line.includes(decorator)) {
            // Extract path from decorator
            for (const pattern of options.pathPatterns) {
              const match = line.match(pattern);
              if (match) {
                const routePath = match[1];
                const methodMatch = decorator.toLowerCase().replace('@', '');

                routes.push({
                  path: routePath.startsWith('/') ? routePath : `/${routePath}`,
                  method: methodMatch === 'get' ? 'get' : methodMatch,
                  operation: routePath.split('/').pop() || 'index',
                  tags: [routePath.split('/')[1] || 'api'],
                  parameters: [],
                  responses: { 200: { description: 'Success' } },
                  file,
                  line: i + 1,
                });
              }
            }
          }
        }
      }
    }
  }

  // Scan JavaScript routes (generic)
  private async scanJavaScriptRoutes(routes: DiscoveredRoute[], options: {
    patterns: RegExp[];
  }): Promise<void> {
    const files = await this.glob(this.projectPath, '**/*.{js,ts,jsx,tsx}');

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf-8');

      for (const pattern of options.patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const method = match[1];
          const routePath = match[2];

          routes.push({
            path: routePath.startsWith('/') ? routePath : `/${routePath}`,
            method,
            operation: routePath.split('/').pop() || 'index',
            tags: [routePath.split('/')[1] || 'api'],
            parameters: [],
            responses: { 200: { description: 'Success' } },
            file,
            line: 0,
          });
        }
      }
    }
  }

  // Simple glob implementation
  private async glob(basePath: string, pattern: string): Promise<string[]> {
    const results: string[] = [];

    // Handle brace expansion: {js,ts} -> ['js', 'ts']
    let patterns = [pattern];
    const braceMatch = pattern.match(/\{([^}]+)\}/);
    if (braceMatch) {
      const options = braceMatch[1].split(',');
      const prefix = pattern.substring(0, braceMatch.index);
      const suffix = pattern.substring(braceMatch.index + braceMatch[0].length);
      patterns = options.map(opt => prefix + opt + suffix);
    }

    for (const pat of patterns) {
      // Replace in correct order: ** first, then *, then escape special chars
      const regexPattern = pat
        .replace(/\*\*/g, '\x00') // Temporarily replace ** with placeholder
        .replace(/\*/g, '[^/]*')   // Then replace single *
        .replace(/\?/g, '[^/]')    // Replace ?
        .replace(/\./g, '\\.')     // Escape dots
        // eslint-disable-next-line no-control-regex
        .replace(/\x00/g, '.*');   // Finally restore ** to .*
      const regex = new RegExp('^' + regexPattern + '$');

      const scanDir = async (dir: string) => {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);
            const relativePath = path.relative(basePath, filePath);

            if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'vendor' && file !== 'target' && file !== 'build' && file !== 'dist') {
              await scanDir(filePath);
            } else if (stat.isFile() && regex.test(relativePath)) {
              if (!results.includes(relativePath)) {
                results.push(relativePath);
              }
            }
          }
        } catch {
          // Ignore errors
        }
      };

      await scanDir(basePath);
    }
    return results;
  }

  // Generate OpenAPI spec from discovered routes
  async generateSpec(options?: {
    info?: Partial<OpenAPIInfo>;
    tags?: OpenAPITag[];
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  }): Promise<OpenAPISpec> {
    const routes = await this.discoverRoutes();
    const projectName = path.basename(this.projectPath);

    // Group routes by path
    const pathItems: Record<string, OpenAPIPathItem> = {};
    for (const route of routes) {
      // Convert Express-style path params :id to OpenAPI format {id}
      const openapiPath = route.path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
      if (!pathItems[openapiPath]) {
        pathItems[openapiPath] = {};
      }
      pathItems[openapiPath][route.method] = {
        tags: route.tags,
        operationId: `${route.method}${openapiPath.replace(/\//g, '-')}`.replace(/^-/, ''),
        summary: route.operation,
        description: `${route.method.toUpperCase()} ${route.path}`,
        parameters: route.parameters,
        responses: route.responses,
      };
    }

    // Default info - options override defaults
    const info: OpenAPIInfo = {
      title: options?.info?.title || projectName,
      description: options?.info?.description || `Auto-generated API spec for ${projectName}`,
      version: options?.info?.version || '1.0.0',
      contact: options?.info?.contact,
      license: options?.info?.license,
    };

    // Default security schemes
    const securitySchemes: OpenAPIComponents['securitySchemes'] = {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
      ...options?.securitySchemes,
    };

    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info,
      servers: [
        { url: `http://localhost:${this.port}${this.basePath}`, description: 'Development server' },
      ],
      paths: pathItems,
      components: {
        schemas: {
          Error: {
            type: 'object',
            properties: {
              code: { type: 'integer', description: 'Error code' },
              message: { type: 'string', description: 'Error message' },
            },
          },
          HealthResponse: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
        securitySchemes,
      },
      security: [{ bearerAuth: [] }],
      tags: options?.tags || [],
    };

    return spec;
  }

  // Write OpenAPI spec to file
  async writeSpec(outputPath: string, format: 'yaml' | 'json' = 'yaml', options?: {
    info?: Partial<OpenAPIInfo>;
    tags?: OpenAPITag[];
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  }): Promise<void> {
    const spec = await this.generateSpec(options);
    await fs.ensureDir(path.dirname(outputPath));

    if (format === 'json') {
      await fs.writeJson(outputPath, spec, { spaces: 2 });
    } else {
      const yaml = await import('yaml');
      await fs.writeFile(outputPath, yaml.stringify(spec), 'utf-8');
    }
  }

  // Get annotation patterns for a framework
  getAnnotationPatterns(framework: string): FrameworkAnnotationPattern[] {
    const patterns: Record<string, FrameworkAnnotationPattern[]> = {
      express: [
        {
          framework: 'express',
          language: 'typescript',
          decorators: [],
          patterns: [/app\.(get|post|put|delete)\('([^']+)'\)/],
          commentStyle: 'line',
          exampleAnnotations: ["// app.get('/users', handler)", "// app.post('/users', handler)"],
        },
      ],
      nestjs: [
        {
          framework: 'nestjs',
          language: 'typescript',
          decorators: ['@Get', '@Post', '@Put', '@Patch', '@Delete'],
          patterns: [/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/],
          commentStyle: 'line',
          exampleAnnotations: [
            "@Get('users')",
            "@Post('users')",
            "  getUsers() {}",
          ],
        },
      ],
      fastapi: [
        {
          framework: 'fastapi',
          language: 'python',
          decorators: [],
          patterns: [/@app\.(get|post|put|patch|delete)\('([^']+)'\)/],
          commentStyle: 'line',
          exampleAnnotations: [
            "@app.get('/users')",
            "async def get_users():",
          ],
        },
      ],
      django: [
        {
          framework: 'django',
          language: 'python',
          decorators: [],
          patterns: [/path\(['"]([^'"]+)['"]\),\s*views/],
          commentStyle: 'line',
          exampleAnnotations: [
            "path('api/users/', views.user_list)",
            "def user_list(request):",
          ],
        },
      ],
      rails: [
        {
          framework: 'rails',
          language: 'ruby',
          decorators: [],
          patterns: [/\s*(get|post|put|patch|delete)\s+['"]([^'"`]+)['"]/],
          commentStyle: 'line',
          exampleAnnotations: [
            "get '/api/users' => 'users#index'",
          ],
        },
      ],
      'aspnet-core': [
        {
          framework: 'aspnet-core',
          language: 'csharp',
          decorators: ['[HttpGet]', '[HttpPost]', '[HttpPut]', '[HttpDelete]'],
          patterns: [/\[Http(Get|Post|Put|Patch|Delete)\]\(['"]([^'"]+)['"]\)/],
          commentStyle: 'line',
          exampleAnnotations: [
            "[HttpGet('/api/users')]",
            "public IActionResult GetUsers()",
          ],
        },
      ],
      spring: [
        {
          framework: 'spring',
          language: 'java',
          decorators: ['@GetMapping', '@PostMapping', '@PutMapping', '@DeleteMapping'],
          patterns: [/@(Get|Post|Put|Patch|Delete|Request)Mapping\(['"]([^'"]+)['"]\)/],
          commentStyle: 'line',
          exampleAnnotations: [
            "@GetMapping('/api/users')",
            "public ResponseEntity<List<User>> getUsers()",
          ],
        },
      ],
      gin: [
        {
          framework: 'gin',
          language: 'go',
          decorators: [],
          patterns: [/router\.(GET|POST|PUT|DELETE)\(['"]([^'"]+)['"]\)/],
          commentStyle: 'line',
          exampleAnnotations: [
            "router.GET('/users', getUsersHandler)",
          ],
        },
      ],
      'rust-actix': [
        {
          framework: 'actix',
          language: 'rust',
          decorators: [],
          patterns: [/\.route\(['"]([^'"]+)['"]\),\s*web::get/],
          commentStyle: 'line',
          exampleAnnotations: [
            ".route(\"/users\", web::get().to(get_users))",
          ],
        },
      ],
    };

    return patterns[framework] || [];
  }

  // Generate code with OpenAPI annotations
  generateAnnotatedCode(framework: string, options: {
    routePath?: string;
    method?: string;
    operation?: string;
    tags?: string[];
  }): string {
    type CodeOptions = {
      routePath: string;
      method: string;
      operation: string;
      tags: string[];
    };

    const opts: CodeOptions = {
      routePath: options.routePath || '/users',
      method: options.method || 'get',
      operation: options.operation || 'getUsers',
      tags: options.tags || ['api'],
    };

    const templates: Record<string, (opts: CodeOptions) => string> = {
      nestjs: (opts) => `@${opts.method}('${opts.routePath}')
  @ApiOperation({ summary: '${opts.operation}', tags: ['${opts.tags.join("', '") || 'api'}'] })
  @ApiResponse({ status: 200, description: 'Success' })
  async ${opts.operation}(): any {
    // TODO: Implement
    return {};
  }`,
      fastapi: (opts) => `@app.${opts.method}('${opts.routePath}')
async def ${opts.operation}():
    """
    ${opts.operation}
    """
    # TODO: Implement
    pass
`,
      rails: (opts) => `${opts.method} '${opts.routePath}', to: '${opts.operation}#index'
# GET /api/users -> users#index`,
      aspnet: (opts) => `[${opts.method.charAt(0).toUpperCase() + opts.method.slice(1)}]('${opts.routePath}')
[ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
public IActionResult ${opts.operation.charAt(0).toUpperCase() + opts.operation.slice(1)}()
{
    // TODO: Implement
    return Ok();
}`,
      gin: (opts) => `func main() {
    r := gin.Default()

    r.${opts.method.charAt(0).toUpperCase() + opts.method.slice(1)}('${opts.routePath}', func(c *gin.Context) {
        // TODO: Implement ${opts.operation}
        c.JSON(200, gin.H{})
    })

    r.Run(":8080")
}`,
    };

    const template = templates[framework];
    if (!template) {
      return `// OpenAPI annotations for ${framework} not yet implemented`;
    }

    return template(opts);
  }
}

// Factory functions

/**
 * Create OpenAPI generator
 */
export async function createOpenAPIGenerator(projectPath: string, framework?: string): Promise<OpenAPIGenerator> {
  return new OpenAPIGenerator(projectPath, framework);
}

/**
 * Generate and write OpenAPI spec
 */
export async function generateOpenAPISpec(
  projectPath: string,
  outputPath: string,
  options?: {
    framework?: string;
    info?: Partial<OpenAPIInfo>;
    format?: 'yaml' | 'json';
  }
): Promise<void> {
  const generator = await createOpenAPIGenerator(projectPath, options?.framework);
  await generator.writeSpec(outputPath, options?.format);
}

/**
 * Get supported frameworks for OpenAPI
 */
export function getSupportedFrameworks(): string[] {
  return [
    'express',
    'nestjs',
    'fastify',
    'fastapi',
    'django',
    'flask',
    'rails',
    'laravel',
    'aspnet-core',
    'spring-boot',
    'gin',
    'chi',
    'fiber',
    'actix',
    'axum',
  ];
}

/**
 * Format OpenAPI spec for display
 */
export function formatOpenAPISpec(spec: OpenAPISpec): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n📄 OpenAPI Specification'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\nTitle: ${chalk.blue(spec.info.title)}`);
  lines.push(`Version: ${chalk.gray(spec.info.version)}`);

  if (spec.info.description) {
    lines.push(`Description: ${chalk.gray(spec.info.description)}`);
  }

  if (spec.servers && spec.servers.length > 0) {
    lines.push(`\n${chalk.cyan('Servers:')}`);
    for (const server of spec.servers) {
      lines.push(`  • ${chalk.blue(server.url)}${server.description ? ` - ${chalk.gray(server.description)}` : ''}`);
    }
  }

  if (spec.tags && spec.tags.length > 0) {
    lines.push(`\n${chalk.cyan('Tags:')}`);
    for (const tag of spec.tags) {
      lines.push(`  • ${chalk.blue(tag.name)}${tag.description ? ` - ${chalk.gray(tag.description)}` : ''}`);
    }
  }

  const pathCount = Object.keys(spec.paths).length;
  lines.push(`\n${chalk.cyan('Endpoints:')}`);
  lines.push(`  Total: ${chalk.blue(String(pathCount))}`);

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = Object.keys(pathItem).filter(m => m !== 'parameters' && m !== 'servers' && m !== '$ref');
    for (const method of methods) {
      const operation = pathItem[method as keyof OpenAPIPathItem] as OpenAPIOperation;
      lines.push(`  ${chalk.green(method.toUpperCase().padEnd(6))} ${chalk.gray(path)} - ${chalk.blue(operation.summary || operation.operationId || '')}`);
    }
  }

  return lines.join('\n');
}
