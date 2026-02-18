# Matriz RBAC de inventario (operación y endurecimiento)

## Objetivo

Definir una matriz de permisos por rol para el flujo de inventario de vehículos, con foco en:

- habilitación funcional para ventas (Sprint 3),
- endurecimiento de permisos y controles server-side (Sprint 4),
- alineación entre comportamiento de UI y validación en backend (RLS/policies o validación en servicios).

## Roles operativos propuestos

| Rol | Propósito operativo | Principio de acceso |
|---|---|---|
| **Admin** | Gobierno del módulo, correcciones y excepciones operativas. | Acceso total en lectura/escritura con auditoría obligatoria. |
| **Comercial** | Gestión de oportunidades, reservas y cierre comercial. | Acceso acotado a información comercial y transiciones de venta. |
| **Operaciones** | Alistamiento, cumplimiento, costos operativos y documentación interna. | Acceso pleno a bloques operativos, restringido en decisiones comerciales finales. |

---

## Convenciones de la matriz

- ✅ Permitido.
- ⚠️ Permitido con condición (estado, ownership, sede o validación previa).
- ❌ No permitido.
- **UI**: cómo debe comportarse interfaz (mostrar/ocultar/deshabilitar, mensajes).
- **Backend**: regla esperada en RLS/policies o validación server-side para evitar bypass de UI.

> Nota: “Guardar” se refiere a persistencia de cambios del bloque correspondiente.

## Bloque General

| Acción | Admin | Comercial | Operaciones | Regla de UI esperada | Regla de backend esperada |
|---|---:|---:|---:|---|---|
| Ver | ✅ | ✅ | ✅ | Listado y vista general visibles para todos los roles operativos. | `SELECT` permitido por rol y alcance de sede/empresa. |
| Editar | ✅ | ⚠️ | ⚠️ | Campos sensibles en solo lectura para roles no autorizados. | Validar columnas editables por rol (whitelist server-side). |
| Guardar | ✅ | ⚠️ | ⚠️ | Botón **Guardar** habilitado solo si hay campos editables y formulario válido. | Revalidar esquema + permiso por campo antes de `UPDATE`. |
| Transicionar estado | ✅ | ⚠️ | ⚠️ | Mostrar solo transiciones válidas según rol y estado actual. | Máquina de estados server-side con matriz `rol x estado_origen x estado_destino`. |
| Eliminar/archivar | ✅ | ❌ | ❌ | Acción oculta/deshabilitada fuera de Admin, con confirmación fuerte. | Solo Admin puede `DELETE` lógico/archivo; registrar `deleted_by` y motivo. |

**Condiciones sugeridas (⚠️)**

- **Comercial**: puede editar/guardar campos comerciales (precio objetivo, notas de gestión, canal).
- **Operaciones**: puede editar/guardar campos operativos (estado físico, checklist, costos base).
- Ninguno de los dos puede alterar identificadores críticos (VIN/placa/propietario legal) sin flujo de excepción.

## Bloque Detalle

| Acción | Admin | Comercial | Operaciones | Regla de UI esperada | Regla de backend esperada |
|---|---:|---:|---:|---|---|
| Ver | ✅ | ✅ | ✅ | Tabs de detalle visibles según rol; campos sensibles enmascarados si aplica. | `SELECT` por rol + políticas de columnas sensibles. |
| Editar | ✅ | ⚠️ | ⚠️ | Inputs habilitados por secciones: Comercial vs Operaciones. | Validación de ownership de sección y bloqueo de columnas no autorizadas. |
| Guardar | ✅ | ⚠️ | ⚠️ | Guardado por sección con feedback granular de campos rechazados. | `UPDATE` parcial con control estricto de campos permitidos por rol. |
| Transicionar estado | ✅ | ⚠️ | ⚠️ | Dropdown de estado filtra opciones por rol y etapa. | Tabla de transiciones válidas + bloqueo transaccional ante conflictos. |
| Eliminar/archivar | ✅ | ❌ | ❌ | Botón de archivado oculto para no-Admin. | Política de borrado lógico solo para Admin; no hard-delete directo. |

**Condiciones sugeridas (⚠️)**

- **Comercial**: puede mover estados de pipeline de venta (ej. “Disponible” → “Reservado” → “Vendido”) si se cumplen precondiciones.
- **Operaciones**: puede mover estados internos (ej. “Recepción” → “Alistamiento” → “Listo publicación”) sin cerrar venta.

## Bloque Alistamiento

