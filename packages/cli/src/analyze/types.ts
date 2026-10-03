/**
 * Shared types for the workspace analysis engine (`re-shell analyze`).
 * Mirrors the `analysisFindingSchema` contract in @re-shell/contracts.
 */
export type AnalysisType = 'security' | 'performance' | 'scalability' | 'architecture';
export const ANALYSIS_TYPES: readonly AnalysisType[] = ['security', 'performance', 'scalability', 'architecture'];

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export interface Evidence {
  kind: 'file' | 'graph' | 'config';
  /** Path relative to the workspace root, posix separators. */
  file?: string;
  line?: number;
  /** Ordered package/service names (graph evidence), e.g. a dependency cycle. */
  path?: string[];
  detail: string;
}

export interface Finding {
  /** `<ruleId>:<subject>`; stable across runs for the same issue. */
  id: string;
  ruleId: string;
  type: AnalysisType;
  severity: Severity;
  title: string;
  message: string;
  evidence: Evidence[];
  recommendation: string;
}

export type PackageKind = 'app' | 'package' | 'service' | 'tool' | 'unknown';

export type DepSection = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies';

export interface DeclaredDependency {
  name: string;
  range: string;
  section: DepSection;
  /** 1-based line in the package.json, 0 when it could not be located. */
  line: number;
}

export interface WorkspacePackage {
  name: string;
  /** Absolute directory. */
  dir: string;
  /** Directory relative to the workspace root (posix). */
  rel: string;
  kind: PackageKind;
  manifestFile: string;
  manifest: Record<string, any>;
  deps: DeclaredDependency[];
  scripts: Record<string, string>;
  private: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  section: DepSection;
  file: string;
  line: number;
}

export interface ServiceModel {
  /** Unique id: `<source>:<file>:<name>`. */
  id: string;
  name: string;
  source: 'docker-compose' | 'kubernetes';
  /** Workload kind for Kubernetes (Deployment, StatefulSet, ...). */
  kind?: string;
  file: string;
  line: number;
  images: string[];
  hasHealthcheck: boolean;
  hasResourceLimits: boolean;
  /** Configured replica count; null when not applicable (DaemonSet). */
  replicas: number | null;
  /** True when replicas are not explicitly configured (default of 1 applies). */
  replicasImplicit: boolean;
  /** A HorizontalPodAutoscaler targets this workload. */
  autoscaled: boolean;
  /** Names (within the same file) of services this one depends on. */
  dependsOn: Array<{ name: string; line: number }>;
  /** Inline literal env entries (compose/k8s) for secret scanning. */
  env: Array<{ key: string; value: string; line: number; fromSecretRef: boolean }>;
}

export interface WorkspaceModel {
  root: string;
  packages: WorkspacePackage[];
  byName: Map<string, WorkspacePackage>;
  edges: DependencyEdge[];
  /** package -> packages that depend on it */
  dependents: Map<string, string[]>;
  /** package -> workspace packages it depends on */
  dependencies: Map<string, string[]>;
  services: ServiceModel[];
}
