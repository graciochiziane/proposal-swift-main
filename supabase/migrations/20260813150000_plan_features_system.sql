-- ============================================================
-- Feature: Plan Features System
--
-- Cria sistema modular de features por plano comercial.
-- Permite activar/desactivar serviços por plano sem alterar código.
--
-- Em vez de adicionar colunas avulsas a plan_limits (que ficaria denso),
-- usa-se uma tabela separada com pares (plano, feature_key).
--
-- Cada feature tem:
--   - enabled BOOLEAN: ligado/desligado para o plano
--   - limit_value INTEGER: limite específico (NULL = ilimitado)
--
-- Exemplos de features:
--   - advanced_proposals: propostas comerciais estruturadas com blueprint + IA
--   - custom_branding: personalização de cores, logo, fontes
--   - api_access: acesso à API pública
--   - pdf_export: exportação de PDFs
--   - multi_user: multi-utilizador por organização
--
-- Data: 2026-08-13
-- Branch: feature/multi-user-hierarchy
-- ============================================================

-- ============================================================
-- 1. Tabela plan_features
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_features (
    plano public.plan_tier NOT NULL,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    limit_value INTEGER,  -- NULL = ilimitado; INTEGER = limite específico
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT plan_features_pkey PRIMARY KEY (plano, feature_key),
    CONSTRAINT plan_features_feature_key_check CHECK (
        feature_key ~ '^[a-z][a-z0-9_]*$'
        AND length(feature_key) BETWEEN 3 AND 50
    )
);

-- Index para lookup rápido por plano
CREATE INDEX IF NOT EXISTS plan_features_plano_idx
    ON public.plan_features(plano) WHERE enabled = true;

-- Trigger updated_at
CREATE TRIGGER trg_plan_features_updated_at
    BEFORE UPDATE ON public.plan_features
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. RLS — read para todos authenticated, write apenas para admins
-- ============================================================
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer utilizador autenticado pode ler (precisa para saber
--         que features o seu plano oferece)
DROP POLICY IF EXISTS "plan_features_select_all" ON public.plan_features;
CREATE POLICY "plan_features_select_all" ON public.plan_features
    FOR SELECT TO authenticated
    USING (true);

-- INSERT/UPDATE/DELETE: apenas platform admins
DROP POLICY IF EXISTS "plan_features_insert_admin" ON public.plan_features;
CREATE POLICY "plan_features_insert_admin" ON public.plan_features
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "plan_features_update_admin" ON public.plan_features;
CREATE POLICY "plan_features_update_admin" ON public.plan_features
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "plan_features_delete_admin" ON public.plan_features;
CREATE POLICY "plan_features_delete_admin" ON public.plan_features
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 3. Seed inicial — features conhecidas
-- ============================================================
-- Nota: por agora, todas as features estão habilitadas para todos os planos
--       (visível para todos). O gate por plano será activado quando os planos
--       comerciais forem lançados (Fase 4 do roadmap).

INSERT INTO public.plan_features (plano, feature_key, enabled, limit_value) VALUES
    -- advanced_proposals: propostas comerciais estruturadas com blueprint + IA
    ('free',      'advanced_proposals', true,  NULL),
    ('pro',       'advanced_proposals', true,  NULL),
    ('business',  'advanced_proposals', true,  NULL),
    -- custom_branding: personalização de cores, logo, fontes
    ('free',      'custom_branding',    false, NULL),
    ('pro',       'custom_branding',    true,  NULL),
    ('business',  'custom_branding',    true,  NULL),
    -- multi_user: multi-utilizador por organização
    ('free',      'multi_user',         true,  3),    -- free: até 3 membros
    ('pro',       'multi_user',         true,  10),   -- pro: até 10 membros
    ('business',  'multi_user',         true,  NULL), -- business: ilimitado
    -- api_access: acesso à API pública
    ('free',      'api_access',         false, NULL),
    ('pro',       'api_access',         false, NULL),
    ('business',  'api_access',         true,  NULL),
    -- pdf_export: exportação de PDFs (todos têm, mas templates variam)
    ('free',      'pdf_export',         true,  NULL),
    ('pro',       'pdf_export',         true,  NULL),
    ('business',  'pdf_export',         true,  NULL)
