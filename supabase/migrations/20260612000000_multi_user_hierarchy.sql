-- ============================================================
-- ProposalJa — Multi-User & Hierarquia (Fase A)
-- Organizacoes, Membros, Convites, Migracao de Dados, Novo RLS
-- ============================================================

-- =========================================
-- 1. NOVO ENUM: org_role
-- =========================================
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- =========================================
-- 2. NOVA TABELA: organizations
-- =========================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT DEFAULT '',
  cor_primaria TEXT DEFAULT '#0B5394',
  plano public.plan_tier NOT NULL DEFAULT 'free',
  propostas_mes_count INT NOT NULL DEFAULT 0,
  propostas_mes_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  geracoes_ia_mes_count INT NOT NULL DEFAULT 0,
  geracoes_ia_mes_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_slug ON public.organizations(slug);

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 3. NOVA TABELA: organization_members
-- =========================================
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- =========================================
-- 4. NOVA TABELA: organization_invitations
-- =========================================
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX idx_org_invitations_org ON public.organization_invitations(organization_id);

-- =========================================
-- 5. ADICIONAR organization_id + created_by
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.proposta_ai
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- =========================================
-- 6. ENABLE RLS nas novas tabelas
-- =========================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 7. FUNCOES HELPER
-- =========================================

-- Buscar organization_id do utilizador (NULL se nao tiver org)
CREATE OR REPLACE FUNCTION public.user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Buscar role do utilizador na organizacao (NULL se nao tiver)
CREATE OR REPLACE FUNCTION public.user_org_role(_user_id UUID)
RETURNS public.org_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Verificar se utilizador tem role minimo na org
CREATE OR REPLACE FUNCTION public.has_org_role_min(_user_id UUID, _min_role public.org_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND (
      -- owner > admin > member > viewer
      CASE role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 3
      END
    ) <= (
      CASE _min_role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 3
      END
    )
  );
$$;

-- Contar propostas da organizacao este mes
CREATE OR REPLACE FUNCTION public.org_proposals_this_month(_org_id UUID)
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.proposals
  WHERE organization_id = _org_id
  AND created_at >= date_trunc('month', now())
$$;

-- Contar geracoes IA da organizacao este mes
CREATE OR REPLACE FUNCTION public.org_ia_generations_this_month(_org_id UUID)
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.proposta_ai
  WHERE organization_id = _org_id
  AND created_at >= date_trunc('month', now())
$$;

-- =========================================
-- 8. MIGRACAO DE DADOS EXISTENTES
-- Cada utilizador existente vira "owner" da sua propria org
-- =========================================

-- Criar organizacao para cada profile existente
INSERT INTO public.organizations (id, nome, slug, plano, propostas_mes_count, propostas_mes_reset_at, created_at)
SELECT
  gen_random_uuid(),
  COALESCE(NULLIF(empresa, ''), NULLIF(nome, ''), email, 'Minha Organizacao'),
  'org-' || SUBSTRING(id::text, 1, 8),
  plano,
  propostas_mes_count,
  propostas_mes_reset_at,
  created_at
FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om
  JOIN public.profiles p2 ON p2.id = om.user_id
  WHERE p2.id = profiles.id
);

-- Associar cada utilizador como "owner" da sua org
INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
SELECT
  o.id,
  p.id,
  'owner',
  p.created_at
FROM public.profiles p
JOIN public.organizations o ON o.slug = 'org-' || SUBSTRING(p.id::text, 1, 8)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om WHERE om.user_id = p.id
);

-- Preencher organization_id em profiles
UPDATE public.profiles p
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE om.user_id = p.id;

-- Preencher organization_id em clients
UPDATE public.clients c
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE c.owner_id = om.user_id;

-- Preencher organization_id em catalog_items
UPDATE public.catalog_items ci
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE ci.owner_id = om.user_id;

-- Preencher organization_id + created_by em proposals
UPDATE public.proposals pr
SET organization_id = om.organization_id,
    created_by = pr.owner_id
FROM public.organization_members om
WHERE pr.owner_id = om.user_id;

-- Preencher organization_id + created_by em invoices
UPDATE public.invoices inv
SET organization_id = om.organization_id,
    created_by = inv.owner_id
FROM public.organization_members om
WHERE inv.owner_id = om.user_id;

-- Preencher organization_id em proposta_ai
UPDATE public.proposta_ai pa
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE pa.user_id = om.user_id;

-- =========================================
-- 9. NOVAS RLS POLICIES (adicionam org ao existing)
-- =========================================

