import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getPriceBook } from "@/lib/prices-db";
import { CarpetRequestForm } from "./CarpetRequestForm";

export const metadata: Metadata = {
  title: "Carpet and sofa cleaning",
  description:
    "Carpets and sofa sets cleaned at the yard. Pick the sizes, bring them in, and we will tell you when they are ready to collect.",
  alternates: { canonical: "/book/carpets" },
  openGraph: {
    title: "Carpet and sofa cleaning",
    description:
      "Carpets by size and sofa sets. Bring them to the yard and we will tell you when they are ready to collect.",
    url: "/book/carpets",
  },
};

/**
 * Per request, like /book: the sizes are priced from the database, and a
 * cached page would show a figure the yard may have changed.
 */
export const dynamic = "force-dynamic";

/**
 * UNDER /book BECAUSE THAT IS WHERE SOMEBODY LOOKS, NOT BECAUSE IT IS A
 * BOOKING. There is no slot and no bay time here — a carpet sits in the
 * yard until it is done — so this is a request staff follow up by phone,
 * not a step of the booking flow. See src/app/api/carpet-requests/route.ts.
 */
export default async function CarpetsPage() {
  const priceBook = await getPriceBook();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        eyebrow="Wash bay"
        title="Carpets & Sofa Sets"
        backHref="/book"
        backLabel="Book a wash"
        intro={
          <p>
            Tell us what needs cleaning, then bring your carpets or sofa set to
            the yard. There is no time slot to pick — we will tell you when
            they are ready to collect.
          </p>
        }
      />
      <CarpetRequestForm priceBook={priceBook} />
    </div>
  );
}
