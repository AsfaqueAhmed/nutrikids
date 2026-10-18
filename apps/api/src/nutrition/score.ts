import { NutrientTotals } from '../meal/recipe-nutrition';
import { RDA_BANDS, SCORE_NUTRIENTS, ScoreNutrient, Targets } from './rda';

export { SCORE_NUTRIENTS };
export type { ScoreNutrient };
export type Rating = 'GOOD' | 'MEDIUM' | 'LOW';
export type NutritionScore = {
  applicable: boolean;
  provisional: true;
  scorePercent: number | null;
  nutrients: {
    nutrient: ScoreNutrient;
    intake: number;
    target: number;
    ratio: number;
    rating: Rating;
  }[];
};

export function rdaFor(ageMonths: number): Targets | null {
  if (ageMonths < 12) return null; // milk/formula-led diet; score does not apply
  return RDA_BANDS.find(
    (b) => ageMonths >= b.fromMonths && ageMonths <= b.toMonths,
  )!.targets;
}

export function rate(ratio: number): Rating {
  if (ratio >= 0.8) return 'GOOD';
  if (ratio >= 0.5) return 'MEDIUM';
  return 'LOW';
}

export function computeScore(
  totals: NutrientTotals,
  ageMonths: number,
): NutritionScore {
  const targets = rdaFor(ageMonths);
  if (!targets)
    return {
      applicable: false,
      provisional: true,
      scorePercent: null,
      nutrients: [],
    };
  const nutrients = SCORE_NUTRIENTS.map((nutrient) => {
    const intake = totals[nutrient] ?? 0;
    const target = targets[nutrient];
    const ratio = Math.round((intake / target) * 1000) / 1000;
    return {
      nutrient,
      intake: Math.round(intake * 100) / 100,
      target,
      ratio,
      rating: rate(ratio),
    };
  });
  const mean =
    nutrients.reduce((s, n) => s + Math.min(n.ratio, 1), 0) / nutrients.length;
  return {
    applicable: true,
    provisional: true,
    scorePercent: Math.round(mean * 100),
    nutrients,
  };
}
