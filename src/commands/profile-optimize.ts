import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { EnvironmentProfile, loadProfileConfig, saveProfileConfig } from './profile';
import { ProfileAnalytics, generateProfileInsights } from './profile-analytics';

/**
 * Profile optimization recommendations
 * Analyze usage patterns and provide actionable optimization suggestions
 */

export interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'security' | 'maintainability' | 'usage' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'easy' | 'medium' | 'hard';
  recommendation: string;
  code?: string; // Suggested configuration changes
  estimatedSavings?: string; // Performance or storage savings
}

export interface OptimizationReport {
  profileName: string;
  totalRecommendations: number;
  categories: Record<string, number>;
  bySeverity: Record<string, number>;
  recommendations: OptimizationRecommendation[];
  overallScore: number; // 0-100
  optimizedAt: string;
}

/**
 * Generate optimization recommendations for a profile
 */
export async function generateOptimizations(profileName: string): Promise<OptimizationReport> {
  const config = await loadProfileConfig();
  const profile = config.profiles[profileName];

  if (!profile) {
    throw new Error(`Profile "${profileName}" not found`);
  }

  const recommendations: OptimizationRecommendation[] = [];
  const categories: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  // Performance optimizations
  const perfRecs = analyzePerformanceOptimizations(profile);
  recommendations.push(...perfRecs);

  // Security optimizations
  const secRecs = analyzeSecurityOptimizations(profile);
  recommendations.push(...secRecs);

  // Maintainability optimizations
  const maintRecs = analyzeMaintainabilityOptimizations(profile);
  recommendations.push(...maintRecs);

  // Usage pattern optimizations
  const usageRecs = await analyzeUsageOptimizations(profileName, profile);
  recommendations.push(...usageRecs);

  // Configuration optimizations
  const configRecs = analyzeConfigurationOptimizations(profile);
  recommendations.push(...configRecs);

  // Categorize recommendations
  for (const rec of recommendations) {
    categories[rec.category] = (categories[rec.category] || 0) + 1;
    bySeverity[rec.severity] = (bySeverity[rec.severity] || 0) + 1;
  }

  // Calculate overall score
  const overallScore = calculateOptimizationScore(profile, recommendations);

  return {
    profileName,
    totalRecommendations: recommendations.length,
    categories,
    bySeverity,
    recommendations,
    overallScore,
    optimizedAt: new Date().toISOString(),
  };
}

/**
 * Apply optimization recommendations
 */
export async function applyOptimizations(
  profileName: string,
  recommendationIds: string[]
): Promise<void> {
  const report = await generateOptimizations(profileName);
  const toApply = report.recommendations.filter(r => recommendationIds.includes(r.id));

  if (toApply.length === 0) {
    console.log(chalk.yellow('\n⚠ No valid recommendations to apply\n'));
    return;
  }

  console.log(chalk.cyan.bold(`\n🔧 Applying ${toApply.length} optimization(s) to "${profileName}"\n`));

  const config = await loadProfileConfig();
  const profile = config.profiles[profileName];

  let applied = 0;
  let skipped = 0;

  for (const rec of toApply) {
    try {
      const result = applyRecommendation(profile, rec);

      if (result.applied) {
        console.log(chalk.green(`✓ ${rec.title}`));
        if (result.description) {
          console.log(chalk.gray(`  ${result.description}`));
        }
        applied++;
      } else {
        console.log(chalk.yellow(`⚠ ${rec.title}`));
        console.log(chalk.gray(`  ${result.description}`));
        skipped++;
      }
    } catch (error: any) {
      console.log(chalk.red(`✗ ${rec.title}`));
      console.log(chalk.gray(`  Error: ${error.message}`));
      skipped++;
    }
  }

  // Save updated profile
  if (applied > 0) {
    await saveProfileConfig(config);
    console.log(chalk.green(`\n✓ Applied ${applied}/${toApply.length} optimization(s)\n`));
  } else {
    console.log(chalk.yellow('\n⚠ No optimizations were applied\n'));
  }

  if (skipped > 0) {
    console.log(chalk.gray(`Skipped: ${skipped}\n`));
  }
}

/**
 * Show optimization report
 */
