"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { segments, serviceBySlug, studio } from "@/content/studio";
import { cn } from "@/lib/cn";
import type { ChatMessage, EnquiryResult, EnquiryValues } from "./types";
import { useWordReveal } from "./use-word-reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

let localId = 0;
const nextId = () => `local-${++localId}`;

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
    result.opening
      ? [{ id: nextId(), role: "ASSISTANT", content: result.opening }]
      : [],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* The resume question blocks free chat until it is answered — otherwise the
     assistant is replying without knowing which thread it is in. */
  const [awaitingChoice, setAwaitingChoice] = useState(result.isReturning);

  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  /* Which bubble the reveal is currently writing into. */
  const activeId = useRef<string | null>(null);
  const started = useRef(false);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(scrollToEnd, [messages, scrollToEnd]);

  const reveal = useWordReveal({
    enabled: !reduced,
    onReveal: (text) => {
      const id = activeId.current;
      if (!id) return;
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, content: text } : msg)));
    },
    onSettled: () => {
      const id = activeId.current;
      if (id) {
        setMessages((m) =>
          m.map((msg) => (msg.id === id ? { ...msg, streaming: false } : msg)),
        );
      }
      activeId.current = null;
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

      let id: string | null = null;

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

          /* The bubble is created by the first token rather than up front, so
             the typing indicator covers the whole round trip instead of an
             empty bubble sitting there with a caret in it. */
          if (!id) {
            id = nextId();
            activeId.current = id;
            setMessages((m) => [
              ...m,
              { id: id as string, role: "ASSISTANT", content: "", streaming: true },
            ]);
          }

          reveal.push(chunk);
        }

        if (!id) throw new Error("The assistant did not reply. Please try again.");
        reveal.seal();
      } catch (e) {
        reveal.cancel();
        if (id) setMessages((m) => m.filter((msg) => msg.id !== id));
        activeId.current = null;
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
        ...(data.transcript ?? []).map(
          (msg: { id: string; role: "USER" | "ASSISTANT"; content: string }) => ({
            id: `prior-${msg.id}`,
            role: msg.role,
            content: msg.content,
          }),
        ),
      ]);

      await stream({ opening: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
      setAwaitingChoice(true);
    }
  }

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
          {messages.map((msg) => (
            <Bubble key={msg.id} message={msg} />
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

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "USER";

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
