-- Fix: ensure authenticated users can read their own profile under RLS
-- Context: auth flow fetches public.profiles by auth.uid(); without table SELECT grant
-- PostgREST returns 403 (error 42501) even if SELECT policies exist.

begin;

-- Minimum privileges required by frontend auth bootstrap
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;

commit;
