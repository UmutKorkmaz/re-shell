import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCodeReviewWorkflowMD,
  generateTerraformCodeReviewWorkflow,
  generateTypeScriptCodeReviewWorkflow,
  generatePythonCodeReviewWorkflow,
  writeFiles,
  codeReviewWorkflow,
} from '../../src/utils/code-review-workflow';

const config = {
  projectName: 'review-app',
  providers: ['aws' as const],
  review: {
    minApprovals: 2,
    minReviewers: 3,
    autoMerge: true,
    blockingChecks: ['lint', 'test'],
  },
  comments: [
    {
      id: 'c1',
      userId: 'u1',
      userName: 'Alice',
      file: 'src/index.ts',
      line: 10,
      content: 'Fix this',
      resolved: false,
      timestamp: Date.now(),
    },
  ],
  rules: [
    { name: 'require-tests', condition: 'changes in /src', required: true },
  ],
  integration: 'github' as const,
  enableAutoReview: true,
  enableComments: true,
  enableNotifications: false,
};

describe('codeReviewWorkflow', () => {
  it('returns the config as-is', () => {
    const result = codeReviewWorkflow(config);
    expect(result).toBe(config);
  });
});

describe('generateCodeReviewWorkflowMD', () => {
  it('generates markdown with title', () => {
    const md = generateCodeReviewWorkflowMD(config);
    expect(md).toContain('# Real-Time Code Review and Approval Workflows');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateCodeReviewWorkflowMD(config);
    expect(md).toContain('Real-time code review');
    expect(md).toContain('Approval workflows');
    expect(md).toContain('Auto-merge');
    expect(md).toContain('Multi-cloud');
  });
});

describe('generateTerraformCodeReviewWorkflow', () => {
  it('includes project name', () => {
    const tf = generateTerraformCodeReviewWorkflow(config);
    expect(tf).toContain('review-app');
    expect(tf).toContain('Terraform');
  });

  it('includes ISO timestamp', () => {
    const tf = generateTerraformCodeReviewWorkflow(config);
    expect(tf).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('generateTypeScriptCodeReviewWorkflow', () => {
  it('generates TypeScript manager class', () => {
    const ts = generateTypeScriptCodeReviewWorkflow(config);
    expect(ts).toContain('CodeReviewWorkflowManager');
    expect(ts).toContain('extends EventEmitter');
    expect(ts).toContain('export default');
    expect(ts).toContain('review-app');
  });
});

describe('generatePythonCodeReviewWorkflow', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCodeReviewWorkflow(config);
    expect(py).toContain('class CodeReviewWorkflowManager');
    expect(py).toContain('review-app');
    expect(py).toContain('import asyncio');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-review-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'code-review-workflow.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'code-review-workflow-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CODE_REVIEW_WORKFLOW.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'code-review-workflow-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'code-review-workflow.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'code_review_workflow_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CODE_REVIEW_WORKFLOW.md'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('review-app-code-review-workflow');
    expect(pkg.dependencies).toHaveProperty('@types/node');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'code-review-workflow-config.json'));
    expect(json.projectName).toBe('review-app');
    expect(json.review.minApprovals).toBe(2);
    expect(json.integration).toBe('github');
    expect(json.comments).toHaveLength(1);
    expect(json.enableAutoReview).toBe(true);
  });

  it('requirements.txt contains expected deps for Python', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pygithub');
    expect(req).toContain('gitlab');
  });
});

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
