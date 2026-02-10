-- Post-deploy audit checklist (PASS/FAIL)
-- Ejecutar después de aplicar migraciones en el entorno objetivo.

with
required_migrations(version) as (
  values
    ('20251231201100'), -- set_updated_at hardening
    ('20251231224345'), -- audit_log insert policy
    ('202602031400'),   -- app_current_role + stage/sold RPCs
    ('202602041000'),   -- profiles RLS hardening
    ('202602091700'),   -- grant select on public.profiles
    ('202602091900')    -- convert_reservation_to_sale RPC
),
migration_history as (
  select version, inserted_at
  from supabase_migrations.schema_migrations
),
checks as (
  -- 1) Historial de migraciones
  select
    'migrations.history_accessible'::text as check_name,
    case when exists (select 1 from migration_history) then 'PASS' else 'FAIL' end as status,
    case
      when exists (select 1 from migration_history)
        then 'schema_migrations tiene registros (' || (select count(*)::text from migration_history) || ')'
      else 'schema_migrations vacío o inaccesible'
    end as detail

  union all

  select
    'migrations.history_no_duplicates',
    case
      when exists (
        select 1
        from migration_history
        group by version
        having count(*) > 1
      ) then 'FAIL'
      else 'PASS'
    end,
    case
      when exists (
        select 1
        from migration_history
        group by version
        having count(*) > 1
      ) then 'Hay versiones duplicadas en supabase_migrations.schema_migrations'
      else 'Sin versiones duplicadas en schema_migrations'
    end

  union all

  select
    'migrations.required_versions_present',
    case
      when exists (
        select 1
        from required_migrations rm
        left join migration_history mh on mh.version like rm.version || '%'
        where mh.version is null
      ) then 'FAIL'
      else 'PASS'
    end,
    case
      when exists (
        select 1
        from required_migrations rm
        left join migration_history mh on mh.version like rm.version || '%'
        where mh.version is null
      ) then 'Faltan versiones requeridas para funciones/policies/grants críticos'
      else 'Todas las versiones requeridas están presentes en schema_migrations'
    end

  -- 2) Funciones críticas
  union all

  select
    'functions.set_updated_at_exists',
    case when to_regprocedure('public.set_updated_at()') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.set_updated_at()') is not null then 'Función encontrada' else 'Función no encontrada' end

  union all

  select
    'functions.app_current_role_exists',
    case when to_regprocedure('public.app_current_role()') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.app_current_role()') is not null then 'Función encontrada' else 'Función no encontrada' end

  union all

  select
    'functions.transition_vehicle_stage_exists',
    case when to_regprocedure('public.transition_vehicle_stage(uuid,text)') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.transition_vehicle_stage(uuid,text)') is not null then 'Función encontrada' else 'Función no encontrada' end

  union all

  select
    'functions.mark_vehicle_sold_exists',
    case when to_regprocedure('public.mark_vehicle_sold(uuid,uuid)') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.mark_vehicle_sold(uuid,uuid)') is not null then 'Función encontrada' else 'Función no encontrada' end

  union all

  select
    'functions.convert_reservation_to_sale_exists',
    case when to_regprocedure('public.convert_reservation_to_sale(uuid,numeric,text,text,boolean)') is not null then 'PASS' else 'FAIL' end,
    case when to_regprocedure('public.convert_reservation_to_sale(uuid,numeric,text,text,boolean)') is not null then 'Función encontrada' else 'Función no encontrada' end

  -- 3) Policies de profiles y audit_log
  union all

  select
    'policies.profiles_self_update_exists',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_update'
    ) then 'PASS' else 'FAIL' end,
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_update'
    ) then 'Policy encontrada' else 'Policy no encontrada' end

  union all

  select
    'policies.profiles_admin_manage_exists',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_admin_manage'
    ) then 'PASS' else 'FAIL' end,
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_admin_manage'
    ) then 'Policy encontrada' else 'Policy no encontrada' end

  union all

  select
    'policies.profiles_admin_update_exists',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_admin_update'
    ) then 'PASS' else 'FAIL' end,
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_admin_update'
    ) then 'Policy encontrada' else 'Policy no encontrada' end

  union all

  select
    'policies.audit_log_insert_exists',
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'audit_log'
        and policyname = 'audit_insert_authenticated'
    ) then 'PASS' else 'FAIL' end,
    case when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'audit_log'
        and policyname = 'audit_insert_authenticated'
    ) then 'Policy encontrada' else 'Policy no encontrada' end

  -- 4) Grants de public.profiles
  union all

  select
    'grants.public_profiles_select_authenticated',
    case when has_table_privilege('authenticated', 'public.profiles', 'SELECT') then 'PASS' else 'FAIL' end,
    case when has_table_privilege('authenticated', 'public.profiles', 'SELECT')
      then 'authenticated tiene SELECT sobre public.profiles'
      else 'Falta grant SELECT para authenticated sobre public.profiles'
    end
)
select
  check_name,
  status,
  detail
from checks
order by
  case status when 'FAIL' then 0 else 1 end,
  check_name;
