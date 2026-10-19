import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { VaccineForm } from '@/features/vaccines/VaccineForm';
import { AdminVaccine } from '@/lib/api/models';

const sampleVaccine: AdminVaccine = {
  id: 'vac-1',
  code: 'BCG',
  name: 'BCG Vaccine',
  disease: 'Tuberculosis',
  description: 'Prevents childhood TB',
  availability: 'GOVERNMENT_FREE',
  isMandatory: true,
  priceMinBdt: null,
  priceMaxBdt: null,
  priceNote: null,
  priceUpdatedAt: null,
  sourceNote: 'EPI schedule guidelines',
  verified: false,
  schedule: [],
};

describe('VaccineForm component', () => {
  it('shows error and stays editable when server returns INVALID_PRICE_RANGE', () => {
    render(
      <VaccineForm
        vaccine={sampleVaccine}
        onSubmit={vi.fn()}
        apiError="The minimum price must not exceed the maximum price"
      />
    );

    expect(
      screen.getByText('The minimum price must not exceed the maximum price')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/vaccine name/i)).toBeEnabled();
  });

  it('prompts confirmation when toggling Verified checkbox', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<VaccineForm vaccine={sampleVaccine} onSubmit={onSubmit} />);

    const verifiedCheckbox = screen.getByRole('checkbox', { name: /verified by medical advisor/i });
    expect(verifiedCheckbox).not.toBeChecked();

    // Click checkbox to turn it on
    await user.click(verifiedCheckbox);

    // Confirmation dialog appears
    expect(
      screen.getByText(/mark as verified by the medical advisor\?/i)
    ).toBeInTheDocument();

    // Confirm dialog
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    // Checkbox is now checked
    expect(verifiedCheckbox).toBeChecked();
  });

  it('submits updated vaccine fields when form is saved', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<VaccineForm vaccine={sampleVaccine} onSubmit={onSubmit} />);

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated TB protection guide');

    const saveBtn = screen.getByRole('button', { name: /save vaccine details/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Updated TB protection guide',
        })
      );
    });
  });
});
