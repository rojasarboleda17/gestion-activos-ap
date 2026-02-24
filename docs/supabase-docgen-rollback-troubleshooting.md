# Supabase rollback docgen: troubleshooting rápido

Este documento cubre errores comunes al revertir cambios remotos de docgen.

## Error en 4.3: `relation "cron.job" does not exist`

Si el query:

```sql
select jobid, jobname, schedule, command
from cron.job
where command ilike '%docgen%'
   or command ilike '%sale_documents%'
   or command ilike '%rpc_get_sale_documents_payload%';
```

falla con `42P01`, significa que en ese proyecto no existe el esquema `cron` (normalmente porque `pg_cron` no está habilitado).

### Paso 1: validar si `pg_cron` existe

```sql
select extname, extversion
from pg_extension
where extname = 'pg_cron';
```

- Si devuelve **0 filas**: no hay jobs de `pg_cron` para borrar y puedes continuar con el siguiente bloque del rollback.
- Si devuelve una fila: continúa con el Paso 2.

### Paso 2: auditar jobs solo si existe `pg_cron`

```sql
select jobid, jobname, schedule, command
from cron.job
where command ilike '%docgen%'
   or command ilike '%sale_documents%'
   or command ilike '%rpc_get_sale_documents_payload%';
```

### Paso 3: eliminar jobs (si aparecen filas)

```sql
select cron.unschedule(jobid)
from cron.job
where command ilike '%docgen%'
   or command ilike '%sale_documents%'
   or command ilike '%rpc_get_sale_documents_payload%';
```

## Query defensivo (opcional, una sola ejecución)

Si quieres evitar el error `42P01` directamente, usa este bloque:

```sql
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron habilitado: auditando jobs';
  else
    raise notice 'pg_cron no habilitado: no hay cron.job que revisar';
  end if;
end $$;
```

> Nota: este bloque no borra nada; solo confirma si debes ejecutar consultas sobre `cron.job`.

## Versión copiar/pegar (recomendada)

### A) Solo auditoría segura (no borra)

```sql
do $$
declare
  v_count int := 0;
  r record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no habilitado en este proyecto; no hay cron.job que auditar';
    return;
  end if;

  for r in
    select jobid, coalesce(jobname,'') as jobname, schedule, command
    from cron.job
    where command ilike '%docgen%'
       or command ilike '%sale_documents%'
       or command ilike '%rpc_get_sale_documents_payload%'
    order by jobid
  loop
    v_count := v_count + 1;
    raise notice 'job encontrado -> id: %, nombre: %, schedule: %, command: %', r.jobid, r.jobname, r.schedule, r.command;
  end loop;

  if v_count = 0 then
    raise notice 'sin jobs relacionados';
  else
    raise notice 'total jobs relacionados: %', v_count;
  end if;
end $$;
```

### B) Borrado seguro (unschedule) con guardas

```sql
do $$
declare
  r record;
  v_count int := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no habilitado; no hay jobs que eliminar';
    return;
  end if;

  for r in
    select jobid
    from cron.job
    where command ilike '%docgen%'
       or command ilike '%sale_documents%'
       or command ilike '%rpc_get_sale_documents_payload%'
  loop
    perform cron.unschedule(r.jobid);
    v_count := v_count + 1;
    raise notice 'job eliminado -> id: %', r.jobid;
  end loop;

  if v_count = 0 then
    raise notice 'no había jobs para eliminar';
  else
    raise notice 'total jobs eliminados: %', v_count;
  end if;
end $$;
```

### C) Verificación final

```sql
do $$
declare
  v_count int := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron no habilitado; verificación no aplica';
    return;
  end if;

  select count(*)
    into v_count
  from cron.job
  where command ilike '%docgen%'
     or command ilike '%sale_documents%'
     or command ilike '%rpc_get_sale_documents_payload%';

  raise notice 'jobs restantes: %', v_count;
end $$;
```


## 5) Verificación final (todo limpio): output esperado

Para cerrar el rollback, estos son los resultados esperados por consulta:

