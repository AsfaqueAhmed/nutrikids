import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeAdmin, registerAndLogin, resetDb } from './helpers';

const nutrition = {
  calories: 100,
  protein: 5,
  carbs: 15,
  fat: 2,
  fiber: 1,
  iron: 1,
  calcium: 50,
  vitaminA: 10,
  vitaminC: 5,
  vitaminD: 0,
  zinc: 1,
};

describe('meals', () => {
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
    const rice = await prisma.food.create({
      data: { name: 'Rice', category: 'Grains', nutrition },
    });
    const egg = await prisma.food.create({
      data: { name: 'Egg', category: 'Protein', allergens: ['EGG'], nutrition },
    });
    const dal = await prisma.food.create({
      data: { name: 'Dal', category: 'Pulses', nutrition },
    });
    const mk = (name: string, foods: { id: string }[]) =>
      prisma.recipe.create({
        data: {
          name,
          instructions: 'Cook.',
          prepMinutes: 15,
          ageMinMonths: 12,
          slots: ['LUNCH', 'DINNER'],
          suitableDiets: ['NON_VEGETARIAN', 'VEGETARIAN'],
          foods: {
            create: foods.map((f) => ({ foodId: f.id, quantityG: 100 })),
          },
        },
      });
    return {
      rice,
      egg,
      dal,
      riceDal: await mk('Rice and dal', [rice, dal]),
      eggRice: await mk('Egg rice', [egg, rice]),
    };
  }

  async function parentWithChild(allergies: object[] = []) {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Amina', dateOfBirth: '2023-01-10', gender: 'FEMALE' })
    ).body;
    if (allergies.length)
      await http()
        .put(`/v1/children/${child.id}/allergies`)
        .set(auth)
        .send({ items: allergies });
    return { auth, child };
  }

  it("generates a plan that never contains a recipe with the child's allergen", async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([
      { allergen: 'EGG', severity: 'MILD' },
    ]);
    const res = await http()
      .post(`/v1/children/${child.id}/meal-plans/generate`)
      .set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-07', type: 'WEEKLY' })
      .expect(201);
    expect(res.body.entries.length).toBeGreaterThan(0);
    expect(
      res.body.entries.every((e: any) => e.recipeId === s.riceDal.id),
    ).toBe(true);
  });

  it('rejects a window that does not match the plan type', async () => {
    await seed();
    const { auth, child } = await parentWithChild();
    await http()
      .post(`/v1/children/${child.id}/meal-plans/generate`)
      .set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-05', type: 'DAILY' })
      .expect(400);
  });

  it('blocks a severe allergen on manual add, even with confirmation', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([
      { allergen: 'EGG', severity: 'SEVERE' },
    ]);
    const res = await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2026-04-01',
        slot: 'LUNCH',
        recipeId: s.eggRice.id,
        confirmAllergen: true,
        clientUpdatedAt: '2026-04-01T08:00:00Z',
      })
      .expect(409);
    expect(res.body.code).toBe('ALLERGEN_BLOCKED');
  });

  it('requires confirmation for a mild allergen, then accepts it', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild([
      { allergen: 'EGG', severity: 'MILD' },
    ]);
    const id = randomUUID();
    const url = `/v1/children/${child.id}/meal-entries/${id}`;
    const body = {
      date: '2026-04-01',
      slot: 'LUNCH',
      recipeId: s.eggRice.id,
      clientUpdatedAt: '2026-04-01T08:00:00Z',
    };
    const first = await http().put(url).set(auth).send(body).expect(409);
    expect(first.body.code).toBe('ALLERGEN_CONFIRM_REQUIRED');
    const ok = await http()
      .put(url)
      .set(auth)
      .send({ ...body, confirmAllergen: true })
      .expect(200);
    expect(ok.body.warnings).toHaveLength(1);
  });

  it('applies last-write-wins to entries and keeps one entry per slot', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild();
    const id = randomUUID();
    const url = `/v1/children/${child.id}/meal-entries/${id}`;
    const body = (recipeId: string, ts: string) => ({
      date: '2026-04-01',
      slot: 'LUNCH',
      recipeId,
      clientUpdatedAt: ts,
    });
    await http()
      .put(url)
      .set(auth)
      .send(body(s.riceDal.id, '2026-04-01T10:00:00Z'))
      .expect(200);
    const stale = await http()
      .put(url)
      .set(auth)
      .send(body(s.eggRice.id, '2026-04-01T09:00:00Z'))
      .expect(200);
    expect(stale.body.sync.superseded).toBe(true);
    expect(stale.body.data.recipeId).toBe(s.riceDal.id);
    await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send(body(s.riceDal.id, '2026-04-01T11:00:00Z'))
      .expect(409); // slot taken by another entry
  });

  it('builds an aggregated grocery list and remembers check-offs', async () => {
    const s = await seed();
    const { auth, child } = await parentWithChild();
    for (const [d, r] of [
      ['2026-04-01', s.riceDal.id],
      ['2026-04-02', s.riceDal.id],
    ]) {
      await http()
        .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
        .set(auth)
        .send({
          date: d,
          slot: 'LUNCH',
          recipeId: r,
          portion: 1,
          clientUpdatedAt: '2026-04-01T08:00:00Z',
        })
        .expect(200);
    }
    const list = await http()
      .get(
        `/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`,
      )
      .set(auth)
      .expect(200);
    expect(list.body.lines).toEqual([
      expect.objectContaining({ foodName: 'Dal', totalG: 200, checked: false }),
      expect.objectContaining({
        foodName: 'Rice',
        totalG: 200,
        checked: false,
      }),
    ]);
    await http()
      .put(`/v1/children/${child.id}/grocery-list/checks`)
      .set(auth)
      .send({
        weekStart: '2026-04-01',
        foodId: s.rice.id,
        checked: true,
        clientUpdatedAt: '2026-04-01T09:00:00Z',
      })
      .expect(200);
    const again = await http()
      .get(
        `/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`,
      )
      .set(auth);
    expect(
      again.body.lines.find((l: any) => l.foodName === 'Rice').checked,
    ).toBe(true);
  });

  it('lets admins manage recipes and returns per-serving nutrition', async () => {
    const s = await seed();
    const admin = await makeAdmin(app);
    const res = await http()
      .get(`/v1/recipes/${s.riceDal.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(res.body.nutrition.calories).toBeCloseTo(200);
    expect(res.body.allergens).toEqual([]);
    const egg = await http()
      .get(`/v1/recipes/${s.eggRice.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(egg.body.allergens).toEqual(['EGG']);
  });
});
