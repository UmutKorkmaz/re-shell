import ora from 'ora';
import chalk from 'chalk';
import { ProgressSpinner } from './spinner';

// Enhanced progress tracker with substeps
export class ProgressTracker {
  private spinner: ProgressSpinner;
  private totalSteps: number;
  private currentStep = 0;
  private stepName = '';

  constructor(title: string, totalSteps: number) {
    this.totalSteps = totalSteps;
    this.spinner = new ProgressSpinner({ text: this.formatText(title) });
  }

  start(): this {
    this.spinner.start();
    return this;
  }

  nextStep(stepName: string): this {
    this.currentStep++;
    this.stepName = stepName;
    this.spinner.setText(this.formatText(stepName));
    return this;
  }

  updateStep(message: string): this {
    this.spinner.setText(this.formatText(message));
    return this;
  }

  succeed(message?: string): this {
    this.spinner.succeed(message || `✅ All ${this.totalSteps} steps completed successfully!`);
    return this;
  }

  fail(message?: string): this {
    this.spinner.fail(message || `❌ Failed at step ${this.currentStep}/${this.totalSteps}: ${this.stepName}`);
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  private formatText(text: string): string {
    if (this.totalSteps > 1) {
      const progress = this.currentStep > 0 ? ` (${this.currentStep}/${this.totalSteps})` : '';
      return `${text}${progress}`;
    }
    return text;
  }
}

// Enhanced multi-step operations with better UX
export class MultiStepProgress {
  private steps: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed' }> = [];
  private spinner: ProgressSpinner;
  private isInteractive: boolean;

  constructor(title: string, steps: string[]) {
    this.steps = steps.map(name => ({ name, status: 'pending' as const }));
    this.isInteractive = Boolean(
      process.stdout.isTTY && 
      process.env.TERM !== 'dumb' && 
      !process.env.CI &&
      !process.env.RE_SHELL_NO_SPINNER
    );
    
    this.spinner = new ProgressSpinner({ text: title });
  }

  start(): this {
    if (this.isInteractive) {
      this.spinner.start();
      this.updateDisplay();
    } else {
      console.log(chalk.cyan('⏳ Starting multi-step process...'));
      this.steps.forEach((step, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${step.name}`));
      });
    }
    return this;
  }

  startStep(stepIndex: number): this {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex].status = 'running';
      this.updateDisplay();
    }
    return this;
  }

  completeStep(stepIndex: number): this {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex].status = 'completed';
      this.updateDisplay();
    }
    return this;
  }

  failStep(stepIndex: number): this {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.steps[stepIndex].status = 'failed';
      this.updateDisplay();
    }
    return this;
  }

  succeed(message?: string): this {
    if (this.isInteractive) {
      this.spinner.succeed(message || 'All steps completed successfully!');
    } else {
      console.log(chalk.green('✅'), message || 'All steps completed successfully!');
    }
    return this;
  }

  fail(message?: string): this {
    if (this.isInteractive) {
      this.spinner.fail(message || 'Process failed');
    } else {
      console.log(chalk.red('❌'), message || 'Process failed');
    }
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  private updateDisplay(): void {
    if (!this.isInteractive) {
      // For non-interactive, just log the current step
      const runningStep = this.steps.find(s => s.status === 'running');
      const completedCount = this.steps.filter(s => s.status === 'completed').length;
      
      if (runningStep) {
        console.log(chalk.cyan(`⏳ [${completedCount}/${this.steps.length}] ${runningStep.name}`));
      }
      return;
    }

    const completedCount = this.steps.filter(s => s.status === 'completed').length;
    const runningStep = this.steps.find(s => s.status === 'running');
    const failedStep = this.steps.find(s => s.status === 'failed');

    let text = '';
    if (failedStep) {
      text = `❌ Failed: ${failedStep.name}`;
    } else if (runningStep) {
      text = `[${completedCount}/${this.steps.length}] ${runningStep.name}`;
    } else if (completedCount === this.steps.length) {
      text = `✅ All ${this.steps.length} steps completed`;
    } else {
      text = `Preparing... (${completedCount}/${this.steps.length})`;
    }

    this.spinner.setText(text);
  }
}

// Simple progress bar for file operations
export class ProgressBar {
  private total: number;
  private current = 0;
  private spinner: ProgressSpinner;
  private title: string;

  constructor(title: string, total: number) {
    this.total = total;
    this.title = title;
    this.spinner = new ProgressSpinner({ text: this.formatText() });
  }

  start(): this {
    this.spinner.start();
    return this;
  }

  increment(amount = 1): this {
    this.current = Math.min(this.current + amount, this.total);
    this.spinner.setText(this.formatText());
    return this;
  }

  setProgress(current: number): this {
    this.current = Math.min(Math.max(current, 0), this.total);
    this.spinner.setText(this.formatText());
    return this;
  }

  succeed(message?: string): this {
    this.spinner.succeed(message || `${this.title} completed`);
    return this;
  }

  fail(message?: string): this {
    this.spinner.fail(message || `${this.title} failed`);
    return this;
  }

  private formatText(): string {
    const percentage = Math.round((this.current / this.total) * 100);
    const progressBar = this.createProgressBar(percentage);
    return `${this.title} ${progressBar} ${this.current}/${this.total} (${percentage}%)`;
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}

// Factory functions for common progress patterns
export function createProgressTracker(title: string, steps: number): ProgressTracker {
  return new ProgressTracker(title, steps);
}

export function createMultiStepProgress(title: string, steps: string[]): MultiStepProgress {
  return new MultiStepProgress(title, steps);
}

export function createProgressBar(title: string, total: number): ProgressBar {
  return new ProgressBar(title, total);
}