import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as
        { code?: string; message?: string | string[] } | string;
      if (typeof body === 'object' && 'code' in body) {
        return res.status(status).json(body);
      }
      const raw = typeof body === 'string' ? body : body.message;
      const messages = Array.isArray(raw) ? raw : undefined;
      return res.status(status).json({
        code:
          status === 400
            ? 'VALIDATION_FAILED'
            : status === 404
              ? 'NOT_FOUND'
              : 'HTTP_ERROR',
        message: messages
          ? 'Validation failed'
          : typeof raw === 'string'
            ? raw
            : exception.message,
        details: messages,
      });
    }
    this.log.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    return res
      .status(500)
      .json({ code: 'INTERNAL', message: 'Internal server error' });
  }
}
