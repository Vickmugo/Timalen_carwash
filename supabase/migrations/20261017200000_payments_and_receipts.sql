-- =====================================================================
-- PAYMENTS AND RECEIPTS — claimed M-Pesa codes, cash at the yard, and
-- gap-free receipt numbers issued by the database.
-- ---------------------------------------------------------------------
-- A SEVENTH MIGRATION. Run it the same way as the others; nothing in the
-- app applies migrations. Run 20261017190000_drainage_channels.sql first
-- (independent, but that is the agreed order), then this, THEN deploy the
-- code: the app now reads `bookings.job_status` and embeds `payments` in
-- every booking and order read, so the code against a database without
-- this file fails on /book, /admin and every confirmation page.
--
-- ADDITIVE ONLY. New tables, new nullable-or-defaulted columns, new
-- functions. Nothing existing is renamed, dropped or rewritten, so the
-- code that is live today keeps working against this schema.
--
-- WHAT IS IN HERE
--   1. bookings.job_status          booked -> in progress -> done, plus
--                                   cancelled / no-show. Separate from
--                                   payment, which is the point of it.
--   2. quote_requests.priced_lines  the carpet request's priced breakdown,
--                                   so a receipt can itemise it.
--   3. payments                     one row per payment attempt.
--   4. receipt_counters, receipts   the two numbered series, W and C.
--   5. the immutability trigger on receipts.
--   6. issue_receipt()              one number, one transaction, once per
--                                   payment.
--   7. resolve_payment()            verify / reject / cash received, and
--                                   the receipt, in the same transaction.
--   8. grants.
--
-- WHAT A PAYMENT ROW IS, AND IS NOT. An M-Pesa code typed by a customer
-- is a CLAIM. It says "I paid, and this is the SMS code". Nothing in this
-- schema checks it against Safaricom; a member of staff does, against the
-- till or paybill statement, and only then moves it to `verified`. The
-- browser can only ever create `claimed` (M-Pesa) or `cash_due` (cash);
-- every other status is set by resolve_payment(), which only the
-- service role can call, which only the staff API routes use.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — JOB STATUS ON BOOKINGS
-- =====================================================================
-- Until now a booking had one status and it was about money
-- (`payment_status`). Whether the car was actually washed was nowhere.
-- The two are different questions with different answers — a car can be
-- washed and not paid for, which is the case the staff view's "Done, not
-- paid" filter exists to find — so they get different columns.
--
-- DEFAULT 'booked' backfills every existing row, which is true of all of
-- them: nothing has ever recorded otherwise.
--
-- 'cancelled' RELEASES THE SLOT. The slot checks in src/lib/bookings-db.ts
-- skip cancelled bookings, so the single bay's time is offered again.
-- 'no_show' does not: by the time somebody is marked a no-show the slot
-- has passed anyway.
alter table public.bookings
  add column if not exists job_status text not null default 'booked';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'bookings_job_status_check'
       and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_job_status_check
      check (job_status in ('booked', 'in_progress', 'done', 'cancelled', 'no_show'));
  end if;
end
$$;


-- =====================================================================
-- SECTION 2 — THE CARPET REQUEST'S PRICED LINES
-- =====================================================================
-- Carpet and sofa-set requests live in `quote_requests` (CP- refs; see
-- src/lib/quote-requests-db.ts) as text: `item` is a sentence per size.
-- That is fine for a phone call and useless for a receipt, which has to
-- itemise name, quantity and price. `quote_request_lines` cannot hold
-- them — it is shaped for a concrete cart line, price NOT NULL and a
-- stock status CHECK — so the breakdown is stored here, as the server
-- priced it when the request arrived:
--
--   [{ "id": "carpet-small", "name": "Small", "quantity": 2, "price_kes": 500 }, ...]
--
-- `price_kes` null on a line nobody has priced (a sofa set, while the
-- board has no figure). '[]' on every row from before this migration;
-- the receipt snapshot falls back to the `item` text for those.
alter table public.quote_requests
  add column if not exists priced_lines jsonb not null default '[]'::jsonb;


-- =====================================================================
-- SECTION 3 — PAYMENTS
-- =====================================================================

