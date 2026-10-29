import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readPriceBook } from "@/lib/prices-db";
import { readJsonBody } from "@/lib/request-body";
import { CROSS_ORIGIN_REFUSED, isSameOriginRequest } from "@/lib/same-origin";
import { getStaffSession } from "@/lib/staff-guard";
import { registerWalkin } from "@/lib/walkin";
import { walkinStore } from "@/lib/walkins-db";

/**
 * =====================================================================
 * POST /api/admin/walkins — register a car at the counter. STAFF ONLY.
 * ---------------------------------------------------------------------
 * No slot: today in Nairobi, now or earlier today. Priced from the live
 * price book; an amount in the body is ignored. The name on the record's
 * history is the staff session's, never the body's. A repeated
 * `walkinRequestId` returns the booking the first request made.
 *
 * The rules are in src/lib/walkin.ts, where the tests can reach them.
 * This file is the HTTP around them: same-origin, the session, the body
 * cap.
 *
 * Under /api, so src/proxy.ts does not gate it: it checks for itself,
 * like every other staff route.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) {
    return json({ error: "forbidden", detail: CROSS_ORIGIN_REFUSED }, 403);
  }
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  const parsed = await readJsonBody<unknown>(request);
  if (!parsed.ok) return parsed.response;

  try {
    const outcome = await registerWalkin({
      staff,
      body: parsed.body,
      now: new Date(),
      readPrices: readPriceBook,
      store: walkinStore,
    });
    return json(outcome.body, outcome.status);
  } catch (error) {
    console.error("[api/admin/walkins] POST threw:", error);
    return json({ error: "write_failed", detail: "That did not save. Nothing was registered — try again." }, 503);
  }
}
