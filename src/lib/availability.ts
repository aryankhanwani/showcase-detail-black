import { db } from "@/lib/db";
import { booking } from "@/content/studio";
import {
  addDays,
  formatDayLong,
  monthGrid,
  monthOf,
  studioToday,
  toDate,
  toYmd,
  weekStart,
  weekdayOf,
} from "@/lib/calendar";

/**
 * What the studio can actually take, and when.
 *
 * The calendar in the chat is not a date picker with a disabled weekend. Every
 * refusal here maps to a real constraint the site already claims in public —
 * four bays, nine cars a week, Sundays by arrangement, two days' notice so the
 * inspection can be scheduled. Which is the point: a calendar that offers a
 * date the studio cannot keep is worse than no calendar, because it converts a
 * promise the brand is built on into a phone call apologising.
 */

export type DayState =
  /** Bookable. */
  | "open"
  /** Bays or the weekly ceiling are gone. */
  | "full"
  /** Sunday. */
  | "closed"
  /** Before the lead time, or past the horizon. */
  | "unavailable";

export type Day = {
  date: string;
  state: DayState;
  /** Slot ids already taken. Only meaningful on an open day. */
  taken: string[];
};

export type Window = { earliest: string; latest: string };

export function bookingWindow(): Window {
  const today = studioToday();
  return {
    earliest: addDays(today, booking.leadDays),
    latest: addDays(today, booking.horizonDays),
  };
}

/** Bookings in a date range, as a map of date -> taken slot ids. */
async function takenBetween(from: string, to: string): Promise<Map<string, string[]>> {
  const rows = await db.booking.findMany({
    where: {
      date: { gte: toDate(from), lte: toDate(to) },
      status: { in: ["CONFIRMED", "RESCHEDULED"] },
    },
    select: { date: true, slot: true },
  });

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const key = toYmd(row.date);
    const list = map.get(key);
    if (list) list.push(row.slot);
    else map.set(key, [row.slot]);
  }
  return map;
}

function stateOf(
  date: string,
  window: Window,
  taken: string[],
  weekLoad: number,
): DayState {
  if (weekdayOf(date) === booking.closedWeekday) return "closed";
  if (date < window.earliest || date > window.latest) return "unavailable";
  if (taken.length >= booking.perDay) return "full";
  if (weekLoad >= booking.perWeek) return "full";
  if (taken.length >= booking.slots.length) return "full";
  return "open";
}

/**
 * One month of availability.
 *
 * The query spans the whole month plus the weeks either side of it, because the
 * weekly ceiling is decided by bookings that may sit in the previous or next
 * month — a month-bounded query makes the first and last week of every month
 * look emptier than the studio really is.
 */
export async function monthAvailability(month: string): Promise<{
  month: string;
  window: Window;
  days: (Day | null)[];
}> {
  const window = bookingWindow();
  const grid = monthGrid(month);
  const dates = grid.filter((d): d is string => d !== null);

  const from = weekStart(dates[0]!);
  const to = addDays(weekStart(dates[dates.length - 1]!), 6);
  const taken = await takenBetween(from, to);

  /* Weekly load, counted once per week rather than per day. */
  const weekLoad = new Map<string, number>();
  for (const [date, slots] of taken) {
    const key = weekStart(date);
    weekLoad.set(key, (weekLoad.get(key) ?? 0) + slots.length);
  }

  return {
    month,
    window,
    days: grid.map((date) =>
      date === null
        ? null
        : {
            date,
            taken: taken.get(date) ?? [],
            state: stateOf(date, window, taken.get(date) ?? [], weekLoad.get(weekStart(date)) ?? 0),
          },
    ),
  };
}

export type SlotOffer = {
  id: string;
  label: string;
  note: string;
  available: boolean;
};

/** The drop-off windows for one day, with the taken ones marked. */
export async function dayAvailability(date: string): Promise<{
  date: string;
  state: DayState;
  slots: SlotOffer[];
}> {
  const window = bookingWindow();
  const week = weekStart(date);
  const taken = await takenBetween(week, addDays(week, 6));

  const onDay = taken.get(date) ?? [];
  const weekLoad = [...taken.values()].reduce((n, slots) => n + slots.length, 0);
  const state = stateOf(date, window, onDay, weekLoad);

  return {
    date,
    state,
    slots: booking.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      note: slot.note,
      available: state === "open" && !onDay.includes(slot.id),
    })),
  };
}

/**
 * The next few bookable days, as prose.
 *
 * WhatsApp cannot render a calendar grid, so the same availability is spoken
 * instead of drawn. One source of truth, two surfaces — which is the rule the
 * whole assistant is built on.
 */
export async function nextOpenDays(count = 4): Promise<string[]> {
  const { earliest, latest } = bookingWindow();
  const taken = await takenBetween(earliest, latest);

  const weekLoad = new Map<string, number>();
  for (const [date, slots] of taken) {
    const key = weekStart(date);
    weekLoad.set(key, (weekLoad.get(key) ?? 0) + slots.length);
  }

  const open: string[] = [];
  for (let date = earliest; date <= latest && open.length < count; date = addDays(date, 1)) {
    const onDay = taken.get(date) ?? [];
    if (stateOf(date, { earliest, latest }, onDay, weekLoad.get(weekStart(date)) ?? 0) === "open") {
      open.push(date);
    }
  }
  return open;
}

/** The month a freshly opened calendar should land on. */
export function openingMonth(): string {
  return monthOf(bookingWindow().earliest);
}

export { formatDayLong };
