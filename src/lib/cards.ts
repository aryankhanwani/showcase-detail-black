import { segmentById, serviceBySlug } from "@/content/studio";
import { isValidYmd } from "@/lib/calendar";

/**
 * The card protocol.
 *
 * The assistant answers in text, but some answers are not text. A price band is
 * a figure that wants to be read at a glance, not a sentence; a date is a thing
 * you point at, not a thing you spell out and hope the model parses back. So
 * the model is allowed to emit a directive on its own line —
 *
 *     ::card quote service=ceramic-coating segment=compact-suv
 *
 * — and the surface renders it as whatever that surface can render. On the web
 * that is a price panel or a calendar the customer taps. On WhatsApp it becomes
 * written lines, because WhatsApp has no grid.
 *
 * Why directives rather than the model's tool-calling: the website reply is
 * streamed token by token into a typing animation, and a tool call cannot be
 * streamed — it arrives as a separate, complete, non-text event, which would
 * mean either dropping streaming or running two requests per turn. A directive
 * is just text, so it rides the same stream as everything else, and the parser
 * only has to hold back one line.
 *
 * The figures themselves are never in the directive. The model names a service
 * and a segment; the price comes from content/studio.ts. A model that cannot
 * state a number cannot get a number wrong.
 */

export type Card =
  /** The band for one service on one segment, read large. */
  | { kind: "quote"; service: string; segment: string }
  /** All three packages, side by side. */
  | { kind: "packages" }
  /** A month grid the customer books from. */
  | { kind: "calendar" }
  /** Drop-off windows for a day already settled. */
  | { kind: "slots"; date: string }
  /** The receipt for a booking that exists. */
  | { kind: "booking"; ref: string };

export type CardKind = Card["kind"];

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "card"; card: Card; text: string };

/* A directive owns its whole line. Leading whitespace is tolerated because
   models indent for no reason, and a stray indent must not print `::card` into
   a chat bubble. */
const DIRECTIVE = /^[ \t>*-]*::card\b(.*)$/i;

function attributes(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  /* key=value, or a bare word which becomes the kind. Quotes allowed so a
      value can hold a space, even though none currently need to. */
  for (const match of rest.matchAll(/([a-z_]+)=("[^"]*"|'[^']*'|\S+)/gi)) {
    out[match[1]!.toLowerCase()] = match[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * Reads one directive line into a card, or returns null.
 *
 * Validation is strict and silent on purpose. An unknown service slug means the
 * model invented one, and the right response to that is to show the customer
 * nothing rather than an empty panel or the literal text `::card quote`.
 */
export function parseDirective(line: string): Card | null {
  const match = DIRECTIVE.exec(line);
  if (!match) return null;

  const rest = match[1] ?? "";
  const kind = rest.trim().split(/[\s]+/)[0]?.toLowerCase() ?? "";
  const attrs = attributes(rest);

  switch (kind) {
    case "quote": {
      const service = attrs.service ?? "";
      const segment = attrs.segment ?? "";
      if (!serviceBySlug(service) || !segmentById(segment)) return null;
      return { kind: "quote", service, segment };
    }
    case "packages":
      return { kind: "packages" };
    case "calendar":
      return { kind: "calendar" };
    case "slots": {
      const date = attrs.date ?? "";
      if (!isValidYmd(date)) return null;
      return { kind: "slots", date };
    }
    case "booking": {
      const ref = attrs.ref ?? "";
      if (!/^[A-Z0-9-]{4,24}$/i.test(ref)) return null;
      return { kind: "booking", ref: ref.toUpperCase() };
    }
    default:
      return null;
  }
}

export function isDirectiveLine(line: string): boolean {
  return DIRECTIVE.test(line);
}

/**
 * Splits a reply into the sequence of things to render.
 *
 * Text is split on blank lines, as it always was — each paragraph becomes its
 * own chat message a beat apart. A directive line breaks the paragraph it sits
 * in, so the model putting a card mid-sentence still produces a clean card
 * rather than a bubble with half a sentence and a code fragment in it.
 */
export function splitSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join("\n");
    buffer = [];
    for (const para of joined.split(/\n\s*\n/)) {
      const trimmed = para.trim();
      if (trimmed) out.push({ kind: "text", text: trimmed });
    }
  };

  for (const line of text.split("\n")) {
    if (!isDirectiveLine(line)) {
      buffer.push(line);
      continue;
    }
    flush();
    const card = parseDirective(line);
    /* An unparseable directive is dropped, not printed. */
    if (card) out.push({ kind: "card", card, text: line.trim() });
  }
  flush();

  return out;
}

/** The reply with every directive removed. For transcripts and for WhatsApp. */
export function stripDirectives(text: string): string {
  return text
    .split("\n")
    .filter((line) => !isDirectiveLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every card in a reply, in order. */
export function cardsIn(text: string): Card[] {
  return splitSegments(text)
    .filter((s): s is Extract<Segment, { kind: "card" }> => s.kind === "card")
    .map((s) => s.card);
}

/** Writes a card back to its directive form. Used to append one server-side. */
export function toDirective(card: Card): string {
  switch (card.kind) {
    case "quote":
      return `::card quote service=${card.service} segment=${card.segment}`;
    case "slots":
      return `::card slots date=${card.date}`;
    case "booking":
      return `::card booking ref=${card.ref}`;
    default:
      return `::card ${card.kind}`;
  }
}
