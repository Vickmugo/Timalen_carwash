/**
 * =====================================================================
 * STAFF SESSION — A SIGNED COOKIE, AND NOTHING MORE THAN THAT.
 * ---------------------------------------------------------------------
 * THIS IS A DEMO-APPROPRIATE STOPGAP. It is a real login page with a
 * sign-out, but it is NOT per-person authentication:
 *
 *   - ONE SHARED PASSWORD. Everybody who gets in knew the same secret.
 *   - A SELF-REPORTED NAME. Staff type their first name when they sign in
 *     and it is carried in the signed cookie, so the server — never the
 *     browser — stamps it on every change. That stops a name being swapped
 *     mid-shift from the page, but nothing stops one person typing
 *     another's name at sign-in. It is labelled "self-reported" everywhere
 *     it is shown. Per-person logins and roles are a later job.
 *   - NO ROLES. Whoever is in can do everything.
 *   - REVOCATION IS ALL-OR-NOTHING. Rotating SESSION_SECRET invalidates
 *     every outstanding cookie at once. Sign out clears this browser only;
 *     a copied cookie stays valid until it expires (twelve hours at most).
 *
 * WHAT THE COOKIE CONTAINS:
 *
 *     v2.<expiresAt>.<base64url(name)>.<HMAC-SHA256(key, "v2.<expiresAt>.<name>")>
 *
 * The name and the expiry are both inside the signed payload, so neither
 * can be edited without the signature failing. A v1 cookie (no name) does
 * not verify, so anyone holding one simply signs in again.
 *
 * THE SIGNING KEY IS SESSION_SECRET, NOT THE PASSWORD. It used to be
 * derived from ADMIN_PASSWORD, which meant a short password was also a
 * short signing key: one cookie copied off a shared machine could be
 * brute-forced offline and used to mint new ones. SESSION_SECRET is a
 * separate, long random value that nobody types. Generate one with
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
 *
 * IF EITHER VARIABLE IS MISSING, EVERYTHING FAILS CLOSED — the proxy, the
 * API guard and the login route all refuse. See `staffAuthConfig()`.
 *
 * Node's built-in `node:crypto` only.
 * =====================================================================
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cookie name.
 *
 * `__Host-` in production: the browser then refuses the cookie unless it is
 * Secure, Path=/ and has no Domain, so a sibling subdomain or a plain-http
 * page cannot plant or overwrite it. Browsers will not store a `__Host-`
 * cookie over http://localhost, so development keeps the plain name.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-timalen_staff" : "timalen_staff";

/**
 * Twelve hours — one working day. A shift change means signing in again,
 * which is also when the name on the session changes hands.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Shorter than this and SESSION_SECRET is treated as unset. */
const MIN_SECRET_LENGTH = 32;

const KEY_DOMAIN = "timalen.staff-session.v2";
const VERSION = "v2";

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export type StaffAuthConfig =
  | { ok: true; password: string; secret: string }
  | { ok: false; missing: ("ADMIN_PASSWORD" | "SESSION_SECRET")[] };

/**
 * Both variables, read at call time (never at import, so `next build` does
 * not need them). A SESSION_SECRET that is present but short counts as
 * missing: a guessable signing key is the problem this replaced.
 */
export function staffAuthConfig(): StaffAuthConfig {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  const missing: ("ADMIN_PASSWORD" | "SESSION_SECRET")[] = [];
  if (!password) missing.push("ADMIN_PASSWORD");
  if (secret.length < MIN_SECRET_LENGTH) missing.push("SESSION_SECRET");
  return missing.length === 0 ? { ok: true, password, secret } : { ok: false, missing };
}

/* ------------------------------------------------------------------ */
/* Staff name                                                          */
/* ------------------------------------------------------------------ */

export const STAFF_NAME_MIN = 2;
export const STAFF_NAME_MAX = 40;

/**
 * Cleans a typed first name, or returns null if nothing usable is left.
 *
 * Control and format characters are removed (they can hide text or break a
 * CSV row), runs of whitespace collapse to one space, and leading `=+-@`
 * go so the name can never start a spreadsheet formula wherever it is
 * exported later.
 */
export function normaliseStaffName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[=+\-@\s]+/, "")
    .trim();
  if (cleaned.length < STAFF_NAME_MIN || cleaned.length > STAFF_NAME_MAX) return null;
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Signing                                                             */
/* ------------------------------------------------------------------ */

function signingKey(secret: string): Buffer {
  return createHash("sha256").update(`${KEY_DOMAIN}:${secret}`).digest();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", signingKey(secret)).update(payload).digest("base64url");
}

export interface StaffSession {
  /** Chosen at sign-in. Self-reported: see the header of this file. */
  name: string;
  expiresAt: number;
}

/** Mints the cookie value for a successful login. */
export function createSessionValue(
  name: string,
  secret: string,
  now: number = Date.now(),
): string {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${VERSION}.${expiresAt}.${Buffer.from(name, "utf8").toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * The session, for a cookie this server signed with this secret that has
 * not expired and carries a valid name. Null for everything else.
 *
 * Never throws: a malformed cookie has to read as "not signed in", not as
 * a 500 on the staff view.
 */
export function verifySessionValue(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): StaffSession | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 4) return null;

  const [version, expiresAtRaw, nameRaw, signature] = parts;
  if (version !== VERSION) return null;

  // Signature before anything else is interpreted.
  const expected = sign(`${version}.${expiresAtRaw}.${nameRaw}`, secret);
  if (!constantTimeEquals(signature, expected)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  // Belt and braces: re-check the name even though it was signed, so a
  // rule tightened later also applies to cookies minted before it.
  const name = normaliseStaffName(Buffer.from(nameRaw, "base64url").toString("utf8"));
  if (!name) return null;

  return { name, expiresAt };
}

/**
 * Constant-time comparison. Both sides are hashed to 32 bytes first because
 * `timingSafeEqual` throws on buffers of different lengths.
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
 * Cookie attributes, in one place so login, logout and the proxy cannot
 * drift apart on them.
 *
 *   httpOnly  Page JavaScript cannot read it.
 *   sameSite  'lax' — rides top-level navigations, not cross-site posts or
 *             iframes.
 *   secure    Production only; plain http://localhost would never store it.
 *   path '/'  Required by the `__Host-` prefix, and lets /api/logout clear
 *             the same cookie /admin is gated on.
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
 * Sanitises the `?next=` value carried through the login form: same-site
 * absolute paths under /admin only, anything else falls back to /admin.
 * "//evil.example" and "/\evil.example" are protocol-relative in browsers,
 * so both are rejected.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  const fallback = "/admin";
  if (!raw) return fallback;

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }

  const isAdmin =
    raw === "/admin" || raw.startsWith("/admin/") || raw.startsWith("/admin?");
  return isAdmin ? raw : fallback;
}
