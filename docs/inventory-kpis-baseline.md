# Baseline de KPIs — Optimización Comercial de Inventario

## 1) Objetivo y alcance
Este documento define la línea base de KPIs para medir el impacto de los cambios planificados en los sprints de optimización del módulo de inventario comercial. El foco está en los flujos de **venta directa**, **reserva→venta** y **calidad operativa por validaciones**.

Perímetro de medición:
- Módulo comercial de vehículo (detalle, reserva, conversión y cierre).
- Acciones ejecutadas por usuarios internos (asesores comerciales y perfiles de operaciones/administración).
- Comparativa **pre-cambios vs post-cambios** para Sprint 2 y Sprint 3.

---

## 2) KPIs base

### KPI 1 — Tiempo de venta directa
**Definición:** tiempo transcurrido entre el inicio de una venta directa y su confirmación final en estado `sold`.

**Fórmula sugerida:**
- `tiempo_venta_directa = sold_at - direct_sale_started_at`
- Reporte principal: mediana (P50) y percentil 90 (P90), en minutos.

**Segmentaciones recomendadas:**
- por sucursal,
- por asesor,
- por método de pago,
- por rango de precio.

---

### KPI 2 — Conversión reserva→venta
**Definición:** proporción de reservas activas que terminan convertidas a venta dentro de una ventana temporal definida.

**Fórmula sugerida:**
- `conversion_reserva_venta = (# reservas convertidas a venta) / (# reservas creadas)`
- Ventana operativa recomendada para baseline: 30 días corridos desde `reservation_created_at`.

**Segmentaciones recomendadas:**
- por sucursal,
- por asesor que creó la reserva,
- por estado de reserva (vigente, vencida, anulada),
- por antigüedad de inventario.

---

### KPI 3 — Errores de validación por flujo
**Definición:** cantidad de errores de validación funcional detectados en UI o backend por cada flujo comercial.

**Fórmula sugerida:**
- `errores_validacion_flujo = # eventos validation_error en flujo X`
- Reporte normalizado: errores por 100 intentos de acción en cada flujo.

**Flujos mínimos a medir:**
- venta directa,
- creación de reserva,
- conversión reserva→venta,
- anulación de venta/reserva (si aplica a operación diaria).

---

## 3) Captura de KPIs (fuente, periodicidad, responsable)

| KPI | Fuente de datos principal | Extracción/transformación | Periodicidad | Responsable primario | Responsable de validación |
|---|---|---|---|---|---|
| Tiempo de venta directa | Tabla de eventos comerciales (`direct_sale_started`, `sale_confirmed`) + estado de vehículo | Query SQL consolidada por `vehicle_id` y `sale_id`; cálculo de P50/P90 | Semanal (corte lunes 08:00) | Data/BI | Líder comercial |
| Conversión reserva→venta | Tabla de reservas + tabla/registro de ventas + eventos de conversión | Join por `reservation_id`; cálculo de conversión en ventana de 30 días | Semanal y cierre mensual | Data/BI | Responsable de ventas |
| Errores de validación por flujo | Logs de frontend (telemetría) + errores de backend (API/RPC) | Normalización por `flow_name`, `error_code` y `attempt_id`; tasa por 100 intentos | Diario (monitoreo) + semanal (reporte) | Tech Lead/Ingeniería | QA funcional |

### Reglas de captura y calidad de datos
1. Cada evento debe incluir `timestamp`, `user_id`, `branch_id`, `vehicle_id` y `flow_name` cuando aplique.
2. Toda métrica semanal se recalcula con ventana móvil de 7 días para evitar sesgo por feriados.
3. Si faltan eventos críticos (>5% del total esperado), el reporte se marca como **parcial** y se registra incidencia técnica.
4. El diccionario de eventos/versionado de KPIs se debe congelar antes de iniciar Sprint 2 para mantener comparabilidad.

---

## 4) Baseline pre-cambios (obligatorio antes de Sprint 2 y Sprint 3)

### 4.1 Ventanas de baseline requeridas
- **Baseline pre-Sprint 2:** última ventana completa de 2 semanas antes del primer despliegue de cambios de capa de datos.
- **Baseline pre-Sprint 3:** última ventana completa de 2 semanas antes del primer despliegue de rediseño comercial.

### 4.2 Registro de baseline (completar antes de ejecutar cambios)

