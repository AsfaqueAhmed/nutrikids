import { INestApplication, ValidationPipe } from '@nestjs/common';
import { text } from 'express';
import { ApiExceptionFilter } from './common/api-exception.filter';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1');
  app.use(text({ type: 'text/csv', limit: '5mb' }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
