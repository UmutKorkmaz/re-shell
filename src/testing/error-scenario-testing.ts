import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';

export interface ErrorScenarioConfig {
  scenarios: ErrorScenario[];
  retryAttempts?: number;
  timeout?: number;
  parallel?: boolean;
  generateReport?: boolean;
  captureStdout?: boolean;
  captureStderr?: boolean;
  validateRecovery?: boolean;
  cleanupAfterEach?: boolean;
}

export interface ErrorScenario {
  name: string;
  description?: string;
  category: 'filesystem' | 'network' | 'permission' | 'memory' | 'process' | 'dependency' | 'custom';
  trigger: ErrorTrigger;
  expectedError?: ExpectedError;
  recovery?: RecoveryAction[];
  validation?: ValidationCheck[];
  prerequisites?: string[];
  cleanup?: string[];
  timeout?: number;
  skip?: boolean;
}

export interface ErrorTrigger {
  type: 'command' | 'file' | 'network' | 'process' | 'memory' | 'signal' | 'custom';
  action: string;
  args?: any;
  delay?: number;
  condition?: string;
}

export interface ExpectedError {
  type: 'exception' | 'exit_code' | 'timeout' | 'signal' | 'output';
  pattern?: string | RegExp;
  code?: number;
  signal?: string;
  message?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'cleanup' | 'restart' | 'custom';
  action: string;
  args?: any;
  timeout?: number;
  condition?: string;
  maxAttempts?: number;
}

export interface ValidationCheck {
  type: 'file' | 'process' | 'state' | 'output' | 'custom';
  target: string;
  condition: 'exists' | 'running' | 'contains' | 'equals' | 'custom';
  value?: any;
  timeout?: number;
}

export interface ErrorTestResult {
  scenario: string;
  success: boolean;
  error?: CapturedError;
  recovery?: RecoveryResult;
  validation?: ValidationResult[];
  duration: number;
  attempts: number;
  logs: LogEntry[];
  artifacts: string[];
  timestamp: Date;
}

export interface CapturedError {
  type: string;
  message: string;
  code?: number;
  signal?: string;
  stack?: string;
  stdout?: string;
  stderr?: string;
  matched: boolean;
}

export interface RecoveryResult {
  attempted: boolean;
  successful: boolean;
  actions: RecoveryActionResult[];
  duration: number;
  finalState: 'recovered' | 'failed' | 'partial';
}

export interface RecoveryActionResult {
  action: string;
  success: boolean;
  duration: number;
  error?: string;
  output?: string;
}

export interface ValidationResult {
  check: string;
  success: boolean;
  actual?: any;
  expected?: any;
  error?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: any;
}

export interface ErrorTestReport {
  summary: ErrorTestSummary;
  results: ErrorTestResult[];
  analysis: ErrorAnalysis;
  recommendations: string[];
  patterns: ErrorPattern[];
  timestamp: Date;
}

export interface ErrorTestSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  recovered: number;
  unrecovered: number;
  categories: Map<string, number>;
  severity: Map<string, number>;
  duration: number;
}

export interface ErrorAnalysis {
  resilience: ResilienceMetrics;
  hotspots: ErrorHotspot[];
  trends: ErrorTrend[];
  gaps: RecoveryGap[];
}

export interface ResilienceMetrics {
  errorRate: number;
  recoveryRate: number;
  averageRecoveryTime: number;
  criticalFailures: number;
  partialRecoveries: number;
}

export interface ErrorHotspot {
  category: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggestion: string;
}

export interface ErrorTrend {
  category: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number;
  period: string;
}

export interface RecoveryGap {
  scenario: string;
  issue: string;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface ErrorPattern {
  name: string;
  pattern: RegExp;
  category: string;
  frequency: number;
  examples: string[];
  solution?: string;
}

export class ErrorScenarioTesting extends EventEmitter {
  private config: ErrorScenarioConfig;
  private results: ErrorTestResult[] = [];
  private workDir: string;
  private logs: LogEntry[] = [];

  constructor(config: ErrorScenarioConfig) {
    super();
    this.config = {
      retryAttempts: 3,
      timeout: 30000,
      parallel: false,
      generateReport: true,
      captureStdout: true,
      captureStderr: true,
      validateRecovery: true,
      cleanupAfterEach: true,
      ...config
    };
    this.workDir = path.join(os.tmpdir(), 're-shell-error-test');
  }

