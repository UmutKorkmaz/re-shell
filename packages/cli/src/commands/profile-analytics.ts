import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { EnvironmentProfile, loadProfileConfig } from './profile';

/**
 * Profile analytics and usage tracking
 * Tracks profile usage, provides insights and recommendations
 */

const ANALYTICS_FILE = '.re-shell/profile-analytics.json';
const ANALYTICS_RETENTION_DAYS = 90;

export interface ProfileAnalytics {
  version: string;
  profiles: Record<string, ProfileUsageData>;
  global: GlobalAnalytics;
  lastUpdated: string;
}

export interface ProfileUsageData {
  profileName: string;
  createdAt: string;
  lastUsed: string;
  usageCount: number;
  totalDuration: number; // milliseconds
  averageSessionDuration: number;
  activationCount: number;
  deactivationCount: number;
  customizationCount: number;
  environments: Record<string, number>;
  frameworks: Record<string, number>;
  errors: ErrorEvent[];
  performanceMetrics: PerformanceMetrics;
  tags: string[];
}

export interface GlobalAnalytics {
  totalActivations: number;
  totalSessionTime: number;
  mostUsedProfile: string;
  longestSession: { profile: string; duration: number };
  averageSessionDuration: number;
  profilesCreated: number;
  profilesDeleted: number;
  frameworkUsage: Record<string, number>;
  environmentUsage: Record<string, number>;
}

export interface ErrorEvent {
  timestamp: string;
  error: string;
  context: string;
  resolved: boolean;
}

export interface PerformanceMetrics {
  averageActivationTime: number;
  averageDeactivationTime: number;
  slowestActivation: { time: number; date: string };
  failedActivations: number;
}

export interface ProfileInsight {
  type: 'usage' | 'performance' | 'optimization' | 'warning';
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation?: string;
  impact?: string;
}

/**
 * Track profile activation
 */
export async function trackProfileActivation(
  profileName: string,
  metadata?: {
    activationTime?: number;
    environment?: string;
    framework?: string;
  }
): Promise<void> {
  const analytics = await loadAnalytics();
  const now = new Date().toISOString();
  const activationTime = metadata?.activationTime || Date.now();

  if (!analytics.profiles[profileName]) {
    analytics.profiles[profileName] = createEmptyProfileData(profileName);
    analytics.global.profilesCreated++;
  }

  const profile = analytics.profiles[profileName];
  profile.lastUsed = now;
  profile.usageCount++;
  profile.activationCount++;

  if (metadata?.environment) {
    profile.environments[metadata.environment] = (profile.environments[metadata.environment] || 0) + 1;
    analytics.global.environmentUsage[metadata.environment] =
      (analytics.global.environmentUsage[metadata.environment] || 0) + 1;
  }

  if (metadata?.framework) {
    profile.frameworks[metadata.framework] = (profile.frameworks[metadata.framework] || 0) + 1;
    analytics.global.frameworkUsage[metadata.framework] =
      (analytics.global.frameworkUsage[metadata.framework] || 0) + 1;
  }

  analytics.global.totalActivations++;
  updateMostUsedProfile(analytics);

  await saveAnalytics(analytics);
}

/**
 * Track profile deactivation
 */
export async function trackProfileDeactivation(
  profileName: string,
  sessionDuration: number,
  metadata?: {
    deactivationTime?: number;
  }
): Promise<void> {
  const analytics = await loadAnalytics();
  const now = new Date().toISOString();

  if (analytics.profiles[profileName]) {
    const profile = analytics.profiles[profileName];
    profile.deactivationCount++;
    profile.totalDuration += sessionDuration;
    profile.averageSessionDuration = profile.totalDuration / profile.usageCount;

    analytics.global.totalSessionTime += sessionDuration;
    analytics.global.averageSessionDuration =
      analytics.global.totalSessionTime / analytics.global.totalActivations;

    if (sessionDuration > (analytics.global.longestSession?.duration || 0)) {
      analytics.global.longestSession = { profile: profileName, duration: sessionDuration };
    }
  }

  await saveAnalytics(analytics);
}

