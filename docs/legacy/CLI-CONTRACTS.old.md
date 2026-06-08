# Re-Shell CLI JSON Contracts

Machine-readable JSON contracts for the Re-Shell CLI UI hub server integration.

## Response Envelope

All commands that support `--json` output a consistent envelope:

### Success Response

```json
{
  "ok": true,
  "data": { ... },
  "warnings": []
}
```

### Error Response

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## Commands

### `re-shell workspace --json`

Returns workspace summary with package manager detection and git status.

**Output:**

```json
{
  "ok": true,
  "data": {
    "path": "/path/to/workspace",
    "name": "my-workspace",
    "packageManager": "pnpm",
    "nodeVersion": "20.10.0",
    "git": {
      "branch": "main",
      "dirty": false,
      "ahead": 0,
      "behind": 0
    },
    "apps": [
      {
        "name": "dashboard",
        "path": "apps/dashboard",
        "type": "app",
        "framework": "react",
        "language": "typescript"
      }
    ],
    "services": [
      {
        "name": "api-service",
        "path": "services/api",
        "type": "backend",
        "framework": "fastify",
        "language": "typescript"
      }
    ]
  },
  "warnings": []
}
```

**TypeScript Interface:**

```typescript
interface WorkspaceSummary {
  path: string;
  name: string;
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';
  nodeVersion?: string;
  git?: {
    branch: string;
    dirty: boolean;
    ahead?: number;
    behind?: number;
  };
  apps: WorkspaceApp[];
  services: WorkspaceService[];
}

interface WorkspaceApp {
  name: string;
  path: string;
  type: 'app';
  framework: string;
  language: string;
  version?: string;
}

interface WorkspaceService {
  name: string;
  path: string;
  type: 'backend' | 'service';
  framework: string;
  language: string;
  version?: string;
}
```

---

### `re-shell workspace list --json`

Lists all workspaces in the monorepo.

**Output:**

```json
{
  "ok": true,
  "data": [
    {
      "name": "dashboard",
      "path": "apps/dashboard",
      "type": "app",
      "framework": "react",
      "language": "typescript",
      "version": "1.0.0",
      "dependencies": ["shared-ui", "api-client"]
    },
    {
      "name": "api-service",
      "path": "services/api",
      "type": "backend",
      "framework": "fastify",
      "language": "typescript",
      "version": "1.0.0",
      "dependencies": ["shared-types"]
    }
  ],
  "warnings": []
}
```

---

### `re-shell workspace health --json`

Returns comprehensive health report with category-based checks.

**Output:**

```json
{
  "ok": true,
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "workspaceFile": "re-shell.workspaces.yaml",
    "duration": 1523,
    "overall": {
      "status": "healthy",
      "score": 92,
      "summary": "Workspace is healthy with 92% of checks passing"
    },
    "categories": [
      {
        "id": "structure",
        "name": "Workspace Structure",
        "description": "Validates workspace directory structure and configuration consistency",
        "summary": {
          "total": 5,
          "passed": 4,
          "failed": 1,
          "warnings": 0,
          "score": 80
        },
        "checks": [
          {
            "id": "workspace-definition-exists",
            "name": "Workspace Definition",
            "description": "Checks if workspace definition file exists",
            "severity": "critical",
            "status": "pass",
            "message": "Workspace definition file found"
          }
        ]
      }
    ],
    "recommendations": [
      "Consider using pnpm for smaller node_modules footprint"
    ],
    "metrics": {
      "workspaceCount": 8,
      "dependencyCount": 24,
      "cycleCount": 0,
      "orphanedCount": 1,
      "coverageScore": 85
    }
  },
  "warnings": []
}
```

**TypeScript Interface:**

```typescript
interface HealthSummary {
  timestamp: string;
  workspaceFile: string;
  duration: number;
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    summary: string;
  };
  categories: HealthCheckCategory[];
  recommendations: string[];
  metrics: {
    workspaceCount: number;
    dependencyCount: number;
    cycleCount: number;
    orphanedCount: number;
    coverageScore: number;
  };
}

interface HealthCheckCategory {
  id: string;
  name: string;
  description: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    score: number;
  };
  checks: HealthCheckResult[];
}

interface HealthCheckResult {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}
```

---

### `re-shell workspace graph --json`

Returns workspace topology dependency graph.

**Output:**

```json
{
  "ok": true,
  "data": {
    "nodes": [
      {
        "id": "dashboard",
        "type": "app",
        "framework": "react",
        "path": "apps/dashboard"
      },
      {
        "id": "api-service",
        "type": "backend",
        "framework": "fastify",
        "path": "services/api"
      }
    ],
    "edges": [
      {
        "from": "dashboard",
        "to": "api-service",
        "type": "dependency"
      }
    ]
  },
  "warnings": []
}
```

**TypeScript Interface:**

```typescript
interface WorkspaceGraph {
  nodes: Array<{
    id: string;
    type: string;
    framework?: string;
    path: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'dependency' | 'devDependency';
  }>;
}
```

---

### `re-shell workspace graph analyze --json`

Returns detailed graph analysis with cycle detection.

**Output:**

