import { describe, expect, it } from 'vitest';
import {
  analysisFindingSchema,
  analysisReportSchema,
  auditEntrySchema,
  auditVerifyResponseSchema,
  complianceReportSchema,
  errorCodeSchema,
  jsonResponseSchema,
  profileInsightsResponseSchema,
  profileOptimizationResponseSchema,
} from './index.js';

const hash = 'a'.repeat(64);

describe('R-1b contracts', () => {
  it('error codes for the new commands exist', () => {
    for (const code of ['AUDIT_ERROR', 'COMPLIANCE_ERROR', 'PROFILE_ERROR']) {
      expect(errorCodeSchema.safeParse(code).success).toBe(true);
    }
    expect(errorCodeSchema.safeParse('NOT_A_CODE').success).toBe(false);
  });

  describe('audit', () => {
    const entry = {
      v: 1,
      seq: 3,
      timestamp: '2026-01-01T00:00:00.000Z',
      actor: 'dev@example.com',
      actorSource: 'git',
      command: 'plugin install',
      args: ['x', '--api-token', '[REDACTED]'],
      cwd: '.',
      exitCode: 0,
      durationMs: 12,
      prevHash: hash,
      hash: 'b'.repeat(64),
    };

    it('accepts a well-formed entry and rejects malformed ones', () => {
      expect(auditEntrySchema.safeParse(entry).success).toBe(true);
      expect(auditEntrySchema.safeParse({ ...entry, seq: 0 }).success).toBe(false);
      expect(auditEntrySchema.safeParse({ ...entry, hash: 'xyz' }).success).toBe(false);
      expect(auditEntrySchema.safeParse({ ...entry, actorSource: 'cloud' }).success).toBe(false);
      expect(auditEntrySchema.safeParse({ ...entry, v: 2 }).success).toBe(false);
    });

    it('verify response carries failures; the error envelope carries them as details', () => {
      const data = {
        valid: false,
        entries: 4,
        failures: [{ seq: 2, line: 2, code: 'hash-mismatch', message: 'entry 2 was modified' }],
        lastSeq: 4,
        lastHash: hash,
        logPath: '.re-shell/audit/audit.jsonl',
        logExists: true,
        head: { seq: 4, hash },
      };
      expect(auditVerifyResponseSchema.safeParse(data).success).toBe(true);
      expect(auditVerifyResponseSchema.safeParse({ ...data, failures: [{ seq: 2, line: 2, code: 'bogus', message: '' }] }).success).toBe(false);
      const envelope = jsonResponseSchema(auditVerifyResponseSchema).safeParse({
        ok: false,
        error: { code: 'AUDIT_ERROR', message: 'failed', details: data },
        warnings: [],
      });
      expect(envelope.success).toBe(true);
    });
  });

  describe('compliance', () => {
    const report = {
      framework: 'soc2',
      frameworkName: 'SOC 2',
      generatedAt: '2026-01-01T00:00:00.000Z',
      since: null,
      disclaimer: 'not an attestation',
      audit: { present: true, enabled: true, chainValid: true, entriesTotal: 1, entriesInWindow: 1, actors: ['a'], firstTimestamp: 't', lastTimestamp: 't', byCategory: { modify: 1 }, failedCommands: 0, verifyFailures: 0 },
      policy: { ran: true, pack: 'recommended', score: 90, passedRules: 3, failedErrors: 0, failedWarnings: 1 },
      controls: [
        { id: 'CC8.1', title: 'Change management', category: 'change-management', objective: 'o', status: 'partial', evidence: [{ source: 'audit-log', summary: 's' }], gaps: ['g'] },
      ],
      summary: { total: 1, evidence: 0, partial: 1, noEvidence: 0 },
      notEvaluated: [{ id: 'CC6.2', title: 't', reason: 'r' }],
    };

    it('accepts a report and rejects unknown frameworks, statuses and sources', () => {
      expect(complianceReportSchema.safeParse(report).success).toBe(true);
      expect(complianceReportSchema.safeParse({ ...report, framework: 'hipaa' }).success).toBe(false);
      expect(complianceReportSchema.safeParse({ ...report, controls: [{ ...report.controls[0], status: 'compliant' }] }).success).toBe(false);
      expect(complianceReportSchema.safeParse({ ...report, controls: [{ ...report.controls[0], evidence: [{ source: 'vibes', summary: 's' }] }] }).success).toBe(false);
    });
  });

  describe('analysis', () => {
    const finding = {
      id: 'arch.dependency-cycle:a>b',
      ruleId: 'arch.dependency-cycle',
      type: 'architecture',
      severity: 'high',
      title: 't',
      message: 'm',
      evidence: [{ kind: 'graph', path: ['a', 'b', 'a'], detail: 'cycle' }, { kind: 'file', file: 'a/package.json', line: 5, detail: 'd' }],
      recommendation: 'fix it',
    };

    it('requires evidence and a recommendation on every finding', () => {
      expect(analysisFindingSchema.safeParse(finding).success).toBe(true);
      expect(analysisFindingSchema.safeParse({ ...finding, evidence: [] }).success).toBe(false);
      expect(analysisFindingSchema.safeParse({ ...finding, severity: 'catastrophic' }).success).toBe(false);
      expect(analysisFindingSchema.safeParse({ ...finding, type: 'bundle' }).success).toBe(false);
      expect(analysisFindingSchema.safeParse({ ...finding, evidence: [{ kind: 'file', file: 'f', line: 0, detail: 'd' }] }).success).toBe(false);
    });

    it('report keeps the legacy per-workspace sections alongside findings', () => {
      const report = {
        timestamp: 't',
        monorepo: 'm',
        workspaces: 1,
        analysis: { 'apps/web': { bundle: { any: 'shape' } } },
        types: ['architecture'],
        graph: { packages: 2, edges: 1, services: 0 },
        findings: [finding],
        summary: { total: 1, bySeverity: { high: 1 }, byType: { architecture: 1 } },
      };
      expect(analysisReportSchema.safeParse(report).success).toBe(true);
      expect(analysisReportSchema.safeParse({ ...report, graph: { packages: 2 } }).success).toBe(false);
    });
  });

  describe('profile', () => {
    const dataSource = { file: '.re-shell/profile-analytics.json', events: 0, profilesTracked: 0, empty: true };

    it('insights response', () => {
      const ok = { profile: null, generatedAt: 't', dataSource, insights: [{ type: 'usage', severity: 'info', title: 't', description: 'd', evidence: ['e'] }] };
      expect(profileInsightsResponseSchema.safeParse(ok).success).toBe(true);
      expect(profileInsightsResponseSchema.safeParse({ ...ok, insights: [{ ...ok.insights[0], severity: 'meh' }] }).success).toBe(false);
      expect(profileInsightsResponseSchema.safeParse({ ...ok, dataSource: { ...dataSource, events: -1 } }).success).toBe(false);
    });

    it('optimization response', () => {
      const ok = {
        profileName: 'dev',
        totalRecommendations: 1,
        categories: { maintainability: 1 },
        bySeverity: { low: 1 },
        recommendations: [{ id: 'maint-description', category: 'maintainability', severity: 'low', title: 't', description: 'd', impact: 'i', effort: 'easy', recommendation: 'r' }],
        overallScore: 98,
        optimizedAt: 't',
        dataSource,
      };
      expect(profileOptimizationResponseSchema.safeParse(ok).success).toBe(true);
      expect(profileOptimizationResponseSchema.safeParse({ ...ok, recommendations: [{ ...ok.recommendations[0], effort: 'trivial' }] }).success).toBe(false);
    });
  });
});
