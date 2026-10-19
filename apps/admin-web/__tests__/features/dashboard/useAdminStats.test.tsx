import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminStats } from '@/features/dashboard/useAdminStats';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: vi.fn(),
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

describe('useAdminStats hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /v1/admin/stats and returns data', async () => {
    const mockStats = {
      totalUsers: 42,
      verifiedUsers: 38,
      disabledUsers: 1,
      totalChildren: 50,
      mealEntriesGenerated: 250,
      vaccinationsGiven: 120,
      signupsByDay: [{ date: '2026-05-01', count: 3 }],
    };

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockStats,
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.GET).toHaveBeenCalledWith('/v1/admin/stats');
    expect(result.current.data?.totalUsers).toBe(42);
    expect(result.current.data?.vaccinationsGiven).toBe(120);
  });
});
