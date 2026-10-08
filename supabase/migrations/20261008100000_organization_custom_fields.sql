-- =============================================
-- organization_custom_fields — campos personalizados
-- por organização (dados adicionais do tenant)
--
-- CONTEXTO: templates PDF personalizados (ex.: réplica Tala
-- Service) precisam de dados que não existem no modelo
-- estruturado (instruções de pagamento, métodos aceites,
-- contacto de pagamento, cidade/país, slogan, …). Em vez de
-- colunas novas em organizations para cada informação, uma
-- tabela genérica key→value por org.
--
-- CONSUMO (mapeamento conceptual dos templates):
--   organization.custom_fields.<field_key>
--   ex.: organization.custom_fields.nib
--        organization.custom_fields.payment_instructions
--
-- O QUE FAZ:
--   1. Tabela org→campo (field_key técnica estável + label
--      apresentável + tipo + valor + ordem).
--   2. UNIQUE (organization_id, field_key): mesma chave
--      rejeitada NA MESMA org; a mesma chave pode existir em
--      orgs diferentes (isolamento multi-tenant por linha).
--   3. CHECK no formato do field_key (^[a-z][a-z0-9_]{0,63}$)
--      e no domínio de field_type.
--   4. RLS no padrão ENDURECIDO de organization_templates:
--      SELECT membros; escrita owner/admin da org ou platform
--      admin.
--
-- DECISÕES:
--   - SEM seed: tabela nasce vazia (org sem campos = zero
--     impacto nos templates — blocos ocultam-se).
--   - value TEXT '' (não NULL): simplifica o NOT NULL e o
--     mapeamento (linha existe mas vazia → oculta).
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.organization_custom_fields CASCADE;
--
-- VALIDAÇÃO EM STAGING (após aplicar):
--   1. Membro da org A: SELECT → só vê linhas da org A (RLS).
--   2. Membro/viewer: INSERT/UPDATE/DELETE → RLS deny.
--   3. Owner/admin: criar/activar/remover campo → permitido.
--   4. Platform admin: gere tudo.
--   5. Segunda linha com a mesma field_key na mesma org →
--      viola organization_custom_fields_org_key.
--   6. field_key = '9abc' ou 'Campo Com Espaços' → viola o
--      CHECK organization_custom_fields_field_key_check.
--   7. field_type = 'fórmula' → viola o CHECK de domínio.
-- =============================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.organization_custom_fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id)
                  ON DELETE CASCADE,
  field_key       TEXT NOT NULL,
  label           TEXT NOT NULL,
  field_type      TEXT NOT NULL DEFAULT 'texto',
  value           TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_custom_fields_org_key
    UNIQUE (organization_id, field_key),
  CONSTRAINT organization_custom_fields_field_key_check
    CHECK (field_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT organization_custom_fields_field_type_check
    CHECK (field_type IN ('texto','numero','telefone','email','url','data','multilinha'))
);

-- 2. updated_at (trigger padrão do schema, já existente)
DROP TRIGGER IF EXISTS trg_organization_custom_fields_updated_at ON public.organization_custom_fields;
CREATE TRIGGER trg_organization_custom_fields_updated_at
  BEFORE UPDATE ON public.organization_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Índices
-- lookup do resolver de templates (campos activos da org):
CREATE INDEX IF NOT EXISTS organization_custom_fields_org_active
  ON public.organization_custom_fields (organization_id) WHERE is_active;
-- ordenação canónica da lista de gestão:
CREATE INDEX IF NOT EXISTS organization_custom_fields_org_order
  ON public.organization_custom_fields (organization_id, display_order);

-- 4. RLS (padrão endurecido — igual a organization_templates)
ALTER TABLE public.organization_custom_fields ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da org + platform admin
DROP POLICY IF EXISTS "org_cf_select_member" ON public.organization_custom_fields;
CREATE POLICY "org_cf_select_member" ON public.organization_custom_fields
  FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_org(organization_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- INSERT: owner/admin da org + platform admin
DROP POLICY IF EXISTS "org_cf_insert_admin" ON public.organization_custom_fields;
CREATE POLICY "org_cf_insert_admin" ON public.organization_custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- UPDATE: idem (USING + WITH CHECK — impede re-apontar a linha para outra org)
DROP POLICY IF EXISTS "org_cf_update_admin" ON public.organization_custom_fields;
CREATE POLICY "org_cf_update_admin" ON public.organization_custom_fields
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
DROP POLICY IF EXISTS "org_cf_delete_admin" ON public.organization_custom_fields;
CREATE POLICY "org_cf_delete_admin" ON public.organization_custom_fields
  FOR DELETE TO authenticated
  USING (
    (public.user_belongs_to_org(organization_id)
     AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

COMMENT ON TABLE public.organization_custom_fields IS
  'Campos personalizados por organização (key→value tipado). field_key é a chave técnica estável para consumo pelos templates PDF (organization.custom_fields.<field_key>); label é apresentável e mutável. UNIQUE (organization_id, field_key): duplicada na mesma org rejeitada, mesma chave em orgs diferentes permitida. Escrita restrita a owner/admin (RLS endurecida).';
