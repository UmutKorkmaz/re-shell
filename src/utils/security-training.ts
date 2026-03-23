// Security Training Integration and Awareness Programs with Gamification

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type TrainingModule = 'phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type TrainingStatus = 'not-started' | 'in-progress' | 'completed' | 'failed' | 'expired';
export type AchievementType = 'completion' | 'speed' | 'accuracy' | 'streak' | 'perfect-score' | 'participation' | 'custom';
export type RewardType = 'points' | 'badge' | 'level' | 'certificate' | 'unlock' | 'custom';
export type LeaderboardType = 'individual' | 'team' | 'department' | 'organization';
export type QuestionType = 'multiple-choice' | 'true-false' | 'scenario' | 'simulation' | 'drag-drop' | 'fill-blank' | 'practical' | 'custom';

export interface SecurityTrainingConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: TrainingSettings;
  modules: TrainingModule[];
  moduleData: TrainingModuleData[];
  users: TrainingUser[];
  progress: UserProgress[];
  assessments: Assessment[];
  gamification: GamificationConfig;
  analytics: TrainingAnalytics[];
  integrations: TrainingIntegration[];
}

export interface TrainingSettings {
  autoAssign: boolean;
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'annual' | 'on-demand';
  duration: number; // minutes per session
  passingScore: number; // percentage
  maxAttempts: number;
  requiredForAll: boolean;
  trackingEnabled: boolean;
  reminderEnabled: boolean;
  reminderFrequency: number; // days before due
  allowSkip: boolean;
  showAnswers: boolean;
  randomizeQuestions: boolean;
  adaptiveDifficulty: boolean;
  gamificationEnabled: boolean;
  leaderboardEnabled: boolean;
  certificateEnabled: boolean;
  expiryPeriod: number; // days before refresher required
  mandatoryModules: TrainingModule[];
  electiveModules: TrainingModule[];
}

export interface TrainingModuleData {
  id: string;
  name: string;
  type: TrainingModule;
  description: string;
  difficulty: Difficulty;
  duration: number; // minutes
  status: TrainingStatus;
  passScore: number;
  maxAttempts: number;
  mandatory: boolean;
  tags: string[];
  content: ModuleContent[];
  questions: Question[];
  learningObjectives: string[];
  prerequisites: string[]; // Module IDs
  targetRoles: string[];
  targetDepartments: string[];
  lastUpdated: Date;
}

export interface ModuleContent {
  id: string;
  type: 'video' | 'text' | 'interactive' | 'simulation' | 'quiz' | 'document' | 'custom';
  title: string;
  content: string;
  duration: number; // minutes
  required: boolean;
  order: number;
  metadata: Record<string, any>;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
  difficulty: Difficulty;
  category: string;
  scenario?: Scenario;
  timeLimit?: number; // seconds
  hints: string[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  context: string;
  steps: ScenarioStep[];
  outcome: string;
}

export interface ScenarioStep {
  id: string;
  step: number;
  description: string;
  options: ScenarioOption[];
  correctOption: string;
  explanation: string;
}

export interface ScenarioOption {
  id: string;
  text: string;
  consequence: string;
}

export interface TrainingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  manager?: string;
  team?: string;
  location?: string;
  joinDate: Date;
  isActive: boolean;
}

export interface UserProgress {
  id: string;
  userId: string;
  moduleId: string;
  status: TrainingStatus;
  score: number; // 0-100
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  timeSpent: number; // minutes
  questionsCorrect: number;
  questionsTotal: number;
  badges: Badge[];
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActivity: Date;
  certificates: Certificate[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: Date;
  progress?: number; // for multi-step achievements
  target?: number;
}

export interface Level {
  id: string;
  name: string;
  number: number;
  pointsRequired: number;
  privileges: string[];
  icon: string;
}

export interface Certificate {
  id: string;
  type: 'completion' | 'excellence' | 'mastery' | 'custom';
  title: string;
  issuedAt: Date;
  expiresAt?: Date;
  certificateNumber: string;
  verified: boolean;
}

export interface GamificationConfig {
  enabled: boolean;
  pointsPerCorrectAnswer: number;
  pointsPerCompletion: number;
  bonusPoints: BonusRule[];
  badges: BadgeDefinition[];
  levels: Level[];
  leaderboards: Leaderboard[];
  challenges: Challenge[];
  rewards: Reward[];
  teams: Team[];
}

export interface BonusRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  points: number;
  maxPerDay?: number;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: string;
  points: number;
}

