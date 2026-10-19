import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isStaffRequest } from "@/lib/staff-guard";
import {
  BUSINESS_ID,
  getSupabaseAnonClient,
  getSupabaseServiceRoleClient,
  missingSupabaseEnvVars,
  supabaseConfigStatus,
} from "@/lib/supabase";

/**
 * =====================================================================
 * GET /api/health/supabase — does the database plumbing actually work?
 * ---------------------------------------------------------------------
 * Writes ONE row to `public.health_checks`, reads it back, and reports
 * what happened. Nothing else in the app touches that table, and this
 * route touches nothing else — no booking, order, quote or change request
 * is read or written here. Those all still live in the visitor's own
 * localStorage (src/lib/store.ts) and this route does not know they exist.
 *
 * WHY IT WRITES TO A TABLE OF ITS OWN. A connection test that inserted a
 * fake booking would put a row that is not a booking into the table the
 * staff view reads, and somebody would eventually have to work out which
 * of their bookings were real. `health_checks` is safe to truncate at any
 * time, which is the entire point of it.
 *
 * WHY GET RATHER THAN POST, given that it writes. This is meant to be
 * opened in a browser and looked at — that is the check. A POST-only
 * endpoint cannot be, and a health check nobody can reach without curl is
 * a health check nobody runs. The write is one row in a disposable table,
 * which is a price worth paying for that.
 *
 * IT ALSO PROVES THE ANON KEY IS LOCKED OUT. The migration enables RLS on
 * every table with no policies, so the anon key must be able to read
 * NOTHING. That is a claim worth testing rather than assuming: an anon key
 * that can read `health_checks` can read `bookings`, and bookings carry
 * customer names and phone numbers. See the `anonBlocked` field below.
 * =====================================================================
 */

/**
 * Never prerendered, never cached.
 *
 * Route handlers are uncached by default in Next 16, but this one reads
 * environment variables and hits the network, and a health check that can
 * be served from a cache is a health check that can report yesterday's
 * answer. `force-dynamic` also keeps `next build` from trying to evaluate
 * it at build time, where these variables are not set.
 */
export const dynamic = "force-dynamic";

/** Never cached by anything in front of us either. */
function json(body: unknown, status: number): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * THE POSTGRES ERROR CODE, AND WHAT IT ACTUALLY MEANS HERE.
 *
 * An earlier version of this route reported `error.message` alone, and
 * "permission denied for table health_checks" is genuinely ambiguous on
 * its own — it reads like the RLS refusal this route deliberately tests
 * for elsewhere, when in fact RLS never produces it. The SQLSTATE is what
 * separates them, so it is now always reported, along with PostgREST's own
 * hint and a plain reading of the two codes this schema can realistically
 * produce.
 *
 *   42P01  the table is not there — the migrations have not been applied.
 *   42501  the ROLE HAS NO GRANT on the table. Raised before RLS is
 *          consulted, so it is never an RLS result. RLS refuses a read by
 *          returning zero rows, and refuses a write with a message that
 *          names the policy.
 */
function describeDbError(error: {
  code?: string;
  message: string;
  hint?: string | null;
  details?: string | null;
}) {
  const meaning =
    error.code === "42P01"
      ? "The table does not exist. Apply supabase/migrations/ — start with " +
        "20260907090000_init_records.sql."
      : error.code === "42501"
        ? "Insufficient privilege: this role has no GRANT on the table. " +
          "This is NOT row level security — RLS refuses a read with zero " +
          "rows, not with this error. Apply " +
          "supabase/migrations/20260907120000_grant_service_role.sql."
        : "Unrecognised database error; the full message is in the server log.";

  // The SQLSTATE and the plain reading only. Postgres's own message and
  // hint name tables and columns, so they go to the server log, never the
  // response — even a staff-only response gets screenshotted.
  console.error(
    `[api/health/supabase] db error ${error.code ?? "no code"}: ${error.message}${error.hint ? ` (hint: ${error.hint})` : ""}`,
  );
  return {
    code: error.code ?? null,
    meaning,
  };
}

