import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { AdminStats } from '@/lib/api/models';

export function useAdminStats(): UseQueryResult<AdminStats> {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.GET('/v1/admin/stats');
      return unwrap<AdminStats>(res);
    },
    staleTime: 60 * 1000,
  });
}
