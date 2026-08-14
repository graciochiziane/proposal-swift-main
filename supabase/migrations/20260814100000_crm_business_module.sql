-- ============================================================
-- PropostaJá Business CRM — Database Layer
--
-- Cria a camada de dados para o CRM comercial exclusivo do
-- plano Business. Estende a tabela clients existente com campos
-- comerciais e cria 4 novas tabelas para actividades, follow-ups,
-- tags e relação contact_tags.
--
-- Princípios:
--   - Não quebrar funcionalidade existente (todas as colunas novas
--     são nullable ou têm defaults)
--   - Reutilizar clients em vez de criar tabela nova de contactos
--   - Propostas continuam na tabela proposals (não duplicar)
--   - RLS em todas as novas tabelas (mesmo padrão multi-tenant)
--   - Feature gate via plan_features (crm_access)
--
-- Data: 2026-08-14
-- Branch: feature/multi-user-hierarchy
-- ============================================================

-- ============================================================
-- 1. NOVOS ENUMS
-- ============================================================

-- Estado comercial do contacto/lead
DO $$ BEGIN
    CREATE TYPE public.crm_estado AS ENUM (
        'novo', 'contactado', 'qualificado', 'proposta_enviada',
        'em_negociacao', 'ganho', 'perdido', 'inactivo'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Origem do lead
DO $$ BEGIN
    CREATE TYPE public.crm_origem AS ENUM (
        'whatsapp', 'facebook', 'instagram', 'website',
        'referencia', 'cliente_existente', 'outro'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de actividade
DO $$ BEGIN
    CREATE TYPE public.crm_activity_type AS ENUM (
        'contacto', 'chamada', 'whatsapp', 'email', 'reuniao',
        'nota', 'proposta_enviada', 'follow_up', 'outro'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. ESTENDER TABELA clients COM CAMPOS CRM
--    Todas as colunas são nullable ou têm default — não quebra
--    funcionalidade existente para Free/Pro.
-- ============================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cargo TEXT DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origem public.crm_origem;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'contacto';  -- lead, contacto, cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estado_comercial public.crm_estado DEFAULT 'novo';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valor_potencial NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ultimo_contacto TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS proximo_contacto TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES auth.users(id);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';

-- Indexes para queries CRM
CREATE INDEX IF NOT EXISTS clients_estado_comercial_idx
    ON public.clients(estado_comercial) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_proximo_contacto_idx
    ON public.clients(proximo_contacto) WHERE proximo_contacto IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_origem_idx
    ON public.clients(origem) WHERE origem IS NOT NULL;

-- ============================================================
-- 3. TABELA crm_activities
--    Timeline de actividades por contacto (e opcionalmente proposta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    type public.crm_activity_type NOT NULL DEFAULT 'nota',
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_activities_org_idx ON public.crm_activities(organization_id);
CREATE INDEX IF NOT EXISTS crm_activities_client_idx ON public.crm_activities(client_id);
CREATE INDEX IF NOT EXISTS crm_activities_performed_at_idx ON public.crm_activities(performed_at DESC);

CREATE TRIGGER trg_crm_activities_updated_at
    BEFORE UPDATE ON public.crm_activities
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. TABELA crm_follow_ups
--    Próximas acções agendadas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    due_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_follow_ups_org_idx ON public.crm_follow_ups(organization_id);
CREATE INDEX IF NOT EXISTS crm_follow_ups_client_idx ON public.crm_follow_ups(client_id);
CREATE INDEX IF NOT EXISTS crm_follow_ups_due_at_idx ON public.crm_follow_ups(due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_follow_ups_completed_idx ON public.crm_follow_ups(completed_at);

CREATE TRIGGER trg_crm_follow_ups_updated_at
    BEFORE UPDATE ON public.crm_follow_ups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. TABELA crm_tags
--    Tags por organização (para classificar contactos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS crm_tags_org_idx ON public.crm_tags(organization_id);

-- ============================================================
-- 6. TABELA crm_contact_tags
--    Relação N:N entre clients e crm_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_contact_tags (
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (client_id, tag_id)
);

CREATE INDEX IF NOT EXISTS crm_contact_tags_client_idx ON public.crm_contact_tags(client_id);
CREATE INDEX IF NOT EXISTS crm_contact_tags_tag_idx ON public.crm_contact_tags(tag_id);

-- ============================================================
-- 7. RLS — Todas as novas tabelas
-- ============================================================

-- crm_activities
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activities_select" ON public.crm_activities;
CREATE POLICY "crm_activities_select" ON public.crm_activities
    FOR SELECT TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "crm_activities_insert" ON public.crm_activities;
CREATE POLICY "crm_activities_insert" ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (public.user_belongs_to_org(organization_id) AND performed_by = auth.uid());

DROP POLICY IF EXISTS "crm_activities_update" ON public.crm_activities;
CREATE POLICY "crm_activities_update" ON public.crm_activities
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "crm_activities_delete" ON public.crm_activities;
CREATE POLICY "crm_activities_delete" ON public.crm_activities
    FOR DELETE TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- crm_follow_ups
ALTER TABLE public.crm_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_follow_ups_select" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_select" ON public.crm_follow_ups
    FOR SELECT TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "crm_follow_ups_insert" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_insert" ON public.crm_follow_ups
    FOR INSERT TO authenticated
    WITH CHECK (public.user_belongs_to_org(organization_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "crm_follow_ups_update" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_update" ON public.crm_follow_ups
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "crm_follow_ups_delete" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_delete" ON public.crm_follow_ups
    FOR DELETE TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- crm_tags
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tags_select" ON public.crm_tags;
CREATE POLICY "crm_tags_select" ON public.crm_tags
    FOR SELECT TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "crm_tags_insert" ON public.crm_tags;
CREATE POLICY "crm_tags_insert" ON public.crm_tags
    FOR INSERT TO authenticated
    WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "crm_tags_update" ON public.crm_tags;
CREATE POLICY "crm_tags_update" ON public.crm_tags
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "crm_tags_delete" ON public.crm_tags;
CREATE POLICY "crm_tags_delete" ON public.crm_tags
    FOR DELETE TO authenticated
    USING (public.user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- crm_contact_tags (herda acesso via client_id e tag_id)
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_contact_tags_select" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_select" ON public.crm_contact_tags
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND (public.user_belongs_to_org(c.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
    );

DROP POLICY IF EXISTS "crm_contact_tags_insert" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_insert" ON public.crm_contact_tags
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND public.user_belongs_to_org(c.organization_id))
    );

DROP POLICY IF EXISTS "crm_contact_tags_delete" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_delete" ON public.crm_contact_tags
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND (public.user_belongs_to_org(c.organization_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)))
    );

-- ============================================================
-- 8. FEATURE GATE — crm_access apenas para Business
-- ============================================================
INSERT INTO public.plan_features (plano, feature_key, enabled, limit_value) VALUES
    ('free',      'crm_access', false, NULL),
    ('pro',       'crm_access', false, NULL),
    ('business',  'crm_access', true,  NULL)
ON CONFLICT (plano, feature_key) DO NOTHING;

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON TABLE public.crm_activities IS 'CRM: timeline de actividades por contacto (chamadas, emails, propostas, follow-ups)';
COMMENT ON TABLE public.crm_follow_ups IS 'CRM: próximas acções agendadas por contacto';
COMMENT ON TABLE public.crm_tags IS 'CRM: tags por organização para classificar contactos';
COMMENT ON TABLE public.crm_contact_tags IS 'CRM: relação N:N entre clients e tags';
