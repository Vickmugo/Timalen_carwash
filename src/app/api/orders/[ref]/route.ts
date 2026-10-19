import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrderByRef } from "@/lib/orders-db";

/**
 * /api/orders/[ref] — one order, for anyone holding the reference.
 *
 * Same arrangement, and the same caveat, as /api/bookings/[ref]: the
 * reference is the only credential. Read the header of that route before
 * extending this one.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;
  try {
    const order = await getOrderByRef(ref);
    if (!order) return json({ error: "not_found" }, 404);
    return json({ order }, 200);
  } catch (error) {
    console.error("[api/orders/[ref]] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}
