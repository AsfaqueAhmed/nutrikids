import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FoodForm } from '@/features/foods/FoodForm';

describe('FoodForm component', () => {
  it('blocks submit and shows validation errors when required fields are empty', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<FoodForm onSubmit={onSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /save food/i });
    await user.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('submits valid food payload with numeric nutrition values and allergen tags', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<FoodForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/food name/i), 'Mashed Sweet Potato');
    await user.type(screen.getByLabelText(/category/i), 'Vegetables');
    await user.type(screen.getByLabelText(/energy \(kcal\)/i), '86');
    await user.type(screen.getByLabelText(/protein \(g\)/i), '1.6');
    await user.type(screen.getByLabelText(/carbs \(g\)/i), '20.1');
    await user.type(screen.getByLabelText(/fat \(g\)/i), '0.1');
    await user.type(screen.getByLabelText(/min age/i), '6');
    await user.type(screen.getByLabelText(/max age/i), '24');

    // Click on allergen tag "Milk"
    const milkCheckbox = screen.getByRole('checkbox', { name: /milk/i });
    await user.click(milkCheckbox);

    const submitBtn = screen.getByRole('button', { name: /save food/i });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mashed Sweet Potato',
        category: 'Vegetables',
        allergens: ['MILK'],
        ageMinMonths: 6,
        ageMaxMonths: 24,
        nutrition: {
          energyKcal: 86,
          proteinG: 1.6,
          carbsG: 20.1,
          fatG: 0.1,
        },
      })
    );
  });

  it('renders server-level error message when apiError is provided', () => {
    render(<FoodForm onSubmit={vi.fn()} apiError="A food with this name already exists" />);
    expect(screen.getByRole('alert')).toHaveTextContent('A food with this name already exists');
  });
});
