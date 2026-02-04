-- P1: Permite revertir el flag de vendido (sold_at/sold_sale_id) y desarchivar el vehículo
-- Uso típico: anulación de venta

create or replace function public.unmark_vehicle_sold(
  p_vehicle_id uuid,
  p_sale_id uuid
)
returns void
language plpgsql
as $$
begin
  if not app_is_admin() then
    raise exception 'Only admins can unmark sold vehicles';
  end if;

  update public.vehicles
     set sold_at = null,
         sold_sale_id = null,
         is_archived = false,
         updated_at = now()
   where id = p_vehicle_id
     and org_id = app_current_org_id()
     and sold_sale_id = p_sale_id;

  if not found then
    raise exception 'Vehicle not found, not in org, or sold_sale_id does not match sale';
  end if;
end;
$$;
