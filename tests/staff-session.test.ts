/**
 * Who may sign in under which name, and what happens to a session whose
 * name has since left the list. No database, no server.
 *
 *     npm test
 *
 * On 2026-10-26 "Julius" became "Inyingi" and "Aaron" became "Haron". A
 * cookie signed before that still carries the old name; it must read as
 * "not signed in" (the proxy then clears it and sends them to /login),
 * never as a crash or an empty name.
 *
 * There are no roles: every listed name can do everything, so "works for
 * the new names" means each one signs in and gets a session in its own
 * spelling.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalStaffName, staffNames } from "../src/data/staff-names";
import {
  createSessionValue,
  matchStaffName,
  normaliseStaffName,
  verifySessionValue,
} from "../src/lib/session";

const SECRET = "TEST-secret-at-least-thirty-two-characters-long";
const NOW = Date.parse("2026-10-26T08:00:00.000Z");

/** What /api/login does with a typed name once the password is right. */
function signIn(typed: string): string | null {
  const cleaned = normaliseStaffName(typed);
  return cleaned ? canonicalStaffName(cleaned) : null;
}

test("the list is Pamela, Inyingi, Haron, in that order", () => {
  assert.deepEqual([...staffNames], ["Pamela", "Inyingi", "Haron"]);
});

test("Inyingi and Haron are accepted, in any case, and stored as listed", () => {
  assert.equal(signIn("Inyingi"), "Inyingi");
  assert.equal(signIn("inyingi"), "Inyingi");
  assert.equal(signIn("  HARON "), "Haron");
  assert.equal(signIn("haron"), "Haron");
  assert.equal(signIn("Pamela"), "Pamela");
});

test("Julius and Aaron are no longer accepted", () => {
  for (const old of ["Julius", "julius", "Aaron", "AARON"]) {
    assert.equal(signIn(old), null, old);
  }
});

test("each listed name signs in and gets a session in its own spelling", () => {
  for (const name of staffNames) {
    const cookie = createSessionValue(signIn(name.toLowerCase())!, SECRET, NOW);
    assert.deepEqual(verifySessionValue(cookie, SECRET, staffNames, NOW + 1000), {
      name,
      expiresAt: NOW + 12 * 60 * 60 * 1000,
    });
  }
});

test("a session signed as Julius or Aaron before the rename reads as signed out", () => {
  for (const old of ["Julius", "Aaron"]) {
    // Minted exactly as the old /api/login would have, with a valid signature.
    const cookie = createSessionValue(old, SECRET, NOW);
    let result: unknown = "threw";
    assert.doesNotThrow(() => {
      result = verifySessionValue(cookie, SECRET, staffNames, NOW + 1000);
    });
    assert.equal(result, null, old);
  }
});

test("the same cookie was valid under the old list, so the list is what rejects it", () => {
  const cookie = createSessionValue("Julius", SECRET, NOW);
  assert.equal(
    verifySessionValue(cookie, SECRET, ["Pamela", "Julius", "Aaron"], NOW + 1000)?.name,
    "Julius",
  );
  assert.equal(verifySessionValue(cookie, SECRET, staffNames, NOW + 1000), null);
});

test("matchStaffName: an empty list accepts the name as is", () => {
  assert.equal(matchStaffName("Anyone", []), "Anyone");
  assert.equal(matchStaffName("haron", staffNames), "Haron");
  assert.equal(matchStaffName("Aaron", staffNames), null);
});