export async function showOptimizationReport(profileName: string): Promise<void> {
  const report = await generateOptimizations(profileName);

  console.log(chalk.cyan.bold(`\n📊 Optimization Report for "${profileName}"\n`));

  // Overall score
  const scoreColor = report.overallScore >= 80 ? chalk.green :
                    report.overallScore >= 60 ? chalk.yellow :
                    chalk.red;

  console.log(chalk.white('Overall Optimization Score:'));
  console.log(scoreColor(`  ${report.overallScore}/100`));

  if (report.overallScore >= 80) {
    console.log(chalk.gray('  ✨ Well optimized!\n'));
  } else if (report.overallScore >= 60) {
    console.log(chalk.gray('  → Room for improvement\n'));
  } else {
    console.log(chalk.gray('  ⚠️  Needs attention\n'));
  }

  // Summary
  console.log(chalk.white('Summary:'));
  console.log(chalk.gray(`  Total recommendations: ${report.totalRecommendations}\n`));

  console.log(chalk.white('By Category:'));
  for (const [category, count] of Object.entries(report.categories)) {
    const icon = getCategoryIcon(category);
    console.log(chalk.gray(`  ${icon} ${category}: ${count}`));
  }
  console.log('');

  console.log(chalk.white('By Severity:'));
  for (const [severity, count] of Object.entries(report.bySeverity)) {
    const icon = getSeverityIcon(severity);
    console.log(chalk.gray(`  ${icon} ${severity}: ${count}`));
  }
  console.log('');

  // Detailed recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.cyan.bold('Recommendations:\n'));

    // Group by severity
    const critical = report.recommendations.filter(r => r.severity === 'critical');
    const high = report.recommendations.filter(r => r.severity === 'high');
    const medium = report.recommendations.filter(r => r.severity === 'medium');
    const low = report.recommendations.filter(r => r.severity === 'low');

    if (critical.length > 0) printRecommendations(critical);
    if (high.length > 0) printRecommendations(high);
    if (medium.length > 0) printRecommendations(medium);
    if (low.length > 0) printRecommendations(low);
  } else {
    console.log(chalk.cyan('✨ No optimization recommendations!\n'));
    console.log(chalk.gray('Your profile is well configured.\n'));
  }
}

/**
 * Auto-optimize profile (apply safe optimizations automatically)
 */
export async function autoOptimizeProfile(profileName: string): Promise<void> {
  const report = await generateOptimizations(profileName);

  // Filter safe, easy optimizations
  const safeOptimizations = report.recommendations.filter(
    r => r.effort === 'easy' && r.severity !== 'critical'
  );

  if (safeOptimizations.length === 0) {
    console.log(chalk.cyan('\n✨ No safe automatic optimizations available\n'));
    return;
  }

  console.log(chalk.cyan.bold(`\n🤖 Auto-optimizing "${profileName}"\n`));
  console.log(chalk.gray(`Found ${safeOptimizations.length} safe optimization(s)\n`));

  const { value: confirmed } = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Apply these optimizations?',
    initial: true,
  });

  if (!confirmed) {
    console.log(chalk.yellow('\n✖ Auto-optimization cancelled\n'));
    return;
  }

  await applyOptimizations(profileName, safeOptimizations.map(r => r.id));
}

/**
 * Helper functions
 */

function analyzePerformanceOptimizations(profile: EnvironmentProfile): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Check build optimization
  if (profile.config.build) {
    if (profile.environment === 'production' && !profile.config.build.optimize) {
      recommendations.push({
        id: 'perf-build-optimize',
        category: 'performance',
        severity: 'high',
        title: 'Enable build optimizations for production',
        description: 'Production builds should have optimizations enabled',
        impact: 'Faster builds and smaller bundle sizes',
        effort: 'easy',
        recommendation: 'Set build.optimize to true in production',
        code: 'build:\n  optimize: true',
        estimatedSavings: '20-40% bundle size reduction',
      });
    }

    if (profile.environment === 'development' && profile.config.build.minify) {
      recommendations.push({
        id: 'perf-dev-minify',
        category: 'performance',
        severity: 'medium',
        title: 'Disable minification in development',
        description: 'Minification slows down development builds',
        impact: 'Faster development rebuilds',
        effort: 'easy',
        recommendation: 'Set build.minify to false in development',
        code: 'build:\n  minify: false',
        estimatedSavings: '30-50% faster rebuilds',
      });
    }

    if (profile.environment === 'development' && profile.config.build.sourcemap === false) {
      recommendations.push({
        id: 'perf-dev-sourcemap',
        category: 'performance',
        severity: 'medium',
        title: 'Enable sourcemaps in development',
        description: 'Sourcemaps improve debugging experience',
        impact: 'Better debugging and error tracking',
        effort: 'easy',
        recommendation: 'Set build.sourcemap to true in development',
        code: 'build:\n  sourcemap: true',
      });
    }
  }

  // Check dev server HMR
  if (profile.config.dev && profile.environment === 'development') {
    if (profile.config.dev.hmr === false) {
      recommendations.push({
        id: 'perf-dev-hmr',
        category: 'performance',
        severity: 'high',
        title: 'Enable Hot Module Replacement',
        description: 'HMR dramatically improves development experience',
        impact: 'Faster iteration and better UX',
        effort: 'easy',
        recommendation: 'Set dev.hmr to true',
        code: 'dev:\n  hmr: true',
        estimatedSavings: '2-5x faster updates',
      });
    }
  }

  return recommendations;
}

