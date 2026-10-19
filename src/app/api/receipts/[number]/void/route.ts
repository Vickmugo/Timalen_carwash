import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { voidReceipt } from "@/lib/payments-db";
import { isStaffRequest } from "@/lib/staff-guard";

/**
 * /api/receipts/[number]/void — POST { by, reason }. STAFF ONLY.
 *
 * A void is a status change with a reason. The number stays used and is
 * never issued again; the trigger on `receipts` refuses every other change
 * and refuses deletion. Voiding does not reopen the payment — if money has
 * to be taken again, that is a conversation with the customer, not a
 * button.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

const RECEIPT_NUMBER = /^[WC]-\d{6}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);

  const { number } = await params;
  if (!RECEIPT_NUMBER.test(number)) return json({ error: "not_found" }, 404);

  let body: { by?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request", detail: "Body is not JSON." }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!reason) {
    return json({ error: "bad_request", detail: "Say why the receipt is being voided." }, 400);
  }
  const by = typeof body.by === "string" ? body.by.slice(0, 100) : "";

  try {
    const result = await voidReceipt(number, by, reason);
    if (result.ok) return json({ ok: true }, 200);
    if (result.reason === "not_found") {
      return json({ error: "not_found", detail: "No issued receipt with that number (it may already be void)." }, 404);
    }
    console.error(`[api/receipts/void] failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/receipts/void] threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
