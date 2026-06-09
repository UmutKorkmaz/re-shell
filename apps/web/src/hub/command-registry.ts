import { z } from 'zod';
import type { CommandSpec } from '@re-shell/contracts';

/**
 * Typed, allow-listed command registry.
 *
 * The hub may ONLY ever invoke the re-shell CLI binary. Browsers never supply a
 * command path or raw argv — they supply a stable `commandId` plus a `params`
 * object. Each registered command maps that input to a FIXED argv template via a
 * typed, zod-validated builder. Anything not in this registry is rejected
 * without spawning a process, and any param that fails schema validation is
 * rejected the same way.
 *
 * Because argv is built element-by-element from validated params, an injection
 * string (e.g. `; rm -rf ~`) supplied as a param value can only ever land as a
 * single literal argv element — it is never shell-interpreted (the hub also
 * spawns without a shell).
 */

// ---------------------------------------------------------------------------
// Shared param fragments
// ---------------------------------------------------------------------------

/**
 * Every command accepts an optional `cwd`. The hub resolves + realpaths it and
 * rejects anything outside the workspace root; the registry only validates that
 * it is a string. `cwd` is NOT forwarded into argv — it is applied as the spawn
 * working directory by the hub.
 */
const baseParamsSchema = z
  .object({
    cwd: z.string().min(1).optional(),
  })
  .strict();

const noParamsSchema = baseParamsSchema;

const templatesListParamsSchema = baseParamsSchema.extend({
  language: z.string().min(1).optional(),
  framework: z.string().min(1).optional(),
});

const templatesShowParamsSchema = baseParamsSchema.extend({
  // A template id. Constrained to a safe identifier charset so it can only ever
  // be a single, well-formed argv token.
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/, 'template id must be alphanumeric with . _ -'),
});

const analyzeTypeSchema = z.enum(['bundle', 'dependencies', 'performance', 'security', 'all']);
const analyzeParamsSchema = baseParamsSchema.extend({
  type: analyzeTypeSchema.optional(),
});

/**
 * Allow-list of vetted re-shell subcommand paths the generic `run` command may
 * resolve to. The Command Builder still goes through the registry — it cannot
 * pass a free-form command. Each entry is a fixed argv prefix; the only variable
 * input is whether `--json` is appended (always, for machine consumption).
 */
const RUN_ALLOWED_SUBCOMMANDS = [
  'workspace summary',
  'workspace graph',
  'workspace health',
  'workspace list',
  'workspace validate',
  'templates list',
  'commands list',
  'doctor',
  'analyze',
] as const;

const runSubcommandSchema = z.enum(RUN_ALLOWED_SUBCOMMANDS);
const runParamsSchema = baseParamsSchema.extend({
  subcommand: runSubcommandSchema,
});

// ---------------------------------------------------------------------------
// Registry entry shape
// ---------------------------------------------------------------------------

/**
 * A single registered command: a zod schema for its params plus a pure builder
 * that turns validated params into a FIXED argv (the arguments passed to the
 * re-shell CLI binary, NOT including the binary itself).
 */
/**
 * Outcome of validating + building one entry from untrusted params. Either a
 * vetted argv (the cwd is carried separately for containment), or a validation
 * error. No process is ever spawned on the error path.
 */
type EntryResolve =
  | { ok: true; args: string[]; cwd: string | undefined }
  | { ok: false; error: string };

/**
 * A type-erased registry entry. Each entry's `resolve` validates an `unknown`
 * params object against its own zod schema and, on success, builds the fixed
 * argv. The per-command param type stays fully typed inside the builder closure
 * created by {@link defineCommand}; only the public surface is erased so every
 * entry shares one uniform type (avoids zod's invariant generic positions).
 */
interface CommandRegistryEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly dryRunSupported: boolean;
  readonly requiresConfirmation: boolean;
  readonly resolve: (params: unknown) => EntryResolve;
}

/**
 * Helper that ties a schema to a builder while keeping the param type inferred
 * from the schema, so builders are fully typed without any `any`. The returned
 * entry's public `resolve` is type-erased.
 */
function defineCommand<TSchema extends z.ZodType>(entry: {
  id: string;
  title: string;
  description: string;
  destructive?: boolean;
  dryRunSupported?: boolean;
  requiresConfirmation?: boolean;
  schema: TSchema;
  buildArgs: (params: z.infer<TSchema>) => string[];
}): CommandRegistryEntry {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    destructive: entry.destructive ?? false,
    dryRunSupported: entry.dryRunSupported ?? false,
    requiresConfirmation: entry.requiresConfirmation ?? false,
    resolve: (params: unknown): EntryResolve => {
      const parsed = entry.schema.safeParse(params ?? {});
      if (!parsed.success) {
        return { ok: false, error: `Invalid params for "${entry.id}": ${parsed.error.message}` };
      }
      const validated = parsed.data as { cwd?: string };
      return { ok: true, args: entry.buildArgs(parsed.data), cwd: validated.cwd };
    },
  };
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

