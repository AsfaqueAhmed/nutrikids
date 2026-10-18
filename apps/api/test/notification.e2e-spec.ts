import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { NotificationService } from '../src/notification/notification.service';
import { MemoryPushSender, PushSender } from '../src/notification/push-sender';
import { ReminderJob } from '../src/notification/reminder.job';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, registerAndLogin, resetDb } from './helpers';

describe('notifications', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let push: MemoryPushSender;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    push = new MemoryPushSender();
    app = await createTestApp((b) =>
      b
        .overrideProvider(PushSender)
        .useValue(push)
        .overrideProvider(ReminderJob)
        .useValue({ tick: async () => {} }),
    );
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await resetDb(prisma);
    push.sent = [];
    push.gone.clear();
  });
  afterAll(() => app.close());

  async function setup() {
    const p = await registerAndLogin(app);
    const auth = { Authorization: `Bearer ${p.token}` };
    const child = (
      await http()
        .post('/v1/children')
        .set(auth)
        .send({ name: 'Amina', dateOfBirth: '2022-01-10', gender: 'FEMALE' })
    ).body;
    await http()
      .post('/v1/notifications/subscriptions')
      .set(auth)
      .send({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'k', auth: 'a' },
      })
      .expect(204);
    return { auth, child, userId: p.userId };
  }

  it('sends a lunch reminder at the local time, with an allergen warning', async () => {
    const { auth, child } = await setup();
    await http()
      .put(`/v1/children/${child.id}/allergies`)
      .set(auth)
      .send({ items: [{ allergen: 'EGG', severity: 'MILD' }] });
    const egg = await prisma.food.create({
      data: { name: 'Egg', category: 'P', allergens: ['EGG'], nutrition: {} },
    });
    const recipe = await prisma.recipe.create({
      data: {
        name: 'Egg rice',
        instructions: 'x',
        prepMinutes: 5,
        slots: ['LUNCH'],
        suitableDiets: ['NON_VEGETARIAN'],
        foods: { create: [{ foodId: egg.id, quantityG: 50 }] },
      },
    });
    await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2026-04-01',
        slot: 'LUNCH',
        recipeId: recipe.id,
        confirmAllergen: true,
        clientUpdatedAt: '2026-04-01T00:00:00Z',
      })
      .expect(200);
    await http()
      .put(`/v1/children/${child.id}/meal-reminders/LUNCH`)
      .set(auth)
      .send({ timeOfDay: '13:00', enabled: true })
      .expect(200);

    const svc = app.get(NotificationService);
    expect(await svc.runMealReminders(new Date('2026-04-01T06:59:00Z'))).toBe(
      0,
    ); // 12:59 in Dhaka
    expect(await svc.runMealReminders(new Date('2026-04-01T07:00:10Z'))).toBe(
      1,
    ); // 13:00 in Dhaka
    expect(push.sent[0].payload.title).toBe('Lunch for Amina');
    expect(push.sent[0].payload.body).toBe('Egg rice. Contains egg.');
  });

  it('sends nothing when the type is disabled', async () => {
    const { auth, child } = await setup();
    const food = await prisma.food.create({
      data: { name: 'Rice', category: 'G', nutrition: {} },
    });
    const recipe = await prisma.recipe.create({
      data: {
        name: 'Plain rice',
        instructions: 'x',
        prepMinutes: 5,
        slots: ['LUNCH'],
        suitableDiets: ['NON_VEGETARIAN'],
        foods: { create: [{ foodId: food.id, quantityG: 50 }] },
      },
    });
    await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2026-04-01',
        slot: 'LUNCH',
        recipeId: recipe.id,
        clientUpdatedAt: '2026-04-01T00:00:00Z',
      })
      .expect(200);
    await http()
      .put(`/v1/children/${child.id}/meal-reminders/LUNCH`)
      .set(auth)
      .send({ timeOfDay: '13:00', enabled: true });
    await http()
      .put('/v1/notifications/preferences/DAILY_PLAN')
      .set(auth)
      .send({ enabled: false })
      .expect(200);
    expect(
      await app
        .get(NotificationService)
        .runMealReminders(new Date('2026-04-01T07:00:10Z')),
    ).toBe(0);
  });

  it('removes subscriptions the push service reports as gone', async () => {
    const { auth, child } = await setup();
    const food = await prisma.food.create({
      data: { name: 'Rice', category: 'G', nutrition: {} },
    });
    const recipe = await prisma.recipe.create({
      data: {
        name: 'Plain rice',
        instructions: 'x',
        prepMinutes: 5,
        slots: ['LUNCH'],
        suitableDiets: ['NON_VEGETARIAN'],
        foods: { create: [{ foodId: food.id, quantityG: 50 }] },
      },
    });
    await http()
      .put(`/v1/children/${child.id}/meal-entries/${randomUUID()}`)
      .set(auth)
      .send({
        date: '2026-04-01',
        slot: 'LUNCH',
        recipeId: recipe.id,
        clientUpdatedAt: '2026-04-01T00:00:00Z',
      });
    await http()
      .put(`/v1/children/${child.id}/meal-reminders/LUNCH`)
      .set(auth)
      .send({ timeOfDay: '13:00', enabled: true });
    push.gone.add('https://push.example/1');
    await app
      .get(NotificationService)
      .runMealReminders(new Date('2026-04-01T07:00:10Z'));
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('sends vaccine reminders for due doses at the default 09:00 local time', async () => {
    const { child } = await setup();
    const v = await prisma.vaccine.create({
      data: {
        code: 'BCG',
        name: 'BCG',
        disease: 'TB',
        description: 'd',
        availability: 'GOVERNMENT_FREE',
        sourceNote: 't',
        schedule: {
          create: [
            {
              doseNumber: 1,
              suggestedAgeDays: 0,
              minAgeDays: 0,
              maxAgeDays: 365,
            },
          ],
        },
      },
      include: { schedule: true },
    });
    await prisma.childVaccination.create({
      data: {
        childId: child.id,
        scheduleItemId: v.schedule[0].id,
        dueDate: new Date('2022-01-10'),
      },
    });
    const svc = app.get(NotificationService);
    expect(
      await svc.runVaccineReminders(new Date('2026-04-01T02:00:00Z')),
    ).toBe(0); // 08:00 Dhaka
    expect(
      await svc.runVaccineReminders(new Date('2026-04-01T03:00:10Z')),
    ).toBe(1); // 09:00 Dhaka
    expect(push.sent[0].payload.body).toContain('free, government programme');
  });

  it("validates reminder times and hides other parents' children", async () => {
    const { auth, child } = await setup();
    await http()
      .put(`/v1/children/${child.id}/meal-reminders/LUNCH`)
      .set(auth)
      .send({ timeOfDay: '25:61', enabled: true })
      .expect(400);
    const other = await registerAndLogin(app, 'other@example.com');
    await http()
      .put(`/v1/children/${child.id}/meal-reminders/LUNCH`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ timeOfDay: '13:00', enabled: true })
      .expect(404);
  });
});
