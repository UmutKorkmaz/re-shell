/**
 * Performance Testing for Polyglot Services
 *
 * Generates performance testing utilities for benchmarking service interactions:
 * - Load testing and stress testing
 * - Latency and throughput measurements
 * - Multi-language benchmark implementations
 * - Performance regression detection
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type PerfLanguage = 'typescript' | 'python' | 'go';

export interface BenchmarkConfig {
  serviceName: string;
  baseUrl: string;
  language: PerfLanguage;
  outputDir: string;
  endpoints: BenchmarkEndpoint[];
  duration?: number;
  concurrency?: number;
  rampUpTime?: number;
}

export interface BenchmarkEndpoint {
  name: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  weight?: number;
}

// TypeScript Performance Testing
export function generateTypeScriptPerformanceTest(config: BenchmarkConfig): string {
  const duration = config.duration || 60;
  const concurrency = config.concurrency || 10;

  return `// Auto-generated Performance Tests for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

import { describe, beforeAll, afterAll, it } from '@jest/globals';
import autocannon from 'autocannon';

const baseUrl = process.env.BASE_URL || '${config.baseUrl}';
const duration = ${duration};
const connections = ${concurrency};

describe('Performance: ${config.serviceName}', () => {
  ${config.endpoints.map((endpoint, index) => {
    return `  describe('Benchmark ${index + 1}: ${endpoint.name}', () => {
    it('should meet performance SLA', async () => {
      const result = await autocannon({
        url: baseUrl + '${endpoint.path}',
        connections: connections,
        duration: duration,
        method: '${endpoint.method}',
        headers: ${JSON.stringify(endpoint.headers || {})},
        ${endpoint.body ? `body: ${JSON.stringify(endpoint.body)},` : ''}
        amount: 1000,
      });

      console.log('\\n📊 Results for ${endpoint.name}:');
      console.log('  Requests:', result.requests.mean, 'req/sec');
      console.log('  Latency:', result.latency.mean, 'ms');
      console.log('  Throughput:', result.throughput.mean, 'bytes/sec');
      console.log('  Errors:', result.errors, '\\n');

      // Performance SLA assertions
      expect(result.errors).toBe(0);
      expect(result.latency.mean).toBeLessThan(500); // 500ms p95 latency
      expect(result.requests.mean).toBeGreaterThan(100); // Min 100 req/sec
    });
  });`;
  }).join('\n\n')}

  describe('Stress Test: Combined Load', () => {
    it('should handle concurrent requests across all endpoints', async () => {
      const instances = ${config.endpoints.length};
      const results = await Promise.all(
        ${config.endpoints.map((endpoint, index) => `autocannon({
          url: baseUrl + '${endpoint.path}',
          connections: Math.floor(connections / instances),
          duration: duration,
          method: '${endpoint.method}',
          headers: ${JSON.stringify(endpoint.headers || {})},
          ${endpoint.body ? `body: ${JSON.stringify(endpoint.body)},` : ''}
        })`).join(',\n        ')}
      );

      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const avgLatency = results.reduce((sum, r) => sum + r.latency.mean, 0) / results.length;

      console.log('\\n📊 Combined Results:');
      console.log('  Total Errors:', totalErrors);
      console.log('  Average Latency:', avgLatency, 'ms\\n');

      expect(totalErrors).toBe(0);
      expect(avgLatency).toBeLessThan(1000);
    });
  });
});
`;
}

// Python Performance Testing
export function generatePythonPerformanceTest(config: BenchmarkConfig): string {
  const duration = config.duration || 60;
  const concurrency = config.concurrency || 10;

  return `# Auto-generated Performance Tests for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

import asyncio
import aiohttp
import time
from typing import Dict, List
from statistics import mean

class PerformanceTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results = []

    async def measure_endpoint(self, session: aiohttp.ClientSession, endpoint: Dict) -> Dict:
        """Measure performance of a single endpoint"""
        url = self.base_url + endpoint['path']
        headers = endpoint.get('headers', {})
        data = endpoint.get('body')

        latencies = []
        errors = 0
        start_time = time.time()

        for _ in range(100):
            req_start = time.time()
            try:
                if data:
                    async with session.request(
                        endpoint['method'],
                        url,
                        json=data,
                        headers=headers
                    ) as response:
                        if response.status >= 400:
                            errors += 1
                else:
                    async with session.request(
                        endpoint['method'],
                        url,
                        headers=headers
                    ) as response:
                        if response.status >= 400:
                            errors += 1
            except Exception as e:
                errors += 1

            latencies.append((time.time() - req_start) * 1000)

        total_time = time.time() - start_time
        avg_latency = mean(latencies)
        throughput = 100 / total_time

        return {
            'endpoint': endpoint['name'],
            'avg_latency_ms': round(avg_latency, 2),
            'throughput_rps': round(throughput, 2),
            'errors': errors,
            'requests': 100,
        }

    async def run_benchmark(self, endpoints: List[Dict], concurrency: int = ${concurrency}):
        """Run benchmark across all endpoints"""
        async with aiohttp.ClientSession() as session:
            tasks = []
            for endpoint in endpoints:
                for _ in range(concurrency):
                    tasks.append(self.measure_endpoint(session, endpoint))

            results = await asyncio.gather(*tasks)

        for result in results:
            self.results.append(result)
            print(f"\\n📊 {result['endpoint']}:")
            print(f"  Latency: {result['avg_latency_ms']} ms")
            print(f"  Throughput: {result['throughput_rps']} req/sec")
            print(f"  Errors: {result['errors']}")

        return self.results

    def assert_sla(self):
        """Assert performance SLA"""
        for result in self.results:
            assert result['errors'] == 0, f"{result['endpoint']}: Errors detected"
            assert result['avg_latency_ms'] < 500, f"{result['endpoint']}: Latency too high"
            assert result['throughput_rps'] > 100, f"{result['endpoint']}: Throughput too low"


async def run_performance_tests():
    """Run all performance tests"""
    tester = PerformanceTester('${config.baseUrl}')

    endpoints = [
${config.endpoints.map(ep => `        {
            'name': '${ep.name}',
            'path': '${ep.path}',
            'method': '${ep.method}',
            'headers': ${JSON.stringify(ep.headers || {})},
            ${ep.body ? `'body': ${JSON.stringify(ep.body)},` : ''}
        },`).join('\n')}
    ]

    results = await tester.run_benchmark(endpoints)
    tester.assert_sla()

    print(f"\\n✅ All performance tests passed!")


if __name__ == '__main__':
    asyncio.run(run_performance_tests())
`;
}

// Go Performance Testing
export function generateGoPerformanceTest(config: BenchmarkConfig): string {
  return `// Auto-generated Performance Tests for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type BenchmarkEndpoint struct {
	Name    string
	Path    string
	Method  string
	Headers map[string]string
	Body    interface{}
}

type BenchmarkResult struct {
	Endpoint       string
	AvgLatencyMs   float64
	ThroughputRPS  float64
	Errors         int
	TotalRequests  int
}

func main() {
	baseURL := "${config.baseUrl}"
	if url := baseURL; url == "" {
		baseURL = "http://localhost:3000"
	}

	endpoints := []BenchmarkEndpoint{
${config.endpoints.map(ep => `		{
			Name:    "${ep.name}",
			Path:    "${ep.path}",
			Method:  "${ep.method}",
			Headers: ${JSON.stringify(ep.headers || {})},
			${ep.body ? `Body: ${JSON.stringify(ep.body)},` : ''}
		},`).join('\n')}
	}

	fmt.Println("\\n🚀 Starting Performance Tests...")
	fmt.Println("Base URL:", baseURL)
	fmt.Println()

	results := runBenchmarks(baseURL, endpoints)

	for _, result := range results {
		fmt.Printf("\\n📊 %s:\\n", result.Endpoint)
		fmt.Printf("  Latency: %.2f ms\\n", result.AvgLatencyMs)
		fmt.Printf("  Throughput: %.2f req/sec\\n", result.ThroughputRPS)
		fmt.Printf("  Errors: %d\\n", result.Errors)

		// Performance SLA assertions
		if result.Errors > 0 {
			panic(fmt.Sprintf("%s: Errors detected", result.Endpoint))
		}
		if result.AvgLatencyMs > 500 {
			panic(fmt.Sprintf("%s: Latency too high", result.Endpoint))
		}
		if result.ThroughputRPS < 100 {
			panic(fmt.Sprintf("%s: Throughput too low", result.Endpoint))
		}
	}

	fmt.Println("\\n✅ All performance tests passed!")
}

func runBenchmarks(baseURL string, endpoints []BenchmarkEndpoint) []BenchmarkResult {
	var results []BenchmarkResult

	for _, endpoint := range endpoints {
		result := benchmarkEndpoint(baseURL, endpoint, 100, 10)
		results = append(results, result)
	}

	return results
}

func benchmarkEndpoint(baseURL string, endpoint BenchmarkEndpoint, requests, concurrency int) BenchmarkResult {
	url := baseURL + endpoint.Path

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, concurrency)
	var mu sync.Mutex

	var totalLatency time.Duration
	var errors int

	start := time.Now()

	for i := 0; i < requests; i++ {
		wg.Add(1)
		semaphore <- struct{}{}

		go func() {
			defer wg.Done()
			defer func() { <-semaphore }()

			reqStart := time.Now()
			err := makeRequest(url, endpoint)
			latency := time.Since(reqStart)

			mu.Lock()
			totalLatency += latency
			if err != nil {
				errors++
			}
			mu.Unlock()
		}()
	}

	wg.Wait()
	totalDuration := time.Since(start)

	avgLatency := float64(totalLatency.Milliseconds()) / float64(requests)
	throughput := float64(requests) / totalDuration.Seconds()

	return BenchmarkResult{
		Endpoint:      endpoint.Name,
		AvgLatencyMs:  avgLatency,
		ThroughputRPS: throughput,
		Errors:        errors,
		TotalRequests: requests,
	}
}

func makeRequest(url string, endpoint BenchmarkEndpoint) error {
	var body io.Reader

	if endpoint.Body != nil {
		jsonBody, _ := json.Marshal(endpoint.Body)
		body = bytes.NewBuffer(jsonBody)
	}

	req, _ := http.NewRequest(endpoint.Method, url, body)

	for key, value := range endpoint.Headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("status code: %d", resp.StatusCode)
	}

	return nil
}
`;
}

// Display configuration
export function displayConfig(config: BenchmarkConfig): void {
  console.log(chalk.cyan('\n✨ Performance Testing Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`${chalk.yellow('Service Name:')} ${chalk.white(config.serviceName)}`);
  console.log(`${chalk.yellow('Base URL:')} ${chalk.white(config.baseUrl)}`);
  console.log(`${chalk.yellow('Language:')} ${chalk.white(config.language)}`);
  console.log(`${chalk.yellow('Duration:')} ${chalk.white((config.duration || 60) + 's')}`);
  console.log(`${chalk.yellow('Concurrency:')} ${chalk.white(config.concurrency || 10)}`);
  console.log(`${chalk.yellow('Endpoints:')} ${chalk.white(config.endpoints.length)}`);

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Benchmark Endpoints:\n'));

  config.endpoints.slice(0, 5).forEach((ep, index) => {
    console.log(`  ${chalk.green((index + 1).toString() + '.')} ${chalk.white(ep.name)}`);
    console.log(`     ${chalk.gray(ep.method + ' ' + ep.path)}`);
  });

  if (config.endpoints.length > 5) {
    console.log(`  ${chalk.gray(`... and ${config.endpoints.length - 5} more`)}`);
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: BenchmarkConfig): string {
  let content = '# Performance Testing for ' + config.serviceName + '\n\n';
  content += 'Performance and load testing utilities for **' + config.serviceName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Service**: ' + config.serviceName + '\n';
  content += '- **Base URL**: ' + config.baseUrl + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Duration**: ' + (config.duration || 60) + 's\n';
  content += '- **Concurrency**: ' + (config.concurrency || 10) + '\n';
  content += '- **Endpoints**: ' + config.endpoints.length + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install --save-dev jest @types/jest autocannon\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install aiohttp pytest-asyncio\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += 'go mod download\n';
    content += '```\n\n';
  }

  content += '## 💻 Running Tests\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += '# Set base URL\n';
    content += 'export BASE_URL="http://localhost:3000"\n\n';
    content += '# Run benchmarks\n';
    content += 'npm test\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += '# Run benchmarks\n';
    content += 'python performance_test.py\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += '# Run benchmarks\n';
    content += 'go run performance_test.go\n';
    content += '```\n\n';
  }

  content += '## 📚 Benchmark Endpoints\n\n';

  config.endpoints.forEach((ep, index) => {
    content += '### ' + (index + 1) + '. ' + ep.name + '\n\n';
    content += '- **Method**: ' + ep.method + '\n';
    content += '- **Path**: ' + ep.path + '\n';
    content += '- **Weight**: ' + (ep.weight || 1) + '\n\n';
  });

  content += '## 🎯 Performance SLA\n\n';
  content += '- **Latency**: p95 < 500ms\n';
  content += '- **Throughput**: > 100 req/sec\n';
  content += '- **Error Rate**: 0%\n';
  content += '- **Concurrent Users**: ' + (config.concurrency || 10) + '\n\n';

  content += '## 📈 Performance Metrics\n\n';
  content += 'Tests measure:\n';
  content += '- Average latency (mean, p50, p95, p99)\n';
  content += '- Throughput (requests per second)\n';
  content += '- Error rate and failures\n';
  content += '- Concurrent request handling\n';
  content += '- Resource utilization\n\n';

  content += '## 🔄 CI/CD Integration\n\n';
  content += '```yaml\n';
  content += 'performance:\n';
  content += '  script:\n';

  if (config.language === 'typescript') {
    content += '    - npm test\n';
  } else if (config.language === 'python') {
    content += '    - python performance_test.py\n';
  } else if (config.language === 'go') {
    content += '    - go run performance_test.go\n';
  }

  content += '  only:\n';
  content += '    - merge_requests\n';
  content += '    - main\n';
  content += '```\n';

  return content;
}

// Write files
export async function writePerformanceTestFiles(
  config: BenchmarkConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = 'performance_test.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptPerformanceTest(config);
  } else if (config.language === 'python') {
    content = generatePythonPerformanceTest(config);
  } else if (config.language === 'go') {
    content = generateGoPerformanceTest(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.serviceName.toLowerCase() + '-performance-test',
      version: '1.0.0',
      description: 'Performance tests for ' + config.serviceName,
      scripts: {
        test: 'jest',
      },
      devDependencies: {
        '@types/jest': '^29.0.0',
        autocannon: '^7.12.0',
        jest: '^29.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✅ Generated: package.json'));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'aiohttp>=3.9.0',
      'pytest-asyncio>=0.21.0',
    ];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = 'module ' + config.serviceName.toLowerCase() + '\n\n' +
                  'go 1.21\n';

    const goModPath = path.join(output, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green('✅ Generated: go.mod'));
  }

  // Generate benchmark config JSON
  const benchmarkConfig = {
    serviceName: config.serviceName,
    baseUrl: config.baseUrl,
    duration: config.duration || 60,
    concurrency: config.concurrency || 10,
    endpoints: config.endpoints,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'benchmark.json');
  await fs.writeFile(configPath, JSON.stringify(benchmarkConfig, null, 2));
  console.log(chalk.green('✅ Generated: benchmark.json'));
}
