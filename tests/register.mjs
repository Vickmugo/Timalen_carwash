/**
 * Lets `node --test` load the app's TypeScript without a test framework.
 *
 * Node strips TypeScript types on its own (v22.18+); what it cannot do is
 * resolve the app's `@/…` alias or an import written without `.ts`. This
 * hook does those two things, plus stubbing `server-only`, and nothing
 * else. Run with
 *
 *     npm test
 */
import { register } from "node:module";

register("./resolve-hook.mjs", import.meta.url);
