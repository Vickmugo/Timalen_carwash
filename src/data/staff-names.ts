/**
 * =====================================================================
 * WHO MAY SIGN IN UNDER WHICH FIRST NAME.
 * ---------------------------------------------------------------------
 * The first names of the people who work the counter, spelled the way
 * they should appear in the history and on receipts. The name typed at
 * /login must match one of them (case is ignored) and the spelling below
 * is what gets stored. Add or remove a name here and redeploy.
 *
 * If the list were ever emptied, any name passing the basic checks in
 * `normaliseStaffName` (src/lib/session.ts) would be accepted — keep at
 * least one entry.
 *
 * SERVER-ONLY, AND IT MUST STAY THAT WAY. This is deliberately not in
 * src/data/config.ts: that file is imported by client components, so
 * anything in it ships in the public JavaScript. The list is only ever
 * read by /api/login, after the password has already been accepted, so it
 * cannot be probed by someone who does not know the password.
 *
 * The list is also checked on every request carrying a session, so a name
 * removed or renamed here signs that person out at their next request.
 *
 * Still self-reported: one person can type another's name. See the header
 * of src/lib/session.ts.
 * =====================================================================
 */

import "server-only";
import { matchStaffName } from "@/lib/session";

export const staffNames: readonly string[] = ["Pamela", "Inyingi", "Haron"];

/**
 * The canonical spelling for a cleaned name, or null if the list is in use
 * and the name is not on it. With an empty list the name is returned as is.
 */
export function canonicalStaffName(name: string): string | null {
  return matchStaffName(name, staffNames);
}
