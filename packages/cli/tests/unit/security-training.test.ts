import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateSecurityTrainingMarkdown,
  generateSecurityTrainingTerraform,
  generateTrainingManagerTypeScript,
  generateTrainingManagerPython,
  writeSecurityTrainingFiles,
  displaySecurityTrainingConfig,
  type SecurityTrainingConfig,
} from '../../src/utils/security-training';

/**
 * Minimal valid `SecurityTrainingConfig` fixture. Only the fields the codegen
 * functions actually read are populated; everything else is cast through.
 */
function makeConfig(over: Partial<SecurityTrainingConfig> = {}): SecurityTrainingConfig {
  return {
    projectName: 'sec-app',
    providers: ['aws', 'azure'],
    settings: {
      autoAssign: true,
      frequency: 'quarterly',
      duration: 45,
      passingScore: 80,
      maxAttempts: 3,
      requiredForAll: true,
      trackingEnabled: true,
      reminderEnabled: true,
      reminderFrequency: 7,
      allowSkip: false,
      showAnswers: false,
      randomizeQuestions: true,
      adaptiveDifficulty: true,
      gamificationEnabled: true,
      leaderboardEnabled: false,
      certificateEnabled: true,
      expiryPeriod: 365,
      mandatoryModules: [],
      electiveModules: [],
    },
    modules: ['phishing', 'passwords'] as any,
    moduleData: [
      {
        id: 'm1',
        name: 'Phishing Awareness',
        type: 'awareness',
        description: 'spot phishing',
        difficulty: 'beginner',
        duration: 30,
        status: 'active',
        passScore: 80,
        maxAttempts: 3,
        mandatory: true,
        tags: ['email'],
        content: [],
        questions: [],
        learningObjectives: [],
        prerequisites: [],
        targetRoles: [],
        targetDepartments: [],
        lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
      } as any,
      {
        id: 'm2',
        name: 'Password Hygiene',
        type: 'awareness',
        difficulty: 'intermediate',
        duration: 20,
        passScore: 70,
        mandatory: false,
      } as any,
    ],
    users: [{ id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'engineer' } as any],
    progress: [],
    assessments: [],
    gamification: { enabled: true } as any,
    analytics: [],
    integrations: [],
    ...over,
  } as SecurityTrainingConfig;
}

describe('generateSecurityTrainingMarkdown', () => {
  it('embeds project name, providers and settings flags', () => {
    const md = generateSecurityTrainingMarkdown(makeConfig());
    expect(md).toContain('# Security Training');
    expect(md).toContain('**Project**: sec-app');
    expect(md).toContain('**Providers**: aws, azure');
    expect(md).toContain('**Auto-Assign**: Yes');
    expect(md).toContain('**Gamification**: Yes');
    expect(md).toContain('**Leaderboard**: No');
  });

  it('renders the training settings block', () => {
    const md = generateSecurityTrainingMarkdown(makeConfig());
    expect(md).toContain('**Frequency**: quarterly');
    expect(md).toContain('**Duration**: 45 minutes per session');
    expect(md).toContain('**Passing Score**: 80%');
    expect(md).toContain('**Max Attempts**: 3');
    expect(md).toContain('**Required for All**: true');
    expect(md).toContain('**Certificate**: true');
    expect(md).toContain('**Adaptive Difficulty**: true');
  });

  it('lists up to five modules and reports aggregate counts', () => {
    const md = generateSecurityTrainingMarkdown(makeConfig());
    expect(md).toContain('## Training Modules (2)');
    expect(md).toContain('### Phishing Awareness');
    expect(md).toContain('### Password Hygiene');
    expect(md).toContain('**Difficulty**: beginner');
    expect(md).toContain('**Mandatory**: Yes');
    expect(md).toContain('## Users (1)');
    expect(md).toContain('## Progress Records (0)');
    expect(md).toContain('## Gamification (Enabled)');
  });

  it('caps the module listing at five entries', () => {
    const moduleData = Array.from({ length: 7 }, (_, i) => ({
      id: `m${i}`,
      name: `Module ${i}`,
      type: 'awareness',
      difficulty: 'beginner',
      duration: 10,
      passScore: 80,
      mandatory: false,
    })) as any;
    const md = generateSecurityTrainingMarkdown(makeConfig({ moduleData } as any));
    expect(md).toContain('## Training Modules (7)');
    expect(md).toContain('### Module 0');
    expect(md).toContain('### Module 4');
    expect(md).not.toContain('### Module 5');
  });

  it('reflects disabled gamification in the summary', () => {
    const md = generateSecurityTrainingMarkdown(
      makeConfig({
        settings: { ...makeConfig().settings, gamificationEnabled: false } as any,
        gamification: { enabled: false } as any,
      } as any),
    );
    expect(md).toContain('**Gamification**: No');
    expect(md).toContain('## Gamification (Disabled)');
  });
});

