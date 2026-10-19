import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArticles, useArticle } from '@/features/learn/useArticles';
import { api } from '@/lib/api/client';
import { ApiException } from '@/lib/api/errors';

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

describe('useArticles & useArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches articles passing filters as query parameters', async () => {
    const mockPage = {
      items: [
        {
          id: 'art-1',
          slug: 'toddler-nutrition',
          title: 'Toddler Nutrition',
          summary: 'Overview of toddler diets.',
          category: 'Nutrition',
          kind: 'ARTICLE',
          minAgeMonths: 12,
          maxAgeMonths: 36,
          coverImageUrl: null,
          readingTimeMinutes: 4,
          publishedAt: '2026-01-01T00:00:00.000Z',
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

    const filters = { kind: 'ARTICLE' as const, ageMonths: 18, q: 'toddler' };
    const { result } = renderHook(() => useArticles(filters), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.GET).toHaveBeenCalledWith('/v1/articles', {
      params: {
        query: {
          kind: 'ARTICLE',
          ageMonths: 18,
          q: 'toddler',
        },
      },
    });
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('surfaces 404 ApiException when an article is not found', async () => {
    vi.mocked(api.GET).mockResolvedValueOnce({
      error: { code: 'NOT_FOUND', message: 'Article not found', statusCode: 404 },
      response: { status: 404, ok: false } as Response,
    } as unknown as Awaited<ReturnType<typeof api.GET>>);

    const { result } = renderHook(() => useArticle('non-existent-slug'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(ApiException);
    const apiError = result.current.error as ApiException;
    expect(apiError.problem.status).toBe(404);
  });
});
