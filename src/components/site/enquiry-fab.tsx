"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ContactPanel } from "@/components/contact/contact-panel";
import { studio } from "@/content/studio";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Genie easing. Deliberately *not* ease-out-expo: that curve front-loads so
   hard that the stretch is ~87% done in the first quarter of its duration and
   the effect reads as a pop. This one keeps motion in the middle of the tween,
   which is where a genie is actually legible. */
const GENIE = [0.42, 0.06, 0.18, 1] as const;

/**
 * The floating enquiry button.
 *
 * It opens the same form-to-chat panel the contact page uses, so there is one
 * implementation of the enquiry flow and it cannot drift between the two
 * places it appears.
 *
 * **The genie.** A real macOS genie is a non-affine warp — it bends the
 * element's edges along a curve, which CSS cannot express and which would cost
 * a canvas or an SVG filter to fake. What sells the effect at a fraction of
 * that is the *timing*, not the curvature: the panel leaves the button as a
 * thin sliver, stretches upward first, and only then widens. So `scaleY` and
 * `scaleX` run as separate tweens with different durations and a small offset
 * between them, anchored to the button's corner.
 *
 * The inner content fades in behind that, on a delay. Scaling a box scales the
 * text inside it, and legible text mid-stretch is exactly what gives away a
 * cheap scale animation — by the time the copy is visible the distortion has
 * resolved.
 */
export function EnquiryFab() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* The contact page *is* this form. A floating button offering the same thing
     over the top of it is noise. */
  const hidden = pathname.startsWith("/contact");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    /* Deferred a tick: the click that opened the panel is still propagating,
       and would otherwise close it immediately. */
    const timeout = setTimeout(() => window.addEventListener("mousedown", onPointer), 0);

    /* Scroll lock on phones only — on desktop the panel is a corner object and
       locking the page behind it is heavy-handed. */
    const narrow = window.matchMedia("(max-width: 639px)").matches;
    const previous = document.body.style.overflow;
    if (narrow) document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      clearTimeout(timeout);
      if (narrow) document.body.style.overflow = previous;
    };
  }, [open]);

  if (hidden) return null;

  return (
    <>
      {/* Backdrop — phones only, where the panel is nearly full-bleed. */}
      <AnimatePresence>
        {open ? (
          <motion.div
            aria-hidden
            className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-end p-4 sm:p-6">
        <div className="pointer-events-auto flex w-full flex-col items-end gap-3 sm:w-auto">
          <AnimatePresence>
            {open ? (
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Start an enquiry with ${studio.fullName}`}
                className="lift w-full origin-bottom-right overflow-y-auto overscroll-contain rounded-panel border border-line bg-ink-2 p-5 sm:w-[420px] sm:p-7"
                style={{
                  transformOrigin: "bottom right",
                  /* Never taller than the space between the nav and the button,
                     or the panel grows off the top of the screen and takes its
                     own heading with it. */
                  maxHeight: "calc(100svh - 8.5rem)",
                }}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scaleX: 0.28, scaleY: 0.015, y: 26 }
                }
                animate={{ opacity: 1, scaleX: 1, scaleY: 1, y: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scaleX: 0.28, scaleY: 0.015, y: 26 }
                }
                transition={
                  reduced
                    ? { duration: 0.2 }
                    : {
                        /* Up first, then out — the order is the whole effect. */
                        scaleY: { duration: 0.62, ease: GENIE },
                        scaleX: { duration: 0.44, ease: GENIE, delay: 0.20 },
                        y: { duration: 0.6, ease: GENIE },
                        opacity: { duration: 0.18 },
                      }
                }
              >
                <motion.div
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: reduced ? 0 : 0.42 }}
                >
                  <div className="mb-1 flex items-start justify-between gap-4">
                    <p className="t-label text-paper-faint">Talk to the studio</p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close enquiry"
                      className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-pill text-paper-faint transition-colors hover:text-paper"
                    >
                      <span aria-hidden className="text-[19px] leading-none">
                        ×
                      </span>
                    </button>
                  </div>

                  <ContactPanel
                    className="pt-1"
                    compact
                    heading="Tell us about the car."
                  />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close enquiry" : "Start an enquiry"}
            whileTap={{ scale: 0.94 }}
            className="lift group flex h-14 items-center gap-3 self-end rounded-pill bg-paper pr-6 pl-5 text-ink"
          >
            <span aria-hidden className="relative block size-5">
              {/* Chat glyph ↔ close, cross-fading in place. */}
              <motion.svg
                viewBox="0 0 20 20"
                fill="none"
                className="absolute inset-0"
                animate={{ opacity: open ? 0 : 1, rotate: open ? -90 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <path
                  d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H8l-4 3.2V14h-.5A.5.5 0 0 1 3 13.5v-8Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </motion.svg>
              <motion.svg
                viewBox="0 0 20 20"
                fill="none"
                className="absolute inset-0"
                animate={{ opacity: open ? 1 : 0, rotate: open ? 0 : 90 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" />
              </motion.svg>
            </span>
            <span className="t-label whitespace-nowrap">
              {open ? "Close" : "Get a quote"}
            </span>
          </motion.button>
        </div>
      </div>
    </>
  );
}
