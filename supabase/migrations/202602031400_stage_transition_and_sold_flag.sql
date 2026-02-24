-- 1) vendido como bandera
alter table public.vehicles
  add column if not exists sold_at timestamptz,
  add column if not exists sold_by uuid references public.profiles(id),
  add column if not exists sold_sale_id uuid references public.sales(id);

-- 2) trazabilidad al cerrar órdenes
alter table public.work_orders
  add column if not exists closed_by uuid references public.profiles(id);

-- 3) helper: rol del usuario (solo si tiene perfil activo en la org actual)
create or replace function public.app_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
    and org_id = app_current_org_id();
$$;

-- 4) transición de stage con reglas
create or replace function public.transition_vehicle_stage(
  p_vehicle_id uuid,
  p_target_stage text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_archived boolean;
  v_sold_at timestamptz;
  v_current_stage text;

  v_wo record;
  v_total int;
  v_done int;
begin
  v_role := public.app_current_role();
  if v_role is null then
    raise exception 'Usuario sin perfil activo en el sistema';
  end if;

  select is_archived, sold_at, stage_code
    into v_is_archived, v_sold_at, v_current_stage
  from public.vehicles
  where id = p_vehicle_id
    and org_id = app_current_org_id();

  if not found then
    raise exception 'Vehículo no existe o no pertenece a tu organización';
  end if;

  -- vendido: solo admin puede modificar
  if v_sold_at is not null and v_role <> 'admin' then
    raise exception 'Vehículo vendido: solo Admin puede modificar';
  end if;

  -- archivado: solo admin puede modificar
  if v_is_archived = true and v_role <> 'admin' then
    raise exception 'Vehículo archivado: solo Admin puede modificar';
  end if;

  -- Sales: NO puede alistamiento -> publicado (solo publicado <-> bloqueado)
  if v_role = 'sales' then
    if p_target_stage = 'publicado' and v_current_stage <> 'publicado' then
      raise exception 'Sales no puede publicar vehículos';
    end if;
    if p_target_stage not in ('publicado','bloqueado') then
      raise exception 'Sales solo puede alternar publicado/bloqueado';
    end if;
  end if;

  -- Si target es publicado: cerrar TODAS las work orders abiertas (scope vehicle) SOLO si:
  -- - cada orden tiene >=1 item
  -- - todos los items están done/hecho/completed
  if p_target_stage = 'publicado' then
    for v_wo in
      select id
      from public.work_orders
      where vehicle_id = p_vehicle_id
        and org_id = app_current_org_id()
        and scope = 'vehicle'
        and status = 'open'
    loop
      select count(*) into v_total
      from public.work_order_items
      where work_order_id = v_wo.id
        and org_id = app_current_org_id();

      if v_total = 0 then
        raise exception 'No se puede publicar: orden % no tiene ítems. Revisar/borrar.', v_wo.id;
      end if;

      select count(*) into v_done
      from public.work_order_items
      where work_order_id = v_wo.id
        and org_id = app_current_org_id()
        and status in ('done','hecho','completed');

      if v_done < v_total then
        raise exception 'No se puede publicar: orden % incompleta (%/% done).', v_wo.id, v_done, v_total;
      end if;

      update public.work_orders
      set status = 'closed',
          closed_at = now(),
          closed_by = auth.uid()
      where id = v_wo.id
        and org_id = app_current_org_id();

      insert into public.audit_log(org_id, actor_id, entity_type, entity_id, action, metadata)
      values (app_current_org_id(), auth.uid(), 'work_order', v_wo.id, 'work_order_auto_closed',
              jsonb_build_object('reason','publish_transition','vehicle_id',p_vehicle_id));
    end loop;
  end if;

  -- aplicar stage
  update public.vehicles
  set stage_code = p_target_stage
  where id = p_vehicle_id
    and org_id = app_current_org_id();

  -- historial (ORG_ID ES OBLIGATORIO)
  insert into public.vehicle_stage_history(org_id, vehicle_id, from_stage_code, to_stage_code, changed_by, changed_at, metadata)
  values (app_current_org_id(), p_vehicle_id, v_current_stage, p_target_stage, auth.uid(), now(), '{}'::jsonb);

  insert into public.audit_log(org_id, actor_id, entity_type, entity_id, action, metadata)
  values (app_current_org_id(), auth.uid(), 'vehicle', p_vehicle_id, 'stage_changed',
          jsonb_build_object('from',v_current_stage,'to',p_target_stage));
end;
$$;

-- 5) marcar vendido + auto-archivar
create or replace function public.mark_vehicle_sold(
  p_vehicle_id uuid,
  p_sale_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.app_current_role();
  if v_role is null then
    raise exception 'Usuario sin perfil activo en el sistema';
  end if;

  if v_role not in ('admin','sales') then
    raise exception 'No autorizado para marcar vendido';
  end if;

  update public.vehicles
  set sold_at = now(),
      sold_by = auth.uid(),
      sold_sale_id = p_sale_id,
      is_archived = true
  where id = p_vehicle_id
    and org_id = app_current_org_id();

  insert into public.audit_log(org_id, actor_id, entity_type, entity_id, action, metadata)
  values (app_current_org_id(), auth.uid(), 'vehicle', p_vehicle_id, 'vehicle_mark_sold',
          jsonb_build_object('sale_id',p_sale_id,'auto_archived',true));
end;
$$;

-- permisos
revoke all on function public.app_current_role() from public;
revoke all on function public.transition_vehicle_stage(uuid, text) from public;
revoke all on function public.mark_vehicle_sold(uuid, uuid) from public;

grant execute on function public.app_current_role() to authenticated;
grant execute on function public.transition_vehicle_stage(uuid, text) to authenticated;
grant execute on function public.mark_vehicle_sold(uuid, uuid) to authenticated;
