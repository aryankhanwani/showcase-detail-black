import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Lead, Section, StatusDot } from "@/components/ui/primitives";
import { workImages } from "@/content/media";
import { process } from "@/content/studio";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Cars that have been through the studio — correction, coating, film and wheel work, with the segment and the time each job actually took.",
};

export default function WorkPage() {
  return (
    <>
      <PageHero
        eyebrow={<StatusDot>Recent work</StatusDot>}
        lines={["Cars that left", "the studio."]}
        lead={
          <Lead>
            Every job below carries the segment and the days it actually took. No
            before-and-after slider tricks, and no photographs of cars we have not
            worked on.
          </Lead>
        }
      />

      <Section tight>
        <Stagger className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {workImages.map((item, i) => (
            <StaggerItem key={item.src}>
              <figure
                className={`group relative overflow-hidden rounded-card ${
                  i % 5 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"
                }`}
              >
                <Image
                  src={item.src}
                  alt={item.caption}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent"
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

      <Section label="What you leave with">
        <Reveal>
          <h2 className="t-section max-w-[18ch] text-paper">
            The photographs are the least of it.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:mt-16 md:gap-4 lg:grid-cols-4">
          {process.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.07} className="surface-1 rounded-card p-6 md:p-7">
              <span className="t-mono text-gold/80">{step.n}</span>
              <h3 className="mt-4 text-[1.15rem] font-medium tracking-[-0.02em] text-paper">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-paper-dim">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <CtaBlock />
    </>
  );
}
