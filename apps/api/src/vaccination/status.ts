import { ageInDays } from '../common/age';

export type VaccineStatus =
  'UPCOMING' | 'DUE' | 'OVERDUE' | 'GIVEN' | 'GIVEN_LATE';

export function dueDateFor(dateOfBirth: Date, suggestedAgeDays: number): Date {
  return new Date(
    Date.UTC(
      dateOfBirth.getUTCFullYear(),
      dateOfBirth.getUTCMonth(),
      dateOfBirth.getUTCDate() + suggestedAgeDays,
    ),
  );
}

export function vaccineStatus(i: {
  dateOfBirth: Date;
  givenDate: Date | null;
  minAgeDays: number;
  maxAgeDays: number | null;
  now?: Date;
}): VaccineStatus {
  if (i.givenDate) {
    const ageWhenGiven = ageInDays(i.dateOfBirth, i.givenDate);
    return i.maxAgeDays !== null && ageWhenGiven > i.maxAgeDays
      ? 'GIVEN_LATE'
      : 'GIVEN';
  }
  const age = ageInDays(i.dateOfBirth, i.now ?? new Date());
  if (age < i.minAgeDays) return 'UPCOMING';
  if (i.maxAgeDays !== null && age > i.maxAgeDays) return 'OVERDUE';
  return 'DUE';
}
