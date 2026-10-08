import { after, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import {
  SlotTakenError,
  confirmationMessage,
  createBooking,
  upcomingBookings,
} from "@/lib/booking";
import { dayAvailability } from "@/lib/availability";
import { splitSegments, toDirective } from "@/lib/cards";
import { formatDayLong } from "@/lib/calendar";
import { studio } from "@/content/studio";
import { buildSystemPrompt, complete, isConfigured as aiReady } from "@/lib/deepseek";
import { parseRowId, sendCard, sendSlotPicker } from "@/lib/whatsapp-cards";
import {
  isConfigured as waReady,
  markReadAndTyping,
  sendText,
  sleep,
  toLocalPhone,
  toMessages,
  typingDelay,
  verifySignature,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/**
 * Meta's subscription handshake. Called once when you set the webhook URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Inbound WhatsApp messages.
 *
 * Meta must get its 200 within seconds or it retries — and a retry means the
 * customer is answered twice. So the reply is generated *after* the response is
 * sent, via `after()`, and every inbound message is deduped on Meta's own id
 * so a retry that slips through still cannot double-send.
 */
export async function POST(req: Request) {
  /* The raw body, not the parsed one: the signature is over exact bytes. */
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const value = payload.entry?.[0]?.changes?.[0]?.value;

  /* Delivery receipts. Meta accepting a message and Meta *delivering* one are
     different events, and only this one knows the difference — a send can come
     back with a message id and then be dropped (an unverified recipient on a
     test number does exactly that, silently). Failures are logged rather than
     swallowed so there is something to read when a customer says the
     confirmation never arrived. */
  for (const status of value?.statuses ?? []) {
    if (status.status !== "failed") continue;
    for (const error of status.errors ?? []) {
      console.error(
        `[whatsapp] delivery FAILED to ${status.recipient_id} — ${error.code} ${error.title}` +
          (error.error_data?.details ? `: ${error.error_data.details}` : ""),
      );
    }
    if (!status.errors?.length) {
      console.error(`[whatsapp] delivery FAILED to ${status.recipient_id} (no reason given)`);
    }
  }

  const message = value?.messages?.[0];

  /* Two kinds of inbound matter: something the customer typed, and something
     the customer tapped. A tap is a list reply from a picker this route sent,
     and it carries an exact row id — which is how a WhatsApp booking lands on
     the same date and window ids the web calendar uses, with nothing parsed out
     of prose in between. */
  const reply = message?.interactive?.list_reply ?? message?.interactive?.button_reply;
  const body = message?.type === "text" ? message.text?.body : reply?.title;

  /* Delivery receipts and read receipts arrive here too. Acknowledge and drop.
     `from` is checked as well as the body: a message with no sender cannot be
     resolved to a customer, and letting one through creates a conversation
     keyed on an empty phone number that nothing can ever reach. */
  if (!message || !body || !message.from) {
    return NextResponse.json({ ok: true });
  }

  const inbound = {
    externalId: message.id,
    from: message.from,
    body,
    /* Present only on a tap. */
    rowId: reply?.id ?? null,
    profileName: value?.contacts?.[0]?.profile?.name ?? null,
  };

  after(async () => {
    try {
      await handle(inbound);
    } catch (error) {
      console.error("[whatsapp] handler failed", error);
    }
  });

  return NextResponse.json({ ok: true });
}

type Inbound = {
  externalId: string;
  from: string;
  body: string;
  rowId: string | null;
  profileName: string | null;
};

async function handle({ externalId, from, body, rowId, profileName }: Inbound) {
  if (!waReady() || !aiReady()) {
    console.warn("[whatsapp] not configured — set WHATSAPP_* and DEEPSEEK_API_KEY");
    return;
  }

  /* Dedupe first, and by insert rather than by lookup: two concurrent
     deliveries of the same id both pass a SELECT, but only one survives the
     unique index. */
  const phone = toLocalPhone(from);
  const conversation = await resolveConversation(phone, profileName);

  try {
    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: body,
        channel: "WHATSAPP",
        externalId,
      },
    });
  } catch {
    return; // already handled by a previous delivery of this webhook
  }

  await markReadAndTyping(externalId);

  /* A tap on a picker is not a question. It is an instruction with exactly one
     meaning, and routing it through the model would mean asking a language
     model to re-derive a decision the customer already made unambiguously. */
  const interaction = rowId ? parseRowId(rowId) : null;
  if (interaction) {
    await handleInteraction(conversation.id, from, interaction);
    return;
  }

  const history = conversation.messages.map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  const system = await buildSystemPrompt({
    bookings: await upcomingBookings(conversation.customerId),
    enquiry: {
      ref: conversation.enquiry.ref,
      name: conversation.customer.name,
      phone: conversation.customer.phone,
      email: conversation.customer.email,
      vehicle: conversation.enquiry.vehicle,
      segment: conversation.enquiry.segment,
      service: conversation.enquiry.service,
      message: conversation.enquiry.message,
    },
  });

  const reply = await complete(system, history, body);
  if (!reply) return;

  await deliver(conversation.id, from, reply);
}

