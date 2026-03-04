# Plan maestro de optimización — Módulo Inventario (Vehículos)

## Objetivo acordado
Mantener la navegación en **4 tabs**, mejorar arquitectura y UX de forma gradual, priorizando **venta directa** sin degradar el flujo de **reserva**.

---

## 1) Qué rescatar, qué mejorar y qué eliminar

### 1.1 Rescatar (sí se mantiene)
Estos elementos ya aportan valor y deben conservarse, con ajustes incrementales:

- **Estructura de 4 tabs en detalle de vehículo** como patrón de navegación estable.
- **Flujos actuales de ventas/reservas** (ya funcionan, hay que simplificarlos y hacerlos más guiados).
- **Guardado coordinado por bloques** en la tab "Otros" (acquisition/compliance/files), porque reduce fricción operativa.
- **Vista lista + kanban** en inventario, porque responde a necesidades distintas (operación y seguimiento por estado).

### 1.2 Mejorar (sí se refactoriza)
- **Capa de datos por dominio** (evitar consultas duplicadas entre bloques y tabs).
- **Componentes grandes** (especialmente ventas) en submódulos más pequeños.
- **Permisos por bloque/acción** (ver/editar/guardar/eliminar/transicionar) sin romper las 4 tabs.
- **Consistencia UX**: estados de carga, errores, vacíos, confirmaciones y mensajes de éxito.

### 1.3 Eliminar (si no tiene uso real)
- Archivos/componentes no conectados al flujo productivo actual.
- Lógica duplicada heredada que ya no aporta valor funcional.
- Código utilitario repetido (parseo/formato/mapeos) cuando exista una versión estándar.

> Regla de eliminación: si no está conectado a rutas/flujo real o no es parte de un roadmap aprobado, se elimina.

---

## 2) Ampliación estratégica (qué significa en la práctica)

### 2.1 "Limpieza arquitectónica" en términos ejecutables
- Definir 1 fuente de verdad por dominio:
  - `vehicle-core` (datos maestros)
  - `vehicle-commercial` (listing, reservas, ventas)
  - `vehicle-operations` (WO + gastos)
  - `vehicle-compliance-docs` (cumplimiento + archivos)
- Mover consultas/mutaciones a hooks de dominio.
- Dejar componentes de UI “tontos” (presentacionales) y lógica de negocio en hooks/servicios.

### 2.2 "Mejor UX" en términos ejecutables
- Mostrar "siguiente mejor acción" según estado del vehículo:
  - Si disponible: CTA primario = **Venta directa**
  - CTA secundario = **Reservar**
- Formularios progresivos (menos campos iniciales, más contexto, validación anticipada).
- Mensajes orientados a tarea (qué pasó + qué sigue).

### 2.3 Resultado esperado
- Menos deuda técnica.
- Menos errores por estado inconsistente.
- Menor tiempo por operación comercial.
- Curva de aprendizaje más baja para nuevos usuarios internos.

---

## 3) Prioridad comercial: Venta directa primero (con reservas robustas)

## 3.1 Principio de priorización
1. **Venta directa** es flujo prioritario (impacto inmediato en caja y conversión).
2. **Reserva** se mantiene como flujo alterno estratégico (usuarios que no compran al instante).

## 3.2 Diseño de flujo recomendado

### Flujo A — Venta directa (prioritario)
- Entrada clara desde "General" con CTA principal.
- Captura mínima inicial:
  - Cliente
  - Precio final
  - Método de pago
- Confirmación en 1 pantalla de resumen.
- Post-acción:
  - actualizar estado vehículo
  - registrar trazabilidad/auditoría
  - sugerir pasos siguientes (documentos, entrega, etc.)

### Flujo B — Reserva (secundario crítico)
- Mantener creación de reserva existente, pero:
  - validación más guiada
  - mejor visibilidad de estado activo
  - camino evidente a "Convertir a venta"
- Evitar ambigüedad entre "reservado", "vendido", "anulado" con badges y CTAs contextuales.

### Reglas UX para convivencia A/B
- Si no hay reserva activa: CTA principal = Venta directa.
- Si hay reserva activa: CTA principal = Convertir a venta.
- Siempre dejar acción alternativa visible, no dominante.

