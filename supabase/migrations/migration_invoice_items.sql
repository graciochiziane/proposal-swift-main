-- ============================================================
-- MIGRAÇÃO: Facturação (Abordagem A)
-- 0) Reverter enum proposal_status (remover faturada)
-- 1) Criar tabela invoice_items + RLS + triggers
-- ============================================================

-- PASSO 0: Reverter enum proposal_status (remover 'faturada')
DO $$
BEGIN
  -- Se a coluna já for do tipo enum e quisermos remover um valor, temos de recriar
  ALTER TYPE proposal_status RENAME TO proposal_status_old;
  CREATE TYPE proposal_status AS ENUM ('rascunho', 'enviada', 'aceite', 'rejeitada');
  ALTER TABLE proposals ALTER COLUMN status TYPE proposal_status 
    USING status::text::proposal_status;
  DROP TYPE proposal_status_old;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN 
    -- Se falhar porque o tipo não existe ou 'faturada' já não está lá, ignoramos
    NULL;
END $$;

-- PASSO 1: Criar tabela invoice_items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id);

-- RLS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Owner policies (via invoice ownership)
CREATE POLICY "ii_owner_select" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
  );

CREATE POLICY "ii_owner_insert" ON invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
  );

CREATE POLICY "ii_owner_update" ON invoice_items
  FOR UPDATE USING (
    invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
  );

CREATE POLICY "ii_owner_delete" ON invoice_items
  FOR DELETE USING (
    invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
  );

-- Admin policies
CREATE POLICY "ii_admin_all" ON invoice_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Trigger: auto updated_at
CREATE OR REPLACE FUNCTION set_invoice_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_items_updated_at ON invoice_items;
CREATE TRIGGER trg_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION set_invoice_items_updated_at();

-- Confirmar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoice_items'
ORDER BY ordinal_position;
