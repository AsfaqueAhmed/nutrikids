import { readFileSync } from 'fs';
import { resolve } from 'path';

const data = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../data/seed/vaccines.bd.json'),
    'utf8',
  ),
);

describe('vaccines.bd.json', () => {
  it('has unique codes and valid doses', () => {
    const codes = data.vaccines.map((v: any) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const v of data.vaccines) {
      expect(['GOVERNMENT_FREE', 'PRIVATE_PAID', 'BOTH']).toContain(
        v.availability,
      );
      expect(v.sourceNote).toBeTruthy();
      expect(v.schedule.length).toBeGreaterThan(0);
      v.schedule.forEach((d: any, i: number) => {
        expect(d.doseNumber).toBe(i + 1);
        expect(d.minAgeDays).toBeLessThanOrEqual(d.suggestedAgeDays);
        if (d.maxAgeDays !== null)
          expect(d.maxAgeDays).toBeGreaterThanOrEqual(d.suggestedAgeDays);
      });
      if (v.availability === 'GOVERNMENT_FREE')
        expect(v.priceMinBdt).toBeNull();
      if (v.priceMinBdt !== null)
        expect(v.priceMaxBdt).toBeGreaterThanOrEqual(v.priceMinBdt);
    }
  });
  it('is marked unverified until a medical advisor approves it', () => {
    expect(typeof data.verified).toBe('boolean');
  });
});
