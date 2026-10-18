import { NUTRIENT_KEYS, NutritionPer100g } from '../food/nutrition';

export type NutrientTotals = Record<keyof NutritionPer100g, number>;

export function recipeNutrition(
  foods: { quantityG: number; nutrition: NutritionPer100g }[],
  portion = 1,
): NutrientTotals {
  const totals = Object.fromEntries(
    NUTRIENT_KEYS.map((k) => [k, 0]),
  ) as NutrientTotals;
  for (const f of foods) {
    for (const k of NUTRIENT_KEYS)
      totals[k] += ((f.nutrition[k] ?? 0) * f.quantityG) / 100;
  }
  for (const k of NUTRIENT_KEYS)
    totals[k] = Math.round(totals[k] * portion * 100) / 100;
  return totals;
}

// PROVISIONAL: portion multipliers need nutritionist review.
export function portionForAge(ageMonths: number): number {
  if (ageMonths < 12) return 0.25;
  if (ageMonths < 48) return 0.5;
  if (ageMonths < 108) return 0.75;
  return 1;
}
