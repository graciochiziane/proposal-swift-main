-- ============================================================
-- ProposalJá — DIAGNÓSTICOS & VERIFICAÇÃO DE INTEGRIDADE
-- ============================================================
-- Executar no Supabase SQL Editor.
-- Todas as queries são SELECT (não modificam dados).
-- ============================================================

-- ============================================================
-- 1. INVENTÁRIO COMPLETO DO SCHEMA
-- ============================================================

-- 1a. Todas as tabelas com contagem de linhas
SELECT
  schemaname AS schema,
  tablename AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 1b. Todos os enums
SELECT t.typname AS enum_name,
       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = 'public'::regnamespace
GROUP BY t.typname
ORDER BY t.typname;

-- 1c. Todas as funções public
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid) AS returns,
  CASE proisstrict WHEN true THEN 'STRICT' ELSE '' END AS strict,
  CASE provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END AS volatility,
  CASE prosecurity WHEN true THEN 'SECURITY DEFINER' ELSE '' END AS security
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 1d. Todos os triggers
SELECT
  tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE tgtype WHEN 17 THEN 'BEFORE INSERT' WHEN 18 THEN 'BEFORE UPDATE' WHEN 19 THEN 'BEFORE DELETE'
       WHEN 21 THEN 'AFTER INSERT'  WHEN 22 THEN 'AFTER UPDATE'  WHEN 23 THEN 'AFTER DELETE' END AS event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
ORDER BY c.relname, tgname;

-- ============================================================
-- 2. RLS — VERIFICAÇÃO DE SEGURANÇA
-- ============================================================

-- 2a. Tabelas SEM RLS (risco de segurança)
SELECT tablename AS unprotected_table
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = pg_tables.tablename)
  AND tablename NOT LIKE '_backup_%'
ORDER BY tablename;

-- 2b. Tabelas com RLS desabilitado
SELECT relname AS rls_disabled_table
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relrowsecurity = false
  AND relname NOT LIKE '_backup_%'
ORDER BY relname;

-- 2c. Todas as RLS policies
SELECT
  schemaname, tablename, policyname,
  cmd AS operation,
  CASE roles::text WHEN '{authenticated}'::text THEN 'authenticated' ELSE roles::text END AS roles,
  pg_get_expr(qual, oid) AS using_expr
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY tablename, policyname;

-- 2d. Verificar se todas as tabelas de dados têm pelo menos 1 policy
SELECT
  t.tablename,
  COUNT(p.policyname) AS policy_count,
  CASE WHEN COUNT(p.policyname) = 0 THEN 'RISCO: SEM PROTEÇÃO' ELSE 'OK' END AS status
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public' AND t.tablename NOT LIKE '_backup_%'
GROUP BY t.tablename
ORDER BY policy_count ASC, t.tablename;

-- ============================================================
-- 3. INTEGRIDADE DE DADOS
-- ============================================================

-- 3a. Perfis sem organização (órfãos)
SELECT p.id, p.email, p.nome, p.created_at
FROM public.profiles p
WHERE p.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = p.id);

-- 3b. Propostas sem organização
SELECT pr.id, pr.numero, pr.owner_id, pr.created_at
FROM public.proposals pr
WHERE pr.organization_id IS NULL;

-- 3c. Clientes sem organização
SELECT c.id, c.nome, c.owner_id
FROM public.clients c
WHERE c.organization_id IS NULL;

-- 3d. Propostas com client_id que aponta para cliente de outra org (cross-tenant leak)
SELECT pr.id, pr.numero, pr.organization_id AS proposal_org,
       c.organization_id AS client_org
FROM public.proposals pr
JOIN public.clients c ON c.id = pr.client_id
WHERE pr.organization_id IS NOT NULL
  AND c.organization_id IS NOT NULL
  AND pr.organization_id != c.organization_id;

-- 3e. Catálogo de itens sem organização
SELECT ci.id, ci.nome, ci.owner_id
FROM public.catalog_items ci
WHERE ci.organization_id IS NULL;

-- 3f. Membros com profile.organization_id diferente da org real
SELECT p.id, p.email, p.organization_id AS profile_org,
       om.organization_id AS member_org
FROM public.profiles p
JOIN public.organization_members om ON om.user_id = p.id
WHERE p.organization_id IS DISTINCT FROM om.organization_id;

-- 3g. Propostas com owner que não é membro da org da proposta
SELECT pr.id, pr.numero, pr.owner_id, pr.organization_id
FROM public.proposals pr
WHERE pr.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = pr.owner_id AND om.organization_id = pr.organization_id
  );

-- 3h. Facturas com valor total inconsistente com items
SELECT i.id, i.numero, i.total AS invoice_total,
       COALESCE(SUM(ii.subtotal), 0) AS items_total,
       i.total - COALESCE(SUM(ii.subtotal), 0) AS diff
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
GROUP BY i.id, i.numero, i.total
HAVING ABS(i.total - COALESCE(SUM(ii.subtotal), 0)) > 0.01
ORDER BY ABS(i.total - COALESCE(SUM(ii.subtotal), 0)) DESC;

