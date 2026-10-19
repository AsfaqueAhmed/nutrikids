import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '@/features/auth/useSession';
import { tokens } from '@/lib/api/auth';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    GET: vi.fn(),
    POST: vi.fn(),
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

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokens.clear();
  });

  it('becomes anon when no refresh token exists', async () => {
    const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.status).toBe('anon');
      expect(result.current.user).toBeNull();
    });
  });

  it('becomes authed when token refresh and user fetch succeed', async () => {
    tokens.setRefresh('valid-refresh-token');
    vi.mocked(api.GET).mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'parent@example.com',
        role: 'parent',
        emailVerified: true,
        timezone: 'Asia/Dhaka',
      },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    // Mock global fetch for auth/refresh
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    } as Response);

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.status).toBe('authed');
      expect(result.current.user?.email).toBe('parent@example.com');
    });
  });

  it('calls logout, clears tokens and transitions to anon', async () => {
    tokens.setAccess('access-token');
    tokens.setRefresh('refresh-token');
    vi.mocked(api.POST).mockResolvedValueOnce({
      data: { success: true },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.POST>>);

    const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.logout();
    });

    expect(tokens.getAccess()).toBeNull();
    expect(tokens.getRefresh()).toBeNull();
    expect(result.current.status).toBe('anon');
  });
});
