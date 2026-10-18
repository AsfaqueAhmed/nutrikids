import { portionForAge, recipeNutrition } from './recipe-nutrition';

const n = (o: Partial<Record<string, number>> = {}) =>
  ({
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 1,
    fiber: 1,
    iron: 1,
    calcium: 100,
    vitaminA: 10,
    vitaminC: 10,
    vitaminD: 1,
    zinc: 1,
    ...o,
  }) as any;

describe('recipeNutrition', () => {
  it('scales per-100g values by grams', () => {
    const t = recipeNutrition([
      { quantityG: 50, nutrition: n() },
      { quantityG: 200, nutrition: n({ calories: 50 }) },
    ]);
    expect(t.calories).toBeCloseTo(50 + 100);
    expect(t.protein).toBeCloseTo(5 + 20);
  });
  it('applies the portion multiplier', () => {
    expect(
      recipeNutrition([{ quantityG: 100, nutrition: n() }], 0.5).calories,
    ).toBeCloseTo(50);
  });
});

describe('portionForAge', () => {
  it.each([
    [6, 0.25],
    [11, 0.25],
    [12, 0.5],
    [47, 0.5],
    [48, 0.75],
    [107, 0.75],
    [108, 1],
  ])('%i months -> %d', (m, p) => {
    expect(portionForAge(m)).toBe(p);
  });
});
