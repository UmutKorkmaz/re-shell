import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommandPreview } from '@/components/re-shell/command-preview';
import { commandSpec } from '@/test/fixtures';
import { LOG_FLASH_CLASS, useChangeFlash } from './useChangeFlash';

describe('useChangeFlash', () => {
  it('does not flash on the first render, flashes on change, and re-keys each time', () => {
    const { result, rerender } = renderHook(({ value }) => useChangeFlash(value), { initialProps: { value: 'a' } });
    expect(result.current).toEqual({ className: '', key: 0 });

    rerender({ value: 'a' });
    expect(result.current.className).toBe('');

    rerender({ value: 'b' });
    expect(result.current).toEqual({ className: LOG_FLASH_CLASS, key: 1 });
    rerender({ value: 'c' });
    expect(result.current.key).toBe(2);
  });
});

describe('CommandPreview log-flash', () => {
  it('flashes the command only when the preview text updates', async () => {
    const { rerender } = render(<CommandPreview spec={commandSpec} />);
    const command = (): HTMLElement => screen.getByText(/^re-shell workspace health/);
    expect(command().className).not.toContain('animate-log-flash');

    await act(async () => {
      rerender(<CommandPreview spec={{ ...commandSpec, command: ['re-shell', 'workspace', 'health', '--json', '--verbose'] }} />);
    });
    expect(command().className).toContain('animate-log-flash');
    expect(command()).toHaveTextContent('--verbose');
  });
});
