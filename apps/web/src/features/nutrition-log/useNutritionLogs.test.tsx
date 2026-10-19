import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useNutritionLogs, useNutritionSummary, useLogMeal } from './useNutritionLogs';
import { api } from '@/lib/api/client';
import { ApiException } from '@/lib/api/errors';

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: vi.fn(),
    DELETE: vi.fn(),
  },
}));

const mockMutate = vi.fn();
vi.mock('@/lib/offline/useSyncedMutation', () => ({
  useSyncedMutation: vi.fn(() => ({
    mutate: mockMutate,
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

describe('useNutritionLogs & useLogMeal hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches nutrition logs for child in date range', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        date: '2026-10-19',
        slot: 'BREAKFAST',
        eatenStatus: 'FULL',
        percent: null,
        notes: null,
        clientUpdatedAt: '2026-10-19T08:00:00Z',
      },
    ];

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockLogs,
      error: undefined,
      response: new Response(),
    } as unknown as ReturnType<typeof api.GET>);

    const { result } = renderHook(
      () => useNutritionLogs('child-1', '2026-10-19', '2026-10-19'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLogs);
    expect(api.GET).toHaveBeenCalledWith(
      '/v1/children/{childId}/nutrition-logs',
      expect.objectContaining({
        params: {
          path: { childId: 'child-1' },
          query: { from: '2026-10-19', to: '2026-10-19' },
        },
      })
    );
  });

  it('fetches nutrition summary for child in date range', async () => {
    const mockSummary = {
      from: '2026-10-13',
      to: '2026-10-19',
      plannedCount: 14,
      loggedCount: 10,
      fullCount: 7,
      partialCount: 2,
      skippedCount: 1,
      loggedPercent: 71,
      eatenPercent: 75,
      perSlot: [],
    };

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockSummary,
      error: undefined,
      response: new Response(),
    } as unknown as ReturnType<typeof api.GET>);

    const { result } = renderHook(
      () => useNutritionSummary('child-1', '2026-10-13', '2026-10-19'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSummary);
  });

  it('validates percent requirement when logging PARTIAL meal', async () => {
    const { result } = renderHook(() => useLogMeal('child-1'), {
      wrapper: createWrapper(),
    });

    // PARTIAL without percent should throw INVALID_PERCENT
    await expect(
      result.current.log({
        date: '2026-10-19',
        slot: 'LUNCH',
        eatenStatus: 'PARTIAL',
      })
    ).rejects.toThrow('INVALID_PERCENT');

    // FULL with percent should also throw INVALID_PERCENT
    await expect(
      result.current.log({
        date: '2026-10-19',
        slot: 'LUNCH',
        eatenStatus: 'FULL',
        percent: 50,
      })
    ).rejects.toThrow('INVALID_PERCENT');
  });

  it('retries with existing log id if server returns LOG_EXISTS conflict', async () => {
    const conflictError = new ApiException({
      status: 409,
      code: 'LOG_EXISTS',
      message: 'This meal slot already has a log',
      details: { id: 'existing-log-uuid' },
    });

    mockMutate
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({ queued: false, superseded: false });

    const { result } = renderHook(() => useLogMeal('child-1'), {
      wrapper: createWrapper(),
    });

    const res = await result.current.log({
      date: '2026-10-19',
      slot: 'BREAKFAST',
      eatenStatus: 'FULL',
    });

    expect(res).toEqual({ queued: false, superseded: false });
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'existing-log-uuid',
        date: '2026-10-19',
        slot: 'BREAKFAST',
        eatenStatus: 'FULL',
      })
    );
  });
});
