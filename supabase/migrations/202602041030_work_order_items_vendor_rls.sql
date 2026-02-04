-- P0: Vendor NO debe tener ALL sobre work_order_items.
-- - Admin/Operations mantienen ALL
-- - Vendor: SELECT ya existe (assigned_to = auth.uid())
-- - Vendor: UPDATE solo sobre items asignados
-- - Trigger: Vendor NO puede mutar columnas estructurales (org_id, work_order_id, title, operation_id, assigned_to)

begin;

-- 1) Re-crear policy interna SIN vendor
drop policy if exists work_order_items_manage_internal on public.work_order_items;

create policy work_order_items_manage_internal
on public.work_order_items
for all
to authenticated
using (
  (org_id = app_current_org_id())
  and (app_current_role() = any (array['admin'::text, 'operations'::text]))
)
with check (
  (org_id = app_current_org_id())
  and (app_current_role() = any (array['admin'::text, 'operations'::text]))
);

-- 2) Vendor update (solo filas asignadas)
drop policy if exists work_order_items_vendor_update on public.work_order_items;

create policy work_order_items_vendor_update
on public.work_order_items
for update
to authenticated
using (
  (org_id = app_current_org_id())
  and (app_current_role() = 'vendor'::text)
  and (assigned_to = auth.uid())
)
with check (
  (org_id = app_current_org_id())
  and (app_current_role() = 'vendor'::text)
  and (assigned_to = auth.uid())
  and (status = any (array['pending'::text, 'in_progress'::text, 'done'::text, 'blocked'::text]))
);

-- 3) Trigger para evitar que vendor cambie columnas estructurales
create or replace function public.prevent_vendor_work_order_item_mutation()
returns trigger
language plpgsql
as $$
begin
  if app_current_role() = 'vendor' then
    if new.org_id <> old.org_id
      or new.work_order_id <> old.work_order_id
      or new.title <> old.title
      or (new.operation_id is distinct from old.operation_id)
      or (new.assigned_to is distinct from old.assigned_to)
    then
      raise exception 'Vendors can only update status/notes/completed/due fields on assigned items';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_vendor_work_order_item_mutation on public.work_order_items;

create trigger trg_prevent_vendor_work_order_item_mutation
before update on public.work_order_items
for each row
execute function public.prevent_vendor_work_order_item_mutation();

commit;
