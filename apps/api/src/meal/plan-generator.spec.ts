import { datesBetween, generatePlan, CandidateRecipe } from './plan-generator';

const r = (
  id: string,
  over: Partial<CandidateRecipe> = {},
): CandidateRecipe => ({
  id,
  name: id,
  slots: ['BREAKFAST', 'LUNCH', 'DINNER'],
  suitableDiets: ['NON_VEGETARIAN', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN'],
  ageMinMonths: 0,
  ageMaxMonths: 144,
  foodIds: [id + '-food'],
  allergens: [],
  ...over,
});
const base = {
  dates: ['2026-04-01', '2026-04-02', '2026-04-03'],
  slots: ['LUNCH' as const],
  ageMonths: 36,
  dietType: 'VEGETARIAN' as const,
  allergies: [],
  dislikedFoodIds: [],
  occupied: new Set<string>(),
  varietyWindowDays: 3,
};

describe('datesBetween', () => {
  it('is inclusive', () =>
    expect(datesBetween('2026-04-01', '2026-04-03')).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
    ]));
  it('handles one day', () =>
    expect(datesBetween('2026-04-01', '2026-04-01')).toEqual(['2026-04-01']));
});

describe('generatePlan', () => {
  it('fills every date/slot when recipes exist', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b'), r('c')] });
    expect(out).toHaveLength(3);
  });
  it('avoids repeating a recipe inside the variety window when possible', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b'), r('c')] });
    expect(new Set(out.map((e) => e.recipeId)).size).toBe(3);
  });
  it('repeats only when there are fewer recipes than the window', () => {
    const out = generatePlan({ ...base, recipes: [r('a'), r('b')] });
    expect(out).toHaveLength(3);
  });
  it('never includes a recipe with any allergen the child has, whatever the severity', () => {
    const out = generatePlan({
      ...base,
      allergies: ['EGG'],
      recipes: [r('a', { allergens: ['EGG'] }), r('b')],
    });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('excludes recipes containing disliked foods', () => {
    const out = generatePlan({
      ...base,
      dislikedFoodIds: ['a-food'],
      recipes: [r('a'), r('b')],
    });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('respects diet and age range', () => {
    const out = generatePlan({
      ...base,
      dietType: 'VEGAN',
      recipes: [
        r('meat', { suitableDiets: ['NON_VEGETARIAN'] }),
        r('young', { ageMinMonths: 48 }),
        r('ok'),
      ],
    });
    expect(out.every((e) => e.recipeId === 'ok')).toBe(true);
  });
  it('respects slot compatibility', () => {
    const out = generatePlan({
      ...base,
      recipes: [r('a', { slots: ['DINNER'] }), r('b', { slots: ['LUNCH'] })],
    });
    expect(out.every((e) => e.recipeId === 'b')).toBe(true);
  });
  it('skips occupied slots', () => {
    const out = generatePlan({
      ...base,
      occupied: new Set(['2026-04-02|LUNCH']),
      recipes: [r('a'), r('b'), r('c')],
    });
    expect(out.map((e) => e.date)).toEqual(['2026-04-01', '2026-04-03']);
  });
  it('leaves a slot empty when nothing qualifies', () => {
    expect(generatePlan({ ...base, recipes: [] })).toEqual([]);
  });
  it('is deterministic', () => {
    const recipes = [r('a'), r('b'), r('c')];
    expect(generatePlan({ ...base, recipes })).toEqual(
      generatePlan({ ...base, recipes }),
    );
  });
});
