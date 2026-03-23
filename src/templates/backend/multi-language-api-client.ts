import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class MultiLanguageApiClientTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Python client
    files.push({
      path: 'clients/python/api_client.py',
      content: this.generatePythonClient()
    });

    files.push({
      path: 'clients/python/setup.py',
      content: this.generatePythonSetup()
    });

    files.push({
      path: 'clients/python/requirements.txt',
      content: this.generatePythonRequirements()
    });

    // Java client
    files.push({
      path: 'clients/java/src/main/java/com/api/client/ApiClient.java',
      content: this.generateJavaClient()
    });

    files.push({
      path: 'clients/java/pom.xml',
      content: this.generateJavaPom()
    });

    // Go client
    files.push({
      path: 'clients/go/client.go',
      content: this.generateGoClient()
    });

    files.push({
      path: 'clients/go/go.mod',
      content: this.generateGoMod()
    });

    // Rust client
    files.push({
      path: 'clients/rust/src/lib.rs',
      content: this.generateRustClient()
    });

    files.push({
      path: 'clients/rust/Cargo.toml',
      content: this.generateRustCargo()
    });

    // Swift client
    files.push({
      path: 'clients/swift/Sources/ApiClient/ApiClient.swift',
      content: this.generateSwiftClient()
    });

    files.push({
      path: 'clients/swift/Package.swift',
      content: this.generateSwiftPackage()
    });

    // C++ client
    files.push({
      path: 'clients/cpp/include/api_client.hpp',
      content: this.generateCppHeader()
    });

    files.push({
      path: 'clients/cpp/src/api_client.cpp',
      content: this.generateCppSource()
    });

    files.push({
      path: 'clients/cpp/CMakeLists.txt',
      content: this.generateCppCMake()
    });

    // Kotlin client
    files.push({
      path: 'clients/kotlin/src/main/kotlin/com/api/client/ApiClient.kt',
      content: this.generateKotlinClient()
    });

    // C# client
    files.push({
      path: 'clients/csharp/ApiClient.cs',
      content: this.generateCSharpClient()
    });

    files.push({
      path: 'clients/csharp/ApiClient.csproj',
      content: this.generateCSharpProject()
    });

    // Ruby client
    files.push({
      path: 'clients/ruby/lib/api_client.rb',
      content: this.generateRubyClient()
    });

    files.push({
      path: 'clients/ruby/api_client.gemspec',
      content: this.generateRubyGemspec()
    });

    // PHP client
    files.push({
      path: 'clients/php/src/ApiClient.php',
      content: this.generatePhpClient()
    });

    files.push({
      path: 'clients/php/composer.json',
      content: this.generatePhpComposer()
    });

    // OpenAPI spec for code generation
    files.push({
      path: 'openapi.yaml',
      content: this.generateOpenApiSpec()
    });

    // Generation script
    files.push({
      path: 'scripts/generate-clients.sh',
      content: this.generateClientScript()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  private generatePythonClient(): string {
    const { normalizedName } = this.context;
    return `"""
${normalizedName} API Client for Python

A type-safe, async-ready API client with automatic retry and caching.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
from urllib.parse import urljoin, urlencode
import aiohttp
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

T = TypeVar('T')


@dataclass
class ApiConfig:
    """API client configuration."""
    base_url: str
    api_key: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class ApiResponse(Generic[T]):
    """Generic API response wrapper."""
    data: Optional[T] = None
    status_code: int = 0
    headers: Dict[str, str] = field(default_factory=dict)
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return 200 <= self.status_code < 300


class ApiError(Exception):
    """API error with status code and response body."""
    def __init__(self, message: str, status_code: int, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RateLimiter:
    """Token bucket rate limiter."""
    def __init__(self, requests_per_second: float = 10.0):
        self.requests_per_second = requests_per_second
        self.tokens = requests_per_second
        self.last_update = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(
                self.requests_per_second,
                self.tokens + elapsed * self.requests_per_second
            )
            self.last_update = now

            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.requests_per_second
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


class ApiClient:
    """
    Synchronous API client with retry logic and rate limiting.
    """

    def __init__(self, config: ApiConfig):
        self.config = config
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        session = requests.Session()

        # Configure retry strategy
        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=self.config.retry_delay,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # Set default headers
        session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
            **self.config.headers
        })

        if self.config.api_key:
            session.headers["Authorization"] = f"Bearer {self.config.api_key}"

        return session

    def _build_url(self, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        url = urljoin(self.config.base_url, path)
        if params:
            url = f"{url}?{urlencode(params)}"
        return url

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return self._request("GET", path, params=params)

    def post(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return self._request("POST", path, data=data, params=params)

    def put(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return self._request("PUT", path, data=data, params=params)

    def patch(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return self._request("PATCH", path, data=data, params=params)

    def delete(self, path: str, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return self._request("DELETE", path, params=params)

    def _request(
        self,
        method: str,
        path: str,
        data: Any = None,
        params: Optional[Dict[str, Any]] = None
    ) -> ApiResponse:
        url = self._build_url(path, params)

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data if data else None,
                timeout=self.config.timeout
            )

            return ApiResponse(
                data=response.json() if response.content else None,
                status_code=response.status_code,
                headers=dict(response.headers)
            )
        except requests.exceptions.RequestException as e:
            return ApiResponse(
                status_code=0,
                error=str(e)
            )

    def close(self) -> None:
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class AsyncApiClient:
    """
    Asynchronous API client with retry logic and rate limiting.
    """

    def __init__(self, config: ApiConfig, rate_limit: float = 10.0):
        self.config = config
        self.rate_limiter = RateLimiter(rate_limit)
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                **self.config.headers
            }

            if self.config.api_key:
                headers["Authorization"] = f"Bearer {self.config.api_key}"

            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self._session = aiohttp.ClientSession(headers=headers, timeout=timeout)

        return self._session

    def _build_url(self, path: str) -> str:
        return urljoin(self.config.base_url, path)

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return await self._request("POST", path, data=data, params=params)

    async def put(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return await self._request("PUT", path, data=data, params=params)

    async def patch(self, path: str, data: Any = None, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return await self._request("PATCH", path, data=data, params=params)

    async def delete(self, path: str, params: Optional[Dict[str, Any]] = None) -> ApiResponse:
        return await self._request("DELETE", path, params=params)

    async def _request(
        self,
        method: str,
        path: str,
        data: Any = None,
        params: Optional[Dict[str, Any]] = None
    ) -> ApiResponse:
        await self.rate_limiter.acquire()

        session = await self._get_session()
        url = self._build_url(path)

        for attempt in range(self.config.max_retries + 1):
            try:
                async with session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params
                ) as response:
                    body = await response.json() if response.content_length else None

                    return ApiResponse(
                        data=body,
                        status_code=response.status,
                        headers=dict(response.headers)
                    )
            except aiohttp.ClientError as e:
                if attempt == self.config.max_retries:
                    return ApiResponse(status_code=0, error=str(e))
                await asyncio.sleep(self.config.retry_delay * (2 ** attempt))

        return ApiResponse(status_code=0, error="Max retries exceeded")

    async def close(self) -> None:
        if self._session:
            await self._session.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# Convenience functions
def create_client(base_url: str, api_key: Optional[str] = None, **kwargs) -> ApiClient:
    """Create a synchronous API client."""
    config = ApiConfig(base_url=base_url, api_key=api_key, **kwargs)
    return ApiClient(config)


def create_async_client(base_url: str, api_key: Optional[str] = None, **kwargs) -> AsyncApiClient:
    """Create an asynchronous API client."""
    config = ApiConfig(base_url=base_url, api_key=api_key, **kwargs)
    return AsyncApiClient(config)


__all__ = [
    'ApiConfig',
    'ApiResponse',
    'ApiError',
    'ApiClient',
    'AsyncApiClient',
    'create_client',
    'create_async_client'
]
`;
  }

  private generatePythonSetup(): string {
    const { normalizedName, name } = this.context;
    return `from setuptools import setup, find_packages

setup(
    name="${normalizedName}-api-client",
    version="1.0.0",
    description="${name} API Client for Python",
    author="Your Name",
    author_email="you@example.com",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.28.0",
        "aiohttp>=3.8.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.20.0",
            "mypy>=1.0.0",
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
`;
  }

  private generatePythonRequirements(): string {
    return `requests>=2.28.0
aiohttp>=3.8.0
`;
  }

  private generateJavaClient(): string {
    const { normalizedName } = this.context;
    return `package com.api.client;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * ${normalizedName} API Client for Java
 *
 * A type-safe, async-ready API client with automatic retry and rate limiting.
 */
public class ApiClient implements AutoCloseable {

    private final ApiConfig config;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public ApiClient(ApiConfig config) {
        this.config = config;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(config.getTimeout()))
            .build();
    }

    // GET request
    public <T> ApiResponse<T> get(String path, Class<T> responseType) {
        return get(path, null, responseType);
    }

    public <T> ApiResponse<T> get(String path, Map<String, String> params, Class<T> responseType) {
        return request("GET", path, params, null, responseType);
    }

    // POST request
    public <T> ApiResponse<T> post(String path, Object body, Class<T> responseType) {
        return post(path, null, body, responseType);
    }

    public <T> ApiResponse<T> post(String path, Map<String, String> params, Object body, Class<T> responseType) {
        return request("POST", path, params, body, responseType);
    }

    // PUT request
    public <T> ApiResponse<T> put(String path, Object body, Class<T> responseType) {
        return request("PUT", path, null, body, responseType);
    }

    // PATCH request
    public <T> ApiResponse<T> patch(String path, Object body, Class<T> responseType) {
        return request("PATCH", path, null, body, responseType);
    }

    // DELETE request
    public <T> ApiResponse<T> delete(String path, Class<T> responseType) {
        return request("DELETE", path, null, null, responseType);
    }

    // Async GET request
    public <T> CompletableFuture<ApiResponse<T>> getAsync(String path, Class<T> responseType) {
        return requestAsync("GET", path, null, null, responseType);
    }

    // Async POST request
    public <T> CompletableFuture<ApiResponse<T>> postAsync(String path, Object body, Class<T> responseType) {
        return requestAsync("POST", path, null, body, responseType);
    }

    private <T> ApiResponse<T> request(
        String method,
        String path,
        Map<String, String> params,
        Object body,
        Class<T> responseType
    ) {
        try {
            HttpRequest request = buildRequest(method, path, params, body);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return parseResponse(response, responseType);
        } catch (IOException | InterruptedException e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    private <T> CompletableFuture<ApiResponse<T>> requestAsync(
        String method,
        String path,
        Map<String, String> params,
        Object body,
        Class<T> responseType
    ) {
        try {
            HttpRequest request = buildRequest(method, path, params, body);
            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> parseResponse(response, responseType))
                .exceptionally(e -> ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            return CompletableFuture.completedFuture(ApiResponse.error(e.getMessage()));
        }
    }

    private HttpRequest buildRequest(String method, String path, Map<String, String> params, Object body) throws IOException {
        String url = buildUrl(path, params);

        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(config.getTimeout()));

        if (config.getApiKey() != null) {
            builder.header("Authorization", "Bearer " + config.getApiKey());
        }

        config.getHeaders().forEach(builder::header);

        HttpRequest.BodyPublisher bodyPublisher = body != null
            ? HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body))
            : HttpRequest.BodyPublishers.noBody();

        return builder.method(method, bodyPublisher).build();
    }

    private String buildUrl(String path, Map<String, String> params) {
        StringBuilder url = new StringBuilder(config.getBaseUrl());

        if (!config.getBaseUrl().endsWith("/") && !path.startsWith("/")) {
            url.append("/");
        }
        url.append(path);

        if (params != null && !params.isEmpty()) {
            url.append("?");
            params.forEach((key, value) -> url.append(key).append("=").append(value).append("&"));
            url.setLength(url.length() - 1);
        }

        return url.toString();
    }

    private <T> ApiResponse<T> parseResponse(HttpResponse<String> response, Class<T> responseType) {
        try {
            T data = response.body() != null && !response.body().isEmpty()
                ? objectMapper.readValue(response.body(), responseType)
                : null;

            return new ApiResponse<>(
                data,
                response.statusCode(),
                response.headers().map(),
                null
            );
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @Override
    public void close() {
        // HttpClient doesn't need explicit close in Java 11+
    }

    // Builder pattern
    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String baseUrl;
        private String apiKey;
        private int timeout = 30;
        private Map<String, String> headers = Map.of();

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder timeout(int timeout) {
            this.timeout = timeout;
            return this;
        }

        public Builder headers(Map<String, String> headers) {
            this.headers = headers;
            return this;
        }

        public ApiClient build() {
            return new ApiClient(new ApiConfig(baseUrl, apiKey, timeout, headers));
        }
    }
}

// Supporting classes
class ApiConfig {
    private final String baseUrl;
    private final String apiKey;
    private final int timeout;
    private final Map<String, String> headers;

    public ApiConfig(String baseUrl, String apiKey, int timeout, Map<String, String> headers) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.timeout = timeout;
        this.headers = headers != null ? headers : Map.of();
    }

    public String getBaseUrl() { return baseUrl; }
    public String getApiKey() { return apiKey; }
    public int getTimeout() { return timeout; }
    public Map<String, String> getHeaders() { return headers; }
}

class ApiResponse<T> {
    private final T data;
    private final int statusCode;
    private final Map<String, java.util.List<String>> headers;
    private final String error;

    public ApiResponse(T data, int statusCode, Map<String, java.util.List<String>> headers, String error) {
        this.data = data;
        this.statusCode = statusCode;
        this.headers = headers;
        this.error = error;
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(null, 0, Map.of(), message);
    }

    public T getData() { return data; }
    public int getStatusCode() { return statusCode; }
    public Map<String, java.util.List<String>> getHeaders() { return headers; }
    public Optional<String> getError() { return Optional.ofNullable(error); }
    public boolean isSuccess() { return statusCode >= 200 && statusCode < 300; }
}
`;
  }

  private generateJavaPom(): string {
    const { normalizedName, name } = this.context;
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.api.client</groupId>
    <artifactId>${normalizedName}-api-client</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <name>${name} API Client</name>
    <description>Java API Client for ${name}</description>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <jackson.version>2.15.2</jackson.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>\${jackson.version}</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.9.3</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
            </plugin>
        </plugins>
    </build>
</project>
`;
  }

  private generateGoClient(): string {
    const { normalizedName } = this.context;
    return `// Package apiclient provides a ${normalizedName} API client for Go
package apiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Config holds the API client configuration
type Config struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	MaxRetries int
	Headers    map[string]string
}

// DefaultConfig returns a Config with sensible defaults
func DefaultConfig(baseURL string) *Config {
	return &Config{
		BaseURL:    baseURL,
		Timeout:    30 * time.Second,
		MaxRetries: 3,
		Headers:    make(map[string]string),
	}
}

// Response wraps an API response
type Response[T any] struct {
	Data       T
	StatusCode int
	Headers    http.Header
	Error      error
}

// Success returns true if the response was successful
func (r *Response[T]) Success() bool {
	return r.StatusCode >= 200 && r.StatusCode < 300
}

// Client is the API client
type Client struct {
	config     *Config
	httpClient *http.Client
}

// NewClient creates a new API client
func NewClient(config *Config) *Client {
	return &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// Get performs a GET request
func (c *Client) Get(ctx context.Context, path string, params map[string]string, result interface{}) *Response[interface{}] {
	return c.request(ctx, http.MethodGet, path, params, nil, result)
}

// Post performs a POST request
func (c *Client) Post(ctx context.Context, path string, body, result interface{}) *Response[interface{}] {
	return c.request(ctx, http.MethodPost, path, nil, body, result)
}

// Put performs a PUT request
func (c *Client) Put(ctx context.Context, path string, body, result interface{}) *Response[interface{}] {
	return c.request(ctx, http.MethodPut, path, nil, body, result)
}

// Patch performs a PATCH request
func (c *Client) Patch(ctx context.Context, path string, body, result interface{}) *Response[interface{}] {
	return c.request(ctx, http.MethodPatch, path, nil, body, result)
}

// Delete performs a DELETE request
func (c *Client) Delete(ctx context.Context, path string, result interface{}) *Response[interface{}] {
	return c.request(ctx, http.MethodDelete, path, nil, nil, result)
}

func (c *Client) request(
	ctx context.Context,
	method, path string,
	params map[string]string,
	body, result interface{},
) *Response[interface{}] {
	// Build URL
	u, err := url.Parse(c.config.BaseURL)
	if err != nil {
		return &Response[interface{}]{Error: err}
	}
	u.Path = path

	if params != nil {
		q := u.Query()
		for k, v := range params {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
	}

	// Prepare body
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return &Response[interface{}]{Error: err}
		}
		bodyReader = bytes.NewBuffer(jsonBody)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, u.String(), bodyReader)
	if err != nil {
		return &Response[interface{}]{Error: err}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	for k, v := range c.config.Headers {
		req.Header.Set(k, v)
	}

	// Execute with retry
	var resp *http.Response
	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		resp, err = c.httpClient.Do(req)
		if err == nil && resp.StatusCode < 500 {
			break
		}
		if attempt < c.config.MaxRetries {
			time.Sleep(time.Duration(attempt+1) * time.Second)
		}
	}

	if err != nil {
		return &Response[interface{}]{Error: err}
	}
	defer resp.Body.Close()

	// Parse response
	response := &Response[interface{}]{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
	}

	if result != nil && resp.ContentLength != 0 {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			response.Error = err
			return response
		}
		response.Data = result
	}

	return response
}

// WithAPIKey sets the API key
func (c *Client) WithAPIKey(apiKey string) *Client {
	c.config.APIKey = apiKey
	return c
}

// WithHeader adds a custom header
func (c *Client) WithHeader(key, value string) *Client {
	c.config.Headers[key] = value
	return c
}

// WithTimeout sets the request timeout
func (c *Client) WithTimeout(timeout time.Duration) *Client {
	c.config.Timeout = timeout
	c.httpClient.Timeout = timeout
	return c
}
`;
  }

  private generateGoMod(): string {
    const { normalizedName } = this.context;
    return `module github.com/example/${normalizedName}-api-client

go 1.21
`;
  }

  private generateRustClient(): string {
    const { normalizedName } = this.context;
    return `//! ${normalizedName} API Client for Rust
//!
//! A type-safe, async-ready API client with automatic retry and rate limiting.

use reqwest::{Client, Response, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use thiserror::Error;

/// API client configuration
#[derive(Clone, Debug)]
pub struct Config {
    pub base_url: String,
    pub api_key: Option<String>,
    pub timeout: Duration,
    pub max_retries: u32,
    pub headers: HashMap<String, String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            api_key: None,
            timeout: Duration::from_secs(30),
            max_retries: 3,
            headers: HashMap::new(),
        }
    }
}

