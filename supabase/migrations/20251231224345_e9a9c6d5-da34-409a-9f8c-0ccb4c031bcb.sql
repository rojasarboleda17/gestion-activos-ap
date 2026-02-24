-- Add INSERT policy for audit_log so frontend can write audit entries
CREATE POLICY "audit_insert_authenticated" 
ON public.audit_log 
FOR INSERT 
TO authenticated
WITH CHECK (
  org_id = app_current_org_id() 
  AND actor_id = auth.uid()
);