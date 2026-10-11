-- ============================================================
-- P0-C2: Hardening de funções admin — REVOKE EXECUTE + has_role check
--
-- Problema (Audit C2):
--   Funções admin (admin_platform_metrics, admin_signups_by_day,
--   admin_most_active_users, organization_health_score) têm
--   EXECUTE grant para PUBLIC e anon. Isto significa que qualquer
--   utilizador anónimo com a chave anon do projecto (pública no
--   bundle JS) pode chamar estas funções e obter métricas globais
--   da plataforma (total de utilizadores, emails, last_seen_at, etc.)
--
-- Adicionalmente:
--   - admin_platform_metrics NÃO tem has_role('admin') check interno
--   - admin_signups_by_day NÃO tem has_role('admin') check interno
--   - admin_most_active_users NÃO tem has_role('admin') check interno
--   - organization_health_score NÃO tem has_role('admin') check interno
--   (transfer_ownership, accept_invitation, get_invitation_by_token,
--    get_my_pending_invitations têm lógica de validação própria)
--
-- Correção:
--   1. Adicionar has_role(auth.uid(), 'admin') check no corpo das
--      4 funções admin que não têm (admin_platform_metrics,
--      admin_signups_by_day, admin_most_active_users,
--      organization_health_score)
--   2. REVOKE EXECUTE FROM PUBLIC e anon em todas as funções admin
--   3. Manter EXECUTE para authenticated (que é verificado no corpo)
--   4. Para get_invitation_by_token e get_my_pending_invitations:
--      REVOKE de PUBLIC e anon também, mas manter para authenticated
--      (get_invitation_by_token é chamado por utilizadores autenticados
--       a partir da página AcceptInvite)
--
-- Princípio: defesa em profundidade
--   Mesmo que a chave anon seja comprometida, as funções recusam
--   executar sem um JWT de utilizador autenticado com role admin.
--
-- Data: 2026-08-13
-- Audit ref: AUDITORIA_E2E_ProposalJa.md, secção 3.8 (C2)
-- Branch: fix/p0-security-critical
-- ============================================================

-- ============================================================
-- 1. RECREATE admin_platform_metrics WITH has_role check
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_platform_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_users INT;
  v_new_signups INT;
  v_proposals_month INT;
  v_clients_month INT;
  v_proposals_total_value NUMERIC;
  v_online_now INT;
  v_accessed_today INT;
  v_accessed_week INT;
  v_accessed_month INT;
  v_result JSON;
BEGIN
  -- P0-C2: Verificar admin de plataforma
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins de plataforma';
  END IF;

  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;

  -- Novos registos este mes
  SELECT COUNT(*) INTO v_new_signups
  FROM public.profiles
  WHERE created_at >= date_trunc('month', now());

  -- Propostas este mes
  SELECT COUNT(*) INTO v_proposals_month
  FROM public.proposals
  WHERE created_at >= date_trunc('month', now());

  -- Clientes este mes
  SELECT COUNT(*) INTO v_clients_month
  FROM public.clients
  WHERE created_at >= date_trunc('month', now());

  -- Valor total de propostas
  SELECT COALESCE(SUM(total), 0) INTO v_proposals_total_value FROM public.proposals;

  -- Online agora (ultimos 15 min)
  SELECT COUNT(*) INTO v_online_now
  FROM public.profiles
  WHERE last_seen_at > now() - INTERVAL '15 minutes';

  -- Acessaram hoje
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_today
  FROM public.user_activity
  WHERE created_at >= date_trunc('day', now());

  -- Acessaram na semana
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_week
  FROM public.user_activity
  WHERE created_at >= now() - INTERVAL '7 days';

  -- Acessaram no mes
  SELECT COUNT(DISTINCT user_id) INTO v_accessed_month
  FROM public.user_activity
  WHERE created_at >= now() - INTERVAL '30 days';

  v_result := json_build_object(
    'users_online_now', v_online_now,
    'accessed_today', v_accessed_today,
    'accessed_week', v_accessed_week,
    'accessed_month', v_accessed_month,
    'total_users', v_total_users,
    'new_signups_this_month', v_new_signups,
    'proposals_this_month', v_proposals_month,
    'clients_this_month', v_clients_month,
    'proposals_total_value', v_proposals_total_value
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 2. RECREATE admin_signups_by_day WITH has_role check
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_signups_by_day(p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_start DATE;
  v_before INT;
  v_result JSON;
BEGIN
  -- P0-C2: Verificar admin de plataforma
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins de plataforma';
  END IF;

  v_start := CURRENT_DATE - p_days;

  SELECT COUNT(*) INTO v_before
  FROM public.profiles
  WHERE created_at < v_start;

  SELECT json_agg(
    json_build_object('date', to_char(d, 'YYYY-MM-DD'), 'total', v_before + COALESCE(dc.cnt, 0))
    ORDER BY d
  ) INTO v_result
  FROM (
    SELECT generate_series(v_start, CURRENT_DATE, '1 day'::INTERVAL)::DATE AS d
  ) dates
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.profiles
    WHERE created_at >= d
      AND created_at < d + 1
  ) dc ON true;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 3. RECREATE admin_most_active_users WITH has_role check
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_most_active_users(p_days INTEGER DEFAULT 30, p_limit INTEGER DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- P0-C2: Verificar admin de plataforma
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins de plataforma';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'email', p.email,
      'nome', p.nome,
      'plano', p.plano,
      'last_seen_at', p.last_seen_at,
      'visits_today', ua.visit_count
    )
    ORDER BY ua.visit_count DESC
  ) INTO v_result
  FROM (
    SELECT user_id, COUNT(*) AS visit_count
    FROM public.user_activity
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY user_id
    ORDER BY visit_count DESC
    LIMIT p_limit
  ) ua
  JOIN public.profiles p ON p.id = ua.user_id;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 4. RECREATE organization_health_score WITH has_role check
