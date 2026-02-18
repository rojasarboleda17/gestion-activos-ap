# Revisión pragmática del módulo de Operaciones

## Alcance revisado

Se revisó la implementación del módulo de Operaciones en:

- `src/pages/admin/Operations.tsx`
- `src/components/operations/WorkOrderSheet.tsx`
- `src/components/vehicle/VehicleWorkOrdersTab.tsx`

## Diagnóstico ejecutivo

**Conclusión corta:** no conviene mantenerlo “tal cual” si el objetivo es escalar con bajo costo operativo.

Hoy el módulo sí funciona, pero presenta señales claras de deuda estructural:

1. **Lógica duplicada** entre vistas (especialmente órdenes de trabajo e ítems).
2. **Acoplamiento UI + datos + reglas de negocio** en componentes muy largos.
3. **Falta de una capa uniforme de dominio de operaciones**, lo que dificulta gobernanza, pruebas y evolución.
4. **Variantes funcionales similares con caminos distintos**, lo que eleva riesgo de inconsistencia.

No recomiendo reescritura total; sí recomiendo un **refactor incremental por capas** en 2-3 iteraciones.

---

## Hallazgos estructurales (diseño, arquitectura, operación y lógica)

## 1) Diseño / UX funcional

- Se mezclan tres contextos en una sola página principal: alistamiento vehículo, operaciones de negocio y catálogo.
- La experiencia es completa pero densa; para usuarios nuevos puede ser difícil entender el flujo “crear → ejecutar → cerrar → costear”.
- Hay consistencia visual razonable, pero no necesariamente consistencia de reglas entre pantallas equivalentes.

**Impacto:** curva de aprendizaje alta y mayor probabilidad de errores operativos.

## 2) Arquitectura de frontend

- `Operations.tsx` concentra consultas, agregaciones, filtros, mutaciones y presentación.
- `WorkOrderSheet.tsx` también mezcla lógica de negocio (validaciones y transición de estado), acceso a datos y UI.
- Existe una implementación paralela en `VehicleWorkOrdersTab.tsx` con operaciones casi equivalentes.

**Impacto:** cambios pequeños se vuelven caros (tiempo + riesgo), porque hay que tocar varios lugares.

## 3) Operación / mantenibilidad

- Para enriquecer órdenes se consultan items y luego se agregan conteos en cliente.
- Para costos se vuelve a consultar y consolidar en frontend.
- Esto escala bien al inicio, pero puede degradar al crecer volumen de órdenes/items.

**Impacto:** mantenimiento reactivo y rendimiento potencialmente inestable.

## 4) Lógica de negocio

- Regla de “una orden abierta por vehículo” se intenta garantizar en UI (consulta previa), no como contrato robusto en dominio.
- Cierre de orden y estados de ítems están distribuidos en varios puntos de código.
- Hay lógica similar para scope `vehicle` vs `business`, pero con ramas condicionales repetidas.

**Impacto:** riesgo de comportamientos divergentes según pantalla/flujo.

---

## ¿Vale la pena mantener la separación actual?

**Sí, pero solo a nivel de concepto de dominio** (`vehicle` vs `business`), no a nivel de implementación duplicada.

- Mantener separación conceptual: ✅ (tiene sentido operativo)
- Mantener lógica separada y poco uniforme: ❌ (no escala ni en costo ni en calidad)

La meta debería ser: **misma plataforma operativa, con variaciones de comportamiento por scope configuradas por reglas**, no por duplicación de componentes y queries.

---

## Propuesta pragmática (sin “big bang”)

## Fase 1 (rápida, bajo riesgo)

1. Extraer hooks de dominio:
   - `useOperationsCatalog`
   - `useWorkOrders`
   - `useWorkOrderItems`
   - `useWorkOrderCosts`
2. Centralizar validaciones de negocio en funciones puras:
   - `canCreateWorkOrder`
   - `canCloseWorkOrder`
   - `canRegisterCost`
3. Crear tipos compartidos de Operaciones (DTO/view models) en un módulo único.

**Resultado esperado:** menos duplicación y mejor trazabilidad.

## Fase 2 (estandarización)

1. Unificar flujos de edición de ítems en un componente reutilizable (misma lógica, distinta configuración por scope).
2. Normalizar el mapa de estados/acciones permitidas (state machine liviana).
3. Consolidar agregados (progreso, pendientes, costo) en utilidades únicas.

**Resultado esperado:** reglas homogéneas y UX más predecible.

## Fase 3 (eficiencia operativa)

1. Mover agregaciones pesadas hacia vistas/RPC en Supabase cuando aplique.
2. Definir KPIs operativos de módulo (tiempo de cierre, bloqueos, costo promedio por alistamiento).
3. Establecer tablero mínimo de observabilidad funcional.

**Resultado esperado:** menor costo de operación y mejor capacidad de decisión.

---

## Preguntas clave antes de diseñar el plan final

Para avanzar bien (sin sobreingeniería), necesitamos cerrar estos puntos:

1. **Prioridad de negocio (Q1-Q2):**
   - ¿Qué pesa más hoy: velocidad de operación, control de costos, o trazabilidad/auditoría?

2. **Dolores concretos actuales:**
   - ¿Dónde duele más en la práctica: creación de órdenes, seguimiento de ítems, cierres o costos?

3. **Volumen real esperado:**
   - ¿Cuántas órdenes activas por semana y cuántos ítems por orden esperan en promedio/pico?

4. **Gobierno de roles:**
   - ¿Operaciones y Comercial deben compartir exactamente las mismas reglas en OT o no?

5. **Reglas no negociables:**
   - ¿Debe existir estrictamente una sola OT abierta por vehículo (a nivel base de datos)?

6. **Costo y contabilidad:**
   - ¿El costo de alistamiento necesita trazabilidad contable formal o solo control interno?

7. **Horizonte de producto:**
   - ¿Este módulo seguirá siendo “operativo interno” o debe convertirse en producto más amplio (multi-sede, multi-equipo, SLA)?

---

## Recomendación final

**No mantener el módulo exactamente como está.**

Sí mantener su alcance funcional, pero con un refactor incremental orientado a:

- Uniformidad de reglas.
- Menor duplicación.
- Menor costo de cambio.
- Mejor control operativo.

Si respondes las 7 preguntas, preparo una propuesta concreta con:

1. diseño objetivo (arquitectura y boundaries),
2. backlog priorizado por impacto/esfuerzo,
3. riesgos + mitigaciones,
4. roadmap de implementación por sprints.