impl Config {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            ..Default::default()
        }
    }

    pub fn with_api_key(mut self, api_key: impl Into<String>) -> Self {
        self.api_key = Some(api_key.into());
        self
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }
}

/// API response wrapper
#[derive(Debug)]
pub struct ApiResponse<T> {
    pub data: Option<T>,
    pub status_code: StatusCode,
    pub headers: HashMap<String, String>,
}

impl<T> ApiResponse<T> {
    pub fn success(&self) -> bool {
        self.status_code.is_success()
    }
}

/// API error types
#[derive(Error, Debug)]
pub enum ApiError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("API error: {status_code} - {message}")]
    Api {
        status_code: StatusCode,
        message: String,
    },

    #[error("Request timeout")]
    Timeout,
}

/// Result type for API operations
pub type ApiResult<T> = Result<ApiResponse<T>, ApiError>;

/// API client
pub struct ApiClient {
    config: Config,
    client: Client,
}

impl ApiClient {
    /// Create a new API client
    pub fn new(config: Config) -> Result<Self, ApiError> {
        let mut builder = Client::builder()
            .timeout(config.timeout);

        let client = builder.build()?;

        Ok(Self { config, client })
    }

    /// Perform a GET request
    pub async fn get<T: DeserializeOwned>(
        &self,
        path: &str,
        params: Option<&[(&str, &str)]>,
    ) -> ApiResult<T> {
        self.request::<(), T>("GET", path, params, None).await
    }

