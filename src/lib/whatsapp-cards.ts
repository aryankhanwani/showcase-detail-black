import {
  packages,
  segmentBand,
  segmentById,
  serviceBySlug,
  studio,
} from "@/content/studio";
import { dayAvailability, nextOpenDays } from "@/lib/availability";
import type { Card } from "@/lib/cards";
import { formatBand, formatINR } from "@/lib/format";
import { formatDayLong, formatDayShort } from "@/lib/calendar";
import { sendList, sendText } from "@/lib/whatsapp";

/**
 * Cards, on a surface that has no cards.
 *
 * The assistant is one brain with two mouths. It emits the same `::card`
 * directives whichever surface it is speaking on, and this is where they land
 * on WhatsApp: a price panel becomes a short written block, and a calendar
 * becomes WhatsApp's own list picker.
 *
 * The alternative — a second prompt that behaves differently on WhatsApp — is
 * how the two surfaces end up quoting different numbers. There is one knowledge
 * base and one set of figures, and the rendering is the only thing that forks.
 */

/* Row id prefixes. Short because a row id is capped at 200 characters and
   these are parsed back out of the customer's reply. */
export const DATE_ROW = "d:";
export const SLOT_ROW = "s:";

export type Interaction =
  | { kind: "date"; date: string }
  | { kind: "slot"; date: string; slot: string }
  | null;

/** Reads a list reply back into an intent. */
export function parseRowId(id: string): Interaction {
  if (id.startsWith(DATE_ROW)) {
    return { kind: "date", date: id.slice(DATE_ROW.length) };
  }
  if (id.startsWith(SLOT_ROW)) {
    const [date, slot] = id.slice(SLOT_ROW.length).split(":");
    if (date && slot) return { kind: "slot", date, slot };
  }
  return null;
}

/**
 * Sends one card.
 *
 * Returns the text that should be written into the transcript in its place —
 * the transcript holds the directive on the web, but on WhatsApp what the
 * customer actually received is the written version, and the model's next turn
 * should see what was really said.
 */
export async function sendCard(to: string, card: Card): Promise<string | null> {
  switch (card.kind) {
    case "quote":
      return sendQuote(to, card.service, card.segment);
    case "packages":
      return sendPackages(to);
    case "calendar":
      return sendDatePicker(to);
    case "slots":
      return sendSlotPicker(to, card.date);
    /* The receipt is sent by the booking itself, not by a directive. */
    case "booking":
      return null;
    default:
      return null;
  }
}

async function sendQuote(to: string, slug: string, segmentId: string): Promise<string | null> {
  const service = serviceBySlug(slug);
  const segment = segmentById(segmentId);
  if (!service) return null;

  const band = segmentBand(service, segmentId);

  const text = [
    `${service.name}${segment ? ` · ${segment.label}` : ""}`,
    `${formatBand(band.from, band.to)} inclusive of GST`,
    "",
    `In the studio: ${service.duration}`,
    `Warranty: ${service.warranty}`,
    "",
    service.includes.map((i) => `• ${i}`).join("\n"),
    "",
    "The exact figure comes after the panel inspection.",
  ].join("\n");

  await sendText(to, text);
  return text;
}

async function sendPackages(to: string): Promise<string> {
  const text = [
    "Packages, priced for a compact SUV:",
    "",
    ...packages.map(
      (pkg) =>
        `${pkg.name} — ${formatINR(pkg.price)}\n${pkg.pitch}${pkg.featured ? "\n(the one most people take)" : ""}`,
    ),
    "",
    "Your segment moves the figure, and the exact one comes after the inspection.",
  ].join("\n");

  await sendText(to, text);
  return text;
}

/**
 * The calendar, as a list of the days actually open.
 *
 * Ten rows is Meta's ceiling, so this offers the next few open days rather than
 * a month — which is arguably the better affordance anyway: nobody picking a
 * drop-off over WhatsApp wants to page through November.
 */
async function sendDatePicker(to: string): Promise<string> {
  const days = await nextOpenDays(9);

  if (!days.length) {
    const text = `We're full for the next few weeks — nine cars a week is a real ceiling. Call the studio on ${studio.phone} and we'll find you the first real date.`;
    await sendText(to, text);
    return text;
  }

  const rows = await Promise.all(
    days.map(async (date) => {
      const day = await dayAvailability(date);
      const open = day.slots.filter((s) => s.available).length;
      return {
        id: `${DATE_ROW}${date}`,
        title: formatDayShort(date),
        description: `${weekdayShort(date)} · ${open} ${open === 1 ? "window" : "windows"} open`,
      };
    }),
  );

  await sendList(to, {
    header: "Book a drop-off",
    body: "Pick the day you want to bring the car in. You'll choose a drop-off window next.",
    footer: "Mon–Sat · Sundays by arrangement",
    button: "Choose a date",
    rows,
  });

  return `Sent the available drop-off dates: ${days.map((d) => formatDayShort(d)).join(", ")}.`;
}

/** The windows for one day. */
export async function sendSlotPicker(to: string, date: string): Promise<string> {
  const day = await dayAvailability(date);
  const open = day.slots.filter((s) => s.available);

  if (!open.length) {
    const text = `${formatDayLong(date)} has just gone. Want me to show you the other dates?`;
    await sendText(to, text);
    return text;
  }

  await sendList(to, {
    header: formatDayLong(date).slice(0, 60),
    body: `What time do you want to drop the car off on ${formatDayLong(date)}?`,
    footer: "One car per window",
    button: "Choose a time",
    rows: open.map((slot) => ({
      id: `${SLOT_ROW}${date}:${slot.id}`,
      title: slot.label,
      description: slot.note,
    })),
  });

  return `Sent the drop-off windows for ${formatDayLong(date)}.`;
}

function weekdayShort(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
