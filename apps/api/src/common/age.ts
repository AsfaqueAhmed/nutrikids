const MS_DAY = 86_400_000;

export function ageInMonths(dob: Date, now: Date = new Date()): number {
  let months =
    (now.getUTCFullYear() - dob.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - dob.getUTCMonth());
  if (now.getUTCDate() < dob.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function ageInDays(dob: Date, now: Date = new Date()): number {
  const start = Date.UTC(
    dob.getUTCFullYear(),
    dob.getUTCMonth(),
    dob.getUTCDate(),
  );
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor((end - start) / MS_DAY);
}
