import type { Metadata } from "next";

/**
 * METADATA CARRIER — see the note in src/app/cart/layout.tsx. Same reason:
 * src/app/checkout/page.tsx is a client component and cannot export
 * `metadata` itself.
 *
 * This layout also wraps /checkout/confirmed, which exports its own title
 * and overrides the one below. It inherits the `robots` value, which is
 * what we want — that page sets `noindex` for itself as well, and the two
 * agree.
 */
export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm your concrete order and choose how to pay.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
