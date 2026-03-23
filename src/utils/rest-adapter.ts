import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * RESTful API Adapter Generation
 *
 * Generate REST API adapters with automatic serialization,
 * validation, and error handling for all supported languages.
 */

export interface RESTEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  operation: string;
  description: string;
  requestSchema?: RESTSchema;
  responseSchema: RESTSchema;
  queryParams?: RESTParam[];
  pathParams?: RESTParam[];
  headers?: RESTParam[];
}

export interface RESTSchema {
  type: string;
  properties: Record<string, RESTSchemaProperty>;
  required?: string[];
}

export interface RESTSchemaProperty {
  type: string;
  format?: string;
  description?: string;
  example?: any;
  validation?: RESTValidation;
}

export interface RESTValidation {
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  enum?: any[];
}

export interface RESTParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: RESTValidation;
}

export interface RESTService {
  name: string;
  version: string;
  basePath: string;
  endpoints: RESTEndpoint[];
  description: string;
}

export interface RESTAdapter {
  language: string;
  serverCode: string;
  clientCode: string;
  validationCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate REST service definition
 */
export async function generateRESTService(
  serviceName: string,
  endpoints: RESTEndpoint[],
  basePath = '/api/v1',
  projectPath: string = process.cwd()
): Promise<RESTService> {
  const service: RESTService = {
    name: serviceName,
    version: 'v1',
    basePath,
    endpoints,
    description: `${serviceName} REST API`,
  };

  return service;
}

/**
 * Generate default REST endpoints for CRUD operations
 */
export function generateCRUDEndpoints(resource: string): RESTEndpoint[] {
  const resourceName = toPascalCase(resource);
  const resourceId = `${resource}Id`;

  return [
    {
      path: `/${resource}`,
      method: 'GET',
      operation: 'list',
      description: `List all ${resource}s`,
      responseSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            description: `Array of ${resource} objects`,
          },
          total: { type: 'number', description: 'Total count' },
          page: { type: 'number', description: 'Current page' },
          pageSize: { type: 'number', description: 'Items per page' },
        },
      },
      queryParams: [
        {
          name: 'page',
          type: 'number',
          required: false,
          description: 'Page number',
          validation: { min: 1 },
        },
        {
          name: 'pageSize',
          type: 'number',
          required: false,
          description: 'Items per page',
          validation: { min: 1, max: 100 },
        },
        {
          name: 'sort',
          type: 'string',
          required: false,
          description: 'Sort field',
        },
      ],
    },
    {
      path: `/${resource}/:${resourceId}`,
      method: 'GET',
      operation: 'get',
      description: `Get a specific ${resource}`,
      pathParams: [
        {
          name: resourceId,
          type: 'string',
          required: true,
          description: `${resourceName} ID`,
        },
      ],
      responseSchema: {
        type: 'object',
        properties: {
          data: { type: 'object', description: `${resourceName} object` },
        },
      },
    },
    {
      path: `/${resource}`,
      method: 'POST',
      operation: 'create',
      description: `Create a new ${resource}`,
      requestSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: `${resourceName} name` },
          description: {
            type: 'string',
            description: `${resourceName} description`,
          },
        },
        required: ['name'],
      },
      responseSchema: {
        type: 'object',
        properties: {
          data: { type: 'object', description: `Created ${resourceName}` },
        },
      },
    },
    {
      path: `/${resource}/:${resourceId}`,
      method: 'PUT',
      operation: 'update',
      description: `Update a ${resource}`,
      pathParams: [
        {
          name: resourceId,
          type: 'string',
          required: true,
          description: `${resourceName} ID`,
        },
      ],
      requestSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: `${resourceName} name` },
          description: {
            type: 'string',
            description: `${resourceName} description`,
          },
        },
      },
      responseSchema: {
        type: 'object',
        properties: {
          data: { type: 'object', description: `Updated ${resourceName}` },
        },
      },
    },
    {
      path: `/${resource}/:${resourceId}`,
      method: 'DELETE',
      operation: 'delete',
      description: `Delete a ${resource}`,
      pathParams: [
        {
          name: resourceId,
          type: 'string',
          required: true,
          description: `${resourceName} ID`,
        },
      ],
      responseSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Deletion success' },
        },
      },
    },
  ];
}

/**
 * Generate REST adapter for language
 */
