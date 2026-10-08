"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  booking as bookingRules,
  packages,
  segmentBand,
  segmentById,
  serviceBySlug,
  studio,
} from "@/content/studio";
import type { Card as CardSpec } from "@/lib/cards";
import { formatBand, formatINR } from "@/lib/format";
import { addDays, formatDayLong, formatMonth, monthOf } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { BookingView } from "./types";

/**
 * The things the chat can show that are not sentences.
 *
 * A price band is a figure to be read at a glance, and a date is a thing to be
 * pointed at. Both were previously prose, and prose is the wrong instrument for
 * either: a customer scanning "between twenty-five and ninety-five thousand
 * depending on segment" has to do arithmetic to find out what their own car
 * costs, and a customer typing "maybe the 12th?" has to be understood by a
 * language model before anything can happen.
 *
 * So the assistant names what it wants shown (see lib/cards.ts) and these
 * render it. Every figure comes from content/studio.ts and every date comes
 * from the availability endpoint — the model supplies the intent, never the
 * data.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export type CardContext = {
  conversationId: string;
  /** The enquiry's segment, used when the model does not name one. */
  segment: string;
  /** Set once anything in this conversation is booked. Locks every calendar. */
  booked: BookingView | null;
  onBooked: (view: BookingView, message: string) => void;
};

/** Dispatches one directive to its renderer. */
export function CardBlock({
  card,
  live,
  context,
}: {
  card: CardSpec;
  /** False for a card further up the transcript: shown, but no longer actionable. */
  live: boolean;
  context: CardContext;
}) {
  switch (card.kind) {
    case "quote":
      return <QuoteCard service={card.service} segment={card.segment} />;
    case "packages":
      return <PackagesCard />;
    case "calendar":
      return <BookingCalendar live={live} context={context} />;
    case "slots":
      return <BookingCalendar live={live} context={context} initialDate={card.date} />;
    case "booking":
      return <Receipt refId={card.ref} context={context} />;
    default:
      return null;
  }
}

/* ── Shell ──────────────────────────────────────────────────────────────── */

function Shell({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn("surface-2 rounded-card w-full overflow-hidden", className)}
      aria-label={label}
    >
      {children}
    </motion.div>
  );
}

/** A spent card. Keeps its place in the transcript without inviting a tap. */
function Stub({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="surface-1 t-label rounded-field px-4 py-3 text-paper-faint"
    >
      {children}
    </motion.div>
  );
}

/** term / value on one line, the site's ledger idiom at chat scale. */
function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5">
      <dt className="t-label shrink-0 text-paper-faint">{term}</dt>
      <dd className="text-right text-[14.5px] leading-snug text-paper-dim">{children}</dd>
    </div>
  );
}

/* ── Quote ──────────────────────────────────────────────────────────────── */

/**
 * The price band, at the size a price deserves.
 *
 * Narrowed to the customer's own segment, because the full ₹25,000–₹95,000
 * spread is true of the service and useless to the person asking. The full
 * range stays on the card underneath, so narrowing never reads as hiding.
 */
