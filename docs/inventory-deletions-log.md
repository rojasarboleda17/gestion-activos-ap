# Inventory module deletions log

## Scope
Cleanup pass focused on `src/components/vehicle` to remove unused legacy tabs that are not mounted in active admin routes.

## Removed files

1. `src/components/vehicle/VehicleFinancialsTab.tsx`
   - Reason: not referenced by active pages/routes.
   - Replacement: no direct replacement; financial and sales summaries remain covered by active `VehicleSummaryTab` and `VehicleSalesTab` flows.

2. `src/components/vehicle/VehicleHistoryTab.tsx`
   - Reason: not referenced by active pages/routes.
   - Replacement: no direct replacement in UI yet; future timeline/history UX can be reintroduced as a scoped module when required.

3. `src/components/vehicle/VehicleListingTab.tsx`
   - Reason: not referenced by active pages/routes.
   - Replacement: listing/commercial data updates are currently handled in active acquisition/commercial flows.

## Verification method
- Searched all `src/` references before deletion.
- Confirmed none of these files were imported outside themselves.