| Acción | Admin | Comercial | Operaciones | Regla de UI esperada | Regla de backend esperada |
|---|---:|---:|---:|---|---|
| Ver | ✅ | ✅ | ✅ | Todos ven progreso de alistamiento; detalle técnico opcional para Comercial. | `SELECT` con visibilidad total de progreso y visibilidad acotada de detalle técnico. |
| Editar | ✅ | ❌ | ✅ | Form de checklist/OT editable solo para Operaciones y Admin. | Solo roles autorizados pueden modificar tablas de OT/checklists. |
| Guardar | ✅ | ❌ | ✅ | Guardar habilitado únicamente en tabs operativas. | Validación de consistencia (fechas, costos, evidencias) antes de persistir. |
| Transicionar estado | ✅ | ❌ | ✅ | Cambios de estado de alistamiento visibles/operables para Operaciones/Admin. | Máquina de estados de alistamiento separada de estados comerciales. |
| Eliminar/archivar | ✅ | ❌ | ⚠️ | Operaciones puede solicitar cierre/archivo, pero no eliminar definitivo. | Permitir archivado operativo condicionado (sin eliminación final), con auditoría. |

**Condiciones sugeridas (⚠️)**

- **Operaciones** puede archivar OT/casos en su ámbito cuando estén cerrados y conciliados.
- Eliminación definitiva del histórico de alistamiento queda restringida a Admin.

## Bloque Otros (archivos, notas internas, integraciones)

| Acción | Admin | Comercial | Operaciones | Regla de UI esperada | Regla de backend esperada |
|---|---:|---:|---:|---|---|
| Ver | ✅ | ⚠️ | ✅ | Comercial ve solo archivos/notas etiquetados como “comerciales” o públicos internos. | RLS por clasificación de documento (`comercial`, `operativo`, `sensible`). |
| Editar | ✅ | ⚠️ | ⚠️ | Edición permitida según tipo de documento/nota y autoría. | Validar tipo de recurso y propiedad (`created_by`) además del rol. |
| Guardar | ✅ | ⚠️ | ⚠️ | Upload/edición habilitados por categoría permitida. | Validar MIME/tamaño + categoría autorizada + trazabilidad de cambios. |
| Transicionar estado | ✅ | ⚠️ | ⚠️ | Estado documental (borrador/aprobado) según flujos de aprobación. | Workflow de aprobación con reglas de segregación de funciones. |
| Eliminar/archivar | ✅ | ❌ | ⚠️ | Comercial no elimina; Operaciones solo archiva lo operativo. | Soft-delete por rol/categoría, retención mínima y registro de auditoría. |

---

## Reglas transversales de UI (mínimas)

1. **No confiar en ocultar botones**: toda denegación visual debe ir acompañada de validación backend equivalente.
2. **Mensajes de permiso explícitos**: cuando una acción esté bloqueada, mostrar causa (rol, estado, precondición).
3. **Desacople por capacidad**: construir UI por capacidades (`canEditGeneral`, `canTransitionSalesState`) y no por strings de rol hardcodeados.
4. **Estados concurrentes**: prevenir “lost update” mostrando conflicto de versión al guardar.

## Reglas transversales de backend (mínimas)

1. **RLS por rol + sede + ownership** en tablas núcleo de inventario.
2. **Validación server-side por campo** en `INSERT/UPDATE` (lista blanca por bloque y rol).
3. **Máquina de estados central** (función/procedimiento) para transiciones, no lógica dispersa en frontend.
4. **Auditoría obligatoria** para cambios críticos: estado, precio, archivado/eliminación, titularidad.
5. **Soft-delete por defecto** + políticas de retención para cumplimiento y trazabilidad.

---

## Bloqueantes por sprint

### Sprint 3 (ventas) — **bloqueantes**

- [ ] Definir y aplicar matriz de transiciones comerciales permitidas por rol (mínimo Admin/Comercial).
- [ ] Implementar validación server-side de transición “Reservado/Vendido” con precondiciones (documentación, checklist mínimo, datos de cliente).
- [ ] Restringir edición de campos críticos en detalle para evitar que Comercial altere datos operativos o legales sin autorización.
- [ ] Exponer en UI capacidades por rol con feedback de permisos denegados (no solo ocultar acciones).

### Sprint 4 (hardening permisos) — **bloqueantes**

- [ ] Activar/ajustar RLS en todas las tablas de inventario relacionadas (vehículo, estados, archivos, notas, OT, gastos).
- [ ] Implementar auditoría estructurada (quién, cuándo, antes/después) para acciones críticas.
- [ ] Unificar lógica de autorización en capa server-side reusable (policies + servicios), removiendo reglas ad-hoc del frontend.
- [ ] Ejecutar pruebas de autorización negativas (intentos de bypass API) y dejarlas en CI.

## Criterio de aceptación sugerido

La matriz se considera implementada cuando:

1. Cada acción de la tabla tiene una verificación backend correspondiente y testeada.
2. La UI refleja la misma decisión de permisos que el backend para cada rol/estado.
3. Existe evidencia en auditoría de cambios críticos y denegaciones relevantes.
