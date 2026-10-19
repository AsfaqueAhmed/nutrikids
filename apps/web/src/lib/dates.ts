export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function rangeEndingToday(
  days: number,
  referenceDate: Date = new Date(),
): { from: string; to: string } {
  const to = new Date(referenceDate);
  const from = new Date(referenceDate);
  from.setDate(to.getDate() - (days - 1));
  return {
    from: formatDateISO(from),
    to: formatDateISO(to),
  };
}
