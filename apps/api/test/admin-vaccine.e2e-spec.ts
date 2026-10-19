import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

describe('admin vaccines', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  async function seed() {
    const v = await prisma.vaccine.create({
      data: {
        code: 'BCG',
        name: 'BCG',
        disease: 'Tuberculosis',
        description: 'At birth',
        availability: 'GOVERNMENT_FREE',
        sourceNote: 'EPI schedule',
        schedule: {
          create: [{ doseNumber: 1, suggestedAgeDays: 0, minAgeDays: 0, maxAgeDays: 365 }],
        },
      },
      include: { schedule: true },
    });
    const admin = await makeAdmin(app);
    return { v, a: { Authorization: `Bearer ${admin.token}` } };
  }

  it('lists vaccines with their schedule and forbids parents', async () => {
    const { a } = await seed();
    const list = await http().get('/v1/admin/vaccines').set(a).expect(200);
    expect(list.body[0]).toMatchObject({ code: 'BCG', verified: false });
    expect(list.body[0].schedule).toHaveLength(1);
    const p = await registerAndLogin(app, 'p@example.com');
    await http()
      .get('/v1/admin/vaccines')
      .set({ Authorization: `Bearer ${p.token}` })
      .expect(403);
  });

  it('updates fields, stamps the price date and validates the price range', async () => {
    const { v, a } = await seed();
    const ok = await http()
      .patch(`/v1/admin/vaccines/${v.id}`)
      .set(a)
      .send({ verified: true, priceMinBdt: 300, priceMaxBdt: 500 })
      .expect(200);
    expect(ok.body.verified).toBe(true);
    expect(ok.body.priceUpdatedAt).not.toBeNull();
    const bad = await http()
      .patch(`/v1/admin/vaccines/${v.id}`)
      .set(a)
      .send({ priceMinBdt: 900 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_PRICE_RANGE');
    await http().patch('/v1/admin/vaccines/00000000-0000-4000-8000-000000000000').set(a).send({}).expect(404);
  });

  it('updates a schedule item and validates the age window', async () => {
    const { v, a } = await seed();
    const item = v.schedule[0];
    const ok = await http()
      .patch(`/v1/admin/vaccine-schedule-items/${item.id}`)
      .set(a)
      .send({ suggestedAgeDays: 14, maxAgeDays: null, notes: 'Within 2 weeks' })
      .expect(200);
    expect(ok.body).toMatchObject({ suggestedAgeDays: 14, maxAgeDays: null });
    const bad = await http()
      .patch(`/v1/admin/vaccine-schedule-items/${item.id}`)
      .set(a)
      .send({ minAgeDays: 30 })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AGE_WINDOW');
  });
});