const REGISTRY = {
  'workspace.summary': defineCommand({
    id: 'workspace.summary',
    title: 'Workspace summary',
    description: 'Machine-readable summary of the current workspace.',
    schema: noParamsSchema,
    buildArgs: () => ['workspace', 'summary', '--json'],
  }),

  'workspace.graph': defineCommand({
    id: 'workspace.graph',
    title: 'Workspace dependency graph',
    description: 'Dependency graph of the current workspace.',
    schema: noParamsSchema,
    buildArgs: () => ['workspace', 'graph', '--json'],
  }),

  'workspace.health': defineCommand({
    id: 'workspace.health',
    title: 'Workspace health',
    description: 'Health checks for the current workspace.',
    schema: noParamsSchema,
    buildArgs: () => ['workspace', 'health', '--json'],
  }),

  'templates.list': defineCommand({
    id: 'templates.list',
    title: 'List templates',
    description: 'List available framework templates.',
    schema: templatesListParamsSchema,
    buildArgs: (params) => {
      const args = ['templates', 'list', '--json'];
      if (params.language) {
        args.push('--language', params.language);
      }
      if (params.framework) {
        args.push('--framework', params.framework);
      }
      return args;
    },
  }),

  'templates.show': defineCommand({
    id: 'templates.show',
    title: 'Show template',
    description: 'Inspect a single framework template by id.',
    schema: templatesShowParamsSchema,
    buildArgs: (params) => ['templates', 'show', params.id, '--json'],
  }),

  'commands.list': defineCommand({
    id: 'commands.list',
    title: 'List commands',
    description: 'Machine-readable catalog of available Re-Shell commands.',
    schema: noParamsSchema,
    buildArgs: () => ['commands', 'list', '--json'],
  }),

  doctor: defineCommand({
    id: 'doctor',
    title: 'Doctor',
    description: 'Run health checks on the current monorepo.',
    schema: noParamsSchema,
    buildArgs: () => ['doctor', '--json'],
  }),

  analyze: defineCommand({
    id: 'analyze',
    title: 'Analyze',
    description: 'Analyze bundles, dependencies, performance, and security.',
    schema: analyzeParamsSchema,
    buildArgs: (params) => {
      const args = ['analyze', '--json'];
      if (params.type) {
        args.push('--type', params.type);
      }
      return args;
    },
  }),

  run: defineCommand({
    id: 'run',
    title: 'Run a vetted command',
    description:
      'Run a vetted re-shell subcommand resolved through the registry allow-list (not free-form).',
    schema: runParamsSchema,
    buildArgs: (params) => [...params.subcommand.split(' '), '--json'],
  }),
} as const satisfies Record<string, CommandRegistryEntry>;

export type CommandId = keyof typeof REGISTRY;

/** The list of registered command ids, for introspection and error messages. */
export const REGISTERED_COMMAND_IDS: readonly string[] = Object.keys(REGISTRY);

/** True when `id` is a registered command id. */
export function isRegisteredCommandId(id: string): id is CommandId {
  return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}

/**
 * Result of resolving a `{ commandId, params }` request against the registry.
 * A failure carries a human-readable reason and never produces argv.
 */
export type ResolveResult =
  | { ok: true; commandId: CommandId; args: string[]; cwd: string | undefined }
  | { ok: false; error: string };

/**
 * Resolve an untrusted `{ commandId, params }` pair to a vetted argv.
 *
 * - Unregistered `commandId` → rejected (no spawn).
 * - Params that fail the command's zod schema → rejected (no spawn).
 * - On success, returns the FIXED argv (to be run as `binary + args`, no shell)
 *   plus the requested `cwd` (still subject to workspace containment by caller).
 */
export function resolveCommand(commandId: unknown, params: unknown): ResolveResult {
  if (typeof commandId !== 'string') {
    return { ok: false, error: 'commandId must be a string' };
  }
  if (!isRegisteredCommandId(commandId)) {
    return {
      ok: false,
      error: `Unknown commandId "${commandId}". Allowed: ${REGISTERED_COMMAND_IDS.join(', ')}`,
    };
  }

  const entry = REGISTRY[commandId];
  const result = entry.resolve(params);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, commandId, args: result.args, cwd: result.cwd };
}

/**
 * Build a {@link CommandSpec} for a resolved command. Useful for echoing the
 * vetted command back to the dashboard. `binary` is the re-shell CLI invocation
 * prefix (e.g. `['node', '/abs/path/index.js']`); `cwd` is the resolved,
 * contained working directory.
 */
export function toCommandSpec(
  commandId: CommandId,
  binary: readonly string[],
  args: readonly string[],
  cwd: string
): CommandSpec {
  const entry = REGISTRY[commandId];
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    command: [...binary, ...args],
    cwd,
    dryRunSupported: entry.dryRunSupported,
    destructive: entry.destructive,
    requiresConfirmation: entry.requiresConfirmation,
  };
}
