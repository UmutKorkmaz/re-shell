import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders a shadcn-style button', () => {
    render(<Button>Run health</Button>);

    const button = screen.getByRole('button', { name: 'Run health' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex');
  });
});
