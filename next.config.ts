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
