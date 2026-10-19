import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrderByRef } from "@/lib/orders-db";
import { isRef } from "@/lib/format";
import { publicOrder } from "@/lib/public-view";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getStaffSession } from "@/lib/staff-guard";

/**
 * /api/orders/[ref] — one order.
 *
 * Same arrangement as /api/bookings/[ref]: staff with a session get the
 * full record; anyone else holding the reference gets the minimal view in
 * src/lib/public-view.ts and counts against the shared lookup limit.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  const staff = getStaffSession(request);

  if (!staff) {
    const limited = await rateLimit(request, LIMITS.refLookup);
    if (!limited.allowed) return tooManyRequests(limited);
  }
  if (!isRef(ref, "OR")) return json({ error: "not_found" }, 404);
  try {
    const order = await getOrderByRef(ref);
    if (!order) return json({ error: "not_found" }, 404);
    return json({ order: staff ? order : publicOrder(order) }, 200);
  } catch (error) {
    console.error("[api/orders/[ref]] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}
