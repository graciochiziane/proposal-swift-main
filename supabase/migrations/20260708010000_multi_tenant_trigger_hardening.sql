-- =============================================
-- Migration: Multi-tenant trigger/function hardening
-- =============================================
-- Corrige 5 bugs em funções/triggers que violam
-- o isolamento multi-tenant.
--
-- BUG 1: enforce_proposal_limit() usava user_org_id() que
--         retorna org aleatória para multi-org users.
--         AGORA usa NEW.organization_id directamente.
--
-- BUG 2: set_proposal_numero() contava por owner_id.
--         AGORA conta por organization_id (sequencial por org).
--
-- BUG 3: set_invoice_numero() contava por owner_id.
--         AGORA conta por organization_id (sequencial por org).
--
-- BUG 4: get_ia_limit() lia profiles.plano (stale).
--         AGORA lê organizations.plano.
--
-- BUG 5: count_ia_generations_this_month() contava por user_id.
--         AGORA conta por organization_id.
--
-- CLEANUP: Remove funções mortas user_org_id, user_org_role,
--          has_org_role_min (não usadas em nenhuma policy activa).

-- =============================================
-- 1. FIX CRÍTICO: enforce_proposal_limit
--    Usa NEW.organization_id em vez de user_org_id()
-- =============================================
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
BEGIN
  v_org_id := NEW.organization_id;

  -- Se tem organizacao, contar por org
  IF v_org_id IS NOT NULL THEN
    SELECT plano, propostas_mes_count, propostas_mes_reset_at
      INTO v_plano, v_count, v_reset
    FROM public.organizations WHERE id = v_org_id FOR UPDATE;

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

    -- NÃO reescrever NEW.organization_id — usar o valor do frontend

  ELSE
    -- Fallback: contar por user (sem org — caso raro de registo antigo)
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

-- =============================================
-- 2. FIX: set_proposal_numero — contar por ORG
--    Antes: WHERE owner_id = NEW.owner_id
--    Agora: WHERE organization_id = NEW.organization_id
-- =============================================
CREATE OR REPLACE FUNCTION public.set_proposal_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero TEXT;
  v_seq    INT;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Contar por organizacao (multi-tenant safe)
  IF NEW.organization_id IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_seq
    FROM public.proposals
    WHERE organization_id = NEW.organization_id
      AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');
  ELSE
    -- Fallback: contar por owner (sem org)
    SELECT COUNT(*)
      INTO v_seq
    FROM public.proposals
    WHERE owner_id = NEW.owner_id
      AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');
  END IF;

  v_numero := 'PROP-'
    || to_char(NEW.data, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

-- =============================================
-- 3. FIX: set_invoice_numero — contar por ORG
-- =============================================
CREATE OR REPLACE FUNCTION public.set_invoice_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero TEXT;
  v_seq    INT;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Contar por organizacao (multi-tenant safe)
  IF NEW.organization_id IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_seq
    FROM public.invoices
    WHERE organization_id = NEW.organization_id
      AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');
  ELSE
    -- Fallback: contar por owner (sem org)
    SELECT COUNT(*)
      INTO v_seq
    FROM public.invoices
    WHERE owner_id = NEW.owner_id
      AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');
  END IF;

  v_numero := 'FAT-'
    || to_char(NEW.data_emissao, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

-- =============================================
-- 4. FIX: get_ia_limit — ler da ORG, não do profile
--    O plano agora vive em organizations, não em profiles
-- =============================================
CREATE OR REPLACE FUNCTION public.get_ia_limit(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pl.geracoes_ia_mes
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.plan_limits pl ON pl.plano = o.plano
  WHERE om.user_id = p_user_id
  LIMIT 1;
$$;

-- =============================================
-- 5. FIX: count_ia_generations_this_month — por ORG
--    Aceita organization_id em vez de user_id
--    DROP+CREATE porque muda nome do parâmetro
-- =============================================
DROP FUNCTION IF EXISTS public.count_ia_generations_this_month(UUID);
CREATE FUNCTION public.count_ia_generations_this_month(p_org_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.proposta_ai
  WHERE organization_id = p_org_id
    AND created_at >= date_trunc('month', now())
$$;

-- =============================================
-- 6. CLEANUP: Remover funções mortas
--    Estas NÃO são usadas em nenhuma policy activa
--    e user_org_id() foi a causa raiz do BUG 1.
-- =============================================
DROP FUNCTION IF EXISTS public.user_org_id(UUID);
DROP FUNCTION IF EXISTS public.user_org_role(UUID);
DROP FUNCTION IF EXISTS public.has_org_role_min(UUID, public.org_role);