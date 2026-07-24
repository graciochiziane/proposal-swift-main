-- ============================================================
-- Admin Tenant Fields: colunas novas + trigger + RPCs
-- Fase 4 do SuperAdmin Panel
-- ============================================================

-- 1. Novas colunas na tabela organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS last_proposal_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orgs_suspended ON public.organizations(suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_last_proposal ON public.organizations(last_proposal_created_at DESC);

-- 2. Tabela admin_audit_log (se nao existir)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  target_owner_id UUID,
  target_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.admin_audit_log(admin_id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_select" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_admin_insert" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Trigger: actualizar last_proposal_created_at quando uma proposta e criada
CREATE OR REPLACE FUNCTION public.update_org_last_proposal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations
    SET last_proposal_created_at = NEW.created_at
  WHERE id = NEW.organization_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_org_last_proposal ON public.proposals;
CREATE TRIGGER trg_update_org_last_proposal
  AFTER INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_org_last_proposal();

-- 4. RPC: Suspender/Reactivar tenant
CREATE OR REPLACE FUNCTION public.admin_toggle_suspend(
  p_org_id UUID,
  p_suspend BOOLEAN,
  p_reason TEXT DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins';
  END IF;

  IF p_suspend THEN
    UPDATE public.organizations
      SET suspended_at = now(), suspension_reason = p_reason
    WHERE id = p_org_id;
  ELSE
    UPDATE public.organizations
      SET suspended_at = NULL, suspension_reason = NULL
    WHERE id = p_org_id;
  END IF;
END;
$$;

-- 5. RPC: Health score do tenant
CREATE OR REPLACE FUNCTION public.organization_health_score(p_org_id UUID)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_days int;
BEGIN
  SELECT last_proposal_created_at INTO v_last
  FROM public.organizations WHERE id = p_org_id;

  IF v_last IS NULL THEN RETURN 0; END IF;

  v_days := extract(day from now() - v_last)::int;
  IF v_days <= 1 THEN RETURN 100; END IF;
  IF v_days <= 3 THEN RETURN 80; END IF;
  IF v_days <= 7 THEN RETURN 60; END IF;
  IF v_days <= 14 THEN RETURN 40; END IF;
  IF v_days <= 30 THEN RETURN 20; END IF;
  RETURN 0;
END;
$$;

-- 6. RLS: Admin pode ver e actualizar todas as organizations
DROP POLICY IF EXISTS "admin_see_all_orgs" ON public.organizations;
CREATE POLICY "admin_see_all_orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_update_orgs" ON public.organizations;
CREATE POLICY "admin_update_orgs" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. RLS: Admin pode ver membros de qualquer org
DROP POLICY IF EXISTS "admin_see_all_members" ON public.organization_members;
CREATE POLICY "admin_see_all_members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
