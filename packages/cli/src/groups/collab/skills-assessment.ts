import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab skills-assessment` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerSkillsAssessment(collab: Command): void {
  collab
  .command('skills-assessment')
  .description('Generate skills assessment and learning path recommendations with certifications')
  .argument('<name>', 'Name of the skills assessment setup')
  .option('--enable-auto-assessment', 'Enable automated skill assessment')
  .option('--enable-progress-tracking', 'Enable learning progress tracking')
  .option('--enable-recommendations', 'Enable learning recommendations')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './skills-assessment')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/skills-assessment.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      learningPaths: [
        {
          developerId: 'dev1',
          developerName: 'Alice Johnson',
          skills: [
            { id: 'skill1', name: 'TypeScript', category: 'technical' as const, currentLevel: 'advanced' as const, targetLevel: 'expert' as const, importance: 9, lastAssessed: Date.now() - 2592000000 },
            { id: 'skill2', name: 'React', category: 'technical' as const, currentLevel: 'advanced' as const, targetLevel: 'expert' as const, importance: 8, lastAssessed: Date.now() - 2592000000 },
            { id: 'skill3', name: 'Communication', category: 'soft' as const, currentLevel: 'intermediate' as const, targetLevel: 'advanced' as const, importance: 7, lastAssessed: Date.now() - 5184000000 },
          ],
          recommendedResources: [
            { id: 'res1', skillId: 'skill1', title: 'Advanced TypeScript Patterns', provider: 'Udemy', format: 'online' as const, duration: 15, cost: 50, url: 'https://udemy.com/ts-advanced', rating: 4.8 },
            { id: 'res2', skillId: 'skill2', title: 'React Performance Optimization', provider: 'Pluralsight', format: 'online' as const, duration: 10, cost: 30, url: 'https://pluralsight.com/react-perf', rating: 4.7 },
          ],
          certifications: [
            { id: 'cert1', skillId: 'skill1', name: 'AWS Certified Developer', issuer: 'Amazon Web Services', status: 'in-progress' as const, expiryDate: Date.now() + 31536000000, verified: false },
            { id: 'cert2', skillId: 'skill2', name: 'Meta Frontend Developer', issuer: 'Meta', status: 'completed' as const, verified: true },
          ],
          estimatedCompletion: 6,
          priority: 'high' as const,
        },
        {
          developerId: 'dev2',
          developerName: 'Bob Smith',
          skills: [
            { id: 'skill4', name: 'Python', category: 'technical' as const, currentLevel: 'intermediate' as const, targetLevel: 'advanced' as const, importance: 8, lastAssessed: Date.now() - 2592000000 },
            { id: 'skill5', name: 'Docker', category: 'tools' as const, currentLevel: 'beginner' as const, targetLevel: 'intermediate' as const, importance: 9, lastAssessed: Date.now() - 5184000000 },
            { id: 'skill6', name: 'Team Leadership', category: 'soft' as const, currentLevel: 'intermediate' as const, targetLevel: 'advanced' as const, importance: 6, lastAssessed: Date.now() - 7776000000 },
          ],
          recommendedResources: [
            { id: 'res3', skillId: 'skill4', title: 'Python for Data Science', provider: 'Coursera', format: 'self-paced' as const, duration: 40, cost: 0, url: 'https://coursera.com/python-data', rating: 4.9 },
            { id: 'res4', skillId: 'skill5', title: 'Docker Essentials', provider: 'Linux Foundation', format: 'online' as const, duration: 20, cost: 100, url: 'https://training.linuxfoundation.org/docker', rating: 4.6 },
          ],
          certifications: [
            { id: 'cert3', skillId: 'skill5', name: 'Docker Certified Associate', issuer: 'Docker Inc', status: 'none' as const, verified: false },
          ],
          estimatedCompletion: 8,
          priority: 'medium' as const,
        },
      ],
      enableAutoAssessment: options.enableAutoAssessment || false,
      enableProgressTracking: options.enableProgressTracking || false,
      enableRecommendations: options.enableRecommendations || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating skills assessment configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: skills-assessment.tf`));
      console.log(chalk.green(`✅ Generated: skills-assessment-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: SKILLS_ASSESSMENT.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: skills-assessment-config.json\n`));

      console.log(chalk.green('✓ Skills assessment configuration generated successfully!'));
    }, 30000);
  }));

// Communication analysis commands
}
