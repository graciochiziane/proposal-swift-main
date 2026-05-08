-- ============================================================
-- ProposalJá — Admin Metrics: user_activity table + last_seen_at
-- Execute this migration in Supabase SQL Editor
-- ============================================================

-- 1. Tabela de actividade dos utilizadores
-- Regista cada visita a uma página (com dedup por sessão de 5 min)
CREATE TABLE IF NOT EXISTS public.user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas por data
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at
  ON public.user_activity (created_at DESC);

-- Índice para consultas de utilizadores únicos por dia
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date
  ON public.user_activity (user_id, created_at DESC);

-- RLS: só o owner pode ver a sua actividade (admin vê tudo via service role)
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own activity"
  ON public.user_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own activity"
  ON public.user_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin pode ver toda a actividade (via bypass RLS no service role, ou policy)
CREATE POLICY "Admin sees all activity"
  ON public.user_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- 2. Adicionar last_seen_at à tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Índice para "who is online"
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles (last_seen_at DESC);


-- 3. Função para limpar actividade antiga (correr mensalmente via cron ou manual)
-- Mantém apenas os últimos 90 dias de actividade
CREATE OR REPLACE FUNCTION public.cleanup_old_activity()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_activity
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;
