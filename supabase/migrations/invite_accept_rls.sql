-- =============================================
-- INVITATION ACCEPT: RLS policies
-- =============================================
-- Allows an invited user (who is NOT yet a member) to:
-- 1. INSERT themselves into organization_members (om_accept_invitation)
-- 2. UPDATE the invitation to mark it as accepted (oi_accept)
--
-- SECURITY MODEL:
-- The user can ONLY insert into organization_members when ALL conditions
-- are met simultaneously:
--   - user_id = auth.uid()             (can only add themselves)
--   - A valid invitation exists where:
--       - organization_id matches the row being inserted
--       - email matches the user's profile email
--       - accepted_at IS NULL           (not already accepted)
--       - expires_at > now()             (not expired)
--
-- This prevents:
-- - Self-invite: no invitation row exists for that org+email
-- - Cross-org invite: invitation's org_id must match
-- - Email spoof: invitation email must match profile email
-- - Replay: accepted_at check prevents double-accept
-- - Expired invite: expires_at check

CREATE POLICY om_accept_invitation ON public.organization_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_invitations i
      WHERE i.organization_id = organization_members.organization_id
        AND i.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        AND i.accepted_at IS NULL
        AND i.expires_at > now()
    )
  );

CREATE POLICY oi_accept ON public.organization_invitations
  FOR UPDATE USING (
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now()
  )
  WITH CHECK (
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );