import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MealSlot, PlanType, Prisma } from '@prisma/client';
import { ageInMonths } from '../common/age';
import { ApiError, conflict, notFound } from '../common/api-error';
import { resolveLww } from '../common/lww';
import { ChildAccessService } from '../child/child-access.service';
import { NutritionPer100g } from '../food/nutrition';
import { PrismaService } from '../prisma/prisma.service';
import { assertAllergySafe, evaluateAllergens } from './allergy';
import { buildGroceryList } from './grocery';
import { datesBetween, generatePlan } from './plan-generator';
import { portionForAge, recipeNutrition } from './recipe-nutrition';

const ALL_SLOTS: MealSlot[] = [
  'BREAKFAST',
  'LUNCH',
  'MORNING_SNACK',
  'AFTERNOON_SNACK',
  'DINNER',
];
const MAX_DAYS: Record<PlanType, number> = { DAILY: 1, WEEKLY: 7, CUSTOM: 31 };
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const recipeInclude = {
  foods: { include: { food: true } },
} satisfies Prisma.RecipeInclude;
export type RecipeWithFoods = Prisma.RecipeGetPayload<{
  include: typeof recipeInclude;
}>;

export function recipeView(r: RecipeWithFoods, portion = 1) {
  return {
    id: r.id,
    name: r.name,
    instructions: r.instructions,
    prepMinutes: r.prepMinutes,
    ageMinMonths: r.ageMinMonths,
    ageMaxMonths: r.ageMaxMonths,
    slots: r.slots,
    suitableDiets: r.suitableDiets,
    foods: r.foods.map((f) => ({
      foodId: f.foodId,
      name: f.food.name,
      quantityG: Number(f.quantityG),
    })),
    allergens: [...new Set(r.foods.flatMap((f) => f.food.allergens))].sort(),
    nutrition: recipeNutrition(
      r.foods.map((f) => ({
        quantityG: Number(f.quantityG),
        nutrition: f.food.nutrition as NutritionPer100g,
      })),
      portion,
    ),
  };
}

