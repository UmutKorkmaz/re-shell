import { describe, expect, it } from 'vitest';
import {
  buildSuggestion,
  buildSuggestions,
  buildFixPlan,
  isAllowedFixCommand,
  needsRemediation,
  remediationCoverage,
  applyPhraser,
  identityPhraser,
  ALLOWED_FIX_COMMAND_PREFIXES,
  type RemediableCheck,
  type RemediationPhraser,
} from '../../src/utils/doctor-remediation';
import {
  suggestionSchema,
  fixPlanSchema,
} from '@re-shell/contracts';

describe('doctor-remediation: needsRemediation', () => {
  it('flags doctor warning/error and rich fail/critical, ignores healthy', () => {
    expect(needsRemediation({ status: 'warning' })).toBe(true);
    expect(needsRemediation({ status: 'error' })).toBe(true);
    expect(needsRemediation({ status: 'fail' })).toBe(true);
    expect(needsRemediation({ status: 'critical' })).toBe(true);
    expect(needsRemediation({ status: 'success' })).toBe(false);
    expect(needsRemediation({ status: 'healthy' })).toBe(false);
    expect(needsRemediation({ status: 'pass' })).toBe(false);
    expect(needsRemediation({ level: 'info' })).toBe(false);
  });
});

describe('doctor-remediation: buildSuggestion', () => {
  it('returns null for healthy checks', () => {
    expect(buildSuggestion({ name: 'security-audit', status: 'success' })).toBeNull();
  });

  it('produces a contract-valid Suggestion for a known fixable check', () => {
    const suggestion = buildSuggestion(
      { name: 'security-audit', status: 'error', message: 'Found 3 vulnerabilities' },
      'pnpm'
    );
    expect(suggestion).not.toBeNull();
    expect(suggestionSchema.safeParse(suggestion).success).toBe(true);
    expect(suggestion?.checkId).toBe('security-audit');
    expect(suggestion?.fixable).toBe(true);
    expect(suggestion?.fixCommand).toBe('pnpm audit fix');
  });

  it('substitutes the package manager placeholder', () => {
    const npm = buildSuggestion({ name: 'outdated-dependencies', status: 'warning' }, 'npm');
    const yarn = buildSuggestion({ name: 'outdated-dependencies', status: 'warning' }, 'yarn');
    expect(npm?.fixCommand).toBe('npm update');
    expect(yarn?.fixCommand).toBe('yarn upgrade');
  });

  it('marks unfixable checks as not fixable and omits fixCommand', () => {
    const suggestion = buildSuggestion({ name: 'large-files', status: 'warning' });
    expect(suggestion?.fixable).toBe(false);
    expect(suggestion?.fixCommand).toBeUndefined();
  });

  it('falls back gracefully for unknown check ids using the check message', () => {
    const suggestion = buildSuggestion({
      name: 'totally-unknown-check',
      status: 'warning',
      message: 'something specific went wrong',
    });
    expect(suggestion?.checkId).toBe('totally-unknown-check');
    expect(suggestion?.cause).toContain('something specific');
    expect(suggestion?.fixable).toBe(false);
  });

  it('covers the workspace-health display-style check ids', () => {
    const dep = buildSuggestion({ name: 'Dependencies', status: 'critical' }, 'pnpm');
    expect(dep?.fixable).toBe(true);
    expect(dep?.fixCommand).toBe('pnpm install');
    const git = buildSuggestion({ name: 'Git', status: 'warning' });
    expect(git?.fixCommand).toBe('git init');
  });
});

describe('doctor-remediation: buildSuggestions ordering + filtering', () => {
  it('drops healthy checks and preserves order', () => {
    const checks: RemediableCheck[] = [
      { name: 'package-json', status: 'success' },
      { name: 'security-audit', status: 'error', message: '2 vulns' },
      { name: 'git-config', status: 'warning' },
    ];
    const suggestions = buildSuggestions(checks, 'npm');
    expect(suggestions.map(s => s.checkId)).toEqual(['security-audit', 'git-config']);
  });
});

