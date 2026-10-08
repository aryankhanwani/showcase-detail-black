import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayAvailability } from "@/lib/availability";
import {
  SlotTakenError,
  confirmationMessage,
  createBooking,
  toView,
} from "@/lib/booking";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { authorizeConversation, getChatSession } from "@/lib/session";
import { bookingSchema } from "@/lib/validation";

export const runtime = "nodejs";
/* The WhatsApp receipt goes out inline, so this request owns a round trip to
   Meta as well as the write. */
export const maxDuration = 30;

/**
 * Finalises a booking.
 *
 * The chat does not ask the model to book anything. The model offers the
 * calendar; the customer taps a date and a window; this route is what makes it
 * real. That split is deliberate — a booking is a commitment, and a commitment
 * must not depend on a language model having parsed "the 12th, late morning"
 * the way the customer meant it.
 *
 * The confirmation written back into the transcript is also fixed text, not a
 * generated reply, for the same reason. The model sees it on the next turn and
 * can talk about it; it never gets to author it.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`booking:${clientKey(req)}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Call the studio and we will sort it out." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Pick a date and a window." },
      { status: 400 },
    );
  }

  const { conversationId, date, slot } = parsed.data;

  const session = await authorizeConversation(conversationId);
  if (!session) {
    return NextResponse.json({ error: "This conversation is not yours." }, { status: 403 });
  }

  /* Checked here as well as at the index, because a clear message beats a
     constraint violation for every reason a slot can be unavailable other than
     the race — a Sunday, a date inside the lead time, a full week. */
  const day = await dayAvailability(date);
  if (day.state !== "open") {
    return NextResponse.json(
      { error: reasonFor(day.state), state: day.state },
      { status: 409 },
    );
  }
  if (!day.slots.find((s) => s.id === slot)?.available) {
    return NextResponse.json(
      { error: "That window has just been taken. Pick another.", state: "taken" },
      { status: 409 },
    );
  }

  try {
    const view = await createBooking({ conversationId, date, slot });
    const message = confirmationMessage(view, view.notified);

    /* Written as the studio's own message so it is in the transcript the model
       reads next turn, and so it survives a reload. */
    const row = await db.message.create({
      data: { conversationId, role: "ASSISTANT", content: message },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      booking: view,
      message: { id: row.id, role: "ASSISTANT" as const, content: message },
    });
  } catch (error) {
    if (error instanceof SlotTakenError) {
      return NextResponse.json({ error: error.message, state: "taken" }, { status: 409 });
    }
    console.error("[booking] failed", error);
    return NextResponse.json(
      { error: "We could not confirm that. Please call the studio." },
      { status: 500 },
    );
  }
}

/**
 * Reads one booking back.
 *
 * The receipt card is rendered from a `::card booking ref=…` directive stored
 * in the transcript, so a customer returning to the thread needs the row again
 * rather than the client's memory of it.
 */
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "No reference." }, { status: 400 });

  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Not yours." }, { status: 403 });

  const row = await db.booking.findUnique({ where: { ref: ref.toUpperCase() } });

  /* Scoped to the browser's own customer, not just to a valid reference —
     references are sequential against an enquiry and therefore guessable. */
  if (!row || row.customerId !== session.customerId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ booking: toView(row) }, { headers: { "Cache-Control": "no-store" } });
}

function reasonFor(state: string): string {
  switch (state) {
    case "closed":
      return "The studio is closed on Sundays — that one is by arrangement only.";
    case "full":
      return "That day is full. We only take nine cars a week.";
    case "unavailable":
      return "We need two days' notice to schedule the inspection. Pick a later date.";
    default:
      return "That date is not available.";
  }
}
