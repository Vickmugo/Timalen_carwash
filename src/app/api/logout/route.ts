import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/**
 * =====================================================================
 * POST /api/logout — clear the staff session cookie.
 * ---------------------------------------------------------------------
 * The thing HTTP Basic Auth could not do. There was no way to sign out of
 * it: the browser cached the credentials for the life of the tab and the
 * only reliable cure was closing the whole browser. On a machine shared by
 * a counter and a workshop, that is the difference between a stopgap and a
 * problem.
 *
 * POST, not GET, and this is not pedantry. A logout on GET can be fired by
 * anything that fetches a URL — a link in a message, an <img src>, a
 * prefetcher warming the page — and staff would find themselves signed out
 * mid-shift for no visible reason. A POST needs a real form submission,
 * which is what the Sign out button in the staff view is.
 *
 * The cookie is SameSite=Lax, so a cross-site form post does not carry it
 * and cannot log anyone out either. Worst case that is a nuisance rather
 * than a breach, but it is a nuisance worth closing.
 *
 * Clearing is unconditional: no session to clear is a fine outcome, and
 * checking first would only mean two ways to end up on the same page.
 * =====================================================================
 */

export async function POST(request: NextRequest) {
  const back = new URL("/login", request.url);
  // Says what happened on arrival. Without it the staff view simply
  // vanishes into a password box, which reads like an error rather than
  // like the button having worked.
  back.searchParams.set("signedout", "1");

  // 303 for the same reason as /api/login: turn the POST into a GET so the
  // resulting page can be reloaded without re-submitting anything.
  const response = NextResponse.redirect(back, { status: 303 });
  response.headers.set("Cache-Control", "no-store");

  /*
    Overwritten with an empty value at maxAge 0, rather than just deleted.

    `delete` emits a Set-Cookie with an expiry in the past, which is enough
    on its own — but only if the attributes line up. A cookie set on Path=/
    is not cleared by a deletion scoped to some other path, and the failure
    is silent: the browser keeps the original and staff stay signed in after
    pressing Sign out. Reusing `sessionCookieOptions()` guarantees the path,
    domain and flags match whatever /api/login used, because it is literally
    the same object.
  */
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
