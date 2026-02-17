# Sprint 2 Contract — Inventario (Vehículos)

## Goal
Stabilize and simplify the inventory module internals without changing the 4-tab navigation.

## In scope
1. Consolidate vehicle sales data fetching into a dedicated hook (`useVehicleSalesData`).
2. Keep direct-sale priority in sales CTAs while preserving reservation path.
3. Continue dead-code cleanup evidence with explicit logs and commit traceability.

## Out of scope
- Full visual redesign of sales flows.
- Permission matrix hardening (Sprint 4).
- KPI instrumentation.

## Acceptance criteria
- Vehicle detail keeps 4 tabs unchanged.
- Sales tab still supports reserve, convert, direct sale and void paths.
- Build passes.
- No references remain to already deleted legacy tabs.

## Release policy
Direct release at sprint end after basic functional validation.
