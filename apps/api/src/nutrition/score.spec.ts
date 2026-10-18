import { computeScore, rate, rdaFor } from './score';

const zero = {
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

describe('rate', () => {
  it.each([
    [1, 'GOOD'],
    [0.8, 'GOOD'],
    [0.79, 'MEDIUM'],
    [0.5, 'MEDIUM'],
    [0.49, 'LOW'],
    [0, 'LOW'],
  ])('%d -> %s', (r, e) => expect(rate(r)).toBe(e));
});

describe('rdaFor', () => {
  it('is not applicable under 12 months', () => expect(rdaFor(11)).toBeNull());
  it('selects an age band', () => {
    expect(rdaFor(24)!.iron).toBeLessThan(rdaFor(60)!.iron + 1);
    expect(rdaFor(120)!.calcium).toBeGreaterThan(rdaFor(24)!.calcium);
  });
});

describe('computeScore', () => {
  it('is 100% when every target is met', () => {
    const rda = rdaFor(36)!;
    const s = computeScore({ ...zero, ...rda }, 36);
    expect(s.scorePercent).toBe(100);
    expect(s.nutrients.every((n) => n.rating === 'GOOD')).toBe(true);
  });
  it('caps each nutrient at 100% so one excess does not hide a gap', () => {
    const rda = rdaFor(36)!;
    const s = computeScore(
      { ...zero, ...rda, protein: rda.protein * 10, iron: 0 },
      36,
    );
    expect(s.scorePercent).toBe(88); // 7 of 8 nutrients at 100%, one at 0 -> 87.5 rounded
  });
  it('is 0% with no intake', () =>
    expect(computeScore(zero, 36).scorePercent).toBe(0));
  it('returns not applicable under 12 months', () => {
    const s = computeScore(zero, 8);
    expect(s).toMatchObject({
      applicable: false,
      scorePercent: null,
      nutrients: [],
    });
  });
});
