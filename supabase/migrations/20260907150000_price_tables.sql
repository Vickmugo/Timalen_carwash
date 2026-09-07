-- =====================================================================
-- PRICES — the board and the catalogue become editable records.
-- ---------------------------------------------------------------------
-- A THIRD MIGRATION. Run it the same way as the other two; nothing in the
-- app applies migrations.
--
-- WHAT CHANGES, AND WHAT DOES NOT.
--
-- Until now every price in this app was a number in a TypeScript file,
-- compiled into the build, movable only by a developer editing
-- src/data/services.ts or src/data/products.ts and redeploying. That is
-- what `change_requests` exists to work around: staff write down what they
-- want changed and wait. These tables remove the waiting for PRICES
-- specifically — a price becomes a row, and the yard edits it directly.
--
-- The rest of the catalogue stays exactly where it is. Service ids and
-- names, the board's row order, product names, descriptions, specs,
-- images, categories, unit labels: all still code, all still in
-- src/data/*.ts. Only the NUMBERS move here. So the three tables below
-- carry no names — they are priced cells keyed by ids that live in the
-- files, and a row here whose id no longer exists in the file is a dead
-- row, not a service.
--
-- WHY THE SPLIT IS DRAWN THERE. A price is the one field the yard has
-- authority over and needs to change without a developer. A service name
-- is the board's own wording and changing it is a transcription decision;
-- an image is a file in the repository. Putting those in the database
-- would mean two sources of truth for what this business sells, and no
-- way to review a change before it is live.
--
-- NULL STILL MEANS "NOT READ", EVERYWHERE.
--
-- `price_kes` is nullable in all three tables and it carries the exact
-- meaning `PriceCell` carries in src/types/index.ts: nobody has
-- transcribed this cell. It does NOT mean free, and it is never a
-- placeholder for a real figure. Nine cells arrive null below, from a band
-- of the board photograph too skewed to read, and two flat rows that look
-- cropped out of frame. They are seeded as rows rather than left absent so
-- that the gap is visible and so the yard can fill it in from the new
-- admin screen — which is the first time filling it in has been possible
-- without a deploy.
--
-- RLS ON, NO POLICIES, SERVICE ROLE ONLY — same as every other table here.
-- Prices are world-READABLE in the sense that the site prints them on a
-- public page, but they are written only by a signed-in staff member
-- through a route handler using the service-role key. The anon key can
-- neither read nor write them; the server reads on the page's behalf.
-- See supabase/migrations/20260907120000_grant_service_role.sql.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — THE WASH BOARD, PRICED PER VEHICLE COLUMN
-- =====================================================================

-- One row per CELL: a service crossed with a vehicle column. Eleven
-- services times three columns is thirty-three rows, seeded in full below
-- — including the nine nobody has read — so that every cell on the board
-- exists as a record and the admin screen can render the grid from the
-- table alone.
--
-- `service_id` and `vehicle_type_id` are the ids from
-- src/data/services.ts. NOT foreign keys: the services themselves are a
-- data file, not a table, which is the same arrangement `booking_lines`
-- uses and for the same reason.
create table if not exists public.service_prices (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',

  service_id      text not null,
  vehicle_type_id text not null
    check (vehicle_type_id in ('saloon', 'family-car', 'pickup')),

  -- NULL = not transcribed. See the header.
  price_kes integer check (price_kes >= 0),

  updated_at timestamptz not null default now(),

  -- One price per cell. This is what makes the table a grid rather than a
  -- log, and it is what an upsert from the admin screen targets.
  constraint service_prices_cell_unique
    unique (business_id, service_id, vehicle_type_id)
);

alter table public.service_prices enable row level security;

create index if not exists service_prices_lookup_idx
  on public.service_prices (business_id, service_id);


-- =====================================================================
-- SECTION 2 — THE REST OF THE BOARD, ONE FIGURE PER ITEM
-- =====================================================================

-- Carpets, lorries, buses, motorbike: priced as a single figure whatever
-- the vehicle. `row_id` matches a FlatPriceRow id in src/data/services.ts;
-- the groups and their order stay in the file.
create table if not exists public.flat_prices (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',

  row_id text not null,

  -- NULL = not transcribed, exactly as above. Two rows arrive that way.
  price_kes integer check (price_kes >= 0),

  updated_at timestamptz not null default now(),

  constraint flat_prices_row_unique unique (business_id, row_id)
);

alter table public.flat_prices enable row level security;


-- =====================================================================
-- SECTION 3 — CONCRETE PRODUCTS
-- =====================================================================

-- One row per product id from src/data/products.ts.
--
-- EVERY FIGURE SEEDED BELOW IS A PLACEHOLDER AND NONE OF THEM HAS BEEN
-- CONFIRMED WITH THE CLIENT. They are carried across unchanged from the
-- data file, where each one already carries that warning in a comment,
-- because moving them into a database does not make them any more true.
-- The difference this table makes is that correcting one is now a staff
-- edit rather than a deploy — which is the whole reason to want them here.
--
-- Nullable for the same reason as the board: a product whose price nobody
-- has confirmed can be set back to "not listed" rather than kept at a
-- fiction, and the site will say so instead of printing a number.
create table if not exists public.product_prices (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',

  product_id text not null,

  price_kes integer check (price_kes >= 0),

  updated_at timestamptz not null default now(),

  constraint product_prices_product_unique unique (business_id, product_id)
);

alter table public.product_prices enable row level security;


-- =====================================================================
-- SECTION 4 — WHO CHANGED A PRICE, FROM WHAT, TO WHAT
-- =====================================================================

-- THE AUDIT TRAIL, SHAPED LIKE `status_changes` ON PURPOSE.
--
-- Same idea, same column conventions, same three-nullable-foreign-keys
-- trick with a CHECK that exactly one is set — so referential integrity is
-- real and ON DELETE CASCADE works, rather than a `table_name` string that
-- nothing can enforce. Read the note on `status_changes` in
-- 20260907090000_init_records.sql; every word of it applies here.
--
-- WHY THIS MATTERS MORE THAN THE STATUS LOG. A payment status is a fact
-- about one booking. A price is what every future customer will be
-- charged, it is now editable by anyone who knows the shared staff
-- password, and there is no draft step and no approval — the edit is live
-- the moment it is saved. This table is the only record that it happened.
--
-- `changed_by` IS SELF-REPORTED AND UNVERIFIED. It comes from the same
-- "Acting as" field as everything else in the staff view — a name tag, not
-- an identity. See the warning at the top of src/data/admin-users.ts. It
-- is worth being blunt about what that means here: this log says a price
-- moved and which name was typed into a box at the time. It does not say
-- who moved it.
--
-- BOTH VALUES ARE NULLABLE, and each null is meaningful:
--   old_price_kes null   the cell had never been priced — this edit is the
--                        first real figure anyone has put on it
--   new_price_kes null   the cell was DEPRICED, set back to "not listed",
--                        which is a legitimate thing to do to a figure
--                        nobody can stand behind
create table if not exists public.price_changes (
  id uuid primary key default gen_random_uuid(),

  service_price_id uuid references public.service_prices (id) on delete cascade,
  flat_price_id    uuid references public.flat_prices (id)    on delete cascade,
  product_price_id uuid references public.product_prices (id) on delete cascade,

  old_price_kes integer,
  new_price_kes integer,

  changed_by text        not null default 'unattributed',
  changed_at timestamptz not null default now(),

  constraint price_changes_one_parent check (
    (service_price_id is not null)::int +
    (flat_price_id    is not null)::int +
    (product_price_id is not null)::int = 1
  )
);

alter table public.price_changes enable row level security;

-- Most recent first, per cell. Partial so each index covers only the rows
-- that belong to it rather than two columns of nulls.
create index if not exists price_changes_service_idx
  on public.price_changes (service_price_id, changed_at desc)
  where service_price_id is not null;

create index if not exists price_changes_flat_idx
  on public.price_changes (flat_price_id, changed_at desc)
  where flat_price_id is not null;

create index if not exists price_changes_product_idx
  on public.price_changes (product_price_id, changed_at desc)
  where product_price_id is not null;

-- The whole log, newest first, for a "recent price changes" panel.
create index if not exists price_changes_recent_idx
  on public.price_changes (changed_at desc);


-- =====================================================================
-- SECTION 5 — GRANTS
-- =====================================================================
-- 20260907120000_grant_service_role.sql set default privileges for
-- service_role on this schema, so tables created after it should inherit
-- these. Stated explicitly anyway: a table that silently ends up
-- unreachable produces a 42501 at runtime, and that is a diagnosis this
-- project has already paid for once.

grant select, insert, update, delete on public.service_prices to service_role;
grant select, insert, update, delete on public.flat_prices    to service_role;
grant select, insert, update, delete on public.product_prices to service_role;
grant select, insert, update, delete on public.price_changes  to service_role;

revoke all on public.service_prices from anon, authenticated;
revoke all on public.flat_prices    from anon, authenticated;
revoke all on public.product_prices from anon, authenticated;
revoke all on public.price_changes  from anon, authenticated;


-- =====================================================================
-- SECTION 6 — SEED
-- =====================================================================
-- Transcribed from src/data/services.ts and src/data/products.ts as they
-- stand at this migration. Every figure marked "board" in that file is a
-- real reading; every null below is a cell nobody has read.
--
-- ON CONFLICT DO NOTHING throughout, so re-running this migration cannot
-- overwrite a price the yard has since edited. Seeding is a one-time
-- floor, not a reset.
--
-- FOUR OF THESE CONFIRMED CELLS PRICE A SMALLER VEHICLE ABOVE A LARGER
-- ONE — engine-wash, dry-vacuum and seat-wash. They are seeded exactly as
-- read, not corrected: a yard may price however it likes, and quietly
-- fixing a real number to match an assumption is the invention this whole
-- exercise exists to prevent. They remain the cells most worth a second
-- look in front of the board. See `nonMonotonicRows` in the data file.

insert into public.service_prices (service_id, vehicle_type_id, price_kes)
values
  -- Eight rows read with confidence: twenty-four real cells.
  ('body-wash',     'saloon',      200),
  ('body-wash',     'family-car',  300),
  ('body-wash',     'pickup',      300),

  ('engine-wash',   'saloon',      200),
  ('engine-wash',   'family-car',  900),  -- above Pick-up; read as painted
  ('engine-wash',   'pickup',      300),

  ('under-wash',    'saloon',      250),
  ('under-wash',    'family-car',  600),
  ('under-wash',    'pickup',      600),

  ('dry-vacuum',    'saloon',      500),  -- above both larger columns
  ('dry-vacuum',    'family-car',  200),
  ('dry-vacuum',    'pickup',      300),

  ('wet-vacuum',    'saloon',      150),
  ('wet-vacuum',    'family-car',  300),
  ('wet-vacuum',    'pickup',     1200),

  ('polishing',     'saloon',      200),
  ('polishing',     'family-car', 1200),
  ('polishing',     'pickup',     2000),

  ('roof-wash',     'saloon',     1000),
  ('roof-wash',     'family-car', 2000),
  ('roof-wash',     'pickup',     2500),

  ('seat-wash',     'saloon',     1500),
  ('seat-wash',     'family-car', 2500),  -- above Pick-up; read as painted
  ('seat-wash',     'pickup',     2000),

  -- Three rows in a band of the photograph too skewed and compressed to
  -- read any column of: nine cells, seeded null. Their POSITION on the
  -- board is known even though their prices are not, which is why they are
  -- rows here rather than absent.
  ('interior-wash', 'saloon',     null),
  ('interior-wash', 'family-car', null),
  ('interior-wash', 'pickup',     null),

  ('complete-wash', 'saloon',     null),
  ('complete-wash', 'family-car', null),
  ('complete-wash', 'pickup',     null),

  ('buffing',       'saloon',     null),
  ('buffing',       'family-car', null),
  ('buffing',       'pickup',     null)
on conflict (business_id, service_id, vehicle_type_id) do nothing;


insert into public.flat_prices (row_id, price_kes)
values
  ('carpet-small',    500),
  -- Medium and Large BOTH read as 1000. That may be one figure spanning
  -- two rows rather than two equal figures; seeded as the board reads. If
  -- a clearer photo shows a merged cell, the fix is to merge the rows in
  -- the data file, not to invent a different number for one of them.
  ('carpet-medium',  1000),
  ('carpet-large',   1000),
  -- Cropped out of frame rather than illegible in it.
  ('carpet-sofa-set', null),

  ('lorry-canter',    400),
  ('lorry-pr',        500),
  ('lorry-fsr',       600),

  ('bus-mini',        400),
  ('bus-full',       null),  -- likely cropped out of frame

  ('motorbike',       100)
on conflict (business_id, row_id) do nothing;


-- PLACEHOLDERS, ALL FIVE. Not confirmed with the client, carried across
-- unchanged from src/data/products.ts where each already says so. Seeded
-- so the catalogue keeps working and so these are now correctable from the
-- admin screen rather than from a deploy — which is the point of the
-- table, not an endorsement of the figures in it.
insert into public.product_prices (product_id, price_kes)
values
  ('fencing-post', 750),
  ('slab',         550),
  ('spindle',      320),
  ('column-cap',   900),
  ('road-kerb',    680)
on conflict (business_id, product_id) do nothing;
