import { describe, it, expect } from 'vitest';

import { scoreToGrade } from '../../src/utils/policy-engine';

/**
 * Unit tests for scoreToGrade and the extended PolicyCheckResult.
 *
 * Grade boundaries:
 *   A: 90-100
 *   B: 80-89
 *   C: 70-79
 *   D: 60-69
 *   F: 0-59
 */

describe('scoreToGrade', () => {
  it('returns A for 90', () => {
    expect(scoreToGrade(90)).toBe('A');
  });

  it('returns A for 100', () => {
    expect(scoreToGrade(100)).toBe('A');
  });

  it('returns A for 95', () => {
    expect(scoreToGrade(95)).toBe('A');
  });

  it('returns B for 80', () => {
    expect(scoreToGrade(80)).toBe('B');
  });

  it('returns B for 89', () => {
    expect(scoreToGrade(89)).toBe('B');
  });

  it('returns B for 85', () => {
    expect(scoreToGrade(85)).toBe('B');
  });

  it('returns C for 70', () => {
    expect(scoreToGrade(70)).toBe('C');
  });

  it('returns C for 79', () => {
    expect(scoreToGrade(79)).toBe('C');
  });

  it('returns C for 75', () => {
    expect(scoreToGrade(75)).toBe('C');
  });

  it('returns D for 60', () => {
    expect(scoreToGrade(60)).toBe('D');
  });

  it('returns D for 69', () => {
    expect(scoreToGrade(69)).toBe('D');
  });

  it('returns D for 65', () => {
    expect(scoreToGrade(65)).toBe('D');
  });

  it('returns F for 59', () => {
    expect(scoreToGrade(59)).toBe('F');
  });

  it('returns F for 0', () => {
    expect(scoreToGrade(0)).toBe('F');
  });

  it('returns F for 30', () => {
    expect(scoreToGrade(30)).toBe('F');
  });
});
