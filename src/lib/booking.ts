import { db } from "@/lib/db";
import { formatDayLong, toDate } from "@/lib/calendar";
import {
  segmentBand,
  segmentById,
  serviceBySlug,
  slotById,
  studio,
} from "@/content/studio";
import { formatBand } from "@/lib/format";
import { toDirective } from "@/lib/cards";
import { sendOpening, toWaId, type Delivery } from "@/lib/whatsapp";

/**
 * Finalising a booking.
 *
 * Everything the customer is told at this moment is written here rather than
 * generated. A confirmation is the one message in the whole system that must be
 * identical every time, must contain the reference exactly as the database has
 * it, and must never be improvised — a model that paraphrases "Monday the 12th"
 * into "early next week" has turned a commitment back into a maybe.
 */

export type BookingView = {
  ref: string;
  date: string;
  dateLabel: string;
  slot: string;
  slotLabel: string;
  service: string;
  serviceName: string;
  segment: string;
  vehicle: string;
  duration: string;
  band: string;
  /** Whether the WhatsApp receipt actually left the building. */
  notified: boolean;
};

/**
 * A WhatsApp enquiry starts with its fields marked unknown — see
 * `resolveConversation` in the webhook route. Those placeholders are honest in
 * the database and nonsense on a receipt, so they are dropped at the boundary
 * rather than printed as "not given yet".
 */
const PLACEHOLDERS = new Set(["unknown", "not given yet", ""]);

function real(value: string): string {
  return PLACEHOLDERS.has(value.trim().toLowerCase()) ? "" : value;
}

export function toView(row: {
  ref: string;
  date: Date;
  slot: string;
  service: string;
  segment: string;
  vehicle: string;
  notifiedAt: Date | null;
}): BookingView {
  const date = row.date.toISOString().slice(0, 10);
  const service = serviceBySlug(row.service);
  const band = service ? segmentBand(service, row.segment) : null;


  return {
    ref: row.ref,
    date,
    dateLabel: formatDayLong(date),
    slot: row.slot,
    slotLabel: slotById(row.slot)?.label ?? row.slot,
    service: row.service,
    /* A booking can be made before the service is settled — a WhatsApp enquiry
       starts with the fields marked unknown, and the inspection is what decides
       the scope anyway. "unknown" on a receipt reads as a bug; this does not. */
    serviceName: service?.name ?? "Inspection and quote",
    segment: row.segment,
    vehicle: real(row.vehicle),
    duration: service?.duration ?? "",
    band: band ? formatBand(band.from, band.to) : "",
    notified: Boolean(row.notifiedAt),
  };
}

/**
 * The booking reference.
 *
 * Derived from the enquiry's reference rather than freshly random, so a
 * customer reading out "AUR-7Q2K4M-B" over the phone also hands the studio the
 * enquiry it came from. The counter only appears from the second booking on,
 * because `-B2` on a customer's only booking looks like a mistake.
 */
async function nextRef(enquiryRef: string, enquiryId: string): Promise<string> {
  const count = await db.booking.count({ where: { enquiryId } });
  return count === 0 ? `${enquiryRef}-B` : `${enquiryRef}-B${count + 1}`;
}

export class SlotTakenError extends Error {
  constructor() {
    super("That window has just been taken.");
    this.name = "SlotTakenError";
  }
}

export async function createBooking({
  conversationId,
  date,
  slot,
}: {
  conversationId: string;
  date: string;
  slot: string;
}): Promise<BookingView> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { customer: true, enquiry: true },
  });
  if (!conversation) throw new Error("Conversation not found.");

  const { customer, enquiry } = conversation;

  let row;
  try {
    row = await db.booking.create({
      data: {
        ref: await nextRef(enquiry.ref, enquiry.id),
        customerId: customer.id,
        enquiryId: enquiry.id,
        conversationId: conversation.id,
        date: toDate(date),
        slot,
        service: enquiry.service,
        segment: enquiry.segment,
        vehicle: enquiry.vehicle,
        notes: enquiry.message,
      },
    });
  } catch (error) {
    /* The unique index on (date, slot) is the real double-booking guard — the
       availability check that ran a moment ago was already stale by the time it
       returned. P2002 here means somebody else got this window first. */
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new SlotTakenError();
    }
    throw error;
  }

  await db.enquiry.update({ where: { id: enquiry.id }, data: { status: "QUOTED" } });

  const view = toView(row);
  const delivery = await notify(view, { name: customer.name, phone: customer.phone });

  const updated = await db.booking.update({
    where: { id: row.id },
    data: {
      notifiedAt: delivery.via ? new Date() : null,
      notifyError: delivery.error,
    },
  });

  return toView(updated);
}

/* ── What the customer is told ─────────────────────────────────────────── */

