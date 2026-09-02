"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Every scroll animation on the site goes through this file.
 *
 * Three constraints, in priority order:
 *  1. Only `transform` and `opacity` are ever animated — they composite on the
 *     GPU and never trigger layout. Animating height, top or filter is what
 *     makes a marketing site feel laggy on a mid-range phone.
 *  2. Everything is `once: true`. Re-animating on scroll-back is the single
 *     most common way a "premium" site becomes exhausting to read.
 *  3. Reduced motion resolves to the *visible* state, never to hidden. A
 *     motion preference must not cost a user the content.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Reveal ─────────────────────────────────────────────────────────────── */

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds. Use for a small cascade inside one group, not across a page. */
  delay?: number;
  /** Travel distance in px. Kept small — a long throw reads as a slideshow. */
  y?: number;
  as?: "div" | "section" | "li" | "article" | "header" | "footer" | "span";
};

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/* ── Stagger ────────────────────────────────────────────────────────────── */

const groupVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.075, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

/**
 * Wrap a list; each direct <StaggerItem> resolves in sequence. Prefer this over
 * hand-computed delays — a cascade written as `delay={i * 0.08}` breaks the
 * moment the list is filtered or reordered.
 */
export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "section";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      variants={groupVariants}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  );
}

/* ── Masked line rise ───────────────────────────────────────────────────── */

/**
 * The headline treatment: each typeset line climbs out from behind a hard mask
 * edge. `lines` takes one entry per rendered line — the caller decides where
 * the text breaks, because an automatic break lands differently at every
 * viewport and the hero is the one place that cannot be left to chance.
 *
 * The mask is `overflow: hidden` on a block wrapper, so the line genuinely
 * emerges from nothing rather than fading up through the background.
 */
export function RiseLines({
  lines,
  className,
  delay = 0,
  stagger = 0.09,
}: {
  lines: readonly string[];
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <span className={cn("block", className)}>
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            initial={reduced ? false : { y: "108%" }}
            animate={{ y: 0 }}
            transition={{
              duration: 1.05,
              delay: delay + i * stagger,
              ease: EASE,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/**
 * Scroll-triggered twin of RiseLines, for section headings below the fold.
 * The hero uses `animate` (it is already in view on load); everything else
 * has to wait until it is actually reached.
 */
export function RiseLinesOnView({
  lines,
  className,
  stagger = 0.08,
}: {
  lines: readonly string[];
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.span
      className={cn("block", className)}
      initial={reduced ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -14% 0px" }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger } } }}
    >
      {lines.map((line) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            variants={{
              hidden: { y: "108%" },
              shown: { y: 0, transition: { duration: 1, ease: EASE } },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
