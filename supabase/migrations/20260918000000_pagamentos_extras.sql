-- ============================================================
-- Migration: pagamentos_extras — formas de pagamento dinâmicas
-- Data: 2026-09-18
-- Item: permitir que o dono adicione formas de pagamento não
--       hardcoded (ex.: segunda conta M-Pesa, PayPal, etc.)
--       — pedido aprovado pelo utilizador.
--
-- Estratégia: ADIÇÃO PURA. Nada do que existe é alterado ou
-- removido: dados_bancarios e mobile_money ficam intocados e
-- continuam a ser a fonte das formas fixas (Banco, M-Pesa,
-- e-Mola, m-Kesh); os extras aparecem DEPOIS das fixas em todos
-- os modelos PDF e na UI das Configurações.
--
-- Nova coluna em profiles (JSONB, NOT NULL, default '[]'):
--   pagamentos_extras = [
--     { "rotulo": "M-Pesa (Conta 2)", "valor": "84 123 4567", "ativo": true },
--     { "rotulo": "PayPal",            "valor": "xpto@mail.com", "ativo": false }
--   ]
--
-- Segurança: SEM políticas novas — a coluna herda o RLS já
-- existente de profiles (profiles_select_own_or_admin /
-- profiles_update_own / profiles_update_admin), ou seja, só o
-- próprio dono (ou admin da plataforma) lê e escreve estes dados.
--
-- ROLLBACK (documentado, reversível):
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS pagamentos_extras;
--   -- Perda de dados limitada aos extras criados; as formas fixas
--   -- (dados_bancarios / mobile_money) permanecem intactas.
--
-- Validação em staging (antes de produção):
--   1. Após aplicar: coluna existe com default '[]' em todas as linhas
--      (SELECT id, pagamentos_extras FROM public.profiles LIMIT 5;)
--   2. UPDATE do próprio profile com extras → persiste após re-login
--   3. Outro utilizador da mesma org sem permissão → negado pelo RLS existente
--   4. PDF gerado nos 3 modelos → extras visíveis DEPOIS das formas fixas
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pagamentos_extras JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.pagamentos_extras IS
  'Formas de pagamento adicionais criadas pelo dono: [{rotulo: text, valor: text, ativo: bool}]';
