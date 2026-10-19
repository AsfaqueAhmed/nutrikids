import { describe, expect, it } from 'vitest';
import { isNetworkError, toProblem } from '@/lib/api/errors';

describe('toProblem', () => {
  it('reads the API error shape', () => {
    const p = toProblem({ status: 409 } as Response, { code: 'ALLERGEN_BLOCKED', message: 'blocked', details: [1] });
    expect(p).toEqual({ status: 409, code: 'ALLERGEN_BLOCKED', message: 'blocked', details: [1] });
  });
  it('falls back for unknown bodies', () => {
    expect(toProblem({ status: 500 } as Response, 'oops')).toMatchObject({ status: 500, code: 'UNKNOWN' });
  });
});

describe('isNetworkError', () => {
  it('treats fetch TypeErrors as network errors', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });
});
