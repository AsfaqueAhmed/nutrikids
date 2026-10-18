import { ApiError } from '../common/api-error';
import { assertAllergySafe, evaluateAllergens } from './allergy';

const egg = { id: 'f1', name: 'Egg', allergens: ['EGG' as const] };
const milk = { id: 'f2', name: 'Milk', allergens: ['MILK' as const] };
const custard = {
  id: 'f3',
  name: 'Custard',
  allergens: ['EGG' as const, 'MILK' as const],
};
const rice = { id: 'f4', name: 'Rice', allergens: [] };

describe('evaluateAllergens', () => {
  it('is OK with no allergies', () => {
    expect(evaluateAllergens([], [egg, milk]).status).toBe('OK');
  });
  it('is OK when no food matches', () => {
    expect(
      evaluateAllergens([{ allergen: 'EGG', severity: 'SEVERE' }], [rice, milk])
        .status,
    ).toBe('OK');
  });
  it('asks to confirm for mild and moderate', () => {
    expect(
      evaluateAllergens([{ allergen: 'EGG', severity: 'MILD' }], [egg]).status,
    ).toBe('CONFIRM');
    expect(
      evaluateAllergens([{ allergen: 'EGG', severity: 'MODERATE' }], [egg])
        .status,
    ).toBe('CONFIRM');
  });
  it('blocks for severe', () => {
    expect(
      evaluateAllergens([{ allergen: 'EGG', severity: 'SEVERE' }], [egg])
        .status,
    ).toBe('BLOCKED');
  });
  it('blocks if any match is severe even when others are mild', () => {
    const v = evaluateAllergens(
      [
        { allergen: 'EGG', severity: 'MILD' },
        { allergen: 'MILK', severity: 'SEVERE' },
      ],
      [custard],
    );
    expect(v.status).toBe('BLOCKED');
    expect(v.matches).toHaveLength(2);
  });
  it('matches derived ingredients through tags', () => {
    const v = evaluateAllergens(
      [{ allergen: 'MILK', severity: 'MILD' }],
      [custard],
    );
    expect(v.matches).toEqual([
      { allergen: 'MILK', severity: 'MILD', foodId: 'f3', foodName: 'Custard' },
    ]);
  });
});

describe('assertAllergySafe', () => {
  const blocked = evaluateAllergens(
    [{ allergen: 'EGG', severity: 'SEVERE' }],
    [egg],
  );
  const confirm = evaluateAllergens(
    [{ allergen: 'EGG', severity: 'MILD' }],
    [egg],
  );
  it('never allows a severe match, even with confirmation', () => {
    expect(() => assertAllergySafe(blocked, true)).toThrow(ApiError);
    expect.assertions(3);
    try {
      assertAllergySafe(blocked, true);
    } catch (e) {
      expect((e as ApiError).getStatus()).toBe(409);
      expect((e as ApiError).code).toBe('ALLERGEN_BLOCKED');
    }
  });
  it('requires confirmation for mild/moderate', () => {
    expect(() => assertAllergySafe(confirm, false)).toThrow(
      expect.objectContaining({ code: 'ALLERGEN_CONFIRM_REQUIRED' }),
    );
    expect(() => assertAllergySafe(confirm, true)).not.toThrow();
  });
  it('passes when OK', () => {
    expect(() =>
      assertAllergySafe({ status: 'OK', matches: [] }, false),
    ).not.toThrow();
  });
});
