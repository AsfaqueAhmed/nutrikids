'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { refreshSession, tokens } from '@/lib/api/auth';
import { unwrap } from '@/lib/api/unwrap';
import { ApiException } from '@/lib/api/errors';
import type { TokenPair, User } from '@/lib/api/models';
import { copy } from '@/lib/copy';

export type SessionStatus = 'loading' | 'authed' | 'anon';

export type AdminSession = {
  status: SessionStatus;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

export function useAdminSession(): AdminSession {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const queryClient = useQueryClient();

  const fetchCurrentAdmin = useCallback(async () => {
    try {
      const res = await api.GET('/v1/me');
      if (res.response.ok) {
        const me = unwrap<User>(res);
        if (me.role !== 'ADMIN') {
          tokens.clear();
          setUser(null);
          setStatus('anon');
          throw new ApiException({
            status: 403,
            code: 'FORBIDDEN',
            message: copy.login.notAdmin,
          });
        }
        setUser(me);
        setStatus('authed');
        return me;
      }
      tokens.clear();
      setUser(null);
      setStatus('anon');
      return null;
    } catch (e) {
      tokens.clear();
      setUser(null);
      setStatus('anon');
      throw e;
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
    try {
      await fetchCurrentAdmin();
    } catch {
      // Ignored on init
    }
  }, [fetchCurrentAdmin]);

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

      await fetchCurrentAdmin();
    },
    [fetchCurrentAdmin]
  );

  const logout = useCallback(async () => {
    const refreshToken = tokens.getRefresh();
    try {
      if (refreshToken) {
        await api.POST('/v1/auth/logout', {
          body: { refreshToken },
        });
      }
    } catch {
      // ignore network errors on logout
    } finally {
      tokens.clear();
      setUser(null);
      setStatus('anon');
      queryClient.clear();
    }
  }, [queryClient]);

  return {
    status,
    user,
    login,
    logout,
  };
}