  async run(): Promise<ErrorTestReport> {
    this.emit('errortest:start', { scenarios: this.config.scenarios.length });

    const startTime = Date.now();

    try {
      await this.setup();

      const scenarios = this.config.scenarios.filter(s => !s.skip);

      if (this.config.parallel) {
        await this.runParallel(scenarios);
      } else {
        await this.runSequential(scenarios);
      }

      const report = this.generateReport(Date.now() - startTime);

      if (this.config.generateReport) {
        await this.saveReport(report);
      }

      this.emit('errortest:complete', report);
      return report;

    } catch (error: any) {
      this.emit('errortest:error', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async setup(): Promise<void> {
    await fs.ensureDir(this.workDir);
    this.log('info', 'Test environment prepared', { workDir: this.workDir });
  }

  private async runSequential(scenarios: ErrorScenario[]): Promise<void> {
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      this.results.push(result);

      if (this.config.cleanupAfterEach) {
        await this.cleanupScenario(scenario);
      }
    }
  }

  private async runParallel(scenarios: ErrorScenario[]): Promise<void> {
    const promises = scenarios.map(scenario => this.runScenario(scenario));
    const results = await Promise.all(promises);
    this.results.push(...results);
  }

  private async runScenario(scenario: ErrorScenario): Promise<ErrorTestResult> {
    this.emit('scenario:start', scenario);
    this.log('info', `Running error scenario: ${scenario.name}`);

    const result: ErrorTestResult = {
      scenario: scenario.name,
      success: false,
      duration: 0,
      attempts: 0,
      logs: [],
      artifacts: [],
      timestamp: new Date()
    };

    const startTime = Date.now();

    try {
      // Setup prerequisites
      if (scenario.prerequisites) {
        await this.runPrerequisites(scenario.prerequisites);
      }

      // Trigger error condition
      result.error = await this.triggerError(scenario);
      result.attempts++;

      // Validate expected error
      if (scenario.expectedError && result.error) {
        result.error.matched = this.validateExpectedError(
          result.error,
          scenario.expectedError
        );
      }

      // Attempt recovery if configured
      if (scenario.recovery && this.config.validateRecovery) {
        result.recovery = await this.attemptRecovery(
          scenario.recovery,
          result.error
        );
        result.success = result.recovery.successful;
      } else {
        result.success = result.error?.matched ?? false;
      }

      // Run validation checks
      if (scenario.validation) {
        result.validation = await this.runValidation(scenario.validation);
        result.success = result.success && 
          result.validation.every(v => v.success);
      }

      result.duration = Date.now() - startTime;
      this.log('info', `Scenario completed: ${scenario.name}`, { 
        success: result.success,
        duration: result.duration 
      });

      this.emit('scenario:complete', result);
      return result;

    } catch (error: any) {
      result.duration = Date.now() - startTime;
      this.log('error', `Scenario failed: ${scenario.name}`, { error: error.message });
      this.emit('scenario:error', { scenario, error });
      return result;
    }
  }

  private async runPrerequisites(prerequisites: string[]): Promise<void> {
    for (const prereq of prerequisites) {
      try {
        await this.executeCommand(prereq);
        this.log('debug', `Prerequisite completed: ${prereq}`);
      } catch (error: any) {
        this.log('warn', `Prerequisite failed: ${prereq}`, { error: error.message });
      }
    }
  }

  private async triggerError(scenario: ErrorScenario): Promise<CapturedError> {
    this.log('debug', `Triggering error: ${scenario.trigger.type}`);

    const trigger = scenario.trigger;
    let capturedError: CapturedError;

    try {
      switch (trigger.type) {
        case 'command':
          capturedError = await this.triggerCommandError(trigger);
          break;

        case 'file':
          capturedError = await this.triggerFileError(trigger);
          break;

        case 'network':
          capturedError = await this.triggerNetworkError(trigger);
          break;

        case 'process':
          capturedError = await this.triggerProcessError(trigger);
          break;

        case 'memory':
          capturedError = await this.triggerMemoryError(trigger);
          break;

        case 'signal':
          capturedError = await this.triggerSignalError(trigger);
          break;

        case 'custom':
          capturedError = await this.triggerCustomError(trigger);
          break;

        default:
          throw new Error(`Unknown trigger type: ${trigger.type}`);
      }

    } catch (error: any) {
      capturedError = {
        type: 'exception',
        message: error.message,
        code: error.code,
        signal: error.signal,
        stack: error.stack,
        stdout: error.stdout,
        stderr: error.stderr,
        matched: false
      };
    }

    this.log('debug', 'Error triggered', { error: capturedError });
    return capturedError;
  }

  private async triggerCommandError(trigger: ErrorTrigger): Promise<CapturedError> {
    const command = trigger.action;
    const args = trigger.args || {};

    try {
      const result = execSync(command, {
        cwd: this.workDir,
        timeout: this.config.timeout,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, ...args.env }
      });

      // Command succeeded when we expected failure
      return {
        type: 'unexpected_success',
        message: 'Command succeeded unexpectedly',
        stdout: result,
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'command_error',
        message: error.message,
        code: error.status,
        signal: error.signal,
        stdout: error.stdout,
        stderr: error.stderr,
        matched: false
      };
    }
  }

  private async triggerFileError(trigger: ErrorTrigger): Promise<CapturedError> {
    const action = trigger.action;
    const args = trigger.args || {};

    try {
      switch (action) {
        case 'delete_required':
          {
          const requiredFile = path.join(this.workDir, args.file || 'required.txt');
          await fs.remove(requiredFile);
          break;

          }
        case 'corrupt_file':
          {
          const corruptFile = path.join(this.workDir, args.file || 'data.json');
          await fs.writeFile(corruptFile, '{"invalid": json}');
          break;

          }
        case 'permission_denied':
          {
          const restrictedFile = path.join(this.workDir, args.file || 'restricted.txt');
          await fs.writeFile(restrictedFile, 'restricted content');
          await fs.chmod(restrictedFile, 0o000);
          break;

          }
        case 'disk_full':
          {
          // Simulate disk full by creating a large file
          const largeContent = 'x'.repeat(1024 * 1024 * 100); // 100MB
          await fs.writeFile(path.join(this.workDir, 'large.tmp'), largeContent);
          break;
          }
      }

      // Now try to use the file to trigger the error
      const testCommand = args.testCommand || `cat ${args.file || 'required.txt'}`;
      execSync(testCommand, { cwd: this.workDir, encoding: 'utf-8' });

      return {
        type: 'file_error_not_triggered',
        message: 'File error was not triggered as expected',
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'file_error',
        message: error.message,
        code: error.code,
        stdout: error.stdout,
        stderr: error.stderr,
        matched: false
      };
    }
  }

  private async triggerNetworkError(trigger: ErrorTrigger): Promise<CapturedError> {
    const action = trigger.action;
    const args = trigger.args || {};

    try {
      switch (action) {
        case 'connection_refused':
          {
          const command = `curl -f ${args.url || 'http://localhost:99999'} --max-time 5`;
          execSync(command, { encoding: 'utf-8' });
          break;

          }
        case 'timeout':
          {
          const timeoutCommand = `curl -f ${args.url || 'http://httpbin.org/delay/30'} --max-time 5`;
          execSync(timeoutCommand, { encoding: 'utf-8' });
          break;

          }
        case 'dns_failure':
          {
          const dnsCommand = `curl -f http://nonexistent.invalid --max-time 5`;
          execSync(dnsCommand, { encoding: 'utf-8' });
          break;
          }
      }

      return {
        type: 'network_error_not_triggered',
        message: 'Network error was not triggered as expected',
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'network_error',
        message: error.message,
        code: error.status,
        stdout: error.stdout,
        stderr: error.stderr,
        matched: false
      };
    }
  }

  private async triggerProcessError(trigger: ErrorTrigger): Promise<CapturedError> {
    const action = trigger.action;
    const args = trigger.args || {};

    try {
      switch (action) {
        case 'spawn_failure':
          spawn('/nonexistent/command', [], { stdio: 'pipe' });
          break;

        case 'child_exit':
          {
          const child = spawn('node', ['-e', 'process.exit(1)'], { stdio: 'pipe' });
          await new Promise((resolve, reject) => {
            child.on('exit', resolve);
            child.on('error', reject);
          });
          break;

          }
        case 'resource_exhaustion':
          {
          // Try to spawn too many processes
          const processes: any[] = [];
          for (let i = 0; i < 1000; i++) {
            try {
              const proc = spawn('sleep', ['1'], { stdio: 'ignore' });
              processes.push(proc);
            } catch (error) {
              // Clean up spawned processes
              processes.forEach(p => p.kill());
              throw error;
            }
          }
          // Clean up
          processes.forEach(p => p.kill());
          break;
          }
      }

      return {
        type: 'process_error_not_triggered',
        message: 'Process error was not triggered as expected',
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'process_error',
        message: error.message,
        code: error.code,
        matched: false
      };
    }
  }

  private async triggerMemoryError(trigger: ErrorTrigger): Promise<CapturedError> {
    const action = trigger.action;
    const args = trigger.args || {};

    try {
      switch (action) {
        case 'out_of_memory':
          {
          // Allocate large amounts of memory
          const arrays: any[] = [];
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(1024 * 1024).fill(0));
          }
          break;

          }
        case 'memory_leak':
          {
          // Simulate memory leak
          const leak: any[] = [];
          const interval = setInterval(() => {
            leak.push(new Array(1024).fill(Math.random()));
          }, 1);
          
          setTimeout(() => clearInterval(interval), 5000);
          break;
          }
      }

      return {
        type: 'memory_error_not_triggered',
        message: 'Memory error was not triggered as expected',
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'memory_error',
        message: error.message,
        matched: false
      };
    }
  }

