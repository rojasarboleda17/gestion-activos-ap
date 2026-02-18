# Inventario: dominios de datos y estrategia de hooks

## Objetivo

Definir dominios de datos para el módulo de inventario, separando lectura, mutaciones y estrategia de refresco; además proponer hooks objetivo y extraer lógica actualmente concentrada en componentes grandes.

---

## 1) Dominios de datos

### A. `vehicle-core`

**Responsabilidad funcional**
- Identidad y estado base del vehículo.
- Metadatos transversales usados por listado y detalle.
- Datos legales de tarjeta de propiedad.

**Fuentes actuales (tablas/vistas)**
- `vehicles`
- `vehicle_stages`
- `branches`
- `inventory_vehicle_overview` (vista para listado/kanban)
- `vehicle_property_card`

**Mutaciones actuales**
- `vehicles.update` (edición de datos base, archivar/desarchivar)
- `vehicles.delete` (eliminación)
- `transition_vehicle_stage` (RPC para cambios de etapa)
- `vehicle_property_card.upsert` (datos legales)

**Estado de caché/refetch esperado**
- **Detalle**: caché por `vehicleId` (`['vehicle-core', vehicleId]`) con invalidación tras update/delete/stage transition.
- **Listado**: caché paginada por filtros (`['vehicle-core-list', filters, page, pageSize, search]`) y un namespace paralelo para kanban (`['vehicle-core-kanban', filters, search]`).
- **Catálogos** (`vehicle_stages`, `branches`): `staleTime` largo (5–15 min) e invalidación manual sólo si se administran catálogos.
- **Optimismo sugerido**:
  - `is_archived` y `stage_code` se pueden actualizar optimistamente en detalle/lista con rollback en error.

---

### B. `vehicle-commercial`

**Responsabilidad funcional**
- Ciclo comercial del vehículo: reserva, venta, anulación y pagos vinculados.
- Catálogos y maestros de soporte comercial.

**Fuentes actuales (tablas/vistas)**
- `reservations`
- `sales`
- `sale_payments`
- `customers`
- `payment_methods`
- `vehicle_stages`
- `vehicle_listing` (precio listado y bandera de publicación para resumen/comercial)

**Mutaciones actuales**
- `reservations.insert` (crear reserva)
- `reservations.update` (cancelar / convertir)
- `sales.insert` (venta directa o desde reserva)
- `sales.update` (anular venta)
- `sale_payments.insert` (abono depósito, reembolsos)
- `customers.insert` (cliente rápido)
- `transition_vehicle_stage` (bloquear/publicar/retornar etapa)
- `mark_vehicle_sold` (RPC para marcar vendido con referencia de venta)

**Estado de caché/refetch esperado**
- Query principal por vehículo: `['vehicle-commercial', vehicleId]` (reservas, ventas, pagos resumidos).
- Query separada para maestros: `['commercial-masters', orgId]` (clientes, métodos de pago, etapas no terminales).
- Invalidate al mutar:
  - `vehicle-commercial` del vehículo afectado.
  - `vehicle-core` del mismo vehículo (cambia etapa/estado).
  - `vehicle-core-list` / `vehicle-core-kanban` para reflejar transición de etapa.
- Evitar `refetch` completo encadenado por acción: preferir invalidación selectiva y updates optimistas en estados (`active`, `converted`, `voided`).

---

### C. `vehicle-operations`

**Responsabilidad funcional**
- Alistamiento operativo (orden de trabajo), ítems y costos/gastos operativos.

**Fuentes actuales (tablas/vistas)**
- `work_orders`
- `work_order_items`
- `operation_catalog`
- `vehicle_expenses`
- `profiles` (asignación de responsables/proveedores)

**Mutaciones actuales**
- `work_orders.insert` (crear orden)
- `work_orders.update` (cerrar orden)
- `work_order_items.insert` (catálogo/manual)
- `work_order_items.update` (estado, asignación, notas, fechas)
- `work_order_items.delete`
- `vehicle_expenses.insert`
- `vehicle_expenses.update`
- `vehicle_expenses.delete`

**Estado de caché/refetch esperado**
- Query principal: `['vehicle-operations', vehicleId]` (orden abierta + items + métricas).
- Query secundaria gastos: `['vehicle-operations-expenses', vehicleId]`.
- Maestros: `['operations-catalog']` y `['active-profiles']` con `staleTime` largo.
- Invalidate tras mutación:
  - Mutaciones de `work_order_items`: invalidar `vehicle-operations`.
  - Mutaciones de `vehicle_expenses`: invalidar `vehicle-operations-expenses` y, si hay costo acumulado por ítem en UI, también `vehicle-operations`.
