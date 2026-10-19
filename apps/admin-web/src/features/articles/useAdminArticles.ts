import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type {
  ArticleDetail,
  ArticleKind,
  ArticleStatus,
  ArticleSummary,
  Page,
} from '@/lib/api/models';

export type CreateArticleInput = {
  kind?: ArticleKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
  coverUrl?: string | null;
  status?: ArticleStatus;
};

export type UpdateArticleInput = Partial<CreateArticleInput>;

export type AdminArticleFilters = {
  status?: ArticleStatus;
  kind?: ArticleKind;
  page?: number;
  limit?: number;
};

export function useAdminArticles(filters?: AdminArticleFilters) {
  return useQuery({
    queryKey: ['admin-articles', filters],
    queryFn: async () => {
      const res = await apiClient.GET('/v1/admin/articles', {
        params: {
          query: {
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.kind ? { kind: filters.kind } : {}),
            page: filters?.page ?? 1,
            limit: filters?.limit ?? 15,
          },
        },
      });
      return unwrap(res) as unknown as Page<ArticleSummary>;
    },
    staleTime: 30_000,
  });
}

export function useAdminArticle(id: string) {
  return useQuery({
    queryKey: ['admin-article', id],
    queryFn: async () => {
      const res = await apiClient.GET('/v1/admin/articles/{id}', {
        params: { path: { id } },
      });
      return unwrap(res) as unknown as ArticleDetail;
    },
    enabled: Boolean(id),
  });
}

export function useArticleMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateArticleInput) => {
      const res = await apiClient.POST('/v1/admin/articles', {
        body: data as any,
      });
      return unwrap(res) as unknown as ArticleDetail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateArticleInput }) => {
      const res = await apiClient.PATCH('/v1/admin/articles/{id}', {
        params: { path: { id } },
        body: data as any,
      });
      return unwrap(res) as unknown as ArticleDetail;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-article', vars.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.DELETE('/v1/admin/articles/{id}', {
        params: { path: { id } },
      });
      return unwrap(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
    },
  });

  return {
    createArticle: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    updateArticle: (id: string, data: UpdateArticleInput) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    deleteArticle: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  };
}
