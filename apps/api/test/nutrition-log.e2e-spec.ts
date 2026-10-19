import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('nutrition logs', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  async function setup(email = 'parent@example.com') {
    const p = await registerAndLogin(app, email);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Rahim', dateOfBirth: '2024-03-01', gender: 'MALE' })
    ).body;
    const put = (id: string, body: object) =>
      http()
        .put(`/v1/children/${child.id}/nutrition-logs/${id}`)
        .set(auth)
        .send(body);
    return { auth, child, put };
  }

  const base = {
    date: '2025-06-10',
    slot: 'LUNCH',
    eatenStatus: 'FULL',
    clientUpdatedAt: '2025-06-10T10:00:00Z',
  };

  it('creates a log and is idempotent on retry', async () => {
    const { put, auth, child } = await setup();
    const id = randomUUID();
    const first = await put(id, base).expect(200);
    expect(first.body.data).toMatchObject({ id, slot: 'LUNCH', percent: null });
    expect(first.body.sync.superseded).toBe(false);
    await put(id, base).expect(200);
    const list = await http()
      .get(
        `/v1/children/${child.id}/nutrition-logs?from=2025-06-01&to=2025-06-30`,
      )
      .set(auth)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('requires percent exactly when the meal was partly eaten', async () => {
    const { put } = await setup();
    await put(randomUUID(), { ...base, eatenStatus: 'PARTIAL' }).expect(400);
    await put(randomUUID(), {
      ...base,
      eatenStatus: 'FULL',
      percent: 50,
    }).expect(400);
    const ok = await put(randomUUID(), {
      ...base,
      eatenStatus: 'PARTIAL',
      percent: 40,
    }).expect(200);
    expect(ok.body.data.percent).toBe(40);
  });

  it('keeps the newer write and flags the stale one as superseded', async () => {
    const { put } = await setup();
    const id = randomUUID();
    await put(id, { ...base, clientUpdatedAt: '2025-06-10T12:00:00Z' }).expect(
      200,
    );
    const stale = await put(id, {
      ...base,
      eatenStatus: 'SKIPPED',
      clientUpdatedAt: '2025-06-10T11:00:00Z',
    }).expect(200);
    expect(stale.body.sync.superseded).toBe(true);
    expect(stale.body.data.eatenStatus).toBe('FULL');
  });

  it('rejects a second log id for the same slot and a date before birth', async () => {
    const { put } = await setup();
    const first = randomUUID();
    await put(first, base).expect(200);
    const clash = await put(randomUUID(), base).expect(409);
    expect(clash.body.code).toBe('LOG_EXISTS');
    expect(clash.body.details.id).toBe(first);
    const early = await put(randomUUID(), {
      ...base,
      date: '2023-01-01',
    }).expect(400);
    expect(early.body.code).toBe('DATE_BEFORE_BIRTH');
  });

  it("returns 404 for another parent's child and 204 on delete", async () => {
    const a = await setup('a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    await http()
      .put(`/v1/children/${a.child.id}/nutrition-logs/${randomUUID()}`)
      .set({ Authorization: `Bearer ${b.token}` })
      .send(base)
      .expect(404);
    const id = randomUUID();
    await a.put(id, base).expect(200);
    await http()
      .delete(`/v1/children/${a.child.id}/nutrition-logs/${id}`)
      .set(a.auth)
      .expect(204);
  });

  it('summarises a range and rejects spans over 92 days', async () => {
    const { put, auth, child } = await setup();
    await put(randomUUID(), base).expect(200);
    await put(randomUUID(), {
      ...base,
      slot: 'DINNER',
      eatenStatus: 'PARTIAL',
      percent: 50,
    }).expect(200);
    const s = await http()
      .get(
        `/v1/children/${child.id}/nutrition-logs/summary?from=2025-06-01&to=2025-06-30`,
      )
      .set(auth)
      .expect(200);
    expect(s.body).toMatchObject({
      loggedCount: 2,
      fullCount: 1,
      partialCount: 1,
      eatenPercent: 75,
    });
    const big = await http()
      .get(
        `/v1/children/${child.id}/nutrition-logs/summary?from=2025-01-01&to=2025-12-31`,
      )
      .set(auth)
      .expect(400);
    expect(big.body.code).toBe('RANGE_TOO_LARGE');
  });
});
