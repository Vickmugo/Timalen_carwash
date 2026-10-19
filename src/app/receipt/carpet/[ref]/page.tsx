import type { Metadata } from "next";
import { NotFound } from "@/components/Receipt";
import { CARPET_REF_PREFIX } from "@/lib/carpet-request";
import { isRef } from "@/lib/format";
import { getQuoteRequestByRef } from "@/lib/quote-requests-db";
import { ReceiptFor } from "../../ReceiptFor";

/**
 * /receipt/carpet/[ref] — the official receipt for a carpet or sofa-set
 * request, once staff have confirmed the payment. Same arrangement as the
 * booking receipt; read app/receipt/booking/[ref]/page.tsx.
 *
 * CP- references only. `quote_requests` will one day hold concrete quotes
 * too (QT-), and a quote is a question with nothing owed — never a receipt.
 */
export const metadata: Metadata = {
  title: "Carpet receipt",
  description: "A printable receipt for carpet and sofa cleaning.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CarpetReceiptPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const request = isRef(ref, CARPET_REF_PREFIX)
    ? await getQuoteRequestByRef(ref)
    : null;

  if (!request) {
    return <NotFound reference={ref} backHref="/book/carpets" backLabel="Carpets & sofa sets" />;
  }

  return (
    <ReceiptFor reference={request.ref} payment={request.payment} backHref="/book/carpets" />
  );
}
