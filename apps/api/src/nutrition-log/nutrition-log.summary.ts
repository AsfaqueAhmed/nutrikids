import { EatenStatus, MealSlot } from '@prisma/client';

export type LogLike = {
  slot: MealSlot;
  eatenStatus: EatenStatus;
  percent: number | null;
};

const SLOT_ORDER: MealSlot[] = [
  'BREAKFAST',
  'MORNING_SNACK',
  'LUNCH',
  'AFTERNOON_SNACK',
  'DINNER',
];

export function summarize(logs: LogLike[], plannedCount: number) {
  let full = 0;
  let partial = 0;
  let skipped = 0;
  let eaten = 0;
  const slots = new Map<
    MealSlot,
    { logged: number; full: number; partial: number; skipped: number }
  >();
  for (const l of logs) {
    const s = slots.get(l.slot) ?? {
      logged: 0,
      full: 0,
      partial: 0,
      skipped: 0,
    };
    s.logged++;
    if (l.eatenStatus === 'FULL') {
      full++;
      s.full++;
      eaten += 1;
    } else if (l.eatenStatus === 'PARTIAL') {
      partial++;
      s.partial++;
      eaten += (l.percent ?? 50) / 100;
    } else {
      skipped++;
      s.skipped++;
    }
    slots.set(l.slot, s);
  }
  const logged = logs.length;
  return {
    plannedCount,
    loggedCount: logged,
    fullCount: full,
    partialCount: partial,
    skippedCount: skipped,
    loggedPercent: plannedCount
      ? Math.min(100, Math.round((100 * logged) / plannedCount))
      : null,
    eatenPercent: logged ? Math.round((100 * eaten) / logged) : null,
    perSlot: SLOT_ORDER.filter((slot) => slots.has(slot)).map((slot) => ({
      slot,
      ...slots.get(slot)!,
    })),
  };
}