  private async triggerSignalError(trigger: ErrorTrigger): Promise<CapturedError> {
    const action = trigger.action;
    const args = trigger.args || {};

    try {
      const child = spawn('node', ['-e', 'setInterval(() => {}, 1000)'], {
        stdio: 'pipe'
      });

      // Send signal after delay
      setTimeout(() => {
        child.kill(args.signal || 'SIGTERM');
      }, args.delay || 100);

      await new Promise((resolve, reject) => {
        child.on('exit', (code, signal) => {
          resolve({ code, signal });
        });
        child.on('error', reject);
      });

      return {
        type: 'signal_error',
        message: `Process killed with signal: ${args.signal || 'SIGTERM'}`,
        signal: args.signal || 'SIGTERM',
        matched: false
      };

    } catch (error: any) {
      return {
        type: 'signal_error',
        message: error.message,
        signal: args.signal,
        matched: false
      };
    }
  }

  private async triggerCustomError(trigger: ErrorTrigger): Promise<CapturedError> {
    // Custom error triggers would be implemented by extending this class
    return {
      type: 'custom_error',
      message: `Custom error: ${trigger.action}`,
      matched: false
    };
  }

  private validateExpectedError(
    actual: CapturedError,
    expected: ExpectedError
  ): boolean {
    switch (expected.type) {
      case 'exception':
        if (expected.pattern) {
          const regex = typeof expected.pattern === 'string' ?
            new RegExp(expected.pattern) :
            expected.pattern;
          return regex.test(actual.message);
        }
        return true;

      case 'exit_code':
        return actual.code === expected.code;

      case 'signal':
        return actual.signal === expected.signal;

      case 'output':
        if (expected.pattern && actual.stdout) {
          const regex = typeof expected.pattern === 'string' ?
            new RegExp(expected.pattern) :
            expected.pattern;
          return regex.test(actual.stdout);
        }
        return false;

      default:
        return false;
    }
  }

