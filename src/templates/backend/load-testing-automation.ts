// Load Testing and Stress Testing Automation
// Automated load and stress testing for full-stack applications

import { BackendTemplate } from '../types';

export const loadTestingTemplate: BackendTemplate = {
  id: 'load-testing-automation',
  name: 'Load Testing & Stress Testing Automation',
  displayName: 'Automated Load Testing and Stress Testing for Full-Stack Applications',
  description: 'Comprehensive load and stress testing automation with performance metrics, bottleneck detection, and scalability analysis',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['testing', 'monitoring', 'documentation'],
  tags: ['load-testing', 'stress-testing', 'performance', 'automation', 'scalability'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-load-testing",
  "version": "1.0.0",
  "description": "{{name}} - Load Testing & Stress Testing Automation",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "axios": "^1.5.0",
    "p-limit": "^4.0.0",
    "p-queue": "^7.4.0",
    "chalk": "^4.1.2",
    "cli-table3": "^0.6.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,

    'src/index.ts': `// Load Testing & Stress Testing Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { LoadTestRunner } from './load-test-runner';
import { StressTestRunner } from './stress-test-runner';
import { PerformanceMetrics } from './performance-metrics';
import { apiRoutes } from './routes/api.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize components
const loadTestRunner = new LoadTestRunner();
const stressTestRunner = new StressTestRunner();
const performanceMetrics = new PerformanceMetrics();

// Mount routes
app.use('/api', apiRoutes(loadTestRunner, stressTestRunner, performanceMetrics));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`⚡ Load Testing Server running on port \${PORT}\`);
  console.log(\`📊 Automated load and stress testing enabled\`);
});`,

    'src/load-test-runner.ts': `// Load Test Runner
// Automated load testing with concurrent requests

import PQueue from 'p-queue';
import axios from 'axios';
import pLimit from 'p-limit';

export interface LoadTestConfig {
  targetUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  concurrency: number;
  totalRequests: number;
  duration?: number;
  rampUp?: number;
  body?: any;
  headers?: Record<string, string>;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errors: Array<{ error: string; count: number }>;
  duration: number;
}

export class LoadTestRunner {
  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    const {
      targetUrl,
      method,
      concurrency,
      totalRequests,
      duration,
      rampUp = 0,
      body,
      headers = {},
    } = config;

    const startTime = Date.now();
    const responseTimes: number[] = [];
    const errors: Map<string, number> = new Map();
    let successfulRequests = 0;
    let failedRequests = 0;

    const limit = pLimit(concurrency);

    const executeRequest = async (): Promise<void> => {
      try {
        const requestStart = Date.now();

        const response = await axios({
          method,
          url: targetUrl,
          data: body,
          headers,
          timeout: 30000,
          validateStatus: () => true,
        });

        const requestTime = Date.now() - requestStart;
        responseTimes.push(requestTime);

        if (response.status >= 400) {
          failedRequests++;
          const errorKey = \`HTTP \${response.status}\`;
          errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
        } else {
          successfulRequests++;
        }
      } catch (error: any) {
        failedRequests++;
        const errorKey = error.code || error.message || 'Unknown error';
        errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
      }
    };

    // Create queue for requests
    const queue = new PQueue({ concurrency });

    // Execute requests
    if (duration) {
      // Run for specified duration
      const endTime = startTime + duration * 1000;
      let requestCount = 0;

      while (Date.now() < endTime) {
        const remainingRequests = Math.min(concurrency, totalRequests - requestCount);

        for (let i = 0; i < remainingRequests; i++) {
          queue.add(executeRequest);
          requestCount++;
        }

        await queue.onIdle();

        if (requestCount >= totalRequests) {
          break;
        }
      }
    } else {
      // Run specified number of requests
      for (let i = 0; i < totalRequests; i++) {
        queue.add(executeRequest);
      }

      await queue.onIdle();
    }

    const testDuration = Date.now() - startTime;

    // Calculate percentiles
    responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] || 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

    return {
      totalRequests: responseTimes.length,
      successfulRequests,
      failedRequests,
      requestsPerSecond: (responseTimes.length / testDuration) * 1000,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      p50,
      p95,
      p99,
      errors: Array.from(errors.entries()).map(([error, count]) => ({ error, count })),
      duration: testDuration,
    };
  }
}`,

    'src/stress-test-runner.ts': `// Stress Test Runner
// Stress testing to find breaking points

import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';
import axios from 'axios';

export interface StressTestConfig {
  targetUrl: string;
  method: 'GET' | 'POST';
  initialConcurrency: number;
  maxConcurrency: number;
  step: number;
  stepDuration: number;
  maxDuration?: number;
  errorThreshold: number;
}

export interface StressTestResult {
  breakingPoint: number;
  maxSuccessfulRPS: number;
  testResults: Array<{
    concurrency: number;
    rps: number;
    avgResponseTime: number;
    errorRate: number;
    successful: boolean;
  }>;
}

export class StressTestRunner extends EventEmitter {
  async run(config: StressTestConfig): Promise<StressTestResult> {
    const {
      targetUrl,
      method,
      initialConcurrency,
      maxConcurrency,
      step,
      stepDuration,
      maxDuration = 60000,
      errorThreshold = 0.05,
    } = config;

    const results: StressTestResult['testResults'] = [];
    let breakingPoint = 0;
    let maxSuccessfulRPS = 0;

    for (let concurrency = initialConcurrency; concurrency <= maxConcurrency; concurrency += step) {
      const stepStartTime = Date.now();

      // Run test at this concurrency level
      const errors: number[] = [];
      const responseTimes: number[] = [];
      let requestCount = 0;
      let successCount = 0;

      const queue = new PQueue({ concurrency });

      const executeRequest = async (): Promise<void> => {
        try {
          const start = Date.now();

          await axios({
            method,
            url: targetUrl,
            timeout: 10000,
            validateStatus: () => true,
          });

          const time = Date.now() - start;
          responseTimes.push(time);
          successCount++;
          requestCount++;
        } catch (error) {
          errors.push(1);
          requestCount++;
        }
      };

      // Run requests for step duration
      while (Date.now() - stepStartTime < stepDuration) {
        for (let i = 0; i < concurrency; i++) {
          queue.add(executeRequest);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await queue.onIdle();

      const errorRate = errors.length / requestCount;
      const rps = (requestCount / (Date.now() - stepStartTime)) * 1000;
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      const stepResult = {
        concurrency,
        rps,
        avgResponseTime,
        errorRate,
        successful: errorRate < errorThreshold,
      };

      results.push(stepResult);

      this.emit('progress', stepResult);

      if (errorRate >= errorThreshold) {
        breakingPoint = concurrency;
        break;
      }

      if (stepResult.successful && rps > maxSuccessfulRPS) {
        maxSuccessfulRPS = rps;
      }

      // Stop if max duration reached
      if (Date.now() - stepStartTime > maxDuration) {
        break;
      }
    }

    return {
      breakingPoint,
      maxSuccessfulRPS,
      testResults: results,
    };
  }
}`,

    'src/performance-metrics.ts': `// Performance Metrics
// Collect and analyze performance metrics

export interface MetricDataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export class PerformanceMetrics {
  private metrics: MetricDataPoint[] = [];
  private startTime: number = 0;

  start(): void {
    this.startTime = Date.now();
    this.metrics = [];
  }

  record(metric: MetricDataPoint): void {
    metric.timestamp = Date.now() - this.startTime;
    this.metrics.push(metric);
  }

  getMetrics(): MetricDataPoint[] {
    return this.metrics;
  }

  getSummary(): {
    avgCpu: number;
    avgMemory: number;
    avgResponseTime: number;
    maxThroughput: number;
    avgErrorRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgCpu: 0,
        avgMemory: 0,
        avgResponseTime: 0,
        maxThroughput: 0,
        avgErrorRate: 0,
      };
    }

    return {
      avgCpu: this.metrics.reduce((sum, m) => sum + m.cpu, 0) / this.metrics.length,
      avgMemory: this.metrics.reduce((sum, m) => sum + m.memory, 0) / this.metrics.length,
      avgResponseTime: this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / this.metrics.length,
      maxThroughput: Math.max(...this.metrics.map(m => m.throughput)),
      avgErrorRate: this.metrics.reduce((sum, m) => sum + m.errorRate, 0) / this.metrics.length,
    };
  }

  clear(): void {
    this.metrics = [];
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { LoadTestRunner } from '../load-test-runner';
import { StressTestRunner } from '../stress-test-runner';
import { PerformanceMetrics } from '../performance-metrics';

export function apiRoutes(
  loadTestRunner: LoadTestRunner,
  stressTestRunner: StressTestRunner,
  performanceMetrics: PerformanceMetrics
): Router {
  const router = Router();

  // Run load test
  router.post('/load-test', async (req, res) => {
    try {
      const config = req.body;
      const result = await loadTestRunner.run(config);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Run stress test
  router.post('/stress-test', async (req, res) => {
    try {
      const config = req.body;
      const result = await stressTestRunner.run(config);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get metrics
  router.get('/metrics', (req, res) => {
    const metrics = performanceMetrics.getMetrics();
    const summary = performanceMetrics.getSummary();
    res.json({ metrics, summary });
  });

  return router;
}`,

    'README.md': `# Load Testing & Stress Testing Automation

Automated load and stress testing with performance metrics, bottleneck detection, and scalability analysis.

## Features

### ⚡ **Load Testing**
- **Concurrent Requests**: Simulate multiple concurrent users
- **Configurable Load**: Adjust concurrency, duration, and request count
- **Metrics Collection**: Response times, throughput, error rates
- **Percentile Analysis**: P50, P95, P99 response times

### 🔥 **Stress Testing**
- **Ramp-Up Testing**: Gradually increase load to find breaking point
- **Breaking Point Detection**: Identify system capacity limits
- **Error Threshold Monitoring**: Stop when error rate exceeds threshold
- **Performance Degradation**: Track performance under load

### 📊 **Performance Metrics**
- **CPU Usage**: Monitor CPU consumption during tests
- **Memory Usage**: Track memory allocation and leaks
- **Response Time**: Average, min, max, percentiles
- **Throughput**: Requests per second
- **Error Rate**: Failure rate tracking

## Quick Start

### 1. Run Load Test

\`\`\`bash
curl -X POST http://localhost:3000/api/load-test \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetUrl": "http://localhost:3001/api/users",
    "method": "GET",
    "concurrency": 10,
    "totalRequests": 1000
  }'
\`\`\`

Response:
\`\`\`json
{
  "totalRequests": 1000,
  "successfulRequests": 995,
  "failedRequests": 5,
  "requestsPerSecond": 98.5,
  "avgResponseTime": 124,
  "minResponseTime": 45,
  "maxResponseTime": 890,
  "p50": 110,
  "p95": 245,
  "p99": 567,
  "errors": [
    { "error": "ETIMEDOUT", "count": 3 },
    { "error": "ECONNREFUSED", "count": 2 }
  ],
  "duration": 10152
}
\`\`\`

### 2. Run Stress Test

\`\`\`bash
curl -X POST http://localhost:3000/api/stress-test \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetUrl": "http://localhost:3001/api/users",
    "method": "GET",
    "initialConcurrency": 10,
    "maxConcurrency": 1000,
    "step": 10,
    "stepDuration": 5000,
    "errorThreshold": 0.05
  }'
\`\`\`

Response:
\`\`\`json
{
  "breakingPoint": 500,
  "maxSuccessfulRPS": 450,
  "testResults": [
    {
      "concurrency": 10,
      "rps": 95,
      "avgResponseTime": 120,
      "errorRate": 0,
      "successful": true
    },
    {
      "concurrency": 20,
      "rps": 180,
      "avgResponseTime": 135,
      "errorRate": 0.01,
      "successful": true
    }
  ]
}
\`\`\`

### 3. Get Metrics

\`\`\`bash
curl http://localhost:3000/api/metrics
\`\`\`

## API Endpoints

#### \`POST /api/load-test\`
Run load test with specified configuration.

#### \`POST /api/stress-test\`
Run stress test to find breaking point.

#### \`GET /api/metrics\`
Get collected performance metrics.

## Test Configuration

### Load Test Options
- \`targetUrl\`: Endpoint to test
- \`method\`: HTTP method (GET, POST, etc.)
- \`concurrency\`: Number of concurrent requests
- \`totalRequests\`: Total number of requests to send
- \`duration\`: Test duration in milliseconds
- \`rampUp\`: Gradual increase of concurrency

### Stress Test Options
- \`initialConcurrency\`: Starting concurrency level
- \`maxConcurrency\`: Maximum concurrency to test
- \`step\`: Concurrency increment per step
- \`stepDuration\`: Duration of each step in ms
- \`errorThreshold\`: Error rate threshold (0-1)

## Best Practices

### Before Testing
1. **Warm up the system**: Send a few initial requests
2. **Set realistic limits**: Don't overwhelm your local machine
3. **Monitor resources**: Watch CPU and memory during tests
4. **Use test environment**: Avoid testing on production

### During Testing
1. **Monitor error rates**: Stop if errors exceed 5%
2. **Watch response times**: Alert if P95 exceeds 1 second
3. **Check for memory leaks**: Monitor memory growth
4. **Log failures**: Record all failed requests for analysis

### After Testing
1. **Analyze bottlenecks**: Review slow endpoints
2. **Optimize database**: Add indexes for slow queries
3. **Scale resources**: Increase server capacity if needed
4. **Re-test improvements**: Verify fixes with follow-up tests

## License

MIT`,
  },
};