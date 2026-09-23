import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  technicalDocumentation,
  displayConfig,
  generateMD,
  generateTerraform,
  generateTypeScript,
  generatePython,
  writeFiles,
  type TechnicalDocConfig,
} from '../../src/utils/technical-documentation';

/**
 * technical-documentation is a code-gen utility (MD / Terraform / TS / Python
 * bundles) driven by a deeply-nested TechnicalDocConfig. We build one valid
 * fixture and assert on the deterministic string output of each generator.
 */

const D = (s: string) => new Date(s);

/** A complete, valid TechnicalDocConfig fixture. */
function makeConfig(): TechnicalDocConfig {
  return {
    projectName: 'Test Project',
    providers: ['aws', 'azure', 'gcp'],
    documentation: [
      {
        docId: 'doc-1',
        title: 'Getting Started',
        type: 'user-guide',
        format: 'markdown',
        status: 'published',
        content: 'Intro content',
        sections: [
          {
            id: 'sec-1',
            title: 'Overview',
            content: 'Overview text',
            order: 1,
            codeBlocks: [
              { language: 'ts', code: 'console.log(1)', syntaxHighlighted: true, lineNumbers: false },
            ],
            diagrams: [],
            examples: [],
            references: [],
            tags: ['intro'],
            aiGenerated: false,
            lastUpdated: D('2026-01-01'),
          },
        ],
        metadata: {
          author: 'alice',
          contributors: ['bob'],
          createdAt: D('2026-01-01'),
          updatedAt: D('2026-01-02'),
          tags: ['intro'],
          category: 'guide',
          audience: 'beginner',
          readingTime: 5,
          difficulty: 'easy',
          prerequisites: [],
          relatedDocs: [],
          searchKeywords: ['start'],
          locale: 'en',
        },
        version: '1.0.0',
        lastReviewed: D('2026-01-02'),
        nextReviewDate: D('2026-04-02'),
        aiSuggestions: [
          { id: 's1', type: 'clarity', suggestion: 'Reword', confidence: 0.8, reasoning: 'r', priority: 'high', status: 'pending', createdAt: D('2026-01-03') },
          { id: 's2', type: 'content', suggestion: 'Add example', confidence: 0.6, reasoning: 'r', priority: 'medium', status: 'accepted', createdAt: D('2026-01-03') },
          { id: 's3', type: 'formatting', suggestion: 'Bold heading', confidence: 0.4, reasoning: 'r', priority: 'low', status: 'rejected', createdAt: D('2026-01-03') },
        ],
        changeHistory: [],
      },
      {
        docId: 'doc-2',
        title: 'API Reference',
        type: 'api',
        format: 'openapi',
        status: 'draft',
        content: '',
        sections: [],
        metadata: {
          author: 'carol',
          contributors: [],
          createdAt: D('2026-01-01'),
          updatedAt: D('2026-01-01'),
          tags: [],
          category: 'api',
          audience: 'advanced',
          readingTime: 20,
          difficulty: 'hard',
          prerequisites: ['REST'],
          relatedDocs: [],
          searchKeywords: [],
          locale: 'en',
        },
        version: '0.1.0',
        lastReviewed: D('2026-01-01'),
        nextReviewDate: D('2026-02-01'),
        aiSuggestions: [],
        changeHistory: [],
      },
    ],
    aiConfig: {
      provider: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-opus',
      temperature: 0.2,
      maxTokens: 4096,
      enableContentGeneration: true,
      enableReview: false,
      enableSuggestions: true,
      enableAutoUpdate: false,
    },
    templates: [
      {
        id: 'tpl-1',
        name: 'API Template',
        type: 'api',
        format: 'openapi',
        structure: [{ id: 'ts-1', title: 'Endpoints', description: 'd', required: true, order: 1 }],
        placeholders: [{ key: 'baseURL', description: 'd', type: 'text', required: true }],
        styleGuidelines: [{ category: 'tone', rule: 'Be concise', enforcement: 'required' }],
        requiredSections: ['ts-1'],
        optionalSections: [],
      },
    ],
    workflows: [
      {
        id: 'wf-1',
        name: 'Publish Flow',
        description: 'Draft to published',
        stages: [
          { id: 'st-1', name: 'Draft', description: 'd', type: 'creation', order: 1, autoAssign: true, checklists: [] },
          { id: 'st-2', name: 'Approve', description: 'd', type: 'approval', order: 2, autoAssign: false, checklists: [] },
        ],
        approvers: ['alice', 'bob'],
        autoTrigger: true,
        triggerConditions: [{ type: 'code-change', description: 'd', config: {} }],
      },
    ],
    qualityChecks: [
      {
        id: 'qc-1',
        name: 'Spell Check',
        description: 'd',
        type: 'spelling',
        enabled: true,
        severity: 'warning',
        config: {},
        autoFix: true,
      },
    ],
    autoGeneration: [
      {
        id: 'ag-1',
        name: 'From OpenAPI',
        trigger: 'api-change',
        source: 'openapi.yaml',
        templateId: 'tpl-1',
        outputFormat: 'openapi',
        enabled: true,
        config: {},
      },
    ],
    versioning: {
      enabled: true,
      strategy: 'semantic',
      majorVersion: 1,
      minorVersion: 2,
      patchVersion: 3,
      retentionPolicy: { keepMajor: 3, keepMinor: 5, keepAll: false },
      branching: true,
      mergeStrategy: 'auto',
    },
  };
}

