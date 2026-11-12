-- =====================================================================
-- CULVERTS — a new line in three diameters, seeded UNPRICED.
-- ---------------------------------------------------------------------
-- Requires 20260913120000_product_variant_prices.sql (the `variant_id`
-- column and the three-column unique constraint). Same shape as section 1
-- of 20261017190000_drainage_channels.sql, and nothing else: there are no
-- confirmed figures yet, so there is no pricing section and no
-- price_changes rows. Staff set the prices in the admin price editor once
-- the client confirms them. That works only because these rows exist,
-- since `setPrice` refuses an id it has never seen.
--
-- The ids must match `variants` on the `culvert` product in
-- src/data/products.ts exactly ("450mm", "600mm", "900mm"). A typo gives a
-- row nothing renders and a real size on the site reading "price not
-- listed" with no row for staff to price.
--
-- IDEMPOTENT. ON CONFLICT DO NOTHING: a re-run inserts nothing and cannot
-- reset a price staff have since set.
-- =====================================================================
insert into public.product_prices (product_id, variant_id, price_kes)
values
  ('culvert', '450mm', null),
  ('culvert', '600mm', null),
  ('culvert', '900mm', null)
on conflict (business_id, product_id, variant_id) do nothing;
