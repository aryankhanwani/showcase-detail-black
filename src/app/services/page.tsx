import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal } from "@/components/ui/motion";
import { Lead, Section, StatusDot } from "@/components/ui/primitives";
import { serviceImage } from "@/content/media";
import { segments, services } from "@/content/studio";
import { formatBand } from "@/lib/format";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Paint protection film, ceramic coating, paint correction, interior detailing, glass and trim, and maintenance washing — with honest price bands for every vehicle segment.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow={<StatusDot>Six services</StatusDot>}
        lines={["Everything we do,", "and what it costs."]}
        lead={
          <Lead>
            Every band below runs from a hatchback at the low end to a full-size
            SUV or luxury car at the high end, inclusive of GST. The exact figure
            comes after the inspection — quoting one before we have seen the paint
            would be a guess with your money.
          </Lead>
        }
      />

      {services.map((service, i) => (
        <Section key={service.slug} id={service.slug} tight>
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
            <Reveal
              as="div"
              className={i % 2 === 1 ? "lg:order-2" : undefined}
            >
              <figure className="relative aspect-[4/3] overflow-hidden rounded-panel">
                <Image
                  src={serviceImage[service.slug]}
                  alt={service.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent"
                />
              </figure>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="t-mono text-gold/80">{service.code}</p>
              <h2 className="t-section mt-4 text-paper">{service.name}</h2>
              <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-paper-dim">
                {service.summary}
              </p>

              <ul className="mt-8 space-y-3">
                {service.includes.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[15.5px] leading-relaxed text-paper-dim"
                  >
                    <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-gold/70" />
                    {item}
                  </li>
                ))}
              </ul>

              <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-7 sm:grid-cols-3">
                <div>
                  <dt className="t-label text-paper-faint">Time in studio</dt>
                  <dd className="mt-1.5 text-[15.5px] text-paper">{service.duration}</dd>
                </div>
                <div>
                  <dt className="t-label text-paper-faint">Warranty</dt>
                  <dd className="mt-1.5 text-[15.5px] text-paper">{service.warranty}</dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="t-label text-paper-faint">Band</dt>
                  <dd className="mt-1.5 text-[15.5px] text-paper">
                    {formatBand(service.priceFrom, service.priceTo)}
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </Section>
      ))}

      <Section label="How the bands work">
        <Reveal>
          <h2 className="t-section max-w-[20ch] text-paper">
            Your car sits in one of five segments.
          </h2>
          <p className="mt-6 max-w-2xl text-[16.5px] leading-relaxed text-paper-dim">
            Panel area is what drives cost — more paint means more film, more
            coating and more hours of correction. Find yours below and read the
            band accordingly.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-5">
          {segments.map((segment, i) => (
            <Reveal key={segment.id} delay={i * 0.06} className="surface-1 rounded-card p-6">
              <p className="t-mono text-gold/70">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 text-[16px] font-medium text-paper">{segment.label}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-paper-faint">
                {segment.example}
              </p>
            </Reveal>
          ))}
        </div>
      </Section>

      <CtaBlock
        title="Not sure which one you need?"
        body="Most people who call asking for a coating actually need correction first. Bring the car in and we will tell you which — including when the answer is that you do not need us yet."
      />
    </>
  );
}
