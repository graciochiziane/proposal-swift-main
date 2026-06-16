-- ============================================================
-- ProposalJa / Proposal Swift — CONSOLIDATED STAGING SQL
-- ============================================================
-- Idempotent: safe to re-run on a fresh or existing database.
-- All CREATE OR REPLACE / IF NOT EXISTS / DO $$ EXCEPTION used.
--
-- ORDER:
--   1. Types / Enums
--   2. Utility Functions
--   3. Base Tables
--   4. Base RLS (original, pre-multi-user)
--   5. Base Triggers (original, pre-multi-user)
--   6. Multi-User Tables
--   7. Multi-User Functions
--   8. Data Migration (existing data → org structure)
--   9. Multi-User RLS (replaces base RLS for key tables)
--  10. Updated Triggers (org-aware replacements)
-- ============================================================


-- ============================================================
-- SECTION 1: TYPES / ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'enviada', 'aceite', 'rejeitada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('pendente', 'paga', 'vencida', 'anulada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.desconto_tipo AS ENUM ('percentual', 'valor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- org_role is defined later in SECTION 6 (multi-user) but we
-- declare the type here so it can be referenced by functions.
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 2: UTILITY FUNCTIONS
-- ============================================================

-- 2a. Auto-set updated_at on row update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2b. Check if user has a given app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2c. Count IA generations this month for a user
CREATE OR REPLACE FUNCTION public.count_ia_generations_this_month(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.proposta_ai
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now())
$$;

-- 2d. Get IA generation limit for a user's plan
CREATE OR REPLACE FUNCTION public.get_ia_limit(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pl.geracoes_ia_mes
  FROM public.profiles p
  JOIN public.plan_limits pl ON pl.plano = p.plano
  WHERE p.id = p_user_id
$$;

-- 2e. Clean up old user activity (keep last 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_activity
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- 2f. Auto-generate proposal numero (PROP-YYYYMM-0001 per owner per month)
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

  SELECT COUNT(*)
    INTO v_seq
  FROM public.proposals
  WHERE owner_id = NEW.owner_id
    AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');

  v_numero := 'PROP-'
    || to_char(NEW.data, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

-- 2g. Auto-generate invoice numero (FAT-YYYYMM-0001 per owner per month)
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

  SELECT COUNT(*)
    INTO v_seq
  FROM public.invoices
  WHERE owner_id = NEW.owner_id
    AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');

  v_numero := 'FAT-'
    || to_char(NEW.data_emissao, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

-- 2h. Log admin deletions to audit table
CREATE OR REPLACE FUNCTION public.log_admin_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot     JSONB;
  v_action       TEXT;
  v_owner_id     UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN OLD;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'clients' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_client';
      v_snapshot := jsonb_build_object(
        'nome', OLD.nome,
        'email', OLD.email,
        'telefone', OLD.telefone,
        'empresa', OLD.empresa
      );

    WHEN 'proposals' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_proposal';
      v_snapshot := jsonb_build_object(
        'numero', OLD.numero,
        'client_id', OLD.client_id,
        'total', OLD.total,
        'status', OLD.status
      );

    WHEN 'catalog_items' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_catalog_item';
      v_snapshot := jsonb_build_object(
        'nome', OLD.nome,
        'preco_unitario', OLD.preco_unitario
      );

    WHEN 'invoices' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_invoice';
      v_snapshot := jsonb_build_object(
        'numero', OLD.numero,
        'total', OLD.total,
        'status', OLD.status
      );

    ELSE
      RETURN OLD;
  END CASE;

  INSERT INTO public.admin_audit_log
    (admin_id, action, target_table, target_id, target_owner_id, target_snapshot)
  VALUES
    (auth.uid(), v_action, TG_TABLE_NAME, OLD.id, v_owner_id, v_snapshot);

  RETURN OLD;
END;
$$;

-- 2i. Enforce proposal plan limit (BASE version — per-user only)
-- NOTE: This is the original version. It is REPLACED by the
--       org-aware version in SECTION 10 (multi-user).
CREATE OR REPLACE FUNCTION public.enforce_proposal_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.plan_tier;
  v_count INT;
  v_reset TIMESTAMPTZ;
  v_limit INT;
BEGIN
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
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED: limite de % propostas/mês atingido no plano %', v_limit, v_plano
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
    SET propostas_mes_count = v_count + 1,
        propostas_mes_reset_at = v_reset
    WHERE id = NEW.owner_id;

  RETURN NEW;
END;
$$;

-- 2j. Handle new user signup (BASE version — no org creation)
-- NOTE: This is the original version. It is REPLACED by the
--       org-aware version in SECTION 10 (multi-user).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := lower(NEW.email) = 'graciochiziane@gmail.com';

  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END);

  INSERT INTO public.subscriptions (user_id, plano, status, provider)
  VALUES (NEW.id, 'free', 'active', 'manual');

  RETURN NEW;
END;
$$;


-- ============================================================
-- SECTION 3: BASE TABLES
-- ============================================================

-- 3a. PROFILES
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added by admin_metrics migration
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Added by multi-user migration (column added here for convenience;
-- FK enforced after organizations table is created in SECTION 6)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen_at DESC);


-- 3b. USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);


-- 3c. SUBSCRIPTIONS
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


-- 3d. PLAN LIMITS (lookup table)
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plano public.plan_tier PRIMARY KEY,
  propostas_mes INT NOT NULL,
  clientes_max INT,
  templates_pdf TEXT[] NOT NULL DEFAULT ARRAY['classic'],
  geracoes_ia_mes INT NOT NULL DEFAULT 3
);

-- Seed plan limits (idempotent upsert)
INSERT INTO public.plan_limits (plano, propostas_mes, clientes_max, templates_pdf, geracoes_ia_mes) VALUES
  ('free', 5, 10, ARRAY['classic'], 3),
  ('pro', 2147483647, NULL, ARRAY['classic','modern'], 50),
  ('business', 2147483647, NULL, ARRAY['classic','modern','executive'], 2147483647)
ON CONFLICT (plano) DO UPDATE SET
  propostas_mes = EXCLUDED.propostas_mes,
  clientes_max = EXCLUDED.clientes_max,
  templates_pdf = EXCLUDED.templates_pdf,
  geracoes_ia_mes = EXCLUDED.geracoes_ia_mes;

-- Safety net: add column if table was created without it
ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 3;

-- Update existing rows if column was just added
UPDATE public.plan_limits SET geracoes_ia_mes = 3 WHERE plano = 'free' AND geracoes_ia_mes IS NULL;
UPDATE public.plan_limits SET geracoes_ia_mes = 50 WHERE plano = 'pro' AND geracoes_ia_mes IS NULL;
UPDATE public.plan_limits SET geracoes_ia_mes = 2147483647 WHERE plano = 'business' AND geracoes_ia_mes IS NULL;


-- 3e. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  empresa TEXT DEFAULT '',
  nuit TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id);