export interface Leaderboard {
  id: string;
  name: string;
  type: LeaderboardType;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  category: string;
  participants: number;
  topScores: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  score: number;
  rank: number;
  change: number; // rank change
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'individual' | 'team' | 'department';
  startDate: Date;
  endDate: Date;
  rules: string[];
  reward: Reward;
  participants: string[];
  progress: ChallengeProgress[];
}

export interface ChallengeProgress {
  userId: string;
  userName: string;
  progress: number; // percentage
  score: number;
}

export interface Reward {
  id: string;
  type: RewardType;
  name: string;
  description: string;
  value: number;
  icon: string;
  unlockThreshold: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: string[];
  score: number;
  rank: number;
  avatar: string;
}

export interface Assessment {
  id: string;
  name: string;
  type: 'phishing-simulation' | 'knowledge-test' | 'practical-exam' | 'audit' | 'custom';
  moduleId: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledFor: Date;
  duration: number;
  participants: string[];
  results: AssessmentResult[];
  averageScore: number;
  passRate: number;
}

export interface AssessmentResult {
  userId: string;
  userName: string;
  score: number;
  passed: boolean;
  timeTaken: number;
  completedAt: Date;
}

export interface TrainingAnalytics {
  id: string;
  period: string;
  totalParticipants: number;
  completedModules: number;
  averageScore: number;
  passRate: number;
  completionRate: number;
  byDepartment: Record<string, DepartmentStats>;
  byModule: Record<string, ModuleStats>;
  vulnerabilityAreas: VulnerabilityArea[];
  engagementMetrics: EngagementMetrics;
  trends: TrainingTrend[];
}

export interface DepartmentStats {
  participants: number;
  completed: number;
  averageScore: number;
  completionRate: number;
}

export interface ModuleStats {
  attempts: number;
  completions: number;
  averageScore: number;
  averageTime: number; // minutes
  passRate: number;
  questionStats: QuestionStats[];
}

export interface QuestionStats {
  questionId: string;
  correctRate: number; // percentage
  averageTime: number; // seconds
  mostCommonWrongAnswer: string;
}

export interface VulnerabilityArea {
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  averageScore: number;
  participants: number;
  improvement: number; // percentage change from previous period
}

export interface EngagementMetrics {
  activeUsers: number;
  totalPoints: number;
  averageSessionTime: number;
  returnUsers: number;
  badgesEarned: number;
  challengesCompleted: number;
  leaderboardParticipation: number;
}

export interface TrainingTrend {
  date: Date;
  participants: number;
  completions: number;
  averageScore: number;
  engagement: number;
}

export interface TrainingIntegration {
  id: string;
  name: string;
  type: 'lms' | 'hr-system' | 'sso' | 'notification' | 'analytics' | 'custom';
  provider: string;
  enabled: boolean;
  config: any;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  usersSynced: number;
  modulesImported: number;
  errorMessage?: string;
}

