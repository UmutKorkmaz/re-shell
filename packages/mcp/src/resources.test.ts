import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCES } from './resources.js';
import { buildMcpServer } from './index.js';
import type { CliInvocation } from './cli.js';

/**
 * Coverage for the MCP Resources + Prompts primitives (issue #17):
 *   - the registry shape (URIs, names, MIME types),
 *   - an in-memory Client can LIST and READ the resources and LIST/CALL the
 *     prompts through the real McpServer (the acceptance bar: "an MCP host can
 *     list and subscribe to graph/health Resources and receive updates" — list +
 *     read is the verifiable core).
 *
 * Resource reads target a non-existent CLI entry, so they degrade to a graceful
 * error JSON envelope rather than throwing across the transport — proving the
 * read path never crashes the host.
 */
const FAKE_INVOCATION: CliInvocation = {
  prefix: ['/__nonexistent-re-shell-cli__/dist/index.js'],
  strategy: 'workspace-fallback',
  entry: '/__nonexistent-re-shell-cli__/dist/index.js',
};

describe('resource registry', () => {
  it('exposes graph, health, summary, scorecard, and commands resources', () => {
    const uris = RESOURCES.map(r => r.uri);
    expect(uris).toContain('reshell://workspace/graph');
    expect(uris).toContain('reshell://workspace/health');
    expect(uris).toContain('reshell://workspace/summary');
    expect(uris).toContain('reshell://scorecard');
    expect(uris).toContain('reshell://contracts/commands');
    expect(RESOURCES.length).toBeGreaterThanOrEqual(5);
  });

  it('every resource has a reshell:// URI, a name, a description, and JSON MIME', () => {
    for (const r of RESOURCES) {
      expect(r.uri.startsWith('reshell://')).toBe(true);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.mimeType).toBe('application/json');
    }
  });

  it('every resource degrades to a graceful error JSON when the CLI is unavailable', async () => {
    for (const r of RESOURCES) {
      const text = await r.read(FAKE_INVOCATION);
      // Must be valid JSON (an envelope), never a thrown error.
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty('error');
      expect((parsed as { error: { code: string } }).error.code).toBe('MCP_RESOURCE_ERROR');
    }
  });
});

describe('McpServer resource + prompt primitives (in-memory Client)', () => {
  async function connectClient() {
    const server = buildMcpServer(FAKE_INVOCATION);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return { client, server };
  }

  it('a client can list the resources with the expected URIs', async () => {
    const { client, server } = await connectClient();
    try {
      const { resources } = await client.listResources();
      const uris = resources.map(r => r.uri);
      expect(uris).toContain('reshell://workspace/graph');
      expect(uris).toContain('reshell://workspace/health');
      expect(uris).toContain('reshell://scorecard');
      expect(resources.length).toBeGreaterThanOrEqual(5);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('a client can READ a resource and receives text content', async () => {
    const { client, server } = await connectClient();
    try {
      const result = await client.readResource({ uri: 'reshell://workspace/graph' });
      expect(result.contents).toHaveLength(1);
      const content = result.contents[0];
      expect(content.uri).toBe('reshell://workspace/graph');
      // text is present and valid JSON (graceful error envelope against the fake CLI).
      expect(typeof (content as { text?: string }).text).toBe('string');
      JSON.parse((content as { text: string }).text);
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('a client can list the prompts', async () => {
    const { client, server } = await connectClient();
    try {
      const { prompts } = await client.listPrompts();
      const names = prompts.map(p => p.name);
      expect(names).toContain('scaffold-service');
      expect(names).toContain('diagnose-drift');
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });

  it('a client can GET a prompt and receives a grounded user message', async () => {
    const { client, server } = await connectClient();
    try {
      const result = await client.getPrompt({
        name: 'scaffold-service',
        arguments: { description: 'a payments API' },
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  });
});
