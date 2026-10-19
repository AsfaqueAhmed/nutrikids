import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SignupsChart } from './SignupsChart';

describe('SignupsChart component', () => {
  it('renders a chart container with role="img" and accessible aria-label summarizing total', () => {
    const data = [
      { date: '2026-05-01', count: 5 },
      { date: '2026-05-02', count: 10 },
      { date: '2026-05-03', count: 0 },
    ];

    render(<SignupsChart data={data} />);

    const chartContainer = screen.getByRole('img');
    expect(chartContainer).toBeInTheDocument();
    expect(chartContainer).toHaveAttribute(
      'aria-label',
      expect.stringContaining('New sign-ups in the last 30 days: 15 total')
    );
  });

  it('renders a visually hidden table for screen readers', () => {
    const data = [{ date: '2026-05-01', count: 5 }];
    render(<SignupsChart data={data} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('2026-05-01')).toBeInTheDocument();
  });

  it('shows "No sign-ups in the last 30 days." when all data counts are zero or empty', () => {
    const data = [
      { date: '2026-05-01', count: 0 },
      { date: '2026-05-02', count: 0 },
    ];
    render(<SignupsChart data={data} />);

    expect(screen.getByText('No sign-ups in the last 30 days.')).toBeInTheDocument();
  });
});
