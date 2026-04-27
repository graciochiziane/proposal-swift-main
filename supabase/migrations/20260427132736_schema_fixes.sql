-- =============================================
-- PROPOSAL SWIFT — SCHEMA FIXES MIGRATION
-- =============================================
-- Data: Abril 2026
-- NOTA: Esta migração é INCREMENTAL. Não modifica
-- ficheiros SQL passados. Aplica-se no topo do schema actual.
-- =============================================


-- =============================================
-- 1. PROPOSAL_ITEMS: Adicionar updated_at + trigger
-- =============================================
ALTER TABLE public.proposal_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_proposal_items_updated_at ON public.proposal_items;
CREATE TRIGGER trg_proposal_items_updated_at
BEFORE UPDATE ON public.proposal_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================
-- 2. GERAÇÃO AUTOMÁTICA DE NÚMERO DE PROPOSTA
-- =============================================
-- Formato: PROP-YYYYMM-0001 (sequencial por owner por mês)
-- O prefixo 'a_' garante que este trigger executa antes do
-- trg_enforce_proposal_limit (ordem alfabética no PostgreSQL).

CREATE OR REPLACE FUNCTION public.set_proposal_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero TEXT;
  v_seq    INT;
BEGIN
  -- Se já tem número (inserido manualmente), não mexer
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Contar propostas do mesmo owner no mesmo mês/ano
  SELECT COUNT(*)
    INTO v_seq
  FROM public.proposals
  WHERE owner_id = NEW.owner_id
    AND to_char(data, 'YYYY-MM') = to_char(NEW.data, 'YYYY-MM');

  -- Gerar número no formato PROP-202604-0001
  v_numero := 'PROP-'
    || to_char(NEW.data, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_set_proposal_numero ON public.proposals;
CREATE TRIGGER a_set_proposal_numero
BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_proposal_numero();


-- =============================================
-- 3. BACKFILL: Atribuir números a propostas sem número
-- =============================================
-- Usa ROW_NUMBER() em vez de COUNT dentro de loop para evitar
-- bug de mutação durante iteração (COUNT muda a cada UPDATE).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      id,
      owner_id,
      data,
      ROW_NUMBER() OVER (
        PARTITION BY owner_id, to_char(data, 'YYYY-MM')
        ORDER BY created_at, id
      ) AS seq_num
    FROM public.proposals
    WHERE numero IS NULL
      AND data IS NOT NULL
    ORDER BY owner_id, data, created_at
  LOOP
    UPDATE public.proposals
    SET numero = 'PROP-'
      || to_char(r.data, 'YYYYMM')
      || '-'
      || lpad(r.seq_num::text, 4, '0')
    WHERE id = r.id;

    RAISE NOTICE 'Backfill: proposta % -> %', r.id,
      'PROP-' || to_char(r.data, 'YYYYMM') || '-' || lpad(r.seq_num::text, 4, '0');
  END LOOP;
END $$;


-- =============================================
-- 4. TORNAR NUMERO NOT NULL + UNIQUE em proposals
-- =============================================

-- Guarda: detectar duplicados manuais antes de aplicar UNIQUE
DO $$
DECLARE
  v_dupes INT;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT (owner_id, numero))
    INTO v_dupes
  FROM public.proposals
  WHERE numero IS NOT NULL;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Existem % propostas com numeros duplicados. Resolve antes de aplicar UNIQUE.', v_dupes;
  END IF;
END $$;

ALTER TABLE public.proposals ALTER COLUMN numero SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposals_numero_owner_unique'
  ) THEN
    ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_numero_owner_unique
    UNIQUE (owner_id, numero);
  END IF;
END $$;


-- =============================================
-- 5. ÍNDICES DE PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_ordem
  ON public.proposal_items(proposal_id, ordem);

CREATE INDEX IF NOT EXISTS idx_proposals_owner_status
  ON public.proposals(owner_id, status);

CREATE INDEX IF NOT EXISTS idx_proposals_owner_data
  ON public.proposals(owner_id, data DESC);