// Markdown Generation
export function generateSecurityTrainingMarkdown(config: SecurityTrainingConfig): string {
  return `# Security Training Integration and Awareness Programs

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Auto-Assign**: ${config.settings.autoAssign ? 'Yes' : 'No'}
**Gamification**: ${config.settings.gamificationEnabled ? 'Yes' : 'No'}
**Leaderboard**: ${config.settings.leaderboardEnabled ? 'Yes' : 'No'}

## Training Settings

- **Auto-Assign**: ${config.settings.autoAssign}
- **Frequency**: ${config.settings.frequency}
- **Duration**: ${config.settings.duration} minutes per session
- **Passing Score**: ${config.settings.passingScore}%
- **Max Attempts**: ${config.settings.maxAttempts}
- **Required for All**: ${config.settings.requiredForAll}
- **Gamification**: ${config.settings.gamificationEnabled}
- **Leaderboard**: ${config.settings.leaderboardEnabled}
- **Certificate**: ${config.settings.certificateEnabled}
- **Adaptive Difficulty**: ${config.settings.adaptiveDifficulty}

## Training Modules (${config.moduleData.length})

${config.moduleData.slice(0, 5).map(mod => `
### ${mod.name} - ${mod.type.toUpperCase()}

- **Type**: ${mod.type}
- **Difficulty**: ${mod.difficulty}
- **Duration**: ${mod.duration} minutes
- **Pass Score**: ${mod.passScore}%
- **Mandatory**: ${mod.mandatory ? 'Yes' : 'No'}
`).join('\n')}

## Users (${config.users.length})
## Progress Records (${config.progress.length})
## Assessments (${config.assessments.length})
## Gamification (${config.gamification.enabled ? 'Enabled' : 'Disabled'})
## Analytics (${config.analytics.length})
`;
}

// Terraform Generation
export function generateSecurityTrainingTerraform(config: SecurityTrainingConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Security Training Infrastructure
# Generated at: ${new Date().toISOString()}

resource "aws_s3_bucket" "training_content" {
  bucket = "${config.projectName}-training-content"

  versioning {
    enabled = true
  }
}

resource "aws_cognito_user_pool" "training_users" {
  name = "${config.projectName}-training-users"
}

resource "aws_lambda_function" "training_tracker" {
  filename         = "training_tracker.zip"
  function_name    = "${config.projectName}-training-tracker"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300
}

resource "aws_pinpoint" "engagement" {
  application_id = aws_pinpoint_app.main.application_id
}
`;
  } else if (provider === 'azure') {
    return `# Azure Security Training Infrastructure
# Generated at: ${new Date().toISOString()}

resource "azurerm_storage_account" "training_content" {
  name                     = "${config.projectName.replace(/-/g, '')}training"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
}

resource "azurerm_policy_assignment" "training_policy" {
  name = "${config.projectName}-security-training"
  policy_definition_id = azurerm_policy_definition.training.id
}
`;
  } else {
    return `# GCP Security Training Infrastructure
# Generated at: ${new Date().toISOString()}

resource "google_storage_bucket" "training_content" {
  name          = "${config.projectName}-training-content"
  location      = "US"
  force_destroy = false
}

resource "google_cloud_tasks_queue" "training_reminders" {
  name = "${config.projectName}-reminders"
  location = "us-central1"
}

resource "google_firebase_project" "gamification" {
  project = "${config.projectName}"
}
`;
  }
}

// TypeScript Manager Generation
export function generateTrainingManagerTypeScript(config: SecurityTrainingConfig): string {
  return `// Auto-generated Security Training Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Progress {
  userId: string;
  moduleId: string;
  status: string;
  score: number;
  completedAt?: Date;
}

interface Badge {
  id: string;
  name: string;
  type: string;
  earnedAt: Date;
}

class SecurityTrainingManager extends EventEmitter {
  private users: Map<string, User> = new Map();
  private progress: Map<string, Progress> = new Map();
  private badges: Map<string, Badge> = new Map();