  private async attemptRecovery(
    recoveryActions: RecoveryAction[],
    error?: CapturedError
  ): Promise<RecoveryResult> {
    this.log('info', 'Attempting recovery');

    const result: RecoveryResult = {
      attempted: true,
      successful: false,
      actions: [],
      duration: 0,
      finalState: 'failed'
    };

    const startTime = Date.now();

    for (const action of recoveryActions) {
      const actionResult = await this.executeRecoveryAction(action, error);
      result.actions.push(actionResult);

      if (!actionResult.success) {
        this.log('warn', `Recovery action failed: ${action.action}`);
        break;
      }
    }

    result.duration = Date.now() - startTime;
    result.successful = result.actions.every(a => a.success);
    result.finalState = result.successful ? 'recovered' : 
                       result.actions.some(a => a.success) ? 'partial' : 'failed';

    this.log('info', 'Recovery attempt completed', { 
      successful: result.successful,
      state: result.finalState 
    });

    return result;
  }

  private async executeRecoveryAction(
    action: RecoveryAction,
    error?: CapturedError
  ): Promise<RecoveryActionResult> {
    this.log('debug', `Executing recovery action: ${action.type}`);

    const result: RecoveryActionResult = {
      action: action.action,
      success: false,
      duration: 0
    };

    const startTime = Date.now();

    try {
      switch (action.type) {
        case 'retry':
          await this.retryAction(action);
          break;

        case 'fallback':
          await this.fallbackAction(action);
          break;

        case 'cleanup':
          await this.cleanupAction(action);
          break;

        case 'restart':
          await this.restartAction(action);
          break;

        case 'custom':
          await this.customRecoveryAction(action);
          break;
      }

      result.success = true;
      result.duration = Date.now() - startTime;

    } catch (recoveryError: any) {
      result.error = recoveryError.message;
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async retryAction(action: RecoveryAction): Promise<void> {
    const maxAttempts = action.maxAttempts || 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.executeCommand(action.action);
        return;
      } catch (error: any) {
        if (attempt === maxAttempts) {
          throw error;
        }
        await this.wait(1000 * attempt); // Exponential backoff
      }
    }
  }