@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  async generate(
    userId: string,
    childId: string,
    dto: { startDate: string; endDate: string; type: PlanType },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const dates = datesBetween(dto.startDate, dto.endDate);
    if (
      dates.length === 0 ||
      dates.length > MAX_DAYS[dto.type] ||
      (dto.type !== 'CUSTOM' && dates.length !== MAX_DAYS[dto.type])
    ) {
      throw new ApiError(
        400,
        'INVALID_PLAN_WINDOW',
        `A ${dto.type} plan must cover ${dto.type === 'DAILY' ? '1 day' : dto.type === 'WEEKLY' ? '7 days' : 'at most 31 days'}`,
      );
    }
    const [allergies, dislikes, recipes, existing] = await Promise.all([
      this.prisma.childAllergy.findMany({ where: { childId } }),
      this.prisma.foodDislike.findMany({ where: { childId } }),
      this.prisma.recipe.findMany({ include: recipeInclude }),
      this.prisma.mealPlanEntry.findMany({
        where: {
          childId,
          date: { gte: day(dto.startDate), lte: day(dto.endDate) },
        },
      }),
    ]);
    const ageMonths = ageInMonths(child.dateOfBirth);
    const generated = generatePlan({
      dates,
      slots: ALL_SLOTS,
      ageMonths,
      dietType: child.dietType,
      allergies: allergies.map((a) => a.allergen),
      dislikedFoodIds: dislikes.map((d) => d.foodId),
      recipes: recipes.map((r) => ({
        id: r.id,
        name: r.name,
        slots: r.slots,
        suitableDiets: r.suitableDiets,
        ageMinMonths: r.ageMinMonths,
        ageMaxMonths: r.ageMaxMonths,
        foodIds: r.foods.map((f) => f.foodId),
        allergens: [...new Set(r.foods.flatMap((f) => f.food.allergens))],
      })),
      occupied: new Set(existing.map((e) => `${iso(e.date)}|${e.slot}`)),
      varietyWindowDays: 3,
    });
    const portion = portionForAge(ageMonths);
    const now = new Date();
    const entries = await this.prisma.$transaction(
      generated.map((g) =>
        this.prisma.mealPlanEntry.create({
          data: {
            id: randomUUID(),
            childId,
            date: day(g.date),
            slot: g.slot,
            recipeId: g.recipeId,
            portion,
            createdBy: 'SYSTEM',
            clientUpdatedAt: now,
          },
        }),
      ),
    );
    return {
      entries: entries.map((e) => ({
        ...e,
        date: iso(e.date),
        portion: Number(e.portion),
      })),
    };
  }

  async list(
    userId: string,
    childId: string,
    q: { from?: string; to?: string; updatedSince?: string },
  ) {
    await this.access.assertOwned(userId, childId);
    const [allergies, rows] = await Promise.all([
      this.prisma.childAllergy.findMany({ where: { childId } }),
      this.prisma.mealPlanEntry.findMany({
        where: {
          childId,
          ...(q.from || q.to
            ? {
                date: {
                  ...(q.from ? { gte: day(q.from) } : {}),
                  ...(q.to ? { lte: day(q.to) } : {}),
                },
              }
            : {}),
          ...(q.updatedSince
            ? { updatedAt: { gt: new Date(q.updatedSince) } }
            : {}),
        },
        include: { recipe: { include: recipeInclude } },
        orderBy: [{ date: 'asc' }, { slot: 'asc' }],
      }),
    ]);
    return rows.map((e) => {
      const foods = e.recipe.foods.map((f) => ({
        id: f.foodId,
        name: f.food.name,
        allergens: f.food.allergens,
      }));
      return {
        id: e.id,
        date: iso(e.date),
        slot: e.slot,
        portion: Number(e.portion),
        createdBy: e.createdBy,
        clientUpdatedAt: e.clientUpdatedAt,
        allergyStatus: evaluateAllergens(allergies, foods).status,
        recipe: recipeView(e.recipe, Number(e.portion)),
      };
    });
  }

  async putEntry(
    userId: string,
    childId: string,
    entryId: string,
    dto: {
      date: string;
      slot: MealSlot;
      recipeId: string;
      portion?: number;
      confirmAllergen?: boolean;
      clientUpdatedAt: string;
    },
  ) {
    const child = await this.access.assertOwned(userId, childId);
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: dto.recipeId },
      include: recipeInclude,
    });
    if (!recipe) throw notFound('Recipe');
    const existing = await this.prisma.mealPlanEntry.findUnique({
      where: { id: entryId },
    });
    if (existing && existing.childId !== childId)
      throw conflict('ID_IN_USE', 'This id belongs to another record');
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    if (!apply) return { data: existing, sync: { superseded }, warnings: [] };

    const allergies = await this.prisma.childAllergy.findMany({
      where: { childId },
    });
    const verdict = evaluateAllergens(
      allergies,
      recipe.foods.map((f) => ({
        id: f.foodId,
        name: f.food.name,
        allergens: f.food.allergens,
      })),
    );
    assertAllergySafe(verdict, dto.confirmAllergen === true);

    const slotTaken = await this.prisma.mealPlanEntry.findFirst({
      where: {
        childId,
        date: day(dto.date),
        slot: dto.slot,
        NOT: { id: entryId },
      },
    });
    if (slotTaken)
      throw conflict('SLOT_TAKEN', 'This meal slot already has an entry');

    const data = {
      date: day(dto.date),
      slot: dto.slot,
      recipeId: dto.recipeId,
      portion: dto.portion ?? portionForAge(ageInMonths(child.dateOfBirth)),
      createdBy: 'PARENT' as const,
      clientUpdatedAt: new Date(dto.clientUpdatedAt),
    };
    const row = await this.prisma.mealPlanEntry.upsert({
      where: { id: entryId },
      create: { id: entryId, childId, ...data },
      update: data,
    });
    return {
      data: { ...row, date: iso(row.date), portion: Number(row.portion) },
      sync: { superseded: false },
      warnings: verdict.matches,
    };
  }

  async deleteEntry(userId: string, childId: string, entryId: string) {
    await this.access.assertOwned(userId, childId);
    await this.prisma.mealPlanEntry.deleteMany({
      where: { id: entryId, childId },
    });
  }

  async groceryList(userId: string, childId: string, from: string, to: string) {
    await this.access.assertOwned(userId, childId);
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { childId, date: { gte: day(from), lte: day(to) } },
      include: { recipe: { include: recipeInclude } },
    });
    const lines = buildGroceryList(
      entries.map((e) => ({
        portion: Number(e.portion),
        foods: e.recipe.foods.map((f) => ({
          foodId: f.foodId,
          foodName: f.food.name,
          quantityG: Number(f.quantityG),
        })),
      })),
    );
    const checks = await this.prisma.groceryCheck.findMany({
      where: { childId, weekStart: day(from) },
    });
    const checked = new Map(checks.map((c) => [c.foodId, c.checked]));
    return {
      weekStart: from,
      lines: lines.map((l) => ({
        ...l,
        checked: checked.get(l.foodId) ?? false,
      })),
    };
  }

  async setCheck(
    userId: string,
    childId: string,
    dto: {
      weekStart: string;
      foodId: string;
      checked: boolean;
      clientUpdatedAt: string;
    },
  ) {
    await this.access.assertOwned(userId, childId);
    const key = {
      childId_foodId_weekStart: {
        childId,
        foodId: dto.foodId,
        weekStart: day(dto.weekStart),
      },
    };
    const existing = await this.prisma.groceryCheck.findUnique({ where: key });
    const { apply, superseded } = resolveLww(
      existing,
      new Date(dto.clientUpdatedAt),
    );
    if (apply) {
      await this.prisma.groceryCheck.upsert({
        where: key,
        create: {
          childId,
          foodId: dto.foodId,
          weekStart: day(dto.weekStart),
          checked: dto.checked,
          clientUpdatedAt: new Date(dto.clientUpdatedAt),
        },
        update: {
          checked: dto.checked,
          clientUpdatedAt: new Date(dto.clientUpdatedAt),
        },
      });
    }
    return { sync: { superseded } };
  }
}
