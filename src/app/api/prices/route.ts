import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listRecentPriceChanges, readPriceBook, setPrice } from "@/lib/prices-db";
import type { PriceKind } from "@/lib/prices-db";
import { getStaffSession, isStaffRequest } from "@/lib/staff-guard";
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

  /*
    PARTIAL, NOT ALL-OR-NOTHING — the same rule the public pages follow.
    Whatever could be read is returned, and `unavailable` names the price
    sections that could not be, so the editor can say "these rows are not
    what the database holds" rather than presenting a failed read as a
    column of unpriced cells somebody might helpfully re-enter. A log that
    will not load is `changes: null`, and does not take the prices with it.
  */
  const [{ book: priceBook, unavailable }, changes] = await Promise.all([
    readPriceBook(),
    listRecentPriceChanges(20).catch((error: unknown) => {
      console.error("[api/prices] change log unreadable:", error);
      return null;
    }),
  ]);
  return json({ priceBook, unavailable, changes }, 200);
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
  variantId: string,
): boolean {
  if (kind === "wash") {
    return Boolean(getWashPriceRow(serviceId) && getVehicleType(vehicleTypeId));
  }
  if (kind === "flat") {
    return flatPriceGroups.some((group) =>
      group.rows.some((row) => row.id === id),
    );
  }
  const product = products.find((entry) => entry.id === id);
  if (!product) return false;
  /*
    A PRODUCT SOLD BY HEIGHT HAS NO PRICE OF ITS OWN, so a request that
    names one without a height is refused rather than written to the old
    one-figure row. That row still exists — the tiers migration depriced it
    instead of deleting it, to keep its audit history — and a write that
    reached it would put a price back on a cell nothing renders. The
    reverse holds too: a height on a single-price product is a typo.
  */
  if (!product.variants) return variantId === "";
  return product.variants.some((variant) => variant.id === variantId);
}

const KINDS: PriceKind[] = ["wash", "flat", "product"];

export async function PATCH(request: NextRequest) {
  const staff = getStaffSession(request);
  if (!staff) return json({ error: "not_authorised" }, 401);

  let body: {
    kind?: unknown;
    serviceId?: unknown;
    vehicleTypeId?: unknown;
    id?: unknown;
    variantId?: unknown;
    priceKes?: unknown;
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
  const variantId = typeof body.variantId === "string" ? body.variantId : "";

  if (!knownId(kind, serviceId, vehicleTypeId, id, variantId)) {
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

  // From the signed session; any name in the body is ignored. Still
  // self-reported at sign-in — see src/lib/session.ts.
  const by = staff.name;

  try {
    const result = await setPrice(
      kind,
      kind === "wash"
        ? { serviceId, vehicleTypeId: vehicleTypeId as VehicleTypeId }
        : kind === "product"
          ? { id, variantId }
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
