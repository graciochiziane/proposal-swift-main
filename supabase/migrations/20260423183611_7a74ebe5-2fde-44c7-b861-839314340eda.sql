
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'business');
CREATE TYPE public.subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
CREATE TYPE public.proposal_status AS ENUM ('rascunho', 'enviada', 'aceite', 'rejeitada');
CREATE TYPE public.invoice_status AS ENUM ('pendente', 'paga', 'vencida', 'anulada');
CREATE TYPE public.desconto_tipo AS ENUM ('percentual', 'valor');

-- =========================================
-- UTILITY: updated_at trigger function
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
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

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

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

-- =========================================
-- SUBSCRIPTIONS
-- =========================================
CREATE TABLE public.subscriptions (
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

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- PLAN LIMITS (lookup)
-- =========================================
CREATE TABLE public.plan_limits (
  plano public.plan_tier PRIMARY KEY,
  propostas_mes INT NOT NULL,
  clientes_max INT,
  templates_pdf TEXT[] NOT NULL DEFAULT ARRAY['classic']
);

INSERT INTO public.plan_limits (plano, propostas_mes, clientes_max, templates_pdf) VALUES
  ('free', 5, 10, ARRAY['classic']),
  ('pro', 2147483647, NULL, ARRAY['classic','modern']),
  ('business', 2147483647, NULL, ARRAY['classic','modern','executive']);

-- =========================================
-- CLIENTS
-- =========================================
CREATE TABLE public.clients (
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
CREATE INDEX idx_clients_owner ON public.clients(owner_id);

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- CATALOG ITEMS
-- =========================================
CREATE TABLE public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_owner ON public.catalog_items(owner_id);

CREATE TRIGGER trg_catalog_updated_at BEFORE UPDATE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- PROPOSALS
-- =========================================
CREATE TABLE public.proposals (
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
CREATE INDEX idx_proposals_owner ON public.proposals(owner_id);
CREATE INDEX idx_proposals_client ON public.proposals(client_id);

CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- PROPOSAL ITEMS
-- =========================================
CREATE TABLE public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_items_proposal ON public.proposal_items(proposal_id);

-- =========================================
-- INVOICES (futuro)
-- =========================================
CREATE TABLE public.invoices (
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
CREATE INDEX idx_invoices_owner ON public.invoices(owner_id);

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE POLICY "subs_select_own_or_admin" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "subs_admin_manage" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- clients
CREATE POLICY "clients_owner_all" ON public.clients FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid());

-- catalog_items
CREATE POLICY "catalog_owner_all" ON public.catalog_items FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid());

-- proposals
CREATE POLICY "proposals_owner_all" ON public.proposals FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid());

-- proposal_items (via parent proposal)
CREATE POLICY "proposal_items_select" ON public.proposal_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "proposal_items_modify" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid()));

-- invoices
CREATE POLICY "invoices_owner_all" ON public.invoices FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid());

-- plan_limits (public read)
CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);

-- =========================================
-- TRIGGER: enforce plan limits on proposals
-- =========================================
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

  -- Reset counter if month elapsed
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

CREATE TRIGGER trg_enforce_proposal_limit
BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_limit();

-- =========================================
-- TRIGGER: handle new user (profile + role + subscription)
-- =========================================
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
