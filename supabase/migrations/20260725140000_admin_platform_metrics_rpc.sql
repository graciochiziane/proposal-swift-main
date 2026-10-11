-- ============================================================
-- Fase 2.1: RPC admin_platform_metrics()
-- Substitui 9 queries paralelas no frontend por 1 query no DB.
-- Elimina o problema de carregar TODOS os proposals.total.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_platform_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Valor total de propostas (aggregate no DB, nao carrega todas as rows)
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
