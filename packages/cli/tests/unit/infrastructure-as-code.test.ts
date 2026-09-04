import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  displayConfig,
  generateIaCMD,
  generateTerraformMain,
  generateTerraformState,
  generatePulumiProgram,
  generateTypeScriptIaCManager,
  generatePythonIaCManager,
  writeFiles,
} from '../../src/utils/infrastructure-as-code';

// The IaCConfig interface is not exported; build full config objects inline.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeConfig(overrides: Record<string, unknown> = {}): any {
  return {
    projectName: 'myapp',
    provider: 'terraform',
    terraform: {
      version: '>= 1.5.0',
      requiredProviders: [
        { name: 'aws', source: 'hashicorp/aws', version: '~> 5.0' },
      ],
      backend: { type: 's3', config: { bucket: 'b', region: 'us-east-1' } },
    },
    stateManagement: {
      enabled: true,
      backend: 's3',
      stateFile: 'terraform.tfstate',
      lockFile: 'locks',
      encryption: true,
      versioning: true,
      remoteStateSharing: false,
    },
    modules: [],
    workspaces: {
      name: 'myapp',
      environments: ['dev', 'staging', 'prod'],
      variablesPerEnvironment: {},
    },
    enableValidation: true,
    enableDriftDetection: true,
    ...overrides,
  };
}

