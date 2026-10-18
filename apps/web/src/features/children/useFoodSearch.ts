'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { Food, FoodPage } from '@/lib/api/models';

/** Searches the food catalogue by name (used to pick disliked foods by id). */
export function useFoodSearch(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ['foods', term],
    enabled: term.length >= 2,
    queryFn: async (): Promise<Food[]> =>
      unwrap<FoodPage>(
        await api.GET('/v1/foods', { params: { query: { search: term, pageSize: 8 } } }),
      ).items,
  });
}

/** Resolves food ids (as stored on a child) to names for display. */
export function useFoodsByIds(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['food', id],
      queryFn: async (): Promise<Food> =>
        unwrap<Food>(await api.GET('/v1/foods/{id}', { params: { path: { id } } })),
    })),
  });
  return {
    foods: results.flatMap((r) => (r.data ? [r.data] : [])),
    isLoading: results.some((r) => r.isLoading),
  };
}
