/**
 * =====================================================================
 * MASKING FOR ANYONE WHO IS NOT STAFF.
 * ---------------------------------------------------------------------
 * The public ref lookup (src/lib/public-view.ts) and the public receipt
 * (src/lib/receipt-view.ts) both show a customer just enough to recognise
 * their own record. The helpers live here, with no imports, so both use
 * the same rules and the unit tests can load them without the app.
 * =====================================================================
 */

/** "Wanjiru Kamau" -> "Wanjiru". */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * "0712 345 678", "+254712345678", "254712345678" -> "07•• ••• 678".
 * Anything too short to mask safely becomes bullets only.
 */
export function maskPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) digits = `0${digits.slice(3)}`;
  if (digits.length < 7) return "••• •••";
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`;
}

/**
 * "SGH4K2LQ9X" -> "••••••LQ9X". The last four are enough for a customer
 * to match the code against their SMS; the whole code is not, because a
 * full code is what someone would type to claim another person's payment.
 */
export function maskMpesaCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length <= 4) return "••••";
  return `${"•".repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}
