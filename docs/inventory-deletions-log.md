# Inventory deletions log

## 2026-02-16

| Archivo eliminado | Motivo | Reemplazo |
|---|---|---|
| `src/components/vehicle/VehicleFinancialsTab.tsx` | Marcado como **candidato a eliminación** en el inventario técnico y sin imports/renderizado en rutas activas (`/admin/vehicles`, `/admin/vehicles/:id`). | No aplica (funcionalidad no montada actualmente). |
| `src/components/vehicle/VehicleHistoryTab.tsx` | Marcado como **legacy confirmado** y sin imports/renderizado en rutas activas (`/admin/vehicles`, `/admin/vehicles/:id`). | No aplica (el flujo vigente usa `VehicleSummaryTab`, `VehicleInfoTab`, `VehicleWorkOrdersTab`, etc.). |
| `src/components/vehicle/VehicleListingTab.tsx` | Marcado como **candidato a eliminación** en el inventario técnico y sin imports/renderizado en rutas activas (`/admin/vehicles`, `/admin/vehicles/:id`). | No aplica (la visualización/listado vigente está cubierta por `Vehicles`, `VehicleFilters` y `VehicleKanban`). |
