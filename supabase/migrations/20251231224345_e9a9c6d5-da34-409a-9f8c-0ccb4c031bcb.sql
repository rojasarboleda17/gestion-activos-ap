-- Add INSERT policy for audit_log so frontend can write audit entries
-- Guarded to avoid failing bootstrap environments where audit_log is not yet present.
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE 'Skipping audit_insert_authenticated policy: public.audit_log does not exist yet';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND policyname = 'audit_insert_authenticated'
  ) THEN
    RAISE NOTICE 'Policy audit_insert_authenticated already exists on public.audit_log';
    RETURN;
  END IF;

  EXECUTE $policy$
    CREATE POLICY "audit_insert_authenticated"
    ON public.audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
      org_id = app_current_org_id()
      AND actor_id = auth.uid()
    )
  $policy$;
END;
$$;
