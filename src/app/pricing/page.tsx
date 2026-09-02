import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import {
  ArrowLink,
  ButtonLink,
  Lead,
  Ledger,
  LedgerRow,
  Section,
  StatusDot,
} from "@/components/ui/primitives";
import { packages, services, studio } from "@/content/studio";
import { formatBand, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Three packages quoted for a compact SUV, plus the honest band for every individual service. No discounts, no negotiation — the price buys correction hours and a warranty on the VIN.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow={<StatusDot>Pricing</StatusDot>}
        lines={["Three packages.", "One fixed figure."]}
        lead={
          <Lead>
            Package prices below are for a compact SUV — the median segment.
            Everything else is quoted per car after the inspection, and the figure
            we give you does not move once you have agreed it.
          </Lead>
        }
      />

      {/* ── Packages ────────────────────────────────────────────────────── */}
      <Section tight>
        <Stagger className="grid gap-3 md:gap-4 lg:grid-cols-3">
          {packages.map((pkg) => (
            <StaggerItem key={pkg.id}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-panel p-7 md:p-9",
                  pkg.featured ? "surface-2" : "surface-1",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="t-label text-paper">{pkg.name}</p>
                  {pkg.featured ? (
                    <span className="t-mono rounded-pill bg-gold/15 px-3 py-1 text-gold-soft">
                      Most taken
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-[16px] leading-relaxed text-paper-dim">{pkg.pitch}</p>

                <div className="mt-7 flex items-baseline gap-2.5">
                  <span className="t-numeral text-paper">{formatINR(pkg.price)}</span>
                </div>
                <p className="t-label mt-1.5 text-paper-faint">{pkg.priceNote}</p>

                <ul className="mt-8 flex-1 space-y-3 border-t border-line pt-7">
                  {pkg.includes.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-[15px] leading-relaxed text-paper-dim"
                    >
                      <span
                        aria-hidden
                        className="mt-2.5 size-1 shrink-0 rounded-full bg-gold/70"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-9">
                  <ButtonLink
                    href="/contact"
                    variant={pkg.featured ? "solid" : "outline"}
                    className="w-full"
                  >
                    Enquire
                  </ButtonLink>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── Individual services ─────────────────────────────────────────── */}
      <Section label="Every service, on its own">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <Reveal>
            <h2 className="t-section max-w-[14ch] text-paper">Bands, not a menu.</h2>
            <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-paper-dim">
              Low end is a hatchback, high end a full-size SUV or a luxury car.
              Panel area is what drives the figure, and inclusive of GST.
            </p>
            <div className="mt-8">
              <ArrowLink href="/services">What each one involves</ArrowLink>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Ledger>
              {services.map((service) => (
                <LedgerRow key={service.slug} term={service.name}>
                  {formatBand(service.priceFrom, service.priceTo)}
                </LedgerRow>
              ))}
            </Ledger>
          </Reveal>
        </div>
      </Section>

      {/* ── The price holds ─────────────────────────────────────────────── */}
      <Section label="Why the price holds" tight>
        <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
          {[
            {
              title: "We do not discount",
              body: "A lower number would have to come out of correction hours, and correction is the part you cannot see being skipped until a year later under a light.",
            },
            {
              title: "The quote is fixed",
              body: "Agreed against a written scope before the car goes into a bay. If we find something mid-job we tell you, and we absorb it unless you ask for more scope.",
            },
            {
              title: `Only ${studio.intakePerWeek} cars a week`,
              body: "Four bays and a fixed intake is why a date holds. We would rather turn work away than start a job we cannot finish properly.",
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08} className="surface-1 rounded-card p-7">
              <h3 className="text-[1.15rem] font-medium tracking-[-0.02em] text-paper">
                {item.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <CtaBlock
        title="The inspection is free."
        body="Forty minutes, no obligation, and you leave with the panel readings and a written figure whether or not you book."
      />
    </>
  );
}
