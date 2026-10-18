import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('children', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  const newChild = (token: string, body: object = {}) =>
    http()
      .post('/v1/children')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Amina',
        dateOfBirth: '2024-06-15',
        gender: 'FEMALE',
        weightKg: 9.5,
        ...body,
      });

  it('creates a child with computed age and lists only own children', async () => {
    const a = await registerAndLogin(app, 'a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    const created = await newChild(a.token).expect(201);
    expect(created.body.ageMonths).toBeGreaterThanOrEqual(0);
    expect(created.body.dateOfBirth).toBe('2024-06-15');
    await newChild(b.token, { name: 'Other' }).expect(201);
    const list = await http()
      .get('/v1/children')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(list.body.map((c: any) => c.name)).toEqual(['Amina']);
  });

  it("returns 404 for another parent's child", async () => {
    const a = await registerAndLogin(app, 'a@example.com');
    const b = await registerAndLogin(app, 'b@example.com');
    const child = (await newChild(a.token)).body;
    await http()
      .get(`/v1/children/${child.id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .expect(404);
    await http()
      .delete(`/v1/children/${child.id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .expect(404);
  });

  it('rejects a future date of birth and an unknown gender', async () => {
    const a = await registerAndLogin(app);
    await newChild(a.token, { dateOfBirth: '2999-01-01' }).expect(400);
    await newChild(a.token, { gender: 'ROBOT' }).expect(400);
  });

  it('replaces allergies, conditions and dislikes', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const prisma = app.get(PrismaService);
    const food = await prisma.food.create({
      data: {
        name: 'Egg',
        category: 'Protein',
        allergens: ['EGG'],
        nutrition: {},
      },
    });

    await http()
      .put(`/v1/children/${child.id}/allergies`)
      .set(auth)
      .send({
        items: [
          { allergen: 'EGG', severity: 'SEVERE' },
          { allergen: 'MILK', severity: 'MILD' },
        ],
      })
      .expect(200);
    await http()
      .put(`/v1/children/${child.id}/allergies`)
      .set(auth)
      .send({ items: [{ allergen: 'EGG', severity: 'MODERATE' }] })
      .expect(200);
    const got = await http().get(`/v1/children/${child.id}`).set(auth);
    expect(got.body.allergies).toEqual([
      { allergen: 'EGG', severity: 'MODERATE' },
    ]);

    await http()
      .put(`/v1/children/${child.id}/conditions`)
      .set(auth)
      .send({ names: ['lactose intolerance'] })
      .expect(200);
    await http()
      .put(`/v1/children/${child.id}/dislikes`)
      .set(auth)
      .send({ foodIds: [food.id] })
      .expect(200);
    await http()
      .put(`/v1/children/${child.id}/dislikes`)
      .set(auth)
      .send({ foodIds: [randomUUID()] })
      .expect(400);
    const again = await http().get(`/v1/children/${child.id}`).set(auth);
    expect(again.body.conditions).toEqual(['lactose intolerance']);
    expect(again.body.dislikes).toEqual([food.id]);
  });

  it('applies feeding logs idempotently with last-write-wins', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const id = randomUUID();
    const url = `/v1/children/${child.id}/feeding-logs/${id}`;
    const body = (notes: string, ts: string) => ({
      type: 'BREAST',
      at: '2026-03-01T08:00:00Z',
      durationMinutes: 15,
      notes,
      clientUpdatedAt: ts,
    });

    const first = await http()
      .put(url)
      .set(auth)
      .send(body('first', '2026-03-01T09:00:00Z'))
      .expect(200);
    expect(first.body.sync.superseded).toBe(false);
    await http()
      .put(url)
      .set(auth)
      .send(body('first', '2026-03-01T09:00:00Z'))
      .expect(200); // replay
    const newer = await http()
      .put(url)
      .set(auth)
      .send(body('newer', '2026-03-01T10:00:00Z'))
      .expect(200);
    expect(newer.body.data.notes).toBe('newer');
    const older = await http()
      .put(url)
      .set(auth)
      .send(body('stale', '2026-03-01T09:30:00Z'))
      .expect(200);
    expect(older.body.sync.superseded).toBe(true);
    expect(older.body.data.notes).toBe('newer');
    const list = await http()
      .get(`/v1/children/${child.id}/feeding-logs`)
      .set(auth);
    expect(list.body).toHaveLength(1);
  });

  it('records food introductions once per food', async () => {
    const a = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${a.token}` };
    const child = (await newChild(a.token)).body;
    const food = await app.get(PrismaService).food.create({
      data: { name: 'Banana', category: 'Fruit', nutrition: {} },
    });
    const id = randomUUID();
    await http()
      .put(`/v1/children/${child.id}/food-introductions/${id}`)
      .set(auth)
      .send({
        foodId: food.id,
        introducedOn: '2026-02-01',
        reaction: 'none',
        clientUpdatedAt: '2026-02-01T10:00:00Z',
      })
      .expect(200);
    const list = await http()
      .get(`/v1/children/${child.id}/food-introductions`)
      .set(auth);
    expect(list.body).toHaveLength(1);
  });
});
