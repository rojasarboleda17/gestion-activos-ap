-- P0: Hardening de RLS en profiles
-- - Evita escalamiento (self update no puede cambiar role/org_id/is_active/branch_id)
-- - Habilita admin update por org
-- - Restringe insert admin a la org actual

-- Bootstrap-safe: ejecutar solo cuando exista public.profiles
DO $profiles_rls_hardening$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'Skipping profiles RLS hardening: public.profiles does not exist yet';
    RETURN;
  END IF;

  -- Limpieza defensiva (por si ya existe en el proyecto)
  DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
  DROP POLICY IF EXISTS profiles_admin_manage ON public.profiles;
  DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;

  -- Self-update: solo la propia fila y NO permite cambiar campos sensibles
  CREATE POLICY profiles_self_update
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- impedir cambio de org/role/is_active/branch_id
    AND org_id = (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    AND branch_id IS NOT DISTINCT FROM (SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid())
  );

  -- Admin insert: solo dentro de la org actual
  CREATE POLICY profiles_admin_manage
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (app_is_admin() AND org_id = app_current_org_id());

  -- Admin update: permite administrar usuarios dentro de la org actual
  CREATE POLICY profiles_admin_update
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (app_is_admin() AND org_id = app_current_org_id())
  WITH CHECK (app_is_admin() AND org_id = app_current_org_id());
END
$profiles_rls_hardening$;
