import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canonicalStaffName } from "@/data/staff-names";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  createSessionValue,
  normaliseStaffName,
  passwordMatches,
  safeReturnPath,
  sessionCookieOptions,
  staffAuthConfig,
} from "@/lib/session";

/**
 * =====================================================================
 * POST /api/login — check the shared password and the first name, mint
 * the session cookie.
 * ---------------------------------------------------------------------
 * A plain form post (the /login page has no client JavaScript), answered
 * with `303 See Other` so the browser GETs the destination rather than
 * re-posting. Never cached.
 *
 * ORDER MATTERS:
 *   1. Too many recent failures from this IP?  -> 429, nothing else checked.
 *   2. Password wrong?  -> "wrong", counted as a failure. The name is not
 *      looked at, so the response is byte-for-byte the same whatever name
 *      was sent and the staff list cannot be probed without the password.
 *   3. Name unusable or not on the staff list?  -> refused, no cookie.
 *   4. Cookie set with the canonical name.
 *
 * Only failures are counted (5 per 15 minutes per IP). There is no global
 * limit: that would let anyone lock the owner out by spamming bad
 * passwords. The long password is the real defence.
 * =====================================================================
 */

function seeOther(url: URL): NextResponse {
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const config = staffAuthConfig();

  const form = await request.formData();
  const supplied = form.get("password");
  const next = safeReturnPath(String(form.get("next") ?? ""));

  const back = new URL("/login", request.url);
  back.searchParams.set("next", next);

  if (!config.ok) {
    console.error(
      `[api/login] Sign-in attempted while ${config.missing.join(" and ")} not set.`,
    );
    return seeOther(back);
  }

  const gate = await rateLimit(request, LIMITS.loginFailures, 0);
  if (!gate.allowed) {
    return new NextResponse(
      "Too many sign-in attempts from this network. Wait a few minutes and try again.",
      {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": String(gate.retryAfterSeconds),
        },
      },
    );
  }

  if (typeof supplied !== "string" || supplied.length === 0) {
    back.searchParams.set("error", "missing");
    return seeOther(back);
  }

  if (!passwordMatches(supplied, config.password)) {
    await rateLimit(request, LIMITS.loginFailures, 1);
    back.searchParams.set("error", "wrong");
    return seeOther(back);
  }

  const cleaned = normaliseStaffName(form.get("name"));
  if (!cleaned) {
    back.searchParams.set("error", "name");
    return seeOther(back);
  }
  const name = canonicalStaffName(cleaned);
  if (!name) {
    back.searchParams.set("error", "unlisted");
    return seeOther(back);
  }

  const response = seeOther(new URL(next, request.url));
  response.cookies.set(
    SESSION_COOKIE,
    createSessionValue(name, config.secret),
    sessionCookieOptions(),
  );
  return response;
}
