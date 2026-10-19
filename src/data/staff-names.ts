/**
 * =====================================================================
 * WHO MAY SIGN IN UNDER WHICH FIRST NAME.
 * ---------------------------------------------------------------------
 * TODO / OWNER TO FILL IN: the first names of the people who work the
 * counter, spelled the way they should appear in the history and on
 * receipts, e.g. ["Wanjiru", "Otieno"]. No names have been invented here.
 *
 * WHILE THIS IS EMPTY, any name that passes the basic checks in
 * `normaliseStaffName` (src/lib/session.ts) is accepted at sign-in. Once it
 * has entries, the name typed at /login must match one of them (case is
 * ignored) and the spelling below is what gets stored.
 *
 * SERVER-ONLY, AND IT MUST STAY THAT WAY. This is deliberately not in
 * src/data/config.ts: that file is imported by client components, so
 * anything in it ships in the public JavaScript. The list is only ever
 * read by /api/login, after the password has already been accepted, so it
 * cannot be probed by someone who does not know the password.
 *
 * Still self-reported: one person can type another's name. See the header
 * of src/lib/session.ts.
 * =====================================================================
 */

import "server-only";

export const staffNames: string[] = ["Pamela", "Julius", "Aaron"];

/**
 * The canonical spelling for a cleaned name, or null if the list is in use
 * and the name is not on it. With an empty list the name is returned as is.
 */
export function canonicalStaffName(name: string): string | null {
  if (staffNames.length === 0) return name;
  const wanted = name.toLocaleLowerCase("en");
  return staffNames.find((entry) => entry.toLocaleLowerCase("en") === wanted) ?? null;
}
