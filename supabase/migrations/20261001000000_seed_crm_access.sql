-- ============================================================
-- Seed: crm_access em plan_features
--
-- CONTEXTO
--   A migration 20260903000000 endureceu as policies RLS do CRM
--   com org_has_crm_access() — fail-closed: sem linha
--   (plano, 'crm_access') com enabled=true, o acesso é NEGADO.
--   O seed original de plan_features (20260813150000) NÃO inclui
--   crm_access, pelo que o módulo CRM ficou bloqueado para TODOS
--   os planos, incluindo Business, até esta seed existir (ou o
--   admin criar a linha manualmente via Gestão de Features).
--
-- VALORES
--   free=false, pro=false, business=true — conforme o desenho
--   comercial ("Operação completa com CRM" no plano Business,
--   descrição exibida na aba Plano & Faturação).
--   limit_value=NULL: feature booleana, sem limite numérico.
--
-- IDEMPOTÊNCIA / SEGURANÇA
--   ON CONFLICT DO NOTHING: se o admin já criou/alterou as linhas
--   via o diálogo "Gestão de Features por Plano", os valores
--   existentes são PRESERVADOS. Esta seed só preenche o vazio.
--
-- ROLLBACK
--   DELETE FROM public.plan_features WHERE feature_key = 'crm_access';
--
-- VERIFICAÇÃO PÓS-MIGRATION
--   SELECT plano, enabled FROM plan_features
--   WHERE feature_key = 'crm_access' ORDER BY plano;
--   Expected: 3 rows (free=false, pro=false, business=true)
-- ============================================================

INSERT INTO public.plan_features (plano, feature_key, enabled, limit_value) VALUES
    ('free',      'crm_access', false, NULL),
    ('pro',       'crm_access', false, NULL),
    ('business',  'crm_access', true,  NULL)
ON CONFLICT (plano, feature_key) DO NOTHING;
