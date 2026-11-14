/** Interpret the date-time picker in the school's timezone, including daylight saving. */
export function publicationDate(value: string, timeZone: string) {
  const desired = Date.parse(value + ":00Z");
  if (!Number.isFinite(desired)) return new Date(NaN);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
    );
    const actual = Date.parse(
      parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute + ":00Z",
    );
    if (actual === desired) return new Date(instant);
    instant += desired - actual;
  }
  return new Date(NaN);
}
