import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Universal Service Communication Protocol
 *
 * Language-agnostic service communication with support for
 * REST, gRPC, GraphQL, and message queues across all supported languages.
 */

export interface ServiceProtocol {
  name: string;
  version: string;
  type: 'rest' | 'grpc' | 'graphql' | 'message-queue';
  language: string;
  framework: string;
  baseUrl: string;
  endpoints: ProtocolEndpoint[];
  definitions: ProtocolDefinition[];
}

export interface ProtocolEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  requestType?: string;
  responseType?: string;
  description: string;
  deprecated: boolean;
}

export interface ProtocolDefinition {
  name: string;
  type: 'message' | 'service' | 'enum';
  language: string;
  definition: string;
}

export interface ServiceBridge {
  sourceLanguage: string;
  targetLanguage: string;
  protocol: string;
  bridgeCode: string;
  dependencies: string[];
}

/**
 * Generate universal service protocol specification
 */
export async function generateServiceProtocol(
  serviceName: string,
  framework: string,
  language: string,
  projectPath: string = process.cwd()
): Promise<ServiceProtocol> {
  const protocol: ServiceProtocol = {
    name: serviceName,
    version: '1.0.0',
    type: 'rest',
    language,
    framework,
    baseUrl: `http://localhost:3000`,
    endpoints: [
      {
        name: 'health',
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint',
        deprecated: false,
      },
      {
        name: 'findAll',
        method: 'GET',
        path: '/',
        responseType: `${serviceName}[]`,
        description: 'Get all resources',
        deprecated: false,
      },
      {
        name: 'findOne',
        method: 'GET',
        path: '/:id',
        responseType: serviceName,
        description: 'Get single resource by ID',
        deprecated: false,
      },
      {
        name: 'create',
        method: 'POST',
        path: '/',
        requestType: `Create${serviceName}Dto`,
        responseType: serviceName,
        description: 'Create new resource',
        deprecated: false,
      },
      {
        name: 'update',
        method: 'PUT',
        path: '/:id',
        requestType: `Update${serviceName}Dto`,
        responseType: serviceName,
        description: 'Update resource',
        deprecated: false,
      },
      {
        name: 'delete',
        method: 'DELETE',
        path: '/:id',
        description: 'Delete resource',
        deprecated: false,
      },
    ],
    definitions: [],
  };

  return protocol;
}

/**
 * Generate service bridge between languages
 */
export async function generateServiceBridge(
  sourceLanguage: string,
  targetLanguage: string,
  protocol: ServiceProtocol
): Promise<ServiceBridge> {
  const bridge: ServiceBridge = {
    sourceLanguage,
    targetLanguage,
    protocol: protocol.type,
    bridgeCode: '',
    dependencies: [],
  };

  // Generate bridge code based on target language
  switch (targetLanguage) {
    case 'typescript':
      bridge.bridgeCode = generateTypeScriptBridge(protocol);
      bridge.dependencies = ['axios', '@grpc/grpc-js', 'graphql-request'];
      break;
    case 'python':
      bridge.bridgeCode = generatePythonBridge(protocol);
      bridge.dependencies = ['requests', 'grpcio', 'graphql-core'];
      break;
    case 'go':
      bridge.bridgeCode = generateGoBridge(protocol);
      bridge.dependencies = ['net/http', 'google.golang.org/grpc', 'github.com/graphql-go/graphql'];
      break;
    case 'csharp':
      bridge.bridgeCode = generateCSharpBridge(protocol);
      bridge.dependencies = ['System.Net.Http', 'Grpc.Core', 'GraphQL'];
      break;
    default:
      bridge.bridgeCode = generateGenericBridge(protocol);
  }

  return bridge;
}

/**
 * Generate TypeScript service bridge
 */
