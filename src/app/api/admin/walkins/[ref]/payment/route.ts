import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRef } from "@/lib/format";
import { CODE_ALREADY_USED, parsePaymentChoice } from "@/lib/payments";
import { readJsonBody } from "@/lib/request-body";
import { CROSS_ORIGIN_REFUSED, isSameOriginRequest } from "@/lib/same-origin";
import { getStaffSession } from "@/lib/staff-guard";
import { attachWalkinPayment } from "@/lib/walkins-db";

/**
 * =====================================================================
 * POST /api/admin/walkins/[ref]/payment — how a walk-in pays. STAFF ONLY.
 * ---------------------------------------------------------------------
 *   { method: "cash" }                                     -> cash_due
 *   { method: "mpesa", destination: "till", mpesaCode }    -> claimed
 *
 * Read by `parsePaymentChoice`, the same check the customer's form goes
 * through: same code format, same till, and a status or amount in the
 * body is never looked at. The amount is the walk-in's server price.
 *
 * NOTHING HERE SETTLES A PAYMENT. Cash received and Verify are the
 * existing actions on /api/payments/[id], a second tap each, so the
 * verify step still shows the code to compare with the statement.
 *
 * KNOWN WEAKER SEPARATION: one self-reported staff name can type a code
 * here and verify it there. The session name is self-reported anyway
 * (src/lib/session.ts); this removes the customer from the claim.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  if (!isSameOriginRequest(request.headers)) {
    return json({ error: "forbidden", detail: CROSS_ORIGIN_REFUSED }, 403);
  }
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  const { ref } = await params;
  if (!isRef(ref)) return json({ error: "not_found" }, 404);

  const parsed = await readJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;

  const choice = parsePaymentChoice(parsed.body, "wash");
  if (!choice.ok) return json({ error: "bad_request", detail: choice.detail }, 400);

  try {
    const result = await attachWalkinPayment(ref, choice.choice);
    if (result.ok) return json({ booking: result.booking }, 201);
    if (result.reason === "not_found") return json({ error: "not_found" }, 404);
    if (result.reason === "not_walk_in") {
      return json({ error: "not_walk_in", detail: "Only a walk-in's payment is recorded here." }, 409);
    }
    if (result.reason === "has_payment") {
      return json(
        { error: "has_payment", detail: "This walk-in already has a payment. Refresh the list." },
        409,
      );
    }
    if (result.reason === "code_used") {
      return json({ error: "code_used", detail: CODE_ALREADY_USED }, 409);
    }
    console.error(`[api/admin/walkins/[ref]/payment] failed: ${result.detail}`);
    return json({ error: "write_failed", detail: "That did not save. Nothing changed — try again." }, 503);
  } catch (error) {
    console.error("[api/admin/walkins/[ref]/payment] POST threw:", error);
    return json({ error: "write_failed", detail: "That did not save. Nothing changed — try again." }, 503);
  }
}
