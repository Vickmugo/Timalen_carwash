/**
 * =====================================================================
 * IS THIS WRITE FROM OUR OWN PAGE? — a same-origin check for staff POSTs.
 * ---------------------------------------------------------------------
 * The staff cookie is SameSite=Lax and httpOnly, which already keeps it
 * off cross-site POSTs in current browsers. This is the second lock: a
 * staff write must say, in a header the browser sets and page script
 * cannot forge, that it came from this site.
 *
 *   Origin          compared with the request's OWN host (Host, or
 *                   X-Forwarded-Host behind the platform's proxy), never a
 *                   hardcoded domain, so deploy previews keep working.
 *   Sec-Fetch-Site  must be "same-origin" when it is sent.
 *
 * Every header that is present must agree. If NEITHER is present the
 * request is refused: every browser that can run the staff page sends at
 * least one of them on a fetch POST.
 *
 * Used by the walk-in routes today. Pure, so it can be added to every
 * staff write later without changing it; see the list in the walk-in
 * report of the routes that do not call it yet.
 * =====================================================================
 */

function ownHost(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded || headers.get("host") || "").toLowerCase() || null;
}

export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  const fetchSite = headers.get("sec-fetch-site");
  if (!origin && !fetchSite) return false;

  if (fetchSite && fetchSite.toLowerCase() !== "same-origin") return false;

  if (origin) {
    const host = ownHost(headers);
    if (!host) return false;
    try {
      if (new URL(origin).host.toLowerCase() !== host) return false;
    } catch {
      // "null" (a sandboxed frame, a file: page) and junk are not us.
      return false;
    }
  }
  return true;
}

/** The sentence a refused request gets. */
export const CROSS_ORIGIN_REFUSED = "That request did not come from the staff page.";
