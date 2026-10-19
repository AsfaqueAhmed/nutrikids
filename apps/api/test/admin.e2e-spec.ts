import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('admin', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('forbids parents', async () => {
    const p = await registerAndLogin(app);
    await http().get('/v1/admin/stats').set(bearer(p.token)).expect(403);
    await http().get('/v1/admin/users').set(bearer(p.token)).expect(403);
  });

  it('reports aggregate stats with a zero-filled 30-day signup series', async () => {
    const admin = await makeAdmin(app);
    const p = await registerAndLogin(app, 'p@example.com');
    await http()
      .post('/v1/children')
      .set(bearer(p.token))
      .send({ name: 'Rahim', dateOfBirth: '2024-03-01', gender: 'MALE' })
      .expect(201);
    const res = await http().get('/v1/admin/stats').set(bearer(admin.token)).expect(200);
    expect(res.body).toMatchObject({ totalUsers: 2, totalChildren: 1, disabledUsers: 0 });
    expect(res.body.signupsByDay).toHaveLength(30);
    const today = res.body.signupsByDay.at(-1);
    expect(today.count).toBe(2);
    expect(JSON.stringify(res.body)).not.toContain('Rahim');
  });

  it('lists and filters users', async () => {
    const admin = await makeAdmin(app);
    await registerAndLogin(app, 'alice@example.com');
    await registerAndLogin(app, 'bob@example.com');
    const all = await http().get('/v1/admin/users').set(bearer(admin.token)).expect(200);
    expect(all.body.total).toBe(3);
    const q = await http().get('/v1/admin/users?q=ALI').set(bearer(admin.token)).expect(200);
    expect(q.body.items.map((u: { email: string }) => u.email)).toEqual(['alice@example.com']);
    const admins = await http().get('/v1/admin/users?role=ADMIN').set(bearer(admin.token)).expect(200);
    expect(admins.body.total).toBe(1);
  });

  it('disables a user: no login, no refresh, and can be re-enabled', async () => {
    const admin = await makeAdmin(app);
    const reg = await http()
      .post('/v1/auth/register')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(201);
    const { refreshToken } = reg.body as { refreshToken: string };
    const list = await http().get('/v1/admin/users?q=kid').set(bearer(admin.token));
    const id = list.body.items[0].id as string;

    const off = await http()
      .patch(`/v1/admin/users/${id}`)
      .set(bearer(admin.token))
      .send({ disabled: true })
      .expect(200);
    expect(off.body.disabled).toBe(true);

    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(403);
    expect(login.body.code).toBe('ACCOUNT_DISABLED');
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);

    await http()
      .patch(`/v1/admin/users/${id}`)
      .set(bearer(admin.token))
      .send({ disabled: false })
      .expect(200);
    await http()
      .post('/v1/auth/login')
      .send({ email: 'kid@example.com', password: 'password123' })
      .expect(200);
  });

  it('changes roles but never lets an admin modify themselves', async () => {
    const admin = await makeAdmin(app);
    const me = await http().get('/v1/me').set(bearer(admin.token));
    const self = await http()
      .patch(`/v1/admin/users/${me.body.id}`)
      .set(bearer(admin.token))
      .send({ disabled: true })
      .expect(400);
    expect(self.body.code).toBe('CANNOT_MODIFY_SELF');
    await registerAndLogin(app, 'p@example.com');
    const list = await http().get('/v1/admin/users?q=p@').set(bearer(admin.token));
    const up = await http()
      .patch(`/v1/admin/users/${list.body.items[0].id}`)
      .set(bearer(admin.token))
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(up.body.role).toBe('ADMIN');
  });
});
