import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab workload-balancing` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerWorkloadBalancing(collab: Command): void {
  collab
  .command('workload-balancing')
  .description('Generate workload balancing and resource allocation with AI optimization')
  .argument('<name>', 'Name of the workload balancing setup')
  .option('--strategy <strategy>', 'Allocation strategy (round-robin, load-based, skill-based, ai-optimized, manual)', 'skill-based')
  .option('--optimization-goal <goal>', 'Optimization goal (speed, quality, cost, balanced)', 'balanced')
  .option('--enable-ai', 'Enable AI-powered optimization')
  .option('--ai-provider <provider>', 'AI provider (openai, anthropic, cohere, local)', 'openai')
  .option('--ai-model <model>', 'AI model name', 'gpt-4')
  .option('--max-tokens <tokens>', 'Max tokens for AI model', '2000')
  .option('--temperature <temp>', 'AI model temperature', '0.7')
  .option('--max-workload-threshold <threshold>', 'Max workload threshold percentage', '100')
  .option('--min-utilization-threshold <threshold>', 'Min utilization threshold percentage', '50')
  .option('--rebalance-interval <hours>', 'Rebalance interval in hours', '24')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './workload-balancing-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { workloadBalancing, writeFiles, displayConfig } = await import('../../utils/workload-balancing.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    // If no providers specified, enable all by default
    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const aiModel = options.enableAi ? {
      provider: options.aiProvider as 'openai' | 'anthropic' | 'cohere' | 'local',
      model: options.aiModel,
      maxTokens: parseInt(options.maxTokens),
      temperature: parseFloat(options.temperature),
    } : undefined;

    const config = {
      projectName: name,
      providers,
      resources: [
        {
          id: 'dev1',
          name: 'Alice Johnson',
          type: 'developer' as const,
          skills: ['TypeScript', 'React', 'Node.js', 'Python'],
          availability: 100,
          currentWorkload: 35,
          maxCapacity: 40,
          hourlyRate: 85,
          timezone: 'America/New_York',
          efficiency: 92,
        },
        {
          id: 'dev2',
          name: 'Bob Smith',
          type: 'developer' as const,
          skills: ['Java', 'Spring', 'Kubernetes', 'Go'],
          availability: 90,
          currentWorkload: 28,
          maxCapacity: 40,
          hourlyRate: 90,
          timezone: 'America/Los_Angeles',
          efficiency: 88,
        },
        {
          id: 'qa1',
          name: 'Carol Davis',
          type: 'qa' as const,
          skills: ['Selenium', 'Cypress', 'Jest', 'API Testing'],
          availability: 100,
          currentWorkload: 20,
          maxCapacity: 40,
          hourlyRate: 75,
          timezone: 'Europe/London',
          efficiency: 95,
        },
        {
          id: 'devops1',
          name: 'David Lee',
          type: 'devops' as const,
          skills: ['Docker', 'Terraform', 'AWS', 'CI/CD'],
          availability: 80,
          currentWorkload: 32,
          maxCapacity: 40,
          hourlyRate: 95,
          timezone: 'Asia/Tokyo',
          efficiency: 90,
        },
      ],
      tasks: [
        {
          id: 'task1',
          title: 'Implement user authentication',
          description: 'Add OAuth2 authentication with social providers',
          priority: 'high' as const,
          status: 'pending' as const,
          estimatedHours: 16,
          requiredSkills: ['TypeScript', 'Node.js', 'React'],
          dependencies: [],
          tags: ['frontend', 'backend', 'security'],
        },
        {
          id: 'task2',
          title: 'Set up CI/CD pipeline',
          description: 'Configure automated testing and deployment',
          priority: 'high' as const,
          status: 'pending' as const,
          estimatedHours: 12,
          requiredSkills: ['Docker', 'CI/CD', 'Terraform'],
          dependencies: [],
          tags: ['devops', 'infrastructure'],
        },
        {
          id: 'task3',
          title: 'Write API integration tests',
          description: 'Create comprehensive test suite for REST APIs',
          priority: 'medium' as const,
          status: 'pending' as const,
          estimatedHours: 20,
          requiredSkills: ['Selenium', 'API Testing', 'Python'],
          dependencies: [],
          tags: ['testing', 'backend'],
        },
        {
          id: 'task4',
          title: 'Migrate to Kubernetes',
          description: 'Deploy application to Kubernetes cluster',
          priority: 'medium' as const,
          status: 'pending' as const,
          estimatedHours: 24,
          requiredSkills: ['Kubernetes', 'Docker', 'Go'],
          dependencies: [],
          tags: ['devops', 'infrastructure'],
        },
        {
          id: 'task5',
          title: 'Performance optimization',
          description: 'Optimize database queries and caching',
          priority: 'medium' as const,
          status: 'pending' as const,
          estimatedHours: 14,
          requiredSkills: ['Java', 'Spring', 'Performance'],
          dependencies: [],
          tags: ['backend', 'optimization'],
        },
        {
          id: 'task6',
          title: 'Update documentation',
          description: 'Add API documentation and user guides',
          priority: 'low' as const,
          status: 'pending' as const,
          estimatedHours: 8,
          requiredSkills: ['Technical Writing'],
          dependencies: [],
          tags: ['documentation'],
        },
      ],
      allocations: [
        {
          taskId: 'task1',
          resourceId: 'dev1',
          allocatedHours: 16,
          startDate: new Date(),
          endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          utilization: 40,
        },
        {
          taskId: 'task2',
          resourceId: 'devops1',
          allocatedHours: 12,
          startDate: new Date(),
          endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          utilization: 30,
        },
      ],
      balances: [
        {
          resourceId: 'dev1',
          resourceName: 'Alice Johnson',
          totalTasks: 1,
          totalHours: 51,
          utilization: 127.5,
          overAllocated: true,
          underUtilized: false,
        },
        {
          resourceId: 'dev2',
          resourceName: 'Bob Smith',
          totalTasks: 0,
          totalHours: 28,
          utilization: 70,
          overAllocated: false,
          underUtilized: false,
        },
        {
          resourceId: 'qa1',
          resourceName: 'Carol Davis',
          totalTasks: 0,
          totalHours: 20,
          utilization: 50,
          overAllocated: false,
          underUtilized: false,
        },
        {
          resourceId: 'devops1',
          resourceName: 'David Lee',
          totalTasks: 1,
          totalHours: 44,
          utilization: 110,
          overAllocated: true,
          underUtilized: false,
        },
      ],
      recommendations: [
        {
          type: 'reassign' as const,
          taskId: 'task1',
          currentResourceId: 'dev1',
          suggestedResourceId: 'dev2',
          reason: 'Alice Johnson is over-allocated at 127.5%, Bob Smith has availability',
          expectedImprovement: 35,
          effort: 'low',
          priority: 9,
        },
        {
          type: 'add-resource' as const,
          taskId: 'task2',
          reason: 'DevOps capacity is limited, consider additional DevOps engineer',
          expectedImprovement: 25,
          effort: 'medium',
          priority: 6,
        },
        {
          type: 'prioritize' as const,
          taskId: 'task3',
          reason: 'QA capacity is available, prioritize testing tasks',
          expectedImprovement: 20,
          effort: 'low',
          priority: 5,
        },
      ],
      strategy: options.strategy as 'round-robin' | 'load-based' | 'skill-based' | 'ai-optimized' | 'manual',
      optimizationGoal: options.optimizationGoal as 'speed' | 'quality' | 'cost' | 'balanced',
      enableAI: options.enableAi || false,
      aiModel,
      maxWorkloadThreshold: parseInt(options.maxWorkloadThreshold),
      minUtilizationThreshold: parseInt(options.minUtilizationThreshold),
      rebalanceInterval: parseInt(options.rebalanceInterval),
    };

    const finalConfig = workloadBalancing(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: workload-balancing.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'workload-balancing-manager.ts' : 'workload_balancing_manager.py'}`));
    console.log(chalk.green(`✅ Generated: WORKLOAD_BALANCING.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: workload-balancing-config.json\n`));

    console.log(chalk.green('✓ Workload balancing configuration generated successfully!'));
  }));
}
