import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useAdminArticles,
  useAdminArticle,
  useArticleMutations,
} from './useAdminArticles';
import { apiClient } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAdminArticles hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches admin articles page with status and kind filters', async () => {
    const mockPage = {
      items: [
        {
          id: 'art-1',
          kind: 'ARTICLE',
          slug: 'first-foods',
          title: 'First Foods',
          summary: 'Guide to starting solids',
          category: 'Nutrition',
          status: 'PUBLISHED',
        },
      ],
      total: 1,
      page: 1,
      limit: 15,
    };

    vi.mocked(apiClient.GET).mockResolvedValueOnce({
      data: mockPage,
      error: undefined,
      response: new Response(),
    } as any);

    const { result } = renderHook(
      () => useAdminArticles({ status: 'PUBLISHED', page: 1, limit: 15 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPage);
    expect(apiClient.GET).toHaveBeenCalledWith(
      '/v1/admin/articles',
      expect.objectContaining({
        params: {
          query: expect.objectContaining({ status: 'PUBLISHED', page: 1, limit: 15 }),
        },
      })
    );
  });

  it('handles create, update and delete mutations', async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { id: 'art-new', slug: 'new-article' },
      error: undefined,
      response: new Response(),
    } as any);

    vi.mocked(apiClient.PATCH).mockResolvedValueOnce({
      data: { id: 'art-new', status: 'PUBLISHED' },
      error: undefined,
      response: new Response(),
    } as any);

    vi.mocked(apiClient.DELETE).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(),
    } as any);

    const { result } = renderHook(() => useArticleMutations(), { wrapper: createWrapper() });

    const created = await result.current.createArticle({
      kind: 'ARTICLE',
      title: 'New Article',
      slug: 'new-article',
      summary: 'Summary text',
      body: '# Heading',
      category: 'Nutrition',
    });

    expect(created.id).toBe('art-new');
    expect(apiClient.POST).toHaveBeenCalledWith(
      '/v1/admin/articles',
      expect.objectContaining({
        body: expect.objectContaining({ slug: 'new-article' }),
      })
    );

    await result.current.updateArticle('art-new', { status: 'PUBLISHED' });
    expect(apiClient.PATCH).toHaveBeenCalledWith(
      '/v1/admin/articles/{id}',
      expect.objectContaining({
        params: { path: { id: 'art-new' } },
        body: { status: 'PUBLISHED' },
      })
    );

    await result.current.deleteArticle('art-new');
    expect(apiClient.DELETE).toHaveBeenCalledWith(
      '/v1/admin/articles/{id}',
      expect.objectContaining({
        params: { path: { id: 'art-new' } },
      })
    );
  });
});
