import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFoods, useFoodMutations } from '@/features/foods/useFoods';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFoods & useFoodMutations hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches foods passing search query and category', async () => {
    const mockPage = {
      items: [
        {
          id: 'f-1',
          name: 'Banana',
          category: 'Fruits',
          allergens: [],
          nutrition: { energyKcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3 },
          ageMinMonths: 6,
          ageMaxMonths: 36,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockPage,
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useFoods({ search: 'Banana', category: 'Fruits' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.GET).toHaveBeenCalledWith('/v1/foods', {
      params: {
        query: {
          search: 'Banana',
          category: 'Fruits',
          page: 1,
          pageSize: 20,
        },
      },
    });
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('removes a food via DELETE /v1/foods/{id}', async () => {
    vi.mocked(api.DELETE).mockResolvedValueOnce({
      response: { status: 204, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.DELETE>>);

    const { result } = renderHook(() => useFoodMutations(), { wrapper: createWrapper() });

    await result.current.remove('f-1');

    expect(api.DELETE).toHaveBeenCalledWith('/v1/foods/{id}', {
      params: { path: { id: 'f-1' } },
    });
  });
});