  private async fallbackAction(action: RecoveryAction): Promise<void> {
    await this.executeCommand(action.action);
  }

  private async cleanupAction(action: RecoveryAction): Promise<void> {
    if (action.action.startsWith('rm ') || action.action.startsWith('delete ')) {
      const target = action.action.split(' ')[1];
      await fs.remove(path.join(this.workDir, target));
    } else {
      await this.executeCommand(action.action);
    }
  }

  private async restartAction(action: RecoveryAction): Promise<void> {
    // Simulate service restart
    await this.executeCommand(action.action);
  }

  private async customRecoveryAction(action: RecoveryAction): Promise<void> {
    // Custom recovery actions would be implemented by extending this class
    this.log('debug', `Custom recovery: ${action.action}`);
  }

  private async runValidation(checks: ValidationCheck[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const check of checks) {
      const result = await this.executeValidationCheck(check);
      results.push(result);
    }

    return results;
  }

  private async executeValidationCheck(check: ValidationCheck): Promise<ValidationResult> {
    const result: ValidationResult = {
      check: `${check.type}:${check.target}`,
      success: false
    };

    try {
      switch (check.type) {
        case 'file':
          await this.validateFile(check, result);
          break;

        case 'process':
          await this.validateProcess(check, result);
          break;

        case 'state':
          await this.validateState(check, result);
          break;

        case 'output':
          await this.validateOutput(check, result);
          break;

        case 'custom':
          await this.validateCustom(check, result);
          break;
      }
    } catch (error: any) {
      result.error = error.message;
    }

    return result;
  }

