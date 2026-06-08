// Auto-generated AWS ECS/EKS CDK Utility
// Generated at: 2026-01-13T10:26:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface EKSClusterConfig {
  clusterName: string;
  version: string;
  roleArn: string;
  vpcId: string;
  subnetIds: string[];
  endpointPrivateAccess: boolean;
  endpointPublicAccess: boolean;
  loggingTypes: string[];
}

interface ECSServiceConfig {
  serviceName: string;
  clusterName: string;
  taskDefinition: string;
  desiredCount: number;
  launchType: 'FARGATE' | 'EC2';
  capacityProviderStrategy: any[];
  enableExecuteCommand: boolean;
}

interface AutoScalingConfig {
  minCapacity: number;
  maxCapacity: number;
  targetCPU: number;
  targetMemory: number;
  scaleInCooldown: number;
  scaleOutCooldown: number;
}

interface CostOptimizationConfig {
  enableSpotInstances: boolean;
  spotInstancePercentage: number;
  enableReservedInstances: boolean;
  enableSavingsPlans: boolean;
  rightsizingEnabled: boolean;
  idleInstanceTimeout: number;
}

interface AWSCloudConfig {
  projectName: string;
  region: string;
  profile?: string;
  eksConfig: EKSClusterConfig;
  ecsConfig: ECSServiceConfig;
  autoScaling: AutoScalingConfig;
  costOptimization: CostOptimizationConfig;
  enableMonitoring: boolean;
  enableLogging: boolean;
}

