/**
 * =====================================================================
 * THE OLD "ACTING AS" NAME TAG IS GONE.
 * ---------------------------------------------------------------------
 * Staff now type their first name at /login and the server stamps it from
 * the signed session (src/lib/session.ts). The list of allowed names is
 * server-only, in src/data/staff-names.ts.
 *
 * This constant survives only so that history rows written before the
 * change — when a blank name was stored as "unattributed" — still read
 * sensibly in the staff view. Nothing writes it any more.
 * =====================================================================
 */

export const UNATTRIBUTED = "unattributed";
