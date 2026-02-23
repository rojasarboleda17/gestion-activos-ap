-- Fix: ensure authenticated users can read their own profile under RLS
-- Context: auth flow fetches public.profiles by auth.uid(); without table SELECT grant
-- PostgREST returns 403 (error 42501) even if SELECT policies exist.
-- Bootstrap-safe: skip table grant when public.profiles does not exist yet.

begin;

-- Minimum privileges required by frontend auth bootstrap
grant usage on schema public to authenticated;

DO $profiles_select_grant_fix$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'Skipping profiles select grant fix: public.profiles does not exist yet';
    RETURN;
  END IF;

  EXECUTE 'grant select on table public.profiles to authenticated';
END
$profiles_select_grant_fix$;

commit;
