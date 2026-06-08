// Auto-generated Interactive Tutorials and Guided Learning Paths Utility
// Generated at: 2026-01-13T14:30:00.000Z

type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type ContentType = 'text' | 'video' | 'interactive' | 'quiz' | 'exercise' | 'project';
type ProgressStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped' | 'failed';
type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading';

interface TutorialContent {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  duration: number; // in minutes
  order: number;
  isRequired: boolean;
  resources?: string[];
}

interface Quiz {
  id: string;
  questions: {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    points: number;
    explanation?: string;
  }[];
  passingScore: number; // percentage
  timeLimit?: number; // in minutes
  attemptsAllowed: number;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  startingCode?: string;
  solutionCode?: string;
  hints: string[];
  difficulty: DifficultyLevel;
  estimatedTime: number; // in minutes
  testCases?: {
    input: any;
    expectedOutput: any;
  }[];
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  content: TutorialContent[];
  quiz?: Quiz;
  exercise?: Exercise;
  order: number;
  dependsOn?: string[]; // step IDs that must be completed first
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: DifficultyLevel;
  estimatedDuration: number; // in hours
  prerequisites: string[];
  learningObjectives: string[];
  targetAudience: string[];
  steps: TutorialStep[];
  tags: string[];
}

interface LearnerProgress {
  learnerId: string;
  learnerName: string;
  pathId: string;
  pathTitle: string;
  currentStepId: string;
  completedSteps: string[];
  quizScores: Map<string, number>; // quizId -> score
  exerciseCompletions: Map<string, boolean>; // exerciseId -> completed
  timeSpent: number; // in minutes
  lastAccessed: Date;
  startedAt: Date;
  completedAt?: Date;
  status: ProgressStatus;
  certificate?: {
    issued: boolean;
    date: Date;
    certificateUrl: string;
  };
  notes: string[];
  bookmarks: string[]; // step IDs
}

interface PersonalizedRecommendation {
  type: 'tutorial' | 'path' | 'content' | 'exercise';
  itemId: string;
  title: string;
  reason: string;
  relevanceScore: number; // 0-100
  estimatedDuration: number; // in minutes
  difficulty: DifficultyLevel;
}

interface InteractiveTutorialsConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  learningPaths: LearningPath[];
  learnerProgress: LearnerProgress[];
  recommendations: PersonalizedRecommendation[];
  enableProgressTracking: boolean;
  enablePersonalizedRecommendations: boolean;
  enableCertificates: boolean;
  enableBookmarking: boolean;
  enableNotes: boolean;
  defaultLearningStyle: LearningStyle;
  maxRetries: number;
  passingScoreThreshold: number; // percentage
}

export function displayConfig(config: InteractiveTutorialsConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '📚 Interactive Tutorials and Guided Learning Paths');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Learning Paths:', config.learningPaths.length);
  console.log('\x1b[33m%s\x1b[0m', 'Learner Progress:', config.learnerProgress.length);
  console.log('\x1b[33m%s\x1b[0m', 'Recommendations:', config.recommendations.length);
  console.log('\x1b[33m%s\x1b[0m', 'Progress Tracking:', config.enableProgressTracking ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Personalized Recommendations:', config.enablePersonalizedRecommendations ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Certificates:', config.enableCertificates ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Passing Score Threshold:', config.passingScoreThreshold + '%');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateInteractiveTutorialsMD(config: InteractiveTutorialsConfig): string {
  let md = '# Interactive Tutorials and Guided Learning Paths\n\n';
  md += '## Features\n\n';
  md += '- Multiple content types: text, video, interactive, quiz, exercise, project\n';
  md += '- Difficulty levels: beginner, intermediate, advanced, expert\n';
  md += '- Learning styles: visual, auditory, kinesthetic, reading\n';
  md += '- Progress tracking with detailed status\n';
  md += '- Quiz and exercise completion tracking\n';
  md += '- Personalized recommendations based on learning history\n';
  md += '- Certificate generation upon completion\n';
  md += '- Bookmarking and note-taking features\n';
  md += '- Step dependencies and prerequisites\n';
  md += '- Time tracking per learner\n';
  md += '- Multi-attempt quiz support\n';
  md += '- Code exercises with test cases\n';
  md += '- Hints and solutions for exercises\n';
  md += '- Learning objectives and target audience\n';
  md += '- Tag-based content discovery\n';
  md += '- Multi-cloud provider support\n\n';
  md += '## Learning Path Structure\n\n';
  md += '### Steps\n';
  md += 'Each learning path consists of multiple steps that can include:\n';
  md += '- **Tutorial Content**: Text, video, or interactive material\n';
  md += '- **Quizzes**: Multiple-choice questions with scoring\n';
  md += '- **Exercises**: Coding challenges with test cases\n';
  md += '- **Projects**: Real-world applications\n\n';
  md += '### Progress Tracking\n';
  md += '- Time spent on each step\n';
  md += '- Quiz scores and attempts\n';
  md += '- Exercise completion status\n';
  md += '- Overall progress percentage\n';
  md += '- Certificates for completed paths\n\n';
  return md;
}

