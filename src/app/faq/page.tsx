import type { Metadata } from "next";
import Script from "next/script";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { PageHero } from "@/components/site/page-hero";
import { CtaBlock } from "@/components/site/cta-block";
import { Reveal } from "@/components/ui/motion";
import { ArrowLink, Lead, Section, StatusDot } from "@/components/ui/primitives";
import { faqs, studio } from "@/content/studio";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "How long a coating takes, what actually voids a warranty, whether PPF beats ceramic, and why a new car still needs correction.",
};

/** FAQPage JSON-LD, generated from the same array the page renders. */
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export default function FaqPage() {
  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PageHero
        eyebrow={<StatusDot>Questions</StatusDot>}
        lines={["The things", "everyone asks."]}
        lead={
          <Lead>
            If yours is not here, the assistant on our contact page has the same
            answers and will pass anything it cannot settle to the studio.
          </Lead>
        }
      />

      <Section tight>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <p className="text-[16.5px] leading-relaxed text-paper-dim">
                Still stuck? Call the studio — {studio.phone} — or start an
                enquiry and ask the assistant directly.
              </p>
              <div className="mt-6">
                <ArrowLink href="/contact">Start an enquiry</ArrowLink>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <FaqAccordion />
          </Reveal>
        </div>
      </Section>

      <CtaBlock />
    </>
  );
}
