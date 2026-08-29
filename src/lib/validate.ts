/**
 * Small shared validators. Deliberately forgiving — this is a customer
 * form on a phone, not a KYC check.
 */

/** Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2541XXXXXXXX. */
export function isValidKenyanPhone(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^(?:\+?254|0)(?:7|1)\d{8}$/.test(digits);
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
