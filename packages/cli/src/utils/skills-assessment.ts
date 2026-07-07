// Auto-generated Skills Assessment Utility
// Generated at: 2026-01-13T14:25:00.000Z

import chalk from 'chalk';

/**
 * The category that a tracked skill belongs to.
 */
type SkillCategory = 'technical' | 'soft' | 'domain' | 'tools' | 'processes';

/**
 * The proficiency level of a skill, ordered from least to most advanced.
 */
type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * The lifecycle status of a certification.
 */
type CertificationStatus = 'none' | 'in-progress' | 'completed';

/**
 * The delivery format of a learning resource.
 */
type LearningFormat = 'online' | 'in-person' | 'self-paced' | 'mentored' | 'workshop';

/**
 * Represents an individual skill being tracked for a developer.
 */
interface Skill {
  /** Unique identifier for the skill. */
  id: string;
  /** Human-readable name of the skill. */
  name: string;
  /** Category the skill belongs to. */
  category: SkillCategory;
  /** The developer's current proficiency level for the skill. */
  currentLevel: SkillLevel;
  /** The proficiency level the developer is aiming to reach. */
  targetLevel: SkillLevel;
  /** Importance of the skill on a scale from 1 to 10. */
  importance: number; // 1-10
  /** Timestamp (epoch milliseconds) when the skill was last assessed. */
  lastAssessed: number;
}

/**
 * Represents a resource that can be used to learn or improve a skill.
 */
interface LearningResource {
  /** Unique identifier for the resource. */
  id: string;
  /** Identifier of the skill this resource helps develop. */
  skillId: string;
  /** Display title of the resource. */
  title: string;
  /** Name of the organization providing the resource. */
  provider: string;
  /** Delivery format of the resource. */
  format: LearningFormat;
  /** Estimated time required to complete the resource, in hours. */
  duration: number; // in hours
  /** Monetary cost of the resource. */
  cost: number;
  /** URL where the resource can be accessed. */
  url: string;
  /** User/provider rating of the resource on a scale from 1 to 5. */
  rating: number; // 1-5
}

/**
 * Represents a certification associated with a skill.
 */
interface Certification {
  /** Unique identifier for the certification. */
  id: string;
  /** Identifier of the skill this certification validates. */
  skillId: string;
  /** Display name of the certification. */
  name: string;
  /** Organization that issues the certification. */
  issuer: string;
  /** Current status of the certification. */
  status: CertificationStatus;
  /** Optional timestamp (epoch milliseconds) when the certification expires. */
  expiryDate?: number;
  /** Whether the certification has been verified by the issuer. */
  verified: boolean;
}

/**
 * A curated learning plan for a developer, including skills, resources, and certifications.
 */
