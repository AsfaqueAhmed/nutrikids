import { z } from 'zod';
import { ApiError } from '../common/api-error';

const nn = (max: number) => z.number().min(0).max(max);

const schema = z.object({
  calories: nn(900),
  protein: nn(100),
  carbs: nn(100),
  fat: nn(100),
  fiber: nn(100),
  iron: nn(100),
  calcium: nn(2000),
  vitaminA: nn(30000),
  vitaminC: nn(2000),
  vitaminD: nn(1000),
  zinc: nn(100),
});

export type NutritionPer100g = z.infer<typeof schema>;
export const NUTRIENT_KEYS = Object.keys(
  schema.shape,
) as (keyof NutritionPer100g)[];

export function validateNutrition(n: unknown): NutritionPer100g {
  const r = schema.safeParse(n);
  if (!r.success)
    throw new ApiError(
      400,
      'INVALID_NUTRITION',
      'Invalid nutrition data',
      r.error.issues,
    );
  if (r.data.protein + r.data.carbs + r.data.fat > 100) {
    throw new ApiError(
      400,
      'INVALID_NUTRITION',
      'Protein + carbs + fat cannot exceed 100 g per 100 g',
    );
  }
  return r.data;
}
