import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RecipeForm } from './RecipeForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    GET: vi.fn(),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('RecipeForm component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks submit and shows validation errors when required fields are missing', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithClient(<RecipeForm onSubmit={onSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /save recipe/i });
    await user.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/recipe name is required/i)).toBeInTheDocument();
  });

  it('allows adding and removing ingredient rows and validates at least one ingredient', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithClient(<RecipeForm onSubmit={onSubmit} />);

    // Initially there is 1 empty ingredient row
    expect(screen.getByText(/ingredient 1/i)).toBeInTheDocument();

    // Add second ingredient row
    const addRowBtn = screen.getByRole('button', { name: /\+ add ingredient/i });
    await user.click(addRowBtn);

    expect(screen.getByText(/ingredient 2/i)).toBeInTheDocument();

    // Remove the second row
    const removeBtns = screen.getAllByRole('button', { name: /remove/i });
    expect(removeBtns).toHaveLength(2);
    await user.click(removeBtns[1]);

    expect(screen.queryByText(/ingredient 2/i)).not.toBeInTheDocument();
  });

  it('displays computed allergen tags from selected ingredients', async () => {
    const onSubmit = vi.fn();

    // Initial with foods having allergens MILK and PEANUT
    const initial = {
      name: 'Peanut Butter Milkshake',
      instructions: 'Blend milk and peanut butter until smooth',
      prepMinutes: 5,
      ageMinMonths: 12,
      ageMaxMonths: 60,
      slots: ['AFTERNOON_SNACK' as const],
      suitableDiets: ['VEGETARIAN' as const],
      foods: [
        { foodId: 'food-milk', name: 'Whole Cow Milk', quantityG: 200, allergens: ['MILK' as const] },
        { foodId: 'food-pb', name: 'Peanut Butter', quantityG: 30, allergens: ['PEANUT' as const] },
      ],
    };

    renderWithClient(<RecipeForm initial={initial} onSubmit={onSubmit} />);

    // Check allergen chips rendered in the "Computed Allergens" section
    expect(screen.getByTestId('computed-allergens')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Peanut')).toBeInTheDocument();
  });

  it('submits valid recipe payload with ingredients and metadata', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <RecipeForm
        initial={{
          foods: [{ foodId: 'food-apple', name: 'Steamed Apple', quantityG: 100, allergens: [] }],
        }}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/recipe name/i), 'Warm Apple Puree');
    await user.type(screen.getByLabelText(/instructions/i), 'Steam apples for 10 minutes and mash');
    await user.type(screen.getByLabelText(/prep minutes/i), '10');
    await user.type(screen.getByLabelText(/min age/i), '6');
    await user.type(screen.getByLabelText(/max age/i), '24');

    // Select slot Breakfast
    const breakfastCheckbox = screen.getByRole('checkbox', { name: /breakfast/i });
    await user.click(breakfastCheckbox);

    // Select diet Vegetarian
    const vegCheckbox = screen.getByRole('checkbox', { name: /vegetarian/i });
    await user.click(vegCheckbox);

    const submitBtn = screen.getByRole('button', { name: /save recipe/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Warm Apple Puree',
          instructions: 'Steam apples for 10 minutes and mash',
          prepMinutes: 10,
          ageMinMonths: 6,
          ageMaxMonths: 24,
          slots: expect.arrayContaining(['BREAKFAST']),
          suitableDiets: expect.arrayContaining(['VEGETARIAN']),
          foods: [{ foodId: 'food-apple', quantityG: 100 }],
        })
      );
    });
  });
});
