import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateAWSCloudMD,
  generateTypeScriptAWSCloud,
  generatePythonAWSCloud,
  writeFiles,
} from '../../src/utils/aws-cloud';

const config: any = {
  projectName: 'test-project',
  region: 'us-east-1',
  profile: 'prod',
  eksConfig: {
    clusterName: 'test-cluster',
    version: '1.28',
    roleArn: 'arn:aws:iam::123456789012:role/eks-role',
    vpcId: 'vpc-12345',
    subnetIds: ['subnet-abc', 'subnet-def'],
    endpointPrivateAccess: true,
    endpointPublicAccess: false,
    loggingTypes: ['api', 'audit'],
  },
  ecsConfig: {
    serviceName: 'test-service',
    clusterName: 'test-ecs-cluster',
    taskDefinition: 'test-task:1',
    desiredCount: 2,
    launchType: 'FARGATE',
    capacityProviderStrategy: [],
    enableExecuteCommand: true,
  },
  autoScaling: {
    minCapacity: 2,
    maxCapacity: 10,
    targetCPU: 70,
    targetMemory: 80,
    scaleInCooldown: 300,
    scaleOutCooldown: 60,
  },
  costOptimization: {
    enableSpotInstances: true,
    spotInstancePercentage: 50,
    enableReservedInstances: false,
    enableSavingsPlans: true,
    rightsizingEnabled: true,
    idleInstanceTimeout: 30,
  },
  enableMonitoring: true,
  enableLogging: true,
};

describe('displayConfig', () => {
  it('logs config summary without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayConfig(config)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateAWSCloudMD', () => {
  it('returns a markdown string with the expected headings', () => {
    const md = generateAWSCloudMD(config);
    expect(md).toContain('# AWS ECS/EKS with CDK Templates and Auto-Scaling');
    expect(md).toContain('## Features');
    expect(md).toContain('## Usage');
    expect(md).toContain('await awsCloud.deployEKS()');
  });
});

describe('generateTypeScriptAWSCloud', () => {
  it('generates TypeScript code containing the project name', () => {
    const ts = generateTypeScriptAWSCloud(config);
    expect(ts).toContain('test-project');
    expect(ts).toContain("import * as cdk from 'aws-cdk-lib'");
    expect(ts).toContain('class AWSCloudStack');
    expect(ts).toContain("region: 'us-east-1'");
  });

  it('includes spot instance configuration when enabled', () => {
    const ts = generateTypeScriptAWSCloud(config);
    expect(ts).toContain('defaultCapacitySpot');
  });

  it('includes CloudWatch alarms when monitoring is enabled', () => {
    const ts = generateTypeScriptAWSCloud(config);
    expect(ts).toContain('CloudWatch Alarms');
    expect(ts).toContain('CPUAlarm');
  });
});

describe('generatePythonAWSCloud', () => {
  it('generates Python code containing the project name', () => {
    const py = generatePythonAWSCloud(config);
    expect(py).toContain('test-project');
    expect(py).toContain('from aws_cdk import');
    expect(py).toContain('class AWSCloudStack');
  });

  it('includes auto-scaling configuration', () => {
    const py = generatePythonAWSCloud(config);
    expect(py).toContain('auto_scale_task_count');
    expect(py).toContain('min_capacity=2');
    expect(py).toContain('max_capacity=10');
  });
});

describe('writeFiles', () => {
  it('writes TypeScript files to the output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `aws-cloud-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'aws-cloud-stack.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AWS_CLOUD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'aws-config.json'))).toBe(true);

    const pkgJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkgJson.name).toBe('test-project-aws-cloud');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Python files to the output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `aws-cloud-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'aws_cloud_stack.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AWS_CLOUD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'aws-config.json'))).toBe(true);

    const reqs = fs.readFileSync(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(reqs).toContain('aws-cdk-lib');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
