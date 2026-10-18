import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { ageInMonths } from '../common/age';
import { type AuthUser, CurrentUser } from '../common/current-user';
import { ChildAccessService } from '../child/child-access.service';
import { NutritionPer100g } from '../food/nutrition';
import { recipeInclude } from '../meal/plan.service';
import { recipeNutrition, NutrientTotals } from '../meal/recipe-nutrition';
import { PrismaService } from '../prisma/prisma.service';
import { computeScore } from './score';

class DailyQuery {
  @IsDateString() date!: string;
}
class WeeklyQuery {
  @IsDateString() weekStart!: string;
}
const day = (s: string) => new Date(`${s}T00:00:00Z`);

@Controller('children/:childId/nutrition')
export class NutritionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChildAccessService,
  ) {}

  private async scoreFor(childId: string, dob: Date, date: string) {
    const entries = await this.prisma.mealPlanEntry.findMany({
      where: { childId, date: day(date) },
      include: { recipe: { include: recipeInclude } },
    });
    const totals: NutrientTotals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      iron: 0,
      calcium: 0,
      vitaminA: 0,
      vitaminC: 0,
      vitaminD: 0,
      zinc: 0,
    };
    for (const e of entries) {
      const t = recipeNutrition(
        e.recipe.foods.map((f) => ({
          quantityG: Number(f.quantityG),
          nutrition: f.food.nutrition as NutritionPer100g,
        })),
        Number(e.portion),
      );
      for (const k of Object.keys(totals) as (keyof NutrientTotals)[])
        totals[k] += t[k];
    }
    return {
      date,
      mealsPlanned: entries.length,
      ...computeScore(totals, ageInMonths(dob, day(date))),
    };
  }

  @Get('daily') async daily(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) id: string,
    @Query() q: DailyQuery,
  ) {
    const child = await this.access.assertOwned(u.id, id);
    return this.scoreFor(id, child.dateOfBirth, q.date);
  }

  @Get('weekly') async weekly(
    @CurrentUser() u: AuthUser,
    @Param('childId', ParseUUIDPipe) id: string,
    @Query() q: WeeklyQuery,
  ) {
    const child = await this.access.assertOwned(u.id, id);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(day(q.weekStart).getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      days.push(await this.scoreFor(id, child.dateOfBirth, d));
    }
    const scored = days.filter(
      (d) => d.scorePercent !== null && d.mealsPlanned > 0,
    );
    const averageScorePercent = scored.length
      ? Math.round(
          scored.reduce((s, d) => s + (d.scorePercent as number), 0) /
            scored.length,
        )
      : null;
    return { provisional: true, days, averageScorePercent };
  }
}
