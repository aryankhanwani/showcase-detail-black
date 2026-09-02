import { customAlphabet } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { returningPrompt } from "@/lib/deepseek";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { setChatSession } from "@/lib/session";
import { enquirySchema } from "@/lib/validation";
import { serviceBySlug } from "@/content/studio";

/* No ambiguous glyphs — this reference gets read out over the phone. */
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/**
 * Creates an enquiry and opens the conversation that replaces the form.
 *
 * The returning-customer branch is the interesting part: a customer is matched
 * on phone *or* email, and if they have enquired before, the conversation opens
 * with the studio's own message offering to resume — written here rather than
 * generated, because "do you want to continue?" must be identical every time
 * and must never be something the model can hallucinate around.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`enquiry:${clientKey(req)}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many enquiries from this connection. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return NextResponse.json({ error: "Check the form.", fieldErrors }, { status: 400 });
  }

  const { name, phone, email, segment, vehicle, service, message, source } = parsed.data;

  try {
    /* Match on either identifier — someone who enquired by phone last time may
       type only an email this time, and they are still the same person. */
    const existing = await db.customer.findFirst({
      where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
    });

    let customer;
    if (existing) {
      /* Only claim the email if it is free. Writing it blindly would collide
         with the unique index whenever two people share a phone but not a
         mailbox, and fail the whole submission on a detail nobody cares about. */
      const emailIsFree =
        email && !existing.email
          ? !(await db.customer.findFirst({
              where: { email, id: { not: existing.id } },
              select: { id: true },
            }))
          : false;

      customer = await db.customer.update({
        where: { id: existing.id },
        data: { name, ...(emailIsFree ? { email } : {}) },
      });
    } else {
      customer = await db.customer.create({ data: { name, phone, email } });
    }

    /* Prior enquiries — read before the new one is written, so the new
       submission can never match itself. */
    const priorEnquiry = await db.enquiry.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      include: {
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, _count: { select: { messages: true } } },
        },
      },
    });

    const enquiry = await db.enquiry.create({
      data: {
        ref: `AUR-${nanoid()}`,
        customerId: customer.id,
        segment,
        vehicle,
        service,
        message,
        source,
        status: "IN_CONVERSATION",
      },
    });

    const conversation = await db.conversation.create({
      data: { customerId: customer.id, enquiryId: enquiry.id },
    });

    const priorConversationId = priorEnquiry?.conversations[0]?.id ?? null;
    const isReturning = Boolean(priorEnquiry);

    let opening: string | null = null;
    if (priorEnquiry) {
      const priorService = serviceBySlug(priorEnquiry.service);
      opening = returningPrompt({
        ref: priorEnquiry.ref,
        vehicle: priorEnquiry.vehicle,
        service: priorService?.name ?? priorEnquiry.service,
        createdAt: priorEnquiry.createdAt,
      });

      await db.message.create({
        data: { conversationId: conversation.id, role: "ASSISTANT", content: opening },
      });
    }

    /* The cookie grants access to the new conversation and — only when the
       customer genuinely has one — the prior conversation they may resume. */
    await setChatSession({
      customerId: customer.id,
      conversationIds: [conversation.id, ...(priorConversationId ? [priorConversationId] : [])],
      activeConversationId: conversation.id,
    });

    return NextResponse.json({
      conversationId: conversation.id,
      ref: enquiry.ref,
      isReturning,
      opening,
      previous: priorEnquiry
        ? {
            ref: priorEnquiry.ref,
            vehicle: priorEnquiry.vehicle,
            service: serviceBySlug(priorEnquiry.service)?.name ?? priorEnquiry.service,
            createdAt: priorEnquiry.createdAt,
            messageCount: priorEnquiry.conversations[0]?._count.messages ?? 0,
          }
        : null,
    });
  } catch (error) {
    console.error("[enquiry] failed", error);
    return NextResponse.json(
      { error: "We could not save that. Please call the studio instead." },
      { status: 500 },
    );
  }
}
