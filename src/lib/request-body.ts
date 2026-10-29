/**
 * =====================================================================
 * REQUEST BODIES — SIZE CAP AND FREE-TEXT CLEANING, IN ONE PLACE.
 * ---------------------------------------------------------------------
 * Every route that reads a body goes through here: public POSTs
 * (bookings, orders, carpet and quote requests) and the staff PATCH/POST
 * routes read JSON through `readJsonBody`; /api/login reads its form
 * through `readFormBody`. Free-text fields go through `cleanText` /
 * `cleanCustomerName`, so the limits cannot drift apart between routes the
 * way the booking route's once did (it had none).
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
export { MAX_TEXT } from "@/lib/clean-text";

export type JsonBodyResult<T> = { ok: true; body: T } | { ok: false; response: NextResponse };

function refuse(status: number, error: string, detail: string): NextResponse {
  const response = NextResponse.json({ error, detail }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * The raw body, or null if it is over `maxBytes`. Refused on the declared
 * Content-Length when there is one, and counted while reading when there
 * is not, so a chunked upload cannot get round it. Nothing past the limit
 * is buffered.
 */
async function readCappedBytes(request: NextRequest, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const tooLarge = () => ({
  ok: false as const,
  response: refuse(413, "too_large", "That request is too large."),
});

export async function readJsonBody<T>(
  request: NextRequest,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<JsonBodyResult<T>> {
  const bytes = await readCappedBytes(request, maxBytes);
  if (!bytes) return tooLarge();

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, response: refuse(400, "bad_request", "Body is not JSON.") };
  }
}

/**
 * A form post (urlencoded or multipart), under the same kind of cap. For
 * /api/login, which used to call `request.formData()` and would buffer a
 * body of any size before looking at the password. 413 for a body over
 * the cap, 400 for one that is not a form.
 */
export async function readFormBody(
  request: NextRequest,
  maxBytes: number,
): Promise<{ ok: true; form: FormData } | { ok: false; status: 400 | 413 }> {
  const bytes = await readCappedBytes(request, maxBytes);
  if (!bytes) return { ok: false, status: 413 };
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
    return { ok: true, form };
  } catch {
    return { ok: false, status: 400 };
  }
}

// The free-text cleaners live in src/lib/clean-text.ts, which has no
// imports, so pure modules (and their tests) can use them without
// next/server. Re-exported here so every route keeps importing them from
// one place.
export { cleanCustomerName, cleanText } from "@/lib/clean-text";