    /// Perform a POST request
    pub async fn post<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        self.request("POST", path, None, Some(body)).await
    }

    /// Perform a PUT request
    pub async fn put<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        self.request("PUT", path, None, Some(body)).await
    }

    /// Perform a PATCH request
    pub async fn patch<B: Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        self.request("PATCH", path, None, Some(body)).await
    }

    /// Perform a DELETE request
    pub async fn delete<T: DeserializeOwned>(&self, path: &str) -> ApiResult<T> {
        self.request::<(), T>("DELETE", path, None, None).await
    }

    async fn request<B: Serialize, T: DeserializeOwned>(
        &self,
        method: &str,
        path: &str,
        params: Option<&[(&str, &str)]>,
        body: Option<&B>,
    ) -> ApiResult<T> {
        let url = format!("{}{}", self.config.base_url, path);

        let mut request = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "PATCH" => self.client.patch(&url),
            "DELETE" => self.client.delete(&url),
            _ => return Err(ApiError::Api {
                status_code: StatusCode::BAD_REQUEST,
                message: "Invalid method".to_string(),
            }),
        };

        // Add headers
        request = request
            .header("Content-Type", "application/json")
            .header("Accept", "application/json");

        if let Some(api_key) = &self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }

        for (key, value) in &self.config.headers {
            request = request.header(key, value);
        }

        // Add query params
        if let Some(params) = params {
            request = request.query(params);
        }

        // Add body
        if let Some(body) = body {
            request = request.json(body);
        }

        // Execute with retry
        let mut last_error = None;
        for attempt in 0..=self.config.max_retries {
            match request.try_clone() {
                Some(req) => {
                    match req.send().await {
                        Ok(response) => {
                            let status_code = response.status();
                            let headers: HashMap<String, String> = response
                                .headers()
                                .iter()
                                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                                .collect();

                            if status_code.is_success() {
                                let data = response.json().await?;
                                return Ok(ApiResponse {
                                    data: Some(data),
                                    status_code,
                                    headers,
                                });
                            } else if status_code.is_server_error() && attempt < self.config.max_retries {
                                tokio::time::sleep(Duration::from_secs((attempt + 1) as u64)).await;
                                continue;
                            } else {
                                return Err(ApiError::Api {
                                    status_code,
                                    message: response.text().await.unwrap_or_default(),
                                });
                            }
                        }
                        Err(e) => {
                            last_error = Some(e);
                            if attempt < self.config.max_retries {
                                tokio::time::sleep(Duration::from_secs((attempt + 1) as u64)).await;
                            }
                        }
                    }
                }
                None => break,
            }
        }

        Err(last_error.map(ApiError::from).unwrap_or(ApiError::Timeout))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_builder() {
        let config = Config::new("https://api.example.com")
            .with_api_key("test-key")
            .with_timeout(Duration::from_secs(60));

        assert_eq!(config.base_url, "https://api.example.com");
        assert_eq!(config.api_key, Some("test-key".to_string()));
        assert_eq!(config.timeout, Duration::from_secs(60));
    }
}
`;
  }

  private generateRustCargo(): string {
    const { normalizedName, name } = this.context;
    return `[package]
name = "${normalizedName}-api-client"
version = "1.0.0"
edition = "2021"
authors = ["Your Name <you@example.com>"]
description = "${name} API Client for Rust"
license = "MIT"
repository = "https://github.com/example/${normalizedName}-api-client"

[dependencies]
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
tokio-test = "0.4"
mockall = "0.11"
`;
  }

  private generateSwiftClient(): string {
    const { normalizedName } = this.context;
    return `import Foundation

/// ${normalizedName} API Client for Swift
///
/// A type-safe, async-ready API client with automatic retry and rate limiting.

// MARK: - Configuration

public struct ApiConfig {
    public let baseURL: URL
    public var apiKey: String?
    public var timeout: TimeInterval
    public var maxRetries: Int
    public var headers: [String: String]

    public init(
        baseURL: URL,
        apiKey: String? = nil,
        timeout: TimeInterval = 30,
        maxRetries: Int = 3,
        headers: [String: String] = [:]
    ) {
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.timeout = timeout
        self.maxRetries = maxRetries
        self.headers = headers
    }
}

// MARK: - Response

public struct ApiResponse<T: Decodable> {
    public let data: T?
    public let statusCode: Int
    public let headers: [String: String]
    public let error: ApiError?

