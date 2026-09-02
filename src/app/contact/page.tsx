import type { Metadata } from "next";
import { ContactPanel } from "@/components/contact/contact-panel";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/ui/motion";
import { Container, Lead, StatusDot } from "@/components/ui/primitives";
import { studio } from "@/content/studio";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Start an enquiry and talk to the studio. Tell us about the car and the conversation opens straight away, already holding everything you typed.",
};

/* Annotated rather than `as const`: the const union makes `href` absent from
   the branches that do not carry it, and the render needs one shape. */
const DETAILS: { label: string; value: string; href?: string }[] = [
  { label: "Studio", value: studio.address },
  { label: "Phone", value: studio.phone, href: studio.phoneHref },
  { label: "Email", value: studio.email, href: `mailto:${studio.email}` },
  { label: "Hours", value: `${studio.hours.weekday}\n${studio.hours.sunday}` },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow={<StatusDot>Usually answered within the hour</StatusDot>}
        lines={["Tell us about", "the car."]}
        lead={
          <Lead>
            Fill this in and it turns into a conversation with the studio
            assistant — one that already knows your car, your segment and what you
            asked for. It will not make you type any of it twice.
          </Lead>
        }
      />

      <section className="pb-24 md:pb-36">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
            {/* ── Studio details ────────────────────────────────────────── */}
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <dl className="space-y-7">
                  {DETAILS.map((item) => (
                    <div key={item.label}>
                      <dt className="t-label text-paper-faint">{item.label}</dt>
                      <dd className="mt-2 text-[16px] leading-relaxed whitespace-pre-line text-paper">
                        {item.href ? (
                          <a
                            href={item.href}
                            className="transition-colors hover:text-gold-soft"
                          >
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-10 max-w-sm border-t border-line pt-7 text-[14.5px] leading-relaxed text-paper-faint">
                  The assistant answers from the studio&rsquo;s own service and
                  pricing information. Anything it cannot settle — a firm date, an
                  exact figure — goes to the team, and they call you.
                </p>
              </div>
            </Reveal>

            {/* ── The panel ─────────────────────────────────────────────── */}
            <Reveal delay={0.12}>
              <ContactPanel />
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}
