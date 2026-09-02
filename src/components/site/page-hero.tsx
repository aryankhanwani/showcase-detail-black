import type { ReactNode } from "react";
import { RiseLines } from "@/components/ui/motion";
import { Container } from "@/components/ui/primitives";

/**
 * The only hero on every route except home.
 *
 * No page hand-rolls a shell — that is what keeps the title block structural
 * rather than a convention that drifts across six files. It carries no
 * background of its own; the document `.ground` is what gives it depth.
 *
 * `lines` takes one entry per typeset line, because an automatic break lands
 * differently at every viewport and the first thing on the page cannot be left
 * to chance.
 */
export function PageHero({
  eyebrow,
  lines,
  lead,
  actions,
}: {
  eyebrow?: ReactNode;
  lines: readonly string[];
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="pt-36 pb-16 md:pt-48 md:pb-24">
      <Container>
        {eyebrow ? <div className="mb-6">{eyebrow}</div> : null}

        <h1 className="t-display-c max-w-[20ch] text-paper">
          <RiseLines lines={lines} delay={0.08} />
        </h1>

        {lead ? <div className="mt-7 max-w-2xl">{lead}</div> : null}
        {actions ? (
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {actions}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
