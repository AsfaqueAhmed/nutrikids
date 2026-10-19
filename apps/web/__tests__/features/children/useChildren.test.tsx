import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChildren } from '@/features/children/useChildren';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
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

describe('useChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches children successfully', async () => {
    const mockChildren = [
      {
        id: 'c1',
        name: 'Maya',
        dateOfBirth: '2023-01-15',
        ageMonths: 45,
        gender: 'FEMALE',
        heightCm: 85,
        weightKg: 12,
        activityLevel: 'MODERATE',
        dietType: 'NON_VEGETARIAN',
        photoUrl: null,
        allergies: [],
        conditions: [],
        dislikes: [],
      },
    ];

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockChildren,
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useChildren(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.children).toHaveLength(1);
      expect(result.current.children[0].name).toBe('Maya');
    });
  });
});
