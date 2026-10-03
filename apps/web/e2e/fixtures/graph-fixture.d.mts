export interface GraphSpecNode {
  name: string;
  dir: string;
  layer: number;
  kind: 'app' | 'package';
  deps: string[];
  devDeps: string[];
  framework: { id: string | null; deps: Record<string, string>; dev: Record<string, string>; language: string };
  marker: string | null;
  service?: { port: number; healthUrl: string };
}

export interface GraphPorts {
  healthyPort?: number;
  unhealthyPort?: number;
  closedPorts?: number[];
}

export function buildGraphSpec(count: number, ports?: GraphPorts): GraphSpecNode[];
export function writeGraphWorkspace(root: string, spec: GraphSpecNode[]): void;
export function describeSpec(spec: GraphSpecNode[]): { nodes: number; apps: number; edges: number };