/**
 * Track profile customization
 */
export async function trackProfileCustomization(
  profileName: string,
  changes: string[]
): Promise<void> {
  const analytics = await loadAnalytics();

  if (analytics.profiles[profileName]) {
    const profile = analytics.profiles[profileName];
    profile.customizationCount += changes.length;

    // Add customization tag
    if (!profile.tags.includes('customized')) {
      profile.tags.push('customized');
    }
  }

  await saveAnalytics(analytics);
}

/**
 * Track profile errors
 */
export async function trackProfileError(
  profileName: string,
  error: string,
  context: string
): Promise<void> {
  const analytics = await loadAnalytics();

  if (analytics.profiles[profileName]) {
    analytics.profiles[profileName].errors.push({
      timestamp: new Date().toISOString(),
      error,
      context,
      resolved: false,
    });
  }

  await saveAnalytics(analytics);
}

/**
 * Generate profile insights
 */
export async function generateProfileInsights(profileName?: string): Promise<ProfileInsight[]> {
  const analytics = await loadAnalytics();
  const insights: ProfileInsight[] = [];

  if (profileName) {
    // Profile-specific insights
    const profile = analytics.profiles[profileName];
    if (!profile) {
      return [{
        type: 'warning',
        severity: 'warning',
        title: 'Profile Not Found',
        description: `No analytics data available for profile "${profileName}"`,
        recommendation: 'Activate this profile to start tracking usage',
      }];
    }

    // Usage insights
    if (profile.usageCount === 0) {
      insights.push({
        type: 'usage',
        severity: 'suggestion',
        title: 'Unused Profile',
        description: `Profile "${profileName}" has never been used`,
        recommendation: 'Consider deleting this profile if it\'s not needed',
      });
    } else if (profile.usageCount < 5) {
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'Low Usage Profile',
        description: `Profile "${profileName}" has been used only ${profile.usageCount} times`,
        recommendation: 'This profile might be a candidate for removal or optimization',
      });
    }

    // Performance insights
    if (profile.performanceMetrics.failedActivations > 0) {
      insights.push({
        type: 'performance',
        severity: 'critical',
        title: 'Activation Failures Detected',
        description: `${profile.performanceMetrics.failedActivations} failed activation(s) detected`,
        recommendation: 'Review profile configuration for errors',
        impact: 'High - Profile may be unstable',
      });
    }

    if (profile.averageSessionDuration < 60000) {
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'Short Sessions',
        description: 'Average session duration is less than 1 minute',
        recommendation: 'This might indicate frequent profile switching or configuration issues',
      });
    }

    // Customization insights
    if (profile.customizationCount > 10) {
      insights.push({
        type: 'optimization',
        severity: 'suggestion',
        title: 'Heavily Customized Profile',
        description: `Profile has been customized ${profile.customizationCount} times`,
        recommendation: 'Consider creating a template from this profile for reuse',
        impact: 'Medium - Could save time for team members',
      });
    }

    // Error insights
    const recentErrors = profile.errors.filter(e => {
      const errorDate = new Date(e.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return errorDate > weekAgo && !e.resolved;
    });

    if (recentErrors.length > 0) {
      insights.push({
        type: 'warning',
        severity: 'warning',
        title: 'Recent Unresolved Errors',
        description: `${recentErrors.length} unresolved error(s) in the last 7 days`,
        recommendation: 'Review and resolve errors to improve stability',
        impact: 'High - Affecting development workflow',
      });
    }

  } else {
    // Global insights
    const profileCount = Object.keys(analytics.profiles).length;

    if (profileCount === 0) {
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'No Profiles Tracked',
        description: 'No analytics data available yet',
        recommendation: 'Activate profiles to start tracking usage',
      });
    } else if (profileCount > 10) {
      insights.push({
        type: 'optimization',
        severity: 'suggestion',
        title: 'Many Profiles Detected',
        description: `You have ${profileCount} profiles being tracked`,
        recommendation: 'Consider archiving or removing unused profiles to reduce complexity',
        impact: 'Low - Organization improvement',
      });
    }

    // Framework diversity
    const frameworkCount = Object.keys(analytics.global.frameworkUsage).length;
    if (frameworkCount > 5) {
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'Multi-Framework Usage',
        description: `Using ${frameworkCount} different frameworks across profiles`,
        recommendation: 'Consider consolidating similar framework profiles',
      });
    }

    // Most used profile
    if (analytics.global.mostUsedProfile) {
      const mostUsed = analytics.profiles[analytics.global.mostUsedProfile];
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'Most Used Profile',
        description: `"${analytics.global.mostUsedProfile}" is your most used profile (${mostUsed.usageCount} times)`,
        recommendation: 'Consider optimizing this profile for better performance',
      });
    }

    // Session patterns
    if (analytics.global.averageSessionDuration > 4 * 60 * 60 * 1000) {
      insights.push({
        type: 'usage',
        severity: 'info',
        title: 'Long Development Sessions',
        description: `Average session duration is ${formatDuration(analytics.global.averageSessionDuration)}`,
        recommendation: 'Consider taking breaks and using session management features',
      });
    }
  }

  return insights;
}

