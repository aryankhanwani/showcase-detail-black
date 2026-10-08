import type { Card } from "@/lib/cards";

export type EnquiryValues = {
  name: string;
  phone: string;
  email: string;
  segment: string;
  vehicle: string;
  service: string;
  message: string;
};

export type PreviousEnquiry = {
  ref: string;
  vehicle: string;
  service: string;
  createdAt: string;
  messageCount: number;
};

export type EnquiryResult = {
  conversationId: string;
  ref: string;
  isReturning: boolean;
  opening: string | null;
  previous: PreviousEnquiry | null;
};

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  /**
   * Set when this message is a card rather than a sentence — a price panel, a
   * calendar, a receipt. `content` then holds the directive it came from, which
   * is what gets stored and what WhatsApp renders as text.
   */
  card?: Card;
  /** True while tokens are still arriving for this message. */
  streaming?: boolean;
};

/**
 * A confirmed drop-off, as the chat needs it.
 *
 * Mirrors `BookingView` in lib/booking.ts, which is where it is built. It is
 * restated here rather than imported because that module reaches the database,
 * and a type import from it would be erased correctly but still invite somebody
 * to import a value next to it.
 */
export type BookingView = {
  ref: string;
  /** YYYY-MM-DD in the studio's timezone. */
  date: string;
  dateLabel: string;
  slot: string;
  slotLabel: string;
  service: string;
  serviceName: string;
  segment: string;
  vehicle: string;
  duration: string;
  band: string;
  /** Whether the WhatsApp receipt actually went out. */
  notified: boolean;
};
