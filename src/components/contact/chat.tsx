"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { segments, serviceBySlug, studio } from "@/content/studio";
import { splitSegments } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { CardBlock, type CardContext } from "./cards";
import type { BookingView, ChatMessage, EnquiryResult, EnquiryValues } from "./types";
import { useWordReveal } from "./use-word-reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

let localId = 0;
const nextId = () => `local-${++localId}`;

/**
 * One stored message, as the bubbles it is made of.
 *
 * A message held in the database is one row, but it can contain several
 * paragraphs and a card directive — so the transcript that is *replayed* has to
 * be split the same way the streamed one is, or a reloaded conversation shows
 * `::card quote service=...` as literal text where a price panel used to be.
 * Both paths go through `splitSegments`, which is the point of it.
 */
function expand(id: string, role: "USER" | "ASSISTANT", content: string): ChatMessage[] {
  return splitSegments(content).map((segment, i) =>
    segment.kind === "card"
      ? { id: `${id}:${i}`, role, content: segment.text, card: segment.card }
      : { id: `${id}:${i}`, role, content: segment.text },
  );
}

/**
 * The chat that replaces the form.
 *
 * It opens already holding the enquiry: the summary strip is the same data the
 * server put into the system prompt, so what the customer can see and what the
 * assistant knows are the same thing by construction.
 */
