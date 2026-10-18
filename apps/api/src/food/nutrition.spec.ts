import { validateNutrition } from './nutrition';

const ok = {
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

describe('validateNutrition', () => {
  it('accepts a valid object', () => expect(validateNutrition(ok)).toEqual(ok));
  it('rejects negative values', () =>
    expect(() => validateNutrition({ ...ok, iron: -1 })).toThrow());
  it('rejects calories above 900 per 100 g', () =>
    expect(() => validateNutrition({ ...ok, calories: 901 })).toThrow());
  it('rejects macros summing above 100 g per 100 g', () =>
    expect(() =>
      validateNutrition({ ...ok, protein: 50, carbs: 50, fat: 10 }),
    ).toThrow());
  it('rejects missing fields', () =>
    expect(() => validateNutrition({ calories: 1 })).toThrow());
});