describe('displayConfig', () => {
  it('prints provider, state, module, and feature summary lines', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      displayConfig(makeConfig({ enableValidation: false, enableDriftDetection: false }));
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Infrastructure as Code');
      expect(out).toContain('myapp');
      expect(out).toContain('terraform');
      expect(out).toContain('s3');
      expect(out).toContain('Modules: 0');
      expect(out).toContain('dev, staging, prod');
      expect(out).toContain('Validation: No');
      expect(out).toContain('Drift Detection: No');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('reflects enabled encryption/versioning/validation flags', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      displayConfig(makeConfig());
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('State Encryption: Yes');
      expect(out).toContain('State Versioning: Yes');
      expect(out).toContain('Validation: Yes');
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('generateIaCMD', () => {
  it('produces a markdown doc with features and usage examples', () => {
    const md = generateIaCMD(makeConfig());
    expect(md).toContain('# Infrastructure as Code with Terraform/Pulumi');
    expect(md).toContain('## Features');
    expect(md).toContain('terraform init');
    expect(md).toContain('pulumi up');
    expect(md).toContain('terraform apply tfplan');
  });
});

describe('generateTerraformMain', () => {
  it('embeds project name, version, providers, backend, providers, variables and outputs', () => {
    const code = generateTerraformMain(makeConfig());
    expect(code).toContain('Terraform configuration for myapp');
    expect(code).toContain('required_version = ">= 1.5.0"');
    expect(code).toContain('required_providers');
    expect(code).toContain('hashicorp/aws');
    expect(code).toContain('backend "s3"');
    expect(code).toContain('bucket = "b"');
    expect(code).toContain('provider "aws"');
    expect(code).toContain('provider "google"');
    expect(code).toContain('variable "aws_region"');
    expect(code).toContain('output "infrastructure_id"');
    expect(code).toContain('myapp-${var.environment}');
  });

  it('falls back to a default required_version and omits provider/backend blocks when absent', () => {
    const code = generateTerraformMain(
      makeConfig({ terraform: undefined }),
    );
    expect(code).toContain('required_version = ">= 1.0"');
    expect(code).not.toContain('required_providers');
    expect(code).not.toContain('backend "');
  });
});

describe('generateTerraformState', () => {
  it('emits an S3 backend with encryption + versioning directives', () => {
    const code = generateTerraformState(makeConfig());
    expect(code).toContain('backend "s3"');
    expect(code).toContain('myapp-terraform-state');
    expect(code).toContain('terraform.tfstate');
    expect(code).toContain('encrypt = true');
    expect(code).toContain('Versioning is enabled');
    expect(code).toContain('myapp-locks');
  });

  it('emits an AzureRM backend', () => {
    const code = generateTerraformState(
      makeConfig({
        stateManagement: { ...makeConfig().stateManagement, backend: 'azurerm' },
      }),
    );
    expect(code).toContain('backend "azurerm"');
    expect(code).toContain('resource_group_name = "myapp-rg"');
    expect(code).toContain('storage_account_name = "myappstate"');
  });

  it('emits a GCS backend with an encryption key when encryption is enabled', () => {
    const code = generateTerraformState(
      makeConfig({
        stateManagement: { ...makeConfig().stateManagement, backend: 'gcs' },
      }),
    );
    expect(code).toContain('backend "gcs"');
    expect(code).toContain('encryption_key = var.state_encryption_key');
  });

  it('returns only the header comment for an unsupported backend', () => {
    const code = generateTerraformState(
      makeConfig({
        stateManagement: { ...makeConfig().stateManagement, backend: 'local' },
      }),
    );
    expect(code).toContain('State management configuration for myapp');
    expect(code).not.toContain('backend "');
  });
});

describe('generatePulumiProgram', () => {
  it('generates a Node.js program by default', () => {
    const code = generatePulumiProgram(makeConfig({ provider: 'pulumi', pulumi: { runtime: 'nodejs', backend: { url: 'u' }, config: {} } }));
    expect(code).toContain('Pulumi TypeScript program for myapp');
    expect(code).toContain('import * as pulumi from "@pulumi/pulumi"');
    expect(code).toContain('export const bucketName');
  });

  it('generates a Python program when runtime is python', () => {
    const code = generatePulumiProgram(makeConfig({ provider: 'pulumi', pulumi: { runtime: 'python', backend: { url: 'u' }, config: {} } }));
    expect(code).toContain('Pulumi Python program for myapp');
    expect(code).toContain('import pulumi_aws as aws');
    expect(code).toContain('pulumi.export("bucketName"');
  });

  it('returns an empty string for an unsupported runtime', () => {
    const code = generatePulumiProgram(makeConfig({ provider: 'pulumi', pulumi: { runtime: 'go', backend: { url: 'u' }, config: {} } }));
    expect(code).toBe('');
  });
});

describe('generateTypeScriptIaCManager', () => {
  it('produces an EventEmitter-based manager with conditional validation/drift methods', () => {
    const code = generateTypeScriptIaCManager(makeConfig());
    expect(code).toContain('IaCManager extends EventEmitter');
    expect(code).toContain('import { execSync }');
    expect(code).toContain('Generated at:');
    expect(code).toContain('async validate()');
    expect(code).toContain('terraform validate');
    expect(code).toContain('async detectDrift()');
    expect(code).toContain('terraform plan -detailed-exitcode');
    expect(code).toContain("this.provider === 'terraform' ? 'terraform apply tfplan'");
    expect(code).toContain('export default iaCManager');
  });

  it('omits validate/detectDrift when the flags are disabled', () => {
    const code = generateTypeScriptIaCManager(
      makeConfig({ enableValidation: false, enableDriftDetection: false }),
    );
    expect(code).not.toContain('async validate()');
    expect(code).not.toContain('async detectDrift()');
    // Core lifecycle methods are still present.
    expect(code).toContain('async init()');
    expect(code).toContain('async apply()');
  });

  it('uses Pulumi commands when the provider is pulumi', () => {
    const code = generateTypeScriptIaCManager(makeConfig({ provider: 'pulumi' }));
    expect(code).toContain("'pulumi stack init'");
    expect(code).toContain("'pulumi preview'");
  });
});

describe('generatePythonIaCManager', () => {
  it('produces a subprocess-based manager with conditional methods', () => {
    const code = generatePythonIaCManager(makeConfig());
    expect(code).toContain('class IaCManager:');
    expect(code).toContain('import subprocess');
    expect(code).toContain('def validate(self)');
    expect(code).toContain('def detect_drift(self)');
    expect(code).toContain('ia_c_manager = IaCManager()');
  });

  it('omits validate/detect_drift when flags are disabled', () => {
    const code = generatePythonIaCManager(
      makeConfig({ enableValidation: false, enableDriftDetection: false }),
    );
    expect(code).not.toContain('def validate(self)');
    expect(code).not.toContain('def detect_drift(self)');
    expect(code).toContain('def init(self)');
  });
});

describe('writeFiles', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-iac-'));
  });
  afterEach(() => {
    fs.removeSync(dir);
  });

  it('writes Terraform + TypeScript manager + package.json + docs + config for TS', async () => {
    await writeFiles(makeConfig(), dir, 'typescript');
    expect(await fs.pathExists(path.join(dir, 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'state.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'iac-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'IAC.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'iac-config.json'))).toBe(true);
    const pkg = await fs.readJson(path.join(dir, 'package.json'));
    expect(pkg.name).toBe('myapp-iac');
    expect(pkg.scripts.apply).toBe('terraform apply tfplan');
    const cfg = await fs.readJson(path.join(dir, 'iac-config.json'));
    expect(cfg.projectName).toBe('myapp');
    expect(cfg.provider).toBe('terraform');
  });

  it('writes a Python manager + requirements.txt when language is python', async () => {
    await writeFiles(makeConfig(), dir, 'python');
    expect(await fs.pathExists(path.join(dir, 'iac_manager.py'))).toBe(true);
    const reqs = await fs.readFile(path.join(dir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pulumi>=3.100.0');
    expect(reqs).toContain('pulumi-aws>=6.0.0');
  });

  it('writes a Pulumi program with the python extension when the provider is pulumi + python runtime', async () => {
    await writeFiles(
      makeConfig({
        provider: 'pulumi',
        pulumi: { runtime: 'python', backend: { url: 'u' }, config: {} },
      }),
      dir,
      'typescript',
    );
    expect(await fs.pathExists(path.join(dir, 'PulumiProgram.py'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'PulumiProgram.ts'))).toBe(false);
  });

  it('creates the output directory when it does not exist', async () => {
    const nested = path.join(dir, 'nested', 'out');
    await writeFiles(makeConfig(), nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, 'main.tf'))).toBe(true);
  });
});
