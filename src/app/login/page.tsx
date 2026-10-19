import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSessionFromCookies } from "@/lib/staff-guard";
import {
  STAFF_NAME_MAX,
  STAFF_NAME_MIN,
  safeReturnPath,
  staffAuthConfig,
} from "@/lib/session";

/**
 * =====================================================================
 * STAFF SIGN-IN
 * ---------------------------------------------------------------------
 * The page src/proxy.ts sends people to when they ask for /admin without a
 * valid session cookie.
 *
 * THIS PAGE IS NOT THE SECURITY BOUNDARY. It is a form. The gate is the
 * cookie check in src/proxy.ts and in every staff API route.
 *
 * ONE SHARED PASSWORD, PLUS A SELF-REPORTED FIRST NAME. The name is carried
 * in the signed session and stamped by the server on every change staff
 * make, but nobody checks it is really theirs. The page says so.
 *
 * THE STAFF LIST NEVER REACHES THIS PAGE. The name field is a plain text
 * box: no dropdown, no autocomplete list, nothing in the HTML. The list in
 * src/data/staff-names.ts is server-only and is consulted by /api/login
 * only after the password has been accepted.
 *
 * NO CLIENT JAVASCRIPT. A plain <form method="post"> to a route handler,
 * which redirects back here with ?error= or on to /admin.
 * =====================================================================
 */

export const metadata: Metadata = {
  title: "Staff sign in",
  description: "Sign in to the Timalen staff view.",
  robots: { index: false, follow: false },
};

/**
 * Every way an attempt can fail, and what to say about it. Looked up rather
 * than echoed, so `?error=` cannot put arbitrary words on this page.
 */
const ERRORS: Record<string, { field: "password" | "name"; text: string }> = {
  wrong: { field: "password", text: "That password is not right. Try again." },
  missing: { field: "password", text: "Enter the password to continue." },
  name: {
    field: "name",
    text: `Enter your first name (${STAFF_NAME_MIN}–${STAFF_NAME_MAX} characters).`,
  },
  unlisted: {
    field: "name",
    text: "That name isn't on the staff list. Ask the owner to add it.",
  },
};

const inputClass = (invalid: boolean) =>
  `mt-1.5 min-h-12 w-full rounded-slab border-2 bg-white px-3 text-base focus:outline-none ${
    invalid ? "border-alert focus:border-alert" : "border-slab-300 focus:border-slab-900"
  }`;

const labelClass = "block text-xs font-bold uppercase tracking-wide text-slab-500";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (key: string) =>
    Array.isArray(params[key]) ? params[key][0] : params[key];

  const next = safeReturnPath(first("next"));
  const configured = staffAuthConfig().ok;

  // Already signed in? Go where you were going.
  if (configured && (await getStaffSessionFromCookies())) redirect(next);

  const error = ERRORS[first("error") ?? ""];
  const signedOut = first("signedout") === "1";

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-hivis-dark">
        Staff only
      </p>
      <h1 className="mt-1 text-3xl sm:text-4xl">Sign in</h1>

      {configured ? (
        <>
          <p className="mt-3 text-slab-600">
            The staff view lists customer names and phone numbers, so it is
            behind a password.
          </p>

          {signedOut ? (
            <p
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
            <input type="hidden" name="next" value={next} />

            <label htmlFor="name" className={labelClass}>
              Your first name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              // "off", not "given-name": this is who is at the counter today,
              // and a browser suggesting yesterday's colleague is the mistake
              // to avoid.
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              required
              minLength={STAFF_NAME_MIN}
              maxLength={STAFF_NAME_MAX}
              autoFocus
              aria-describedby={error?.field === "name" ? "login-error" : "name-hint"}
              aria-invalid={error?.field === "name" ? true : undefined}
              className={inputClass(error?.field === "name")}
            />
            <p id="name-hint" className="mt-1.5 text-xs text-slab-500">
              Recorded on every change you make. Self-reported: not checked.
            </p>

            <label htmlFor="password" className={`mt-5 ${labelClass}`}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-describedby={error?.field === "password" ? "login-error" : undefined}
              aria-invalid={error?.field === "password" ? true : undefined}
              className={inputClass(error?.field === "password")}
            />

            {error ? (
              <p id="login-error" role="alert" className="mt-3 text-sm font-semibold text-alert">
                {error.text}
              </p>
            ) : null}

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
              Everybody at the yard uses the same password. The first name you
              type is attached to what you change, so the team can see who did
              what — but nobody checks it, so it is a courtesy, not proof.
              Signing in lasts twelve hours on this device, and there is a
              sign-out button at the top of the staff view. Lost the password?
              Ask whoever set up the site.
            </p>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-slab border-2 border-alert/40 bg-alert-tint p-5">
          <h2 className="text-base">Sign-in is not set up</h2>
          <p className="mt-2 text-sm text-slab-700">
            The staff password or session secret has not been configured for
            this site, so there is nothing to sign in against. The staff view
            stays closed rather than open — it lists customer names and phone
            numbers.
          </p>
          <p className="mt-2 text-sm text-slab-700">
            Whoever runs the site needs to set{" "}
            <code className="font-mono">ADMIN_PASSWORD</code> and{" "}
            <code className="font-mono">SESSION_SECRET</code> in the
            environment and restart. The notes at the top of{" "}
            <code className="font-mono">src/lib/session.ts</code> say how.
          </p>
        </div>
      )}
    </div>
  );
}