```sql
-- funciones
select proname
from pg_proc
where proname in ('rpc_get_sale_documents_payload','util_split_full_name','util_transit_city');
```

**Esperado:** `0 rows` (sin filas).

```sql
-- tabla catálogo
select to_regclass('public.identity_document_types');
```

**Esperado:** `NULL`.

```sql
-- vista dependiente (si la creaste en algún punto)
select to_regclass('public.v_sale_documents_payload');
```

**Esperado:** `NULL`.

```sql
-- columnas en customers
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='customers'
  and column_name in ('first_names','last_names','address','city','identity_document_type_code');
```

**Esperado:** `0 rows`.

```sql
-- columna en vehicle_files
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='vehicle_files'
  and column_name='sale_id';
```

**Esperado:** `0 rows`.

```sql
-- índice
select indexname
from pg_indexes
where schemaname='public'
  and indexname='idx_vehicle_files_sale_id';
```

**Esperado:** `0 rows`.

```sql
-- constraints
select conname
from pg_constraint
where conname in ('vehicle_files_sale_id_fkey','customers_identity_document_type_code_fkey');
```

**Esperado:** `0 rows`.

```sql
-- storage docgen
select count(*) as objetos_restantes
from storage.objects
where bucket_id='vehicle-internal'
  and name like '%/sales/%/documents/%';
```

**Esperado:** una sola fila con `objetos_restantes = 0`.

```sql
-- tipos documentales docgen
select count(*) as document_types_restantes
from public.document_types
where code in ('contrato_compraventa','mandato','traspaso','otro');
```

**Esperado:** una sola fila con `document_types_restantes = 0`.

```sql
-- metadatos en vehicle_files
select count(*) as vehicle_files_restantes
from public.vehicle_files
where doc_type in ('contrato_compraventa','mandato','traspaso','otro');
```

**Esperado:** una sola fila con `vehicle_files_restantes = 0`.

> Si alguno devuelve filas/no nulo/contador > 0, todavía queda un residuo de docgen por revertir.

> En SQL Editor de Supabase, **"Success. No rows returned"** equivale a **`0 rows`**, que para estas consultas de existencia/eliminación es el resultado esperado.


## 6) Si te devuelve 1+ filas en verificaciones (qué ejecutar)

Si una verificación devuelve filas (o `to_regclass` no es `NULL`), todavía existe residuo en la base remota. Ejecuta en este orden:

```sql
begin;

-- 1) vista dependiente (si existe)
drop view if exists public.v_sale_documents_payload;
drop materialized view if exists public.v_sale_documents_payload;

-- 2) funciones
drop function if exists public.rpc_get_sale_documents_payload(uuid);
drop function if exists public.util_split_full_name(text);
drop function if exists public.util_transit_city(text);

-- 3) vehicle_files: índice/FK/columna sale_id
drop index if exists public.idx_vehicle_files_sale_id;
alter table if exists public.vehicle_files
  drop constraint if exists vehicle_files_sale_id_fkey;
alter table if exists public.vehicle_files
  drop column if exists sale_id;

-- 4) customers: FK + columnas docgen
alter table if exists public.customers
  drop constraint if exists customers_identity_document_type_code_fkey;
alter table if exists public.customers
  drop column if exists identity_document_type_code,
  drop column if exists city,
  drop column if exists address,
  drop column if exists last_names,
  drop column if exists first_names;

-- 5) catálogo identity_document_types
drop table if exists public.identity_document_types;

-- 6) referencias de doc_type antes de borrar catálogo document_types
delete from public.vehicle_files
where doc_type in ('contrato_compraventa','mandato','traspaso','otro');

delete from public.document_types
where code in ('contrato_compraventa','mandato','traspaso','otro');

commit;
```

Luego vuelve a correr la sección **5) Verificación final**; el objetivo es:
- consultas de objetos/columnas/índices/constraints: **0 rows**
- `to_regclass(...)`: **NULL**
- contadores: **0**

> Nota: si alguna sentencia falla por dependencias, comparte el error exacto y se ajusta con `DROP ... CASCADE` solo donde sea necesario.
