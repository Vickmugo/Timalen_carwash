import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSessionFromCookies } from "@/lib/staff-guard";
import { StaffNameProvider } from "./StaffName";

/**
 * METADATA CARRIER — see the note in src/app/cart/layout.tsx — and the
 * one place the staff view learns the name on the session.
 *
 * `noindex, nofollow` is a backstop after the session check in src/proxy.ts
 * (the real gate) and the Disallow line in app/robots.ts.
 */
export const metadata: Metadata = {
  title: "Staff view",
  description: "Bookings, orders, payments and quote requests for the yard.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The proxy has already refused anyone without a valid session; this is
  // the same check again because the name is needed here, and a layout
  // must not render staff UI on the assumption that something else ran.
  const session = await getStaffSessionFromCookies();
  if (!session) redirect("/login?next=%2Fadmin");

  return <StaffNameProvider name={session.name}>{children}</StaffNameProvider>;
}