/**
 * Show profile analytics dashboard
 */
export async function showAnalyticsDashboard(profileName?: string): Promise<void> {
  const analytics = await loadAnalytics();

  console.log(chalk.cyan.bold('\n📊 Profile Analytics Dashboard\n'));

  if (profileName) {
    await showProfileAnalytics(profileName, analytics);
  } else {
    await showGlobalAnalytics(analytics);
  }

  // Generate and display insights
  const insights = await generateProfileInsights(profileName);

  if (insights.length > 0) {
    console.log(chalk.cyan.bold('\n💡 Insights & Recommendations\n'));

    for (const insight of insights) {
      const severityColor = {
        info: chalk.blue,
        suggestion: chalk.cyan,
        warning: chalk.yellow,
        critical: chalk.red,
      }[insight.severity];

      const icon = {
        info: 'ℹ️',
        suggestion: '💡',
        warning: '⚠️',
        critical: '🔴',
      }[insight.severity];

      console.log(severityColor(`${icon} ${insight.title}`));
      console.log(chalk.gray(`   ${insight.description}`));

      if (insight.recommendation) {
        console.log(chalk.gray(`   → ${insight.recommendation}`));
      }

      if (insight.impact) {
        console.log(chalk.gray(`   Impact: ${insight.impact}`));
      }

      console.log('');
    }
  }
}

/**
 * Show usage statistics
 */
export async function showUsageStatistics(options: {
  sortBy?: 'name' | 'usage' | 'duration';
  limit?: number;
  format?: 'table' | 'json';
} = {}): Promise<void> {
  const analytics = await loadAnalytics();
  const profiles = Object.entries(analytics.profiles);

  if (profiles.length === 0) {
    console.log(chalk.yellow('\n⚠ No usage data available\n'));
    return;
  }

  // Sort profiles
  let sortedProfiles = profiles;
  if (options.sortBy === 'usage') {
    sortedProfiles.sort(([, a], [, b]) => b.usageCount - a.usageCount);
  } else if (options.sortBy === 'duration') {
    sortedProfiles.sort(([, a], [, b]) => b.totalDuration - a.totalDuration);
  } else {
    sortedProfiles.sort(([a], [b]) => a.localeCompare(b));
  }

  // Apply limit
  if (options.limit) {
    sortedProfiles = sortedProfiles.slice(0, options.limit);
  }

  console.log(chalk.cyan.bold('\n📈 Profile Usage Statistics\n'));

  if (options.format === 'json') {
    console.log(JSON.stringify(sortedProfiles.map(([name, data]) => ({ name, ...data })), null, 2));
  } else {
    // Table format
    console.log(chalk.white('Profile'.padEnd(25)) +
      chalk.white('Usage'.padEnd(10)) +
      chalk.white('Total Time'.padEnd(15)) +
      chalk.white('Avg Session'.padEnd(15)) +
      chalk.white('Last Used\n'));

    console.log(chalk.gray('-'.repeat(80)));

    for (const [name, data] of sortedProfiles) {
      console.log(
        chalk.cyan(name.padEnd(25)) +
        chalk.white(data.usageCount.toString().padEnd(10)) +
        chalk.white(formatDuration(data.totalDuration).padEnd(15)) +
        chalk.white(formatDuration(data.averageSessionDuration).padEnd(15)) +
        chalk.gray(formatDate(data.lastUsed))
      );
    }

    console.log('');
  }
}

