import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesScreen } from './TemplatesScreen';
import type { TemplateFeed } from './shared/feedSchemas';

const useHubQueryMock = vi.fn();
const writeTextMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@umutkorkmaz/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@umutkorkmaz/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function queryState(over: Partial<ReturnType<typeof useHubQueryMock>>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

const TEMPLATES: TemplateFeed[] = [
  {
    id: 'express',
    name: 'express',
    displayName: 'Express.js',
    description: 'Minimalist web framework',
    language: 'typescript',
    framework: 'express',
    version: '4.19.2',
    tags: ['nodejs', 'rest'],
    features: ['routing'],
    port: 3000,
    fileCount: 27,
  },
  {
    id: 'sailsjs',
    name: 'sailsjs',
    displayName: 'Sails.js',
    description: 'MVC framework',
    language: 'javascript',
    framework: 'sailsjs',
    version: '1.5.8',
    tags: ['nodejs', 'postgres'],
    features: ['database'],
    port: 1337,
    fileCount: 30,
  },
];

function setList(): void {
  useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: TEMPLATES, warnings: [] } }));
}

describe('TemplatesScreen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    useHubQueryMock.mockReset();
    writeTextMock.mockClear();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(<TemplatesScreen />);
    expect(screen.getByText(/Loading templates/i)).toBeInTheDocument();
  });

  it('marks tier-1 templates and lists all rows', () => {
    setList();
    render(<TemplatesScreen />);
    expect(screen.getByText('Express.js')).toBeInTheDocument();
    expect(screen.getByText('Sails.js')).toBeInTheDocument();
    // express is in the curated tier-1 list; sailsjs is not.
    expect(screen.getAllByText('Tier 1')).toHaveLength(1);
  });

  it('narrows the grid by a filter and persists it in the URL', () => {
    setList();
    render(<TemplatesScreen />);

    fireEvent.change(screen.getByLabelText('language'), { target: { value: 'javascript' } });

    expect(screen.queryByText('Express.js')).not.toBeInTheDocument();
    expect(screen.getByText('Sails.js')).toBeInTheDocument();
    expect(window.location.search).toContain('language=javascript');
  });

  it('shows the empty-filter-result state when nothing matches', () => {
    setList();
    render(<TemplatesScreen />);
    fireEvent.change(screen.getByLabelText('database'), { target: { value: 'PostgreSQL' } });
    fireEvent.change(screen.getByLabelText('language'), { target: { value: 'typescript' } });
    expect(screen.getByText(/No templates match these filters/i)).toBeInTheDocument();
  });

  /** The scaffold CommandPreview region for a template id (stable test id). */
  function scaffoldPreview(id: string): HTMLElement {
    return screen.getByTestId(`scaffold-${id}`);
  }

  it('dry-run toggle injects --dry-run into the command', () => {
    setList();
    render(<TemplatesScreen />);

    const preview = within(scaffoldPreview('express'));
    expect(preview.getByText(/^re-shell create express/)).not.toHaveTextContent('--dry-run');
    fireEvent.click(preview.getByRole('button', { name: /dry run/i }));
    expect(preview.getByText(/--dry-run/)).toBeInTheDocument();
  });

  it('copy copies the exact command shown', () => {
    setList();
    render(<TemplatesScreen />);

    const preview = within(scaffoldPreview('express'));
    fireEvent.click(preview.getByRole('button', { name: /copy command/i }));

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock.mock.calls[0][0]).toMatch(/^re-shell create express --template express$/);
  });

  it('hydrates filters from the URL on load', () => {
    window.history.replaceState(null, '', '/?language=javascript');
    setList();
    render(<TemplatesScreen />);
    expect(screen.getByLabelText('language')).toHaveValue('javascript');
    expect(screen.queryByText('Express.js')).not.toBeInTheDocument();
  });
});
