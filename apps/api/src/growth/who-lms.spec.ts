import {
  bmiStatus,
  lmsAt,
  normalCdf,
  percentileFromZ,
  valueAtZ,
  zScore,
} from './who-lms';

describe('WHO LMS maths', () => {
  const boysWfa0 = { L: 0.3487, M: 3.3464, S: 0.14602 }; // WHO weight-for-age, boys, birth

  it('gives z = 0 and the 50th percentile at the median', () => {
    expect(zScore(3.3464, boysWfa0)).toBeCloseTo(0, 6);
    expect(percentileFromZ(0)).toBe(50);
  });
  it('is symmetric: z(+1) ~ 84.1, z(-1) ~ 15.9', () => {
    expect(normalCdf(1)).toBeCloseTo(0.8413, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 4);
  });
  it('uses the log form when L = 0', () => {
    expect(zScore(Math.E * 10, { L: 0, M: 10, S: 1 })).toBeCloseTo(1, 6);
  });
  it('round-trips value -> z -> value', () => {
    const z = zScore(4.2, boysWfa0);
    expect(valueAtZ(z, boysWfa0)).toBeCloseTo(4.2, 5);
  });
  it('interpolates linearly between rows and clamps at the ends', () => {
    const t = [
      { ageMonths: 0, L: 1, M: 10, S: 0.1 },
      { ageMonths: 2, L: 1, M: 14, S: 0.2 },
    ];
    expect(lmsAt(t, 1)).toEqual({
      ageMonths: 1,
      L: 1,
      M: 12,
      S: 0.15000000000000002,
    });
    expect(lmsAt(t, -1).M).toBe(10);
    expect(lmsAt(t, 99).M).toBe(14);
  });
  it('classifies BMI z-scores (provisional thresholds)', () => {
    expect(bmiStatus(-2.1)).toBe('UNDERWEIGHT');
    expect(bmiStatus(0)).toBe('NORMAL');
    expect(bmiStatus(2.1)).toBe('OVERWEIGHT');
  });
});