export function generateTerraformInteractiveTutorials(config: InteractiveTutorialsConfig): string {
  let code = '# Auto-generated Interactive Tutorials Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

export function generateTypeScriptInteractiveTutorials(config: InteractiveTutorialsConfig): string {
  let code = '// Auto-generated Interactive Tutorials Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'interface TutorialStep {\n';
  code += '  id: string;\n';
  code += '  title: string;\n';
  code += '  description: string;\n';
  code += '  order: number;\n';
  code += '  dependsOn?: string[];\n';
  code += '}\n\n';
  code += 'interface LearnerProgress {\n';
  code += '  learnerId: string;\n';
  code += '  learnerName: string;\n';
  code += '  pathId: string;\n';
  code += '  currentStepId: string;\n';
  code += '  completedSteps: string[];\n';
  code += '  timeSpent: number;\n';
  code += '  status: string;\n';
  code += '}\n\n';
  code += 'class InteractiveTutorialsManager extends EventEmitter {\n';
  code += '  private learningPaths: Map<string, any> = new Map();\n';
  code += '  private learnerProgress: Map<string, LearnerProgress> = new Map();\n';
  code += '  private enableProgressTracking: boolean;\n';
  code += '  private passingScoreThreshold: number;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.enableProgressTracking = options.enableProgressTracking !== false;\n';
  code += '    this.passingScoreThreshold = options.passingScoreThreshold || 70;\n';
  code += '  }\n\n';
  code += '  addLearningPath(path: any): void {\n';
  code += '    this.learningPaths.set(path.id, path);\n';
  code += '    this.emit(\'path-added\', path);\n';
  code += '  }\n\n';
  code += '  enrollLearner(learnerId: string, pathId: string): LearnerProgress {\n';
  code += '    const path = this.learningPaths.get(pathId);\n';
  code += '    if (!path) {\n';
  code += '      throw new Error(`Learning path not found: ${pathId}`);\n';
  code += '    }\n\n';
  code += '    const progress: LearnerProgress = {\n';
  code += '      learnerId,\n';
  code += '      learnerName: \'\',\n';
  code += '      pathId,\n';
  code += '      pathTitle: path.title,\n';
  code += '      currentStepId: path.steps[0]?.id || \'\',\n';
  code += '      completedSteps: [],\n';
  code += '      quizScores: new Map(),\n';
  code += '      exerciseCompletions: new Map(),\n';
  code += '      timeSpent: 0,\n';
  code += '      lastAccessed: new Date(),\n';
  code += '      startedAt: new Date(),\n';
  code += '      status: \'in-progress\',\n';
  code += '      notes: [],\n';
  code += '      bookmarks: [],\n';
  code += '    };\n\n';
  code += '    this.learnerProgress.set(`${learnerId}-${pathId}`, progress);\n';
  code += '    this.emit(\'learner-enrolled\', { learnerId, pathId });\n\n';
  code += '    return progress;\n';
  code += '  }\n\n';
  code += '  updateProgress(learnerId: string, pathId: string, stepId: string, timeSpent: number): void {\n';
  code += '    if (!this.enableProgressTracking) return;\n\n';
  code += '    const key = `${learnerId}-${pathId}`;\n';
  code += '    const progress = this.learnerProgress.get(key);\n';
  code += '    if (!progress) return;\n\n';
  code += '    if (!progress.completedSteps.includes(stepId)) {\n';
  code += '      progress.completedSteps.push(stepId);\n';
  code += '    }\n\n';
  code += '    progress.timeSpent += timeSpent;\n';
  code += '    progress.lastAccessed = new Date();\n\n';
  code += '    const path = this.learningPaths.get(pathId);\n';
  code += '    if (path) {\n';
  code += '      const allSteps = path.steps;\n';
  code += '      const nextStep = allSteps.find(step => \n';
  code += '        !progress.completedSteps.includes(step.id) &&\n';
  code += '        this.checkPrerequisites(step, progress.completedSteps)\n';
  code += '      );\n\n';
  code += '      if (nextStep) {\n';
  code += '        progress.currentStepId = nextStep.id;\n';
  code += '      } else if (progress.completedSteps.length === allSteps.length) {\n';
  code += '        progress.status = \'completed\';\n';
  code += '        progress.completedAt = new Date();\n';
  code += '        this.emit(\'path-completed\', { learnerId, pathId });\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    this.emit(\'progress-updated\', { learnerId, pathId, stepId });\n';
  code += '  }\n\n';
  code += '  private checkPrerequisites(step: TutorialStep, completedSteps: string[]): boolean {\n';
  code += '    if (!step.dependsOn || step.dependsOn.length === 0) return true;\n';
  code += '    return step.dependsOn.every(depId => completedSteps.includes(depId));\n';
  code += '  }\n\n';
  code += '  recordQuizScore(learnerId: string, pathId: string, quizId: string, score: number): void {\n';
  code += '    const key = `${learnerId}-${pathId}`;\n';
  code += '    const progress = this.learnerProgress.get(key);\n';
  code += '    if (!progress) return;\n\n';
  code += '    progress.quizScores.set(quizId, score);\n';
  code += '    this.emit(\'quiz-completed\', { learnerId, pathId, quizId, score });\n';
  code += '  }\n\n';
  code += '  getProgress(learnerId: string, pathId: string): any {\n';
  code += '    const key = `${learnerId}-${pathId}`;\n';
  code += '    const progress = this.learnerProgress.get(key);\n';
  code += '    if (!progress) return null;\n\n';
  code += '    const path = this.learningPaths.get(pathId);\n';
  code += '    const totalSteps = path?.steps.length || 0;\n';
  code += '    const completedCount = progress.completedSteps.length;\n';
  code += '    const percentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;\n\n';
  code += '    return {\n';
  code += '      ...progress,\n';
  code += '      percentage,\n';
  code += '      totalSteps,\n';
  code += '      remainingSteps: totalSteps - completedCount,\n';
  code += '    };\n';
  code += '  }\n\n';
  code += '  generateCertificate(learnerId: string, pathId: string): any {\n';
  code += '    const progress = this.getProgress(learnerId, pathId);\n';
  code += '    if (!progress || progress.status !== \'completed\') {\n';
  code += '      throw new Error(\'Path not completed\');\n';
  code += '    }\n\n';
  code += '    const certificate = {\n';
  code += '      id: `cert-${Date.now()}`,\n';
  code += '      learnerId,\n';
  code += '      pathId,\n';
  code += '      pathTitle: progress.pathTitle,\n';
  code += '      issuedAt: new Date(),\n';
  code += '      certificateUrl: `https://certificates.example.com/${learnerId}/${pathId}`,\n';
  code += '    };\n\n';
  code += '    this.emit(\'certificate-issued\', { learnerId, pathId, certificate });\n';
  code += '    return certificate;\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const interactiveTutorialsManager = new InteractiveTutorialsManager({\n';
  code += '  enableProgressTracking: ' + config.enableProgressTracking + ',\n';
  code += '  passingScoreThreshold: ' + config.passingScoreThreshold + ',\n';
  code += '});\n';
  code += 'export default interactiveTutorialsManager;\n';
  return code;
}

export function generatePythonInteractiveTutorials(config: InteractiveTutorialsConfig): string {
  let code = '# Auto-generated Interactive Tutorials Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'from typing import Dict, List, Any, Optional\n';
  code += 'from dataclasses import dataclass, field\n';
  code += 'from datetime import datetime\n';
  code += 'from enum import Enum\n\n';
  code += 'class ProgressStatus(Enum):\n';
  code += '    NOT_STARTED = "not-started"\n';
  code += '    IN_PROGRESS = "in-progress"\n';
  code += '    COMPLETED = "completed"\n';
  code += '    SKIPPED = "skipped"\n';
  code += '    FAILED = "failed"\n\n';
  code += '@dataclass\n';
  code += 'class LearnerProgress:\n';
  code += '    learner_id: str\n';
  code += '    learner_name: str\n';
  code += '    path_id: str\n';
  code += '    path_title: str\n';
  code += '    current_step_id: str\n';
  code += '    completed_steps: List[str] = field(default_factory=list)\n';
  code += '    quiz_scores: Dict[str, float] = field(default_factory=dict)\n';
  code += '    exercise_completions: Dict[str, bool] = field(default_factory=dict)\n';
  code += '    time_spent: float = 0\n';
  code += '    last_accessed: datetime = None\n';
  code += '    started_at: datetime = None\n';
  code += '    completed_at: Optional[datetime] = None\n';
  code += '    status: str = "not-started"\n';
  code += '    notes: List[str] = field(default_factory=list)\n';
  code += '    bookmarks: List[str] = field(default_factory=list)\n\n';
  code += 'class InteractiveTutorialsManager:\n';
  code += '    def __init__(self, project_name: str = \'' + config.projectName + '\'):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.learning_paths: Dict[str, Any] = {}\n';
  code += '        self.learner_progress: Dict[str, LearnerProgress] = {}\n';
  code += '        self.enable_progress_tracking = ' + (config.enableProgressTracking ? 'True' : 'False') + '\n';
  code += '        self.passing_score_threshold = ' + config.passingScoreThreshold + '\n\n';
  code += '    def add_learning_path(self, path: Any) -> None:\n';
  code += '        self.learning_paths[path[\'id\']] = path\n\n';
  code += '    def enroll_learner(self, learner_id: str, path_id: str) -> LearnerProgress:\n';
  code += '        path = self.learning_paths.get(path_id)\n';
  code += '        if not path:\n';
  code += '            raise ValueError(f"Learning path not found: {path_id}")\n\n';
  code += '        progress = LearnerProgress(\n';
  code += '            learner_id=learner_id,\n';
  code += '            learner_name="",\n';
  code += '            path_id=path_id,\n';
  code += '            path_title=path[\'title\'],\n';
  code += '            current_step_id=path[\'steps\'][0][\'id\'] if path[\'steps\'] else \'\',\n';
  code += '            time_spent=0,\n';
  code += '            last_accessed=datetime.now(),\n';
  code += '            started_at=datetime.now(),\n';
  code += '            status="in-progress",\n';
  code += '        )\n\n';
  code += '        self.learner_progress[f"{learner_id}-{path_id}"] = progress\n';
  code += '        return progress\n\n';
  code += '    def update_progress(self, learner_id: str, path_id: str, step_id: str, time_spent: float) -> None:\n';
  code += '        if not self.enable_progress_tracking:\n';
  code += '            return\n\n';
  code += '        key = f"{learner_id}-{path_id}"\n';
  code += '        progress = self.learner_progress.get(key)\n';
  code += '        if not progress:\n';
  code += '            return\n\n';
  code += '        if step_id not in progress.completed_steps:\n';
  code += '            progress.completed_steps.append(step_id)\n\n';
  code += '        progress.time_spent += time_spent\n';
  code += '        progress.last_accessed = datetime.now()\n\n';
  code += '        path = self.learning_paths.get(path_id)\n';
  code += '        if path:\n';
  code += '            all_steps = path.get(\'steps\', [])\n';
  code += '            completed_count = len(progress.completed_steps)\n\n';
  code += '            if completed_count == len(all_steps):\n';
  code += '                progress.status = "completed"\n';
  code += '                progress.completed_at = datetime.now()\n\n';
  code += '    def record_quiz_score(self, learner_id: str, path_id: str, quiz_id: str, score: float) -> None:\n';
  code += '        key = f"{learner_id}-{path_id}"\n';
  code += '        progress = self.learner_progress.get(key)\n';
  code += '        if progress:\n';
  code += '            progress.quiz_scores[quiz_id] = score\n\n';
  code += '    def get_progress(self, learner_id: str, path_id: str) -> Optional[Dict[str, Any]]:\n';
  code += '        key = f"{learner_id}-{path_id}"\n';
  code += '        progress = self.learner_progress.get(key)\n';
  code += '        if not progress:\n';
  code += '            return None\n\n';
  code += '        path = self.learning_paths.get(path_id)\n';
  code += '        total_steps = len(path.get(\'steps\', [])) if path else 0\n';
  code += '        completed_count = len(progress.completed_steps)\n';
  code += '        percentage = round((completed_count / total_steps) * 100) if total_steps > 0 else 0\n\n';
  code += '        return {\n';
  code += '            \'learner_id\': progress.learner_id,\n';
  code += '            \'path_title\': progress.path_title,\n';
  code += '            \'status\': progress.status,\n';
  code += '            \'percentage\': percentage,\n';
  code += '            \'total_steps\': total_steps,\n';
  code += '            \'completed_steps\': completed_count,\n';
  code += '            \'remaining_steps\': total_steps - completed_count,\n';
  code += '            \'time_spent\': progress.time_spent,\n';
  code += '        }\n\n';
  code += '    def generate_certificate(self, learner_id: str, path_id: str) -> Dict[str, Any]:\n';
  code += '        progress = self.get_progress(learner_id, path_id)\n';
  code += '        if not progress or progress.get(\'status\') != \'completed\':\n';
  code += '            raise ValueError(\'Path not completed\')\n\n';
  code += '        return {\n';
  code += '            \'id\': f"cert-{int(datetime.now().timestamp())}",\n';
  code += '            \'learner_id\': learner_id,\n';
  code += '            \'path_id\': path_id,\n';
  code += '            \'path_title\': progress.get(\'path_title\'),\n';
  code += '            \'issued_at\': datetime.now(),\n';
  code += '            \'certificate_url\': f"https://certificates.example.com/{learner_id}/{path_id}",\n';
  code += '        }\n\n';
  code += 'interactive_tutorials_manager = InteractiveTutorialsManager()\n';
  return code;
}

export async function writeFiles(config: InteractiveTutorialsConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformInteractiveTutorials(config);
  await fs.writeFile(path.join(outputDir, 'interactive-tutorials.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptInteractiveTutorials(config);
    await fs.writeFile(path.join(outputDir, 'interactive-tutorials-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-interactive-tutorials',
      version: '1.0.0',
      description: 'Interactive Tutorials and Guided Learning Paths',
      main: 'interactive-tutorials-manager.ts',
      dependencies: {},
      devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonInteractiveTutorials(config);
    await fs.writeFile(path.join(outputDir, 'interactive_tutorials_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pandas>=2.0.0', 'numpy>=1.24.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateInteractiveTutorialsMD(config);
  await fs.writeFile(path.join(outputDir, 'INTERACTIVE_TUTORIALS.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    learningPaths: config.learningPaths,
    learnerProgress: config.learnerProgress,
    recommendations: config.recommendations,
    enableProgressTracking: config.enableProgressTracking,
    enablePersonalizedRecommendations: config.enablePersonalizedRecommendations,
    enableCertificates: config.enableCertificates,
    enableBookmarking: config.enableBookmarking,
    enableNotes: config.enableNotes,
    defaultLearningStyle: config.defaultLearningStyle,
    maxRetries: config.maxRetries,
    passingScoreThreshold: config.passingScoreThreshold,
  };
  await fs.writeFile(path.join(outputDir, 'interactive-tutorials-config.json'), JSON.stringify(configJson, null, 2));
}

export function interactiveTutorials(config: InteractiveTutorialsConfig): InteractiveTutorialsConfig {
  return config;
}
