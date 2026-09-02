"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { RiseLines } from "@/components/ui/motion";
import { ArrowLink, ButtonLink, Container, StatusDot } from "@/components/ui/primitives";
import { studio } from "@/content/studio";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The hero. One video, one scrim, one title block.
 *
 * The video is the only heavy asset on the site (361 KB h264 / 168 KB vp9 at
 * 720p) and it earns its place: a detailing studio sells a surface, and a still
 * photograph cannot show light moving across one. Everything else on the page
 * is type and tone.
 *
 * It never blocks the page: the poster paints immediately, the video fades in
 * over it once it can actually play, and under `prefers-reduced-motion` it is
 * never loaded at all — the poster is the hero.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Parallax on the media only. The title block does not move, because text
     drifting under a fixed nav is the fastest way to make a hero feel cheap. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[92svh] items-end overflow-hidden pt-28 pb-14 md:min-h-[100svh] md:pb-20"
    >
      {/* ── Media ─────────────────────────────────────────────────────── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 z-0"
        style={reduced ? undefined : { y: mediaY, scale: mediaScale }}
      >
        <img
          src="/media/hero-poster.jpg"
          alt=""
          className="size-full object-cover"
          fetchPriority="high"
        />

        {!reduced ? (
          <motion.video
            className="absolute inset-0 size-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/media/hero-poster.jpg"
            onCanPlay={() => setReady(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: ready ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <source src="/media/hero.webm" type="video/webm" />
            <source src="/media/hero.mp4" type="video/mp4" />
          </motion.video>
        ) : null}
      </motion.div>

      {/*
       * The scrim. A flat wash plus one directional falloff — enough to hold
       * 17:1 text contrast over a moving image, and deliberately not a
       * decorative gradient. If it reads as a colour effect, it is wrong.
       */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to top, rgba(8,8,10,0.96) 0%, rgba(8,8,10,0.72) 34%, rgba(8,8,10,0.42) 62%, rgba(8,8,10,0.66) 100%)",
        }}
      />

      {/* ── Title block ───────────────────────────────────────────────── */}
      <Container className="relative z-10">
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <StatusDot>
            {studio.city} · {studio.bays} bays · {studio.intakePerWeek} cars a week
          </StatusDot>
        </motion.div>

        <h1 className="t-display mt-6 max-w-[16ch] text-paper">
          <RiseLines
            lines={["Paint protection", "done to a", "measured standard."]}
            delay={0.15}
          />
        </h1>

        <motion.div
          className="mt-8 max-w-xl"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: EASE }}
        >
          <p className="t-lead text-paper-dim">
            Every panel gauged before we touch it. A fixed figure against a
            written scope. The warranty registered to your VIN, not to a
            handshake.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <ButtonLink href="/contact">Book an inspection</ButtonLink>
            <ArrowLink href="/work">See the work</ArrowLink>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
