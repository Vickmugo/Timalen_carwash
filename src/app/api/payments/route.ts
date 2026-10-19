import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listPaymentsByStatus } from "@/lib/payments-db";
import { isStaffRequest } from "@/lib/staff-guard";

/**
 * =====================================================================
 * /api/payments?status=claimed|cash_due — the two staff queues. STAFF ONLY.
 * ---------------------------------------------------------------------
 * Read-only. There is no POST here: payments are created by the booking,
 * order and carpet routes, at the moment the record is written, with the
 * amount the server computed. Staff move them through /api/payments/[id].
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);

  const status = request.nextUrl.searchParams.get("status");
  if (status !== "claimed" && status !== "cash_due") {
    return json({ error: "bad_request", detail: "status must be claimed or cash_due." }, 400);
  }

  try {
    return json({ payments: await listPaymentsByStatus(status) }, 200);
  } catch (error) {
    console.error("[api/payments] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}
