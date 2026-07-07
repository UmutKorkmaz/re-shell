// Auto-generated Mentorship Matching and Collaboration Tools Utility
// Generated at: 2026-01-13T14:30:00.000Z

import chalk from 'chalk';

type MentorshipStatus = 'pending' | 'active' | 'completed' | 'paused' | 'cancelled';
type MatchCriteria = 'skills' | 'experience' | 'availability' | 'location' | 'goals' | 'personality';
type FeedbackType = 'session' | 'monthly' | 'final' | 'peer' | 'self';
type CollaborationType = 'one-on-one' | 'group' | 'workshop' | 'project' | 'shadowing';

interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: 'mentor' | 'mentee' | 'both';
  department: string;
  level: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  skills: string[];
  expertiseAreas: string[];
  learningGoals: string[];
  availability: {
    daysPerWeek: number;
    hoursPerWeek: number;
    timezone: string;
  };
  location: string;
  bio: string;
  yearsExperience: number;
}

interface MatchScore {
  mentorId: string;
  menteeId: string;
  overallScore: number; // 0-100
  criteriaScores: Map<MatchCriteria, number>;
  reasons: string[];
}

interface MentorshipPair {
  id: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  status: MentorshipStatus;
  startDate: Date;
  endDate?: Date;
  matchScore: number;
  collaborationType: CollaborationType;
  focusAreas: string[];
  goals: string[];
  sessionFrequency: string; // e.g., "weekly", "bi-weekly"
  sessionDuration: number; // in minutes
}

interface Session {
  id: string;
  pairId: string;
  date: Date;
  duration: number; // in minutes
  type: 'planning' | 'check-in' | 'training' | 'review' | 'project-work';
  topic: string;
  notes: string;
  actionItems: string[];
  mentorPreparation?: string;
  menteePreparation?: string;
}

interface Feedback {
  id: string;
  pairId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  type: FeedbackType;
  rating: number; // 1-5
  strengths: string[];
  improvements: string[];
  comments: string;
  date: Date;
  anonymous: boolean;
}

interface MentorshipProgram {
  id: string;
  name: string;
  description: string;
  department: string;
  startDate: Date;
  endDate?: Date;
  mentors: string[];
  mentees: string[];
  pairs: MentorshipPair[];
  sessions: Session[];
  feedbacks: Feedback[];
  goals: string[];
  requirements: string[];
}

interface MentorshipConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  users: UserProfile[];
  programs: MentorshipProgram[];
  pairs: MentorshipPair[];
  sessions: Session[];
  feedbacks: Feedback[];
  enableAutoMatching: boolean;
  enableFeedbackSystem: boolean;
  enableProgressTracking: boolean;
  matchThreshold: number; // minimum score to match
  sessionReminderHours: number; // hours before session
}

/**
 * Prints a human-readable summary of the mentorship configuration to the console,
 * including project name, provider list, counts of users, programs, pairs, sessions,
 * feedback entries, and the status of the auto-matching, feedback, and progress tracking features.
 *
 * @param config - The mentorship configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: MentorshipConfig): void {
  console.log(chalk.cyan('🤝 Mentorship Matching and Collaboration Tools'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Users:'), config.users.length);
  console.log(chalk.yellow('Programs:'), config.programs.length);
  console.log(chalk.yellow('Active Pairs:'), config.pairs.length);
  console.log(chalk.yellow('Sessions:'), config.sessions.length);
  console.log(chalk.yellow('Feedbacks:'), config.feedbacks.length);
  console.log(chalk.yellow('Auto Matching:'), config.enableAutoMatching ? 'Yes' : 'No');
  console.log(chalk.yellow('Feedback System:'), config.enableFeedbackSystem ? 'Yes' : 'No');
  console.log(chalk.yellow('Progress Tracking:'), config.enableProgressTracking ? 'Yes' : 'No');
  console.log(chalk.yellow('Match Threshold:'), config.matchThreshold + '%');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview document describing the mentorship matching and
 * collaboration tools, including the feature list, matching algorithm criteria,
 * and supported collaboration types.
 *
 * @param config - The mentorship configuration used to drive the generated document.
 * @returns A Markdown-formatted string containing the mentorship feature documentation.
 */