```json
{
  "ok": true,
  "data": {
    "nodeCount": 8,
    "edgeCount": 24,
    "hasCycles": false,
    "cycleCount": 0,
    "maxDepth": 4,
    "orphanedNodes": ["shared-utils"],
    "statistics": {
      "maxDepth": 4,
      "avgDependencies": 3.2,
      "avgDependents": 2.8
    },
    "cycles": {
      "hasCycles": false,
      "cycles": []
    },
    "levels": [
      ["shared-types"],
      ["shared-ui", "api-client"],
      ["dashboard", "admin-panel"],
      ["shell-app"]
    ],
    "criticalPath": ["shared-types", "api-client", "dashboard", "shell-app"]
  },
  "warnings": []
}
```

---

### `re-shell templates list --json`

Returns available configuration templates.

**Output:**

```json
{
  "ok": true,
  "data": [
    {
      "id": "react-project",
      "name": "react-project",
      "description": "React project template with TypeScript and Vite",
      "domain": "frontend",
      "language": "typescript",
      "framework": "react",
      "version": "1.0.0",
      "tags": ["react", "typescript", "vite"],
      "variables": [
        {
          "name": "projectName",
          "type": "string",
          "description": "Name of the project",
          "required": true
        }
      ]
    }
  ],
  "warnings": []
}
```

**TypeScript Interface:**

```typescript
interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  domain: 'frontend' | 'backend' | 'infrastructure';
  language: string;
  framework: string;
  version?: string;
  tags: string[];
  variables?: TemplateVariable[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}
```

---

### `re-shell doctor --json`

Returns system diagnostics with health check results.

**Output:**

```json
{
  "ok": true,
  "data": {
    "checks": [
      {
        "name": "package-json",
        "status": "success",
        "message": "Package.json structure is valid"
      },
      {
        "name": "security-audit",
        "status": "warning",
        "message": "Found 3 security vulnerabilities",
        "suggestion": "Run 'pnpm audit fix' to fix automatically fixable vulnerabilities"
      },
      {
        "name": "workspace-config",
        "status": "success",
        "message": "Found 5 properly configured workspaces"
      }
    ]
  },
  "warnings": []
}
```

**TypeScript Interface:**

```typescript
interface DoctorSummary {
  checks: Array<{
    name: string;
    status: 'success' | 'warning' | 'error';
    message: string;
    suggestion?: string;
  }>;
}
```

---

## Using Contracts

### Basic Usage

```bash
# Get workspace summary
re-shell workspace --json

# Get health report
re-shell workspace health --json

# Get graph analysis
re-shell workspace graph analyze --json

# Get templates
re-shell templates list --json

# Get system diagnostics
re-shell doctor --json
```

### Filtering with jq

```bash
# Extract health score
re-shell workspace health --json | jq '.data.overall.score'

# Check if workspace is healthy
re-shell workspace health --json | jq '.data.overall.status'

# List workspace names
re-shell workspace list --json | jq '.data[].name'

# Check for cycles in graph
re-shell workspace graph analyze --json | jq '.data.hasCycles'
```

### Error Handling

```bash
# Check if command succeeded
re-shell workspace --json | jq '.ok'

# Extract error code on failure
re-shell workspace --json | jq 'if .ok then "success" else .error.code end'

# Extract error message
re-shell workspace --json | jq 'if not .ok then .error.message else empty end'
```

### Scripting Example

```bash
#!/bin/bash
# Check workspace health before deployment

HEALTH=$(re-shell workspace health --json)
SCORE=$(echo "$HEALTH" | jq '.data.overall.score')
STATUS=$(echo "$HEALTH" | jq -r '.data.overall.status')

if [ "$STATUS" = "unhealthy" ]; then
  echo "Workspace health check failed: $STATUS (score: $SCORE)"
  exit 1
fi

echo "Workspace healthy: $STATUS (score: $SCORE)"
```

---

## Error Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `WORKSPACE_NOT_FOUND` | Workspace not found | No workspace configuration at the specified path |
| `WORKSPACE_CONFIG_INVALID` | Invalid configuration | Workspace configuration has syntax errors |
| `INVALID_PACKAGE_MANAGER` | Unknown package manager | Package manager detection failed or unsupported |
| `NODE_VERSION_MISMATCH` | Node version incompatible | Required Node.js version not met |
| `CLI_NOT_FOUND` | CLI binary not found | Re-Shell CLI is not installed or not in PATH |
| `TEMPLATE_NOT_FOUND` | Template not found | Requested template does not exist |
| `CIRCULAR_DEPENDENCY` | Circular dependencies detected | Workspace has circular dependency chain |
| `WORKSPACE_DETECTION_FAILED` | Detection timeout | Timeout while detecting workspace structure |
| `MONOREPO_ROOT_NOT_FOUND` | Not in a monorepo | Command must be run within a monorepo workspace |
| `VALIDATION_ERROR` | Validation failed | Workspace configuration validation errors found |

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial contract definitions |
| 1.1.0 | Added `workspace graph analyze` contract |
| 1.2.0 | Added `templates list` contract |
| 1.3.0 | Added `doctor` contract |
| 1.4.0 | Added `workspace list` contract |
