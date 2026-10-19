import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { MealSlot, Recipe } from '@/lib/api/models';
import type { DietType } from '@/lib/api/domain';
import type { components } from '@/lib/api/schema';

export type CreateRecipeFoodInput = {
  foodId: string;
  quantityG: number;
};

export type CreateRecipeInput = {
  name: string;
  instructions: string;
  prepMinutes: number;
  ageMinMonths: number;
  ageMaxMonths: number;
  slots: MealSlot[];
  suitableDiets: DietType[];
  foods: CreateRecipeFoodInput[];
};

export type RecipeQueryParams = {
  slot?: MealSlot;
  maxAgeMonths?: number;
};

export function useRecipes(query?: RecipeQueryParams) {
  return useQuery({
    queryKey: ['admin-recipes', query],
    queryFn: async () => {
      const res = await apiClient.GET('/v1/recipes', {
        params: {
          query: {
            ...(query?.slot ? { slot: query.slot } : {}),
            ...(query?.maxAgeMonths !== undefined ? { maxAgeMonths: query.maxAgeMonths } : {}),
          },
        },
      });
      return unwrap(res) as unknown as Recipe[];
    },
    staleTime: 30_000,
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['admin-recipe', id],
    queryFn: async () => {
      const res = await apiClient.GET('/v1/recipes/{id}', {
        params: { path: { id } },
      });
      return unwrap(res) as unknown as Recipe;
    },
    enabled: Boolean(id),
  });
}

export function useRecipeMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateRecipeInput) => {
      const res = await apiClient.POST('/v1/recipes', {
        body: data as unknown as components['schemas']['RecipeDto'],
      });
      return unwrap(res) as unknown as Recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateRecipeInput }) => {
      const res = await apiClient.PATCH('/v1/recipes/{id}', {
        params: { path: { id } },
        body: data as unknown as components['schemas']['UpdateRecipeDto'],
      });
      return unwrap(res) as unknown as Recipe;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-recipe', vars.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.DELETE('/v1/recipes/{id}', {
        params: { path: { id } },
      });
      return unwrap(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recipes'] });
    },
  });

  return {
    createRecipe: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    updateRecipe: (id: string, data: CreateRecipeInput) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    deleteRecipe: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  };
}
