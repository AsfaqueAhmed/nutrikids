import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useAdminVaccines,
  useUpdateVaccine,
  useUpdateScheduleItem,
} from './useAdminVaccines';
import { apiClient } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    GET: vi.fn(),
    PATCH: vi.fn(),
  },
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

describe('useAdminVaccines hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches admin vaccine catalogue', async () => {
    const mockVaccines = [
      {
        id: 'vac-1',
        code: 'BCG',
        name: 'BCG',
        disease: 'Tuberculosis',
        description: 'At birth',
        availability: 'GOVERNMENT_FREE',
        isMandatory: true,
        priceMinBdt: null,
        priceMaxBdt: null,
        priceNote: null,
        priceUpdatedAt: null,
        sourceNote: 'EPI schedule',
        verified: true,
        schedule: [
          {
            id: 'item-1',
            doseNumber: 1,
            suggestedAgeDays: 0,
            minAgeDays: 0,
            maxAgeDays: 365,
            intervalFromPreviousDays: null,
            notes: null,
          },
        ],
      },
    ];

    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: mockVaccines,
      error: undefined,
      response: new Response(),
    } as unknown as ReturnType<typeof apiClient.GET>);

    const { result } = renderHook(() => useAdminVaccines(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockVaccines);
    expect(apiClient.GET).toHaveBeenCalledWith('/v1/admin/vaccines');
  });

  it('calls PATCH /v1/admin/vaccines/:id to update vaccine', async () => {
    vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
      data: { id: 'vac-1', verified: true },
      error: undefined,
      response: new Response(),
    } as unknown as ReturnType<typeof apiClient.PATCH>);

    const { result } = renderHook(() => useUpdateVaccine(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'vac-1',
      data: { verified: true, priceMinBdt: 100, priceMaxBdt: 200 },
    });

    expect(apiClient.PATCH).toHaveBeenCalledWith(
      '/v1/admin/vaccines/{id}',
      expect.objectContaining({
        params: { path: { id: 'vac-1' } },
        body: { verified: true, priceMinBdt: 100, priceMaxBdt: 200 },
      })
    );
  });

  it('calls PATCH /v1/admin/vaccine-schedule-items/:id to update schedule item', async () => {
    vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
      data: { id: 'item-1', suggestedAgeDays: 14 },
      error: undefined,
      response: new Response(),
    } as unknown as ReturnType<typeof apiClient.PATCH>);

    const { result } = renderHook(() => useUpdateScheduleItem(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      id: 'item-1',
      data: { suggestedAgeDays: 14 },
    });

    expect(apiClient.PATCH).toHaveBeenCalledWith(
      '/v1/admin/vaccine-schedule-items/{id}',
      expect.objectContaining({
        params: { path: { id: 'item-1' } },
        body: { suggestedAgeDays: 14 },
      })
    );
  });
});
