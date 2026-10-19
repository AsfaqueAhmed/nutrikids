import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import { ArticleKind, ArticleSummary, ArticleDetail, Page } from '@/lib/api/models';

export type ArticleFilters = {
  kind?: ArticleKind;
  category?: string;
  ageMonths?: number;
  q?: string;
  page?: number;
  limit?: number;
};

export function useArticles(f: ArticleFilters = {}): UseQueryResult<Page<ArticleSummary>> {
  return useQuery({
    queryKey: ['articles', f],
    queryFn: async () => {
      const res = await api.GET('/v1/articles', {
        params: {
          query: {
            kind: f.kind,
            category: f.category,
            ageMonths: f.ageMonths,
            q: f.q,
          },
        },
      });
      return unwrap<Page<ArticleSummary>>(res);
    },
  });
}

export function useArticle(slug: string): UseQueryResult<ArticleDetail> {
  return useQuery({
    queryKey: ['article', slug],
    queryFn: async () => {
      const res = await api.GET('/v1/articles/{slug}', {
        params: {
          path: { slug },
        },
      });
      return unwrap<ArticleDetail>(res);
    },
  });
}
