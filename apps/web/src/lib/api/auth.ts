const REFRESH_KEY = 'nk.refresh';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (t: string | null) => {
    accessToken = t;
  },
  getRefresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  setRefresh: (t: string | null) => {
    if (typeof window === 'undefined') return;
    if (t) localStorage.setItem(REFRESH_KEY, t);
    else localStorage.removeItem(REFRESH_KEY);
  },
  clear() {
    accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REFRESH_KEY);
    }
  },
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Exchanges the refresh token once; concurrent callers share the same attempt. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = tokens.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokens.clear();
        return false;
      }
      const body = await res.json();
      tokens.setAccess(body.accessToken);
      tokens.setRefresh(body.refreshToken);
      return true;
    } catch {
      return false; // offline: keep the refresh token, try again later
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