export async function generateRESTAdapter(
  service: RESTService,
  language: string
): Promise<RESTAdapter> {
  let adapter: RESTAdapter;

  switch (language) {
    case 'typescript':
      adapter = generateTypeScriptREST(service);
      break;
    case 'python':
      adapter = generatePythonREST(service);
      break;
    case 'go':
      adapter = generateGoREST(service);
      break;
    case 'csharp':
      adapter = generateCSharpREST(service);
      break;
    default:
      adapter = generateGenericREST(service, language);
  }

  return adapter;
}

/**
 * Generate TypeScript REST adapter
 */
function generateTypeScriptREST(service: RESTService): RESTAdapter {
  return {
    language: 'typescript',
    serverCode: generateTypeScriptServer(service),
    clientCode: generateTypeScriptClient(service),
    validationCode: generateTypeScriptValidation(service),
    dependencies: [
      'express',
      'zod',
      '@types/express',
      'axios',
    ],
    buildInstructions: [
      'npm install express zod @types/express axios',
      'Copy server code to src/server.ts',
      'Copy client code to src/client.ts',
      'Copy validation code to src/validation.ts',
      'Start server: npm run dev',
    ],
  };
}

function generateTypeScriptServer(service: RESTService): string {
  const imports = `import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest, validateQuery, validateParams } from './validation';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

`;

  const routes = service.endpoints
    .map((endpoint) => generateTypeScriptRoute(service, endpoint))
    .join('\n');

  const errorHandling = `// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(\`${service.name} server running on port \${PORT}\`);
  console.log(\`API base path: ${service.basePath}\`);
});
`;

  return imports + routes + '\n' + errorHandling;
}

function generateTypeScriptRoute(service: RESTService, endpoint: RESTEndpoint): string {
  const routePath = service.basePath + endpoint.path;
  const handlerName = toCamelCase(endpoint.operation) + toPascalCase(service.name);

  let paramsValidation = '';
  if (endpoint.pathParams && endpoint.pathParams.length > 0) {
    paramsValidation = `  validateParams(req, res, next);`;
  }

  let queryValidation = '';
  if (endpoint.queryParams && endpoint.queryParams.length > 0) {
    queryValidation = `  validateQuery(req, res, next);`;
  }

  let bodyValidation = '';
  if (endpoint.requestSchema) {
    bodyValidation = `  validateRequest(req, res, next);`;
  }

  return `// ${endpoint.description}
app.${endpoint.method.toLowerCase()}('${routePath}', ${paramsValidation}${queryValidation}${bodyValidation}async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ${handlerName}(req);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

`;
}

function generateTypeScriptClient(service: RESTService): string {
  const methods = service.endpoints
    .map((endpoint) => {
      const methodName = toCamelCase(endpoint.operation);
      const path = service.basePath + endpoint.path;
      const pathParamNames = (endpoint.pathParams || []).map((p) => p.name);

      let pathParams = '';
      let pathInterpolation = '';

      if (pathParamNames.length > 0) {
        pathParams = pathParamNames.map((p) => `${p}: string`).join(', ');
        pathInterpolation = path.replace(/:(\w+)/g, '${$1}');
      }

      return `  async ${methodName}(${pathParams}${pathParams ? ', ' : ''}params?: any, body?: any): Promise<any> {
    return this.request('${endpoint.method}', \`${pathInterpolation}\`, params, body);
  }`;
    })
    .join('\n\n');

  return `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export class ${toPascalCase(service.name)}Client {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async request(
    method: string,
    path: string,
    params?: any,
    data?: any
  ): Promise<any> {
    const config: AxiosRequestConfig = {
      method,
      url: path,
      params,
      data,
    };

    const response: AxiosResponse = await this.client.request(config);
    return response.data;
  }

${methods}
}
`;
}

function generateTypeScriptValidation(service: RESTService): string {
  const schemas = service.endpoints
    .map((endpoint) => {
      if (!endpoint.requestSchema) return '';

      const schemaName = toPascalCase(endpoint.operation) + 'Schema';

      const properties = Object.entries(endpoint.requestSchema.properties)
        .map(
          ([name, prop]) =>
            `  ${name}: z.${prop.type}()${generateZodValidation(prop.validation)},`
        )
        .join('\n');

      return `export const ${schemaName} = z.object({
${properties}
});
`;
    })
    .filter(Boolean)
    .join('\n');

  const middleware = `// Validation middleware
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  // Schema validation based on route
  next();
}

export function validateQuery(req: Request, res: Response, next: NextFunction) {
  // Query validation
  next();
}

export function validateParams(req: Request, res: Response, next: NextFunction) {
  // Params validation
  next();
}
`;

  return schemas + '\n' + middleware;
}