export function generateMentorshipMD(config: MentorshipConfig): string {
  let md = '# Mentorship Matching and Collaboration Tools\n\n';
  md += '## Features\n\n';
  md += '- User profiles with skills, expertise, and learning goals\n';
  md += '- Intelligent mentor-mentee matching based on multiple criteria\n';
  md += '- Match criteria: skills, experience, availability, location, goals, personality\n';
  md += '- Collaboration types: one-on-one, group, workshop, project, shadowing\n';
  md += '- Session scheduling and tracking\n';
  md += '- Comprehensive feedback system (session, monthly, final, peer, self)\n';
  md += '- Progress tracking with goals and action items\n';
  md += '- Mentorship program management\n';
  md += '- Rating system (1-5 stars)\n';
  md += '- Anonymous feedback option\n';
  md += '- Session reminders\n';
  md += '- Multi-cloud provider support\n\n';
  md += '## Matching Algorithm\n\n';
  md += 'The matching system considers:\n';
  md += '1. **Skills Overlap**: Mentor expertise vs mentee learning goals\n';
  md += '2. **Experience Gap**: Appropriate level difference\n';
  md += '3. **Availability**: Compatible schedules and timezones\n';
  md += '4. **Location**: Proximity for in-person sessions\n';
  md += '5. **Goals Alignment**: Shared objectives and interests\n';
  md += '6. **Personality Fit**: Communication style preferences\n\n';
  md += '## Collaboration Types\n\n';
  md += '- **One-on-One**: Traditional mentor-mentee pairing\n';
  md += '- **Group**: One mentor with multiple mentees\n';
  md += '- **Workshop**: Structured learning sessions\n';
  md += '- **Project**: Real-world project collaboration\n';
  md += '- **Shadowing**: Observational learning\n\n';
  return md;
}

/**
 * Generates the Terraform header boilerplate for the mentorship infrastructure
 * associated with the given configuration, including the project name and a
 * current ISO timestamp comment.
 *
 * @param config - The mentorship configuration whose project name is used in the header.
 * @returns A string containing the Terraform header preamble for the mentorship project.
 */
