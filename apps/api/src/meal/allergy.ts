import { Allergen, Severity } from '@prisma/client';
import { conflict } from '../common/api-error';

export type ChildAllergyInfo = { allergen: Allergen; severity: Severity };
export type FoodAllergenInfo = {
  id: string;
  name: string;
  allergens: Allergen[];
};
export type AllergenMatch = {
  allergen: Allergen;
  severity: Severity;
  foodId: string;
  foodName: string;
};
export type AllergyVerdict = {
  status: 'OK' | 'CONFIRM' | 'BLOCKED';
  matches: AllergenMatch[];
};

export function evaluateAllergens(
  childAllergies: ChildAllergyInfo[],
  foods: FoodAllergenInfo[],
): AllergyVerdict {
  const bySeverity = new Map(
    childAllergies.map((a) => [a.allergen, a.severity]),
  );
  const matches: AllergenMatch[] = [];
  for (const food of foods) {
    for (const allergen of food.allergens) {
      const severity = bySeverity.get(allergen);
      if (severity)
        matches.push({
          allergen,
          severity,
          foodId: food.id,
          foodName: food.name,
        });
    }
  }
  if (matches.length === 0) return { status: 'OK', matches };
  return {
    status: matches.some((m) => m.severity === 'SEVERE')
      ? 'BLOCKED'
      : 'CONFIRM',
    matches,
  };
}

export function assertAllergySafe(
  verdict: AllergyVerdict,
  confirmAllergen: boolean,
): void {
  if (verdict.status === 'BLOCKED') {
    throw conflict(
      'ALLERGEN_BLOCKED',
      'This meal contains a severe allergen for this child',
      verdict.matches,
    );
  }
  if (verdict.status === 'CONFIRM' && !confirmAllergen) {
    throw conflict(
      'ALLERGEN_CONFIRM_REQUIRED',
      'This meal contains an allergen for this child. Confirm to add it.',
      verdict.matches,
    );
  }
}
