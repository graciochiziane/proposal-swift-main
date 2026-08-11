-- ============================================================
-- ProposalJa — Advanced Proposals: Blueprint Engine
-- Assumes: organizations, organization_members, plan_tier,
--   user_belongs_to_org(), has_org_role_min_in_org() already exist.
-- Fixes: has_role() — redefined to query user_roles (not profiles.role).
-- ============================================================

BEGIN;

-- ============================================================
-- 0. FIX: has_role() — queries user_roles table, NOT profiles.role
--     (profiles has no role column; user_roles has user_id + role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = p_role); $$;

-- ============================================================
-- 1. ENUM: visual_style (idempotent)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.visual_style AS ENUM ('corporate','premium','minimal','technical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TRIGGER FUNCTION: set_updated_at (only if missing)
-- ============================================================
DO $$ BEGIN
  CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
  AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
EXCEPTION WHEN duplicate_function THEN NULL;
END $$;

-- ============================================================
-- 3. business_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT DEFAULT '', slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '', sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. proposal_blueprints
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, description TEXT DEFAULT '',
  business_category_id UUID NOT NULL REFERENCES public.business_categories(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1, is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true, estimated_pages INT DEFAULT 10,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- ============================================================
-- 5. proposal_sections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.proposal_blueprints(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text', title TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0, required BOOLEAN NOT NULL DEFAULT true,
  content_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. section_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.section_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL, placeholder TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0, required BOOLEAN NOT NULL DEFAULT true,
  question_type TEXT NOT NULL DEFAULT 'text',
  visibility_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. company_brand_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '', secondary_color TEXT DEFAULT '', accent_color TEXT DEFAULT '',
  font_preference TEXT DEFAULT 'inter', visual_style public.visual_style DEFAULT 'corporate',
  logo_colors_extracted JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ============================================================
-- 8. advanced_proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advanced_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  blueprint_id UUID REFERENCES public.proposal_blueprints(id) ON DELETE SET NULL,
  blueprint_version INT NOT NULL DEFAULT 1, title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_preenchimento','em_revisao','concluida','exportada')),
  brand_profile_id UUID REFERENCES public.company_brand_profiles(id) ON DELETE SET NULL,
  current_section_index INT NOT NULL DEFAULT 0, total_sections INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. proposal_section_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_section_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advanced_proposal_id UUID NOT NULL REFERENCES public.advanced_proposals(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL DEFAULT '', section_order INT NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}',
  ai_content TEXT DEFAULT '', ai_model TEXT DEFAULT '', ai_tokens_used INT DEFAULT 0,
  edited_content TEXT DEFAULT '',
  content_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (content_status IN ('pendente','gerando','gerado','editando','revisado','erro')),
  error_message TEXT DEFAULT '',
  generated_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advanced_proposal_id, section_id)
);

-- ============================================================
-- 10. ALTER proposals (add blueprint_id, non-destructive)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS blueprint_id UUID
    REFERENCES public.proposal_blueprints(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 11. INDEXES
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
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_proposals_blueprint_id ON public.proposals(blueprint_id) WHERE blueprint_id IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ============================================================
-- 12. TRIGGERS (idempotent drop+create loop)
-- ============================================================
DO $$ DECLARE _tbl text; _trg text;
BEGIN
  FOR _tbl, _trg IN SELECT unnest(ARRAY[
    ('business_categories','trg_business_categories_updated_at'),
    ('proposal_blueprints','trg_proposal_blueprints_updated_at'),
    ('proposal_sections','trg_proposal_sections_updated_at'),
    ('section_questions','trg_section_questions_updated_at'),
    ('company_brand_profiles','trg_company_brand_profiles_updated_at'),
    ('advanced_proposals','trg_advanced_proposals_updated_at'),
    ('proposal_section_answers','trg_proposal_section_answers_updated_at')
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _trg, _tbl);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', _trg, _tbl);
  END LOOP;
END $$;

-- ============================================================
-- 13. RLS POLICIES (idempotent, org-scoped)
-- ============================================================

-- business_categories: readable by all authenticated, manageable by admins
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY bc_select_all ON public.business_categories FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY bc_admin_manage ON public.business_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_blueprints: readable by all authenticated, manageable by admins
ALTER TABLE public.proposal_blueprints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY pb_select_all ON public.proposal_blueprints FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pb_admin_manage ON public.proposal_blueprints FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_sections: readable by all authenticated, manageable by admins
ALTER TABLE public.proposal_sections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY ps_select_all ON public.proposal_sections FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ps_admin_manage ON public.proposal_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- section_questions: readable by all authenticated, manageable by admins
ALTER TABLE public.section_questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY sq_select_all ON public.section_questions FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sq_admin_manage ON public.section_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- company_brand_profiles: org-scoped
ALTER TABLE public.company_brand_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY cbp_select ON public.company_brand_profiles FOR SELECT TO authenticated USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_insert ON public.company_brand_profiles FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_org(organization_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_update ON public.company_brand_profiles FOR UPDATE TO authenticated USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY cbp_delete ON public.company_brand_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- advanced_proposals: org-scoped + owner fallback
ALTER TABLE public.advanced_proposals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY advp_select ON public.advanced_proposals FOR SELECT TO authenticated USING (public.user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_insert ON public.advanced_proposals FOR INSERT TO authenticated WITH CHECK ((public.user_belongs_to_org(organization_id) AND public.has_org_role_min_in_org(organization_id,'member')) OR (owner_id = auth.uid() AND NOT public.user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_update ON public.advanced_proposals FOR UPDATE TO authenticated USING (public.user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY advp_delete ON public.advanced_proposals FOR DELETE TO authenticated USING ((public.user_belongs_to_org(organization_id) AND public.has_org_role_min_in_org(organization_id,'admin')) OR (owner_id = auth.uid() AND NOT public.user_belongs_to_org(organization_id)) OR public.has_role(auth.uid(),'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_section_answers: inherits access from parent advanced_proposal
ALTER TABLE public.proposal_section_answers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY psa_select ON public.proposal_section_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.advanced_proposals ap WHERE ap.id = advanced_proposal_id AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_insert ON public.proposal_section_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.advanced_proposals ap WHERE ap.id = advanced_proposal_id AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid()))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_update ON public.proposal_section_answers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.advanced_proposals ap WHERE ap.id = advanced_proposal_id AND (public.user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY psa_delete ON public.proposal_section_answers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.advanced_proposals ap WHERE ap.id = advanced_proposal_id AND ((public.user_belongs_to_org(ap.organization_id) AND public.has_org_role_min_in_org(organization_id,'admin')) OR public.has_role(auth.uid(),'admin')))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 14. SEED: Categories
-- ============================================================
INSERT INTO public.business_categories (id,name,description,slug,icon,sort_order,active) VALUES
  ('a0000000-0001-0000-0000-000000000001','Tecnologia da Informacao','Solucoes de software, hardware, cloud, infraestrutura IT e servicos digitais para empresas.','tecnologia','Monitor',1,true),
  ('a0000000-0001-0000-0000-000000000002','Consultoria e Servicos Profissionais','Consultoria estrategica, financeira, juridica, recursos humanos e outros servicos B2B.','consultoria','Briefcase',2,true),
  ('a0000000-0001-0000-0000-000000000003','Construcao e Engenharia','Projetos de construcao civil, engenharia, arquitectura, reformas e manutencao predial.','construcao','HardHat',3,true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 15. SEED: Blueprints
-- ============================================================
INSERT INTO public.proposal_blueprints (id,name,description,business_category_id,version,is_default,active,estimated_pages) VALUES
  ('b0000000-0001-0000-0000-000000000001','Proposta de Software sob Medida','Estrutura completa para propor solucoes de software personalizado: analise, desenvolvimento, implementacao e suporte.','a0000000-0001-0000-0000-000000000001',1,true,true,12),
  ('b0000000-0001-0000-0000-000000000002','Proposta de Consultoria Estrategica','Framework para apresentar servicos de consultoria: diagnostico, recomendacoes, plano de accao e ROI.','a0000000-0001-0000-0000-000000000002',1,true,true,10),
  ('b0000000-0001-0000-0000-000000000003','Proposta de Obra de Construcao','Estrutura para projetos de construcao: memoria descritivo, custos, cronograma, garantias e condicoes.','a0000000-0001-0000-0000-000000000003',1,true,true,15)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 16. SEED: Sections — Software (6)
-- ============================================================
INSERT INTO public.proposal_sections (id,blueprint_id,type,title,"order",required,content_rules) VALUES
  ('c1000000-0001-0000-0000-000000000001','b0000000-0001-0000-0000-000000000001','narrative','1. Contexto e Diagnostico',1,true,'{"minWords":120,"maxWords":300,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva o contexto actual do cliente e as dores identificadas."}'),
  ('c1000000-0001-0000-0000-000000000002','b0000000-0001-0000-0000-000000000001','narrative','2. Solucao Proposta',2,true,'{"minWords":150,"maxWords":400,"tone":"persuasivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Apresente a solucao de forma estruturada com modulos e funcionalidades."}'),
  ('c1000000-0001-0000-0000-000000000003','b0000000-0001-0000-0000-000000000001','narrative','3. Metodologia de Implementacao',3,true,'{"minWords":100,"maxWords":300,"tone":"technical","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva fases, tecnologias e praticas AGIL."}'),
  ('c1000000-0001-0000-0000-000000000004','b0000000-0001-0000-0000-000000000001','items_table','4. Detalhamento de Precos',4,true,'{"minWords":0,"maxWords":0,"tone":"formal","requiresData":true,"allowsBullets":false,"allowsTable":true,"promptHint":"Tabela de precos por modulo/fase. Moeda: MZN."}'),
  ('c1000000-0001-0000-0000-000000000005','b0000000-0001-0000-0000-000000000001','narrative','5. Beneficios Esperados',5,true,'{"minWords":80,"maxWords":250,"tone":"persuasivo","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Liste beneficios tangiveis e intangiveis. ROI estimado."}'),
  ('c1000000-0001-0000-0000-000000000006','b0000000-0001-0000-0000-000000000001','terms','6. Condicoes Comerciais e Garantias',6,true,'{"minWords":80,"maxWords":200,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Condicoes de pagamento, garantias, SLA."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 17. SEED: Sections — Consultoria (4)
-- ============================================================
INSERT INTO public.proposal_sections (id,blueprint_id,type,title,"order",required,content_rules) VALUES
  ('c2000000-0001-0000-0000-000000000001','b0000000-0001-0000-0000-000000000002','narrative','1. Analise da Situacao Actual',1,true,'{"minWords":150,"maxWords":350,"tone":"consultivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Analise a situacao actual da organizacao."}'),
  ('c2000000-0001-0000-0000-000000000002','b0000000-0001-0000-0000-000000000002','narrative','2. Abordagem e Metodologia',2,true,'{"minWords":120,"maxWords":300,"tone":"consultivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Metodologia: fases, ferramentas, entregaveis."}'),
  ('c2000000-0001-0000-0000-000000000003','b0000000-0001-0000-0000-000000000002','narrative','3. Entregaveis e Resultados Esperados',3,true,'{"minWords":100,"maxWords":250,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Entregaveis concretos e resultados mensuraveis."}'),
  ('c2000000-0001-0000-0000-000000000004','b0000000-0001-0000-0000-000000000002','pricing','4. Investimento e Condicoes',4,true,'{"minWords":50,"maxWords":200,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Estrutura de precos. Moeda: MZN."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 18. SEED: Sections — Construcao (5)
-- ============================================================
INSERT INTO public.proposal_sections (id,blueprint_id,type,title,"order",required,content_rules) VALUES
  ('c3000000-0001-0000-0000-000000000001','b0000000-0001-0000-0000-000000000003','narrative','1. Memoria Descritivo da Obra',1,true,'{"minWords":150,"maxWords":400,"tone":"technical","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a obra: localizacao, tipologia, area, materiais."}'),
  ('c3000000-0001-0000-0000-000000000002','b0000000-0001-0000-0000-000000000003','narrative','2. Metodologia de Execucao',2,true,'{"minWords":100,"maxWords":300,"tone":"technical","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Fases, equipamentos, mao-de-obra, prazos."}'),
  ('c3000000-0001-0000-0000-000000000003','b0000000-0001-0000-0000-000000000003','timeline','3. Cronograma de Execucao',3,true,'{"minWords":50,"maxWords":200,"tone":"technical","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Cronograma em tabela: Fase, Periodo, Entregaveis."}'),
  ('c3000000-0001-0000-0000-000000000004','b0000000-0001-0000-0000-000000000003','pricing','4. Orcamento Detalhado',4,true,'{"minWords":50,"maxWords":200,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Custos: materiais, mao-de-obra, equipamentos. IVA. MZN."}'),
  ('c3000000-0001-0000-0000-000000000005','b0000000-0001-0000-0000-000000000003','terms','5. Condicoes Gerais e Garantias',5,true,'{"minWords":80,"maxWords":200,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Garantias, prazos, pagamento, seguro."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 19. SEED: Questions — Software
-- ============================================================
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000001','c1000000-0001-0000-0000-000000000001','Qual e o principal desafio ou dor que o cliente enfrenta actualmente?','Seja especifico: problemas de eficiencia, custos, escalabilidade, etc.',1,true,'textarea','{}'),
  ('d1000000-0001-0000-0000-000000000002','c1000000-0001-0000-0000-000000000001','Existem sistemas actuais em uso? Quais?','Liste software, ferramentas ou processos manuais actuais.',2,false,'textarea','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000003','c1000000-0001-0000-0000-000000000002','Quais modulos ou funcionalidades principais deve incluir a solucao?','Ex: gestao de utilizadores, relatorios, integracoes, API, etc.',1,true,'textarea','{}'),
  ('d1000000-0001-0000-0000-000000000004','c1000000-0001-0000-0000-000000000002','Existem requisitos tecnicos especificos?','Ex: React, PostgreSQL, integracao com SAP, LGPD, etc.',2,false,'textarea','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000005','c1000000-0001-0000-0000-000000000003','Qual o prazo desejado para a implementacao?','Ex: 3 meses, 6 meses, fases...',1,false,'text','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000006','c1000000-0001-0000-0000-000000000004','Qual o orcamento disponivel para o projecto?','Em MZN (Meticais). Indique faixa ou valor exacto.',1,true,'text','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000007','c1000000-0001-0000-0000-000000000005','Quais resultados tangiveis o cliente espera obter?','Ex: reducao de 30% no tempo de processo...',1,false,'textarea','{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20. SEED: Questions — Consultoria
-- ============================================================
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000001','c2000000-0001-0000-0000-000000000001','Qual e a area de consultoria pretendida?','Ex: estrategia, financeira, RH, operacoes...',1,true,'text','{}'),
  ('d2000000-0001-0000-0000-000000000002','c2000000-0001-0000-0000-000000000001','Descreva brevemente a organizacao (tamanho, sector, equipa)','Inclua numero de colaboradores e volume de negocios.',2,true,'textarea','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000003','c2000000-0001-0000-0000-000000000002','Ja existiu algum projecto de consultoria anterior nesta area?','Descreva resultados obtidos ou insucessos.',1,false,'textarea','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000004','c2000000-0001-0000-0000-000000000004','Qual o investimento maximo disponivel?','Em MZN. Indique faixa ou valor mensal/total.',1,true,'text','{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 21. SEED: Questions — Construcao
-- ============================================================
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000001','c3000000-0001-0000-0000-000000000001','Descreva a obra (tipo, localizacao, area aproximada)','Ex: Construcao de edificio de escritorios, 3 andares, 500m2, Maputo.',1,true,'textarea','{}'),
  ('d3000000-0001-0000-0000-000000000002','c3000000-0001-0000-0000-000000000001','Existe projecto de arquitectura ou licenca aprovada?','Sim/Nao e detalhes relevantes.',2,false,'text','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000003','c3000000-0001-0000-0000-000000000003','Prazo desejado para conclusao da obra?','Ex: 6 meses, 1 ano, por fases.',1,true,'text','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000004','c3000000-0001-0000-0000-000000000004','Orcamento disponivel para a obra?','Em MZN. Inclua margem para imprevistos.',1,true,'text','{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.section_questions (id,section_id,question_text,placeholder,"order",required,question_type,visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000005','c3000000-0001-0000-0000-000000000005','Materiais preferidos ou restricoes especificas?','Ex: estrutura metalica, acabamentos premium, normas de seguranca...',1,false,'textarea','{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$ DECLARE v_bc INT; v_bp INT; v_ps INT; v_sq INT;
BEGIN
  SELECT COUNT(*) INTO v_bc FROM public.business_categories;
  SELECT COUNT(*) INTO v_bp FROM public.proposal_blueprints;
  SELECT COUNT(*) INTO v_ps FROM public.proposal_sections;
  SELECT COUNT(*) INTO v_sq FROM public.section_questions;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BLUEPRINT ENGINE MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'business_categories: %', v_bc;
  RAISE NOTICE 'proposal_blueprints: %', v_bp;
  RAISE NOTICE 'proposal_sections: %', v_ps;
  RAISE NOTICE 'section_questions: %', v_sq;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
