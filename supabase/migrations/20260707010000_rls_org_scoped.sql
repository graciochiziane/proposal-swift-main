-- =============================================
-- Migration: RLS org-scoped (multi-org safe)
-- Substitui user_org_id() por funções que recebem
-- o organization_id da row, garantindo que o RLS
-- valida pertença à org ESPECÍFICA da linha.
-- =============================================

-- 1. Nova função: verifica se o user é membro de uma org específica
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
  );
$$;

-- 2. Nova função: retorna o role do user numa org específica
CREATE OR REPLACE FUNCTION public.user_role_in_org(p_org_id UUID)
RETURNS public.org_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = p_org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================
-- 3. Recriar políticas de dados de negócio
-- =============================================

-- organizations
DROP POLICY IF EXISTS "org_select_member" ON public.organizations;
CREATE POLICY "org_select_member" ON public.organizations FOR SELECT TO authenticated
  USING (user_belongs_to_org(id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org_update_owner_admin" ON public.organizations;
CREATE POLICY "org_update_owner_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (
    (user_belongs_to_org(id) AND user_role_in_org(id) IN ('owner', 'admin'))
    OR public.has_role(auth.uid(), 'admin')
  );

-- organization_members
DROP POLICY IF EXISTS "om_select_member" ON public.organization_members;
CREATE POLICY "om_select_member" ON public.organization_members FOR SELECT TO authenticated
  USING (user_belongs_to_org(organization_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "om_manage_owner_admin" ON public.organization_members;
CREATE POLICY "om_manage_owner_admin" ON public.organization_members FOR ALL TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin'))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin'))
    OR public.has_role(auth.uid(), 'admin')
  );

-- organization_invitations
DROP POLICY IF EXISTS "oi_select_own" ON public.organization_invitations;
CREATE POLICY "oi_select_own" ON public.organization_invitations FOR SELECT TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin'))
    OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "oi_manage_owner_admin" ON public.organization_invitations;
CREATE POLICY "oi_manage_owner_admin" ON public.organization_invitations FOR ALL TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND user_role_in_org(organization_id) IN ('owner', 'admin'))
    OR public.has_role(auth.uid(), 'admin')
  );

-- clients
DROP POLICY IF EXISTS "clients_org_or_owner" ON public.clients;
CREATE POLICY "clients_org_or_owner" ON public.clients FOR ALL TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
  );

-- catalog_items
DROP POLICY IF EXISTS "catalog_org_or_owner" ON public.catalog_items;
CREATE POLICY "catalog_org_or_owner" ON public.catalog_items FOR ALL TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
  );

-- proposals
DROP POLICY IF EXISTS "proposals_select" ON public.proposals;
CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "proposals_insert" ON public.proposals;
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (
    (user_belongs_to_org(organization_id) AND has_org_role_min(auth.uid(), 'member'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "proposals_update" ON public.proposals;
CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "proposals_delete" ON public.proposals;
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND has_org_role_min(auth.uid(), 'admin'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- proposal_items (via parent proposal)
DROP POLICY IF EXISTS "pi_select" ON public.proposal_items;
DROP POLICY IF EXISTS "pi_modify" ON public.proposal_items;
CREATE POLICY "pi_select" ON public.proposal_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_items.proposal_id
    AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "pi_modify" ON public.proposal_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_items.proposal_id
    AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_items.proposal_id
    AND (user_belongs_to_org(p.organization_id) OR p.owner_id = auth.uid())
  ));

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (user_belongs_to_org(organization_id) AND has_org_role_min(auth.uid(), 'member'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
  USING (
    (user_belongs_to_org(organization_id) AND has_org_role_min(auth.uid(), 'admin'))
    OR (owner_id = auth.uid() AND NOT user_belongs_to_org(organization_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- profiles (already uses EXISTS from previous fix, but ensure consistency)
DROP POLICY IF EXISTS "profiles_select_org" ON public.profiles;
CREATE POLICY "profiles_select_org" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = profiles.id
        AND user_belongs_to_org(om.organization_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- proposta_ai
DROP POLICY IF EXISTS "pai_select" ON public.proposta_ai;
CREATE POLICY "pai_select" ON public.proposta_ai FOR SELECT TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "pai_modify" ON public.proposta_ai;
CREATE POLICY "pai_modify" ON public.proposta_ai FOR ALL TO authenticated
  USING (
    user_belongs_to_org(organization_id)
    OR user_id = auth.uid()
  )
  WITH CHECK (
    user_belongs_to_org(organization_id)
    OR user_id = auth.uid()
  );

-- invoice_items (via parent invoice)
DROP POLICY IF EXISTS ii_org_select ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_insert ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_update ON public.invoice_items;
DROP POLICY IF EXISTS ii_org_delete ON public.invoice_items;
CREATE POLICY ii_org_select ON public.invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
    AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY ii_org_insert ON public.invoice_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
    AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY ii_org_update ON public.invoice_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
    AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY ii_org_delete ON public.invoice_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
    AND (user_belongs_to_org(i.organization_id) OR i.owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')))
);

-- subscriptions (per-user, org-scoped check)
DROP POLICY IF EXISTS "subs_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_update_own" ON public.subscriptions;
CREATE POLICY "subs_select_own" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "subs_update_own" ON public.subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));