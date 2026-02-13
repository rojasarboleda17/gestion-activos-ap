-- Enforce positive listed price when the vehicle is published
ALTER TABLE public.vehicle_listing
DROP CONSTRAINT IF EXISTS vehicle_listing_listed_price_when_listed_check;

ALTER TABLE public.vehicle_listing
ADD CONSTRAINT vehicle_listing_listed_price_when_listed_check
CHECK (
  NOT is_listed
  OR (
    listed_price_cop IS NOT NULL
    AND listed_price_cop > 0
  )
);
