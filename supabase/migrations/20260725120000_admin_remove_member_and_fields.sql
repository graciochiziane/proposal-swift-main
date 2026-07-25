-- ============================================================
-- Tarefa 1: DB fields + admin_remove_member RPC
-- ============================================================
-- 1. organizations: contact_email, nuit
-- 2. plan_limits: geracoes_ia_mes + RLS UPDATE
-- 3. RPC: admin_remove_member (corrigido: captura user_id antes do DELETE)
-- 4. RLS: Admin DELETE em organization_members (fallback client-side)
-- ============================================================

-- ==============================================
-- 1. organizations: novas colunas
-- ==============================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS nuit TEXT DEFAULT '';

-- ==============================================
-- 2. plan_limits: geracoes_ia_mes + RLS UPDATE
-- ==============================================
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 2147483647;

-- Populacao inicial (se a coluna foi criada agora)
UPDATE public.plan_limits SET geracoes_ia_mes = 2147483647 WHERE geracoes_ia_mes IS NULL;

-- RLS: admin pode actualizar plan_limits (para PlanLimitsManager)
CREATE POLICY "plan_limits_admin_update" ON public.plan_limits
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ==============================================
-- 3. RPC: admin_remove_member
--    Corrigido: captura v_user_id ANTES do DELETE
--    para poder actualizar profiles.organization_id
-- ==============================================
CREATE OR REPLACE FUNCTION public.admin_remove_member(
  p_member_id UUID,
  p_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.org_role;
  v_owner_count INT;
  v_user_id UUID;
BEGIN
  -- Verificar admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins';
  END IF;

  -- Buscar role e user_id ANTES de apagar
  SELECT role, user_id INTO v_role, v_user_id
  FROM public.organization_members
  WHERE id = p_member_id AND organization_id = p_org_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Membro nao encontrado nesta organizacao';
  END IF;

  -- Impedir remocao do ultimo owner
  SELECT COUNT(*) INTO v_owner_count
  FROM public.organization_members
  WHERE organization_id = p_org_id AND role = 'owner';

  IF v_role = 'owner' AND v_owner_count <= 1 THEN
    RAISE EXCEPTION 'Nao e possivel remover o unico owner da organizacao';
  END IF;

  -- Apagar membro
  DELETE FROM public.organization_members
  WHERE id = p_member_id AND organization_id = p_org_id;

  -- Limpar organization_id no profile (usando v_user_id capturado)
  UPDATE public.profiles
    SET organization_id = NULL
  WHERE organization_id = p_org_id
    AND id = v_user_id;

END;
$$;

-- ==============================================
-- 4. RLS: Admin DELETE em organization_members
--    (O RPC e SECURITY DEFINER e bypassa RLS, mas se
--     alguem tentar DELETE directo do client, precisa
--     desta policy como fallback)
-- ==============================================
-- Nota: ja existe "om_manage_owner_admin" para ALL que cobre DELETE
-- para owner/admin da org E platform admin. Nao e necessario
-- adicionar policy adicional.

-- ==============================================
-- 5. RLS: Admin SELECT em plan_limits (ja existe "plan_limits_read")
--    So adicionamos UPDATE acima.
-- ==============================================