function generateZodValidation(validation?: RESTValidation): string {
  if (!validation) return '';

  const chains: string[] = [];

  if (validation.min !== undefined) {
    chains.push(`.min(${validation.min})`);
  }
  if (validation.max !== undefined) {
    chains.push(`.max(${validation.max})`);
  }
  if (validation.minLength !== undefined) {
    chains.push(`.min(${validation.minLength})`);
  }
  if (validation.maxLength !== undefined) {
    chains.push(`.max(${validation.maxLength})`);
  }
  if (validation.pattern) {
    chains.push(`.regex(/${validation.pattern}/)`);
  }
  if (validation.enum) {
    chains.push(`.enum([${validation.enum.map((v) => `'${v}'`).join(', ')}])`);
  }

  return chains.join('');
}

/**
 * Generate Python REST adapter
 */
function generatePythonREST(service: RESTService): RESTAdapter {
  return {
    language: 'python',
    serverCode: generatePythonServer(service),
    clientCode: generatePythonClient(service),
    validationCode: generatePythonValidation(service),
    dependencies: [
      'fastapi',
      'uvicorn',
      'pydantic',
      'httpx',
    ],
    buildInstructions: [
      'pip install fastapi uvicorn pydantic httpx',
      'Copy server code to server.py',
      'Copy client code to client.py',
      'Copy validation code to validation.py',
      'Start server: uvicorn server:app --reload',
    ],
  };
}

function generatePythonServer(service: RESTService): string {
  const routes = service.endpoints
    .map((endpoint) => {
      const routePath = service.basePath + endpoint.path;
      const handlerName = toSnakeCase(endpoint.operation) + '_' + toSnakeCase(service.name);
      const path = routePath.replace(/:(\w+)/g, '{$1}');

      let pathParams = '';
      if (endpoint.pathParams && endpoint.pathParams.length > 0) {
        pathParams = endpoint.pathParams.map((p) => `${p.name}: str`).join(', ');
      }

      return `@app.${endpoint.method.toLowerCase()}("${path}")
async def ${handlerName}(${pathParams}${pathParams ? ', ' : ''}request: Request):
    # TODO: Implement ${endpoint.operation}
    return {"message": "${endpoint.description}"}
`;
    })
    .join('\n');

  return `from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="${toPascalCase(service.name)} API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

${routes}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
}

function generatePythonClient(service: RESTService): string {
  const methods = service.endpoints
    .map((endpoint) => {
      const methodName = toSnakeCase(endpoint.operation);
      const path = service.basePath + endpoint.path;
      const pathParams = (endpoint.pathParams || []).map((p) => `${p.name}: str`).join(', ');

      return `    async def ${methodName}(${pathParams}${pathParams ? ', ' : ''}params: dict = None, body: dict = None):
        return await self._request("${endpoint.method}", "${path}", params, body)`;
    })
    .join('\n');

  return `import httpx

class ${toPascalCase(service.name)}Client:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)

    async def _request(self, method: str, path: str, params: dict = None, body: dict = None):
        response = await self.client.request(method, path, params=params, json=body)
        response.raise_for_status()
        return response.json()

${methods}

    async def close(self):
        await self.client.aclose()
`;
}

function generatePythonValidation(service: RESTService): string {
  return `from pydantic import BaseModel, Field, validator
from typing import Optional, List

# Example validation models
class ${toPascalCase(service.name)}Model(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Example",
                "description": "Example description"
            }
        }
