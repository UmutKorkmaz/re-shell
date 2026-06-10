#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { resolveCli, type CliInvocation } from './cli.js';
import { getActiveTools, type ToolDefinition } from './tools.js';

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

/** Build, configure, and connect the stdio MCP server. */
async function main(): Promise<void> {
  // Resolve the CLI up front so a misconfiguration fails fast and visibly on
  // stderr (stdout is reserved for the MCP stdio transport).
  const invocation = resolveCli();
  process.stderr.write(
    `[re-shell-mcp] CLI resolved via ${invocation.strategy}: ${invocation.entry}\n`
  );

  const server = new McpServer({
    name: '@re-shell/mcp',
    version: '0.1.0',
  });

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

  process.stderr.write(
    `[re-shell-mcp] Registered ${tools.length} tool(s): ${tools.map((t) => t.name).join(', ')}\n`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[re-shell-mcp] Listening on stdio.\n');
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[re-shell-mcp] Fatal: ${message}\n`);
  process.exitCode = 1;
});