export async function GET(request: NextRequest) {
  /*
    WHO MAY RUN THIS: a signed-in member of staff, in every environment.

    It used to be open in development. An open version hands any caller
    on the network an unlimited supply of database writes and a report of
    which credentials are configured, and `next dev` is reachable across
    the LAN (see allowedDevOrigins in next.config.ts). This route sits
    outside the proxy's matcher, so it checks for itself.
  */
  if (!isStaffRequest(request)) {
    return json(
      { ok: false, error: "not_authorised", detail: "Sign in to the staff area first." },
      401,
    );
  }

  /*
    STEP 0 — is it even configured?

    Answered before any client is constructed, so the response says which
    variable is missing rather than surfacing whatever error the library
    raises when handed an empty URL. Names only, never values.
  */
  const missing = missingSupabaseEnvVars();
  if (missing.length > 0) {
    return json(
      {
        ok: false,
        error: "not_configured",
        missing,
        config: supabaseConfigStatus(),
        detail:
          "Set these in .env.local and restart the dev server. Nothing in " +
          "the app creates or edits .env files.",
      },
      503,
    );
  }

  const startedAt = Date.now();
  const note = `health check ${new Date().toISOString()}`;

  try {
    const admin = getSupabaseServiceRoleClient();

    /* STEP 1 — WRITE. `.select()` returns the inserted row, so the id
       comes back without a second round trip. */
    const insert = await admin
      .from("health_checks")
      .insert({ business_id: BUSINESS_ID, note })
      .select()
      .single();

    if (insert.error) {
      return json(
        {
          ok: false,
          error: "insert_failed",
          step: "write",
          usingKey: "service_role",
          ...describeDbError(insert.error),
        },
        503,
      );
    }

    const id = insert.data.id as string;

    /* STEP 2 — READ IT BACK. A separate query, deliberately: the row
       returned by the insert proves the statement was accepted, not that
       it was committed and is readable. Fetching it by id is what closes
       the round trip. */
    const readBack = await admin
      .from("health_checks")
      .select("id, business_id, note, created_at")
      .eq("id", id)
      .single();

    if (readBack.error) {
      return json(
        {
          ok: false,
          error: "read_back_failed",
          step: "read",
          usingKey: "service_role",
          wroteId: id,
          ...describeDbError(readBack.error),
        },
        503,
      );
    }

    /* STEP 3 — THE ANON KEY MUST SEE NOTHING.

       Two independent locks should stop it, and the response says WHICH
       one did. They fail differently and the difference is diagnostic:

         42501, no rows      no GRANT. The role cannot touch the table at
                             all. This is the stronger lock, and after
                             20260907120000_grant_service_role.sql it is
                             the one anon hits first.
         no error, no rows   GRANT exists, RLS admitted no row. Also
                             correct, and what would be seen if a grant
                             were ever handed to anon by accident.

       A row coming back is neither. That would mean the browser-side key
       can read this table — and the same hole would expose customer names
       and phone numbers the moment bookings move here. Reported rather
       than thrown, so the service-role result above stays visible next
       to it. */
    const anon = getSupabaseAnonClient();
    const anonRead = await anon.from("health_checks").select("id").eq("id", id);
    const anonRows = anonRead.data?.length ?? 0;
    const anonBlocked = Boolean(anonRead.error) || anonRows === 0;

    return json(
      {
        ok: true,

        /* THE HEADLINE, STATED RATHER THAN INFERRED.

           This is the one line worth reading: the key the migrated
           features will actually use wrote a row and read it back. It is
           deliberately not something to deduce from the absence of an
           error elsewhere in this payload. */
        serviceRoleWriteReadBack: "PASS",

        usingKey: "service_role",
        wrote: { id, note },
        readBack: readBack.data,
        roundTripMs: Date.now() - startedAt,

        anonKey: {
          blocked: anonBlocked,
          blockedBy: anonRead.error
            ? anonRead.error.code === "42501"
              ? "grant"
              : `error:${anonRead.error.code ?? "unknown"}`
            : anonRows === 0
              ? "rls"
              : "NOTHING",
          detail: anonBlocked
            ? "Anon key cannot read health_checks, as intended."
            : "WARNING: the anon key CAN read this table. Neither the " +
              "grants nor RLS are doing what the migrations intend — do " +
              "not migrate customer records until this is fixed.",
        },

        note: "public.health_checks is disposable. Truncate it whenever.",
      },
      200,
    );
  } catch (error) {
    /* Anything the library throws rather than returns — a bad URL, DNS
       failure, a TLS problem. Logged, not returned. */
    console.error("[api/health/supabase] threw:", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "unexpected", detail: "See the server log." }, 503);
  }
}
