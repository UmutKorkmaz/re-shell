import { describe, expect, it } from 'vitest';
import { Command } from 'commander';
import { buildFindCorpus } from '../../src/utils/find-corpus';
import { rankDocs } from '../../src/utils/find-index';

/**
 * Build a tiny program whose command tree mirrors the real shape closely enough
 * to exercise the command-corpus adapter without booting the whole CLI.
 */
function buildProgram(): Command {
  const program = new Command();
  const k8s = new Command('k8s').description('Kubernetes integration');
  k8s
    .command('manifests')
    .description('Generate Kubernetes manifests')
    .option('--json', 'Output as JSON')
    .action(() => {});
  program.addCommand(k8s);
  return program;
}

describe('buildFindCorpus', () => {
  it('produces command docs from the program and template docs from the registry', () => {
    const corpus = buildFindCorpus(buildProgram());

    const commands = corpus.filter(d => d.type === 'command');
    const templates = corpus.filter(d => d.type === 'template');

    expect(commands.some(d => d.id === 'k8s manifests')).toBe(true);
    // The backend registry is large; guard against an empty/broken adapter.
    expect(templates.length).toBeGreaterThan(100);
  });

  it('emits ranked results that prefer the matching command for an on-topic query', () => {
    const corpus = buildFindCorpus(buildProgram());
    const results = rankDocs('kubernetes manifests', corpus, { limit: 5 });
    expect(results[0].id).toBe('k8s manifests');
    expect(results[0].usage).toBe('re-shell k8s manifests');
  });

  it('surfaces a real template for a framework query', () => {
    const corpus = buildFindCorpus(buildProgram());
    const results = rankDocs('express', corpus, { limit: 5, type: 'template' });
    expect(results.some(r => r.id === 'express')).toBe(true);
    expect(results.every(r => r.type === 'template')).toBe(true);
  });
});
