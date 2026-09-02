import type { Metadata } from "next";

/**
 * METADATA CARRIER — this layout exists only to give /cart a title.
 *
 * src/app/cart/page.tsx is a client component (it reads the cart out of
 * localStorage), and a `"use client"` module cannot export `metadata`.
 * Without this file the cart page inherits the site default and renders in
 * the browser tab as "Timalen Auto & Concrete | Car wash and concrete works
 * in one yard" — which, on the one page where someone may have several tabs
 * open comparing things, is the least useful title available.
 *
 * `noindex` because a cart is per-visitor state and is always empty for a
 * crawler. app/robots.ts disallows the path too; this is the tag that
 * travels with the page if it is ever linked from outside.
 */
export const metadata: Metadata = {
  title: "Your cart",
  description: "The concrete products you have selected, ready to check out.",
  robots: { index: false, follow: false },
};

export default function CartLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
