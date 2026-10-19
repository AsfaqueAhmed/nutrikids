import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useImportHospitals } from './useImportHospitals';

const globalFetch = vi.fn();
global.fetch = globalFetch;

vi.mock('@/lib/api/auth', () => ({
  API_URL: 'http://localhost:3000',
  tokens: {
    getAccess: vi.fn().mockReturnValue('mock-admin-token'),
  },
  refreshSession: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
}

describe('useImportHospitals hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts raw CSV text with Content-Type: text/csv and bearer auth', async () => {
    const mockResponse = {
      imported: 5,
      updated: 2,
      errors: [{ line: 3, message: 'Invalid latitude' }],
    };

    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useImportHospitals(), {
      wrapper: createWrapper(),
    });

    const csvText = 'name,type,address,district,lat,lng,phone,services,source\nHosp,Type,Addr,Dist,23.8,90.4,,,OSM';
    const data = await result.current.importHospitals(csvText);

    expect(data).toEqual(mockResponse);
    expect(globalFetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/admin/hospitals/import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'text/csv',
          Authorization: 'Bearer mock-admin-token',
        }),
        body: csvText,
      })
    );
  });
});
