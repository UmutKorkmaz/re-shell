import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '@re-shell/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_PACK_CSS_KEY, THEME_PACK_STORAGE_KEY, THEME_PACK_STYLE_ID } from '../../theme/theme-packs';
import { ThemePackProvider } from '../../theme/useThemePacks';
import { AppearancePanel } from './AppearancePanel';

const LIGHT = {
  background: 'oklch(0.97 0.004 265)',
  foreground: 'oklch(0.21 0.015 265)',
  primary: 'oklch(0.74 0.18 130)',
  'primary-foreground': 'oklch(0.16 0.03 130)',
};

function pack(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    id: 'midnight-lime',
    name: 'Midnight Lime',
    version: '1.0.0',
    description: 'A lime on midnight.',
    radius: '0.25rem',
    colors: { light: LIGHT },
    ...overrides,
  });
}

function renderPanel() {
  return render(
    <ThemePackProvider>
      <ToastProvider>
        <AppearancePanel />
      </ToastProvider>
    </ThemePackProvider>
  );
}

async function installFromFile(json: string, name = 'theme.json'): Promise<void> {
  const input = screen.getByLabelText('Install from file') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([json], name, { type: 'application/json' })] } });
  });
}

const style = (): HTMLElement | null => document.getElementById(THEME_PACK_STYLE_ID);

describe('AppearancePanel: install, preview, apply, remove', () => {
  beforeEach(() => {
    window.localStorage.clear();
    style()?.remove();
  });
  afterEach(() => {
    window.localStorage.clear();
    style()?.remove();
    vi.restoreAllMocks();
  });

  it('starts on the built-in theme with nothing installed', () => {
    renderPanel();
    expect(screen.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('No theme packs installed yet.')).toBeInTheDocument();
    expect(style()).toBeNull();
  });

  it('installs from a file, previews without persisting, then reverts', async () => {
    renderPanel();
    await installFromFile(pack());
    await waitFor(() => expect(screen.getByLabelText('Preview Midnight Lime')).toBeInTheDocument());
    // Installed, but neither previewed nor applied: no style, nothing "active" except built-in.
    expect(style()).toBeNull();

    fireEvent.click(screen.getByLabelText('Preview Midnight Lime'));
    expect(style()?.textContent).toContain('--radius:0.25rem');
    expect(screen.getByTestId('theme-preview-banner')).toHaveTextContent('Previewing "Midnight Lime"');
    // Previewing is not persisted.
    expect(window.localStorage.getItem(THEME_PACK_CSS_KEY)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(THEME_PACK_STORAGE_KEY) ?? '{}').activeId).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Revert preview' }));
    expect(style()).toBeNull();
    expect(screen.queryByTestId('theme-preview-banner')).toBeNull();
  });

  it('applies a pack (persisted + boot CSS mirror), then removing it restores the built-in theme', async () => {
    renderPanel();
    await installFromFile(pack());
    await waitFor(() => screen.getByLabelText('Apply Midnight Lime'));

    fireEvent.click(screen.getByLabelText('Apply Midnight Lime'));
    expect(style()?.textContent).toContain(':root.light{--background:oklch(0.97 0.004 265);');
    expect(JSON.parse(window.localStorage.getItem(THEME_PACK_STORAGE_KEY) ?? '{}').activeId).toBe('midnight-lime');
    expect(window.localStorage.getItem(THEME_PACK_CSS_KEY)).toContain('--radius:0.25rem');
    expect(screen.getByLabelText('Apply Midnight Lime')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Remove Midnight Lime'));
    expect(style()).toBeNull();
    expect(window.localStorage.getItem(THEME_PACK_CSS_KEY)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(THEME_PACK_STORAGE_KEY) ?? '{}').installed).toEqual([]);
    const builtIn = screen.getAllByRole('listitem')[0];
    expect(within(builtIn).getByText('Active')).toBeInTheDocument();
  });

  it('an applied pack survives a reload (remount re-reads and re-applies it)', async () => {
    const first = renderPanel();
    await installFromFile(pack());
    await waitFor(() => screen.getByLabelText('Apply Midnight Lime'));
    fireEvent.click(screen.getByLabelText('Apply Midnight Lime'));
    first.unmount();
    style()?.remove(); // a fresh document has no style until the provider (or boot script) adds it

    renderPanel();
    expect(style()?.textContent).toContain('--radius:0.25rem');
    expect(within(screen.getAllByRole('listitem')[1]).getByText('Active')).toBeInTheDocument();
  });

  it('applying the built-in row restores the default without removing the pack', async () => {
    renderPanel();
    await installFromFile(pack());
    await waitFor(() => screen.getByLabelText('Apply Midnight Lime'));
    fireEvent.click(screen.getByLabelText('Apply Midnight Lime'));
    fireEvent.click(screen.getByLabelText('Apply Built-in'));
    expect(style()).toBeNull();
    expect(screen.getByLabelText('Apply Midnight Lime')).toBeEnabled();
  });

  it('rejects an invalid pack with the exact problems and installs nothing', async () => {
    renderPanel();
    await installFromFile(pack({ radius: '99rem', colors: { light: { ...LIGHT, foreground: 'oklch(0.9 0.01 265)' } } }), 'bad.json');
    const error = await screen.findByTestId('theme-install-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('bad.json is not a valid theme pack.');
    expect(error).toHaveTextContent(/radius:/);
    expect(error).toHaveTextContent(/foreground on background has contrast/);
    expect(within(screen.getByRole('list', { name: 'Installed themes' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('refuses CSS injection through a font stack', async () => {
    renderPanel();
    await installFromFile(pack({ fonts: { sans: 'Inter; } body { display:none' } }));
    expect(await screen.findByTestId('theme-install-error')).toHaveTextContent(/fonts\.sans/);
    expect(style()).toBeNull();
  });

  it('installs from a URL (https only) with a mocked network', async () => {
    const fetchMock = vi.fn(async () => new Response(pack({ id: 'from-url', name: 'From URL' })));
    vi.stubGlobal('fetch', fetchMock);
    try {
      renderPanel();
      fireEvent.change(screen.getByLabelText('Install from URL'), { target: { value: 'https://themes.example/lime.json' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Install' }));
      });
      await waitFor(() => expect(screen.getByLabelText('Apply From URL')).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledWith('https://themes.example/lime.json', expect.anything());

      fireEvent.change(screen.getByLabelText('Install from URL'), { target: { value: 'http://themes.example/lime.json' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Install' }));
      });
      expect(await screen.findByTestId('theme-install-error')).toHaveTextContent(/https/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('announces installs through the toast live region', async () => {
    renderPanel();
    await installFromFile(pack());
    const region = within(screen.getByRole('region', { name: 'Notifications' })).getByRole('status');
    await waitFor(() => expect(region).toHaveTextContent('Installed "Midnight Lime"'));
  });
});
