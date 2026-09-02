import Image from "next/image";
import { Hero } from "@/components/home/hero";
import { ServiceCard } from "@/components/home/service-card";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal, RiseLinesOnView, Stagger, StaggerItem } from "@/components/ui/motion";
import {
  ArrowLink,
  Card,
  CardGrid,
  Container,
  Section,
  SectionTitle,
} from "@/components/ui/primitives";
import { processImage, serviceImage, workImages } from "@/content/media";
import { packages, process, services } from "@/content/studio";
import { formatINR } from "@/lib/format";

export default function HomePage() {
  const featured = packages.find((p) => p.featured) ?? packages[1];

  return (
    <>
      <Hero />

      {/* ── Positioning ─────────────────────────────────────────────────── */}
      <Section label="What we are">
        <div className="grid gap-10 md:grid-cols-[1.15fr_1fr] md:gap-16">
          <SectionTitle className="max-w-[18ch]">
            <RiseLinesOnView
              lines={["A studio, not", "a service centre."]}
            />
          </SectionTitle>

          <div className="space-y-6">
            <Reveal delay={0.1}>
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                Four bays and nine cars a week is a real ceiling, not a scarcity
                tactic. One technician owns your car from intake to handover, and
                nothing jumps the queue because it is bigger.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                Clear coat is finite. We gauge paint depth on every panel before a
                machine touches it and again afterwards, and you get the readings
                in writing — because anyone polishing without a gauge is spending
                yours blind.
              </p>
            </Reveal>
            <Reveal delay={0.26}>
              <ArrowLink href="/about">How the studio runs</ArrowLink>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      <Section label="What we do">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle className="max-w-[15ch]">
            <RiseLinesOnView lines={["Six things.", "Done properly."]} />
          </SectionTitle>
          <Reveal delay={0.15}>
            <ArrowLink href="/services">Every service in detail</ArrowLink>
          </Reveal>
        </div>

        <Stagger className="mt-12 grid gap-3 sm:grid-cols-2 md:mt-16 md:gap-4 lg:grid-cols-3">
          {services.map((service, i) => (
            <StaggerItem key={service.slug} className="flex">
              <div className="flex w-full">
                <ServiceCard
                  service={service}
                  image={serviceImage[service.slug]}
                  priority={i < 3}
                />
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <Section label="How it goes">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div>
            <SectionTitle className="max-w-[16ch]">
              <RiseLinesOnView lines={["Four steps.", "No surprises."]} />
            </SectionTitle>
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-paper-dim">
                The quote does not move once you have agreed it. We will not call
                you halfway through the job to say it needs more.
              </p>
            </Reveal>

            {/* The column is otherwise a short paragraph above a tall empty
                gutter on desktop; the image gives the section a second anchor. */}
            <Reveal delay={0.22} className="mt-10 hidden lg:block">
              <figure className="relative aspect-[4/3] overflow-hidden rounded-panel">
                <Image
                  src={processImage}
                  alt="Paint depth being read before correction"
                  fill
                  sizes="40vw"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent"
                />
              </figure>
            </Reveal>
          </div>

          <Stagger className="space-y-3 md:space-y-4">
            {process.map((step) => (
              <StaggerItem key={step.n}>
                <Card className="flex gap-6">
                  <span className="t-mono shrink-0 pt-1 text-gold/80">{step.n}</span>
                  <div>
                    <h3 className="text-[1.15rem] font-medium tracking-[-0.02em] text-paper">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">
                      {step.body}
                    </p>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      {/* ── Work ────────────────────────────────────────────────────────── */}
      <Section label="Recent work">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle className="max-w-[16ch]">
            <RiseLinesOnView lines={["Cars that left", "the studio."]} />
          </SectionTitle>
          <Reveal delay={0.15}>
            <ArrowLink href="/work">The full gallery</ArrowLink>
          </Reveal>
        </div>

        <Stagger className="mt-12 grid gap-3 sm:grid-cols-2 md:mt-16 md:gap-4 lg:grid-cols-3">
          {workImages.slice(0, 3).map((item) => (
            <StaggerItem key={item.src}>
              <figure className="group relative aspect-[4/5] overflow-hidden rounded-card">
                <Image
                  src={item.src}
                  alt={item.caption}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-[15.5px] text-paper">{item.caption}</p>
                  <p className="t-mono mt-1.5 text-paper-faint">{item.meta}</p>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      {/* ── Packages teaser ─────────────────────────────────────────────── */}
      <Section label="Where most people start">
        <Reveal>
          <div className="surface-1 rounded-panel p-8 md:p-12">
            <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
              <div>
                <p className="t-label text-gold-soft">{featured.name}</p>
                <h3 className="t-section mt-4 max-w-[18ch] text-paper">
                  {featured.pitch}
                </h3>
                <p className="mt-6 max-w-md text-[16px] leading-relaxed text-paper-dim">
                  Film on the panels that actually get hit, coating over
                  everything else. It is the combination that matches how cars are
                  really damaged.
                </p>

                <div className="mt-8 flex items-baseline gap-3">
                  <span className="t-numeral text-paper">{formatINR(featured.price)}</span>
                  <span className="t-label text-paper-faint">{featured.priceNote}</span>
                </div>

                <div className="mt-8">
                  <ArrowLink href="/pricing">Compare all three packages</ArrowLink>
                </div>
              </div>

              <ul className="space-y-3 md:border-l md:border-line md:pl-12">
                {featured.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-paper-dim">
                    <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-gold/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Section>

      <CtaBlock />
    </>
  );
}