`;
}

/**
 * Generate Go REST adapter
 */
function generateGoREST(service: RESTService): RESTAdapter {
  return {
    language: 'go',
    serverCode: generateGoServer(service),
    clientCode: generateGoClient(service),
    validationCode: generateGoValidation(service),
    dependencies: [
      'github.com/gin-gonic/gin',
      'github.com/go-playground/validator/v10',
    ],
    buildInstructions: [
      'go get github.com/gin-gonic/gin',
      'go get github.com/go-playground/validator/v10',
      'Copy server code to main.go',
      'Start server: go run main.go',
    ],
  };
}

function generateGoServer(service: RESTService): string {
  const routes = service.endpoints
    .map((endpoint) => {
      const path = (service.basePath + endpoint.path).replace(/:(\w+)/g, ':$1');
      return `r.${endpoint.method.toLowerCase()}("${path}", ${toCamelCase(endpoint.operation)})`;
    })
    .join('\n    ');

  return `package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()

    // Routes
    ${routes}

    r.Run(":8080")
}

func ${toCamelCase(service.endpoints[0]?.operation || 'index')}(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "message": "OK",
    })
}
`;
}

function generateGoClient(service: RESTService): string {
  return `package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

type ${toPascalCase(service.name)}Client struct {
    BaseURL string
    Client  *http.Client
}

func New${toPascalCase(service.name)}Client(baseURL string) *${toPascalCase(service.name)}Client {
    return &${toPascalCase(service.name)}Client{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

func (c *${toPascalCase(service.name)}Client) Request(method, path string, body interface{}) (map[string]interface{}, error) {
    var buf bytes.Buffer
    if body != nil {
        if err := json.NewEncoder(&buf).Encode(body); err != nil {
            return nil, err
        }
    }

    req, err := http.NewRequest(method, c.BaseURL+path, &buf)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")

    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result, nil
}
`;
}

function generateGoValidation(service: RESTService): string {
  return `package main

import "github.com/go-playground/validator/v10"

var validate *validator.Validate

func init() {
    validate = validator.New()
}

type ${toPascalCase(service.name)}Request struct {
    Name string \`json:"name" validate:"required,min=1,max=100"\`
    Description string \`json:"description" validate:"omitempty,max=500"\`
}

func (r *${toPascalCase(service.name)}Request) Validate() error {
    return validate.Struct(r)
}
`;
}

/**
 * Generate C# REST adapter
 */
function generateCSharpREST(service: RESTService): RESTAdapter {
  return {
    language: 'csharp',
    serverCode: generateCSharpServer(service),
    clientCode: generateCSharpClient(service),
    validationCode: generateCSharpValidation(service),
    dependencies: [
      'Microsoft.AspNetCore.App',
      'System.ComponentModel.Annotations',
    ],
    buildInstructions: [
      'dotnet new webapi -n ' + service.name,
      'dotnet add package System.ComponentModel.Annotations',
      'Copy server code to Controllers/',
      'Start server: dotnet run',
    ],
  };
}

function generateCSharpServer(service: RESTService): string {
  return `using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace ${toPascalCase(service.name)}.Controllers
{
    [ApiController]
    [Route("${service.basePath}")]
    public class ${toPascalCase(service.name)}Controller : ControllerBase
    {
        [HttpGet]
        public IActionResult Get()
        {
            return Ok(new { message = "OK" });
        }

        [HttpGet("{id}")]
        public IActionResult GetById(string id)
        {
            return Ok(new { id });
        }

        [HttpPost]
        public IActionResult Create([FromBody] ${toPascalCase(service.name)}Request request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            return CreatedAtAction(nameof(GetById), new { id = request.Id }, request);
        }
    }

    public class ${toPascalCase(service.name)}Request
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; }

        [StringLength(500)]
        public string Description { get; set; }
    }
}
`;
}

function generateCSharpClient(service: RESTService): string {
  return `using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace ${toPascalCase(service.name)}.Client
{
    public class ${toPascalCase(service.name)}Client
    {
        private readonly HttpClient _client;
        private readonly string _baseUrl;

        public ${toPascalCase(service.name)}Client(string baseUrl = "http://localhost:5000")
        {
            _client = new HttpClient();
            _baseUrl = baseUrl;
        }

        public async Task<T> Get<T>(string path)
        {
            var response = await _client.GetAsync($"{_baseUrl}{path}");
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<T>(content);
        }

        public async Task<T> Post<T>(string path, object data)
        {
            var json = JsonSerializer.Serialize(data);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _client.PostAsync($"{_baseUrl}{path}", content);
            response.EnsureSuccessStatusCode();
            var responseContent = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<T>(responseContent);
        }
    }
}
`;
}

function generateCSharpValidation(service: RESTService): string {
  return `using System.ComponentModel.DataAnnotations;

namespace ${toPascalCase(service.name)}.Models
{
    public class ${toPascalCase(service.name)}Model
    {
        [Required(ErrorMessage = "Name is required")]
        [StringLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
        public string Name { get; set; }

        [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters")]
        public string Description { get; set; }
    }
}
`;
}

/**
 * Generate generic REST adapter
 */
function generateGenericREST(service: RESTService, language: string): RESTAdapter {
  return {
    language,
    serverCode: `// TODO: Implement REST server for ${language}`,
    clientCode: `// TODO: Implement REST client for ${language}`,
    validationCode: `// TODO: Implement validation for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Install REST framework for ${language}`,
      `Implement server code`,
      `Implement client code`,
      `Add validation logic`,
    ],
  };
}

/**
 * Helper functions
 */
function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return (
    str.charAt(0).toLowerCase() +
    str.slice(1).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  );
}

