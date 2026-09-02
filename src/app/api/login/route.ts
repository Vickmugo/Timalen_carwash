import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionValue,
  passwordMatches,
  safeReturnPath,
  sessionCookieOptions,
} from "@/lib/session";

/**
 * =====================================================================
 * POST /api/login — check the shared password, mint the session cookie.
 * ---------------------------------------------------------------------
 * The only place ADMIN_PASSWORD is compared against something a visitor
 * typed. src/proxy.ts checks the resulting COOKIE and never sees the
 * password itself.
 *
 * A route handler taking a plain form post, not a Server Action, because
 * the form on /login has no client JavaScript behind it: a browser can post
 * to this and follow the redirect with the JS bundle still in flight, or
 * disabled outright. It is also the shape the task called for.
 *
 * ALWAYS REDIRECTS, never renders. Right password or wrong, the answer is
 * `303 See Other` to a normal page. 303 specifically, not Next's default
 * 307: a 307 preserves the method, so the browser would POST again at the
 * destination. 303 tells it to GET, which is what turns a form submission
 * into a page you can then reload or bookmark without re-posting.
 *
 * WHAT IS DELIBERATELY MISSING, same list as everywhere else in this
 * feature: no accounts, no username, no signup, no password reset, and NO
 * RATE LIMITING — nothing here counts or slows repeated wrong guesses. One
 * shared secret guarding a demo. See src/lib/session.ts.
 * =====================================================================
 */

/** `303 See Other` + never cached. Both matter on every path out of here. */
function seeOther(url: URL): NextResponse {
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;

  const form = await request.formData();
  const supplied = form.get("password");
  // Re-validated even though /login already sanitised it into the hidden
  // field: a form post is just an HTTP request, and anybody can send one
  // with any `next` they like. See `safeReturnPath` for what it rejects.
  const next = safeReturnPath(String(form.get("next") ?? ""));

  const back = new URL("/login", request.url);
  back.searchParams.set("next", next);

  if (!expected) {
    // Nothing to check against. /login renders the "not set up" notice for
    // this case, and the proxy refuses /admin outright, so there is no path
    // where an unset password quietly opens the door.
    console.error(
      "[api/login] Sign-in attempted while ADMIN_PASSWORD is not set.",
    );
    return seeOther(back);
  }

  if (typeof supplied !== "string" || supplied.length === 0) {
    back.searchParams.set("error", "missing");
    return seeOther(back);
  }

  if (!passwordMatches(supplied, expected)) {
    back.searchParams.set("error", "wrong");
    return seeOther(back);
  }

  const response = seeOther(new URL(next, request.url));
  response.cookies.set(
    SESSION_COOKIE,
    createSessionValue(expected),
    sessionCookieOptions(),
  );
  return response;
}
