# Inventory execution log

## Sprint 2 — Incremental execution trace

### Step S2-01: Extract commercial data hook
- Commit: `ea695de`
- Outcome: introduced `useVehicleSalesData` and reduced data-fetch orchestration inside `VehicleSalesTab`.

### Step S2-02: Contextual primary CTA by active reservation
- Commit: `ea695de`
- Outcome: primary action now changes between direct sale and reservation conversion based on active reservation state.

### Step S2-03: Modularize sales action header (alerts + CTAs)
- Commit: `6e5a687`
- Outcome: split alert/CTA rendering into `VehicleSalesActions` for better maintainability and easier future RBAC gating.

### Step S2-04: Split reservations and sales cards
- Commit: `ac29d89`
- Outcome: moved reservations list and sales list rendering out of `VehicleSalesTab` into focused components to keep the tab as orchestrator.

### Step S2-05: Extract reservation and quick-customer dialogs
- Commit: `e3b9331`
- Outcome: moved reservation creation dialog and quick-customer dialog from `VehicleSalesTab` into dedicated components.

### Step S2-06: Extract convert-reservation and direct-sale dialogs
- Commit: `cc4176f`
- Outcome: moved reservation conversion dialog and direct sale dialog from `VehicleSalesTab` into dedicated components.

### Step S2-07: Extract cancel-reservation and void-sale dialogs
- Commit: `97cf3cb`
- Outcome: moved reservation cancellation and sale void dialogs from `VehicleSalesTab` into dedicated components.

### Step S2-08: Centralize sales dialog state/openers in hook
- Commit: `4c57f76`
- Outcome: moved `VehicleSalesTab` UI state and opener functions into `useVehicleSalesUIState` to keep the tab focused on action handlers.

### Step S2-09: Extract direct-sale and void-sale mutations to hook
- Commit: `e6c70cf`
- Outcome: moved direct sale and void sale mutation logic from `VehicleSalesTab` to `useVehicleSalesMutations`.

### Step S2-10: Extract reservation mutations to hook
- Commit: `5df4af3`
- Outcome: moved create/cancel/convert reservation mutation logic from `VehicleSalesTab` to `useVehicleReservationMutations`.

### Step S2-11: Extract quick-customer mutation to hook
- Commit: `7f4b47a`
- Outcome: moved quick customer creation logic from `VehicleSalesTab` to `useVehicleCustomerMutations`.


### Step S2-12: Centralize shared vehicle-sales domain types
- Commit: `722c0fd`
- Outcome: introduced `src/hooks/vehicle/types.ts` and removed duplicated type/form contracts across sales hooks to reduce drift and maintenance overhead.

### Step S2-13: Harden commercial data loading and fallback behavior
- Commit: `ad36907`
- Outcome: strengthened `useVehicleSalesData` with explicit per-query error checks, safe customer fallback when `orgId` is unavailable, and stable alphabetical customer ordering after quick-create.
