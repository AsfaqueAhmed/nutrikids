import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminSession } from './useAdminSession';
import { api } from '@/lib/api/client';
import { tokens } from '@/lib/api/auth';
import { copy } from '@/lib/copy';

vi.mock('@/lib/api/client', () => ({
  api: {
    POST: vi.fn(),
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

describe('useAdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokens.clear();
  });

  it('rejects login with PARENT role and leaves status: "anon" with storage empty', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce({
      data: {
        accessToken: 'access-parent',
        refreshToken: 'refresh-parent',
        expiresIn: 3600,
      },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.POST>>);

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: {
        id: 'u-1',
        email: 'parent@example.com',
        role: 'PARENT',
        emailVerified: true,
        timezone: 'UTC',
      },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useAdminSession(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.login('parent@example.com', 'password123');
      })
    ).rejects.toThrow(copy.login.notAdmin);

    expect(result.current.status).toBe('anon');
    expect(result.current.user).toBeNull();
    expect(tokens.getAccess()).toBeNull();
    expect(tokens.getRefresh()).toBeNull();
  });

  it('resolves login with ADMIN role and sets status: "authed"', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce({
      data: {
        accessToken: 'access-admin',
        refreshToken: 'refresh-admin',
        expiresIn: 3600,
      },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.POST>>);

    vi.mocked(api.GET).mockResolvedValueOnce({
      data: {
        id: 'u-admin',
        email: 'admin@nutrikids.com',
        role: 'ADMIN',
        emailVerified: true,
        timezone: 'UTC',
      },
      response: { status: 200, ok: true } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useAdminSession(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.login('admin@nutrikids.com', 'adminPass123');
    });

    expect(result.current.status).toBe('authed');
    expect(result.current.user?.role).toBe('ADMIN');
    expect(tokens.getRefresh()).toBe('refresh-admin');
  });

  it('surfaces ACCOUNT_DISABLED error on 403 login response', async () => {
    vi.mocked(api.POST).mockResolvedValueOnce({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'This account has been disabled.',
        statusCode: 403,
      },
      response: { status: 403, ok: false } as Response,
    } as unknown as Awaited<ReturnType<typeof api.POST>>);

    const { result } = renderHook(() => useAdminSession(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.login('disabled@nutrikids.com', 'password123');
      })
    ).rejects.toThrow('This account has been disabled.');

    expect(result.current.status).toBe('anon');
  });
});
