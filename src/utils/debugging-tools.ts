/**
 * Debugging Tools for Polyglot Services
 *
 * Generates debugging utilities for tracing service interactions:
 * - Request/response logging with correlation IDs
 * - Distributed tracing across services
 * - Multi-language debugging implementations
 * - Performance bottleneck identification
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type DebugLanguage = 'typescript' | 'python' | 'go';

export interface DebugConfig {
  serviceName: string;
  language: DebugLanguage;
  outputDir: string;
  endpoints: DebugEndpoint[];
  enableTracing: boolean;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface DebugEndpoint {
  name: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}

// TypeScript Debugging Tools
export function generateTypeScriptDebugTools(config: DebugConfig): string {
  const logLevel = config.logLevel || 'info';

  return `// Auto-generated Debugging Tools for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

import { performance } from 'perf_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
}

interface RequestLog {
  traceId: string;
  spanId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
}

interface ResponseLog {
  traceId: string;
  spanId: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
  timestamp: number;
}

class DebugTracer {
  private serviceName: string;
  private logLevel: LogLevel;
  private traces: Map<string, TraceContext>;
  private requests: Map<string, RequestLog>;
  private responses: Map<string, ResponseLog>;

  constructor(serviceName: string, logLevel: LogLevel = '${logLevel}') {
    this.serviceName = serviceName;
    this.logLevel = logLevel;
    this.traces = new Map();
    this.requests = new Map();
    this.responses = new Map();
  }

  generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  createTrace(parentSpanId?: string): TraceContext {
    const traceId = this.generateId();
    const spanId = this.generateId();

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      timestamp: performance.now(),
    };

    this.traces.set(traceId, context);
    return context;
  }

  log(level: LogLevel, message: string, data?: any): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(level);
    const configLevel = levels.indexOf(this.logLevel);

    if (currentLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        service: this.serviceName,
        message,
        ...(data && { data }),
      };

      console.log(JSON.stringify(logEntry));
    }
  }

  logRequest(traceId: string, method: string, path: string, headers: Record<string, string>, body?: any): void {
    const request: RequestLog = {
      traceId,
      spanId: this.generateId(),
      method,
      path,
      headers,
      body,
      timestamp: performance.now(),
    };

    this.requests.set(traceId, request);
    this.log('info', 'Incoming request', {
      method,
      path,
      traceId,
      spanId: request.spanId,
    });
  }

  logResponse(traceId: string, statusCode: number, headers: Record<string, string>, body?: any): void {
    const request = this.requests.get(traceId);
    const response: ResponseLog = {
      traceId,
      spanId: request?.spanId || this.generateId(),
      statusCode,
      headers,
      body,
      duration: request ? performance.now() - request.timestamp : 0,
      timestamp: performance.now(),
    };

    this.responses.set(traceId, response);
    this.log('info', 'Outgoing response', {
      statusCode,
      traceId,
      duration: response.duration + 'ms',
    });
  }

  getTrace(traceId: string): TraceContext | undefined {
    return this.traces.get(traceId);
  }

  getAllTraces(): TraceContext[] {
    return Array.from(this.traces.values());
  }

  getRequest(traceId: string): RequestLog | undefined {
    return this.requests.get(traceId);
  }

  getResponse(traceId: string): ResponseLog | undefined {
    return this.responses.get(traceId);
  }

  exportTraces(): string {
    const traces = Array.from(this.traces.values()).map(trace => ({
      ...trace,
      request: this.requests.get(trace.traceId),
      response: this.responses.get(trace.traceId),
    }));

    return JSON.stringify(traces, null, 2);
  }

  analyzePerformance(): void {
    const responses = Array.from(this.responses.values());
    const durations = responses.map(r => r.duration);

    if (durations.length === 0) {
      this.log('info', 'No performance data available');
      return;
    }

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const p95 = this.percentile(durations, 95);

    this.log('info', 'Performance Analysis', {
      average: avg.toFixed(2) + 'ms',
      min: min.toFixed(2) + 'ms',
      max: max.toFixed(2) + 'ms',
      p95: p95.toFixed(2) + 'ms',
      totalRequests: durations.length,
    });
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Export singleton instance
const tracer = new DebugTracer('${config.serviceName}');

export default tracer;
`;
}

// Python Debugging Tools
export function generatePythonDebugTools(config: DebugConfig): string {
  const logLevel = config.logLevel || 'info';

  return `# Auto-generated Debugging Tools for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

import time
import uuid
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class TraceContext:
    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    timestamp: float

@dataclass
class RequestLog:
    trace_id: str
    span_id: str
    method: str
    path: str
    headers: Dict[str, str]
    body: Optional[Any]
    timestamp: float

@dataclass
class ResponseLog:
    trace_id: str
    span_id: str
    status_code: int
    headers: Dict[str, str]
    body: Optional[Any]
    duration: float
    timestamp: float

class DebugTracer:
    def __init__(self, service_name: str, log_level: str = '${logLevel}'):
        self.service_name = service_name
        self.log_level = log_level
        self.traces: Dict[str, TraceContext] = {}
        self.requests: Dict[str, RequestLog] = {}
        self.responses: Dict[str, ResponseLog] = {}

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def create_trace(self, parent_span_id: Optional[str] = None) -> TraceContext:
        trace_id = self._generate_id()
        span_id = self._generate_id()

        context = TraceContext(
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
            timestamp=time.time()
        )

        self.traces[trace_id] = context
        return context

    def log(self, level: str, message: str, data: Optional[Dict] = None):
        levels = ['debug', 'info', 'warn', 'error']
        current_level = levels.index(level)
        config_level = levels.index(self.log_level)

        if current_level >= config_level:
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'level': level,
                'service': self.service_name,
                'message': message,
            }

            if data:
                log_entry['data'] = data

            print(json.dumps(log_entry))

    def log_request(self, trace_id: str, method: str, path: str,
                    headers: Dict[str, str], body: Optional[Any] = None):
        request = RequestLog(
            trace_id=trace_id,
            span_id=self._generate_id(),
            method=method,
            path=path,
            headers=headers,
            body=body,
            timestamp=time.time()
        )

        self.requests[trace_id] = request
        self.log('info', 'Incoming request', {
            'method': method,
            'path': path,
            'trace_id': trace_id,
            'span_id': request.span_id
        })

    def log_response(self, trace_id: str, status_code: int,
                     headers: Dict[str, str], body: Optional[Any] = None):
        request = self.requests.get(trace_id)
        duration = (time.time() - request.timestamp) if request else 0

        response = ResponseLog(
            trace_id=trace_id,
            span_id=request.span_id if request else self._generate_id(),
            status_code=status_code,
            headers=headers,
            body=body,
            duration=duration,
            timestamp=time.time()
        )

        self.responses[trace_id] = response
        self.log('info', 'Outgoing response', {
            'status_code': status_code,
            'trace_id': trace_id,
            'duration': f'{duration:.2f}ms'
        })

    def get_trace(self, trace_id: str) -> Optional[TraceContext]:
        return self.traces.get(trace_id)

    def get_all_traces(self) -> list[TraceContext]:
        return list(self.traces.values())

    def get_request(self, trace_id: str) -> Optional[RequestLog]:
        return self.requests.get(trace_id)

    def get_response(self, trace_id: str) -> Optional[ResponseLog]:
        return self.responses.get(trace_id)

    def export_traces(self) -> str:
        traces_data = []
        for trace in self.traces.values():
            trace_dict = asdict(trace)
            trace_dict['request'] = asdict(self.requests[trace.trace_id]) if trace.trace_id in self.requests else None
            trace_dict['response'] = asdict(self.responses[trace.trace_id]) if trace.trace_id in self.responses else None
            traces_data.append(trace_dict)

        return json.dumps(traces_data, indent=2)

    def analyze_performance(self):
        durations = [r.duration for r in self.responses.values()]

        if not durations:
            self.log('info', 'No performance data available')
            return

        avg = sum(durations) / len(durations)
        max_dur = max(durations)
        min_dur = min(durations)
        p95 = self._percentile(durations, 95)

        self.log('info', 'Performance Analysis', {
            'average': f'{avg:.2f}ms',
            'min': f'{min_dur:.2f}ms',
            'max': f'{max_dur:.2f}ms',
            'p95': f'{p95:.2f}ms',
            'total_requests': len(durations)
        })

    def _percentile(self, arr: list, p: int) -> float:
        sorted_arr = sorted(arr)
        index = int((p / 100) * len(sorted_arr)) - 1
        return sorted_arr[index]


# Singleton instance
tracer = DebugTracer('${config.serviceName}')
`;
}

// Go Debugging Tools
export function generateGoDebugTools(config: DebugConfig): string {
  return `// Auto-generated Debugging Tools for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

package main

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

type LogLevel string

const (
	DebugLevel LogLevel = "debug"
	InfoLevel  LogLevel = "info"
	WarnLevel  LogLevel = "warn"
	ErrorLevel LogLevel = "error"
)

type TraceContext struct {
	TraceID      string  \`json:"traceId"\`
	SpanID       string  \`json:"spanId"\`
	ParentSpanID string  \`json:"parentSpanId,omitempty"\`
	Timestamp    float64 \`json:"timestamp"\`
}

type RequestLog struct {
	TraceID   string                   \`json:"traceId"\`
	SpanID    string                   \`json:"spanId"\`
	Method    string                   \`json:"method"\`
	Path      string                   \`json:"path"\`
	Headers   map[string]string        \`json:"headers"\`
	Body      interface{}              \`json:"body,omitempty"\`
	Timestamp float64                  \`json:"timestamp"\`
}

type ResponseLog struct {
	TraceID   string                   \`json:"traceId"\`
	SpanID    string                   \`json:"spanId"\`
	StatusCode int                     \`json:"statusCode"\`
	Headers   map[string]string        \`json:"headers"\`
	Body      interface{}              \`json:"body,omitempty"\`
	Duration  float64                  \`json:"duration"\`
	Timestamp float64                  \`json:"timestamp"\`
}

type DebugTracer struct {
	serviceName string
	logLevel    LogLevel
	traces      map[string]TraceContext
	requests    map[string]RequestLog
	responses   map[string]ResponseLog
	mu          sync.RWMutex
}

func NewDebugTracer(serviceName string, logLevel LogLevel) *DebugTracer {
	return &DebugTracer{
		serviceName: serviceName,
		logLevel:    logLevel,
		traces:      make(map[string]TraceContext),
		requests:    make(map[string]RequestLog),
		responses:   make(map[string]ResponseLog),
	}
}

func (dt *DebugTracer) generateID() string {
	return fmt.Sprintf("%d", rand.Int63())
}

func (dt *DebugTracer) CreateTrace(parentSpanID string) TraceContext {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	traceID := dt.generateID()
	spanID := dt.generateID()

	context := TraceContext{
		TraceID:      traceID,
		SpanID:       spanID,
		ParentSpanID: parentSpanID,
		Timestamp:    float64(time.Now().UnixNano()) / 1e6,
	}

	dt.traces[traceID] = context
	return context
}

func (dt *DebugTracer) Log(level LogLevel, message string, data interface{}) {
	levels := []LogLevel{DebugLevel, InfoLevel, WarnLevel, ErrorLevel}
	currentLevel := dt.getLevelIndex(level)
	configLevel := dt.getLevelIndex(dt.logLevel)

	if currentLevel >= configLevel {
		logEntry := map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
			"level":     level,
			"service":   dt.serviceName,
			"message":   message,
		}

		if data != nil {
			logEntry["data"] = data
		}

		jsonData, _ := json.Marshal(logEntry)
		fmt.Println(string(jsonData))
	}
}

func (dt *DebugTracer) LogRequest(traceID, method, path string, headers map[string]string, body interface{}) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	request := RequestLog{
		TraceID:   traceID,
		SpanID:    dt.generateID(),
		Method:    method,
		Path:      path,
		Headers:   headers,
		Body:      body,
		Timestamp: float64(time.Now().UnixNano()) / 1e6,
	}

	dt.requests[traceID] = request

	dt.Log(InfoLevel, "Incoming request", map[string]interface{}{
		"method":  method,
		"path":    path,
		"traceId": traceID,
		"spanId":  request.SpanID,
	})
}

func (dt *DebugTracer) LogResponse(traceID string, statusCode int, headers map[string]string, body interface{}) {
	dt.mu.Lock()
	defer dt.mu.Unlock()

	request, exists := dt.requests[traceID]
	duration := 0.0
	if exists {
		duration = (float64(time.Now().UnixNano())/1e6 - request.Timestamp)
	}

	response := ResponseLog{
		TraceID:    traceID,
		SpanID:     request.SpanID,
		StatusCode: statusCode,
		Headers:    headers,
		Body:       body,
		Duration:   duration,
		Timestamp:  float64(time.Now().UnixNano()) / 1e6,
	}

	dt.responses[traceID] = response

	dt.Log(InfoLevel, "Outgoing response", map[string]interface{}{
		"statusCode": statusCode,
		"traceId":    traceID,
		"duration":   fmt.Sprintf("%.2fms", duration),
	})
}

func (dt *DebugTracer) GetTrace(traceID string) (TraceContext, bool) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	trace, exists := dt.traces[traceID]
	return trace, exists
}

func (dt *DebugTracer) GetAllTraces() []TraceContext {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	traces := make([]TraceContext, 0, len(dt.traces))
	for _, trace := range dt.traces {
		traces = append(traces, trace)
	}
	return traces
}

func (dt *DebugTracer) GetRequest(traceID string) (RequestLog, bool) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	request, exists := dt.requests[traceID]
	return request, exists
}

func (dt *DebugTracer) GetResponse(traceID string) (ResponseLog, bool) {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	response, exists := dt.responses[traceID]
	return response, exists
}

func (dt *DebugTracer) ExportTraces() string {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	tracesData := make([]map[string]interface{}, 0)

	for _, trace := range dt.traces {
		traceData := map[string]interface{}{
			"traceId":      trace.TraceID,
			"spanId":       trace.SpanID,
			"parentSpanId": trace.ParentSpanID,
			"timestamp":    trace.Timestamp,
		}

		if request, exists := dt.requests[trace.TraceID]; exists {
			traceData["request"] = request
		}

		if response, exists := dt.responses[trace.TraceID]; exists {
			traceData["response"] = response
		}

		tracesData = append(tracesData, traceData)
	}

	jsonData, _ := json.MarshalIndent(tracesData, "", "  ")
	return string(jsonData)
}

func (dt *DebugTracer) AnalyzePerformance() {
	dt.mu.RLock()
	defer dt.mu.RUnlock()

	durations := make([]float64, 0, len(dt.responses))
	for _, response := range dt.responses {
		durations = append(durations, response.Duration)
	}

	if len(durations) == 0 {
		dt.Log(InfoLevel, "No performance data available", nil)
		return
	}

	sum := 0.0
	max := 0.0
	min := durations[0]

	for _, d := range durations {
		sum += d
		if d > max {
			max = d
		}
		if d < min {
			min = d
		}
	}

	avg := sum / float64(len(durations))
	p95 := dt.percentile(durations, 95)

	dt.Log(InfoLevel, "Performance Analysis", map[string]interface{}{
		"average":       fmt.Sprintf("%.2fms", avg),
		"min":           fmt.Sprintf("%.2fms", min),
		"max":           fmt.Sprintf("%.2fms", max),
		"p95":           fmt.Sprintf("%.2fms", p95),
		"totalRequests": len(durations),
	})
}

func (dt *DebugTracer) percentile(arr []float64, p float64) float64 {
	sorted := make([]float64, len(arr))
	copy(sorted, arr)

	// Simple bubble sort
	for i := 0; i < len(sorted); i++ {
		for j := 0; j < len(sorted)-1-i; j++ {
			if sorted[j] > sorted[j+1] {
				sorted[j], sorted[j+1] = sorted[j+1], sorted[j]
			}
		}
	}

	index := int(math.Ceil((p/100)*float64(len(sorted)))) - 1
	return sorted[index]
}

func (dt *DebugTracer) getLevelIndex(level LogLevel) int {
	levels := []LogLevel{DebugLevel, InfoLevel, WarnLevel, ErrorLevel}
	for i, l := range levels {
		if l == level {
			return i
		}
	}
	return 0
}

// Global tracer instance
var tracer = NewDebugTracer("${config.serviceName}", InfoLevel)
`;
}

// Display configuration
export function displayConfig(config: DebugConfig): void {
  console.log(chalk.cyan('\n✨ Debugging Tools Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Service Name:'), chalk.white(config.serviceName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Log Level:'), chalk.white(config.logLevel));
  console.log(chalk.yellow('Tracing:'), chalk.white(config.enableTracing ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Metrics:'), chalk.white(config.enableMetrics ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Endpoints:'), chalk.white(config.endpoints.length));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Traced Endpoints:\n'));

  config.endpoints.slice(0, 5).forEach((ep, index) => {
    console.log('  ' + chalk.green((index + 1).toString() + '.') + ' ' + chalk.white(ep.name));
    console.log('     ' + chalk.gray(ep.method + ' ' + ep.path));
  });

  if (config.endpoints.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (config.endpoints.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: DebugConfig): string {
  let content = '# Debugging Tools for ' + config.serviceName + '\n\n';
  content += 'Request tracing and debugging utilities for **' + config.serviceName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Service**: ' + config.serviceName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Log Level**: ' + config.logLevel + '\n';
  content += '- **Tracing**: ' + (config.enableTracing ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Metrics**: ' + (config.enableMetrics ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Endpoints**: ' + config.endpoints.length + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install -r requirements.txt\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += 'go mod download\n';
    content += '```\n\n';
  }

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import tracer from \'./debug_tools\';\n\n';
    content += '// Create a trace\n';
    content += 'const trace = tracer.createTrace();\n\n';
    content += '// Log a request\n';
    content += 'tracer.logRequest(trace.traceId, \'GET\', \'/users\', headers);\n\n';
    content += '// Log a response\n';
    content += 'tracer.logResponse(trace.traceId, 200, responseHeaders, responseBody);\n\n';
    content += '// Export traces\n';
    content += 'const traces = tracer.exportTraces();\n';
    content += 'console.log(traces);\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from debug_tools import tracer\n\n';
    content += '# Create a trace\n';
    content += 'trace = tracer.create_trace()\n\n';
    content += '# Log a request\n';
    content += 'tracer.log_request(trace.trace_id, \'GET\', \'/users\', headers)\n\n';
    content += '# Log a response\n';
    content += 'tracer.log_response(trace.trace_id, 200, response_headers, response_body)\n\n';
    content += '# Export traces\n';
    content += 'traces = tracer.export_traces()\n';
    content += 'print(traces)\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```go\n';
    content += 'package main\n\n';
    content += 'import "debug_tools"\n\n';
    content += 'func main() {\n';
    content += '    // Create a trace\n';
    content += '    trace := debug_tools.tracer.CreateTrace("")\n\n';
    content += '    // Log a request\n';
    content += '    debug_tools.tracer.LogRequest(trace.TraceID, "GET", "/users", headers, nil)\n\n';
    content += '    // Log a response\n';
    content += '    debug_tools.tracer.LogResponse(trace.TraceID, 200, responseHeaders, responseBody)\n\n';
    content += '    // Export traces\n';
    content += '    traces := debug_tools.tracer.ExportTraces()\n';
    content += '    fmt.Println(traces)\n';
    content += '}\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Correlation IDs**: Automatic trace ID generation\n';
  content += '- **Request/Response Logging**: Complete HTTP cycle tracking\n';
  content += '- **Performance Metrics**: Latency, throughput, percentiles\n';
  content += '- **Distributed Tracing**: Parent-child span relationships\n';
  content += '- **Export Capabilities**: JSON trace export\n\n';

  content += '## 🎯 Performance Analysis\n\n';
  content += 'The tracer provides built-in performance analysis:\n\n';
  content += '- Average request duration\n';
  content += '- Min/Max latencies\n';
  content += '- p95 percentile\n';
  content += '- Total request count\n\n';

  content += '## 📊 Log Levels\n\n';
  content += '- `debug`: Detailed diagnostic information\n';
  content += '- `info`: General informational messages\n';
  content += '- `warn`: Warning messages\n';
  content += '- `error`: Error messages\n\n';

  return content;
}

// Write files
export async function writeDebugToolFiles(
  config: DebugConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = 'debug_tools.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptDebugTools(config);
  } else if (config.language === 'python') {
    content = generatePythonDebugTools(config);
  } else if (config.language === 'go') {
    content = generateGoDebugTools(config);
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

  // Generate example usage file
  const exampleContent = generateExample(config);
  const examplePath = path.join(output, 'example.' + ext);
  await fs.writeFile(examplePath, exampleContent);
  console.log(chalk.green('✅ Generated: example.' + ext));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.serviceName.toLowerCase() + '-debug-tools',
      version: '1.0.0',
      description: 'Debugging tools for ' + config.serviceName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
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
      'typing-extensions>=4.0.0',
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

  // Generate debug config JSON
  const debugConfig = {
    serviceName: config.serviceName,
    language: config.language,
    logLevel: config.logLevel,
    enableTracing: config.enableTracing,
    enableMetrics: config.enableMetrics,
    endpoints: config.endpoints,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'debug-config.json');
  await fs.writeFile(configPath, JSON.stringify(debugConfig, null, 2));
  console.log(chalk.green('✅ Generated: debug-config.json'));
}

function generateExample(config: DebugConfig): string {
  if (config.language === 'typescript') {
    return `// Example usage of debugging tools for ${config.serviceName}
import tracer from './debug_tools';

async function exampleRequest() {
  // Create a trace
  const trace = tracer.createTrace();

  // Log incoming request
  tracer.logRequest(trace.traceId, 'GET', '/users', {
    'Content-Type': 'application/json',
  });

  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Log outgoing response
  tracer.logResponse(trace.traceId, 200, {
    'Content-Type': 'application/json',
  }, { id: '1', name: 'John Doe' });

  // Analyze performance
  tracer.analyzePerformance();

  // Export traces
  console.log('\\n📊 Exported Traces:');
  console.log(tracer.exportTraces());
}

// Run example
exampleRequest().catch(console.error);
`;
  } else if (config.language === 'python') {
    return `# Example usage of debugging tools for ${config.serviceName}
import asyncio
from debug_tools import tracer

async def example_request():
    # Create a trace
    trace = tracer.create_trace()

    # Log incoming request
    tracer.log_request(trace.trace_id, 'GET', '/users', {
        'Content-Type': 'application/json',
    })

    # Simulate processing
    await asyncio.sleep(0.1)

    # Log outgoing response
    tracer.log_response(trace.trace_id, 200, {
        'Content-Type': 'application/json',
    }, {'id': '1', 'name': 'John Doe'})

    # Analyze performance
    tracer.analyze_performance()

    # Export traces
    print('\\n📊 Exported Traces:')
    print(tracer.export_traces())

# Run example
asyncio.run(example_request())
`;
  } else {
    return `// Example usage of debugging tools for ${config.serviceName}
package main

import (
	"fmt"
	"time"
	"debug_tools"
)

func exampleRequest() {
	// Create a trace
	trace := debug_tools.tracer.CreateTrace("")

	// Log incoming request
	debug_tools.tracer.LogRequest(trace.TraceID, "GET", "/users",
		map[string]string{"Content-Type": "application/json"}, nil)

	// Simulate processing
	time.Sleep(100 * time.Millisecond)

	// Log outgoing response
	debug_tools.tracer.LogResponse(trace.TraceID, 200,
		map[string]string{"Content-Type": "application/json"},
		map[string]interface{}{"id": "1", "name": "John Doe"})

	// Analyze performance
	debug_tools.tracer.AnalyzePerformance()

	// Export traces
	fmt.Println("\\n📊 Exported Traces:")
	fmt.Println(debug_tools.tracer.ExportTraces())
}

func main() {
	exampleRequest()
}
`;
  }
}