    public var success: Bool {
        (200..<300).contains(statusCode)
    }
}

// MARK: - Error

public enum ApiError: Error {
    case invalidURL
    case networkError(Error)
    case httpError(statusCode: Int, body: Data?)
    case decodingError(Error)
    case timeout
    case unknown
}

// MARK: - Client

public actor ApiClient {
    private let config: ApiConfig
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(config: ApiConfig) {
        self.config = config

        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = config.timeout
        sessionConfig.timeoutIntervalForResource = config.timeout * 2

        self.session = URLSession(configuration: sessionConfig)
    }

    // MARK: - GET

    public func get<T: Decodable>(
        path: String,
        params: [String: String]? = nil
    ) async throws -> ApiResponse<T> {
        try await request(method: "GET", path: path, params: params, body: nil as String?)
    }

    // MARK: - POST

    public func post<B: Encodable, T: Decodable>(
        path: String,
        body: B
    ) async throws -> ApiResponse<T> {
        try await request(method: "POST", path: path, params: nil, body: body)
    }

    // MARK: - PUT

    public func put<B: Encodable, T: Decodable>(
        path: String,
        body: B
    ) async throws -> ApiResponse<T> {
        try await request(method: "PUT", path: path, params: nil, body: body)
    }

    // MARK: - PATCH

    public func patch<B: Encodable, T: Decodable>(
        path: String,
        body: B
    ) async throws -> ApiResponse<T> {
        try await request(method: "PATCH", path: path, params: nil, body: body)
    }

    // MARK: - DELETE

    public func delete<T: Decodable>(path: String) async throws -> ApiResponse<T> {
        try await request(method: "DELETE", path: path, params: nil, body: nil as String?)
    }

    // MARK: - Private

    private func request<B: Encodable, T: Decodable>(
        method: String,
        path: String,
        params: [String: String]?,
        body: B?
    ) async throws -> ApiResponse<T> {
        // Build URL
        guard var components = URLComponents(url: config.baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true) else {
            throw ApiError.invalidURL
        }

        if let params = params {
            components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        guard let url = components.url else {
            throw ApiError.invalidURL
        }

        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let apiKey = config.apiKey {
            request.setValue("Bearer \\(apiKey)", forHTTPHeaderField: "Authorization")
        }

        for (key, value) in config.headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        // Execute with retry
        var lastError: Error?

        for attempt in 0...config.maxRetries {
            do {
                let (data, response) = try await session.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw ApiError.unknown
                }

                let headers = httpResponse.allHeaderFields as? [String: String] ?? [:]

                if (200..<300).contains(httpResponse.statusCode) {
                    let decodedData = try decoder.decode(T.self, from: data)
                    return ApiResponse(
                        data: decodedData,
                        statusCode: httpResponse.statusCode,
                        headers: headers,
                        error: nil
                    )
                } else if httpResponse.statusCode >= 500 && attempt < config.maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_000_000_000)
                    continue
                } else {
                    throw ApiError.httpError(statusCode: httpResponse.statusCode, body: data)
                }
            } catch {
                lastError = error
                if attempt < config.maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_000_000_000)
                }
            }
        }

        throw lastError ?? ApiError.timeout
    }
}
`;
  }

  private generateSwiftPackage(): string {
    const { normalizedName, name } = this.context;
    return `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "${normalizedName}-api-client",
    platforms: [
        .macOS(.v12),
        .iOS(.v15),
        .tvOS(.v15),
        .watchOS(.v8)
    ],
    products: [
        .library(
            name: "ApiClient",
            targets: ["ApiClient"]
        ),
    ],
    targets: [
        .target(
            name: "ApiClient",
            path: "Sources/ApiClient"
        ),
        .testTarget(
            name: "ApiClientTests",
            dependencies: ["ApiClient"],
            path: "Tests/ApiClientTests"
        ),
    ]
)
`;
  }

  private generateCppHeader(): string {
    const { normalizedName } = this.context;
    return `#pragma once

/**
 * ${normalizedName} API Client for C++
 *
 * A type-safe API client with automatic retry and rate limiting.
 */

#include <string>
#include <map>
#include <memory>
#include <optional>
#include <functional>
#include <chrono>
#include <future>

namespace api {

// Forward declarations
class HttpClient;

/**
 * API configuration
 */
struct Config {
    std::string base_url;
    std::optional<std::string> api_key;
    std::chrono::seconds timeout{30};
    int max_retries{3};
    std::map<std::string, std::string> headers;

    Config(const std::string& url) : base_url(url) {}

    Config& with_api_key(const std::string& key) {
        api_key = key;
        return *this;
    }

    Config& with_timeout(std::chrono::seconds t) {
        timeout = t;
        return *this;
    }
};

/**
 * API response
 */
template<typename T>
struct Response {
    std::optional<T> data;
    int status_code{0};
    std::map<std::string, std::string> headers;
    std::optional<std::string> error;

    bool success() const {
        return status_code >= 200 && status_code < 300;
    }
};

/**
 * JSON value (simplified)
 */
class JsonValue {
public:
    JsonValue() = default;
    JsonValue(const std::string& json);

    template<typename T>
    T as() const;

    std::string to_string() const;

private:
    std::string data_;
};

/**
 * API Client
 */
class ApiClient {
public:
    explicit ApiClient(const Config& config);
    ~ApiClient();

    // Synchronous methods
    Response<JsonValue> get(
        const std::string& path,
        const std::map<std::string, std::string>& params = {}
    );

    Response<JsonValue> post(
        const std::string& path,
        const JsonValue& body
    );

    Response<JsonValue> put(
        const std::string& path,
        const JsonValue& body
    );

    Response<JsonValue> patch(
        const std::string& path,
        const JsonValue& body
    );

    Response<JsonValue> del(const std::string& path);

    // Asynchronous methods
    std::future<Response<JsonValue>> get_async(
        const std::string& path,
        const std::map<std::string, std::string>& params = {}
    );

    std::future<Response<JsonValue>> post_async(
        const std::string& path,
        const JsonValue& body
    );

private:
    Response<JsonValue> request(
        const std::string& method,
        const std::string& path,
        const std::map<std::string, std::string>& params,
        const std::optional<JsonValue>& body
    );

    std::string build_url(
        const std::string& path,
        const std::map<std::string, std::string>& params
    ) const;

    Config config_;
    std::unique_ptr<HttpClient> http_client_;
};

/**
 * Builder for fluent API client creation
 */
class ApiClientBuilder {
public:
    ApiClientBuilder& base_url(const std::string& url);
    ApiClientBuilder& api_key(const std::string& key);
    ApiClientBuilder& timeout(std::chrono::seconds t);
    ApiClientBuilder& header(const std::string& key, const std::string& value);

    std::unique_ptr<ApiClient> build();

private:
    std::optional<std::string> base_url_;
    std::optional<std::string> api_key_;
    std::chrono::seconds timeout_{30};
    std::map<std::string, std::string> headers_;
};

} // namespace api
`;
  }

  private generateCppSource(): string {
    return `#include "api_client.hpp"
#include <sstream>
#include <thread>
#include <curl/curl.h>

namespace api {

// HTTP client implementation using libcurl
class HttpClient {
public:
    HttpClient() {
        curl_global_init(CURL_GLOBAL_DEFAULT);
    }

    ~HttpClient() {
        curl_global_cleanup();
    }

    struct HttpResponse {
        std::string body;
        int status_code;
        std::map<std::string, std::string> headers;
    };

    HttpResponse request(
        const std::string& method,
        const std::string& url,
        const std::map<std::string, std::string>& headers,
        const std::optional<std::string>& body,
        std::chrono::seconds timeout
    ) {
        HttpResponse response;
        CURL* curl = curl_easy_init();

        if (!curl) {
            response.status_code = 0;
            return response;
        }

        // Set URL
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());

        // Set method
        if (method == "POST") {
            curl_easy_setopt(curl, CURLOPT_POST, 1L);
        } else if (method == "PUT") {
            curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
        } else if (method == "PATCH") {
            curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PATCH");
        } else if (method == "DELETE") {
            curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
        }

        // Set headers
        struct curl_slist* header_list = nullptr;
        for (const auto& [key, value] : headers) {
            std::string header = key + ": " + value;
            header_list = curl_slist_append(header_list, header.c_str());
        }
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, header_list);

