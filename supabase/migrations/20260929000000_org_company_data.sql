-- =============================================
-- Centralização dos dados da EMPRESA em organizations
-- (arquitectura SaaS: perfil pessoal ≠ dados da organização)
--
-- CONTEXTO: até aqui logo/cor/NUIT/endereço/pagamentos viviam no
-- profiles de CADA utilizador (duplicados por membro, conflitantes
-- entre membros da mesma org). Passam a pertencer à organização.
--
-- O QUE FAZ:
--   1. Adiciona a organizations: endereco, dados_bancarios,
--      mobile_money, pagamentos_extras.
--      (nuit, cor_primaria e logo_url JÁ existiam nesta tabela.)
--   2. Backfill a partir do perfil do melhor membro da org
--      (owner > admin > membro mais antigo), apenas quando o lado
--      org está vazio/por-omissão — nunca sobrescreve dados org
--      já configurados. Logo legacy {user_id}/{filename} é
--      referenciado pelo caminho completo (mesmo ficheiro).
--   3. NÃO remove nenhuma coluna do profiles — os dados antigos
--      ficam intactos como rede de segurança e rollback do UI.
--
-- STORAGE (bucket 'logos'): RLS já org-aware desde 20260709010000 —
--   caminho {organization_id}/{filename}: admin+ faz upload/delete,
--   qualquer membro lê. ZERO policies novas neste migration.
--
-- RLS (tabela organizations): policies existentes cobrem as colunas
--   novas automaticamente (RLS é ao nível da linha):
--   - org_select_member  (membros leem)
--   - org_update_owner_admin (owner/admin escrevem)
--   - admin_update_orgs (platform admin, 20260725000000)
--
-- ROLLBACK:
--   ALTER TABLE public.organizations
--     DROP COLUMN IF EXISTS endereco,
--     DROP COLUMN IF EXISTS dados_bancarios,
--     DROP COLUMN IF EXISTS mobile_money,
--     DROP COLUMN IF EXISTS pagamentos_extras;
--   (profiles nunca foi alterado — reverter o frontend restaura o
--    comportamento antigo com os dados originais intactos)
--
-- VALIDAÇÃO EM STAGING (após aplicar):
--   1. Re-run idempotente: ALTER ... IF NOT EXISTS; backfill tem
--      guards nos dois lados (org vazio E profile com dados).
--   2. Org cujo owner tinha pagamentos no perfil → org herda-os
--      (SELECT dados_bancarios, mobile_money, pagamentos_extras
--       FROM organizations WHERE id = '<org>');
--   3. Org SEM dados no owner → permanece com os defaults.
--   4. Membro comum: SELECT ok; UPDATE organizations → RLS deny.
--   5. Admin: upload logos/{org_id}/x.png → sucesso;
--      membro comum → storage RLS deny.
-- =============================================

-- 1. Novas colunas (idempotente)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS dados_bancarios JSONB NOT NULL
    DEFAULT '{"ativo":false,"banco":"","numeroConta":"","nib":""}'::jsonb,
  ADD COLUMN IF NOT EXISTS mobile_money JSONB NOT NULL
    DEFAULT '{"mpesa":{"ativo":false,"numero":""},"emola":{"ativo":false,"numero":""},"mkesh":{"ativo":false,"numero":""}}'::jsonb,
  ADD COLUMN IF NOT EXISTS pagamentos_extras JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill do perfil do melhor membro (owner > admin > membro mais antigo)
--    Guardas: lado org vazio/por-omissão E lado profile com dados significativos.
WITH candidato AS (
  SELECT m.organization_id,
         m.user_id,
         ROW_NUMBER() OVER (
           PARTITION BY m.organization_id
           ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                    m.joined_at ASC
         ) AS rn
  FROM public.organization_members m
)
UPDATE public.organizations o
SET nuit = COALESCE(NULLIF(o.nuit, ''), p.nuit),
    endereco = COALESCE(NULLIF(o.endereco, ''), p.endereco),
    cor_primaria = COALESCE(NULLIF(o.cor_primaria, ''), p.cor_primaria),
    logo_url = COALESCE(NULLIF(o.logo_url, ''),
      CASE
        WHEN p.logotipo_url IS NULL OR p.logotipo_url = '' THEN NULL
        WHEN p.logotipo_url LIKE 'http%' THEN p.logotipo_url
        ELSE c.user_id || '/' || p.logotipo_url
      END),
    dados_bancarios = CASE
      WHEN o.dados_bancarios = '{"ativo":false,"banco":"","numeroConta":"","nib":""}'::jsonb
       AND (
         (p.dados_bancarios ->> 'ativo')::boolean IS TRUE
         OR NULLIF(p.dados_bancarios ->> 'banco', '') IS NOT NULL
         OR NULLIF(p.dados_bancarios ->> 'numeroConta', '') IS NOT NULL
         OR NULLIF(p.dados_bancarios ->> 'nib', '') IS NOT NULL
       )
      THEN COALESCE(p.dados_bancarios, o.dados_bancarios)
      ELSE o.dados_bancarios
    END,
    mobile_money = CASE
      WHEN o.mobile_money = '{"mpesa":{"ativo":false,"numero":""},"emola":{"ativo":false,"numero":""},"mkesh":{"ativo":false,"numero":""}}'::jsonb
       AND (
         (p.mobile_money -> 'mpesa' ->> 'ativo')::boolean IS TRUE
         OR NULLIF(p.mobile_money -> 'mpesa' ->> 'numero', '') IS NOT NULL
         OR (p.mobile_money -> 'emola' ->> 'ativo')::boolean IS TRUE
         OR NULLIF(p.mobile_money -> 'emola' ->> 'numero', '') IS NOT NULL
         OR (p.mobile_money -> 'mkesh' ->> 'ativo')::boolean IS TRUE
         OR NULLIF(p.mobile_money -> 'mkesh' ->> 'numero', '') IS NOT NULL
       )
      THEN COALESCE(p.mobile_money, o.mobile_money)
      ELSE o.mobile_money
    END,
    pagamentos_extras = CASE
      WHEN o.pagamentos_extras = '[]'::jsonb
       AND p.pagamentos_extras IS NOT NULL
       AND p.pagamentos_extras <> '[]'::jsonb
      THEN p.pagamentos_extras
      ELSE o.pagamentos_extras
    END
FROM candidato c
JOIN public.profiles p ON p.id = c.user_id
WHERE c.rn = 1
  AND c.organization_id = o.id;
