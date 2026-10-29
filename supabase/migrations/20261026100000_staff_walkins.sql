-- =====================================================================
-- STAFF WALK-INS — a car registered at the counter, with no time slot.
-- ---------------------------------------------------------------------
-- A NINTH MIGRATION. Run it the same way as the others; nothing in the
-- app applies migrations. Run it BEFORE deploying the code that uses it:
-- the new code reads `bookings.source` in every booking select, so that
-- code against a database without this file fails on /admin.
--
-- ADDITIVE ONLY, AND SAFE FOR THE CODE THAT IS LIVE TODAY. Two new
-- columns and one partial index. The code deployed now never names either
-- column: its inserts omit `source` and get the default 'online', which
-- is true of every row it writes, and `walkin_request_id` stays null for
-- them. Its selects list columns by name, so a new column changes nothing
-- they read. Nothing is renamed, dropped or rewritten.
--
-- WHAT IS IN HERE
--   1. bookings.source              'online' (the /book form) or 'staff'
--                                   (registered from /admin). Every
--                                   existing row is an online booking, and
--                                   the default backfills it as one.
--   2. bookings.walkin_request_id   the id the staff form generates once
--                                   per opening, and the partial unique
--                                   index that turns a double tap or a
--                                   retry on a bad connection into one
--                                   booking rather than two.
--   3. grants, restated.
--
-- WHAT IS DELIBERATELY NOT IN HERE
--   - No overlap rule. A staff entry is a real use of the single bay, so
--     it blocks overlapping online slots through the same check the online
--     route already runs (src/lib/bookings-db.ts reads every row that is
--     not cancelled), but a staff entry itself is never refused for
--     overlapping: the car is already in the bay.
--   - No change to payments, receipts or their functions. A walk-in's
--     payment is an ordinary `payments` row with `booking_id` set, created
--     `claimed` or `cash_due` and moved only by resolve_payment().
--   - No plate column. `bookings.vehicle` already holds the free-text
--     "make, model and number plate" the online form asks for; a walk-in
--     stores its plate there.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — WHERE A BOOKING CAME FROM
-- =====================================================================
alter table public.bookings
  add column if not exists source text not null default 'online';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'bookings_source_check'
       and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_source_check
      check (source in ('online', 'staff'));
  end if;
end
$$;


-- =====================================================================
-- SECTION 2 — ONE WALK-IN PER FORM OPENING
-- =====================================================================
-- Nullable: online bookings never carry one. Partial, so the many nulls
-- are not indexed at all, and scoped to the business like the ref.
alter table public.bookings
  add column if not exists walkin_request_id uuid;

create unique index if not exists bookings_walkin_request_unique
  on public.bookings (business_id, walkin_request_id)
  where walkin_request_id is not null;


-- =====================================================================
-- SECTION 3 — GRANTS
-- =====================================================================
-- Unchanged arrangement: service_role only, RLS on with no policies. New
-- columns inherit the table's grants, so nothing new is needed; restated
-- so this file says so on its own. No function is created here, so there
-- is no EXECUTE to revoke.
grant select, insert, update, delete on public.bookings to service_role;
revoke all on public.bookings from public, anon, authenticated;
