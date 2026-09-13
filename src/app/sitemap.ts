import type { MetadataRoute } from "next";
import { business } from "@/data/business";
import { products } from "@/data/products";

/**
 * SITEMAP — every page worth indexing, built from the data files.
 *
 * Generated rather than written out, so a new line in
 * src/data/products.ts appears here automatically. A hand-maintained
 * sitemap is a list that silently goes stale the first time someone adds a
 * product and does not think to come back here.
 *
 * THE WASH SIDE IS TWO FIXED URLS, not one per service. /book/[serviceId]
 * is gone: those three services were invented, and the real price board
 * prices eleven services across three vehicle types, which is one page
 * (/prices) and one flow (/book) rather than thirty-three URLs.
 *
 * WHAT IS DELIBERATELY LEFT OUT, and why:
 *   /cart, /checkout        per-visitor state, empty for a crawler
 *   /book/confirmed         reached only with a ?ref of your own booking
 *   /checkout/confirmed     same
 *   /quote/submitted        same
 *   /receipt/*              printable receipts, keyed by a reference only
 *                           the customer has
 *   /admin                  staff view, and session-gated in src/proxy.ts
 *   /login                  the staff sign-in form; nothing to index
 *   /api/*                  route handlers, POST only
 *
 * These are also disallowed in app/robots.ts. The two files must agree:
 * listing a URL here while blocking it there asks a crawler to index a page
 * it has been told it may not fetch.
 *
 * Every URL here is absolute, built from `business.siteUrl` — the real
 * registered domain. It changes there, never here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = business.siteUrl.replace(/\/$/, "");

  // One timestamp for the whole build. `new Date()` per entry would differ
  // by milliseconds across the list, which is noise rather than information.
  const lastModified = new Date();

  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/book`,
      lastModified,
      changeFrequency: "monthly",
      // The two things a visitor comes here to do. Ranked above the pages
      // that only support them.
      priority: 0.9,
    },
    {
      url: `${base}/products`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${base}/prices`,
      lastModified,
      changeFrequency: "monthly",
      // The full wash price board. Ranked below /book because booking is
      // the thing the business wants, but well above the supporting pages:
      // "how much is a car wash in Kiambu" is a search this page answers
      // directly and nothing else on the site does.
      priority: 0.8,
    },
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${base}/quote`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      // Carpets and sofa sets. A request, like /quote, and ranked with it.
      url: `${base}/book/carpets`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
