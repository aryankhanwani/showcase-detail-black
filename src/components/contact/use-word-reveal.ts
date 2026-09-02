"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Reveals streamed text a word at a time.
 *
 * DeepSeek delivers tokens in bursts — several words can land in a single
 * chunk, and then nothing for 200ms. Rendering chunks as they arrive therefore
 * looks like text being *pasted* in clumps, not typed. This buffers everything
 * received and releases it on its own clock, which is what makes it read as
 * writing.
 *
 * The cadence is adaptive rather than fixed. A fixed delay is fine for the
 * first sentence and then falls badly behind on a long reply — the network
 * finishes while the UI is still typing paragraph one, and the user waits on an
 * animation rather than on the model. So the further ahead the buffer gets, the
 * more words each tick releases: it catches up without ever dropping to an
 * instant dump.
 */

/* ~24 words/second at stride 1. Measured against live DeepSeek: 32ms read as
   text being pasted rather than written, and anything past ~60ms leaves the
   reader waiting on the animation after the model has already finished. */
const TICK_MS = 42;

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

export type WordReveal = {
  /** Start a new reveal. Clears any previous buffer. */
  begin: () => void;
  /** Feed a chunk as it arrives off the network. */
  push: (chunk: string) => void;
  /** No more chunks are coming; finish once the buffer is drained. */
  seal: () => void;
  /** Abandon the current reveal without settling (errors, unmount). */
  cancel: () => void;
};

export function useWordReveal({
  enabled,
  onReveal,
  onSettled,
}: {
  /** False under prefers-reduced-motion: text appears as it arrives. */
  enabled: boolean;
  onReveal: (text: string) => void;
  onSettled: () => void;
}): WordReveal {
  const buffer = useRef("");
  const shown = useRef(0);
  const sealed = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Callbacks are read through refs so the ticker never needs to be torn down
     and rebuilt when the parent re-renders mid-stream. */
  const revealRef = useRef(onReveal);
  const settledRef = useRef(onSettled);
  revealRef.current = onReveal;
  settledRef.current = onSettled;

  /** True between mount and real unmount. See `ensureTicking`. */
  const alive = useRef(true);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);


  const settle = useCallback(() => {
    stop();
    revealRef.current(buffer.current);
    settledRef.current();
  }, [stop]);

  const tick = useCallback(() => {
    const full = buffer.current;

    if (shown.current >= full.length) {
      if (sealed.current) settle();
      return;
    }

    let next = shown.current;
    const steps = stride(full.length - shown.current);
    for (let i = 0; i < steps && next < full.length; i++) {
      next = nextWordEnd(full, next);
    }

    shown.current = next;
    revealRef.current(full.slice(0, next));

    if (sealed.current && next >= full.length) settle();
  }, [settle]);

  /**
   * Starts the ticker if it should be running and is not.
   *
   * This is called from every entry point rather than only from `begin`, and
   * that is load-bearing: React StrictMode double-invokes effects on mount
   * (run -> cleanup -> run), so the unmount cleanup below fires *once* in
   * development at a moment when a reveal may already be in flight. That
   * cleanup would clear the interval and leave `push` filling a buffer nothing
   * was draining — an empty bubble with a blinking caret, forever. Re-arming on
   * demand makes the ticker self-healing instead of relying on a lifecycle that
   * is deliberately not linear in development.
   */
  const ensureTicking = useCallback(() => {
    if (!enabled || !alive.current || timer.current) return;
    timer.current = setInterval(tick, TICK_MS);
  }, [enabled, tick]);

  const begin = useCallback(() => {
    stop();
    buffer.current = "";
    shown.current = 0;
    sealed.current = false;
    ensureTicking();
  }, [ensureTicking, stop]);

  const push = useCallback(
    (chunk: string) => {
      buffer.current += chunk;
      /* Reduced motion skips the clock entirely — the text is the content, and
         a motion preference must not put it behind an animation. */
      if (!enabled) revealRef.current(buffer.current);
      else ensureTicking();
    },
    [enabled, ensureTicking],
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

  /* A stream in flight when the panel closes would otherwise keep ticking
     against an unmounted tree. `alive` gates re-arming so a late chunk cannot
     resurrect the ticker after a genuine unmount. */
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, [stop]);

  /* Memoised: a fresh object each render would invalidate the caller's
     useCallback deps on every keystroke and rebuild the stream function
     mid-generation. */
  return useMemo(() => ({ begin, push, seal, cancel }), [begin, push, seal, cancel]);
}
