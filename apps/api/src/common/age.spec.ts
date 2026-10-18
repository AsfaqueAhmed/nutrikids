import { ageInDays, ageInMonths } from './age';

describe('age', () => {
  const now = new Date('2026-03-31T00:00:00Z');
  it('counts whole months', () => {
    expect(ageInMonths(new Date('2025-03-31'), now)).toBe(12);
    expect(ageInMonths(new Date('2025-04-01'), now)).toBe(11);
    expect(ageInMonths(new Date('2026-03-31'), now)).toBe(0);
  });
  it('counts days', () => {
    expect(ageInDays(new Date('2026-03-01'), now)).toBe(30);
  });
});
