import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeConversation } from "@/lib/session";
import { resumeSchema } from "@/lib/validation";

/**
 * Answers the "continue or start fresh?" question a returning customer is asked.
 *
 * Choosing to continue does not move the customer back into the old thread —
 * it links the new conversation to the old one and returns the old transcript
 * for display. Keeping the new enquiry as the live record means the thing they
 * just filled in is never silently discarded, while the model still receives
 * the whole history.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = resumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }
  const { conversationId, choice } = parsed.data;

  const session = await authorizeConversation(conversationId);
  if (!session) {
    return NextResponse.json({ error: "This conversation is not yours." }, { status: 403 });
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { customer: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (choice === "new") {
    await db.message.create({
      data: {
        conversationId,
        role: "USER",
        content: "Let's start fresh with this new enquiry.",
      },
    });
    return NextResponse.json({ resumed: false, transcript: [] });
  }

  /* The prior conversation is whichever of this customer's threads the session
     cookie also authorised — never an arbitrary id from the request body. */
  const priorId = session.conversationIds.find((id) => id !== conversationId);
  const prior = priorId
    ? await db.conversation.findFirst({
        where: { id: priorId, customerId: conversation.customerId },
        include: {
          enquiry: true,
          messages: { orderBy: { createdAt: "asc" }, take: 40 },
        },
      })
    : null;

  if (!prior) {
    return NextResponse.json(
      { error: "We could not find that earlier enquiry." },
      { status: 404 },
    );
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { resumedFromId: prior.id, status: "RESUMED" },
  });

  await db.message.create({
    data: {
      conversationId,
      role: "USER",
      content: `Continue my earlier enquiry ${prior.enquiry.ref}.`,
    },
  });

  return NextResponse.json({
    resumed: true,
    ref: prior.enquiry.ref,
    transcript: prior.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
