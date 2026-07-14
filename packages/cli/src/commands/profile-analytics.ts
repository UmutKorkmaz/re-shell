import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { EnvironmentProfile, loadProfileConfig } from './profile';

/**
 * Profile analytics and usage tracking.
 *
 * Tracks profile usage, provides insights and recommendations.
 *
 * @packageDocumentation
 */

const ANALYTICS_FILE = '.re-shell/profile-analytics.json';
const ANALYTICS_RETENTION_DAYS = 90;

/**
 * Root analytics document persisted to disk.
 *
 * Contains schema version information, per-profile usage data,
 * aggregate global statistics, and the timestamp of the most recent update.
 */
export interface ProfileAnalytics {
  /** Schema version of the analytics document. */
  version: string;
  /** Map of profile name to its usage data. */
  profiles: Record<string, ProfileUsageData>;
  /** Aggregate analytics computed across all profiles. */
  global: GlobalAnalytics;
  /** ISO timestamp of the most recent analytics write. */
  lastUpdated: string;
}

/**
 * Per-profile usage and health data tracked over time.
 */
export interface ProfileUsageData {
  /** Name of the profile this data describes. */
  profileName: string;
  /** ISO timestamp of when the profile first appeared in analytics. */
  createdAt: string;
  /** ISO timestamp of the most recent activity on this profile. */
  lastUsed: string;
  /** Total number of times the profile has been used. */
  usageCount: number;
  /** Cumulative session duration in milliseconds. */
  totalDuration: number;
  /** Average session duration in milliseconds. */
  averageSessionDuration: number;
  /** Number of times the profile has been activated. */
  activationCount: number;
  /** Number of times the profile has been deactivated. */
  deactivationCount: number;
  /** Number of customization changes applied to the profile. */
  customizationCount: number;
  /** Map of environment name to number of activations in that environment. */
  environments: Record<string, number>;
  /** Map of framework name to number of activations using that framework. */
  frameworks: Record<string, number>;
  /** Recorded error events associated with the profile. */
  errors: ErrorEvent[];
  /** Performance timings collected for activation/deactivation operations. */
  performanceMetrics: PerformanceMetrics;
  /** Free-form labels assigned to the profile (e.g. `customized`). */
  tags: string[];
}

/**
 * Aggregate analytics computed across all tracked profiles.
 */
export interface GlobalAnalytics {
  /** Total number of profile activations recorded. */
  totalActivations: number;
  /** Total accumulated session time across all profiles, in milliseconds. */
  totalSessionTime: number;
  /** Name of the profile with the highest usage count. */
  mostUsedProfile: string;
  /** Profile and duration of the longest single session observed. */
  longestSession: { profile: string; duration: number };
  /** Average session duration across all activations, in milliseconds. */
  averageSessionDuration: number;
  /** Total number of profiles that have been created. */
  profilesCreated: number;
  /** Total number of profiles that have been deleted. */
  profilesDeleted: number;
  /** Map of framework name to total activations across all profiles. */
  frameworkUsage: Record<string, number>;
  /** Map of environment name to total activations across all profiles. */
  environmentUsage: Record<string, number>;
}

/**
 * A single recorded error event tied to a profile.
 */
export interface ErrorEvent {
  /** ISO timestamp of when the error occurred. */
  timestamp: string;
  /** Human-readable description of the error. */
  error: string;
  /** Contextual information about what was happening when the error occurred. */
  context: string;
  /** Whether the error has been marked as resolved. */
  resolved: boolean;
}

/**
 * Performance timing metrics for a profile's activation lifecycle.
 */
export interface PerformanceMetrics {
  /** Average time (ms) taken to activate the profile. */
  averageActivationTime: number;
  /** Average time (ms) taken to deactivate the profile. */
  averageDeactivationTime: number;
  /** Slowest single activation observed, with its time and date. */
  slowestActivation: { time: number; date: string };
  /** Number of activation attempts that failed. */
  failedActivations: number;
}

/**
 * A single actionable insight generated from analytics data.
 */