create table if not exists public.payments (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',

  -- Which business line the money belongs to, which decides where it may
  -- be paid and which receipt series it lands in:
  --   wash      car wash bookings AND carpet/sofa requests -> till, W-
  --   concrete  product orders                             -> paybill, C-
  stream      text        not null check (stream in ('wash', 'concrete')),

  method      text        not null check (method in ('mpesa', 'cash')),
  -- Null for cash. The numbers themselves are NOT stored here; they are in
  -- src/data/config.ts (`mpesaDestinations`). This records which of the
  -- two the customer was shown and says they paid to.
  destination text        check (destination in ('till', 'paybill')),

  -- EXPECTED amount, computed by the server from the live price book at
  -- the moment the booking/order/request was written. Never sent by the
  -- browser.
  amount_kes  integer     not null check (amount_kes >= 0),

  -- As typed, normalised by the server: trimmed, upper-cased, spaces
  -- removed. The FORMAT check (ten letters and digits) lives in one place,
  -- MPESA_CODE_PATTERN in src/lib/payments.ts, deliberately not here: it is
  -- an assumption about Safaricom's codes, and relaxing an assumption
  -- should be a code change, not a migration. What IS enforced here is the
  -- normalisation, because the unique index below is only meaningful if
  -- "qk12 abc" and "QK12ABC" cannot both be stored.
  mpesa_code  text,

  status      text        not null
    check (status in ('claimed', 'verified', 'rejected', 'cash_due', 'cash_received')),

  -- Exactly one parent; see the CHECK below. Same three-nullable-keys
  -- pattern as `status_changes`, for the same reason: real foreign keys.
  --
  -- ON DELETE CASCADE so the compensating delete in the booking/order
  -- writers (a booking whose lines failed is removed) takes its unreceipted
  -- payment with it. A payment that HAS a receipt cannot be removed: the
  -- receipt's own key is ON DELETE RESTRICT and the receipt cannot be
  -- deleted at all. So a receipted booking cannot be deleted either, which
  -- is correct.
  booking_id       uuid references public.bookings (id)       on delete cascade,
  order_id         uuid references public.orders (id)         on delete cascade,
  quote_request_id uuid references public.quote_requests (id) on delete cascade,

  claimed_at  timestamptz not null default now(),
  resolved_at timestamptz,
  -- The "Acting as" name from the staff view. SELF-REPORTED AND
  -- UNVERIFIED, exactly like `status_changes.changed_by`: the staff
  -- session proves somebody knew the shared password, not who they were.
  -- See src/data/admin-users.ts.
  resolved_by text,
  reject_reason text,
  -- What was actually handed over or seen on the statement. Defaults to
  -- the expected amount when staff confirm; may differ for cash, in which
  -- case the receipt snapshot flags it.
  amount_received_kes integer check (amount_received_kes >= 0),

  constraint payments_one_parent check (
    (booking_id       is not null)::int +
    (order_id         is not null)::int +
    (quote_request_id is not null)::int = 1
  ),

  -- Concrete is an order; wash is a booking or a carpet request.
  constraint payments_stream_parent check (
    (stream = 'concrete') = (order_id is not null)
  ),

  -- The two shapes a payment can take, with the statuses each may hold.
  constraint payments_method_shape check (
    (method = 'mpesa'
      and destination is not null
      and mpesa_code is not null
      and mpesa_code = upper(mpesa_code)
      and mpesa_code !~ '\s'
      and length(mpesa_code) > 0
      and status in ('claimed', 'verified', 'rejected'))
    or
    (method = 'cash'
      and destination is null
      and mpesa_code is null
      and status in ('cash_due', 'cash_received'))
  ),

  -- Wash money goes to the till, concrete money to the paybill. Enforced
  -- here AND in the route (which gives the customer a sentence instead of
  -- a constraint name).
  constraint payments_stream_destination check (
    method = 'cash'
    or (stream = 'wash'     and destination = 'till')
    or (stream = 'concrete' and destination = 'paybill')
  ),

  -- Open statuses have no resolution; closed ones always say who and when.
  constraint payments_resolution_shape check (
    (status in ('claimed', 'cash_due')
      and resolved_at is null and resolved_by is null)
    or
    (status in ('verified', 'rejected', 'cash_received')
      and resolved_at is not null and resolved_by is not null)
  ),

  constraint payments_reject_reason check (
    status <> 'rejected' or length(btrim(coalesce(reject_reason, ''))) > 0
  )
);