-- 3i. Propostas com valor total inconsistente
SELECT pr.id, pr.numero, pr.total AS proposal_total,
       COALESCE(SUM(pi.subtotal), 0) AS items_total,
       pr.total - COALESCE(SUM(pi.subtotal), 0) AS diff
FROM public.proposals pr
LEFT JOIN public.proposal_items pi ON pi.proposal_id = pr.id
GROUP BY pr.id, pr.numero, pr.total
HAVING ABS(pr.total - COALESCE(SUM(pi.subtotal), 0)) > 0.01
ORDER BY ABS(pr.total - COALESCE(SUM(pi.subtotal), 0)) DESC;

-- ============================================================
-- 4. ÍNDICES & CONSTRAINTS
-- ============================================================

-- 4a. Índices únicos duplicados (mesmo nome em tabelas diferentes)
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    GROUP BY indexname HAVING COUNT(*) > 1
  )
ORDER BY indexname, tablename;

-- 4b. Constraints com erros (invalid)
SELECT conname, conrelid::regclass AS table_name, contype, conislocal
FROM pg_constraint
WHERE convalidated = false
  AND connamespace = 'public'::regnamespace;

-- 4c. FKs com tabela referenciada inexistente
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_name = ccu.table_name AND t.table_schema = 'public'
  );

-- ============================================================
-- 5. PERFORMANCE
-- ============================================================

-- 5a. Tabelas com mais de 10k linhas sem índice (exceto PK)
SELECT
  relname AS table_name,
  n_live_tup AS row_count,
  (SELECT COUNT(*) FROM pg_index i WHERE i.indrelid = c.oid AND NOT i.indisprimary) AS index_count
FROM pg_class c
JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND n_live_tup > 10000
  AND (SELECT COUNT(*) FROM pg_index i WHERE i.indrelid = c.oid AND NOT i.indisprimary) = 0
ORDER BY n_live_tup DESC;

-- 5b. Sequences/serials vazias ou desalinhadas
SELECT
  t.relname AS table_name,
  a.attname AS column_name,
  s.relname AS sequence_name
FROM pg_class s
JOIN pg_depend d ON d.objid = s.oid
JOIN pg_class t ON d.refobjid = t.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
WHERE s.relkind = 'S'
  AND t.relnamespace = 'public'::regnamespace;

-- ============================================================
-- 6. SEGURANÇA AVANÇADA
-- ============================================================

-- 6a. Funções SECURITY DEFINER sem search_path setado
SELECT
  p.proname AS function_name,
  CASE WHEN p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path%'
  ) THEN 'RISCO: sem search_path' ELSE 'OK' END AS status
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prosecurity = true
ORDER BY p.proname;

-- 6b. Tabelas com GRANT público (world-readable)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'public'
  AND table_name NOT LIKE '_backup_%';

-- 6c. Triggers BEFORE DELETE que podem impedir cascade
SELECT tgname AS trigger_name, c.relname AS table_name,
       p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace
  AND (tgtype = 19 OR tgtype = 23); -- BEFORE DELETE or AFTER DELETE

-- ============================================================
-- 7. MÉTRICAS DE NEGÓCIO
-- ============================================================

-- 7a. Resumo por organização
SELECT
  o.nome AS organization,
  o.plano,
  o.propostas_mes_count,
  o.suspended_at IS NOT NULL AS is_suspended,
  (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = o.id) AS members,
  (SELECT COUNT(*) FROM public.clients WHERE organization_id = o.id) AS clients,
  (SELECT COUNT(*) FROM public.proposals WHERE organization_id = o.id) AS proposals,
  (SELECT COUNT(*) FROM public.invoices WHERE organization_id = o.id) AS invoices,
  (SELECT COALESCE(SUM(total), 0) FROM public.proposals WHERE organization_id = o.id) AS total_proposal_value
FROM public.organizations o
ORDER BY o.created_at;

-- 7b. Contagem de propostas por estado
SELECT status, COUNT(*) AS total
FROM public.proposals
GROUP BY status
ORDER BY total DESC;

-- 7c. Top 10 organizações por valor de propostas
SELECT
  o.nome,
  COUNT(pr.id) AS num_proposals,
  COALESCE(SUM(pr.total), 0) AS total_value
FROM public.organizations o
LEFT JOIN public.proposals pr ON pr.organization_id = o.id
GROUP BY o.id, o.nome
ORDER BY total_value DESC
LIMIT 10;

-- 7d. Utilizadores sem organização (só devem existir se o
--     signup trigger falhou)
SELECT p.id, p.email, p.nome, p.created_at
FROM public.profiles p
LEFT JOIN public.organization_members om ON om.user_id = p.id
WHERE om.id IS NULL;
