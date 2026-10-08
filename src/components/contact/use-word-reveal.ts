"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { splitSegments, type Segment } from "@/lib/cards";

/**
 * Reveals a streamed reply the way a person types it: word by word, and split
 * across several messages rather than arriving as one block.
 *
 * Three problems are being solved here.
 *
 * **Bursts.** DeepSeek delivers tokens in clumps — several words at once, then
 * a pause. Rendering chunks as they arrive looks like text being *pasted*, not
 * written. So everything received is buffered and released on our own clock.
 *
 * **Blocks.** A tidy five-line answer landing as a single bubble is the loudest
 * "this is a bot" signal there is; people type in fragments and hit send early.
 * The model is instructed to write short paragraphs, and each paragraph becomes
 * its own message, a beat apart, with the typing indicator in between.
 *
 * **Cards.** A reply can contain a `::card` directive (see lib/cards.ts), which
 * renders as a price panel or a calendar rather than as text. A card is not
 * typed — nobody types a calendar — so it is released whole, after the same
 * pause that separates two messages. It still waits its turn, so a card never
 * appears above the sentence introducing it.
 */

const TICK_MS = 42;

/* The gap between two messages from the same reply — long enough to read as a
   separate send, short enough that nobody wonders if it broke. */
const PAUSE_MS = 820;

/** Words released per tick, by how far the buffer is ahead (in characters). */
function stride(backlog: number): number {
  if (backlog > 700) return 5;
  if (backlog > 400) return 3;
  if (backlog > 180) return 2;
  return 1;
}

/** Index just past the next whole word, skipping any leading whitespace. */
function nextWordEnd(text: string, from: number): number {
  let i = from;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  while (i < text.length && !/\s/.test(text[i]!)) i++;
  return i;
}

/**
 * The part of the buffer it is safe to parse yet.
 *
 * A directive is only a directive once its line is complete: mid-stream the
 * buffer ends in `::ca`, which is not yet a card and must never be shown as
 * text either. So while tokens are still arriving, a final unterminated line
 * that has begun with a colon is held back — one line of latency, and the
 * alternative is the customer watching `::card quo` type itself out.
 */
function visible(buffer: string, sealed: boolean): string {
  if (sealed) return buffer;

  const cut = buffer.lastIndexOf("\n");
  const tail = buffer.slice(cut + 1);
  return /^[ \t>*-]*:/.test(tail) ? buffer.slice(0, cut + 1) : buffer;
}

export type RevealSegment = Segment;

export type WordReveal = {
  begin: () => void;
  push: (chunk: string) => void;
  seal: () => void;
  cancel: () => void;
};

export function useWordReveal({
  enabled,
  onReveal,
  onSettled,
}: {
  /** False under prefers-reduced-motion: the whole reply appears at once. */
  enabled: boolean;
  /** `segments` are the messages revealed so far; the last may be partial. */
  onReveal: (segments: RevealSegment[], pausing: boolean) => void;
  onSettled: () => void;
}): WordReveal {
  const buffer = useRef("");
  const segIndex = useRef(0);
  const segCursor = useRef(0);
  const pauseUntil = useRef(0);
  const sealed = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);

  const revealRef = useRef(onReveal);
  const settledRef = useRef(onSettled);
  revealRef.current = onReveal;
  settledRef.current = onSettled;

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const parsed = useCallback(
    () => splitSegments(visible(buffer.current, sealed.current)),
    [],
  );

  const emit = useCallback(
    (pausing: boolean) => {
      const segs = parsed();
      const done = segs.slice(0, segIndex.current);
      const current = segs[segIndex.current];

      if (!current || segCursor.current === 0) {
        revealRef.current(done, pausing);
        return;
      }

      /* A card is whole or absent — there is no half-drawn calendar. */
      if (current.kind === "card") {
        revealRef.current([...done, current], pausing);
        return;
      }

      revealRef.current(
        [...done, { kind: "text", text: current.text.slice(0, segCursor.current) }],
        pausing,
      );
    },
    [parsed],
  );

  const settle = useCallback(() => {
    stop();
    const segs = parsed();
    segIndex.current = segs.length;
    segCursor.current = 0;
    revealRef.current(segs, false);
    settledRef.current();
  }, [parsed, stop]);

  const tick = useCallback(() => {
    /* Holding between two messages. The caller draws typing dots meanwhile. */
    if (Date.now() < pauseUntil.current) return;

    const segs = parsed();
    const current = segs[segIndex.current];

    if (current === undefined) {
      if (sealed.current) settle();
      return;
    }

    /* Cards are not typed. One tick places the whole thing. */
    if (current.kind === "card") {
      if (segCursor.current === 0) {
        segCursor.current = current.text.length;
        emit(false);
        return;
      }
    } else if (segCursor.current < current.text.length) {
      let next = segCursor.current;
      const steps = stride(current.text.length - segCursor.current);
      for (let i = 0; i < steps && next < current.text.length; i++) {
        next = nextWordEnd(current.text, next);
      }
      segCursor.current = next;
      emit(false);
      return;
    }

    /* This segment is fully written. Move on only once we know it is really
       finished — either another segment exists behind it, or the stream is
       sealed. Advancing early would split a paragraph mid-sentence the moment a
       chunk boundary happened to land on a newline. */
    const more = segIndex.current < segs.length - 1;
    if (more) {
      segIndex.current += 1;
      segCursor.current = 0;
      pauseUntil.current = Date.now() + PAUSE_MS;
      emit(true);
      return;
    }

    if (sealed.current) settle();
  }, [emit, parsed, settle]);

  /**
   * Starts the ticker if it should be running and is not.
   *
   * Called from every entry point, and that is load-bearing: React StrictMode
   * double-invokes effects on mount (run -> cleanup -> run), so the unmount
   * cleanup below fires once in development at a moment when a reveal may
   * already be in flight. That cleanup cleared the interval and left `push`
   * filling a buffer nothing was draining — an empty bubble with a blinking
   * caret, forever. Re-arming on demand makes this self-healing instead of
   * depending on a lifecycle that is deliberately not linear in development.
   */
  const ensureTicking = useCallback(() => {
    if (!enabled || !alive.current || timer.current) return;
    timer.current = setInterval(tick, TICK_MS);
  }, [enabled, tick]);

  const begin = useCallback(() => {
    stop();
    buffer.current = "";
    segIndex.current = 0;
    segCursor.current = 0;
    pauseUntil.current = 0;
    sealed.current = false;
    ensureTicking();
  }, [ensureTicking, stop]);

  const push = useCallback(
    (chunk: string) => {
      buffer.current += chunk;
      /* Reduced motion skips the clock entirely — the text is the content, and
         a motion preference must not put it behind an animation. */
      if (!enabled) revealRef.current(parsed(), false);
      else ensureTicking();
    },
    [enabled, ensureTicking, parsed],
  );

  const seal = useCallback(() => {
    sealed.current = true;
    if (!enabled) settle();
    else ensureTicking();
  }, [enabled, ensureTicking, settle]);

  const cancel = useCallback(() => {
    stop();
    sealed.current = false;
  }, [stop]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  return useMemo(() => ({ begin, push, seal, cancel }), [begin, push, seal, cancel]);
}
