import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRecipes, useRecipeMutations } from './useRecipes';
import { apiClient } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRecipes hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches recipes list successfully', async () => {
    const mockRecipes = [
      {
        id: 'rec-1',
        name: 'Banana Oatmeal',
        instructions: 'Mix and cook for 5 minutes',
        prepMinutes: 5,
        ageMinMonths: 6,
        ageMaxMonths: 24,
        slots: ['BREAKFAST'],
        suitableDiets: ['VEGETARIAN'],
        foods: [{ foodId: 'food-1', name: 'Oats', quantityG: 40 }],
        allergens: [],
      },
    ];

    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: mockRecipes,
      error: undefined,
      response: new Response(),
    } as any);

    const { result } = renderHook(() => useRecipes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRecipes);
    expect(apiClient.GET).toHaveBeenCalledWith('/v1/recipes', expect.any(Object));
  });

  it('handles create and delete recipe mutations', async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { id: 'rec-2', name: 'Apple Puree' },
      error: undefined,
      response: new Response(),
    } as any);

    vi.mocked(apiClient.DELETE).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(),
    } as any);

    const { result } = renderHook(() => useRecipeMutations(), { wrapper: createWrapper() });

    const newRecipe = await result.current.createRecipe({
      name: 'Apple Puree',
      instructions: 'Steam and blend apples',
      prepMinutes: 10,
      ageMinMonths: 6,
      ageMaxMonths: 12,
      slots: ['MORNING_SNACK'],
      suitableDiets: ['VEGAN', 'VEGETARIAN'],
      foods: [{ foodId: 'food-apple', quantityG: 100 }],
    });

    expect(newRecipe.id).toBe('rec-2');
    expect(apiClient.POST).toHaveBeenCalledWith(
      '/v1/recipes',
      expect.objectContaining({
        body: expect.objectContaining({ name: 'Apple Puree' }),
      })
    );

    await result.current.deleteRecipe('rec-2');
    expect(apiClient.DELETE).toHaveBeenCalledWith(
      '/v1/recipes/{id}',
      expect.objectContaining({
        params: { path: { id: 'rec-2' } },
      })
    );
  });
});
