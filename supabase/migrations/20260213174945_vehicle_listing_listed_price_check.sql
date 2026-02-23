-- Enforce positive listed price when the vehicle is published
-- Bootstrap-safe: skip constraint updates when public.vehicle_listing does not exist yet.

begin;

DO $vehicle_listing_listed_price_check$
BEGIN
  IF to_regclass('public.vehicle_listing') IS NULL THEN
    RAISE NOTICE 'Skipping vehicle_listing listed price check: public.vehicle_listing does not exist yet';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.vehicle_listing DROP CONSTRAINT IF EXISTS vehicle_listing_listed_price_when_listed_check';

  EXECUTE $sql$
    ALTER TABLE public.vehicle_listing
    ADD CONSTRAINT vehicle_listing_listed_price_when_listed_check
    CHECK (
      NOT is_listed
      OR (
        listed_price_cop IS NOT NULL
        AND listed_price_cop > 0
      )
    )
  $sql$;
END
$vehicle_listing_listed_price_check$;

commit;
