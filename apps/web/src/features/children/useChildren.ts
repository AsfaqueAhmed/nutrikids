'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { components } from '@/lib/api/schema';
import type { Allergy, Child } from '@/lib/api/models';

export type { Child };
export type CreateChildDto = components['schemas']['CreateChildDto'];
export type UpdateChildDto = components['schemas']['UpdateChildDto'];

export function useChildren() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['children'] });

  const query = useQuery({
    queryKey: ['children'],
    queryFn: async (): Promise<Child[]> => unwrap<Child[]>(await api.GET('/v1/children')),
  });

  const createChildMutation = useMutation({
    mutationFn: async (dto: CreateChildDto): Promise<Child> =>
      unwrap<Child>(await api.POST('/v1/children', { body: dto })),
    onSuccess: (newChild) => {
      refresh();
      // If no active child in storage, set the new one
      if (typeof window !== 'undefined' && !localStorage.getItem('nk.activeChild')) {
        localStorage.setItem('nk.activeChild', newChild.id);
      }
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateChildDto }): Promise<Child> =>
      unwrap<Child>(await api.PATCH('/v1/children/{id}', { params: { path: { id } }, body: dto })),
    onSuccess: refresh,
  });

  /** Allergies and dislikes are separate "replace the list" endpoints on the backend. */
  const saveExtrasMutation = useMutation({
    mutationFn: async ({
      id,
      allergies,
      dislikeFoodIds,
    }: {
      id: string;
      allergies: Allergy[];
      dislikeFoodIds: string[];
    }): Promise<void> => {
      unwrap(
        await api.PUT('/v1/children/{id}/allergies', {
          params: { path: { id } },
          body: { items: allergies },
        }),
      );
      unwrap(
        await api.PUT('/v1/children/{id}/dislikes', {
          params: { path: { id } },
          body: { foodIds: dislikeFoodIds },
        }),
      );
    },
    onSuccess: refresh,
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await api.DELETE('/v1/children/{id}', { params: { path: { id } } }));
    },
    onSuccess: (_, deletedId) => {
      refresh();
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
    saveExtras: saveExtrasMutation.mutateAsync,
    deleteChild: deleteChildMutation.mutateAsync,
    isCreating: createChildMutation.isPending,
    isUpdating: updateChildMutation.isPending,
  };
}
