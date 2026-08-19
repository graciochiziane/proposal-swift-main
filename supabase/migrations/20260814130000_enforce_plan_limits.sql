-- ============================================================
-- FASE 3: Fix broken functionality — enforce plan limits via triggers
--
-- 1. enforce_client_limit — valida limite de clientes por plano
-- 2. enforce_ia_generation_limit — valida limite de IA mensal por org
-- ============================================================

-- ============================================================
-- 1. enforce_client_limit — trigger BEFORE INSERT on clients
--    Verifica se a org atingiu o limite de clientes do plano
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_client_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_plano public.plan_tier;
  v_clientes_max INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Determinar org_id (pode vir de organization_id ou owner_id legacy)
  IF NEW.organization_id IS NOT NULL THEN
    v_org_id := NEW.organization_id;
  ELSE
    -- Solo user: sem limite de clientes
    RETURN NEW;
  END IF;

  -- Buscar plano da org e limite
  SELECT o.plano INTO v_plano
  FROM public.organizations o
  WHERE o.id = v_org_id AND o.suspended_at IS NULL;

  IF v_plano IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada ou suspensa';
  END IF;

  -- Buscar limite de clientes
  SELECT clientes_max INTO v_clientes_max
  FROM public.plan_limits
  WHERE plano = v_plano;

  -- Se clientes_max é NULL (ilimitado), permitir
  IF v_clientes_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar clientes actuais da org
  SELECT COUNT(*) INTO v_current_count
  FROM public.clients
  WHERE organization_id = v_org_id;

  IF v_current_count >= v_clientes_max THEN
    RAISE EXCEPTION 'Limite de clientes atingido (%) para o plano %',
      v_clientes_max, v_plano;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trg_enforce_client_limit ON public.clients;
CREATE TRIGGER trg_enforce_client_limit
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_limit();

-- ============================================================
-- 2. enforce_ia_generation_limit — trigger BEFORE INSERT on proposta_ai
--    Verifica se a org atingiu o limite de gerações IA mensais
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_ia_generation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_plano public.plan_tier;
  v_ia_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Determinar org_id
  IF NEW.organization_id IS NOT NULL THEN
    v_org_id := NEW.organization_id;
  ELSE
    -- Fallback: buscar via user_id (legacy single-tenant)
    SELECT organization_id INTO v_org_id
    FROM public.profiles WHERE id = NEW.user_id;
    IF v_org_id IS NULL THEN
      RETURN NEW; -- não consegue determinar org, permitir
    END IF;
  END IF;

  -- Buscar plano da org
  SELECT o.plano INTO v_plano
  FROM public.organizations o
  WHERE o.id = v_org_id AND o.suspended_at IS NULL;

  IF v_plano IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada ou suspensa';
  END IF;

  -- Buscar limite de IA
  SELECT geracoes_ia_mes INTO v_ia_limit
  FROM public.plan_limits
  WHERE plano = v_plano;

  -- Se ilimitado, permitir
  IF v_ia_limit IS NULL OR v_ia_limit >= 2147483647 THEN
    RETURN NEW;
  END IF;

  -- Contar gerações IA este mês para a org
  SELECT COUNT(*) INTO v_current_count
  FROM public.proposta_ai
  WHERE organization_id = v_org_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())
    AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM now());

  IF v_current_count >= v_ia_limit THEN
    RAISE EXCEPTION 'Limite de gerações IA mensais atingido (%) para o plano %',
      v_ia_limit, v_plano;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_enforce_ia_generation_limit ON public.proposta_ai;
CREATE TRIGGER trg_enforce_ia_generation_limit
  BEFORE INSERT ON public.proposta_ai
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ia_generation_limit();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON FUNCTION public.enforce_client_limit() IS
'FASE 3: Trigger BEFORE INSERT on clients. Verifica limite de clientes do plano (plan_limits.clientes_max).';

COMMENT ON FUNCTION public.enforce_ia_generation_limit() IS
'FASE 3: Trigger BEFORE INSERT on proposta_ai. Verifica limite de IA mensal (plan_limits.geracoes_ia_mes). Substitui verificação apenas no Edge Function.';
