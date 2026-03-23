/**
 * Chaos Engineering for Polyglot Services
 *
 * Generates chaos engineering utilities for testing service resilience:
 * - Failure injection (latency, errors, crashes)
 * - Fault tolerance testing
 * - Multi-language chaos implementations
 * - Resilience metrics and reporting
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ChaosLanguage = 'typescript' | 'python' | 'go';

export interface ChaosConfig {
  serviceName: string;
  language: ChaosLanguage;
  outputDir: string;
  endpoints: ChaosEndpoint[];
  failureScenarios: FailureScenario[];
}

export interface ChaosEndpoint {
  name: string;
  path: string;
  method: string;
}

export interface FailureScenario {
  type: 'latency' | 'error' | 'timeout' | 'crash' | 'corruption';
  probability: number;
  severity: 'low' | 'medium' | 'high';
  config?: Record<string, any>;
}

// TypeScript Chaos Engineering
export function generateTypeScriptChaos(config: ChaosConfig): string {
  return `// Auto-generated Chaos Engineering for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

type FailureType = 'latency' | 'error' | 'timeout' | 'crash' | 'corruption';
type Severity = 'low' | 'medium' | 'high';

interface FailureScenario {
  type: FailureType;
  probability: number;
  severity: Severity;
  config?: any;
}

interface ChaosResult {
  endpoint: string;
  scenario: FailureType;
  injected: boolean;
  successful: boolean;
  duration: number;
  timestamp: Date;
}

class ChaosEngine {
  private serviceName: string;
  private scenarios: FailureScenario[];
  private results: ChaosResult[];

  constructor(serviceName: string, scenarios: FailureScenario[]) {
    this.serviceName = serviceName;
    this.scenarios = scenarios;
    this.results = [];
  }

  async injectChaos(endpoint: string): Promise<ChaosResult> {
    const scenario = this.selectScenario();
    const injected = scenario !== null;
    let successful = false;
    let duration = 0;

    const startTime = Date.now();

    try {
      if (scenario && injected) {
        await this.applyFailure(endpoint, scenario);
        successful = true;
      } else {
        // Normal request
        successful = await this.makeRequest(endpoint);
      }
    } catch (error) {
      successful = false;
    }

    duration = Date.now() - startTime;

    const result: ChaosResult = {
      endpoint,
      scenario: injected ? scenario.type : 'none',
      injected,
      successful,
      duration,
      timestamp: new Date(),
    };

    this.results.push(result);
    return result;
  }

  private selectScenario(): FailureScenario | null {
    const roll = Math.random();
    for (const scenario of this.scenarios) {
      if (roll < scenario.probability) {
        return scenario;
      }
    }
    return null;
  }

  private async applyFailure(endpoint: string, scenario: FailureScenario): Promise<void> {
    const config = scenario.config || {};

    switch (scenario.type) {
      case 'latency':
        const delay = config.delay || 5000;
        console.log(\`💥 Injecting latency: \${delay}ms for \${endpoint}\`);
        await this.sleep(delay);
        await this.makeRequest(endpoint);
        break;

      case 'error':
        console.log(\`💥 Injecting error for \${endpoint}\`);
        throw new Error('Chaos-induced failure');

      case 'timeout':
        const timeout = config.timeout || 30000;
        console.log(\`💥 Injecting timeout: \${timeout}ms for \${endpoint}\`);
        await this.sleep(timeout);
        break;

      case 'crash':
        console.log(\`💥 Simulating crash for \${endpoint}\`);
        throw new Error('Service crash simulated');

      case 'corruption':
        console.log(\`💥 Injecting data corruption for \${endpoint}\`);
        await this.makeCorruptedRequest(endpoint);
        break;

      default:
        await this.makeRequest(endpoint);
    }
  }

  private async makeRequest(endpoint: string): Promise<boolean> {
    // Simulate normal request
    await this.sleep(Math.random() * 100 + 50); // 50-150ms
    return true;
  }

  private async makeCorruptedRequest(endpoint: string): Promise<boolean> {
    // Simulate corrupted request
    await this.sleep(Math.random() * 100 + 50);
    return Math.random() > 0.3; // 70% success rate
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runChaosTest(endpoints: string[], iterations: number = 100): Promise<void> {
    console.log(\`🔥 Starting chaos engineering test for \${this.serviceName}\\n\`);
    console.log(\`Endpoints: \${endpoints.length}\`);
    console.log(\`Iterations: \${iterations}\`);
    console.log(\`Scenarios: \${this.scenarios.length}\\n\`);

    for (let i = 0; i < iterations; i++) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const result = await this.injectChaos(endpoint);

      if (result.injected) {
        console.log(\`  [Iteration \${i + 1}] \${result.scenario.toUpperCase()} injected on \${endpoint}: \${result.successful ? '✅' : '❌'}\`);
      }
    }

    console.log('\\n📊 Chaos Test Results:');
    this.analyzeResults();
  }

  analyzeResults(): void {
    const total = this.results.length;
    const injected = this.results.filter(r => r.injected).length;
    const successful = this.results.filter(r => r.successful).length;
    const failed = total - successful;

    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;

    const failuresByType = new Map<FailureType, number>();
    for (const result of this.results) {
      if (!result.successful && result.injected) {
        const count = failuresByType.get(result.scenario) || 0;
        failuresByType.set(result.scenario, count + 1);
      }
    }

    console.log(\`  Total Iterations: \${total}\`);
    console.log(\`  Failures Injected: \${injected} (\${((injected / total) * 100).toFixed(1)}%)\`);
    console.log(\`  Successful: \${successful} (\${((successful / total) * 100).toFixed(1)}%)\`);
    console.log(\`  Failed: \${failed} (\${((failed / total) * 100).toFixed(1)}%)\`);
    console.log(\`  Average Duration: \${avgDuration.toFixed(2)}ms\`);

    if (failuresByType.size > 0) {
      console.log('\\n  Failures by Type:');
      for (const [type, count] of failuresByType) {
        console.log(\`    \${type}: \${count}\`);
      }
    }

    const resilienceScore = this.calculateResilienceScore();
    console.log(\`\\n  🎯 Resilience Score: \${resilienceScore}/100\`);
  }

  calculateResilienceScore(): number {
    const total = this.results.length;
    const successful = this.results.filter(r => r.successful).length;
    return Math.round((successful / total) * 100);
  }

  getResults(): ChaosResult[] {
    return this.results;
  }

  generateReport(): string {
    const report = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      results: {
        total: this.results.length,
        injected: this.results.filter(r => r.injected).length,
        successful: this.results.filter(r => r.successful).length,
        failed: this.results.filter(r => !r.successful).length,
        averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
      },
      resilienceScore: this.calculateResilienceScore(),
      scenarios: this.scenarios,
    };

    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
const scenarios: FailureScenario[] = ${JSON.stringify(config.failureScenarios, null, 2)};

const chaosEngine = new ChaosEngine('${config.serviceName}', scenarios);

export default chaosEngine;
`;
}

// Python Chaos Engineering
export function generatePythonChaos(config: ChaosConfig): string {
  return `# Auto-generated Chaos Engineering for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

import asyncio
import time
import random
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import json

FailureType = str  # 'latency' | 'error' | 'timeout' | 'crash' | 'corruption'
Severity = str  # 'low' | 'medium' | 'high'

@dataclass
class FailureScenario:
    type: FailureType
    probability: float
    severity: Severity
    config: Optional[Dict] = None

@dataclass
class ChaosResult:
    endpoint: str
    scenario: FailureType
    injected: bool
    successful: bool
    duration: float
    timestamp: str

class ChaosEngine:
    def __init__(self, service_name: str, scenarios: List[FailureScenario]):
        self.service_name = service_name
        self.scenarios = scenarios
        self.results: List[ChaosResult] = []

    async def inject_chaos(self, endpoint: str) -> ChaosResult:
        """Inject chaos into an endpoint"""
        scenario = self._select_scenario()
        injected = scenario is not None
        successful = False
        duration = 0

        start_time = time.time()

        try:
            if scenario and injected:
                await self._apply_failure(endpoint, scenario)
                successful = True
            else:
                # Normal request
                successful = await self._make_request(endpoint)
        except Exception as error:
            successful = False

        duration = (time.time() - start_time) * 1000

        result = ChaosResult(
            endpoint=endpoint,
            scenario=scenario.type if injected else 'none',
            injected=injected,
            successful=successful,
            duration=duration,
            timestamp=datetime.now().isoformat()
        )

        self.results.append(result)
        return result

    def _select_scenario(self) -> Optional[FailureScenario]:
        """Select a failure scenario based on probability"""
        roll = random.random()
        for scenario in self.scenarios:
            if roll < scenario.probability:
                return scenario
        return None

    async def _apply_failure(self, endpoint: str, scenario: FailureScenario):
        """Apply a specific failure scenario"""
        config = scenario.config or {}

        if scenario.type == 'latency':
            delay = config.get('delay', 5000)
            print(f"💥 Injecting latency: {delay}ms for {endpoint}")
            await asyncio.sleep(delay / 1000)
            await self._make_request(endpoint)

        elif scenario.type == 'error':
            print(f"💥 Injecting error for {endpoint}")
            raise Exception('Chaos-induced failure')

        elif scenario.type == 'timeout':
            timeout = config.get('timeout', 30000)
            print(f"💥 Injecting timeout: {timeout}ms for {endpoint}")
            await asyncio.sleep(timeout / 1000)

        elif scenario.type == 'crash':
            print(f"💥 Simulating crash for {endpoint}")
            raise Exception('Service crash simulated')

        elif scenario.type == 'corruption':
            print(f"💥 Injecting data corruption for {endpoint}")
            await self._make_corrupted_request(endpoint)

        else:
            await self._make_request(endpoint)

    async def _make_request(self, endpoint: str) -> bool:
        """Simulate a normal request"""
        await asyncio.sleep((random.random() * 0.1) + 0.05)  # 50-150ms
        return True

    async def _make_corrupted_request(self, endpoint: str) -> bool:
        """Simulate a corrupted request"""
        await asyncio.sleep((random.random() * 0.1) + 0.05)
        return random.random() > 0.3  # 70% success rate

    async def run_chaos_test(self, endpoints: List[str], iterations: int = 100):
        """Run chaos engineering test"""
        print(f"🔥 Starting chaos engineering test for {self.service_name}\\n")
        print(f"Endpoints: {len(endpoints)}")
        print(f"Iterations: {iterations}")
        print(f"Scenarios: {len(self.scenarios)}\\n")

        for i in range(iterations):
            endpoint = random.choice(endpoints)
            result = await self.inject_chaos(endpoint)

            if result.injected:
                status = "✅" if result.successful else "❌"
                print(f"  [Iteration {i + 1}] {result.scenario.upper()} injected on {endpoint}: {status}")

        print("\\n📊 Chaos Test Results:")
        self._analyze_results()

    def _analyze_results(self):
        """Analyze chaos test results"""
        total = len(self.results)
        injected = sum(1 for r in self.results if r.injected)
        successful = sum(1 for r in self.results if r.successful)
        failed = total - successful

        avg_duration = sum(r.duration for r in self.results) / total

        failures_by_type = {}
        for result in self.results:
            if not result.successful and result.injected:
                failures_by_type[result.scenario] = failures_by_type.get(result.scenario, 0) + 1

        print(f"  Total Iterations: {total}")
        print(f"  Failures Injected: {injected} ({(injected / total * 100):.1f}%)")
        print(f"  Successful: {successful} ({(successful / total * 100):.1f}%)")
        print(f"  Failed: {failed} ({(failed / total * 100):.1f}%)")
        print(f"  Average Duration: {avg_duration:.2f}ms")

        if failures_by_type:
            print("\\n  Failures by Type:")
            for failure_type, count in failures_by_type.items():
                print(f"    {failure_type}: {count}")

        resilience_score = self._calculate_resilience_score()
        print(f"\\n  🎯 Resilience Score: {resilience_score}/100")

    def _calculate_resilience_score(self) -> int:
        """Calculate overall resilience score"""
        if not self.results:
            return 0
        total = len(self.results)
        successful = sum(1 for r in self.results if r.successful)
        return round((successful / total) * 100)

    def get_results(self) -> List[ChaosResult]:
        """Get all chaos test results"""
        return self.results

    def generate_report(self) -> str:
        """Generate chaos test report"""
        total = len(self.results)
        report = {
            'service': self.service_name,
            'timestamp': datetime.now().isoformat(),
            'results': {
                'total': total,
                'injected': sum(1 for r in self.results if r.injected),
                'successful': sum(1 for r in self.results if r.successful),
                'failed': sum(1 for r in self.results if not r.successful),
                'averageDuration': sum(r.duration for r in self.results) / total if total > 0 else 0,
            },
            'resilienceScore': self._calculate_resilience_score(),
            'scenarios': [asdict(s) for s in self.scenarios],
        }

        return json.dumps(report, indent=2)


# Singleton instance
scenarios = ${JSON.stringify(config.failureScenarios, null, 2)}

chaos_engine = ChaosEngine('${config.serviceName}', scenarios)
`;
}

// Go Chaos Engineering
export function generateGoChaos(config: ChaosConfig): string {
  return `// Auto-generated Chaos Engineering for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type FailureType string

const (
	LatencyFailure  FailureType = "latency"
	ErrorFailure    FailureType = "error"
	TimeoutFailure  FailureType = "timeout"
	CrashFailure    FailureType = "crash"
	CorruptionFailure FailureType = "corruption"
)

type Severity string

const (
	LowSeverity    Severity = "low"
	MediumSeverity Severity = "medium"
	HighSeverity   Severity = "high"
)

type FailureScenario struct {
	Type       FailureType         \`json:"type"\`
	Probability float64             \`json:"probability"\`
	Severity   Severity            \`json:"severity"\`
	Config     map[string]interface{} \`json:"config,omitempty"\`
}

type ChaosResult struct {
	Endpoint   string     \`json:"endpoint"\`
	Scenario   FailureType \`json:"scenario"\`
	Injected   bool       \`json:"injected"\`
	Successful bool       \`json:"successful"\`
	Duration   float64    \`json:"duration"\`
	Timestamp  string     \`json:"timestamp"\`
}

type ChaosEngine struct {
	serviceName string
	scenarios   []FailureScenario
	results     []ChaosResult
	mu          sync.RWMutex
}

func NewChaosEngine(serviceName string, scenarios []FailureScenario) *ChaosEngine {
	return &ChaosEngine{
		serviceName: serviceName,
		scenarios:   scenarios,
		results:     make([]ChaosResult, 0),
	}
}

func (ce *ChaosEngine) InjectChaos(endpoint string) ChaosResult {
	scenario := ce.selectScenario()
	injected := scenario != nil
	successful := false
	duration := 0.0

	startTime := time.Now()

	if injected && scenario != nil {
		ce.applyFailure(endpoint, scenario)
		successful = true
	} else {
		// Normal request
		successful = ce.makeRequest(endpoint)
	}

	duration = float64(time.Since(startTime).Microseconds()) / 1000.0

	result := ChaosResult{
		Endpoint:   endpoint,
		Scenario:   "none",
		Injected:   injected,
		Successful: successful,
		Duration:   duration,
		Timestamp:  time.Now().Format(time.RFC3339),
	}

	if injected && scenario != nil {
		result.Scenario = scenario.Type
	}

	ce.mu.Lock()
	ce.results = append(ce.results, result)
	ce.mu.Unlock()

	return result
}

func (ce *ChaosEngine) selectScenario() *FailureScenario {
	roll := rand.Float64()
	for i := range ce.scenarios {
		if roll < ce.scenarios[i].Probability {
			return &ce.scenarios[i]
		}
	}
	return nil
}

func (ce *ChaosEngine) applyFailure(endpoint string, scenario *FailureScenario) {
	switch scenario.Type {
	case LatencyFailure:
		delay := 5000.0
		if d, ok := scenario.Config["delay"].(float64); ok {
			delay = d
		}
		fmt.Printf("💥 Injecting latency: %.0fms for %s\\n", delay, endpoint)
		time.Sleep(time.Duration(delay) * time.Millisecond)
		ce.makeRequest(endpoint)

	case ErrorFailure:
		fmt.Printf("💥 Injecting error for %s\\n", endpoint)
		panic("Chaos-induced failure")

	case TimeoutFailure:
		timeout := 30000.0
		if t, ok := scenario.Config["timeout"].(float64); ok {
			timeout = t
		}
		fmt.Printf("💥 Injecting timeout: %.0fms for %s\\n", timeout, endpoint)
		time.Sleep(time.Duration(timeout) * time.Millisecond)

	case CrashFailure:
		fmt.Printf("💥 Simulating crash for %s\\n", endpoint)
		panic("Service crash simulated")

	case CorruptionFailure:
		fmt.Printf("💥 Injecting data corruption for %s\\n", endpoint)
		ce.makeCorruptedRequest(endpoint)
	}
}

func (ce *ChaosEngine) makeRequest(endpoint string) bool {
	// Simulate normal request
	delay := rand.Float64()*100 + 50
	time.Sleep(time.Duration(delay) * time.Millisecond)
	return true
}

func (ce *ChaosEngine) makeCorruptedRequest(endpoint string) bool {
	// Simulate corrupted request
	delay := rand.Float64()*100 + 50
	time.Sleep(time.Duration(delay) * time.Millisecond)
	return rand.Float64() > 0.3 // 70% success rate
}

func (ce *ChaosEngine) RunChaosTest(endpoints []string, iterations int) {
	fmt.Printf("🔥 Starting chaos engineering test for %s\\n\\n", ce.serviceName)
	fmt.Printf("Endpoints: %d\\n", len(endpoints))
	fmt.Printf("Iterations: %d\\n", iterations)
	fmt.Printf("Scenarios: %d\\n\\n", len(ce.scenarios))

	for i := 0; i < iterations; i++ {
		endpointIdx := rand.Intn(len(endpoints))
		result := ce.InjectChaos(endpoints[endpointIdx])

		if result.Injected {
			status := "✅"
			if !result.Successful {
				status = "❌"
			}
			fmt.Printf("  [Iteration %d] %s injected on %s: %s\\n", i+1, result.Scenario, result.Endpoint, status)
		}
	}

	fmt.Println("\\n📊 Chaos Test Results:")
	ce.analyzeResults()
}

func (ce *ChaosEngine) analyzeResults() {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	total := len(ce.results)
	injected := 0
	successful := 0

	for _, result := range ce.results {
		if result.Injected {
			injected++
		}
		if result.Successful {
			successful++
		}
	}

	failed := total - successful

	sumDuration := 0.0
	for _, result := range ce.results {
		sumDuration += result.Duration
	}
	avgDuration := sumDuration / float64(total)

	failuresByType := make(map[FailureType]int)
	for _, result := range ce.results {
		if !result.Successful && result.Injected {
			failuresByType[result.Scenario]++
		}
	}

	fmt.Printf("  Total Iterations: %d\\n", total)
	fmt.Printf("  Failures Injected: %d (%.1f%%)\\n", injected, float64(injected)/float64(total)*100)
	fmt.Printf("  Successful: %d (%.1f%%)\\n", successful, float64(successful)/float64(total)*100)
	fmt.Printf("  Failed: %d (%.1f%%)\\n", failed, float64(failed)/float64(total)*100)
	fmt.Printf("  Average Duration: %.2fms\\n", avgDuration)

	if len(failuresByType) > 0 {
		fmt.Println("\\n  Failures by Type:")
		for failureType, count := range failuresByType {
			fmt.Printf("    %s: %d\\n", failureType, count)
		}
	}

	resilienceScore := ce.calculateResilienceScore()
	fmt.Printf("\\n  🎯 Resilience Score: %d/100\\n", resilienceScore)
}

func (ce *ChaosEngine) calculateResilienceScore() int {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	if len(ce.results) == 0 {
		return 0
	}

	successful := 0
	for _, result := range ce.results {
		if result.Successful {
			successful++
		}
	}

	return int(float64(successful) / float64(len(ce.results)) * 100)
}

func (ce *ChaosEngine) GetResults() []ChaosResult {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	// Return copy
	results := make([]ChaosResult, len(ce.results))
	copy(results, ce.results)
	return results
}

func (ce *ChaosEngine) GenerateReport() string {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	total := len(ce.results)
	injected := 0
	successful := 0

	for _, result := range ce.results {
		if result.Injected {
			injected++
		}
		if result.Successful {
			successful++
		}
	}

	sumDuration := 0.0
	for _, result := range ce.results {
		sumDuration += result.Duration
	}

	report := map[string]interface{}{
		"service": ce.serviceName,
		"timestamp": time.Now().Format(time.RFC3339),
		"results": map[string]interface{}{
			"total":          total,
			"injected":       injected,
			"successful":     successful,
			"failed":         total - successful,
			"averageDuration": sumDuration / float64(total),
		},
		"resilienceScore": ce.calculateResilienceScore(),
		"scenarios":       ce.scenarios,
	}

	jsonData, _ := json.MarshalIndent(report, "", "  ")
	return string(jsonData)
}

// Global instance
var scenarios = []FailureScenario${JSONToGoSlice(config.failureScenarios)}

var chaosEngine = NewChaosEngine("${config.serviceName}", scenarios)
`;
}

function JSONToGoSlice(arr: any[]): string {
  return '[]FailureScenario{' + arr.map(item => '{' +
    `Type: "${item.type}", ` +
    `Probability: ${item.probability}, ` +
    `Severity: "${item.severity}", ` +
    (item.config ? `Config: map[string]interface{}${JSON.stringify(item.config)}, ` : '') +
  '}').join(', ') + '}';
}

// Display configuration
export function displayConfig(config: ChaosConfig): void {
  console.log(chalk.cyan('\n✨ Chaos Engineering Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Service Name:'), chalk.white(config.serviceName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Endpoints:'), chalk.white(config.endpoints.length));
  console.log(chalk.yellow('Failure Scenarios:'), chalk.white(config.failureScenarios.length));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Failure Scenarios:\n'));

  config.failureScenarios.slice(0, 5).forEach((scenario, index) => {
    console.log('  ' + chalk.green((index + 1).toString() + '.') + ' ' + chalk.white(scenario.type.toUpperCase()));
    console.log('     ' + chalk.gray('Probability: ' + (scenario.probability * 100).toFixed(1) + '%'));
    console.log('     ' + chalk.gray('Severity: ' + scenario.severity));
  });

  if (config.failureScenarios.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (config.failureScenarios.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: ChaosConfig): string {
  let content = '# Chaos Engineering for ' + config.serviceName + '\n\n';
  content += 'Chaos engineering and resilience testing utilities for **' + config.serviceName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Service**: ' + config.serviceName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Endpoints**: ' + config.endpoints.length + '\n';
  content += '- **Failure Scenarios**: ' + config.failureScenarios.length + '\n\n';

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
    content += 'import chaosEngine from \'./chaos\';\n\n';
    content += '// Run chaos test\n';
    content += 'await chaosEngine.runChaosTest(endpoints, 100);\n\n';
    content += '// Get results\n';
    content += 'const results = chaosEngine.getResults();\n\n';
    content += '// Generate report\n';
    content += 'const report = chaosEngine.generateReport();\n';
    content += 'console.log(report);\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from chaos import chaos_engine\n\n';
    content += '# Run chaos test\n';
    content += 'await chaos_engine.run_chaos_test(endpoints, 100)\n\n';
    content += '# Get results\n';
    content += 'results = chaos_engine.get_results()\n\n';
    content += '# Generate report\n';
    content += 'report = chaos_engine.generate_report()\n';
    content += 'print(report)\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```go\n';
    content += 'package main\n\n';
    content += 'import "chaos"\n\n';
    content += 'func main() {\n';
    content += '    // Run chaos test\n';
    content += '    chaos.chaosEngine.RunChaosTest(endpoints, 100)\n\n';
    content += '    // Generate report\n';
    content += '    report := chaos.chaosEngine.GenerateReport()\n';
    content += '    fmt.Println(report)\n';
    content += '}\n';
    content += '```\n\n';
  }

  content += '## 📚 Failure Types\n\n';
  content += '- **latency**: Inject artificial delays into requests\n';
  content += '- **error**: Simulate service errors\n';
  content += '- **timeout**: Inject request timeouts\n';
  content += '- **crash**: Simulate service crashes\n';
  content += '- **corruption**: Inject data corruption\n\n';

  content += '## 🎯 Resilience Metrics\n\n';
  content += 'The chaos engine measures:\n';
  content += '- Total test iterations\n';
  content += '- Failure injection rate\n';
  content += '- Success/failure rates\n';
  content += '- Average request duration\n';
  content += '- Failures by type\n';
  content += '- Overall resilience score (0-100)\n\n';

  content += '## 🔥 Best Practices\n\n';
  content += '1. Start with low probability failures (5-10%)\n';
  content += '2. Gradually increase failure rates\n';
  content += '3. Test in staging environments first\n';
  content += '4. Monitor system behavior during tests\n';
  content += '5. Have rollback plans ready\n';
  content += '6. Document all chaos experiments\n\n';

  return content;
}

// Write files
export async function writeChaosFiles(
  config: ChaosConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = 'chaos.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptChaos(config);
  } else if (config.language === 'python') {
    content = generatePythonChaos(config);
  } else if (config.language === 'go') {
    content = generateGoChaos(config);
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
  const exampleContent = generateChaosExample(config);
  const examplePath = path.join(output, 'example.' + ext);
  await fs.writeFile(examplePath, exampleContent);
  console.log(chalk.green('✅ Generated: example.' + ext));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.serviceName.toLowerCase() + '-chaos',
      version: '1.0.0',
      description: 'Chaos engineering for ' + config.serviceName,
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
      'asyncio>=3.4.3',
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

  // Generate chaos config JSON
  const chaosConfig = {
    serviceName: config.serviceName,
    language: config.language,
    endpoints: config.endpoints,
    failureScenarios: config.failureScenarios,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'chaos-config.json');
  await fs.writeFile(configPath, JSON.stringify(chaosConfig, null, 2));
  console.log(chalk.green('✅ Generated: chaos-config.json'));
}

function generateChaosExample(config: ChaosConfig): string {
  if (config.language === 'typescript') {
    return `// Example usage of chaos engineering for ${config.serviceName}
import chaosEngine from './chaos';

async function runChaosTest() {
  console.log('🔥 Starting chaos engineering example...\\n');

  const endpoints = [
${config.endpoints.slice(0, 3).map(ep => `  '${ep.path}',`).join('\n')}
  ];

  // Run chaos test with 100 iterations
  await chaosEngine.runChaosTest(endpoints, 100);

  // Generate and display report
  console.log('\\n📊 Chaos Engineering Report:');
  console.log(chaosEngine.generateReport());

  // Get resilience score
  const score = chaosEngine['calculateResilienceScore']();
  console.log(\`\\n🎯 Final Resilience Score: \${score}/100\`);
}

// Run example
runChaosTest().catch(console.error);
`;
  } else if (config.language === 'python') {
    return `# Example usage of chaos engineering for ${config.serviceName}
import asyncio
from chaos import chaos_engine

async def run_chaos_test():
    print("🔥 Starting chaos engineering example...\\n")

    endpoints = [
${config.endpoints.slice(0, 3).map(ep => `    '${ep.path}',`).join('\n')}
    ]

    # Run chaos test with 100 iterations
    await chaos_engine.run_chaos_test(endpoints, 100)

    # Generate and display report
    print("\\n📊 Chaos Engineering Report:")
    print(chaos_engine.generate_report())

    # Get resilience score
    score = chaos_engine._calculate_resilience_score()
    print(f"\\n🎯 Final Resilience Score: {score}/100")

# Run example
asyncio.run(run_chaos_test())
`;
  } else {
    return `// Example usage of chaos engineering for ${config.serviceName}
package main

import (
	"fmt"
	"chaos"
)

func main() {
	fmt.Println("🔥 Starting chaos engineering example...\\n")

	endpoints := []string{
${config.endpoints.slice(0, 3).map(ep => `		"${ep.path}",`).join('\n')}
	}

	// Run chaos test with 100 iterations
	chaos.chaosEngine.RunChaosTest(endpoints, 100)

	// Generate and display report
	fmt.Println("\\n📊 Chaos Engineering Report:")
	fmt.Println(chaos.chaosEngine.GenerateReport())
}
`;
  }
}
