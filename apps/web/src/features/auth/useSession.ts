'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { refreshSession, tokens } from '@/lib/api/auth';
import { unwrap } from '@/lib/api/unwrap';
import type { TokenPair, User } from '@/lib/api/models';

export type { User };
export type SessionStatus = 'loading' | 'authed' | 'anon';

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const queryClient = useQueryClient();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.GET('/v1/me');
      if (res.response.ok) {
        const me = unwrap<User>(res);
        setUser(me);
        setStatus('authed');
        return me;
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
      const pair = unwrap<TokenPair>(res);
      tokens.setAccess(pair.accessToken);
      tokens.setRefresh(pair.refreshToken);
      // the API returns tokens only; load the profile separately
      await fetchCurrentUser();
    },
    [fetchCurrentUser]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.POST('/v1/auth/register', {
        body: { email, password },
      });
      const pair = unwrap<TokenPair>(res);
      tokens.setAccess(pair.accessToken);
      tokens.setRefresh(pair.refreshToken);
      // the API returns tokens only; load the profile separately
      await fetchCurrentUser();
    },
    [fetchCurrentUser]
  );

  const logout = useCallback(async () => {
    try {
      const refresh = tokens.getRefresh();
      await api.POST('/v1/auth/logout', {
        body: { refreshToken: refresh ?? '' },
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
