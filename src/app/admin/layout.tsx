import type { Metadata } from "next";

/**
 * METADATA CARRIER — see the note in src/app/cart/layout.tsx.
 *
 * `noindex, nofollow` is the third lock on this route, after the session
 * check in src/proxy.ts and the Disallow line in app/robots.ts. The proxy
 * is the one that actually protects it; a crawler that ignores robots.txt
 * gets a redirect to /login rather than a page. This tag only matters for
 * the case where somebody is signed in and a page of customer names is
 * then rendered inside something that indexes what it is shown.
 */
export const metadata: Metadata = {
  title: "Staff view",
  description: "Bookings, orders and quote requests recorded by this demo.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
