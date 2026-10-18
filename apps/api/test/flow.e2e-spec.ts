import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { seedAll } from '../prisma/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('core flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  it('register -> child -> allergy -> plan -> no severe allergen -> vaccine given', async () => {
    await resetDb(prisma);
    await seedAll(prisma); // uses data/seed
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Amina', dateOfBirth: '2023-01-10', gender: 'FEMALE' })
        .expect(201)
    ).body;
    await http()
      .put(`/v1/children/${child.id}/allergies`)
      .set(auth)
      .send({
        items: [
          { allergen: 'EGG', severity: 'SEVERE' },
          { allergen: 'MILK', severity: 'SEVERE' },
        ],
      })
      .expect(200);

    const gen = await http()
      .post(`/v1/children/${child.id}/meal-plans/generate`)
      .set(auth)
      .send({ startDate: '2026-04-01', endDate: '2026-04-07', type: 'WEEKLY' })
      .expect(201);
    expect(gen.body.entries.length).toBeGreaterThan(0);

    const plan = await http()
      .get(`/v1/children/${child.id}/meal-plans?from=2026-04-01&to=2026-04-07`)
      .set(auth)
      .expect(200);
    for (const e of plan.body) {
      expect(e.recipe.allergens).not.toContain('EGG');
      expect(e.recipe.allergens).not.toContain('MILK');
      expect(e.allergyStatus).toBe('OK');
    }

    for (
      let i = 0;
      i < 20 &&
      (await prisma.childVaccination.count({
        where: { childId: child.id },
      })) === 0;
      i++
    )
      await new Promise((r) => setTimeout(r, 50));
    const vaccs = await http()
      .get(`/v1/children/${child.id}/vaccinations`)
      .set(auth)
      .expect(200);
    if (vaccs.body.length) {
      const first = vaccs.body[0];
      const done = await http()
        .put(`/v1/children/${child.id}/vaccinations/${first.id}`)
        .set(auth)
        .send({
          givenDate: '2023-02-01',
          facilityName: 'Clinic',
          clientUpdatedAt: '2023-02-01T10:00:00Z',
        })
        .expect(200);
      expect(['GIVEN', 'GIVEN_LATE']).toContain(done.body.data.status);
    }

    const grocery = await http()
      .get(
        `/v1/children/${child.id}/grocery-list?from=2026-04-01&to=2026-04-07`,
      )
      .set(auth)
      .expect(200);
    expect(grocery.body.lines.length).toBeGreaterThan(0);
  });
});