| Corte baseline | Ventana medida | Tiempo venta directa P50 (min) | Tiempo venta directa P90 (min) | Conversión reserva→venta (%) | Errores validación venta directa (x100) | Errores validación reserva (x100) | Errores validación conversión (x100) | Responsable de carga | Fecha de aprobación |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Pre-Sprint 2 | [AAAA-MM-DD a AAAA-MM-DD] | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Pre-Sprint 3 | [AAAA-MM-DD a AAAA-MM-DD] | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

### 4.3 Criterio de validez del baseline
- Se considera válido cuando:
  - incluye ambas ventanas (pre-S2 y pre-S3),
  - tiene aprobación de Líder comercial + Tech Lead,
  - no presenta huecos de captura críticos no resueltos.

---

## 5) Criterios de aceptación por sprint vinculados a KPIs

### Sprint 2 — Capa de datos por dominio
**Objetivo de impacto esperado:** confiabilidad y consistencia de medición, sin degradación operativa.

**Criterios de aceptación KPI:**
1. Cobertura de eventos para los 3 KPIs >= 95% (sin campos críticos nulos).
2. Tiempo de venta directa P50 no empeora más de 5% respecto a baseline pre-S2.
3. Errores de validación por flujo no aumentan más de 10% respecto a baseline pre-S2.
4. Tablero semanal publicado durante 2 cortes consecutivos sin incidencias de calidad severa.

### Sprint 3 — Rediseño de flujo comercial
**Objetivo de impacto esperado:** mejorar eficiencia de venta directa y conversión reserva→venta.

**Criterios de aceptación KPI:**
1. Reducción mínima de 15% en tiempo de venta directa P50 vs baseline pre-S3.
2. Mejora mínima de +8 puntos porcentuales en conversión reserva→venta vs baseline pre-S3.
3. Reducción mínima de 20% en errores de validación de flujo de venta directa vs baseline pre-S3.
4. No degradación de más de 5% en errores de validación del flujo de reserva.

### Regla de decisión (Go/No-Go)
- Si se cumplen al menos 3 de 4 criterios de Sprint 3 y no hay degradaciones críticas de operación, el cambio se considera **Go**.
- Si fallan 2 o más criterios críticos, se ejecuta plan de remediación y nueva medición antes de escalar despliegue.

---

## 6) Plantilla de seguimiento semanal

> Usar esta plantilla en cada corte semanal de KPIs.

### 6.1 Encabezado
- Semana (ISO):
- Ventana analizada:
- Responsable de elaboración:
- Fecha/hora de corte:
- Estado del reporte: Completo / Parcial / Con incidencia

### 6.2 Resumen ejecutivo (1 bloque)
- Resultado general vs baseline: Mejora / Estable / Degradación
- KPI con mejor evolución:
- KPI con mayor riesgo:
- Acción inmediata propuesta:

### 6.3 Tabla de evolución semanal

| KPI | Baseline de referencia | Semana actual | Variación absoluta | Variación % | Estado (verde/amarillo/rojo) | Comentario |
|---|---:|---:|---:|---:|---|---|
| Tiempo venta directa P50 (min) |  |  |  |  |  |  |
| Tiempo venta directa P90 (min) |  |  |  |  |  |  |
| Conversión reserva→venta (%) |  |  |  |  |  |  |
| Errores validación venta directa (x100) |  |  |  |  |  |  |
| Errores validación reserva (x100) |  |  |  |  |  |  |
| Errores validación conversión (x100) |  |  |  |  |  |  |

### 6.4 Incidencias y acciones
- Incidencias de datos detectadas:
- Causas probables:
- Acciones correctivas:
- Owner por acción:
- Fecha compromiso:

### 6.5 Decisiones de gestión
- ¿Se mantiene plan del sprint?: Sí / No
- Ajustes de prioridad:
- Riesgos para próxima semana:
- Necesidades de soporte (producto/tecnología/operación):

---

## 7) Checklist operativo de cierre semanal
- [ ] Query de extracción ejecutada y versionada.
- [ ] Validaciones de calidad de datos completadas.
- [ ] Tabla semanal actualizada y revisada.
- [ ] Comparativa contra baseline documentada.
- [ ] Incidencias registradas con owner y fecha.
- [ ] Reporte socializado con Comercial + Tecnología.

