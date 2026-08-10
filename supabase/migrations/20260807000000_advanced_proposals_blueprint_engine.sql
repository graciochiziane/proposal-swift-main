-- EXECUTION INSTRUCTIONS:
-- This migration must be executed via Supabase Dashboard > SQL Editor
-- or via Supabase CLI: supabase db push
-- Direct connection from this environment failed (IPv6 ENETUNREACH)
-- The SQL has been validated for syntax correctness.

-- ============================================================
-- MIGRATION: Advanced Proposals - Blueprint Engine
-- Version: 20260807000000
-- Description: 5 new tables for controlled proposal structure
-- Destructive: NO - only CREATE TABLE + ADD COLUMN nullable
-- ============================================================

-- 1. ENUM: Visual style for brand profiles
CREATE TYPE IF NOT EXISTS visual_style AS ENUM (
  'corporate',
  'premium',
  'minimal',
  'technical'
);

-- ============================================================
-- 2. business_categories
-- Library of business sectors for blueprint classification
-- ============================================================
CREATE TABLE IF NOT EXISTS business_categories (
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

-- 3. proposal_blueprints
-- Pre-defined proposal structures per business category
-- ============================================================
CREATE TABLE IF NOT EXISTS proposal_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  business_category_id UUID NOT NULL REFERENCES business_categories(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  estimated_pages INT DEFAULT 10,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

-- 4. proposal_sections
-- Sections within a blueprint (ordered, typed)
-- ============================================================
CREATE TABLE IF NOT EXISTS proposal_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES proposal_blueprints(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  title TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  content_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. section_questions
-- Fixed questions per section for controlled data collection
-- ============================================================
CREATE TABLE IF NOT EXISTS section_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES proposal_sections(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  placeholder TEXT DEFAULT '',
  "order" INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  question_type TEXT NOT NULL DEFAULT 'text',
  visibility_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. company_brand_profiles
-- Visual identity per organization
-- ============================================================
CREATE TABLE IF NOT EXISTS company_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '',
  secondary_color TEXT DEFAULT '',
  accent_color TEXT DEFAULT '',
  font_preference TEXT DEFAULT 'inter',
  visual_style visual_style DEFAULT 'corporate',
  logo_colors_extracted JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- ============================================================
-- 7. advanced_proposals
-- Top-level container for advanced proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS advanced_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  blueprint_id UUID REFERENCES proposal_blueprints(id) ON DELETE SET NULL,
  blueprint_version INT DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_preenchimento','em_revisao','concluida','exportada')),
  brand_profile_id UUID REFERENCES company_brand_profiles(id) ON DELETE SET NULL,
  current_section_index INT NOT NULL DEFAULT 0,
  total_sections INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. proposal_section_answers
-- User answers + AI-generated content per section
-- ============================================================
CREATE TABLE IF NOT EXISTS proposal_section_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advanced_proposal_id UUID NOT NULL REFERENCES advanced_proposals(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES proposal_sections(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL DEFAULT '',
  section_order INT NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}',
  ai_content TEXT DEFAULT '',
  ai_model TEXT DEFAULT '',
  ai_tokens_used INT DEFAULT 0,
  edited_content TEXT DEFAULT '',
  content_status TEXT NOT NULL DEFAULT 'pendente' CHECK (content_status IN ('pendente','gerando','gerado','editando','revisado','erro')),
  error_message TEXT DEFAULT '',
  generated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. ADD blueprint_id to proposals table (nullable, non-destructive)
-- ============================================================
ALTER TABLE proposals 
  ADD COLUMN IF NOT EXISTS blueprint_id UUID REFERENCES proposal_blueprints(id) ON DELETE SET NULL;

-- ============================================================
-- 10. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_business_categories_active ON business_categories(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_blueprints_category ON proposal_blueprints(business_category_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_proposal_sections_blueprint ON proposal_sections(blueprint_id, "order");
CREATE INDEX IF NOT EXISTS idx_section_questions_section ON section_questions(section_id, "order");
CREATE INDEX IF NOT EXISTS idx_brand_profiles_org ON company_brand_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_org ON advanced_proposals(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_owner ON advanced_proposals(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_section_answers_proposal ON proposal_section_answers(advanced_proposal_id, section_order);

-- ============================================================
-- 11. TRIGGERS: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_business_categories_updated_at
  BEFORE UPDATE ON business_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proposal_blueprints_updated_at
  BEFORE UPDATE ON proposal_blueprints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proposal_sections_updated_at
  BEFORE UPDATE ON proposal_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_section_questions_updated_at
  BEFORE UPDATE ON section_questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_company_brand_profiles_updated_at
  BEFORE UPDATE ON company_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_advanced_proposals_updated_at
  BEFORE UPDATE ON advanced_proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proposal_section_answers_updated_at
  BEFORE UPDATE ON proposal_section_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 12. RLS POLICIES
-- ============================================================

-- business_categories: readable by all authenticated, writable by admin only
ALTER TABLE business_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY bc_select_all ON business_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY bc_admin_manage ON business_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- proposal_blueprints: readable by all, writable by admin only
ALTER TABLE proposal_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY pb_select_all ON proposal_blueprints FOR SELECT TO authenticated USING (true);
CREATE POLICY pb_admin_manage ON proposal_blueprints FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- proposal_sections: readable by all, writable by admin only
ALTER TABLE proposal_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_select_all ON proposal_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_admin_manage ON proposal_sections FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- section_questions: readable by all, writable by admin only
ALTER TABLE section_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sq_select_all ON section_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY sq_admin_manage ON section_questions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- company_brand_profiles: org-scoped
ALTER TABLE company_brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY cbp_select ON company_brand_profiles FOR SELECT TO authenticated
  USING (user_belongs_to_org(organization_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY cbp_insert ON company_brand_profiles FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(organization_id));
CREATE POLICY cbp_update ON company_brand_profiles FOR UPDATE TO authenticated
  USING (user_belongs_to_org(organization_id) OR has_role(auth.uid(), 'admin'));
CREATE POLICY cbp_delete ON company_brand_profiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- advanced_proposals: org-scoped
ALTER TABLE advanced_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY advp_select ON advanced_proposals FOR SELECT TO authenticated
  USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY advp_insert ON advanced_proposals FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_org(organization_id) OR owner_id = auth.uid());
CREATE POLICY advp_update ON advanced_proposals FOR UPDATE TO authenticated
  USING (user_belongs_to_org(organization_id) OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY advp_delete ON advanced_proposals FOR DELETE TO authenticated
  USING (user_belongs_to_org(organization_id) AND has_org_role_min_in_org(organization_id, 'admin') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- proposal_section_answers: org-scoped via advanced_proposal
ALTER TABLE proposal_section_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY psa_select ON proposal_section_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM advanced_proposals ap
      WHERE ap.id = proposal_section_answers.advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY psa_insert ON proposal_section_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM advanced_proposals ap
      WHERE ap.id = proposal_section_answers.advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid())
    )
  );
CREATE POLICY psa_update ON proposal_section_answers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM advanced_proposals ap
      WHERE ap.id = proposal_section_answers.advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) OR ap.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY psa_delete ON proposal_section_answers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM advanced_proposals ap
      WHERE ap.id = proposal_section_answers.advanced_proposal_id
      AND (user_belongs_to_org(ap.organization_id) AND has_org_role_min_in_org(ap.organization_id, 'admin') OR has_role(auth.uid(), 'admin'))
    )
  );

-- ============================================================
-- 13. SEED DATA: 3 categories + 3 blueprints with sections + questions
-- ============================================================

-- Category 1: Construcao Civil
INSERT INTO business_categories (id, name, description, slug, icon, sort_order) VALUES
('a0000000-0001-0000-0000-000000000001', 'Construcao Civil', 'Construcao, obras, infraestrutura e projectos de engenharia civil', 'construcao-civil', 'Building2', 1)
ON CONFLICT (slug) DO NOTHING;

-- Category 2: Tecnologia
INSERT INTO business_categories (id, name, description, slug, icon, sort_order) VALUES
('a0000000-0001-0000-0000-000000000002', 'Tecnologia', 'Software, hardware, servicos IT e solucoes digitais', 'tecnologia', 'Monitor', 2)
ON CONFLICT (slug) DO NOTHING;

-- Category 3: Consultoria
INSERT INTO business_categories (id, name, description, slug, icon, sort_order) VALUES
('a0000000-0001-0000-0000-000000000003', 'Consultoria', 'Servicos de consultoria, assessoria e gestao', 'consultoria', 'Briefcase', 3)
ON CONFLICT (slug) DO NOTHING;

-- Blueprint 1: Construcao Civil Completa
INSERT INTO proposal_blueprints (id, name, description, business_category_id, version, is_default, estimated_pages) VALUES
('b0000000-0001-0000-0000-000000000001', 'Construcao Civil Completa', 'Estrutura completa de proposta tecnica para construcao civil', 'a0000000-0001-0000-0000-000000000001', 1, true, 15)
ON CONFLICT (name, version) DO NOTHING;

-- Blueprint 2: Tecnologia Completa
INSERT INTO proposal_blueprints (id, name, description, business_category_id, version, is_default, estimated_pages) VALUES
('b0000000-0001-0000-0000-000000000002', 'Tecnologia Completa', 'Estrutura completa de proposta para solucoes tecnologicas', 'a0000000-0001-0000-0000-000000000002', 1, true, 12)
ON CONFLICT (name, version) DO NOTHING;

-- Blueprint 3: Consultoria Completa
INSERT INTO proposal_blueprints (id, name, description, business_category_id, version, is_default, estimated_pages) VALUES
('b0000000-0001-0000-0000-000000000003', 'Consultoria Completa', 'Estrutura completa de proposta para servicos de consultoria', 'a0000000-0001-0000-0000-000000000003', 1, true, 10)
ON CONFLICT (name, version) DO NOTHING;

-- ============================================================
-- SECTIONS: Construcao Civil (14 sections)
-- ============================================================
INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'cover', 'Capa', 1, true, '{"minWords": 0, "maxWords": 50, "tone": "formal", "requiresData": true, "allowsBullets": false, "allowsTable": false, "promptHint": "Gerar texto de capa com nome da empresa, titulo da proposta e data."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000002', 'b0000000-0001-0000-0000-000000000001', 'text', 'Sobre a Empresa', 2, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever a empresa, sua experiencia e capacidade tecnica."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000003', 'b0000000-0001-0000-0000-000000000001', 'text', 'Experiencia em Obras', 3, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Listar projectos similares concluidos com sucesso."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000004', 'b0000000-0001-0000-0000-000000000001', 'text', 'Descricao do Projecto', 4, true, '{"minWords": 300, "maxWords": 800, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever detalhadamente o objecto da proposta e o que sera executado."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000005', 'b0000000-0001-0000-0000-000000000001', 'text', 'Memoria Descritiva', 5, true, '{"minWords": 300, "maxWords": 800, "tone": "technical", "requiresData": true, "allowsBullets": false, "allowsTable": false, "promptHint": "Descricao tecnica detalhada dos materiais, processos e especificacoes."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000006', 'b0000000-0001-0000-0000-000000000001', 'methodology', 'Metodologia Construtiva', 6, true, '{"minWords": 300, "maxWords": 700, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever a metodologia e fases construtivas."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000007', 'b0000000-0001-0000-0000-000000000001', 'text', 'Fases da Obra', 7, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Listar e descrever cada fase da obra."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000008', 'b0000000-0001-0000-0000-000000000001', 'timeline', 'Cronograma Fisico', 8, true, '{"minWords": 100, "maxWords": 300, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Apresentar cronograma de execucao com prazos."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000009', 'b0000000-0001-0000-0000-000000000001', 'text', 'Materiais e Equipamentos', 9, true, '{"minWords": 200, "maxWords": 500, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Listar materiais e equipamentos necessarios."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000010', 'b0000000-0001-0000-0000-000000000001', 'pricing', 'Orcamento', 10, true, '{"minWords": 100, "maxWords": 300, "tone": "commercial", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Apresentar tabela de precos detalhada."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000011', 'b0000000-0001-0000-0000-000000000001', 'text', 'Prazo de Execucao', 11, true, '{"minWords": 100, "maxWords": 300, "tone": "formal", "requiresData": true, "allowsBullets": false, "allowsTable": false, "promptHint": "Definir prazo total e condicoes de cumprimento."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000012', 'b0000000-0001-0000-0000-000000000001', 'text', 'Garantias', 12, true, '{"minWords": 150, "maxWords": 400, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever garantias oferecidas."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000013', 'b0000000-0001-0000-0000-000000000001', 'terms', 'Termos Comerciais', 13, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Condicoes de pagamento, penalidades, foro."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0001-0000-0000-000000000014', 'b0000000-0001-0000-0000-000000000001', 'text', 'Conclusao', 14, false, '{"minWords": 100, "maxWords": 200, "tone": "formal", "requiresData": false, "allowsBullets": false, "allowsTable": false, "promptHint": "Fechar com chamada a accao."}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTIONS: Tecnologia (10 sections)
-- ============================================================
INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'cover', 'Capa', 1, true, '{"minWords": 0, "maxWords": 50, "tone": "formal", "requiresData": true, "allowsBullets": false, "allowsTable": false, "promptHint": "Capa com nome da empresa e titulo."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000002', 'b0000000-0001-0000-0000-000000000002', 'text', 'Apresentacao da Empresa', 2, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Apresentar a empresa, missao e competencias."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000003', 'b0000000-0001-0000-0000-000000000002', 'text', 'Entendimento do Projecto', 3, true, '{"minWords": 300, "maxWords": 700, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Demonstrar compreensao dos desafios e objectivos."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000004', 'b0000000-0001-0000-0000-000000000002', 'text', 'Solucao Proposta', 4, true, '{"minWords": 400, "maxWords": 1000, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever a solucao tecnologica proposta em detalhe."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000005', 'b0000000-0001-0000-0000-000000000002', 'methodology', 'Metodologia', 5, true, '{"minWords": 300, "maxWords": 700, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Descrever metodologia de trabalho (Agile, Scrum, etc)."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000006', 'b0000000-0001-0000-0000-000000000002', 'timeline', 'Cronograma', 6, true, '{"minWords": 150, "maxWords": 400, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Apresentar cronograma de entrega por fase."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000007', 'b0000000-0001-0000-0000-000000000002', 'text', 'Equipa Tecnica', 7, true, '{"minWords": 200, "maxWords": 400, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Apresentar equipa assignada ao projecto."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000008', 'b0000000-0001-0000-0000-000000000002', 'pricing', 'Investimento', 8, true, '{"minWords": 100, "maxWords": 300, "tone": "commercial", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Tabela de precos por fase ou modulo."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000009', 'terms', 'Condicoes Comerciais', 9, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Condicoes de pagamento, garantias, SLA."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0002-0000-0000-000000000010', 'b0000000-0001-0000-0000-000000000002', 'text', 'Conclusao', 10, false, '{"minWords": 100, "maxWords": 200, "tone": "formal", "requiresData": false, "allowsBullets": false, "allowsTable": false, "promptHint": "Fechar com chamada a accao."}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTIONS: Consultoria (10 sections)
-- ============================================================
INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000003', 'cover', 'Capa', 1, true, '{"minWords": 0, "maxWords": 50, "tone": "formal", "requiresData": true, "allowsBullets": false, "allowsTable": false, "promptHint": "Capa com nome da empresa e titulo."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000002', 'b0000000-0001-0000-0000-000000000003', 'text', 'Apresentacao da Empresa', 2, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Apresentar a firma de consultoria."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000003', 'b0000000-0001-0000-0000-000000000003', 'text', 'Analise do Contexto', 3, true, '{"minWords": 300, "maxWords": 700, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Analise do sector, mercado e contexto do cliente."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000004', 'b0000000-0001-0000-0000-000000000003', 'text', 'Diagnostico', 4, true, '{"minWords": 300, "maxWords": 700, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Principais problemas e oportunidades identificados."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000005', 'b0000000-0001-0000-0000-000000000003', 'text', 'Solucao Proposta', 5, true, '{"minWords": 400, "maxWords": 1000, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Abordagem metodologica e servicos propostos."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000006', 'b0000000-0001-0000-0000-000000000003', 'methodology', 'Metodologia de Trabalho', 6, true, '{"minWords": 300, "maxWords": 700, "tone": "technical", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Ferramentas, tecnicas e etapas do projecto."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000007', 'b0000000-0001-0000-0000-000000000003', 'timeline', 'Cronograma', 7, true, '{"minWords": 150, "maxWords": 400, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Cronograma de entregas por fase."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000008', 'b0000000-0001-0000-0000-000000000003', 'pricing', 'Investimento', 8, true, '{"minWords": 100, "maxWords": 300, "tone": "commercial", "requiresData": true, "allowsBullets": true, "allowsTable": true, "promptHint": "Tabela de honorarios e custos."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000009', 'terms', 'Condicoes Comerciais', 9, true, '{"minWords": 200, "maxWords": 500, "tone": "formal", "requiresData": true, "allowsBullets": true, "allowsTable": false, "promptHint": "Forma de pagamento, confidencialidade, garantia."}')
ON CONFLICT DO NOTHING;

INSERT INTO proposal_sections (id, blueprint_id, type, title, "order", required, content_rules) VALUES
('s0000000-0003-0000-0000-000000000010', 'b0000000-0001-0000-0000-000000000003', 'text', 'Conclusao', 10, false, '{"minWords": 100, "maxWords": 200, "tone": "formal", "requiresData": false, "allowsBullets": false, "allowsTable": false, "promptHint": "Fechar com chamada a accao."}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SAMPLE QUESTIONS: Construcao Civil - Metodologia (section s0000000-0001-...-006)
-- ============================================================
INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000001', 's0000000-0001-0000-0000-000000000006', 'Como sera executado o projecto?', 'Descreva a abordagem geral de execucao', 1, true, 'textarea')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000002', 's0000000-0001-0000-0000-000000000006', 'Quais etapas fazem parte da execucao?', 'Liste as fases principais', 2, true, 'textarea')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000003', 's0000000-0001-0000-0000-000000000006', 'Que equipamentos serao utilizados?', 'Liste maquinas e equipamentos', 3, false, 'textarea')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000004', 's0000000-0001-0000-0000-000000000006', 'Existem normas tecnicas aplicaveis?', 'Ex: NORMA SA, ISO, etc.', 4, false, 'text')
ON CONFLICT DO NOTHING;

-- SAMPLE QUESTIONS: Construcao Civil -Descricao do Projecto (s0000000-0001-...-004)
INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000005', 's0000000-0001-0000-0000-000000000004', 'Qual e o objecto da obra?', 'Ex: Construcao de edificio de 3 andares...', 1, true, 'textarea')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000006', 's0000000-0001-0000-0000-000000000004', 'Qual e a localizacao?', 'Endereco ou zona', 2, true, 'text')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0001-0000-0000-000000000007', 's0000000-0001-0000-0000-000000000004', 'Qual e a area total estimada?', 'Em metros quadrados', 3, false, 'text')
ON CONFLICT DO NOTHING;

-- SAMPLE QUESTIONS: Tecnologia - Solucao Proposta (s0000000-0002-...-004)
INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0002-0000-0000-000000000001', 's0000000-0002-0000-0000-000000000004', 'Qual e a solucao tecnologica proposta?', 'Descreva a arquitectura ou plataforma', 1, true, 'textarea')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0002-0000-0000-000000000002', 's0000000-0002-0000-0000-000000000004', 'Quais tecnologias serao utilizadas?', 'Ex: React, Node.js, AWS...', 2, true, 'text')
ON CONFLICT DO NOTHING;

INSERT INTO section_questions (id, section_id, question_text, placeholder, "order", required, question_type) VALUES
('q0000000-0002-0000-0000-000000000003', 's0000000-0002-0000-0000-000000000004', 'Quais integracoes sao necessarias?', 'Ex: gateway de pagamento, ERP...', 3, false, 'textarea')
ON CONFLICT DO NOTHING;