--    (qualquer admin de plataforma OU owner/admin da própria org)
-- ============================================================
CREATE OR REPLACE FUNCTION public.organization_health_score(p_org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_last TIMESTAMPTZ;
  v_days INT;
  v_is_admin BOOLEAN;
  v_is_org_member BOOLEAN;
BEGIN
  -- P0-C2: Verificar acesso — admin de plataforma OU owner/admin da própria org
  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_org_member := EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );

  IF NOT (v_is_admin OR v_is_org_member) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins de plataforma ou owner/admin da org';
  END IF;

  SELECT last_proposal_created_at INTO v_last
  FROM public.organizations WHERE id = p_org_id;

  IF v_last IS NULL THEN RETURN 0; END IF;

  v_days := extract(day from now() - v_last)::INT;
  IF v_days <= 1 THEN RETURN 100; END IF;
  IF v_days <= 3 THEN RETURN 80; END IF;
  IF v_days <= 7 THEN RETURN 60; END IF;
  IF v_days <= 14 THEN RETURN 40; END IF;
  IF v_days <= 30 THEN RETURN 20; END IF;
  RETURN 0;
END;
$$;

-- ============================================================
-- 5. REVOKE EXECUTE de PUBLIC e anon em todas as funções sensíveis
--    Mantém EXECUTE para authenticated (que é validado no corpo)
--    e para service_role (que bypassa RLS em operações server-side)
-- ============================================================

-- Funções admin de plataforma (apenas admins)
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_signups_by_day(INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_most_active_users(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_suspend(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.organization_health_score(UUID) FROM PUBLIC, anon;

-- Funções de gestão de org (apenas autenticados)
REVOKE EXECUTE ON FUNCTION public.transfer_ownership(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(UUID, UUID, TEXT) FROM PUBLIC, anon;

-- Funções de convite (apenas autenticados com email correspondente)
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_pending_invitations(TEXT) FROM PUBLIC, anon;

-- ============================================================
-- 6. Comentários para documentação
-- ============================================================
COMMENT ON FUNCTION public.admin_platform_metrics() IS
'P0-C2 (2026-08-13): Adicionado has_role(admin) check. Apenas admins de plataforma podem chamar.';
COMMENT ON FUNCTION public.admin_signups_by_day(INTEGER) IS
'P0-C2 (2026-08-13): Adicionado has_role(admin) check. Apenas admins de plataforma podem chamar.';
COMMENT ON FUNCTION public.admin_most_active_users(INTEGER, INTEGER) IS
'P0-C2 (2026-08-13): Adicionado has_role(admin) check. Apenas admins de plataforma podem chamar.';
COMMENT ON FUNCTION public.organization_health_score(UUID) IS
'P0-C2 (2026-08-13): Adicionado check — admin de plataforma OU owner/admin da própria org.';

-- ============================================================
-- 7. Verificação pós-migration (executar manualmente para confirmar)
-- ============================================================
-- Expected results after this migration:
--
-- SELECT routine_name, grantee
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('admin_platform_metrics', 'admin_signups_by_day',
--                        'admin_most_active_users', 'admin_toggle_suspend',
--                        'admin_remove_member', 'organization_health_score',
--                        'transfer_ownership', 'accept_invitation',
--                        'get_invitation_by_token', 'get_my_pending_invitations')
--   AND grantee IN ('PUBLIC', 'anon')
-- ORDER BY routine_name;
--
-- Should return ZERO rows.
