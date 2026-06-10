import { z } from 'zod';
import {
  workspaceSummarySchema,
  healthSummarySchema,
  templateSummarySchema,
} from '@re-shell/contracts';
import { runJsonCommand, type CliInvocation, type ValidatedEnvelope } from './cli.js';

/**
 * A registered MCP tool: a stable name, human description, an optional zod
 * input shape (raw shape, as the SDK's `registerTool` expects), and a `run`
 * that maps validated args to a FIXED CLI argv + validates the JSON envelope.
 *
 * `inputShape` is a zod raw shape (`Record<string, ZodType>`); tools with no
 * arguments use an empty shape. The CLI argv is always built element-by-element
 * from validated args, so an injection-style argument can only ever land as a
 * single literal argv token (the CLI is also spawned without a shell).
 */
export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputShape: z.ZodRawShape;
  readonly mutating: boolean;
  readonly run: (
    invocation: CliInvocation,
    args: Record<string, unknown>
  ) => Promise<ValidatedEnvelope<unknown>>;
}

/**
 * `analyze --type` accepts a fixed, vetted set of analysis kinds. Mirrors the
 * hub registry's `analyzeTypeSchema`.
 */
const analyzeTypeSchema = z.enum(['bundle', 'dependencies', 'performance', 'security', 'all']);

/**
 * A template id is constrained to a safe identifier charset so it can only ever
 * be a single, well-formed argv token. Mirrors the hub registry.
 */
const templateIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, 'template id must be alphanumeric with . _ -');

/**
 * The read-only tool set. Each entry mirrors an allow-listed command from the
 * dashboard hub registry (apps/web/src/hub/command-registry.ts). Data schemas
 * from @re-shell/contracts are used where a precise shape is published; the
 * remainder validate against the canonical envelope around `z.unknown()` (the
 * `ok`/`warnings`/`error` envelope is still fully type-checked).
 */
export const READ_ONLY_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'workspace_summary',
    title: 'Workspace summary',
    description: 'Machine-readable summary of the current Re-Shell workspace (root, package manager, workspaces, graph, health).',
    inputShape: {},
    mutating: false,
    run: (invocation) =>
      runJsonCommand(invocation, ['workspace', 'summary', '--json'], workspaceSummarySchema),
  },
  {
    name: 'workspace_graph',
    title: 'Workspace dependency graph',
    description: 'Dependency graph of the current Re-Shell workspace.',
    inputShape: {},
    mutating: false,
    run: (invocation) =>
      runJsonCommand(invocation, ['workspace', 'graph', '--json'], z.unknown()),
  },
  {
    name: 'workspace_health',
    title: 'Workspace health',
    description: 'Health checks for the current Re-Shell workspace.',
    inputShape: {},
    mutating: false,
    run: (invocation) =>
      runJsonCommand(invocation, ['workspace', 'health', '--json'], healthSummarySchema),
  },
  {
    name: 'templates_list',
    title: 'List templates',
    description: 'List available framework templates, optionally filtered by language and/or framework.',
    inputShape: {
      language: z.string().min(1).optional(),
      framework: z.string().min(1).optional(),
    },
    mutating: false,
    run: (invocation, args) => {
      const argv = ['templates', 'list', '--json'];
      if (typeof args.language === 'string') {
        argv.push('--language', args.language);
      }
      if (typeof args.framework === 'string') {
        argv.push('--framework', args.framework);
      }
      return runJsonCommand(invocation, argv, z.array(templateSummarySchema));
    },
  },
  {
    name: 'templates_show',
    title: 'Show template',
    description: 'Inspect a single framework template by id.',
    inputShape: {
      id: templateIdSchema,
    },
    mutating: false,
    run: async (invocation, args) => {
      const id = templateIdSchema.parse(args.id);
      return runJsonCommand(invocation, ['templates', 'show', id, '--json'], templateSummarySchema);
    },
  },
  {
    name: 'templates_matrix',
    title: 'Template compatibility matrix',
    description: 'Compatibility grid across language, framework, database, cache, and deployment.',
    inputShape: {},
    mutating: false,
    run: (invocation) =>
      runJsonCommand(invocation, ['templates', 'matrix', '--json'], z.unknown()),
  },
  {
    name: 'doctor',
    title: 'Doctor',
    description: 'Run health checks on the current Re-Shell monorepo.',
    inputShape: {},
    mutating: false,
    run: (invocation) => runJsonCommand(invocation, ['doctor', '--json'], z.unknown()),
  },
  {
    name: 'analyze',
    title: 'Analyze',
    description: 'Analyze bundles, dependencies, performance, and security for the current project.',
    inputShape: {
      type: analyzeTypeSchema.optional(),
    },
    mutating: false,
    run: async (invocation, args) => {
      const argv = ['analyze', '--json'];
      const parsedType = analyzeTypeSchema.optional().parse(args.type);
      if (parsedType) {
        argv.push('--type', parsedType);
      }
      return runJsonCommand(invocation, argv, z.unknown());
    },
  },
  {
    name: 'commands_list',
    title: 'List commands',
    description: 'Machine-readable catalog of available Re-Shell commands.',
    inputShape: {},
    mutating: false,
    run: (invocation) => runJsonCommand(invocation, ['commands', 'list', '--json'], z.unknown()),
  },
];

/**
 * Mutating tools (e.g. workspace scaffolding). These are NOT registered unless
 * `RE_SHELL_MCP_ALLOW_WRITE === '1'`. They still go exclusively through the CLI
 * with a fixed argv and no shell. The CLI itself enforces the real side effects
 * and validation; the MCP layer only forwards vetted, schema-checked arguments.
 */
const workspaceNameSchema = z
  .string()
  .min(1)
  .max(214)
  .regex(/^[A-Za-z0-9._-]+$/, 'workspace name must be alphanumeric with . _ -');

export const WRITE_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'workspace_create',
    title: 'Create workspace',
    description:
      'Create a new Re-Shell workspace. Only available when RE_SHELL_MCP_ALLOW_WRITE=1.',
    inputShape: {
      name: workspaceNameSchema,
    },
    mutating: true,
    run: async (invocation, args) => {
      const name = workspaceNameSchema.parse(args.name);
      // Route through the CLI's machine-readable workspace creation path. The
      // CLI owns the actual filesystem work and emits the standard envelope.
      return runJsonCommand(invocation, ['workspace', 'init', name, '--json'], z.unknown());
    },
  },
];

/** True when mutating tools have been explicitly opted into via the env flag. */
export function isWriteEnabled(): boolean {
  return process.env.RE_SHELL_MCP_ALLOW_WRITE === '1';
}

/**
 * The full set of tools to register, gated on the write opt-in. Read-only by
 * default; mutating tools are appended only when explicitly enabled.
 */
export function getActiveTools(): readonly ToolDefinition[] {
  return isWriteEnabled() ? [...READ_ONLY_TOOLS, ...WRITE_TOOLS] : READ_ONLY_TOOLS;
}