  async assignTraining(userId: string, moduleId: string): Promise<Progress> {
    const progress: Progress = {
      userId,
      moduleId,
      status: 'not-started',
      score: 0,
    };

    this.progress.set(\${userId}-\${moduleId}\`, progress);
    this.emit('training-assigned', progress);

    return progress;
  }

  async submitScore(userId: string, moduleId: string, score: number): Promise<any> {
    const key = \${userId}-\${moduleId}\`;
    const progress = this.progress.get(key);
    if (!progress) throw new Error('Progress not found');

    progress.score = score;
    progress.status = score >= 80 ? 'completed' : 'in-progress';
    if (progress.status === 'completed') {
      progress.completedAt = new Date();
    }

    this.emit('score-submitted', progress);
    return { userId, moduleId, score, status: progress.status };
  }

  async awardBadge(userId: string, badgeId: string): Promise<Badge> {
    const badge: Badge = {
      id: badgeId,
      name: 'Security Champion',
      type: 'completion',
      earnedAt: new Date(),
    };

    this.badges.set(\${userId}-\${badgeId}\`, badge);
    this.emit('badge-earned', badge);

    return badge;
  }

  getLeaderboard(): any[] {
    return Array.from(this.progress.values())
      .filter(p => p.status === 'completed')
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}

export { SecurityTrainingManager };
`;
}

// Python Manager Generation
export function generateTrainingManagerPython(config: SecurityTrainingConfig): string {
  return `# Auto-generated Security Training Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    id: str
    name: str
    email: str
    role: str

@dataclass
class Progress:
    user_id: str
    module_id: str
    status: str
    score: int
    completed_at: Optional[datetime]

@dataclass
class Badge:
    id: str
    name: str
    type: str
    earned_at: datetime

class SecurityTrainingManager:
    def __init__(self):
        self.users: Dict[str, User] = {}
        self.progress: Dict[str, Progress] = {}
        self.badges: Dict[str, Badge] = {}

    async def assign_training(self, user_id: str, module_id: str) -> Progress:
        progress = Progress(
            user_id=user_id,
            module_id=module_id,
            status="not-started",
            score=0,
        )
        self.progress[f"{user_id}-{module_id}"] = progress
        return progress

    async def submit_score(self, user_id: str, module_id: str, score: int) -> Dict[str, Any]:
        key = f"{user_id}-{module_id}"
        progress = self.progress.get(key)
        if not progress:
            raise ValueError("Progress not found")

        progress.score = score
        progress.status = "completed" if score >= 80 else "in-progress"
        if progress.status == "completed":
            progress.completed_at = datetime.now()

        return {"userId": user_id, "moduleId": module_id, "score": score}

    async def award_badge(self, user_id: str, badge_id: str) -> Badge:
        badge = Badge(
            id=badge_id,
            name="Security Champion",
            type="completion",
            earned_at=datetime.now(),
        )
        self.badges[f"{user_id}-{badge_id}"] = badge
        return badge

    def get_leaderboard(self) -> List[Dict[str, Any]]:
        completed = [p for p in self.progress.values() if p.status == "completed"]
        return sorted(completed, key=lambda x: x.score, reverse=True)[:10]
`;
}

// Write Files
export async function writeSecurityTrainingFiles(
  config: SecurityTrainingConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  await fs.writeFile(
    path.join(outputDir, 'SECURITY_TRAINING.md'),
    generateSecurityTrainingMarkdown(config)
  );

  for (const provider of config.providers) {
    const tfContent = generateSecurityTrainingTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `security-training-${provider}.tf`),
      tfContent
    );
  }

  if (language === 'typescript') {
    const tsContent = generateTrainingManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'security-training-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Security Training Integration and Awareness',
      main: 'security-training-manager.ts',
      scripts: { start: 'ts-node security-training-manager.ts' },
      dependencies: {
        '@types/node': '^20.0.0',
        'events': '^3.3.0',
      },
    };
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } else {
    const pyContent = generateTrainingManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'security_training_manager.py'), pyContent);

    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      'pydantic>=2.0.0\npython-dotenv>=1.0.0\n'
    );
  }

  await fs.writeFile(
    path.join(outputDir, 'security-training-config.json'),
    JSON.stringify(config, null, 2)
  );
}

export function displaySecurityTrainingConfig(config: SecurityTrainingConfig): void {
  console.log(chalk.cyan('🎓 Security Training Integration and Awareness Programs'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Auto-Assign:`), chalk.white(config.settings.autoAssign ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Gamification:`), chalk.white(config.settings.gamificationEnabled ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Modules:`), chalk.cyan(config.modules.length));
  console.log(chalk.yellow(`Users:`), chalk.cyan(config.users.length));
  console.log(chalk.gray('─'.repeat(60)));
}