/** The WhatsApp receipt. Plain text, because a receipt is read, not browsed. */
export function receiptText(view: BookingView, name: string): string {
  const first = name.split(" ")[0] ?? name;

  /* Written as blocks rather than lines: on WhatsApp the blank line between
     groups is the entire layout system available, and a receipt that arrives as
     one paragraph is a receipt nobody checks. */
  const blocks = [
    `${first}, your drop-off at ${studio.fullName} is confirmed.`,
    [
      `Reference ${view.ref}`,
      `${view.dateLabel} · ${view.slotLabel} drop-off`,
      [view.serviceName, view.vehicle].filter(Boolean).join(" · "),
      view.duration ? `In the studio ${view.duration}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    studio.address,
    view.band
      ? `The exact figure comes after the inspection on the day. For your segment the band is ${view.band}.`
      : "We will gauge the paint and quote it in writing on the day.",
    `Reply here to move the date, or call ${studio.phone}.`,
  ];

  return blocks.join("\n\n");
}

/**
 * The studio's own line in the chat transcript.
 *
 * It carries the booking card directive so the receipt panel renders on the web
 * — and so a customer who reloads and resumes the thread still sees it, because
 * the directive is part of the stored message rather than client state.
 */
export function confirmationMessage(view: BookingView, notified: boolean): string {
  const lines = [
    `Booked. ${view.dateLabel}, ${view.slotLabel} drop-off${view.vehicle ? ` for the ${view.vehicle}` : ""}, reference ${view.ref}.`,
    "",
    toDirective({ kind: "booking", ref: view.ref }),
    "",
    notified
      ? "The confirmation is on its way to your WhatsApp. Bring the keys and the car as it is — we photograph it before anything is touched."
      : "I have it in the book. Bring the keys and the car as it is — we photograph it before anything is touched.",
  ];
  return lines.join("\n");
}

async function notify(
  view: BookingView,
  customer: { name: string; phone: string },
): Promise<Delivery> {
  const to = toWaId(customer.phone);
  const text = receiptText(view, customer.name);

  const delivery = await sendOpening(to, {
    template: process.env.WHATSAPP_BOOKING_TEMPLATE || undefined,
    /* Positional, matching the template body documented in
       docs/whatsapp-setup.md. Changing the order here without changing it
       there sends a customer somebody else's date. */
    params: [
      customer.name.split(" ")[0] ?? customer.name,
      view.ref,
      `${view.dateLabel}, ${view.slotLabel}`,
      view.serviceName,
      /* A template variable may never be empty — Meta rejects the whole send
         with error 132000 rather than leaving a blank. */
      view.vehicle || "to be confirmed",
      studio.phone,
    ],
    text,
  });

  if (delivery.error) console.warn("[booking] whatsapp receipt", view.ref, delivery.error);

  /* The studio's own alert. Optional, never fatal, and sent to a human's
     number rather than the business number — a WhatsApp business number
     cannot message itself. */
  const alert = process.env.WHATSAPP_STUDIO_ALERT_TO;
  if (alert) {
    await sendOpening(toWaId(alert), {
      template: process.env.WHATSAPP_ALERT_TEMPLATE || undefined,
      params: [
        view.ref,
        `${view.dateLabel}, ${view.slotLabel}`,
        view.vehicle || "to be confirmed",
        view.serviceName,
      ],
      text: `New booking — ${view.ref}\n${view.dateLabel}, ${view.slotLabel}\n${[view.serviceName, view.vehicle].filter(Boolean).join(" · ")}\n${customer.name}, +91 ${customer.phone}`,
    }).catch(() => {});
  }

  return delivery;
}

/** Segment label for a booking, for the run sheet and the card. */
export function segmentLabel(id: string): string {
  return segmentById(id)?.label ?? id;
}

/**
 * Drop-offs this customer still has ahead of them.
 *
 * Fed into the system prompt on both surfaces. Without it an assistant that
 * booked somebody yesterday cheerfully offers them the calendar again today,
 * because the only record of the booking was in a transcript it no longer has.
 */
export async function upcomingBookings(customerId: string) {
  const rows = await db.booking.findMany({
    where: {
      customerId,
      status: { in: ["CONFIRMED", "RESCHEDULED"] },
      /* Comparing against the UTC day keeps this on the same footing as the
         stored `@db.Date` — today's booking still counts as upcoming. */
      date: { gte: toDate(new Date().toISOString().slice(0, 10)) },
    },
    orderBy: { date: "asc" },
    take: 3,
  });

  return rows.map((row) => {
    const view = toView(row);
    return {
      ref: view.ref,
      dateLabel: view.dateLabel,
      slotLabel: view.slotLabel,
      serviceName: view.serviceName,
      vehicle: view.vehicle,
    };
  });
}