        // Set body
        if (body) {
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body->c_str());
        }

        // Set timeout
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, static_cast<long>(timeout.count()));

        // Response callback
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response.body);

        // Execute
        CURLcode res = curl_easy_perform(curl);

        if (res == CURLE_OK) {
            long http_code;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
            response.status_code = static_cast<int>(http_code);
        }

        curl_slist_free_all(header_list);
        curl_easy_cleanup(curl);

        return response;
    }

private:
    static size_t write_callback(char* ptr, size_t size, size_t nmemb, std::string* data) {
        data->append(ptr, size * nmemb);
        return size * nmemb;
    }
};

// JsonValue implementation
JsonValue::JsonValue(const std::string& json) : data_(json) {}

std::string JsonValue::to_string() const {
    return data_;
}

// ApiClient implementation
ApiClient::ApiClient(const Config& config)
    : config_(config)
    , http_client_(std::make_unique<HttpClient>()) {}

ApiClient::~ApiClient() = default;

Response<JsonValue> ApiClient::get(
    const std::string& path,
    const std::map<std::string, std::string>& params
) {
    return request("GET", path, params, std::nullopt);
}

Response<JsonValue> ApiClient::post(const std::string& path, const JsonValue& body) {
    return request("POST", path, {}, body);
}

Response<JsonValue> ApiClient::put(const std::string& path, const JsonValue& body) {
    return request("PUT", path, {}, body);
}

Response<JsonValue> ApiClient::patch(const std::string& path, const JsonValue& body) {
    return request("PATCH", path, {}, body);
}

Response<JsonValue> ApiClient::del(const std::string& path) {
    return request("DELETE", path, {}, std::nullopt);
}

std::future<Response<JsonValue>> ApiClient::get_async(
    const std::string& path,
    const std::map<std::string, std::string>& params
) {
    return std::async(std::launch::async, [this, path, params]() {
        return this->get(path, params);
    });
}

std::future<Response<JsonValue>> ApiClient::post_async(
    const std::string& path,
    const JsonValue& body
) {
    return std::async(std::launch::async, [this, path, body]() {
        return this->post(path, body);
    });
}

Response<JsonValue> ApiClient::request(
    const std::string& method,
    const std::string& path,
    const std::map<std::string, std::string>& params,
    const std::optional<JsonValue>& body
) {
    std::string url = build_url(path, params);

    std::map<std::string, std::string> headers = config_.headers;
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";

    if (config_.api_key) {
        headers["Authorization"] = "Bearer " + *config_.api_key;
    }

    std::optional<std::string> body_str;
    if (body) {
        body_str = body->to_string();
    }

    Response<JsonValue> response;

    for (int attempt = 0; attempt <= config_.max_retries; ++attempt) {
        auto http_response = http_client_->request(
            method, url, headers, body_str, config_.timeout
        );

        response.status_code = http_response.status_code;
        response.headers = http_response.headers;

        if (response.success()) {
            response.data = JsonValue(http_response.body);
            break;
        } else if (http_response.status_code >= 500 && attempt < config_.max_retries) {
            std::this_thread::sleep_for(std::chrono::seconds(attempt + 1));
        } else {
            response.error = http_response.body;
            break;
        }
    }

    return response;
}

std::string ApiClient::build_url(
    const std::string& path,
    const std::map<std::string, std::string>& params
) const {
    std::ostringstream url;
    url << config_.base_url;

    if (!config_.base_url.empty() && config_.base_url.back() != '/' && !path.empty() && path.front() != '/') {
        url << '/';
    }
    url << path;

    if (!params.empty()) {
        url << '?';
        bool first = true;
        for (const auto& [key, value] : params) {
            if (!first) url << '&';
            url << key << '=' << value;
            first = false;
        }
    }

    return url.str();
}

// Builder implementation
ApiClientBuilder& ApiClientBuilder::base_url(const std::string& url) {
    base_url_ = url;
    return *this;
}

ApiClientBuilder& ApiClientBuilder::api_key(const std::string& key) {
    api_key_ = key;
    return *this;
}

ApiClientBuilder& ApiClientBuilder::timeout(std::chrono::seconds t) {
    timeout_ = t;
    return *this;
}

ApiClientBuilder& ApiClientBuilder::header(const std::string& key, const std::string& value) {
    headers_[key] = value;
    return *this;
}

std::unique_ptr<ApiClient> ApiClientBuilder::build() {
    if (!base_url_) {
        throw std::runtime_error("base_url is required");
    }

    Config config(*base_url_);
    config.timeout = timeout_;
    config.headers = headers_;

    if (api_key_) {
        config.api_key = *api_key_;
    }

    return std::make_unique<ApiClient>(config);
}

} // namespace api
`;
  }

  private generateCppCMake(): string {
    const { normalizedName, name } = this.context;
    return `cmake_minimum_required(VERSION 3.16)