function analyzeSecurityOptimizations(profile: EnvironmentProfile): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Check for secrets in environment variables
  if (profile.config.env) {
    const secretKeys = Object.keys(profile.config.env).filter(key =>
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token')
    );

    if (secretKeys.length > 0) {
      recommendations.push({
        id: 'sec-secrets-in-profile',
        category: 'security',
        severity: 'critical',
        title: 'Secrets found in profile configuration',
        description: `Profile contains ${secretKeys.length} potential secret(s): ${secretKeys.join(', ')}`,
        impact: 'Security vulnerability if profile is committed to version control',
        effort: 'medium',
        recommendation: 'Move secrets to encrypted environment storage',
        code: '# Use: re-shell profile env add <profile> <name> <value> --encrypt',
      });
    }
  }

  // Check CORS configuration
  if (profile.config.dev) {
    if (profile.config.dev.cors === true && profile.environment === 'production') {
      recommendations.push({
        id: 'sec-cors-production',
        category: 'security',
        severity: 'high',
        title: 'Review CORS configuration for production',
        description: 'Wide-open CORS in production can be a security risk',
        impact: 'Prevent unauthorized cross-origin requests',
        effort: 'medium',
        recommendation: 'Configure specific CORS origins',
        code: 'dev:\n  cors:\n    origin: https://yourdomain.com',
      });
    }
  }

  return recommendations;
}

function analyzeMaintainabilityOptimizations(profile: EnvironmentProfile): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Check for description
  if (!profile.description) {
    recommendations.push({
      id: 'maint-description',
      category: 'maintainability',
      severity: 'low',
      title: 'Add profile description',
      description: 'Profiles should have clear descriptions',
      impact: 'Better profile discoverability',
      effort: 'easy',
      recommendation: 'Add a description explaining the profile\'s purpose',
    });
  }

  // Check for unused scripts
  if (profile.config.scripts && Object.keys(profile.config.scripts).length > 20) {
    recommendations.push({
      id: 'maint-too-many-scripts',
      category: 'maintainability',
      severity: 'medium',
      title: 'Too many scripts defined',
      description: `Profile has ${Object.keys(profile.config.scripts).length} scripts`,
      impact: 'Maintenance complexity',
      effort: 'medium',
      recommendation: 'Consider moving scripts to package.json or separate files',
      estimatedSavings: 'Cleaner profile structure',
    });
  }

  // Check for very long inheritance chains
  if (profile.extends && profile.extends.length > 3) {
    recommendations.push({
      id: 'maint-long-inheritance',
      category: 'maintainability',
      severity: 'medium',
      title: 'Long inheritance chain',
      description: `Profile extends ${profile.extends.length} other profiles`,
      impact: 'Complex inheritance can be hard to understand',
      effort: 'hard',
      recommendation: 'Simplify inheritance chain or consolidate profiles',
    });
  }

  return recommendations;
}

async function analyzeUsageOptimizations(
  profileName: string,
  profile: EnvironmentProfile
): Promise<OptimizationRecommendation[]> {
  const recommendations: OptimizationRecommendation[] = [];

  try {
    // Import insights from analytics
    const insights = await generateProfileInsights(profileName);

    for (const insight of insights) {
      if (insight.type === 'usage' && insight.recommendation) {
        let severity: OptimizationRecommendation['severity'] = 'low';
        if (insight.severity === 'critical') severity = 'critical';
        else if (insight.severity === 'warning') severity = 'high';
        else if (insight.severity === 'suggestion') severity = 'medium';

        recommendations.push({
          id: `usage-${profileName}-${insight.title.toLowerCase().replace(/\s+/g, '-')}`,
          category: 'usage',
          severity,
          title: insight.title,
          description: insight.description,
          impact: insight.impact || 'Better resource utilization',
          effort: 'medium',
          recommendation: insight.recommendation,
        });
      }
    }
  } catch (error) {
    // Analytics not available, skip
  }

  return recommendations;
}

