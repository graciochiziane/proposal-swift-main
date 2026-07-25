-- ============================================================
-- Fase 3.2: Bloquear organizações suspensas
-- - Org suspensa não pode criar propostas (via enforce_proposal_limit)
-- - Org suspensa não pode gerar IA (novo trigger)
-- ============================================================

-- ==============================================
-- 1. Adicionar verificação de suspensão ao
--    enforce_proposal_limit (já existe, fazemos
--    CREATE OR REPLACE para adicionar o check)
-- ==============================================
CREATE OR REPLACE FUNCTION public.enforce_proposal_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_plano public.plan_tier;
  v_count INT;
  v_reset TIMESTAMPTZ;
  v_limit INT;
  v_suspended TIMESTAMPTZ;
BEGIN
  v_org_id := NEW.organization_id;

  IF v_org_id IS NOT NULL THEN
    -- CHECK 3.2: Org suspensa?
    SELECT suspended_at INTO v_suspended
      FROM public.organizations WHERE id = v_org_id FOR UPDATE;

    IF v_suspended IS NOT NULL THEN
      RAISE EXCEPTION 'ORG_SUSPENDED: esta organizacao esta suspensa. Contacte o suporte.';
    END IF;

    SELECT plano, propostas_mes_count, propostas_mes_reset_at
      INTO v_plano, v_count, v_reset
    FROM public.organizations WHERE id = v_org_id;

    IF v_plano IS NULL THEN
      RAISE EXCEPTION 'Organization not found for proposal';
    END IF;

    IF now() >= v_reset THEN
      v_count := 0;
      v_reset := date_trunc('month', now()) + INTERVAL '1 month';
    END IF;

    SELECT propostas_mes INTO v_limit FROM public.plan_limits WHERE plano = v_plano;

    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: limite de % propostas/mes atingido no plano %', v_limit, v_plano;
    END IF;

    UPDATE public.organizations
    SET propostas_mes_count = v_count + 1,
        propostas_mes_reset_at = v_reset
    WHERE id = v_org_id;

  ELSE
    SELECT plano, propostas_mes_count, propostas_mes_reset_at
      INTO v_plano, v_count, v_reset
      FROM public.profiles WHERE id = NEW.owner_id FOR UPDATE;

    IF v_plano IS NULL THEN
      RAISE EXCEPTION 'Profile not found for user %', NEW.owner_id;
    END IF;

    IF now() >= v_reset THEN
      v_count := 0;
      v_reset := date_trunc('month', now()) + INTERVAL '1 month';
    END IF;

    SELECT propostas_mes INTO v_limit FROM public.plan_limits WHERE plano = v_plano;

    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: limite de % propostas/mes atingido no plano %', v_limit, v_plano;
    END IF;

    UPDATE public.profiles
    SET propostas_mes_count = v_count + 1,
        propostas_mes_reset_at = v_reset
    WHERE id = NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================
-- 2. Novo trigger: bloquear IA para org suspensa
-- ==============================================
CREATE OR REPLACE FUNCTION public.enforce_ia_suspended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suspended TIMESTAMPTZ;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT suspended_at INTO v_suspended
    FROM public.organizations
    WHERE id = NEW.organization_id;

  IF v_suspended IS NOT NULL THEN
    RAISE EXCEPTION 'ORG_SUSPENDED: esta organizacao esta suspensa. Geração IA bloqueada.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ia_suspended ON public.proposta_ai;
CREATE TRIGGER trg_enforce_ia_suspended
  BEFORE INSERT ON public.proposta_ai
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ia_suspended();
