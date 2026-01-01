# Asset Vault (MVP)

Asset Vault es un MVP para la gestión interna de activos (vehículos y motos) de un concesionario de usados. Centraliza inventario, alistamientos, costos/gastos, documentación y trazabilidad operativa, con control de acceso por roles y seguridad a nivel de base de datos (RLS).

## Alcance del MVP

### Módulos principales (Admin)
- **Dashboard**: visión general de inventario y operación.
- **Inventario**: registro y administración de vehículos, estados y detalle por activo.
- **Operaciones**: catálogo de operaciones y **órdenes de trabajo** (alistamiento y tareas), con seguimiento.
- **Ventas**: reservas, ventas, pagos y documentos del negocio.
- **Archivos**: carga y consulta de documentos/fotos asociados a vehículos y negocios.
- **Usuarios**: administración de perfiles internos.
- **Sedes**: gestión de sedes y asignación.
- **Auditoría**: registro de eventos críticos para trazabilidad.

> Nota: el frontend actual prioriza el flujo de **Admin**. Los roles adicionales pueden existir en la base de datos y en RLS, pero sus “dashboards” dedicados pueden no estar implementados todavía.

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