-- Added by multi-user migration
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organization_id UUID;


-- 3f. CATALOG ITEMS
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_owner ON public.catalog_items(owner_id);

-- Added by multi-user migration
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Unique constraint for upsert by name per owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalog_items_owner_nome_unique'
  ) THEN
    ALTER TABLE public.catalog_items
    ADD CONSTRAINT catalog_items_owner_nome_unique
    UNIQUE (owner_id, nome);
  END IF;
END $$;


-- 3g. PROPOSALS
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  numero TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_tipo public.desconto_tipo NOT NULL DEFAULT 'percentual',
  desconto_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_percentual NUMERIC(5,2) NOT NULL DEFAULT 16,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT DEFAULT '',
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  cliente_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_owner ON public.proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_status ON public.proposals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_data ON public.proposals(owner_id, data DESC);

-- Added by multi-user migration
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Make numero NOT NULL + UNIQUE (safe: only applies if column has no NULLs)
DO $$
BEGIN
  -- Backfill: assign numbers to existing proposals without one
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN
      SELECT
        id,
        owner_id,
        data,
        ROW_NUMBER() OVER (
          PARTITION BY owner_id, to_char(data, 'YYYY-MM')
          ORDER BY created_at, id
        ) AS seq_num
      FROM public.proposals
      WHERE numero IS NULL
        AND data IS NOT NULL
      ORDER BY owner_id, data, created_at
    LOOP
      UPDATE public.proposals
      SET numero = 'PROP-'
        || to_char(r.data, 'YYYYMM')
        || '-'
        || lpad(r.seq_num::text, 4, '0')
      WHERE id = r.id;
    END LOOP;
  END;
