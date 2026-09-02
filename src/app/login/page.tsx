import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  safeReturnPath,
  verifySessionValue,
} from "@/lib/session";

/**
 * =====================================================================
 * STAFF SIGN-IN
 * ---------------------------------------------------------------------
 * The page src/proxy.ts sends people to when they ask for /admin without a
 * valid session cookie. It replaces the browser's own Basic Auth prompt,
 * which could not be styled, could not explain itself, and could not be
 * signed out of.
 *
 * THIS PAGE IS NOT THE SECURITY BOUNDARY. It is a form. The gate is the
 * cookie check in src/proxy.ts, which runs before any admin HTML exists;
 * deleting this page would lock everybody out rather than let anybody in.
 *
 * ONE SHARED PASSWORD, exactly as before. No accounts, no signup, no
 * username, no "forgot password", no rate limiting — see the header of
 * src/lib/session.ts for the full list of what this is not, and say so on
 * the page itself rather than letting a login form imply otherwise.
 *
 * NO CLIENT JAVASCRIPT. A plain <form method="post"> to a route handler,
 * which redirects back here with ?error= or on to /admin. Errors survive in
 * the URL rather than in component state, so a failed attempt is a normal
 * page load: it works with autofill, with the back button, and on a phone
 * with a flaky connection where a JS bundle may not have arrived yet.
 * =====================================================================
 */

export const metadata: Metadata = {
  title: "Staff sign in",
  description: "Sign in to the Timalen staff view.",
  // Same reasoning as src/app/admin/layout.tsx: also disallowed in
  // app/robots.ts, and neither is what actually protects anything.
  robots: { index: false, follow: false },
};

/**
 * Every way an attempt can fail, and what to say about it.
 *
 * Looked up rather than echoed: the key comes from the query string, and
 * rendering an arbitrary `?error=` value would let anyone put words of
 * their choosing on this business's sign-in page.
 */
const ERRORS: Record<string, string> = {
  wrong: "That password is not right. Try again.",
  missing: "Enter the password to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (key: string) =>
    Array.isArray(params[key]) ? params[key][0] : params[key];

  // Re-sanitised here as well as in the route handler. This value ends up
  // in a hidden field that is posted back, and validating it at every point
  // it crosses a boundary is cheaper than reasoning about which one is the
  // real check.
  const next = safeReturnPath(first("next"));
  const expected = process.env.ADMIN_PASSWORD;

  /*
    Already signed in? Go where you were going.

    Someone with a live session who clicks the footer's Staff link is sent
    here only if the cookie has since expired — but they can also reach this
    URL from history or a bookmark, and showing a signed-in colleague a
    password box is a small lie about the state they are in.
  */
  if (expected) {
    const session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (verifySessionValue(session, expected)) redirect(next);
  }

  const error = ERRORS[first("error") ?? ""];
  const signedOut = first("signedout") === "1";

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis-dark">
        Staff only
      </p>
      <h1 className="mt-1 text-3xl sm:text-4xl">Sign in</h1>

      {expected ? (
        <>
          <p className="mt-3 text-slab-600">
            The staff view lists customer names and phone numbers, so it is
            behind a password.
          </p>

          {signedOut ? (
            <p
              // Announced because it appears after an action the visitor
              // took, on a page that otherwise looks unchanged.
              role="status"
              className="mt-6 rounded-slab border-2 border-slab-300 bg-white px-4 py-3 text-sm font-semibold text-slab-700"
            >
              Signed out. This browser no longer has access to the staff view.
            </p>
          ) : null}

          <form
            method="post"
            action="/api/login"
            className="mt-6 rounded-slab border-2 border-slab-300 bg-white p-5"
          >
            {/* Where the proxy was trying to send them. Validated on both sides. */}
            <input type="hidden" name="next" value={next} />

            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wide text-slab-500"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              // The hint that tells a password manager this is a sign-in
              // rather than a change-password form.
              autoComplete="current-password"
              required
              autoFocus
              aria-describedby={error ? "password-error" : undefined}
              aria-invalid={error ? true : undefined}
              className={`mt-1.5 min-h-12 w-full rounded-slab border-2 bg-white px-3 text-base focus:outline-none ${
                error
                  ? "border-alert focus:border-alert"
                  : "border-slab-300 focus:border-slab-900"
              }`}
            />

            {error ? (
              <p
                id="password-error"
                role="alert"
                className="mt-2 text-sm font-semibold text-alert"
              >
                {error}
              </p>
            ) : null}

            {/*
              A plain <button>, not the shared <Button> component: that one
              renders in a client bundle's idiom and this page has no client
              JavaScript at all. The classes below are the `dark` variant's,
              at the `lg` size, so it looks like every other primary action
              on the site.
            */}
            <button
              type="submit"
              className="lift mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-slab border-2 border-hivis bg-hivis px-6 py-3.5 text-base font-bold uppercase tracking-wide text-slab-900 hover:border-hivis-dark hover:bg-hivis-dark"
            >
              Sign in
            </button>
          </form>

          <div className="mt-6 rounded-slab border-2 border-slab-200 bg-white p-4">
            <h2 className="text-sm">One shared password</h2>
            <p className="mt-2 text-sm text-slab-600">
              There is no personal account here and nothing to sign up for —
              everybody at the yard uses the same password, so this says
              somebody is staff, not which member of staff. Signing in lasts
              twelve hours on this device, and there is a sign-out button at
              the top of the staff view. Lost the password? Ask whoever set
              up the site; nobody can reset it from this page.
            </p>
          </div>
        </>
      ) : (
        /*
          ADMIN_PASSWORD is unset, so there is nothing to check an answer
          against. The proxy already refuses /admin outright in this case
          (with a message aimed at whoever deployed it); this is the same
          situation seen from the front door, and rendering a form that
          cannot accept any password would be a worse answer than saying so.
        */
        <div className="mt-6 rounded-slab border-2 border-alert/40 bg-alert-tint p-5">
          <h2 className="text-base">Sign-in is not set up</h2>
          <p className="mt-2 text-sm text-slab-700">
            No staff password has been configured for this site, so there is
            nothing to sign in against. The staff view stays closed rather
            than open — it lists customer names and phone numbers.
          </p>
          <p className="mt-2 text-sm text-slab-700">
            Whoever runs the site needs to set{" "}
            <code className="font-mono">ADMIN_PASSWORD</code> in the
            environment and restart. The notes at the top of{" "}
            <code className="font-mono">src/proxy.ts</code> say how.
          </p>
        </div>
      )}
    </div>
  );
}
