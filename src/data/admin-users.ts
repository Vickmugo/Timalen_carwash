/**
 * =====================================================================
 * "ACTING AS" — A NAME TAG, NOT A LOGIN.
 * ---------------------------------------------------------------------
 * READ THIS BEFORE TREATING THE NAMES RECORDED BY THIS FEATURE AS FACT.
 *
 * This list feeds a dropdown at the top of the staff view. Whoever is at
 * the counter picks their name, and from then on any status they change is
 * stamped with that name and the time (see `StatusChange` in
 * src/types/index.ts). That is the whole mechanism.
 *
 * WHAT IT IS NOT:
 *   - not a sign-in: nobody proves they are who they picked
 *   - not per-person: there is no account, no password, no signup here.
 *     The ONLY password in this app is the single shared one guarding
 *     /admin in src/proxy.ts, and everyone past it is the same principal
 *   - not an audit trail: the stamp is self-reported and anyone can pick
 *     any name, including someone else's, or change the name after the
 *     fact and carry on. It records what somebody TYPED, not what happened
 *   - not tamper-proof: the records live in the visitor's own localStorage
 *     (src/lib/store.ts) and can be edited from the browser console
 *
 * So it answers "who marked this paid?" the way a paper sign-out sheet by
 * the door does — well enough for a small team acting in good faith, and
 * worth nothing at all in a dispute. Do not cite it as evidence, and do not
 * build anything on it that assumes the name is true.
 *
 * Real per-person identity needs real accounts, which needs a backend. The
 * checklist for that is at the top of src/app/admin/page.tsx.
 * ---------------------------------------------------------------------
 * TODO / CONFIRM WITH CLIENT: who actually works the counter, and what
 * should each of them be called here? First names are usually right — the
 * name is read by colleagues, not customers.
 *
 * No names have been invented for this list. It ships with one placeholder
 * so the feature is visible and testable, and the staff view renders a
 * plain text field rather than a dropdown while that is the only entry —
 * a one-item dropdown would be a control with nothing to choose. Add the
 * real names below and it becomes a dropdown on its own, with no code
 * change needed anywhere else.
 * =====================================================================
 */

export const adminUsers: string[] = ["Staff member 1"];

/**
 * Stamped in place of a name when a status is changed before anyone has
 * said who they are. Deliberately not blank: a missing name in the history
 * list should read as a gap somebody left, not as a rendering bug.
 */
export const UNATTRIBUTED = "unattributed";
