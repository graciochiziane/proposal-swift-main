-- ============================================================
-- ProposalJa — IA Rate Limiting
-- Add geracoes_ia_mes to plan_limits table
-- Execute this migration in Supabase SQL Editor
-- ============================================================

-- Add column for IA generation limit per plan
ALTER TABLE public.plan_limits
ADD COLUMN IF NOT EXISTS geracoes_ia_mes INT NOT NULL DEFAULT 3;

-- Set limits per plan
UPDATE public.plan_limits SET geracoes_ia_mes = 3 WHERE plano = 'free';
UPDATE public.plan_limits SET geracoes_ia_mes = 50 WHERE plano = 'pro';
UPDATE public.plan_limits SET geracoes_ia_mes = 2147483647 WHERE plano = 'business';

-- Make plan_limits readable by authenticated users (already exists but safe to re-run)
DO $$ BEGIN
  CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Function: count_ia_generations_this_month(user_id)
-- Returns how many IA proposals the user generated this month
-- ============================================================
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

-- ============================================================
-- Function: get_ia_limit(user_id)
-- Returns the IA generation limit for the user's plan
-- ============================================================
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
