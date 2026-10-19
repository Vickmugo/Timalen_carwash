import type { Metadata } from "next";
import { CARPET_REF_PREFIX } from "@/lib/carpet-request";
import { getQuoteRequestByRef } from "@/lib/quote-requests-db";
import { ReceiptPage } from "../../receipt-page";

/**
 * /receipt/carpet/[ref] — the official receipt for a carpet or sofa-set
 * request, once staff have confirmed the payment. Same arrangement as the
 * booking receipt; see src/app/receipt/receipt-page.tsx.
 *
 * CP- references only. `quote_requests` also holds concrete quotes (QT-),
 * and a quote is a question with nothing owed — never a receipt.
 */
export const metadata: Metadata = {
  title: "Carpet receipt",
  description: "A printable receipt for carpet and sofa cleaning.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CarpetReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <ReceiptPage
      params={params}
      config={{
        prefix: CARPET_REF_PREFIX,
        load: getQuoteRequestByRef,
        backHref: () => "/book/carpets",
        notFoundBack: { href: "/book/carpets", label: "Carpets & sofa sets" },
      }}
    />
  );
}
