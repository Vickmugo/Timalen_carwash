-- =====================================================================
-- PRICES BY HEIGHT — fencing posts and spindles get three figures each.
-- ---------------------------------------------------------------------
-- A FIFTH MIGRATION. Run it the same way as the other four; nothing in
-- the app applies migrations.
--
-- RUN 20260911160000_confirmed_product_prices.sql FIRST. As of 13 Sept
-- 2026 that migration had NOT been applied to the live database. This one
-- refuses to run until it has — see section 0 for why the order matters.
--
-- AND DO NOT RE-RUN 20260911160000 AFTER THIS ONE. It says re-running is
-- harmless, and until now it was. Its inserts target the two-column
-- unique constraint this migration replaces, so a re-run afterwards fails
-- on its first insert. It fails whole — nothing moves — but it fails.
--
-- ALSO RUN THIS BEFORE DEPLOYING THE CODE THAT GOES WITH IT. The app now
-- selects `product_prices.variant_id`; against a database without the
-- column, `getPriceBook()` throws, and it is on the render path of the
-- home page, /prices, /products and /book — the car wash booking flow
-- included. That is the deliberate behaviour of `getPriceBook()` (read its
-- header), and it means migration first, deploy second.
--
-- WHAT THIS DOES, IN ONE LINE: adds a variant dimension to
-- `product_prices`, retires the one-figure placeholder on posts and
-- spindles, and seeds and prices six height cells, logging every figure
-- it moves.
--
-- ---------------------------------------------------------------------
-- WHY A COLUMN AND NOT A NEW TABLE
--
-- `service_prices` already answers this question for the wash board: one
-- row per CELL, a service crossed with a vehicle column, unique on the
-- pair. A post crossed with a height is the same shape, one dimension
-- narrower. So the existing table gains the dimension rather than getting
-- a sibling:
--
--   * `price_changes.product_price_id` keeps pointing at one table. A
--     `product_variant_prices` table would need a fourth nullable foreign
--     key on the audit log and a widened one-parent CHECK, and the log
--     would have two places a product price could live.
--   * `setPrice` in src/lib/prices-db.ts keeps its single code path — one
--     more filter column, not a fourth kind.
--   * `getPriceBook()` keeps reading three tables.
--
-- `variant_id` IS NOT NULL, DEFAULT ''. The empty string means "this
-- product is sold at one price", and every row that existed before this
-- migration takes it. Not NULL, because a NULL in a unique constraint is
-- distinct from every other NULL: two rows for the same product with a
-- NULL variant would both be allowed, and the constraint that makes this
-- table a grid would quietly stop holding for exactly the products that
-- have no variants. The same '' convention the records tables already use
-- for "nothing written here" — see `notes` in 20260907090000_init_records.sql.
--
-- Like `service_id`, `variant_id` is not a foreign key and has no CHECK
-- listing heights. The heights are `variants` on the product in
-- src/data/products.ts, and /api/prices checks a variant id against that
-- file before it writes anything.
--
-- ---------------------------------------------------------------------
-- WHAT HAPPENS TO THE OLD 750 AND 320
--
-- Fencing posts carried one placeholder figure, 750, shown against an
-- "8 ft" spec row. 8 ft is not a height the client sells. Spindles carried
-- 320 against "500 mm", which is not one of theirs either. Neither figure
-- becomes a fourth tier.
--
-- Both rows are DEPRICED, NOT DELETED, and not re-keyed:
--
--   * Deleting would cascade away every `price_changes` row pointing at
--     them (the foreign key is ON DELETE CASCADE) — including any edit
--     staff made to that figure between the price-tables migration and
--     this one. The previous migration refused to delete-and-reinsert for
--     the same reason.
--   * Re-keying one of them to a height (say 10 ft) would put a 750 in the
--     10 ft post's history that was never a price for a 10 ft post.
--
-- So each goes to null, the log records the move from its old figure to
-- "not listed", and the row stays as a dead cell with `variant_id` ''.
-- Nothing renders it: the app reads only the height cells for a product
-- that has heights, and /api/prices refuses a write to it.
-- =====================================================================


-- =====================================================================
-- SECTION 0 — REFUSE TO RUN OUT OF ORDER
-- =====================================================================
-- 20260911160000 inserts with `on conflict (business_id, product_id)`.
-- Section 1 below drops that two-column constraint for a three-column
-- one. Run this first and that migration then fails outright — Postgres
-- rejects an ON CONFLICT target with no matching constraint — leaving the
-- five confirmed prices unapplied behind a confusing error.
--
-- The `cabro` row exists only once 20260911160000 has run, and nothing in
-- the app can delete a price row, so its presence is the test.
do $$
begin
  if not exists (
    select 1 from public.product_prices
     where business_id = 'timalen' and product_id = 'cabro'
  ) then
    raise exception
      'Apply 20260911160000_confirmed_product_prices.sql before this migration (no cabro row found in product_prices).';
  end if;
end
$$;


-- =====================================================================
-- SECTION 1 — THE VARIANT DIMENSION
-- =====================================================================

alter table public.product_prices
  add column if not exists variant_id text not null default '';

