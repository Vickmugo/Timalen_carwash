import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  JOB_STATUSES,
  getBookingByRef,
  updateBookingJobStatus,
  updateBookingPayment,
} from "@/lib/bookings-db";
import { getStaffSession } from "@/lib/staff-guard";
import { isRef } from "@/lib/format";
import { publicBooking } from "@/lib/public-view";
import { LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { JobStatus, PaymentStatus } from "@/types";

/**
 * =====================================================================
 * /api/bookings/[ref] — one booking, by its printed reference.
 * ---------------------------------------------------------------------
 *   GET    read it. Anyone holding the reference.
 *   PATCH  change its job status, or (legacy bookings only) its payment
 *          status. STAFF ONLY. A booking with a payment record has its
 *          payment moved through /api/payments/[id], never here.
 *
 * WHO CAN READ A BOOKING NOW, AND WHY IT IS WORTH SAYING OUT LOUD.
 *
 * The reference is the only credential on GET. That matches how the
 * customer-facing pages work — the confirmation page and the receipt are
 * reached from a link carrying the ref, by someone who has just made the
 * booking or been handed the printout.
 *
 * It is nonetheless a REAL CHANGE from the localStorage version, and not a
 * small one. Before this stage a booking existed only in the browser that
 * made it, so a guessed reference found nothing at all. Now a guessed
 * reference returns a real customer's name, phone number and vehicle from
 * the server. `makeRef` draws six characters from a 32-letter alphabet and
 * documents itself as "not collision-proof"; it was never designed to be
 * unguessable either, and nothing here rate-limits attempts.
 *
 * That is a deliberate, documented consequence of this stage rather than an
 * oversight — the receipt has to work from a link. The fix, when these stop
 * being demo records, is a longer random reference or a separate
 * unguessable token in the URL, plus rate limiting. Noted here so it is
 * decided rather than inherited.
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

/**
 * Staff with a session get the full record. Everyone else gets the minimal
 * view (src/lib/public-view.ts) and counts against the lookup limit, which
 * is checked before the ref is so that a flood of guesses is throttled
 * whether or not the guesses are well-formed.
 */
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
  if (!isRef(ref, "WB")) return json({ error: "not_found" }, 404);

  try {
    const booking = await getBookingByRef(ref);
    if (!booking) return json({ error: "not_found" }, 404);
    return json({ booking: staff ? booking : publicBooking(booking) }, 200);
  } catch (error) {
    console.error("[api/bookings/[ref]] GET failed:", error);
    return json({ error: "read_failed" }, 503);
  }
}

/* ------------------------------------------------------------------ */
/* PATCH — payment status, with attribution                            */
/* ------------------------------------------------------------------ */

const PAYMENT_STATUSES: PaymentStatus[] = [
  "paid",
  "pay_on_collection",
  "unpaid",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> },
) {
  const staff = getStaffSession(request);
  if (!staff) {
    return json({ error: "not_authorised" }, 401);
  }
  // The name chosen at sign-in, from the signed session. Any name in the
  // body is ignored. Still self-reported — see src/lib/session.ts.
  const by = staff.name;

  const { ref } = await params;

  let body: { paymentStatus?: unknown; jobStatus?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad_request", detail: "Body is not JSON." }, 400);
  }

  /* ---- the work: booked -> in progress -> done, or cancelled / no-show ---- */
  if (body.jobStatus !== undefined) {
    const jobStatus = body.jobStatus as JobStatus;
    if (!JOB_STATUSES.includes(jobStatus)) {
      return json({ error: "bad_request", detail: "Unknown job status." }, 400);
    }
    try {
      const result = await updateBookingJobStatus(ref, jobStatus, by);
      if (result.ok) return json({ booking: result.booking }, 200);
      if (result.reason === "not_found") return json({ error: "not_found" }, 404);
      console.error(`[api/bookings/[ref]] job PATCH failed: ${result.detail}`);
      return json({ error: "write_failed" }, 503);
    } catch (error) {
      console.error("[api/bookings/[ref]] job PATCH threw:", error);
      return json({ error: "write_failed" }, 503);
    }
  }

  const paymentStatus = body.paymentStatus as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    return json(
      { error: "bad_request", detail: "Unknown payment status." },
      400,
    );
  }


  try {
    const result = await updateBookingPayment(ref, paymentStatus, by);

    if (result.ok) return json({ booking: result.booking }, 200);
    if (result.reason === "not_found") return json({ error: "not_found" }, 404);
    if (result.reason === "has_payment") {
      return json(
        {
          error: "has_payment",
          detail: "This booking has a payment record. Verify it or record the cash instead.",
        },
        409,
      );
    }

    console.error(`[api/bookings/[ref]] PATCH failed: ${result.detail}`);
    return json({ error: "write_failed" }, 503);
  } catch (error) {
    console.error("[api/bookings/[ref]] PATCH threw:", error);
    return json({ error: "write_failed" }, 503);
  }
}
