import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateRBACMarkdown,
  generateRBACTerraformAWS,
  generateRBACTerraformAzure,
  generateRBACTypeScriptManager,
  generateRBACPythonManager,
  generateRBACPackageJSON,
  generateRBACConfigJSON,
  displayRBACConfig,
  writeRBACFiles,
} from '../../src/utils/rbac-manager';

const baseRole = {
  id: 'role-1',
  name: 'admin',
  description: 'Administrator role',
  status: 'active' as const,
  isSystemRole: true,
  isCustomizable: true,
  priority: 10,
  permissions: ['perm-1'],
  scopedPermissions: [],
  conditions: [],
  metadata: {
    category: 'admin',
    riskLevel: 'critical' as const,
    complianceReferences: [],
    approvalRequired: true,
    approvers: [],
    reviewInterval: 90,
    lastReviewed: new Date('2024-01-01'),
    nextReviewDate: new Date('2024-04-01'),
    version: '1.0.0',
    changeHistory: [],
    documentation: 'doc',
    rationale: 'why',
  },
  tags: ['core'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const basePermission = {
  id: 'perm-1',
  name: 'manage-users',
  description: 'Manage users',
  resource: 'users' as const,
  actions: ['create', 'read', 'update', 'delete'] as any[],
  effect: 'allow' as const,
  isSystemPermission: true,
  constraints: [],
  status: 'granted' as const,
  metadata: {
    category: 'admin',
    sensitivity: 'restricted' as const,
    complianceRequirements: [],
    riskScore: 80,
    requiresApproval: true,
    approvers: [],
  },
  createdAt: new Date('2024-01-01'),
};

const basePolicy = {
  id: 'pol-1',
  name: 'default-deny',
  description: 'Default deny policy',
  status: 'active' as const,
  priority: 1,
  statements: [],
  version: '1.0.0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  effectiveFrom: new Date('2024-01-01'),
  metadata: {
    description: 'desc',
    owner: 'security',
    tags: [],
    complianceReferences: [],
    riskLevel: 'medium' as const,
    changeHistory: [],
  },
};

const baseAssignment = {
  id: 'asgn-1',
  userId: 'user-1',
  roleId: 'role-1',
  status: 'active' as const,
  assignedBy: 'user-2',
  assignedAt: new Date('2024-01-01'),
  isTemporary: false,
  requiresApproval: false,
};

const baseGroup = {
  id: 'grp-1',
  name: 'Engineering',
  description: 'Engineering team',
  type: 'team' as const,
  status: 'active' as const,
  members: ['user-1'],
  roles: ['role-1'],
  owners: ['user-2'],
  metadata: {
    category: 'team',
    externalSync: false,
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const baseResourceNode = {
  id: 'node-1',
  name: 'root',
  type: 'organization',
  path: '/root',
  permissions: [],
  children: [],
  metadata: {
    owner: 'admin',
    classification: 'internal' as const,
    tags: [],
    complianceRequirements: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

const baseAuditLog = {
  id: 'log-1',
  timestamp: new Date('2024-01-01'),
  userId: 'user-1',
  action: 'read',
  resource: '/users',
  resourceType: 'users',
  outcome: 'allowed' as const,
};

const config: any = {
  projectName: 'rbac-app',
  providers: ['aws', 'azure', 'gcp'],
  settings: {
    enableFineGrained: true,
    defaultDenyAll: true,
    requireMFAForAdmin: true,
    enableSessionTimeout: true,
    sessionTimeoutMinutes: 60,
    enablePermissionCaching: true,
    cacheTTLMinutes: 15,
    enableAuditLogging: true,
    logRetentionDays: 365,
    enableDynamicPermissions: false,
    enableRoleHierarchy: true,
    maxRoleDepth: 5,
    enableTemporaryAccess: true,
    temporaryAccessMaxHours: 24,
  },
  roles: [baseRole],
  permissions: [basePermission],
  policies: [basePolicy],
  assignments: [baseAssignment],
  groups: [baseGroup],
  resourceHierarchy: [baseResourceNode],
  auditLogs: [baseAuditLog],
};

describe('generateRBACMarkdown', () => {
  it('renders markdown with project, settings, and entity counts', () => {
    const md = generateRBACMarkdown(config);
    expect(md).toContain('# RBAC and Access Control Management');
    expect(md).toContain('rbac-app');
    expect(md).toContain('aws, azure, gcp');
    expect(md).toContain('Default Deny All');
    expect(md).toContain('admin - ACTIVE');
    expect(md).toContain('manage-users');
    expect(md).toContain('Engineering');
  });
});

describe('generateRBACTerraformAWS', () => {
  it('generates AWS Terraform with project name', () => {
    const tf = generateRBACTerraformAWS(config);
    expect(tf).toContain('AWS');
    expect(tf).toContain('Terraform');
    expect(tf).toContain('rbac-app');
  });
});

describe('generateRBACTerraformAzure', () => {
  it('generates Azure Terraform with project name', () => {
    const tf = generateRBACTerraformAzure(config);
    expect(tf).toContain('Azure');
    expect(tf).toContain('rbac-app');
  });
});

describe('generateRBACTypeScriptManager', () => {
  it('generates a TypeScript manager with enums and class', () => {
    const code = generateRBACTypeScriptManager(config);
    expect(code).toContain('Auto-generated RBAC Manager');
    expect(code).toContain('PermissionAction');
    expect(code).toContain('import');
  });
});

describe('generateRBACPythonManager', () => {
  it('generates a Python manager with classes', () => {
    const code = generateRBACPythonManager(config);
    expect(code).toContain('Auto-generated RBAC Manager');
    expect(code).toContain('class');
  });
});

describe('generateRBACPackageJSON', () => {
  it('returns valid JSON for typescript language', () => {
    const out = generateRBACPackageJSON('typescript');
    const parsed = JSON.parse(out);
    expect(parsed.name).toBe('rbac-manager');
    expect(parsed.dependencies).toHaveProperty('uuid');
    expect(parsed.devDependencies).toHaveProperty('typescript');
  });

  it('returns requirements text for python language', () => {
    const out = generateRBACPackageJSON('python');
    expect(out).toContain('pydantic');
    expect(out).toContain('pytest');
    // Not valid JSON — it's a pip requirements file
    expect(() => JSON.parse(out)).toThrow();
  });
});

describe('generateRBACConfigJSON', () => {
  it('serializes config including Date objects as ISO strings', () => {
    const json = generateRBACConfigJSON(config);
    const parsed = JSON.parse(json);
    expect(parsed.projectName).toBe('rbac-app');
    // Dates should be serialized as ISO strings, not raw Date objects
    expect(typeof parsed.roles[0].createdAt).toBe('string');
  });
});

describe('displayRBACConfig', () => {
  it('logs summary of the RBAC configuration', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayRBACConfig(config);
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('rbac-app');
    expect(out).toContain('aws');
    expect(out).toContain('Yes');
    spy.mockRestore();
  });
});

describe('writeRBACFiles', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbac-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes Markdown, Terraform (per provider), TypeScript manager, package.json, and config', async () => {
    await writeRBACFiles(config, tmpDir, 'typescript');

    expect(await fs.pathExists(path.join(tmpDir, 'RBAC.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-azure.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-gcp.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-config.json'))).toBe(true);

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('rbac-manager');
  });

  it('writes Python manager and requirements.txt', async () => {
    await writeRBACFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'rbac_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    const reqs = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pydantic');
  });

  it('only writes Terraform for the providers in config', async () => {
    const single: any = { ...config, providers: ['aws'] };
    await writeRBACFiles(single, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-azure.tf'))).toBe(false);
    expect(await fs.pathExists(path.join(tmpDir, 'rbac-gcp.tf'))).toBe(false);
  });
});
