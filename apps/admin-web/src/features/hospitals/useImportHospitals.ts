'use client';

import { useState } from 'react';
import { API_URL, refreshSession, tokens } from '@/lib/api/auth';

export type ImportHospitalsResult = {
  imported: number;
  updated: number;
  errors: { line: number; message: string }[];
};

export function useImportHospitals() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const importHospitals = async (csvText: string): Promise<ImportHospitalsResult> => {
    setIsPending(true);
    setError(null);
    try {
      const token = tokens.getAccess();
      let res = await fetch(`${API_URL}/v1/admin/hospitals/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: csvText,
      });

      if (res.status === 401) {
        const refreshed = await refreshSession();
        if (refreshed) {
          const newToken = tokens.getAccess();
          res = await fetch(`${API_URL}/v1/admin/hospitals/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/csv',
              ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
            },
            body: csvText,
          });
        }
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Import failed with status ${res.status}`);
      }

      return (await res.json()) as ImportHospitalsResult;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Import failed');
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return {
    importHospitals,
    isPending,
    error,
  };
}
