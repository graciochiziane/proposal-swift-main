-- ============================================================
-- CRM RLS Business Enforcement (Item 3 — segurança)
--
-- OBJECTIVO
--   O acesso às tabelas CRM deixa de ser verificado apenas pelo
--   membership da organização e passa a exigir também que a org
--   tenha a feature 'crm_access' activa (plano Business) na
--   tabela plan_features. O gate frontend (menu Vendas escondido)
--   NÃO é segurança — esta migration move a autoridade para a BD.
--
-- PRINCÍPIO FAIL-CLOSED
--   Se a org não tiver linha (plano, 'crm_access') com enabled=true,
--   o acesso é NEGADO. A ausência de dados negia o acesso; nunca
--   o concede. Platform admins ('admin' app_role) mantêm acesso
--   total (suporte/ops) — cláusula OR fora do AND do plano.
--
-- MECANISMO
--   1. Função auxiliar org_has_crm_access(p_org_id) — STABLE,
--      SECURITY DEFINER, reutiliza has_plan_feature (existente na
--      migration 20260813150000). Zero novas dependências.
--   2. As 15 policies RLS do CRM (migration 20260814100000 §7)
--      são recriadas com o mesmo nome, acrescentando
--      AND public.org_has_crm_access(<org>) a cada cláusula
--      user_belongs_to_org existente. Padrões preservados:
--        - select/delete: (belongs AND crm) OR admin
--        - update:        belongs AND crm (USING e WITH CHECK)
--        - insert:        belongs AND crm (AND identidade, onde existia)
--        - contact_tags:  EXISTS via clients c (belongs(c.org) AND crm(c.org)) [OR admin]
--
-- RECURSÃO / PERFORMANCE
--   org_has_crm_access lê organizations por PK e chama has_plan_feature
--   (SECURITY DEFINER sobre plan_features por PK). Sem RLS intermédia,
--   sem ciclos. Uma execução extra por linha avaliada por policy.
--
-- REVERSIBILIDADE (rollback)
--   Para reverter: re-aplicar a secção 7 da migration
--   20260814100000_crm_business_module.sql (DROP POLICY IF EXISTS +
--   CREATE com apenas user_belongs_to_org) e
--   DROP FUNCTION IF EXISTS public.org_has_crm_access(UUID);
--   Nada é apagado por esta migration além das próprias policies
--   que ela recria.
--
-- STAGING
--   Migration preparada para validação em ambiente de staging
--   (Business: acesso OK; Free/Pro: bloqueado; cross-org: bloqueado;
--   admin platform: acesso). Sem runtime Supabase na sessão de
--   autoria — aplicar primeiro em staging, nunca directamente em
--   produção.
-- ============================================================

-- ============================================================
-- 1. Função auxiliar: org_has_crm_access
-- ============================================================
DROP FUNCTION IF EXISTS public.org_has_crm_access(UUID);

CREATE OR REPLACE FUNCTION public.org_has_crm_access(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = p_org_id
          AND public.has_plan_feature(o.plano, 'crm_access')
    )
$function$;

COMMENT ON FUNCTION public.org_has_crm_access(UUID) IS
'Verifica se a organização tem a feature crm_access activa (plano Business). Usada pelas policies RLS do CRM. Fail-closed: org desconhecida ou sem feature => false.';

-- ============================================================
-- 2. crm_activities — 4 policies endurecidas
-- ============================================================
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activities_select" ON public.crm_activities;
CREATE POLICY "crm_activities_select" ON public.crm_activities
    FOR SELECT TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

DROP POLICY IF EXISTS "crm_activities_insert" ON public.crm_activities;
CREATE POLICY "crm_activities_insert" ON public.crm_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_belongs_to_org(organization_id)
        AND public.org_has_crm_access(organization_id)
        AND performed_by = auth.uid()
    );

