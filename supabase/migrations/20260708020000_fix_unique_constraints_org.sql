-- =============================================
-- Migration: Fix unique constraints for org-scoped numbering
-- =============================================
-- BUG: proposals_numero_owner_unique é (owner_id, numero)
-- mas agora os números são por organization_id.
-- Dois membros da mesma org podiam criar o mesmo número.
--
-- FIX: Criar índice unique parcial por (organization_id, numero)
-- e manter (owner_id, numero) apenas para legacy sem org.

-- 1. Drop old constraint
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_numero_owner_unique;

-- 2. New partial unique index: org-scoped numbering
CREATE UNIQUE INDEX proposals_numero_org_unique
  ON public.proposals (organization_id, numero)
  WHERE organization_id IS NOT NULL;

-- 3. Legacy fallback: keep unique per owner for rows without org
CREATE UNIQUE INDEX proposals_numero_owner_unique
  ON public.proposals (owner_id, numero)
  WHERE organization_id IS NULL;

-- 4. Same for invoices (if constraint exists)
-- Check if there's a similar constraint on invoices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_numero_owner_unique'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_numero_owner_unique;
  END IF;
END $$;

-- 5. Invoice org-scoped unique
CREATE UNIQUE INDEX invoices_numero_org_unique
  ON public.invoices (organization_id, numero)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX invoices_numero_owner_unique
  ON public.invoices (owner_id, numero)
  WHERE organization_id IS NULL;