describe('technicalDocumentation — passthrough', () => {
  it('normalizes the config into the runtime object', () => {
    const cfg = makeConfig();
    const norm = technicalDocumentation(cfg);
    expect(norm.name).toBe('Test Project');
    expect(norm.providers).toEqual(['aws', 'azure', 'gcp']);
    expect(norm.documentation).toHaveLength(2);
    expect(norm.aiConfig.model).toBe('claude-opus');
    expect(norm.templates).toHaveLength(1);
    expect(norm.workflows).toHaveLength(1);
    expect(norm.qualityChecks).toHaveLength(1);
    expect(norm.autoGeneration).toHaveLength(1);
    expect(norm.versioning.enabled).toBe(true);
  });
});

describe('displayConfig', () => {
  it('prints the project name and section counts', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayConfig(technicalDocumentation(makeConfig()));
      const out = spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n');
      expect(out).toContain('Technical Documentation Generation and Maintenance');
      expect(out).toContain('Project Name:');
      expect(out).toContain('Test Project');
      expect(out).toContain('Documents:');
      expect(out).toContain('2');
      expect(out).toContain('AI Provider:');
      expect(out).toContain('anthropic');
      expect(out).toContain('Model:');
      expect(out).toContain('claude-opus');
      expect(out).toContain('Templates:');
      expect(out).toContain('Workflows:');
      expect(out).toContain('Quality Checks:');
      expect(out).toContain('Auto Generation Rules:');
      expect(out).toContain('Versioning: Yes');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('generateMD', () => {
  const md = generateMD(technicalDocumentation(makeConfig()));

  it('renders the title and feature list', () => {
    expect(md).toContain('# Technical Documentation Generation and Maintenance');
    expect(md).toContain('## Features');
    expect(md).toContain('Document types: API, architecture');
  });

  it('renders the AI capabilities with enable/disable states', () => {
    expect(md).toContain('## AI Capabilities');
    expect(md).toContain('Provider: anthropic');
    expect(md).toContain('Model: claude-opus');
    expect(md).toContain('Content Generation: Enabled');
    expect(md).toContain('Auto Review: Disabled');
    expect(md).toContain('Suggestions: Enabled');
  });

  it('renders workflows with stage/approver counts and auto-trigger', () => {
    expect(md).toContain('### Publish Flow');
    expect(md).toContain('Stages: 2');
    expect(md).toContain('Approvers: 2');
    expect(md).toContain('Auto Trigger: Yes');
  });

  it('renders quality checks and auto-generation rules', () => {
    expect(md).toContain('**Spell Check**: spelling (warning)');
    expect(md).toContain('**From OpenAPI**: api-change → openapi');
  });

  it('renders the versioning strategy and current version', () => {
    expect(md).toContain('Strategy: semantic');
    expect(md).toContain('Current Version: 1.2.3');
    expect(md).toContain('Branching: Enabled');
  });

  it('renders document statistics with status counts', () => {
    expect(md).toContain('Total Documents: 2');
    expect(md).toContain('published: 1');
    expect(md).toContain('draft: 1');
  });

  it('renders per-document AI suggestion dispositions', () => {
    expect(md).toContain('### Getting Started');
    expect(md).toContain('Pending Suggestions: 1');
    expect(md).toContain('Accepted: 1');
    expect(md).toContain('Rejected: 1');
  });

  it('omits versioning detail when versioning is disabled', () => {
    const cfg = makeConfig();
    cfg.versioning.enabled = false;
    const out = generateMD(technicalDocumentation(cfg));
    expect(out).not.toContain('Strategy: semantic');
  });
});

describe('generateTerraform', () => {
  const norm = technicalDocumentation(makeConfig());

  it('aws: declares the aws provider and project_name variable', () => {
    const tf = generateTerraform(norm, 'aws');
    expect(tf).toContain('provider "aws"');
    expect(tf).toContain('variable "project_name"');
    expect(tf).toContain('resource "aws_s3_bucket" "docs_storage"');
    expect(tf).toContain('resource "aws_dynamodb_table" "docs_metadata"');
  });

  it('azure: declares the azurerm provider and resource group', () => {
    const tf = generateTerraform(norm, 'azure');
    expect(tf).toContain('provider "azurerm"');
    expect(tf).toContain('resource "azurerm_resource_group" "docs_rg"');
    expect(tf).toContain('resource "azurerm_storage_account" "docs_storage"');
  });

  it('gcp: declares the google provider and storage bucket', () => {
    const tf = generateTerraform(norm, 'gcp');
    expect(tf).toContain('hashicorp/google');
    expect(tf).toContain('provider "google"');
    expect(tf).toContain('var.gcp_project');
    expect(tf).toContain('resource "google_storage_bucket" "docs_storage"');
  });
});

describe('generateTypeScript', () => {
  const ts = generateTypeScript(technicalDocumentation(makeConfig()));

  it('imports EventEmitter and declares a manager class extending it', () => {
    expect(ts).toContain(`import { EventEmitter } from 'events'`);
    expect(ts).toContain('class TechnicalDocumentationManager extends EventEmitter');
  });

  it('declares the async document/suggestion/quality methods', () => {
    expect(ts).toContain('async createDocument(');
    expect(ts).toContain('async updateDocument(');
    expect(ts).toContain('async generateAISuggestions(');
    expect(ts).toContain('async acceptSuggestion(');
    expect(ts).toContain('async rejectSuggestion(');
    expect(ts).toContain('async runQualityChecks(');
  });
});

describe('generatePython', () => {
  const py = generatePython(technicalDocumentation(makeConfig()));

  it('imports typing/dataclass/datetime/enum', () => {
    expect(py).toContain('from typing import Dict, List, Any, Optional');
    expect(py).toContain('from dataclasses import dataclass, field');
    expect(py).toContain('from datetime import datetime, timedelta');
    expect(py).toContain('from enum import Enum');
  });

  it('declares the manager class and async methods', () => {
    expect(py).toContain('class TechnicalDocumentationManager');
    expect(py).toContain('def __init__(self, project_name');
    expect(py).toContain('async def create_document(');
    expect(py).toContain('async def generate_ai_suggestions(');
    expect(py).toContain('async def run_quality_checks(');
  });
});

describe('writeFiles', () => {
  let out: string;

  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-techdoc-'));
  });

  afterEach(async () => {
    await fs.remove(out);
  });

  it('writes the full TypeScript bundle (tf per provider, manager, md, config, package.json)', async () => {
    await writeFiles(technicalDocumentation(makeConfig()), out, 'typescript');

    expect(await fs.pathExists(path.join(out, 'technical-documentation-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-azure.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-gcp.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'TECHNICAL_DOCUMENTATION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-config.json'))).toBe(true);

    const pkg = await fs.readJson(path.join(out, 'package.json'));
    expect(pkg.name).toBe('test-project');
    expect(pkg.main).toBe('technical-documentation-manager.ts');
    expect(pkg.dependencies).toHaveProperty('eventemitter3');
    expect(pkg.devDependencies).toHaveProperty('typescript');
  });

  it('writes the Python bundle (manager.py + requirements.txt)', async () => {
    await writeFiles(technicalDocumentation(makeConfig()), out, 'python');

    expect(await fs.pathExists(path.join(out, 'technical_documentation_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'TECHNICAL_DOCUMENTATION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-config.json'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'package.json'))).toBe(false);

    const reqs = await fs.readFile(path.join(out, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pydantic>=2.0.0');
    expect(reqs).toContain('python-dateutil>=2.8.0');
  });

  it('serializes the full config into config.json (round-trip)', async () => {
    const cfg = makeConfig();
    await writeFiles(technicalDocumentation(cfg), out, 'typescript');
    const written = await fs.readJson(path.join(out, 'technical-documentation-config.json'));
    expect(written.name).toBe('Test Project');
    expect(written.documentation).toHaveLength(2);
    expect(written.aiConfig.model).toBe('claude-opus');
  });

  it('kebab-cases the package name from spaces', async () => {
    const cfg = makeConfig();
    cfg.projectName = 'My Cool Docs';
    await writeFiles(technicalDocumentation(cfg), out, 'typescript');
    const pkg = await fs.readJson(path.join(out, 'package.json'));
    expect(pkg.name).toBe('my-cool-docs');
  });

  it('writes only the requested providers tf files', async () => {
    const cfg = makeConfig();
    cfg.providers = ['aws'];
    await writeFiles(technicalDocumentation(cfg), out, 'typescript');
    expect(await fs.pathExists(path.join(out, 'technical-documentation-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-azure.tf'))).toBe(false);
    expect(await fs.pathExists(path.join(out, 'technical-documentation-gcp.tf'))).toBe(false);
  });
});
