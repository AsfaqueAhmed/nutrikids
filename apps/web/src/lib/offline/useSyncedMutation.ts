import { useQueryClient } from '@tanstack/react-query';
import { API_URL, tokens } from '@/lib/api/auth';
import { ApiException, isNetworkError, toProblem } from '@/lib/api/errors';
import { enqueueOutbox } from './outbox';

export type SyncedMutationOptions<TBody> = {
  url: (b: TBody) => string;
  key: (b: TBody) => string;
  onOptimistic?: (b: TBody) => void;
  invalidate: unknown[][];
  toBody?: (b: TBody) => unknown;
};

export type SyncedMutationResult = {
  queued: boolean;
  superseded: boolean;
};

export function useSyncedMutation<TBody extends { clientUpdatedAt?: string }>(
  opts: SyncedMutationOptions<TBody>
) {
  const queryClient = useQueryClient();

  async function mutate(body: TBody): Promise<SyncedMutationResult> {
    opts.onOptimistic?.(body);

    const outboundBody = opts.toBody ? opts.toBody(body) : body;
    const clientUpdatedAt = body.clientUpdatedAt || new Date().toISOString();
    const endpoint = opts.url(body);
    const mutationKey = opts.key(body);

    // If browser is explicitly offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueOutbox({
        key: mutationKey,
        url: endpoint,
        method: 'PUT',
        body: outboundBody,
        clientUpdatedAt,
      });

      for (const queryKey of opts.invalidate) {
        await queryClient.invalidateQueries({ queryKey: queryKey as any });
      }

      return { queued: true, superseded: false };
    }

    try {
      const token = tokens.getAccess();
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

      const res = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(outboundBody),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new ApiException(toProblem(res, errorBody));
      }

      for (const queryKey of opts.invalidate) {
        await queryClient.invalidateQueries({ queryKey: queryKey as any });
      }

      const data = await res.json().catch(() => null);
      return {
        queued: false,
        superseded: Boolean(data?.superseded),
      };
    } catch (err: unknown) {
      if (isNetworkError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        await enqueueOutbox({
          key: mutationKey,
          url: endpoint,
          method: 'PUT',
          body: outboundBody,
          clientUpdatedAt,
        });

        for (const queryKey of opts.invalidate) {
          await queryClient.invalidateQueries({ queryKey: queryKey as any });
        }

        return { queued: true, superseded: false };
      }

      throw err;
    }
  }

  return { mutate };
}