export function Chat({
  values,
  result,
  compact = false,
}: {
  values: EnquiryValues;
  result: EnquiryResult;
  /** Shorter transcript, for the floating panel where the viewport is shared. */
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    result.opening ? expand(nextId(), "ASSISTANT", result.opening) : [],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The resume question blocks free chat until it is answered — otherwise the
     assistant is replying without knowing which thread it is in. */
  const [awaitingChoice, setAwaitingChoice] = useState(result.isReturning);
  /* Set the moment a drop-off is confirmed. Every calendar in the transcript
     locks off this, so there is no way to book the same car twice by scrolling
     up to an older card. */
  const [booked, setBooked] = useState<BookingView | null>(null);

  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  /* Id prefix for the bubbles of the reply currently being written. One reply
     can become several messages, so this names the group, not one bubble. */
  const activeBase = useRef<string | null>(null);
  const started = useRef(false);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(scrollToEnd, [messages, scrollToEnd]);

  const reveal = useWordReveal({
    enabled: !reduced,
    /* Each paragraph of the reply is its own bubble. The group is rebuilt from
       the segments every tick, which keeps this a pure function of the reveal
       state — no incremental bookkeeping to drift out of sync. */
    onReveal: (segments, pausing) => {
      const base = activeBase.current;
      if (!base) return;
      setMessages((m) => [
        ...m.filter((msg) => !msg.id.startsWith(`${base}:`)),
        ...segments.map((segment, i) => ({
          id: `${base}:${i}`,
          role: "ASSISTANT" as const,
          content: segment.text,
          ...(segment.kind === "card" ? { card: segment.card } : {}),
          /* Mid-pause nothing is being written, so the caret comes off and the
             typing indicator takes over — which is what makes the gap read as
             "sending the next one" rather than as a stall. A card is never
             mid-write, so it never carries the caret. */
          streaming:
            segment.kind === "text" && i === segments.length - 1 && !pausing,
        })),
      ]);
    },
    onSettled: () => {
      const base = activeBase.current;
      if (base) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id.startsWith(`${base}:`) ? { ...msg, streaming: false } : msg,
          ),
        );
      }
      activeBase.current = null;
      setBusy(false);
    },
  });

  /**
   * Streams one assistant turn.
   *
   * `busy` stays true until the *reveal* settles, not until the network
   * finishes — otherwise the composer unlocks while the assistant is visibly
   * still writing, and a fast typist can interleave two turns.
   */
  const stream = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      reveal.begin();

      let base: string | null = null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: result.conversationId, ...payload }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "The assistant is unavailable.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          /* Bubbles are created by the reveal, not up front, so the typing
             indicator covers the whole round trip rather than an empty bubble
             sitting there with a caret in it. */
          if (!base) {
            base = nextId();
            activeBase.current = base;
          }

          reveal.push(chunk);
        }

        if (!base) throw new Error("The assistant did not reply. Please try again.");
        reveal.seal();
      } catch (e) {
        reveal.cancel();
        if (base) setMessages((m) => m.filter((msg) => !msg.id.startsWith(`${base}:`)));
        activeBase.current = null;
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setBusy(false);
      }
    },
    [result.conversationId, reveal],
  );

  /* A new customer gets the assistant's opening immediately. A returning one
     is asked which thread to use first, so nothing is generated until they say. */
  useEffect(() => {
    if (started.current || result.isReturning) return;
    started.current = true;
    void stream({ opening: true });
  }, [result.isReturning, stream]);

  async function choose(choice: "continue" | "new") {
    setAwaitingChoice(false);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/chat/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: result.conversationId, choice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not do that.");

      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "USER",
          content:
            choice === "continue"
              ? `Carry on with ${result.previous?.ref ?? "my earlier enquiry"}.`
              : "Start fresh with this new enquiry.",
        },
        ...(data.transcript ?? []).flatMap(
          (msg: { id: string; role: "USER" | "ASSISTANT"; content: string }) =>
            expand(`prior-${msg.id}`, msg.role, msg.content),
        ),
      ]);

      await stream({ opening: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
      setAwaitingChoice(true);
    }
  }

  /**
   * A drop-off has just been confirmed.
   *
   * The confirmation text comes from the server, not from the model — see
   * api/booking/route.ts. It is appended here exactly as it was stored, so the
   * bubble the customer reads and the line the assistant sees on its next turn
   * are the same string.
   */
  const onBooked = useCallback((view: BookingView, message: string) => {
    setBooked(view);
    setMessages((m) => [...m, ...expand(nextId(), "ASSISTANT", message)]);
  }, []);

  /* The last card in the transcript — the only one still worth tapping. */
  const lastCardIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.card) return i;
    }
    return -1;
  }, [messages]);

  const cardContext = useMemo<CardContext>(
    () => ({
      conversationId: result.conversationId,
      segment: values.segment,
      booked,
      onBooked,
    }),
    [booked, onBooked, result.conversationId, values.segment],
  );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || awaitingChoice) return;

    setInput("");
    setMessages((m) => [...m, { id: nextId(), role: "USER", content: text }]);
    await stream({ message: text });
  }

  const service = serviceBySlug(values.service);
  const segment = segments.find((s) => s.id === values.segment);

  return (
    <div className={cn("flex flex-col", compact ? "h-[min(62vh,520px)]" : "h-[min(72vh,640px)]")}>
      {/* ── Context strip ───────────────────────────────────────────────── */}
      <motion.div
        layout="position"
        className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line pb-5"
      >
        <span className="t-mono rounded-pill bg-gold/15 px-2.5 py-1 text-gold-soft">
          {result.ref}
        </span>
        {[values.vehicle, segment?.label, service?.name].filter(Boolean).map((chip) => (
          <span
            key={chip as string}
            className="surface-1 t-label rounded-pill px-3 py-1 text-paper-dim"
          >
            {chip}
          </span>
        ))}
      </motion.div>

      {/* ── Transcript ──────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto py-6"
        role="log"
        aria-live="polite"
        aria-label="Conversation with the studio assistant"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <Bubble
              key={msg.id}
              message={msg}
              context={cardContext}
              /* Only the newest card is actionable — an older calendar would
                 book against a date the conversation has moved past. It is the
                 newest *card*, not the newest message: the assistant usually
                 says one more line after placing a calendar, and that line must
                 not switch off the calendar it just introduced. */
              live={i === lastCardIndex}
            />
          ))}
        </AnimatePresence>

        {busy && !messages.some((m) => m.streaming) ? <Typing /> : null}

        {/* ── Resume choice ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {awaitingChoice && result.previous ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex flex-col gap-3 pt-1 sm:flex-row"
            >
              <button
                type="button"
                onClick={() => choose("continue")}
                className="press t-label flex-1 rounded-pill bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90"
              >
                Carry on with {result.previous.ref}
              </button>
              <button
                type="button"
                onClick={() => choose("new")}
                className="press t-label flex-1 rounded-pill border border-line-strong px-5 py-3 text-paper transition-colors hover:surface-1"
              >
                Start fresh
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <p role="alert" className="text-[14.5px] leading-relaxed text-gold-soft">
            {error} You can always call the studio on{" "}
            <a href={studio.phoneHref} className="underline">
              {studio.phone}
            </a>
            .
          </p>
        ) : null}
      </div>

      {/* ── Composer ────────────────────────────────────────────────────── */}
      <form onSubmit={send} className="flex items-end gap-3 border-t border-line pt-5">
        <label htmlFor="chat-input" className="sr-only">
          Message the studio
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends; Shift+Enter is a newline. On a phone the on-screen
               keyboard's return key inserts a newline instead, which is why the
               send button is always present rather than being a desktop
               affordance the thumb cannot reach. */
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          disabled={awaitingChoice}
          placeholder={
            awaitingChoice ? "Pick one above to carry on…" : "Ask about your car…"
          }
          className="surface-1 max-h-32 min-h-[52px] flex-1 resize-none rounded-field border border-line-strong px-4 py-3.5 text-[15.5px] text-paper outline-none transition-colors placeholder:text-paper-faint focus:border-gold/50 focus:surface-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || awaitingChoice || !input.trim()}
          aria-label="Send message"
          className="press flex size-[52px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink transition-opacity hover:opacity-90 disabled:opacity-35"
        >
          <span aria-hidden className="text-[17px]">
            ↑
          </span>
        </button>
      </form>
    </div>
  );
}

/* ── Parts ──────────────────────────────────────────────────────────────── */

function Bubble({
  message,
  context,
  live,
}: {
  message: ChatMessage;
  context: CardContext;
  live: boolean;
}) {
  const mine = message.role === "USER";

  /* A card is not a bubble. It gets the full width of the transcript, because
     a calendar squeezed into 85% with a tightened corner is a calendar nobody
     can tap accurately on a phone. */
  if (message.card) {
    return (
      <motion.div layout="position" className="flex justify-start">
        <CardBlock card={message.card} live={live} context={context} />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] px-4 py-3 text-[15.5px] leading-relaxed whitespace-pre-wrap",
          /* The tightened corner on the speaker's side does the "who is talking"
             work that a colour-coded chat app would do with hue. */
          mine
            ? "surface-3 rounded-card rounded-br-field text-paper"
            : "surface-1 rounded-card rounded-bl-field text-paper-dim",
        )}
      >
        {message.content}
        {message.streaming ? (
          <motion.span
            aria-hidden
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-gold"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="surface-1 inline-flex items-center gap-1.5 rounded-card rounded-bl-field px-4 py-3.5"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block size-1.5 rounded-full bg-paper-faint"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
        />
      ))}
    </motion.div>
  );
}