/** Records something the studio said on WhatsApp. */
async function said(conversationId: string, content: string) {
  await db.message.create({
    data: { conversationId, role: "ASSISTANT", content, channel: "WHATSAPP" },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Sends one reply, text and cards in the order they were written.
 *
 * Text is chunked and paced so it reads as someone typing rather than a block
 * landing all at once (see docs/whatsapp-integration-plan.pdf §03). A card
 * interrupts that run: whatever text preceded it goes out first, then the card,
 * so "here's where a compact SUV lands" never arrives after the figures it was
 * introducing.
 *
 * What is stored is the directive, not the rendering — the transcript has to
 * mean the same thing on both surfaces, and the directive is the thing that
 * re-renders correctly on either.
 */
async function deliver(conversationId: string, to: string, reply: string) {
  let run: string[] = [];

  const flushText = async () => {
    if (!run.length) return;
    for (const part of toMessages(run.join("\n\n"))) {
      await sleep(typingDelay(part));
      await sendText(to, part);
      await said(conversationId, part);
    }
    run = [];
  };

  for (const segment of splitSegments(reply)) {
    if (segment.kind === "text") {
      run.push(segment.text);
      continue;
    }
    await flushText();
    try {
      const sent = await sendCard(to, segment.card);
      if (sent !== null) await said(conversationId, segment.text);
    } catch (error) {
      /* A card that will not send must not take the conversation with it. */
      console.error("[whatsapp] card failed", segment.card.kind, error);
    }
  }

  await flushText();
}

/**
 * A tap on a date or a drop-off window.
 *
 * This is the WhatsApp half of the booking flow, and it is deliberately the
 * same two steps as the web card: choose a day, then choose a window, then it
 * is real. The model is not consulted at either step — the row ids came from
 * this server, so there is nothing to interpret and nothing to get wrong.
 */
async function handleInteraction(
  conversationId: string,
  to: string,
  interaction: NonNullable<ReturnType<typeof parseRowId>>,
) {
  if (interaction.kind === "date") {
    await sendSlotPicker(to, interaction.date);
    await said(conversationId, toDirective({ kind: "slots", date: interaction.date }));
    return;
  }

  const { date, slot } = interaction;

  /* Re-checked here because the picker the customer tapped may have been sent
     an hour ago, and a window taken since then is the normal case, not the
     exception. */
  const day = await dayAvailability(date);
  if (day.state !== "open" || !day.slots.find((s) => s.id === slot)?.available) {
    const text = `${formatDayLong(date)} at that time has just gone. Tell me when else suits and I'll show you what's open.`;
    await sendText(to, text);
    await said(conversationId, text);
    return;
  }

  try {
    const view = await createBooking({ conversationId, date, slot });
    /* The receipt itself went out from createBooking. This is the line that
       belongs in the conversation. */
    await said(conversationId, confirmationMessage(view, view.notified));
  } catch (error) {
    const text =
      error instanceof SlotTakenError
        ? "Somebody took that window a moment before you. Tell me another time and I'll check it."
        : `Something went wrong confirming that. Call the studio on ${studio.phone} and we'll book it properly.`;
    if (!(error instanceof SlotTakenError)) {
      console.error("[whatsapp] booking failed", error);
    }
    await sendText(to, text);
    await said(conversationId, text);
  }
}

/**
 * Finds the customer's live conversation, or opens one.
 *
 * A number that already filled the form resolves to their enquiry and the
 * assistant knows their car immediately — that is the whole point of
 * normalising phone numbers at the door. An unknown number still gets a
 * conversation so the thread accumulates context; the enquiry is created with
 * its fields marked unknown rather than invented, because a guessed vehicle is
 * worse than no vehicle.
 */
async function resolveConversation(phone: string, profileName: string | null) {
  const existing = await db.conversation.findFirst({
    where: { customer: { phone } },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      enquiry: true,
      messages: { orderBy: { createdAt: "asc" }, take: 40 },
    },
  });
  if (existing) return existing;

  const customer = await db.customer.upsert({
    where: { phone },
    update: {},
    create: { name: profileName ?? "WhatsApp enquiry", phone },
  });

  const enquiry = await db.enquiry.create({
    data: {
      ref: `AUR-${nanoid()}`,
      customerId: customer.id,
      segment: "unknown",
      vehicle: "not given yet",
      service: "unknown",
      source: "whatsapp",
      status: "IN_CONVERSATION",
    },
  });

  const created = await db.conversation.create({
    data: { customerId: customer.id, enquiryId: enquiry.id },
    include: {
      customer: true,
      enquiry: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  return created;
}

/* Only the slice of Meta's webhook shape this route actually reads. */
type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string } }[];
        statuses?: {
          id: string;
          status: string;
          recipient_id: string;
          errors?: {
            code: number;
            title: string;
            error_data?: { details?: string };
          }[];
        }[];
        messages?: {
          id: string;
          from: string;
          type: string;
          text?: { body: string };
          interactive?: {
            type?: string;
            list_reply?: { id: string; title: string };
            button_reply?: { id: string; title: string };
          };
        }[];
      };
    }[];
  }[];
};
