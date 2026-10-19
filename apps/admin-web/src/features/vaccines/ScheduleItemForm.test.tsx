import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ScheduleItemForm } from './ScheduleItemForm';

const sampleItem = {
  id: 'item-1',
  doseNumber: 1,
  suggestedAgeDays: 42,
  minAgeDays: 42,
  maxAgeDays: 365,
  intervalFromPreviousDays: null,
  notes: 'First dose',
};

describe('ScheduleItemForm component', () => {
  it('prevents submission when minAgeDays > suggestedAgeDays with client error', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<ScheduleItemForm item={sampleItem} onSubmit={onSubmit} />);

    const minAgeInput = screen.getByLabelText(/min age \(days\)/i);
    await user.clear(minAgeInput);
    await user.type(minAgeInput, '60'); // min 60 > suggested 42

    const saveBtn = screen.getByRole('button', { name: /save dose 1/i });
    await user.click(saveBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/minimum age cannot be greater than suggested age/i)
    ).toBeInTheDocument();
  });

  it('submits updated schedule item values when valid', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<ScheduleItemForm item={sampleItem} onSubmit={onSubmit} />);

    const notesInput = screen.getByLabelText(/dose notes/i);
    await user.clear(notesInput);
    await user.type(notesInput, 'Give with oral polio vaccine');

    const saveBtn = screen.getByRole('button', { name: /save dose 1/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Give with oral polio vaccine',
        })
      );
    });
  });
});
