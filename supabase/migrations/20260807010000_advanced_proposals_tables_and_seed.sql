-- ============================================================
-- ProposalJa — Advanced Proposals: Core Tables + Seed Data
-- ============================================================
-- Creates the 2 missing tables referenced by advancedProposalService.ts
-- and seeds initial blueprint data for 3 business categories.
-- ============================================================
-- Destructive: NO
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TABLE: advanced_proposals
--    Referenced by advancedProposalService.ts
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
CREATE INDEX IF NOT EXISTS idx_adv_proposals_org ON public.advanced_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_adv_proposals_owner ON public.advanced_proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_adv_proposals_status ON public.advanced_proposals(status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_advanced_proposals_updated_at ON public.advanced_proposals;
CREATE TRIGGER trg_advanced_proposals_updated_at
  BEFORE UPDATE ON public.advanced_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. TABLE: proposal_section_answers
--    Referenced by advancedProposalService.ts (upsert on conflict)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_section_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advanced_proposal_id UUID NOT NULL REFERENCES public.advanced_proposals(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.proposal_sections(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL DEFAULT '',
  section_order INT NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
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
CREATE INDEX IF NOT EXISTS idx_section_answers_proposal ON public.proposal_section_answers(advanced_proposal_id);
CREATE INDEX IF NOT EXISTS idx_section_answers_status ON public.proposal_section_answers(content_status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_section_answers_updated_at ON public.proposal_section_answers;
CREATE TRIGGER trg_section_answers_updated_at
  BEFORE UPDATE ON public.proposal_section_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. RLS: Enable + Policies
-- ============================================================
ALTER TABLE public.advanced_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_section_answers ENABLE ROW LEVEL SECURITY;

-- advanced_proposals: org members + owner fallback + admin
DO $$ BEGIN
  CREATE POLICY "adv_proposals_select" ON public.advanced_proposals FOR SELECT TO authenticated
    USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adv_proposals_insert" ON public.advanced_proposals FOR INSERT TO authenticated
    WITH CHECK (
      (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'member'))
      OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adv_proposals_update" ON public.advanced_proposals FOR UPDATE TO authenticated
    USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "adv_proposals_delete" ON public.advanced_proposals FOR DELETE TO authenticated
    USING (
      (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin'))
      OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
      OR public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_section_answers: via parent advanced_proposal
DO $$ BEGIN
  CREATE POLICY "section_answers_select" ON public.proposal_section_answers FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.advanced_proposals ap
      WHERE ap.id = advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "section_answers_modify" ON public.proposal_section_answers FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.advanced_proposals ap
      WHERE ap.id = advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid())
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.advanced_proposals ap
      WHERE ap.id = advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. SEED: Business Categories
-- ============================================================
INSERT INTO public.business_categories (id, name, description, slug, icon, sort_order, active) VALUES
  ('a0000000-0001-0000-0000-000000000001',
   'Tecnologia da Informacao',
   'Solucoes de software, hardware, cloud, infraestrutura IT e servicos digitais para empresas.',
   'tecnologia',
   'Monitor', 1, true),
  ('a0000000-0001-0000-0000-000000000002',
   'Consultoria e Servicos Profissionais',
   'Consultoria estrategica, financeira, juridica, recursos humanos e outros servicos B2B.',
   'consultoria',
   'Briefcase', 2, true),
  ('a0000000-0001-0000-0000-000000000003',
   'Construcao e Engenharia',
   'Projetos de construcao civil, engenharia, arquitectura, reformas e manutencao predial.',
   'construcao',
   'HardHat', 3, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. SEED: Proposal Blueprints
-- ============================================================
INSERT INTO public.proposal_blueprints (id, name, description, business_category_id, is_default, active) VALUES
  ('b0000000-0001-0000-0000-000000000001',
   'Proposta de Software sob Medida',
   'Estrutura completa para propor solucoes de software personalizado: analise, desenvolvimento, implementacao e suporte.',
   'a0000000-0001-0000-0000-000000000001', true, true),

  ('b0000000-0001-0000-0000-000000000002',
   'Proposta de Consultoria Estrategica',
   'Framework para apresentar servicos de consultoria: diagnostico, recomendacoes, plano de accao e ROI.',
   'a0000000-0001-0000-0000-000000000002', true, true),

  ('b0000000-0001-0000-0000-000000000003',
   'Proposta de Obra de Construcao',
   'Estrutura para projetos de construcao: memoria descritivo, custos, cronograma, garantias e condicoes.',
   'a0000000-0001-0000-0000-000000000003', true, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. SEED: Proposal Sections (Blueprint 1: Software)
-- ============================================================
INSERT INTO public.proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
  -- Secção 1: Contexto
  ('c1000000-0001-0000-0000-000000000001',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '1. Contexto e Diagnostico', 1, true,
   '{"minWords":120,"maxWords":300,"tone":"formal","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva o contexto actual do cliente, as dores identificadas e as necessidades que motivam esta proposta. Baseie-se nas respostas do questionario."}'),

  -- Secção 2: Solucao
  ('c1000000-0001-0000-0000-000000000002',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '2. Solucao Proposta', 2, true,
   '{"minWords":150,"maxWords":400,"tone":"persuasivo","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Apresente a solucao de forma estruturada. Destaque modulos, funcionalidades principais e como resolvem os problemas identificados. Seja especifico."}'),

  -- Secção 3: Metodologia
  ('c1000000-0001-0000-0000-000000000003',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '3. Metodologia de Implementacao', 3, true,
   '{"minWords":100,"maxWords":300,"tone":"tecnico","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a abordagem metodologica: fases, tecnologias, praticas AGIL e cronograma resumido. Seja tecnico mas acessivel."}'),

  -- Secção 4: Tabela de Precos
  ('c1000000-0001-0000-0000-000000000004',
   'b0000000-0001-0000-0000-000000000001', 'items_table',
   '4. Detalhamento de Precos', 4, true,
   '{"minWords":0,"maxWords":0,"tone":"formal","requiresData":true,"allowsBullets":false,"allowsTable":true,"promptHint":"Gerar tabela de precos por modulo/fase. Incluir descricao, quantidade, preco unitario e subtotal. Moeda: MZN (Metical)."}'),

  -- Secção 5: Beneficios
  ('c1000000-0001-0000-0000-000000000005',
   'b0000000-0001-0000-0000-000000000001', 'narrative',
   '5. Beneficios Esperados', 5, true,
   '{"minWords":80,"maxWords":250,"tone":"persuasivo","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Liste os beneficios tangiveis e intangiveis. Inclua ROI estimado, reducao de custos, ganhos de eficiencia e vantagens competitivas."}'),

  -- Secção 6: Condicoes
  ('c1000000-0001-0000-0000-000000000006',
   'b0000000-0001-0000-0000-000000000001', 'terms',
   '6. Condicoes Comerciais e Garantias', 6, true,
   '{"minWords":80,"maxWords":200,"tone":"formal","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Inclua condicoes de pagamento, garantias, suporte tecnico, SLA e prazo de validade da proposta."}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. SEED: Proposal Sections (Blueprint 2: Consultoria)
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
-- 8. SEED: Proposal Sections (Blueprint 3: Construcao)
-- ============================================================
INSERT INTO public.proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
  ('c3000000-0001-0000-0000-000000000001',
   'b0000000-0001-0000-0000-000000000003', 'narrative',
   '1. Memoria Descritivo da Obra', 1, true,
   '{"minWords":150,"maxWords":400,"tone":"tecnico","requiresData":true,"allowsBullets":true,"allowsTable":false,"promptHint":"Descreva a obra: localizacao, tipologia, area, finalidade, materiais previstos e especificacoes tecnicas relevantes."}'),

  ('c3000000-0001-0000-0000-000000000002',
   'b0000000-0001-0000-0000-000000000003', 'narrative',
   '2. Metodologia de Execucao', 2, true,
   '{"minWords":100,"maxWords":300,"tone":"tecnico","requiresData":false,"allowsBullets":true,"allowsTable":false,"promptHint":"Explique como a obra sera executada: fases, equipamentos, mao-de-obra, prazos e medidas de seguranca."}'),

  ('c3000000-0001-0000-0000-000000000003',
   'b0000000-0001-0000-0000-000000000003', 'timeline',
   '3. Cronograma de Execucao', 3, true,
   '{"minWords":50,"maxWords":200,"tone":"tecnico","requiresData":true,"allowsBullets":true,"allowsTable":true,"promptHint":"Apresente cronograma em formato de tabela: Fase, Periodo, Actividades, Entregaveis. Seja realista com os prazos."}'),

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
-- 9. SEED: Questions (Blueprint 1: Software) - 2 per section
-- ============================================================
-- Contexto
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000001', 'c1000000-0001-0000-0000-000000000001',
   'Qual e o principal desafio ou dor que o cliente enfrenta actualmente?',
   'Seja especifico: problemas de eficiencia, custos, escalabilidade, etc.', 1, true, 'textarea', '{}'),
  ('d1000000-0001-0000-0000-000000000002', 'c1000000-0001-0000-0000-000000000001',
   'Existem sistemas actuais em uso? Quais?',
   'Liste software, ferramentas ou processos manuais actuais.', 2, false, 'textarea', '{}'),

-- Solucao
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000003', 'c1000000-0001-0000-0000-000000000002',
   'Quais modulos ou funcionalidades principais deve incluir a solucao?',
   'Ex: gestao de utilizadores, relatorios, integracoes, API, etc.', 1, true, 'textarea', '{}'),
  ('d1000000-0001-0000-0000-000000000004', 'c1000000-0001-0000-0000-000000000002',
   'Existem requisitos tecnicos especificos? (tecnologias, integracoes, compliance)',
   'Ex: React, PostgreSQL, integracao com SAP, LGPD, etc.', 2, false, 'textarea', '{}'),

-- Metodologia
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000005', 'c1000000-0001-0000-0000-000000000003',
   'Qual o prazo desejado para a implementacao?',
   'Ex: 3 meses, 6 meses, fases...', 1, false, 'text', '{}'),

-- Precos
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000006', 'c1000000-0001-0000-0000-000000000004',
   'Qual o orcamento disponivel para o projecto?',
   'Em MZN (Meticais). Indique faixa ou valor exacto.', 1, true, 'text', '{}'),

-- Beneficios
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d1000000-0001-0000-0000-000000000007', 'c1000000-0001-0000-0000-000000000005',
   'Quais resultados tangiveis o cliente espera obter?',
   'Ex: reducao de 30% no tempo de processo, automacao de X tarefas...', 1, false, 'textarea', '{}'),

-- ============================================================
-- 10. SEED: Questions (Blueprint 2: Consultoria)
-- ============================================================
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d2000000-0001-0000-0000-000000000001', 'c2000000-0001-0000-0000-000000000001',
   'Qual e a area de consultoria pretendida?',
   'Ex: estrategia, financeira, RH, operacoes, transformacao digital, etc.', 1, true, 'text', '{}'),
  ('d2000000-0001-0000-0000-000000000002', 'c2000000-0001-0000-0000-000000000001',
   'Descreva brevemente a organizacao (tamanho, sector, equipa)',
   'Inclua numero de colaboradores, volume de negocios, desafios actuais.', 2, true, 'textarea', '{}'),
  ('d2000000-0001-0000-0000-000000000003', 'c2000000-0001-0000-0000-000000000002',
   'Ja existiu algum projecto de consultoria anterior nesta area?',
   'Descreva resultados obtidos ou insucessos.', 1, false, 'textarea', '{}'),
  ('d2000000-0001-0000-0000-000000000004', 'c2000000-0001-0000-0000-000000000004',
   'Qual o investimento maximo disponivel?',
   'Em MZN. Indique faixa ou valor mensal/total.', 1, true, 'text', '{}');

-- ============================================================
-- 11. SEED: Questions (Blueprint 3: Construcao)
-- ============================================================
INSERT INTO public.section_questions (id, section_id, question_text, help_text, "order", required, question_type, visibility_rules) VALUES
  ('d3000000-0001-0000-0000-000000000001', 'c3000000-0001-0000-0000-000000000001',
   'Descreva a obra (tipo, localizacao, area aproximada)',
   'Ex: Construcao de edificio de escritorios, 3 andares, 500m2, Maputo.', 1, true, 'textarea', '{}'),
  ('d3000000-0001-0000-0000-000000000002', 'c3000000-0001-0000-0000-000000000001',
   'Existe projecto de arquitectura ou licenca aprovada?',
   'Sim/Nao e detalhes relevantes.', 2, false, 'text', '{}'),
  ('d3000000-0001-0000-0000-000000000003', 'c3000000-0001-0000-0000-000000000003',
   'Prazo desejado para conclusao da obra?',
   'Ex: 6 meses, 1 ano, por fases.', 1, true, 'text', '{}'),
  ('d3000000-0001-0000-0000-000000000004', 'c3000000-0001-0000-0000-000000000004',
   'Orcamento disponivel para a obra?',
   'Em MZN. Inclua margem para imprevistos.', 1, true, 'text', '{}'),
  ('d3000000-0001-0000-0000-000000000005', 'c3000000-0001-0000-0000-000000000005',
   'Materiais preferidos ou restricoes especificas?',
   'Ex: estrutura metalica, acabamentos premium, normas de seguranca...', 1, false, 'textarea', '{}');

-- ============================================================
-- VERIFICACAO FINAL
-- ============================================================
DO $$
DECLARE
  v_ap INT; v_sa INT; v_bc INT; v_bp INT; v_ps INT; v_sq INT;
BEGIN
  SELECT COUNT(*) INTO v_ap FROM information_schema.tables WHERE table_name = 'advanced_proposals' AND table_schema = 'public';
  SELECT COUNT(*) INTO v_sa FROM information_schema.tables WHERE table_name = 'proposal_section_answers' AND table_schema = 'public';
  SELECT COUNT(*) INTO v_bc FROM public.business_categories;
  SELECT COUNT(*) INTO v_bp FROM public.proposal_blueprints;
  SELECT COUNT(*) INTO v_ps FROM public.proposal_sections;
  SELECT COUNT(*) INTO v_sq FROM public.section_questions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRACAO CONCLUIDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'advanced_proposals: %', v_ap;
  RAISE NOTICE 'proposal_section_answers: %', v_sa;
  RAISE NOTICE 'business_categories: %', v_bc;
  RAISE NOTICE 'proposal_blueprints: %', v_bp;
  RAISE NOTICE 'proposal_sections: %', v_ps;
  RAISE NOTICE 'section_questions: %', v_sq;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
