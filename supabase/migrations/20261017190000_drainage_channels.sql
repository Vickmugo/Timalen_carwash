-- =====================================================================
-- DRAINAGE CHANNELS — a new line, priced by length.
-- ---------------------------------------------------------------------
-- A SIXTH MIGRATION. Run it the same way as the others; nothing in the
-- app applies migrations. Requires 20260913120000_product_variant_prices.sql
-- (the `variant_id` column and the three-column unique constraint).
--
-- WHAT THIS DOES, IN ONE LINE: seeds two length cells for the new
-- `drainage-channel` product unpriced, then prices them, logging each
-- figure in `price_changes`.
--
-- Figures from the client, October 2026, per piece:
--
--   drainage-channel  1 ft  400
--                     2 ft  600
--
-- NOT THE SAME ROW AS `channel`. The existing Channels line (one figure,
-- 250, from 20260911160000) is untouched by this file. Whether the client
-- means one product or two is an open question; see the note on the entry
-- in src/data/products.ts.
--
-- IDEMPOTENT. The insert is ON CONFLICT DO NOTHING and each price block is
-- guarded by `is distinct from`, so a re-run inserts nothing, moves
-- nothing and logs nothing. Same shape as 20260913120000, section 4 — read
-- that file's header for why each step of the CTE chain exists.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — THE TWO LENGTH CELLS, UNPRICED
-- =====================================================================
-- The ids must match `variants` on the product in src/data/products.ts
-- exactly ("1ft", "2ft"). A typo gives a priced row nothing renders and a
-- real length on the site reading "price not listed".
insert into public.product_prices (product_id, variant_id, price_kes)
values
  ('drainage-channel', '1ft', null),
  ('drainage-channel', '2ft', null)
on conflict (business_id, product_id, variant_id) do nothing;


-- =====================================================================
-- SECTION 2 — THE FIGURES, WITH THE LOG
-- =====================================================================

-- Drainage channels, 1 ft: never priced -> 400.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'drainage-channel' and variant_id = '1ft'
), moved as (
  update public.product_prices p
     set price_kes = 400, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 400
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 400, 'migration 20261017190000 (client-confirmed)' from moved;

-- Drainage channels, 2 ft: never priced -> 600.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'drainage-channel' and variant_id = '2ft'
), moved as (
  update public.product_prices p
     set price_kes = 600, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 600
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 600, 'migration 20261017190000 (client-confirmed)' from moved;
