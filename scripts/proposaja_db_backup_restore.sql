-- ============================================================
-- ProposalJá — PROCEDIMENTOS DE BACKUP & RESTORE
-- ============================================================
-- Executar no Supabase SQL Editor.
-- Estes procedimentos criam backups lógicos via pg_dump
-- e fornecem restore points.
-- ============================================================

-- ============================================================
-- 1. FUNÇÃO: Criar restore point (snapshot lógico)
--    Cria uma tabela de backup com timestamp para
--    tabelas críticas. Útil para rollback rápido.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_restore_point(p_label TEXT DEFAULT '')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timestamp TEXT := to_char(now(), 'YYYYMMDD_HH24MISS');
  v_label TEXT := COALESCE(NULLIF(p_label, ''), 'auto');
  v_point_name TEXT := 'rp_' || v_timestamp || '_' || v_label;
  v_table_count INT := 0;
BEGIN
  -- Backup organizations
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_organizations AS SELECT * FROM public.organizations', v_point_name);
  v_table_count := v_table_count + 1;

  -- Backup organization_members
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_org_members AS SELECT * FROM public.organization_members', v_point_name);
  v_table_count := v_table_count + 1;

  -- Backup profiles (sem dados bancários sensíveis no log)
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_profiles AS SELECT id, email, nome, cargo, empresa, plano, organization_id, created_at, updated_at FROM public.profiles', v_point_name);
  v_table_count := v_table_count + 1;

  -- Backup user_roles
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_user_roles AS SELECT * FROM public.user_roles', v_point_name);
  v_table_count := v_table_count + 1;

  -- Backup subscriptions
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_subscriptions AS SELECT * FROM public.subscriptions', v_point_name);
  v_table_count := v_table_count + 1;

  -- Backup plan_limits
  EXECUTE format('CREATE TABLE IF NOT EXISTS _backup_%s_plan_limits AS SELECT * FROM public.plan_limits', v_point_name);
  v_table_count := v_table_count + 1;

  RAISE NOTICE 'Restore point criado: % (% tabelas: %)', v_point_name, v_table_count;
  RETURN v_point_name;
END;
$$;


-- ============================================================
-- 2. FUNÇÃO: Restaurar de um restore point
--    Restaura dados das tabelas de backup para as tabelas
--    de produção. USA COM CAUTELA.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_from_point(p_point_name TEXT, p_confirm BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup_exists BOOLEAN;
BEGIN
  IF NOT p_confirm THEN
    RAISE EXCEPTION 'RESTORE_REQUIRES_CONFIRM: chame com p_confirm = true para confirmar';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas admins';
  END IF;

  -- Verificar se o backup existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = '_backup_' || p_point_name || '_organizations'
    AND table_schema = 'public'
  ) INTO v_backup_exists;

  IF NOT v_backup_exists THEN
    RAISE EXCEPTION 'Restore point % nao encontrado', p_point_name;
  END IF;

  -- Restaurar organizations (merge: update existing, insert missing)
  EXECUTE format('INSERT INTO public.organizations (id, nome, slug, logo_url, cor_primaria, plano, propostas_mes_count, propostas_mes_reset_at, geracoes_ia_mes_count, geracoes_ia_mes_reset_at, suspended_at, suspension_reason, monthly_price, notes, contact_email, nuit, last_proposal_created_at, created_at, updated_at) SELECT id, nome, slug, logo_url, cor_primaria, plano, propostas_mes_count, propostas_mes_reset_at, geracoes_ia_mes_count, geracoes_ia_mes_reset_at, suspended_at, suspension_reason, monthly_price, notes, contact_email, nuit, last_proposal_created_at, created_at, updated_at FROM _backup_%s_organizations ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, plano = EXCLUDED.plano, propostas_mes_count = EXCLUDED.propostas_mes_count, propostas_mes_reset_at = EXCLUDED.propostas_mes_reset_at', p_point_name);

  -- Restaurar organization_members
  EXECUTE format('INSERT INTO public.organization_members (id, organization_id, user_id, role, joined_at, invited_by, display_name) SELECT id, organization_id, user_id, role, joined_at, invited_by, display_name FROM _backup_%s_org_members ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name', p_point_name);

  -- Restaurar user_roles
  EXECUTE format('INSERT INTO public.user_roles (id, user_id, role, created_at) SELECT id, user_id, role, created_at FROM _backup_%s_user_roles ON CONFLICT (user_id, role) DO NOTHING', p_point_name);

  -- Restaurar plan_limits
  EXECUTE format('INSERT INTO public.plan_limits (plano, propostas_mes, clientes_max, templates_pdf, geracoes_ia_mes) SELECT plano, propostas_mes, clientes_max, templates_pdf, geracoes_ia_mes FROM _backup_%s_plan_limits ON CONFLICT (plano) DO UPDATE SET propostas_mes = EXCLUDED.propostas_mes, clientes_max = EXCLUDED.clientes_max, templates_pdf = EXCLUDED.templates_pdf, geracoes_ia_mes = EXCLUDED.geracoes_ia_mes', p_point_name);

  RETURN 'Restaurado de ' || p_point_name;
END;
$$;


-- ============================================================
-- 3. FUNÇÃO: Limpar restore points antigos
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_restore_points(p_keep_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_drop_sql TEXT;
BEGIN
  FOR v_drop_sql IN
    SELECT 'DROP TABLE IF EXISTS public.' || tablename
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '_backup_%'
      AND table_name NOT LIKE '_backup_%_profiles'  -- skip non-primary backups
      AND creation_time < now() - (p_keep_days || ' days')::interval
  LOOP
    EXECUTE v_drop_sql;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ============================================================
-- 4. INSTRUÇÕES DE BACKUP COMPLETO VIA pg_dump
--    Executar NA LINHA DE COMANDOS (não no SQL Editor)
-- ============================================================

-- Backup completo (schema + dados):
-- pg_dump "postgresql://postgres:OperaOmnia#89@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres" \
--   --no-owner --no-privileges --no-comments \
--   -f proposaja_full_backup_$(date +%Y%m%d_%H%M%S).sql

-- Backup só dados (sem schema):
-- pg_dump "postgresql://postgres:OperaOmnia#89@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres" \
--   --data-only --no-owner --no-privileges \
--   -f proposaja_data_$(date +%Y%m%d_%H%M%S).sql

-- Backup só schema (sem dados):
-- pg_dump "postgresql://postgres:OperaOmnia#89@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres" \
--   --schema-only --no-owner --no-privileges \
--   -f proposaja_schema_$(date +%Y%m%d_%H%M%S).sql

-- Restore completo:
-- psql "postgresql://postgres:OperaOmnia#89@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres" \
--   -f proposaja_full_backup_YYYYMMDD_HHMMSS.sql

-- Restore dados só (em cima do schema existente):
-- psql "postgresql://postgres:OperaOmnia#89@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres" \
--   -f proposaja_data_YYYYMMDD_HHMMSS.sql

-- ============================================================
-- 5. LISTAR RESTORE POINTS DISPONÍVEIS
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_restore_points()
RETURNS TABLE(point_name TEXT, table_count BIGINT, created TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    REPLACE(table_name, '_backup_', '') AS point_name,
    COUNT(*) AS table_count,
    MIN(cast(create_time as timestamptz)) AS created
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE '_backup_%'
    AND table_name ~ '_backup_\d{8}_\d{6}_'
  GROUP BY table_name
  ORDER BY created DESC
  LIMIT 50;
$$;
