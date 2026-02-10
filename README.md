# Asset Vault (MVP)

Asset Vault es un MVP para la gestión interna de activos (vehículos y motos) de un concesionario de usados. Centraliza inventario, alistamientos, costos/gastos, documentación y trazabilidad operativa, con control de acceso por roles y seguridad a nivel de base de datos (RLS).

## Alcance del MVP

### Módulos principales (Admin)
- **Dashboard**: retirado temporalmente del routing productivo.
- **Inventario**: registro y administración de vehículos, estados y detalle por activo.
- **Operaciones**: catálogo de operaciones y **órdenes de trabajo** (alistamiento y tareas), con seguimiento.
- **Ventas**: reservas, ventas, pagos y documentos del negocio.
- **Finanzas**: retirado temporalmente del routing productivo.
- **Archivos**: carga y consulta de documentos/fotos asociados a vehículos y negocios.
- **Usuarios**: administración de perfiles internos.
- **Sedes**: gestión de sedes y asignación.
- **Auditoría**: registro de eventos críticos para trazabilidad.

> Nota: el frontend actual prioriza el flujo de **Admin**. Los roles adicionales pueden existir en la base de datos y en RLS, pero sus “dashboards” dedicados pueden no estar implementados todavía.

> Estado actual de routing: los módulos **Dashboard** y **Finanzas** están deshabilitados temporalmente en producción para evitar rutas ambiguas mientras se estabilizan sus flujos.

## Seguridad y modelo de acceso

- **Auth**: Supabase Auth (email/password).
- **Perfiles**: la app usa la tabla `profiles` para asociar `org_id`, `role` e `is_active`.
- **Seguridad real**: se aplica mediante **Row Level Security (RLS)** en Supabase; los checks del cliente son solo conveniencia de UX.

## Stack técnico

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + PostgREST + RLS)
- TanStack React Query

## Requisitos

- Node.js + npm

## Variables de entorno

Configura estas variables (por ejemplo en `.env.local`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

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

3. **Correr checklist SQL post-deploy**
   - Ejecutar el checklist de verificación en la base de datos objetivo inmediatamente después de aplicar migraciones.
   - Script versionado: `supabase/checks/post_deploy_audit.sql`.
   - Ejecutar el script (Supabase SQL Editor o cliente SQL conectado al entorno destino) y revisar la columna `status` (`PASS`/`FAIL`).
   - El script valida: historial en `supabase_migrations.schema_migrations`, funciones críticas, policies de `profiles` y `audit_log`, y grants de `public.profiles`.
   - **Regla operativa:** si existe al menos un `FAIL`, el release **no se puede cerrar** hasta corregir y re-ejecutar el checklist.

## Checklist corto de release

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Ejecutado `supabase/checks/post_deploy_audit.sql` en el entorno desplegado.
- [ ] Resultado del checklist SQL: **0 filas con `FAIL`** (si hay `FAIL`, el release no se cierra).
