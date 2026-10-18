import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './helpers';

describe('error shape', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  afterAll(() => app.close());

  it('returns {code,message} for an unknown route', async () => {
    const res = await request(app.getHttpServer() as App)
      .get('/v1/nope')
      .expect(404);
    const body = res.body as { code: string; message: unknown };
    expect(body).toMatchObject({ code: 'NOT_FOUND' });
    expect(typeof body.message).toBe('string');
  });
});