ON CONFLICT (plano, feature_key) DO NOTHING;

-- ============================================================
-- 4. Helper function: has_plan_feature
--    Verifica se um plano tem uma feature activa
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_plan_feature(
    p_plano public.plan_tier,
    p_feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.plan_features
        WHERE plano = p_plano
          AND feature_key = p_feature_key
          AND enabled = true
    )
$function$;

-- ============================================================
-- 5. Helper function: get_plan_feature_limit
--    Retorna o limit_value de uma feature para um plano
--    Retorna NULL se a feature não existe, não está activa, ou é ilimitada
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_plan_feature_limit(
    p_plano public.plan_tier,
    p_feature_key TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT limit_value FROM public.plan_features
    WHERE plano = p_plano
      AND feature_key = p_feature_key
      AND enabled = true
$function$;

-- ============================================================
-- 6. RPC: get_plan_features
--    Retorna todas as features de um plano (para o frontend)
--    Acessível a qualquer utilizador autenticado
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_plan_features(p_plano public.plan_tier)
RETURNS TABLE(
    feature_key TEXT,
    enabled BOOLEAN,
    limit_value INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT feature_key, enabled, limit_value
    FROM public.plan_features
    WHERE plano = p_plano
    ORDER BY feature_key
$function$;

-- ============================================================
-- 7. RPC: upsert_plan_feature
--    Para o super admin activar/desactivar features por plano
--    Apenas platform admins podem chamar
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_plan_feature(
    p_plano public.plan_tier,
    p_feature_key TEXT,
    p_enabled BOOLEAN,
    p_limit_value INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
        RAISE EXCEPTION 'Acesso negado: apenas admins de plataforma';
    END IF;

    INSERT INTO public.plan_features (plano, feature_key, enabled, limit_value)
    VALUES (p_plano, p_feature_key, p_enabled, p_limit_value)
    ON CONFLICT (plano, feature_key)
    DO UPDATE SET
        enabled = p_enabled,
        limit_value = p_limit_value,
        updated_at = now();
END;
$$;

-- REVOKE EXECUTE de PUBLIC/anon nas funções de escrita
REVOKE EXECUTE ON FUNCTION public.upsert_plan_feature(public.plan_tier, TEXT, BOOLEAN, INTEGER) FROM PUBLIC, anon;

-- get_plan_features e has_plan_feature ficam acessíveis a authenticated
-- (qualquer utilizador precisa de saber que features o seu plano oferece)

-- ============================================================
-- 8. Comentários para documentação
-- ============================================================
COMMENT ON TABLE public.plan_features IS
'Sistema modular de features por plano comercial. Cada par (plano, feature_key) define se uma feature está activa e o seu limite.';

COMMENT ON FUNCTION public.has_plan_feature(public.plan_tier, TEXT) IS
'Verifica se um plano tem uma feature activa. Retorna BOOLEAN.';

COMMENT ON FUNCTION public.get_plan_feature_limit(public.plan_tier, TEXT) IS
'Retorna o limit_value de uma feature para um plano. NULL = ilimitado ou feature inactiva.';

COMMENT ON FUNCTION public.get_plan_features(public.plan_tier) IS
'Retorna todas as features de um plano. Acessível a qualquer utilizador autenticado.';

COMMENT ON FUNCTION public.upsert_plan_feature(public.plan_tier, TEXT, BOOLEAN, INTEGER) IS
'Para super admin activar/desactivar features por plano. Apenas platform admins.';

-- ============================================================
-- 9. Verificação pós-migration
-- ============================================================
-- SELECT plano, feature_key, enabled, limit_value FROM plan_features ORDER BY plano, feature_key;
-- Expected: 15 rows (5 features × 3 planos)