interface LearningPath {
  /** Unique identifier of the developer this path belongs to. */
  developerId: string;
  /** Display name of the developer. */
  developerName: string;
  /** Skills included in the learning path. */
  skills: Skill[];
  /** Resources recommended for the skills in this path. */
  recommendedResources: LearningResource[];
  /** Certifications targeted or completed within this path. */
  certifications: Certification[];
  /** Estimated time to complete the path, in months. */
  estimatedCompletion: number; // in months
  /** Priority of the learning path. */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Configuration object for the skills assessment utility.
 */
interface SkillsAssessmentConfig {
  /** Name of the project the assessment is associated with. */
  projectName: string;
  /** Cloud providers covered by the assessment. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Learning paths tracked under this configuration. */
  learningPaths: LearningPath[];
  /** Whether automated skill assessment is enabled. */
  enableAutoAssessment: boolean;
  /** Whether progress tracking is enabled. */
  enableProgressTracking: boolean;
  /** Whether resource recommendations are enabled. */
  enableRecommendations: boolean;
}

/**
 * Prints a human-readable summary of the skills assessment configuration to the console.
 *
 * @param config - The skills assessment configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: SkillsAssessmentConfig): void {
  console.log(chalk.cyan('🎓 Skills Assessment and Learning Path Recommendations'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Learning Paths:'), config.learningPaths.length);
  console.log(chalk.yellow('Auto Assessment:'), config.enableAutoAssessment ? 'Yes' : 'No');
  console.log(chalk.yellow('Progress Tracking:'), config.enableProgressTracking ? 'Yes' : 'No');
  console.log(chalk.yellow('Recommendations:'), config.enableRecommendations ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the features of the skills assessment.
 *
 * @param config - The skills assessment configuration used to scope the document.
 * @returns A Markdown string summarizing the skills assessment features.
 */
export function generateSkillsAssessmentMD(config: SkillsAssessmentConfig): string {
  let md = '# Skills Assessment and Learning Path Recommendations with Certifications\n\n';
  md += '## Features\n\n';
  md += '- Skill categories: technical, soft, domain, tools, processes\n';
  md += '- Skill levels: beginner, intermediate, advanced, expert\n';
  md += '- Current vs target skill level tracking\n';
  md += '- Importance scoring (1-10)\n';
  md += '- Learning resource recommendations\n';
  md += '- Multiple learning formats: online, in-person, self-paced, mentored, workshop\n';
  md += '- Certification tracking with status and expiry\n';
  md += '- Learning path generation with priorities\n';
  md += '- Estimated completion time in months\n';
  md += '- Cost and duration tracking\n';
  md += '- Provider and rating information\n';
  md += '- Automated skill assessment\n';
  md += '- Progress monitoring\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a minimal Terraform header stub for the skills assessment.
 *
 * @param config - The skills assessment configuration providing the project name.
 * @returns A Terraform-formatted string containing a generated header comment.
 */
export function generateTerraformSkillsAssessment(config: SkillsAssessmentConfig): string {
  let code = '# Auto-generated Skills Assessment Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript stub module that instantiates a `SkillsAssessmentManager`.
 *
 * @param config - The skills assessment configuration providing the project name.
 * @returns A TypeScript source string defining a default-exported manager instance.
 */
export function generateTypeScriptSkillsAssessment(config: SkillsAssessmentConfig): string {
  let code = '// Auto-generated Skills Assessment Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class SkillsAssessmentManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const skillsAssessmentManager = new SkillsAssessmentManager();\n';
  code += 'export default skillsAssessmentManager;\n';
  return code;
}

/**
 * Generates a Python stub module that instantiates a `SkillsAssessmentManager`.
 *
 * @param config - The skills assessment configuration providing the project name.
 * @returns A Python source string defining a `SkillsAssessmentManager` instance.
 */
export function generatePythonSkillsAssessment(config: SkillsAssessmentConfig): string {
  let code = '# Auto-generated Skills Assessment Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class SkillsAssessmentManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'skills_assessment_manager = SkillsAssessmentManager()\n';
  return code;
}

/**
 * Writes the generated skills assessment artifacts to disk.
 *
 * The output includes Terraform, Markdown, a language-specific manager module
 * (TypeScript or Python), dependency manifests, and a JSON configuration file.
 *
 * @param config - The skills assessment configuration to materialize.
 * @param outputDir - Directory where the generated files will be written. Created if missing.
 * @param language - Target language for the manager module; `'typescript'` produces TS artifacts, anything else produces Python artifacts.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeFiles(config: SkillsAssessmentConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformSkillsAssessment(config);
  await fs.writeFile(path.join(outputDir, 'skills-assessment.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptSkillsAssessment(config);
    await fs.writeFile(path.join(outputDir, 'skills-assessment-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-skills-assessment',
      version: '1.0.0',
      description: 'Skills Assessment and Learning Path Recommendations',
      main: 'skills-assessment-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonSkillsAssessment(config);
    await fs.writeFile(path.join(outputDir, 'skills_assessment_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pandas>=2.0.0', 'scikit-learn>=1.2.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateSkillsAssessmentMD(config);
  await fs.writeFile(path.join(outputDir, 'SKILLS_ASSESSMENT.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    learningPaths: config.learningPaths,
    enableAutoAssessment: config.enableAutoAssessment,
    enableProgressTracking: config.enableProgressTracking,
    enableRecommendations: config.enableRecommendations,
  };
  await fs.writeFile(path.join(outputDir, 'skills-assessment-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided skills assessment configuration unchanged.
 *
 * This acts as a passthrough/identity accessor for the configuration object.
 *
 * @param config - The skills assessment configuration to return.
 * @returns The same `config` instance that was passed in.
 */
export function skillsAssessment(config: SkillsAssessmentConfig): SkillsAssessmentConfig {
  return config;
}
