import { NextResponse } from "next/server";
import {
  bookingWindow,
  dayAvailability,
  monthAvailability,
  openingMonth,
} from "@/lib/availability";
import { booking } from "@/content/studio";
import { addMonths, monthOf } from "@/lib/calendar";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { availabilitySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * What the calendar in the chat draws.
 *
 * `?month=YYYY-MM` returns the grid; `?date=YYYY-MM-DD` returns one day's
 * windows. No session is required — availability is not private, it is the same
 * thing a phone call would tell you — but it is rate-limited, because it is the
 * one endpoint here that hits the database on every month the customer pages
 * through.
 *
 * Months outside the booking horizon are refused rather than returned empty, so
 * the arrows in the UI have an authoritative answer about where to stop.
 */
export async function GET(req: Request) {
  const limit = rateLimit(`avail:${clientKey(req)}`, { limit: 60, windowMs: 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const url = new URL(req.url);
  const parsed = availabilitySchema.safeParse({
    month: url.searchParams.get("month") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Bad date." }, { status: 400 });
  }

  const window = bookingWindow();

  if (parsed.data.date) {
    const day = await dayAvailability(parsed.data.date);
    return NextResponse.json({ ...day, window }, { headers: NO_STORE });
  }

  const month = parsed.data.month ?? openingMonth();
  const first = monthOf(window.earliest);
  const last = monthOf(window.latest);

  if (month < first || month > last) {
    return NextResponse.json({ error: "The calendar does not go that far." }, { status: 400 });
  }

  const data = await monthAvailability(month);

  return NextResponse.json(
    {
      ...data,
      slots: booking.slots,
      /* The UI does not recompute the horizon — it is told which way it may
         still go, so the two can never disagree about the edge. */
      previous: month > first ? addMonths(month, -1) : null,
      next: month < last ? addMonths(month, 1) : null,
    },
    { headers: NO_STORE },
  );
}

/* Availability is stale the moment it is computed. Caching it books two cars
   into one bay. */
const NO_STORE = { "Cache-Control": "no-store" } as const;
