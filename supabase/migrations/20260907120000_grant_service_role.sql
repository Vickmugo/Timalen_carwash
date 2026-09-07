-- =====================================================================
-- GRANTS — let the service role actually reach these tables.
-- ---------------------------------------------------------------------
-- A SECOND MIGRATION RATHER THAN AN EDIT to 20260907090000_init_records.sql.
-- That one has already been applied to the project; migrations are
-- forward-only, and editing an applied file means the file no longer
-- describes what is in the database. Run this one the same way.
--
-- ---------------------------------------------------------------------
-- WHAT WENT WRONG, PRECISELY
--
-- After the first migration applied cleanly, every request through
-- PostgREST came back:
--
--     code    42501
--     message permission denied for table health_checks
--
-- 42501 is `insufficient_privilege`. It is a GRANT error — the role has no
-- table-level privilege at all — and it is raised BEFORE row level
-- security is ever consulted. This was measured, not assumed: the same
-- error came back for `service_role` on health_checks (INSERT and SELECT)
-- and on bookings, with PostgREST itself suggesting the fix in its hint.
--
-- THIS IS NOT AN RLS FAILURE, AND THE DIFFERENCE MATTERS.
--
--   RLS denial      the role may touch the table, but no policy admits
--                   the row. A SELECT returns ZERO ROWS; an INSERT raises
--                   42501 with "new row violates row-level security
--                   policy for table ...".
--   GRANT denial    the role may not touch the table at all. Every verb
--                   fails identically, naming the table and nothing else.
--
-- The first migration enabled RLS on everything and wrote no policies,
-- which correctly locks out `anon`. What it did not do is grant anything
-- to `service_role` — and `service_role` bypasses RLS but is still an
-- ordinary Postgres role that needs a GRANT like any other. Bypassing
-- row-level security is not the same as being a superuser.
--
-- Older Supabase projects hid this: they shipped blanket default
-- privileges on `public` for anon, authenticated and service_role, so any
-- table created there was reachable immediately. This project does not
-- have those, which is the safer arrangement and the reason the gap
-- surfaced here rather than in production.
--
-- ---------------------------------------------------------------------
-- WHO GETS WHAT, AND WHY THE LIST IS SHORT
--
--   service_role   SELECT, INSERT, UPDATE, DELETE. This is the key held
--                  only by the server (src/lib/supabase.ts), and it is the
--                  path every migrated feature will use.
--
--   anon           NOTHING. Explicitly revoked below rather than merely
--                  left unmentioned.
--   authenticated  NOTHING, same.
--
-- The revokes are belt and braces: those roles have no privileges here to
-- begin with. They are written down so the intent is auditable in the
-- schema itself, and so that a future change to the project's default
-- privileges cannot quietly hand the browser-side key access to a table of
-- customer phone numbers.
--
-- The result is two independent locks on `anon`: no GRANT, and RLS with no
-- policy. Either alone would be enough. Both is correct for tables holding
-- names, phone numbers and vehicle registrations.
--
-- NO GRANTS ON SEQUENCES. There are none to grant — every primary key in
-- the first migration is `uuid default gen_random_uuid()`, not a serial or
-- an identity column, so no sequence is ever touched on insert.
-- =====================================================================


-- Reaching a table also requires reaching the schema that holds it.
-- Almost certainly already granted; stated explicitly so this migration
-- does not depend on that being true.
grant usage on schema public to service_role;


-- ---------------------------------------------------------------------
-- The service role: full access to the eight tables from the first
-- migration. Named one by one rather than `all tables in schema public`,
-- so that a table added later is a deliberate decision here rather than
-- something that silently inherits access.
-- ---------------------------------------------------------------------

grant select, insert, update, delete on public.health_checks       to service_role;
grant select, insert, update, delete on public.bookings            to service_role;
grant select, insert, update, delete on public.booking_lines       to service_role;
grant select, insert, update, delete on public.orders              to service_role;
grant select, insert, update, delete on public.order_lines         to service_role;
grant select, insert, update, delete on public.quote_requests      to service_role;
grant select, insert, update, delete on public.quote_request_lines to service_role;
grant select, insert, update, delete on public.change_requests     to service_role;
grant select, insert, update, delete on public.status_changes      to service_role;


-- ---------------------------------------------------------------------
-- The browser-side roles: nothing, on the record.
-- ---------------------------------------------------------------------

revoke all on public.health_checks       from anon, authenticated;
revoke all on public.bookings            from anon, authenticated;
revoke all on public.booking_lines       from anon, authenticated;
revoke all on public.orders              from anon, authenticated;
revoke all on public.order_lines         from anon, authenticated;
revoke all on public.quote_requests      from anon, authenticated;
revoke all on public.quote_request_lines from anon, authenticated;
revoke all on public.change_requests     from anon, authenticated;
revoke all on public.status_changes      from anon, authenticated;


-- ---------------------------------------------------------------------
-- FUTURE TABLES, so Stage B does not rediscover this the hard way.
--
-- Applies only to tables created by the role that runs this statement —
-- the same role that runs the migrations — which is exactly the case that
-- matters. A table created by any other route still needs its own grant,
-- deliberately: this sets a default, it does not hand out blanket access.
--
-- Note what is NOT here: no matching default for anon or authenticated.
-- New tables stay unreachable from the browser key until somebody writes
-- the grant and the RLS policy by hand, one table at a time.
-- ---------------------------------------------------------------------

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
