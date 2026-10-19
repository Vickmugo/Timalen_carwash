/**
 * =====================================================================
 * PUBLIC REQUEST BODIES — SIZE CAP AND FREE-TEXT CLEANING, IN ONE PLACE.
 * ---------------------------------------------------------------------
 * Every public POST (bookings, orders, carpet and quote requests) reads its
 * JSON through `readJsonBody` and every free-text field through
 * `cleanText` / `cleanCustomerName`, so the limits cannot drift apart
 * between routes the way the booking route's once did (it had none).
 *
 *   BODY      32 KB. A real booking or order is well under 2 KB; anything
 *             near this is not a customer. Checked against Content-Length
 *             when sent, and counted while reading when it is not, so a
 *             chunked upload cannot get round it.
 *   TEXT      500 characters per field, after trimming. Longer input is
 *             truncated rather than refused — a customer who pastes a long
 *             note should still get their booking.
 *   NAMES     Also lose any leading `=`, `+`, `-` or `@`, so a customer
 *             name can never begin a spreadsheet formula in the receipts
 *             export (that is also guarded at export time, in
 *             src/app/admin/ReceiptsLedger.tsx).
 * =====================================================================
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const MAX_BODY_BYTES = 32 * 1024;
export const MAX_TEXT = 500;

export type JsonBodyResult<T> = { ok: true; body: T } | { ok: false; response: NextResponse };

function refuse(status: number, error: string, detail: string): NextResponse {
  const response = NextResponse.json({ error, detail }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function readJsonBody<T>(
  request: NextRequest,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<JsonBodyResult<T>> {
  const tooLarge = () => ({
    ok: false as const,
    response: refuse(413, "too_large", "That request is too large."),
  });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();

  let text = "";
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }

  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, response: refuse(400, "bad_request", "Body is not JSON.") };
  }
}

/**
 * Trimmed, capped free text. Control characters other than newline and
 * tab are dropped; anything that is not a string becomes "".
 */
export function cleanText(value: unknown, max: number = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

/** `cleanText`, minus any leading formula characters. */
export function cleanCustomerName(value: unknown): string {
  return cleanText(value).replace(/^[=+\-@\s]+/, "").trim();
}