function generateTypeScriptBridge(protocol: ServiceProtocol): string {
  const className = `${toPascalCase(protocol.name)}Client`;

  return `import axios, { AxiosInstance } from 'axios';

export interface ${toPascalCase(protocol.name)}Service {
  health(): Promise<{ status: string }>;
  findAll(): Promise<${protocol.name}[]>;
  findOne(id: string): Promise<${protocol.name}>;
  create(data: Create${toPascalCase(protocol.name)}Dto): Promise<${protocol.name}>;
  update(id: string, data: Update${toPascalCase(protocol.name)}Dto): Promise<${protocol.name}>;
  delete(id: string): Promise<void>;
}

export class ${className} implements ${toPascalCase(protocol.name)}Service {
  private client: AxiosInstance;

  constructor(baseUrl: string = '${protocol.baseUrl}') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async health(): Promise<{ status: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  async findAll(): Promise<${protocol.name}[]> {
    const response = await this.client.get('/');
    return response.data;
  }

  async findOne(id: string): Promise<${protocol.name}> {
    const response = await this.client.get(\`/\${id}\`);
    return response.data;
  }

  async create(data: Create${toPascalCase(protocol.name)}Dto): Promise<${protocol.name}> {
    const response = await this.client.post('/', data);
    return response.data;
  }

  async update(id: string, data: Update${toPascalCase(protocol.name)}Dto): Promise<${protocol.name}> {
    const response = await this.client.put(\`/\${id}\`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(\`/\${id}\`);
  }
}
`;
}

/**
 * Generate Python service bridge
 */
function generatePythonBridge(protocol: ServiceProtocol): string {
  return `import requests
from typing import List, Optional
from dataclasses import dataclass

class ${toPascalCase(protocol.name)}Client:
    def __init__(self, base_url: str = '${protocol.baseUrl}'):
        self.base_url = base_url
        self.timeout = 30

    def health(self) -> dict:
        response = requests.get(f"{self.base_url}/health", timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def find_all(self) -> List[dict]:
        response = requests.get(f"{self.base_url}/", timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def find_one(self, id: str) -> dict:
        response = requests.get(f"{self.base_url}/{id}", timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def create(self, data: dict) -> dict:
        response = requests.post(f"{self.base_url}/", json=data, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def update(self, id: str, data: dict) -> dict:
        response = requests.put(f"{self.base_url}/{id}", json=data, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def delete(self, id: str) -> None:
        response = requests.delete(f"{self.base_url}/{id}", timeout=self.timeout)
        response.raise_for_status()
`;
}

/**
 * Generate Go service bridge
 */
function generateGoBridge(protocol: ServiceProtocol): string {
  const clientName = toPascalCase(protocol.name) + 'Client';

  return `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ${clientName} struct {
	BaseURL    string
	HTTPClient *http.Client
}

func New${clientName}(baseURL string) *${clientName} {
	return &${clientName}{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *${clientName}) Health() (map[string]string, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + "/health")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *${clientName}) FindAll() ([]map[string]interface{}, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + "/")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func (c *${clientName}) FindOne(id string) (map[string]interface{}, error) {
	resp, err := c.HTTPClient.Get(c.BaseURL + "/" + id)
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

func (c *${clientName}) Create(data map[string]interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	resp, err := c.HTTPClient.Post(c.BaseURL+"/", "application/json", bytes.NewBuffer(jsonData))
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

func (c *${clientName}) Update(id string, data map[string]interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PUT", c.BaseURL+"/"+id, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
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

func (c *${clientName}) Delete(id string) error {
	req, err := http.NewRequest("DELETE", c.BaseURL+"/"+id, nil)
	if err != nil {
		return err
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return nil
}
`;
}

/**
 * Generate C# service bridge
 */
