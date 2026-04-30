# Proposal Swift — Estado do Projecto

## Tecnologia
- React 18 + Vite 5 + TypeScript + Supabase
- Tailwind CSS + lucide-react icons
- Deploy: Vercel (https://propostaja2.vercel.app)
- Supabase: https://ytbgfrbhyclnfdftmnoy.supabase.co
- Admin: graciochiziane@gmail.com

## Módulos Implementados

### Autenticação
- Login/Registro via Supabase Auth
- Password reset (forgot/reset)
- RLS em todas as tabelas
- useAuth hook + ProtectedRoute

### Perfil (profileService.ts)
- getProfile com signed URLs (bucket privado logos)
- uploadLogo (limpa ficheiro antigo antes)
- removeLogo (delete do storage + null no DB)
- updateProfile

### Clientes (clienteService.ts)
- CRUD completo
- || null para strings vazias

### Catálogo (catalogService.ts)
- CRUD com upsert onConflict (owner_id, nome)
- UNIQUE constraint obrigatória

### Propostas (propostaService.ts)
- getPropostas (join com clients)
- criarProposta (snapshot + insert proposta + insert items com rollback)
- atualizarProposta (delete+insert items)
- removerProposta, duplicarProposta, atualizarStatus
- Trigger auto-numeração PROP-YYYYMM-NNNN
- cliente_snapshot JSONB
- NAO envia: validade, descricao, owner_id nos items

### Facturação (faturaService.ts)
- converterPropostaEmFactura (cria factura + copia items com rollback)
- getFaturas, getFaturaById, getFaturasPorProposta
- atualizarStatusFatura
- Trigger auto-numeração FAT-YYYYMM-NNNN

### Páginas
- Dashboard (stats + propostas recentes)
- Propostas (gestão: filtros, pesquisa, status, duplicar, eliminar)
- CriarProposta (formulário async com catalog autocomplete)
- ResumoProposta (detalhes + converter em factura + histórico)
- Clientes (CRUD)
- Catálogo (CRUD + busca)
- Configuracoes (perfil + logo upload/remove)
- Admin, Auth, ForgotPassword, ResetPassword, NotFound

### PDF Templates (src/lib/pdf/)
- classic.ts, modern.ts, executive.ts
- Mostram sempre PROPOSTA (sem logica FATURA)
- Usam proposta.numero (PROP-XXXX)

## Enums do Banco
- proposal_status: rascunho, enviada, aceite, rejeitada
- invoice_status: pendente, paga, vencida, anulada
- desconto_tipo: percentual, valor
- plan_tier: free, pro, business
- app_role: admin, user
- subscription_status: active, canceled, past_due

## Tabelas do Banco
- profiles, user_roles, subscriptions, plan_limits
- clients, catalog_items
- proposals, proposal_items
- invoices, invoice_items
- admin_audit_log

## Regras Criticas
- proposal_items: NAO tem descricao, NAO tem owner_id
- proposals: NAO tem coluna validade
- Bucket logos: PRIVADO (usar createSignedUrl, nunca getPublicUrl)
- Import Supabase: @/integrations/supabase/client (NAO @/lib/supabase)
- Ficheiros eliminados: src/lib/storage.ts, src/lib/supabase.ts
- Tipos gerados: src/integrations/supabase/types.ts (regenerar após migrations)
- DescontoTipo: percentual | valor (NAO fixo)

## Deploy
- Vercel via GitHub (branch main)
- vercel.json com SPA rewrites na raiz
- Supabase Site URL: https://propostaja2.vercel.app

## Pendente
- TanStack Query (instalado mas nao usado)
- Vitest testes unitários
- Página dedicada de facturas
- Domínio próprio
- Refactoring: remover as any residuais

## Fortificação (Abril 2026)

### Remoção de `as any` (14 instâncias)
- **propostaService.ts**: 11 substituídos por `ProposalRow`, `ProposalInsert`, `ProposalItemRow`, `ProposalItemInsert`, `ProposalStatus`, `ProposalWithClient`
- **profileService.ts**: 2 substituídos por `DonoProposta['dadosBancarios']` e `DonoProposta['mobileMoney']`
- **faturaService.ts**: 1 substituído por `ProposalItemRow`

### Bug fixes
- **Propostas.tsx**: Corrigido double call de `getPropostas()` (era chamado 2× em `Promise.all`)
- **useAuth.tsx**: Adicionado redirecionamento para `/auth` quando sessão expira (`SIGNED_OUT` event)
- **tsconfig.app.json**: Removido `vitest/globals` (pertence a config de testes, não da app)

### Testes unitários
- **calculos.test.ts**: 5 testes criados com Vitest (subtotal, desconto percentual, desconto fixo, total com IVA, edge cases)
- Todos os testes passam ✅

---

Depois disto, a fortificação está 100% completa. O ProposalJá está consideravelmente mais robusto:

- Zero `as any` em services
- Zero erros TypeScript (`tsc --noEmit` limpo)
- 5 testes unitários passando
- Session expiry tratado correctamente
- Logo fallback já existia