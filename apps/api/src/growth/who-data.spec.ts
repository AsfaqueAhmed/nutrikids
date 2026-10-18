import { readFileSync } from 'fs';
import { resolve } from 'path';

const load = (f: string) =>
  JSON.parse(
    readFileSync(resolve(__dirname, '../../../../data/who', f), 'utf8'),
  ) as { ageMonths: number; L: number; M: number; S: number }[];

describe('WHO data files', () => {
  it('boys weight-for-age at birth', () =>
    expect(load('WFA_MALE.json')[0]).toMatchObject({
      ageMonths: 0,
      L: 0.3487,
      M: 3.3464,
      S: 0.14602,
    }));
  it('girls weight-for-age at birth', () =>
    expect(load('WFA_FEMALE.json')[0]).toMatchObject({
      ageMonths: 0,
      L: 0.3809,
      M: 3.2322,
      S: 0.14171,
    }));
  it('boys length-for-age at birth', () =>
    expect(load('HFA_MALE.json')[0]).toMatchObject({
      ageMonths: 0,
      M: 49.8842,
      S: 0.03795,
    }));
  it.each(['WFA', 'HFA', 'BFA', 'HCFA'])(
    '%s tables are sorted with no gaps larger than 1 month',
    (ind) => {
      for (const g of ['MALE', 'FEMALE']) {
        const t = load(`${ind}_${g}.json`);
        for (let i = 1; i < t.length; i++) {
          expect(t[i].ageMonths).toBeGreaterThan(t[i - 1].ageMonths);
          expect(t[i].ageMonths - t[i - 1].ageMonths).toBeLessThanOrEqual(1);
        }
      }
    },
  );
});
