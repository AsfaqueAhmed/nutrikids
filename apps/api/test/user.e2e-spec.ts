import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('user', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('returns and updates the profile', async () => {
    const { token } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set(auth)
      .expect(200);
    expect(me.body).toMatchObject({
      email: 'parent@example.com',
      role: 'PARENT',
      emailVerified: false,
      timezone: 'Asia/Dhaka',
    });
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set(auth)
      .send({ timezone: 'Asia/Kolkata' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/v1/me')
      .set(auth)
      .send({ timezone: 'Mars/Base' })
      .expect(400);
  });

  it('exports and deletes all user data', async () => {
    const { token, userId } = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${token}` };
    const exp = await request(app.getHttpServer())
      .get('/v1/me/export')
      .set(auth)
      .expect(200);
    expect(exp.body.user.id).toBe(userId);
    await request(app.getHttpServer()).delete('/v1/me').set(auth).expect(204);
    expect(await app.get(PrismaService).user.count()).toBe(0);
  });
});
