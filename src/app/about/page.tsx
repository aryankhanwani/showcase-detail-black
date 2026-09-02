import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal, RiseLinesOnView } from "@/components/ui/motion";
import { Lead, Section, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { aboutImage, processImage } from "@/content/media";
import { process, studio } from "@/content/studio";

export const metadata: Metadata = {
  title: "About",
  description:
    "A four-bay detailing studio in Ahmedabad, running since 2016. One technician per car, nine cars a week, and paint depth gauged before anything touches a panel.",
};

const NUMBERS = [
  { figure: String(studio.bays), label: "Bays", note: "One car in each, start to finish" },
  { figure: String(studio.intakePerWeek), label: "Cars a week", note: "A real ceiling, not a tactic" },
  {
    figure: String(new Date().getFullYear() - studio.founded),
    label: "Years",
    note: `Working on paint since ${studio.founded}`,
  },
  { figure: "0", label: "Discounts", note: "The figure buys correction hours" },
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow={<StatusDot>{studio.city}, {studio.state}</StatusDot>}
        lines={["We measure", "what we do."]}
        lead={
          <Lead>
            AURUM has been protecting paint in {studio.city} since {studio.founded}.
            Four bays, a fixed weekly intake, and a rule that has not moved in all
            that time: nothing gets polished that has not been gauged first.
          </Lead>
        }
      />

      <Section tight>
        <Reveal>
          <figure className="relative aspect-[21/9] overflow-hidden rounded-panel">
            <Image
              src={aboutImage}
              alt="A technician working a panel inside the studio"
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent"
            />
          </figure>
        </Reveal>
      </Section>

      {/* ── Numbers ─────────────────────────────────────────────────────── */}
      <Section label="The studio, in figures" tight>
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {NUMBERS.map((item, i) => (
            <Reveal key={item.label} delay={i * 0.07} className="surface-1 rounded-card p-7">
              <p className="t-numeral text-paper">{item.figure}</p>
              <p className="t-label mt-3 text-paper">{item.label}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-paper-faint">{item.note}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── The argument ────────────────────────────────────────────────── */}
      <Section label="Why we work this way">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <SectionTitle className="max-w-[16ch]">
            <RiseLinesOnView lines={["Clear coat", "is finite."]} />
          </SectionTitle>

          <div className="space-y-6">
            <Reveal delay={0.1}>
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                There is a fixed amount of clear coat on your car and every
                correction spends some of it. That is the whole reason we gauge:
                a studio polishing without a depth reading is spending a resource
                it cannot measure and you cannot replace.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                It is also why we will tell you when a car does not need us.
                A two-year-old daily driver with good paint and a customer who
                wants a coating usually needs one stage, not three — and we would
                rather say that than sell the bigger number.
              </p>
            </Reveal>
            <Reveal delay={0.22}>
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                Nine cars a week exists for the same reason. A bay running three
                jobs at once is a bay where a panel gets rushed, and a rushed
                panel is permanent.
              </p>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <Section label="What happens to your car">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <Reveal>
            <figure className="relative aspect-[4/5] overflow-hidden rounded-panel lg:sticky lg:top-28">
              <Image
                src={processImage}
                alt="Machine polishing under inspection light"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-ink/75 via-transparent to-transparent"
              />
            </figure>
          </Reveal>

          <ol className="space-y-3 md:space-y-4">
            {process.map((step, i) => (
              <Reveal key={step.n} as="li" delay={i * 0.07} className="surface-1 rounded-card p-6 md:p-7">
                <div className="flex gap-5">
                  <span className="t-mono shrink-0 pt-1 text-gold/80">{step.n}</span>
                  <div>
                    <h3 className="text-[1.15rem] font-medium tracking-[-0.02em] text-paper">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">{step.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      {/* ── Visit ───────────────────────────────────────────────────────── */}
      <Section label="Find us" tight>
        <div className="surface-1 grid gap-8 rounded-panel p-8 md:grid-cols-3 md:p-12">
          <div>
            <p className="t-label text-paper-faint">Studio</p>
            <p className="mt-3 text-[16px] leading-relaxed text-paper">{studio.address}</p>
          </div>
          <div>
            <p className="t-label text-paper-faint">Hours</p>
            <p className="mt-3 text-[16px] leading-relaxed text-paper">
              {studio.hours.weekday}
              <br />
              {studio.hours.sunday}
            </p>
          </div>
          <div>
            <p className="t-label text-paper-faint">Reach us</p>
            <p className="mt-3 text-[16px] leading-relaxed text-paper">
              <a href={studio.phoneHref} className="transition-colors hover:text-gold-soft">
                {studio.phone}
              </a>
              <br />
              <a
                href={`mailto:${studio.email}`}
                className="transition-colors hover:text-gold-soft"
              >
                {studio.email}
              </a>
            </p>
          </div>
        </div>
      </Section>

      <CtaBlock />
    </>
  );
}