alter table public.payments enable row level security;

-- ONE CODE, ONE PAYMENT, EVER. Across every stream and every status,
-- rejected included: a code that has been typed once cannot back a second
-- booking. Partial, because cash rows have no code and NULLs would be
-- skipped by a unique index anyway; written out so the intent is plain.
create unique index if not exists payments_mpesa_code_unique
  on public.payments (mpesa_code)
  where mpesa_code is not null;

-- The two staff queues: claimed codes oldest first, cash due.
create index if not exists payments_open_idx
  on public.payments (business_id, status, claimed_at);

create index if not exists payments_booking_idx
  on public.payments (booking_id) where booking_id is not null;
create index if not exists payments_order_idx
  on public.payments (order_id) where order_id is not null;
create index if not exists payments_quote_request_idx
  on public.payments (quote_request_id) where quote_request_id is not null;


-- =====================================================================
-- SECTION 4 — RECEIPT COUNTERS AND RECEIPTS
-- =====================================================================
-- TWO SERIES, MATCHING WHERE THE MONEY LANDS, so each reconciles against
-- its own statement:
--   W   wash and carpets/sofa: the till, plus cash paid at the bay
--   C   concrete: the paybill, plus cash paid at collection
--
-- GAP-FREE, AND THAT RULES OUT A SEQUENCE. A Postgres sequence hands out
-- a number the moment it is asked and never takes it back, so a rolled-
-- back insert leaves a hole. Here the number is a counter row incremented
-- with UPDATE ... RETURNING inside the same transaction as the receipt
-- insert: roll one back and the other goes with it. The row lock the
-- UPDATE takes also serialises two simultaneous issues in one series, so
-- they get consecutive numbers rather than the same one.
create table if not exists public.receipt_counters (
  business_id text    not null default 'timalen',
  series      text    not null check (series in ('W', 'C')),
  last_seq    integer not null default 0 check (last_seq >= 0),
  primary key (business_id, series)
);

alter table public.receipt_counters enable row level security;

insert into public.receipt_counters (business_id, series, last_seq)
values ('timalen', 'W', 0), ('timalen', 'C', 0)
on conflict (business_id, series) do nothing;


create table if not exists public.receipts (
  id          uuid        primary key default gen_random_uuid(),
  business_id text        not null default 'timalen',

  series      text        not null check (series in ('W', 'C')),
  -- Six digits on paper, so the series tops out at 999999. The CHECK
  -- stops a seventh digit being silently truncated by lpad() below into a
  -- number that already exists.
  seq         integer     not null check (seq between 1 and 999999),
  -- "W-000001". Derived from the two columns above and checked against
  -- them, so the printed number can never disagree with the counter.
  number      text        not null unique,

  -- Nullable so a walk-in receipt (no online payment behind it) can be
  -- added later without a schema change. Unique when set: see the index.
  -- RESTRICT: a payment that has been receipted stays.
  payment_id  uuid        references public.payments (id) on delete restrict,

  issued_at   timestamptz not null default now(),
  -- Self-reported "Acting as" name, like everywhere else.
  issued_by   text        not null,

  amount_kes  integer     not null check (amount_kes >= 0),
  method      text        not null check (method in ('mpesa', 'cash')),
  mpesa_code  text,

  -- EVERYTHING THE PAPER SAYS, AS IT STOOD AT ISSUE: customer, reference,
  -- line items with names, variants, quantities and prices. A receipt is
  -- rendered from this and nothing else, so a later price change, a
  -- renamed service or an edited booking never alters an old receipt.
  snapshot    jsonb       not null,

  -- A void is a status change with a reason. The number stays used and is
  -- never reissued.
  status      text        not null default 'issued' check (status in ('issued', 'void')),
  voided_at   timestamptz,
  voided_by   text,
  void_reason text,

  constraint receipts_series_seq_unique unique (business_id, series, seq),

  constraint receipts_number_shape check (
    number = series || '-' || lpad(seq::text, 6, '0')
  ),

  constraint receipts_void_shape check (
    (status = 'issued'
      and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'void'
      and voided_at is not null and voided_by is not null
      and length(btrim(coalesce(void_reason, ''))) > 0)
  )
);

alter table public.receipts enable row level security;

create unique index if not exists receipts_payment_unique
  on public.receipts (payment_id)
  where payment_id is not null;

