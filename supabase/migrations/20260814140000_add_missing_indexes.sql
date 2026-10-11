-- ============================================================
-- FASE 6: Adicionar indexes em FKs críticas sem index
--
-- 20 FK columns identified without supporting index.
-- Full-scan on FK-delete checks and JOINs.
-- ============================================================

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- CRM Activities
CREATE INDEX IF NOT EXISTS idx_crm_activities_proposal_id ON public.crm_activities(proposal_id) WHERE proposal_id IS NOT NULL;

-- CRM Follow-ups
CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_proposal_id ON public.crm_follow_ups(proposal_id) WHERE proposal_id IS NOT NULL;

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id) WHERE organization_id IS NOT NULL;

-- Advanced proposals
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_client_id ON public.advanced_proposals(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advanced_proposals_blueprint_id ON public.advanced_proposals(blueprint_id) WHERE blueprint_id IS NOT NULL;

-- Proposal section answers
CREATE INDEX IF NOT EXISTS idx_proposal_section_answers_section_id ON public.proposal_section_answers(section_id);

-- Section questions
CREATE INDEX IF NOT EXISTS idx_section_questions_section_id ON public.section_questions(section_id);

-- Organization invitations
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invited_by ON public.organization_invitations(invited_by) WHERE invited_by IS NOT NULL;

-- Organization members
CREATE INDEX IF NOT EXISTS idx_organization_members_invited_by ON public.organization_members(invited_by) WHERE invited_by IS NOT NULL;

-- Platform admins
CREATE INDEX IF NOT EXISTS idx_platform_admins_granted_by ON public.platform_admins(granted_by) WHERE granted_by IS NOT NULL;

-- Company brand profiles
CREATE INDEX IF NOT EXISTS idx_company_brand_profiles_organization_id ON public.company_brand_profiles(organization_id);

-- Proposal blueprints
CREATE INDEX IF NOT EXISTS idx_proposal_blueprints_business_category_id ON public.proposal_blueprints(business_category_id);

-- Proposal sections
CREATE INDEX IF NOT EXISTS idx_proposal_sections_blueprint_id ON public.proposal_sections(blueprint_id);

-- Clients responsavel
CREATE INDEX IF NOT EXISTS idx_clients_responsavel_id ON public.clients(responsavel_id) WHERE responsavel_id IS NOT NULL;

-- CRM tags
CREATE INDEX IF NOT EXISTS idx_crm_tags_organization_id ON public.crm_tags(organization_id);
