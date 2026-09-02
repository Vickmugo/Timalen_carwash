/**
 * =====================================================================
 * STAFF SESSION — A SIGNED COOKIE, AND NOTHING MORE THAN THAT.
 * ---------------------------------------------------------------------
 * THIS IS A DEMO-APPROPRIATE STOPGAP, exactly as the HTTP Basic Auth it
 * replaces was. It swaps the browser's credential prompt for a real login
 * page and gives staff a way to sign out. It does NOT turn this into
 * production authentication, and the same caveats still apply:
 *
 *   - ONE SHARED SECRET. Everybody who gets in is the same principal.
 *     There is no "who did that", no per-person account, and no signup.
 *   - NO IDENTITY. The cookie says "somebody knew the password", not who.
 *     The "Acting as" name in the staff view is still self-reported and
 *     still proves nothing — see src/data/admin-users.ts.
 *   - NO REVOCATION LIST. Changing ADMIN_PASSWORD invalidates every
 *     outstanding cookie at once (the signing key is derived from it), and
 *     that is the only lever. There is no "sign out this one device".
 *   - NO RATE LIMITING. Nothing here slows down or locks out repeated
 *     wrong guesses, so the password is only as good as its length.
 *   - NO ROLES. Whoever is in can do everything, including "clear all".
 *
 * WHAT THE COOKIE ACTUALLY CONTAINS, and why it is built this way:
 *
 *     v1.<expiresAt>.<HMAC-SHA256(key, "v1.<expiresAt>")>
 *
 * The plaintext password is NEVER in the cookie. Putting it there would
 * mean handing the shared secret to every browser that logs in, where any
 * XSS or an unlocked machine's devtools could read it back out — a worse
 * position than Basic Auth, which at least only replayed it to the server.
 * Instead the browser holds an expiry and a signature over that expiry.
 *
 * The signing key is `sha256(domain-separator + ADMIN_PASSWORD)`, so:
 *   - the cookie cannot be forged without knowing the password
 *   - every outstanding cookie dies the moment the password changes
 *   - the expiry is INSIDE the signed payload, so a copied cookie cannot
 *     be edited to last longer; the server never has to trust the
 *     browser's own Max-Age
 *
 * Node's built-in `node:crypto` only. No dependency was added for this.
 *
 * WHERE IT IS CHECKED: src/proxy.ts, before Next.js renders anything under
 * /admin. That is the same enforcement point the Basic Auth check used —
 * server-side, ahead of any admin HTML or data. A check inside the page
 * component would run after that data had already been sent.
 * =====================================================================
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cookie name. Prefixed with the business rather than something generic
 * like `session`, so it is obvious in devtools which app set it and so it
 * cannot collide with another project sharing localhost in development.
 */
export const SESSION_COOKIE = "timalen_staff";

/**
 * Twelve hours — one working day, near enough.
 *
 * Long enough that nobody re-types the password between the morning wash
 * queue and the afternoon deliveries; short enough that a phone left on the
 * counter overnight is not still signed in tomorrow. Basic Auth had no
 * expiry at all, so any finite number is an improvement on it.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Bound into the signing key so this HMAC can never be confused with some
 * other use of the same environment variable. Costs nothing, and the day
 * ADMIN_PASSWORD gets reused to sign something else, the two schemes stay
 * separate instead of silently accepting each other's tokens.
 */
const KEY_DOMAIN = "timalen.staff-session.v1";

/** Bumped if the payload format changes; old cookies then fail to verify. */
const VERSION = "v1";

function signingKey(secret: string): Buffer {
  return createHash("sha256").update(`${KEY_DOMAIN}:${secret}`).digest();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", signingKey(secret))
    .update(payload)
    .digest("base64url");
}

/**
 * Mints the cookie value for a successful login.
 *
 * `now` is injectable so the expiry behaviour can be exercised without
 * waiting twelve hours for it.
 */
export function createSessionValue(
  secret: string,
  now: number = Date.now(),
): string {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${VERSION}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * True only for a cookie this server signed, with this password, that has
 * not expired.
 *
 * Every failure path returns false rather than throwing. This runs in the
 * proxy on every /admin request, and a malformed cookie — truncated, hand
 * edited, left over from an older format — has to read as "not signed in"
 * and send someone to the login page, not as a 500 on the staff view.
 */
export function verifySessionValue(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [version, expiresAtRaw, signature] = parts;
  if (version !== VERSION) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;

  // Signature checked BEFORE the clock. Rejecting on expiry first would
  // answer "is this timestamp in the past?" for payloads we never signed,
  // which is a question nobody needs to be able to ask for free.
  const expected = sign(`${version}.${expiresAtRaw}`, secret);
  if (!constantTimeEquals(signature, expected)) return false;

  return expiresAt > now;
}

/**
 * Constant-time comparison.
 *
 * `timingSafeEqual` throws on buffers of different lengths, so both sides
 * are hashed to a fixed 32 bytes first. Hashing here is a length equaliser,
 * not storage — the expected password is still a plain secret in the
 * environment.
 *
 * A plain `===` returns sooner the earlier it finds a differing byte, which
 * leaks the value one character at a time to anyone patient enough to
 * measure it. Cheap to avoid, so avoid it — for the signature above and for
 * the password below.
 */
function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

/** The one password check, used by the login route handler. */
export function passwordMatches(supplied: string, expected: string): boolean {
  return constantTimeEquals(supplied, expected);
}

/**
 * Cookie attributes, in one place so the login route, the logout route and
 * the proxy cannot drift apart on them.
 *
 *   httpOnly  Page JavaScript cannot read it. The value is only a
 *             signature, but there is no reason for the client to see it.
 *   sameSite  'lax' — the cookie rides ordinary top-level navigations, so
 *             following the footer's Staff link while signed in just works,
 *             but it does not ride cross-site form posts or subrequests.
 *   secure    Production only. Setting it in development would mean the
 *             cookie is never stored over plain http://localhost and nobody
 *             could log in on their own machine, or on a phone across the
 *             LAN (see next.config.ts).
 *   path '/'  So /api/logout can clear the same cookie /admin is gated on.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Sanitises the `?next=` value carried through the login form.
 *
 * The proxy puts the page someone was trying to reach into the login URL so
 * they land back there afterwards. That value arrives in a query string,
 * which means it arrives from whoever wrote the link — and a redirect
 * target taken on trust is an open redirect: a link on our own domain that
 * quietly lands on someone else's, which is the exact shape a phishing page
 * wants to borrow.
 *
 * So: same-site absolute paths only, and only under /admin, because /admin
 * is the only thing this login gates. Everything else falls back to /admin
 * rather than erroring — a mangled return path is not worth a dead end.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  const fallback = "/admin";
  if (!raw) return fallback;

  // "//evil.example" starts with a slash but a browser reads it as a
  // protocol-relative URL to another host. So does "/\evil.example" in
  // several browsers, which is why the backslash is rejected too.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }

  const isAdmin =
    raw === "/admin" || raw.startsWith("/admin/") || raw.startsWith("/admin?");
  return isAdmin ? raw : fallback;
}
