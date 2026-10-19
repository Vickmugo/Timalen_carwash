import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listReceipts } from "@/lib/payments-db";
import { isStaffRequest } from "@/lib/staff-guard";

/**
 * /api/receipts — the whole ledger, newest first. STAFF ONLY.
 *
 * No POST. Receipts are issued by `issue_receipt()` in the database, via
 * /api/payments/[id], and by nothing else.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);
  try {
    return json({ receipts: await listReceipts() }, 200);
  } catch (error) {
    console.error("[api/receipts] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}
