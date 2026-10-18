import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const notFound = (what = 'Resource') =>
  new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const unauthorized = (code = 'UNAUTHORIZED') =>
  new ApiError(401, code, 'Authentication required');
export const forbidden = (code = 'FORBIDDEN') =>
  new ApiError(403, code, 'Not allowed');
export const conflict = (code: string, message: string, details?: unknown) =>
  new ApiError(409, code, message, details);
