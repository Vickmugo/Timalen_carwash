-- =====================================================================
-- THE FIRST CONFIRMED CONCRETE PRICES, AND THE RENAME THAT CAME WITH THEM.
-- ---------------------------------------------------------------------
-- A FOURTH MIGRATION. Run it the same way as the other three; nothing in
-- the app applies migrations.
--
-- WHAT THIS DOES, IN ONE LINE: renames one product id, adds three new
-- ones, sets five prices the client has actually confirmed, and writes an
-- audit row for every figure it moves.
--
-- ---------------------------------------------------------------------
-- WHY THE PRICES ARE SET HERE RATHER THAN TYPED INTO THE ADMIN SCREEN
--
-- They could have been. The staff price editor exists precisely so a
-- price no longer needs a developer, and using it would have produced the
-- same rows. Two reasons it was done as a migration instead:
--
--   1. THREE OF THE FIVE PRODUCTS DID NOT EXIST YET. Channels, cornices
--      and cabros are new lines in src/data/products.ts, and `setPrice`
--      in src/lib/prices-db.ts deliberately refuses to insert a row for
--      an id it has never seen — it returns `not_found` rather than
--      creating one, because a price appearing for an unseeded id is more
--      likely a typo than an intention. So the rows have to be seeded
--      somewhere, and that somewhere is a migration.
--
--   2. A RENAME IS NOT A PRICE EDIT. `column-cap` becoming `wall-cap` is a
--      schema-level change to a key; there is no screen for it and there
--      should not be.
--
-- ---------------------------------------------------------------------
-- THE AUDIT TRAIL IS NOT OPTIONAL HERE
--
-- src/lib/prices-db.ts guarantees that no price moves without a
-- `price_changes` row behind it. A migration that quietly UPDATEd
-- `price_kes` would be the one path through this system that breaks that
-- guarantee — and it would break it for the most consequential edit the
-- table has seen so far, the first time real money was attached to these
-- products. So every UPDATE below is paired with an INSERT into
-- `price_changes`, with the same column meanings the application uses:
--
--   old_price_kes null  the cell had never been priced (the three new
--                       lines: their rows are inserted null, then priced,
--                       so the log shows the first figure arriving)
--   new_price_kes null  the cell was depriced — does not happen here
--   changed_by          self-reported and unverified everywhere else in
--                       this app. Here it is honest and specific: the
--                       string below names the migration, so anybody
--                       reading the log can tell a staff edit from this
--                       one. It is NOT a person's name, and pretending
--                       otherwise would be the one lie in a table whose
--                       whole job is to say who did what.
--
-- ---------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT IN THIS MIGRATION
--
-- FENCING POSTS AND SPINDLES. The client prices both in three height
-- tiers:
--
--   posts     10 ft 1900   9 ft 1700   7 ft 1400
--   spindles  12"  200     18"  250    24"  300
--
-- `product_prices` holds ONE figure per product — `unique (business_id,
-- product_id)`, no tier column — the way `service_prices` holds one per
-- service-crossed-with-vehicle. Writing any single one of those six
-- numbers into the existing shape would publish, say, 1900 as the price
-- of every post regardless of height, which is worse than the placeholder
-- sitting there now because it would look confirmed. Supporting tiers is
-- a schema change plus a change to `PriceBook`, to `CartLine`, and to the
-- receipt, and it is held for its own stage. Both products keep their
-- placeholder figures until then.
--
-- AIR VENTS, CULVERTS, ROAD KERBS. No confirmed price. Road kerbs keep
-- the placeholder they already have; the other two have no product row in
-- src/data/products.ts and so get none here.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — RENAME: column-cap -> wall-cap
-- =====================================================================
-- The client's own printed banner names this line WALL CAPS and pictures
-- the same pyramid-topped cap the photographs show, so the code, the
-- image filenames and this key were all renamed together. See the note on
-- the entry in src/data/products.ts.
--
-- AN UPDATE, NOT A DELETE-AND-INSERT, and the difference matters: the row
-- keeps its uuid, so every `price_changes` row already pointing at it
-- through `product_price_id` stays attached. Recreating the row would
-- orphan that history — or rather would cascade it away, since the
-- foreign key is ON DELETE CASCADE, which is a silent loss of exactly the
-- record this table exists to keep.
--
-- Guarded so re-running is harmless: if `wall-cap` is already there this
-- matches nothing.
update public.product_prices
   set product_id = 'wall-cap',
       updated_at = now()
 where business_id = 'timalen'
   and product_id  = 'column-cap';


