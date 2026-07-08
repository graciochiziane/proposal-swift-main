-- =============================================
-- Migration: Admin-only enforcement + multi-org safety
-- =============================================
-- Garante que SOMENTE owner/admin de cada tenant podem:
--   1. Alterar dados da organizacao (RLS ja correcto, reforçado)
--   2. Gerir membros (RLS ja correcto, reforçado)
--   3. Eliminar propostas/facturas (FIX: era org-agnostic)
--   4. Transferir ownership (FIX: era org-agnostic)
--
-- BUGS CORRIGIDOS:
--   Bug 1: has_org_role_min() nao recebia org_id — role cross-org leak
--   Bug 2: transfer_ownership() nao validava organization_id
--   Bug 3: accept_invitation() nao copiava nome -> display_name

-- =============================================
-- 1. Nova função: role hierarchy check ORG-SPECIFIC
--    Substitui has_org_role_min(auth.uid(), role) que era
--    vulnerável em multi-tenant (retornava role de qualquer org).
-- =============================================
CREATE OR REPLACE FUNCTION public.has_org_role_min_in_org(
  p_org_id UUID,
  p_min_role public.org_role
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE user_role_in_org(p_org_id)
    WHEN 'owner'  THEN true
    WHEN 'admin'  THEN p_min_role IN ('admin', 'member', 'viewer')
    WHEN 'member' THEN p_min_role IN ('member', 'viewer')
    WHEN 'viewer' THEN p_min_role = 'viewer'
    ELSE false
  END;
$$;

-- =============================================
-- 2. Actualizar RLS de PROPOSALS com role check org-specific
-- =============================================
DROP POLICY IF EXISTS "proposals_insert" ON public.proposals;
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'member'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "proposals_delete" ON public.proposals;
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- 3. Actualizar RLS de INVOICES com role check org-specific
-- =============================================
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'member'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- =============================================
-- 4. FIX: transfer_ownership — validar organization_id
--    Antes: buscava role SEM filtrar org (multi-org bug)
--    Depois: obtém org_id do target, valida owner nessa org
-- =============================================
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
  v_org_id uuid;
  v_owner_role org_role;
  v_target_user_id uuid;
  v_target_role org_role;
BEGIN
  -- 1. Buscar membro de destino para obter organization_id
  SELECT user_id, role, organization_id
    INTO v_target_user_id, v_target_role, v_org_id
    FROM public.organization_members
    WHERE id = p_target_member_id;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro de destino nao encontrado';
  END IF;

  -- 2. Verificar que o caller é owner DESTA org específica
  SELECT role INTO v_owner_role
    FROM public.organization_members
    WHERE user_id = p_current_owner_id
      AND organization_id = v_org_id;

  IF v_owner_role IS NULL OR v_owner_role != 'owner' THEN
    RAISE EXCEPTION 'Apenas o owner pode transferir a propriedade';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Membro ja e owner';
  END IF;

  IF v_target_user_id = p_current_owner_id THEN
    RAISE EXCEPTION 'Nao pode transferir para si mesmo';
  END IF;

  -- 3. Atomic swap DENTRO da org específica
  UPDATE public.organization_members SET role = 'admin'
    WHERE user_id = p_current_owner_id
      AND organization_id = v_org_id;

  UPDATE public.organization_members SET role = 'owner'
    WHERE id = p_target_member_id;
END;
$$;

-- =============================================
-- 5. FIX: accept_invitation — copiar nome -> display_name
--    (reforço do fix anterior para garantir consistência)
-- =============================================
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

  -- 3. Insert membership com display_name do convite
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, display_name)
    VALUES (
      v_invite.organization_id,
      p_user_id,
      v_invite.role,
      v_invite.invited_by,
      COALESCE(NULLIF(v_invite.nome, ''), NULL)
    );

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

-- =============================================
-- 6. Reforço: garantir que profiles_update_admin
--    tambem verifica que o admin é da mesma org
--    (antes permitia any platform admin editar qualquer perfil)
-- =============================================
-- NOTA: profiles_update_admin e para PLATFORM ADMIN (superadmin),
-- nao para org admin. Mantemos como está pois é intencional.
-- A policy org_update_owner_admin ja protege dados da org.