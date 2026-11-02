/**
 * =====================================================================
 * IS THIS REQUEST FROM A SIGNED-IN STAFF MEMBER — AND WHICH NAME?
 * ---------------------------------------------------------------------
 * src/proxy.ts gates /admin, and its matcher covers ONLY /admin — route
 * handlers under /api are not behind it. So every endpoint that reads or
 * changes staff data checks for itself, here, with the same verification
 * the proxy uses.
 *
 * The session also carries the name chosen at sign-in. Routes that write
 * `changed_by`, `issued_by`, `voided_by` or `resolved_by` take it from
 * `getStaffSession()` and ignore any name in the request body. It is still
 * self-reported (see src/lib/session.ts), but the browser can no longer
 * change it between one click and the next.
 *
 * IF ADMIN_PASSWORD OR SESSION_SECRET IS NOT SET, THIS REFUSES.
 * =====================================================================
 */

import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { staffNames } from "@/data/staff-names";
import {
  SESSION_COOKIE,
  sessionFromCookie,
  staffAuthConfig,
  type StaffSession,
} from "@/lib/session";

function verify(value: string | undefined): StaffSession | null {
  const config = staffAuthConfig();
  if (!config.ok) {
    console.error(
      `[staff-guard] Refusing a staff request: ${config.missing.join(" and ")} not set.`,
    );
    return null;
  }
  return sessionFromCookie(value, config, staffNames);
}

/** For route handlers. */
export function getStaffSession(request: NextRequest): StaffSession | null {
  return verify(request.cookies.get(SESSION_COOKIE)?.value);
}

export function isStaffRequest(request: NextRequest): boolean {
  return getStaffSession(request) !== null;
}

/** For server components (the /admin layout), which have no request object. */
export async function getStaffSessionFromCookies(): Promise<StaffSession | null> {
  return verify((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * For /book: whether to offer the walk-in switch. A boolean only, so the
 * name never reaches a public page. Convenience, not a lock: the walk-in
 * routes check the session again on every request.
 */
export async function isStaffViewer(): Promise<boolean> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  // No cookie is the customer case; answered without `verify`, so a
  // misconfigured deploy does not log an error for every visitor.
  return value ? verify(value) !== null : false;
}
