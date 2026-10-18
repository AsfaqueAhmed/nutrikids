import createClient, { Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { API_URL, refreshSession, tokens } from './auth';

const auth: Middleware = {
  onRequest({ request }) {
    const t = tokens.getAccess();
    if (t) {
      request.headers.set('Authorization', `Bearer ${t}`);
    }
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.headers.get('x-retried')) {
      return response;
    }
    try {
      const url = new URL(request.url);
      if (url.pathname.includes('/auth/')) {
        return response;
      }
    } catch {
      // Relative URL or invalid
    }
    if (!(await refreshSession())) {
      return response;
    }
    const retry = new Request(request, { headers: new Headers(request.headers) });
    const access = tokens.getAccess();
    if (access) {
      retry.headers.set('Authorization', `Bearer ${access}`);
    }
    retry.headers.set('x-retried', '1');
    return fetch(retry);
  },
};

export const api = createClient<paths>({ baseUrl: API_URL });
api.use(auth);
