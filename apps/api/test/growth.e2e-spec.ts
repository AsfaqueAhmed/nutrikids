import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('growth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  async function setup() {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Rahim', dateOfBirth: '2025-03-01', gender: 'MALE' })
    ).body;
    return { auth, child };
  }

  it('computes percentiles for a record (median weight at birth is ~50th)', async () => {
    const { auth, child } = await setup();
    const res = await http()
      .put(`/v1/children/${child.id}/growth-records/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2025-03-01',
        weightKg: 3.3464,
        heightCm: 49.9,
        clientUpdatedAt: '2025-03-01T10:00:00Z',
      })
      .expect(200);
    // weight is stored to 2 decimals (3.35 kg), so allow a small offset from the exact median
    expect(res.body.measures.weight.percentile).toBeCloseTo(50, 0);
    expect(res.body.provisional).toBe(true);
    expect(res.body.measures.bmi).toBeDefined();
  });

  it('rejects empty records and dates before birth', async () => {
    const { auth, child } = await setup();
    const put = (b: object) =>
      http()
        .put(`/v1/children/${child.id}/growth-records/${randomUUID()}`)
        .set(auth)
        .send(b);
    await put({
      date: '2025-04-01',
      clientUpdatedAt: '2025-04-01T00:00:00Z',
    }).expect(400);
    await put({
      date: '2024-01-01',
      weightKg: 3,
      clientUpdatedAt: '2025-04-01T00:00:00Z',
    }).expect(400);
  });

  it('returns chart points and WHO reference curves', async () => {
    const { auth, child } = await setup();
    await http()
      .put(`/v1/children/${child.id}/growth-records/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2025-09-01',
        weightKg: 7.5,
        heightCm: 67,
        clientUpdatedAt: '2025-09-01T10:00:00Z',
      })
      .expect(200);
    const chart = await http()
      .get(`/v1/children/${child.id}/growth/chart`)
      .set(auth)
      .expect(200);
    expect(chart.body.points).toHaveLength(1);
    expect(chart.body.reference.WFA.p50[0].ageMonths).toBe(0);
    expect(chart.body.reference.WFA.p3[10].value).toBeLessThan(
      chart.body.reference.WFA.p97[10].value,
    );
  });

  it('exports a PDF', async () => {
    const { auth, child } = await setup();
    await http()
      .put(`/v1/children/${child.id}/growth-records/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2025-09-01',
        weightKg: 7.5,
        heightCm: 67,
        clientUpdatedAt: '2025-09-01T10:00:00Z',
      });
    const res = await http()
      .get(`/v1/children/${child.id}/growth/export.pdf`)
      .set(auth)
      .buffer()
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it("hides another parent's child", async () => {
    const { child } = await setup();
    const other = await registerAndLogin(app, 'other@example.com');
    await http()
      .get(`/v1/children/${child.id}/growth/chart`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
  });
});
