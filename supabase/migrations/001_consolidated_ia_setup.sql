-- ============================================================
-- ProposalJa — CONSOLIDATED: IA + Invoice Items + Admin Metrics
-- Execute este ficheiro INTEIRO no Supabase SQL Editor (uma vez).
-- Todas as operacoes sao idempotentes (seguro para re-executar).
-- ============================================================
-- Ordem de execucao:
--   1. proposta_ai (tabela + RLS + indices)
--   2. ia_rate_limit (coluna em plan_limits + funcoes)
--   3. admin_metrics (user_activity + profiles.last_seen_at)
--   4. invoice_items (tabela + RLS + triggers)
-- ============================================================


-- ============================================================
-- 1. PROPOSTA IA — tabela para propostas geradas por IA
-- ============================================================
-- Dependencias: proposals (tabela original ja existente)

CREATE TABLE IF NOT EXISTS public.proposta_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referencia text,

  -- Configuracao da geracao
  mode text NOT NULL DEFAULT 'rapido' CHECK (mode IN ('rapido', 'assertivo')),
  tone text NOT NULL DEFAULT 'formal' CHECK (tone IN ('formal', 'persuasivo', 'tecnico', 'consultivo')),
  sector text,

  -- Dados
  input_json jsonb,
  output_json jsonb,
  edited_json jsonb,

  -- Metadata
  modelo text DEFAULT 'gpt-4o-mini',
  tokens_usados integer DEFAULT 0,
  custo_usd numeric(10,6) DEFAULT 0,
  gerado_em timestamptz,
  exportado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_proposta_ai_user ON public.proposta_ai(user_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_cotacao ON public.proposta_ai(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_proposta_ai_created ON public.proposta_ai(created_at DESC);

-- RLS
ALTER TABLE public.proposta_ai ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own proposta_ai"
    ON public.proposta_ai FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin reads all proposta_ai"
    ON public.proposta_ai FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 2. IA RATE LIMITING — coluna em plan_limits + funcoes
-- ============================================================
-- Dependencias: proposta_ai (acima), plan_limits, profiles (originais)

-- 2a. Adicionar coluna geracoes_ia_mes
ALTER TABLE public.plan_limits
ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 3;

-- 2b. Definir limites por plano
UPDATE public.plan_limits SET geracoes_ia_mes = 3 WHERE plano = 'free';
UPDATE public.plan_limits SET geracoes_ia_mes = 50 WHERE plano = 'pro';
UPDATE public.plan_limits SET geracoes_ia_mes = 2147483647 WHERE plano = 'business';

-- 2c. Policy plan_limits_read (ja existe na migration original, idempotente)
DO $$ BEGIN
  CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2d. Funcao: contar geracoes IA este mes
CREATE OR REPLACE FUNCTION public.count_ia_generations_this_month(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM public.proposta_ai
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now())
$$;

-- 2e. Funcao: obter limite do plano do utilizador
CREATE OR REPLACE FUNCTION public.get_ia_limit(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT pl.geracoes_ia_mes
  FROM public.profiles p
  JOIN public.plan_limits pl ON pl.plano = p.plano
  WHERE p.id = p_user_id
$$;


-- ============================================================
-- 3. ADMIN METRICS — user_activity + profiles.last_seen_at
-- ============================================================
-- Dependencias: user_roles, profiles (originais)

-- 3a. Tabela de actividade dos utilizadores
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at
  ON public.user_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date
  ON public.user_activity (user_id, created_at DESC);

-- RLS
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users see own activity"
    ON public.user_activity FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own activity"
    ON public.user_activity FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin sees all activity"
    ON public.user_activity FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3b. Adicionar last_seen_at a profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen_at DESC);

-- 3c. Funcao de limpeza (correr manualmente quando necessario)
CREATE OR REPLACE FUNCTION public.cleanup_old_activity()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_activity
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. INVOICE ITEMS — tabela para itens de factura
-- ============================================================
-- Dependencias: invoices (tabela original ja existente)

-- 4a. Tabela invoice_items
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

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id);

-- RLS
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ii_owner_select" ON invoice_items
    FOR SELECT USING (
      invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_insert" ON invoice_items
    FOR INSERT WITH CHECK (
      invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_update" ON invoice_items
    FOR UPDATE USING (
      invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_owner_delete" ON invoice_items
    FOR DELETE USING (
      invoice_id IN (SELECT id FROM invoices WHERE owner_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ii_admin_all" ON invoice_items
    FOR ALL USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4b. Trigger auto updated_at
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


-- ============================================================
-- VERIFICACAO FINAL — confirmar que tudo foi criado
-- ============================================================
SELECT 'proposta_ai' AS tabela,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'proposta_ai') AS colunas,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'proposta_ai') AS indices
UNION ALL
SELECT 'invoice_items',
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'invoice_items'),
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'invoice_items')
UNION ALL
SELECT 'user_activity',
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user_activity'),
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'user_activity')
UNION ALL
SELECT 'plan_limits (geracoes_ia_mes)',
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'plan_limits' AND column_name = 'geracoes_ia_mes'),
  0
UNION ALL
SELECT 'profiles (last_seen_at)',
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen_at'),
  0;
