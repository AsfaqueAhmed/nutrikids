import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const nutrition = {
  calories: 61,
  protein: 3.2,
  carbs: 4.8,
  fat: 3.3,
  fiber: 0,
  iron: 0.03,
  calcium: 113,
  vitaminA: 46,
  vitaminC: 0,
  vitaminD: 1.3,
  zinc: 0.4,
};

describe('foods', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => (app = await createTestApp()));
  beforeEach(() => resetDb(app.get(PrismaService)));
  afterAll(() => app.close());

  it('lets only admins create foods', async () => {
    const parent = await registerAndLogin(app);
    await http()
      .post('/v1/foods')
      .set('Authorization', `Bearer ${parent.token}`)
      .send({ name: 'Milk', category: 'Dairy', allergens: ['MILK'], nutrition })
      .expect(403);
    const admin = await makeAdmin(app);
    await http()
      .post('/v1/foods')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Milk', category: 'Dairy', allergens: ['MILK'], nutrition })
      .expect(201);
  });

  it('rejects invalid nutrition', async () => {
    const admin = await makeAdmin(app);
    const res = await http()
      .post('/v1/foods')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Bad',
        category: 'X',
        nutrition: { ...nutrition, calories: 5000 },
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_NUTRITION');
  });

  it('searches, filters by category, and excludes allergens', async () => {
    const admin = await makeAdmin(app);
    const auth = { Authorization: `Bearer ${admin.token}` };
    await http()
      .post('/v1/foods')
      .set(auth)
      .send({
        name: 'Milk',
        category: 'Dairy',
        allergens: ['MILK'],
        nutrition,
      });
    await http()
      .post('/v1/foods')
      .set(auth)
      .send({ name: 'Rice', category: 'Grains', nutrition });
    const all = await http().get('/v1/foods').set(auth).expect(200);
    expect(all.body.total).toBe(2);
    const search = await http().get('/v1/foods?search=ric').set(auth);
    expect(search.body.items.map((f: any) => f.name)).toEqual(['Rice']);
    const safe = await http()
      .get('/v1/foods?excludeAllergens=MILK,EGG')
      .set(auth);
    expect(safe.body.items.map((f: any) => f.name)).toEqual(['Rice']);
    const cats = await http().get('/v1/foods/categories').set(auth);
    expect(cats.body).toEqual(['Dairy', 'Grains']);
  });
});
