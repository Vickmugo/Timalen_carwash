import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * DEV ONLY. Hosts allowed to request Next.js's own dev assets.
   *
   * WHY THIS IS HERE — it fixes a real crash, not a warning.
   * Next blocks cross-origin requests to anything under `/_next` or
   * `/__nextjs` unless the requesting host is allowlisted (localhost is the
   * only default). Opening the dev server on a PHONE over the LAN — at
   * http://192.168.x.x:3000 rather than localhost — trips that block on
   * every dev request, and one of the blocked endpoints is the error
   * overlay's own `/__nextjs_original-stack-frames`.
   *
   * That endpoint does `JSON.parse(body)` with no guard
   * (node_modules/next/dist/server/dev/middleware-turbopack.js). Blocked,
   * the body arrives empty, and `JSON.parse("")` throws
   *
   *     SyntaxError: Unexpected end of JSON input
   *
   * server-side — which is the error that was showing up on /book routes.
   * It never came from the booking code: the overlay was trying to
   * symbolicate a DIFFERENT browser error and could not reach its own
   * endpoint. Allowlisting the LAN range lets that request through, so the
   * overlay works and the parse never sees an empty body.
   *
   * Private ranges only, and `allowedDevOrigins` is ignored entirely by
   * `next build` / `next start` — this cannot loosen anything in
   * production. Wildcards are matched segment by segment, so these cover a
   * DHCP lease moving between addresses.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],

  /**
   * ONE REDIRECT, FOR ONE RENAMED PRODUCT.
   *
   * "Column & Pillar Caps" became "Wall Caps" in the September batch —
   * the name the business itself prints on its banner — which moved the
   * page from /products/column-caps to /products/wall-caps. Without this
   * the old URL is a bare 404.
   *
   * WHY IT IS WORTH A CONFIG ENTRY for a site this small: that URL is in
   * the sitemap this app has been serving, so a crawler has had it, and it
   * is the kind of link that gets pasted into a WhatsApp thread and sat on
   * for months. A 404 tells that visitor the yard stopped selling the
   * thing; a 308 puts them on the product.
   *
   * PERMANENT (308) rather than temporary, because the rename is not
   * coming back. That does mean browsers and search engines cache it hard,
   * so it is the right call only for a move that is genuinely final —
   * which this one is, the old name having been wrong rather than merely
   * out of favour.
   *
   * NOT NEEDED FOR THE FILTER LINK /products?category=column-caps: an
   * unrecognised category falls through `isCategoryId` in
   * src/app/products/page.tsx and renders the full grid, which is a
   * reasonable landing rather than an error.
   */
  redirects() {
    return Promise.resolve([
      {
        source: "/products/column-caps",
        destination: "/products/wall-caps",
        permanent: true,
      },
    ]);
  },

  turbopack: {
    /**
     * This folder sits inside a git repository rooted at the home directory,
     * so Turbopack's automatic root detection walks too far up and ignores
     * package-lock.json. Pin the root to this project.
     */
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