  private async validateFile(
    check: ValidationCheck,
    result: ValidationResult
  ): Promise<void> {
    const filePath = path.join(this.workDir, check.target);

    switch (check.condition) {
      case 'exists':
        {
        const exists = await fs.pathExists(filePath);
        result.success = exists;
        result.actual = exists;
        result.expected = true;
        break;

        }
      case 'contains':
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          result.success = content.includes(check.value);
          result.actual = content.substring(0, 100);
          result.expected = `contains "${check.value}"`;
        }
        break;
    }
  }

  private async validateProcess(
    check: ValidationCheck,
    result: ValidationResult
  ): Promise<void> {
    switch (check.condition) {
      case 'running':
        try {
          execSync(`pgrep -f "${check.target}"`, { encoding: 'utf-8' });
          result.success = true;
          result.actual = 'running';
          result.expected = 'running';
        } catch {
          result.success = false;
          result.actual = 'not running';
          result.expected = 'running';
        }
        break;
    }
  }

  private async validateState(
    check: ValidationCheck,
    result: ValidationResult
  ): Promise<void> {
    // State validation implementation
    result.success = true;
  }

  private async validateOutput(
    check: ValidationCheck,
    result: ValidationResult
  ): Promise<void> {
    // Output validation implementation
    result.success = true;
  }

  private async validateCustom(
    check: ValidationCheck,
    result: ValidationResult
  ): Promise<void> {
    // Custom validation implementation
    result.success = true;
  }

  private async executeCommand(command: string): Promise<string> {
    return execSync(command, {
      cwd: this.workDir,
      encoding: 'utf-8',
      timeout: this.config.timeout
    });
  }

  private async cleanupScenario(scenario: ErrorScenario): Promise<void> {
    if (scenario.cleanup) {
      for (const cleanup of scenario.cleanup) {
        try {
          await this.executeCommand(cleanup);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await fs.remove(this.workDir);
    } catch {
      // Ignore cleanup errors
    }
  }

  private generateReport(duration: number): ErrorTestReport {
    const summary = this.generateSummary(duration);
    const analysis = this.analyzeResults();
    const recommendations = this.generateRecommendations(analysis);
    const patterns = this.identifyPatterns();

    return {
      summary,
      results: this.results,
      analysis,
      recommendations,
      patterns,
      timestamp: new Date()
    };
  }

  private generateSummary(duration: number): ErrorTestSummary {
    const categories = new Map<string, number>();
    const severity = new Map<string, number>();

    for (const result of this.results) {
      const scenario = this.config.scenarios.find(s => s.name === result.scenario);
      if (scenario) {
        categories.set(scenario.category, (categories.get(scenario.category) || 0) + 1);
        
        const sev = scenario.expectedError?.severity || 'medium';
        severity.set(sev, (severity.get(sev) || 0) + 1);
      }
    }

    return {
      totalScenarios: this.results.length,
      passed: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      recovered: this.results.filter(r => r.recovery?.successful).length,
      unrecovered: this.results.filter(r => r.recovery && !r.recovery.successful).length,
      categories,
      severity,
      duration: duration / 1000
    };
  }

  private analyzeResults(): ErrorAnalysis {
    const resilience = this.calculateResilience();
    const hotspots = this.identifyHotspots();
    const trends = this.analyzeTrends();
    const gaps = this.identifyGaps();

    return { resilience, hotspots, trends, gaps };
  }

  private calculateResilience(): ResilienceMetrics {
    const total = this.results.length;
    const errors = this.results.filter(r => r.error).length;
    const recovered = this.results.filter(r => r.recovery?.successful).length;
    const partialRecoveries = this.results.filter(r => 
      r.recovery?.finalState === 'partial'
    ).length;

    const recoveryTimes = this.results
      .filter(r => r.recovery)
      .map(r => r.recovery!.duration);

    const criticalFailures = this.results.filter(r => {
      const scenario = this.config.scenarios.find(s => s.name === r.scenario);
      return scenario?.expectedError?.severity === 'critical' && !r.success;
    }).length;

    return {
      errorRate: total > 0 ? (errors / total) * 100 : 0,
      recoveryRate: errors > 0 ? (recovered / errors) * 100 : 0,
      averageRecoveryTime: recoveryTimes.length > 0 ?
        recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : 0,
      criticalFailures,
      partialRecoveries
    };
  }

  private identifyHotspots(): ErrorHotspot[] {
    const hotspots: ErrorHotspot[] = [];
    const categoryStats = new Map<string, { count: number; failures: number }>();

    for (const result of this.results) {
      const scenario = this.config.scenarios.find(s => s.name === result.scenario);
      if (scenario) {
        const stats = categoryStats.get(scenario.category) || { count: 0, failures: 0 };
        stats.count++;
        if (!result.success) stats.failures++;
        categoryStats.set(scenario.category, stats);
      }
    }

    for (const [category, stats] of categoryStats) {
      const failureRate = (stats.failures / stats.count) * 100;
      
      if (failureRate > 50) {
        hotspots.push({
          category,
          count: stats.failures,
          severity: failureRate > 80 ? 'critical' : 'high',
          description: `High failure rate in ${category} operations (${failureRate.toFixed(1)}%)`,
          impact: `${stats.failures} out of ${stats.count} scenarios failed`,
          suggestion: `Review and strengthen ${category} error handling`
        });
      }
    }

    return hotspots;
  }

  private analyzeTrends(): ErrorTrend[] {
    // Simple trend analysis
    return [];
  }

  private identifyGaps(): RecoveryGap[] {
    const gaps: RecoveryGap[] = [];

    for (const result of this.results) {
      if (result.recovery && !result.recovery.successful) {
        gaps.push({
          scenario: result.scenario,
          issue: 'Recovery failed',
          impact: 'high',
          recommendation: 'Implement additional recovery mechanisms'
        });
      }

      if (!result.recovery && result.error) {
        gaps.push({
          scenario: result.scenario,
          issue: 'No recovery mechanism defined',
          impact: 'medium',
          recommendation: 'Add recovery actions for this error scenario'
        });
      }
    }

    return gaps;
  }

  private generateRecommendations(analysis: ErrorAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.resilience.recoveryRate < 80) {
      recommendations.push(
        `Improve recovery mechanisms - current rate: ${analysis.resilience.recoveryRate.toFixed(1)}%`
      );
    }

    if (analysis.resilience.criticalFailures > 0) {
      recommendations.push(
        `Address ${analysis.resilience.criticalFailures} critical failure(s) immediately`
      );
    }

    for (const hotspot of analysis.hotspots) {
      if (hotspot.severity === 'critical') {
        recommendations.push(hotspot.suggestion);
      }
    }

    if (analysis.gaps.length > 0) {
      recommendations.push(
        `Implement recovery mechanisms for ${analysis.gaps.length} identified gap(s)`
      );
    }

    return recommendations;
  }

  private identifyPatterns(): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];
    const errorMessages = this.results
      .filter(r => r.error)
      .map(r => r.error!.message);

    // Common error patterns
    const commonPatterns = [
      { name: 'Permission Denied', pattern: /permission denied|access denied/i },
      { name: 'File Not Found', pattern: /no such file|file not found/i },
      { name: 'Network Error', pattern: /connection refused|timeout|network/i },
      { name: 'Out of Memory', pattern: /out of memory|cannot allocate/i },
      { name: 'Process Error', pattern: /child process|spawn|exit code/i }
    ];

    for (const patternDef of commonPatterns) {
      const matches = errorMessages.filter(msg => patternDef.pattern.test(msg));
      
      if (matches.length > 0) {
        patterns.push({
          name: patternDef.name,
          pattern: patternDef.pattern,
          category: 'common',
          frequency: matches.length,
          examples: matches.slice(0, 3)
        });
      }
    }

    return patterns;
  }

  private async saveReport(report: ErrorTestReport): Promise<void> {
    const reportPath = path.join(process.cwd(), 'error-test-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });

    const summaryPath = reportPath.replace('.json', '-summary.txt');
    await fs.writeFile(summaryPath, this.formatSummary(report));

    this.emit('report:saved', { json: reportPath, summary: summaryPath });
  }

  private formatSummary(report: ErrorTestReport): string {
    const lines: string[] = [
      'Error Scenario Testing Report',
      '============================',
      '',
      `Date: ${report.timestamp.toISOString()}`,
      '',
      'Summary:',
      `  Total Scenarios: ${report.summary.totalScenarios}`,
      `  Passed: ${report.summary.passed}`,
      `  Failed: ${report.summary.failed}`,
      `  Recovered: ${report.summary.recovered}`,
      `  Unrecovered: ${report.summary.unrecovered}`,
      '',
      'Resilience Metrics:',
      `  Error Rate: ${report.analysis.resilience.errorRate.toFixed(1)}%`,
      `  Recovery Rate: ${report.analysis.resilience.recoveryRate.toFixed(1)}%`,
      `  Avg Recovery Time: ${report.analysis.resilience.averageRecoveryTime.toFixed(0)}ms`,
      `  Critical Failures: ${report.analysis.resilience.criticalFailures}`,
      '',
      'Error Patterns:'
    ];

    report.patterns.forEach(pattern => {
      lines.push(`  ${pattern.name}: ${pattern.frequency} occurrences`);
    });

    lines.push('', 'Recommendations:');
    report.recommendations.forEach(rec => {
      lines.push(`  - ${rec}`);
    });

    return lines.join('\n');
  }

  private log(level: LogEntry['level'], message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };

    this.logs.push(entry);
    this.emit('log', entry);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export utility functions
export function createErrorScenario(
  name: string,
  category: ErrorScenario['category'],
  trigger: ErrorTrigger,
  options?: Partial<ErrorScenario>
): ErrorScenario {
  return {
    name,
    category,
    trigger,
    ...options
  };
}

export function createErrorTrigger(
  type: ErrorTrigger['type'],
  action: string,
  args?: any
): ErrorTrigger {
  return { type, action, args };
}

export async function runErrorScenarios(
  scenarios: ErrorScenario[],
  config?: Partial<ErrorScenarioConfig>
): Promise<ErrorTestReport> {
  const tester = new ErrorScenarioTesting({
    scenarios,
    ...config
  });
  return tester.run();
}