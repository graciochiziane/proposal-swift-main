-- =============================================
-- CATALOG_ITEMS: Adicionar UNIQUE constraint
-- =============================================
-- Necessária para o upsert atómico do CatalogService.
-- Garante que o mesmo utilizador não pode ter itens
-- duplicados no catálogo (mesmo nome).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalog_items_owner_nome_unique'
  ) THEN
    ALTER TABLE public.catalog_items
    ADD CONSTRAINT catalog_items_owner_nome_unique
    UNIQUE (owner_id, nome);
  END IF;
END $$;
