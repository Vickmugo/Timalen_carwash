/**
 * Staff walk-ins, at fixed instants read as Nairobi time. No database: an
 * in-memory store stands in for src/lib/walkins-db.ts and honours the
 * same unique rule on `walkinRequestId`.
 *
 *     npm test
 *
 * Monday 2026-10-26, open 08:00–18:00; Sunday closed (src/data/business.ts).
 * Nairobi is UTC+3 all year.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { countsTowardPhoneCap, planWalkinTime, priceWalkin, registerWalkin } from "../src/lib/walkin";
import type { WalkinRecord, WalkinStore } from "../src/lib/walkin";
import { checkSlot, generateSlots } from "../src/lib/slots";
import { isSameOriginRequest } from "../src/lib/same-origin";
import { buildReceiptView } from "../src/lib/receipt-view";
import type { Booking, PriceBook, ReceiptRecord } from "../src/types";

/** Nairobi wall-clock on a date, as an instant. */
function at(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+03:00`);
}
const MONDAY = "2026-10-26";
const SUNDAY = "2026-10-25";
const REQUEST_ID = "6f1c2b9e-4a7d-4c1e-9b2a-0d3e5f7a8b9c";

const BOOK: PriceBook = {
  wash: { "body-wash:saloon": 300, "engine-wash:saloon": 200, "body-wash:pickup": 400 },
  flat: {},
  product: {},
};

function body(extra: Record<string, unknown> = {}) {
  return {
    walkinRequestId: REQUEST_ID,
    vehicleTypeId: "saloon",
    serviceIds: ["body-wash", "engine-wash"],
    ...extra,
  };
}

/** The store, in memory, with the partial unique index on the request id. */
function memoryStore() {
  const rows: (Booking & { walkinRequestId: string; by: string })[] = [];
  let seq = 0;
  const store: WalkinStore = {
    async findByRequestId(id) {
      return rows.find((row) => row.walkinRequestId === id) ?? null;
    },
    async insert(record: WalkinRecord, by: string) {
      if (rows.some((row) => row.walkinRequestId === record.walkinRequestId)) {
        return { ok: false, reason: "duplicate_request" };
      }
      seq += 1;
      const booking = {
        ref: `WB-TEST${String(seq).padStart(4, "0")}`,
        vehicleTypeId: record.vehicleTypeId,
        vehicleTypeName: record.vehicleTypeName,
        lines: record.lines,
        priceKes: record.priceKes,
        durationMinutes: record.durationMinutes,
        date: record.date,
        startTime: record.startTime,
        endTime: record.endTime,
        customerName: record.customerName,
        phone: record.phone,
        vehicle: record.vehicle,
        notes: "",
        paymentStatus: "unpaid" as const,
        jobStatus: record.jobStatus,
        source: "staff" as const,
        createdAt: new Date().toISOString(),
        history: [{ to: "walk_in_registered", by, at: new Date().toISOString() }],
      };
      rows.push({ ...booking, walkinRequestId: record.walkinRequestId, by });
      return { ok: true, booking };
    },
  };
  return { store, rows };
}

async function register(
  extra: Record<string, unknown>,
  now: Date,
  options: { staff?: { name: string } | null; store?: WalkinStore } = {},
) {
  const store = options.store ?? memoryStore().store;
  return registerWalkin({
    staff: options.staff === undefined ? { name: "Pamela" } : options.staff,
    body: body(extra),
    now,
    readPrices: async () => ({ book: BOOK, unavailable: [] }),
    store,
  });
}

function bookingOf(outcome: { body: Record<string, unknown> }): Booking {
  return outcome.body.booking as Booking;
}

/* ---------------------------- time rules ---------------------------- */

test("now is accepted: today in Nairobi, at the current minute, held 30 minutes", async () => {
  const outcome = await register({}, at(MONDAY, "10:07"));
  assert.equal(outcome.status, 201);
  const booking = bookingOf(outcome);
  assert.equal(booking.date, MONDAY);
  assert.equal(booking.startTime, "10:07");
  assert.equal(booking.endTime, "10:37");
  assert.equal(booking.jobStatus, "booked");
});

test("earlier today is accepted, and Already finished stores done", async () => {
  const outcome = await register({ serviceTime: "08:15", alreadyDone: true }, at(MONDAY, "15:00"));
  assert.equal(outcome.status, 201);
  assert.equal(bookingOf(outcome).startTime, "08:15");
  assert.equal(bookingOf(outcome).jobStatus, "done");
});

test("the future is refused, beyond a five-minute tolerance", async () => {
  assert.equal((await register({ serviceTime: "10:05" }, at(MONDAY, "10:00"))).status, 201);
  const later = await register({ serviceTime: "10:06" }, at(MONDAY, "10:00"));
  assert.equal(later.status, 400);
  assert.equal(later.body.error, "future");
});

test("yesterday cannot be entered: a late time just after midnight is refused, not read as yesterday", async () => {
  // 00:10 on Tuesday; "23:30" would be Monday night.
  const outcome = await register({ serviceTime: "23:30", confirmOutsideHours: true }, at("2026-10-27", "00:10"));
  assert.equal(outcome.status, 400);
  assert.equal(outcome.body.error, "future");
  // And a date in the body is not read at all: the date is always today.
  const dated = await register({ date: "2026-10-25" }, at(MONDAY, "11:00"));
  assert.equal(bookingOf(dated).date, MONDAY);
});

test("outside hours returns outside_hours, and passes with the confirm flag", async () => {
  const early = await register({ serviceTime: "07:30" }, at(MONDAY, "09:00"));
  assert.equal(early.status, 409);
  assert.equal(early.body.error, "outside_hours");
  assert.equal(early.body.detail, "This is outside opening hours. Register anyway?");

  const confirmed = await register({ serviceTime: "07:30", confirmOutsideHours: true }, at(MONDAY, "09:00"));
  assert.equal(confirmed.status, 201);

  // Closing time itself is outside; Sunday is outside all day.
  assert.equal((await register({}, at(MONDAY, "18:00"))).body.error, "outside_hours");
  assert.equal((await register({}, at(SUNDAY, "11:00"))).body.error, "outside_hours");
  assert.equal((await register({ confirmOutsideHours: true }, at(SUNDAY, "11:00"))).status, 201);
});

test("midnight clamp: the end never passes 23:59, and stays after the start", () => {
  const late = planWalkinTime({ serviceTime: null, durationMinutes: 90, confirmOutsideHours: true, now: at(MONDAY, "23:10") });
  assert.deepEqual(late, { ok: true, date: MONDAY, startTime: "23:10", endTime: "23:59", outsideHours: true });

  const last = planWalkinTime({ serviceTime: null, durationMinutes: 30, confirmOutsideHours: true, now: at(MONDAY, "23:59") });
  assert.ok(last.ok);
  assert.equal(last.endTime, "23:59");
  assert.ok(last.startTime < last.endTime);
});

/* ------------------------- price and people ------------------------- */

test("a tampered amount is ignored: the price comes from the price book", async () => {
  const outcome = await register(
    { priceKes: 1, amountKes: 1, lines: [{ serviceId: "body-wash", name: "x", priceKes: 1 }] },
    at(MONDAY, "10:00"),
  );
  const booking = bookingOf(outcome);
  assert.equal(booking.priceKes, 500);
  assert.deepEqual(booking.lines?.map((line) => line.priceKes), [300, 200]);
});

test("pricing matches the online route: unpriced services drop, flat vehicles take one size", () => {
  const priced = priceWalkin(BOOK, "saloon", ["body-wash", "polishing"]);
  assert.ok(priced.ok);
  assert.equal(priced.priceKes, 300);
  assert.equal(priceWalkin(BOOK, "saloon", ["polishing"]).ok, false);
  assert.equal(priceWalkin(BOOK, "spaceship", ["body-wash"]).ok, false);
  assert.equal(priceWalkin(BOOK, "saloon", []).ok, false);
});

test("phone and name blank: stored as '' and 'Customer'; a plate is cleaned", async () => {
  const booking = bookingOf(
    await register({ customerName: "   ", phone: "", plate: "  kda  123x " }, at(MONDAY, "10:00")),
  );
  assert.equal(booking.customerName, "Customer");
  assert.equal(booking.phone, "");
  assert.equal(booking.vehicle, "KDA 123X");
});

test("a phone, when given, is normalised; a bad one is refused", async () => {
  assert.equal(bookingOf(await register({ phone: "+254 700 000 041" }, at(MONDAY, "10:00"))).phone, "0700000041");
  const bad = await register({ phone: "12345" }, at(MONDAY, "10:00"));
  assert.equal(bad.status, 400);
});

/* --------------------------- idempotency ---------------------------- */

test("the same walkinRequestId twice gives one booking", async () => {
  const { store, rows } = memoryStore();
  const first = await register({}, at(MONDAY, "10:00"), { store });
  const second = await register({ serviceIds: ["body-wash"] }, at(MONDAY, "10:01"), { store });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.body.replayed, true);
  assert.equal(bookingOf(second).ref, bookingOf(first).ref);
  assert.equal(rows.length, 1);
});

test("a retry that races the first (unique index fires) returns the first booking", async () => {
  const { store, rows } = memoryStore();
  let lookups = 0;
  const racing: WalkinStore = {
    // The first lookup misses, as if the other request had not landed yet.
    findByRequestId: async (id) => (lookups++ === 0 ? null : store.findByRequestId(id)),
    insert: store.insert,
  };
  await register({}, at(MONDAY, "10:00"), { store });
  const outcome = await register({}, at(MONDAY, "10:00"), { store: racing });
  assert.equal(outcome.status, 200);
  assert.equal(rows.length, 1);
});

/* ----------------------------- the session ---------------------------- */

test("unauthenticated is refused, before anything is read or written", async () => {
  const { store, rows } = memoryStore();
  const outcome = await register({}, at(MONDAY, "10:00"), { staff: null, store });
  assert.equal(outcome.status, 401);
  assert.equal(rows.length, 0);
});

test("the acting name in the body is ignored; the session's is stamped", async () => {
  const { store, rows } = memoryStore();
  await register({ by: "Mallory", changedBy: "Mallory", staffName: "Mallory" }, at(MONDAY, "10:00"), {
    staff: { name: "Inyingi" },
    store,
  });
  assert.equal(rows[0].by, "Inyingi");
});

/* ------------------------ online rules unchanged ------------------------ */

test("a staff entry blocks the overlapping online slot", () => {
  // A walk-in 10:07–10:37 on a Monday; online, the day before.
  const walkIn = { date: MONDAY, startTime: "10:07", endTime: "10:37" } as Booking;
  const slots = generateSlots(MONDAY, 30, [walkIn], at("2026-10-25", "12:00"));
  assert.deepEqual(checkSlot(slots, "10:00"), { ok: false, error: "slot_taken" });
  assert.deepEqual(checkSlot(slots, "10:30"), { ok: false, error: "slot_taken" });
  assert.equal(checkSlot(slots, "11:00").ok, true);
});

test("a staff entry does not count toward the phone cap; online ones still do", () => {
  assert.equal(countsTowardPhoneCap({ source: "staff" }), false);
  assert.equal(countsTowardPhoneCap({ source: "online" }), true);
  // A row read before the column existed has no source: it is online.
  assert.equal(countsTowardPhoneCap({}), true);
});

/* ---------------------------- same origin ---------------------------- */

test("same-origin: our own host passes, anything else or nothing is refused", () => {
  const h = (entries: Record<string, string>) => new Headers(entries);
  assert.equal(isSameOriginRequest(h({ host: "timalen.example", origin: "https://timalen.example" })), true);
  assert.equal(isSameOriginRequest(h({ host: "localhost:3000", "sec-fetch-site": "same-origin" })), true);
  // A deploy preview: compared with the request's own host, not a fixed domain.
  assert.equal(
    isSameOriginRequest(
      h({ host: "internal:3000", "x-forwarded-host": "preview-1.vercel.app", origin: "https://preview-1.vercel.app" }),
    ),
    true,
  );
  assert.equal(isSameOriginRequest(h({ host: "timalen.example", origin: "https://evil.example" })), false);
  assert.equal(isSameOriginRequest(h({ host: "timalen.example", origin: "null" })), false);
  assert.equal(
    isSameOriginRequest(h({ host: "timalen.example", origin: "https://timalen.example", "sec-fetch-site": "cross-site" })),
    false,
  );
  assert.equal(isSameOriginRequest(h({ host: "timalen.example" })), false);
});

/* ------------------------------ receipts ------------------------------ */

test("a walk-in receipt with a blank phone and the name Customer renders cleanly", () => {
  const receipt: ReceiptRecord = {
    id: "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
    number: "W-000124",
    series: "W",
    seq: 124,
    status: "issued",
    issuedAt: "2026-10-26T08:00:00.000Z",
    issuedBy: "Haron",
    amountKes: 500,
    method: "cash",
    mpesaCode: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    snapshot: {
      kind: "booking",
      ref: "WB-TEST0001",
      customer_name: "Customer",
      phone: "",
      lines: [{ name: "Body Wash", variant: null, unit: null, quantity: 1, price_kes: 500 }],
      stream: "wash",
      method: "cash",
      destination: null,
      mpesa_code: null,
      expected_kes: 500,
      received_kes: 500,
      amount_differs: false,
      claimed_at: "2026-10-26T07:30:00.000Z",
      confirmed_at: "2026-10-26T08:00:00.000Z",
      confirmed_by: "Haron",
      vehicle: "",
      priced_as: "Saloon",
      date: MONDAY,
      start_time: "10:07",
      end_time: "10:37",
    },
  };
  for (const audience of ["public", "staff"] as const) {
    const view = buildReceiptView(receipt, audience);
    assert.equal(view.customerName, "Customer", audience);
    assert.equal(view.phone, "", audience);
    assert.ok(!JSON.stringify(view).includes("undefined"), audience);
  }
});

/* --------------------- the migration, read as text --------------------- */

const MIGRATION = readFileSync(
  new URL("../supabase/migrations/20261026100000_staff_walkins.sql", import.meta.url),
  "utf8",
);
/** The SQL with comments removed, lower-cased. */
const SQL = MIGRATION.replace(/--.*$/gm, "").toLowerCase();

test("migration: additive and idempotent", () => {
  assert.match(SQL, /add column if not exists source text not null default 'online'/);
  assert.match(SQL, /check \(source in \('online', 'staff'\)\)/);
  assert.match(SQL, /add column if not exists walkin_request_id uuid;/);
  assert.match(
    SQL,
    /create unique index if not exists bookings_walkin_request_unique\s+on public\.bookings \(business_id, walkin_request_id\)\s+where walkin_request_id is not null/,
  );
  for (const forbidden of [/\bdrop\b/, /\balter column\b/, /\brename\b/, /\bupdate public\./,/\bdelete from\b/, /\btruncate\b/]) {
    assert.doesNotMatch(SQL, forbidden);
  }
});

test("migration: RLS untouched, browser roles still shut out", () => {
  assert.doesNotMatch(SQL, /disable row level security/);
  assert.doesNotMatch(SQL, /create policy/);
  assert.match(SQL, /revoke all on public\.bookings from public, anon, authenticated;/);
  assert.doesNotMatch(SQL, /grant [^;]* to (anon|authenticated|public)/);
});