export function displayConfig(config: AWSCloudConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ AWS ECS/EKS with CDK Templates and Auto-Scaling');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Region:', config.region);
  console.log('\x1b[33m%s\x1b[0m', 'Profile:', config.profile || 'default');
  console.log('\x1b[33m%s\x1b[0m', 'EKS Cluster:', config.eksConfig.clusterName);
  console.log('\x1b[33m%s\x1b[0m', 'EKS Version:', config.eksConfig.version);
  console.log('\x1b[33m%s\x1b[0m', 'ECS Service:', config.ecsConfig.serviceName);
  console.log('\x1b[33m%s\x1b[0m', 'Launch Type:', config.ecsConfig.launchType);
  console.log('\x1b[33m%s\x1b[0m', 'Min Capacity:', config.autoScaling.minCapacity);
  console.log('\x1b[33m%s\x1b[0m', 'Max Capacity:', config.autoScaling.maxCapacity);
  console.log('\x1b[33m%s\x1b[0m', 'Target CPU:', config.autoScaling.targetCPU + '%');
  console.log('\x1b[33m%s\x1b[0m', 'Spot Instances:', config.costOptimization.enableSpotInstances ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateAWSCloudMD(config: AWSCloudConfig): string {
  let md = '# AWS ECS/EKS with CDK Templates and Auto-Scaling\n\n';
  md += '## Features\n\n';
  md += '- AWS EKS (Elastic Kubernetes Service) cluster provisioning\n';
  md += '- AWS ECS (Elastic Container Service) with Fargate\n';
  md += '- CDK (Cloud Development Kit) templates for infrastructure as code\n';
  md += '- Auto-scaling with target tracking policies\n';
  md += '- Cost optimization with Spot instances and Savings Plans\n';
  md += '- Reserved instance management\n';
  md += '- Rightsizing recommendations\n';
  md += '- CloudWatch monitoring and alarms\n';
  md += '- AWS X-Ray tracing\n';
  md += '- IAM security policies\n';
  md += '- VPC and subnet configuration\n';
  md += '- Load balancer integration\n';
  md += '- ECR (Elastic Container Registry) integration\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import awsCloud from \'./aws-cloud\';\n\n';
  md += '// Deploy EKS cluster\n';
  md += 'await awsCloud.deployEKS();\n\n';
  md += '// Deploy ECS service\n';
  md += 'await awsCloud.deployECS();\n\n';
  md += '// Configure auto-scaling\n';
  md += 'await awsCloud.configureAutoScaling();\n\n';
  md += '// Enable cost optimization\n';
  md += 'await awsCloud.optimizeCosts();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptAWSCloud(config: AWSCloudConfig): string {
  let code = '// Auto-generated AWS Cloud Infrastructure for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import * as cdk from \'aws-cdk-lib\';\n';
  code += 'import * as eks from \'aws-cdk-lib/aws-eks\';\n';
  code += 'import * as ecs from \'aws-cdk-lib/aws-ecs\';\n';
  code += 'import * as autoscaling from \'aws-cdk-lib/aws-applicationautoscaling\';\n';
  code += 'import * as ec2 from \'aws-cdk-lib/aws-ec2\';\n';
  code += 'import * as iam from \'aws-cdk-lib/aws-iam\';\n';
  code += 'import * as elbv2 from \'aws-cdk-lib/aws-elasticloadbalancingv2\';\n';
  code += 'import * as cloudwatch from \'aws-cdk-lib/aws-cloudwatch\';\n';
  code += 'import { Construct } from \'constructs\';\n\n';

  code += 'export class AWSCloudStack extends cdk.Stack {\n';
  code += '  constructor(scope: Construct, id: string, props?: cdk.StackProps) {\n';
  code += '    super(scope, id, props);\n\n';
  code += '    // VPC\n';
  code += '    const vpc = new ec2.Vpc(this, \'' + config.projectName + 'Vpc\', {\n';
  code += '      maxAzs: 3,\n';
  code += '      natGateways: 2,\n';
  code += '      subnetConfiguration: [\n';
  code += '        {\n';
  code += '          cidrMask: 24,\n';
  code += '          name: \'public\',\n';
  code += '          subnetType: ec2.SubnetType.PUBLIC,\n';
  code += '        },\n';
  code += '        {\n';
  code += '          cidrMask: 24,\n';
  code += '          name: \'private\',\n';
  code += '          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,\n';
  code += '        },\n';
  code += '      ],\n';
  code += '    });\n\n';

  // EKS Cluster
  code += '    // EKS Cluster\n';
  code += '    const eksCluster = new eks.Cluster(this, \'' + config.projectName + 'EKSCluster\', {\n';
  code += '      version: eks.KubernetesVersion.' + config.eksConfig.version.replace(/\./g, '_') + ',\n';
  code += '      vpc,\n';
  code += '      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],\n';
  code += '      endpointAccess: eks.EndpointAccess.' + (config.eksConfig.endpointPrivateAccess && config.eksConfig.endpointPublicAccess ? 'PUBLIC_AND_PRIVATE' : config.eksConfig.endpointPrivateAccess ? 'PRIVATE' : 'PUBLIC') + ',\n';
  code += '      defaultCapacity: ' + (config.costOptimization.enableSpotInstances ? '10' : '0') + ',\n';
  code += '      defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.' + (config.costOptimization.enableSpotInstances ? 'T3' : 'M5') + ', ec2.InstanceSize.' + (config.costOptimization.enableSpotInstances ? 'MICRO' : 'LARGE') + '),\n';
  if (config.costOptimization.enableSpotInstances) {
    code += '      defaultCapacityMachineImageType: eks.MachineImageType.AMAZON_LINUX_2,\n';
    code += '      defaultCapacitySpot: true,\n';
    code += '      defaultCapacitySpotPrice: ec2.SpotInstancePrice.MAX_PRICE,\n';
  }
  code += '      albController: true,\n';
  code += '    });\n\n';

  code += '    // EKS Auto-Scaling\n';
  code += '    const autoscalingGroup = eksCluster.nodegroups?.[0]?.autoScalingGroup;\n';
  code += '    if (autoscalingGroup) {\n';
  code += '      autoscalingGroup.scaleOnCpuUtilization(\'' + config.projectName + 'CPUScaling\', {\n';
  code += '        targetUtilizationPercent: ' + config.autoScaling.targetCPU + ',\n';
  code += '        scaleInCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleInCooldown + '),\n';
  code += '        scaleOutCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleOutCooldown + '),\n';
  code += '      });\n';
  code += '    }\n\n';

  // ECS Cluster
  code += '    // ECS Cluster\n';
  code += '    const ecsCluster = new ecs.Cluster(this, \'' + config.projectName + 'ECSCluster\', {\n';
  code += '      vpc,\n';
  code += '      containerInsights: true,\n';
  code += '    });\n\n';

  // ECS Task Definition
  code += '    // Task Definition\n';
  code += '    const taskDefinition = new ecs.FargateTaskDefinition(this, \'' + config.projectName + 'TaskDef\', {\n';
  code += '      memoryLimitMiB: 512,\n';
  code += '      cpu: 256,\n';
  code += '    });\n\n';

  code += '    const container = taskDefinition.addContainer(\'' + config.projectName + 'Container\', {\n';
  code += '      image: ecs.ContainerImage.fromRegistry(\'nginx:latest\'),\n';
  code += '      memoryLimitMiB: 512,\n';
  code += '      cpu: 256,\n';
  code += '      logging: ecs.LogDrivers.awsLogs({ streamPrefix: \'' + config.projectName + '\' }),\n';
  code += '    });\n\n';

  code += '    container.addPortMappings({\n';
  code += '      containerPort: 80,\n';
  code += '      protocol: ecs.Protocol.TCP,\n';
  code += '    });\n\n';

  // ECS Service with Auto-Scaling
  code += '    // Fargate Service\n';
  code += '    const fargateService = new ecs.FargateService(this, \'' + config.projectName + 'FargateService\', {\n';
  code += '      cluster: ecsCluster,\n';
  code += '      taskDefinition,\n';
  code += '      desiredCount: ' + config.autoScaling.minCapacity + ',\n';
  code += '      assignPublicIp: true,\n';
  code += '      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },\n';
  code += '    });\n\n';

  // Load Balancer
  code += '    // Load Balancer\n';
  code += '    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, \'' + config.projectName + 'ALB\', {\n';
  code += '      vpc,\n';
  code += '      internetFacing: true,\n';
  code += '    });\n\n';

  code += '    const listener = loadBalancer.addListener(\'' + config.projectName + 'Listener\', {\n';
  code += '      port: 80,\n';
  code += '      open: true,\n';
  code += '    });\n\n';

  code += '    listener.addTargets(\'' + config.projectName + 'TargetGroup\', {\n';
  code += '      port: 80,\n';
  code += '      targets: [fargateService],\n';
  code += '      healthCheck: {\n';
  code += '        path: \'/\',\n';
  code += '        interval: cdk.Duration.seconds(30),\n';
  code += '      },\n';
  code += '    });\n\n';

  // ECS Auto-Scaling
  code += '    // ECS Auto-Scaling\n';
  code += '    const scaling = fargateService.autoScaleTaskCount({\n';
  code += '      minCapacity: ' + config.autoScaling.minCapacity + ',\n';
  code += '      maxCapacity: ' + config.autoScaling.maxCapacity + ',\n';
  code += '    });\n\n';

  code += '    scaling.scaleOnCpuUtilization(\'' + config.projectName + 'CPUScaling\', {\n';
  code += '      targetUtilizationPercent: ' + config.autoScaling.targetCPU + ',\n';
  code += '      scaleInCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleInCooldown + '),\n';
  code += '      scaleOutCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleOutCooldown + '),\n';
  code += '    });\n\n';

  code += '    scaling.scaleOnMemoryUtilization(\'' + config.projectName + 'MemoryScaling\', {\n';
  code += '      targetUtilizationPercent: ' + config.autoScaling.targetMemory + ',\n';
  code += '      scaleInCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleInCooldown + '),\n';
  code += '      scaleOutCooldown: cdk.Duration.seconds(' + config.autoScaling.scaleOutCooldown + '),\n';
  code += '    });\n\n';

  // CloudWatch Alarms
  if (config.enableMonitoring) {
    code += '    // CloudWatch Alarms\n';
    code += '    const cpuAlarm = new cloudwatch.Alarm(this, \'' + config.projectName + 'CPUAlarm\', {\n';
    code += '      metric: fargateService.metricCpuUtilization(),\n';
    code += '      threshold: 80,\n';
    code += '      evaluationPeriods: 2,\n';
    code += '    });\n\n';

    code += '    const memoryAlarm = new cloudwatch.Alarm(this, \'' + config.projectName + 'MemoryAlarm\', {\n';
    code += '      metric: fargateService.metricMemoryUtilization(),\n';
    code += '      threshold: 80,\n';
    code += '      evaluationPeriods: 2,\n';
    code += '    });\n\n';
  }

  code += '    // Outputs\n';
  code += '    new cdk.CfnOutput(this, \'ClusterName\', {\n';
  code += '      value: eksCluster.clusterName,\n';
  code += '    });\n\n';

  code += '    new cdk.CfnOutput(this, \'ECSServiceName\', {\n';
  code += '      value: fargateService.serviceName,\n';
  code += '    });\n\n';

  code += '    new cdk.CfnOutput(this, \'LoadBalancerDNS\', {\n';
  code += '      value: loadBalancer.loadBalancerDnsName,\n';
  code += '    });\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const app = new cdk.App();\n';
  code += 'new AWSCloudStack(app, \'' + config.projectName + 'Stack\', {\n';
  code += '  env: {\n';
  code += '    region: \'' + config.region + '\',\n';
  code += '    account: process.env.CDK_DEFAULT_ACCOUNT,\n';
  code += '  },\n';
  code += '});\n';

  return code;
}

