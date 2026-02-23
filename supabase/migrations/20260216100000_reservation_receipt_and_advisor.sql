do $$
begin
  if to_regclass('public.reservations') is null then
    raise notice 'Skipping reservations receipt migration: public.reservations does not exist yet';
    return;
  end if;

  alter table public.reservations
    add column if not exists advisor_name text,
    add column if not exists receipt_year integer,
    add column if not exists receipt_sequence integer,
    add column if not exists receipt_generated_at timestamptz;

  create unique index if not exists reservations_org_receipt_unique
    on public.reservations (org_id, receipt_year, receipt_sequence)
    where receipt_year is not null and receipt_sequence is not null;
end
$$;
