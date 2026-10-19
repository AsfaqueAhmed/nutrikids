import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminUsers, useUpdateUser } from './useAdminUsers';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: vi.fn(),
    PATCH: vi.fn(),
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

describe('useAdminUsers & useUpdateUser hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches users passing filters as query parameters', async () => {
    const mockPage = {
      items: [
        {
          id: 'u-1',
          email: 'test@nutrikids.com',
          role: 'PARENT',
          disabled: true,
          emailVerified: true,
          childCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    };

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: mockPage,
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const filters = { disabled: true, role: 'PARENT' as const, q: 'test' };
    const { result } = renderHook(() => useAdminUsers(filters), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.GET).toHaveBeenCalledWith('/v1/admin/users', {
      params: {
        query: {
          disabled: true,
          role: 'PARENT',
          q: 'test',
        },
      },
    });
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('updates a user via PATCH /v1/admin/users/{id}', async () => {
    const updatedUser = {
      id: 'u-1',
      email: 'test@nutrikids.com',
      role: 'ADMIN',
      disabled: false,
      emailVerified: true,
      childCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(api.PATCH).mockResolvedValueOnce({
      data: updatedUser,
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.PATCH>>);

    const { result } = renderHook(() => useUpdateUser(), { wrapper: createWrapper() });

    const response = await result.current.mutateAsync({
      id: 'u-1',
      role: 'ADMIN',
    });

    expect(api.PATCH).toHaveBeenCalledWith('/v1/admin/users/{id}', {
      params: { path: { id: 'u-1' } },
      body: { role: 'ADMIN' },
    });
    expect(response.role).toBe('ADMIN');
  });
});
