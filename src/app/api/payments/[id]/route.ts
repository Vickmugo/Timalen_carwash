import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePayment, type ResolveAction } from "@/lib/payments-db";
import { readJsonBody } from "@/lib/request-body";
import { getStaffSession } from "@/lib/staff-guard";

/**
 * =====================================================================
 * /api/payments/[id] — verify, reject, or record cash. STAFF ONLY.
 * ---------------------------------------------------------------------
 *   POST { action: "verify" }
 *   POST { action: "reject", reason }                 reason required
 *   POST { action: "cash_received", amountReceivedKes? }
 *
 * The ONLY way a payment leaves `claimed` or `cash_due`, and it goes
 * through `resolve_payment()` in the database, which issues the receipt in
 * the same transaction. This route checks the session and the shape of the
 * request; the rules about which status may follow which live in that
 * function, so they hold however it is called.
 *
 * Who did it is the first name on the signed staff session, stamped here;
 * a name in the body is ignored. It is still self-reported (typed at
 * sign-in, not an identity) — see src/lib/session.ts.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

const ACTIONS: ResolveAction[] = ["verify", "reject", "cash_received"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  const { id } = await params;
  if (!UUID.test(id)) return json({ error: "not_found" }, 404);

  const parsed = await readJsonBody<{
    action?: unknown;
    reason?: unknown;
    amountReceivedKes?: unknown;
  } | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const action = body.action as ResolveAction;
  if (!ACTIONS.includes(action)) {
    return json({ error: "bad_request", detail: "Unknown action." }, 400);
  }
  // From the signed session, never the body. Self-reported at sign-in.
  const by = staff.name;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (action === "reject" && !reason) {
    return json({ error: "bad_request", detail: "Say why it is being rejected." }, 400);
  }

  let amountReceivedKes: number | undefined;
  if (action === "cash_received" && body.amountReceivedKes !== undefined && body.amountReceivedKes !== null) {
    const amount = body.amountReceivedKes;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
      return json({ error: "bad_request", detail: "The amount must be whole shillings." }, 400);
    }
    amountReceivedKes = amount;
  }

  try {
    const result = await resolvePayment(id, action, by, { reason, amountReceivedKes });
    if (result.ok) return json({ receiptNumber: result.receiptNumber }, 200);
    if (result.reason === "not_found") return json({ error: "not_found" }, 404);
    if (result.reason === "conflict") {
      // Already handled by someone else, most likely on another device.
      return json({ error: "conflict", detail: "This payment has already been dealt with. Refresh the list." }, 409);
    }
    console.error(`[api/payments/[id]] resolve failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/payments/[id]] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
