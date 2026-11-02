/**
 * Who sees the staff switch on /book. The page asks `isStaffViewer()`
 * (src/lib/staff-guard.ts), which reads the cookie and goes through
 * `sessionFromCookie` — the same check every staff route makes. That
 * function is what is tested here. No database, no server.
 *
 *     npm test
 *
 * Everything that is not a live session with a listed name must come out
 * as "customer": no cookie, a bad signature, an expired cookie, a name
 * taken off the list (Julius and Aaron, renamed on 2026-10-26), a name
 * edited inside the cookie, and a deploy missing its variables.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { staffNames } from "../src/data/staff-names";
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionValue,
  sessionFromCookie,
  type StaffAuthConfig,
} from "../src/lib/session";

const SECRET = "TEST-secret-at-least-thirty-two-characters-long";
const CONFIG: StaffAuthConfig = { ok: true, password: "TEST-password", secret: SECRET };
const NOW = Date.parse("2026-11-02T08:00:00.000Z");

/** The boolean /book gets. */
function isStaff(cookie: string | undefined, config: StaffAuthConfig = CONFIG, now = NOW + 1000) {
  return sessionFromCookie(cookie, config, staffNames, now) !== null;
}

test("a valid session for a listed name is staff", () => {
  for (const name of staffNames) {
    assert.equal(isStaff(createSessionValue(name, SECRET, NOW)), true, name);
  }
});

test("no cookie, or an empty one, is a customer", () => {
  assert.equal(isStaff(undefined), false);
  assert.equal(isStaff(""), false);
});

test("a cookie with a bad signature is a customer", () => {
  const cookie = createSessionValue("Pamela", SECRET, NOW);
  const parts = cookie.split(".");
  const last = parts[3];
  parts[3] = (last[0] === "A" ? "B" : "A") + last.slice(1);
  assert.equal(isStaff(parts.join(".")), false);
  // Signed with another secret.
  assert.equal(isStaff(createSessionValue("Pamela", `${SECRET}-other`, NOW)), false);
  assert.equal(isStaff("not-a-session"), false);
});

test("an expired cookie is a customer", () => {
  const cookie = createSessionValue("Pamela", SECRET, NOW);
  const expiry = NOW + SESSION_MAX_AGE_SECONDS * 1000;
  assert.equal(isStaff(cookie, CONFIG, expiry - 1), true);
  assert.equal(isStaff(cookie, CONFIG, expiry), false);
  assert.equal(isStaff(cookie, CONFIG, expiry + 60_000), false);
});

test("a name no longer on the list (Julius, Aaron) is a customer", () => {
  for (const old of ["Julius", "Aaron"]) {
    assert.equal(isStaff(createSessionValue(old, SECRET, NOW)), false, old);
  }
});

test("a name edited inside a signed cookie is a customer", () => {
  const cookie = createSessionValue("Julius", SECRET, NOW);
  const parts = cookie.split(".");
  parts[2] = Buffer.from("Pamela", "utf8").toString("base64url");
  assert.equal(isStaff(parts.join(".")), false);
});

test("with ADMIN_PASSWORD or SESSION_SECRET missing, nobody is staff", () => {
  const cookie = createSessionValue("Pamela", SECRET, NOW);
  assert.equal(isStaff(cookie, { ok: false, missing: ["SESSION_SECRET"] }), false);
  assert.equal(isStaff(cookie, { ok: false, missing: ["ADMIN_PASSWORD"] }), false);
});
