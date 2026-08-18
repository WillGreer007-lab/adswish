-- 015_admin_audit_rls.sql
-- Fix: admin_audit_logs had RLS enabled with no policies, so the admin
-- audit-log viewer (which reads with the admin's own JWT, not the service
-- role) always rendered an empty list. Writes still go through the service
-- role; this only adds the admin read path.
create policy "Admins can read audit logs"
  on public.admin_audit_logs for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
