-- ============================================================
-- ProposalJá — SQL DE REPARAÇÃO COMPLETO DA BASE DE DADOS
-- ============================================================
-- Idempotente: seguro para re-executar em qualquer estado.
-- Não destrói dados existentes.
-- Cobertura: 17 tabelas, 7 enums, 15+ funções, 20+ triggers,
--            40+ RLS policies, 20+ índices, todas as constraints.
--
-- EXECUÇÃO: Supabase Dashboard > SQL Editor
--           ou psql directamente.
-- ============================================================
-- Versão: 1.0 — 2026-08-07
-- Baseado em: 30+ migrações analisadas
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1: VERIFICAÇÃO DE INTEGRIDADE (diagnóstico)
-- ============================================================

DO $$
DECLARE
  v_errors TEXT[] := '{}';
  v_table_count INT;
  v_rls_off TEXT[] := '{}';
  v_missing_funcs TEXT[] := '{}';
BEGIN
  -- 1. Contar tabelas esperadas (mínimo 15)
  SELECT COUNT(*) INTO v_table_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  IF v_table_count < 15 THEN
    v_errors := array_append(v_errors, 
      'POUCAS TABELAS: encontradas ' || v_table_count || ', esperadas >= 15');
  END IF;

  -- 2. Verificar RLS activo em todas as tabelas de dados
  FOR rec IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename NOT IN ('plan_limits')
      AND tablename NOT LIKE 'pg_%'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = rec.tablename
    ) THEN
      v_rls_off := array_append(v_rls_off, rec.tablename);
    END IF;
  END LOOP;

  IF array_length(v_rls_off, 1) > 0 THEN
    v_errors := array_append(v_errors, 
      'RLS SEM POLICIES: ' || array_to_string(v_rls_off, ', '));
  END IF;

  -- 3. Verificar funções críticas
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'set_updated_at');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'handle_new_user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_proposal_limit') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'enforce_proposal_limit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_belongs_to_org') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'user_belongs_to_org');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'user_role_in_org') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'user_role_in_org');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_org_role_min_in_org') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'has_org_role_min_in_org');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'accept_invitation') THEN
    v_missing_funcs := array_append(v_missing_funcs, 'accept_invitation');
  END IF;

  IF array_length(v_missing_funcs, 1) > 0 THEN
    v_errors := array_append(v_errors, 
      'FUNÇÕES EM FALTA: ' || array_to_string(v_missing_funcs, ', '));
  END IF;

  -- 4. Reportar
  IF array_length(v_errors, 1) > 0 THEN
    RAISE NOTICE '=== PROBLEMAS DETECTADOS ===';
    FOR i IN 1..array_length(v_errors, 1) LOOP
      RAISE NOTICE '  ! %', v_errors[i];
    END LOOP;
  ELSE
    RAISE NOTICE 'Diagnóstico inicial: sem problemas críticos detectados.';
  END IF;
END $$;


-- ============================================================
-- PARTE 2: ENUMS (criação segura)
-- ============================================================

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'business'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'enviada', 'aceite', 'rejeitada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.invoice_status AS ENUM ('pendente', 'paga', 'vencida', 'anulada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.desconto_tipo AS ENUM ('percentual', 'valor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.visual_style AS ENUM ('corporate', 'premium', 'minimal', 'technical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- PARTE 3: FUNÇÕES UTILITÁRIAS
-- ============================================================

-- 3a. Auto-set updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 3b. Verifica se user tem app_role de plataforma
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 3c. Verifica se user pertence a uma org ESPECÍFICA (multi-tenant safe)
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid());
$$;

-- 3d. Retorna role do user numa org ESPECÍFICA
CREATE OR REPLACE FUNCTION public.user_role_in_org(p_org_id UUID)
RETURNS public.org_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid() LIMIT 1;
$$;

