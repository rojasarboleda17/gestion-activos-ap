-- Atomic reservation->sale conversion to avoid partial states across modules.

begin;

create or replace function public.convert_reservation_to_sale(
  p_reservation_id uuid,
  p_final_price_cop numeric,
  p_payment_method_code text,
  p_notes text default null,
  p_register_deposit_as_payment boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_sale_id uuid;
  v_reservation public.reservations%rowtype;
  v_payment_method_code text;
begin
  v_org_id := app_current_org_id();
  v_role := app_current_role();

  if v_org_id is null then
    raise exception 'Usuario sin organización activa';
  end if;

  if v_role not in ('admin', 'sales') then
    raise exception 'No autorizado para convertir reservas';
  end if;

  if p_final_price_cop is null or p_final_price_cop <= 0 then
    raise exception 'El precio final debe ser mayor a cero';
  end if;

  if p_payment_method_code is null or length(trim(p_payment_method_code)) = 0 then
    raise exception 'Método de pago requerido';
  end if;

  select *
  into v_reservation
  from public.reservations
  where id = p_reservation_id
    and org_id = v_org_id
  for update;

  if not found then
    raise exception 'Reserva no encontrada en tu organización';
  end if;

  if v_reservation.status <> 'active' then
    raise exception 'La reserva no está activa';
  end if;

  if v_reservation.vehicle_id is null then
    raise exception 'La reserva no tiene vehículo asociado';
  end if;

  if v_reservation.customer_id is null then
    raise exception 'La reserva no tiene cliente asociado';
  end if;

  if exists (
    select 1
    from public.sales s
    where s.reservation_id = p_reservation_id
      and s.org_id = v_org_id
      and s.status = 'active'
  ) then
    raise exception 'La reserva ya fue convertida';
  end if;

  insert into public.sales (
    org_id,
    vehicle_id,
    customer_id,
    final_price_cop,
    payment_method_code,
    reservation_id,
    status,
    created_by,
    notes
  )
  values (
    v_org_id,
    v_reservation.vehicle_id,
    v_reservation.customer_id,
    p_final_price_cop,
    p_payment_method_code,
    p_reservation_id,
    'active',
    auth.uid(),
    nullif(trim(p_notes), '')
  )
  returning id into v_sale_id;

  if p_register_deposit_as_payment and coalesce(v_reservation.deposit_amount_cop, 0) > 0 then
    v_payment_method_code := coalesce(v_reservation.payment_method_code, p_payment_method_code);

    insert into public.sale_payments (
      org_id,
      sale_id,
      amount_cop,
      direction,
      payment_method_code,
      notes,
      created_by
    )
    values (
      v_org_id,
      v_sale_id,
      v_reservation.deposit_amount_cop,
      'in',
      v_payment_method_code,
      'Depósito de reserva',
      auth.uid()
    );
  end if;

  update public.vehicles
  set stage_code = 'vendido'
  where id = v_reservation.vehicle_id
    and org_id = v_org_id;

  update public.reservations
  set status = 'converted'
  where id = p_reservation_id
    and org_id = v_org_id;

  return v_sale_id;
end;
$$;

revoke all on function public.convert_reservation_to_sale(uuid, numeric, text, text, boolean) from public;
grant execute on function public.convert_reservation_to_sale(uuid, numeric, text, text, boolean) to authenticated;

commit;
