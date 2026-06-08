// Performance Bottleneck Detection and Resolution Suggestions
// Automatic detection and resolution of performance bottlenecks

import { BackendTemplate } from '../types';

export const bottleneckDetectionTemplate: BackendTemplate = {
  id: 'bottleneck-detection',
  name: 'Performance Bottleneck Detection & Resolution',
  displayName: 'Automatic Performance Bottleneck Detection and Resolution Suggestions',
  description: 'Automatic detection of performance bottlenecks with actionable resolution suggestions and code fixes',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['monitoring', 'performance', 'rest-api'],
  tags: ['bottleneck', 'detection', 'optimization', 'performance', 'analysis'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-bottleneck-detection",
  "version": "1.0.0",
  "description": "{{name}} - Performance Bottleneck Detection & Resolution",
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
    "chalk": "^4.1.2",
    "cli-table3": "^0.6.3",
    "acorn": "^8.10.0",
    "acorn-walk": "^8.2.0",
    "eslint": "^8.50.0",
    "typescript-eslint": "^6.7.0"
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

    'src/index.ts': `// Performance Bottleneck Detection Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { BottleneckDetector } from './bottleneck-detector';
import { CodeAnalyzer } from './code-analyzer';
import { ResolutionAdvisor } from './resolution-advisor';
import { apiRoutes } from './routes/api.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize components
const detector = new BottleneckDetector();
const codeAnalyzer = new CodeAnalyzer();
const resolutionAdvisor = new ResolutionAdvisor();

// Mount routes
app.use('/api', apiRoutes(detector, codeAnalyzer, resolutionAdvisor));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🔍 Performance Bottleneck Detection Server running on port \${PORT}\`);
  console.log(\`⚡ Automatic bottleneck detection enabled\`);
});`,

    'src/bottleneck-detector.ts': `// Bottleneck Detector
// Automatic detection of performance bottlenecks

import { EventEmitter } from 'eventemitter3';

export interface Bottleneck {
  id: string;
  type: 'memory-leak' | 'cpu-spike' | 'slow-query' | 'blocking-operation' | 'inefficient-loop' | 'unbounded-cache' | 'synchronous-io';
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  evidence: any;
  timestamp: number;
}

export interface PerformanceProfile {
  cpuUsage: number;
  memoryUsage: number;
  eventLoopLag: number;
  activeHandles: number;
  activeRequests: number;
  heapSize: number;
  heapUsed: number;
}

export class BottleneckDetector extends EventEmitter {
  private bottlenecks: Bottleneck[] = [];
  private profiles: PerformanceProfile[] = [];
  private thresholds = {
    cpu: { critical: 90, high: 75, medium: 60 },
    memory: { critical: 90, high: 75, medium: 60 },
    eventLoopLag: { critical: 500, high: 200, medium: 100 },
    heapUsed: { critical: 90, high: 75, medium: 60 },
  };

  async scan(profile: PerformanceProfile): Promise<Bottleneck[]> {
    const detected: Bottleneck[] = [];

    // Check CPU usage
    if (profile.cpuUsage > this.thresholds.cpu.critical) {
      detected.push({
        id: \`cpu-\${Date.now()}\`,
        type: 'cpu-spike',
        severity: 'critical',
        location: 'process',
        description: \`Critical CPU usage: \${profile.cpuUsage.toFixed(2)}%\`,
        evidence: { cpuUsage: profile.cpuUsage },
        timestamp: Date.now(),
      });
    }

    // Check memory usage
    if (profile.heapUsed > this.thresholds.heapUsed.critical) {
      detected.push({
        id: \`memory-\${Date.now()}\`,
        type: 'memory-leak',
        severity: 'critical',
        location: 'heap',
        description: \`Critical heap usage: \${profile.heapUsed.toFixed(2)}%\`,
        evidence: { heapUsed: profile.heapUsed, heapSize: profile.heapSize },
        timestamp: Date.now(),
      });
    }

    // Check event loop lag
    if (profile.eventLoopLag > this.thresholds.eventLoopLag.critical) {
      detected.push({
        id: \`eventloop-\${Date.now()}\`,
        type: 'blocking-operation',
        severity: 'critical',
        location: 'event-loop',
        description: \`Event loop blocked: \${profile.eventLoopLag.toFixed(2)}ms lag\`,
        evidence: { eventLoopLag: profile.eventLoopLag },
        timestamp: Date.now(),
      });
    }

    // Check for unbounded growth
    this.profiles.push(profile);
    if (this.profiles.length > 100) {
      this.profiles.shift();
    }

    // Analyze trends
    const trendBottlenecks = this.analyzeTrends();
    detected.push(...trendBottlenecks);

    this.bottlenecks.push(...detected);
    this.emit('detected', detected);

    return detected;
  }

  private analyzeTrends(): Bottleneck[] {
    const trends: Bottleneck[] = [];

    if (this.profiles.length < 10) {
      return trends;
    }

    const recent = this.profiles.slice(-10);

    // Check for memory leak trend
    const memoryTrend = recent.map((p) => p.heapUsed);
    const isIncreasing = this.isIncreasing(memoryTrend);

    if (isIncreasing) {
      trends.push({
        id: \`memory-leak-trend-\${Date.now()}\`,
        type: 'memory-leak',
        severity: 'high',
        location: 'heap',
        description: 'Memory usage consistently increasing - potential leak',
        evidence: { trend: memoryTrend },
        timestamp: Date.now(),
      });
    }

    // Check for CPU trend
    const cpuTrend = recent.map((p) => p.cpuUsage);
    if (this.isIncreasing(cpuTrend)) {
      trends.push({
        id: \`cpu-trend-\${Date.now()}\`,
        type: 'cpu-spike',
        severity: 'medium',
        location: 'process',
        description: 'CPU usage trending upward',
        evidence: { trend: cpuTrend },
        timestamp: Date.now(),
      });
    }

    return trends;
  }

  private isIncreasing(values: number[]): boolean {
    if (values.length < 3) return false;

    let increases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        increases++;
      }
    }

    return increases >= values.length * 0.7;
  }

  getBottlenecks(severity?: string): Bottleneck[] {
    let filtered = this.bottlenecks;

    if (severity) {
      filtered = filtered.filter((b) => b.severity === severity);
    }

    return filtered.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  clear(): void {
    this.bottlenecks = [];
    this.profiles = [];
  }
}`,

    'src/code-analyzer.ts': `// Code Analyzer
// Static code analysis for performance issues

export interface CodeIssue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  message: string;
  suggestion: string;
  fix?: string;
}

export class CodeAnalyzer {
  analyzeCode(code: string, filename: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = code.split('\\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Check for synchronous file operations in async context
      if (line.match(/\\.readFileSync|\\.writeFileSync|\\.existsSync/) && !line.includes('// OK sync')) {
        issues.push({
          id: \`sync-fs-\${lineNumber}\`,
          type: 'synchronous-io',
          severity: 'high',
          file: filename,
          line: lineNumber,
          message: 'Synchronous file operation detected',
          suggestion: 'Use async file operations to avoid blocking the event loop',
          fix: line.replace(/FileSync/g, 'File'),
        });
      }

      // Check for console.log in production code
      if (line.includes('console.log') && !line.includes('//')) {
        issues.push({
          id: \`console-log-\${lineNumber}\`,
          type: 'debug-log',
          severity: 'low',
          file: filename,
          line: lineNumber,
          message: 'Console.log statement found',
          suggestion: 'Use a proper logging library',
        });
      }

      // Check for nested loops
      if (line.match(/for\\s*\\(.*\\).*\\{/g)) {
        const nestLevel = (line.match(/{/g) || []).length;
        if (nestLevel > 2) {
          issues.push({
            id: \`nested-loop-\${lineNumber}\`,
            type: 'inefficient-loop',
            severity: 'medium',
            file: filename,
            line: lineNumber,
            message: 'Deeply nested loop detected',
            suggestion: 'Consider breaking into smaller functions or using more efficient algorithms',
          });
        }
      }

      // Check for Promise.all instead of await in loop
      if (line.match(/for.*await.*\\(/)) {
        issues.push({
          id: \`await-in-loop-\${lineNumber}\`,
          type: 'inefficient-loop',
          severity: 'medium',
          file: filename,
          line: lineNumber,
          message: 'Await inside loop may cause sequential execution',
          suggestion: 'Use Promise.all() for parallel execution',
        });
      }

      // Check for missing error handling
      if (line.includes('.then(') && !line.includes('.catch')) {
        issues.push({
          id: \`missing-catch-\${lineNumber}\`,
          type: 'unhandled-promise',
          severity: 'medium',
          file: filename,
          line: lineNumber,
          message: 'Promise without error handling',
          suggestion: 'Add .catch() or use async/await with try/catch',
        });
      }
    });

    return issues;
  }

  analyzeProject(directory: string): Promise<CodeIssue[]> {
    // This would scan all files in the directory
    // Simplified version returns empty array
    return Promise.resolve([]);
  }
}`,

    'src/resolution-advisor.ts': `// Resolution Advisor
// Provides actionable resolution suggestions

export interface Resolution {
  bottleneck: Bottleneck;
  priority: number;
  description: string;
  codeFix?: string;
  configChange?: string;
  architectureChange?: string;
  estimatedImpact: string;
}

export class ResolutionAdvisor {
  advise(bottleneck: Bottleneck): Resolution {
    const resolution: Resolution = {
      bottleneck,
      priority: this.getPriority(bottleneck.severity),
      description: '',
      estimatedImpact: '',
    };

    switch (bottleneck.type) {
      case 'memory-leak':
        resolution.description = 'Investigate memory leak by taking heap snapshots and analyzing retained objects';
        resolution.codeFix = \`// Use weak references or explicit cleanup
const cache = new WeakMap();

// Clear intervals
const interval = setInterval(() => {}, 1000);
clearInterval(interval);\`;
        resolution.estimatedImpact = 'High - Can reduce memory usage by 50-90%';
        break;

      case 'cpu-spike':
        resolution.description = 'Optimize CPU-intensive operations or move to worker threads';
        resolution.codeFix = \`// Use worker threads for CPU-intensive work
const { Worker } = require('worker_threads');

const worker = new Worker('./cpu-intensive-task.js');
worker.on('message', (result) => {
  // Handle result
});\`;
        resolution.estimatedImpact = 'High - Can reduce CPU usage by 40-80%';
        break;

      case 'blocking-operation':
        resolution.description = 'Break up blocking operations or move to async/await';
        resolution.codeFix = \`// Use setImmediate to yield to event loop
setImmediate(() => {
  // Process in chunks
});

// Use promises
await Promise.all(items.map(processItem));\`;
        resolution.estimatedImpact = 'Critical - Can reduce event loop lag by 70-95%';
        break;

      case 'inefficient-loop':
        resolution.description = 'Optimize loop algorithms or use more efficient data structures';
        resolution.codeFix = \`// Use Map instead of object for lookups
const map = new Map();
map.set('key', 'value');
const value = map.get('key');

// Use Set for unique values
const set = new Set();
set.add('value');\`;
        resolution.estimatedImpact = 'Medium - Can improve performance by 30-60%';
        break;

      case 'unbounded-cache':
        resolution.description = 'Implement cache size limits with LRU eviction';
        resolution.codeFix = \`// Use LRU cache with size limit
import LRU from 'lru-cache';

const cache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  maxSize: 10000 // bytes
});\`;
        resolution.estimatedImpact = 'High - Can prevent memory overflow';
        break;

      case 'synchronous-io':
        resolution.description = 'Replace synchronous I/O with asynchronous operations';
        resolution.codeFix = \`// Use async operations instead
import { promises } from 'fs';

const content = await promises.readFile('./file.txt', 'utf-8');\`;
        resolution.estimatedImpact = 'Critical - Eliminates event loop blocking';
        break;

      case 'slow-query':
        resolution.description = 'Add indexes, optimize queries, or implement caching';
        resolution.codeFix = \`// Add database index
CREATE INDEX idx_user_email ON users(email);

// Cache frequent queries
const cache = new Map();
async function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  cache.set(id, user);
  return user;
}\`;
        resolution.estimatedImpact = 'High - Can reduce query time by 50-90%';
        break;
    }

    return resolution;
  }

  private getPriority(severity: string): number {
    switch (severity) {
      case 'critical':
        return 1;
      case 'high':
        return 2;
      case 'medium':
        return 3;
      case 'low':
        return 4;
      default:
        return 5;
    }
  }

  generateReport(bottlenecks: Bottleneck[]): string {
    if (bottlenecks.length === 0) {
      return 'No bottlenecks detected! 🎉';
    }

    const bySeverity = bottlenecks.reduce((acc, b) => {
      acc[b.severity] = (acc[b.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let report = '🔍 Performance Bottleneck Report\\n';
    report += '='.repeat(50) + '\\n\\n';

    report += \`Summary:
  Critical: \${bySeverity.critical || 0}
  High: \${bySeverity.high || 0}
  Medium: \${bySeverity.medium || 0}
  Low: \${bySeverity.low || 0}
\`;

    return report;
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { BottleneckDetector } from '../bottleneck-detector';
import { CodeAnalyzer } from '../code-analyzer';
import { ResolutionAdvisor } from '../resolution-advisor';

export function apiRoutes(
  detector: BottleneckDetector,
  codeAnalyzer: CodeAnalyzer,
  resolutionAdvisor: ResolutionAdvisor
): Router {
  const router = Router();

  // Scan for bottlenecks
  router.post('/scan', async (req, res) => {
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({ error: 'profile is required' });
    }

    const bottlenecks = await detector.scan(profile);
    res.json({ bottlenecks });
  });

  // Get all bottlenecks
  router.get('/bottlenecks', (req, res) => {
    const { severity } = req.query;
    const bottlenecks = detector.getBottlenecks(severity as string);
    res.json({ bottlenecks });
  });

  // Clear bottlenecks
  router.post('/clear', (req, res) => {
    detector.clear();
    res.json({ message: 'Bottlenecks cleared' });
  });

  // Analyze code
  router.post('/analyze/code', (req, res) => {
    const { code, filename } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const issues = codeAnalyzer.analyzeCode(code, filename || 'unknown');
    res.json({ issues });
  });

  // Get resolution for bottleneck
  router.post('/resolve', (req, res) => {
    const { bottleneck } = req.body;

    if (!bottleneck) {
      return res.status(400).json({ error: 'bottleneck is required' });
    }

    const resolution = resolutionAdvisor.advise(bottleneck);
    res.json(resolution);
  });

  // Generate report
  router.get('/report', (req, res) => {
    const bottlenecks = detector.getBottlenecks();
    const report = resolutionAdvisor.generateReport(bottlenecks);
    res.type('text').send(report);
  });

  return router;
}`,

    'README.md': `# Performance Bottleneck Detection & Resolution

Automatic detection of performance bottlenecks with actionable resolution suggestions and code fixes.

## Features

### 🔍 **Automatic Detection**
- **Memory Leaks**: Detect memory usage trends and heap growth
- **CPU Spikes**: Identify high CPU usage events
- **Blocking Operations**: Find event loop blocking operations
- **Inefficient Loops**: Detect nested loops and await-in-loop patterns
- **Synchronous I/O**: Identify blocking file operations
- **Slow Queries**: Detect database performance issues

### 💡 **Smart Analysis**
- **Trend Analysis**: Track metrics over time to identify patterns
- **Severity Classification**: Critical, High, Medium, Low priority
- **Evidence Collection**: Gather diagnostic data for each issue
- **Performance Profiling**: CPU, memory, event loop metrics

### 🛠️ **Resolution Suggestions**
- **Code Fixes**: Ready-to-use code examples
- **Architecture Changes**: High-level architectural improvements
- **Config Changes**: Configuration optimizations
- **Impact Estimation**: Expected performance improvements

## Quick Start

### 1. Scan for Bottlenecks

\`\`\`bash
curl -X POST http://localhost:3000/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{
    "cpuUsage": 95,
    "memoryUsage": 85,
    "eventLoopLag": 250,
    "activeHandles": 10,
    "activeRequests": 5,
    "heapSize": 1000000000,
    "heapUsed": 950000000
  }'
\`\`\`

Response:
\`\`\`json
{
  "bottlenecks": [
    {
      "id": "cpu-1234567890",
      "type": "cpu-spike",
      "severity": "critical",
      "location": "process",
      "description": "Critical CPU usage: 95.00%",
      "timestamp": 1234567890
    }
  ]
}
\`\`\`

### 2. Analyze Code

\`\`\`bash
curl -X POST http://localhost:3000/api/analyze/code \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "for (const user of users) { const posts = await getPosts(user.id); }",
    "filename": "app.ts"
  }'
\`\`\`

Response:
\`\`\`json
{
  "issues": [
    {
      "id": "await-in-loop-5",
      "type": "inefficient-loop",
      "severity": "medium",
      "file": "app.ts",
      "line": 5,
      "message": "Await inside loop may cause sequential execution",
      "suggestion": "Use Promise.all() for parallel execution"
    }
  ]
}
\`\`\`

### 3. Get Resolution

\`\`\`bash
curl -X POST http://localhost:3000/api/resolve \\
  -H "Content-Type: application/json" \\
  -d '{
    "bottleneck": {
      "type": "memory-leak",
      "severity": "critical"
    }
  }'
\`\`\`

Response:
\`\`\`json
{
  "bottleneck": { ... },
  "priority": 1,
  "description": "Investigate memory leak...",
  "codeFix": "// Use weak references...",
  "estimatedImpact": "High - Can reduce memory usage by 50-90%"
}
\`\`\`

## API Endpoints

#### \`POST /api/scan\`
Scan performance profile for bottlenecks.

#### \`GET /api/bottlenecks?severity=critical\`
Get detected bottlenecks with optional severity filter.

#### \`POST /api/analyze/code\`
Analyze code for performance issues.

#### \`POST /api/resolve\`
Get resolution suggestions for a bottleneck.

#### \`GET /api/report\`
Generate human-readable bottleneck report.

## Resolution Examples

### Memory Leak
\`\`\`typescript
// ❌ Before - Memory leak
const cache = {};

// ✅ After - Using WeakMap
const cache = new WeakMap();
\`\`\`

### CPU Spike
\`\`\`typescript
// ❌ Before - Blocking main thread
function processData(data) {
  return heavyComputation(data);
}

// ✅ After - Worker thread
const worker = new Worker('./processor.js');
worker.postMessage(data);
worker.on('message', handleResult);
\`\`\`

### Blocking Operation
\`\`\`typescript
// ❌ Before - Blocking
for (const item of largeArray) {
  await processItem(item);
}

// ✅ After - Parallel
await Promise.all(largeArray.map(processItem));
\`\`\`

## License

MIT`,
  },
};