END $$;

DO $$
BEGIN
  -- Only set NOT NULL if no NULLs remain
  IF NOT EXISTS (SELECT 1 FROM public.proposals WHERE numero IS NULL) THEN
    ALTER TABLE public.proposals ALTER COLUMN numero SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposals_numero_owner_unique'
  ) THEN
    ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_numero_owner_unique
    UNIQUE (owner_id, numero);
  END IF;
END $$;


-- 3h. PROPOSAL ITEMS
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_ordem
  ON public.proposal_items(proposal_id, ordem);

-- Added by schema_fixes migration
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- 3i. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  numero TEXT,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_id);

-- Added by multi-user migration
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID;


-- 3j. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON public.invoice_items(invoice_id);


-- 3k. PROPOSTA IA (AI-generated proposals)
CREATE TABLE IF NOT EXISTS public.proposta_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referencia TEXT,
  mode TEXT NOT NULL DEFAULT 'rapido' CHECK (mode IN ('rapido', 'assertivo')),
  tone TEXT NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal', 'persuasivo', 'tecnico', 'consultivo')),
  sector TEXT,
  input_json JSONB,
  output_json JSONB,
  edited_json JSONB,
  modelo TEXT DEFAULT 'gpt-4o-mini',
  tokens_usados INTEGER DEFAULT 0,
  custo_usd NUMERIC(10,6) DEFAULT 0,
  gerado_em TIMESTAMPTZ,
  exportado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_user ON public.proposta_ai(user_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_cotacao ON public.proposta_ai(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_created ON public.proposta_ai(created_at DESC);

-- Added by multi-user migration
ALTER TABLE public.proposta_ai
  ADD COLUMN IF NOT EXISTS organization_id UUID;


-- 3l. USER ACTIVITY (admin metrics)
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at
  ON public.user_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date
  ON public.user_activity (user_id, created_at DESC);


-- 3m. ADMIN AUDIT LOG
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  target_table    TEXT        NOT NULL,
  target_id       UUID        NOT NULL,
  target_owner_id UUID,
  target_snapshot JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin
  ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log(created_at DESC);


-- 3n. SUPABASE STORAGE: Bucket for logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- SECTION 4: BASE RLS (original, pre-multi-user)
-- ============================================================

-- 4a. Enable RLS on all tables
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

-- 4b. profiles policies
-- NOTE: "profiles_select_own_or_admin" is DROPPED in SECTION 9 and
--       replaced by "profiles_select_org". The update policies persist.
DO $$ BEGIN
  CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin can update any profile
DO $$ BEGIN
  CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4c. user_roles policies
DO $$ BEGIN
  CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4d. subscriptions policies
DO $$ BEGIN
  CREATE POLICY "subs_select_own_or_admin" ON public.subscriptions FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "subs_admin_manage" ON public.subscriptions FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4e. clients policies
-- NOTE: "clients_owner_all" is DROPPED in SECTION 9 and replaced by
--       "clients_org_or_owner".
DO $$ BEGIN
  CREATE POLICY "clients_owner_all" ON public.clients FOR ALL TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4f. catalog_items policies
-- NOTE: "catalog_owner_all" is DROPPED in SECTION 9 and replaced by
--       "catalog_org_or_owner".
DO $$ BEGIN
  CREATE POLICY "catalog_owner_all" ON public.catalog_items FOR ALL TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4g. proposals policies
-- NOTE: "proposals_owner_all" is DROPPED in SECTION 9 and replaced by
--       split policies (proposals_select/insert/update/delete).
DO $$ BEGIN
  CREATE POLICY "proposals_owner_all" ON public.proposals FOR ALL TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4h. proposal_items policies
-- NOTE: Both policies are DROPPED in SECTION 9 and replaced by
--       org-aware versions.
DO $$ BEGIN
  CREATE POLICY "proposal_items_select" ON public.proposal_items FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposal_items_modify" ON public.proposal_items FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4i. invoices policies
-- NOTE: "invoices_owner_all" is DROPPED in SECTION 9 and replaced by
--       split policies (invoices_select/insert/update/delete).
DO $$ BEGIN
  CREATE POLICY "invoices_owner_all" ON public.invoices FOR ALL TO authenticated
    USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4j. invoice_items policies
DO $$ BEGIN
  CREATE POLICY "ii_owner_select" ON public.invoice_items
    FOR SELECT USING (
      invoice_id IN (SELECT id FROM public.invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_insert" ON public.invoice_items
    FOR INSERT WITH CHECK (
      invoice_id IN (SELECT id FROM public.invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_update" ON public.invoice_items
    FOR UPDATE USING (
      invoice_id IN (SELECT id FROM public.invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_delete" ON public.invoice_items
    FOR DELETE USING (
      invoice_id IN (SELECT id FROM public.invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_admin_all" ON public.invoice_items
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4k. plan_limits policy
DO $$ BEGIN
  CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4l. proposta_ai policies
-- NOTE: Both are DROPPED in SECTION 9 and replaced by org-aware versions.
DO $$ BEGIN
  CREATE POLICY "Users manage own proposta_ai"
    ON public.proposta_ai FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin reads all proposta_ai"
    ON public.proposta_ai FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4m. user_activity policies
DO $$ BEGIN
  CREATE POLICY "Users see own activity"
    ON public.user_activity FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own activity"
    ON public.user_activity FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin sees all activity"
    ON public.user_activity FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4n. admin_audit_log policies
DO $$ BEGIN
  CREATE POLICY "audit_log_select" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "audit_log_insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4o. Storage bucket policies (logos)
DO $$ BEGIN
  CREATE POLICY "logos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "logos_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 5: BASE TRIGGERS (original, pre-multi-user)
-- ============================================================

-- 5a. updated_at auto-triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_updated_at BEFORE UPDATE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_proposal_items_updated_at ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_updated_at BEFORE UPDATE ON public.proposal_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5b. Proposal numero auto-generation (runs before enforce_proposal_limit
--     due to 'a_' alphabetical ordering of trigger names in PostgreSQL)
DROP TRIGGER IF EXISTS a_set_proposal_numero ON public.proposals;
CREATE TRIGGER a_set_proposal_numero
BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_proposal_numero();

-- 5c. Invoice numero auto-generation
DROP TRIGGER IF EXISTS a_set_invoice_numero ON public.invoices;
CREATE TRIGGER a_set_invoice_numero
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_numero();

-- 5d. Enforce proposal plan limit (BASE version — per-user)
-- NOTE: Replaced by org-aware version in SECTION 10.
DROP TRIGGER IF EXISTS trg_enforce_proposal_limit ON public.proposals;
CREATE TRIGGER trg_enforce_proposal_limit
BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_limit();

-- 5e. Admin deletion audit log triggers
DROP TRIGGER IF EXISTS trg_audit_clients_delete ON public.clients;
CREATE TRIGGER trg_audit_clients_delete
BEFORE DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_proposals_delete ON public.proposals;
CREATE TRIGGER trg_audit_proposals_delete
BEFORE DELETE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_catalog_delete ON public.catalog_items;
CREATE TRIGGER trg_audit_catalog_delete
BEFORE DELETE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_invoices_delete ON public.invoices;
CREATE TRIGGER trg_audit_invoices_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

-- 5f. New user signup trigger (BASE version)
-- NOTE: Function is replaced by org-aware version in SECTION 10.
--       The trigger itself persists and automatically uses the latest function body.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- SECTION 6: MULTI-USER TABLES
-- ============================================================
-- Organizations, Members, and Invitations for multi-tenant support.

-- 6a. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
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
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON public.organizations(slug);

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 6b. ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);


-- 6c. ORGANIZATION INVITATIONS
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);


-- 6d. Add FK constraints for organization_id columns added in SECTION 3
-- (Deferred until now because the organizations table didn't exist yet)
DO $$
BEGIN
  -- profiles.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_organization_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- clients.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_organization_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- catalog_items.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_items_organization_id_fkey'
  ) THEN
    ALTER TABLE public.catalog_items
      ADD CONSTRAINT catalog_items_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- proposals.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_organization_id_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- proposals.created_by
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_created_by_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- invoices.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_organization_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- invoices.created_by
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_created_by_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- proposta_ai.organization_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposta_ai_organization_id_fkey'
  ) THEN
    ALTER TABLE public.proposta_ai
      ADD CONSTRAINT proposta_ai_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some FK constraints may already exist or columns may not exist yet: %', SQLERRM;
END $$;


-- ============================================================
-- SECTION 7: MULTI-USER FUNCTIONS
-- ============================================================

-- 7a. Get the organization_id for a user (NULL if no org)
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

-- 7b. Get the org role for a user (NULL if no org)
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

-- 7c. Check if user has at least a minimum org role
--     owner(0) > admin(1) > member(2) > viewer(3)
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

-- 7d. Count org proposals this month
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

-- 7e. Count org IA generations this month
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


-- ============================================================
-- SECTION 8: DATA MIGRATION (existing data → org structure)
-- ============================================================
-- Each existing user becomes "owner" of their own organization.
-- Safe to re-run: all INSERTs have WHERE NOT EXISTS guards.

-- 8a. Create an organization for each profile that doesn't have one yet
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

-- 8b. Associate each user as "owner" of their org
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

-- 8c. Fill organization_id in profiles
UPDATE public.profiles p
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE om.user_id = p.id
  AND p.organization_id IS NULL;

-- 8d. Fill organization_id in clients
UPDATE public.clients c
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE c.owner_id = om.user_id
  AND c.organization_id IS NULL;

-- 8e. Fill organization_id in catalog_items
UPDATE public.catalog_items ci
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE ci.owner_id = om.user_id
  AND ci.organization_id IS NULL;

-- 8f. Fill organization_id + created_by in proposals
UPDATE public.proposals pr
SET organization_id = om.organization_id,
    created_by = pr.owner_id
FROM public.organization_members om
WHERE pr.owner_id = om.user_id
  AND pr.organization_id IS NULL;

-- 8g. Fill organization_id + created_by in invoices
UPDATE public.invoices inv
SET organization_id = om.organization_id,
    created_by = inv.owner_id
FROM public.organization_members om
WHERE inv.owner_id = om.user_id
  AND inv.organization_id IS NULL;

-- 8h. Fill organization_id in proposta_ai
UPDATE public.proposta_ai pa
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE pa.user_id = om.user_id
  AND pa.organization_id IS NULL;


-- ============================================================
-- SECTION 9: MULTI-USER RLS (replaces base RLS for key tables)
-- ============================================================
-- These policies add org-level access alongside the original
-- owner-based access. Old policies are dropped first.

-- 9a. Enable RLS on new multi-user tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- 9b. organizations policies
DO $$ BEGIN
  CREATE POLICY "org_select_member" ON public.organizations FOR SELECT TO authenticated
    USING (
      id = user_org_id(auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "org_update_owner_admin" ON public.organizations FOR UPDATE TO authenticated
    USING (
      id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9c. organization_members policies
DO $$ BEGIN
  CREATE POLICY "om_select_member" ON public.organization_members FOR SELECT TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "om_manage_owner_admin" ON public.organization_members FOR ALL TO authenticated
    USING (
      organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
      OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
      organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9d. organization_invitations policies
DO $$ BEGIN
  CREATE POLICY "oi_select_own" ON public.organization_invitations FOR SELECT TO authenticated
    USING (
      (organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin'))
      OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "oi_manage_owner_admin" ON public.organization_invitations FOR ALL TO authenticated
    USING (
      organization_id = user_org_id(auth.uid()) AND user_org_role(auth.uid()) IN ('owner', 'admin')
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9e. REPLACE: profiles select policy (add org member visibility)
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DO $$ BEGIN
  CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated
    USING (
      id = auth.uid()
      OR organization_id = user_org_id(auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9f. REPLACE: clients policy (org members OR owner fallback OR platform admin)
DROP POLICY IF EXISTS "clients_owner_all" ON public.clients;
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9g. REPLACE: catalog_items policy (org members OR owner fallback)
DROP POLICY IF EXISTS "catalog_owner_all" ON public.catalog_items;
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9h. REPLACE: proposals policies (split by operation for fine-grained control)
DROP POLICY IF EXISTS "proposals_owner_all" ON public.proposals;
DO $$ BEGIN
  CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
    WITH CHECK (
      (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'member'))
      OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
    USING (
      (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'admin'))
      OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9i. REPLACE: proposal_items policies (via parent proposal, org-aware)
DROP POLICY IF EXISTS "proposal_items_select" ON public.proposal_items;
DROP POLICY IF EXISTS "proposal_items_modify" ON public.proposal_items;
DO $$ BEGIN
  CREATE POLICY "pi_select" ON public.proposal_items FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_id
      AND (p.organization_id = user_org_id(auth.uid()) OR p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9j. REPLACE: invoices policies (split by operation for fine-grained control)
DROP POLICY IF EXISTS "invoices_owner_all" ON public.invoices;
DO $$ BEGIN
  CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
    WITH CHECK (
      (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'member'))
      OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
    USING (
      (organization_id = user_org_id(auth.uid()) AND has_org_role_min(auth.uid(), 'admin'))
      OR (owner_id = auth.uid() AND user_org_id(auth.uid()) IS NULL)
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9k. REPLACE: proposta_ai policies (org members OR owner fallback)
DROP POLICY IF EXISTS "Users manage own proposta_ai" ON public.proposta_ai;
DROP POLICY IF EXISTS "Admin reads all proposta_ai" ON public.proposta_ai;
DO $$ BEGIN
  CREATE POLICY "pai_select" ON public.proposta_ai FOR SELECT TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pai_modify" ON public.proposta_ai FOR ALL TO authenticated
    USING (
      organization_id = user_org_id(auth.uid())
      OR user_id = auth.uid()
    )
    WITH CHECK (
      organization_id = COALESCE(user_org_id(auth.uid()), organization_id)
      OR user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- SECTION 10: UPDATED TRIGGERS (org-aware replacements)
-- ============================================================
-- These CREATE OR REPLACE functions override the base versions
-- from SECTION 2. The existing triggers (SECTION 5) automatically
-- use the latest function body.

-- 10a. REPLACE: enforce_proposal_limit (org-aware)
--     If user has org → count per org.
--     If no org → fallback to per-user count.
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

  IF v_org_id IS NOT NULL THEN
    -- Count per organization
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

    -- Sync organization_id on the proposal
    NEW.organization_id := v_org_id;

  ELSE
    -- Fallback: count per user (no org)
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

-- 10b. REPLACE: handle_new_user (org-aware, auto-create org on signup)
--     Admin email gets 'business' plan.
--     Every new user gets a personal organization.
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

  -- Create a personal organization for the new user
  v_org_nome := COALESCE(NEW.raw_user_meta_data->>'empresa', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1), 'Minha Organizacao');

  INSERT INTO public.organizations (nome, slug, plano)
  VALUES (v_org_nome, 'org-' || SUBSTRING(NEW.id::text, 1, 8), CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END)
  RETURNING id INTO v_org_id;

  -- Associate user as owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  -- Link profile to org
  UPDATE public.profiles SET organization_id = v_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 10c. Backfill: ensure admin user has correct role + business plan
--     (in case this runs on an existing database where admin already exists)
DO $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'graciochiziane@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET plano = 'business'::public.plan_tier WHERE id = v_uid;
    UPDATE public.subscriptions SET plano = 'business'::public.plan_tier WHERE user_id = v_uid;
  END IF;
END $$;


-- ============================================================
-- END OF CONSOLIDATED STAGING SQL
-- ============================================================