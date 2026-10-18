'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ApiException, toProblem } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';

export type Child = components['schemas']['Child'];
export type CreateChildDto = components['schemas']['CreateChildDto'];

export function useChildren() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['children'],
    queryFn: async (): Promise<Child[]> => {
      const res = await api.GET('/v1/children');
      if (res.data) {
        return res.data;
      }
      if (res.error) {
        throw new ApiException(toProblem(res.response as Response, res.error));
      }
      return [];
    },
  });

  const createChildMutation = useMutation({
    mutationFn: async (dto: CreateChildDto): Promise<Child> => {
      const res = await api.POST('/v1/children', { body: dto });
      if (res.data) {
        return res.data as Child;
      }
      throw new ApiException(toProblem(res.response as Response, res.error));
    },
    onSuccess: (newChild) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      // If no active child in storage, set the new one
      if (typeof window !== 'undefined' && !localStorage.getItem('nk.activeChild')) {
        localStorage.setItem('nk.activeChild', newChild.id);
      }
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: Partial<CreateChildDto>;
    }): Promise<Child> => {
      const res = await api.PUT('/v1/children/{id}', {
        params: { path: { id } },
        body: dto,
      });
      if (res.data) {
        return res.data as Child;
      }
      throw new ApiException(toProblem(res.response as Response, res.error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await api.DELETE('/v1/children/{id}', {
        params: { path: { id } },
      });
      if (res.error) {
        throw new ApiException(toProblem(res.response as Response, res.error));
      }
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      if (typeof window !== 'undefined' && localStorage.getItem('nk.activeChild') === deletedId) {
        localStorage.removeItem('nk.activeChild');
      }
    },
  });

  return {
    children: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createChild: createChildMutation.mutateAsync,
    updateChild: updateChildMutation.mutateAsync,
    deleteChild: deleteChildMutation.mutateAsync,
    isCreating: createChildMutation.isPending,
    isUpdating: updateChildMutation.isPending,
  };
}