-- The ledger reads newest first.
create index if not exists receipts_recent_idx
  on public.receipts (business_id, issued_at desc);


-- =====================================================================
-- SECTION 5 — RECEIPTS ARE PERMANENT
-- =====================================================================
-- Rejects any change to what a receipt SAYS, and rejects DELETE outright.
-- The only permitted change is issued -> void, with who, when and why.
--
-- Not a substitute for discipline, a backstop to it: the service role can
-- still drop this trigger. What it stops is the ordinary mistake — an
-- UPDATE with the wrong WHERE, a "tidy-up" DELETE — which is the one that
-- actually happens.
--
-- TRUNCATE IS NOT BLOCKED, on purpose. It does not fire row triggers, and
-- it is the documented one-time reset if test receipts are ever issued
-- before go-live (`truncate receipts; update receipt_counters set
-- last_seq = 0;`). After go-live, never.
create or replace function public.receipts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Receipt % cannot be deleted. Void it instead.', old.number
      using errcode = 'P0001';
  end if;

  if new.number      is distinct from old.number
  or new.series      is distinct from old.series
  or new.seq         is distinct from old.seq
  or new.payment_id  is distinct from old.payment_id
  or new.amount_kes  is distinct from old.amount_kes
  or new.snapshot    is distinct from old.snapshot
  or new.business_id is distinct from old.business_id
  or new.issued_at   is distinct from old.issued_at
  or new.issued_by   is distinct from old.issued_by
  or new.method      is distinct from old.method
  or new.mpesa_code  is distinct from old.mpesa_code
  then
    raise exception 'Receipt % cannot be changed. Only its status may move to void.', old.number
      using errcode = 'P0001';
  end if;

  -- A void stays void, with the reason it was given.
  if old.status = 'void' and (
       new.status      is distinct from old.status
    or new.voided_at   is distinct from old.voided_at
    or new.voided_by   is distinct from old.voided_by
    or new.void_reason is distinct from old.void_reason
  ) then
    raise exception 'Receipt % is void and stays void.', old.number
      using errcode = 'P0001';
  end if;

  return new;
end
$$;

drop trigger if exists receipts_immutable on public.receipts;
create trigger receipts_immutable
  before update or delete on public.receipts
  for each row execute function public.receipts_guard();


-- =====================================================================
-- SECTION 6 — issue_receipt(payment_id, issued_by)
-- =====================================================================
-- ONE TRANSACTION: lock the payment, return its receipt if it already has
-- one, otherwise take the next number in its series and write the receipt.
-- Called over RPC, a function body is a single transaction, so an error
-- anywhere — the snapshot, the insert, a constraint — rolls back the
-- counter increment too, and no number is consumed.
--
-- IDEMPOTENT. A second call for the same payment returns the first
-- receipt. The `for update` on the payment row is what makes that hold
-- under concurrency: two calls for one payment queue on that lock, and the
-- second one finds the receipt the first one wrote.
--
-- Refuses a payment that is not `verified` or `cash_received`: a receipt
-- is issued when money has been confirmed, never at checkout.

-- The snapshot, built from the payment's parent record as it stands now.
create or replace function public.receipt_snapshot(p_payment public.payments)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_parent jsonb;
  v_expected integer := p_payment.amount_kes;
  v_received integer := coalesce(p_payment.amount_received_kes, p_payment.amount_kes);
