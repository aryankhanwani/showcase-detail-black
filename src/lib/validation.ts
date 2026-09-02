import { z } from "zod";
import { segments, services } from "@/content/studio";

/**
 * The phone number is the identity key for returning enquiries, so it is
 * normalised to bare 10 digits before it ever reaches the database — otherwise
 * "+91 98250 41200" and "9825041200" are two different customers and the whole
 * returning-enquiry feature silently never fires.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, "").replace(/^(\+?91)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number."),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("That email address does not look right.");

const serviceSlugs = services.map((s) => s.slug) as [string, ...string[]];
const segmentIds = segments.map((s) => s.id) as [string, ...string[]];

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal("").transform(() => undefined)),
  segment: z.enum(segmentIds, { message: "Pick your vehicle segment." }),
  vehicle: z.string().trim().min(2, "Which car is it?").max(80),
  service: z.enum(serviceSlugs, { message: "Pick the service you want." }),
  message: z.string().trim().max(1200).optional(),
  source: z.string().trim().max(120).optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

/**
 * A chat turn is either a real user message, or an `opening` request that asks
 * the assistant to speak first. The opening turn carries no user text, because
 * the customer has not said anything yet — the form is what it is replying to.
 */
export const chatMessageSchema = z
  .object({
    conversationId: z.string().min(1),
    message: z.string().trim().max(2000).optional(),
    opening: z.boolean().optional(),
  })
  .refine((d) => d.opening === true || (d.message?.length ?? 0) > 0, {
    message: "Type a message.",
    path: ["message"],
  });

export const resumeSchema = z.object({
  conversationId: z.string().min(1),
  choice: z.enum(["continue", "new"]),
});
