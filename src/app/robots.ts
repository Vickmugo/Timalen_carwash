import type { MetadataRoute } from "next";
import { business } from "@/data/business";

/**
 * ROBOTS — what a crawler may fetch, and where the sitemap is.
 *
 * The disallow list is the same set app/sitemap.ts leaves out, for the same
 * reasons. Keep the two in step: a URL listed in the sitemap but blocked
 * here is an instruction to index a page the crawler has been forbidden to
 * read, which is how pages end up in results as a bare URL with no title.
 *
 * WHAT THIS IS NOT. robots.txt is a request, not access control. /admin is
 * disallowed here so it stays out of search results, but the thing that
 * actually protects it is the session check in src/proxy.ts — a crawler
 * that ignores this file gets bounced to /login and never sees a record.
 * Never let a Disallow line be the only thing standing in front of
 * customer data.
 */
export default function robots(): MetadataRoute.Robots {
  const base = business.siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Per-visitor state. Always empty for a crawler, so indexing them
        // would put two permanently blank pages in the results.
        "/cart",
        "/checkout",

        // Reachable only with the ?ref of a record you created yourself.
        // Without one they render an error state, which is not a page
        // anybody should arrive at from a search result.
        "/book/confirmed",
        "/checkout/confirmed",
        "/quote/submitted",

        // Printable receipts, addressed by a reference only the customer
        // has. Same reasoning as the confirmation pages above, and the
        // record itself is in that visitor's browser — a crawler following
        // one of these would index "receipt not found" under the business's
        // own name.
        "/receipt",

        // Staff view. Session-gated in src/proxy.ts; this only keeps it
        // out of the index.
        "/admin",

        // The staff sign-in form. Nothing behind it to index, and a
        // business's own password box is not a useful search result under
        // its own name.
        "/login",

        // Route handlers, not pages: /api/login and /api/logout answer only
        // POST and redirect. A crawler following one would get a 405.
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
