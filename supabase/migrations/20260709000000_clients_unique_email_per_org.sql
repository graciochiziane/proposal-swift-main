-- =============================================
-- Ponto A: Unique index parcial em clients(organization_id, email)
-- Impede clientes duplicados (mesmo email) dentro da mesma org.
-- Ignora emails vazios e NULL — permite múltiplos clientes sem email.
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_org_unique
  ON public.clients (organization_id, email)
  WHERE organization_id IS NOT NULL
    AND email IS NOT NULL
    AND email != '';

-- Nota: clientes legacy sem org (organization_id IS NULL) ficam de fora.
-- Se existissem, teríamos um index fallback, mas a query confirmou 0 rows com NULL org_id.