-- =============================================
-- organization_templates.origem — distinção entre
-- modelos PERSONALIZADOS e ADQUIRIDOS por tenant
--
-- PEDIDO DO CLIENTE (pós-Etapa 3): na aba Templates
-- do TenantDetailPage deve aparecer a distinção entre
-- os templates personalizados e os adquiridos do tenant.
--
-- SEMÂNTICA:
--   - 'personalizado' : modelo com identidade própria do
--     cliente (rótulo de marca; no futuro, config de
--     layout — Nível 2).
--   - 'adquirido'    : modelo do catálogo da plataforma
--     adquirido (posto à disposição) do tenant.
--
-- ALTER ADITIVO (mesma filosofia das Etapas 1-3):
--   - coluna NOT NULL com DEFAULT 'adquirido' → linhas
--     existentes (se houver) ficam 'adquirido', o valor
--     conservador (catálogo).
--   - sem novos índices (cardinalidade baixa; o filtro
--     é feito em memória na UI).
--   - SEM alterações de RLS: as policies dependem só de
--     organization_id — origem não concede nem retira
--     permissões.
--   - resolver e cadeia de fallback INALTERADOS: a coluna
--     é apenas metadado comercial/visual da aba Templates.
--
-- ORDEM DE DEPLOY: aplicar esta migration ANTES do deploy
-- do frontend que envia 'origem' no INSERT (caso contrário
-- o insert falha com "column not found"). A leitura degrada
-- em segurança: linhas sem coluna → UI mostra 'adquirido'.
--
-- ROLLBACK:
--   ALTER TABLE public.organization_templates
--     DROP COLUMN IF EXISTS origem;
--
-- VALIDAÇÃO EM STAGING (após aplicar):
--   1. INSERT sem origem → devolve 'adquirido' (default).
--   2. INSERT com origem='personalizado' → aceite.
--   3. INSERT com origem='banana' → violação do CHECK
--      (org_templates_origem_check).
--   4. Aba Templates: badges violeta/azul + filtro por
--      origem com contadores.
-- =============================================

-- 1. Coluna (idempotente)
ALTER TABLE public.organization_templates
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'adquirido';

-- 2. CHECK de domínio (recriado para idempotência)
ALTER TABLE public.organization_templates
  DROP CONSTRAINT IF EXISTS organization_templates_origem_check;

ALTER TABLE public.organization_templates
  ADD CONSTRAINT organization_templates_origem_check
  CHECK (origem IN ('adquirido', 'personalizado'));

COMMENT ON COLUMN public.organization_templates.origem IS
  'Distinção comercial dos modelos do tenant: personalizado = identidade própria do cliente (futura config Nível 2); adquirido = modelo do catálogo posto à disposição do tenant. Default conservador: adquirido.';