-- organizations: membros veem a sua org, admins da plataforma veem todas
CREATE POLICY "org_select_member" ON public.organizations FOR SELECT TO authenticated
  USING (
    id = user_org_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "org_update_owner_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (
    id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- organization_members: membros veem a sua org, owner/admin gerem
CREATE POLICY "om_select_member" ON public.organization_members FOR SELECT TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "om_manage_owner_admin" ON public.organization_members FOR ALL TO authenticated
  USING (
    organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- organization_invitations: owner/admin da org gerem, convidado ve os seus
CREATE POLICY "oi_select_own" ON public.organization_invitations FOR SELECT TO authenticated
  USING (
    (organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin'))
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "oi_manage_owner_admin" ON public.organization_invitations FOR ALL TO authenticated
  USING (
    organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
    OR public.has_role(auth.uid(), 'admin')
  );

-- =========================================
-- 10. ACTUALIZAR RLS EXISTENTES (dual: org OU owner)
-- Mantem compatibilidade com users sem org
-- =========================================

-- clients: org members OU owner (fallback) OU platform admin
DROP POLICY IF EXISTS "clients_owner_all" ON public.clients;
CREATE POLICY "clients_org_or_owner" ON public.clients FOR ALL TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    organization_id = COALESCE(user_org_id(auth.uid()), organization_id)
    OR owner_id = auth.uid()
  );

-- catalog_items: org members OU owner (fallback)
DROP POLICY IF EXISTS "catalog_owner_all" ON public.catalog_items;
CREATE POLICY "catalog_org_or_owner" ON public.catalog_items FOR ALL TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    organization_id = COALESCE(user_org_id(auth.uid()), organization_id)
    OR owner_id = auth.uid()
  );

-- proposals: org members (role >= member) OU owner (fallback)
-- Delete so apenas owner/admin da org
DROP POLICY IF EXISTS "proposals_owner_all" ON public.proposals;
CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'member'))
    OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
  USING (
    (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'admin'))
    OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
    OR public.has_role(auth.uid(), 'admin')
  );

-- proposal_items: via parent proposal (org OU owner)
DROP POLICY IF EXISTS "proposal_items_select" ON public.proposal_items;
DROP POLICY IF EXISTS "proposal_items_modify" ON public.proposal_items;
CREATE POLICY "pi_select" ON public.proposal_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
    AND (p.organization_id = user_org_id(auth.uid()) OR p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "pi_modify" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
    AND (p.organization_id = user_org_id(auth.uid()) OR p.owner_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_id
    AND (p.organization_id = user_org_id(auth.uid()) OR p.owner_id = auth.uid())
  ));

-- invoices: org members OU owner (fallback)
DROP POLICY IF EXISTS "invoices_owner_all" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'member'))
    OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'admin'))
    OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
    OR public.has_role(auth.uid(), 'admin')
  );

-- profiles: adiciona visibilidade entre membros da mesma org
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = user_org_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- proposta_ai: org members OU owner (fallback)
DROP POLICY IF EXISTS "Users manage own proposta_ai" ON public.proposta_ai;
DROP POLICY IF EXISTS "Admin reads all proposta_ai" ON public.proposta_ai;
CREATE POLICY "pai_select" ON public.proposta_ai FOR SELECT TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "pai_modify" ON public.proposta_ai FOR ALL TO authenticated
  USING (
    organization_id = user_org_id(auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = COALESCE(user_org_id(auth.uid()), organization_id)
    OR user_id = auth.uid()
  );

-- =========================================
-- 11. ACTUALIZAR enforce_proposal_limit (contar por org)
-- Se user tem org, conta por org. Se nao, conta por user (fallback).
-- =========================================
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
  v_org_id := user_org_id(NEW.owner_id);

  -- Se tem organizacao, contar por org
  IF v_org_id IS NOT NULL THEN
    SELECT plano, propostas_mes_count, propostas_mes_reset_at
      INTO v_plano, v_count, v_reset
    FROM public.organizations WHERE id = v_org_id FOR UPDATE;

    IF v_plano IS NULL THEN
      RAISE EXCEPTION 'Organization not found for user %', NEW.owner_id;
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

    -- Sincronizar organization_id na proposta
    NEW.organization_id := v_org_id;

  ELSE
    -- Fallback: contar por user (sem org)
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

-- =========================================
-- 12. ACTUALIZAR handle_new_user (auto-criar org)
-- Quando um utilizador se regista, criar org automaticamente
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_org_id UUID;
  v_org_nome TEXT;
BEGIN
  v_is_admin := lower(NEW.email) = 'graciochiziane@gmail.com';

  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END);

  INSERT INTO public.subscriptions (user_id, plano, status, provider)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END, 'active', 'manual');

  -- Criar organizacao pessoal para o novo utilizador
  v_org_nome := COALESCE(NEW.raw_user_meta_data->>'empresa', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1), 'Minha Organizacao');

  INSERT INTO public.organizations (nome, slug, plano)
  VALUES (v_org_nome, 'org-' || SUBSTRING(NEW.id::text, 1, 8), CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END)
  RETURNING id INTO v_org_id;

  -- Associar como owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  -- Linkar profile a org
  UPDATE public.profiles SET organization_id = v_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;