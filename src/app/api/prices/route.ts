import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPriceBook, listRecentPriceChanges, setPrice } from "@/lib/prices-db";
import type { PriceKind } from "@/lib/prices-db";
import { isStaffRequest } from "@/lib/staff-guard";
import { getVehicleType, getWashPriceRow } from "@/data/services";
import { flatPriceGroups } from "@/data/services";
import { products } from "@/data/products";
import type { VehicleTypeId } from "@/types";

/**
 * =====================================================================
 * /api/prices — read the whole book, or move one figure.
 * ---------------------------------------------------------------------
 *   GET    the price book plus the recent change log. STAFF ONLY.
 *   PATCH  set one cell. STAFF ONLY.
 *
 * BOTH VERBS ARE GATED, including the read. The prices themselves are not
 * secret — they are printed on a public page — but this endpoint also
 * returns the audit log, which carries the names of people who changed
 * them. The public pages get their prices server-side, through
 * `getPriceBook()` directly; nothing customer-facing needs this route.
 *
 * WRITES ARE SERVICE-ROLE, SERVER-SIDE, AND ONLY HERE. There is no path
 * from a browser to a price except this handler, and it checks the staff
 * session before it does anything. The anon key could not write a price
 * even if some future code tried: the grants forbid it.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/* ------------------------------------------------------------------ */
/* GET                                                                 */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);

  try {
    const [priceBook, changes] = await Promise.all([
      getPriceBook(),
      listRecentPriceChanges(20),
    ]);
    return json({ priceBook, changes }, 200);
  } catch (error) {
    console.error("[api/prices] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

/* ------------------------------------------------------------------ */
/* PATCH — one cell                                                    */
/* ------------------------------------------------------------------ */

/**
 * THE ID IS CHECKED AGAINST THE DATA FILES BEFORE ANYTHING IS WRITTEN.
 *
 * The database does not know what a service is — `service_prices` holds
 * opaque ids, deliberately, because the catalogue is code. So this is the
 * only place that can tell a real service id from a typo, and it does.
 *
 * Without it a malformed request would either write a price for a service
 * that does not exist (a dead row nothing renders, quietly accumulating)
 * or, worse, be reported as a successful edit that never shows up on the
 * site. `setPrice` returns `not_found` for an id with no seeded row, which
 * catches most of it — this catches the rest, and gives a better answer.
 */
function knownId(
  kind: PriceKind,
  serviceId: string,
  vehicleTypeId: string,
  id: string,
): boolean {
  if (kind === "wash") {
    return Boolean(getWashPriceRow(serviceId) && getVehicleType(vehicleTypeId));
  }
  if (kind === "flat") {
    return flatPriceGroups.some((group) =>
      group.rows.some((row) => row.id === id),
    );
  }
  return products.some((product) => product.id === id);
}

const KINDS: PriceKind[] = ["wash", "flat", "product"];

export async function PATCH(request: NextRequest) {
  if (!isStaffRequest(request)) return json({ error: "not_authorised" }, 401);

  let body: {
    kind?: unknown;
    serviceId?: unknown;
    vehicleTypeId?: unknown;
    id?: unknown;
    priceKes?: unknown;
    by?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request", detail: "Body is not JSON." }, 400);
  }

  const kind = body.kind as PriceKind;
  if (!KINDS.includes(kind)) {
    return json({ error: "bad_request", detail: "Unknown price kind." }, 400);
  }

  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const vehicleTypeId =
    typeof body.vehicleTypeId === "string" ? body.vehicleTypeId : "";
  const id = typeof body.id === "string" ? body.id : "";

  if (!knownId(kind, serviceId, vehicleTypeId, id)) {
    return json(
      { error: "bad_request", detail: "That is not something we price." },
      400,
    );
  }

  /*
    NULL IS A VALID VALUE, and it is not the same as a missing field.

    `priceKes: null` DEPRICES the cell — puts it back to "not listed",
    which is what the site should say about a figure nobody can stand
    behind. Anything else must be a whole non-negative number of shillings:
    this business prices in whole shillings and `formatKes` prints no
    decimals, so accepting 549.50 would mean storing a figure the site then
    displays as 550.
  */
  let priceKes: number | null;
  if (body.priceKes === null) {
    priceKes = null;
  } else if (
    typeof body.priceKes === "number" &&
    Number.isInteger(body.priceKes) &&
    body.priceKes >= 0
  ) {
    priceKes = body.priceKes;
  } else {
    return json(
      {
        error: "bad_request",
        detail: "Price must be a whole number of shillings, or null.",
      },
      400,
    );
  }

  // Self-reported "Acting as" name. Proves nothing; see admin-users.ts.
  const by = typeof body.by === "string" ? body.by : "";

  try {
    const result = await setPrice(
      kind,
      kind === "wash"
        ? { serviceId, vehicleTypeId: vehicleTypeId as VehicleTypeId }
        : { id },
      priceKes,
      by,
    );

    if (result.ok) {
      return json(
        {
          ok: true,
          oldPriceKes: result.oldPriceKes,
          newPriceKes: result.newPriceKes,
        },
        200,
      );
    }

    if (result.reason === "not_found") {
      // Seeded rows are created by the migration. A miss here means the
      // migration has not run, or has not been re-run since a service was
      // added to the data file.
      return json(
        {
          error: "not_found",
          detail:
            "No price row for that item. The price migration may not have " +
            "been applied, or this item was added after it was.",
        },
        404,
      );
    }

    console.error(`[api/prices] PATCH failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/prices] PATCH threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
