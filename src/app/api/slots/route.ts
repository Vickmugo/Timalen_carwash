import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { bookingConfig } from "@/data/config";
import { getBookedIntervals } from "@/lib/bookings-db";
import { generateSlots, getBookableDates } from "@/lib/slots";

/**
 * =====================================================================
 * GET /api/slots?date=YYYY-MM-DD — which times are still free that day.
 * ---------------------------------------------------------------------
 * Public, because the booking form is public. Which is exactly why it
 * returns SLOTS AND NOTHING ELSE.
 *
 * The obvious shortcut would have been to let the form fetch the day's
 * bookings and work the slots out itself, the way it did when they were
 * sitting in its own localStorage. That would publish the customer list of
 * this business — names, phone numbers, vehicles — to anybody who opened
 * the network tab on a public page. So the day's occupied intervals never
 * leave the server: `getBookedIntervals` reads three columns, this route
 * turns them into a grid of times, and the grid is what ships.
 *
 * A caller learns which times are taken. That is unavoidable — it is the
 * entire question a booking form asks — and it reveals nothing about who
 * took them.
 *
 * NOT A SEGMENT UNDER /api/bookings, on purpose. `/api/bookings/slots`
 * would sit beside `/api/bookings/[ref]`, where a static segment and a
 * dynamic one share a level: it resolves correctly today only because no
 * reference is ever the literal string "slots". A separate path does not
 * depend on that staying true.
 * =====================================================================
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";

  /*
    Only days the form itself offers. This is a cheap bound on how much of
    the diary one caller can enumerate, and it costs nothing: the picker
    cannot ask for a day outside the window anyway.
  */
  if (!getBookableDates().includes(date)) {
    return NextResponse.json(
      { error: "bad_request", detail: "That date is not open for booking." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const slots = generateSlots(
      date,
      bookingConfig.placeholderWashDurationMinutes,
      await getBookedIntervals(date),
    );
    return NextResponse.json(
      { date, slots },
      // Never cached: a slot that was free thirty seconds ago is exactly
      // the thing this endpoint must not be able to say twice.
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/slots] failed:", error);
    return NextResponse.json(
      { error: "read_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