DROP POLICY IF EXISTS "crm_activities_update" ON public.crm_activities;
CREATE POLICY "crm_activities_update" ON public.crm_activities
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id));

DROP POLICY IF EXISTS "crm_activities_delete" ON public.crm_activities;
CREATE POLICY "crm_activities_delete" ON public.crm_activities
    FOR DELETE TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- ============================================================
-- 3. crm_follow_ups — 4 policies endurecidas
-- ============================================================
ALTER TABLE public.crm_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_follow_ups_select" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_select" ON public.crm_follow_ups
    FOR SELECT TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

DROP POLICY IF EXISTS "crm_follow_ups_insert" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_insert" ON public.crm_follow_ups
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_belongs_to_org(organization_id)
        AND public.org_has_crm_access(organization_id)
        AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS "crm_follow_ups_update" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_update" ON public.crm_follow_ups
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id));

DROP POLICY IF EXISTS "crm_follow_ups_delete" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_delete" ON public.crm_follow_ups
    FOR DELETE TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- ============================================================
-- 4. crm_tags — 4 policies endurecidas
-- ============================================================
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tags_select" ON public.crm_tags;
CREATE POLICY "crm_tags_select" ON public.crm_tags
    FOR SELECT TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

DROP POLICY IF EXISTS "crm_tags_insert" ON public.crm_tags;
CREATE POLICY "crm_tags_insert" ON public.crm_tags
    FOR INSERT TO authenticated
    WITH CHECK (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id));

DROP POLICY IF EXISTS "crm_tags_update" ON public.crm_tags;
CREATE POLICY "crm_tags_update" ON public.crm_tags
    FOR UPDATE TO authenticated
    USING (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
    WITH CHECK (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id));

DROP POLICY IF EXISTS "crm_tags_delete" ON public.crm_tags;
CREATE POLICY "crm_tags_delete" ON public.crm_tags
    FOR DELETE TO authenticated
    USING (
        (public.user_belongs_to_org(organization_id) AND public.org_has_crm_access(organization_id))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- ============================================================
-- 5. crm_contact_tags — 3 policies endurecidas (acesso via clients)
-- ============================================================
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_contact_tags_select" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_select" ON public.crm_contact_tags
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND ((public.user_belongs_to_org(c.organization_id) AND public.org_has_crm_access(c.organization_id))
                     OR public.has_role(auth.uid(), 'admin'::public.app_role)))
    );

DROP POLICY IF EXISTS "crm_contact_tags_insert" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_insert" ON public.crm_contact_tags
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND public.user_belongs_to_org(c.organization_id)
                AND public.org_has_crm_access(c.organization_id))
    );

DROP POLICY IF EXISTS "crm_contact_tags_delete" ON public.crm_contact_tags;
CREATE POLICY "crm_contact_tags_delete" ON public.crm_contact_tags
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id
                AND ((public.user_belongs_to_org(c.organization_id) AND public.org_has_crm_access(c.organization_id))
                     OR public.has_role(auth.uid(), 'admin'::public.app_role)))
    );

-- ============================================================
-- 6. Verificação pós-migration (executar em staging)
-- ============================================================
-- Expectativa por cenário (secção 20 do protocolo):
--   Free                        => todas as operações CRM negadas
--   Pro                         => todas as operações CRM negadas
--   Business                    => SELECT/INSERT/UPDATE permitidos
--   Business + outra org        => negado (RLS org)
--   Utilizador sem membership   => negado
--   Platform admin              => SELECT/DELETE permitidos (suporte)
--
-- Smoke tests manuais em staging (SQL editor, como utilizador):
--   SELECT count(*) FROM crm_activities;            -- Business: >=0, Free: ERRO/0
--   INSERT INTO crm_activities (...) VALUES (...);  -- Free: violação RLS
--   SELECT public.org_has_crm_access('<org_uuid>'); -- Business: true, Free: false
--   SELECT public.org_has_crm_access(gen_random_uuid()); -- false (fail-closed)
