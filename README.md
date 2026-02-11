# Asset Vault (MVP)

Asset Vault es un MVP para la gestión interna de activos (vehículos y motos) de un concesionario de usados. Centraliza inventario, alistamientos, costos/gastos, documentación y trazabilidad operativa, con control de acceso por roles y seguridad a nivel de base de datos (RLS).

## Alcance del MVP

### Módulos activos (Admin)
- **Inventario**: registro y administración de vehículos, estados y detalle por activo.
- **Operaciones**: catálogo de operaciones y **órdenes de trabajo** (alistamiento y tareas), con seguimiento.
- **Ventas**: reservas, ventas, pagos y documentos del negocio.
- **Archivos**: carga y consulta de documentos/fotos asociados a vehículos y negocios.
- **Usuarios**: administración de perfiles internos.
- **Sedes**: gestión de sedes y asignación.
- **Auditoría**: registro de eventos críticos para trazabilidad.

### Decisión definitiva sobre módulos fuera de alcance
- **Dashboard**: eliminado del alcance y del routing productivo.
- **Finanzas**: eliminado del alcance y del routing productivo.
- **Debug**: no existe módulo/ruta productiva y se considera fuera de alcance.

> Estado real del frontend: el producto expuesto por routing contiene únicamente módulos Admin listados en "Módulos activos".

## Seguridad y modelo de acceso

- **Auth**: Supabase Auth (email/password).
- **Perfiles**: la app usa la tabla `profiles` para asociar `org_id`, `role` e `is_active`.
- **Seguridad real**: se aplica mediante **Row Level Security (RLS)** en Supabase; los checks del cliente son solo conveniencia de UX.

## Stack técnico

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + PostgREST + RLS)
- TanStack React Query

## Estándar de logging

- Usar `logger` central (`src/lib/logger.ts`) en lugar de `console.log` o `console.debug` dentro de módulos de negocio.
- `logger.debug(...)` solo emite en entorno de desarrollo (`import.meta.env.DEV`).
- Para eventos operativos relevantes usar `logger.info(...)` o `logger.warn(...)` según corresponda.
- Errores de negocio e integración deben reportarse con `logger.error(...)`.
- Evitar llamadas directas a `console.*` en la app, salvo casos muy excepcionales de borde crítico.

## Requisitos

- Node.js + npm
- `psql` disponible en PATH para ejecutar gate SQL de release

## Variables de entorno

Configura estas variables (por ejemplo en `.env.local`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` (obligatoria para ejecutar el gate SQL de release)

## Ejecutar localmente

```bash
npm i
npm run dev
```

## Operación de migraciones (Supabase)

1. **Revisar migraciones pendientes**
   - Inspeccionar archivos SQL en `supabase/migrations/` y confirmar orden cronológico por prefijo de timestamp.
   - Verificar que cada migración tenga objetivo claro, sea idempotente cuando aplique y no incluya cambios manuales fuera de control de versiones.

2. **Validar historial aplicado en base de datos**
   - Consultar `supabase_migrations.schema_migrations` para confirmar que el historial remoto coincide con el repositorio.
   - SQL sugerido:

   ```sql
   select version, inserted_at
   from supabase_migrations.schema_migrations
   order by version;
   ```

3. **Gate SQL post-deploy (obligatorio de release)**
   - Script versionado de checks: `supabase/checks/post_deploy_audit.sql`.
   - Runner estándar de release: `npm run release:sql-gate` (ejecuta `scripts/release/run_post_deploy_gate.sh`).
   - El gate imprime todos los checks y bloquea automáticamente el release con código de salida `1` si encuentra cualquier `FAIL`.
   - Este gate valida historial en `supabase_migrations.schema_migrations`, funciones críticas, policies de `profiles` y `audit_log`, y grants de `public.profiles`.

## Checklist de release (criterio de bloqueo)

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run release:sql-gate` ejecutado contra el entorno desplegado.
- [ ] Evidencia adjunta del resultado del gate SQL.
- [ ] Resultado final del gate SQL: **0 checks en `FAIL`**.

> **Bloqueo obligatorio:** si cualquier check SQL devuelve `FAIL`, el deploy **no se cierra**.

## Registro sugerido para auditoría P1 (lint/build)

Documentar en el PR de release un bloque breve con:

- **Antes:** cantidad de errores y warnings (global y por módulo crítico).
- **Después:** cantidad de errores y warnings tras el ajuste.
- **Módulos impactados:** listado explícito de áreas tocadas (o `ninguno` si fue validación sin cambios funcionales).

Formato recomendado:

```md
### Resultado final P1
- Antes: `errores=<n>`, `warnings=<n>` (módulos críticos: `<detalle>`).
- Después: `errores=<n>`, `warnings=<n>` (módulos críticos: `<detalle>`).
- Módulos impactados: `<lista>`.
```