export function generatePythonAWSCloud(config: AWSCloudConfig): string {
  let code = '# Auto-generated AWS Cloud Infrastructure for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'from aws_cdk import (\n';
  code += '    Stack,\n';
  code += '    aws_ec2 as ec2,\n';
  code += '    aws_eks as eks,\n';
  code += '    aws_ecs as ecs,\n';
  code += '    aws_elasticloadbalancingv2 as elbv2,\n';
  code += '    aws_cloudwatch as cloudwatch,\n';
  code += '    CfnOutput,\n';
  code += '    Duration,\n';
  code += '    RemovalPolicy,\n';
  code += ')\n';
  code += 'from constructs import Construct\n\n';

  code += 'class AWSCloudStack(Stack):\n';
  code += '    def __init__(self, scope: Construct, id: str, **kwargs):\n';
  code += '        super().__init__(scope, id, **kwargs)\n\n';
  code += '        # VPC\n';
  code += '        vpc = ec2.Vpc(self, "' + config.projectName + 'Vpc",\n';
  code += '            max_azs=3,\n';
  code += '            nat_gateways=2,\n';
  code += '            subnet_configuration=[\n';
  code += '                ec2.SubnetConfiguration(\n';
  code += '                    cidr_mask=24,\n';
  code += '                    name="public",\n';
  code += '                    subnet_type=ec2.SubnetType.PUBLIC,\n';
  code += '                ),\n';
  code += '                ec2.SubnetConfiguration(\n';
  code += '                    cidr_mask=24,\n';
  code += '                    name="private",\n';
  code += '                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,\n';
  code += '                ),\n';
  code += '            ],\n';
  code += '        )\n\n';

  code += '        # EKS Cluster\n';
  code += '        eks_cluster = eks.Cluster(self, "' + config.projectName + 'EKSCluster",\n';
  code += '            version=eks.KubernetesVersion.V1_' + config.eksConfig.version.replace(/\./g, '_') + ',\n';
  code += '            vpc=vpc,\n';
  code += '            vpc_subnets=[{"subnet_type": ec2.SubnetType.PRIVATE_WITH_EGRESS}],\n';
  code += '            alb_controller=True,\n';
  code += '        )\n\n';

  code += '        # ECS Cluster\n';
  code += '        ecs_cluster = ecs.Cluster(self, "' + config.projectName + 'ECSCluster",\n';
  code += '            vpc=vpc,\n';
  code += '            container_insights=True,\n';
  code += '        )\n\n';

  code += '        # Task Definition\n';
  code += '        task_definition = ecs.FargateTaskDefinition(self, "' + config.projectName + 'TaskDef",\n';
  code += '            memory_limit_mib=512,\n';
  code += '            cpu=256,\n';
  code += '        )\n\n';

  code += '        container = task_definition.add_container("' + config.projectName + 'Container",\n';
  code += '            image=ecs.ContainerImage.from_registry("nginx:latest"),\n';
  code += '            memory_limit_mib=512,\n';
  code += '            cpu=256,\n';
  code += '            logging=ecs.LogDrivers.aws_logs(stream_prefix="' + config.projectName + '"),\n';
  code += '        )\n\n';

  code += '        container.add_port_mappings(\n';
  code += '            container_port=80,\n';
  code += '            protocol=ecs.Protocol.TCP,\n';
  code += '        )\n\n';

  code += '        # Fargate Service\n';
  code += '        fargate_service = ecs.FargateService(self, "' + config.projectName + 'FargateService",\n';
  code += '            cluster=ecs_cluster,\n';
  code += '            task_definition=task_definition,\n';
  code += '            desired_count=' + config.autoScaling.minCapacity + ',\n';
  code += '            assign_public_ip=True,\n';
  code += '            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),\n';
  code += '        )\n\n';

  code += '        # Load Balancer\n';
  code += '        load_balancer = elbv2.ApplicationLoadBalancer(self, "' + config.projectName + 'ALB",\n';
  code += '            vpc=vpc,\n';
  code += '            internet_facing=True,\n';
  code += '        )\n\n';

  code += '        listener = load_balancer.add_listener("' + config.projectName + 'Listener",\n';
  code += '            port=80,\n';
  code += '            open=True,\n';
  code += '        )\n\n';

  code += '        listener.add_targets("' + config.projectName + 'TargetGroup",\n';
  code += '            port=80,\n';
  code += '            targets=[fargate_service],\n';
  code += '            health_check={\n';
  code += '                "path": "/",\n';
  code += '                "interval": Duration.seconds(30),\n';
  code += '            },\n';
  code += '        )\n\n';

  code += '        # Auto-Scaling\n';
  code += '        scaling = fargate_service.auto_scale_task_count(\n';
  code += '            min_capacity=' + config.autoScaling.minCapacity + ',\n';
  code += '            max_capacity=' + config.autoScaling.maxCapacity + ',\n';
  code += '        )\n\n';

  code += '        scaling.scale_on_cpu_utilization("' + config.projectName + 'CPUScaling",\n';
  code += '            target_utilization_percent=' + config.autoScaling.targetCPU + ',\n';
  code += '            scale_in_cooldown=Duration.seconds(' + config.autoScaling.scaleInCooldown + '),\n';
  code += '            scale_out_cooldown=Duration.seconds(' + config.autoScaling.scaleOutCooldown + '),\n';
  code += '        )\n\n';

  code += '        scaling.scale_on_memory_utilization("' + config.projectName + 'MemoryScaling",\n';
  code += '            target_utilization_percent=' + config.autoScaling.targetMemory + ',\n';
  code += '            scale_in_cooldown=Duration.seconds(' + config.autoScaling.scaleInCooldown + '),\n';
  code += '            scale_out_cooldown=Duration.seconds(' + config.autoScaling.scaleOutCooldown + '),\n';
  code += '        )\n\n';

  code += '        # Outputs\n';
  code += '        CfnOutput(self, "ClusterName", value=eks_cluster.cluster_name)\n';
  code += '        CfnOutput(self, "ServiceName", value=fargate_service.service_name)\n';
  code += '        CfnOutput(self, "LoadBalancerDNS", value=load_balancer.load_balancer_dns_name)\n';

  return code;
}

export async function writeFiles(config: AWSCloudConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptAWSCloud(config);
    await fs.writeFile(path.join(outputDir, 'aws-cloud-stack.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-aws-cloud',
      version: '1.0.0',
      description: 'AWS ECS/EKS with CDK Templates and Auto-Scaling',
      main: 'aws-cloud-stack.ts',
      scripts: {
        deploy: 'cdk deploy',
        diff: 'cdk diff',
        destroy: 'cdk destroy',
        synthesize: 'cdk synth',
      },
      dependencies: {
        'aws-cdk-lib': '^2.100.0',
        'constructs': '^10.0.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'aws-cdk': '^2.100.0',
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonAWSCloud(config);
    await fs.writeFile(path.join(outputDir, 'aws_cloud_stack.py'), pyCode);

    const requirements = [
      'aws-cdk-lib>=2.100.0',
      'constructs>=10.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateAWSCloudMD(config);
  await fs.writeFile(path.join(outputDir, 'AWS_CLOUD.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    region: config.region,
    profile: config.profile,
    eksConfig: config.eksConfig,
    ecsConfig: config.ecsConfig,
    autoScaling: config.autoScaling,
    costOptimization: config.costOptimization,
    enableMonitoring: config.enableMonitoring,
    enableLogging: config.enableLogging,
  };
  await fs.writeFile(path.join(outputDir, 'aws-config.json'), JSON.stringify(configJson, null, 2));
}
