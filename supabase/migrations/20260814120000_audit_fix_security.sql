-- ============================================================
-- P1-FIX: Security fixes from integral audit
--
-- 1. REVOKE EXECUTE de PUBLIC/anon em get_invitation_for_accept
-- 2. Fix search_path vazio em create_my_first_org e has_org_role_min_in_org
-- 3. FORCE ROW LEVEL SECURITY em todas as tabelas
-- ============================================================

-- ============================================================
-- 1. REVOKE EXECUTE de PUBLIC/anon em get_invitation_for_accept
--    Esta função é SECURITY DEFINER + EXECUTE to PUBLIC sem auth check interno.
--    Permite a qualquer utilizador anónimo ver detalhes de convites.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_invitation_for_accept(uuid, text) FROM PUBLIC, anon;

-- ============================================================
-- 2. Fix search_path vazio em 2 funções SECURITY DEFINER
--    search_path="" permite schema injection (shadow function hijack)
-- ============================================================

-- create_my_first_org: search_path vazio → public
CREATE OR REPLACE FUNCTION public.create_my_first_org(p_nome TEXT, p_plano public.plan_tier)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org public.organizations;
BEGIN
  INSERT INTO public.organizations (nome, slug, plano)
  VALUES (p_nome, 'org-' || substring(gen_random_uuid()::text, 1, 8), p_plano)
  RETURNING * INTO v_org;
  RETURN v_org;
END;
$$;

-- has_org_role_min_in_org: search_path vazio → public
-- (Esta função já tem search_path=public, mas vamos garantir)
CREATE OR REPLACE FUNCTION public.has_org_role_min_in_org(p_org_id UUID, p_min_role public.org_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND (
        (p_min_role = 'owner' AND role = 'owner') OR
        (p_min_role = 'admin' AND role IN ('owner', 'admin')) OR
        (p_min_role = 'member' AND role IN ('owner', 'admin', 'member')) OR
        (p_min_role = 'viewer' AND role IN ('owner', 'admin', 'member', 'viewer'))
      )
  )
$$;

-- ============================================================
-- 3. FORCE ROW LEVEL SECURITY em todas as tabelas public
--    Sem FORCE, o table owner (postgres) bypassa RLS.
--    Com leaked DB password, direct psql connection bypassa todas as policies.
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- ============================================================
-- 4. Verificar
-- ============================================================
COMMENT ON FUNCTION public.get_invitation_for_accept(uuid, text) IS
'P1-FIX: EXECUTE revoked from PUBLIC/anon. Only authenticated users with invitation UUID + email can call.';

COMMENT ON FUNCTION public.create_my_first_org(TEXT, public.plan_tier) IS
'P1-FIX: search_path fixed to public (was empty).';

-- Verificação: funções com search_path vazio
-- SELECT p.proname, pg_get_functiondef(p.oid)
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.prosecdef = true
-- AND pg_get_functiondef(p.oid) LIKE '%search_path TO ''''%';
-- Deve retornar 0 rows.
