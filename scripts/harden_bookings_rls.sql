-- Production-safe, idempotent correction for databases originally created
-- from 001_create_bookings_table.sql. The application performs booking reads
-- and writes through createAdminClient() on the server, so the service role
-- continues to work while direct browser/PostgREST access is denied.
begin;

alter table public.bookings enable row level security;

drop policy if exists "Allow public to create bookings" on public.bookings;
drop policy if exists "Allow reading all bookings" on public.bookings;
drop policy if exists "Allow updating bookings" on public.bookings;

revoke all on table public.bookings from anon, authenticated;

commit;
