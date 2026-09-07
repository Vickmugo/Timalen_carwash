-- =====================================================================
-- INITIAL SCHEMA — the records this app currently keeps in localStorage.
-- ---------------------------------------------------------------------
-- NOT APPLIED BY ANY CODE. Run this through the Supabase dashboard's SQL
-- editor or `supabase db push`. Nothing in the app executes migrations,
-- and nothing in the app reads these tables yet: bookings, orders, quote
-- requests and change requests are all still served from the visitor's own
-- localStorage via src/lib/store.ts. This is the destination, built ahead
-- of the move, so the move itself is a separate reviewable change.
--
-- WHAT THIS MIRRORS. Every table below comes from a type in
-- src/types/index.ts and a key in src/lib/store.ts:
--
--   demo.bookings        -> bookings + booking_lines
--   demo.orders          -> orders + order_lines
--   demo.quotes          -> quote_requests + quote_request_lines
--   demo.changeRequests  -> change_requests
--   (the `history` field on all four) -> status_changes
--
-- WHAT IS DELIBERATELY ABSENT. There are no products, services, price
-- board or business-identity tables here. That content is not a record —
-- it lives in src/data/*.ts, is compiled into the build, and is edited by
-- a developer in a commit. Copying it into the database would create a
-- second source of truth for prices, and the two would disagree the first
-- time anybody edited either one. The change_requests table below is the
-- deliberate seam between the two worlds: staff ask for a price change
-- here, a developer makes it in the data file.
--
-- ROW LEVEL SECURITY IS ON EVERYWHERE, WITH NO POLICIES.
-- Read that as: the anon key can do NOTHING against these tables. Not read
-- a booking, not write one. That is intentional and it is the safe
-- direction to start from — a Supabase table left without RLS is readable
-- and writable by anybody who has the anon key, which is a key that ships
-- to browsers by design. Every one of these tables holds customer names
-- and phone numbers.
--
-- Only the service-role key (see src/lib/supabase.ts) can touch these
-- today, and that key never leaves the server. When a feature actually
-- migrates, it gets the narrowest policy that makes it work, added
-- deliberately in its own migration — not a blanket `using (true)` added
-- here to save that work later.
--
-- CONVENTIONS
--   * snake_case columns; the TypeScript types are camelCase. The mapping
--     is mechanical but it is NOT written yet — no reader or writer exists
--     to need it, and guessing at one now would be code nothing calls.
--   * text + CHECK rather than Postgres ENUM types for the status
--     vocabularies. Both express the same constraint; a CHECK is a plain
--     ALTER to widen, whereas an enum value cannot be removed and cannot
--     be reordered, and these vocabularies are young.
--   * money is `integer` KES. This business prices in whole shillings —
--     the price board carries no cents and every figure in src/data is an
--     integer. No floats anywhere near a price.
--   * timestamps are `timestamptz`. The TS side stores ISO 8601 strings
--     from `new Date().toISOString()`, which are UTC; `timestamp` without
--     a zone would silently drop that and read as local time on a server
--     in another region.
-- =====================================================================


-- =====================================================================
-- SECTION 0 — HEALTH CHECK
-- =====================================================================

-- ISOLATED CONNECTION TEST. Not a record of anything, and no application
-- feature reads it. It exists so a route can write one row and read it
-- back and prove the URL, the key and the network path all work, WITHOUT
-- writing a fake booking into a table that is supposed to hold real ones.
--
-- Safe to truncate at any time. See src/app/api/health/supabase/route.ts.
create table if not exists public.health_checks (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',
  -- Free text from whoever ran the check: which machine, which branch.
  note        text        not null default '',
  created_at  timestamptz not null default now()
);

alter table public.health_checks enable row level security;

create index if not exists health_checks_recent_idx
  on public.health_checks (business_id, created_at desc);


-- =====================================================================
-- SECTION 1 — BOOKINGS            (src/types/index.ts: Booking)
-- =====================================================================

-- ON `id` VERSUS `ref`.
--
-- The app identifies a booking by `ref` — "WB-4K9T2X" — and looks records
-- up by it everywhere, including in the receipt URL (/receipt/booking/[ref]).
-- The obvious move is to make `ref` the primary key. It is the wrong one.
--
-- `makeRef` in src/lib/format.ts documents itself as "not collision-proof":
-- six characters from a 32-letter alphabet, about a billion values, which
-- by the birthday bound starts colliding in the low tens of thousands of
-- records. With `ref` as the primary key, that collision is an insert that
-- fails and a customer whose booking is lost.
--
-- So: a surrogate uuid is the identity, and `ref` carries a UNIQUE
-- constraint per business. A collision then surfaces as a unique violation
-- the writing code can catch and retry with a fresh ref — a hiccup instead
-- of a lost booking. Lookups by ref keep working; the constraint is what
-- makes them safe.
create table if not exists public.bookings (
  id          uuid        primary key default gen_random_uuid(),

  -- THE TENANT HEDGE. One column, one default, and no logic anywhere that
  -- reads it — that is the entire feature. It is here so a second business
  -- is a new value rather than a schema migration against live records.
  business_id text        not null default 'timalen',

  ref         text        not null,

  -- THE PRICE-BOARD FIELDS — all three nullable, exactly as they are
  -- optional in TypeScript, and for the same reason. Bookings made before
  -- the price board was wired in are still sitting in visitors' browsers
  -- carrying `service_name` and no lines. If those records are ever
  -- imported, they must be storable as they are; a NOT NULL here would
  -- mean either dropping them or inventing a vehicle type for them.
  vehicle_type_id   text,
  vehicle_type_name text,

  -- LEGACY, from the three invented tiers that predated the board. Never
  -- written by new bookings. Kept because on those old records they are
  -- the only description of what was actually booked.
  service_id        text,
  service_name      text,

  -- The whole booking: the sum of every line in booking_lines.
  --
  -- Stored rather than derived, deliberately. It is what was agreed on the
  -- day. Recomputing it from the lines later would be recomputing it from
  -- whatever the lines say later, and a receipt has to keep saying what
  -- the customer actually paid.
  price_kes        integer     not null check (price_kes >= 0),
  duration_minutes integer     not null check (duration_minutes > 0),

  -- `booking_date` rather than `date`: `date` is also a type name, and a
  -- column called that needs quoting in half the places it appears. The
  -- name also reads better beside start_time / end_time.
  booking_date  date        not null,
  start_time    time        not null,
  end_time      time        not null,

  customer_name text        not null,
  phone         text        not null,
  vehicle       text        not null,
  -- Always present in the type, frequently the empty string. DEFAULT ''
  -- rather than NULL so there is one representation of "nothing written
  -- here" instead of two that read differently in every query.
  notes         text        not null default '',

  payment_status text       not null
    check (payment_status in ('paid', 'pay_on_collection', 'unpaid')),

  created_at    timestamptz not null default now(),

  -- A booking must not end before it starts. Cheap, and it catches a whole
  -- class of slot-arithmetic bug at the door rather than on a receipt.
  constraint bookings_time_order check (end_time > start_time),

  -- Scoped to the business, not global: two tenants may legitimately mint
  -- the same ref, and this is the constraint that stays correct the day a
  -- second one exists.
  constraint bookings_ref_unique unique (business_id, ref)
);

alter table public.bookings enable row level security;

-- The staff diary reads forwards, oldest first, by date then time — see
-- `getBookings` in src/lib/store.ts. This index is that query.
create index if not exists bookings_diary_idx
  on public.bookings (business_id, booking_date, start_time);

-- ONE SERVICE ON A BOOKING, PRICED AS IT READ AT THE TIME.
--
-- `price_kes` is copied here rather than joined to the price board for the
-- reason given on BookingLine in src/types/index.ts: if the board is
-- repainted next month, a receipt printed from an old booking still has to
-- say what was charged. The same argument applies to `name`.
create table if not exists public.booking_lines (
  id         uuid    primary key default gen_random_uuid(),

  -- No business_id here, on purpose. A line reaches its tenant through its
  -- booking. Repeating the column on the child would be a second copy that
  -- can disagree with the first, and nothing would be watching which is
  -- right. Same reasoning on every child table below.
  booking_id uuid    not null
    references public.bookings (id) on delete cascade,

  -- Matches a WashPriceRow.id in src/data/services.ts. NOT a foreign key:
  -- the price board is a data file, not a table, so there is nothing here
  -- to point at. That is the intended arrangement, not a gap.
  service_id text    not null,
  -- The board name as it read when the booking was made.
  name       text    not null,
  -- Never null. An unread board cell cannot be selected, so it cannot
  -- reach a booking — unlike PriceCell on the board itself, which is
  -- nullable precisely because a cell may not have been read yet.
  price_kes  integer not null check (price_kes >= 0),

  -- Board order, preserved. Rows in a table have no inherent order and a
  -- receipt that lists services in a different order each time it renders
  -- looks broken.
  position   integer not null default 0
);

alter table public.booking_lines enable row level security;

create index if not exists booking_lines_booking_idx
  on public.booking_lines (booking_id, position);


-- =====================================================================
-- SECTION 2 — ORDERS              (src/types/index.ts: Order, CartLine)
-- =====================================================================

create table if not exists public.orders (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',
  ref         text        not null,

  -- Sum of the order's lines, stored for the same reason bookings store
  -- their total: it is the figure that was agreed.
  subtotal_kes integer    not null check (subtotal_kes >= 0),

  customer_name     text  not null,
  phone             text  not null,
  delivery_location text  not null,
  notes             text  not null default '',

  payment_status text       not null
    check (payment_status in ('paid', 'pay_on_collection', 'unpaid')),

  created_at  timestamptz not null default now(),

  constraint orders_ref_unique unique (business_id, ref)
);

alter table public.orders enable row level security;

-- Orders read newest-first in the staff view.
create index if not exists orders_recent_idx
  on public.orders (business_id, created_at desc);

-- ONE CART LINE ON AN ORDER.
--
-- Every descriptive field is copied off the product at the time of sale —
-- name, unit label, price, fulfilment status. Same argument as the booking
-- lines: this is a record of a sale, and it must not change its own
-- history when src/data/products.ts is edited.
create table if not exists public.order_lines (
  id         uuid    primary key default gen_random_uuid(),
  order_id   uuid    not null
    references public.orders (id) on delete cascade,

  -- A Product.id / Product.slug from src/data/products.ts. Not foreign
  -- keys, for the same reason as service_id above: the catalogue is a file.
  product_id text    not null,
  slug       text    not null,
  name       text    not null,
  unit_label text    not null,

  price_kes  integer not null check (price_kes >= 0),
  quantity   integer not null check (quantity > 0),

  -- FulfilmentStatus. Hand-set per product; explicitly NOT stock tracking —
  -- there are no stock counts anywhere in this app by design.
  status     text    not null
    check (status in ('ready_to_ship', 'made_to_order')),

  -- Copied rather than looked up: whether this item bypassed the cart is
  -- part of what happened, and the flag on the product can change later.
  quote_only boolean not null default false,

  position   integer not null default 0
);

alter table public.order_lines enable row level security;

create index if not exists order_lines_order_idx
  on public.order_lines (order_id, position);


-- =====================================================================
-- SECTION 3 — QUOTE REQUESTS      (src/types/index.ts: QuoteRequest)
-- =====================================================================

create table if not exists public.quote_requests (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',
  ref         text        not null,

  customer_name     text  not null,
  phone             text  not null,

  -- Free text describing what they want made.
  item              text  not null,

  -- TEXT, NOT A NUMBER, AND THAT IS NOT AN OVERSIGHT.
  --
  -- `quantity` is a string in TypeScript because this field takes whatever
  -- the customer types: "about 200", "2 lorry loads", "enough for 30m of
  -- fence". Typing it as integer here would force the form to reject those
  -- answers, and a customer who cannot describe their own job in their own
  -- words does not send the enquiry at all. The staff member reading it is
  -- the parser.
  quantity          text  not null,

  delivery_location text  not null,
  notes             text  not null default '',

  status text not null
    check (status in ('new', 'contacted', 'quoted', 'closed')),

  created_at  timestamptz not null default now(),

  constraint quote_requests_ref_unique unique (business_id, ref)
);

alter table public.quote_requests enable row level security;

create index if not exists quote_requests_recent_idx
  on public.quote_requests (business_id, created_at desc);

-- Populated only when the request came from an over-threshold cart (see
-- `quoteRules` in src/data/config.ts). An empty set here is the ordinary
-- case for a request typed straight into the quote form.
create table if not exists public.quote_request_lines (
  id               uuid    primary key default gen_random_uuid(),
  quote_request_id uuid    not null
    references public.quote_requests (id) on delete cascade,

  product_id text    not null,
  slug       text    not null,
  name       text    not null,
  unit_label text    not null,
  price_kes  integer not null check (price_kes >= 0),
  quantity   integer not null check (quantity > 0),
  status     text    not null
    check (status in ('ready_to_ship', 'made_to_order')),
  quote_only boolean not null default false,
  position   integer not null default 0
);

alter table public.quote_request_lines enable row level security;

create index if not exists quote_request_lines_parent_idx
  on public.quote_request_lines (quote_request_id, position);


-- =====================================================================
-- SECTION 4 — CHANGE REQUESTS     (src/types/index.ts: ChangeRequest)
-- =====================================================================

-- A REQUEST TO CHANGE THE SITE. NOT A CHANGE TO THE SITE.
--
-- Nothing in this table is wired to anything. Prices live in
-- src/data/services.ts and src/data/products.ts, they are compiled into
-- the build, and the only thing that moves one is a developer editing that
-- file and redeploying. These rows exist so the yard can say what it wants
-- changed without waiting to catch the developer on the phone, and so the
-- asking is written down instead of living in a WhatsApp thread nobody can
-- search. `status` tracks the asking, not the doing.
--
-- ONE TABLE FOR A THREE-MEMBER UNION.
--
-- PriceChangeRequest, NewItemRequest and StockChangeRequest share a base
-- and differ in a handful of fields. Three tables would mean three queries
-- and a client-side merge every time the staff view renders its one
-- newest-first list. One table with a `kind` discriminator and CHECK
-- constraints keeps that a single ordered read.
--
-- The CHECKs are what stop this becoming a bag of nullable columns: they
-- enforce, in the database, exactly what the discriminated union enforces
-- in TypeScript. A 'new_item' row carrying a subject_id is as impossible
-- here as a NewItemRequest carrying one is in the type system.
create table if not exists public.change_requests (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',
  ref         text        not null,

  kind text not null check (kind in ('price', 'new_item', 'stock')),

  -- Two states, and "sent" is self-reported: it means a staff member
  -- pressed "Mark sent" after copying the text somewhere. There is no
  -- delivery receipt behind it. Deliberately no third "applied" state —
  -- this app cannot know when a change has gone live, because that
  -- happens in a deploy it has no sight of, and a status nobody can set
  -- truthfully is worse than no status.
  status text not null check (status in ('draft', 'sent')),

  -- `by` is a keyword in SQL, so the column takes a prefix. Maps to
  -- ChangeRequestBase.by: a SELF-REPORTED, UNVERIFIED name from the
  -- "Acting as" field, or the literal 'unattributed'. Read the warning at
  -- the top of src/data/admin-users.ts before trusting it for anything.
  -- It is a name tag, not an identity.
  raised_by text not null default 'unattributed',

  note      text not null default '',

  created_at timestamptz not null default now(),

  -- ---- kind = 'price' ------------------------------------------------
  -- Subject stored as an opaque id PLUS the label and price as they read
  -- at the time. Not redundancy: the request is a message to a human about
  -- a moment. If the board is repainted between drafting and sending, this
  -- row must still say what was being looked at rather than silently
  -- re-pointing at whatever holds that id now.
  subject_id        text,
  subject_label     text,
  -- NULLABLE ON PURPOSE, and distinct from "not applicable". A null here
  -- on a price row means the board cell has never been read — and those
  -- are the rows most likely to be the whole point of the request, so they
  -- are offered rather than filtered out. Mirrors PriceCell.
  current_price_kes integer,

  -- Shared by 'price' and 'new_item'; both propose a figure.
  proposed_price_kes integer check (proposed_price_kes >= 0),

  -- ---- kind = 'new_item' ---------------------------------------------
  item_name      text,
  -- A ProductCategoryId or the literal 'other'. No CHECK listing the five
  -- categories: they are content in src/data/products.ts, and a genuinely
  -- new category is a real thing that happens in this yard. A constraint
  -- here would have to be migrated every time the catalogue grew, which is
  -- the opposite of what this table is for.
  category_id    text,
  -- Only meaningful when category_id is 'other'.
  other_category text,
  description    text,
  -- Staff ticked "we still owe you a photo of this".
  photo_needed   boolean,

  -- ---- kind = 'stock' ------------------------------------------------
  -- Products only. Wash services are not stocked — a bay either runs or it
  -- does not, and that is an opening-hours question, not this one.
  intent text check (intent in ('out_of_stock', 'back_in_stock')),

  constraint change_requests_ref_unique unique (business_id, ref),

  -- The union, enforced. Each branch states what must be present and what
  -- must be absent, so no row can carry another kind's fields.
  constraint change_requests_price_shape check (
    kind <> 'price' or (
      subject_id is not null
      and subject_label is not null
      and proposed_price_kes is not null
      -- current_price_kes stays free: null is a meaningful value here.
      and item_name is null
      and category_id is null
      and other_category is null
      and description is null
      and photo_needed is null
      and intent is null
    )
  ),

  constraint change_requests_new_item_shape check (
    kind <> 'new_item' or (
      item_name is not null
      and category_id is not null
      and proposed_price_kes is not null
      and description is not null
      and photo_needed is not null
      and subject_id is null
      and subject_label is null
      and current_price_kes is null
      and intent is null
    )
  ),

  constraint change_requests_stock_shape check (
    kind <> 'stock' or (
      subject_id is not null
      and subject_label is not null
      and intent is not null
      and current_price_kes is null
      and proposed_price_kes is null
      and item_name is null
      and category_id is null
      and other_category is null
      and description is null
      and photo_needed is null
    )
  )
);

alter table public.change_requests enable row level security;

-- Newest first — the opposite of the bookings sort, and on purpose. A
-- booking list is a diary and reads forwards. This is a to-do list: the
-- thing just drafted is the thing about to be sent, and it should not be
-- at the bottom of the page behind a month of requests already dealt with.
create index if not exists change_requests_recent_idx
  on public.change_requests (business_id, created_at desc);


-- =====================================================================
-- SECTION 5 — STATUS HISTORY      (src/types/index.ts: StatusChange)
-- =====================================================================

-- ONE STATUS CHANGE, AND THE NAME OF WHOEVER SAYS THEY MADE IT.
--
-- In TypeScript this is a `history?: StatusChange[]` hanging off four
-- different record types. Relationally it is one table, because the shape
-- is identical in all four cases and four near-identical tables would be
-- four places for a future column to be forgotten.
--
-- FOUR NULLABLE FOREIGN KEYS, EXACTLY ONE SET.
--
-- The tempting shape is the polymorphic one: a `record_type` column and a
-- `record_ref` string. It is rejected here because the database cannot
-- enforce it — a `record_ref` pointing at a booking that no longer exists
-- is just a string, and nothing would ever catch it. Four real foreign
-- keys with a CHECK that exactly one is populated costs three nullable
-- columns and buys actual referential integrity, plus ON DELETE CASCADE
-- that works.
--
-- NO 20-ENTRY CAP HERE, unlike src/lib/store.ts. That cap exists because
-- localStorage is a ~5MB budget shared by every record in the app. This
-- table has no such pressure, and silently discarding the oldest entries
-- of an attribution trail is not a behaviour to port into a database.
create table if not exists public.status_changes (
  id uuid primary key default gen_random_uuid(),

  booking_id        uuid references public.bookings (id)        on delete cascade,
  order_id          uuid references public.orders (id)          on delete cascade,
  quote_request_id  uuid references public.quote_requests (id)  on delete cascade,
  change_request_id uuid references public.change_requests (id) on delete cascade,

  -- The value the status was set TO, stored RAW: 'pay_on_collection', not
  -- 'Pay on arrival'.
  --
  -- Deliberately plain text with NO CHECK constraint, which is the one
  -- place in this file a status vocabulary is left unconstrained. Two
  -- reasons. It spans four different vocabularies — PaymentStatus,
  -- QuoteStatus and ChangeRequestStatus — and a constraint covering all of
  -- them at once would accept a quote status on a booking, so it would not
  -- be saying anything true. And this is a record of what happened: the
  -- wording on the badges must stay free to change without invalidating
  -- history already written.
  --
  -- `to` is reserved in SQL; the column is named for what it holds.
  to_status text not null,

  -- Self-reported name, or 'unattributed'. Same caveat as everywhere else.
  changed_by text not null default 'unattributed',
  changed_at timestamptz not null default now(),

  constraint status_changes_one_parent check (
    (booking_id        is not null)::int +
    (order_id          is not null)::int +
    (quote_request_id  is not null)::int +
    (change_request_id is not null)::int = 1
  )
);

alter table public.status_changes enable row level security;

-- Most recent first, matching the documented order of the `history` field.
-- One partial index per parent: partial so each covers only the rows that
-- actually belong to it rather than three columns of nulls.
create index if not exists status_changes_booking_idx
  on public.status_changes (booking_id, changed_at desc)
  where booking_id is not null;

create index if not exists status_changes_order_idx
  on public.status_changes (order_id, changed_at desc)
  where order_id is not null;

create index if not exists status_changes_quote_idx
  on public.status_changes (quote_request_id, changed_at desc)
  where quote_request_id is not null;

create index if not exists status_changes_change_request_idx
  on public.status_changes (change_request_id, changed_at desc)
  where change_request_id is not null;
