create table if not exists public.identity_document_types (
  code text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_document_types_code_not_blank check (btrim(code) <> ''),
  constraint identity_document_types_label_not_blank check (btrim(label) <> '')
);

alter table public.identity_document_types
  add column if not exists label text,
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'identity_document_types'
      and column_name = 'name'
  ) then
    execute $sql$
      update public.identity_document_types
      set
        label = coalesce(nullif(btrim(label), ''), nullif(btrim(name), ''), upper(code)),
        name = coalesce(nullif(btrim(name), ''), nullif(btrim(label), ''), upper(code))
      where label is null
         or btrim(label) = ''
         or name is null
         or btrim(name) = ''
    $sql$;
  else
    update public.identity_document_types
    set label = coalesce(nullif(btrim(label), ''), upper(code))
    where label is null or btrim(label) = '';
  end if;
end
$$;

alter table public.identity_document_types
  alter column label set not null;

insert into public.identity_document_types (code, label, name)
values
  ('cc', 'Cédula de ciudadanía', 'Cédula de ciudadanía'),
  ('ce', 'Cédula de extranjería', 'Cédula de extranjería'),
  ('nit', 'NIT', 'NIT'),
  ('pas', 'Pasaporte', 'Pasaporte'),
  ('pep', 'PEP', 'PEP')
on conflict (code) do update
set label = excluded.label,
    name = excluded.name,
    updated_at = now();

alter table public.customers
  add column if not exists first_names text,
  add column if not exists last_names text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists identity_document_type_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_identity_document_type_code_fkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_identity_document_type_code_fkey
      foreign key (identity_document_type_code)
      references public.identity_document_types (code)
      on update cascade
      on delete restrict;
  end if;
end
$$;

alter table public.vehicle_files
  add column if not exists sale_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_files_sale_id_fkey'
      and conrelid = 'public.vehicle_files'::regclass
  ) then
    alter table public.vehicle_files
      add constraint vehicle_files_sale_id_fkey
      foreign key (sale_id)
      references public.sales (id)
      on update cascade
      on delete set null;
  end if;
end
$$;

create index if not exists idx_vehicle_files_sale_id
  on public.vehicle_files (sale_id);

create or replace function public.util_split_full_name(p_full_name text)
returns table (
  first_names text,
  last_names text
)
language plpgsql
immutable
as $$
declare
  v_name text;
  v_parts text[];
  v_count integer;
begin
  v_name := regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g');
  v_name := btrim(v_name);

  if v_name = '' then
    first_names := null;
    last_names := null;
    return next;
    return;
  end if;

  v_parts := regexp_split_to_array(v_name, ' ');
  v_count := coalesce(array_length(v_parts, 1), 0);

  if v_count = 1 then
    first_names := v_parts[1];
    last_names := null;
  elsif v_count = 2 then
    first_names := v_parts[1];
    last_names := v_parts[2];
  else
    first_names := array_to_string(v_parts[1:(v_count - 2)], ' ');
    last_names := array_to_string(v_parts[(v_count - 1):v_count], ' ');
  end if;

  return next;
end
$$;

create or replace function public.util_transit_city(p_transit_agency text)
returns text
language sql
immutable
as $$
  select case
    when p_transit_agency is null or btrim(p_transit_agency) = '' then null
    else initcap(lower(btrim(p_transit_agency)))
  end;
$$;

create or replace function public.rpc_get_sale_documents_payload(p_sale_id uuid)
returns jsonb
language sql
stable
as $$
  with sale_data as (
    select
      s.id,
      s.vehicle_id,
      s.customer_id,
      s.created_at,
      c.full_name,
      c.document_id,
      c.phone,
      c.email,
      c.first_names,
      c.last_names,
      c.address,
      public.util_transit_city(c.city) as city,
      c.identity_document_type_code
    from public.sales s
    left join public.customers c on c.id = s.customer_id
    where s.id = p_sale_id
  ),
  docs as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', vf.id,
          'doc_type', vf.doc_type,
          'doc_type_other', vf.doc_type_other,
          'storage_bucket', vf.storage_bucket,
          'storage_path', vf.storage_path,
          'file_name', vf.file_name,
          'expires_at', vf.expires_at,
          'created_at', vf.created_at
        )
        order by vf.created_at desc
      ),
      '[]'::jsonb
    ) as value
    from public.vehicle_files vf
    where vf.sale_id = p_sale_id
  )
  select coalesce(
    (
      select jsonb_build_object(
        'sale', to_jsonb(sd),
        'documents', docs.value
      )
      from sale_data sd
      cross join docs
    ),
    jsonb_build_object('sale', null, 'documents', '[]'::jsonb)
  );
$$;

insert into public.document_types (code, label)
values
  ('contrato_compraventa', 'Contrato de compraventa'),
  ('mandato', 'Mandato'),
  ('traspaso', 'Traspaso'),
  ('otro', 'Otro')
on conflict (code) do update
set label = excluded.label,
    is_active = true,
    updated_at = now();
