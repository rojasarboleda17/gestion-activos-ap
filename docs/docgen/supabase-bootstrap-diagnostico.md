# Diagnóstico: por qué `supabase start` falla con "relation ... does not exist"

## Hallazgo principal

En este repositorio **no existe una migración base** que cree las tablas de dominio principales
(`vehicles`, `profiles`, `reservations`, `sales`, `vehicle_listing`, etc.).

Las migraciones actuales asumen que esas tablas ya existen, pero en un entorno local limpio
`supabase start`/`supabase db reset` solo aplica lo que está en `supabase/migrations`.

Si la creación original de tablas quedó solo en la base remota (o se hizo fuera de migraciones),
localmente van a aparecer errores en cascada de tipo `relation "public.<tabla>" does not exist`.

## Evidencia rápida en este repo

- Las migraciones contienen referencias a muchas tablas de dominio.
- Pero `CREATE TABLE` solo aparece para catálogos recientes (`document_types`, `identity_document_types`).

Eso confirma desalineación entre:
1) esquema real de tu proyecto remoto,
2) historial de migraciones versionado en git.

## Qué se necesita para solucionarlo de verdad

### Opción recomendada (correcta a largo plazo)

1. **Generar una migración baseline del esquema real** (desde el proyecto fuente de verdad):
   - usando `supabase db pull` sobre el proyecto enlazado correcto.
2. Revisar/limpiar esa baseline para evitar objetos no deseados.
3. Ubicarla cronológicamente **antes** de las migraciones funcionales actuales.
4. En ambiente local, ejecutar reset limpio y validar que no haya faltantes.

> Sin ese baseline, seguir agregando `IF to_regclass(...)` solo evita caídas puntuales,
> pero no reconstruye el esquema completo.

### Opción alternativa (menos ideal)

- Recrear manualmente todas las tablas faltantes en migraciones nuevas.
- Es más propenso a errores y deriva respecto al estado real.

## Runbook sugerido

1. Enlazar el proyecto correcto:

```bash
supabase link --project-ref <project_ref>
```

2. Traer esquema como migración:

```bash
supabase db pull
```

3. Revisar orden de migraciones por timestamp (la baseline debe ir antes de las feature migrations).

4. Probar en limpio:

```bash
supabase db reset
supabase start
```

5. Validar historia aplicada:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

## Nota práctica

Los errores no significan necesariamente que "la tabla no exista" en tu **entorno cloud**;
significan que **no existe en el Postgres local recién inicializado** con el historial actual de migraciones.
