import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@re-shell/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../settings/useSettings';
import { ThemePackProvider } from '../theme/useThemePacks';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../settings/settings-store';
import { SettingsScreen } from './SettingsScreen';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

function renderScreen() {
  return render(
    <SettingsProvider>
      <ThemePackProvider>
        <ToastProvider>
          <SettingsScreen />
        </ToastProvider>
      </ThemePackProvider>
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

  it('theme toggle flips the dark token class live and persists (dark is the default)', () => {
    renderScreen();
    // The design-system default: dark out of the box.
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(loadSettings().theme).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: /Switch to light theme/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(loadSettings().theme).toBe('light');

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

  it('recovers null saved preferences into editable defaults', () => {
    window.localStorage.setItem('re-shell.dashboard.settings.v1', 'null');
    renderScreen();
    expect(screen.getByLabelText(/Daemon port/i)).toHaveValue('3333');
    expect(screen.getByRole('switch', { name: /Safety mode/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText(/Daemon port/i), { target: { value: '4445' } });
    fireEvent.click(screen.getByRole('button', { name: /Save settings/i }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, daemonPort: 4445 });
  });

  it('reset discards an invalid draft and restores safe persisted defaults', () => {
    saveSettings({
      ...DEFAULT_SETTINGS, workspacePath: '/tmp/custom-workspace', cliBinaryPath: '/opt/re-shell',
      daemonPort: 4444, telemetryOptIn: true, theme: 'light', safetyMode: false,
    });
    renderScreen();
    expect(screen.getByLabelText(/Workspace path/i)).toHaveValue('/tmp/custom-workspace');
    expect(screen.getByRole('switch', { name: /Telemetry/i })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('light');

    fireEvent.change(screen.getByLabelText(/Daemon port/i), { target: { value: 'not-a-port' } });
    expect(screen.getByText('Port must be a whole number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save settings/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Reset to defaults/i }));

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(screen.getByLabelText(/Workspace path/i)).toHaveValue('');
    expect(screen.getByLabelText(/CLI binary path/i)).toHaveValue('re-shell');
    expect(screen.getByLabelText(/Daemon port/i)).toHaveValue('3333');
    expect(screen.getByRole('switch', { name: /Telemetry/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: /Safety mode/i })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.queryByText('Port must be a whole number.')).toBeNull();
    expect(screen.getByRole('button', { name: /Save settings/i })).toBeEnabled();
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