begin
  if p_payment.booking_id is not null then
    select jsonb_build_object(
             'kind',          'booking',
             'ref',           b.ref,
             'customer_name', b.customer_name,
             'phone',         b.phone,
             'vehicle',       b.vehicle,
             'priced_as',     b.vehicle_type_name,
             'date',          b.booking_date,
             'start_time',    to_char(b.start_time, 'HH24:MI'),
             'end_time',      to_char(b.end_time, 'HH24:MI'),
             'lines', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'name', l.name, 'variant', null, 'unit', null,
                        'quantity', 1, 'price_kes', l.price_kes)
                      order by l.position)
                 from booking_lines l where l.booking_id = b.id
             ), '[]'::jsonb)
           )
      into v_parent
      from bookings b where b.id = p_payment.booking_id;

  elsif p_payment.order_id is not null then
    select jsonb_build_object(
             'kind',          'order',
             'ref',           o.ref,
             'customer_name', o.customer_name,
             'phone',         o.phone,
             'collection',    o.delivery_location,
             'lines', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'name', l.name,
                        'variant', nullif(l.variant_label, ''),
                        'unit', l.unit_label,
                        'quantity', l.quantity, 'price_kes', l.price_kes)
                      order by l.position)
                 from order_lines l where l.order_id = o.id
             ), '[]'::jsonb)
           )
      into v_parent
      from orders o where o.id = p_payment.order_id;

  else
    select jsonb_build_object(
             'kind',          'carpet',
             'ref',           q.ref,
             'customer_name', q.customer_name,
             'phone',         q.phone,
             -- The stored sentence, for requests made before priced_lines
             -- existed; the receipt prints it when `lines` is empty.
             'item_text',     q.item,
             'lines', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'name', e->>'name', 'variant', null, 'unit', 'per piece',
                        'quantity', (e->>'quantity')::int,
                        'price_kes', (e->>'price_kes')::int)
                      order by ord)
                 from jsonb_array_elements(q.priced_lines) with ordinality as t(e, ord)
             ), '[]'::jsonb)
           )
      into v_parent
      from quote_requests q where q.id = p_payment.quote_request_id;
  end if;

  if v_parent is null then
    raise exception 'Payment % has no parent record to receipt.', p_payment.id
      using errcode = 'P0001';
  end if;

  return v_parent || jsonb_build_object(
    'stream',         p_payment.stream,
    'method',         p_payment.method,
    'destination',    p_payment.destination,
    'mpesa_code',     p_payment.mpesa_code,
    'expected_kes',   v_expected,
    'received_kes',   v_received,
    -- A different amount is allowed (cash counted at the counter) but it
    -- is said on the paper, not smoothed over.
    'amount_differs', v_received <> v_expected,
    'claimed_at',     p_payment.claimed_at,
    'confirmed_at',   p_payment.resolved_at,
    'confirmed_by',   p_payment.resolved_by
  );
end
$$;


create or replace function public.issue_receipt(p_payment_id uuid, p_issued_by text)
returns public.receipts
language plpgsql
set search_path = public
as $$
declare
  v_payment public.payments;
  v_receipt public.receipts;
  v_series  text;
  v_seq     integer;
begin
  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment % does not exist.', p_payment_id using errcode = 'P0002';
  end if;

  -- Idempotent: one receipt per payment, ever.
  select * into v_receipt from receipts where payment_id = p_payment_id;
  if found then
    return v_receipt;
  end if;

  if v_payment.status not in ('verified', 'cash_received') then
    raise exception 'Payment % is %; a receipt is only issued once it is verified or the cash is received.',
      p_payment_id, v_payment.status using errcode = 'P0001';
  end if;

  v_series := case v_payment.stream when 'concrete' then 'C' else 'W' end;

  insert into receipt_counters (business_id, series, last_seq)
  values (v_payment.business_id, v_series, 0)
  on conflict (business_id, series) do nothing;

  update receipt_counters
     set last_seq = last_seq + 1
   where business_id = v_payment.business_id and series = v_series
  returning last_seq into v_seq;

  insert into receipts (
    business_id, series, seq, number, payment_id, issued_by,
    amount_kes, method, mpesa_code, snapshot
  ) values (
    v_payment.business_id, v_series, v_seq,
    v_series || '-' || lpad(v_seq::text, 6, '0'),
    v_payment.id,
    coalesce(nullif(btrim(p_issued_by), ''), 'unattributed'),
    coalesce(v_payment.amount_received_kes, v_payment.amount_kes),
    v_payment.method,
    v_payment.mpesa_code,
    receipt_snapshot(v_payment)
  )
  returning * into v_receipt;

  return v_receipt;
end
$$;


-- =====================================================================
-- SECTION 7 — resolve_payment(): the only way a status moves
-- =====================================================================
--   verify         claimed  -> verified, receipt issued
--   reject         claimed  -> rejected, reason required, no receipt
--   cash_received  cash_due -> cash_received, receipt issued
--
-- All in one transaction with the parent's `payment_status` mirror and a
-- `status_changes` row, so a payment can never be verified without its
-- receipt, or receipted without its audit line. Returns the receipt, or
-- null for a rejection.
--
-- `p_by` is the self-reported "Acting as" name.
create or replace function public.resolve_payment(
  p_payment_id      uuid,
  p_action          text,
  p_by              text,
  p_reason          text    default null,
  p_amount_received integer default null
)
returns public.receipts
language plpgsql
set search_path = public
as $$
declare
  v_payment public.payments;
  v_by      text := coalesce(nullif(btrim(p_by), ''), 'unattributed');
  v_to      text;
  v_mirror  text;