export function generateTerraformMentorship(config: MentorshipConfig): string {
  let code = '# Auto-generated Mentorship Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates the TypeScript source code for a `MentorshipManager` class based on
 * the supplied configuration. The generated code defines user/pair interfaces,
 * an EventEmitter-based manager with user registration, match scoring, pair
 * creation, and program statistics, plus a default exported manager instance.
 *
 * @param config - The mentorship configuration used to seed the generated manager
 *   (match threshold and auto-matching flag are interpolated into the output).
 * @returns A string containing the full TypeScript source code of the mentorship manager.
 */
export function generateTypeScriptMentorship(config: MentorshipConfig): string {
  let code = '// Auto-generated Mentorship Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'interface UserProfile {\n';
  code += '  userId: string;\n';
  code += '  name: string;\n';
  code += '  role: \'mentor\' | \'mentee\' | \'both\';\n';
  code += '  skills: string[];\n';
  code += '  expertiseAreas: string[];\n';
  code += '  learningGoals: string[];\n';
  code += '  yearsExperience: number;\n';
  code += '}\n\n';
  code += 'interface MentorshipPair {\n';
  code += '  id: string;\n';
  code += '  mentorId: string;\n';
  code += '  menteeId: string;\n';
  code += '  status: string;\n';
  code += '  matchScore: number;\n';
  code += '}\n\n';
  code += 'class MentorshipManager extends EventEmitter {\n';
  code += '  private users: Map<string, UserProfile> = new Map();\n';
  code += '  private pairs: Map<string, MentorshipPair> = new Map();\n';
  code += '  private matchThreshold: number;\n';
  code += '  private enableAutoMatching: boolean;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.matchThreshold = options.matchThreshold || 70;\n';
  code += '    this.enableAutoMatching = options.enableAutoMatching !== false;\n';
  code += '  }\n\n';
  code += '  addUser(user: UserProfile): void {\n';
  code += '    this.users.set(user.userId, user);\n';
  code += '    this.emit(\'user-added\', user);\n';
  code += '  }\n\n';
  code += '  calculateMatchScore(mentor: UserProfile, mentee: UserProfile): number {\n';
  code += '    let score = 0;\n';
  code += '    let weights = { skills: 0.3, experience: 0.2, goals: 0.3, availability: 0.2 };\n\n';
  code += '    // Skills overlap\n';
  code += '    const skillOverlap = mentee.learningGoals.filter(goal => \n';
  code += '      mentor.expertiseAreas.includes(goal)\n';
  code += '    ).length;\n';
  code += '    const skillScore = (skillOverlap / mentee.learningGoals.length) * 100;\n\n';
  code += '    // Experience gap (should be 3+ years for good mentorship)\n';
  code += '    const experienceDiff = mentor.yearsExperience - mentee.yearsExperience;\n';
  code += '    const experienceScore = experienceDiff >= 3 ? 100 : (experienceDiff / 3) * 100;\n\n';
  code += '    // Goals alignment\n';
  code += '    const commonGoals = mentor.expertiseAreas.filter(area => \n';
  code += '      mentee.learningGoals.includes(area)\n';
  code += '    ).length;\n';
  code += '    const goalsScore = (commonGoals / Math.max(mentor.expertiseAreas.length, 1)) * 100;\n\n';
  code += '    // Availability (simplified)\n';
  code += '    const availabilityScore = 100; // Assume compatible for now\n\n';
  code += '    score = \n';
  code += '      skillScore * weights.skills +\n';
  code += '      experienceScore * weights.experience +\n';
  code += '      goalsScore * weights.goals +\n';
  code += '      availabilityScore * weights.availability;\n\n';
  code += '    return Math.round(score);\n';
  code += '  }\n\n';
  code += '  findMatches(menteeId: string): MentorshipPair[] {\n';
  code += '    const mentee = this.users.get(menteeId);\n';
  code += '    if (!mentee) {\n';
  code += '      throw new Error(`User not found: ${menteeId}`);\n';
  code += '    }\n\n';
  code += '    const matches: MentorshipPair[] = [];\n\n';
  code += '    for (const [mentorId, mentor] of this.users) {\n';
  code += '      if (mentor.role === \'mentee\') continue;\n';
  code += '      if (mentorId === menteeId) continue;\n\n';
  code += '      const score = this.calculateMatchScore(mentor, mentee);\n\n';
  code += '      if (score >= this.matchThreshold) {\n';
  code += '        matches.push({\n';
  code += '          id: `pair-${mentorId}-${menteeId}`,\n';
  code += '          mentorId,\n';
  code += '          menteeId,\n';
  code += '          status: \'pending\',\n';
  code += '          matchScore: score,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    return matches.sort((a, b) => b.matchScore - a.matchScore);\n';
  code += '  }\n\n';
  code += '  createPair(mentorId: string, menteeId: string): MentorshipPair {\n';
  code += '    const mentor = this.users.get(mentorId);\n';
  code += '    const mentee = this.users.get(menteeId);\n\n';
  code += '    if (!mentor || !mentee) {\n';
  code += '      throw new Error(\'Invalid mentor or mentee\');\n';
  code += '    }\n\n';
  code += '    const score = this.calculateMatchScore(mentor, mentee);\n';
  code += '    if (score < this.matchThreshold) {\n';
  code += '      throw new Error(`Match score ${score} below threshold ${this.matchThreshold}`);\n';
  code += '    }\n\n';
  code += '    const pair: MentorshipPair = {\n';
  code += '      id: `pair-${Date.now()}`,\n';
  code += '      mentorId,\n';
  code += '      menteeId,\n';
  code += '      status: \'active\',\n';
  code += '      matchScore: score,\n';
  code += '    };\n\n';
  code += '    this.pairs.set(pair.id, pair);\n';
  code += '    this.emit(\'pair-created\', pair);\n\n';
  code += '    return pair;\n';
  code += '  }\n\n';
  code += '  getPairs(): MentorshipPair[] {\n';
  code += '    return Array.from(this.pairs.values());\n';
  code += '  }\n\n';
  code += '  getProgramStats(): any {\n';
  code += '    const activePairs = Array.from(this.pairs.values()).filter(p => p.status === \'active\');\n';
  code += '    const avgMatchScore = activePairs.reduce((sum, p) => sum + p.matchScore, 0) / activePairs.length;\n\n';
  code += '    return {\n';
  code += '      totalUsers: this.users.size,\n';
  code += '      totalPairs: this.pairs.size,\n';
  code += '      activePairs: activePairs.length,\n';
  code += '      averageMatchScore: Math.round(avgMatchScore || 0),\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const mentorshipManager = new MentorshipManager({\n';
  code += '  matchThreshold: ' + config.matchThreshold + ',\n';
  code += '  enableAutoMatching: ' + config.enableAutoMatching + ',\n';
  code += '});\n';
  code += 'export default mentorshipManager;\n';
  return code;
}

/**
 * Generates the Python source code for a `MentorshipManager` class based on
 * the supplied configuration. The generated code defines a `UserProfile`
 * dataclass and a manager class exposing user registration, match scoring,
 * match finding, pair creation, and program statistics.
 *
 * @param config - The mentorship configuration used to seed the generated manager
 *   (project name, match threshold, and auto-matching flag are interpolated
 *   into the output).
 * @returns A string containing the full Python source code of the mentorship manager.
 */
export function generatePythonMentorship(config: MentorshipConfig): string {
  let code = '# Auto-generated Mentorship Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'from typing import Dict, List, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';
  code += '@dataclass\n';
  code += 'class UserProfile:\n';
  code += '    user_id: str\n';
  code += '    name: str\n';
  code += '    role: str  # mentor, mentee, both\n';
  code += '    skills: List[str]\n';
  code += '    expertise_areas: List[str]\n';
  code += '    learning_goals: List[str]\n';
  code += '    years_experience: float\n\n';
  code += 'class MentorshipManager:\n';
  code += '    def __init__(self, project_name: str = \'' + config.projectName + '\'):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.users: Dict[str, UserProfile] = {}\n';
  code += '        self.pairs: Dict[str, Any] = {}\n';
  code += '        self.match_threshold = ' + config.matchThreshold + '\n';
  code += '        self.enable_auto_matching = ' + (config.enableAutoMatching ? 'True' : 'False') + '\n\n';
  code += '    def add_user(self, user: UserProfile) -> None:\n';
  code += '        self.users[user.user_id] = user\n\n';
  code += '    def calculate_match_score(self, mentor: UserProfile, mentee: UserProfile) -> float:\n';
  code += '        # Skills overlap\n';
  code += '        skill_overlap = len(set(mentee.learning_goals) & set(mentor.expertise_areas))\n';
  code += '        skill_score = (skill_overlap / len(mentee.learning_goals)) * 100 if mentee.learning_goals else 0\n\n';
  code += '        # Experience gap\n';
  code += '        experience_diff = mentor.years_experience - mentee.years_experience\n';
  code += '        experience_score = 100 if experience_diff >= 3 else (experience_diff / 3) * 100\n\n';
  code += '        # Goals alignment\n';
  code += '        common_goals = len(set(mentor.expertise_areas) & set(mentee.learning_goals))\n';
  code += '        goals_score = (common_goals / max(len(mentor.expertise_areas), 1)) * 100\n\n';
  code += '        # Availability\n';
  code += '        availability_score = 100\n\n';
  code += '        weights = {\'skills\': 0.3, \'experience\': 0.2, \'goals\': 0.3, \'availability\': 0.2}\n';
  code += '        score = (\n';
  code += '            skill_score * weights[\'skills\'] +\n';
  code += '            experience_score * weights[\'experience\'] +\n';
  code += '            goals_score * weights[\'goals\'] +\n';
  code += '            availability_score * weights[\'availability\']\n';
  code += '        )\n\n';
  code += '        return round(score)\n\n';
  code += '    def find_matches(self, mentee_id: str) -> List[Dict[str, Any]]:\n';
  code += '        mentee = self.users.get(mentee_id)\n';
  code += '        if not mentee:\n';
  code += '            raise ValueError(f"User not found: {mentee_id}")\n\n';
  code += '        matches = []\n';
  code += '        for mentor_id, mentor in self.users.items():\n';
  code += '            if mentor.role == \'mentee\':\n';
  code += '                continue\n';
  code += '            if mentor_id == mentee_id:\n';
  code += '                continue\n\n';
  code += '            score = self.calculate_match_score(mentor, mentee)\n\n';
  code += '            if score >= self.match_threshold:\n';
  code += '                matches.append({\n';
  code += '                    \'id\': f"pair-{mentor_id}-{mentee_id}",\n';
  code += '                    \'mentor_id\': mentor_id,\n';
  code += '                    \'mentee_id\': mentee_id,\n';
  code += '                    \'status\': \'pending\',\n';
  code += '                    \'match_score\': score,\n';
  code += '                })\n\n';
  code += '        return sorted(matches, key=lambda x: x[\'match_score\'], reverse=True)\n\n';
  code += '    def create_pair(self, mentor_id: str, mentee_id: str) -> Dict[str, Any]:\n';
  code += '        mentor = self.users.get(mentor_id)\n';
  code += '        mentee = self.users.get(mentee_id)\n\n';
  code += '        if not mentor or not mentee:\n';
  code += '            raise ValueError("Invalid mentor or mentee")\n\n';
  code += '        score = self.calculate_match_score(mentor, mentee)\n';
  code += '        if score < self.match_threshold:\n';
  code += '            raise ValueError(f"Match score {score} below threshold {self.match_threshold}")\n\n';
  code += '        pair = {\n';
  code += '            \'id\': f"pair-{int(datetime.now().timestamp())}",\n';
  code += '            \'mentor_id\': mentor_id,\n';
  code += '            \'mentee_id\': mentee_id,\n';
  code += '            \'status\': \'active\',\n';
  code += '            \'match_score\': score,\n';
  code += '        }\n\n';
  code += '        self.pairs[pair[\'id\']] = pair\n';
  code += '        return pair\n\n';
  code += '    def get_program_stats(self) -> Dict[str, Any]:\n';
  code += '        active_pairs = [p for p in self.pairs.values() if p[\'status\'] == \'active\']\n';
  code += '        avg_match_score = sum(p[\'match_score\'] for p in active_pairs) / len(active_pairs) if active_pairs else 0\n\n';
  code += '        return {\n';
  code += '            \'total_users\': len(self.users),\n';
  code += '            \'total_pairs\': len(self.pairs),\n';
  code += '            \'active_pairs\': len(active_pairs),\n';
  code += '            \'average_match_score\': round(avg_match_score),\n';
  code += '        }\n\n';
  code += 'mentorship_manager = MentorshipManager()\n';
  return code;
}

/**
 * Writes the mentorship project files to disk for the given configuration.
 * Always writes the Terraform file (`mentorship.tf`) and the Markdown
 * documentation (`MENTORSHIP.md`), plus a JSON serialization of the
 * configuration (`mentorship-config.json`). Depending on the requested
 * language, also writes either the TypeScript manager and `package.json`
 * or the Python manager and `requirements.txt`.
 *
 * @param config - The mentorship configuration to materialize as files.
 * @param outputDir - The directory to write generated files into; created if missing.
 * @param language - Target language for the manager implementation; when
 *   `'typescript'` the TypeScript files are written, otherwise the Python files.
 * @returns A promise that resolves when all files have been written.
 */
export async function writeFiles(config: MentorshipConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformMentorship(config);
  await fs.writeFile(path.join(outputDir, 'mentorship.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptMentorship(config);
    await fs.writeFile(path.join(outputDir, 'mentorship-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-mentorship',
      version: '1.0.0',
      description: 'Mentorship Matching and Collaboration Tools',
      main: 'mentorship-manager.ts',
      dependencies: {},
      devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonMentorship(config);
    await fs.writeFile(path.join(outputDir, 'mentorship_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pandas>=2.0.0', 'numpy>=1.24.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateMentorshipMD(config);
  await fs.writeFile(path.join(outputDir, 'MENTORSHIP.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    users: config.users,
    programs: config.programs,
    pairs: config.pairs,
    sessions: config.sessions,
    feedbacks: config.feedbacks,
    enableAutoMatching: config.enableAutoMatching,
    enableFeedbackSystem: config.enableFeedbackSystem,
    enableProgressTracking: config.enableProgressTracking,
    matchThreshold: config.matchThreshold,
    sessionReminderHours: config.sessionReminderHours,
  };
  await fs.writeFile(path.join(outputDir, 'mentorship-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided mentorship configuration unchanged. Acts as the canonical
 * entry point/identity helper for producing a `MentorshipConfig` value.
 *
 * @param config - The mentorship configuration to return.
 * @returns The same `MentorshipConfig` instance that was passed in.
 */
export function mentorship(config: MentorshipConfig): MentorshipConfig {
  return config;
}
