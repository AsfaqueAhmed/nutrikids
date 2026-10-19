import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { Food, FoodPage } from '@/lib/api/models';
import type { Allergen } from '@/lib/api/domain';

export type FoodFilters = {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
};

export type CreateFoodInput = {
  name: string;
  category: string;
  allergens?: Allergen[];
  nutrition: {
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    [key: string]: number;
  };
  ageMinMonths?: number;
  ageMaxMonths?: number;
};

export function useFoods(filters: FoodFilters = {}): UseQueryResult<FoodPage> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;

  return useQuery({
    queryKey: ['foods', { ...filters, page, pageSize }],
    queryFn: async () => {
      const res = await api.GET('/v1/foods', {
        params: {
          query: {
            search: filters.search,
            category: filters.category,
            page,
            pageSize,
          },
        },
      });
      return unwrap<FoodPage>(res);
    },
  });
}

export function useFood(id: string): UseQueryResult<Food> {
  return useQuery({
    queryKey: ['food', id],
    queryFn: async () => {
      const res = await api.GET('/v1/foods/{id}', {
        params: { path: { id } },
      });
      return unwrap<Food>(res);
    },
    enabled: Boolean(id),
  });
}

export function useFoodCategories(): UseQueryResult<string[]> {
  return useQuery({
    queryKey: ['food-categories'],
    queryFn: async () => {
      const res = await api.GET('/v1/foods/categories');
      return unwrap<string[]>(res);
    },
  });
}

export function useFoodMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateFoodInput) => {
      const res = await api.POST('/v1/foods', {
        body: data,
      });
      return unwrap<Food>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.invalidateQueries({ queryKey: ['food-categories'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateFoodInput> }) => {
      const res = await api.PATCH('/v1/foods/{id}', {
        params: { path: { id } },
        body: data,
      });
      return unwrap<Food>(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.invalidateQueries({ queryKey: ['food', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['food-categories'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.DELETE('/v1/foods/{id}', {
        params: { path: { id } },
      });
      unwrap<void>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
      queryClient.invalidateQueries({ queryKey: ['food-categories'] });
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isPending:
      createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  };
}