describe('doctor-remediation: isAllowedFixCommand', () => {
  it('accepts allow-listed prefixes and exact matches', () => {
    expect(isAllowedFixCommand('npm audit fix')).toBe(true);
    expect(isAllowedFixCommand('pnpm audit fix --force')).toBe(true);
    expect(isAllowedFixCommand('git init')).toBe(true);
  });

  it('rejects anything not allow-listed', () => {
    expect(isAllowedFixCommand('rm -rf /')).toBe(false);
    expect(isAllowedFixCommand('npm publish')).toBe(false);
    expect(isAllowedFixCommand(undefined)).toBe(false);
    // No partial-token match: "git initialize" must not pass as "git init".
    expect(isAllowedFixCommand('git initialize-everything')).toBe(false);
  });

  it('every prefix in the allow-list is itself allowed', () => {
    for (const prefix of ALLOWED_FIX_COMMAND_PREFIXES) {
      expect(isAllowedFixCommand(prefix)).toBe(true);
    }
  });
});

describe('doctor-remediation: buildFixPlan', () => {
  const checks: RemediableCheck[] = [
    { name: 'security-audit', status: 'error', message: '1 vuln' },
    { name: 'large-files', status: 'warning' },
  ];

  it('default plan is a dry run: applied=false, nothing marked applied', () => {
    const suggestions = buildSuggestions(checks, 'npm');
    const plan = buildFixPlan(suggestions);
    expect(fixPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.applied).toBe(false);
    expect(plan.steps.every(s => s.applied === false)).toBe(true);
    // Executable step carries a command; manual step does not.
    const audit = plan.steps.find(s => s.checkId === 'security-audit');
    const large = plan.steps.find(s => s.checkId === 'large-files');
    expect(audit?.command).toBe('npm audit fix');
    expect(large?.command).toBeUndefined();
  });

  it('apply=true only marks executable allow-listed steps as applied', () => {
    const suggestions = buildSuggestions(checks, 'npm');
    const plan = buildFixPlan(suggestions, true);
    expect(plan.applied).toBe(true);
    const audit = plan.steps.find(s => s.checkId === 'security-audit');
    const large = plan.steps.find(s => s.checkId === 'large-files');
    expect(audit?.applied).toBe(true);
    expect(large?.applied).toBe(false);
  });

  it('produces an empty plan when there is nothing to remediate', () => {
    const plan = buildFixPlan([]);
    expect(plan.steps).toHaveLength(0);
    expect(plan.applied).toBe(false);
  });
});

describe('doctor-remediation: coverage', () => {
  it('covers every doctor check id', () => {
    const covered = new Set(remediationCoverage());
    const doctorIds = [
      'monorepo-detection',
      'doctor-execution',
      'package-json',
      'dependency-duplicates',
      'outdated-dependencies',
      'dependencies-health',
      'security-audit',
      'workspace-config',
      'git-config',
      'build-config',
      'build-files',
      'node-modules-size',
      'large-files',
      'performance-check',
      'disk-space',
      'broken-symlinks',
      'filesystem-health',
    ];
    for (const id of doctorIds) {
      expect(covered.has(id)).toBe(true);
    }
  });

  it('covers every workspace-health display-style id', () => {
    const covered = new Set(remediationCoverage());
    for (const id of ['Workspaces', 'Config File', 'Services', 'Dependencies', 'File Structure', 'Git', 'Package Manager']) {
      expect(covered.has(id)).toBe(true);
    }
  });
});

describe('doctor-remediation: LLM phraser hook', () => {
  it('identity phraser is a no-op', () => {
    const suggestion = buildSuggestion({ name: 'security-audit', status: 'error' }, 'npm')!;
    expect(applyPhraser(suggestion, identityPhraser)).toEqual(suggestion);
  });

  it('a misbehaving phraser cannot change safety-critical fields', () => {
    const evil: RemediationPhraser = {
      name: 'evil',
      phrase: s => ({
        ...s,
        cause: 'friendlier cause',
        suggestion: 'friendlier suggestion',
        // Attempt to escalate / hijack the executed command.
        checkId: 'hijacked',
        fixable: true,
        fixCommand: 'rm -rf /',
      }),
    };
    const original = buildSuggestion({ name: 'large-files', status: 'warning' })!;
    const phrased = applyPhraser(original, evil);
    // Wording is taken from the phraser...
    expect(phrased.cause).toBe('friendlier cause');
    expect(phrased.suggestion).toBe('friendlier suggestion');
    // ...but safety-critical fields remain from the deterministic original.
    expect(phrased.checkId).toBe('large-files');
    expect(phrased.fixable).toBe(false);
    expect(phrased.fixCommand).toBeUndefined();
  });
});