-- =====================================================================
-- SECTION 2 — THE THREE NEW LINES
-- =====================================================================
-- Seeded UNPRICED, then priced in section 3 alongside everything else.
--
-- That is one more statement than inserting them with their figures
-- directly, and it is the point: going in null and then being set means
-- the `price_changes` log records the first real figure arriving on each
-- of these cells, with a null `old_price_kes`, exactly as it would if a
-- staff member had typed it into the admin screen. Inserted pre-priced,
-- these three would be the only products in the table whose current price
-- has no corresponding row in the audit log.
--
-- ON CONFLICT DO NOTHING so a re-run cannot reset a price the yard has
-- since edited — the same rule the original seed follows.
insert into public.product_prices (product_id, price_kes)
values
  ('channel', null),
  ('cornice', null),
  ('cabro',   null)
on conflict (business_id, product_id) do nothing;


-- =====================================================================
-- SECTION 3 — THE CONFIRMED FIGURES, WITH THE LOG
-- =====================================================================
-- Five prices, all confirmed by the client in September 2026:
--
--   slab      350   per piece
--   wall-cap  250   per piece
--   channel   250   per piece
--   cornice   180   per piece
--   cabro    1100   PER SQUARE METRE, not per piece
--
-- CABROS ARE THE ONLY LINE NOT SOLD BY THE PIECE, and nothing in this
-- table says so. There is no unit column here and this migration does not
-- add one: the unit is `unitLabel` on the product in
-- src/data/products.ts, which is what the customer actually reads next to
-- the figure on the card, the detail page, the cart, the receipt and a
-- quote. A `unit` column here would be a second place to state the same
-- fact, free to disagree with the first. The figure is the yard's to
-- edit; what the figure is PER is a property of the product.
--
-- WRITTEN AS ONE CTE CHAIN PER PRICE so the UPDATE and its audit row
-- cannot come apart. The application path has the opposite problem and
-- says so at length in src/lib/prices-db.ts: PostgREST cannot do
-- multi-statement transactions, so there an UPDATE is followed by a
-- separate INSERT and a failure between them moves a price with no record
-- of it. A migration runs in a transaction and has no such excuse.
--
-- Each block:
--   `target`  finds the row and captures what it says NOW, before the
--             write — an UPDATE cannot tell us what it overwrote, which
--             is the same reason `setPrice` reads first
--   `moved`   writes the new figure, returning the row's id
--   the tail  inserts the audit row, and is a SELECT rather than a VALUES
--             list so that it writes NOTHING when the product row is
--             missing, instead of failing a not-null or logging a change
--             that did not happen
--
-- The `is distinct from` guard means a re-run that changes nothing logs
-- nothing. Running this migration twice should not produce two identical
-- audit rows claiming the price moved twice.

-- Slab: 550 placeholder -> 350 confirmed.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'slab'
), moved as (
  update public.product_prices p
     set price_kes = 350, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 350
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 350, 'migration 20260911160000 (client-confirmed)' from moved;

-- Wall caps: 900 placeholder -> 250 confirmed. Note this is the same row
-- that was 'column-cap' until section 1.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'wall-cap'
), moved as (
  update public.product_prices p
     set price_kes = 250, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 250
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 250, 'migration 20260911160000 (client-confirmed)' from moved;

-- Channels: never priced -> 250. old_price_kes logs as null.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'channel'
), moved as (
  update public.product_prices p
     set price_kes = 250, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 250
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 250, 'migration 20260911160000 (client-confirmed)' from moved;

-- Cornices: never priced -> 180.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'cornice'
), moved as (
  update public.product_prices p
     set price_kes = 180, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 180
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 180, 'migration 20260911160000 (client-confirmed)' from moved;

-- Cabros: never priced -> 1100 PER SQUARE METRE. See the note above about
-- where the unit lives.
with target as (
  select id, price_kes as old_price
    from public.product_prices
   where business_id = 'timalen' and product_id = 'cabro'
), moved as (
  update public.product_prices p
     set price_kes = 1100, updated_at = now()
    from target t
   where p.id = t.id and t.old_price is distinct from 1100
  returning p.id, t.old_price
)
insert into public.price_changes (product_price_id, old_price_kes, new_price_kes, changed_by)
select id, old_price, 1100, 'migration 20260911160000 (client-confirmed)' from moved;
