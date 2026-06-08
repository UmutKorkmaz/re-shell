import { describe, expect, it } from 'vitest';
import { buildTemplateMatrix } from '../../src/utils/template-matrix';
import { listBackendTemplates } from '../../src/templates/backend/index';

describe('buildTemplateMatrix', () => {
  it('emits exactly one row per registry template', () => {
    const { matrix } = buildTemplateMatrix();
    expect(matrix.length).toBe(listBackendTemplates().length);
    // The registry is ~205 entries; guard against accidental regression.
    expect(matrix.length).toBeGreaterThan(150);
  });

  it('exposes non-empty facets derived from registry metadata', () => {
    const { facets } = buildTemplateMatrix();
    expect(facets.languages.length).toBeGreaterThan(0);
    expect(facets.frameworks.length).toBeGreaterThan(0);
    expect(facets.databases.length).toBeGreaterThan(0);
    expect(facets.caches.length).toBeGreaterThan(0);
    expect(facets.deploymentTargets.length).toBeGreaterThan(0);
    expect(facets.features.length).toBeGreaterThan(0);
  });

  it('produces well-formed rows with all matrix columns present', () => {
    const { matrix } = buildTemplateMatrix();
    const express = matrix.find(r => r.id === 'express');
    expect(express).toBeDefined();
    expect(express?.language).toBe('typescript');
    expect(express?.framework).toBe('express');
    expect(Array.isArray(express?.databases)).toBe(true);
    expect(Array.isArray(express?.caches)).toBe(true);
    expect(Array.isArray(express?.deploymentTargets)).toBe(true);
    expect(Array.isArray(express?.features)).toBe(true);
  });

  it('keeps facet unions consistent with the rows they summarize', () => {
    const { matrix, facets } = buildTemplateMatrix();
    const langsInRows = new Set(matrix.map(r => r.language));
    for (const lang of facets.languages) {
      expect(langsInRows.has(lang)).toBe(true);
    }
    // A template advertising postgresql should surface it in the db facet.
    const withDb = matrix.find(r => r.databases.includes('postgresql'));
    if (withDb) {
      expect(facets.databases).toContain('postgresql');
    }
  });
});