-- 3e. Role hierarchy check ORG-SPECIFIC (owner > admin > member > viewer)
CREATE OR REPLACE FUNCTION public.has_org_role_min_in_org(p_org_id UUID, p_min_role public.org_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE user_role_in_org(p_org_id)
    WHEN 'owner'  THEN true
    WHEN 'admin'  THEN p_min_role IN ('admin', 'member', 'viewer')
    WHEN 'member' THEN p_min_role IN ('member', 'viewer')
    WHEN 'viewer' THEN p_min_role = 'viewer'
    ELSE false
  END;
$$;

-- 3f. Legacy: compatibilidade com código antigo (encaminha para versão org-specific)
CREATE OR REPLACE FUNCTION public.has_org_role_min(_user_id UUID, _min_role public.org_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = _user_id
    AND (
      CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 WHEN 'viewer' THEN 3 END
    ) <= (
      CASE _min_role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 WHEN 'viewer' THEN 3 END
    )
  );
$$;

-- 3g. Contar gerações IA da org este mês
DROP FUNCTION IF EXISTS public.count_ia_generations_this_month(UUID);
CREATE FUNCTION public.count_ia_generations_this_month(p_org_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.proposta_ai WHERE organization_id = p_org_id AND created_at >= date_trunc('month', now());
$$;

-- 3h. IA limit: lê da ORG (não do profile)
CREATE OR REPLACE FUNCTION public.get_ia_limit(p_user_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pl.geracoes_ia_mes FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  JOIN public.plan_limits pl ON pl.plano = o.plano WHERE om.user_id = p_user_id LIMIT 1;
$$;

-- 3i. Limpar atividade antiga (90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN DELETE FROM public.user_activity WHERE created_at < now() - interval '90 days'; END; $$;


-- ============================================================
-- PARTE 4: TABELAS BASE (CREATE IF NOT EXISTS)
-- ============================================================

-- 4a. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT DEFAULT '',
  cargo TEXT DEFAULT '',
  empresa TEXT DEFAULT '',
  contacto TEXT DEFAULT '',
  nuit TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  logotipo_url TEXT DEFAULT '',
  cor_primaria TEXT DEFAULT '#0B5394',
  dados_bancarios JSONB NOT NULL DEFAULT '{"ativo":false,"banco":"","numeroConta":"","nib":""}'::jsonb,
  mobile_money JSONB NOT NULL DEFAULT '{"mpesa":{"ativo":false,"numero":""},"emola":{"ativo":false,"numero":""},"mkesh":{"ativo":false,"numero":""}}'::jsonb,
  plano public.plan_tier NOT NULL DEFAULT 'free',
  propostas_mes_count INT NOT NULL DEFAULT 0,
  propostas_mes_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  organization_id UUID,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles (last_seen_at DESC);

-- 4b. USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4c. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano public.plan_tier NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4d. PLAN LIMITS (lookup)
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plano public.plan_tier PRIMARY KEY,
  propostas_mes INT NOT NULL,
  clientes_max INT,
  templates_pdf TEXT[] NOT NULL DEFAULT ARRAY['classic'],
  geracoes_ia_mes INT NOT NULL DEFAULT 3
);
INSERT INTO public.plan_limits (plano, propostas_mes, clientes_max, templates_pdf, geracoes_ia_mes) VALUES
  ('free', 5, 10, ARRAY['classic'], 3),
  ('pro', 2147483647, NULL, ARRAY['classic','modern'], 50),
  ('business', 2147483647, NULL, ARRAY['classic','modern','executive'], 2147483647)
ON CONFLICT (plano) DO UPDATE SET
  propostas_mes = EXCLUDED.propostas_mes, clientes_max = EXCLUDED.clientes_max,
  templates_pdf = EXCLUDED.templates_pdf, geracoes_ia_mes = EXCLUDED.geracoes_ia_mes;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 3;
UPDATE public.plan_limits SET geracoes_ia_mes = 3 WHERE plano = 'free' AND geracoes_ia_mes IS NULL;
UPDATE public.plan_limits SET geracoes_ia_mes = 50 WHERE plano = 'pro' AND geracoes_ia_mes IS NULL;
UPDATE public.plan_limits SET geracoes_ia_mes = 2147483647 WHERE plano = 'business' AND geracoes_ia_mes IS NULL;

-- 4e. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, email TEXT DEFAULT '', telefone TEXT DEFAULT '',
  empresa TEXT DEFAULT '', nuit TEXT DEFAULT '', endereco TEXT DEFAULT '',
  organization_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id);

-- 4f. CATALOG ITEMS
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  organization_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_owner ON public.catalog_items(owner_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_owner_nome_unique') THEN
    ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_owner_nome_unique UNIQUE (owner_id, nome);
  END IF;
END $$;

-- 4g. PROPOSALS
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  numero TEXT, data DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_tipo public.desconto_tipo NOT NULL DEFAULT 'percentual',
  desconto_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_percentual NUMERIC(5,2) NOT NULL DEFAULT 16,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT DEFAULT '',
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  cliente_snapshot JSONB,
  organization_id UUID,
  created_by UUID,
  blueprint_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_owner ON public.proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_status ON public.proposals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_data ON public.proposals(owner_id, data DESC);

-- 4h. PROPOSAL ITEMS
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, quantidade NUMERIC(12,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_ordem ON public.proposal_items(proposal_id, ordem);
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 4i. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  numero TEXT, data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE, total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'pendente',
  organization_id UUID, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_id);

-- 4j. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0, subtotal NUMERIC NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- 4k. PROPOSTA IA
CREATE TABLE IF NOT EXISTS public.proposta_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referencia TEXT,
  mode TEXT NOT NULL DEFAULT 'rapido' CHECK (mode IN ('rapido', 'assertivo')),
  tone TEXT NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal', 'persuasivo', 'tecnico', 'consultivo')),
  sector TEXT, input_json JSONB, output_json JSONB, edited_json JSONB,
  modelo TEXT DEFAULT 'gpt-4o-mini', tokens_usados INTEGER DEFAULT 0,
  custo_usd NUMERIC(10,6) DEFAULT 0, gerado_em TIMESTAMPTZ, exportado_em TIMESTAMPTZ,
  organization_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_user ON public.proposta_ai(user_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_cotacao ON public.proposta_ai(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_created ON public.proposta_ai(created_at DESC);

-- 4l. USER ACTIVITY
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON public.user_activity (user_id, created_at DESC);

-- 4m. ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, target_table TEXT, target_id UUID, target_owner_id UUID,
  target_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log(admin_id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_table, target_id);

-- ============================================================
-- PARTE 5: TABELAS MULTI-TENANT (ORGANIZAÇÕES)
-- ============================================================

-- 5a. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  logo_url TEXT DEFAULT '', cor_primaria TEXT DEFAULT '#0B5394',
  plano public.plan_tier NOT NULL DEFAULT 'free',
  propostas_mes_count INT NOT NULL DEFAULT 0,
  propostas_mes_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  geracoes_ia_mes_count INT NOT NULL DEFAULT 0,
  geracoes_ia_mes_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  suspended_at TIMESTAMPTZ, suspension_reason TEXT,
  monthly_price NUMERIC(10,2) DEFAULT 0, notes TEXT DEFAULT '',
  contact_email TEXT DEFAULT '', nuit TEXT DEFAULT '',
  last_proposal_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_suspended ON public.organizations(suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_last_proposal ON public.organizations(last_proposal_created_at DESC);

-- 5b. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  display_name TEXT DEFAULT '',
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 5c. ORGANIZATION INVITATIONS
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL, role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  nome TEXT DEFAULT '',
  accepted_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);

-- ============================================================
-- PARTE 6: TABELAS BLUEPRINT ENGINE (propostas avançadas)
-- ============================================================

-- 6a. BUSINESS CATEGORIES
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL, icon TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6b. PROPOSAL BLUEPRINTS
CREATE TABLE IF NOT EXISTS public.proposal_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT DEFAULT '',
  business_category_id UUID REFERENCES public.business_categories(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON public.proposal_blueprints(business_category_id);

-- 6c. PROPOSAL SECTIONS
CREATE TABLE IF NOT EXISTS public.proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.proposal_blueprints(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'narrative' CHECK (type IN ('narrative', 'items_table', 'pricing', 'timeline', 'terms', 'custom')),
  title TEXT NOT NULL, description TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0, required BOOLEAN NOT NULL DEFAULT true,
  content_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sections_blueprint ON public.proposal_sections(blueprint_id);

-- 6d. SECTION QUESTIONS
CREATE TABLE IF NOT EXISTS public.section_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL, help_text TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0, required BOOLEAN NOT NULL DEFAULT true,
  input_type TEXT NOT NULL DEFAULT 'text' CHECK (input_type IN ('text', 'textarea', 'number', 'select', 'multiselect', 'date', 'boolean')),
  visibility_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_section ON public.section_questions(section_id);

-- 6e. COMPANY BRAND PROFILES
CREATE TABLE IF NOT EXISTS public.company_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#0B5394', secondary_color TEXT DEFAULT '#333333',
  accent_color TEXT DEFAULT '#F59E0B', font_preference TEXT DEFAULT 'modern',
  visual_style public.visual_style NOT NULL DEFAULT 'corporate',
  logo_colors_extracted JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_profile_company ON public.company_brand_profiles(company_id);

-- ============================================================
-- PARTE 7: COLUNAS ADICIONAIS (ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS contact_email TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS nuit TEXT DEFAULT '';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS last_proposal_created_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS blueprint_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.proposta_ai ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 3;
ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- ============================================================
-- PARTE 8: CONSTRAINTS ÚNICAS (parciais, multi-tenant safe)
-- ============================================================

-- Proposals: numero único por org OU por owner (fallback sem org)
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_numero_owner_unique;
DO $$ BEGIN
  CREATE UNIQUE INDEX proposals_numero_org_unique ON public.proposals (organization_id, numero) WHERE organization_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX proposals_numero_owner_unique ON public.proposals (owner_id, numero) WHERE organization_id IS NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Invoices: mesmo padrão
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_numero_owner_unique' AND contype = 'c') THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_numero_owner_unique;
  END IF;
END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX invoices_numero_org_unique ON public.invoices (organization_id, numero) WHERE organization_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX invoices_numero_owner_unique ON public.invoices (owner_id, numero) WHERE organization_id IS NULL;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Clients: email único por org
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS clients_email_org_unique
    ON public.clients (organization_id, email) WHERE organization_id IS NOT NULL AND email IS NOT NULL AND email != '';
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- PostgREST join FKs (redundantes mas necessárias para o PostgREST)
DO $$ BEGIN
  ALTER TABLE public.organization_members ADD CONSTRAINT om_user_id_profile_fk
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.admin_audit_log ADD CONSTRAINT aal_admin_id_profile_fk
    FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- PARTE 9: TRIGGERS (updated_at, números, limites, auditoria)
-- ============================================================

-- 9a. updated_at auto-triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposal_items_updated_at ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_updated_at BEFORE UPDATE ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9b. Proposal numero (org-scoped, alphabetical trigger order)
CREATE OR REPLACE FUNCTION public.set_proposal_numero()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_numero TEXT; v_seq INT;
BEGIN
  IF NEW.numero IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.organization_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seq FROM public.proposals
    WHERE organization_id = NEW.organization_id AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');
  ELSE
    SELECT COUNT(*) INTO v_seq FROM public.proposals
    WHERE owner_id = NEW.owner_id AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');
  END IF;
  NEW.numero := 'PROP-' || to_char(NEW.data, 'YYYYMM') || '-' || lpad((v_seq + 1)::text, 4, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS a_set_proposal_numero ON public.proposals;
CREATE TRIGGER a_set_proposal_numero BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_proposal_numero();

-- 9c. Invoice numero (org-scoped)
CREATE OR REPLACE FUNCTION public.set_invoice_numero()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_numero TEXT; v_seq INT;
BEGIN
  IF NEW.numero IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.organization_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seq FROM public.invoices
    WHERE organization_id = NEW.organization_id AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');
  ELSE
    SELECT COUNT(*) INTO v_seq FROM public.invoices
    WHERE owner_id = NEW.owner_id AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');
  END IF;
  NEW.numero := 'FAT-' || to_char(NEW.data_emissao, 'YYYYMM') || '-' || lpad((v_seq + 1)::text, 4, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS a_set_invoice_numero ON public.invoices;
CREATE TRIGGER a_set_invoice_numero BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_numero();

-- 9d. Enforce proposal limit (org-aware + suspended check)
CREATE OR REPLACE FUNCTION public.enforce_proposal_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID; v_plano public.plan_tier; v_count INT;
  v_reset TIMESTAMPTZ; v_limit INT; v_suspended TIMESTAMPTZ;
BEGIN
  v_org_id := NEW.organization_id;
  IF v_org_id IS NOT NULL THEN
    SELECT suspended_at INTO v_suspended FROM public.organizations WHERE id = v_org_id FOR UPDATE;
    IF v_suspended IS NOT NULL THEN
      RAISE EXCEPTION 'ORG_SUSPENDED: organizacao suspensa. Contacte o suporte.';
    END IF;
    SELECT plano, propostas_mes_count, propostas_mes_reset_at INTO v_plano, v_count, v_reset
    FROM public.organizations WHERE id = v_org_id;
    IF v_plano IS NULL THEN RAISE EXCEPTION 'Organization not found for proposal'; END IF;
    IF now() >= v_reset THEN v_count := 0; v_reset := date_trunc('month', now()) + INTERVAL '1 month'; END IF;
    SELECT propostas_mes INTO v_limit FROM public.plan_limits WHERE plano = v_plano;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: limite de % propostas/mes atingido no plano %', v_limit, v_plano;
    END IF;
    UPDATE public.organizations SET propostas_mes_count = v_count + 1, propostas_mes_reset_at = v_reset WHERE id = v_org_id;
  ELSE
    SELECT plano, propostas_mes_count, propostas_mes_reset_at INTO v_plano, v_count, v_reset
    FROM public.profiles WHERE id = NEW.owner_id FOR UPDATE;
    IF v_plano IS NULL THEN RAISE EXCEPTION 'Profile not found for user %', NEW.owner_id; END IF;
    IF now() >= v_reset THEN v_count := 0; v_reset := date_trunc('month', now()) + INTERVAL '1 month'; END IF;
    SELECT propostas_mes INTO v_limit FROM public.plan_limits WHERE plano = v_plano;
    IF v_count >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED: limite de % propostas/mes atingido no plano %', v_limit, v_plano;
    END IF;
    UPDATE public.profiles SET propostas_mes_count = v_count + 1, propostas_mes_reset_at = v_reset WHERE id = NEW.owner_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_proposal_limit ON public.proposals;
CREATE TRIGGER trg_enforce_proposal_limit BEFORE INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_limit();

-- 9e. Block IA for suspended orgs
CREATE OR REPLACE FUNCTION public.enforce_ia_suspended()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_suspended TIMESTAMPTZ;
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  SELECT suspended_at INTO v_suspended FROM public.organizations WHERE id = NEW.organization_id;
  IF v_suspended IS NOT NULL THEN
    RAISE EXCEPTION 'ORG_SUSPENDED: organizacao suspensa. Geracao IA bloqueada.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_ia_suspended ON public.proposta_ai;
CREATE TRIGGER trg_enforce_ia_suspended BEFORE INSERT ON public.proposta_ai FOR EACH ROW EXECUTE FUNCTION public.enforce_ia_suspended();

-- 9f. Admin deletion audit logging
CREATE OR REPLACE FUNCTION public.log_admin_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_snapshot JSONB; v_action TEXT; v_owner_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN OLD; END IF;
  CASE TG_TABLE_NAME
    WHEN 'clients' THEN v_owner_id := OLD.owner_id; v_action := 'delete_client';
      v_snapshot := jsonb_build_object('nome', OLD.nome, 'email', OLD.email, 'telefone', OLD.telefone, 'empresa', OLD.empresa);
    WHEN 'proposals' THEN v_owner_id := OLD.owner_id; v_action := 'delete_proposal';
      v_snapshot := jsonb_build_object('numero', OLD.numero, 'client_id', OLD.client_id, 'total', OLD.total, 'status', OLD.status);
    WHEN 'catalog_items' THEN v_owner_id := OLD.owner_id; v_action := 'delete_catalog_item';
      v_snapshot := jsonb_build_object('nome', OLD.nome, 'preco_unitario', OLD.preco_unitario);
    WHEN 'invoices' THEN v_owner_id := OLD.owner_id; v_action := 'delete_invoice';
      v_snapshot := jsonb_build_object('numero', OLD.numero, 'total', OLD.total, 'status', OLD.status);
    ELSE RETURN OLD;
  END CASE;
  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, target_owner_id, target_snapshot)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, OLD.id, v_owner_id, v_snapshot);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_clients_delete ON public.clients;
CREATE TRIGGER trg_audit_clients_delete BEFORE DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_proposals_delete ON public.proposals;
CREATE TRIGGER trg_audit_proposals_delete BEFORE DELETE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_catalog_delete ON public.catalog_items;
CREATE TRIGGER trg_audit_catalog_delete BEFORE DELETE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_invoices_delete ON public.invoices;
CREATE TRIGGER trg_audit_invoices_delete BEFORE DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

-- 9g. Update org last_proposal_created_at
CREATE OR REPLACE FUNCTION public.update_org_last_proposal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  UPDATE public.organizations SET last_proposal_created_at = NEW.created_at WHERE id = NEW.organization_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_update_org_last_proposal ON public.proposals;
CREATE TRIGGER trg_update_org_last_proposal AFTER INSERT ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_org_last_proposal();

-- 9h. Handle new user (org-aware, auto-create org)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN; v_org_id UUID; v_org_nome TEXT;
BEGIN
  v_is_admin := lower(NEW.email) = 'graciochiziane@gmail.com';
  INSERT INTO public.profiles (id, email, nome) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END);
  INSERT INTO public.subscriptions (user_id, plano, status, provider)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END, 'active', 'manual');
  v_org_nome := COALESCE(NEW.raw_user_meta_data->>'empresa', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1), 'Minha Organizacao');
  INSERT INTO public.organizations (nome, slug, plano)
  VALUES (v_org_nome, 'org-' || SUBSTRING(NEW.id::text, 1, 8), CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END)
  RETURNING id INTO v_org_id;
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (v_org_id, NEW.id, 'owner');
  UPDATE public.profiles SET organization_id = v_org_id WHERE id = NEW.id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PARTE 10: RPCs (Stored Procedures)
-- ============================================================

-- 10a. Accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_invitation_id UUID, p_user_id UUID, p_user_email TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_invite RECORD;
BEGIN
  SELECT i.id, i.organization_id, i.role, i.invited_by, i.email, i.nome INTO v_invite
  FROM public.organization_invitations i
  WHERE i.id = p_invitation_id AND i.email = p_user_email AND i.accepted_at IS NULL AND i.expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite nao encontrado ou expirado'; END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user_id AND organization_id = v_invite.organization_id) THEN
    RAISE EXCEPTION 'Ja e membro desta organizacao';
  END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, display_name)
  VALUES (v_invite.organization_id, p_user_id, v_invite.role, v_invite.invited_by, COALESCE(NULLIF(v_invite.nome, ''), NULL));
  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = p_invitation_id;
  UPDATE public.profiles SET organization_id = v_invite.organization_id WHERE id = p_user_id AND organization_id IS NULL;
END; $$;

-- 10b. Transfer ownership (org-specific)
CREATE OR REPLACE FUNCTION public.transfer_ownership(p_current_owner_id UUID, p_target_member_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org_id UUID; v_owner_role org_role; v_target_user_id UUID; v_target_role org_role;
BEGIN
  SELECT user_id, role, organization_id INTO v_target_user_id, v_target_role, v_org_id
  FROM public.organization_members WHERE id = p_target_member_id;
  IF v_target_user_id IS NULL THEN RAISE EXCEPTION 'Membro de destino nao encontrado'; END IF;
  SELECT role INTO v_owner_role FROM public.organization_members WHERE user_id = p_current_owner_id AND organization_id = v_org_id;
  IF v_owner_role IS NULL OR v_owner_role != 'owner' THEN RAISE EXCEPTION 'Apenas o owner pode transferir a propriedade'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Membro ja e owner'; END IF;
  IF v_target_user_id = p_current_owner_id THEN RAISE EXCEPTION 'Nao pode transferir para si mesmo'; END IF;
  UPDATE public.organization_members SET role = 'admin' WHERE user_id = p_current_owner_id AND organization_id = v_org_id;
  UPDATE public.organization_members SET role = 'owner' WHERE id = p_target_member_id;
END; $$;

-- 10c. Admin toggle suspend
CREATE OR REPLACE FUNCTION public.admin_toggle_suspend(p_org_id UUID, p_suspend BOOLEAN, p_reason TEXT DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado: apenas admins'; END IF;
  IF p_suspend THEN
    UPDATE public.organizations SET suspended_at = now(), suspension_reason = p_reason WHERE id = p_org_id;
  ELSE
    UPDATE public.organizations SET suspended_at = NULL, suspension_reason = NULL WHERE id = p_org_id;
  END IF;
END; $$;

-- 10d. Organization health score
CREATE OR REPLACE FUNCTION public.organization_health_score(p_org_id UUID)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_last TIMESTAMPTZ; v_days int;
BEGIN
  SELECT last_proposal_created_at INTO v_last FROM public.organizations WHERE id = p_org_id;
  IF v_last IS NULL THEN RETURN 0; END IF;
  v_days := extract(day from now() - v_last)::int;
  IF v_days <= 1 THEN RETURN 100; END IF;
  IF v_days <= 3 THEN RETURN 80; END IF;
  IF v_days <= 7 THEN RETURN 60; END IF;
  IF v_days <= 14 THEN RETURN 40; END IF;
  IF v_days <= 30 THEN RETURN 20; END IF;
  RETURN 0;
END; $$;

-- 10e. Admin remove member
CREATE OR REPLACE FUNCTION public.admin_remove_member(p_member_id UUID, p_org_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role public.org_role; v_owner_count INT; v_user_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado: apenas admins'; END IF;
  SELECT role, user_id INTO v_role, v_user_id FROM public.organization_members WHERE id = p_member_id AND organization_id = p_org_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Membro nao encontrado nesta organizacao'; END IF;
  SELECT COUNT(*) INTO v_owner_count FROM public.organization_members WHERE organization_id = p_org_id AND role = 'owner';
  IF v_role = 'owner' AND v_owner_count <= 1 THEN RAISE EXCEPTION 'Nao e possivel remover o unico owner'; END IF;
  DELETE FROM public.organization_members WHERE id = p_member_id AND organization_id = p_org_id;
  UPDATE public.profiles SET organization_id = NULL WHERE organization_id = p_org_id AND id = v_user_id;
END; $$;

-- 10f. Admin platform metrics
CREATE OR REPLACE FUNCTION public.admin_platform_metrics()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_users INT; v_new_signups INT; v_proposals_month INT; v_clients_month INT;
  v_proposals_total_value NUMERIC; v_online_now INT;
  v_accessed_today INT; v_accessed_week INT; v_accessed_month INT; v_result JSON;
BEGIN
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_new_signups FROM public.profiles WHERE created_at >= date_trunc('month', now());
  SELECT COUNT(*) INTO v_proposals_month FROM public.proposals WHERE created_at >= date_trunc('month', now());
  SELECT COUNT(*) INTO v_clients_month FROM public.clients WHERE created_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(total), 0) INTO v_proposals_total_value FROM public.proposals;
  SELECT COUNT(*) INTO v_online_now FROM public.profiles WHERE last_seen_at > now() - INTERVAL '15 minutes';
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_today FROM public.user_activity WHERE created_at >= date_trunc('day', now());
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_week FROM public.user_activity WHERE created_at >= now() - INTERVAL '7 days';
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_month FROM public.user_activity WHERE created_at >= now() - INTERVAL '30 days';
  v_result := json_build_object(
    'users_online_now', v_online_now, 'accessed_today', v_accessed_today,
    'accessed_week', v_accessed_week, 'accessed_month', v_accessed_month,
    'total_users', v_total_users, 'new_signups_this_month', v_new_signups,
    'proposals_this_month', v_proposals_month, 'clients_this_month', v_clients_month,
    'proposals_total_value', v_proposals_total_value);
  RETURN v_result;
END; $$;


-- ============================================================
-- PARTE 11: RLS — ENABLE em TODAS as tabelas
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposta_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_brand_profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PARTE 12: RLS POLICIES (Drop + Create — idempotente)
-- ============================================================

-- MACRO HELPER: cada bloco faz DROP IF EXISTS + CREATE

-- 12a. PROFILES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DO $$ BEGIN
  CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated USING (
    id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = profiles.id AND user_belongs_to_org(om.organization_id)) OR public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12b. USER ROLES
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DO $$ BEGIN CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12c. SUBSCRIPTIONS
DROP POLICY IF EXISTS "subs_select_own_or_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_admin_manage" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_update_own" ON public.subscriptions;
DO $$ BEGIN CREATE POLICY "subs_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subs_update_own" ON public.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subs_admin_manage" ON public.subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12d. CLIENTS
DROP POLICY IF EXISTS "clients_owner_all" ON public.clients;
DROP POLICY IF EXISTS "clients_org_or_owner" ON public.clients;
DO $$ BEGIN
  CREATE POLICY "clients_org_or_owner" ON public.clients FOR ALL TO authenticated
  USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_belongs_to_org(organization_id) OR owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12e. CATALOG ITEMS
DROP POLICY IF EXISTS "catalog_owner_all" ON public.catalog_items;
DROP POLICY IF EXISTS "catalog_org_or_owner" ON public.catalog_items;
DO $$ BEGIN
  CREATE POLICY "catalog_org_or_owner" ON public.catalog_items FOR ALL TO authenticated
  USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_belongs_to_org(organization_id) OR owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12f. PROPOSALS (split by operation)
DROP POLICY IF EXISTS "proposals_owner_all" ON public.proposals;
DROP POLICY IF EXISTS "proposals_select" ON public.proposals;
DROP POLICY IF EXISTS "proposals_insert" ON public.proposals;
DROP POLICY IF EXISTS "proposals_update" ON public.proposals;
DROP POLICY IF EXISTS "proposals_delete" ON public.proposals;
DO $$ BEGIN CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated WITH CHECK ((user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'member')) OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated USING ((user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin')) OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12g. PROPOSAL ITEMS
DROP POLICY IF EXISTS "proposal_items_select" ON public.proposal_items;
DROP POLICY IF EXISTS "proposal_items_modify" ON public.proposal_items;
DROP POLICY IF EXISTS "pi_select" ON public.proposal_items;
DROP POLICY IF EXISTS "pi_modify" ON public.proposal_items;
DO $$ BEGIN
  CREATE POLICY "pi_select" ON public.proposal_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_items.proposal_id AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "pi_modify" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_items.proposal_id AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_items.proposal_id AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12h. INVOICES (split)
DROP POLICY IF EXISTS "invoices_owner_all" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
DO $$ BEGIN CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK ((user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'member')) OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated USING ((user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin')) OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12i. INVOICE ITEMS (org-scoped via parent)
DROP POLICY IF EXISTS "ii_owner_select" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_owner_insert" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_owner_update" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_owner_delete" ON public.invoice_items;
DROP POLICY IF EXISTS "ii_admin_all" ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_select ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_insert ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_update ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_delete ON public.invoice_items;
DO $$ BEGIN CREATE POLICY ii_org_select ON public.invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ii_org_insert ON public.invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ii_org_update ON public.invoice_items FOR UPDATE USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ii_org_delete ON public.invoice_items FOR DELETE USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12j. PLAN LIMITS
DROP POLICY IF EXISTS "plan_limits_read" ON public.plan_limits;
DROP POLICY IF EXISTS "plan_limits_admin_update" ON public.plan_limits;
DO $$ BEGIN CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "plan_limits_admin_update" ON public.plan_limits FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12k. PROPOSTA AI
DROP POLICY IF EXISTS "Users manage own proposta_ai" ON public.proposta_ai;
DROP POLICY IF EXISTS "Admin reads all proposta_ai" ON public.proposta_ai;
DROP POLICY IF EXISTS "pai_select" ON public.proposta_ai;
DROP POLICY IF EXISTS "pai_modify" ON public.proposta_ai;
DO $$ BEGIN CREATE POLICY "pai_select" ON public.proposta_ai FOR SELECT TO authenticated USING (user_belongs_to_org(organization_id) OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pai_modify" ON public.proposta_ai FOR ALL TO authenticated USING (user_belongs_to_org(organization_id) OR user_id = auth.uid()) WITH CHECK (user_belongs_to_org(organization_id) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12l. USER ACTIVITY
DROP POLICY IF EXISTS "Users see own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users insert own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Admin sees all activity" ON public.user_activity;
DO $$ BEGIN CREATE POLICY "Users see own activity" ON public.user_activity FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users insert own activity" ON public.user_activity FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admin sees all activity" ON public.user_activity FOR SELECT USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12m. ADMIN AUDIT LOG
DROP POLICY IF EXISTS "audit_log_select" ON public.admin_audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON public.admin_audit_log;
DROP POLICY IF EXISTS "audit_admin_select" ON public.admin_audit_log;
DROP POLICY IF EXISTS "audit_admin_insert" ON public.admin_audit_log;
DO $$ BEGIN CREATE POLICY "audit_admin_select" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "audit_admin_insert" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12n. ORGANIZATIONS
DROP POLICY IF EXISTS "org_select_member" ON public.organizations;
DROP POLICY IF EXISTS "org_update_owner_admin" ON public.organizations;
DROP POLICY IF EXISTS "admin_see_all_orgs" ON public.organizations;
DROP POLICY IF EXISTS "admin_update_orgs" ON public.organizations;
DO $$ BEGIN CREATE POLICY "org_select_member" ON public.organizations FOR SELECT TO authenticated USING (user_belongs_to_org(id) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_update_owner_admin" ON public.organizations FOR UPDATE TO authenticated USING ((user_belongs_to_org(id) AND user_role_in_org(id) IN ('owner', 'admin')) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_see_all_orgs" ON public.organizations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_update_orgs" ON public.organizations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12o. ORGANIZATION MEMBERS
DROP POLICY IF EXISTS "om_select_member" ON public.organization_members;
DROP POLICY IF EXISTS "om_manage_owner_admin" ON public.organization_members;
DROP POLICY IF EXISTS "admin_see_all_members" ON public.organization_members;
DO $$ BEGIN CREATE POLICY "om_select_member" ON public.organization_members FOR SELECT TO authenticated USING (user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "om_manage_owner_admin" ON public.organization_members FOR ALL TO authenticated USING ((user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin')) OR public.has_role(auth.uid(), 'admin')) WITH CHECK ((user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin')) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_see_all_members" ON public.organization_members FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12p. ORGANIZATION INVITATIONS
DROP POLICY IF EXISTS "oi_select_own" ON public.organization_invitations;
DROP POLICY IF EXISTS "oi_manage_owner_admin" ON public.organization_invitations;
DO $$ BEGIN CREATE POLICY "oi_select_own" ON public.organization_invitations FOR SELECT TO authenticated USING ((user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin')) OR email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "oi_manage_owner_admin" ON public.organization_invitations FOR ALL TO authenticated USING ((user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin')) OR public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12q. STORAGE: logos bucket (org-aware)
DROP POLICY IF EXISTS logos_select ON storage.objects;
DROP POLICY IF EXISTS logos_insert ON storage.objects;
DROP POLICY IF EXISTS logos_update ON storage.objects;
DROP POLICY IF EXISTS logos_delete ON storage.objects;
DROP POLICY IF EXISTS logos_select_own ON storage.objects;
DROP POLICY IF EXISTS logos_insert_own ON storage.objects;
DROP POLICY IF EXISTS logos_update_own ON storage.objects;
DROP POLICY IF EXISTS logos_delete_own ON storage.objects;
DROP POLICY IF EXISTS logos_admin_select ON storage.objects;
DROP POLICY IF EXISTS logos_admin_delete ON storage.objects;
DO $$ BEGIN
  CREATE POLICY logos_select ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'logos' AND (user_belongs_to_org((storage.foldername(name))[1]::uuid) OR (storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY logos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'logos' AND ((user_belongs_to_org((storage.foldername(name))[1]::uuid) AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role)) OR (storage.foldername(name))[1] = auth.uid()::text)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY logos_update ON storage.objects FOR UPDATE TO authenticated USING (
    bucket_id = 'logos' AND ((user_belongs_to_org((storage.foldername(name))[1]::uuid) AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role)) OR (storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY logos_delete ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'logos' AND ((user_belongs_to_org((storage.foldername(name))[1]::uuid) AND has_org_role_min_in_org((storage.foldername(name))[1]::uuid, 'admin'::org_role)) OR (storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12r. BLUEPRINT TABLES (admin gerencia, authenticated lê)
DO $$ BEGIN CREATE POLICY "bc_read" ON public.business_categories FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "bc_admin_manage" ON public.business_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "bp_read" ON public.proposal_blueprints FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "bp_admin_manage" ON public.proposal_blueprints FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ps_read" ON public.proposal_sections FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ps_admin_manage" ON public.proposal_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sq_read" ON public.section_questions FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sq_admin_manage" ON public.section_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "cbp_org_read" ON public.company_brand_profiles FOR SELECT TO authenticated USING (user_belongs_to_org(company_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "cbp_org_manage" ON public.company_brand_profiles FOR ALL TO authenticated USING (user_belongs_to_org(company_id) AND user_role_in_org(company_id) IN ('owner', 'admin')) WITH CHECK (user_belongs_to_org(company_id) AND user_role_in_org(company_id) IN ('owner', 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- PARTE 13: STORAGE BUCKET (logos)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- PARTE 14: BACKFILL — Garantir integridade de dados existentes
-- ============================================================

-- 14a. Propostas sem número: backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, owner_id, data, organization_id,
      ROW_NUMBER() OVER (PARTITION BY COALESCE(organization_id, owner_id), to_char(data, 'YYYY-MM') ORDER BY created_at, id) AS seq_num
    FROM public.proposals WHERE numero IS NULL AND data IS NOT NULL
    ORDER BY COALESCE(organization_id, owner_id), data, created_at
  LOOP
    UPDATE public.proposals SET numero = 'PROP-' || to_char(r.data, 'YYYYMM') || '-' || lpad(r.seq_num::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- 14b. Facturas sem número: backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, owner_id, data_emissao, organization_id,
      ROW_NUMBER() OVER (PARTITION BY COALESCE(organization_id, owner_id), to_char(data_emissao, 'YYYY-MM') ORDER BY created_at, id) AS seq_num
    FROM public.invoices WHERE numero IS NULL AND data_emissao IS NOT NULL
    ORDER BY COALESCE(organization_id, owner_id), data_emissao, created_at
  LOOP
    UPDATE public.invoices SET numero = 'FAT-' || to_char(r.data_emissao, 'YYYYMM') || '-' || lpad(r.seq_num::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- 14c. Criar org para users sem org
INSERT INTO public.organizations (id, nome, slug, plano, propostas_mes_count, propostas_mes_reset_at, created_at)
SELECT gen_random_uuid(), COALESCE(NULLIF(empresa, ''), NULLIF(nome, ''), email, 'Minha Organizacao'),
  'org-' || SUBSTRING(id::text, 1, 8), plano, propostas_mes_count, propostas_mes_reset_at, created_at
FROM public.profiles
WHERE NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = profiles.id);

-- 14d. Associar users como owner da sua org
INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
SELECT o.id, p.id, 'owner', p.created_at
FROM public.profiles p
JOIN public.organizations o ON o.slug = 'org-' || SUBSTRING(p.id::text, 1, 8)
WHERE NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = p.id);

-- 14e. Preencher organization_id em profiles
UPDATE public.profiles p SET organization_id = om.organization_id
FROM public.organization_members om WHERE om.user_id = p.id AND p.organization_id IS NULL;

-- 14f. Preencher organization_id em clients
UPDATE public.clients c SET organization_id = om.organization_id
FROM public.organization_members om WHERE c.owner_id = om.user_id AND c.organization_id IS NULL;

-- 14g. Preencher organization_id em catalog_items
UPDATE public.catalog_items ci SET organization_id = om.organization_id
FROM public.organization_members om WHERE ci.owner_id = om.user_id AND ci.organization_id IS NULL;

-- 14h. Preencher organization_id + created_by em proposals
UPDATE public.proposals pr SET organization_id = om.organization_id, created_by = pr.owner_id
FROM public.organization_members om WHERE pr.owner_id = om.user_id AND pr.organization_id IS NULL;

-- 14i. Preencher organization_id + created_by em invoices
UPDATE public.invoices inv SET organization_id = om.organization_id, created_by = inv.owner_id
FROM public.organization_members om WHERE inv.owner_id = om.user_id AND inv.organization_id IS NULL;

-- 14j. Preencher organization_id em proposta_ai
UPDATE public.proposta_ai pa SET organization_id = om.organization_id
FROM public.organization_members om WHERE pa.user_id = om.user_id AND pa.organization_id IS NULL;

-- 14k. Admin backfill: garantir admin tem role + business plan
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'graciochiziane@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin'::public.app_role) ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET plano = 'business'::public.plan_tier WHERE id = v_uid;
    UPDATE public.subscriptions SET plano = 'business'::public.plan_tier WHERE user_id = v_uid;
    -- Garantir org do admin também é business
    UPDATE public.organizations SET plano = 'business'::public.plan_tier
    WHERE id = (SELECT organization_id FROM public.profiles WHERE id = v_uid);
  END IF;
END $$;


-- ============================================================
-- PARTE 15: LIMPEZA — Remover funções mortas
-- ============================================================

-- NOTA: user_org_id e user_org_role foram removidas na migração
-- 20260708010000. Se ainda existirem, remover.
-- has_org_role_min é mantida para compatibilidade com RLS policies
-- que ainda a referenciam (proposals_insert, proposals_delete, etc.)
-- NÃO removê-la.


-- ============================================================
-- PARTE 16: VERIFICAÇÃO FINAL
-- ============================================================

DO $$
DECLARE
  v_tables INT; v_policies INT; v_functions INT; v_triggers INT;
begin
  SELECT COUNT(*) INTO v_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  SELECT COUNT(*) INTO v_policies FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO v_functions FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
  SELECT COUNT(*) INTO v_triggers FROM pg_trigger WHERE NOT tgisinternal;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'REPARAÇÃO CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabelas:     %', v_tables;
  RAISE NOTICE 'RLS Policies: %', v_policies;
  RAISE NOTICE 'Funções:     %', v_functions;
  RAISE NOTICE 'Triggers:    %', v_triggers;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
