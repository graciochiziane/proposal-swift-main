-- ============================================================
-- ProposalJa — Advanced Proposals: Blueprint Engine
-- Consolidated migration (fixes: ON CONFLICT, help_text→placeholder,
--   search_path, AND/OR precedence, missing index, seed conflicts)
-- Version: 20260807000000
-- Destructive: NO — only CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- Dependencies: organizations, clients, auth.users (from multi-user migration)
--   has_role(), user_belongs_to_org(), has_org_role_min_in_org()
--   (from 20260423, 20260707, 20260708 migrations)
-- ============================================================

BEGIN;

-- ============================================================
-- 0. TRIGGER FUNCTION: set_updated_at (hardened)
--    SET search_path = '' prevents search_path hijacking in SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. ENUM: Visual style for brand profiles
-- ============================================================
CREATE TYPE IF NOT EXISTS public.visual_style AS ENUM (
  'corporate',
  'premium',
  'minimal',
  'technical'
);

-- ============================================================
-- 2. business_categories
--    Library of business sectors for blueprint classification
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. proposal_blueprints
--    Pre-defined proposal structures per business category
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  business_category_id UUID NOT NULL REFERENCES public.business_categories(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  estimated_pages INT DEFAULT 10,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- ============================================================
-- 4. proposal_sections
--    Sections within a blueprint (ordered, typed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.proposal_blueprints(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  title TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  content_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. section_questions
--    Fixed questions per section for controlled data collection
--    NOTE: column is `placeholder` (NOT help_text)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.section_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  placeholder TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  question_type TEXT NOT NULL DEFAULT 'text',
  visibility_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. company_brand_profiles
--    Visual identity per organization
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '',
  secondary_color TEXT DEFAULT '',
  accent_color TEXT DEFAULT '',
  font_preference TEXT DEFAULT 'inter',
  visual_style public.visual_style DEFAULT 'corporate',
  logo_colors_extracted JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ============================================================
-- 7. advanced_proposals
--    Top-level container for advanced proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advanced_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  blueprint_id UUID REFERENCES public.proposal_blueprints(id) ON DELETE SET NULL,
  blueprint_version INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'em_preenchimento', 'em_revisao', 'concluida', 'exportada')),
  brand_profile_id UUID REFERENCES public.company_brand_profiles(id) ON DELETE SET NULL,
  current_section_index INT NOT NULL DEFAULT 0,
  total_sections INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. proposal_section_answers
--    User answers + AI-generated content per section
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_section_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advanced_proposal_id UUID NOT NULL REFERENCES public.advanced_proposals(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL DEFAULT '',
  section_order INT NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}',
  ai_content TEXT DEFAULT '',
  ai_model TEXT DEFAULT '',
  ai_tokens_used INT DEFAULT 0,
  edited_content TEXT DEFAULT '',
  content_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (content_status IN ('pendente', 'gerando', 'gerado', 'editando', 'revisado', 'erro')),
  error_message TEXT DEFAULT '',
  generated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advanced_proposal_id, section_id)
);

-- ============================================================
-- 9. ALTER existing proposals table (non-destructive, nullable)
-- ============================================================
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES public.proposal_blueprints(id) ON DELETE SET NULL;

