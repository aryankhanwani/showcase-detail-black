import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  CHAT_PARAMS,
  buildSystemPrompt,
  getClient,
  isConfigured,
  type PriorContext,
} from "@/lib/deepseek";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { authorizeConversation } from "@/lib/session";
import { chatMessageSchema } from "@/lib/validation";
import { serviceBySlug } from "@/content/studio";

/* Node runtime: the prompt builder reads knowledge.md off disk. */
export const runtime = "nodejs";

/**
 * Streams a reply, then persists it.
 *
 * The assistant message is written after the stream closes rather than
 * optimistically before it, so an aborted or failed generation never leaves a
 * half-sentence in the transcript that the next turn would then treat as
 * something the studio actually said.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`chat:${clientKey(req)}`, { limit: 30, windowMs: 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Type a message." }, { status: 400 });
  }
  const { conversationId, opening } = parsed.data;
  const message = parsed.data.message ?? "";

  /* The cookie, not the id in the body, is what grants access. */
  const session = await authorizeConversation(conversationId);
  if (!session) {
    return NextResponse.json({ error: "This conversation is not yours." }, { status: 403 });
  }

  /* Configuration is checked only after authorisation. Answering 503 first
     would tell an unauthenticated caller whether the studio has an AI key
     configured — a small leak, but a free one to close. */
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "The assistant is not configured yet. Add DEEPSEEK_API_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      enquiry: true,
      customer: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  /* A resumed thread carries the earlier transcript into the system prompt so
     the model can genuinely pick up where it stopped. */
  let prior: PriorContext | null = null;
  if (conversation.resumedFromId) {
    const previous = await db.conversation.findUnique({
      where: { id: conversation.resumedFromId },
      include: {
        enquiry: true,
        messages: { orderBy: { createdAt: "asc" }, take: 40 },
      },
    });
    if (previous) {
      prior = {
        ref: previous.enquiry.ref,
        service: serviceBySlug(previous.enquiry.service)?.name ?? previous.enquiry.service,
        vehicle: previous.enquiry.vehicle,
        createdAt: previous.enquiry.createdAt,
        transcript: previous.messages.map((m) => ({ role: m.role, content: m.content })),
      };
    }
  }

  const system = await buildSystemPrompt({
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
    prior,
  });

  /* An opening turn has no user message to persist — the form already is the
     customer's first move, and writing a fake user line would put words in
     their mouth that the model would then quote back at them. */
  if (!opening) {
    await db.message.create({
      data: { conversationId, role: "USER", content: message },
    });
  }

  const history = conversation.messages.map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  /* DeepSeek requires the final message to be a user turn. On an opening the
     nudge stands in for one and is never shown or stored. */
  const turn = opening
    ? "(The customer has just submitted the enquiry form and is waiting. Open the conversation.)"
    : message;

  try {
    const completion = await getClient().chat.completions.create({
      ...CHAT_PARAMS,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: turn },
      ],
    });

    const encoder = new TextEncoder();
    let full = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (!delta) continue;
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          console.error("[chat] stream failed", error);
          if (!full) {
            controller.enqueue(
              encoder.encode(
                "Something went wrong on our side. Call the studio and we will pick it up there.",
              ),
            );
          }
        } finally {
          controller.close();

          if (full.trim()) {
            await db.message
              .create({
                data: { conversationId, role: "ASSISTANT", content: full },
              })
              .catch((error) => console.error("[chat] persist failed", error));
            await db.conversation
              .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
              .catch(() => {});
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        /* Stops nginx and friends buffering the stream into one lump. */
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[chat] request failed", error);
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Please call the studio." },
      { status: 502 },
    );
  }
}