export interface ProfileInsight {
  /** Category of the insight. */
  type: 'usage' | 'performance' | 'optimization' | 'warning';
  /** How important the insight is. */
  severity: 'info' | 'suggestion' | 'warning' | 'critical';
  /** Short headline describing the insight. */
  title: string;
  /** Detailed explanation of what was observed. */
  description: string;
  /** Optional suggested action the user can take. */
  recommendation?: string;
  /** Optional description of the potential impact of acting on the insight. */
  impact?: string;
}

/**
 * Record a profile activation in the analytics store.
 *
 * Increments usage and activation counters, updates last-used timestamp,
 * records environment/framework metadata when provided, and refreshes the
 * "most used profile" global statistic. The profile is created on first use.
 *
 * @param profileName - Name of the profile being activated.
 * @param metadata - Optional activation metadata.
 * @param metadata.activationTime - Optional time (ms) the activation took.
 * @param metadata.environment - Optional environment the profile was activated in.
 * @param metadata.framework - Optional framework the profile was activated with.
 * @returns Resolves when the updated analytics have been persisted.
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
 * Record a profile deactivation and its session duration in the analytics store.
 *
 * Increments deactivation counters, accumulates session time, recomputes
 * average session durations, and updates the global longest-session statistic
 * when applicable. No-op if the profile is not present in analytics.
 *
 * @param profileName - Name of the profile being deactivated.
 * @param sessionDuration - Duration of the just-ended session in milliseconds.
 * @param metadata - Optional deactivation metadata.
 * @param metadata.deactivationTime - Optional time (ms) the deactivation took.
 * @returns Resolves when the updated analytics have been persisted.
 */
export async function trackProfileDeactivation(
  profileName: string,
  sessionDuration: number,
  metadata?: {
    deactivationTime?: number;
  }
): Promise<void> {
  const analytics = await loadAnalytics();

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
 * Record customization changes applied to a profile.
 *
 * Increments the customization counter by the number of changes and tags the
 * profile as `customized` if it has not already been tagged.
 *
 * @param profileName - Name of the profile that was customized.
 * @param changes - List of change descriptions applied in this customization.
 * @returns Resolves when the updated analytics have been persisted.
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
 * Record an error event against a profile.
 *
 * Appends a new unresolved error entry to the profile's error history. No-op
 * if the profile is not present in analytics.
 *
 * @param profileName - Name of the profile the error is associated with.
 * @param error - Human-readable description of the error.
 * @param context - Contextual information about what was happening when the error occurred.
 * @returns Resolves when the updated analytics have been persisted.
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
 * Generate actionable insights from analytics data.
 *
 * When `profileName` is supplied, produces insights scoped to that profile
 * (usage volume, performance failures, customization volume, recent errors).
 * Otherwise produces global insights across all profiles (profile count,
 * framework diversity, most used profile, session patterns). Returns a single
 * "Profile Not Found" warning insight if the requested profile does not exist.
 *
 * @param profileName - Optional profile name to scope insights to.
 * @returns Array of generated insights, possibly empty.
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
 * Render the analytics dashboard to the console.
 *
 * When `profileName` is supplied, displays per-profile analytics; otherwise
 * displays global analytics. Generated insights are also rendered at the end
 * of the dashboard with severity-appropriate coloring.
 *
 * @param profileName - Optional profile name to display analytics for.
 * @returns Resolves once the dashboard has been printed.
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
 * Render profile usage statistics to the console.
 *
 * Loads all profiles, optionally sorts them, optionally limits the result set,
 * and renders them either as a formatted table (default) or as JSON.
 *
 * @param options - Rendering options.
 * @param options.sortBy - Field to sort profiles by: `name`, `usage`, or `duration`.
 * @param options.limit - Maximum number of profiles to render.
 * @param options.format - Output format: `table` (default) or `json`.
 * @returns Resolves once the statistics have been printed.
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
 * Remove stale analytics records older than the retention window.
 *
 * Deletes profiles that have never been used and whose last-used date precedes
 * the cutoff, and prunes per-profile error entries that predate the cutoff.
 * The number of removed records is reported to the console.
 *
 * @param daysToKeep - Number of days of history to retain. Defaults to {@link ANALYTICS_RETENTION_DAYS}.
 * @returns Resolves when the cleaned analytics have been persisted.
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
 * Internal helper functions.
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
