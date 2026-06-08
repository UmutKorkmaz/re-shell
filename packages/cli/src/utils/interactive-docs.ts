/**
 * Interactive API Documentation Generator
 * Generates interactive documentation with live examples and try-it functionality
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Documentation configuration interfaces
export interface InteractiveDocsConfig {
  title: string;
  description?: string;
  version: string;
  baseUrl: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeColor?: string;
  authConfig?: AuthConfig;
  endpoints: APIDocumentationEndpoint[];
  groups?: APIGroup[];
  examplesEnabled?: boolean;
  tryItEnabled?: boolean;
  responseViewerEnabled?: boolean;
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'apiKey' | 'oauth2';
  bearer?: {
    token?: string;
    prefix?: string;
  };
  basic?: {
    username?: string;
    password?: string;
  };
  apiKey?: {
    name: string;
    in: 'header' | 'query';
    value?: string;
  };
  oauth2?: {
    clientId: string;
    authorizationUrl: string;
    tokenUrl: string;
    scopes: Record<string, string>;
  };
}

export interface APIDocumentationEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  group?: string;
  authRequired?: boolean;
  parameters?: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  examples?: APIExample[];
  tryIt?: TryItConfig;
}

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  enum?: string[];
  default?: any;
  example?: any;
  schema?: any;
}

export interface APIRequestBody {
  description?: string;
  required: boolean;
  contentType: string;
  schema?: any;
  examples?: Record<string, any>;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
  headers?: Record<string, { description: string; schema: any }>;
}

export interface APIExample {
  name: string;
  description?: string;
  request: {
    parameters?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
  };
  response: {
    statusCode: number;
    body: any;
    headers?: Record<string, string>;
  };
}

export interface TryItConfig {
  enabled: boolean;
  mockResponse?: boolean;
  mockDelay?: number;
  defaultHeaders?: Record<string, string>;
}

export interface APIGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
}

// Generate interactive HTML documentation
export function generateInteractiveDocsHTML(config: InteractiveDocsConfig): string {
  const themeColor = config.themeColor || '#3b82f6';
  const groups = config.groups || [];
  const endpointsByGroup = config.endpoints.reduce((acc, endpoint) => {
    const group = endpoint.group || 'default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(endpoint);
    return acc;
  }, {} as Record<string, APIDocumentationEndpoint[]>);

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
      --theme-color: ${themeColor};
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --border-color: #334155;
      --success-color: #22c55e;
      --warning-color: #f59e0b;
      --error-color: #ef4444;
      --info-color: #3b82f6;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }

    /* Layout */
    .docs-layout {
      display: grid;
      grid-template-columns: 280px 1fr 400px;
      grid-template-rows: auto 1fr;
      height: 100vh;
      overflow: hidden;
    }

    /* Header */
    .docs-header {
      grid-column: 1 / -1;
      grid-row: 1;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
    }

    .docs-header__logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .docs-header__logo img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
    }

    .docs-header__title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .docs-header__version {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .docs-header__actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Sidebar */
    .docs-sidebar {
      grid-column: 1;
      grid-row: 2;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
      padding: 1rem;
    }

    .docs-sidebar__search {
      margin-bottom: 1rem;
    }

    .docs-sidebar__search input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
    }

    .docs-sidebar__search input:focus {
      outline: none;
      border-color: var(--theme-color);
    }

    .docs-sidebar__group {
      margin-bottom: 1.5rem;
    }

    .docs-sidebar__group-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
      padding: 0 0.5rem;
    }

    .docs-sidebar__endpoint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 0.875rem;
    }

    .docs-sidebar__endpoint:hover {
      background: var(--bg-tertiary);
    }

    .docs-sidebar__endpoint.active {
      background: var(--theme-color);
      color: white;
    }

    .docs-sidebar__method {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .docs-sidebar__method.get { background: var(--info-color); }
    .docs-sidebar__method.post { background: var(--success-color); }
    .docs-sidebar__method.put { background: var(--warning-color); }
    .docs-sidebar__method.patch { background: var(--warning-color); }
    .docs-sidebar__method.delete { background: var(--error-color); }

    /* Main Content */
    .docs-main {
      grid-column: 2;
      grid-row: 2;
      overflow-y: auto;
      padding: 2rem;
    }

    .docs-main__endpoint {
      margin-bottom: 3rem;
    }

    .docs-main__endpoint-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .docs-main__method {
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .docs-main__method.get { background: var(--info-color); }
    .docs-main__method.post { background: var(--success-color); }
    .docs-main__method.put { background: var(--warning-color); }
    .docs-main__method.patch { background: var(--warning-color); }
    .docs-main__method.delete { background: var(--error-color); }

    .docs-main__path {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 1rem;
      color: var(--info-color);
    }

    .docs-main__summary {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .docs-main__description {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }

    /* Parameters Section */
    .docs-main__section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .docs-main__section-title {
      padding: 0.75rem 1rem;
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .docs-main__section-content {
      padding: 1rem;
    }

    .docs-main__parameter {
      display: grid;
      grid-template-columns: 150px 1fr auto;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border-color);
    }

    .docs-main__parameter:last-child {
      border-bottom: none;
    }

    .docs-main__parameter-name {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.875rem;
    }

    .docs-main__parameter-required {
      color: var(--error-color);
      font-size: 0.75rem;
    }

    .docs-main__parameter-type {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--bg-primary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }

    /* Try It Panel */
    .docs-tryit {
      grid-column: 3;
      grid-row: 2;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .docs-tryit__header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .docs-tryit__title {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .docs-tryit__content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .docs-tryit__section {
      margin-bottom: 1.5rem;
    }

    .docs-tryit__section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 0.75rem;
    }

    .docs-tryit__input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .docs-tryit__input:focus {
      outline: none;
      border-color: var(--theme-color);
    }

    .docs-tryit__button {
      padding: 0.5rem 1rem;
      background: var(--theme-color);
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      width: 100%;
    }

    .docs-tryit__button:hover {
      opacity: 0.9;
    }

    .docs-tryit__button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .docs-tryit__response {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
    }

    .docs-tryit__response-status {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: inline-block;
    }

    .docs-tryit__response-status.success { background: var(--success-color); }
    .docs-tryit__response-status.error { background: var(--error-color); }

    /* Examples */
    .docs-example {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .docs-example__title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-secondary);
    }

    .docs-example__code {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
    }

    /* Auth Modal */
    .docs-auth-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .docs-auth-modal__content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      width: 400px;
      max-width: 90%;
    }

    .docs-auth-modal__title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    /* Code Editor */
    .docs-code-editor {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      width: 100%;
      min-height: 150px;
      color: var(--text-primary);
      resize: vertical;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .docs-layout {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr auto;
      }

      .docs-sidebar {
        display: none;
      }

      .docs-tryit {
        border-left: none;
        border-top: 1px solid var(--border-color);
        max-height: 50vh;
      }
    }
  </style>
</head>
<body>
  <div class="docs-layout">
    <!-- Header -->
    <header class="docs-header">
      <div class="docs-header__logo">
        ${config.logoUrl ? `<img src="${config.logoUrl}" alt="Logo">` : ''}
        <div>
          <div class="docs-header__title">${config.title}</div>
          ${config.description ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${config.description}</div>` : ''}
        </div>
        <span class="docs-header__version">${config.version}</span>
      </div>
      <div class="docs-header__actions">
        <button class="docs-tryit__button" style="width: auto;" onclick="showAuthModal()">
          🔑 Auth
        </button>
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="docs-sidebar">
      <div class="docs-sidebar__search">
        <input type="text" placeholder="Search endpoints..." id="searchInput">
      </div>
      ${groups.map(g => `
        <div class="docs-sidebar__group">
          <div class="docs-sidebar__group-title">${g.name}</div>
          ${(endpointsByGroup[g.id] || []).map(e => `
            <div class="docs-sidebar__endpoint" data-endpoint="${e.id}" onclick="selectEndpoint('${e.id}')">
              <span class="docs-sidebar__method ${e.method.toLowerCase()}">${e.method}</span>
              <span>${e.summary}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
      ${!groups.length ? `
        <div class="docs-sidebar__group">
          <div class="docs-sidebar__group-title">Endpoints</div>
          ${config.endpoints.map(e => `
            <div class="docs-sidebar__endpoint" data-endpoint="${e.id}" onclick="selectEndpoint('${e.id}')">
              <span class="docs-sidebar__method ${e.method.toLowerCase()}">${e.method}</span>
              <span>${e.summary}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </aside>

    <!-- Main Content -->
    <main class="docs-main" id="mainContent">
      <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📘</div>
        <div style="font-size: 1.25rem; font-weight: 600;">${config.title}</div>
        <div style="margin-top: 0.5rem;">Select an endpoint to view documentation</div>
      </div>
    </main>

    <!-- Try It Panel -->
    <aside class="docs-tryit">
      <div class="docs-tryit__header">
        <div class="docs-tryit__title">
          <span>⚡</span> Try It
        </div>
        <button class="docs-tryit__button" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="clearTryIt()">
          Clear
        </button>
      </div>
      <div class="docs-tryit__content" id="tryItContent">
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          <div>Select an endpoint to test</div>
        </div>
      </div>
    </aside>
  </div>

  <script>
    const API_BASE_URL = '${config.baseUrl}';
    const AUTH_CONFIG = ${JSON.stringify(config.authConfig || { type: 'none' })};
    const ENDPOINTS = ${JSON.stringify(config.endpoints)};

    let currentAuth = { type: AUTH_CONFIG.type };

    // Endpoint data
    function getEndpoint(id) {
      return ENDPOINTS.find(e => e.id === id);
    }

    // Select endpoint
    function selectEndpoint(id) {
      // Update sidebar active state
      document.querySelectorAll('.docs-sidebar__endpoint').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.endpoint === id) {
          el.classList.add('active');
        }
      });

      const endpoint = getEndpoint(id);
      if (!endpoint) return;

      // Render main content
      renderEndpointDetail(endpoint);
      // Render try it panel
      renderTryIt(endpoint);
    }

    // Render endpoint detail
    function renderEndpointDetail(endpoint) {
      const main = document.getElementById('mainContent');

      let html = \`
        <div class="docs-main__endpoint">
          <div class="docs-main__endpoint-header">
            <span class="docs-main__method \${endpoint.method.toLowerCase()}">\${endpoint.method}</span>
            <span class="docs-main__path">\${endpoint.path}</span>
          </div>
          <h1 class="docs-main__summary">\${endpoint.summary}</h1>
          \${endpoint.description ? \`<p class="docs-main__description">\${endpoint.description}</p>\` : ''}
      \`;

      // Parameters
      if (endpoint.parameters && endpoint.parameters.length) {
        html += \`
          <div class="docs-main__section">
            <div class="docs-main__section-title">Parameters</div>
            <div class="docs-main__section-content">
        \`;

        endpoint.parameters.forEach(param => {
          html += \`
            <div class="docs-main__parameter">
              <div>
                <span class="docs-main__parameter-name">\${param.name}</span>
                \${param.required ? '<span class="docs-main__parameter-required">required</span>' : ''}
              </div>
              <div>\${param.description || ''}</div>
              <span class="docs-main__parameter-type">\${param.type}\${param.format ? ': ' + param.format : ''}</span>
            </div>
          \`;
        });

        html += \`</div></div>\`;
      }

      // Request Body
      if (endpoint.requestBody) {
        html += \`
          <div class="docs-main__section">
            <div class="docs-main__section-title">Request Body</div>
            <div class="docs-main__section-content">
              <div style="margin-bottom: 0.5rem;">
                <span class="docs-main__parameter-type">\${endpoint.requestBody.contentType}</span>
                \${endpoint.requestBody.required ? '<span class="docs-main__parameter-required">required</span>' : ''}
              </div>
              \${endpoint.requestBody.description ? \`<p style="color: var(--text-secondary); margin-bottom: 0.5rem;">\${endpoint.requestBody.description}</p>\` : ''}
            </div>
          </div>
        \`;
      }

      // Responses
      html += \`<div class="docs-main__section">
        <div class="docs-main__section-title">Responses</div>
        <div class="docs-main__section-content">
      \`;

      endpoint.responses.forEach(response => {
        html += \`
          <div style="margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="docs-main__parameter-type" style="background: \${response.statusCode < 400 ? 'var(--success-color)' : 'var(--error-color)'};">\${response.statusCode}</span>
              <span>\${response.description}</span>
            </div>
            \${response.example ? \`<pre class="docs-example__code">\${JSON.stringify(response.example, null, 2)}</pre>\` : ''}
          </div>
        \`;
      });

      html += \`</div></div>\`;

      // Examples
      if (endpoint.examples && endpoint.examples.length) {
        html += \`<div class="docs-main__section">
          <div class="docs-main__section-title">Examples</div>
          <div class="docs-main__section-content">
        \`;

        endpoint.examples.forEach(example => {
          html += \`
            <div class="docs-example">
              <div class="docs-example__title">\${example.name}</div>
              \${example.description ? \`<p style="color: var(--text-secondary); margin-bottom: 0.5rem;">\${example.description}</p>\` : ''}
              <pre class="docs-example__code">Request: \${JSON.stringify(example.request, null, 2)}\\nResponse: \${JSON.stringify(example.response, null, 2)}</pre>
            </div>
          \`;
        });

        html += \`</div></div>\`;
      }

      html += \`</div>\`;
      main.innerHTML = html;
    }

    // Render Try It panel
    function renderTryIt(endpoint) {
      const panel = document.getElementById('tryItContent');

      let html = \`<div class="docs-tryit__section">
        <div class="docs-tryit__section-title">Request</div>
      \`;

      // Parameters
      if (endpoint.parameters && endpoint.parameters.length) {
        endpoint.parameters.forEach(param => {
          html += \`
            <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">
              \${param.name}
              \${param.required ? '<span style="color: var(--error-color);">*</span>' : ''}
            </label>
            <input
              type="input"
              class="docs-tryit__input"
              id="param-\${param.name}"
              placeholder="\${param.example || param.default || ''}"
              \${param.required ? 'required' : ''}
            >
          \`;
        });
      }

      // Request Body
      if (endpoint.requestBody) {
        const example = endpoint.requestBody.examples?.default || endpoint.examples?.[0]?.request?.body;
        html += \`
          <div class="docs-tryit__section-title">Request Body</div>
          <textarea
            class="docs-code-editor"
            id="requestBody"
            placeholder="Enter request body as JSON..."
          >\${example ? JSON.stringify(example, null, 2) : ''}</textarea>
        \`;
      }

      html += \`</div>
        <button class="docs-tryit__button" onclick="executeRequest('\${endpoint.id}')">
          Send \${endpoint.method} Request
        </button>

        <div class="docs-tryit__section" id="responseContainer" style="display: none;">
          <div class="docs-tryit__section-title">Response</div>
          <div id="responseStatus"></div>
          <pre class="docs-tryit__response" id="responseBody"></pre>
        </div>
      \`;

      panel.innerHTML = html;
    }

    // Execute request
    async function executeRequest(id) {
      const endpoint = getEndpoint(id);
      if (!endpoint) return;

      const responseContainer = document.getElementById('responseContainer');
      const responseStatus = document.getElementById('responseStatus');
      const responseBody = document.getElementById('responseBody');

      responseContainer.style.display = 'block';
      responseStatus.innerHTML = '<span style="color: var(--info-color);">Sending...</span>';
      responseBody.textContent = '';

      // Build URL
      let url = API_BASE_URL + endpoint.path;

      // Add path parameters
      if (endpoint.parameters) {
        endpoint.parameters.forEach(param => {
          if (param.in === 'path') {
            const value = document.getElementById('param-' + param.name)?.value;
            if (value) {
              url = url.replace('{' + param.name + '}', encodeURIComponent(value));
            }
          }
        });

        // Add query parameters
        const queryParams = new URLSearchParams();
        endpoint.parameters.forEach(param => {
          if (param.in === 'query') {
            const value = document.getElementById('param-' + param.name)?.value;
            if (value) {
              queryParams.append(param.name, value);
            }
          }
        });

        if (queryParams.toString()) {
          url += '?' + queryParams.toString();
        }
      }

      // Build headers
      const headers = {
        'Content-Type': endpoint.requestBody?.contentType || 'application/json',
      };

      // Add auth
      if (currentAuth.type === 'bearer' && currentAuth.token) {
        headers['Authorization'] = \`Bearer \${currentAuth.token}\`;
      } else if (currentAuth.type === 'apiKey' && currentAuth.apiKeyValue) {
        if (currentAuth.apiKeyIn === 'header') {
          headers[currentAuth.apiKeyName] = currentAuth.apiKeyValue;
        }
      }

      // Build body
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.requestBody) {
        const bodyValue = document.getElementById('requestBody')?.value;
        if (bodyValue) {
          try {
            body = JSON.stringify(JSON.parse(bodyValue));
          } catch {
            body = bodyValue;
          }
        }
      }

      try {
        const response = await fetch(url, {
          method: endpoint.method,
          headers,
          body,
        });

        const status = response.status;
        const statusText = response.statusText;
        const responseHeaders = Object.fromEntries(response.headers.entries());

        let responseBodyText;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseBodyText = JSON.stringify(await response.json(), null, 2);
        } else {
          responseBodyText = await response.text();
        }

        responseStatus.innerHTML = \`<span class="docs-tryit__response-status \${status < 400 ? 'success' : 'error'}">\${status} \${statusText}</span>\`;
        responseBody.textContent = responseBodyText;

        if (responseHeaders) {
          responseBody.textContent = \`// Headers:\${JSON.stringify(responseHeaders, null, 2)}\\n\\n\` + responseBodyText;
        }

      } catch (error) {
        responseStatus.innerHTML = \`<span class="docs-tryit__response-status error">Error</span>\`;
        responseBody.textContent = error.message;
      }
    }

    // Clear Try It
    function clearTryIt() {
      document.getElementById('responseContainer').style.display = 'none';
      document.querySelectorAll('.docs-tryit__input, .docs-code-editor').forEach(el => {
        if (el.tagName === 'TEXTAREA') {
          el.value = '';
        } else {
          el.value = '';
        }
      });
    }

    // Auth Modal
    function showAuthModal() {
      const type = AUTH_CONFIG.type || 'none';
      let html = \`
        <div class="docs-auth-modal" onclick="closeAuthModal(event)">
          <div class="docs-auth-modal__content" onclick="event.stopPropagation()">
            <h2 class="docs-auth-modal__title">Authentication</h2>
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">Auth Type</label>
              <select id="authType" class="docs-tryit__input" onchange="updateAuthFields()">
                <value value="none">None</value>
                <value value="bearer">Bearer Token</value>
                <value value="apiKey">API Key</value>
              </select>
            </div>
            <div id="authFields"></div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button class="docs-tryit__button" onclick="saveAuth()">Save</button>
              <button class="docs-tryit__button" style="background: var(--bg-tertiary);" onclick="closeAuthModal(event)">Cancel</button>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('authType').value = currentAuth.type || 'none';
      updateAuthFields();
    }

    function closeAuthModal(event) {
      if (event && event.target.className !== 'docs-auth-modal') return;
      document.querySelector('.docs-auth-modal')?.remove();
    }

    function updateAuthFields() {
      const type = document.getElementById('authType').value;
      const fields = document.getElementById('authFields');

      if (type === 'bearer') {
        fields.innerHTML = \`
          <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">Token</label>
          <input id="authToken" type="password" class="docs-tryit__input" placeholder="your-token-here" value="\${currentAuth.token || ''}">
        \`;
      } else if (type === 'apiKey') {
        fields.innerHTML = \`
          <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem;">Key Name</label>
          <input id="authKeyName" type="text" class="docs-tryit__input" value="\${currentAuth.apiKeyName || 'X-API-Key'}">
          <label style="display: block; margin-bottom: 0.5rem; font-size: 0.875rem; margin-top: 0.5rem;">Key Value</label>
          <input id="authKeyValue" type="password" class="docs-tryit__input" value="\${currentAuth.apiKeyValue || ''}">
        \`;
      } else {
        fields.innerHTML = '';
      }
    }

    function saveAuth() {
      const type = document.getElementById('authType').value;
      currentAuth.type = type;

      if (type === 'bearer') {
        currentAuth.token = document.getElementById('authToken').value;
      } else if (type === 'apiKey') {
        currentAuth.apiKeyName = document.getElementById('authKeyName').value;
        currentAuth.apiKeyValue = document.getElementById('authKeyValue').value;
        currentAuth.apiKeyIn = 'header';
      }

      closeAuthModal();
    }

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.docs-sidebar__endpoint').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });

    // Initial render
    if (ENDPOINTS.length > 0) {
      selectEndpoint(ENDPOINTS[0].id);
    }
  </script>
</body>
</html>`;
}

// Convert OpenAPI spec to InteractiveDocsConfig
export function openAPIToInteractiveDocs(spec: any, baseUrl: string): InteractiveDocsConfig {
  const paths = spec.paths || {};
  const endpoints: APIDocumentationEndpoint[] = [];
  const groups: APIGroup[] = [];

  // Extract tags as groups
  if (spec.tags) {
    spec.tags.forEach((tag: any, index: number) => {
      groups.push({
        id: tag.name,
        name: tag.name,
        description: tag.description,
        order: index,
      });
    });
  }

  Object.entries(paths).forEach(([path, methods]: [string, any]) => {
    Object.entries(methods).forEach(([method, operation]: [string, any]) => {
      if (method === 'parameters' || !operation) return;

      const endpoint: APIDocumentationEndpoint = {
        id: `${method.toLowerCase()}-${path}`.replace(/[^a-z0-9-]/g, '-'),
        method: method.toUpperCase() as any,
        path,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        description: operation.description,
        tags: operation.tags || [],
        group: operation.tags?.[0] || 'default',
        authRequired: operation.security?.length > 0,
        parameters: [
          ...(operation.parameters || []),
          ...(methods.parameters || []),
        ].map((p: any) => ({
          name: p.name,
          in: p.in,
          description: p.description,
          required: p.required,
          type: p.schema?.type || 'string',
          format: p.schema?.format,
          enum: p.schema?.enum,
          default: p.schema?.default,
          example: p.example,
        })),
        requestBody: operation.requestBody ? {
          description: operation.requestBody.description,
          required: operation.requestBody.required,
          contentType: Object.keys(operation.requestBody.content || {})[0] || 'application/json',
          schema: operation.requestBody.content?.['application/json']?.schema,
          examples: operation.requestBody.content?.['application/json']?.examples,
        } : undefined,
        responses: Object.entries(operation.responses || {}).map(([code, resp]: [string, any]) => ({
          statusCode: parseInt(code),
          description: resp.description,
          contentType: Object.keys(resp.content || {})[0],
          schema: resp.content?.['application/json']?.schema,
          example: resp.content?.['application/json']?.example,
        })),
        tryIt: { enabled: true },
      };

      // Add examples from x-examples
      if (operation['x-examples']) {
        endpoint.examples = operation['x-examples'];
      }

      endpoints.push(endpoint);
    });
  });

  return {
    title: spec.info?.title || 'API Documentation',
    description: spec.info?.description,
    version: spec.info?.version || '1.0.0',
    baseUrl,
    themeColor: '#3b82f6',
    authConfig: spec.components?.securitySchemes ? {
      type: 'bearer',
    } : { type: 'none' },
    endpoints,
    groups,
    examplesEnabled: true,
    tryItEnabled: true,
    responseViewerEnabled: true,
  };
}

// Generate docs from OpenAPI spec file
export async function generateDocsFromSpec(specPath: string, outputPath: string, baseUrl: string): Promise<void> {
  const specContent = await fs.readFile(specPath, 'utf-8');
  const spec = JSON.parse(specContent);

  const config = openAPIToInteractiveDocs(spec, baseUrl);
  const html = generateInteractiveDocsHTML(config);

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, html, 'utf-8');
}

// Format for display
export function formatInteractiveDocsConfig(config: InteractiveDocsConfig): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n📘 Interactive API Documentation'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\n${chalk.blue('Title:')} ${config.title}`);
  if (config.description) {
    lines.push(`${chalk.blue('Description:')} ${config.description}`);
  }
  lines.push(`${chalk.blue('Version:')} ${config.version}`);
  lines.push(`${chalk.blue('Base URL:')} ${config.baseUrl}`);

  lines.push(`\n${chalk.blue('Endpoints:')} ${config.endpoints.length}`);
  const byMethod = config.endpoints.reduce((acc, e) => {
    acc[e.method] = (acc[e.method] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(byMethod).forEach(([method, count]) => {
    lines.push(`  ${chalk.gray('•')} ${chalk.yellow(method)}: ${count}`);
  });

  lines.push(`\n${chalk.blue('Features:')}`);
  lines.push(`  ${chalk.gray('Try It:')} ${config.tryItEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`  ${chalk.gray('Examples:')} ${config.examplesEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`  ${chalk.gray('Auth:')} ${config.authConfig?.type || 'none'}`);

  return lines.join('\n');
}

// List supported frameworks for auto-detection
export function listSupportedFrameworks(): string[] {
  return [
    'express',
    'nestjs',
    'fastify',
    'fastapi',
    'django',
    'aspnet-core',
    'spring-boot',
    'gin',
    'rust-axum',
  ];
}
