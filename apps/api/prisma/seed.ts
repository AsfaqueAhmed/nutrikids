import { Allergen, DietType, MealSlot, PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateNutrition } from '../src/food/nutrition';

const defaultDir = resolve(__dirname, '../../../data/seed');
const read = (dir: string, f: string) =>
  JSON.parse(readFileSync(resolve(dir, f), 'utf8'));

export async function seedAll(prisma: PrismaClient, dataDir = defaultDir) {
  const foods = existsSync(resolve(dataDir, 'foods.json'))
    ? read(dataDir, 'foods.json').foods
    : [];
  for (const f of foods) {
    const data = {
      category: f.category,
      allergens: (f.allergens ?? []) as Allergen[],
      nutrition: validateNutrition(f.nutrition) as object,
      ageMinMonths: f.ageMinMonths ?? 0,
      ageMaxMonths: f.ageMaxMonths ?? 144,
    };
    await prisma.food.upsert({
      where: { name: f.name },
      create: { name: f.name, ...data },
      update: data,
    });
  }

  const recipes = existsSync(resolve(dataDir, 'recipes.json'))
    ? read(dataDir, 'recipes.json').recipes
    : [];
  for (const r of recipes) {
    const foodRows = await prisma.food.findMany({
      where: { name: { in: r.foods.map((x: any) => x.food) } },
    });
    const byName = new Map(foodRows.map((x) => [x.name, x.id]));
    const missing = r.foods.filter((x: any) => !byName.has(x.food));
    if (missing.length)
      throw new Error(
        `Recipe "${r.name}" uses unknown foods: ${missing.map((m: any) => m.food).join(', ')}`,
      );
    const base = {
      instructions: r.instructions,
      prepMinutes: r.prepMinutes,
      ageMinMonths: r.ageMinMonths,
      ageMaxMonths: r.ageMaxMonths,
      slots: r.slots as MealSlot[],
      suitableDiets: r.suitableDiets as DietType[],
    };
    const links = r.foods.map((x: any) => ({
      foodId: byName.get(x.food)!,
      quantityG: x.quantityG,
    }));
    await prisma.recipe.upsert({
      where: { name: r.name },
      create: { name: r.name, ...base, foods: { create: links } },
      update: { ...base, foods: { deleteMany: {}, create: links } },
    });
  }

  let vaccines = 0;
  let doses = 0;
  if (existsSync(resolve(dataDir, 'vaccines.bd.json'))) {
    const v = read(dataDir, 'vaccines.bd.json');
    for (const x of v.vaccines) {
      const { schedule, ...rest } = x;
      const data = {
        ...rest,
        priceUpdatedAt: rest.priceUpdatedAt
          ? new Date(rest.priceUpdatedAt)
          : null,
        verified: !!v.verified,
      };
      const saved = await prisma.vaccine.upsert({
        where: { code: x.code },
        create: data,
        update: data,
      });
      vaccines++;
      for (const d of schedule) {
        await prisma.vaccineScheduleItem.upsert({
          where: {
            vaccineId_doseNumber: {
              vaccineId: saved.id,
              doseNumber: d.doseNumber,
            },
          },
          create: { vaccineId: saved.id, ...d },
          update: d,
        });
        doses++;
      }
    }
  }
  return { foods: foods.length, recipes: recipes.length, vaccines, doses };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAll(prisma)
    .then((r) => console.log('seeded', r))
    .finally(() => prisma.$disconnect());
}
