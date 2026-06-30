/**
 * Swagger UI Integration Generator
 * Generates unified Swagger UI with custom branding and multi-service discovery
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Configuration options for the generated Swagger UI, including branding,
 * service list, and display behavior.
 */
// Swagger UI configuration
export interface SwaggerUIConfig {
  title: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeColor?: string;
  services: SwaggerUIService[];
  defaultService?: string;
  persistAuthorization?: boolean;
  tryItOutEnabled?: boolean;
  displayOperationId?: boolean;
  displayRequestDuration?: boolean;
  docExpansion?: 'list' | 'full' | 'none';
  filter?: boolean;
  maxDisplayedTags?: number;
  syntaxHighlight?: boolean;
  syntaxHighlightTheme?: 'agate' | 'arta' | 'monokai' | 'nord' | 'obsidian' | 'tomorrow-night';
}

/**
 * Describes a single API service entry surfaced in the Swagger UI, including
 * the spec location and display metadata.
 */
export interface SwaggerUIService {
  name: string;
  url?: string;
  specPath?: string; // Path to local spec file
  description?: string;
  version?: string;
  baseUrl?: string;
}

/**
 * Generates a complete, standalone HTML document hosting Swagger UI with
 * custom branding, theming, and multi-service navigation.
 * @param config - The Swagger UI configuration to render.
 * @returns A full HTML string ready to be written to disk.
 */
