import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QuickLog } from './QuickLog';
import { useLogMeal } from './useNutritionLogs';
import { NutritionLog } from '@/lib/api/models';

vi.mock('./useNutritionLogs', () => ({
  useLogMeal: vi.fn(),
}));

describe('QuickLog component', () => {
  const mockLog = vi.fn();
  const mockClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLogMeal).mockReturnValue({
      log: mockLog,
      clear: mockClear,
    });
  });

  it('renders three buttons with min-h-11 and aria-pressed="false" when no log exists', () => {
    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="BREAKFAST" />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    const someBtn = screen.getByRole('button', { name: /ate some/i });
    const skippedBtn = screen.getByRole('button', { name: /skipped/i });

    expect(fullBtn).toHaveAttribute('aria-pressed', 'false');
    expect(someBtn).toHaveAttribute('aria-pressed', 'false');
    expect(skippedBtn).toHaveAttribute('aria-pressed', 'false');

    expect(fullBtn.className).toContain('min-h-11');
    expect(someBtn.className).toContain('min-h-11');
    expect(skippedBtn.className).toContain('min-h-11');
  });

  it('renders "Ate all" with aria-pressed="true" and check icon when existing status is FULL', () => {
    const existing: NutritionLog = {
      id: 'log-1',
      date: '2026-10-19',
      slot: 'BREAKFAST',
      eatenStatus: 'FULL',
      percent: null,
      notes: null,
      clientUpdatedAt: '2026-10-19T08:00:00Z',
    };

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="BREAKFAST" existing={existing} />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    expect(fullBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('calls log with eatenStatus="FULL" when clicking "Ate all"', async () => {
    mockLog.mockResolvedValueOnce({ queued: false, superseded: false });
    const user = userEvent.setup();

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="LUNCH" />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    await user.click(fullBtn);

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-10-19',
        slot: 'LUNCH',
        eatenStatus: 'FULL',
      })
    );
  });

  it('opens PartialPercentDialog on "Ate some" and logs chosen percent', async () => {
    mockLog.mockResolvedValueOnce({ queued: false, superseded: false });
    const user = userEvent.setup();

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="LUNCH" />
    );

    const someBtn = screen.getByRole('button', { name: /ate some/i });
    await user.click(someBtn);

    // Dialog opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/how much was eaten\?/i)).toBeInTheDocument();

    // Select 50%
    const radio50 = screen.getByRole('radio', { name: /50%/i });
    await user.click(radio50);

    const saveBtn = screen.getByRole('button', { name: /save portion/i });
    await user.click(saveBtn);

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-10-19',
        slot: 'LUNCH',
        eatenStatus: 'PARTIAL',
        percent: 50,
      })
    );
  });

  it('calls clear(existing.id) when clicking the already pressed button to clear', async () => {
    const existing: NutritionLog = {
      id: 'log-1',
      date: '2026-10-19',
      slot: 'DINNER',
      eatenStatus: 'FULL',
      percent: null,
      notes: null,
      clientUpdatedAt: '2026-10-19T18:00:00Z',
    };
    const user = userEvent.setup();

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="DINNER" existing={existing} />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    await user.click(fullBtn);

    // Prompt to clear
    const clearBtn = screen.getByRole('button', { name: /clear entry/i });
    await user.click(clearBtn);

    expect(mockClear).toHaveBeenCalledWith('log-1');
  });

  it('displays "Saved offline" when queued is true', async () => {
    mockLog.mockResolvedValueOnce({ queued: true, superseded: false });
    const user = userEvent.setup();

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="BREAKFAST" />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    await user.click(fullBtn);

    await waitFor(() => {
      expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
    });
  });

  it('displays superseded notice when superseded is true', async () => {
    mockLog.mockResolvedValueOnce({ queued: false, superseded: true });
    const user = userEvent.setup();

    render(
      <QuickLog childId="child-1" date="2026-10-19" slot="BREAKFAST" />
    );

    const fullBtn = screen.getByRole('button', { name: /ate all/i });
    await user.click(fullBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/your change was replaced by a newer one\./i)
      ).toBeInTheDocument();
    });
  });
});
