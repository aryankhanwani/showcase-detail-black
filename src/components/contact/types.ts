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
  /** True while tokens are still arriving for this message. */
  streaming?: boolean;
};
