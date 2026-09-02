"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { studio } from "@/content/studio";
import { cn } from "@/lib/cn";

const NAV = [
  { label: "Services", href: "/services" },
  { label: "Work", href: "/work" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  /* Reading scroll through a motion value keeps this off the React render path —
     a useState on every scroll event re-renders the whole bar 60 times a second. */
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > 24;
    setStuck((prev) => (prev === next ? prev : next));
  });

  /* Route change closes the menu. Without this, tapping a link navigates
     underneath an overlay that never goes away. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Scroll lock + ESC, for as long as the menu is open. */
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        {/*
         * The fill rides its own masked layer, 40px taller than the bar.
         * A backdrop-blur averages the ground's grain flat, so a full-width
         * blurred bar always ends in a visible horizontal cut; fading tint and
         * blur out together over the last third is the only thing that removes
         * it. The layer has to overshoot the bar because the fade cannot begin
         * before the links end.
         */}
        <motion.div
          aria-hidden
          className="mask-chrome pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+40px)] backdrop-blur-md"
          initial={false}
          animate={{ opacity: stuck && !open ? 1 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ backgroundColor: "rgba(8, 8, 10, 0.62)" }}
        />

        <nav className="edge relative mx-auto flex h-[72px] max-w-[1240px] items-center justify-between">
          <Link
            href="/"
            className="font-display text-[19px] font-semibold tracking-[0.22em] text-paper"
            aria-label={`${studio.fullName} — home`}
          >
            {studio.wordmark.head}
          </Link>

          {/* ── Desktop ───────────────────────────────────────────────── */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "t-label relative rounded-pill px-4 py-2 transition-colors duration-200",
                  isActive(item.href)
                    ? "text-paper"
                    : stuck
                      ? "text-paper/70 hover:text-paper"
                      : "text-paper-faint hover:text-paper",
                )}
              >
                {isActive(item.href) ? (
                  <motion.span
                    layoutId="nav-active"
                    className="surface-2 absolute inset-0 rounded-pill"
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                ) : null}
                <span className="relative">{item.label}</span>
              </Link>
            ))}

            <Link
              href="/contact"
              className="press t-label ml-3 rounded-pill bg-paper px-5 py-2.5 text-ink transition-opacity duration-200 hover:opacity-90"
            >
              Book an inspection
            </Link>
          </div>

          {/* ── Mobile trigger ────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="relative z-50 -mr-2 flex size-11 items-center justify-center rounded-pill md:hidden"
          >
            <span className="relative block h-3 w-6">
              <motion.span
                className="absolute left-0 block h-px w-6 bg-paper"
                animate={open ? { top: 6, rotate: 45 } : { top: 0, rotate: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
              <motion.span
                className="absolute left-0 block h-px w-6 bg-paper"
                animate={open ? { top: 6, rotate: -45 } : { top: 12, rotate: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
            </span>
          </button>
        </nav>
      </header>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-ink md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="edge flex flex-1 flex-col justify-center gap-1 pt-20 pb-10">
              {NAV.map((item, i) => (
                <div key={item.href} className="overflow-hidden">
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.55, delay: 0.05 + i * 0.05, ease: EASE }}
                  >
                    <Link
                      href={item.href}
                      className="flex items-baseline gap-4 py-3"
                      aria-current={isActive(item.href) ? "page" : undefined}
                    >
                      <span className="t-mono w-6 text-gold/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "font-display text-[2rem] font-medium tracking-[-0.03em]",
                          isActive(item.href) ? "text-paper" : "text-paper-dim",
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                </div>
              ))}
            </div>

            <motion.div
              className="edge border-t border-line pt-6 pb-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: EASE }}
            >
              <Link
                href="/contact"
                className="press t-label flex w-full items-center justify-center gap-2.5 rounded-pill bg-paper px-7 py-4 text-ink"
              >
                Book an inspection
                <span aria-hidden>→</span>
              </Link>
              <a
                href={studio.phoneHref}
                className="t-label mt-4 block text-center text-paper-faint"
              >
                {studio.phone}
              </a>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
