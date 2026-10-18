export function localTimeParts(
  now: Date,
  timeZone: string,
): { hhmm: string; date: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    hhmm: `${get('hour')}:${get('minute')}`,
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export const isDueNow = (now: Date, timeZone: string, timeOfDay: string) =>
  localTimeParts(now, timeZone).hhmm === timeOfDay;