---

## 4) Roadmap por sprints (plena ejecución)

## Sprint 0 (2–3 días) — Descubrimiento controlado
**Objetivo:** preparar ejecución sin riesgo funcional.

Entregables:
- Inventario de componentes usados vs no usados.
- Matriz de permisos por bloque/acción.
- Mapa de consultas y mutaciones actuales.

DoD:
- Lista de eliminación aprobada.
- Dependencias del Sprint 1 cerradas.

---

## Sprint 1 (1 semana) — Higiene + eliminación de no usados
**Objetivo:** reducir complejidad sin cambiar comportamiento de negocio.

Alcance:
- Eliminar archivos/componentes no conectados.
- Remover imports huérfanos y rutas muertas.
- Consolidar utilidades repetidas.

DoD:
- Build estable.
- Sin referencias colgantes.
- Menor tamaño y complejidad del módulo.

Riesgo: bajo-medio.

---

## Sprint 2 (1–2 semanas) — Capa de datos por dominio
**Objetivo:** mejorar consistencia y mantenibilidad.

Alcance:
- Hooks de dominio para overview/commercial/operations/compliance-docs.
- Invalidación/refetch unificado tras mutaciones.
- Reducir fetch duplicado.

DoD:
- Componentes más pequeños.
- Menos duplicidad en llamadas a datos.

Riesgo: medio.

---

## Sprint 3 (2 semanas) — Rediseño de flujo comercial
**Objetivo:** optimizar conversión priorizando venta directa.

Alcance:
- Submódulos de ventas (venta directa, reserva, conversión, anulación).
- CTAs contextuales según estado.
- Formularios progresivos y validación anticipada.

DoD:
- Menos pasos para venta directa.
- Conversión reserva→venta más obvia.
- Menos errores de operación.

Riesgo: medio-alto.

---

## Sprint 4 (1 semana) — Permisos finos + hardening
**Objetivo:** control por rol con UX clara.

Alcance:
- Guardas por acción.
- UI adaptativa según permisos.
- Auditoría reforzada en acciones críticas.

DoD:
- Roles correctamente acotados.
- Sin rutas de edición no autorizadas.

Riesgo: medio.

---

## Sprint 5 (1 semana) — Calidad y rendimiento
**Objetivo:** estabilizar y dejar listo para escalar.

Alcance:
- Pruebas E2E en flujos críticos (venta directa, reserva, conversión, archivos).
- Perfilado de rendimiento y mejoras de render.
- Cierre de deuda remanente.

DoD:
- Flujos críticos en verde.
- Métricas de UX/operación mejoradas.

Riesgo: bajo-medio.

---

## 5) KPIs para validar mejora real

### Negocio
- Tasa de cierre por venta directa.
- Tiempo promedio de cierre de venta directa.
- Tasa de conversión reserva → venta.

### Operación
- Tiempo para registrar una reserva.
- Errores por validación/reintento en ventas.
- Número de incidencias por permisos.

### Técnica
- Reducción de componentes no usados.
- Reducción de duplicidad de consultas.
- Reducción de tamaño en componentes monolíticos.

---

## 6) Orden recomendado de ejecución inmediata
1. Sprint 0 completo (inventario + matriz + mapa).
2. Sprint 1 (borrar no usado y consolidar base).
3. Sprint 2 (dominio de datos).
4. Sprint 3 (rediseño comercial con prioridad venta directa).

---

## 7) Criterios de decisión para borrar vs rescatar

Borrar si:
- no se renderiza en ninguna ruta activa,
- no participa en flujo de negocio actual,
- su responsabilidad fue absorbida por otro componente.

Rescatar si:
- aporta lógica válida de negocio reutilizable,
- reduce tiempo de implementación del rediseño,
- tiene pruebas o comportamiento estable en producción.

---

## 8) Nota de implementación gradual
No se propone un “big bang”. Cada sprint debe dejar el módulo **funcional, estable y desplegable**. El rediseño comercial (venta directa primero) se hace por capas para no romper el flujo de reservas que ya aporta valor.
