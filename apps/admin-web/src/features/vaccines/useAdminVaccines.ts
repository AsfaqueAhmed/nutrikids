import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';
import type { AdminVaccine } from '@/lib/api/models';
import type { components } from '@/lib/api/schema';

export type UpdateVaccineInput = {
  name?: string;
  disease?: string;
  description?: string;
  availability?: 'GOVERNMENT_FREE' | 'PRIVATE_PAID' | 'BOTH';
  isMandatory?: boolean;
  priceMinBdt?: number | null;
  priceMaxBdt?: number | null;
  priceNote?: string | null;
  sourceNote?: string;
  verified?: boolean;
};

export type UpdateScheduleItemInput = {
  suggestedAgeDays?: number;
  minAgeDays?: number;
  maxAgeDays?: number | null;
  intervalFromPreviousDays?: number | null;
  notes?: string | null;
};

export function useAdminVaccines() {
  return useQuery({
    queryKey: ['admin-vaccines'],
    queryFn: async () => {
      const res = await apiClient.GET('/v1/admin/vaccines');
      return unwrap(res) as unknown as AdminVaccine[];
    },
    staleTime: 60_000,
  });
}

export function useAdminVaccine(id: string) {
  const { data: vaccines, ...rest } = useAdminVaccines();
  const vaccine = vaccines?.find((v) => v.id === id);
  return { data: vaccine, ...rest };
}

export function useUpdateVaccine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateVaccineInput }) => {
      const res = await apiClient.PATCH('/v1/admin/vaccines/{id}', {
        params: { path: { id } },
        body: data as unknown as components['schemas']['UpdateVaccineDto'],
      });
      return unwrap(res) as unknown as AdminVaccine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vaccines'] });
    },
  });
}

export function useUpdateScheduleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateScheduleItemInput }) => {
      const res = await apiClient.PATCH('/v1/admin/vaccine-schedule-items/{id}', {
        params: { path: { id } },
        body: data as unknown as components['schemas']['UpdateScheduleItemDto'],
      });
      return unwrap(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vaccines'] });
    },
  });
}
