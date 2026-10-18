import { Gender } from '@prisma/client';

export type Indicator = 'WFA' | 'HFA' | 'BFA' | 'HCFA';
export type LmsRow = { ageMonths: number; L: number; M: number; S: number };
export type GrowthStatus = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT';

export function zScore(
  x: number,
  { L, M, S }: { L: number; M: number; S: number },
): number {
  return L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
}

export function valueAtZ(
  z: number,
  { L, M, S }: { L: number; M: number; S: number },
): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

// Abramowitz & Stegun 7.1.26 approximation of the error function
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}
export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export const percentileFromZ = (z: number) =>
  Math.round(normalCdf(z) * 1000) / 10;

export function lmsAt(table: LmsRow[], ageMonths: number): LmsRow {
  if (ageMonths <= table[0].ageMonths) return table[0];
  const last = table[table.length - 1];
  if (ageMonths >= last.ageMonths) return last;
  const hi = table.findIndex((r) => r.ageMonths >= ageMonths);
  const a = table[hi - 1];
  const b = table[hi];
  const f = (ageMonths - a.ageMonths) / (b.ageMonths - a.ageMonths);
  return {
    ageMonths,
    L: a.L + f * (b.L - a.L),
    M: a.M + f * (b.M - a.M),
    S: a.S + f * (b.S - a.S),
  };
}

// PROVISIONAL thresholds; need medical advisor approval.
export function bmiStatus(z: number): GrowthStatus {
  if (z < -2) return 'UNDERWEIGHT';
  if (z > 2) return 'OVERWEIGHT';
  return 'NORMAL';
}

export class WhoTables {
  constructor(private readonly tables: Record<string, LmsRow[]>) {}
  table(ind: Indicator, gender: Gender): LmsRow[] {
    const key = `${ind}_${gender}`;
    const t = this.tables[key];
    if (!t?.length) throw new Error(`Missing WHO table ${key}`);
    return t;
  }
}
