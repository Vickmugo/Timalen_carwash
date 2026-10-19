-- =====================================================================
-- RATE LIMITS, AND A FAIRER M-PESA CODE INDEX.
-- ---------------------------------------------------------------------
-- AN EIGHTH MIGRATION. Run it in the Supabase SQL editor like the others;
-- nothing in the app applies migrations.
--
-- ORDER RELATIVE TO THE DEPLOY: either way round is safe.
--   - Code first, this later: the limiter's RPC does not exist yet, so
--     every limit FAILS OPEN and logs "[rate-limit] FAILING OPEN". Nothing
--     breaks; nothing is limited either.
--   - This first, code later: the old code never calls the function, and
--     the narrower index only allows more than before.
--
-- WHAT IS IN HERE
--   1. rate_limits + hit_rate_limit()  a fixed-window counter keyed by a
--                                      SHA-256 the app computes, so no raw
--                                      IP address or phone number is stored.
--   2. payments_mpesa_code_unique      recreated so a REJECTED claim no
--                                      longer blocks the code forever.
--   3. grants.
--
-- ADDITIVE apart from the index swap, which only loosens a constraint.
-- Every other constraint on `payments` is unchanged.
-- =====================================================================


-- =====================================================================
-- SECTION 1 — RATE LIMITS
-- =====================================================================
-- One row per (key, window). `key` is hex SHA-256 of "<bucket>:<client ip>"
-- computed in src/lib/rate-limit.ts. A fixed window is coarse — a burst
-- straddling the boundary can see up to twice the limit — which is fine
-- for stopping floods, the only job these limits have.

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0 check (count >= 0),
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Lets the opportunistic cleanup below find old windows without a scan.
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);


-- hit_rate_limit(key, limit, window_seconds, cost)
--
--   cost 1 (default)  count one hit, then answer whether it was within the
--                     limit. Used for public writes and lookups.
--   cost 0            count nothing; answer whether ONE MORE hit would be
--                     allowed. Used by /api/login before it checks the
--                     password, so that only FAILED attempts are counted.
--
-- Returns one row: allowed, hits (the count in this window, after this
-- call), retry_after_seconds (until the window rolls over).
--
-- The increment is a single INSERT ... ON CONFLICT DO UPDATE, so two
-- concurrent hits on the same key serialise on the row and both count.
--
-- Roughly one call in fifty also deletes windows older than a day. No
-- limit in the app uses a window longer than fifteen minutes, so nothing
-- live is ever removed, and the table stays small without a cron job.
create or replace function public.hit_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer,
  p_cost           integer default 1
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 128
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400
     or p_cost is null or p_cost not in (0, 1) then
    raise exception 'hit_rate_limit: invalid arguments' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  if p_cost = 0 then
    select rl.count into v_count
      from rate_limits rl
     where rl.key = p_key and rl.window_start = v_window_start;
    v_count := coalesce(v_count, 0);
    allowed := v_count < p_limit;
  else
    insert into rate_limits as rl (key, window_start, count)
    values (p_key, v_window_start, 1)
    on conflict (key, window_start) do update set count = rl.count + 1
    returning rl.count into v_count;
    allowed := v_count <= p_limit;
  end if;

  hits := v_count;
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (
      v_window_start + make_interval(secs => p_window_seconds) - now()
    )))::integer
  );

  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return next;
end
$$;


-- =====================================================================
-- SECTION 2 — THE M-PESA CODE INDEX
-- =====================================================================
-- Was: one code, one payment, ever, rejected included. That let a squatter
-- who saw a customer's SMS submit the code first; once staff rejected the
-- squatter's claim, the real customer still could not use their own code.
--
-- Now: one code per LIVE payment. A claim that is claimed, verified, cash
-- or anything else still holds its code exclusively; a rejected one lets
-- go of it. Two live claims on the same code are still refused.
--
-- Same name, so anything that recognises the unique violation by it (the
-- app maps SQLSTATE 23505 to "code already used") keeps working. Dropped
-- and created in one transaction when run as a single script in the SQL
-- editor, so there is no moment without the index.

drop index if exists public.payments_mpesa_code_unique;

create unique index payments_mpesa_code_unique
  on public.payments (mpesa_code)
  where mpesa_code is not null and status <> 'rejected';


-- =====================================================================
-- SECTION 3 — GRANTS
-- =====================================================================
-- Same arrangement as every other table: RLS on with no policies, service
-- role only, the browser-side roles and PUBLIC explicitly shut out.

revoke all on public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

revoke all on function public.hit_rate_limit(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer, integer)
  to service_role;
