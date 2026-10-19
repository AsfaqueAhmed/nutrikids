import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { AdminUser, Page } from '@/lib/api/models';

export type UserFilters = {
  q?: string;
  role?: 'PARENT' | 'NUTRITIONIST' | 'ADMIN';
  disabled?: boolean;
  page?: number;
  limit?: number;
};

export function useAdminUsers(filters: UserFilters = {}): UseQueryResult<Page<AdminUser>> {
  return useQuery({
    queryKey: ['admin-users', filters],
    queryFn: async () => {
      const res = await api.GET('/v1/admin/users', {
        params: {
          query: {
            q: filters.q,
            role: filters.role,
            disabled: filters.disabled,
          },
        },
      });
      return unwrap<Page<AdminUser>>(res);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      id,
      disabled,
      role,
    }: {
      id: string;
      disabled?: boolean;
      role?: 'PARENT' | 'NUTRITIONIST' | 'ADMIN';
    }) => {
      const res = await api.PATCH('/v1/admin/users/{id}', {
        params: { path: { id } },
        body: { disabled, role },
      });
      return unwrap<AdminUser>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