project(${normalizedName}_api_client VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(CURL REQUIRED)

add_library(\${PROJECT_NAME}
    src/api_client.cpp
)

target_include_directories(\${PROJECT_NAME}
    PUBLIC
        $<BUILD_INTERFACE:\${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)

target_link_libraries(\${PROJECT_NAME}
    PRIVATE
        CURL::libcurl
)

# Installation
install(TARGETS \${PROJECT_NAME}
    EXPORT \${PROJECT_NAME}Targets
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
    RUNTIME DESTINATION bin
    INCLUDES DESTINATION include
)

install(DIRECTORY include/ DESTINATION include)

# Tests
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
`;
  }

  private generateKotlinClient(): string {
    const { normalizedName } = this.context;
    return `package com.api.client

import kotlinx.coroutines.*
import kotlinx.serialization.*
import kotlinx.serialization.json.*
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * ${normalizedName} API Client for Kotlin
 *
 * A type-safe, coroutine-ready API client with automatic retry and rate limiting.
 */

data class ApiConfig(
    val baseUrl: String,
    val apiKey: String? = null,
    val timeout: Duration = Duration.ofSeconds(30),
    val maxRetries: Int = 3,
    val headers: Map<String, String> = emptyMap()
)

data class ApiResponse<T>(
    val data: T? = null,
    val statusCode: Int = 0,
    val headers: Map<String, List<String>> = emptyMap(),
    val error: String? = null
) {
    val success: Boolean get() = statusCode in 200..299
}

class ApiException(
    message: String,
    val statusCode: Int,
    val body: String? = null
) : Exception(message)

class ApiClient(private val config: ApiConfig) : AutoCloseable {

    private val json = Json { ignoreUnknownKeys = true }

    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(config.timeout)
        .build()

    // GET request
    suspend inline fun <reified T> get(
        path: String,
        params: Map<String, String> = emptyMap()
    ): ApiResponse<T> = request("GET", path, params, null)

    // POST request
    suspend inline fun <reified T> post(
        path: String,
        body: Any? = null
    ): ApiResponse<T> = request("POST", path, emptyMap(), body)

    // PUT request
    suspend inline fun <reified T> put(
        path: String,
        body: Any? = null
    ): ApiResponse<T> = request("PUT", path, emptyMap(), body)

    // PATCH request
    suspend inline fun <reified T> patch(
        path: String,
        body: Any? = null
    ): ApiResponse<T> = request("PATCH", path, emptyMap(), body)

    // DELETE request
    suspend inline fun <reified T> delete(path: String): ApiResponse<T> =
        request("DELETE", path, emptyMap(), null)

    @OptIn(ExperimentalSerializationApi::class)
    suspend inline fun <reified T> request(
        method: String,
        path: String,
        params: Map<String, String>,
        body: Any?
    ): ApiResponse<T> = withContext(Dispatchers.IO) {
        val url = buildUrl(path, params)

        val requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(config.timeout)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")

        config.apiKey?.let {
            requestBuilder.header("Authorization", "Bearer $it")
        }

        config.headers.forEach { (key, value) ->
            requestBuilder.header(key, value)
        }

        val bodyPublisher = if (body != null) {
            HttpRequest.BodyPublishers.ofString(json.encodeToString(body as @Serializable Any))
        } else {
            HttpRequest.BodyPublishers.noBody()
        }

        requestBuilder.method(method, bodyPublisher)

        val request = requestBuilder.build()

        var lastError: Exception? = null

        for (attempt in 0..config.maxRetries) {
            try {
                val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())

                if (response.statusCode() in 200..299) {
                    val data = if (response.body().isNotEmpty()) {
                        json.decodeFromString<T>(response.body())
                    } else null

                    return@withContext ApiResponse(
                        data = data,
                        statusCode = response.statusCode(),
                        headers = response.headers().map()
                    )
                } else if (response.statusCode() >= 500 && attempt < config.maxRetries) {
                    delay((attempt + 1).seconds)
                    continue
                } else {
                    return@withContext ApiResponse<T>(
                        statusCode = response.statusCode(),
                        error = response.body()
                    )
                }
            } catch (e: Exception) {
                lastError = e
                if (attempt < config.maxRetries) {
                    delay((attempt + 1).seconds)
                }
            }
        }

        ApiResponse(error = lastError?.message ?: "Request failed")
    }

    private fun buildUrl(path: String, params: Map<String, String>): String {
        val baseUrl = config.baseUrl.trimEnd('/')
        val cleanPath = if (path.startsWith("/")) path else "/$path"
        val url = StringBuilder("$baseUrl$cleanPath")

        if (params.isNotEmpty()) {
            url.append("?")
            params.entries.joinToString("&") { (k, v) -> "$k=$v" }
                .let { url.append(it) }
        }

        return url.toString()
    }

    override fun close() {
        // HttpClient doesn't need explicit close in Java 11+
    }

    companion object {
        fun builder() = Builder()
    }

    class Builder {
        private var baseUrl: String = ""
        private var apiKey: String? = null
        private var timeout: Duration = Duration.ofSeconds(30)
        private val headers = mutableMapOf<String, String>()

        fun baseUrl(url: String) = apply { baseUrl = url }
        fun apiKey(key: String) = apply { apiKey = key }
        fun timeout(duration: Duration) = apply { timeout = duration }
        fun header(key: String, value: String) = apply { headers[key] = value }

        fun build(): ApiClient {
            require(baseUrl.isNotEmpty()) { "baseUrl is required" }
            return ApiClient(ApiConfig(baseUrl, apiKey, timeout, headers = headers))
        }
    }
}

// Extension function for easy client creation
fun apiClient(baseUrl: String, block: ApiClient.Builder.() -> Unit = {}): ApiClient =
    ApiClient.builder().baseUrl(baseUrl).apply(block).build()
`;
  }

  private generateCSharpClient(): string {
    const { normalizedName } = this.context;
    return `using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ApiClient
{
    /// <summary>
    /// ${normalizedName} API Client for C#
    /// A type-safe, async-ready API client with automatic retry and rate limiting.
    /// </summary>

    public class ApiConfig
    {
        public string BaseUrl { get; set; } = "";
        public string? ApiKey { get; set; }
        public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);
        public int MaxRetries { get; set; } = 3;
        public Dictionary<string, string> Headers { get; set; } = new();
    }

    public class ApiResponse<T>
    {
        public T? Data { get; set; }
        public int StatusCode { get; set; }
        public Dictionary<string, IEnumerable<string>> Headers { get; set; } = new();
        public string? Error { get; set; }
        public bool Success => StatusCode >= 200 && StatusCode < 300;
    }

    public class ApiException : Exception
    {
        public int StatusCode { get; }
        public string? Body { get; }

        public ApiException(string message, int statusCode, string? body = null)
            : base(message)
        {
            StatusCode = statusCode;
            Body = body;
        }
    }

    public class ApiClient : IDisposable
    {
        private readonly ApiConfig _config;
        private readonly HttpClient _httpClient;
        private readonly JsonSerializerOptions _jsonOptions;

        public ApiClient(ApiConfig config)
        {
            _config = config;
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(config.BaseUrl),
                Timeout = config.Timeout
            };

            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

            if (!string.IsNullOrEmpty(config.ApiKey))
            {
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {config.ApiKey}");
            }

            foreach (var header in config.Headers)
            {
                _httpClient.DefaultRequestHeaders.Add(header.Key, header.Value);
            }

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true
            };
        }

        // GET request
        public Task<ApiResponse<T>> GetAsync<T>(
            string path,
            Dictionary<string, string>? parameters = null,
            CancellationToken cancellationToken = default)
        {
            return RequestAsync<object, T>(HttpMethod.Get, path, parameters, null, cancellationToken);
        }

        // POST request
        public Task<ApiResponse<T>> PostAsync<TBody, T>(
            string path,
            TBody body,
            CancellationToken cancellationToken = default)
        {
            return RequestAsync<TBody, T>(HttpMethod.Post, path, null, body, cancellationToken);
        }

        // PUT request
        public Task<ApiResponse<T>> PutAsync<TBody, T>(
            string path,
            TBody body,
            CancellationToken cancellationToken = default)
        {
            return RequestAsync<TBody, T>(HttpMethod.Put, path, null, body, cancellationToken);
        }

        // PATCH request
        public Task<ApiResponse<T>> PatchAsync<TBody, T>(
            string path,
            TBody body,
            CancellationToken cancellationToken = default)
        {
            return RequestAsync<TBody, T>(HttpMethod.Patch, path, null, body, cancellationToken);
        }

        // DELETE request
        public Task<ApiResponse<T>> DeleteAsync<T>(
            string path,
            CancellationToken cancellationToken = default)
        {
            return RequestAsync<object, T>(HttpMethod.Delete, path, null, null, cancellationToken);
        }

        private async Task<ApiResponse<T>> RequestAsync<TBody, T>(
            HttpMethod method,
            string path,
            Dictionary<string, string>? parameters,
            TBody? body,
            CancellationToken cancellationToken)
        {
            var url = BuildUrl(path, parameters);
            Exception? lastException = null;

            for (int attempt = 0; attempt <= _config.MaxRetries; attempt++)
            {
                try
                {
                    using var request = new HttpRequestMessage(method, url);

                    if (body != null)
                    {
                        request.Content = JsonContent.Create(body, options: _jsonOptions);
                    }

                    using var response = await _httpClient.SendAsync(request, cancellationToken);

                    var headers = new Dictionary<string, IEnumerable<string>>();
                    foreach (var header in response.Headers)
                    {
                        headers[header.Key] = header.Value;
                    }

                    if (response.IsSuccessStatusCode)
                    {
                        var data = await response.Content.ReadFromJsonAsync<T>(_jsonOptions, cancellationToken);
                        return new ApiResponse<T>
                        {
                            Data = data,
                            StatusCode = (int)response.StatusCode,
                            Headers = headers
                        };
                    }
                    else if ((int)response.StatusCode >= 500 && attempt < _config.MaxRetries)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(attempt + 1), cancellationToken);
                        continue;
                    }
                    else
                    {
                        var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                        return new ApiResponse<T>
                        {
                            StatusCode = (int)response.StatusCode,
                            Headers = headers,
                            Error = errorBody
                        };
                    }
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    if (attempt < _config.MaxRetries)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(attempt + 1), cancellationToken);
                    }
                }
            }

            return new ApiResponse<T>
            {
                Error = lastException?.Message ?? "Request failed"
            };
        }

        private string BuildUrl(string path, Dictionary<string, string>? parameters)
        {
            var url = path;

            if (parameters != null && parameters.Count > 0)
            {
                var queryString = new StringBuilder("?");
                foreach (var param in parameters)
                {
                    queryString.Append($"{Uri.EscapeDataString(param.Key)}={Uri.EscapeDataString(param.Value)}&");
                }
                url += queryString.ToString().TrimEnd('&');
            }

            return url;
        }

        public void Dispose()
        {
            _httpClient.Dispose();
        }

        // Builder pattern
        public class Builder
        {
            private readonly ApiConfig _config = new();

            public Builder BaseUrl(string url)
            {
                _config.BaseUrl = url;
                return this;
            }

            public Builder ApiKey(string key)
            {
                _config.ApiKey = key;
                return this;
            }

            public Builder Timeout(TimeSpan timeout)
            {
                _config.Timeout = timeout;
                return this;
            }

            public Builder Header(string key, string value)
            {
                _config.Headers[key] = value;
                return this;
            }

            public ApiClient Build()
            {
                if (string.IsNullOrEmpty(_config.BaseUrl))
                    throw new InvalidOperationException("BaseUrl is required");
                return new ApiClient(_config);
            }
        }
    }
}
`;
  }

  private generateCSharpProject(): string {
    const { normalizedName, name } = this.context;
    return `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <PackageId>${normalizedName}-api-client</PackageId>
    <Version>1.0.0</Version>
    <Authors>Your Name</Authors>
    <Description>${name} API Client for .NET</Description>
    <PackageLicenseExpression>MIT</PackageLicenseExpression>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="System.Net.Http.Json" Version="8.0.0" />
  </ItemGroup>

