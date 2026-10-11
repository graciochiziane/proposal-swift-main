-- =============================================
-- Phase 2.5: Fix invitation + member RPCs
-- =============================================
-- BUGS FIXed:
--   B1: Non-members can't see own invites (no SELECT RLS)
--   B2+B3: accept/acceptByToken duplicate logic, token RPC doesn't verify email
--   B4: transferOwnership race condition (two separate UPDATEs)
--
-- All functions are SECURITY DEFINER to bypass RLS where needed.

-- ─── 1. List pending invitations by email (InvitationBanner) ───
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations(p_email text)
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
    o.nome AS org_nome
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.email = p_email
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
$$;

-- ─── 2. Get single invitation for acceptance by ID + email ───
CREATE OR REPLACE FUNCTION public.get_invitation_for_accept(p_id uuid, p_email text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email text,
  role org_role,
  token text,
  invited_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    i.id, i.organization_id, i.email, i.role, i.token,
    i.invited_by, i.accepted_at, i.expires_at, i.created_at
  FROM public.organization_invitations i
  WHERE i.id = p_id
    AND i.email = p_email
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
$$;

-- ─── 3. Accept invitation (atomic — single RPC, no race condition) ───
-- Checks: valid invite, email match, not already member, not already in another org.
-- Actions: insert membership + mark accepted + update profile org — all in one tx.
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_invitation_id uuid,
  p_user_id uuid,
  p_user_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite RECORD;
  v_existing_org uuid;
BEGIN
  -- 1. Fetch and validate invitation
  SELECT i.id, i.organization_id, i.role, i.invited_by, i.email
    INTO v_invite
    FROM public.organization_invitations i
    WHERE i.id = p_invitation_id
      AND i.email = p_user_email
      AND i.accepted_at IS NULL
      AND i.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite nao encontrado ou expirado';
  END IF;

  -- 2. Check if already member of THIS org
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = v_invite.organization_id
  ) THEN
    RAISE EXCEPTION 'Ja e membro desta organizacao';
  END IF;

  -- 3. (REMOVED: multi-org is now allowed — users can join multiple orgs)

  -- 4. Insert membership
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_invite.organization_id, p_user_id, v_invite.role, v_invite.invited_by);

  -- 5. Mark invitation as accepted
  UPDATE public.organization_invitations
    SET accepted_at = now()
    WHERE id = p_invitation_id;

  -- 6. Update profile.organization_id only if NULL (set initial active org)
  UPDATE public.profiles
    SET organization_id = v_invite.organization_id
    WHERE id = p_user_id
      AND organization_id IS NULL;
END;
$$;

-- ─── 4. Transfer ownership (atomic) ───
-- Downgrades current owner to admin, upgrades target to owner.
-- Single RPC = single transaction = no race condition.
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  p_current_owner_id uuid,
  p_target_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_role org_role;
  v_target_user_id uuid;
  v_target_role org_role;
  v_same_org boolean;
BEGIN
  -- 1. Verify caller is owner
  SELECT role INTO v_owner_role
    FROM public.organization_members
    WHERE user_id = p_current_owner_id;

  IF v_owner_role IS NULL OR v_owner_role != 'owner' THEN
    RAISE EXCEPTION 'Apenas o owner pode transferir a propriedade';
  END IF;

  -- 2. Fetch target member
  SELECT user_id, role, organization_id INTO v_target_user_id, v_target_role, v_same_org
    FROM public.organization_members
    WHERE id = p_target_member_id;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro de destino nao encontrado';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Membro ja e owner';
  END IF;

  IF v_target_user_id = p_current_owner_id THEN
    RAISE EXCEPTION 'Nao pode transferir para si mesmo';
  END IF;

  -- 3. Atomic swap: owner -> admin, target -> owner
  UPDATE public.organization_members SET role = 'admin'
    WHERE user_id = p_current_owner_id;

  UPDATE public.organization_members SET role = 'owner'
    WHERE id = p_target_member_id;
END;
$$;