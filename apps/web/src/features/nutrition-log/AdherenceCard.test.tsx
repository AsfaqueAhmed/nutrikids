import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdherenceCard } from './AdherenceCard';
import * as useNutritionLogsModule from './useNutritionLogs';
import type { NutritionSummary } from '@/lib/api/models';

vi.mock('./useNutritionLogs', () => ({
  useNutritionSummary: vi.fn(),
}));

describe('AdherenceCard', () => {
  const mockUseNutritionSummary = vi.mocked(useNutritionLogsModule.useNutritionSummary);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when loggedCount is 0', () => {
    mockUseNutritionSummary.mockReturnValue({
      data: {
        from: '2026-10-13',
        to: '2026-10-19',
        plannedCount: 21,
        loggedCount: 0,
        fullCount: 0,
        partialCount: 0,
        skippedCount: 0,
        loggedPercent: 0,
        eatenPercent: 0,
        perSlot: [],
      },
      isLoading: false,
    } as any);

    render(<AdherenceCard childId="child-1" />);

    expect(screen.getByText('No meals logged yet. Tap a meal on Today to start.')).toBeInTheDocument();
    expect(screen.queryByTestId('stacked-adherence-bar')).not.toBeInTheDocument();
  });

  it('renders adherence stats, slot breakdown, and stacked bar with aria-labels when meals are logged', () => {
    const summaryData: NutritionSummary = {
      from: '2026-10-13',
      to: '2026-10-19',
      plannedCount: 6,
      loggedCount: 3,
      fullCount: 1,
      partialCount: 1,
      skippedCount: 1,
      loggedPercent: 50,
      eatenPercent: 50,
      perSlot: [
        { slot: 'BREAKFAST', logged: 1, full: 1, partial: 0, skipped: 0 },
        { slot: 'LUNCH', logged: 1, full: 0, partial: 1, skipped: 0 },
        { slot: 'DINNER', logged: 1, full: 0, partial: 0, skipped: 1 },
      ],
    };

    mockUseNutritionSummary.mockReturnValue({
      data: summaryData,
      isLoading: false,
    } as any);

    render(<AdherenceCard childId="child-1" />);

    // Explainer text
    expect(
      screen.getByText('The score is based on the meal plan. This card shows what was actually eaten.'),
    ).toBeInTheDocument();

    // Summary texts
    expect(screen.getByText(/Logged 3 of 6 planned meals/i)).toBeInTheDocument();
    expect(screen.getByText(/Ate about 50% of what was logged/i)).toBeInTheDocument();

    // Stacked bar segments with aria-label
    expect(screen.getByLabelText('1 full')).toBeInTheDocument();
    expect(screen.getByLabelText('1 partly')).toBeInTheDocument();
    expect(screen.getByLabelText('1 skipped')).toBeInTheDocument();

    // Per-slot rows
    expect(screen.getByText('BREAKFAST')).toBeInTheDocument();
    expect(screen.getByText('LUNCH')).toBeInTheDocument();
    expect(screen.getByText('DINNER')).toBeInTheDocument();
  });

  it('switches between 7 and 30 day range via tablist', async () => {
    const user = userEvent.setup();
    mockUseNutritionSummary.mockReturnValue({
      data: {
        from: '2026-10-13',
        to: '2026-10-19',
        plannedCount: 6,
        loggedCount: 3,
        fullCount: 1,
        partialCount: 1,
        skippedCount: 1,
        loggedPercent: 50,
        eatenPercent: 50,
        perSlot: [],
      },
      isLoading: false,
    } as any);

    render(<AdherenceCard childId="child-1" />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tab7 = screen.getByRole('tab', { name: /7 days/i });
    const tab30 = screen.getByRole('tab', { name: /30 days/i });

    expect(tab7).toHaveAttribute('aria-selected', 'true');
    expect(tab30).toHaveAttribute('aria-selected', 'false');

    await user.click(tab30);
    expect(tab30).toHaveAttribute('aria-selected', 'true');

    // Called with 30-day range
    expect(mockUseNutritionSummary).toHaveBeenCalledWith(
      'child-1',
      expect.any(String),
      expect.any(String),
    );
  });
});