function QuoteCard({ service: slug, segment: segmentId }: { service: string; segment: string }) {
  const service = serviceBySlug(slug);
  const segment = segmentById(segmentId);
  if (!service) return null;

  const band = segmentBand(service, segmentId);

  return (
    <Shell label={`${service.name} pricing`}>
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t-mono text-paper-faint">
            {service.code} · {service.name}
          </p>
          {segment ? (
            <span className="t-label rounded-pill bg-gold/15 px-2.5 py-0.5 text-gold-soft">
              {segment.label}
            </span>
          ) : null}
        </div>

        <p className="mt-4 font-display text-[clamp(1.55rem,6.2vw,2.1rem)] leading-none font-medium tracking-[-0.035em] text-paper tabular-nums">
          {formatINR(band.from)}
          <span className="px-1.5 text-paper-faint">–</span>
          {formatINR(band.to)}
        </p>
        <p className="t-label mt-2.5 text-paper-faint">
          {segment ? `For a ${segment.label} · ` : ""}inclusive of GST · exact figure
          after the inspection
        </p>

        <dl className="mt-5">
          <Row term="In the studio">{service.duration}</Row>
          <Row term="Warranty">{service.warranty}</Row>
          <Row term="Full range">{formatBand(service.priceFrom, service.priceTo)}</Row>
        </dl>

        <ul className="mt-5 space-y-2 border-t border-line pt-4">
          {service.includes.map((item) => (
            <li key={item} className="flex gap-2.5 text-[14.5px] leading-snug text-paper-dim">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold/70" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

/* ── Packages ───────────────────────────────────────────────────────────── */

function PackagesCard() {
  return (
    <Shell label="Packages">
      <div className="p-5 md:p-6">
        <p className="t-mono text-paper-faint">Packages · priced for a compact SUV</p>

        <div className="mt-4 space-y-2.5">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "rounded-field p-4",
                pkg.featured ? "surface-2" : "surface-1",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="t-label text-paper">{pkg.name}</p>
                <p className="font-display text-[1.35rem] leading-none font-medium tracking-[-0.03em] text-paper tabular-nums">
                  {formatINR(pkg.price)}
                </p>
              </div>
              <p className="mt-2 text-[14.5px] leading-snug text-paper-dim">{pkg.pitch}</p>
              {pkg.featured ? (
                <span className="t-mono mt-3 inline-block rounded-pill bg-gold/15 px-2.5 py-0.5 text-gold-soft">
                  Most taken
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <p className="t-label mt-4 border-t border-line pt-4 text-paper-faint">
          Other segments move the figure. Yours is quoted after the inspection.
        </p>
      </div>
    </Shell>
  );
}

/* ── Calendar ───────────────────────────────────────────────────────────── */

type Day = { date: string; state: "open" | "full" | "closed" | "unavailable"; taken: string[] };
type Slot = { id: string; label: string; note: string; available: boolean };

type MonthData = {
  month: string;
  days: (Day | null)[];
  previous: string | null;
  next: string | null;
  window: { earliest: string; latest: string };
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Date, then window, then confirmed — all in one card.
 *
 * Two separate cards for "pick a day" and "pick a time" would push the first
 * one off the top of a phone screen the moment the second arrived, and the
 * customer would be choosing a slot with the date no longer visible. So the
 * card advances in place: the grid collapses to the chosen date, the windows
 * take its place, and going back is one tap.
 *
 * None of this asks the model anything. The model offered the calendar; from
 * here it is the customer and the database.
 */
function BookingCalendar({
  live,
  context,
  initialDate,
}: {
  live: boolean;
  context: CardContext;
  initialDate?: string;
}) {
  /* Opens on the first month that holds a bookable date — not on this
     month, which in the last two days of it contains nothing at all. */
  const [month, setMonth] = useState(() =>
    monthOf(initialDate ?? addDays(todayish(), bookingRules.leadDays)),
  );
  const [data, setData] = useState<MonthData | null>(null);
  const [date, setDate] = useState<string | null>(initialDate ?? null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = Boolean(context.booked) || !live;

  /* Month grid. Refetched on every month change rather than cached, because a
     cached calendar is a calendar that offers a slot somebody already took. */
  useEffect(() => {
    if (date) return;
    let alive = true;
    setError(null);

    fetch(`/api/booking/availability?month=${month}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.error) setError(json.error);
        else setData(json as MonthData);
      })
      .catch(() => alive && setError("Could not load the calendar."));

    return () => {
      alive = false;
    };
  }, [month, date]);

  /* Windows for the chosen day. */
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlots(null);
    setError(null);

    fetch(`/api/booking/availability?date=${date}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.error) setError(json.error);
        else setSlots(json.slots as Slot[]);
      })
      .catch(() => alive && setError("Could not load the windows."));

    return () => {
      alive = false;
    };
  }, [date]);

  const confirm = useCallback(async () => {
    if (!date || !slot || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: context.conversationId, date, slot }),
      });
      const json = await res.json();
      if (!res.ok) {
        /* A lost race is recoverable in place: drop the stale window list and
           let them pick again rather than sending them back to the grid. */
        if (json.state === "taken") {
          setSlot(null);
          setSlots((prev) =>
            prev ? prev.map((s) => (s.id === slot ? { ...s, available: false } : s)) : prev,
          );
        }
        throw new Error(json.error ?? "Could not confirm that.");
      }
      context.onBooked(json.booking as BookingView, json.message.content as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm that.");
    } finally {
      setBusy(false);
    }
  }, [busy, context, date, slot]);

  /* Once something is booked, or once a newer card has superseded this one,
     the calendar stops being an instrument and becomes a record. It collapses
     rather than disappearing: a transcript that silently loses the calendar the
     customer used makes the conversation unreadable afterwards. */
  if (context.booked) {
    return (
      <Stub>
        Booked · {context.booked.dateLabel}, {context.booked.slotLabel}
      </Stub>
    );
  }
  if (!live) {
    return <Stub>Calendar · use the one below</Stub>;
  }

  return (
    <Shell label="Book a drop-off">
      <div className="p-5 md:p-6">
        <AnimatePresence mode="wait" initial={false}>
          {!date ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="t-mono text-paper-faint">Pick a drop-off date</p>
                <div className="flex items-center gap-1">
                  <Arrow
                    dir="prev"
                    disabled={!data?.previous || locked}
                    onClick={() => data?.previous && setMonth(data.previous)}
                  />
                  <Arrow
                    dir="next"
                    disabled={!data?.next || locked}
                    onClick={() => data?.next && setMonth(data.next)}
                  />
                </div>
              </div>

              <p className="mt-3 font-display text-[1.25rem] leading-none font-medium tracking-[-0.03em] text-paper">
                {formatMonth(month)}
              </p>

              <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden>
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="t-mono py-1 text-center text-paper-faint">
                    {d}
                  </span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
                {(data?.days ?? Array.from({ length: 35 }, () => null)).map((day, i) =>
                  day === null ? (
                    <span key={i} />
                  ) : (
                    <DayCell
                      key={day.date}
                      day={day}
                      disabled={locked}
                      onPick={() => {
                        setDate(day.date);
                        setSlot(null);
                      }}
                    />
                  ),
                )}
              </div>

              <p className="t-label mt-4 border-t border-line pt-4 text-paper-faint">
                Sundays by arrangement. Nine cars a week, so a full day is
                genuinely full — {bookingRules.leadDays} days&rsquo; notice lets us
                schedule the inspection.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="slots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="t-mono text-paper-faint">Drop-off window</p>
                  <p className="mt-2 font-display text-[1.25rem] leading-tight font-medium tracking-[-0.03em] text-paper">
                    {formatDayLong(date)}
                  </p>
                </div>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDate(null);
                      setSlot(null);
                      setSlots(null);
                    }}
                    className="t-label shrink-0 text-paper-faint underline underline-offset-4 transition-colors hover:text-paper"
                  >
                    Change date
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {(slots ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.available || locked || busy}
                    onClick={() => setSlot(s.id)}
                    aria-pressed={slot === s.id}
                    className={cn(
                      "press rounded-field px-3 py-3 text-left transition-colors",
                      slot === s.id
                        ? "bg-paper text-ink"
                        : "surface-1 text-paper hover:surface-3",
                      !s.available && "cursor-not-allowed opacity-30 line-through",
                    )}
                  >
                    <span className="block text-[15px] leading-none font-medium tabular-nums">
                      {s.label}
                    </span>
                    <span
                      className={cn(
                        "t-label mt-1 block",
                        slot === s.id ? "text-ink/60" : "text-paper-faint",
                      )}
                    >
                      {s.note}
                    </span>
                  </button>
                ))}
                {slots === null ? <SlotSkeleton /> : null}
              </div>

              <button
                type="button"
                disabled={!slot || busy || locked}
                onClick={confirm}
                className="press t-label mt-4 w-full rounded-pill bg-paper px-5 py-3.5 text-ink transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                {busy ? "Confirming…" : "Confirm this drop-off"}
              </button>

              <p className="t-label mt-3 text-center text-paper-faint">
                You will get the confirmation on WhatsApp.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <p role="alert" className="mt-3 text-[14px] leading-snug text-gold-soft">
            {error}
          </p>
        ) : null}
      </div>
    </Shell>
  );
}

