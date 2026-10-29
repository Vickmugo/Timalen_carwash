/**
 * Free-text cleaning for request bodies. No imports, so it runs anywhere;
 * src/lib/request-body.ts re-exports it, and its header explains the limits.
 */

export const MAX_TEXT = 500;

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
