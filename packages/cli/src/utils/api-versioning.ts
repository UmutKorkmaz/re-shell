/**
 * API Versioning Patterns and Backwards Compatibility Management
 * Supports URL versioning, header versioning, and content negotiation
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Versioning strategies
export type VersioningStrategy = 'url' | 'header' | 'query' | 'content-type' | 'none';

export interface APIVersion {
  version: string;
  status: 'active' | 'deprecated' | 'sunset' | 'retired';
  introducedAt: string; // ISO date
  deprecatedAt?: string; // ISO date
  sunsetAt?: string; // ISO date
  supportedUntil?: string; // ISO date
  migrationGuide?: string;
  breakingChanges: BreakingChange[];
}

export interface BreakingChange {
  field: string;
  type: 'field-removed' | 'type-changed' | 'required-added' | 'enum-changed' | 'endpoint-removed' | 'response-changed';
  description: string;
  migrationPath?: string;
}

export interface VersioningConfig {
  strategy: VersioningStrategy;
  defaultVersion: string;
  headerName?: string; // For header-based versioning
  queryParam?: string; // For query-based versioning
  versions: APIVersion[];
  deprecationPolicy: DeprecationPolicy;
}

export interface DeprecationPolicy {
  warningPeriod: number; // days
  sunsetPeriod: number; // days
  notifyUsers: boolean;
  addDeprecationHeaders: boolean;
}

// Route versioning patterns
export interface VersionedRoute {
  path: string;
  method: string;
  versions: string[];
  deprecatedIn?: string;
  removedIn?: string;
  alternatives?: VersionedRoute[];
}

// Versioning pattern templates for different frameworks
export interface FrameworkVersioningTemplate {
  framework: string;
  language: string;
  urlPattern: string; // e.g., /api/v{version}/users
  headerPattern: string;
  middlewarePattern: string;
  exampleCode: string;
}

// Common breaking change detection patterns
export const BREAKING_CHANGE_PATTERNS = {
  fieldRemoved: /removed\s+(\w+)\s+field/i,
  typeChanged: /changed\s+(\w+)\s+type\s+from\s+(\w+)\s+to\s+(\w+)/i,
  requiredAdded: /(\w+)\s+is\s+now\s+required/i,
  endpointRemoved: /removed\s+(GET|POST|PUT|DELETE|PATCH)\s+([\w/]+)/i,
  responseChanged: /response\s+structure\s+changed/i,
};

// Get versioning patterns for a framework
export function getVersioningTemplate(framework: string): FrameworkVersioningTemplate | undefined {
  const templates: Record<string, FrameworkVersioningTemplate> = {
    express: {
      framework: 'express',
      language: 'typescript',
      urlPattern: '/api/v${version}/route',
      headerPattern: 'Accept: application/vnd.api+json; version=${version}',
      middlewarePattern: 'app.use(versionMiddleware)',
      exampleCode: `// URL-based versioning
app.get('/api/v1/users', getUsersV1);
app.get('/api/v2/users', getUsersV2);

// Header-based versioning middleware
function versionMiddleware(req: any, res: any, next: any) {
  const acceptHeader = req.headers['accept'];
  const version = acceptHeader?.match(/version=(\\d+)/)?.[1] || '1';
  req.apiVersion = version;
  next();
}`,
    },
    nestjs: {
      framework: 'nestjs',
      language: 'typescript',
      urlPattern: '/api/v${version}/route',
      headerPattern: 'Accept: application/vnd.api+json; version=${version}',
      middlewarePattern: '@UseGuards(ApiVersionGuard)',
      exampleCode: `// Controller versioning
@Controller('v1/users')
export class UsersControllerV1 {
  @Get()
  getUsers() {
    return [];
  }
}

@Controller('v2/users')
export class UsersControllerV2 {
  @Get()
  getUsers() {
    return []; // Enhanced response
  }
}`,
    },
    fastapi: {
      framework: 'fastapi',
      language: 'python',
      urlPattern: '/api/v{version}/route',
      headerPattern: 'X-API-Version: {version}',
      middlewarePattern: '@app.middleware("http")',
      exampleCode: `# URL-based versioning
@app.get("/api/v1/users")
async def get_users_v1():
    return []

@app.get("/api/v2/users")
async def get_users_v2():
    return []  # Enhanced response

# Header-based versioning
@app.middleware("http")
async def api_version_middleware(request: Request, call_next):
    version = request.headers.get("X-API-Version", "1")
    request.state.api_version = version
    response = await call_next(request)
    return response`,
    },
    django: {
      framework: 'django',
      language: 'python',
      urlPattern: '/api/v{version}/route',
      headerPattern: 'X-API-Version: {version}',
      middlewarePattern: 'class VersionMiddleware',
      exampleCode: `# urls.py - URL namespace versioning
urlpatterns = [
    path('api/v1/users', views_v1.users),
    path('api/v2/users', views_v2.users),
]

# Middleware for header versioning
class VersionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        version = request.headers.get('X-API-Version', '1')
        request.api_version = version
        return self.get_response(request)`,
    },
    'aspnet-core': {
      framework: 'aspnet-core',
      language: 'csharp',
      urlPattern: '/api/v{version}/route',
      headerPattern: 'X-API-Version: {version}',
      middlewarePattern: 'app.UseMiddleware<ApiVersionMiddleware>()',
      exampleCode: `// Controller versioning with URL
[ApiController]
[Route("api/v1/[controller]")]
public class UsersControllerV1 : ControllerBase {
    [HttpGet]
    public IActionResult GetUsers() => Ok(new List<User>());
}

[ApiController]
[Route("api/v2/[controller]")]
public class UsersControllerV2 : ControllerBase {
    [HttpGet]
    public IActionResult GetUsers() => Ok(new List<UserDto>());
}

// Or use ApiVersioning attribute
[ApiVersion("1.0")]
[ApiVersion("2.0")]`,
    },
    'spring-boot': {
      framework: 'spring-boot',
      language: 'java',
      urlPattern: '/api/v${version}/route',
      headerPattern: 'X-API-Version: ${version}',
      middlewarePattern: '@ControllerAdvice',
      exampleCode: `// RestController with versioning
@RestController
@RequestMapping("/api/v1/users")
public class UsersControllerV1 {
    @GetMapping
    public List<User> getUsers() {
        return new ArrayList<>();
    }
}

// Header-based versioning
@RestController
@RequestMapping("/api/users")
public class UsersController {
    @GetMapping
    @RequestMapping(headers = "X-API-Version=1")
    public List<User> getUsersV1() {
        return new ArrayList<>();
    }

    @GetMapping
    @RequestMapping(headers = "X-API-Version=2")
    public List<UserDTO> getUsersV2() {
        return new ArrayList<>();
    }
}`,
    },
    gin: {
      framework: 'gin',
      language: 'go',
      urlPattern: '/api/v{version}/route',
      headerPattern: 'X-API-Version: {version}',
      middlewarePattern: 'r.Use(ApiVersionMiddleware())',
      exampleCode: `// URL-based versioning
v1 := r.Group("/api/v1")
v1.GET("/users", getUsersV1)

v2 := r.Group("/api/v2")
v2.GET("/users", getUsersV2)

// Middleware for header versioning
func ApiVersionMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        version := c.GetHeader("X-API-Version")
        if version == "" {
            version = "1"
        }
        c.Set("apiVersion", version)
        c.Next()
    }
}`,
    },
    'rust-actix': {
      framework: 'actix',
      language: 'rust',
      urlPattern: '/api/v{version}/route',
      headerPattern: 'X-API-Version: {version}',
      middlewarePattern: '.wrap(middleware::VersionMiddleware)',
      exampleCode: `// URL-based versioning
HttpServer::new(move || {
    App::new()
        .service("/api/v1/users")
        .route(HttpMethod::GET, get_users_v1)
        .service("/api/v2/users")
        .route(HttpMethod::GET, get_users_v2)
})`,
    },
  };

  return templates[framework];
}

// Generate versioned route code
export function generateVersionedRoute(framework: string, options: {
  routePath: string;
  method: string;
  versions: string[];
  strategy?: VersioningStrategy;
}): string {
  const template = getVersioningTemplate(framework);
  if (!template) {
    return `// Versioning template not available for ${framework}`;
  }

  const routePath = options.routePath.startsWith('/') ? options.routePath : `/${options.routePath}`;
  const strategy = options.strategy || 'url';

  let code = '';
  const versions = options.versions.length > 0 ? options.versions : ['1', '2'];

  if (strategy === 'url') {
    code = `// URL-based versioning for ${options.method.toUpperCase()} ${routePath}\n`;
    for (const v of versions) {
      code += `${template.exampleCode.split('\n')[0]}${routePath.replace('/api/', `/api/v${v}/`) || routePath + '/v' + v}\n`;
    }
  } else if (strategy === 'header') {
    code = `// Header-based versioning for ${options.method.toUpperCase()} ${routePath}\n`;
    code += `// Header: ${template.headerPattern}\n`;
    for (const v of versions) {
      code += `// Version ${v} handler\n`;
    }
  }

  return code + template.exampleCode;
}

// Detect breaking changes between two API specs
export function detectBreakingChanges(oldSpec: any, newSpec: any): BreakingChange[] {
  const changes: BreakingChange[] = [];

  // Check for removed endpoints
  if (oldSpec.paths && newSpec.paths) {
    for (const path of Object.keys(oldSpec.paths)) {
      if (!newSpec.paths[path]) {
        changes.push({
          field: path,
          type: 'endpoint-removed',
          description: `Endpoint ${path} was removed`,
          migrationPath: `Consider keeping ${path} with deprecated status`,
        });
        continue;
      }

      // Check for removed methods
      const oldPath = oldSpec.paths[path];
      const newPath = newSpec.paths[path];
      for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        if (oldPath[method] && !newPath[method]) {
          changes.push({
            field: `${path.toUpperCase()} ${method}`,
            type: 'endpoint-removed',
            description: `Method ${method.toUpperCase()} ${path} was removed`,
          });
        }
      }

      // Check for changed required parameters
      if (oldPath.get?.parameters && newPath.get?.parameters) {
        const oldParams = oldPath.get.parameters;
        const newParams = newPath.get.parameters;

        for (const newParam of newParams) {
          const oldParam = oldParams.find((p: any) => p.name === newParam.name);
          if (!oldParam && newParam.required) {
            changes.push({
              field: newParam.name,
              type: 'required-added',
              description: `Required parameter '${newParam.name}' was added to ${path}`,
            });
          }
          if (oldParam && oldParam.required !== newParam.required && newParam.required) {
            changes.push({
              field: newParam.name,
              type: 'required-added',
              description: `Parameter '${newParam.name}' became required in ${path}`,
            });
          }
        }
      }
    }
  }

  // Check for removed schema properties
  if (oldSpec.components?.schemas && newSpec.components?.schemas) {
    for (const [schemaName, oldSchema] of Object.entries(oldSpec.components.schemas)) {
      const newSchema = newSpec.components.schemas[schemaName] as any;
      if (!newSchema) continue;

      const oldSchemaTyped = oldSchema as any;
      if (oldSchemaTyped.properties && newSchema.properties) {
        for (const propName of Object.keys(oldSchemaTyped.properties)) {
          if (!newSchema.properties[propName]) {
            const wasRequired = Array.isArray(oldSchemaTyped.required) && oldSchemaTyped.required.includes(propName);
            changes.push({
              field: `${schemaName}.${propName}`,
              type: 'field-removed',
              description: `Property '${propName}' was removed from ${schemaName}`,
              migrationPath: wasRequired ? `This is a breaking change - consider keeping with null default` : undefined,
            });
          }
        }
      }
    }
  }

  return changes;
}

// Calculate deprecation timeline
export function calculateDeprecationTimeline(apiVersion: APIVersion): {
  deprecationDate?: Date;
  sunsetDate?: Date;
  retirementDate?: Date;
  daysUntilSunset?: number;
  status: 'active' | 'warning' | 'critical' | 'expired';
} {
  const now = new Date();
  const result: any = { status: 'active' as const };

  if (apiVersion.deprecatedAt) {
    result.deprecationDate = new Date(apiVersion.deprecatedAt);
    const daysSinceDeprecation = Math.floor((now.getTime() - result.deprecationDate.getTime()) / (1000 * 60 * 60 * 24));

    if (apiVersion.sunsetAt) {
      result.sunsetDate = new Date(apiVersion.sunsetAt);
      result.daysUntilSunset = Math.floor((result.sunsetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (result.daysUntilSunset < 0) {
        result.status = 'expired';
      } else if (result.daysUntilSunset < 30) {
        result.status = 'critical';
      } else if (result.daysUntilSunset < 90) {
        result.status = 'warning';
      }
    }
  }

  if (apiVersion.supportedUntil) {
    result.retirementDate = new Date(apiVersion.supportedUntil);
  }

  return result;
}

// Generate migration guide between versions
export function generateMigrationGuide(fromVersion: string, toVersion: string, breakingChanges: BreakingChange[]): string {
  const lines: string[] = [];

  lines.push(`# Migration Guide: ${fromVersion} → ${toVersion}`);
  lines.push('');
  lines.push('## Breaking Changes');
  lines.push('');

  if (breakingChanges.length === 0) {
    lines.push('No breaking changes. You can safely upgrade!');
  } else {
    for (const change of breakingChanges) {
      lines.push(`### ${change.field}`);
      lines.push(`**Type:** ${change.type}`);
      lines.push(`**Description:** ${change.description}`);
      if (change.migrationPath) {
        lines.push(`**Migration:** ${change.migrationPath}`);
      }
      lines.push('');
    }

    lines.push('## Migration Steps');
    lines.push('');
    lines.push('1. Review breaking changes above');
    lines.push('2. Update your API calls');
    lines.push('3. Test against the new version');
    lines.push('4. Deploy changes gradually');
  }

  return lines.join('\n');
}

// Versioning configuration generator class
export class APIVersioningGenerator {
  private projectPath: string;
  private framework?: string;

  constructor(projectPath: string, framework?: string) {
    this.projectPath = projectPath;
    this.framework = framework;
  }

  // Generate versioning configuration
  generateVersioningConfig(options: Partial<VersioningConfig> = {}): VersioningConfig {
    return {
      strategy: options.strategy || 'url',
      defaultVersion: options.defaultVersion || '1',
      headerName: options.headerName || 'X-API-Version',
      queryParam: options.queryParam || 'version',
      versions: options.versions || [
        {
          version: '1',
          status: 'active',
          introducedAt: new Date().toISOString().split('T')[0],
          breakingChanges: [],
        },
      ],
      deprecationPolicy: options.deprecationPolicy || {
        warningPeriod: 90,
        sunsetPeriod: 180,
        notifyUsers: true,
        addDeprecationHeaders: true,
      },
    };
  }

  // Write versioning config file
  async writeConfig(outputPath: string, config: VersioningConfig): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, config, { spaces: 2 });
  }

  // Generate middleware for the framework
  generateVersioningMiddleware(strategy: VersioningStrategy): string {
    const templates: Record<VersioningStrategy, string> = {
      url: this.generateURLVersioningMiddleware(),
      header: this.generateHeaderVersioningMiddleware(),
      query: this.generateQueryVersioningMiddleware(),
      'content-type': this.generateContentTypeVersioningMiddleware(),
      none: '// No versioning middleware',
    };

    return templates[strategy];
  }

  private generateURLVersioningMiddleware(): string {
    return `// URL-based versioning is handled by route structure
// Example: /api/v1/users, /api/v2/users

// Redirect to latest version if no version specified
app.use('/api', (req, res, next) => {
  if (!req.path.match(/^\\/v\\d+/)) {
    return res.redirect(302, req.path.replace('/api', '/api/v1'));
  }
  next();
});`;
  }

  private generateHeaderVersioningMiddleware(): string {
    return `// Header-based versioning middleware
function apiVersionMiddleware(req, res, next) {
  const version = req.headers['x-api-version'] || '1';

  // Validate version
  const supportedVersions = ['1', '2'];
  if (!supportedVersions.includes(version)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      supportedVersions,
    });
  }

  req.apiVersion = version;

  // Add version to response headers
  res.setHeader('X-API-Version', version);

  next();
}

app.use(apiVersionMiddleware);`;
  }

  private generateQueryVersioningMiddleware(): string {
    return `// Query-based versioning middleware
function apiVersionMiddleware(req, res, next) {
  const version = req.query.version || req.headers['x-api-version'] || '1';

  req.apiVersion = version;
  res.setHeader('X-API-Version', version);

  next();
}

app.use(apiVersionMiddleware);`;
  }

  private generateContentTypeVersioningMiddleware(): string {
    return `// Content-Type based versioning
function apiVersionMiddleware(req, res, next) {
  const accept = req.headers['accept'] || '';

  // Extract version from Accept header
  // e.g., application/vnd.api+json; version=2
  const versionMatch = accept.match(/version=(\\d+)/);
  const version = versionMatch ? versionMatch[1] : '1';

  req.apiVersion = version;
  res.setHeader('X-API-Version', version);

  next();
}

app.use(apiVersionMiddleware);`;
  }

  // Generate deprecation warning headers
  generateDeprecationHeaders(apiVersion: APIVersion): string {
    const lines: string[] = [];

    if (apiVersion.status === 'deprecated') {
      lines.push('// Add deprecation headers');
      lines.push(`res.setHeader('Deprecation', 'true');`);
      if (apiVersion.sunsetAt) {
        lines.push(`res.setHeader('Sunset', '${new Date(apiVersion.sunsetAt).toUTCString()}');`);
      }
      if (apiVersion.deprecatedAt) {
        lines.push(`res.setHeader('Link', '<${apiVersion.migrationGuide || '/docs/migration'}>; rel="deprecation"; type="text/html"');`);
      }
    }

    return lines.join('\n');
  }

  // Get all supported frameworks for versioning
  getSupportedFrameworks(): string[] {
    return Object.keys({
      express: true,
      nestjs: true,
      fastapi: true,
      django: true,
      'aspnet-core': true,
      'spring-boot': true,
      gin: true,
      'rust-actix': true,
    });
  }
}

// Factory functions
export async function createVersioningGenerator(projectPath: string, framework?: string): Promise<APIVersioningGenerator> {
  return new APIVersioningGenerator(projectPath, framework);
}

export async function generateVersioningConfig(
  projectPath: string,
  outputPath: string,
  options?: Partial<VersioningConfig>
): Promise<void> {
  const generator = await createVersioningGenerator(projectPath);
  const config = generator.generateVersioningConfig(options);
  await generator.writeConfig(outputPath, config);
}

// Format for display
export function formatVersioningConfig(config: VersioningConfig): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n📋 API Versioning Configuration'));
  lines.push(chalk.gray('═'.repeat(60)));

  lines.push(`\n${chalk.blue('Strategy:')} ${chalk.yellow(config.strategy)}`);
  lines.push(`${chalk.blue('Default Version:')} ${chalk.yellow('v' + config.defaultVersion)}`);

  if (config.headerName) {
    lines.push(`${chalk.blue('Header Name:')} ${chalk.gray(config.headerName)}`);
  }

  lines.push(`\n${chalk.blue('Versions:')} ${config.versions.length}`);
  for (const version of config.versions) {
    const statusColor = version.status === 'active' ? chalk.green : version.status === 'deprecated' ? chalk.yellow : chalk.red;
    lines.push(`  ${chalk.gray('•')} v${version.version} - ${statusColor(version.status)}`);
    if (version.deprecatedAt) {
      lines.push(`    ${chalk.gray('Deprecated:')} ${version.deprecatedAt}`);
    }
    if (version.sunsetAt) {
      lines.push(`    ${chalk.gray('Sunset:')} ${version.sunsetAt}`);
    }
  }

  lines.push(`\n${chalk.blue('Deprecation Policy:')} `);
  lines.push(`  ${chalk.gray('Warning Period:')} ${config.deprecationPolicy.warningPeriod} days`);
  lines.push(`  ${chalk.gray('Sunset Period:')} ${config.deprecationPolicy.sunsetPeriod} days`);

  return lines.join('\n');
}

export function formatBreakingChanges(changes: BreakingChange[]): string {
  if (changes.length === 0) {
    return chalk.green('\n✓ No breaking changes detected\n');
  }

  const lines: string[] = [];
  lines.push(chalk.yellow(`\n⚠️  Found ${changes.length} breaking change(s)\n`));

  for (const change of changes) {
    const typeColor = change.type === 'endpoint-removed' ? chalk.red : change.type === 'required-added' ? chalk.yellow : chalk.hex('#f97316');
    lines.push(`${chalk.gray('•')} ${typeColor(change.type)}: ${chalk.cyan(change.field)}`);
    lines.push(`  ${chalk.gray(change.description)}`);
    if (change.migrationPath) {
      lines.push(`  ${chalk.blue('Migration:')} ${chalk.gray(change.migrationPath)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
