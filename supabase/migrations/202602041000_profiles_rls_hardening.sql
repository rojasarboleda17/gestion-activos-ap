-- P0: Hardening de RLS en profiles
-- - Evita escalamiento (self update no puede cambiar role/org_id/is_active/branch_id)
-- - Habilita admin update por org
-- - Restringe insert admin a la org actual

begin;

-- Limpieza defensiva (por si ya existe en el proyecto)
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_admin_manage on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

-- Self-update: solo la propia fila y NO permite cambiar campos sensibles
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  -- impedir cambio de org/role/is_active/branch_id
  and org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  and branch_id is not distinct from (select p.branch_id from public.profiles p where p.id = auth.uid())
);

-- Admin insert: solo dentro de la org actual
create policy profiles_admin_manage
on public.profiles
for insert
to authenticated
with check (app_is_admin() and org_id = app_current_org_id());

-- Admin update: permite administrar usuarios dentro de la org actual
create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (app_is_admin() and org_id = app_current_org_id())
with check (app_is_admin() and org_id = app_current_org_id());

commit;
