"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Chat } from "./chat";
import { EnquiryForm } from "./enquiry-form";
import type { EnquiryResult, EnquiryValues } from "./types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The form-to-chat morph.
 *
 * One panel, two states. The panel itself is a `layout` element so its height
 * animates between the form's and the chat's; the two states swap inside it
 * with `mode="wait"` so the outgoing form is gone before the chat measures,
 * which is what stops the height from jumping mid-crossfade.
 *
 * Children animate `layout="position"` rather than plain `layout` — a layout
 * animation that scales a box also scales the text inside it, and text that
 * stretches during a transition is the exact thing that reads as cheap.
 */
export function ContactPanel({
  className = "surface-1 rounded-panel p-6 md:p-9",
  compact = false,
  heading = "Six fields, then we talk.",
}: {
  /** The floating panel supplies its own chrome, so this is overridable. */
  className?: string;
  compact?: boolean;
  heading?: string;
} = {}) {
  const reduced = useReducedMotion();
  const [state, setState] = useState<
    { phase: "form" } | { phase: "chat"; values: EnquiryValues; result: EnquiryResult }
  >({ phase: "form" });

  return (
    <motion.div
      layout={!reduced}
      transition={{ duration: 0.62, ease: EASE }}
      className={className}
      style={{ overflow: "hidden" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state.phase === "form" ? (
          <motion.div
            key="form"
            initial={false}
            exit={reduced ? undefined : { opacity: 0, y: -14, filter: "blur(3px)" }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <motion.div layout="position">
              <p className="t-label text-paper-faint">Start an enquiry</p>
              <h2 className="mt-3 mb-8 text-[1.5rem] font-medium tracking-[-0.025em] text-paper">
                {heading}
              </h2>
            </motion.div>

            <EnquiryForm
              onSuccess={(values, result) => setState({ phase: "chat", values, result })}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
          >
            <Chat values={state.values} result={state.result} compact={compact} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
