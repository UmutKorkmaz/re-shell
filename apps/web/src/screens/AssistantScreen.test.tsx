import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantScreen } from './AssistantScreen';

const useJobMock = vi.fn();
const startMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return {
    ...actual,
    // The deterministic resolver (resolveCommand) stays REAL — only the live job
    // transport is mocked so the suite is one-shot and network-free.
    useJob: (...args: unknown[]) => useJobMock(...args),
  };
});

function jobState(over: Partial<ReturnType<typeof useJobMock>> = {}) {
  return {
    lines: [],
    status: 'running',
    exitCode: null,
    error: null,
    start: startMock,
    cancel: cancelMock,
    ...over,
  };
}

function ask(text: string): void {
  fireEvent.change(screen.getByLabelText(/ask the assistant/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /resolve & run/i }));
}

describe('AssistantScreen', () => {
  beforeEach(() => {
    useJobMock.mockReturnValue(jobState());
  });

  afterEach(() => {
    useJobMock.mockReset();
    startMock.mockClear();
    cancelMock.mockClear();
    vi.restoreAllMocks();
  });

  it('renders the prompt console and empty state', () => {
    render(<AssistantScreen />);
    expect(screen.getByRole('heading', { name: /assistant console/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ask the assistant/i })).toBeInTheDocument();
  });

  it('resolves "is my workspace healthy?" to workspace.health and runs it (acceptance)', () => {
    useJobMock.mockReturnValue(
      jobState({ lines: [{ stream: 'stdout', text: 'all green' }], status: 'running' })
    );
    render(<AssistantScreen />);

    ask('is my workspace healthy?');

    // The resolved command id is routed straight through the hub job pipeline.
    expect(useJobMock).toHaveBeenCalledWith('workspace.health', undefined);
    // Transparency: the resolved command is shown (preview + job header echo).
    expect(screen.getAllByText(/re-shell workspace health --json/).length).toBeGreaterThan(0);
    expect(screen.getByText(/all green/)).toBeInTheDocument();
  });

  it('refuses an out-of-allow-list request and lists allowed commands', () => {
    render(<AssistantScreen />);

    ask('delete the production database and email everyone');

    expect(useJobMock).not.toHaveBeenCalled();
    const refusal = screen.getByText(/can.?t run that/i).closest('div');
    expect(refusal).not.toBeNull();
    // The refusal lists vetted commands the assistant CAN run.
    expect(within(refusal as HTMLElement).getByText(/Workspace health/i)).toBeInTheDocument();
  });

  it('resolves a dependency-graph intent via a keyword synonym', () => {
    render(<AssistantScreen />);
    ask('show me the deps graph');
    expect(useJobMock).toHaveBeenCalledWith('workspace.graph', undefined);
  });

  it('seeds discovery with example prompts that resolve when clicked', () => {
    render(<AssistantScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'List available templates' }));
    expect(useJobMock).toHaveBeenCalledWith('templates.list', undefined);
  });

  it('does not submit a blank query', () => {
    render(<AssistantScreen />);
    fireEvent.click(screen.getByRole('button', { name: /resolve & run/i }));
    expect(useJobMock).not.toHaveBeenCalled();
  });

  it('dismisses a turn', () => {
    render(<AssistantScreen />);
    ask('is my workspace healthy?');
    expect(screen.getByText(/you asked:/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    expect(screen.queryByText(/you asked:/i)).not.toBeInTheDocument();
  });
});
