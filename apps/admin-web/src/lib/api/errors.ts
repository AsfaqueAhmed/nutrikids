export type ApiProblem = { status: number; code: string; message: string; details?: unknown };

export function toProblem(res: Pick<Response, 'status'>, body: unknown): ApiProblem {
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    const b = body as { code: string; message: string; details?: unknown };
    return { status: res.status, code: b.code, message: b.message, details: b.details };
  }
  return { status: res.status, code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}

export const isNetworkError = (e: unknown): boolean => e instanceof TypeError;

export class ApiException extends Error {
  constructor(public readonly problem: ApiProblem) {
    super(problem.message);
    this.name = 'ApiException';
  }
}
