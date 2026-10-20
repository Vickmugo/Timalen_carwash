import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** `@/lib/mask` -> src/lib/mask.ts; `./mask` -> ./mask.ts, when that file exists. */
export async function resolve(specifier, context, nextResolve) {
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
