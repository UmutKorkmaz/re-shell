/**
 * Data Lineage Tracking across Polyglot Services with Visualization
 * Track data flow, transformations, service dependencies with graph visualization
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Data flow event types
export type DataEventType =
  | 'transform'
  | 'validate'
  | 'enrich'
  | 'aggregate'
  | 'filter'
  | 'join'
  | 'split'
  | 'serialize'
  | 'deserialize'
  | 'store';

// Service types
export type ServiceType = 'producer' | 'consumer' | 'transformer' | 'storage' | 'gateway';

// Visualization formats
export type VisualizationFormat = 'dot' | 'json' | 'mermaid' | 'plantuml' | 'html';

// Data lineage node
export interface LineageNode {
  id: string;
  type: ServiceType;
  service: string;
  language: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Data lineage edge
export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  eventType: DataEventType;
  dataFormat: string;
  dataSize: number;
  transformation?: string;
  timestamp: Date;
}

// Data flow event
export interface DataFlowEvent {
  eventId: string;
  sourceService: string;
  targetService: string;
  eventType: DataEventType;
  dataFormat: string;
  dataSize: number;
  transformation?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Lineage graph
export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  events: DataFlowEvent[];
  metadata: {
    startTime: Date;
    endTime: Date;
    totalEvents: number;
    totalDataVolume: number;
  };
}

// Visualization output
export interface VisualizationOutput {
  format: VisualizationFormat;
  content: string;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    eventCount: number;
  };
}

// Lineage tracker configuration
export interface LineageTrackerConfig {
  serviceName: string;
  enableVisualization: boolean;
  defaultFormat: VisualizationFormat;
  maxEvents: number;
  retentionDays: number;
  enableMetrics: boolean;
}

// Generate lineage tracker config
export async function generateLineageTrackerConfig(
  serviceName: string,
  defaultFormat: VisualizationFormat = 'mermaid'
): Promise<LineageTrackerConfig> {
  return {
    serviceName,
    enableVisualization: true,
    defaultFormat,
    maxEvents: 10000,
    retentionDays: 30,
    enableMetrics: true,
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptLineageTracker(
  config: LineageTrackerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-lineage-tracker.ts`,
    content: `// Data Lineage Tracker for ${config.serviceName}

export type DataEventType =
  | 'transform'
  | 'validate'
  | 'enrich'
  | 'aggregate'
  | 'filter'
  | 'join'
  | 'split'
  | 'serialize'
  | 'deserialize'
  | 'store';

export type ServiceType = 'producer' | 'consumer' | 'transformer' | 'storage' | 'gateway';
export type VisualizationFormat = 'dot' | 'json' | 'mermaid' | 'plantuml' | 'html';

export interface LineageNode {
  id: string;
  type: ServiceType;
  service: string;
  language: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  eventType: DataEventType;
  dataFormat: string;
  dataSize: number;
  transformation?: string;
  timestamp: Date;
}

export interface DataFlowEvent {
  eventId: string;
  sourceService: string;
  targetService: string;
  eventType: DataEventType;
  dataFormat: string;
  dataSize: number;
  transformation?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  events: DataFlowEvent[];
  metadata: {
    startTime: Date;
    endTime: Date;
    totalEvents: number;
    totalDataVolume: number;
  };
}

export class ${toPascalCase(config.serviceName)}DataLineageTracker {
  private nodes: Map<string, LineageNode>;
  private edges: Map<string, LineageEdge>;
  private events: DataFlowEvent[];
  private config: any;
  private metrics: Map<string, number>;

  constructor(config: any) {
    this.nodes = new Map();
    this.edges = new Map();
    this.events = [];
    this.config = config;
    this.metrics = new Map();
  }

  /**
   * Register a service node
   */
  registerNode(
    id: string,
    service: string,
    type: ServiceType,
    language: string,
    metadata?: Record<string, any>
  ): LineageNode {
    const node: LineageNode = {
      id,
      type,
      service,
      language,
      timestamp: new Date(),
      metadata,
    };

    this.nodes.set(id, node);
    return node;
  }

  /**
   * Track a data flow event
   */
  trackEvent(event: Omit<DataFlowEvent, 'eventId' | 'timestamp'>): DataFlowEvent {
    const dataFlowEvent: DataFlowEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(dataFlowEvent);

    // Create or update nodes
    const sourceId = \`node-\${event.sourceService}\`;
    const targetId = \`node-\${event.targetService}\`;

    if (!this.nodes.has(sourceId)) {
      this.registerNode(sourceId, event.sourceService, 'producer', 'unknown');
    }
    if (!this.nodes.has(targetId)) {
      this.registerNode(targetId, event.targetService, 'consumer', 'unknown');
    }

    // Create edge
    const edgeId = \`edge-\${sourceId}-\${targetId}-\${dataFlowEvent.eventId}\`;
    const edge: LineageEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      eventType: event.eventType,
      dataFormat: event.dataFormat,
      dataSize: event.dataSize,
      transformation: event.transformation,
      timestamp: dataFlowEvent.timestamp,
    };

    this.edges.set(edgeId, edge);

    // Update metrics
    this.updateMetrics(event);

    return dataFlowEvent;
  }

  /**
   * Get lineage graph
   */
  getLineageGraph(): LineageGraph {
    const sortedEvents = [...this.events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      events: sortedEvents,
      metadata: {
        startTime: sortedEvents[0]?.timestamp || new Date(),
        endTime: sortedEvents[sortedEvents.length - 1]?.timestamp || new Date(),
        totalEvents: this.events.length,
        totalDataVolume: this.calculateTotalDataVolume(),
      },
    };
  }

  /**
   * Generate visualization
   */
  visualize(format: VisualizationFormat = this.config.defaultFormat): VisualizationOutput {
    const graph = this.getLineageGraph();

    let content: string;

    switch (format) {
      case 'dot':
        content = this.generateDotFormat(graph);
        break;
      case 'mermaid':
        content = this.generateMermaidFormat(graph);
        break;
      case 'plantuml':
        content = this.generatePlantUMLFormat(graph);
        break;
      case 'html':
        content = this.generateHTMLFormat(graph);
        break;
      case 'json':
      default:
        content = JSON.stringify(graph, null, 2);
        break;
    }

    return {
      format,
      content,
      metadata: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        eventCount: graph.events.length,
      },
    };
  }

  /**
   * Generate DOT format (Graphviz)
   */
  private generateDotFormat(graph: LineageGraph): string {
    let dot = 'digraph DataLineage {\\n';
    dot += '  rankdir=LR;\\n';
    dot += '  node [shape=box];\\n\\n';

    // Nodes
    for (const node of graph.nodes) {
      const color = this.getNodeColor(node.type);
      dot += \`  "\${node.id}" [label="\${node.service}\\\\n(\${node.language})", fillcolor=\${color}, style="filled"];\\n\`;
    }

    dot += '\\n';

    // Edges
    for (const edge of graph.edges) {
      const label = edge.transformation || edge.eventType;
      dot += \`  "\${edge.source}" -> "\${edge.target}" [label="\${label}\\\\n(\${this.formatBytes(edge.dataSize)})"];\n\`;
    }

    dot += '}';
    return dot;
  }

  /**
   * Generate Mermaid format
   */
  private generateMermaidFormat(graph: LineageGraph): string {
    let mermaid = 'graph LR;\\n';

    // Nodes
    const nodeMap = new Map<string, string>();
    let nodeId = 0;
    for (const node of graph.nodes) {
      const shortId = \`N\${nodeId++}\`;
      const shape = this.getMermaidShape(node.type);
      nodeMap.set(node.id, shortId);
      mermaid += \`  \${shortId}\${shape}["\${node.service}\\\\n(\${node.language})"]\\n\`;
    }

    // Edges
    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.source) || edge.source;
      const target = nodeMap.get(edge.target) || edge.target;
      const label = edge.transformation || edge.eventType;
      mermaid += \`  \${source}|\${label}|\\n\`;
    }

    return mermaid;
  }

  /**
   * Generate PlantUML format
   */
  private generatePlantUMLFormat(graph: LineageGraph): string {
    let plantuml = '@startuml\\n';
    plantuml += 'skinparam monochrome true\\n\\n';

    // Nodes and edges
    for (const edge of graph.edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);

      if (sourceNode && targetNode) {
        const label = edge.transformation || edge.eventType;
        plantuml += \`"\${sourceNode.service}" -> "\${targetNode.service}" : \${label}\\\\n[\${this.formatBytes(edge.dataSize)}]\\n\`;
      }
    }

    plantuml += '@enduml';
    return plantuml;
  }

  /**
   * Generate HTML format with embedded visualization
   */
  private generateHTMLFormat(graph: LineageGraph): string {
    const mermaidCode = this.generateMermaidFormat(graph);

    return \`<!DOCTYPE html>
<html>
<head>
  <title>Data Lineage - \${this.config.serviceName}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .stat-card h3 { margin: 0 0 10px 0; color: #333; }
    .stat-card .value { font-size: 32px; font-weight: bold; color: #0066cc; }
    .graph-container { background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
    .events-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
    .events-table th, .events-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .events-table th { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Data Lineage Visualization</h1>
    <h2>Service: \${this.config.serviceName}</h2>

    <div class="stats">
      <div class="stat-card">
        <h3>Total Events</h3>
        <div class="value">\${graph.events.length}</div>
      </div>
      <div class="stat-card">
        <h3>Services</h3>
        <div class="value">\${graph.nodes.length}</div>
      </div>
      <div class="stat-card">
        <h3>Data Flows</h3>
        <div class="value">\${graph.edges.length}</div>
      </div>
      <div class="stat-card">
        <h3>Total Volume</h3>
        <div class="value">\${this.formatBytes(graph.metadata.totalDataVolume)}</div>
      </div>
    </div>

    <div class="graph-container">
      <div class="mermaid">
\${mermaidCode}
      </div>
    </div>

    <h2>Recent Events</h2>
    <table class="events-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Source</th>
          <th>Target</th>
          <th>Event Type</th>
          <th>Format</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
\${graph.events.slice(-10).reverse().map(event => \`
        <tr>
          <td>\${event.timestamp.toISOString()}</td>
          <td>\${event.sourceService}</td>
          <td>\${event.targetService}</td>
          <td>\${event.eventType}</td>
          <td>\${event.dataFormat}</td>
          <td>\${this.formatBytes(event.dataSize)}</td>
        </tr>
\`).join('')}
      </tbody>
    </table>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true });
  </script>
</body>
</html>\`;
  }

  /**
   * Get node color for DOT format
   */
  private getNodeColor(type: ServiceType): string {
    const colors = {
      producer: 'lightblue',
      consumer: 'lightgreen',
      transformer: 'lightyellow',
      storage: 'lightgray',
      gateway: 'lightcoral',
    };
    return colors[type] || 'white';
  }

  /**
   * Get Mermaid node shape
   */
  private getMermaidShape(type: ServiceType): string {
    const shapes = {
      producer: '([ ',
      consumer: '([ ',
      transformer: '[ ',
      storage: '[( ',
      gateway: '([ ',
    };
    return shapes[type] || '[ ';
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return \`event-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  /**
   * Calculate total data volume
   */
  private calculateTotalDataVolume(): number {
    return this.events.reduce((sum, event) => sum + event.dataSize, 0);
  }

  /**
   * Update metrics
   */
  private updateMetrics(event: Omit<DataFlowEvent, 'eventId' | 'timestamp'>): void {
    const key = \`\${event.sourceService}->\${event.targetService}\`;
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + event.dataSize);
  }

  /**
   * Get metrics for a service
   */
  getServiceMetrics(serviceName: string): {
    eventsIn: number;
    eventsOut: number;
    dataIn: number;
    dataOut: number;
  } {
    const eventsIn = this.events.filter(e => e.targetService === serviceName);
    const eventsOut = this.events.filter(e => e.sourceService === serviceName);

    return {
      eventsIn: eventsIn.length,
      eventsOut: eventsOut.length,
      dataIn: eventsIn.reduce((sum, e) => sum + e.dataSize, 0),
      dataOut: eventsOut.reduce((sum, e) => sum + e.dataSize, 0),
    };
  }

  /**
   * Get data path between services
   */
  getDataPath(sourceService: string, targetService: string): DataFlowEvent[] {
    const path: DataFlowEvent[] = [];
    const visited = new Set<string>();
    const queue: Array<{ service: string; events: DataFlowEvent[] }> = [
      { service: sourceService, events: [] },
    ];

    while (queue.length > 0) {
      const { service, events } = queue.shift()!;

      if (service === targetService) {
        return events;
      }

      if (visited.has(service)) continue;
      visited.add(service);

      const outgoingEvents = this.events.filter(e => e.sourceService === service);
      for (const event of outgoingEvents) {
        queue.push({
          service: event.targetService,
          events: [...events, event],
        });
      }
    }

    return path;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return \`\${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} \${sizes[i]}\`;
  }

  /**
   * Export lineage data
   */
  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.getLineageGraph(), null, 2);
    }

    // CSV format
    let csv = 'Timestamp,Source,Target,EventType,Format,Size,Transformation\\n';
    for (const event of this.events) {
      csv += \`"\${event.timestamp.toISOString()}","\${event.sourceService}","\${event.targetService}","\${event.eventType}","\${event.dataFormat}",\${event.dataSize},"\${event.transformation || ''}"\\n\`;
    }
    return csv;
  }

  /**
   * Clear old events
   */
  clearOldEvents(retentionDays: number = this.config.retentionDays): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const initialCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp > cutoff);

    // Rebuild edges
    this.edges.clear();
    for (const event of this.events) {
      const sourceId = \`node-\${event.sourceService}\`;
      const targetId = \`node-\${event.targetService}\`;
      const edgeId = \`edge-\${sourceId}-\${targetId}-\${event.eventId}\`;
      const edge: LineageEdge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        eventType: event.eventType,
        dataFormat: event.dataFormat,
        dataSize: event.dataSize,
        transformation: event.transformation,
        timestamp: event.timestamp,
      };
      this.edges.set(edgeId, edge);
    }

    return initialCount - this.events.length;
  }
}

// Factory function
export function createDataLineageTracker(config: any) {
  return new ${toPascalCase(config.serviceName)}DataLineageTracker(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    enableVisualization: true,
    defaultFormat: 'mermaid',
    maxEvents: 10000,
    retentionDays: 30,
  };

  const tracker = new ${toPascalCase(config.serviceName)}DataLineageTracker(config);

  // Register services
  tracker.registerNode('service-api', 'API Gateway', 'gateway', 'TypeScript');
  tracker.registerNode('service-user', 'User Service', 'transformer', 'Python');
  tracker.registerNode('service-db', 'Database', 'storage', 'SQL');

  // Track data flow events
  tracker.trackEvent({
    sourceService: 'API Gateway',
    targetService: 'User Service',
    eventType: 'transform',
    dataFormat: 'json',
    dataSize: 1024,
    transformation: 'validateUser',
  });

  tracker.trackEvent({
    sourceService: 'User Service',
    targetService: 'Database',
    eventType: 'store',
    dataFormat: 'protobuf',
    dataSize: 512,
    transformation: 'saveUser',
  });

  // Generate visualization
  const viz = tracker.visualize('html');

  console.log('Data Lineage Visualization:');
  console.log(\`  Nodes: \${viz.metadata.nodeCount}\`);
  console.log(\`  Edges: \${viz.metadata.edgeCount}\`);
  console.log(\`  Events: \${viz.metadata.eventCount}\`);

  // Save to file
  // fs.writeFileSync('lineage.html', viz.content);
  // console.log('Saved to lineage.html');
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonLineageTracker(
  config: LineageTrackerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_data_lineage_tracker.py`,
    content: `# Data Lineage Tracker for ${config.serviceName}
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import json
import uuid

class DataEventType(Enum):
    TRANSFORM = 'transform'
    VALIDATE = 'validate'
    ENRICH = 'enrich'
    AGGREGATE = 'aggregate'
    FILTER = 'filter'
    JOIN = 'join'
    SPLIT = 'split'
    SERIALIZE = 'serialize'
    DESERIALIZE = 'deserialize'
    STORE = 'store'

class ServiceType(Enum):
    PRODUCER = 'producer'
    CONSUMER = 'consumer'
    TRANSFORMER = 'transformer'
    STORAGE = 'storage'
    GATEWAY = 'gateway'

class VisualizationFormat(Enum):
    DOT = 'dot'
    JSON = 'json'
    MERMAID = 'mermaid'
    PLANTUML = 'plantuml'
    HTML = 'html'

@dataclass
class LineageNode:
    id: str
    type: ServiceType
    service: str
    language: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class LineageEdge:
    id: str
    source: str
    target: str
    event_type: DataEventType
    data_format: str
    data_size: int
    transformation: Optional[str] = None
    timestamp: datetime = None

@dataclass
class DataFlowEvent:
    event_id: str
    source_service: str
    target_service: str
    event_type: DataEventType
    data_format: str
    data_size: int
    transformation: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime = None

class ${toPascalCase(config.serviceName)}DataLineageTracker:
    def __init__(self, config: Dict[str, Any]):
        self.nodes: Dict[str, LineageNode] = {}
        self.edges: Dict[str, LineageEdge] = {}
        self.events: List[DataFlowEvent] = []
        self.config = config
        self.metrics: Dict[str, int] = {}

    def register_node(
        self,
        node_id: str,
        service: str,
        node_type: ServiceType,
        language: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LineageNode:
        """Register a service node"""
        node = LineageNode(
            id=node_id,
            type=node_type,
            service=service,
            language=language,
            timestamp=datetime.utcnow(),
            metadata=metadata,
        )
        self.nodes[node_id] = node
        return node

    def track_event(
        self,
        source_service: str,
        target_service: str,
        event_type: DataEventType,
        data_format: str,
        data_size: int,
        transformation: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> DataFlowEvent:
        """Track a data flow event"""
        event = DataFlowEvent(
            event_id=str(uuid.uuid4()),
            source_service=source_service,
            target_service=target_service,
            event_type=event_type,
            data_format=data_format,
            data_size=data_size,
            transformation=transformation,
            metadata=metadata,
            timestamp=datetime.utcnow(),
        )

        self.events.append(event)

        # Create or update nodes
        source_id = f"node-{source_service}"
        target_id = f"node-{target_service}"

        if source_id not in self.nodes:
            self.register_node(source_id, source_service, ServiceType.PRODUCER, 'unknown')
        if target_id not in self.nodes:
            self.register_node(target_id, target_service, ServiceType.CONSUMER, 'unknown')

        # Create edge
        edge_id = f"edge-{source_id}-{target_id}-{event.event_id}"
        edge = LineageEdge(
            id=edge_id,
            source=source_id,
            target=target_id,
            event_type=event_type,
            data_format=data_format,
            data_size=data_size,
            transformation=transformation,
            timestamp=event.timestamp,
        )
        self.edges[edge_id] = edge

        return event

    def visualize(self, format: VisualizationFormat = VisualizationFormat.MERMAID) -> Dict[str, Any]:
        """Generate visualization"""
        if format == VisualizationFormat.JSON:
            content = json.dumps({
                'nodes': [self._node_to_dict(n) for n in self.nodes.values()],
                'events': [self._event_to_dict(e) for e in self.events],
            }, indent=2)
        elif format == VisualizationFormat.MERMAID:
            content = self._generate_mermaid()
        elif format == VisualizationFormat.HTML:
            content = self._generate_html()
        else:
            content = ""

        return {
            'format': format.value,
            'content': content,
            'metadata': {
                'nodeCount': len(self.nodes),
                'edgeCount': len(self.edges),
                'eventCount': len(self.events),
            }
        }

    def _generate_mermaid(self) -> str:
        """Generate Mermaid format"""
        lines = ['graph LR']

        node_map = {}
        node_id = 0
        for node_id_key, node in self.nodes.items():
            short_id = f"N{node_id}"
            node_map[node_id_key] = short_id
            lines.append(f"  {short_id}["{node.service}\\\\n({node.language})"]")
            node_id += 1

        for edge in self.edges.values():
            source = node_map.get(edge.source, edge.source)
            target = node_map.get(edge.target, edge.target)
            label = edge.transformation or edge.event_type.value
            lines.append(f"  {source}|{label}|{target}")

        return '\\n'.join(lines)

    def _generate_html(self) -> str:
        """Generate HTML visualization"""
        mermaid = self._generate_mermaid()
        return f'''<!DOCTYPE html>
<html>
<head>
  <title>Data Lineage - {self.config.get('serviceName', 'Unknown')}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 20px; }}
    .container {{ max-width: 1200px; margin: 0 auto; }}
    .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }}
    .stat-card {{ background: #f5f5f5; padding: 20px; border-radius: 8px; }}
    .stat-card h3 {{ margin: 0; color: #333; }}
    .stat-card .value {{ font-size: 32px; font-weight: bold; color: #0066cc; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>Data Lineage</h1>
    <div class="stats">
      <div class="stat-card"><h3>Events</h3><div class="value">{len(self.events)}</div></div>
      <div class="stat-card"><h3>Services</h3><div class="value">{len(self.nodes)}</div></div>
    </div>
    <div class="mermaid">
{mermaid}
    </div>
  </div>
  <script>mermaid.initialize({{ startOnLoad: true }});</script>
</body>
</html>'''

    def _node_to_dict(self, node: LineageNode) -> Dict:
        return {
            'id': node.id,
            'type': node.type.value,
            'service': node.service,
            'language': node.language,
            'timestamp': node.timestamp.isoformat(),
        }

    def _event_to_dict(self, event: DataFlowEvent) -> Dict:
        return {
            'eventId': event.event_id,
            'sourceService': event.source_service,
            'targetService': event.target_service,
            'eventType': event.event_type.value,
            'dataFormat': event.data_format,
            'dataSize': event.data_size,
            'timestamp': event.timestamp.isoformat(),
        }

# Usage
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'enableVisualization': True,
        'defaultFormat': 'mermaid',
    }

    tracker = ${toPascalCase(config.serviceName)}DataLineageTracker(config)

    tracker.register_node('service-api', 'API Gateway', ServiceType.GATEWAY, 'TypeScript')
    tracker.register_node('service-user', 'User Service', ServiceType.TRANSFORMER, 'Python')

    tracker.track_event(
        source_service='API Gateway',
        target_service='User Service',
        event_type=DataEventType.TRANSFORM,
        data_format='json',
        data_size=1024,
        transformation='validateUser',
    )

    viz = tracker.visualize(VisualizationFormat.MERMAID)
    print(f"Events: {viz['metadata']['eventCount']}")
    print(f"Services: {viz['metadata']['nodeCount']}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoLineageTracker(
  config: LineageTrackerConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-lineage-tracker.go`,
    content: `package main

import (
	"encoding/json"
	"fmt"
	"time"
)

type DataEventType string

const (
	EventTransform   DataEventType = "transform"
	EventValidate    DataEventType = "validate"
	EventEnrich      DataEventType = "enrich"
	EventAggregate   DataEventType = "aggregate"
	EventFilter      DataEventType = "filter"
	EventJoin        DataEventType = "join"
	EventSplit       DataEventType = "split"
	EventSerialize   DataEventType = "serialize"
	EventDeserialize DataEventType = "deserialize"
	EventStore       DataEventType = "store"
)

type ServiceType string

const (
	TypeProducer    ServiceType = "producer"
	TypeConsumer    ServiceType = "consumer"
	TypeTransformer ServiceType = "transformer"
	TypeStorage     ServiceType = "storage"
	TypeGateway     ServiceType = "gateway"
)

type VisualizationFormat string

const (
	FormatDot     VisualizationFormat = "dot"
	FormatJSON    VisualizationFormat = "json"
	FormatMermaid VisualizationFormat = "mermaid"
	FormatPlantUML VisualizationFormat = "plantuml"
	FormatHTML    VisualizationFormat = "html"
)

type LineageNode struct {
	ID        string                 \`json:"id"\`
	Type      ServiceType            \`json:"type"\`
	Service   string                 \`json:"service"\`
	Language  string                 \`json:"language"\`
	Timestamp time.Time              \`json:"timestamp"\`
	Metadata  map[string]interface{} \`json:"metadata,omitempty"\`
}

type LineageEdge struct {
	ID            string        \`json:"id"\`
	Source        string        \`json:"source"\`
	Target        string        \`json:"target"\`
	EventType     DataEventType \`json:"eventType"\`
	DataFormat    string        \`json:"dataFormat"\`
	DataSize      int64         \`json:"dataSize"\`
	Transformation string       \`json:"transformation,omitempty"\`
	Timestamp     time.Time     \`json:"timestamp"\`
}

type DataFlowEvent struct {
	EventID       string                 \`json:"eventId"\`
	SourceService string                 \`json:"sourceService"\`
	TargetService string                 \`json:"targetService"\`
	EventType     DataEventType          \`json:"eventType"\`
	DataFormat    string                 \`json:"dataFormat"\`
	DataSize      int64                  \`json:"dataSize"\`
	Transformation string                \`json:"transformation,omitempty"\`
	Metadata      map[string]interface{}  \`json:"metadata,omitempty"\`
	Timestamp     time.Time              \`json:"timestamp"\`
}

type LineageGraph struct {
	Nodes    []LineageNode    \`json:"nodes"\`
	Edges    []LineageEdge    \`json:"edges"\`
	Events   []DataFlowEvent  \`json:"events"\`
	Metadata GraphMetadata    \`json:"metadata"\`
}

type GraphMetadata struct {
	StartTime      time.Time \`json:"startTime"\`
	EndTime        time.Time \`json:"endTime"\`
	TotalEvents    int       \`json:"totalEvents"\`
	TotalDataVolume int64    \`json:"totalDataVolume"\`
}

type ${toPascalCase(config.serviceName)}DataLineageTracker struct {
	nodes   map[string]LineageNode
	edges   map[string]LineageEdge
	events  []DataFlowEvent
	config  map[string]interface{}
	metrics map[string]int64
}

func New${toPascalCase(config.serviceName)}DataLineageTracker(config map[string]interface{}) *${toPascalCase(config.serviceName)}DataLineageTracker {
	return &${toPascalCase(config.serviceName)}DataLineageTracker{
		nodes:   make(map[string]LineageNode),
		edges:   make(map[string]LineageEdge),
		events:  []DataFlowEvent{},
		config:  config,
		metrics: make(map[string]int64),
	}
}

func (t *${toPascalCase(config.serviceName)}DataLineageTracker) RegisterNode(
	id string,
	service string,
	nodeType ServiceType,
	language string,
) LineageNode {
	node := LineageNode{
		ID:       id,
		Type:     nodeType,
		Service:  service,
		Language: language,
		Timestamp: time.Now(),
	}
	t.nodes[id] = node
	return node
}

func (t *${toPascalCase(config.serviceName)}DataLineageTracker) TrackEvent(
	sourceService string,
	targetService string,
	eventType DataEventType,
	dataFormat string,
	dataSize int64,
	transformation string,
) DataFlowEvent {
	event := DataFlowEvent{
		EventID:       fmt.Sprintf("event-%d", time.Now().UnixNano()),
		SourceService: sourceService,
		TargetService: targetService,
		EventType:     eventType,
		DataFormat:    dataFormat,
		DataSize:      dataSize,
		Transformation: transformation,
		Timestamp:     time.Now(),
	}

	t.events = append(t.events, event)

	// Create nodes and edges
	sourceId := fmt.Sprintf("node-%s", sourceService)
	targetId := fmt.Sprintf("node-%s", targetService)

	if _, exists := t.nodes[sourceId]; !exists {
		t.RegisterNode(sourceId, sourceService, TypeProducer, "unknown")
	}
	if _, exists := t.nodes[targetId]; !exists {
		t.RegisterNode(targetId, targetService, TypeConsumer, "unknown")
	}

	edgeId := fmt.Sprintf("edge-%s-%s-%s", sourceId, targetId, event.EventID)
	edge := LineageEdge{
		ID:            edgeId,
		Source:        sourceId,
		Target:        targetId,
		EventType:     eventType,
		DataFormat:    dataFormat,
		DataSize:      dataSize,
		Transformation: transformation,
		Timestamp:     event.Timestamp,
	}
	t.edges[edgeId] = edge

	return event
}

func (t *${toPascalCase(config.serviceName)}DataLineageTracker) Visualize(format VisualizationFormat) (string, map[string]interface{}) {
	graph := t.GetLineageGraph()

	var content string
	switch format {
	case FormatJSON:
		jsonData, _ := json.Marshal(graph)
		content = string(jsonData)
	case FormatMermaid:
		content = t.generateMermaid(graph)
	default:
		jsonData, _ := json.Marshal(graph)
		content = string(jsonData)
	}

	metadata := map[string]interface{}{
		"nodeCount":  len(graph.Nodes),
		"edgeCount":  len(graph.Edges),
		"eventCount": len(graph.Events),
	}

	return content, metadata
}

func (t *${toPascalCase(config.serviceName)}DataLineageTracker) GetLineageGraph() LineageGraph {
	graph := LineageGraph{
		Nodes:  make([]LineageNode, 0, len(t.nodes)),
		Edges:  make([]LineageEdge, 0, len(t.edges)),
		Events: t.events,
	}

	for _, node := range t.nodes {
		graph.Nodes = append(graph.Nodes, node)
	}
	for _, edge := range t.edges {
		graph.Edges = append(graph.Edges, edge)
	}

	if len(t.events) > 0 {
		graph.Metadata.StartTime = t.events[0].Timestamp
		graph.Metadata.EndTime = t.events[len(t.events)-1].Timestamp
		graph.Metadata.TotalEvents = len(t.events)
	}

	return graph
}

func (t *${toPascalCase(config.serviceName)}DataLineageTracker) generateMermaid(graph LineageGraph) string {
	mermaid := "graph LR\\\\n"

	nodeMap := make(map[string]string)
	nodeId := 0
	for _, node := range graph.Nodes {
		shortId := fmt.Sprintf("N%d", nodeId)
		nodeMap[node.ID] = shortId
		mermaid += fmt.Sprintf("  %s[\\"%s\\\\\\\\n(%s)\\"]\\\\n", shortId, node.Service, node.Language)
		nodeId++
	}

	for _, edge := range graph.Edges {
		source := nodeMap[edge.Source]
		target := nodeMap[edge.Target]
		label := edge.Transformation
		if label == "" {
			label = string(edge.EventType)
		}
		mermaid += fmt.Sprintf("  %s|%s|%s\\\\n", source, label, target)
	}

	return mermaid
}

func main() {
	config := map[string]interface{}{
		"serviceName": "${config.serviceName}",
		"enableVisualization": true,
		"defaultFormat": "mermaid",
	}

	tracker := New${toPascalCase(config.serviceName)}DataLineageTracker(config)

	tracker.RegisterNode("service-api", "API Gateway", TypeGateway, "TypeScript")
	tracker.RegisterNode("service-user", "User Service", TypeTransformer, "Python")

	tracker.TrackEvent(
		"API Gateway",
		"User Service",
		EventTransform,
		"json",
		1024,
		"validateUser",
	)

	content, metadata := tracker.Visualize(FormatMermaid)

	fmt.Printf("Events: %v\\\\n", metadata["eventCount"])
	fmt.Printf("Services: %v\\\\n", metadata["nodeCount"])
	fmt.Printf("Mermaid:\\\\n%s\\\\n", content)
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeLineageTrackerFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayLineageTrackerConfig(config: LineageTrackerConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n🔍 Data Lineage Tracker: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Visualization Enabled:'), config.enableVisualization ? chalk.green('yes') : chalk.red('no'));
  console.log(chalk.cyan('Default Format:'), config.defaultFormat);
  console.log(chalk.cyan('Max Events:'), config.maxEvents);
  console.log(chalk.cyan('Retention Days:'), config.retentionDays);
  console.log(chalk.cyan('Metrics Enabled:'), config.enableMetrics ? chalk.green('yes') : chalk.red('no'));

  console.log(chalk.cyan('\n📊 Event Types:'));
  console.log(chalk.gray('  • transform - Data transformation'));
  console.log(chalk.gray('  • validate - Data validation'));
  console.log(chalk.gray('  • enrich - Data enrichment'));
  console.log(chalk.gray('  • aggregate - Data aggregation'));
  console.log(chalk.gray('  • filter - Data filtering'));
  console.log(chalk.gray('  • join - Data joining'));
  console.log(chalk.gray('  • split - Data splitting'));
  console.log(chalk.gray('  • serialize - Serialization'));
  console.log(chalk.gray('  • deserialize - Deserialization'));
  console.log(chalk.gray('  • store - Data storage'));

  console.log(chalk.cyan('\n🏗️  Service Types:'));
  console.log(chalk.gray('  • producer - Data producer'));
  console.log(chalk.gray('  • consumer - Data consumer'));
  console.log(chalk.gray('  • transformer - Data transformer'));
  console.log(chalk.gray('  • storage - Data storage'));
  console.log(chalk.gray('  • gateway - API gateway'));

  console.log(chalk.cyan('\n📈 Visualization Formats:'));
  console.log(chalk.gray('  • dot - Graphviz DOT format'));
  console.log(chalk.gray('  • json - JSON export'));
  console.log(chalk.gray('  • mermaid - Mermaid diagram'));
  console.log(chalk.gray('  • plantuml - PlantUML diagram'));
  console.log(chalk.gray('  • html - Interactive HTML visualization'));

  console.log(chalk.cyan('\n✨ Features:'));
  console.log(chalk.gray('  • Real-time event tracking'));
  console.log(chalk.gray('  • Service dependency graph'));
  console.log(chalk.gray('  • Data flow visualization'));
  console.log(chalk.gray('  • Service metrics'));
  console.log(chalk.gray('  • Data path analysis'));
  console.log(chalk.gray('  • Export to multiple formats'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Data Lineage Tracker Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This data lineage tracker provides:
- **Event Tracking**: Track data flow between services in real-time
- **Service Graph**: Automatic service dependency graph generation
- **Multiple Visualizations**: Mermaid, PlantUML, Graphviz, HTML
- **Metrics Collection**: Per-service data volume and event counts
- **Path Analysis**: Trace data paths through services
- **Export Options**: JSON, CSV, multiple diagram formats

## Usage Examples

### Basic Tracking

\`\`\`typescript
import { ${toPascalCase(serviceName)}DataLineageTracker } from './${serviceName}-data-lineage-tracker';

const tracker = new ${toPascalCase(serviceName)}DataLineageTracker({
  serviceName: '${serviceName}',
  enableVisualization: true,
  defaultFormat: 'mermaid',
  maxEvents: 10000,
  retentionDays: 30,
});

// Register services
tracker.registerNode('api', 'API Gateway', 'gateway', 'TypeScript');
tracker.registerNode('user-service', 'User Service', 'transformer', 'Python');
tracker.registerNode('database', 'Primary DB', 'storage', 'SQL');

// Track data flow
tracker.trackEvent({
  sourceService: 'API Gateway',
  targetService: 'User Service',
  eventType: 'transform',
  dataFormat: 'json',
  dataSize: 1024,
  transformation: 'validateUser',
});

tracker.trackEvent({
  sourceService: 'User Service',
  targetService: 'Primary DB',
  eventType: 'store',
  dataFormat: 'protobuf',
  dataSize: 512,
  transformation: 'saveUser',
});

// Generate visualization
const viz = tracker.visualize('html');
fs.writeFileSync('lineage.html', viz.content);
\`\`\`

### Querying Lineage Data

\`\`\`typescript
// Get service metrics
const metrics = tracker.getServiceMetrics('User Service');
console.log(\`Events in: \${metrics.eventsIn}\`);
console.log(\`Events out: \${metrics.eventsOut}\`);
console.log(\`Data in: \${metrics.dataIn} bytes\`);
console.log(\`Data out: \${metrics.dataOut} bytes\`);

// Find data path
const path = tracker.getDataPath('API Gateway', 'Primary DB');
console.log(\`Path length: \${path.length} hops\`);

// Export data
const jsonExport = tracker.export('json');
const csvExport = tracker.export('csv');
\`\`\`

## Visualization Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| mermaid | Markdown-compatible diagram | Documentation |
| html | Interactive HTML visualization | Dashboards |
| dot | Graphviz DOT format | Custom graphs |
| plantuml | PlantUML diagram | UML tools |
| json | Raw data export | Programmatic access |

## Integration

See generated code for complete API reference and examples.
`;
}
