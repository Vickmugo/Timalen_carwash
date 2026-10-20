import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CHANGE_REQUEST_STATUSES, updateChangeRequestStatus } from "@/lib/change-requests-db";
import { isRef } from "@/lib/format";
import { readJsonBody } from "@/lib/request-body";
import { getStaffSession } from "@/lib/staff-guard";
import type { ChangeRequestStatus } from "@/types";

/**
 * PATCH /api/change-requests/[ref] — { status: "draft" | "sent" }. STAFF ONLY.
 *
 * Each move writes a `status_changes` row attributed to the name on the
 * staff session; a name in the body is ignored.
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
  if (!isRef(ref, "CR")) return json({ error: "not_found" }, 404);

  const parsed = await readJsonBody<{ status?: unknown } | null>(request);
  if (!parsed.ok) return parsed.response;
  const status = parsed.body?.status as ChangeRequestStatus;
  if (!CHANGE_REQUEST_STATUSES.includes(status)) {
    return json({ error: "bad_request", detail: "Unknown status." }, 400);
  }

  try {
    const result = await updateChangeRequestStatus(ref, status, staff.name);
    if (result.ok) return json({ ok: true }, 200);
    if (result.reason === "not_found") return json({ error: "not_found" }, 404);
    console.error(`[api/change-requests/[ref]] PATCH failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/change-requests/[ref]] PATCH threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
