/**
 * Small shared validators. Deliberately forgiving — this is a customer
 * form on a phone, not a KYC check.
 */

/** Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2541XXXXXXXX. */
export function isValidKenyanPhone(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^(?:\+?254|0)(?:7|1)\d{8}$/.test(digits);
}

/**
 * One spelling for a Kenyan mobile number, "07XXXXXXXX" / "01XXXXXXXX",
 * whichever way it was typed ("0712 345 678", "+254712345678",
 * "254-712-345-678"). Null if it is not a valid number at all.
 *
 * Phones are stored as typed, so anything that needs to know whether two
 * records are the same number compares these, never the raw strings.
 */
export function canonicalKenyanPhone(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^(?:\+?254|0)(?:7|1)\d{8}$/.test(digits)) return null;
  return `0${digits.slice(-9)}`;
}

export function requiredText(value: string, label: string): string | undefined {
  return value.trim().length === 0 ? `${label} is required.` : undefined;
}

export function phoneError(value: string): string | undefined {
  if (value.trim().length === 0) return "Phone number is required.";
  if (!isValidKenyanPhone(value)) {
    return "Enter a valid Kenyan number, e.g. 0712 345 678.";
  }
  return undefined;
}

/** Drops keys with undefined values so `Object.keys(errors).length` is truthful. */
export function compactErrors(
  errors: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  ) as Record<string, string>;
}
