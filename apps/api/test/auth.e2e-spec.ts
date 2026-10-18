import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IdentityVerifier } from '../src/auth/identity-verifier';
import { MailService, MemoryMailService } from '../src/auth/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

@Controller('probe')
class ProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('auth', () => {
  let app: INestApplication;
  let mail: MemoryMailService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    mail = new MemoryMailService();
    app = await createTestApp(
      (b) =>
        b
          .overrideProvider(MailService)
          .useValue(mail)
          .overrideProvider(IdentityVerifier)
          .useValue({
            verify: async () => ({
              sub: 'g-1',
              email: 'social@example.com',
              emailVerified: true,
            }),
          }),
      [ProbeController],
    );
  });
  beforeEach(async () => {
    await resetDb(app.get(PrismaService));
    mail.outbox = [];
  });
  afterAll(() => app.close());

  const register = (email = 'p@example.com') =>
    http()
      .post('/v1/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

  it('registers, logs in, and protects routes', async () => {
    const { body } = await register();
    expect(body.accessToken).toBeDefined();
    await http()
      .post('/v1/auth/login')
      .send({ email: 'p@example.com', password: 'password123' })
      .expect(200);
    await http()
      .post('/v1/auth/login')
      .send({ email: 'p@example.com', password: 'wrongwrong' })
      .expect(401);
    await http().get('/v1/probe').expect(401);
    await http()
      .get('/v1/probe')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
  });

  it('rejects a duplicate email', async () => {
    await register();
    const res = await http()
      .post('/v1/auth/register')
      .send({ email: 'P@example.com', password: 'password123' })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const { body: first } = await register();
    const { body: second } = await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    const reuse = await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
  });

  it('verifies email with the mailed token', async () => {
    await register();
    const token = mail.outbox[0].text.split(': ')[1];
    await http().post('/v1/auth/verify-email').send({ token }).expect(204);
    await http().post('/v1/auth/verify-email').send({ token }).expect(400);
  });

  it('resets a password and invalidates old refresh tokens', async () => {
    const { body } = await register();
    mail.outbox = [];
    await http()
      .post('/v1/auth/forgot-password')
      .send({ email: 'p@example.com' })
      .expect(204);
    const token = mail.outbox[0].text.split(': ')[1];
    await http()
      .post('/v1/auth/reset-password')
      .send({ token, password: 'newpassword1' })
      .expect(204);
    await http()
      .post('/v1/auth/login')
      .send({ email: 'p@example.com', password: 'newpassword1' })
      .expect(200);
    await http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(401);
  });

  it('does not reveal unknown emails on forgot-password', async () => {
    await http()
      .post('/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' })
      .expect(204);
    expect(mail.outbox).toHaveLength(0);
  });

  it('signs in with a verified social identity', async () => {
    const res = await http()
      .post('/v1/auth/social')
      .send({ provider: 'google', idToken: 'x' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