-- One price per product-and-height. Replaces one price per product. Done
-- in a block so a re-run, which finds the new constraint already there,
-- is a no-op rather than an error.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'product_prices_cell_unique'
       and conrelid = 'public.product_prices'::regclass
  ) then
    alter table public.product_prices
      drop constraint if exists product_prices_product_unique;
    alter table public.product_prices
      add constraint product_prices_cell_unique
      unique (business_id, product_id, variant_id);
  end if;
end
$$;


-- =====================================================================
-- SECTION 2 — RETIRE THE ONE-FIGURE PLACEHOLDERS
-- =====================================================================
-- Same CTE chain as 20260911160000, section 3 — read that header for why
-- each step is shaped the way it is. The only difference is the target
-- figure is null, and `is distinct from null` is what makes a re-run log
-- nothing once the row is already unpriced.

-- Fencing posts: 750 placeholder ("8 ft") -> not listed.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'fencing-post' and variant_id = ''
), moved as (
  update public.product_prices p
     set price_kes = null, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from null
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, null, 'migration 20260913120000 (retired: replaced by height tiers)' from moved;

-- Spindles: 320 placeholder ("500 mm") -> not listed.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'spindle' and variant_id = ''
), moved as (
  update public.product_prices p
     set price_kes = null, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from null
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, null, 'migration 20260913120000 (retired: replaced by height tiers)' from moved;


-- =====================================================================
-- SECTION 3 — THE SIX HEIGHT CELLS
-- =====================================================================
-- Seeded UNPRICED and then priced in section 4, for the reason
-- 20260911160000 gives: the log then shows each first figure arriving
-- with a null `old_price_kes`, as a staff edit would.
--
-- The ids must match `variants` in src/data/products.ts exactly. A typo
-- here gives two failures at once: a priced row nothing ever renders, and
-- a real height on the site showing "price not listed".
insert into public.product_prices (product_id, variant_id, price_kes)
values
  ('fencing-post', '7ft',  null),
  ('fencing-post', '9ft',  null),
  ('fencing-post', '10ft', null),
  ('spindle',      '12in', null),
  ('spindle',      '18in', null),
  ('spindle',      '24in', null)
on conflict (business_id, product_id, variant_id) do nothing;


-- =====================================================================
-- SECTION 4 — THE CONFIRMED FIGURES, WITH THE LOG
-- =====================================================================
-- Six prices, all from the client's memo, September 2026:
--
--   fencing-post  10 ft  1900     spindle  12 in (1 ft)    200
--                  9 ft  1700              18 in (1.5 ft)  250
--                  7 ft  1400              24 in (2 ft)    300
--
-- All per piece. The unit stays `unitLabel` in src/data/products.ts, as it
-- did for cabros.

-- Fencing posts, 10 ft: never priced -> 1900.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'fencing-post' and variant_id = '10ft'
), moved as (
  update public.product_prices p
     set price_kes = 1900, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 1900
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 1900, 'migration 20260913120000 (client-confirmed)' from moved;

-- Fencing posts, 9 ft: never priced -> 1700.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'fencing-post' and variant_id = '9ft'
), moved as (
  update public.product_prices p
     set price_kes = 1700, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 1700
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 1700, 'migration 20260913120000 (client-confirmed)' from moved;

-- Fencing posts, 7 ft: never priced -> 1400.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'fencing-post' and variant_id = '7ft'
), moved as (
  update public.product_prices p
     set price_kes = 1400, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 1400
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 1400, 'migration 20260913120000 (client-confirmed)' from moved;

-- Spindles, 12 in (1 ft): never priced -> 200.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'spindle' and variant_id = '12in'
), moved as (
  update public.product_prices p
     set price_kes = 200, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 200
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 200, 'migration 20260913120000 (client-confirmed)' from moved;

-- Spindles, 18 in (1.5 ft): never priced -> 250.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'spindle' and variant_id = '18in'
), moved as (
  update public.product_prices p
     set price_kes = 250, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 250
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 250, 'migration 20260913120000 (client-confirmed)' from moved;

-- Spindles, 24 in (2 ft): never priced -> 300.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'spindle' and variant_id = '24in'
), moved as (
  update public.product_prices p
     set price_kes = 300, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 300
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 300, 'migration 20260913120000 (client-confirmed)' from moved;


-- =====================================================================
-- SECTION 5 — THE RECORD TABLES THAT MIRROR A CART LINE
-- =====================================================================
-- `order_lines` and `quote_request_lines` were built as mirrors of
-- `CartLine` in src/types/index.ts, ahead of orders and quotes moving off
-- localStorage. Nothing writes them yet. `CartLine` gained a variant in
-- this stage, so the mirrors do too — otherwise the day orders migrate,
-- "Fencing Posts x 40" is all a stored order could say about which posts.
--
-- Both are the height AS IT READ at the time, copied, for the reason every
-- other descriptive field on these lines is copied. '' = no variant, the
-- same convention as `product_prices.variant_id`.
alter table public.order_lines
  add column if not exists variant_id    text not null default '',
  add column if not exists variant_label text not null default '';

alter table public.quote_request_lines
  add column if not exists variant_id    text not null default '',
  add column if not exists variant_label text not null default '';

-- AIR VENTS: still no legible price on the memo. Not touched.
-- ROAD KERBS, CULVERTS: no data. Not touched; road kerbs keeps its
-- placeholder from the price-tables migration.