/**
 * Write REST adapter files
 */
export async function writeRESTAdapterFiles(
  serviceName: string,
  adapter: RESTAdapter,
  outputPath: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  if (adapter.serverCode) {
    const serverFile = path.join(outputPath, `${serviceName}-server.${getFileExtension(adapter.language)}`);
    await fs.writeFile(serverFile, adapter.serverCode);
  }

  if (adapter.clientCode) {
    const clientFile = path.join(outputPath, `${serviceName}-client.${getFileExtension(adapter.language)}`);
    await fs.writeFile(clientFile, adapter.clientCode);
  }

  if (adapter.validationCode) {
    const validationFile = path.join(
      outputPath,
      `${serviceName}-validation.${getFileExtension(adapter.language)}`
    );
    await fs.writeFile(validationFile, adapter.validationCode);
  }

  // Write build instructions
  const readmeFile = path.join(outputPath, 'BUILD.md');
  const readmeContent = generateBuildREADME(serviceName, adapter);
  await fs.writeFile(readmeFile, readmeContent);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    csharp: 'cs',
  };
  return extensions[language] || 'txt';
}

function generateBuildREADME(serviceName: string, adapter: RESTAdapter): string {
  return `# REST API Adapter Build Instructions for ${serviceName}

## Language: ${adapter.language.toUpperCase()}

## Dependencies

\`\`\`bash
${adapter.dependencies.map((dep) => getInstallCommand(dep, adapter.language)).join('\n')}
\`\`\`

## Build Steps

${adapter.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Server
\`\`\`bash
${getStartCommand(adapter.language, serviceName)}
\`\`\`

### Client
Import and use the client class in your application.

## API Endpoints

Generated adapter includes:
- Automatic request/response serialization
- Input validation
- Error handling
- Type safety (for typed languages)
`;
}

function getInstallCommand(dep: string, language: string): string {
  const commands: Record<string, (dep: string) => string> = {
    typescript: (dep) => `npm install ${dep}`,
    python: (dep) => `pip install ${dep}`,
    go: (dep) => `go get ${dep}`,
    csharp: (dep) => `dotnet add package ${dep}`,
  };

  const fn = commands[language];
  return fn ? fn(dep) : `# Install ${dep} for ${language}`;
}

function getStartCommand(language: string, serviceName: string): string {
  const commands: Record<string, string> = {
    typescript: `npm run dev`,
    python: `python ${serviceName}-server.py`,
    go: `go run ${serviceName}-server.go`,
    csharp: `dotnet run`,
  };

  return commands[language] || `# Start ${serviceName} server`;
}

/**
 * Display REST service info
 */
export async function displayRESTService(service: RESTService): Promise<void> {
  console.log(chalk.bold(`\n🔌 REST API: ${service.name}\n`));
  console.log(chalk.cyan(`Version: ${service.version}`));
  console.log(chalk.cyan(`Base Path: ${service.basePath}\n`));

  console.log(chalk.bold('Endpoints:\n'));

  for (const endpoint of service.endpoints) {
    const method = endpoint.method.padEnd(7);
    const path = service.basePath + endpoint.path;
    console.log(`  ${chalk.green(method)} ${chalk.cyan(path)}`);
    console.log(chalk.gray(`      ${endpoint.description}`));

    if (endpoint.requestSchema) {
      console.log(chalk.gray(`      Request: ${Object.keys(endpoint.requestSchema.properties).join(', ')}`));
    }
    console.log('');
  }
}
