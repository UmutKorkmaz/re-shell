import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security security-training` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerSecurityTraining(security: Command): void {
  security
  .command('security-training')
  .description('Generate security training integration and awareness programs with gamification')
  .argument('<name>', 'Name of the security training program')
  .option('--auto-assign', 'Enable automatic training assignment')
  .option('--frequency <frequency>', 'Training frequency (one-time, monthly, quarterly, annual, on-demand)', 'quarterly')
  .option('--duration <minutes>', 'Duration per session (minutes)', '30')
  .option('--passing-score <score>', 'Passing score percentage', '80')
  .option('--max-attempts <attempts>', 'Maximum attempts allowed', '3')
  .option('--gamification', 'Enable gamification features')
  .option('--leaderboard', 'Enable leaderboard')
  .option('--certificates', 'Enable certificate generation')
  .option('--adaptive-difficulty', 'Enable adaptive difficulty')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './security-training-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeSecurityTrainingFiles, displaySecurityTrainingConfig } = await import('../../utils/security-training.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoAssign: options.autoAssign || true,
        frequency: options.frequency,
        duration: parseInt(options.duration),
        passingScore: parseInt(options.passingScore),
        maxAttempts: parseInt(options.maxAttempts),
        requiredForAll: true,
        trackingEnabled: true,
        reminderEnabled: true,
        reminderFrequency: 7,
        allowSkip: false,
        showAnswers: true,
        randomizeQuestions: true,
        adaptiveDifficulty: options.adaptiveDifficulty || false,
        gamificationEnabled: options.gamification || true,
        leaderboardEnabled: options.leaderboard || true,
        certificateEnabled: options.certificates || true,
        expiryPeriod: 365,
        mandatoryModules: ['phishing', 'password-security', 'data-handling'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
        electiveModules: ['secure-coding', 'mobile-security', 'cloud-security'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
      },
      modules: ['phishing', 'password-security', 'data-handling', 'social-engineering', 'incident-reporting'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
      moduleData: [
        {
          id: 'module-001',
          name: 'Phishing Awareness',
          type: 'phishing' as const,
          description: 'Learn to identify and avoid phishing attacks',
          difficulty: 'beginner' as const,
          duration: 30,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: true,
          tags: ['email', 'security', 'awareness'],
          content: [],
          questions: [],
          learningObjectives: ['Identify phishing emails', 'Report suspicious messages'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-002',
          name: 'Password Security',
          type: 'password-security' as const,
          description: 'Best practices for creating and managing secure passwords',
          difficulty: 'beginner' as const,
          duration: 20,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: true,
          tags: ['password', 'authentication', 'security'],
          content: [],
          questions: [],
          learningObjectives: ['Create strong passwords', 'Use password managers'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-003',
          name: 'Data Handling',
          type: 'data-handling' as const,
          description: 'Proper handling and protection of sensitive data',
          difficulty: 'intermediate' as const,
          duration: 45,
          status: 'not-started' as const,
          passScore: 85,
          maxAttempts: 3,
          mandatory: true,
          tags: ['data', 'privacy', 'gdpr'],
          content: [],
          questions: [],
          learningObjectives: ['Classify data types', 'Handle sensitive information'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-004',
          name: 'Social Engineering Defense',
          type: 'social-engineering' as const,
          description: 'Recognize and defend against social engineering attacks',
          difficulty: 'intermediate' as const,
          duration: 35,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: false,
          tags: ['social-engineering', 'psychology', 'security'],
          content: [],
          questions: [],
          learningObjectives: ['Identify manipulation tactics', 'Verify identities'],
          prerequisites: ['module-001'],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-005',
          name: 'Incident Reporting',
          type: 'incident-reporting' as const,
          description: 'How to properly report security incidents',
          difficulty: 'beginner' as const,
          duration: 15,
          status: 'not-started' as const,
          passScore: 100,
          maxAttempts: 3,
          mandatory: true,
          tags: ['incident', 'reporting', 'response'],
          content: [],
          questions: [],
          learningObjectives: ['Recognize security incidents', 'Follow reporting procedures'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
      ],
      users: [
        {
          id: 'user-001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: 'Developer',
          department: 'Engineering',
          manager: 'Jane Smith',
          team: 'Platform Team',
          location: 'New York',
          joinDate: new Date('2023-01-15'),
          isActive: true,
        },
        {
          id: 'user-002',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: 'Engineering Manager',
          department: 'Engineering',
          team: 'Platform Team',
          location: 'San Francisco',
          joinDate: new Date('2022-06-01'),
          isActive: true,
        },
      ],
      progress: [],
      assessments: [],
      gamification: {
        enabled: true,
        pointsPerCorrectAnswer: 10,
        pointsPerCompletion: 100,
        bonusPoints: [
          { id: 'bonus-001', name: 'First Attempt Perfect', description: 'Complete module with 100% on first attempt', condition: 'first-attempt-perfect', points: 50, maxPerDay: 1 },
          { id: 'bonus-002', name: 'Speed Demon', description: 'Complete module in half the time', condition: 'fast-completion', points: 25 },
        ],
        badges: [
          { id: 'badge-001', name: 'Security Novice', description: 'Complete first training module', type: 'completion' as const, icon: '🎓', rarity: 'common' as const, requirement: 'Complete 1 module', points: 100 },
          { id: 'badge-002', name: 'Security Champion', description: 'Complete all modules', type: 'completion' as const, icon: '🏆', rarity: 'legendary' as const, requirement: 'Complete all modules', points: 1000 },
          { id: 'badge-003', name: 'Quick Learner', description: 'Complete 5 modules in one day', type: 'speed' as const, icon: '⚡', rarity: 'rare' as const, requirement: '5 modules in 1 day', points: 200 },
        ],
        levels: [
          { id: 'level-1', name: 'Novice', number: 1, pointsRequired: 0, privileges: ['Access basic modules'], icon: '🌱' },
          { id: 'level-2', name: 'Aware', number: 2, pointsRequired: 500, privileges: ['Access intermediate modules'], icon: '📚' },
          { id: 'level-3', name: 'Competent', number: 3, pointsRequired: 1500, privileges: ['Access advanced modules', 'Mentor others'], icon: '🎯' },
          { id: 'level-4', name: 'Expert', number: 4, pointsRequired: 3000, privileges: ['All modules', 'Custom challenges'], icon: '👑' },
        ],
        leaderboards: [
          { id: 'lb-001', name: 'Monthly Champions', type: 'individual' as const, period: 'monthly' as const, category: 'points', participants: 150, topScores: [] },
          { id: 'lb-002', name: 'Team Battle', type: 'team' as const, period: 'monthly' as const, category: 'completions', participants: 12, topScores: [] },
        ],
        challenges: [
          {
            id: 'challenge-001',
            name: 'Cybersecurity Month',
            description: 'Complete all phishing modules during October',
            type: 'individual' as const,
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-10-31'),
            rules: ['Complete all phishing modules', 'Score 90% or higher'],
            reward: { id: 'reward-001', type: 'badge' as const, name: 'Cyber Defender', description: 'October challenge winner', value: 500, icon: '🛡️', unlockThreshold: 0 },
            participants: ['user-001', 'user-002'],
            progress: [],
          },
        ],
        rewards: [
          { id: 'reward-001', type: 'badge' as const, name: 'Cyber Defender', description: 'October challenge winner', value: 500, icon: '🛡️', unlockThreshold: 1000 },
          { id: 'reward-002', type: 'certificate' as const, name: 'Security Certified', description: 'Completion certificate', value: 0, icon: '📜', unlockThreshold: 2000 },
        ],
        teams: [
          { id: 'team-001', name: 'Platform Guardians', description: 'Platform team security champions', members: ['user-001', 'user-002'], score: 2500, rank: 1, avatar: '🦅' },
        ],
      },
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-01',
          totalParticipants: 150,
          completedModules: 420,
          averageScore: 87,
          passRate: 94,
          completionRate: 85,
          byDepartment: {
            Engineering: { participants: 50, completed: 180, averageScore: 90, completionRate: 92 },
            Sales: { participants: 40, completed: 80, averageScore: 82, completionRate: 75 },
            Marketing: { participants: 35, completed: 70, averageScore: 85, completionRate: 80 },
            HR: { participants: 25, completed: 50, averageScore: 88, completionRate: 88 },
          },
          byModule: {
            'module-001': { attempts: 150, completions: 145, averageScore: 88, averageTime: 28, passRate: 97, questionStats: [] },
            'module-002': { attempts: 150, completions: 148, averageScore: 92, averageTime: 18, passRate: 99, questionStats: [] },
          },
          vulnerabilityAreas: [
            { area: 'Phishing Recognition', severity: 'medium' as const, averageScore: 78, participants: 30, improvement: 12 },
            { area: 'Password Management', severity: 'low' as const, averageScore: 92, participants: 15, improvement: 5 },
          ],
          engagementMetrics: {
            activeUsers: 120,
            totalPoints: 125000,
            averageSessionTime: 25,
            returnUsers: 95,
            badgesEarned: 85,
            challengesCompleted: 12,
            leaderboardParticipation: 78,
          },
          trends: [
            { date: new Date('2024-01-01'), participants: 120, completions: 85, averageScore: 85, engagement: 75 },
            { date: new Date('2024-01-15'), participants: 130, completions: 95, averageScore: 87, engagement: 80 },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'SSO Integration',
          type: 'sso' as const,
          provider: 'Okta',
          enabled: true,
          config: { domain: 'company.okta.com', clientId: 'abc123' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
          usersSynced: 150,
          modulesImported: 5,
        },
        {
          id: 'integration-002',
          name: 'Slack Notifications',
          type: 'notification' as const,
          provider: 'Slack',
          enabled: true,
          config: { channel: '#security-training', webhookUrl: 'https://hooks.slack.com/...' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 30 * 60 * 1000),
          usersSynced: 0,
          modulesImported: 0,
        },
      ],
    };

    displaySecurityTrainingConfig(finalConfig);

    await writeSecurityTrainingFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: security-training-${providers.join('.tf, security-training-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'security-training-manager.ts' : 'security_training_manager.py'}`));
    console.log(chalk.green('✅ Generated: SECURITY_TRAINING.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: security-training-config.json\n'));

    console.log(chalk.green('✓ Security training and awareness program configured successfully!'));
  }));

}