// Generate HTML for Swagger UI with custom branding
export function generateSwaggerUIHTML(config: SwaggerUIConfig): string {
  const services = config.services.map((s, i) => ({
    name: s.name,
    url: s.specPath ? undefined : s.url,
    specPath: s.specPath,
    description: s.description || s.name,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
  ${config.faviconUrl ? `<link rel="icon" href="${config.faviconUrl}" type="image/x-icon">` : ''}
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    :root {
      --theme-color: ${config.themeColor || '#3b82f6'};
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --border-color: #334155;
      --success-color: #22c55e;
      --warning-color: #f59e0b;
      --error-color: #ef4444;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    /* Custom header */
    .swagger-header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .swagger-header__logo {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .swagger-header__logo img {
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }

    .swagger-header__title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .swagger-header__description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }

    /* Service selector */
    .service-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .service-selector__select {
      padding: 0.5rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      cursor: pointer;
    }

    /* Swagger UI overrides */
    .swagger-ui {
      color: var(--text-primary);
    }

    .swagger-ui .information-container {
      background: var(--bg-secondary);
      padding: 1rem 2rem;
    }

    .swagger-ui .info {
      margin: 0;
    }

    .swagger-ui .info .title {
      color: var(--text-primary);
      font-size: 2rem;
    }

    .swagger-ui .info .description {
      color: var(--text-secondary);
    }

    .swagger-ui .opblock {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .swagger-ui .opblock .opblock-summary {
      border-color: var(--border-color);
      background: var(--bg-primary);
    }

    .swagger-ui .opblock .opblock-summary-description {
      color: var(--text-secondary);
    }

    .swagger-ui .opblock.opblock-get {
      border-color: var(--theme-color);
    }

    .swagger-ui .opblock.opblock-post {
      border-color: var(--success-color);
    }

    .swagger-ui .opblock.opblock-put {
      border-color: var(--warning-color);
    }

    .swagger-ui .opblock.opblock-delete {
      border-color: var(--error-color);
    }

    .swagger-ui .opblock-tag {
      color: var(--theme-color);
    }

    .swagger-ui .scheme-container {
      background: var(--bg-secondary);
      padding: 1rem 2rem;
    }

    .swagger-ui .loading-container {
      display: none;
    }

    .swagger-ui .btn {
      background: var(--theme-color);
      border-color: var(--theme-color);
      color: white;
    }

    .swagger-ui select {
      background: var(--bg-primary);
      border-color: var(--border-color);
      color: var(--text-primary);
    }

    .swagger-ui input[type="text"],
    .swagger-ui input[type="password"],
    .swagger-ui textarea {
      background: var(--bg-primary);
      border-color: var(--border-color);
      color: var(--text-primary);
    }

    .swagger-ui .response-control-media-type__title {
      color: var(--text-secondary);
    }

    .swagger-ui .tab li {
      color: var(--text-secondary);
    }

    .swagger-ui .tab li.active {
      color: var(--theme-color);
    }

    /* Loading state */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 1rem;
    }

    .loading__spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--theme-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Multi-service layout */
    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      padding: 2rem;
    }

    .service-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .service-card:hover {
      border-color: var(--theme-color);
      transform: translateY(-2px);
    }

    .service-card__name {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .service-card__description {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .service-card__version {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: var(--bg-primary);
      border-radius: 9999px;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .service-card__link {
      color: var(--theme-color);
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* Back button */
    .back-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      text-decoration: none;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .back-button:hover {
      border-color: var(--theme-color);
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>

  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    const config = ${JSON.stringify({
      title: config.title,
      description: config.description,
      services: services,
      defaultService: config.defaultService,
      persistAuthorization: config.persistAuthorization ?? true,
      tryItOutEnabled: config.tryItOutEnabled ?? true,
      displayOperationId: config.displayOperationId ?? false,
      displayRequestDuration: config.displayRequestDuration ?? true,
      docExpansion: config.docExpansion || 'list',
      filter: config.filter ?? true,
      maxDisplayedTags: config.maxDisplayedTags,
      syntaxHighlight: config.syntaxHighlight ?? true,
      syntaxHighlightTheme: config.syntaxHighlightTheme || 'monokai',
    })};

    // Check URL for service parameter
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service') || config.defaultService;

    // Multi-service home page
    function renderServiceGrid() {
      document.body.innerHTML = \`
        <div class="swagger-header">
          <div class="swagger-header__logo">
            ${config.logoUrl ? '<img src="' + config.logoUrl + '" alt="Logo">' : ''}
            <div>
              <h1 class="swagger-header__title">\${config.title}</h1>
              \${config.description ? '<p class="swagger-header__description">' + config.description + '</p>' : ''}
            </div>
          </div>
        </div>
        <div class="service-grid">
          \${config.services.map(service => \`
            <div class="service-card" onclick="window.location.href='?service=\${service.name}'">
              <div class="service-card__name">\${service.name}</div>
              \${service.description ? '<div class="service-card__description">' + service.description + '</div>' : ''}
              <span class="service-card__version">v\${service.version || '1.0'}</span>
              <span class="service-card__link">View API Documentation →</span>
            </div>
          \`).join('')}
        </div>
      \`;
    }

    // Render single service
    function renderService(serviceName) {
      const service = config.services.find(s => s.name === serviceName);
      if (!service) {
        renderServiceGrid();
        return;
      }

      const specUrl = service.specPath
        ? window.location.origin + window.location.pathname.replace('index.html', '') + service.specPath
        : service.url;

      // Add back button and header
      document.body.innerHTML = \`
        <div class="swagger-header">
          <a href="?" class="back-button">← All Services</a>
          <div class="service-selector">
            <select class="service-selector__select" onchange="window.location.href='?service=' + this.value">
              \${config.services.map(s => \`
                <option value="\${s.name}" \${s.name === serviceName ? 'selected' : ''}>\${s.name}</option>
              \`).join('')}
            </select>
          </div>
        </div>
        <div id="swagger-ui"></div>
      \`;

      const ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: config.persistAuthorization,
        tryItOutEnabled: config.tryItOutEnabled,
        displayOperationId: config.displayOperationId,
        displayRequestDuration: config.displayRequestDuration,
        docExpansion: config.docExpansion,
        filter: config.filter,
        maxDisplayedTags: config.maxDisplayedTags,
        syntaxHighlight: config.syntaxHighlight,
        syntaxHighlightTheme: {
          name: config.syntaxHighlightTheme
        },
        validatorUrl: null,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        onComplete: () => {
          console.log('Swagger UI loaded for service:', serviceName);
        },
        onError: (error) => {
          console.error('Swagger UI error:', error);
          document.getElementById('swagger-ui').innerHTML = \`
            <div style="padding: 2rem; text-align: center;">
              <h3 style="color: #ef4444;">Failed to load API specification</h3>
              <p style="color: #94a3b8;">Error: \${error.message}</p>
              <p style="color: #94a3b8;">Spec URL: \${specUrl}</p>
            </div>
          \`;
        }
      });

      window.ui = ui;
    }

    // Main routing
    if (serviceParam && config.services.find(s => s.name === serviceParam)) {
      renderService(serviceParam);
    } else if (config.services.length === 1) {
      renderService(config.services[0].name);
    } else {
      renderServiceGrid();
    }
  </script>
</body>
</html>`;
}

/**
 * Builds and persists a Swagger UI site, managing the output path, config,
 * and registered services.
 */
// Swagger UI Generator Class
export class SwaggerUIGenerator {
  private outputPath: string;
  private config: SwaggerUIConfig;

  /**
   * Creates a new generator targeting the given output file path.
   * @param outputPath - Absolute or relative path where the HTML will be written.
   * @param config - Swagger UI configuration to use for generation.
   */
  constructor(outputPath: string, config: SwaggerUIConfig) {
    this.outputPath = outputPath;
    this.config = config;
  }

  /**
   * Writes the generated Swagger UI HTML to the configured output path,
   * creating parent directories as needed.
   * @returns Resolves once the file has been written.
   */
  // Generate Swagger UI files
  async generate(): Promise<void> {
    await fs.ensureDir(path.dirname(this.outputPath));

    // Generate HTML
    const html = generateSwaggerUIHTML(this.config);
    await fs.writeFile(this.outputPath, html, 'utf-8');
  }

  /**
   * Adds a service or replaces an existing one with the same name.
   * @param service - The service definition to register.
   */
  // Add service to existing config
  addService(service: SwaggerUIService): void {
    const existing = this.config.services.findIndex(s => s.name === service.name);
    if (existing >= 0) {
      this.config.services[existing] = service;
    } else {
      this.config.services.push(service);
    }
  }

  /**
   * Produces HTML markup for the service cards shown on the multi-service
   * landing page.
   * @returns A string of HTML for all configured service cards.
   */
  // Generate service card HTML for multi-service view
  generateServiceCardHTML(): string {
    return this.config.services.map(service => `
      <div class="service-card">
        <div class="service-card__name">${service.name}</div>
        ${service.description ? `<div class="service-card__description">${service.description}</div>` : ''}
        <a href="?service=${service.name}" class="service-card__link">View Documentation →</a>
      </div>
    `).join('');
  }

  /**
   * Serializes the current configuration as a pretty-printed JSON string
   * suitable for embedding in another application.
   * @returns A formatted JSON representation of the config.
   */
  // Generate config for embedding in existing app
  generateEmbedConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }
}

/**
 * Factory that creates a configured `SwaggerUIGenerator` instance.
 * @param outputPath - Path where the generated HTML will be written.
 * @param config - Swagger UI configuration to apply.
 * @returns A promise resolving to the new generator.
 */
// Factory functions
export async function createSwaggerUI(outputPath: string, config: SwaggerUIConfig): Promise<SwaggerUIGenerator> {
  return new SwaggerUIGenerator(outputPath, config);
}

/**
 * Convenience helper that creates a generator and immediately writes the
 * Swagger UI files to disk.
 * @param outputPath - Path where the generated HTML will be written.
 * @param config - Swagger UI configuration to apply.
 * @returns Resolves once generation and file writing complete.
 */
export async function generateSwaggerUI(outputPath: string, config: SwaggerUIConfig): Promise<void> {
  const generator = await createSwaggerUI(outputPath, config);
  await generator.generate();
}

/**
 * Returns the available theme color presets keyed by identifier.
 * @returns A map of preset keys to their color and display name.
 */
// Get default theme colors
export function getThemePresets(): Record<string, { color: string; name: string }> {
  return {
    blue: { color: '#3b82f6', name: 'Blue' },
    green: { color: '#22c55e', name: 'Green' },
    purple: { color: '#a855f7', name: 'Purple' },
    red: { color: '#ef4444', name: 'Red' },
    orange: { color: '#f97316', name: 'Orange' },
    pink: { color: '#ec4899', name: 'Pink' },
    cyan: { color: '#06b6d4', name: 'Cyan' },
    slate: { color: '#64748b', name: 'Slate' },
  };
}

/**
 * Scans the `apps` and `packages` directories of a project for OpenAPI spec
 * files and returns one service entry per discovered spec.
 * @param projectPath - Root path of the project to scan.
 * @returns A promise resolving to the detected service definitions.
 */
// Auto-detect services from workspace
export async function detectServices(projectPath: string): Promise<SwaggerUIService[]> {
  const services: SwaggerUIService[] = [];
  const appsPath = path.join(projectPath, 'apps');
  const packagesPath = path.join(projectPath, 'packages');

  // Scan for openapi.yaml or openapi.json files
  const scanDir = async (dir: string) => {
    if (!(await fs.pathExists(dir))) return;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && (entry.name === 'openapi.yaml' || entry.name === 'openapi.json')) {
        const serviceName = path.basename(path.dirname(fullPath));
        const specPath = path.relative(projectPath, fullPath);

        services.push({
          name: serviceName,
          specPath: specPath,
          description: `API documentation for ${serviceName}`,
          version: '1.0.0',
        });
      }
    }
  };

  await scanDir(appsPath);
  await scanDir(packagesPath);

  return services;
}

/**
 * Formats a Swagger UI configuration as a human-readable, colorized string
 * suitable for CLI output.
 * @param config - The configuration to format.
 * @returns A formatted string summarizing the config.
 */
// Format for display
export function formatSwaggerUIConfig(config: SwaggerUIConfig): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n📚 Swagger UI Configuration'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\n${chalk.blue('Title:')} ${config.title}`);
  if (config.description) {
    lines.push(`${chalk.blue('Description:')} ${config.description}`);
  }

  lines.push(`\n${chalk.blue('Services:')} ${config.services.length}`);
  for (const service of config.services) {
    lines.push(`  ${chalk.gray('•')} ${chalk.yellow(service.name)}`);
    if (service.description) {
      lines.push(`    ${chalk.gray(service.description)}`);
    }
    if (service.url || service.specPath) {
      lines.push(`    ${chalk.gray('URL/Spec:')} ${service.url || service.specPath}`);
    }
  }

  lines.push(`\n${chalk.blue('Options:')}`);
  lines.push(`  ${chalk.gray('Try It Out:')} ${config.tryItOutEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`  ${chalk.gray('Persist Auth:')} ${config.persistAuthorization ? 'Enabled' : 'Disabled'}`);
  lines.push(`  ${chalk.gray('Filter:')} ${config.filter ? 'Enabled' : 'Disabled'}`);

  return lines.join('\n');
}
