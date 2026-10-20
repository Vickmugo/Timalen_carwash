import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { productCategories } from "@/data/products";
import { stockSubjects } from "@/lib/change-requests";
import {
  createChangeRequest,
  listChangeRequests,
  type NewChangeRequestInput,
} from "@/lib/change-requests-db";
import { cleanText, readJsonBody } from "@/lib/request-body";
import { getStaffSession, isStaffRequest } from "@/lib/staff-guard";
import type { NewItemRequest } from "@/types";

/**
 * =====================================================================
 * /api/change-requests — staff notes to the developer. STAFF ONLY.
 * ---------------------------------------------------------------------
 *   GET   every request, newest first, with its status history.
 *   POST  draft one. The server mints the ref, sets status `draft`, stamps
 *         the time and the name from the staff session; any of those in
 *         the body are ignored.
 *
 * Moved off localStorage: see src/lib/change-requests-db.ts.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** A product name is short; the rest share the 500-character cap. */
const MAX_NAME = 120;
const MAX_PRICE_KES = 10_000_000;

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);
  try {
    return json({ requests: await listChangeRequests() }, 200);
  } catch (error) {
    console.error("[api/change-requests] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

export async function POST(request: NextRequest) {
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  const parsed = await readJsonBody<Record<string, unknown> | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  const note = cleanText(body.note);

  let input: NewChangeRequestInput;
  if (body.kind === "new_item") {
    const name = cleanText(body.name, MAX_NAME);
    const categoryId = body.categoryId;
    const known = productCategories.some((category) => category.id === categoryId);
    const otherCategory = cleanText(body.otherCategory, MAX_NAME);
    const price = body.proposedPriceKes;
    if (!name) return json({ error: "bad_request", detail: "Give the new item a name." }, 400);
    if (!known && categoryId !== "other") {
      return json({ error: "bad_request", detail: "Unknown category." }, 400);
    }
    if (categoryId === "other" && !otherCategory) {
      return json({ error: "bad_request", detail: "Describe the new category." }, 400);
    }
    if (typeof price !== "number" || !Number.isInteger(price) || price <= 0 || price > MAX_PRICE_KES) {
      return json({ error: "bad_request", detail: "Enter the proposed price in whole shillings." }, 400);
    }
    input = {
      kind: "new_item",
      note,
      name,
      // Checked against the catalogue above.
      categoryId: categoryId as NewItemRequest["categoryId"],
      otherCategory: categoryId === "other" ? otherCategory : "",
      proposedPriceKes: price,
      description: cleanText(body.description),
      photoNeeded: body.photoNeeded === true,
    };
  } else if (body.kind === "stock") {
    // The label is the catalogue's, not the browser's.
    const subject = stockSubjects().find((option) => option.id === body.subjectId);
    if (!subject) return json({ error: "bad_request", detail: "Pick which product this is about." }, 400);
    if (body.intent !== "out_of_stock" && body.intent !== "back_in_stock") {
      return json({ error: "bad_request", detail: "Unknown stock change." }, 400);
    }
    input = { kind: "stock", note, subjectId: subject.id, subjectLabel: subject.label, intent: body.intent };
  } else {
    return json({ error: "bad_request", detail: "Unknown kind of request." }, 400);
  }

  try {
    // From the signed session, never the body. Self-reported at sign-in.
    const result = await createChangeRequest(input, staff.name);
    if (result.ok) return json({ ref: result.ref }, 201);
    console.error(
      `[api/change-requests] write failed: ${result.reason === "db_error" ? result.detail : result.reason}`,
    );
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/change-requests] POST threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
