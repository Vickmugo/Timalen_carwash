/**
 * =====================================================================
 * RATE LIMITS — A COUNTER IN SUPABASE, NOT IN MEMORY.
 * ---------------------------------------------------------------------
 * Serverless instances share no memory, so a counter in a module variable
 * would reset on every cold start and differ between instances. The count
 * lives in `public.rate_limits` instead, bumped by `hit_rate_limit()`
 * (supabase/migrations/20261018100000_rate_limits_and_code_index.sql).
 *
 * KEYS ARE HASHED HERE. The table holds SHA-256(bucket + client IP), never
 * a raw IP address or phone number.
 *
 * FAIL OPEN, LOG LOUDLY. If the database call errors — migration not yet
 * applied, Supabase down — the request is let through and the failure is
 * logged with "FAILING OPEN". A broken limiter must never stop a customer
 * booking a wash or staff signing in.
 *
 * PER-IP LIMITS ARE GENEROUS ON PURPOSE. Many Kenyan mobile users share one
 * public IP through carrier NAT, so these only stop floods. The per-phone
 * booking cap (src/lib/bookings-db.ts) does the real work against slot
 * hoarding.
 * =====================================================================
 */

import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";

export interface RateLimitRule {
  /** Names the counter, e.g. "login-fail". Part of the hashed key. */
  bucket: string;
  limit: number;
  windowSeconds: number;
}

/** The limits in one place, so they can be read and tuned together. */
export const LIMITS = {
  /** Failed sign-ins per IP. Successful ones are not counted. No global limit. */
  loginFailures: { bucket: "login-fail", limit: 5, windowSeconds: 15 * 60 },
  /** Public writes, per IP per route. */
  bookingCreate: { bucket: "booking-create", limit: 30, windowSeconds: 60 * 60 },
  orderCreate: { bucket: "order-create", limit: 30, windowSeconds: 60 * 60 },
  carpetCreate: { bucket: "carpet-create", limit: 30, windowSeconds: 60 * 60 },
  quoteCreate: { bucket: "quote-create", limit: 30, windowSeconds: 60 * 60 },
  /** Public lookups by ref: the booking and order APIs and the receipt pages share one counter. */
  refLookup: { bucket: "ref-lookup", limit: 60, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const OPEN: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };

/**
 * The caller's IP, or null if it cannot be trusted.
 *
 * On Netlify `x-nf-client-connection-ip` is set by Netlify's edge from the
 * TCP connection and overwrites anything the client sent. `x-forwarded-for`
 * is NOT used: its left-most entry is whatever the client chose to send.
 *
 * Locally there is no such header, so development uses one fixed key — and
 * a request that sends the header itself is taken at its word, which is
 * how the local tests exercise "a different IP is unaffected".
 *
 * In production without the header (a host other than Netlify) this
 * returns null and the limits are skipped with a log line rather than
 * lumping every visitor into one shared counter, which would become the
 * global lockout this design avoids.
 */
export function clientIp(request: NextRequest): string | null {
  const netlify = request.headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  if (process.env.NODE_ENV !== "production") return "local-dev";
  return null;
}

function hashKey(bucket: string, ip: string): string {
  return createHash("sha256").update(`timalen.rl.v1:${bucket}:${ip}`).digest("hex");
}

/**
 * Counts one hit (cost 1), or only checks whether one more would be
 * allowed (cost 0). Login uses cost 0 before checking the password and
 * cost 1 only when the password was wrong, so successes are never counted.
 */
export async function rateLimit(
  request: NextRequest,
  rule: RateLimitRule,
  cost: 0 | 1 = 1,
): Promise<RateLimitResult> {
  const ip = clientIp(request);
  if (!ip) {
    console.error(
      `[rate-limit] FAILING OPEN for ${rule.bucket}: no trusted client IP header in production.`,
    );
    return OPEN;
  }

  try {
    const { data, error } = await getSupabaseServiceRoleClient().rpc("hit_rate_limit", {
      p_key: hashKey(rule.bucket, ip),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_cost: cost,
    });
    if (error) throw new Error(`${error.code ?? "no code"}: ${error.message}`);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; retry_after_seconds?: number }
      | null;
    if (!row || typeof row.allowed !== "boolean") throw new Error("unexpected result shape");
    return {
      allowed: row.allowed,
      retryAfterSeconds: Math.max(1, Math.ceil(row.retry_after_seconds ?? rule.windowSeconds)),
    };
  } catch (error) {
    console.error(
      `[rate-limit] FAILING OPEN for ${rule.bucket}: limiter errored —`,
      error instanceof Error ? error.message : error,
    );
    return OPEN;
  }
}

/** The JSON 429 every public API route returns. */
export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      detail: "Too many requests from this network. Please wait a little and try again.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
