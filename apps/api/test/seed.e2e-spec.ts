import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { seedAll } from '../prisma/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb } from './helpers';

const nutrition = {
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
  iron: 0.2,
  calcium: 10,
  vitaminA: 0,
  vitaminC: 0,
  vitaminD: 0,
  zinc: 0.5,
};

describe('seed', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  function dir() {
    const d = mkdtempSync(join(tmpdir(), 'seed-'));
    writeFileSync(
      join(d, 'foods.json'),
      JSON.stringify({
        foods: [
          { name: 'Rice', category: 'Grains', nutrition },
          { name: 'Egg', category: 'Protein', allergens: ['EGG'], nutrition },
        ],
      }),
    );
    writeFileSync(
      join(d, 'recipes.json'),
      JSON.stringify({
        recipes: [
          {
            name: 'Egg rice',
            instructions: 'x',
            prepMinutes: 10,
            ageMinMonths: 12,
            ageMaxMonths: 144,
            slots: ['LUNCH'],
            suitableDiets: ['NON_VEGETARIAN'],
            foods: [
              { food: 'Rice', quantityG: 100 },
              { food: 'Egg', quantityG: 50 },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(d, 'vaccines.bd.json'),
      JSON.stringify({
        verified: false,
        vaccines: [
          {
            code: 'BCG',
            name: 'BCG',
            disease: 'TB',
            description: 'd',
            availability: 'GOVERNMENT_FREE',
            isMandatory: true,
            sourceNote: 's',
            schedule: [
              {
                doseNumber: 1,
                suggestedAgeDays: 0,
                minAgeDays: 0,
                maxAgeDays: 365,
              },
            ],
          },
        ],
      }),
    );
    return d;
  }

  it('loads data and is idempotent', async () => {
    const d = dir();
    expect(await seedAll(prisma, d)).toEqual({
      foods: 2,
      recipes: 1,
      vaccines: 1,
      doses: 1,
    });
    await seedAll(prisma, d);
    expect(await prisma.food.count()).toBe(2);
    expect(await prisma.recipe.count()).toBe(1);
    expect(await prisma.vaccineScheduleItem.count()).toBe(1);
    expect(
      (await prisma.vaccine.findUniqueOrThrow({ where: { code: 'BCG' } }))
        .verified,
    ).toBe(false);
  });

  it('fails clearly when a recipe references an unknown food', async () => {
    const d = dir();
    writeFileSync(join(d, 'foods.json'), JSON.stringify({ foods: [] }));
    await expect(seedAll(prisma, d)).rejects.toThrow(/unknown foods/);
  });

  it('rejects invalid nutrition in the data files', async () => {
    const d = dir();
    writeFileSync(
      join(d, 'foods.json'),
      JSON.stringify({
        foods: [
          {
            name: 'Bad',
            category: 'X',
            nutrition: { ...nutrition, calories: 9999 },
          },
        ],
      }),
    );
    await expect(seedAll(prisma, d)).rejects.toThrow();
  });
});