-- ============================================================
-- 10. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON public.business_categories(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON public.proposal_blueprints(business_category_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_proposal_sections_blueprint ON public.proposal_sections(blueprint_id, "order");
CREATE INDEX IF NOT EXISTS idx_section_questions_section ON public.section_questions(section_id, "order");
CREATE INDEX IF NOT EXISTS idx_brand_profiles_org ON public.company_brand_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_org ON public.advanced_proposals(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_owner ON public.advanced_proposals(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_section_answers_proposal ON public.proposal_section_answers(advanced_proposal_id, section_order);
CREATE INDEX IF NOT EXISTS idx_section_answers_status ON public.proposal_section_answers(content_status);
-- FIX: missing index on proposals.blueprint_id (pointed out by review)
CREATE INDEX IF NOT EXISTS idx_proposals_blueprint_id ON public.proposals(blueprint_id) WHERE blueprint_id IS NOT NULL;

-- ============================================================
-- 11. TRIGGERS: updated_at (with idempotent drop first)
-- ============================================================
DO $$ DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'trg_business_categories_updated_at',
    'trg_proposal_blueprints_updated_at',
    'trg_proposal_sections_updated_at',
    'trg_section_questions_updated_at',
    'trg_company_brand_profiles_updated_at',
    'trg_advanced_proposals_updated_at',
    'trg_proposal_section_answers_updated_at'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t,
      CASE t
        WHEN 'trg_business_categories_updated_at' THEN 'business_categories'
        WHEN 'trg_proposal_blueprints_updated_at' THEN 'proposal_blueprints'
        WHEN 'trg_proposal_sections_updated_at' THEN 'proposal_sections'
        WHEN 'trg_section_questions_updated_at' THEN 'section_questions'
        WHEN 'trg_company_brand_profiles_updated_at' THEN 'company_brand_profiles'
        WHEN 'trg_advanced_proposals_updated_at' THEN 'advanced_proposals'
        WHEN 'trg_proposal_section_answers_updated_at' THEN 'proposal_section_answers'
      END
    );
  END LOOP;
END $$;

CREATE TRIGGER trg_business_categories_updated_at
  BEFORE UPDATE ON public.business_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_proposal_blueprints_updated_at
  BEFORE UPDATE ON public.proposal_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_proposal_sections_updated_at
  BEFORE UPDATE ON public.proposal_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_section_questions_updated_at
  BEFORE UPDATE ON public.section_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_company_brand_profiles_updated_at
  BEFORE UPDATE ON public.company_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_advanced_proposals_updated_at
  BEFORE UPDATE ON public.advanced_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_proposal_section_answers_updated_at
  BEFORE UPDATE ON public.proposal_section_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 12. RLS POLICIES
--    Dependencies (must exist from prior migrations):
--      public.has_role(auth.uid(), 'admin')          — 20260423 migration
--      public.user_belongs_to_org(organization_id)    — 20260707 migration
--      public.has_org_role_min_in_org(org_id, role)   — 20260708 migration
--    All wrapped in DO $$ EXCEPTION for idempotency.
-- ============================================================

-- --- business_categories: readable by all authenticated, admin write ---
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY bc_select_all ON public.business_categories FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY bc_admin_manage ON public.business_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- proposal_blueprints: readable by all, admin write ---
ALTER TABLE public.proposal_blueprints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY pb_select_all ON public.proposal_blueprints FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pb_admin_manage ON public.proposal_blueprints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- proposal_sections: readable by all, admin write ---
ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY ps_select_all ON public.proposal_sections FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ps_admin_manage ON public.proposal_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- section_questions: readable by all, admin write ---
ALTER TABLE public.section_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY sq_select_all ON public.section_questions FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sq_admin_manage ON public.section_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- company_brand_profiles: org-scoped ---
ALTER TABLE public.company_brand_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY cbp_select ON public.company_brand_profiles FOR SELECT TO authenticated
  USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_insert ON public.company_brand_profiles FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_update ON public.company_brand_profiles FOR UPDATE TO authenticated
  USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_delete ON public.company_brand_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- advanced_proposals: org-scoped with explicit AND/OR precedence ---
ALTER TABLE public.advanced_proposals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY advp_select ON public.advanced_proposals FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_insert ON public.advanced_proposals FOR INSERT TO authenticated
  WITH CHECK (
    (public.user_belongs_to_org(organization_id) AND public.has_org_role_min_in_org(organization_id, 'member'))
    OR (owner_id = auth.uid() AND NOT public.user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_update ON public.advanced_proposals FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_delete ON public.advanced_proposals FOR DELETE TO authenticated
  USING (
    -- FIX: explicit parentheses to clarify AND/OR precedence
    (public.user_belongs_to_org(organization_id) AND public.has_org_role_min_in_org(organization_id, 'admin'))
    OR (owner_id = auth.uid() AND NOT public.user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --- proposal_section_answers: scoped via parent advanced_proposal ---
ALTER TABLE public.proposal_section_answers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY psa_select ON public.proposal_section_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advanced_proposals ap
    WHERE ap.id = advanced_proposal_id
    AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_insert ON public.proposal_section_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.advanced_proposals ap
    WHERE ap.id = advanced_proposal_id
    AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid())
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_update ON public.proposal_section_answers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advanced_proposals ap
    WHERE ap.id = advanced_proposal_id
    AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_delete ON public.proposal_section_answers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.advanced_proposals ap
    WHERE ap.id = advanced_proposal_id
    AND (
      -- FIX: explicit parentheses for AND/OR precedence
      (public.user_belongs_to_org(ap.organization_id) AND public.has_org_role_min_in_org(ap.organization_id, 'admin'))
      OR public.has_role(auth.uid(), 'admin')
    )
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 13. SEED: Business Categories
--    FIX: explicit ON CONFLICT (id) DO NOTHING
-- ============================================================
INSERT INTO public.business_categories (id, name, description, slug, icon, sort_order, active) VALUES
  ('a0000000-0001-0000-0000-000000000001',
   'Tecnologia da Informacao',
   'Solucoes de software, hardware, cloud, infraestrutura IT e servicos digitais para empresas.',
   'tecnologia', 'Monitor', 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_categories (id, name, description, slug, icon, sort_order, active) VALUES
  ('a0000000-0001-0000-0000-000000000002',
   'Consultoria e Servicos Profissionais',
   'Consultoria estrategica, financeira, juridica, recursos humanos e outros servicos B2B.',
   'consultoria', 'Briefcase', 2, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_categories (id, name, description, slug, icon, sort_order, active) VALUES
  ('a0000000-0001-0000-0000-000000000003',
   'Construcao e Engenharia',
   'Projetos de construcao civil, engenharia, arquitectura, reformas e manutencao predial.',
   'construcao', 'HardHat', 3, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 14. SEED: Proposal Blueprints
--    FIX: explicit ON CONFLICT (id) DO NOTHING
-- ============================================================
INSERT INTO public.proposal_blueprints (id, name, description, business_category_id, version, is_default, active, estimated_pages) VALUES
  ('b0000000-0001-0000-0000-000000000001',
   'Proposta de Software sob Medida',
   'Estrutura completa para propor solucoes de software personalizado: analise, desenvolvimento, implementacao e suporte.',
   'a0000000-0001-0000-0000-000000000001', 1, true, true, 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.proposal_blueprints (id, name, description, business_category_id, version, is_default, active, estimated_pages) VALUES
  ('b0000000-0001-0000-0000-000000000002',
   'Proposta de Consultoria Estrategica',
   'Framework para apresentar servicos de consultoria: diagnostico, recomendacoes, plano de accao e ROI.',
   'a0000000-0001-0000-0000-000000000002', 1, true, true, 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.proposal_blueprints (id, name, description, business_category_id, version, is_default, active, estimated_pages) VALUES
  ('b0000000-0001-0000-0000-000000000003',
   'Proposta de Obra de Construcao',
   'Estrutura para projetos de construcao: memoria descritivo, custos, cronograma, garantias e condicoes.',
   'a0000000-0001-0000-0000-000000000003', 1, true, true, 15)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. SEED: Sections — Blueprint 1: Software (6 sections)
--    FIX: explicit ON CONFLICT (id) DO NOTHING
-- ============================================================
INSERT INTO public.proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
  ('c1000000-0001-0000-0000-000000000001',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '1. Contexto e Diagnostico', 1, true,
   '{"minWords":120,"maxWords":300,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva o contexto actual do cliente, as dores identificadas e as necessidades que motivam esta proposta. Baseie-se nas respostas do questionario."}'),
  ('c1000000-0001-0000-0000-000000000002',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '2. Solucao Proposta', 2, true,
   '{"minWords":150,"maxWords":400,"tone":"persuasivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Apresente a solucao de forma estruturada. Destaque modulos, funcionalidades principais e como resolvem os problemas identificados. Seja especifico."}'),
  ('c1000000-0001-0000-0000-000000000003',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '3. Metodologia de Implementacao', 3, true,
   '{"minWords":100,"maxWords":300,"tone":"technical","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a abordagem metodologica: fases, tecnologias, praticas AGIL e cronograma resumido. Seja tecnico mas acessivel."}'),
  ('c1000000-0001-0000-0000-000000000004',
   'b0000000-0001-0000-0000-000000000001', 'items_table',
   '4. Detalhamento de Precos', 4, true,
   '{"minWords":0,"maxWords":0,"tone":"formal","requiresData":true,"allowsBullets":false,"allowsTable":true,"promptHint":"Gerar tabela de precos por modulo/fase. Incluir descricao, quantidade, preco unitario e subtotal. Moeda: MZN (Metical)."}'),
  ('c1000000-0001-0000-0000-000000000005',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '5. Beneficios Esperados', 5, true,
   '{"minWords":80,"maxWords":250,"tone":"persuasivo","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Liste os beneficios tangiveis e intangiveis. Inclua ROI estimado, reducao de custos, ganhos de eficiencia e vantagens competitivas."}'),
  ('c1000000-0001-0000-0000-000000000006',
   'b0000000-0001-0000-0000-000000000001', 'terms',
   '6. Condicoes Comerciais e Garantias', 6, true,
   '{"minWords":80,"maxWords":200,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Inclua condicoes de pagamento, garantias, suporte tecnico, SLA e prazo de validade da proposta."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 16. SEED: Sections — Blueprint 2: Consultoria (4 sections)
-- ============================================================
INSERT INTO public.proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
  ('c2000000-0001-0000-0000-000000000001',
   'b0000000-0001-0000-0000-000000000002', 'narrative',
   '1. Analise da Situacao Actual', 1, true,
   '{"minWords":150,"maxWords":350,"tone":"consultivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Analise a situacao actual da organizacao no ambito da consultoria. Identifique desafios, oportunidades e areas de melhoria."}'),
  ('c2000000-0001-0000-0000-000000000002',
   'b0000000-0001-0000-0000-000000000002', 'narrative',
   '2. Abordagem e Metodologia', 2, true,
   '{"minWords":120,"maxWords":300,"tone":"consultivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a metodologia de consultoria: fases, ferramentas, entregaveis e calendario. Mostre expertise e rigor."}'),
  ('c2000000-0001-0000-0000-000000000003',
   'b0000000-0001-0000-0000-000000000002', 'narrative',
   '3. Entregaveis e Resultados Esperados', 3, true,
   '{"minWords":100,"maxWords":250,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Detalhe os entregaveis concretos, resultados mensuraveis e indicadores de sucesso do projecto de consultoria."}'),
  ('c2000000-0001-0000-0000-000000000004',
   'b0000000-0001-0000-0000-000000000002', 'pricing',
   '4. Investimento e Condicoes', 4, true,
   '{"minWords":50,"maxWords":200,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Apresente a estrutura de precos da consultoria: honorarios, despesas, pagamento por fases. Moeda: MZN."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 17. SEED: Sections — Blueprint 3: Construcao (5 sections)
-- ============================================================
INSERT INTO public.proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
  ('c3000000-0001-0000-0000-000000000001',
   'b0000000-0001-0000-0000-000000000003', 'narrative',
   '1. Memoria Descritivo da Obra', 1, true,
   '{"minWords":150,"maxWords":400,"tone":"technical","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a obra: localizacao, tipologia, area, finalidade, materiais previstos e especificacoes tecnicas relevantes."}'),
  ('c3000000-0001-0000-0000-000000000002',
   'b0000000-0001-0000-0000-000000000003', 'narrative',
   '2. Metodologia de Execucao', 2, true,
   '{"minWords":100,"maxWords":300,"tone":"technical","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Explique como a obra sera executada: fases, equipamentos, mao-de-obra, prazos e medidas de seguranca."}'),
  ('c3000000-0001-0000-0000-000000000003',
   'b0000000-0001-0000-0000-000000000003', 'timeline',
   '3. Cronograma de Execucao', 3, true,
   '{"minWords":50,"maxWords":200,"tone":"technical","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Apresente cronograma em formato de tabela: Fase, Periodo, Actividades, Entregaveis. Seja realista com os prazos."}'),
  ('c3000000-0001-0000-0000-000000000004',
   'b0000000-0001-0000-0000-000000000003', 'pricing',
   '4. Orcamento Detalhado', 4, true,
   '{"minWords":50,"maxWords":200,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Tabela de custos: materiais, mao-de-obra, equipamentos, subcontratos. Incluir IVA e total. Moeda: MZN."}'),
  ('c3000000-0001-0000-0000-000000000005',
   'b0000000-0001-0000-0000-000000000003', 'terms',
   '5. Condicoes Gerais e Garantias', 5, true,
   '{"minWords":80,"maxWords":200,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Inclua garantias da obra, prazos de execucao, condicoes de pagamento, seguro e responsabilidade tecnica."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 18. SEED: Questions — Blueprint 1: Software
--    FIX: uses `placeholder` column (NOT help_text)
--    FIX: explicit ON CONFLICT (id) DO NOTHING
-- ============================================================
INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000001', 'c1000000-0001-0000-0000-000000000001',
   'Qual e o principal desafio ou dor que o cliente enfrenta actualmente?',
   'Seja especifico: problemas de eficiencia, custos, escalabilidade, etc.', 1, true, 'textarea', '{}'),
  ('d1000000-0001-0000-0000-000000000002', 'c1000000-0001-0000-0000-000000000001',
   'Existem sistemas actuais em uso? Quais?',
   'Liste software, ferramentas ou processos manuais actuais.', 2, false, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000003', 'c1000000-0001-0000-0000-000000000002',
   'Quais modulos ou funcionalidades principais deve incluir a solucao?',
   'Ex: gestao de utilizadores, relatorios, integracoes, API, etc.', 1, true, 'textarea', '{}'),
  ('d1000000-0001-0000-0000-000000000004', 'c1000000-0001-0000-0000-000000000002',
   'Existem requisitos tecnicos especificos? (tecnologias, integracoes, compliance)',
   'Ex: React, PostgreSQL, integracao com SAP, LGPD, etc.', 2, false, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000005', 'c1000000-0001-0000-0000-000000000003',
   'Qual o prazo desejado para a implementacao?',
   'Ex: 3 meses, 6 meses, fases...', 1, false, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000006', 'c1000000-0001-0000-0000-000000000004',
   'Qual o orcamento disponivel para o projecto?',
   'Em MZN (Meticais). Indique faixa ou valor exacto.', 1, true, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000007', 'c1000000-0001-0000-0000-000000000005',
   'Quais resultados tangiveis o cliente espera obter?',
   'Ex: reducao de 30% no tempo de processo, automacao de X tarefas...', 1, false, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 19. SEED: Questions — Blueprint 2: Consultoria
--    FIX: uses `placeholder` column (NOT help_text)
-- ============================================================
INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000001', 'c2000000-0001-0000-0000-000000000001',
   'Qual e a area de consultoria pretendida?',
   'Ex: estrategia, financeira, RH, operacoes, transformacao digital, etc.', 1, true, 'text', '{}'),
  ('d2000000-0001-0000-0000-000000000002', 'c2000000-0001-0000-0000-000000000001',
   'Descreva brevemente a organizacao (tamanho, sector, equipa)',
   'Inclua numero de colaboradores, volume de negocios, desafios actuais.', 2, true, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000003', 'c2000000-0001-0000-0000-000000000002',
   'Ja existiu algum projecto de consultoria anterior nesta area?',
   'Descreva resultados obtidos ou insucessos.', 1, false, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000004', 'c2000000-0001-0000-0000-000000000004',
   'Qual o investimento maximo disponivel?',
   'Em MZN. Indique faixa ou valor mensal/total.', 1, true, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20. SEED: Questions — Blueprint 3: Construcao
--    FIX: uses `placeholder` column (NOT help_text)
-- ============================================================
INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000001', 'c3000000-0001-0000-0000-000000000001',
   'Descreva a obra (tipo, localizacao, area aproximada)',
   'Ex: Construcao de edificio de escritorios, 3 andares, 500m2, Maputo.', 1, true, 'textarea', '{}'),
  ('d3000000-0001-0000-0000-000000000002', 'c3000000-0001-0000-0000-000000000001',
   'Existe projecto de arquitectura ou licenca aprovada?',
   'Sim/Nao e detalhes relevantes.', 2, false, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000003', 'c3000000-0001-0000-0000-000000000003',
   'Prazo desejado para conclusao da obra?',
   'Ex: 6 meses, 1 ano, por fases.', 1, true, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000004', 'c3000000-0001-0000-0000-000000000004',
   'Orcamento disponivel para a obra?',
   'Em MZN. Inclua margem para imprevistos.', 1, true, 'text', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.section_questions (id, section_id, question_text, placeholder, "order", required, question_type, visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000005', 'c3000000-0001-0000-0000-000000000005',
   'Materiais preferidos ou restricoes especificas?',
   'Ex: estrutura metalica, acabamentos premium, normas de seguranca...', 1, false, 'textarea', '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFICACAO FINAL
-- ============================================================
DO $$
DECLARE
  v_bc INT; v_bp INT; v_ps INT; v_sq INT;
  v_ap INT; v_sa INT; v_cbp INT;
BEGIN
  SELECT COUNT(*) INTO v_bc FROM public.business_categories;
  SELECT COUNT(*) INTO v_bp FROM public.proposal_blueprints;
  SELECT COUNT(*) INTO v_ps FROM public.proposal_sections;
  SELECT COUNT(*) INTO v_sq FROM public.section_questions;
  SELECT COUNT(*) INTO v_ap FROM information_schema.tables WHERE table_name = 'advanced_proposals' AND table_schema = 'public';
  SELECT COUNT(*) INTO v_sa FROM information_schema.tables WHERE table_name = 'proposal_section_answers' AND table_schema = 'public';
  SELECT COUNT(*) INTO v_cbp FROM information_schema.tables WHERE table_name = 'company_brand_profiles' AND table_schema = 'public';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACAO CONCLUIDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'business_categories: %', v_bc;
  RAISE NOTICE 'proposal_blueprints: %', v_bp;
  RAISE NOTICE 'proposal_sections: %', v_ps;
  RAISE NOTICE 'section_questions: %', v_sq;
  RAISE NOTICE 'advanced_proposals table: %', v_ap;
  RAISE NOTICE 'proposal_section_answers table: %', v_sa;
  RAISE NOTICE 'company_brand_profiles table: %', v_cbp;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
