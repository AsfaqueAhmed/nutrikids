import { summarize } from './nutrition-log.summary';

describe('summarize', () => {
  it('returns nulls when nothing is logged', () => {
    const s = summarize([], 0);
    expect(s).toMatchObject({
      loggedCount: 0,
      loggedPercent: null,
      eatenPercent: null,
      perSlot: [],
    });
  });

  it('counts statuses and weights partial meals by percent', () => {
    const s = summarize(
      [
        { slot: 'BREAKFAST', eatenStatus: 'FULL', percent: null },
        { slot: 'LUNCH', eatenStatus: 'PARTIAL', percent: 50 },
        { slot: 'DINNER', eatenStatus: 'SKIPPED', percent: null },
      ],
      6,
    );
    expect(s.loggedCount).toBe(3);
    expect(s.fullCount).toBe(1);
    expect(s.partialCount).toBe(1);
    expect(s.skippedCount).toBe(1);
    expect(s.plannedCount).toBe(6);
    expect(s.loggedPercent).toBe(50); // 3 of 6 planned meals were logged
    expect(s.eatenPercent).toBe(50); // (1 + 0.5 + 0) / 3
    expect(s.perSlot).toEqual([
      { slot: 'BREAKFAST', logged: 1, full: 1, partial: 0, skipped: 0 },
      { slot: 'LUNCH', logged: 1, full: 0, partial: 1, skipped: 0 },
      { slot: 'DINNER', logged: 1, full: 0, partial: 0, skipped: 1 },
    ]);
  });

  it('leaves loggedPercent null when nothing was planned', () => {
    const s = summarize(
      [{ slot: 'LUNCH', eatenStatus: 'FULL', percent: null }],
      0,
    );
    expect(s.loggedPercent).toBeNull();
    expect(s.eatenPercent).toBe(100);
  });
});
