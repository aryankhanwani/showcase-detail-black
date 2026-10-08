/**
 * Calendar arithmetic for the booking flow.
 *
 * Every date in this system is a plain `YYYY-MM-DD` string in the studio's own
 * timezone, and it stays a string from the database row to the button the
 * customer taps. That is deliberate. A `Date` is a point in time, a drop-off is
 * a day — and on a UTC host the two disagree by five and a half hours, which is
 * exactly long enough to show a customer the 12th, book them for the 11th, and
 * leave nobody able to explain how.
 *
 * `new Date(ymd + "T00:00:00.000Z")` is used wherever Prisma needs a value,
 * because `@db.Date` stores the UTC calendar day and so round-trips unchanged.
 */

export const STUDIO_TZ = "Asia/Kolkata";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDIO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today, as the studio's wall calendar has it. */
export function studioToday(): string {
  return ymdFormatter.format(new Date());
}

export function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

/** 0 = Sunday, matching `Date.getUTCDay` and `booking.closedWeekday`. */
export function weekdayOf(ymd: string): number {
  return toDate(ymd).getUTCDay();
}

/** The Monday of the week this date falls in. Keys the weekly intake cap. */
export function weekStart(ymd: string): string {
  const day = weekdayOf(ymd);
  /* Sunday is the end of the week here, not the start — the studio's week runs
     Mon–Sat and the ceiling is nine cars across it. */
  const back = day === 0 ? 6 : day - 1;
  return addDays(ymd, -back);
}

export function isValidYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toYmd(toDate(value)) === value;
}

/** "Monday, 12 October" — how a person says a date out loud. */
export function formatDayLong(ymd: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(ymd));
}

/** "12 Oct" — for chips, where the weekday does not fit. */
export function formatDayShort(ymd: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(toDate(ymd));
}

/** "October 2026" — the calendar header. */
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(toDate(`${month}-01`));
}

/** The `YYYY-MM` a date belongs to. */
export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return toYmd(d).slice(0, 7);
}

/**
 * Every day in a month, padded to whole Monday-start weeks.
 *
 * Padding days are returned as nulls rather than as the neighbouring month's
 * dates: a grid that shows the 29th of September greyed out next to the 1st of
 * October invites exactly one misread, and it is a misread that books a car in.
 */
export function monthGrid(month: string): (string | null)[] {
  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7; // Monday-start
  const days: (string | null)[] = Array.from({ length: lead }, () => null);

  for (let day = first; monthOf(day) === month; day = addDays(day, 1)) {
    days.push(day);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}
