-- ============================================================
-- ProposalJa — Proposta IA: tabela para armazenar propostas geradas por IA
-- Execute this migration in Supabase SQL Editor
-- ============================================================

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
  input_json jsonb,      -- campos preenchidos pelo utilizador
  output_json jsonb,      -- output do LLM (JSON por seccao)
  edited_json jsonb,      -- versao editada pelo utilizador

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

CREATE POLICY "Users manage own proposta_ai"
  ON public.proposta_ai FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin reads all proposta_ai"
  ON public.proposta_ai FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