/**
 * Clean old analytics data
 */
export async function cleanAnalyticsData(daysToKeep: number = ANALYTICS_RETENTION_DAYS): Promise<void> {
  const analytics = await loadAnalytics();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let cleaned = 0;

  for (const [profileName, profile] of Object.entries(analytics.profiles)) {
    const profileDate = new Date(profile.lastUsed);

    if (profileDate < cutoffDate && profile.usageCount === 0) {
      delete analytics.profiles[profileName];
      cleaned++;
    } else {
      // Clean old errors
      const initialErrorCount = profile.errors.length;
      profile.errors = profile.errors.filter(e => new Date(e.timestamp) >= cutoffDate);
      cleaned += initialErrorCount - profile.errors.length;
    }
  }

  await saveAnalytics(analytics);

  if (cleaned > 0) {
    console.log(chalk.green(`\n✓ Cleaned ${cleaned} old records (older than ${daysToKeep} days)\n`));
  } else {
    console.log(chalk.gray('\n✓ No old records to clean\n'));
  }
}

/**
 * Helper functions
 */

async function loadAnalytics(): Promise<ProfileAnalytics> {
  const analyticsPath = path.join(process.cwd(), ANALYTICS_FILE);

  if (!(await fs.pathExists(analyticsPath))) {
    const emptyAnalytics: ProfileAnalytics = {
      version: '1.0.0',
      profiles: {},
      global: {
        totalActivations: 0,
        totalSessionTime: 0,
        mostUsedProfile: '',
        longestSession: { profile: '', duration: 0 },
        averageSessionDuration: 0,
        profilesCreated: 0,
        profilesDeleted: 0,
        frameworkUsage: {},
        environmentUsage: {},
      },
      lastUpdated: new Date().toISOString(),
    };
    await fs.writeFile(analyticsPath, JSON.stringify(emptyAnalytics, null, 2), 'utf8');
    return emptyAnalytics;
  }

  const content = await fs.readFile(analyticsPath, 'utf8');
  return JSON.parse(content);
}

async function saveAnalytics(analytics: ProfileAnalytics): Promise<void> {
  analytics.lastUpdated = new Date().toISOString();
  const analyticsPath = path.join(process.cwd(), ANALYTICS_FILE);
  await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2), 'utf8');
}

function createEmptyProfileData(profileName: string): ProfileUsageData {
  return {
    profileName,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    usageCount: 0,
    totalDuration: 0,
    averageSessionDuration: 0,
    activationCount: 0,
    deactivationCount: 0,
    customizationCount: 0,
    environments: {},
    frameworks: {},
    errors: [],
    performanceMetrics: {
      averageActivationTime: 0,
      averageDeactivationTime: 0,
      slowestActivation: { time: 0, date: '' },
      failedActivations: 0,
    },
    tags: [],
  };
}

function updateMostUsedProfile(analytics: ProfileAnalytics): void {
  let maxUsage = 0;
  let mostUsed = '';

  for (const [name, data] of Object.entries(analytics.profiles)) {
    if (data.usageCount > maxUsage) {
      maxUsage = data.usageCount;
      mostUsed = name;
    }
  }

  analytics.global.mostUsedProfile = mostUsed;
}

