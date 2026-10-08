import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Cloud API transport.
 *
 * This file only moves messages. The assistant's brain — knowledge.md plus the
 * customer's enquiry — is shared with the website chat and lives in
 * `deepseek.ts`. WhatsApp is a second surface, not a second bot.
 */

/* Overridable so the whole inbound -> reply loop can be exercised against a
   local stand-in without touching Meta. Defaults to the real Graph API. */
const GRAPH = process.env.WHATSAPP_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

export function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function endpoint(): string {
  return `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function call(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

/** A plain free-form message. Only legal inside the 24-hour service window. */
export async function sendText(to: string, body: string): Promise<void> {
  await call({
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

/**
 * Marks the customer's message read and shows the typing indicator.
 *
 * Both in one call, because that is the shape the API takes. It matters more
 * than it looks: a reply that arrives with no blue ticks and no typing dots
 * reads as machinery, and the indicator is what makes the pause before a
 * considered answer feel like someone writing rather than a request hanging.
 * The indicator clears itself after ~25s or when the next message lands.
 */
export async function markReadAndTyping(messageId: string): Promise<void> {
  await call({
    status: "read",
    message_id: messageId,
    typing_indicator: { type: "text" },
  }).catch((error) => {
    /* Never let presence cosmetics break the actual reply. */
    console.warn("[whatsapp] read/typing failed", error);
  });
}

/**
 * Confirms the request genuinely came from Meta.
 *
 * The webhook URL is public, so without this anyone who finds it can inject
 * fake inbound messages and drive the assistant — and the bill.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = header.slice("sha256=".length);

  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Meta sends `919825041200`; the database stores `9825041200`.
 *
 * The form already normalises to bare 10 digits, and matching the two is the
 * entire reason an inbound WhatsApp can resolve to the right enquiry. Get this
 * wrong and every customer looks like a stranger.
 */
export function toLocalPhone(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Splits a reply into the messages a person would actually send.
 *
 * The model is told to write short paragraphs; each becomes its own message.
 * A five-line answer arriving as one block is the loudest bot signal there is.
 */
export function toMessages(reply: string): string[] {
  const parts = reply
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  /* Merge a stray one-liner into its neighbour rather than firing a message
     containing three words — and never send more than three. */
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && (part.length < 25 || merged.length >= 3)) {
      merged[merged.length - 1] = `${previous}\n\n${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged.length ? merged : [reply.trim()];
}

/** Roughly how long a person would take to type this, in ms. */
export function typingDelay(text: string): number {
  const words = text.trim().split(/\s+/).length;
  /* ~55 wpm, floored so it never snaps, capped so nobody is left waiting. */
  return Math.min(4200, Math.max(700, Math.round((words / 55) * 60_000)));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Turns a stored 10-digit number into the wa_id Meta expects.
 *
 * The database holds `9825041200`; the Graph API wants `919825041200`. This is
 * the mirror of `toLocalPhone`, and the two have to stay exact inverses or an
 * inbound reply and an outbound confirmation land on different conversations.
 */
export function toWaId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * A pre-approved template message.
 *
 * This is the part of WhatsApp that surprises everyone: free-form text is only
 * legal inside 24 hours of the customer's last message to you. A booking made
 * on the website is almost never inside that window — the customer has never
 * messaged the business number at all — so `sendText` fails with error 131047
 * and the confirmation silently never arrives.
 *
 * A template is how you open a conversation the customer did not start. It has
 * to be written and approved in the WhatsApp Manager first, and the variables
 * are positional: `{{1}}` is the first element of `params`.
 */
export async function sendTemplate(
  to: string,
  name: string,
  params: string[],
  language = process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
): Promise<void> {
  await call({
    to,
    type: "template",
    template: {
      name,
      language: { code: language },
      components: params.length
        ? [
            {
              type: "body",
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  });
}

export type Delivery = {
  /** How it actually went out, or null if it did not. */
  via: "template" | "text" | null;
  error: string | null;
};

/**
 * Sends a message that opens a conversation, by whichever route is available.
 *
 * Template first when one is configured, because that is the only route
 * guaranteed to work outside the 24-hour window. Plain text second, because
 * during development there is usually no approved template yet and the test
 * number *is* inside the window — so the flow stays testable before the
 * template clears review.
 *
 * Never throws. A failed confirmation must not fail the booking: the customer
 * has a slot, the studio has the row, and an undelivered WhatsApp is a thing to
 * show on screen and retry, not a reason to lose the appointment.
 */
export async function sendOpening(
  to: string,
  { template, params, text }: { template?: string; params: string[]; text: string },
): Promise<Delivery> {
  if (!isConfigured()) {
    return { via: null, error: "WhatsApp is not configured on the server." };
  }

  const failures: string[] = [];

  if (template) {
    try {
      await sendTemplate(to, template, params);
      return { via: "template", error: null };
    } catch (error) {
      failures.push(`template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    await sendText(to, text);
    return { via: "text", error: failures.length ? failures.join(" | ") : null };
  } catch (error) {
    failures.push(`text: ${error instanceof Error ? error.message : String(error)}`);
    return { via: null, error: failures.join(" | ") };
  }
}

export type ListRow = { id: string; title: string; description?: string };

/**
 * An interactive list message — WhatsApp's own picker.
 *
 * This is how the website's calendar crosses over. A date cannot be tapped in a
 * WhatsApp text message, and asking a customer to type one back means parsing
 * "the 12th, late morning" with a language model and then booking a car on the
 * result. A list reply comes back as an exact row id, so the booking is built
 * from the same ids the web calendar uses and nothing has to be interpreted.
 *
 * Meta's limits, all of which silently reject the whole message when exceeded:
 * ten rows across all sections, 24 characters of title, 72 of description, 20
 * on the button, 200 on a row id.
 */
export async function sendList(
  to: string,
  {
    body,
    button,
    rows,
    header,
    footer,
  }: {
    body: string;
    button: string;
    rows: ListRow[];
    header?: string;
    footer?: string;
  },
): Promise<void> {
  await call({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(header ? { header: { type: "text", text: header.slice(0, 60) } } : {}),
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: button.slice(0, 20),
        sections: [
          {
            title: "Choose one",
            rows: rows.slice(0, 10).map((row) => ({
              id: row.id.slice(0, 200),
              title: row.title.slice(0, 24),
              ...(row.description
                ? { description: row.description.slice(0, 72) }
                : {}),
            })),
          },
        ],
      },
    },
  });
}
