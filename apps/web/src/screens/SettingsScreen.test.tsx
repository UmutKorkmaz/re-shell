import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../settings/useSettings';
import { loadSettings } from '../settings/settings-store';
import { SettingsScreen } from './SettingsScreen';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

function renderScreen() {
  return render(
    <SettingsProvider>
      <SettingsScreen />
    </SettingsProvider>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    window.localStorage.clear();
    writeTextMock.mockClear();
    vi.restoreAllMocks();
  });

  it('renders the settings form with default values', () => {
    renderScreen();
    expect(screen.getByLabelText(/Workspace path/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Daemon port/i)).toHaveValue('3333');
    expect(screen.getByRole('switch', { name: /Safety mode/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('theme toggle flips the dark token class live and persists', () => {
    renderScreen();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Switch to dark theme/i }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(loadSettings().theme).toBe('dark');
  });

  it('persists field edits on Save (survives a remount/reload)', () => {
    const { unmount } = renderScreen();

    const portInput = screen.getByLabelText(/Daemon port/i);
    fireEvent.change(portInput, { target: { value: '4444' } });
    fireEvent.click(screen.getByRole('button', { name: /Save settings/i }));

    expect(loadSettings().daemonPort).toBe(4444);

    unmount();
    renderScreen();
    expect(screen.getByLabelText(/Daemon port/i)).toHaveValue('4444');
  });

  it('blocks Save on an invalid (out-of-range) port', () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText(/Daemon port/i), { target: { value: '99' } });

    expect(screen.getByText(/Port must be between/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save settings/i })).toBeDisabled();
  });

  it('safety-mode toggle is readable by the destructive gate', () => {
    renderScreen();
    expect(loadSettings().safetyMode).toBe(true);

    fireEvent.click(screen.getByRole('switch', { name: /Safety mode/i }));
    expect(loadSettings().safetyMode).toBe(false);
  });

  it('renders a copy-CLI affordance for the doctor verification command', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
    expect(screen.getByText(/re-shell doctor --json/)).toBeInTheDocument();
  });

  it('copies the doctor command to the clipboard', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('re-shell doctor --json');
  });
});
