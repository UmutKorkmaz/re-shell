import { architectureFindings, performanceFindings, scalabilityFindings, securityFindings } from './checks';
import { buildModel } from './model';
import {
  ANALYSIS_TYPES,
  SEVERITY_ORDER,
  type AnalysisType,
  type Finding,
  type Severity,
  type WorkspaceModel,
} from './types';

export interface AnalyzeEngineOptions {
  /** Which analyses to run. Default: all four. */
  types?: readonly AnalysisType[];
  /** Restrict findings to one workspace (relative path or package name). */
  workspace?: string;
}

export interface AnalysisSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byType: Record<AnalysisType, number>;
}

export interface AnalysisEngineResult {
  types: AnalysisType[];
  graph: { packages: number; edges: number; services: number };
  findings: Finding[];
  summary: AnalysisSummary;
}

const RUNNERS: Record<AnalysisType, (m: WorkspaceModel) => Finding[]> = {
  architecture: architectureFindings,
  security: securityFindings,
  performance: performanceFindings,
  scalability: scalabilityFindings,
};

export function isAnalysisType(value: string): value is AnalysisType {
  return (ANALYSIS_TYPES as readonly string[]).includes(value);
}

/** Run the selected analyses over the workspace at `root`. Pure with respect to the file system (read-only). */
export function analyzeWorkspace(root: string, options: AnalyzeEngineOptions = {}): AnalysisEngineResult {
  const types = [...(options.types ?? ANALYSIS_TYPES)].filter((t, i, a) => a.indexOf(t) === i);
  const model = buildModel(root);

  let findings = types.flatMap(t => RUNNERS[t](model));

  if (options.workspace) {
    const wanted = options.workspace.replace(/\\/g, '/').replace(/\/+$/, '');
    const pkg = model.packages.find(p => p.name === wanted || p.rel === wanted);
    const rel = pkg?.rel ?? wanted;
    const name = pkg?.name ?? wanted;
    findings = findings.filter(f =>
      f.evidence.some(e => (e.file !== undefined && (e.file === rel || e.file.startsWith(`${rel}/`))) || (e.path ?? []).includes(name))
    );
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.id.localeCompare(b.id)
  );

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byType: Record<AnalysisType, number> = { security: 0, performance: 0, scalability: 0, architecture: 0 };
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byType[f.type] += 1;
  }

  return {
    types,
    graph: { packages: model.packages.length, edges: model.edges.length, services: model.services.length },
    findings,
    summary: { total: findings.length, bySeverity, byType },
  };
}
