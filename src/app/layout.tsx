import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { business } from "@/data/business";

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

export const metadata: Metadata = {
  // TODO: replace once the real trading name is confirmed.
  title: `${business.name} | Car wash and concrete works`,
  description:
    "Book a car wash slot, or order cabros, fencing posts and concrete decorations.",
};

export const viewport: Viewport = {
  themeColor: "#1a1d1e",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="flex min-h-screen flex-col antialiased">
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
