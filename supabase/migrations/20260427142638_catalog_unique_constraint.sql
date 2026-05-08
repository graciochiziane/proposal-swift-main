-- Adicionar restrição UNIQUE para permitir o UPSERT atómico por nome para cada utilizador
ALTER TABLE public.catalog_items
ADD CONSTRAINT catalog_items_owner_nome_unique UNIQUE (owner_id, nome);
