/**
 * Timestamps print in Kenyan time whatever the machine's own zone is.
 *
 *     npm test
 *
 * The server runs on UTC, so the cases that matter are the ones where the
 * UTC date is still the day before: 21:00–24:00 UTC is 00:00–03:00 here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTimestamp } from "../src/lib/format-time";

test("an evening UTC instant prints as the next morning in Nairobi", () => {
  assert.equal(formatTimestamp("2026-10-19T21:36:00Z"), "20 Oct, 00:36");
});

test("the date rolls over with the time", () => {
  assert.equal(formatTimestamp("2026-10-20T21:30:00Z"), "21 Oct, 00:30");
});

test("midday stays on the same date, two-digit hours", () => {
  assert.equal(formatTimestamp("2026-10-20T06:05:00Z"), "20 Oct, 09:05");
});

test("a malformed value prints a dash", () => {
  assert.equal(formatTimestamp("not a date"), "-");
});
