import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/**
 * `@/lib/mask` -> src/lib/mask.ts; `./mask` -> ./mask.ts, when that file exists.
 *
 * `server-only` becomes an empty module. Next resolves it to a no-op on the
 * server and fails the build if a client component imports it; under plain
 * Node it is not installed at all, so without this a test could not load
 * src/data/staff-names.ts.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,", shortCircuit: true };
  }
  let candidate = null;
  if (specifier.startsWith("@/")) {
    candidate = SRC + specifier.slice(2);
  } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    candidate = fileURLToPath(new URL(specifier, context.parentURL));
  }
  if (candidate) {
    for (const path of [candidate, `${candidate}.ts`, `${candidate}/index.ts`]) {
      if (existsSync(path) && !path.endsWith("/") && /\.(m?[jt]s)$/.test(path)) {
        return nextResolve(pathToFileURL(path).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
