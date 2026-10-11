-- ============================================================
-- P1-H1: Hardening do overload has_role(uuid, text)
--
-- Problema (Audit H1):
--   Existem duas assinaturas has_role na BD:
--     1. has_role(_user_id uuid, _role app_role) — original, search_path=public
--     2. has_role(p_user_id uuid, p_role text) — adicionada via SQL Editor,
--        search_path='' (vazio) — vulnerabilidade de schema injection
--
--   38 policies RLS dependem do overload (uuid, text). Não é possível
--   fazer DROP sem CASCADE (que removeria todas as policies).
--
-- Correção:
--   Recriar has_role(uuid, text) com:
--     - SET search_path TO 'public' (consistente com overload app_role)
--     - Body equivalente: compara role::text com p_role
--   Isto elimina a vulnerabilidade de search_path vazio sem quebrar policies.
--
-- Nota:
--   A ambiguidade de overload permanece (PostgreSQL pode escolher qualquer
--   um dos dois quando se passa 'admin' string). Mas como ambos são agora
--   funcionalmente equivalentes e seguros, isto não é problema.
--   Para chamadas novas, preferir sempre has_role(uid, 'admin'::app_role).
--
-- Data: 2026-08-13
-- Audit ref: AUDITORIA_E2E_ProposalJa.md, secção 3.10 (H1)
-- Branch: fix/p1-security-high
-- ============================================================

-- Recriar has_role(uuid, text) com search_path correcto
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role::text = p_role
  )
$function$;

-- Verificar que ambas as assinaturas estão consistentes
COMMENT ON FUNCTION public.has_role(p_user_id uuid, p_role text) IS
'P1-H1 (2026-08-13): Recriada com search_path=public (era vazio). Wrapper equivalente ao overload app_role. 38 policies dependem desta assinatura.';

-- Nota: não fazemos DROP porque 38 policies dependem dela.
-- A correção de search_path elimina a vulnerabilidade de schema injection.
