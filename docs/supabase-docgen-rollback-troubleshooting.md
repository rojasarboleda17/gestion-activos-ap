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
