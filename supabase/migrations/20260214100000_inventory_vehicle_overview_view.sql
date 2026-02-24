begin;

create or replace view public.inventory_vehicle_overview as
select
  v.id,
  v.org_id,
  v.license_plate,
  v.vin,
  v.brand,
  v.line,
  v.model_year,
  v.vehicle_class,
  v.stage_code,
  v.mileage_km,
  v.fuel_type,
  v.transmission,
  v.color,
  v.branch_id,
  v.is_archived,
  v.created_at,
  b.name as branch_name,
  vs.name as stage_name,
  coalesce(vl.is_listed, false) as is_listed,
  vl.listed_price_cop,
  vc.soat_expires_at,
  vc.tecnomecanica_expires_at,
  coalesce(vc.has_fines, false) as has_fines,
  vc.fines_amount_cop
from public.vehicles v
left join public.branches b on b.id = v.branch_id
left join public.vehicle_stages vs on vs.code = v.stage_code
left join public.vehicle_listing vl on vl.vehicle_id = v.id
left join public.vehicle_compliance vc on vc.vehicle_id = v.id;

comment on view public.inventory_vehicle_overview is
  'Read model for inventory list/kanban: vehicles + stage + branch + listing + compliance.';

grant select on public.inventory_vehicle_overview to authenticated;

commit;