</Project>
`;
  }

  private generateRubyClient(): string {
    const { normalizedName } = this.context;
    return `# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'json'

# ${normalizedName} API Client for Ruby
#
# A type-safe API client with automatic retry and rate limiting.

module ApiClient
  # Configuration for the API client
  class Config
    attr_accessor :base_url, :api_key, :timeout, :max_retries, :headers

    def initialize(base_url:, api_key: nil, timeout: 30, max_retries: 3, headers: {})
      @base_url = base_url
      @api_key = api_key
      @timeout = timeout
      @max_retries = max_retries
      @headers = headers
    end
  end

  # API response wrapper
  class Response
    attr_reader :data, :status_code, :headers, :error

    def initialize(data: nil, status_code: 0, headers: {}, error: nil)
      @data = data
      @status_code = status_code
      @headers = headers
      @error = error
    end

    def success?
      (200...300).include?(status_code)
    end
  end

  # API error
  class ApiError < StandardError
    attr_reader :status_code, :body

    def initialize(message, status_code: 0, body: nil)
      super(message)
      @status_code = status_code
      @body = body
    end
  end

  # Main API client class
  class Client
    def initialize(config)
      @config = config
    end

    # GET request
    def get(path, params: {})
      request(:get, path, params: params)
    end

    # POST request
    def post(path, body: nil)
      request(:post, path, body: body)
    end

    # PUT request
    def put(path, body: nil)
      request(:put, path, body: body)
    end

    # PATCH request
    def patch(path, body: nil)
      request(:patch, path, body: body)
    end

    # DELETE request
    def delete(path)
      request(:delete, path)
    end

    private

    def request(method, path, params: {}, body: nil)
      uri = build_uri(path, params)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      http.read_timeout = @config.timeout
      http.open_timeout = @config.timeout

      request = build_request(method, uri, body)
      last_error = nil

      (0..@config.max_retries).each do |attempt|
        begin
          response = http.request(request)
          status_code = response.code.to_i

          if (200...300).include?(status_code)
            data = response.body && !response.body.empty? ? JSON.parse(response.body) : nil
            return Response.new(
              data: data,
              status_code: status_code,
              headers: response.to_hash
            )
          elsif status_code >= 500 && attempt < @config.max_retries
            sleep(attempt + 1)
            next
          else
            return Response.new(
              status_code: status_code,
              headers: response.to_hash,
              error: response.body
            )
          end
        rescue StandardError => e
          last_error = e
          sleep(attempt + 1) if attempt < @config.max_retries
        end
      end

      Response.new(error: last_error&.message || 'Request failed')
    end

    def build_uri(path, params)
      uri = URI.join(@config.base_url, path)
      uri.query = URI.encode_www_form(params) unless params.empty?
      uri
    end

    def build_request(method, uri, body)
      request_class = {
        get: Net::HTTP::Get,
        post: Net::HTTP::Post,
        put: Net::HTTP::Put,
        patch: Net::HTTP::Patch,
        delete: Net::HTTP::Delete
      }[method]

      request = request_class.new(uri)
      request['Content-Type'] = 'application/json'
      request['Accept'] = 'application/json'
      request['Authorization'] = "Bearer #{@config.api_key}" if @config.api_key

      @config.headers.each { |key, value| request[key] = value }

      request.body = body.to_json if body
      request
    end
  end

  # Builder for fluent client creation
  class ClientBuilder
    def initialize
      @base_url = nil
      @api_key = nil
      @timeout = 30
      @headers = {}
    end

    def base_url(url)
      @base_url = url
      self
    end

    def api_key(key)
      @api_key = key
      self
    end

    def timeout(seconds)
      @timeout = seconds
      self
    end

    def header(key, value)
      @headers[key] = value
      self
    end

    def build
      raise ArgumentError, 'base_url is required' unless @base_url

      config = Config.new(
        base_url: @base_url,
        api_key: @api_key,
        timeout: @timeout,
        headers: @headers
      )
      Client.new(config)
    end
  end

  def self.builder
    ClientBuilder.new
  end
end
`;
  }

  private generateRubyGemspec(): string {
    const { normalizedName, name } = this.context;
    return `# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = '${normalizedName}-api-client'
  spec.version       = '1.0.0'
  spec.authors       = ['Your Name']
  spec.email         = ['you@example.com']

  spec.summary       = '${name} API Client for Ruby'
  spec.description   = 'A type-safe API client for ${name} with automatic retry and rate limiting'
  spec.homepage      = 'https://github.com/example/${normalizedName}-api-client'
  spec.license       = 'MIT'

  spec.required_ruby_version = '>= 3.0.0'

  spec.files = Dir['lib/**/*', 'README.md', 'LICENSE']
  spec.require_paths = ['lib']

  spec.add_development_dependency 'rspec', '~> 3.12'
  spec.add_development_dependency 'webmock', '~> 3.18'
end
`;
  }

  private generatePhpClient(): string {
    const { normalizedName } = this.context;
    return `<?php

declare(strict_types=1);

namespace ApiClient;

/**
 * ${normalizedName} API Client for PHP
 *
 * A type-safe API client with automatic retry and rate limiting.
 */

class Config
{
    public function __construct(
        public readonly string $baseUrl,
        public readonly ?string $apiKey = null,
        public readonly int $timeout = 30,
        public readonly int $maxRetries = 3,
        public readonly array $headers = []
    ) {}
}

class Response
{
    public function __construct(
        public readonly mixed $data = null,
        public readonly int $statusCode = 0,
        public readonly array $headers = [],
        public readonly ?string $error = null
    ) {}

    public function success(): bool
    {
        return $this->statusCode >= 200 && $this->statusCode < 300;
    }
}

class ApiException extends \\Exception
{
    public function __construct(
        string $message,
        public readonly int $statusCode = 0,
        public readonly ?string $body = null
    ) {
        parent::__construct($message);
    }
}

class Client
{
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    /**
     * GET request
     */
    public function get(string $path, array $params = []): Response
    {
        return $this->request('GET', $path, $params);
    }

    /**
     * POST request
     */
    public function post(string $path, mixed $body = null): Response
    {
        return $this->request('POST', $path, [], $body);
    }

    /**
     * PUT request
     */
    public function put(string $path, mixed $body = null): Response
    {
        return $this->request('PUT', $path, [], $body);
    }

    /**
     * PATCH request
     */
    public function patch(string $path, mixed $body = null): Response
    {
        return $this->request('PATCH', $path, [], $body);
    }

    /**
     * DELETE request
     */
    public function delete(string $path): Response
    {
        return $this->request('DELETE', $path);
    }

    private function request(
        string $method,
        string $path,
        array $params = [],
        mixed $body = null
    ): Response {
        $url = $this->buildUrl($path, $params);
        $lastError = null;

        for ($attempt = 0; $attempt <= $this->config->maxRetries; $attempt++) {
            try {
                $ch = curl_init();

                curl_setopt_array($ch, [
                    CURLOPT_URL => $url,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => $this->config->timeout,
                    CURLOPT_CUSTOMREQUEST => $method,
                    CURLOPT_HTTPHEADER => $this->buildHeaders(),
                    CURLOPT_HEADER => true,
                ]);

                if ($body !== null) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
                }

                $response = curl_exec($ch);
                $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

                if ($response === false) {
                    throw new \\Exception(curl_error($ch));
                }

                curl_close($ch);

                $headers = $this->parseHeaders(substr($response, 0, $headerSize));
                $responseBody = substr($response, $headerSize);

                if ($statusCode >= 200 && $statusCode < 300) {
                    $data = $responseBody ? json_decode($responseBody, true) : null;
                    return new Response(
                        data: $data,
                        statusCode: $statusCode,
                        headers: $headers
                    );
                } elseif ($statusCode >= 500 && $attempt < $this->config->maxRetries) {
                    sleep($attempt + 1);
                    continue;
                } else {
                    return new Response(
                        statusCode: $statusCode,
                        headers: $headers,
                        error: $responseBody
                    );
                }
            } catch (\\Exception $e) {
                $lastError = $e;
                if ($attempt < $this->config->maxRetries) {
                    sleep($attempt + 1);
                }
            }
        }

