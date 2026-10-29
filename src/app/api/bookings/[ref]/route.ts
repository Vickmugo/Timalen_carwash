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
import { readJsonBody } from "@/lib/request-body";
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
 * WHO CAN READ A BOOKING, AND HOW MUCH.
 *
 * The reference is the only credential on GET, because the confirmation
 * page and the receipt are reached from a link carrying it. A ref is not a
 * secret (it is read aloud and pasted into chats), so:
 *
 *   - without a staff session the answer is the minimal public view
 *     (src/lib/public-view.ts): first name, masked phone, what and when,
 *     the amount and a payment label. Never the full name or phone, the
 *     vehicle, notes, the M-Pesa code or the history.
 *   - lookups without a session are rate-limited per IP (60 a minute,
 *     shared with /api/orders/[ref] and the receipt pages), counted before
 *     the ref is even checked.
 *   - new refs are eight characters from a 32-letter alphabet drawn with
 *     the platform CSPRNG (`makeRef`, src/lib/format.ts); six-character
 *     refs issued before that still resolve.
 *
 * Staff with a session get the full record.
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

  const parsed = await readJsonBody<{ paymentStatus?: unknown; jobStatus?: unknown } | null>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

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
    if (result.reason === "walk_in") {
      return json(
        {
          error: "walk_in",
          detail: "This is a walk-in. Record its payment with its own Cash or M-Pesa buttons.",
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
