'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { refreshSession, tokens } from '@/lib/api/auth';
import { ApiException, toProblem } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';

export type User = components['schemas']['User'];
export type SessionStatus = 'loading' | 'authed' | 'anon';

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const queryClient = useQueryClient();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.GET('/v1/me');
      if (res.data) {
        setUser(res.data);
        setStatus('authed');
        return res.data;
      }
      setStatus('anon');
      return null;
    } catch {
      setStatus('anon');
      return null;
    }
  }, []);

  const initSession = useCallback(async () => {
    const refreshToken = tokens.getRefresh();
    if (!refreshToken) {
      setUser(null);
      setStatus('anon');
      return;
    }
    const refreshed = await refreshSession();
    if (!refreshed) {
      setUser(null);
      setStatus('anon');
      return;
    }
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.POST('/v1/auth/login', {
        body: { email, password },
      });
      if (res.error) {
        throw new ApiException(toProblem(res.response, res.error));
      }
      if (res.data) {
        tokens.setAccess(res.data.accessToken);
        tokens.setRefresh(res.data.refreshToken);
        setUser(res.data.user);
        setStatus('authed');
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.POST('/v1/auth/register', {
        body: { email, password },
      });
      if (res.error) {
        throw new ApiException(toProblem(res.response, res.error));
      }
      if (res.data) {
        tokens.setAccess(res.data.accessToken);
        tokens.setRefresh(res.data.refreshToken);
        setUser(res.data.user);
        setStatus('authed');
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const refresh = tokens.getRefresh();
      await api.POST('/v1/auth/logout', {
        body: { refreshToken: refresh ?? undefined },
      });
    } catch {
      // Best effort logout
    } finally {
      tokens.clear();
      setUser(null);
      setStatus('anon');
      queryClient.clear();
    }
  }, [queryClient]);

  return {
    user,
    status,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
  };
}
