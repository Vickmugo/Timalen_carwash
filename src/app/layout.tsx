import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { business } from "@/data/business";
import { jsonLdScript, localBusinessJsonLd } from "@/lib/seo";

/**
 * One variable font, self-hosted by next/font (no runtime request to
 * Google, no render-blocking stylesheet). `display: swap` means text is
 * readable immediately on a slow mobile connection.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

/**
 * SITE-WIDE METADATA.
 *
 * `title.template` means every page below sets only its OWN name — the
 * business name is appended once, here, and cannot drift page to page.
 * `title.default` is the home page's title and the fallback for anything
 * that forgets to set one.
 *
 * `metadataBase` is required as soon as any metadata field uses a relative
 * URL (the canonicals and the OG image below do). It points at
 * `business.siteUrl` — now the real domain — and every relative URL below
 * is resolved against it, so that field has to match the origin the site
 * is actually served from. See the note on it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: {
    default: `${business.name} | Car wash and concrete works in one yard`,
    template: `%s | ${business.name}`,
  },
  description:
    "A car wash bay and a concrete yard on the same premise. Book a wash slot online, or buy fencing posts, slabs, spindles, wall caps, road kerbs, channels, cornices and cabros cast on site.",
  applicationName: business.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: business.name,
    title: `${business.name} | Car wash and concrete works in one yard`,
    description:
      "Book a car wash slot online, or buy fencing posts, slabs, spindles, wall caps, road kerbs, channels, cornices and cabros cast on site.",
    locale: "en_KE",
    url: "/",
  },
  // No Twitter image is declared: `summary_large_image` without an image
  // renders worse than a plain summary card. Revisit when there is a
  // purpose-shot OG image rather than a cropped yard photo.
  twitter: { card: "summary" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1a1d1e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      {/*
        `suppressHydrationWarning`, on this element only and one level deep.

        Browser extensions edit <body> before React hydrates — Grammarly is
        the one that showed up here, adding `data-gr-ext-installed` and
        `data-new-gr-c-s-check-loaded`. React compares the server HTML to
        what it finds, sees attributes the server never wrote, and logs a
        hydration mismatch that the developer cannot fix from inside the
        app: it is not our markup and it varies by whoever's browser is
        open. In dev that error also sends the overlay off to symbolicate a
        stack trace, which is the first link in the chain described in
        next.config.ts.

        This suppresses attribute noise on <body> itself and NOT on its
        children, so a genuine mismatch inside the app is still reported.
      */}
      <body
        suppressHydrationWarning
        className="flex min-h-screen flex-col antialiased"
      >
        {/*
          LocalBusiness structured data. Built from src/data/business.ts,
          with every still-unconfirmed field omitted rather than guessed —
          see src/lib/seo.ts. Rendered in the root layout so it appears on
          every page, which is what a search engine expects of a
          site-level business record.
        */}
        <script
          type="application/ld+json"
          // JSON-LD has no element form, so this is the only way to emit
          // it. The payload is our own data and `<` is escaped in
          // jsonLdScript(), so the script tag cannot be closed early.
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(localBusinessJsonLd()),
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-slab focus:bg-hivis focus:px-4 focus:py-2 focus:font-bold focus:text-slab-900"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
