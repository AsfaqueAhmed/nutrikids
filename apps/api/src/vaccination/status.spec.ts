import { dueDateFor, vaccineStatus } from './status';

const dob = new Date('2026-01-01T00:00:00Z');
const at = (days: number) => new Date(dob.getTime() + days * 86_400_000);
const base = {
  dateOfBirth: dob,
  givenDate: null as Date | null,
  minAgeDays: 42,
  maxAgeDays: 84 as number | null,
};

describe('vaccineStatus', () => {
  it('is UPCOMING before the minimum age', () =>
    expect(vaccineStatus({ ...base, now: at(10) })).toBe('UPCOMING'));
  it('is DUE inside the window, inclusive', () => {
    expect(vaccineStatus({ ...base, now: at(42) })).toBe('DUE');
    expect(vaccineStatus({ ...base, now: at(84) })).toBe('DUE');
  });
  it('is OVERDUE after the maximum age', () =>
    expect(vaccineStatus({ ...base, now: at(85) })).toBe('OVERDUE'));
  it('stays DUE when there is no maximum age', () =>
    expect(vaccineStatus({ ...base, maxAgeDays: null, now: at(9999) })).toBe(
      'DUE',
    ));
  it('is GIVEN when given inside the window', () =>
    expect(vaccineStatus({ ...base, givenDate: at(50), now: at(500) })).toBe(
      'GIVEN',
    ));
  it('is GIVEN_LATE when given after the maximum age', () =>
    expect(vaccineStatus({ ...base, givenDate: at(100), now: at(500) })).toBe(
      'GIVEN_LATE',
    ));
});

describe('dueDateFor', () => {
  it('adds the suggested age in days', () =>
    expect(dueDateFor(dob, 42).toISOString().slice(0, 10)).toBe('2026-02-12'));
});
