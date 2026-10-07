-- =============================================
-- Templates PDF por Organização — tabela de associação
-- (implementa a proposta auditada e aprovada: Secções 6 e 7
--  do documento "Auditoria e Proposta de Arquitectura para
--  Templates Personalizados por Organização")
--
-- CONTEXTO: os 4 modelos PDF vivem em código
-- (src/lib/pdf/templates.ts — registry). Faltava a ligação
-- organização→modelo: qual o modelo por omissão de cada tenant
-- nas exportações quando o utilizador não escolhe outro.
--
-- O QUE FAZ:
--   1. Cria organization_templates (uma linha = um modelo posto
--      à disposição de uma org; is_default marca o modelo aplicado
--      nas exportações; is_active desactiva sem apagar).
--   2. RLS no padrão ENDURECIDO das tabelas de negócio:
--      SELECT para membros; INSERT/UPDATE/DELETE só owner/admin
--      da org ou platform admin. (Deliberadamente MAIS
--      restritiva que a pdf_templates dormente, cujo UPDATE
--      exigia apenas membership.)
--   3. Índice único parcial: no máximo 1 default por org.
--   4. config JSONB reservado (Nível 2 — ainda sem consumidor).
--
-- DECISÕES (da proposta aprovada):
--   - SEM CHECK em template_key: a validação real é o lookup no
--     registry em código; chave órfã degrada para fallback no
--     resolver, nunca para erro.
--   - SEM scope / template_type / version: sem consumidores (YAGNI).
--   - SEM seed: a tabela nasce vazia → org sem linhas =
--     comportamento idêntico ao actual (fallback do resolver).
--
-- NÃO CONFIRMADO: estado real do projecto Supabase (as migrações
-- dormentes pdf_templates/blueprint podem não estar aplicadas) —
-- esta tabela é independente; verificar no SQL Editor antes do
-- deploy apenas por higiene de inventário.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.organization_templates CASCADE;
--   (CREATE puro — nenhuma tabela existente é alterada)
--
-- VALIDAÇÃO EM STAGING (após aplicar):
--   1. Membro da org A: SELECT * FROM organization_templates
--      → só vê linhas da org A (RLS devolve 0 linhas de outra org).
--   2. Membro (viewer/member): INSERT/UPDATE/DELETE → RLS deny.
--   3. Owner/admin da org: definir default / desactivar → permitido.
--   4. Platform admin (has_role 'admin'): lê e gere tudo.
--   5. Segundo default na mesma org → viola o índice único parcial
--      organization_templates_one_default.
--   6. Org sem linhas: exportações idênticas ao pré-deploy
--      (resolver devolve o fallback — regressão zero).
-- =============================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.organization_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id)
                  ON DELETE CASCADE,
  template_key    TEXT NOT NULL,          -- chave do registry em código (executivo|editorial|cotacao|minimal)
  nome            TEXT NOT NULL,          -- rótulo comercial apresentado (ex.: "Modelo Corporativo ACME")
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  config          JSONB NOT NULL DEFAULT '{}',  -- reservado (Nível 2: layout por configuração)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. updated_at (trigger padrão do schema, já existente)
DROP TRIGGER IF EXISTS trg_organization_templates_updated_at ON public.organization_templates;
CREATE TRIGGER trg_organization_templates_updated_at
  BEFORE UPDATE ON public.organization_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Índices
-- no máximo 1 default por org:
CREATE UNIQUE INDEX IF NOT EXISTS organization_templates_one_default
  ON public.organization_templates (organization_id) WHERE is_default;
-- lookup do resolver (default activo):
CREATE INDEX IF NOT EXISTS organization_templates_org_active
  ON public.organization_templates (organization_id) WHERE is_active;

-- 4. RLS (padrão endurecido — NÃO copiar da pdf_templates dormente)
ALTER TABLE public.organization_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da org + platform admin
DROP POLICY IF EXISTS "org_templates_select_member" ON public.organization_templates;
CREATE POLICY "org_templates_select_member" ON public.organization_templates
  FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_org(organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- INSERT: owner/admin da org + platform admin
DROP POLICY IF EXISTS "org_templates_insert_admin" ON public.organization_templates;
CREATE POLICY "org_templates_insert_admin" ON public.organization_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- UPDATE: idem (USING + WITH CHECK — impede re-apontar a linha para outra org)
DROP POLICY IF EXISTS "org_templates_update_admin" ON public.organization_templates;
CREATE POLICY "org_templates_update_admin" ON public.organization_templates
  FOR UPDATE TO authenticated
  USING (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- DELETE: idem
DROP POLICY IF EXISTS "org_templates_delete_admin" ON public.organization_templates;
CREATE POLICY "org_templates_delete_admin" ON public.organization_templates
  FOR DELETE TO authenticated
  USING (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

COMMENT ON TABLE public.organization_templates IS
  'Associação organização→modelo PDF (registry em código). is_default = modelo aplicado nas exportações quando o utilizador não escolhe outro no selector. config JSONB reservado para o Nível 2 (layout por configuração). SEM CHECK em template_key: a validação é o lookup no registry; chave órfã degrada para fallback, nunca para erro.';