function DayCell({
  day,
  disabled,
  onPick,
}: {
  day: Day;
  disabled: boolean;
  onPick: () => void;
}) {
  const open = day.state === "open" && !disabled;
  const number = Number(day.date.slice(-2));

  return (
    <button
      type="button"
      disabled={!open}
      onClick={onPick}
      aria-label={`${formatDayLong(day.date)}${open ? "" : " — not available"}`}
      className={cn(
        "press flex aspect-square items-center justify-center rounded-field text-[14.5px] tabular-nums transition-colors",
        open
          ? "surface-1 text-paper hover:bg-paper hover:text-ink"
          : "cursor-not-allowed text-paper-faint/45",
        /* A full day is struck through rather than merely dimmed: "we are
           genuinely booked" and "that date is not offered yet" are different
           facts, and the studio's whole pitch is that the first one is real. */
        day.state === "full" && "line-through decoration-gold/50",
      )}
    >
      {number}
    </button>
  );
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous month" : "Next month"}
      className="press surface-1 flex size-8 items-center justify-center rounded-pill text-paper-dim transition-colors hover:surface-3 hover:text-paper disabled:opacity-25"
    >
      <span aria-hidden className="text-[13px]">
        {dir === "prev" ? "←" : "→"}
      </span>
    </button>
  );
}

function SlotSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface-1 h-[62px] animate-pulse rounded-field" />
      ))}
    </>
  );
}

/* ── Receipt ────────────────────────────────────────────────────────────── */

/** Loads a booking by reference — used when the thread is reopened. */
function Receipt({ refId, context }: { refId: string; context: CardContext }) {
  const cached = context.booked?.ref === refId ? context.booked : null;
  const [view, setView] = useState<BookingView | null>(cached);

  useEffect(() => {
    if (view) return;
    let alive = true;
    fetch(`/api/booking?ref=${encodeURIComponent(refId)}`)
      .then((r) => r.json())
      .then((json) => alive && json.booking && setView(json.booking as BookingView))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refId, view]);

  if (!view) return null;
  return <ReceiptCard view={view} />;
}

function ReceiptCard({ view }: { view: BookingView }) {
  return (
    <Shell label={`Booking ${view.ref}`} className="surface-2">
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t-mono text-gold-soft">Confirmed</p>
          <span className="t-mono rounded-pill bg-gold/15 px-2.5 py-0.5 text-gold-soft">
            {view.ref}
          </span>
        </div>

        <p className="mt-4 font-display text-[clamp(1.35rem,5vw,1.8rem)] leading-tight font-medium tracking-[-0.03em] text-paper">
          {view.dateLabel}
        </p>
        <p className="mt-1 text-[16px] text-paper-dim tabular-nums">
          {view.slotLabel} drop-off
        </p>

        <dl className="mt-5">
          <Row term="Service">{view.serviceName}</Row>
          {view.vehicle ? <Row term="Vehicle">{view.vehicle}</Row> : null}
          {view.duration ? <Row term="In the studio">{view.duration}</Row> : null}
          {view.band ? <Row term="Band">{view.band}</Row> : null}
          <Row term="Studio">{studio.address}</Row>
        </dl>

        <p className="t-label mt-4 border-t border-line pt-4 text-paper-faint">
          {view.notified
            ? "Confirmation sent to your WhatsApp."
            : `We could not reach your WhatsApp just now — the booking stands. Call ${studio.phone} if you need to change it.`}
        </p>
      </div>
    </Shell>
  );
}

/* The client's idea of today. Only ever used to choose which month to open on;
   every real decision about a date is made on the server. */
function todayish(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export { ReceiptCard };
