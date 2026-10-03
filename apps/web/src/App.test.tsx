import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WHITE_LABEL, resolveWhiteLabel } from '@re-shell/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { BrandProvider } from './brand/BrandProvider';
import { SettingsProvider } from './settings/useSettings';

const useHubQueryMock = vi.fn();

vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function renderApp(brand = DEFAULT_WHITE_LABEL) {
  return render(
    <BrandProvider brand={brand}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </BrandProvider>
  );
}

const nav = () => screen.getByRole('complementary', { name: /Dashboard navigation/i });

describe('App shell accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    // Never resolves: the screens stay on their loading panels (the shell is what is under test).
    useHubQueryMock.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
  });
  afterEach(() => {
    useHubQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('has the landmark structure: banner, labelled navigation, one main, one h1 naming the screen', async () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(nav()).toBeInTheDocument();
    expect(within(nav()).getByRole('navigation', { name: 'Screens' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);

    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent('Overview');
    expect(h1[0]).toHaveAttribute('data-testid', 'screen-label');
    // The h1 is inside <main>; the workspace name in the banner is plain text, not a heading.
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toBe(h1[0]);
    expect(within(screen.getByRole('banner')).queryByRole('heading')).toBeNull();
    // A lazy screen chunk shows a polite loading status, then its content.
    expect(await screen.findByText(/Loading workspace/i)).toBeInTheDocument();
  });

  it('puts a skip link first in the tab order and it moves focus to <main>', () => {
    renderApp();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main-content');
    // First focusable element in the document.
    const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    expect(focusable[0]).toBe(skip);

    skip.focus();
    fireEvent.click(skip);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('moves focus to the new screen heading, updates the title and announces on navigation', async () => {
    renderApp();
    expect(document.title).toBe('Overview · Re-Shell');
    // Initial load must not steal focus.
    expect(document.body).toHaveFocus();

    fireEvent.click(within(nav()).getByRole('button', { name: /^Templates$/ }));
    const h1 = screen.getByRole('heading', { level: 1, name: 'Templates' });
    expect(h1).toHaveFocus();
    expect(document.title).toBe('Templates · Re-Shell');
    expect(window.location.search).toBe('?screen=templates');
    expect(within(nav()).getByRole('button', { name: /^Templates$/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Templates screen', { selector: '[role="status"]' })).toBeInTheDocument();

    // Back/forward restore the previous screen and move focus again.
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Overview');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('names the product from the white-label brand in the tab title', () => {
    const result = resolveWhiteLabel({ productName: 'Acme Console' });
    if (!result.ok) throw new Error('invalid brand');
    renderApp(result.config);
    expect(document.title).toBe('Overview · Acme Console');
    expect(screen.getByTestId('brand-name')).toHaveTextContent('Acme Console');
  });

  it('reports hub status as real text inside a live region', () => {
    renderApp();
    const status = within(screen.getByRole('banner')).getByRole('status');
    expect(status).toHaveTextContent('Connecting');
    expect(status).toHaveAttribute('data-hub-status', 'connecting');
  });

  it('keeps the theme toggle accessible (named, pressed state)', () => {
    renderApp();
    const toggle = within(screen.getByRole('banner')).getByRole('button', { name: /Switch to light theme/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(within(screen.getByRole('banner')).getByRole('button', { name: /Switch to dark theme/i })).toHaveAttribute('aria-pressed', 'false');
  });
});