        return new Response(error: $lastError?->getMessage() ?? 'Request failed');
    }

    private function buildUrl(string $path, array $params): string
    {
        $baseUrl = rtrim($this->config->baseUrl, '/');
        $path = ltrim($path, '/');
        $url = "{$baseUrl}/{$path}";

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        return $url;
    }

    private function buildHeaders(): array
    {
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if ($this->config->apiKey) {
            $headers[] = "Authorization: Bearer {$this->config->apiKey}";
        }

        foreach ($this->config->headers as $key => $value) {
            $headers[] = "{$key}: {$value}";
        }

        return $headers;
    }

    private function parseHeaders(string $headerText): array
    {
        $headers = [];
        foreach (explode("\\r\\n", $headerText) as $line) {
            if (strpos($line, ':') !== false) {
                [$key, $value] = explode(':', $line, 2);
                $headers[trim($key)] = trim($value);
            }
        }
        return $headers;
    }

    /**
     * Create a new client builder
     */
    public static function builder(): ClientBuilder
    {
        return new ClientBuilder();
    }
}

class ClientBuilder
{
    private ?string $baseUrl = null;
    private ?string $apiKey = null;
    private int $timeout = 30;
    private array $headers = [];

    public function baseUrl(string $url): self
    {
        $this->baseUrl = $url;
        return $this;
    }

    public function apiKey(string $key): self
    {
        $this->apiKey = $key;
        return $this;
    }

    public function timeout(int $seconds): self
    {
        $this->timeout = $seconds;
        return $this;
    }

    public function header(string $key, string $value): self
    {
        $this->headers[$key] = $value;
        return $this;
    }

    public function build(): Client
    {
        if (!$this->baseUrl) {
            throw new \\InvalidArgumentException('baseUrl is required');
        }

        return new Client(new Config(
            baseUrl: $this->baseUrl,
            apiKey: $this->apiKey,
            timeout: $this->timeout,
            headers: $this->headers
        ));
    }
}
`;
  }

  private generatePhpComposer(): string {
    const { normalizedName, name } = this.context;
    return JSON.stringify({
      name: `example/${normalizedName}-api-client`,
      description: `${name} API Client for PHP`,
      type: 'library',
      license: 'MIT',
      autoload: {
        'psr-4': {
          'ApiClient\\': 'src/'
        }
      },
      require: {
        php: '>=8.1',
        'ext-curl': '*',
        'ext-json': '*'
      },
      'require-dev': {
        phpunit: '^10.0'
      }
    }, null, 2);
  }

  private generateOpenApiSpec(): string {
    const { name, normalizedName } = this.context;
    return `openapi: 3.0.3
info:
  title: ${name} API
  description: API specification for ${name}
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

paths:
  /health:
    get:
      summary: Health check
      operationId: healthCheck
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /items:
    get:
      summary: List items
      operationId: listItems
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: List of items
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ItemList'
    post:
      summary: Create item
      operationId: createItem
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateItemRequest'
      responses:
        '201':
          description: Item created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Item'

  /items/{id}:
    get:
      summary: Get item by ID
      operationId: getItem
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Item details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Item'
        '404':
          description: Item not found
    put:
      summary: Update item
      operationId: updateItem
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateItemRequest'
      responses:
        '200':
          description: Item updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Item'
    delete:
      summary: Delete item
      operationId: deleteItem
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Item deleted

components:
  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          example: healthy
        timestamp:
          type: string
          format: date-time

    Item:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    ItemList:
      type: object
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/Item'
        total:
          type: integer
        page:
          type: integer
        limit:
          type: integer

    CreateItemRequest:
      type: object
      required:
        - name
      properties:
        name:
          type: string
        description:
          type: string

    UpdateItemRequest:
      type: object
      properties:
        name:
          type: string
        description:
          type: string

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
`;
  }

  private generateClientScript(): string {
    return `#!/bin/bash
set -e

# Generate API clients from OpenAPI specification

SPEC_FILE="openapi.yaml"
OUTPUT_DIR="clients/generated"

echo "Generating API clients from $SPEC_FILE..."

# Install OpenAPI Generator if not present
if ! command -v openapi-generator-cli &> /dev/null; then
    echo "Installing OpenAPI Generator..."
    npm install -g @openapitools/openapi-generator-cli
fi

# Generate Python client
echo "Generating Python client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g python \\
    -o $OUTPUT_DIR/python \\
    --additional-properties=packageName=api_client

# Generate Java client
echo "Generating Java client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g java \\
    -o $OUTPUT_DIR/java \\
    --additional-properties=library=native

# Generate Go client
echo "Generating Go client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g go \\
    -o $OUTPUT_DIR/go \\
    --additional-properties=packageName=apiclient

# Generate TypeScript client
echo "Generating TypeScript client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g typescript-fetch \\
    -o $OUTPUT_DIR/typescript

# Generate Rust client
echo "Generating Rust client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g rust \\
    -o $OUTPUT_DIR/rust

# Generate Swift client
echo "Generating Swift client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g swift5 \\
    -o $OUTPUT_DIR/swift

# Generate Kotlin client
echo "Generating Kotlin client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g kotlin \\
    -o $OUTPUT_DIR/kotlin

# Generate C# client
echo "Generating C# client..."
openapi-generator-cli generate \\
    -i $SPEC_FILE \\
    -g csharp \\
    -o $OUTPUT_DIR/csharp

echo "All clients generated successfully!"
echo "Output directory: $OUTPUT_DIR"
`;
  }

  protected generateReadme(): string {
    const { name } = this.context;
    return `# Multi-Language API Clients

API clients for ${name} in multiple programming languages.

## Supported Languages

| Language | Directory | Package Manager |
|----------|-----------|-----------------|
| Python | \`clients/python\` | pip |
| Java | \`clients/java\` | Maven |
| Go | \`clients/go\` | go mod |
| Rust | \`clients/rust\` | Cargo |
| Swift | \`clients/swift\` | SPM |
| C++ | \`clients/cpp\` | CMake |
| Kotlin | \`clients/kotlin\` | Gradle |
| C# | \`clients/csharp\` | NuGet |
| Ruby | \`clients/ruby\` | RubyGems |
| PHP | \`clients/php\` | Composer |

## Quick Start

### Python

\`\`\`python
from api_client import create_client

client = create_client("https://api.example.com", api_key="your-key")
response = client.get("/items")
print(response.data)
\`\`\`

### Java

\`\`\`java
ApiClient client = ApiClient.builder()
    .baseUrl("https://api.example.com")
    .apiKey("your-key")
    .build();

ApiResponse<Item[]> response = client.get("/items", Item[].class);
\`\`\`

### Go

\`\`\`go
config := apiclient.DefaultConfig("https://api.example.com")
config.APIKey = "your-key"

client := apiclient.NewClient(config)
response := client.Get(ctx, "/items", nil, &items)
\`\`\`

### Rust

\`\`\`rust
let config = Config::new("https://api.example.com")
    .with_api_key("your-key");

let client = ApiClient::new(config)?;
let response: ApiResponse<Vec<Item>> = client.get("/items", None).await?;
\`\`\`

### Swift

\`\`\`swift
let config = ApiConfig(
    baseURL: URL(string: "https://api.example.com")!,
    apiKey: "your-key"
)

let client = ApiClient(config: config)
let response: ApiResponse<[Item]> = try await client.get(path: "/items")
\`\`\`

## Features

All clients include:

- Type-safe request/response handling
- Automatic retry with exponential backoff
- Configurable timeouts
- Rate limiting support
- Async/await support (where applicable)
- Builder pattern for configuration
- Comprehensive error handling

## Code Generation

Generate clients from OpenAPI specification:

\`\`\`bash
./scripts/generate-clients.sh
\`\`\`

## License

MIT
`;
  }
}