function generateCSharpBridge(protocol: ServiceProtocol): string {
  return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

public class ${toPascalCase(protocol.name)}Client
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;

    public ${toPascalCase(protocol.name)}Client(string baseUrl = "${protocol.baseUrl}")
    {
        _baseUrl = baseUrl;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        _httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");
    }

    public async Task<object> HealthAsync()
    {
        var response = await _httpClient.GetAsync($"{_baseUrl}/health");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<object>(content);
    }

    public async Task<string[]> FindAllAsync()
    {
        var response = await _httpClient.GetAsync($"{_baseUrl}/");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<string[]>(content);
    }

    public async Task<string> FindOneAsync(string id)
    {
        var response = await _httpClient.GetAsync($"{_baseUrl}/{id}");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<string>(content);
    }

    public async Task<string> CreateAsync(object data)
    {
        var json = JsonConvert.SerializeObject(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync($"{_baseUrl}/", content);
        response.EnsureSuccessStatusCode();

        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<string>(responseContent);
    }

    public async Task<string> UpdateAsync(string id, object data)
    {
        var json = JsonConvert.SerializeObject(data);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PutAsync($"{_baseUrl}/{id}", content);
        response.EnsureSuccessStatusCode();

        var responseContent = await response.Content.ReadAsStringAsync();
        return JsonConvert.DeserializeObject<string>(responseContent);
    }

    public async Task DeleteAsync(string id)
    {
        var response = await _httpClient.DeleteAsync($"{_baseUrl}/{id}");
        response.EnsureSuccessStatusCode();
    }
}
`;
}

/**
 * Generate generic service bridge
 */
function generateGenericBridge(protocol: ServiceProtocol): string {
  return `// Universal Service Bridge for ${protocol.name}
// Language: ${protocol.language}
// Protocol: ${protocol.type}

// TODO: Implement bridge for ${protocol.language}
// Base URL: ${protocol.baseUrl}

interface ServiceEndpoint {
  method: string;
  path: string;
  handler: (params?: any) => Promise<any>;
}

const endpoints: ServiceEndpoint[] = ${JSON.stringify(protocol.endpoints, null, 2)};

export class ${toPascalCase(protocol.name)}Bridge {
  private baseUrl: string;

  constructor(baseUrl: string = '${protocol.baseUrl}') {
    this.baseUrl = baseUrl;
  }

  async call(method: string, path: string, data?: any): Promise<any> {
    const url = \`\${this.baseUrl}\${path}\`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

  async health(): Promise<any> {
    return this.call('GET', '/health');
  }

  async findAll(): Promise<any[]> {
    return this.call('GET', '/');
  }

  async findOne(id: string): Promise<any> {
    return this.call('GET', \`/\${id}\`);
  }

  async create(data: any): Promise<any> {
    return this.call('POST', '/', data);
  }

  async update(id: string, data: any): Promise<any> {
    return this.call('PUT', \`/\${id}\`, data);
  }

  async delete(id: string): Promise<void> {
    return this.call('DELETE', \`/\${id}\`);
  }
}
`;
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

/**
 * Write service protocol file
 */
export async function writeServiceProtocol(
  protocol: ServiceProtocol,
  outputPath: string
): Promise<void> {
  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeJson(outputPath, protocol, { spaces: 2 });
}

/**
 * Write service bridge file
 */
export async function writeServiceBridge(
  bridge: ServiceBridge,
  outputPath: string,
  extension: string
): Promise<void> {
  const filePath = outputPath.replace(/\.[^.]+$/, extension);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, bridge.bridgeCode);
}

/**
 * Display service protocol
 */
export async function displayServiceProtocol(protocol: ServiceProtocol): Promise<void> {
  console.log(chalk.bold(`\n🔗 Service Protocol: ${protocol.name}\n`));
  console.log(chalk.cyan(`Version: ${protocol.version}`));
  console.log(chalk.cyan(`Type: ${protocol.type}`));
  console.log(chalk.cyan(`Language: ${protocol.language}`));
  console.log(chalk.cyan(`Framework: ${protocol.framework}`));
  console.log(chalk.cyan(`Base URL: ${protocol.baseUrl}\n`));

  console.log(chalk.bold('Endpoints:\n'));

  for (const endpoint of protocol.endpoints) {
    const methodColor =
      endpoint.method === 'GET'
        ? chalk.blue
        : endpoint.method === 'POST'
        ? chalk.green
        : endpoint.method === 'PUT'
        ? chalk.yellow
        : endpoint.method === 'DELETE'
        ? chalk.red
        : chalk.gray;

    console.log(`  ${methodColor(endpoint.method.padEnd(7))} ${endpoint.path}`);
    console.log(chalk.gray(`      ${endpoint.description}`));

    if (endpoint.deprecated) {
      console.log(chalk.yellow(`      ⚠️  DEPRECATED`));
    }
    console.log('');
  }
}
