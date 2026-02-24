create table if not exists public.document_types (
  code text primary key,
  label text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_types_code_not_blank check (btrim(code) <> ''),
  constraint document_types_label_not_blank check (btrim(label) <> '')
);


insert into public.document_types (code, label, sort_order)
values
  ('soat', 'SOAT', 10),
  ('tecnomecanica', 'Tecnomecánica', 20),
  ('rtm', 'RTM', 30),
  ('factura', 'Factura', 40),
  ('traspaso', 'Traspaso', 50),
  ('tarjeta_propiedad', 'Tarjeta de propiedad', 60),
  ('contrato', 'Contrato', 70),
  ('revision', 'Revisión', 80),
  ('otro', 'Otro', 999)
on conflict (code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.vehicle_files
  add column if not exists doc_type_other text;

update public.vehicle_files
set
  doc_type = case
    when doc_type is null or btrim(doc_type) = '' then null
    when lower(btrim(doc_type)) in ('soat') then 'soat'
    when lower(btrim(doc_type)) in ('tecnomecanica', 'tecnomecánica', 'tecno') then 'tecnomecanica'
    when lower(btrim(doc_type)) in ('rtm', 'revision tecnico mecanica', 'revisión técnico mecánica') then 'rtm'
    when lower(btrim(doc_type)) in ('factura') then 'factura'
    when lower(btrim(doc_type)) in ('traspaso') then 'traspaso'
    when lower(btrim(doc_type)) in ('tarjeta_propiedad', 'tarjeta propiedad', 'tarjeta de propiedad') then 'tarjeta_propiedad'
    when lower(btrim(doc_type)) in ('contrato') then 'contrato'
    when lower(btrim(doc_type)) in ('revision', 'revisión') then 'revision'
    when lower(btrim(doc_type)) = 'otro' then 'otro'
    else 'otro'
  end,
  doc_type_other = case
    when doc_type is null or btrim(doc_type) = '' then null
    when lower(btrim(doc_type)) in (
      'soat',
      'tecnomecanica',
      'tecnomecánica',
      'tecno',
      'rtm',
      'revision tecnico mecanica',
      'revisión técnico mecánica',
      'factura',
      'traspaso',
      'tarjeta_propiedad',
      'tarjeta propiedad',
      'tarjeta de propiedad',
      'contrato',
      'revision',
      'revisión',
      'otro'
    ) then null
    else btrim(doc_type)
  end;

alter table public.vehicle_files
  drop constraint if exists vehicle_files_doc_type_fkey;

alter table public.vehicle_files
  add constraint vehicle_files_doc_type_fkey
  foreign key (doc_type)
  references public.document_types (code)
  on update cascade
  on delete restrict;

alter table public.vehicle_files
  drop constraint if exists vehicle_files_doc_type_other_check;

alter table public.vehicle_files
  add constraint vehicle_files_doc_type_other_check
  check (
    (doc_type is null and doc_type_other is null)
    or (doc_type = 'otro' and doc_type_other is not null and btrim(doc_type_other) <> '')
    or (doc_type <> 'otro' and doc_type_other is null)
  );

alter table public.document_types enable row level security;

drop policy if exists "Authenticated users can read document types" on public.document_types;
create policy "Authenticated users can read document types"
on public.document_types
for select
to authenticated
using (true);
