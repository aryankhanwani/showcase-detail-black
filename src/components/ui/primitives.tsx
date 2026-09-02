import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Every layout shape used more than once lives here.
 *
 * These are Server Components on purpose — a page composed of primitives that
 * each drag in a client boundary ships the whole layout to the browser for no
 * reason. Only the things that genuinely animate or hold state are "use client".
 */

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("edge mx-auto w-full max-w-[1240px]", className)}>
      {children}
    </div>
  );
}

/**
 * Sections separate by rhythm and only by rhythm — never a rule, never a
 * background. `tight` is for a section whose content is shorter than its
 * padding would otherwise imply.
 */
export function Section({
  children,
  className,
  label,
  tight = false,
  flush = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Renders the section kicker. Every section opens with one, or with nothing. */
  label?: string;
  tight?: boolean;
  /** Drops the container, for full-bleed content. */
  flush?: boolean;
  id?: string;
}) {
  const body = (
    <>
      {label ? (
        <p className="t-label mb-10 flex items-center gap-2.5 text-paper-faint md:mb-14">
          <span aria-hidden className="h-px w-6 bg-gold/60" />
          {label}
        </p>
      ) : null}
      {children}
    </>
  );

  return (
    <section
      id={id}
      className={cn("relative", tight ? "py-16 md:py-24" : "py-24 md:py-36", className)}
    >
      {flush ? body : <Container>{body}</Container>}
    </section>
  );
}

/* ── Type ───────────────────────────────────────────────────────────────── */

export function SectionTitle({
  children,
  className,
  scale = "section",
}: {
  children: ReactNode;
  className?: string;
  /** `display` steps up for a page's closing statement, and only for that. */
  scale?: "section" | "display";
}) {
  return (
    <h2 className={cn(scale === "display" ? "t-display-c" : "t-section", className)}>
      {children}
    </h2>
  );
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("t-lead max-w-2xl text-paper-dim", className)}>{children}</p>;
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("max-w-2xl text-[16.5px] leading-relaxed text-paper-dim", className)}>
      {children}
    </p>
  );
}

/** The one hue on the site, and only ever as a status marker. */
export function StatusDot({ children }: { children: ReactNode }) {
  return (
    <span className="t-label inline-flex items-center gap-2.5 text-paper-faint">
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-gold" />
      </span>
      {children}
    </span>
  );
}

/* ── Objects ────────────────────────────────────────────────────────────── */

/** A card is a surface token plus a radius. Never a border, never a solid fill. */
export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-1 rounded-card p-6 md:p-8",
        interactive &&
          "transition-[background-color,transform] duration-300 hover:surface-2 hover:-translate-y-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("surface-1 rounded-panel p-7 md:p-10", className)}>{children}</div>
  );
}

/** Real gaps between rounded cards — never gutters rendered as hairlines. */
export function CardGrid({
  children,
  className,
  cols = 3,
}: {
  children: ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 md:gap-4",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── Actions ────────────────────────────────────────────────────────────── */

/*
 * CTAs are full-width until `sm`. On a 360px screen a pill sized to its label
 * leaves a thumb hunting for a 140px target, and this site's whole job is to
 * get a phone user into the enquiry.
 */
const BUTTON_BASE =
  "press inline-flex w-full items-center justify-center gap-2.5 rounded-pill px-7 py-3.5 t-label transition-all duration-300 sm:w-auto";

const BUTTON_VARIANTS = {
  solid: "bg-paper text-ink hover:opacity-90 hover:gap-4",
  outline:
    "border border-line-strong text-paper hover:surface-1 hover:border-paper/40 hover:gap-4",
  ghost: "text-paper-dim hover:text-paper hover:gap-4",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function ButtonLink({
  href,
  children,
  variant = "solid",
  className,
  arrow = true,
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  arrow?: boolean;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const external = href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:");
  const content = (
    <>
      {children}
      {arrow ? (
        <span aria-hidden className="transition-transform duration-300">
          →
        </span>
      ) : null}
    </>
  );
  const classes = cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className);

  if (external) {
    return (
      <a href={href} className={classes} rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}

/** Secondary action. A text link, never a second pill competing with the CTA. */
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "t-label group inline-flex items-center gap-2 text-paper transition-colors hover:text-gold-soft",
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

/* ── Ledger — the one sanctioned hairline ───────────────────────────────── */

export function Ledger({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("w-full", className)}>{children}</dl>;
}

export function LedgerRow({
  term,
  children,
}: {
  term: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <dt className="t-label text-paper-faint">{term}</dt>
      <dd className="text-right text-[15.5px] text-paper">{children}</dd>
    </div>
  );
}