describe('generateSecurityTrainingTerraform', () => {
  const config = makeConfig();

  it('generates AWS resources keyed off the project name', () => {
    const tf = generateSecurityTrainingTerraform(config, 'aws');
    expect(tf).toContain('# AWS Security Training Infrastructure');
    expect(tf).toContain('resource "aws_s3_bucket" "training_content"');
    expect(tf).toContain('bucket = "sec-app-training-content"');
    expect(tf).toContain('aws_cognito_user_pool" "training_users"');
    expect(tf).toContain('aws_lambda_function" "training_tracker"');
    expect(tf).toContain('runtime         = "python3.9"');
  });

  it('generates Azure resources with dashes stripped from the storage name', () => {
    const tf = generateSecurityTrainingTerraform(
      makeConfig({ projectName: 'my-app' }),
      'azure',
    );
    expect(tf).toContain('# Azure Security Training Infrastructure');
    expect(tf).toContain('azurerm_storage_account" "training_content"');
    expect(tf).toContain('name                     = "myapptraining"');
    expect(tf).toContain('azurerm_policy_assignment" "training_policy"');
  });

  it('generates GCP resources', () => {
    const tf = generateSecurityTrainingTerraform(config, 'gcp');
    expect(tf).toContain('# GCP Security Training Infrastructure');
    expect(tf).toContain('google_storage_bucket" "training_content"');
    expect(tf).toContain('name          = "sec-app-training-content"');
    expect(tf).toContain('google_cloud_tasks_queue" "training_reminders"');
    expect(tf).toContain('google_firebase_project" "gamification"');
  });
});

describe('generateTrainingManagerTypeScript', () => {
  it('emits a SecurityTrainingManager class with the expected shape', () => {
    const ts = generateTrainingManagerTypeScript(makeConfig());
    expect(ts).toContain('import { EventEmitter }');
    expect(ts).toContain('interface User');
    expect(ts).toContain('interface Progress');
    expect(ts).toContain('interface Badge');
    expect(ts).toContain('class SecurityTrainingManager extends EventEmitter');
    expect(ts).toContain('async assignTraining(');
    expect(ts).toContain('async submitScore(');
    expect(ts).toContain('async awardBadge(');
    expect(ts).toContain('getLeaderboard()');
    expect(ts).toContain("export { SecurityTrainingManager }");
  });
});

describe('generateTrainingManagerPython', () => {
  it('emits a SecurityTrainingManager class with dataclasses', () => {
    const py = generateTrainingManagerPython(makeConfig());
    expect(py).toContain('from typing import Dict, List, Any, Optional');
    expect(py).toContain('@dataclass');
    expect(py).toContain('class User:');
    expect(py).toContain('class Progress:');
    expect(py).toContain('class Badge:');
    expect(py).toContain('class SecurityTrainingManager:');
    expect(py).toContain('async def assign_training(');
    expect(py).toContain('async def submit_score(');
    expect(py).toContain('async def award_badge(');
    expect(py).toContain('def get_leaderboard(');
  });
});

describe('writeSecurityTrainingFiles', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-write-'));
  });
  afterEach(() => fs.removeSync(dir));

  it('writes the TypeScript bundle: MD, per-provider TF, manager, package.json, config', async () => {
    const config = makeConfig({ providers: ['aws', 'gcp'] });
    await writeSecurityTrainingFiles(config, dir, 'typescript');

    expect(await fs.pathExists(path.join(dir, 'SECURITY_TRAINING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'security-training-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'security-training-gcp.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'security-training-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'security-training-config.json'))).toBe(true);

    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('sec-app');
    expect(pkg.main).toBe('security-training-manager.ts');
    expect(pkg.dependencies).toBeDefined();

    const cfg = JSON.parse(await fs.readFile(path.join(dir, 'security-training-config.json'), 'utf8'));
    expect(cfg.projectName).toBe('sec-app');
  });

  it('writes the Python bundle: MD, per-provider TF, manager, requirements.txt, config', async () => {
    const config = makeConfig({ providers: ['azure'] });
    await writeSecurityTrainingFiles(config, dir, 'python');

    expect(await fs.pathExists(path.join(dir, 'security_training_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'security-training-azure.tf'))).toBe(true);
    const reqs = await fs.readFile(path.join(dir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pydantic');
    expect(reqs).toContain('python-dotenv');
  });
});

describe('displaySecurityTrainingConfig', () => {
  it('prints a summary keyed off the config', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      displaySecurityTrainingConfig(makeConfig());
      const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Security Training Integration');
      expect(out).toContain('sec-app');
      expect(out).toContain('aws, azure');
      expect(out).toContain('Auto-Assign: Yes');
      expect(out).toContain('Modules: 2');
      expect(out).toContain('Users: 1');
    } finally {
      spy.mockRestore();
    }
  });
});
