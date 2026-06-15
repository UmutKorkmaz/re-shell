#!/usr/bin/env node
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { resolveCli, runJsonCommand, type CliInvocation } from './cli.js';
import { getActiveTools, isWriteEnabled, type ToolDefinition } from './tools.js';
import { RESOURCES } from './resources.js';
import { PROMPTS } from './prompts.js';

/**
 * We always return one pretty-printed JSON text block as the tool result;
 * failures set `isError` so the client surfaces them as tool errors. The SDK's
 * `CallToolResult` is the contract the tool callback must satisfy.
 */
type ToolResult = CallToolResult;

/** Pretty-print a value as a single text-content result. */
function jsonText(value: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    isError: isError || undefined,
  };
}

/**
 * Execute one tool and map its outcome to an MCP tool result:
 *   - A success envelope -> the validated envelope as pretty JSON.
 *   - A CLI error envelope -> the envelope's `error` surfaced as an MCP error.
 *   - A thrown failure (bad JSON, schema mismatch, spawn/timeout) -> an MCP
 *     error with a clear message.
 */
async function executeTool(
  tool: ToolDefinition,
  invocation: CliInvocation,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { envelope } = await tool.run(invocation, args);
    if (envelope.ok) {
      return jsonText(envelope);
    }
    // Structured CLI error: surface code + message, keep the full envelope.
    return jsonText(
      {
        error: envelope.error,
        warnings: envelope.warnings,
      },
      true
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonText({ error: { code: 'MCP_TOOL_ERROR', message } }, true);
  }
}

/** A safe service-name charset for the elicitation-backed scaffold tool. */
const scaffoldNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, 'service name must be alphanumeric with . _ -');

/**
 * Build, configure, and connect the stdio MCP server.
 *
 * Primitives registered (issue #17):
 *   - Tools: the existing read-only set (and the write set when opted in).
 *   - Resources: subscribable, read-only workspace context (graph, health,
 *     scorecard/drift/policy, command catalog) — a moat generic tools-only
 *     servers cannot match.
 *   - Prompts: reusable, grounded instructions (scaffold a service, diagnose
 *     drift).
 *   - Elicitation: the scaffold tool requests a missing required service name
 *     from the host instead of failing.
 *
 * Sampling stays OFF by default (the MCP spec's optional host-offloaded
 * reasoning). It is enabled only when RE_SHELL_MCP_ALLOW_SAMPLING=1.
 */
/**
 * Build and configure the MCP server (tools + resources + prompts + the
 * elicitation-backed scaffold tool) WITHOUT connecting it to a transport. Split
 * out from {@link main} so the primitive surface is unit-testable over an
 * in-memory transport without spawning the CLI.
 */
export function buildMcpServer(invocation: CliInvocation): McpServer {
  const server = new McpServer({
    name: '@re-shell/mcp',
    version: '0.1.0',
  });

  // ── Tools ───────────────────────────────────────────────────────────────────
  const tools = getActiveTools();
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: {
          readOnlyHint: !tool.mutating,
          destructiveHint: tool.mutating,
        },
      },
      async (args: Record<string, unknown>) => executeTool(tool, invocation, args ?? {})
    );
  }

  // ── Resources (subscribable read-only workspace context) ───────────────────
  for (const resource of RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      async (): Promise<ReadResourceResult> => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType,
            text: await resource.read(invocation),
          },
        ],
      })
    );
  }

  // ── Prompts (reusable, grounded instructions) ──────────────────────────────
  for (const prompt of PROMPTS) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      (args: Record<string, unknown>) => Promise.resolve(prompt.build(args ?? {}))
    );
  }

  // ── Elicitation-backed scaffold tool ───────────────────────────────────────
  // When write is enabled, a scaffold missing the required `name` triggers an
  // Elicitation form rather than failing — the host collects the param.
  if (isWriteEnabled()) {
    server.registerTool(
      'scaffold_service',
      {
        title: 'Scaffold a service (with elicitation)',
        description:
          'Scaffold a new re-shell service. When the required `name` is missing, the server elicits it from the host via a form rather than failing. Only available when RE_SHELL_MCP_ALLOW_WRITE=1.',
        inputSchema: {
          name: scaffoldNameSchema.optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
        },
      },
      async (args: Record<string, unknown>) => {
        // Validate/derive the service name, eliciting it when absent.
        let name: string | undefined;
        const rawName = args.name;
        if (typeof rawName === 'string' && rawName.trim()) {
          const parsed = scaffoldNameSchema.safeParse(rawName.trim());
          if (parsed.success) name = parsed.data;
        }

        if (!name) {
          // Request the missing required param via Elicitation (form mode). Wrap
          // the whole elicitation in try/catch: a host that did not advertise the
          // elicitation capability (or returns schema-invalid content) makes the
          // SDK throw — surface that as a structured envelope, not raw text.
          let result;
          try {
            result = await server.server.elicitInput({
              mode: 'form',
              message: 'A service name is required to scaffold. Please provide one:',
              requestedSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    title: 'Service name',
                    description: 'A slug-safe service name (alphanumeric, . _ -).',
                    minLength: 1,
                    maxLength: 128,
                  },
                },
                required: ['name'],
              },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return jsonText(
              { error: { code: 'MCP_ELICITATION_UNAVAILABLE', message } },
              true
            );
          }

          if (result.action !== 'accept' || !result.content?.name) {
            return jsonText(
              { error: { code: 'MCP_ELICITATION_CANCELLED', message: 'Scaffold cancelled: the host declined to provide a service name.' } },
              true
            );
          }
          const parsed = scaffoldNameSchema.safeParse(String(result.content.name));
          if (!parsed.success) {
            return jsonText(
              { error: { code: 'MCP_ELICITATION_INVALID', message: `Elicited name failed validation: ${parsed.error.message}` } },
              true
            );
          }
          name = parsed.data;
        }

        // Route through the CLI's machine-readable service scaffold path.
        try {
          const { envelope } = await runJsonCommand(
            invocation,
            ['generate', 'service', name, '--json'],
            z.unknown()
          );
          return jsonText(envelope, envelope.ok ? false : true);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonText({ error: { code: 'MCP_TOOL_ERROR', message } }, true);
        }
      }
    );
  }

  return server;
}

async function main(): Promise<void> {
  // Resolve the CLI up front so a misconfiguration fails fast and visibly on
  // stderr (stdout is reserved for the MCP stdio transport).
  const invocation = resolveCli();
  process.stderr.write(
    `[re-shell-mcp] CLI resolved via ${invocation.strategy}: ${invocation.entry}\n`
  );

  const server = buildMcpServer(invocation);
  process.stderr.write(
    `[re-shell-mcp] Registered ${getActiveTools().length} tool(s), ${RESOURCES.length} resource(s), ${PROMPTS.length} prompt(s)${isWriteEnabled() ? ' (+1 elicitation scaffold tool)' : ''}.\n` +
      `[re-shell-mcp] Sampling is ${process.env.RE_SHELL_MCP_ALLOW_SAMPLING === '1' ? 'ENABLED' : 'off (default; set RE_SHELL_MCP_ALLOW_SAMPLING=1 to opt in)'}.\n`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[re-shell-mcp] Listening on stdio.\n');
}

// Entry-point guard: only start the stdio server when this module IS the entry
// point. Importing buildMcpServer in a test (or as a library) must NOT spawn the
// transport or resolve the CLI.
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return nodePath.resolve(process.argv[1]) === nodePath.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[re-shell-mcp] Fatal: ${message}\n`);
    process.exitCode = 1;
  });
}
