import Link from "next/link";
import { studio } from "@/content/studio";
import { Container } from "@/components/ui/primitives";

const COLUMNS = [
  {
    heading: "Studio",
    links: [
      { label: "Services", href: "/services" },
      { label: "Work", href: "/work" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const;

/** The footer is a section, not an object — it separates by rhythm, no tint. */
export function SiteFooter() {
  return (
    <footer className="relative pt-20 pb-12 md:pt-28">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <p className="font-display text-[19px] font-semibold tracking-[0.22em] text-paper">
              {studio.wordmark.head}
            </p>
            <p className="mt-4 max-w-[26ch] text-[15px] leading-relaxed text-paper-faint">
              {studio.tagline}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="t-label text-paper-faint">{col.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-paper-dim transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <p className="t-label text-paper-faint">Visit</p>
            <address className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-paper-dim not-italic">
              <p>{studio.address}</p>
              <p>
                <a href={studio.phoneHref} className="transition-colors hover:text-paper">
                  {studio.phone}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${studio.email}`}
                  className="transition-colors hover:text-paper"
                >
                  {studio.email}
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="t-mono text-paper-faint">
            © {new Date().getFullYear()} {studio.fullName}
          </p>
          <div className="flex flex-col gap-1 text-[14px] text-paper-faint sm:flex-row sm:gap-6">
            <span>{studio.hours.weekday}</span>
            <span>{studio.hours.sunday}</span>
          </div>
        </div>

        {/*
         * This site is a demo. Saying so in the footer is deliberate: the
         * studio, its address and its numbers are invented, and a visitor who
         * mistakes them for a real business is a problem the disclaimer costs
         * one line to prevent.
         */}
        <p className="mt-8 text-[13px] leading-relaxed text-paper-faint/70">
          AURUM Detail Studio is a fictional business built to showcase a
          marketing site. The studio, its address, its pricing and its contact
          details are not real.
        </p>
      </Container>
    </footer>
  );
}
