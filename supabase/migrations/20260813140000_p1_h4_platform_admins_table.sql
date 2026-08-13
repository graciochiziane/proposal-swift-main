-- ============================================================
-- P1-H4: Migrar admin hardcoded para tabela platform_admins
--
-- Problema (Audit H4):
--   handle_new_user() trigger tem email 'graciochiziane@gmail.com'
--   hardcoded. Qualquer signup com esse email ganha automaticamente:
--     - app_role = 'admin' (platform admin)
--     - plano = 'business'
--   Se o email for comprometido, atacante ganha admin de plataforma.
--   Impossível adicionar outros admins sem alterar código.
--
-- Correção:
--   1. Criar tabela platform_admins (user_id, granted_by, granted_at, active)
--   2. Migrar email hardcoded para a tabela
--   3. Refazer handle_new_user() para consultar platform_admins
--      em vez de comparar com string hardcoded
--   4. Manter compatibilidade: o email existente continua a funcionar
--      mas agora é gerido via tabela (pode adicionar/remover admins)
--
-- Nota de segurança:
--   A tabela platform_admins tem RLS: apenas platform admins podem
--   ler/escrever. Isto significa que o primeiro admin precisa de ser
--   inserido via migration (SECURITY DEFINER bypassa RLS).
--
-- Data: 2026-08-13
-- Audit ref: AUDITORIA_E2E_ProposalJa.md, secção 12.2 H4
-- Branch: fix/p1-security-high
-- ============================================================

-- ============================================================
-- 1. Criar tabela platform_admins
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT DEFAULT ''
);

-- Index por email para lookup rápido
CREATE INDEX IF NOT EXISTS platform_admins_email_idx
    ON public.platform_admins(email) WHERE active = true;

-- ============================================================
-- 2. Migrar email hardcoded para a tabela
--    Procura o user existente com esse email e insere na tabela
-- ============================================================
INSERT INTO public.platform_admins (user_id, email, granted_by, notes)
SELECT
    u.id,
    u.email,
    NULL,  -- granted_by desconhecido (foi hardcoded originalmente)
    'Migrated from hardcoded email in handle_new_user() on 2026-08-13'
FROM auth.users u
WHERE lower(u.email) = 'graciochiziane@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 3. RLS na tabela platform_admins
--    Apenas platform admins podem ler; apenas admins podem escrever
-- ============================================================
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas platform admins
DROP POLICY IF EXISTS "platform_admins_select_admin" ON public.platform_admins;
CREATE POLICY "platform_admins_select_admin" ON public.platform_admins
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- INSERT: apenas platform admins
DROP POLICY IF EXISTS "platform_admins_insert_admin" ON public.platform_admins;
CREATE POLICY "platform_admins_insert_admin" ON public.platform_admins
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- UPDATE: apenas platform admins
DROP POLICY IF EXISTS "platform_admins_update_admin" ON public.platform_admins;
CREATE POLICY "platform_admins_update_admin" ON public.platform_admins
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- DELETE: apenas platform admins
DROP POLICY IF EXISTS "platform_admins_delete_admin" ON public.platform_admins;
CREATE POLICY "platform_admins_delete_admin" ON public.platform_admins
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- 4. Helper function: verificar se um email é platform admin
--    Usado pelo trigger handle_new_user() refactorizado
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins
        WHERE lower(email) = lower(p_email)
          AND active = true
    )
$function$;

-- ============================================================
-- 5. Refactor handle_new_user() para usar platform_admins
--    Substitui a comparação hardcoded por chamada à função helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_org_id UUID;
  v_org_nome TEXT;
BEGIN
  -- P1-H4: Verificar se o email está na tabela platform_admins
  -- (anteriormente era: lower(NEW.email) = 'graciochiziane@gmail.com')
  v_is_admin := public.is_platform_admin_email(NEW.email);

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

-- ============================================================
-- 6. Comentários para documentação
-- ============================================================
COMMENT ON TABLE public.platform_admins IS
'P1-H4 (2026-08-13): Substitui o email hardcoded em handle_new_user(). Adicionar/remover admins via INSERT/DELETE nesta tabela.';

COMMENT ON FUNCTION public.is_platform_admin_email(TEXT) IS
'P1-H4 (2026-08-13): Helper usado por handle_new_user() para verificar se um email é platform admin. Consulta a tabela platform_admins.';

COMMENT ON FUNCTION public.handle_new_user() IS
'P1-H4 (2026-08-13): Refactorizada para usar is_platform_admin_email() em vez de comparação hardcoded. Trigger AFTER INSERT em auth.users.';

-- ============================================================
-- 7. Verificação pós-migration
-- ============================================================
-- Expected: 1 row in platform_admins (graciochiziane@gmail.com)
-- SELECT user_id, email, active FROM public.platform_admins;
--
-- Expected: handle_new_user() body contains is_platform_admin_email
-- SELECT pg_get_functiondef('handle_new_user()'::regprocedure);
