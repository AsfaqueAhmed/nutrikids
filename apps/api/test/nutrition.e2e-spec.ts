import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('nutrition score', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  it('scores a day from the planned meals and marks it provisional', async () => {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Amina', dateOfBirth: '2022-01-10', gender: 'FEMALE' })
    ).body;
    const food = await prisma.food.create({
      data: {
        name: 'Super food',
        category: 'Test',
        nutrition: {
          calories: 100,
          protein: 20,
          carbs: 10,
          fat: 5,
          fiber: 30,
          iron: 10,
          calcium: 1000,
          vitaminA: 500,
          vitaminC: 50,
          vitaminD: 20,
          zinc: 10,
        },
      },
    });
    const recipe = await prisma.recipe.create({
      data: {
        name: 'Test meal',
        instructions: 'x',
        prepMinutes: 5,
        ageMinMonths: 12,
        slots: ['LUNCH'],
        suitableDiets: ['NON_VEGETARIAN'],
        foods: { create: [{ foodId: food.id, quantityG: 100 }] },
      },
    });
    await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2026-04-01',
        slot: 'LUNCH',
        recipeId: recipe.id,
        portion: 1,
        clientUpdatedAt: '2026-04-01T08:00:00Z',
      })
      .expect(200);
    const res = await http()
      .get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-01`)
      .set(auth)
      .expect(200);
    expect(res.body).toMatchObject({
      applicable: true,
      provisional: true,
      mealsPlanned: 1,
      scorePercent: 100,
    });
    const empty = await http()
      .get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-02`)
      .set(auth);
    expect(empty.body.scorePercent).toBe(0);
  });

  it('is not applicable for infants under 12 months', async () => {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Baby', dateOfBirth: '2026-01-10', gender: 'MALE' })
    ).body;
    const res = await http()
      .get(`/v1/children/${child.id}/nutrition/daily?date=2026-04-01`)
      .set(auth)
      .expect(200);
    expect(res.body).toMatchObject({ applicable: false, scorePercent: null });
  });
});
