-- =============================================================================
-- Migration: display_name em organization_members + nome em convites
-- Corrige Bug 2: nome do membro convidado nao visivel
-- =============================================================================

-- 1. Adicionar coluna nome aos convites (preenchido opcionalmente pelo admin)
ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';

-- 2. Adicionar coluna display_name aos membros (nome de exibicao por-org)
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';

-- 3. Corrigir RLS de profiles para usar organization_members em vez de
--    profiles.organization_id (que fica stale para multi-org / membros convidados)
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = profiles.id
        AND om.organization_id = user_org_id(auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Actualizar accept_invitation RPC: copiar invite.nome para display_name
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
  SELECT i.id, i.organization_id, i.role, i.invited_by, i.email, i.nome
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

  -- 3. Insert membership (with display_name from invitation)
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, display_name)
    VALUES (v_invite.organization_id, p_user_id, v_invite.role, v_invite.invited_by,
            COALESCE(NULLIF(v_invite.nome, ''), ''));

  -- 4. Mark invitation as accepted
  UPDATE public.organization_invitations
    SET accepted_at = now()
    WHERE id = p_invitation_id;

  -- 5. Update profile.organization_id only if NULL (set initial active org)
  UPDATE public.profiles
    SET organization_id = v_invite.organization_id
    WHERE id = p_user_id
      AND organization_id IS NULL;
END;
$$;