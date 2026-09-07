/**
 * =====================================================================
 * IS THIS REQUEST FROM A SIGNED-IN STAFF MEMBER?
 * ---------------------------------------------------------------------
 * src/proxy.ts gates /admin, and its matcher covers ONLY /admin — route
 * handlers under /api are not behind it and never were. That is correct
 * for /api/login, which has to be reachable by someone who is not signed
 * in yet. It is emphatically not correct for an endpoint that returns
 * every customer's name and phone number.
 *
 * So the endpoints that carry customer data check for themselves, using
 * the same cookie and the same verification the proxy uses. This is that
 * check, in one place, so /api/bookings and its siblings cannot drift
 * apart on what "signed in" means.
 *
 * IF ADMIN_PASSWORD IS NOT SET, THIS REFUSES. Same reasoning as the proxy:
 * an unset password is a deployment mistake, and the failure mode for a
 * deployment mistake on the data behind the staff view is a locked door.
 *
 * This is the same demo-appropriate stopgap it is everywhere else in this
 * app — one shared secret, no accounts, no roles, no rate limiting. See
 * the header of src/lib/session.ts.
 * =====================================================================
 */

import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";

export function isStaffRequest(request: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    console.error(
      "[staff-guard] Refusing a staff request: ADMIN_PASSWORD is not set.",
    );
    return false;
  }
  return verifySessionValue(request.cookies.get(SESSION_COOKIE)?.value, expected);
}
