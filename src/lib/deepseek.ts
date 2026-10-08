import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { segmentBand, segments, serviceBySlug, studio } from "@/content/studio";
import { formatBand } from "@/lib/format";

/**
 * The AI receptionist.
 *
 * DeepSeek exposes an OpenAI-compatible API, so the official SDK is pointed at
 * their base URL rather than a bespoke fetch wrapper — it gets us streaming,
 * retries and typed errors for free.
 */

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

let client: OpenAI | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getClient(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Add it to .env.local — see .env.example.",
    );
  }
  client ??= new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
  return client;
}

/*
 * The knowledge base is a markdown file rather than a string constant so the
 * studio's facts can be edited without touching TypeScript. It is read once per
 * server process and cached — it is ~8 KB and never changes at runtime.
 */
let knowledgeCache: string | null = null;

async function loadKnowledge(): Promise<string> {
  if (knowledgeCache) return knowledgeCache;
  const file = path.join(process.cwd(), "src", "content", "knowledge.md");
  knowledgeCache = await readFile(file, "utf8");
  return knowledgeCache;
}

export type EnquiryContext = {
  ref: string;
  name: string;
  phone: string;
  email?: string | null;
  vehicle: string;
  segment: string;
  service: string;
  message?: string | null;
};

/** A booking that already exists, so the assistant stops offering to make one. */
export type BookingContext = {
  ref: string;
  dateLabel: string;
  slotLabel: string;
  serviceName: string;
  vehicle: string;
};

/** Prior enquiries, rendered for the model when a customer resumes. */
export type PriorContext = {
  ref: string;
  service: string;
  vehicle: string;
  createdAt: Date;
  transcript: { role: string; content: string }[];
};

/**
 * The studio's clock, in its own timezone.
 *
 * Server time is not Ahmedabad time — on Vercel it is UTC — so this is computed
 * in IST explicitly. Without it the assistant cheerfully implies someone is at
 * the desk at 3am, which is both the fastest way to break the illusion and a
 * false promise about when a callback will happen.
 */
function studioClock(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const time = `${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
  /* The ISO date is here for one reason: `::card slots date=YYYY-MM-DD` needs
     it, and a model guessing today's date books people into last month. */
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const minutes = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", minute: "numeric" }).format(now),
  );
  const clock = hour + minutes / 60;

  const sunday = weekday === "Sunday";
  const open = !sunday && clock >= 9.5 && clock < 19.5;

  const status = open
    ? "The studio is OPEN right now."
    : sunday
      ? "It is Sunday — the studio is CLOSED and only opens by appointment."
      : "The studio is CLOSED right now. It opens Mon-Sat, 9:30 AM to 7:30 PM.";

  return `It is ${weekday}, ${get("day")} ${get("month")} ${get("year")}, ${time} in Ahmedabad (today's date is ${today}). ${status}`;
}

function describeEnquiry(enquiry: EnquiryContext): string {
  const service = serviceBySlug(enquiry.service);
  const segment = segments.find((s) => s.id === enquiry.segment);

  const lines = [
    `Reference: ${enquiry.ref}`,
    `Name: ${enquiry.name}`,
    `Phone: +91 ${enquiry.phone}`,
    enquiry.email ? `Email: ${enquiry.email}` : null,
    `Vehicle: ${enquiry.vehicle}`,
    segment ? `Segment: ${segment.label} (${segment.example})` : null,
    service
      ? `Service asked about: ${service.name} (slug ${service.slug}) — full band ${formatBand(service.priceFrom, service.priceTo)}, ${service.duration}, ${service.warranty}`
      : null,
    /* The figure the quote card will actually show. Given to the model so its
       one line of introduction agrees with the panel underneath it — the card
       is the source of truth, and this is how the prose stays in step. */
    service && segment
      ? (() => {
          const band = segmentBand(service, enquiry.segment);
          return `For their segment the card will show ${formatBand(band.from, band.to)} — do not retype that figure, place the card.`;
        })()
      : null,
    enquiry.message ? `What they wrote: "${enquiry.message}"` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Builds the system prompt: the knowledge base, then this specific customer.
 *
 * The enquiry block is appended *after* the knowledge base and framed as facts
 * you already hold, because the single most common failure mode of a form-fed
 * chatbot is opening by asking for the car it was just told about.
 */
export async function buildSystemPrompt({
  enquiry,
  prior,
  bookings,
}: {
  enquiry: EnquiryContext;
  prior?: PriorContext | null;
  /** Confirmed drop-offs still ahead of them. */
  bookings?: BookingContext[];
}): Promise<string> {
  const knowledge = await loadKnowledge();

  let prompt = `${knowledge}

---

# The customer you are talking to right now

You already know all of this. It came from the form they just filled in.
Do not ask them to repeat any of it.

${describeEnquiry(enquiry)}

${studioClock()}

Your first reply should acknowledge their actual car and their actual question
and give them something useful immediately — the relevant price band for their
segment, or the direct answer to what they wrote. Do not open with a greeting
that says nothing.`;

  /* A customer who is already booked must never be offered a calendar again.
     The model cannot know this from the transcript alone — the booking may have
     been made in an earlier session, or on the other surface entirely. */
  if (bookings?.length) {
    prompt += `

---

# This customer already has a drop-off booked

${bookings
  .map(
    (b) =>
      `${b.ref} — ${b.dateLabel}, ${b.slotLabel} drop-off. ${b.serviceName} on the ${b.vehicle}.`,
  )
  .join("\n")}

Treat this as settled. Do not show the calendar again and do not ask them when
they would like to come in. If they want to move or cancel it, you cannot do
either — say the studio will sort it out and give them the number.`;
  }

  if (prior) {
    const history = prior.transcript
      .map((m) => `${m.role === "USER" ? "Customer" : "You"}: ${m.content}`)
      .join("\n");

    prompt += `

---

# This customer is returning, and chose to continue their earlier enquiry

Earlier enquiry ${prior.ref} — ${prior.vehicle}, ${prior.service}, opened ${prior.createdAt.toLocaleDateString("en-IN", { dateStyle: "long" })}.

What was said last time:
${history || "(no messages were exchanged)"}

Pick up where that stopped. Refer back to it naturally rather than restarting
the conversation, and do not re-ask anything already settled above.`;
  }

  return prompt;
}

/** The studio's own opening line when a returning customer is detected. */
export function returningPrompt(prior: {
  ref: string;
  vehicle: string;
  service: string;
  createdAt: Date;
}): string {
  const when = prior.createdAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
  });
  return `Good to hear from you again. We already have an enquiry from you — ${prior.ref}, about ${prior.service.toLowerCase()} for your ${prior.vehicle}, opened on ${when}.

Do you want to carry on with that one, or start fresh with this new enquiry?`;
}

export const CHAT_PARAMS = {
  model: DEEPSEEK_MODEL,
  temperature: 0.6,
  /* The knowledge base tells the model to answer in two or three sentences.
     This is the hard stop that keeps a runaway reply from filling the pane. */
  max_tokens: 700,
} as const;

export const STUDIO_PHONE = studio.phone;

/**
 * A single, non-streamed completion.
 *
 * WhatsApp has no concept of a partial message, so the streaming path the
 * website uses does not apply — the typing indicator plays that role instead.
 * Same model, same parameters, same system prompt; only the delivery differs.
 */
export async function complete(
  system: string,
  history: { role: "user" | "assistant"; content: string }[],
  message: string,
): Promise<string> {
  const res = await getClient().chat.completions.create({
    ...CHAT_PARAMS,
    stream: false,
    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: message },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}