begin
  select * into v_payment from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment % does not exist.', p_payment_id using errcode = 'P0002';
  end if;

  if p_action = 'verify' then
    if v_payment.status <> 'claimed' then
      raise exception 'Payment % is %, not claimed.', p_payment_id, v_payment.status
        using errcode = 'P0001';
    end if;
    update payments
       set status = 'verified', resolved_at = now(), resolved_by = v_by,
           amount_received_kes = amount_kes
     where id = p_payment_id;
    v_to := 'payment_verified';
    v_mirror := 'paid';

  elsif p_action = 'reject' then
    if v_payment.status <> 'claimed' then
      raise exception 'Payment % is %, not claimed.', p_payment_id, v_payment.status
        using errcode = 'P0001';
    end if;
    if length(btrim(coalesce(p_reason, ''))) = 0 then
      raise exception 'A reason is required to reject a payment.' using errcode = 'P0001';
    end if;
    update payments
       set status = 'rejected', resolved_at = now(), resolved_by = v_by,
           reject_reason = btrim(p_reason)
     where id = p_payment_id;
    v_to := 'payment_rejected';
    v_mirror := 'unpaid';

  elsif p_action = 'cash_received' then
    if v_payment.status <> 'cash_due' then
      raise exception 'Payment % is %, not cash due.', p_payment_id, v_payment.status
        using errcode = 'P0001';
    end if;
    if p_amount_received is not null and p_amount_received < 0 then
      raise exception 'The amount received cannot be negative.' using errcode = 'P0001';
    end if;
    update payments
       set status = 'cash_received', resolved_at = now(), resolved_by = v_by,
           amount_received_kes = coalesce(p_amount_received, amount_kes)
     where id = p_payment_id;
    v_to := 'cash_received';
    v_mirror := 'paid';

  else
    raise exception 'Unknown action %.', p_action using errcode = 'P0001';
  end if;

  -- The parent's own payment_status column predates this table and the
  -- staff list and old pages still read it. Kept in step here so the two
  -- cannot disagree. Carpet requests have no such column.
  if v_payment.booking_id is not null then
    update bookings set payment_status = v_mirror where id = v_payment.booking_id;
  elsif v_payment.order_id is not null then
    update orders set payment_status = v_mirror where id = v_payment.order_id;
  end if;

  insert into status_changes (booking_id, order_id, quote_request_id, to_status, changed_by)
  values (v_payment.booking_id, v_payment.order_id, v_payment.quote_request_id, v_to, v_by);

  if p_action = 'reject' then
    return null;
  end if;
  return issue_receipt(p_payment_id, v_by);
end
$$;


-- =====================================================================
-- SECTION 8 — GRANTS
-- =====================================================================
-- Same arrangement as every other table: service_role only, RLS on with
-- no policies, the browser-side roles explicitly shut out.

grant select, insert, update, delete on public.payments         to service_role;
grant select, insert, update, delete on public.receipt_counters to service_role;
grant select, insert, update, delete on public.receipts         to service_role;

revoke all on public.payments         from anon, authenticated;
revoke all on public.receipt_counters from anon, authenticated;
revoke all on public.receipts         from anon, authenticated;

-- FUNCTIONS. Postgres grants EXECUTE to PUBLIC on every new function, and
-- Supabase's default privileges add anon and authenticated on top. All
-- three are revoked by name; only the service role may issue a number or
-- move a payment.
revoke all on function public.issue_receipt(uuid, text)
  from public, anon, authenticated;
revoke all on function public.resolve_payment(uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.receipt_snapshot(public.payments)
  from public, anon, authenticated;
revoke all on function public.receipts_guard()
  from public, anon, authenticated;

grant execute on function public.issue_receipt(uuid, text)                         to service_role;
grant execute on function public.resolve_payment(uuid, text, text, text, integer)  to service_role;
grant execute on function public.receipt_snapshot(public.payments)                 to service_role;
