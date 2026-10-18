import { isDueNow, localTimeParts } from './due';

describe('localTimeParts', () => {
  it('converts UTC to Asia/Dhaka (UTC+6)', () => {
    expect(
      localTimeParts(new Date('2026-04-01T02:30:00Z'), 'Asia/Dhaka'),
    ).toEqual({ hhmm: '08:30', date: '2026-04-01' });
  });
  it('rolls the date over at local midnight', () => {
    expect(
      localTimeParts(new Date('2026-04-01T18:30:00Z'), 'Asia/Dhaka'),
    ).toEqual({ hhmm: '00:30', date: '2026-04-02' });
  });
});

describe('isDueNow', () => {
  const now = new Date('2026-04-01T02:30:20Z'); // 08:30 in Dhaka
  it('matches the local minute', () =>
    expect(isDueNow(now, 'Asia/Dhaka', '08:30')).toBe(true));
  it('does not match another minute', () =>
    expect(isDueNow(now, 'Asia/Dhaka', '08:31')).toBe(false));
  it('respects the time zone', () =>
    expect(isDueNow(now, 'UTC', '08:30')).toBe(false));
});