async function showProfileAnalytics(profileName: string, analytics: ProfileAnalytics): Promise<void> {
  const profile = analytics.profiles[profileName];

  if (!profile) {
    console.log(chalk.yellow(`\n⚠ No analytics data for profile "${profileName}"\n`));
    return;
  }

  console.log(chalk.cyan.bold(`Profile: ${profileName}\n`));
  console.log(chalk.white('Usage Statistics:'));
  console.log(chalk.gray(`  Total activations: ${profile.activationCount}`));
  console.log(chalk.gray(`  Total deactivations: ${profile.deactivationCount}`));
  console.log(chalk.gray(`  Total usage count: ${profile.usageCount}`));
  console.log(chalk.gray(`  Total session time: ${formatDuration(profile.totalDuration)}`));
  console.log(chalk.gray(`  Average session: ${formatDuration(profile.averageSessionDuration)}\n`));

  console.log(chalk.white('Timeline:'));
  console.log(chalk.gray(`  Created: ${formatDate(profile.createdAt)}`));
  console.log(chalk.gray(`  Last used: ${formatDate(profile.lastUsed)}\n`));

  if (Object.keys(profile.environments).length > 0) {
    console.log(chalk.white('Environments:'));
    for (const [env, count] of Object.entries(profile.environments)) {
      console.log(chalk.gray(`  ${env}: ${count} times`));
    }
    console.log('');
  }

  if (Object.keys(profile.frameworks).length > 0) {
    console.log(chalk.white('Frameworks:'));
    for (const [fw, count] of Object.entries(profile.frameworks)) {
      console.log(chalk.gray(`  ${fw}: ${count} times`));
    }
    console.log('');
  }

  if (profile.errors.length > 0) {
    console.log(chalk.white(`Errors (${profile.errors.length}):`));
    const recentErrors = profile.errors.slice(-5);
    for (const error of recentErrors) {
      const status = error.resolved ? '✓' : '✗';
      console.log(chalk.gray(`  ${status} ${error.error} (${formatDate(error.timestamp)})`));
    }
    console.log('');
  }

  if (profile.tags.length > 0) {
    console.log(chalk.white('Tags:'));
    console.log(chalk.gray(`  ${profile.tags.join(', ')}\n`));
  }
}

async function showGlobalAnalytics(analytics: ProfileAnalytics): Promise<void> {
  const profileCount = Object.keys(analytics.profiles).length;

  console.log(chalk.white('Global Statistics:'));
  console.log(chalk.gray(`  Tracked profiles: ${profileCount}`));
  console.log(chalk.gray(`  Total activations: ${analytics.global.totalActivations}`));
  console.log(chalk.gray(`  Total session time: ${formatDuration(analytics.global.totalSessionTime)}`));
  console.log(chalk.gray(`  Average session: ${formatDuration(analytics.global.averageSessionDuration)}`));
  console.log(chalk.gray(`  Profiles created: ${analytics.global.profilesCreated}`));
  console.log(chalk.gray(`  Last updated: ${formatDate(analytics.lastUpdated)}\n`));

  if (analytics.global.mostUsedProfile) {
    console.log(chalk.white('Most Used Profile:'));
    const mostUsed = analytics.profiles[analytics.global.mostUsedProfile];
    console.log(chalk.gray(`  ${analytics.global.mostUsedProfile} (${mostUsed.usageCount} uses)\n`));
  }

  if (Object.keys(analytics.global.frameworkUsage).length > 0) {
    console.log(chalk.white('Framework Usage:'));
    for (const [fw, count] of Object.entries(analytics.global.frameworkUsage)) {
      console.log(chalk.gray(`  ${fw}: ${count}`));
    }
    console.log('');
  }

  if (Object.keys(analytics.global.environmentUsage).length > 0) {
    console.log(chalk.white('Environment Usage:'));
    for (const [env, count] of Object.entries(analytics.global.environmentUsage)) {
      console.log(chalk.gray(`  ${env}: ${count}`));
    }
    console.log('');
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
