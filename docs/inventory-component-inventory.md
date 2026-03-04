# Inventario de componentes de inventario de vehículos

## Alcance de revisión

Este inventario se construyó revisando:

- `src/App.tsx` para identificar rutas activas y páginas montadas por router.
- `src/pages/admin/Vehicles.tsx` para identificar subcomponentes del flujo de listado.
- `src/pages/admin/VehicleDetail.tsx` para identificar subcomponentes del flujo de detalle.

## Componentes realmente montados por rutas activas

| Componente / archivo | Ruta donde se usa | Flujo funcional | Estado |
|---|---|---|---|
| `src/pages/admin/Vehicles.tsx` | `/admin/vehicles` | Pantalla principal de inventario: consulta, filtros, búsqueda, paginación y acciones por vehículo. | **Activo** |
| `src/components/vehicle/VehicleFilters.tsx` | `/admin/vehicles` (renderizado dentro de `Vehicles`) | Filtros por etapa, sede, clase y estado de publicación para acotar el listado/kanban. | **Activo** |
| `src/components/vehicle/VehicleKanban.tsx` | `/admin/vehicles` (tab `kanban`) | Visualización alternativa del inventario por columnas de etapa. | **Activo** |
| `src/components/vehicle/VehicleQuickEdit.tsx` | `/admin/vehicles` (modal) | Edición rápida desde el listado sin navegar al detalle completo. | **Activo** |
| `src/pages/admin/VehicleDetail.tsx` | `/admin/vehicles/:id` | Pantalla de detalle del vehículo con tabs funcionales y acciones de etapa/archivo/eliminación. | **Activo** |
| `src/components/vehicle/VehicleSummaryTab.tsx` | `/admin/vehicles/:id` (tab `overview`) | Resumen general del vehículo. | **Activo** |
| `src/components/vehicle/VehicleSalesTab.tsx` | `/admin/vehicles/:id` (tab `overview`) | Flujo comercial: reservas, ventas y operaciones relacionadas de venta. | **Activo** |
| `src/components/vehicle/VehicleInfoTab.tsx` | `/admin/vehicles/:id` (tab `info`) | Edición/consulta de información principal del vehículo. | **Activo** |
| `src/components/vehicle/VehicleLegalTab.tsx` | `/admin/vehicles/:id` (tab `info`) | Datos legales asociados al vehículo. | **Activo** |
| `src/components/vehicle/VehicleWorkOrdersTab.tsx` | `/admin/vehicles/:id` (tab `operations`) | Gestión de órdenes de trabajo (alistamiento/operaciones). | **Activo** |
| `src/components/vehicle/VehicleExpensesTab.tsx` | `/admin/vehicles/:id` (tab `operations`) | Registro y seguimiento de gastos del vehículo. | **Activo** |
| `src/components/vehicle/VehicleAcquisitionTab.tsx` | `/admin/vehicles/:id` (tab `internal`) | Bloque interno de adquisición con integración al guardado unificado. | **Activo** |
| `src/components/vehicle/VehicleComplianceTab.tsx` | `/admin/vehicles/:id` (tab `internal`) | Bloque interno de cumplimiento con integración al guardado unificado. | **Activo** |
| `src/components/vehicle/VehicleFilesTab.tsx` | `/admin/vehicles/:id` (tab `internal`) | Bloque interno de archivos con integración al guardado unificado. | **Activo** |

## Sección especial: `src/components/vehicle/*Tab.tsx` no renderizados por rutas activas

Estos componentes existen en `src/components/vehicle`, pero no se importan ni se renderizan desde rutas activas (`App.tsx`) ni desde las páginas activas analizadas (`Vehicles` y `VehicleDetail`).

| Componente / archivo | Ruta donde se usa | Flujo funcional | Estado | Decisión explícita |
|---|---|---|---|---|
| `src/components/vehicle/VehicleFinancialsTab.tsx` | No aplica (sin montaje actual) | Posible consolidación financiera adicional del vehículo (fuera del flujo vigente). | **Candidato a eliminación** | **Rescatar para refactor** |
| `src/components/vehicle/VehicleHistoryTab.tsx` | No aplica (sin montaje actual) | Histórico de eventos/cambios del vehículo no expuesto en UI actual. | **Legacy confirmado** | **Eliminar en Sprint 1** |
| `src/components/vehicle/VehicleListingTab.tsx` | No aplica (sin montaje actual) | Información/listado comercial no integrado al detalle vigente. | **Candidato a eliminación** | **Rescatar para refactor** |

## Criterios aplicados para estado

- **Activo**: componente montado por una ruta activa o por su árbol directo de render.
- **Candidato a eliminación**: componente no montado actualmente, pero con posible valor funcional para reintegración.
- **Legacy confirmado**: componente no montado y sin evidencia de integración en el flujo actual revisado.
