-- =============================================
-- Fix: PostgREST profile join FKs
-- =============================================
-- PostgREST follows DIRECT foreign key relationships for embedded joins.
-- organization_members.user_id -> auth.users(id) FK exists,
-- and profiles.id -> auth.users(id) FK exists, but PostgREST cannot
-- follow the indirect chain org_members -> auth.users <- profiles.
--
-- The services adminService.ts (getTenantMembers, getAuditLog) and
-- memberService.ts use profiles!inner(...) joins that require a
-- DIRECT FK from the source table to profiles.
--
-- These redundant FKs solve the issue without breaking existing data
-- or the auth.users FKs (both FKs can coexist on the same column).

ALTER TABLE public.organization_members
  ADD CONSTRAINT om_user_id_profile_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT aal_admin_id_profile_fk
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;