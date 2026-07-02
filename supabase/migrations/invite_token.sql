-- =============================================
-- 2.1: Token field for invitation links
-- =============================================
-- Adds a unique token to invitations so they can be shared via URL
-- without exposing the internal ID.

ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS token text UNIQUE;

-- Backfill any existing rows
UPDATE public.organization_invitations SET token = gen_random_uuid()::text WHERE token IS NULL;

ALTER TABLE public.organization_invitations ALTER COLUMN token SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.organization_invitations ALTER COLUMN token SET NOT NULL;

-- =============================================
-- RPC: get_invitation_by_token (replaces leaky RLS policy)
-- =============================================
-- SECURITY DEFINER bypasses RLS. Only returns data for the
-- exact token provided. No data leak — caller must know UUID.
-- Returns only fields needed for the accept page.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email text,
  role org_role,
  token text,
  invited_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  org_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.organization_id, i.email, i.role, i.token,
    i.invited_by, i.accepted_at, i.expires_at, i.created_at,
    o.nome as org_nome
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
$$;