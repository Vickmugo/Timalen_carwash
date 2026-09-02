import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";

/**
 * =====================================================================
 * /admin — THE GATE
 * ---------------------------------------------------------------------
 * WHY THIS FILE IS CALLED proxy.ts AND NOT middleware.ts
 * `middleware.ts` was deprecated in Next.js 16 and renamed to `proxy.ts`;
 * the exported function is `proxy` rather than `middleware`. Same feature,
 * same matcher, same request/response objects. This project is on Next
 * 16.3.3, so it uses the current name. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 *
 * WHAT CHANGED, AND WHAT DELIBERATELY DID NOT
 * This used to answer an unauthenticated request with `401` and a
 * `WWW-Authenticate: Basic` header, which made the browser throw up its own
 * credential prompt. Now it redirects to /login, a real page, and the check
 * is for a signed session cookie rather than a password replayed on every
 * request.
 *
 * The ENFORCEMENT POINT is unchanged and that is the part that matters: the
 * check still happens here, in the proxy, server-side, before Next.js
 * renders a single byte of admin HTML or the data behind it. A redirect
 * refuses a request just as completely as a 401 does. What changed is only
 * what the visitor sees when refused — a page we control instead of a
 * browser dialog nobody can style, log out of, or explain themselves in.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 * Still a demo-appropriate stopgap. /admin renders customer names and phone
 * numbers, and a shared password in an environment variable keeps that from
 * being readable by anyone who has or guesses the URL. It is NOT production
 * authentication:
 *
 *   - one shared secret, so there is no "who did that" and no audit trail —
 *     every member of staff is the same principal
 *   - no accounts and no signup. The "Acting as" name in the staff view is
 *     a self-reported name tag, not an identity (src/data/admin-users.ts)
 *   - no rate limiting, so the password is only as good as its length
 *   - no roles: whoever gets in can do everything, including "clear all"
 *   - the only way to revoke every outstanding session is to change
 *     ADMIN_PASSWORD, which invalidates all of them at once
 *
 * What sessions DID buy over Basic Auth: an expiry (twelve hours), a real
 * sign-out, a login page that can say why it is asking, and a secret that
 * is no longer sent on every single request. The mechanics are documented
 * in src/lib/session.ts.
 *
 * Real per-person auth is a separate job, and the right time to do it is
 * when there is an actual backend — at that point the records stop living
 * in one browser's localStorage and become real customer data on a server,
 * which is when the bullets above start to matter. The checklist for that
 * work is at the top of src/app/admin/page.tsx.
 *
 * SETTING THE PASSWORD
 * Set ADMIN_PASSWORD in the environment. Locally that means .env.local; in
 * production it is whatever the host calls environment variables. No .env
 * file is created or edited by this code, and the value is never read from
 * anywhere but process.env.
 *
 * IF IT IS NOT SET, THE ROUTE IS CLOSED, NOT OPEN. An unset variable is a
 * deployment mistake, and the failure mode for a deployment mistake on the
 * page that shows customer phone numbers has to be a locked door. Failing
 * open here would recreate the exact hole this file was written to close.
 * =====================================================================
 */

const MISCONFIGURED_MESSAGE = [
  "The staff area is not available.",
  "",
  "ADMIN_PASSWORD is not set in this environment, so there is no password to",
  "check against. Access is refused rather than granted: this page shows",
  "customer names and phone numbers.",
  "",
  "To fix: set ADMIN_PASSWORD in the environment and restart. See the notes",
  "at the top of src/proxy.ts.",
].join("\n");

export function proxy(request: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    // Server-side breadcrumb; the visitor gets the message above, which says
    // the same thing without pretending the page is merely missing.
    //
    // Not a redirect to /login: sending someone to a form that cannot
    // possibly accept any answer is worse than saying what is wrong. The
    // login page carries the same explanation for anyone who arrives there
    // by another route.
    console.error(
      "[proxy] /admin blocked: ADMIN_PASSWORD is not set. Refusing access.",
    );
    return new NextResponse(MISCONFIGURED_MESSAGE, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!verifySessionValue(session, expected)) {
    /*
      Where they were trying to go, carried across so the login lands them
      back on it rather than dumping everyone on /admin. Built from
      `nextUrl` — our own parsed URL, never a caller-supplied string — and
      re-validated on the way out in `safeReturnPath` (src/lib/session.ts),
      because by then it has been through a query string a visitor can edit.
    */
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);

    const response = NextResponse.redirect(url);
    // A redirect away from the staff area is not something a shared cache
    // should ever hold and replay — nor, past the gate, is a page of
    // customer phone numbers.
    response.headers.set("Cache-Control", "no-store");

    /*
      Clear whatever was in the cookie jar on the way past.

      It failed verification, so it is one of: expired, signed with a
      password that has since changed, or junk. None of those get better on
      the next request, and leaving it in place means the browser keeps
      sending a dead cookie to every /admin URL until it ages out on its
      own. Deleting it also means a stale session cannot be mistaken for a
      live one by anything added here later.
    */
    if (session) response.cookies.delete(SESSION_COOKIE);

    return response;
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  /*
    Scoped tightly. Without a matcher this would run on every request in the
    app, including static assets — and a proxy that redirects /_next/static
    to a login page would take the whole site down, not just lock the staff
    page.

    Both patterns are listed because `:path*` covers the segments BELOW
    /admin; the bare route needs naming in its own right.

    /login and /api/login are deliberately NOT matched. They are the way in;
    gating them on being signed in already would be a locked door whose key
    is behind the same door.
  */
  matcher: ["/admin", "/admin/:path*"],
};
