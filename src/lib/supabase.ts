/**
 * =====================================================================
 * SUPABASE CLIENTS — SERVER SIDE ONLY.
 * ---------------------------------------------------------------------
 * NOTHING IN THE APP READS THIS YET. Bookings, orders, quote requests and
 * change requests all still live in the visitor's own localStorage via
 * src/lib/store.ts, untouched. This module is the plumbing for a migration
 * that has not happened, and the schema it talks to is in
 * supabase/migrations/ — which is applied by hand, not by this code.
 *
 * TWO KEYS, AND THE DIFFERENCE IS THE WHOLE SECURITY MODEL:
 *
 *   ANON KEY          Safe to hold in a browser. Every request it makes is
 *                     subject to Row Level Security. Against the schema in
 *                     supabase/migrations/, RLS is ON with NO policies, so
 *                     this key can currently read and write NOTHING. That
 *                     is deliberate — see the header of the migration.
 *
 *   SERVICE ROLE KEY  BYPASSES RLS ENTIRELY. It is a superuser credential
 *                     for the whole database. It must never be sent to a
 *                     browser, logged, or put in a NEXT_PUBLIC_ variable.
 *
 * WHY NEITHER IS `NEXT_PUBLIC_`. Next.js inlines any `NEXT_PUBLIC_` value
 * into the JavaScript bundle at build time (see
 * node_modules/next/dist/docs/01-app/02-guides/environment-variables.md).
 * The variable names this module reads — SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY — are unprefixed, so they exist only in the
 * Node process. The `assertServer()` call below is the second lock on the
 * same door: an accidental `import` of this file from a client component
 * fails loudly at the boundary instead of shipping a key to the browser.
 *
 * ENV IS READ AT CALL TIME, NOT AT IMPORT. Same convention as
 * ADMIN_PASSWORD in src/app/api/login/route.ts and src/proxy.ts. A
 * module-scope read would run during `next build`, where these variables
 * are not set, and would turn a missing key into a failed build rather
 * than a clear error on the one route that needs it.
 * =====================================================================
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The three variables this module needs. Set them yourself; see README. */
export const SUPABASE_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type SupabaseEnvVar = (typeof SUPABASE_ENV_VARS)[number];

/**
 * Thrown for every failure in this module — missing variable, wrong
 * environment — so a caller can catch one type and answer with a useful
 * status rather than a 500 with a stack trace in it.
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/**
 * Hard stop if this module is ever evaluated in a browser.
 *
 * Done with a plain runtime check rather than the `server-only` package
 * because that would be a second new dependency for something one `if`
 * covers. The tradeoff is honest: `server-only` fails at BUILD time and
 * this fails at RUN time. It still fails before any network call is made,
 * and the service-role key is never read on a path that reaches here.
 */
function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new SupabaseConfigError(
      "src/lib/supabase.ts was imported into browser code. These clients " +
        "hold server-only keys and must never run in a browser.",
    );
  }
}

/** Reads one variable, or explains precisely which one is missing. */
function requireEnv(name: SupabaseEnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new SupabaseConfigError(
      `${name} is not set. Set it in .env.local (development) or in the ` +
        `deployment's environment. This file does not create or edit ` +
        `.env files.`,
    );
  }
  return value;
}

/**
 * WHICH VARIABLES ARE PRESENT — NEVER THEIR VALUES.
 *
 * Returns booleans only. A health endpoint needs to say "the service role
 * key is missing" without printing a credential into a response body, a
 * log aggregator, or a screenshot pasted into a chat.
 */
export function supabaseConfigStatus(): Record<SupabaseEnvVar, boolean> {
  return {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

/** The variables that are still unset, for an error message. */
export function missingSupabaseEnvVars(): SupabaseEnvVar[] {
  const status = supabaseConfigStatus();
  return SUPABASE_ENV_VARS.filter((name) => !status[name]);
}

/**
 * CLIENTS ARE CACHED PER KEY, not rebuilt per request.
 *
 * `createClient` sets up connection state and a fetch wrapper; doing that
 * on every request would be waste in a hot route handler. Keyed by the
 * resolved credential rather than stored in one variable, so that changing
 * a variable and restarting picks up the new value instead of serving a
 * client built from the old one.
 *
 * The cache is per Node process, which in development means it is dropped
 * whenever the dev server reloads this module. That is fine: it is a
 * performance cache, and nothing in it is correctness-critical.
 */
const clientCache = new Map<string, SupabaseClient>();

/**
 * Common options for both clients.
 *
 * All three auth flags are off, and each for a concrete reason. There is no
 * signed-in Supabase user in this app — staff auth is the shared-password
 * cookie in src/lib/session.ts and is entirely separate. On a server there
 * is no browser storage to persist a session into, no redirect URL to
 * detect a token in, and a background refresh timer in a serverless
 * function is a timer that leaks. Left at their browser defaults, all three
 * are wrong here.
 */
const SERVER_AUTH_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * RLS-RESPECTING CLIENT — the anon key.
 *
 * Use this for anything a customer's own request should be able to do. As
 * the schema stands it can do nothing at all, because RLS is enabled with
 * no policies; that is the safe default to start from, and policies get
 * added deliberately, one at a time, when a feature actually migrates.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  assertServer();

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_ANON_KEY");

  const cacheKey = `anon:${url}:${key}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, key, SERVER_AUTH_OPTIONS);
  clientCache.set(cacheKey, client);
  return client;
}

/**
 * RLS-BYPASSING CLIENT — the service role key.
 *
 * EVERY CALL THROUGH THIS CLIENT IS UNRESTRICTED. There is no row it
 * cannot read, change or delete, and no policy standing behind it. Use it
 * only in a route handler or script that has already established the
 * caller is allowed to do the thing, and never pass its results to a
 * browser without deciding what belongs there.
 *
 * Kept as a separate function rather than a `useServiceRole` flag on the
 * one above, so that reaching for the dangerous client is a visible choice
 * at the call site and greppable across the codebase.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  assertServer();

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const cacheKey = `service:${url}:${key}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, key, SERVER_AUTH_OPTIONS);
  clientCache.set(cacheKey, client);
  return client;
}

/**
 * THE TENANT COLUMN, IN ONE PLACE.
 *
 * Every main table in supabase/migrations/ carries `business_id` with this
 * as its DEFAULT. There is NO multi-tenant logic anywhere in this app and
 * none is planned here — the column exists purely so that a future
 * multi-business version adds a value rather than rewriting a schema and
 * backfilling live records. Exported so that application code writing rows
 * names the same string the database defaults to.
 */
export const BUSINESS_ID = "timalen";
