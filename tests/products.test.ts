/**
 * The culvert sizes in the catalogue and in the migration that seeds their
 * price rows must be the same three ids. A typo on either side ships a
 * size that reads "price not listed" forever, with no row for staff to
 * price, so this reads the SQL file itself rather than a copy of it.
 *
 *     npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getProductById } from "../src/data/products";

test("culvert variants match the ids seeded by 20261111200000_culverts.sql", () => {
  const culvert = getProductById("culvert");
  assert.ok(culvert, "no product with id 'culvert'");

  const sql = readFileSync(
    new URL("../supabase/migrations/20261111200000_culverts.sql", import.meta.url),
    "utf8",
  );
  const seeded = [...sql.matchAll(/\(\s*'culvert'\s*,\s*'([^']+)'\s*,\s*null\s*\)/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(
    seeded,
    (culvert.variants ?? []).map((variant) => variant.id),
  );
});
