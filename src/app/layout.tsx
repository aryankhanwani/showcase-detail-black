import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { SiteFooter } from "@/components/site/footer";
import { SiteNav } from "@/components/site/nav";
import { studio } from "@/content/studio";
import "./globals.css";

/*
 * Two families, one job each.
 *
 * Sora is display only: a geometric grotesque that keeps its structure at
 * 5rem+ on a dark ground, which is where a UI face goes flat. Inter is body
 * only — it is the most legible thing available at 16–17px on the mid-range
 * Android this site is actually read on. Running one family across both roles
 * is the obvious simplification and it collapses the hierarchy.
 *
 * Both come from next/font/google rather than an npm package because Google
 * splits families by unicode-range; a self-hosted variable font ships the
 * Cyrillic and Greek this site will never render.
 */
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${studio.fullName} — Paint Protection & Ceramic Coating in ${studio.city}`,
    template: `%s · ${studio.name}`,
  },
  description:
    "A four-bay detailing studio in Ahmedabad. Paint protection film, ceramic coating and measured paint correction — quoted against a written scope, warranted to the VIN.",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: studio.fullName,
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sora.variable} ${inter.variable}`}>
      <body className="bg-ink text-paper antialiased">
        {/* The site's only background, rendered once, behind everything. */}
        <div aria-hidden className="ground" />

        <a
          href="#main"
          className="sr-only-focusable t-label fixed top-4 left-4 z-[60] rounded-pill bg-paper px-5 py-2.5 text-ink"
        >
          Skip to content
        </a>

        <SiteNav />
        <main id="main" className="relative z-10">
          {children}
        </main>
        <div className="relative z-10">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