function analyzeConfigurationOptimizations(profile: EnvironmentProfile): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Check for conflicting port settings
  if (profile.config.dev && profile.config.dev.port) {
    const recommendedPorts = {
      development: 3000,
      staging: 3001,
      production: 3002,
    };

    const recommendedPort = recommendedPorts[profile.environment as keyof typeof recommendedPorts];
    if (recommendedPort && profile.config.dev.port !== recommendedPort) {
      recommendations.push({
        id: 'config-port-recommendation',
        category: 'configuration',
        severity: 'low',
        title: 'Non-standard port configuration',
        description: `Port ${profile.config.dev.port} is non-standard for ${profile.environment}`,
        impact: 'Consistent development experience',
        effort: 'easy',
        recommendation: `Consider using port ${recommendedPort} for ${profile.environment}`,
        code: `dev:\n  port: ${recommendedPort}`,
      });
    }
  }

  // Check for missing test configuration
  if (profile.environment === 'production' && !profile.config.test) {
    recommendations.push({
      id: 'config-test-missing',
      category: 'configuration',
      severity: 'medium',
      title: 'Add test configuration',
      description: 'Production profiles should include test settings',
      impact: 'Better test coverage and quality',
      effort: 'medium',
      recommendation: 'Configure test targets and coverage',
      code: 'test:\n  coverage: 80\n  parallel: true\n  timeout: 5000',
    });
  }

  return recommendations;
}

function applyRecommendation(
  profile: EnvironmentProfile,
  rec: OptimizationRecommendation
): { applied: boolean; description: string } {
  switch (rec.id) {
    case 'perf-build-optimize':
      if (profile.config.build) {
        profile.config.build.optimize = true;
        return { applied: true, description: 'Enabled build optimization' };
      }
      break;

    case 'perf-dev-minify':
      if (profile.config.build) {
        profile.config.build.minify = false;
        return { applied: true, description: 'Disabled minification' };
      }
      break;

    case 'perf-dev-sourcemap':
      if (profile.config.build) {
        profile.config.build.sourcemap = true;
        return { applied: true, description: 'Enabled sourcemaps' };
      }
      break;

    case 'perf-dev-hmr':
      if (profile.config.dev) {
        profile.config.dev.hmr = true;
        return { applied: true, description: 'Enabled HMR' };
      }
      break;

    case 'maint-description':
      // Cannot auto-apply (requires user input)
      return { applied: false, description: 'Skipped: Requires user input' };

    default:
      return { applied: false, description: 'Manual application required' };
  }

  return { applied: false, description: 'Could not apply automatically' };
}

function calculateOptimizationScore(profile: EnvironmentProfile, recommendations: OptimizationRecommendation[]): number {
  let score = 100;

  for (const rec of recommendations) {
    switch (rec.severity) {
      case 'critical':
        score -= 20;
        break;
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 2;
        break;
    }
  }

  return Math.max(0, score);
}

function printRecommendations(recommendations: OptimizationRecommendation[]): void {
  for (const rec of recommendations) {
    const severityColor = {
      low: chalk.blue,
      medium: chalk.yellow,
      high: chalk.magenta,
      critical: chalk.red,
    }[rec.severity];

    const severityIcon = getSeverityIcon(rec.severity);
    const categoryIcon = getCategoryIcon(rec.category);

    console.log(severityColor(`${severityIcon} ${rec.title}`));
    console.log(chalk.gray(`   ${categoryIcon} ${rec.category} | Effort: ${rec.effort}`));
    console.log(chalk.gray(`   ${rec.description}`));
    console.log(chalk.gray(`   Impact: ${rec.impact}`));
    console.log(chalk.cyan(`   → ${rec.recommendation}`));

    if (rec.estimatedSavings) {
      console.log(chalk.green(`   Savings: ${rec.estimatedSavings}`));
    }

    if (rec.code) {
      console.log(chalk.gray('\n   Suggested changes:'));
      console.log(chalk.gray(`   ${rec.code.replace(/\n/g, '\n   ')}`));
    }

    console.log('');
  }
}

function getSeverityIcon(severity: string): string {
  const icons = {
    low: '💡',
    medium: '⚠️',
    high: '🔶',
    critical: '🔴',
  };
  return icons[severity as keyof typeof icons] || '•';
}

function getCategoryIcon(category: string): string {
  const icons = {
    performance: '⚡',
    security: '🔒',
    maintainability: '🔧',
    usage: '📊',
    configuration: '⚙️',
  };
  return icons[category as keyof typeof icons] || '•';
}
