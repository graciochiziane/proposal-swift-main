-- =============================================
-- FIX: invoice_items RLS for multi-tenant
-- =============================================
-- Previous policies (ii_owner_*) only checked invoices.owner_id = auth.uid().
-- This broke multi-tenant: org members couldn't see/modify invoice_items
-- for invoices created by other org members.
--
-- New policies follow the same pattern as proposal_items:
-- check via the parent invoices table for org membership OR owner match.

DROP POLICY IF EXISTS ii_owner_select ON public.invoice_items;
DROP POLICY IF EXISTS ii_owner_insert ON public.invoice_items;
DROP POLICY IF EXISTS ii_owner_update ON public.invoice_items;
DROP POLICY IF EXISTS ii_owner_delete ON public.invoice_items;

CREATE POLICY ii_org_select ON public.invoice_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
      AND (i.organization_id = user_org_id(auth.uid()) OR i.owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY ii_org_insert ON public.invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
      AND (i.organization_id = user_org_id(auth.uid()) OR i.owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY ii_org_update ON public.invoice_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
      AND (i.organization_id = user_org_id(auth.uid()) OR i.owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY ii_org_delete ON public.invoice_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
      AND (i.organization_id = user_org_id(auth.uid()) OR i.owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)))
  );