- Optimismo recomendado:
  - Cambios de estado de ítems (`pending/in_progress/done/blocked`) y delete de ítem.

---

### D. `vehicle-compliance-docs`

**Responsabilidad funcional**
- Cumplimiento documental y operativo del vehículo.
- Gestión de archivos con expiración y visibilidad.

**Fuentes actuales (tablas/vistas)**
- `vehicle_compliance`
- `vehicle_files`
- `document_types`
- Supabase Storage buckets:
  - `vehicle-public`
  - `vehicle-internal`
  - `vehicle-restricted`

**Mutaciones actuales**
- `vehicle_compliance.upsert`
- `vehicle_files.insert`
- `vehicle_files.delete`
- Storage `.upload`, `.remove`, `.createSignedUrl`

**Estado de caché/refetch esperado**
- Query de cumplimiento: `['vehicle-compliance', vehicleId]`.
- Query de archivos: `['vehicle-docs', vehicleId, activeFilter]`.
- Query de tipos documentales: `['document-types']` con `staleTime` largo.
- Invalidate tras mutación:
  - `vehicle-compliance` al guardar formulario.
  - `vehicle-docs` al subir/eliminar archivo.
  - `vehicle-core-list` y `vehicle-core` si cambia semáforo de vencimientos que impacta overview.
- Estrategia de archivos:
  - Mantener estado de subida por archivo (progreso local) y refresco incremental en vez de recargar toda la lista.

---

## 2) Hooks objetivo (nombres, inputs, outputs)

> Convención sugerida:
> - `useXxxData(...)` para lecturas agregadas.
> - `useXxxMutations(...)` para comandos.
> - Retorno estandarizado con `data`, `isLoading`, `error`, `refetch` + mutaciones explícitas.

### `vehicle-core`

#### `useVehicleCoreData(vehicleId: string)`
**Inputs**
- `vehicleId`

**Outputs**
- `vehicle`: registro de `vehicles`
- `stages`: catálogo de etapas
- `branches`: catálogo de sedes activas
- `propertyCard`: `vehicle_property_card | null`
- `isLoading`, `error`, `refetch`

#### `useVehicleCoreMutations(vehicleId: string)`
**Outputs**
- `updateVehicle(payload)`
- `updatePropertyCard(payload)`
- `transitionStage(targetStage)`
- `toggleArchive()`
- `deleteVehicle()`
- `isSaving`, `mutationError`

#### `useInventoryVehicleList(params)`
**Inputs**
- `{ filters, page, pageSize, search, viewMode }`

**Outputs**
- `rows`, `totalCount`, `stages`, `branches`
- `isLoading`, `error`, `refetch`

---

### `vehicle-commercial`

#### `useVehicleCommercialData(vehicleId: string, orgId?: string)`
**Inputs**
- `vehicleId`
- `orgId` (para clientes)

**Outputs**
- `reservations`, `sales`, `paymentsSummary`
- `customers`, `paymentMethods`, `availableStages`
- `derived`: `hasActiveReservation`, `isSold`, `activeReservation`
- `isLoading`, `error`, `refetch`

#### `useVehicleCommercialMutations(vehicleId: string, ctx)`
**Outputs**
- `createReservation(input)`
- `cancelReservation(input)`
- `createSale(input)`
- `convertReservationToSale(input)`
- `voidSale(input)`
- `createCustomerQuick(input)`
- Estados por comando: `isCreatingReservation`, `isConverting`, etc.

---

### `vehicle-operations`

#### `useVehicleOperationsData(vehicleId: string)`
**Inputs**
- `vehicleId`

**Outputs**
- `openWorkOrder`, `items`, `stats`, `progress`, `totalCost`
- `catalog`, `assignableProfiles`
- `isLoading`, `error`, `refetch`

#### `useVehicleOperationsMutations(vehicleId: string, orgId?: string, userId?: string)`
**Outputs**
- `createWorkOrder()`
- `closeWorkOrder(workOrderId)`
- `addCatalogItems(input)`
- `addManualItem(input)`
- `updateItem(itemId, updates)`
- `deleteItem(itemId)`
- `registerItemCost(input)`

#### `useVehicleExpensesData(vehicleId: string)`
**Outputs**
- `expenses`, `groupedExpenses`, `totalExpenses`
- `openWorkOrderItems`, `vendors`
- `isLoading`, `error`, `refetch`

#### `useVehicleExpensesMutations(vehicleId: string, orgId?: string, userId?: string)`
**Outputs**
- `createExpense(input)`
- `updateExpense(expenseId, input)`
- `deleteExpense(expenseId)`

