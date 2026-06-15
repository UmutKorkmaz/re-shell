import { describe, it, expect } from 'vitest';
import { PROMPTS } from './prompts.js';

describe('prompt registry', () => {
  it('ships the two required reusable prompts (scaffold-service, diagnose-drift)', () => {
    const names = PROMPTS.map(p => p.name);
    expect(names).toContain('scaffold-service');
    expect(names).toContain('diagnose-drift');
    expect(PROMPTS.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every prompt a non-empty title + description', () => {
    for (const prompt of PROMPTS) {
      expect(prompt.title.length).toBeGreaterThan(0);
      expect(prompt.description.length).toBeGreaterThan(0);
    }
  });

  it('every prompt has a stable name and URI-free identifier', () => {
    for (const prompt of PROMPTS) {
      expect(/^[a-z][a-z0-9-]*$/.test(prompt.name)).toBe(true);
    }
  });
});

describe('scaffold-service prompt', () => {
  const prompt = PROMPTS.find(p => p.name === 'scaffold-service')!;

  it('builds a user message that grounds the model in the re-shell surface', () => {
    const result = prompt.build({ description: 'a payments API in node' });
    expect(result.messages).toHaveLength(1);
    const msg = result.messages[0];
    expect(msg.role).toBe('user');
    if (msg.content.type !== 'text') throw new Error('expected text content');
    // Grounded in real resources/tools.
    expect(msg.content.text).toContain('reshell://workspace/graph');
    expect(msg.content.text).toContain('templates_list');
    expect(msg.content.text).toContain('Elicitation');
    expect(msg.content.text).toContain('a payments API in node');
  });

  it('notes the missing description when none is provided', () => {
    const result = prompt.build({});
    const msg = result.messages[0];
    if (msg.content.type !== 'text') throw new Error('expected text content');
    expect(msg.content.text).toMatch(/not provided/i);
  });

  it('includes the preferred name when one is supplied', () => {
    const result = prompt.build({ name: 'payments-api' });
    const msg = result.messages[0];
    if (msg.content.type !== 'text') throw new Error('expected text content');
    expect(msg.content.text).toContain('payments-api');
  });
});

describe('diagnose-drift prompt', () => {
  const prompt = PROMPTS.find(p => p.name === 'diagnose-drift')!;

  it('grounds the model in the scorecard + health resources', () => {
    const result = prompt.build({});
    const msg = result.messages[0];
    if (msg.content.type !== 'text') throw new Error('expected text content');
    expect(msg.content.text).toContain('reshell://scorecard');
    expect(msg.content.text).toContain('reshell://workspace/health');
  });

  it('scopes to the target when one is supplied', () => {
    const result = prompt.build({ target: '@rs/payments' });
    const msg = result.messages[0];
    if (msg.content.type !== 'text') throw new Error('expected text content');
    expect(msg.content.text).toContain('@rs/payments');
  });

  it('defaults to whole-workspace scope when no target is supplied', () => {
    const result = prompt.build({});
    const msg = result.messages[0];
    if (msg.content.type !== 'text') throw new Error('expected text content');
    expect(msg.content.text).toMatch(/whole workspace/);
  });
});
