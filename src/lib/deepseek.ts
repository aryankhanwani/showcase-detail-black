import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { segments, serviceBySlug, studio } from "@/content/studio";
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

/** Prior enquiries, rendered for the model when a customer resumes. */
export type PriorContext = {
  ref: string;
  service: string;
  vehicle: string;
  createdAt: Date;
  transcript: { role: string; content: string }[];
};

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
      ? `Service asked about: ${service.name} — band ${formatBand(service.priceFrom, service.priceTo)}, ${service.duration}, ${service.warranty}`
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
}: {
  enquiry: EnquiryContext;
  prior?: PriorContext | null;
}): Promise<string> {
  const knowledge = await loadKnowledge();

  let prompt = `${knowledge}

---

# The customer you are talking to right now

You already know all of this. It came from the form they just filled in.
Do not ask them to repeat any of it.

${describeEnquiry(enquiry)}

Today is ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}.

Your first reply should acknowledge their actual car and their actual question
and give them something useful immediately — the relevant price band for their
segment, or the direct answer to what they wrote. Do not open with a greeting
that says nothing.`;

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
