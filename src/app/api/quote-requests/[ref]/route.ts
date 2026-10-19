import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CARPET_REF_PREFIX } from "@/lib/carpet-request";
import { isRef } from "@/lib/format";
import { QUOTE_STATUSES, updateQuoteRequestStatus } from "@/lib/quote-requests-db";
import { readJsonBody } from "@/lib/request-body";
import { getStaffSession } from "@/lib/staff-guard";
import type { QuoteStatus } from "@/types";

/**
 * PATCH /api/quote-requests/[ref] — staff move a concrete quote (QT-) or a
 * carpet request (CP-) between new / contacted / quoted / closed.
 *
 * Any of the four values the table's CHECK allows, in any order, so a
 * mistaken click can be put right. Each move writes a `status_changes` row
 * attributed to the name on the staff session; a name in the body is
 * ignored.
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  const { ref } = await params;
  if (!isRef(ref, "QT") && !isRef(ref, CARPET_REF_PREFIX)) {
    return json({ error: "not_found" }, 404);
  }

  const parsed = await readJsonBody<{ status?: unknown } | null>(request);
  if (!parsed.ok) return parsed.response;
  const status = parsed.body?.status as QuoteStatus;
  if (!QUOTE_STATUSES.includes(status)) {
    return json({ error: "bad_request", detail: "Unknown status." }, 400);
  }

  try {
    const result = await updateQuoteRequestStatus(ref, status, staff.name);
    if (result.ok) return json({ ok: true }, 200);
    if (result.reason === "not_found") return json({ error: "not_found" }, 404);
    console.error(`[api/quote-requests/[ref]] PATCH failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/quote-requests/[ref]] PATCH threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