-- =============================================
-- 6. ADMIN AUDIT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action          TEXT        NOT NULL,
  target_table    TEXT        NOT NULL,
  target_id       UUID        NOT NULL,
  target_owner_id UUID,
  target_snapshot JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin
  ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_log(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.admin_audit_log
FOR SELECT TO authenticated
USING (admin_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_log_insert" ON public.admin_audit_log
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- =============================================
-- 7. TRIGGER: Log automático de eliminações por admin
-- =============================================
CREATE OR REPLACE FUNCTION public.log_admin_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot     JSONB;
  v_action       TEXT;
  v_owner_id     UUID;
BEGIN
  -- Apenas registar se quem elimina é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN OLD;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'clients' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_client';
      v_snapshot := jsonb_build_object(
        'nome', OLD.nome,
        'email', OLD.email,
        'telefone', OLD.telefone,
        'empresa', OLD.empresa
      );

    WHEN 'proposals' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_proposal';
      v_snapshot := jsonb_build_object(
        'numero', OLD.numero,
        'client_id', OLD.client_id,
        'total', OLD.total,
        'status', OLD.status
      );

    WHEN 'catalog_items' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_catalog_item';
      v_snapshot := jsonb_build_object(
        'nome', OLD.nome,
        'preco_unitario', OLD.preco_unitario
      );

    WHEN 'invoices' THEN
      v_owner_id := OLD.owner_id;
      v_action   := 'delete_invoice';
      v_snapshot := jsonb_build_object(
        'numero', OLD.numero,
        'total', OLD.total,
        'status', OLD.status
      );

    ELSE
      RETURN OLD;
  END CASE;

  INSERT INTO public.admin_audit_log
    (admin_id, action, target_table, target_id, target_owner_id, target_snapshot)
  VALUES
    (auth.uid(), v_action, TG_TABLE_NAME, OLD.id, v_owner_id, v_snapshot);

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_clients_delete ON public.clients;
CREATE TRIGGER trg_audit_clients_delete
BEFORE DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_proposals_delete ON public.proposals;
CREATE TRIGGER trg_audit_proposals_delete
BEFORE DELETE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_catalog_delete ON public.catalog_items;
CREATE TRIGGER trg_audit_catalog_delete
BEFORE DELETE ON public.catalog_items
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();

DROP TRIGGER IF EXISTS trg_audit_invoices_delete ON public.invoices;
CREATE TRIGGER trg_audit_invoices_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_admin_deletion();


-- =============================================
-- 8. NOTA SOBRE RLS DE ADMIN DELETE
-- =============================================
-- As políticas 'FOR ALL' existentes (clients_owner_all,
-- proposals_owner_all, catalog_owner_all, invoices_owner_all)
-- já permitem admin DELETE via:
--   USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
-- O audit log (secções 6-7) é a mitigação para accountability.
-- Não é necessário alterar políticas existentes.


-- =============================================
-- 9. GERAÇÃO AUTOMÁTICA DE NÚMERO DE FATURA (futuro)
-- =============================================
CREATE OR REPLACE FUNCTION public.set_invoice_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero TEXT;
  v_seq    INT;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_seq
  FROM public.invoices
  WHERE owner_id = NEW.owner_id
    AND to_char(data_emissao, 'YYYY-MM') = to_char(NEW.data_emissao, 'YYYY-MM');

  v_numero := 'FAT-'
    || to_char(NEW.data_emissao, 'YYYYMM')
    || '-'
    || lpad((v_seq + 1)::text, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_set_invoice_numero ON public.invoices;
CREATE TRIGGER a_set_invoice_numero
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_numero();


-- =============================================
-- 10. SUPABASE STORAGE: Bucket para Logotipos
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS do bucket: cada user gere apenas a sua pasta logos/{user_id}/
CREATE POLICY "logos_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "logos_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "logos_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "logos_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "logos_admin_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'logos'
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin também pode apagar logos (consistência com RLS de dados)
CREATE POLICY "logos_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND public.has_role(auth.uid(), 'admin')
);


-- =============================================
-- FIM DA MIGRAÇÃO
-- =============================================
