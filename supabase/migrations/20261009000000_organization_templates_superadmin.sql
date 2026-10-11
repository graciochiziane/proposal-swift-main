-- =============================================
-- organization_templates — escrita apenas pelo SUPERADMIN
-- (plataforma). Requisito do cliente: "Somente o superadmin
-- pode atribuir templates."
--
-- CONTEXTO: as policies originais (20261007000000) permitiam
-- INSERT/UPDATE/DELETE ao owner/admin DA ORG — um tenant podia
-- auto-atribuir-se modelos restritos (ex.: talaService) via API,
-- contornando o catálogo. A UI nunca expôs essa escrita aos
-- tenants (só o TenantDetailPage do platform admin), portanto
-- apertar a RLS não regressa nenhuma UX.
--
-- O QUE FAZ:
--   1. Substitui as policies de INSERT/UPDATE/DELETE para exigir
--      EXCLUSIVAMENTE public.has_role('admin') (platform admin).
--   2. SELECT mantém-se: membros da org + platform admin —
--      necessário para os seletores filtrarem o catálogo pelas
--      linhas atribuídas à própria org.
--
-- EFEITOS:
--   - Owner/admin/member de org: SÓ LEITURA (dos seus próprios).
--   - Platform admin: gestão completa (atribuir, default, ligar/
--     desligar, apagar) — exactamente o que o TenantTemplatesTab
--     e a nova aba Modelos do Admin fazem.
--
-- VALIDAÇÃO EM STAGING (após aplicar):
--   1. Owner de org A: INSERT em organization_templates → RLS deny.
--   2. Owner de org A: UPDATE/DELETE das próprias linhas → RLS deny.
--   3. Platform admin: INSERT/UPDATE/DELETE → permitido.
--   4. Membro da org A: SELECT → vê só as linhas da org A.
--
-- ROLLBACK (restaurar escrita aos org owners):
--   Reaplicar as policies INSERT/UPDATE/DELETE do ficheiro
--   20261007000000_organization_templates.sql.
-- =============================================

-- INSERT: apenas platform admin (superadmin)
DROP POLICY IF EXISTS "org_templates_insert_admin" ON public.organization_templates;
CREATE POLICY "org_templates_insert_admin" ON public.organization_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- UPDATE: apenas platform admin (USING + WITH CHECK idênticos)
DROP POLICY IF EXISTS "org_templates_update_admin" ON public.organization_templates;
CREATE POLICY "org_templates_update_admin" ON public.organization_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- DELETE: apenas platform admin
DROP POLICY IF EXISTS "org_templates_delete_admin" ON public.organization_templates;
CREATE POLICY "org_templates_delete_admin" ON public.organization_templates
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

COMMENT ON POLICY "org_templates_insert_admin" ON public.organization_templates IS
  'Apenas platform admin (superadmin) pode atribuir modelos aos tenants.';
COMMENT ON POLICY "org_templates_update_admin" ON public.organization_templates IS
  'Apenas platform admin (superadmin) pode alterar linhas (default, is_active).';
COMMENT ON POLICY "org_templates_delete_admin" ON public.organization_templates IS
  'Apenas platform admin (superadmin) pode remover atribuições.';
