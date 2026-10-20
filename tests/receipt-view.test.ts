/**
 * What a receipt page may show, on fixtures. No database, no server.
 *
 *     npm test
 *
 * The four payment states: claimed (no receipt), rejected, issued, void.
 * For a visitor, the serialised result must never contain any of FORBIDDEN.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskMpesaCode, maskPhone } from "../src/lib/mask";
import { receiptPageResult } from "../src/lib/receipt-view";
import type { PaymentSummary, ReceiptRecord } from "../src/types";

const CODE = "TESTQ7K2LX";
const PAYMENT_ID = "1e5de7f7-c769-4042-8de8-d8b1d19a36bd";
const RECEIPT_ID = "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d";
const CLAIMED_AT = "2026-10-19T09:12:56.057Z";
const REJECT_REASON = "TEST code not on the till statement";
const VOID_REASON = "TEST typed the wrong amount";
const STAFF_NAMES = ["Pamela", "Julius", "Aaron"];

function payment(status: PaymentSummary["status"], receipt: PaymentSummary["receipt"]): PaymentSummary {
  return {
    id: PAYMENT_ID,
    method: "mpesa",
    destination: "till",
    status,
    amountKes: 1350,
    amountReceivedKes: null,
    mpesaCode: CODE,
    claimedAt: CLAIMED_AT,
    rejectReason: status === "rejected" ? REJECT_REASON : null,
    receipt,
  };
}

function receiptRow(status: "issued" | "void"): ReceiptRecord {
  return {
    id: RECEIPT_ID,
    number: "W-000123",
    series: "W",
    seq: 123,
    status,
    issuedAt: "2026-10-19T10:00:00.000Z",
    issuedBy: "Pamela",
    amountKes: 1350,
    method: "mpesa",
    mpesaCode: CODE,
    voidedAt: status === "void" ? "2026-10-19T11:00:00.000Z" : null,
    voidedBy: status === "void" ? "Julius" : null,
    voidReason: status === "void" ? VOID_REASON : null,
    snapshot: {
      kind: "booking",
      ref: "WB-TEST2345",
      customer_name: "TEST Wanjiru Kamau",
      phone: "+254712345678",
      lines: [{ name: "Body Wash", variant: null, unit: null, quantity: 1, price_kes: 1350 }],
      stream: "wash",
      method: "mpesa",
      destination: "till",
      mpesa_code: CODE,
      expected_kes: 1350,
      received_kes: 1350,
      amount_differs: false,
      claimed_at: CLAIMED_AT,
      confirmed_at: "2026-10-19T10:00:00.000Z",
      confirmed_by: "Aaron",
      vehicle: "TEST KDA 123X red Probox",
      priced_as: "Saloon",
      date: "2026-10-30",
      start_time: "08:30",
      end_time: "09:00",
      // A field the snapshot might grow later must not ride along either.
      ...({ notes: "TEST secret note" } as object),
    },
  };
}

const FORBIDDEN = [
  CODE,
  REJECT_REASON,
  VOID_REASON,
  PAYMENT_ID,
  RECEIPT_ID,
  CLAIMED_AT,
  "claimedAt",
  "TEST KDA 123X",
  "Probox",
  "secret note",
  "Kamau",
  "+254712345678",
  "0712345678",
  "712345678",
  ...STAFF_NAMES,
];

function assertClean(label: string, value: unknown) {
  const json = JSON.stringify(value);
  for (const needle of FORBIDDEN) {
    assert.ok(!json.includes(needle), `${label}: public output contains ${JSON.stringify(needle)}`);
  }
}

const record = (p: PaymentSummary) => ({ ref: "WB-TEST2345", payment: p });

test("claimed, no receipt: a visitor gets the bare 404 result", () => {
  const result = receiptPageResult({ audience: "public", record: record(payment("claimed", null)), receipt: null });
  assert.deepEqual(result, { show: "hidden" });
  assertClean("claimed", result);
});

test("rejected: a visitor gets the bare 404 result", () => {
  const result = receiptPageResult({ audience: "public", record: record(payment("rejected", null)), receipt: null });
  assert.deepEqual(result, { show: "hidden" });
  assertClean("rejected", result);
});

test("no such ref: identical to claimed and rejected", () => {
  const result = receiptPageResult({ audience: "public", record: null, receipt: null });
  assert.deepEqual(result, { show: "hidden" });
});

test("issued: masked public view", () => {
  const row = receiptRow("issued");
  const result = receiptPageResult({
    audience: "public",
    record: record(payment("verified", { number: row.number, status: "issued", issuedAt: row.issuedAt })),
    receipt: row,
  });
  assert.equal(result.show, "receipt");
  if (result.show !== "receipt") return;
  const view = result.view;
  assertClean("issued", view);
  assert.equal(view.number, "W-000123");
  assert.equal(view.customerName, "TEST");
  assert.equal(view.phone, "07•• ••• 678");
  assert.equal(view.mpesaCode, "••••••K2LX");
  assert.equal(view.vehicle, null);
  assert.equal(view.void, null);
  assert.equal(view.amountKes, 1350);
  assert.equal(view.pricedAs, "Saloon");
  assert.deepEqual(view.lines, [{ name: "Body Wash", variant: null, unit: null, quantity: 1, price_kes: 1350 }]);
});

test("void: masked public view says VOID with its date and no reason or name", () => {
  const row = receiptRow("void");
  const result = receiptPageResult({
    audience: "public",
    record: record(payment("verified", { number: row.number, status: "void", issuedAt: row.issuedAt })),
    receipt: row,
  });
  assert.equal(result.show, "receipt");
  if (result.show !== "receipt") return;
  assertClean("void", result.view);
  assert.deepEqual(result.view.void, { at: "2026-10-19T11:00:00.000Z", reason: null });
});

test("staff: the full receipt and the pending page, as before", () => {
  const row = receiptRow("void");
  const full = receiptPageResult({ audience: "staff", record: null, receipt: row });
  assert.equal(full.show, "receipt");
  if (full.show === "receipt") {
    assert.equal(full.view.customerName, "TEST Wanjiru Kamau");
    assert.equal(full.view.phone, "+254712345678");
    assert.equal(full.view.mpesaCode, CODE);
    assert.equal(full.view.vehicle, "TEST KDA 123X red Probox");
    assert.equal(full.view.void?.reason, VOID_REASON);
  }
  assert.deepEqual(
    receiptPageResult({ audience: "staff", record: record(payment("rejected", null)), receipt: null }),
    { show: "pending", ref: "WB-TEST2345", status: "rejected" },
  );
  assert.deepEqual(receiptPageResult({ audience: "staff", record: null, receipt: null }), { show: "not_found" });
});

test("masking helpers", () => {
  assert.equal(maskPhone("0712 345 678"), "07•• ••• 678");
  assert.equal(maskPhone("+254712345678"), "07•• ••• 678");
  assert.equal(maskPhone("254112345678"), "01•• ••• 678");
  assert.equal(maskMpesaCode("SGH4K2LQ9X"), "••••••LQ9X");
  assert.equal(maskMpesaCode("ABC"), "••••");
});
