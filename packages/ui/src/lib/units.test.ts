import { describe, expect, it } from 'vitest';

import {
  ROOT_FONT_SIZE_PX,
  addLength,
  clampLength,
  isCssLength,
  lengthValue,
  parseLength,
  percent,
  px,
  pxToRem,
  rem,
  remToPx,
  scaleLength,
  spacingToCss
} from './units';

describe('branded CSS units (runtime)', () => {
  it('formats lengths without float noise or negative zero', () => {
    expect(px(12)).toBe('12px');
    expect(rem(0.75)).toBe('0.75rem');
    expect(percent(33.3333333)).toBe('33.3333%');
    expect(px(0.1 + 0.2)).toBe('0.3px');
    expect(px(-0)).toBe('0px');
  });

  it('rejects non-finite numbers', () => {
    expect(() => px(Number.NaN)).toThrow(RangeError);
    expect(() => rem(Number.POSITIVE_INFINITY)).toThrow(/finite/);
    expect(() => percent(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => scaleLength(px(1), Number.NaN)).toThrow(RangeError);
  });

  it('converts between px and rem', () => {
    expect(ROOT_FONT_SIZE_PX).toBe(16);
    expect(pxToRem(px(24))).toBe('1.5rem');
    expect(remToPx(rem(0.5))).toBe('8px');
    expect(pxToRem(px(10), 10)).toBe('1rem');
  });

  it('adds, scales and clamps within one unit', () => {
    expect(addLength(px(4), px(6))).toBe('10px');
    expect(addLength(rem(1), rem(0.5))).toBe('1.5rem');
    expect(addLength(percent(25), percent(25))).toBe('50%');
    expect(scaleLength(rem(2), 1.5)).toBe('3rem');
    expect(clampLength(px(5), px(8), px(16))).toBe('8px');
    expect(clampLength(px(20), px(8), px(16))).toBe('16px');
    expect(clampLength(px(10), px(8), px(16))).toBe('10px');
  });

  it('parses untrusted strings strictly', () => {
    expect(parseLength('12px')).toBe('12px');
    expect(parseLength(' 1.5rem ')).toBe('1.5rem');
    expect(parseLength('.5%')).toBe('0.5%');
    expect(parseLength('12')).toBeNull();
    expect(parseLength('12em')).toBeNull();
    expect(parseLength('12px; color:red')).toBeNull();
    expect(parseLength('calc(1px + 2px)')).toBeNull();
    expect(lengthValue(px(7))).toBe(7);
  });

  it('guards at runtime', () => {
    expect(isCssLength('4px')).toBe(true);
    expect(isCssLength('4')).toBe(false);
    expect(isCssLength(4)).toBe(false);
  });

  it('resolves spacing tokens (4px scale) and lengths', () => {
    expect(spacingToCss(0)).toBe('0rem');
    expect(spacingToCss(4)).toBe('1rem');
    expect(spacingToCss(px(3))).toBe('3px');
    expect(spacingToCss(rem(2))).toBe('2rem');
  });
});
