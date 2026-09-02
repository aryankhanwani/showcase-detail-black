import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Chat sessions.
 *
 * A conversation id alone must never be enough to read a conversation —
 * ids are handed to the browser, and cuid2-style ids are not a secret. So the
 * browser instead carries an HMAC-signed cookie naming exactly which
 * conversations it is allowed to touch, and every chat route checks it.
 *
 * The cookie is httpOnly (no script can read it), sameSite=lax (it is only
 * ever used by same-site fetches) and secure in production.
 */

const COOKIE = "aurum_chat";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type ChatSession = {
  customerId: string;
  /** Every conversation this browser may read or append to. */
  conversationIds: string[];
  /** The one the next message belongs to. */
  activeConversationId: string;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to .env.local.",
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: ChatSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(raw: string): ChatSession | null {
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  /* Constant-time compare: a fast-exit string compare on an HMAC leaks the
     signature one byte at a time to anyone willing to time the responses. */
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as ChatSession;
  } catch {
    return null;
  }
}

export async function setChatSession(session: ChatSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getChatSession(): Promise<ChatSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  return raw ? decode(raw) : null;
}

/**
 * Reads the session and confirms it grants access to `conversationId`.
 * Returns null rather than throwing so routes can answer 403 uniformly.
 */
export async function authorizeConversation(
  conversationId: string,
): Promise<ChatSession | null> {
  const session = await getChatSession();
  if (!session) return null;
  return session.conversationIds.includes(conversationId) ? session : null;
}