---

### `vehicle-compliance-docs`

#### `useVehicleComplianceData(vehicleId: string)`
**Outputs**
- `compliance`
- `isDirty`, `setField`, `reset`
- `isLoading`, `error`, `save()`

#### `useVehicleDocumentsData(vehicleId: string, filter: 'all' | 'expired' | 'upcoming')`
**Outputs**
- `files`, `filteredFiles`, `documentTypes`
- `statusCounters` (`expired`, `upcoming`, `ok`)
- `isLoading`, `error`, `refetch`

#### `useVehicleDocumentsMutations(vehicleId: string, orgId?: string, userId?: string)`
**Outputs**
- `uploadFile(input)`
- `deleteFile(file)`
- `downloadFile(file)`
- `uploadState`, `isDeleting`, `mutationError`

---

## 3) Lógica a extraer de componentes grandes hacia hooks/servicios

## Prioridad alta (alto impacto en mantenibilidad)

### 1. `VehicleDetail.tsx` → orquestación de dominio y acciones globales
**Sacar de componente**
- `fetchVehicle` y carga de etapas.
- `handleStageChange`, `handleArchive`, `handleDelete`.
- Máquina de estado de guardado unificado (`dirtyMap`, `collectors`, `saveStatus`, `handleSaveAll`).

**Mover a**
- Hook `useVehicleDetailController(vehicleId)` que consuma hooks de dominio.
- Servicio `vehicleCoreService` para comandos core.

**Beneficio**
- Página enfocada en layout/tabs; menos acoplamiento de negocio y UI.

### 2. `VehicleSalesTab.tsx` → casos de uso comerciales
**Sacar de componente**
- `fetchData` con 5 fuentes simultáneas.
- Flujos transaccionales: crear reserva, cancelar, convertir a venta, venta directa, anular venta (incluyendo RPCs y pagos).

**Mover a**
- `useVehicleCommercialData` + `useVehicleCommercialMutations`.
- Servicio `vehicleCommercialService` con métodos de caso de uso:
  - `createReservationAndBlockVehicle`
  - `cancelReservationAndReconcileStage`
  - `convertReservationToSale`
  - `voidSaleAndRestoreStage`

**Beneficio**
- Permite pruebas unitarias de reglas comerciales fuera de la UI.

### 3. `VehicleWorkOrdersTab.tsx` + `VehicleExpensesTab.tsx`
**Sacar de componente**
- Cálculo de `stats/progress/totalCost`.
- Carga encadenada de orden abierta + ítems + suma de costos.
- CRUD de items/gastos y lógica de acople entre ambos.

**Mover a**
- `useVehicleOperationsData`, `useVehicleOperationsMutations`.
- `useVehicleExpensesData`, `useVehicleExpensesMutations`.
- Servicio `vehicleOperationsService`.

**Beneficio**
- Evita duplicar lógica de gastos/costos entre tabs y mejora consistencia.

## Prioridad media

### 4. `VehicleFilesTab.tsx`
**Sacar de componente**
- Resolución de bucket por visibilidad.
- Pipeline upload storage + insert DB + auditoría.
- Filtros de expiración (`expired/upcoming`) y metadatos de estado.

**Mover a**
- `useVehicleDocumentsData`, `useVehicleDocumentsMutations`.
- Servicio `vehicleDocumentsService` (storage + tabla).

### 5. `VehicleComplianceTab.tsx` / `VehicleAcquisitionTab.tsx`
**Sacar de componente**
- Estado `initialForm/form`, cálculo de `isDirty`, patrón de `onCollectPayload`.

**Mover a**
- Hook reusable de formulario persistido: `usePersistedVehicleForm`.
- Hooks específicos por sección que expongan `collectSave` y `dirty`.

---

## 4) Orden sugerido de implementación

1. Introducir capa de servicios por dominio (sin cambiar UI).
2. Migrar lectura a hooks `use...Data`.
3. Migrar mutaciones a hooks `use...Mutations`.
4. Conectar invalidaciones de caché entre dominios (`commercial` ⇒ `core-list`, etc.).
5. Simplificar `VehicleDetail` a contenedor/presentación.

---

## 5) Resultado esperado de la separación

- Menos lógica transaccional en componentes de UI.
- Refetches más precisos y predecibles.
- Reutilización de reglas de negocio en nuevas pantallas (ej. wizard de ventas, panel operativo).
- Base lista para evolucionar a React Query/TanStack Query con claves de caché estables por dominio.
