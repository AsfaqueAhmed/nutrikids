import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ApiException } from '@/lib/api/errors';
import { unwrap } from '@/lib/api/unwrap';
import { useSyncedMutation } from '@/lib/offline/useSyncedMutation';
import type { EatenStatus, MealSlot, NutritionLog, NutritionSummary } from '@/lib/api/models';

export function useNutritionLogs(childId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['nutrition-logs', childId, from, to],
    queryFn: async () => {
      const res = await api.GET('/v1/children/{childId}/nutrition-logs', {
        params: {
          path: { childId },
          query: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        },
      });
      return unwrap<NutritionLog[]>(res);
    },
    enabled: Boolean(childId),
  });
}

export function useNutritionSummary(childId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['nutrition-summary', childId, from, to],
    queryFn: async () => {
      const res = await api.GET('/v1/children/{childId}/nutrition-logs/summary', {
        params: {
          path: { childId },
          query: { from, to },
        },
      });
      return unwrap<NutritionSummary>(res);
    },
    enabled: Boolean(childId && from && to),
  });
}

export type LogInput = {
  id?: string;
  date: string;
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent?: number;
  notes?: string;
};

export function useLogMeal(childId: string) {
  const queryClient = useQueryClient();

  const sync = useSyncedMutation<{ id: string } & LogInput & { clientUpdatedAt: string }>({
    url: (b) => `/v1/children/${childId}/nutrition-logs/${b.id}`,
    key: (b) => `/v1/children/${childId}/nutrition-logs/${b.id}`,
    toBody: ({ id, ...rest }) => rest,
    invalidate: [
      ['nutrition-logs', childId],
      ['nutrition-summary', childId],
    ],
  });

  async function log(input: LogInput) {
    if ((input.eatenStatus === 'PARTIAL') !== (input.percent !== undefined)) {
      throw new Error('INVALID_PERCENT');
    }

    const body = {
      ...input,
      id: input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'temp-id'),
      clientUpdatedAt: new Date().toISOString(),
    };

    try {
      return await sync.mutate(body);
    } catch (e: unknown) {
      if (e instanceof ApiException && e.problem.code === 'LOG_EXISTS') {
        const id = (e.problem.details as { id: string })?.id;
        if (id) {
          return await sync.mutate({ ...body, id });
        }
      }
      throw e;
    }
  }

  async function clear(logId: string) {
    const res = await api.DELETE('/v1/children/{childId}/nutrition-logs/{logId}', {
      params: { path: { childId, logId } },
    });
    unwrap(res);
    await queryClient.invalidateQueries({ queryKey: ['nutrition-logs', childId] });
    await queryClient.invalidateQueries({ queryKey: ['nutrition-summary', childId] });
  }

  return { log, clear };
}
