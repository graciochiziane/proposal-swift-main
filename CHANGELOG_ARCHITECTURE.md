# CHANGELOG_ARCHITECTURE.md
## PropostaJá — Registo Vivo de Decisões e Mudanças Arquitecturais

> **Fonte única de verdade** para a evolução arquitectural do PropostaJá.
> Este ficheiro conecta todas as outras docs (PROJETO_STATUS, PLAN_MULTI_USER, AUDITORIA_*, ARCHITECTURE_BASELINE) e mantém-se actualizado a cada mudança estrutural.
> **Obrigatório** ler antes de qualquer alteração estrutural. **Obrigatório** actualizar após qualquer alteração estrutural.

---

## 0. Metadados

| Campo | Valor |
|---|---|
| Versão do documento | 1.0 |
| Data de criação | 2026-08-13 |
| Última actualização | 2026-08-13 |
| Branch actual | `feature/multi-user-hierarchy` |
| HEAD commit | `73af970` |
| Total de commits | 118 |
| Branch de backup | `backup/pre-audit-fixes-2026-08-13` |
| Tag de backup | `pre-audit-fixes-2026-08-13` |
| Audit base | `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` (60 findings) |
| Skill ativa | `proposaja-engineering` (em `/home/z/my-project/skills/proposaja-engineering/`) |

---

## 1. Como Usar Este Ficheiro

### Para agentes de IA (antes de alterar código)

1. **Ler a secção 3 (Baseline Actual)** — confirma que a tua compreensão do projecto está actualizada
2. **Ler a secção 5 (Mudanças Pendentes)** — verifica se a tua tarefa já está planeada
3. **Ler a secção 4 (Histórico)** — evita repetir erros do passado
4. **Ler a secção 6 (ADRs Activas)** — não violar decisões registadas

### Para agentes de IA (depois de alterar código)

1. **Adicionar entrada na secção 4 (Histórico)** com template da secção 8
2. **Actualizar a secção 3 (Baseline)** se algo mudou (nova tabela, novo service, etc.)
3. **Mover item na secção 5** de "Pendente" para "Concluído" se aplicável
4. **Adicionar ADR** na secção 6 se foi uma decisão arquitectural significativa

### Para humanos

- **Onboarding:** ler secções 2 → 3 → 6 (em 10 minutos compreende o estado do projecto)
- **Diagnóstico:** ler secção 4 (últimas 5 entradas) + secção 5 (pendentes)
- **Auditoria:** comparar secção 3 com o código real para detectar drift

### Quando actualizar

**Sempre que** ocorrer qualquer um destes eventos:

- Nova migration SQL aplicada
- Nova tabela, coluna, função, trigger, ou policy RLS
- Nova Edge Function
- Novo service, hook, ou componente arquitectural
- Alteração do stack (nova dependência, mudança de versão major)
- Correção de bug de segurança (P0/P1)
- Refactor que muda interfaces públicas
- Deploy para produção
- Mudança de branch default
- Adição/remoção de variável de ambiente

---

## 2. Stack Tecnológico (Baseline Actual)

| Camada | Tecnologia | Versão | Notas |
|---|---|---|---|
| Framework | React + Vite | 18.3 + 5.4 | SPA (NÃO Next.js, sem SSR) |
| Linguagem | TypeScript | 5.8 | Strict mode |
| UI Library | shadcn/ui (Radix) | — | 42+ componentes em `src/components/ui/` |
| CSS | Tailwind CSS | 3.4 | + tailwindcss-animate, @tailwindcss/typography |
| Routing | react-router-dom | 6.30 | BrowserRouter, SPA rewrite em `vercel.json` |
| Server State | TanStack React Query | 5.83 | Provider montado mas **não usado** |
| Forms | react-hook-form + zod | 7.61 + 3.25 | Validação client-side |
| DB | Supabase (PostgreSQL 15) | — | PostgREST + RLS |
| Auth | Supabase Auth | — | JWT em localStorage, autoRefresh |
| PDF | jsPDF + jspdf-autotable | 4.2 + 5.0 | Client-side, ~980 `doc.*` calls |
| PDF (advanced) | html2canvas → JPEG → jsPDF | 1.4 | Image-based, não acessível |
| AI | Gemini (via Edge Function) | — | `generate-proposal`, `generate-section` |
| Analytics | PostHog | 1.8 | **Não funcional** (VITE_POSTHOG_KEY marcado Sensitive) |
| Charts | Recharts | 2.15 | Dashboard admin |
| Hosting | Vercel | — | SPA rewrite, sem security headers |
| Testes | Vitest + Testing Library | 3.2 + 16.0 | 5 testes apenas (calculos) |
| E2E | @playwright/test | 1.58 | Config quebrado, 0 testes |
| Package Manager | bun | — | `bun.lock` (e `package-lock.json` — duplicado) |

**CRÍTICO:** Não é Next.js. É React SPA com Vite. Não há SSR/SSG.

---

## 3. Estado Actual da Arquitectura

### 3.1 Estrutura de Directórios

```
proposal-swift-main/
├── src/
│   ├── main.tsx, App.tsx, App.css, index.css, vite-env.d.ts
│   ├── integrations/supabase/    # client.ts + types.ts (stale)
│   ├── types/                    # index, admin, advancedProposal
│   ├── hooks/                    # useAuth, useOrganization, useActivityTracker, use-mobile, use-toast
│   ├── pages/                    # 13 top-level + admin/(4 tabs + 4 hooks) + advanced/(4 pages)
│   ├── services/                 # 14 services
│   ├── components/               # AppLayout, ProtectedRoute, org/, pdf/, ui/(42+)
│   └── lib/                      # utils, calculos, posthog, pdf/, advanced/, __tests__/
├── supabase/
│   ├── config.toml
│   ├── migrations/               # 31 SQL files
│   └── functions/                # 4 Edge Functions
├── public/, scripts/, download/
├── [docs].md, [config files]
```

### 3.2 Base de Dados (estado real em 2026-08-13)

- **23 tabelas** (todas com RLS habilitada)
- **8 enums** (app_role, plan_tier, subscription_status, proposal_status, invoice_status, desconto_tipo, org_role, visual_style)
- **66 policies RLS**
- **30 funções SQL** (todas `SECURITY DEFINER`)
- **24 triggers**
- **74 indexes**
- **27 foreign keys**
- **1 bucket storage** (`logos`, privado)

**Contagem de registos (não-vazias):**

| Tabela | Rows |
|---|---:|
| user_activity | 1029 |
| proposal_section_answers | 21 |
| proposal_items | 17 |
| section_questions | 16 |
| catalog_items | 15 |
| proposal_sections | 15 |
| clients | 12 |
| proposals | 11 |
| organization_members | 10 |
| profiles | 9 |
| subscriptions | 9 |
| user_roles | 9 |
| organizations | 8 |
| proposta_ai | 5 |
| advanced_proposals | 4 |
| business_categories | 3 |
| plan_limits | 3 |
| proposal_blueprints | 3 |
| organization_invitations | 2 |
| admin_audit_log, company_brand_profiles, invoice_items, invoices | 0 |

### 3.3 Multi-Tenant

- **Modelo:** Organization → Members → Data
- **Roles:** `owner > admin > member > viewer` (hierárquicos)
- **Isolamento:** via `organization_id` em todas as tabelas de dados + RLS policies
- **Plataforma admin:** `has_role(uid, 'admin')` — actualmente apenas `graciochiziane@gmail.com`
- **Funções helper:** `user_belongs_to_org()`, `user_role_in_org()`, `has_org_role_min_in_org()`
- **Storage paths:** `{org_id}/{filename}` (novo) ou `{user_id}/{filename}` (legacy)

### 3.4 Auth & Autorização

- **Provider:** Supabase Auth (JWT em localStorage)
- **Signup:** Email/password, auto-trigger `handle_new_user()` (cria profile + org + membership)
- **Admin hardcoded:** `graciochiziane@gmail.com` em `handle_new_user()` → `app_role = admin` + plano `business` (ver ADR-001)
- **Guard frontend:** `ProtectedRoute` verifica apenas `user != null` (sem role guard)
- **Verificação real de admin:** client-side dentro de `Admin.tsx` e `TenantDetailPage.tsx`
- **Org switching:** `setActiveOrganization(orgId)` no AuthContext + `localStorage['propostaja_active_org_{userId}']`

### 3.5 Edge Functions

| Function | Auth | CORS | Rate Limit | Logging |
|---|---|---|---|---|
| `generate-proposal` | ✅ JWT | `*` ❌ | ❌ | ✅ 10-step |
| `generate-section` | ✅ JWT | `*` ❌ | ❌ | ✅ |
| `send-invite-email` | ❌ **NONE** | `*` ❌ | ❌ | ✅ |
| `admin-create-tenant` | ✅ JWT + admin | (sem CORS) | ❌ | ❌ |

### 3.6 Motor PDF

- **Subsistema A (simples):** jsPDF nativo, 7 templates (classic, modern, executive, sleek, sidebar, business, narrativa)
- **Subsistema B (avançado):** HTML → html2canvas → JPEG → jsPDF (image-based, não acessível)
- **`gerarPDF()` retorna `void`** (não Blob) — impossibilita upload/email
- **Footer apenas na última página** (6/7 templates; só `narrativa` itera `getNumberOfPages()`)

### 3.7 Blueprint Engine (Propostas Avançadas)

```
business_categories (3) → proposal_blueprints (3) → proposal_sections (15)
                                                          ↓
section_questions (16) → proposal_section_answers (21) ← advanced_proposals (4)
```

- **4 propostas avançadas** criadas (todas em `em_revisao` ou `concluida`)
- **Todas pertencem** à org `Grácio Chiz, LDA` (business plan)
- **Rota quebrada:** `PreencherProposta.tsx:180` navega para URL inexistente (ver P0-C6)

### 3.8 Testes

- **5 testes unitários** em `src/lib/__tests__/calculos.test.ts` (cálculos MZN)
- **0 testes E2E** (Playwright config quebrado — importa `lovable-agent-playwright-config/config` inexistente)
- **Cobertura efectiva:** ~0%

---

## 4. Histórico de Mudanças

> Formato: mais recente primeiro. Cada entrada segue o template da secção 8.

### [2026-08-13] — Auditoria E2E Completa + Skill Engineering + Backup

**Tipo:** Audit + Tooling + Backup
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `73af970`
**Autor:** Agente auditor (automatizado)

#### Sumário

- Auditados 150+ ficheiros (~20.000 LOC) — 31 migrations, 14 services, 21 rotas, 4 Edge Functions, 17 ficheiros PDF, 12 hooks/componentes, 16 ficheiros config/testes
- Verificação ao vivo da BD Supabase remota via pooler IPv4 (`aws-0-eu-west-1.pooler.supabase.com:6543`)
- Identificados **60 findings**: 7 Critical, 12 High, 18 Medium, 14 Low, 9 Info
- Criada skill `proposaja-engineering` em `/home/z/my-project/skills/proposaja-engineering/` com 45 princípios + 7 ficheiros de referência
- Criado branch de backup `backup/pre-audit-fixes-2026-08-13` + tag annotated `pre-audit-fixes-2026-08-13` no GitHub

#### Findings Críticos (P0)

| ID | Finding | Referência |
|---|---|---|
| C1 | Gemini API key hardcoded no bundle client | `src/services/geminiClient.ts:6` |
| C2 | Funções admin com EXECUTE grant para PUBLIC/anon | DB (verificado ao vivo) |
| C3 | `send-invite-email` sem JWT verification | `supabase/functions/send-invite-email/index.ts:34-60` |
| C4 | CORS `*` em 3/4 Edge Functions | `generate-proposal/index.ts:11`, `generate-section/index.ts:11`, `send-invite-email/index.ts:11` |
| C5 | Stored XSS via conteúdo IA em HTML | `src/lib/advanced/documentModel.ts:225-258`, `pdfExport.ts:44` |
| C6 | Rota quebrada no fluxo Advanced | `src/pages/advanced/PreencherProposta.tsx:180` vs `App.tsx:70` |
| C7 | DB password + `.env` committed em scripts/git history | `scripts/run_migration.{cjs,mjs}`, commit `9d77ce6` |

#### Artefactos Produzidos

- `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` (1,770 linhas, 84 KB)
- `/home/z/my-project/audit_tmp/` (8 ficheiros de extração detalhada, ~7,000 linhas)
- `/home/z/my-project/skills/proposaja-engineering/` (skill com 45 princípios)
- Branch `backup/pre-audit-fixes-2026-08-13` no GitHub
- Tag `pre-audit-fixes-2026-08-13` no GitHub

#### Breaking Changes

Nenhum — auditoria não modificou código.

#### Pendências

- Aplicar 7 correções P0 (ver secção 5)
- Aplicar 12 correções P1
- Aplicar 18 correções P2
- Rotacionar 4 credenciais expostas (Gemini key, DB password, service role key, Resend key)

---

### [2026-08-12] — Rotas de Propostas Avançadas + PDF Nativo

**Tipo:** feat
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `73af970`
**Commits:** `73af970`, `915056e`

#### Sumário

- Adicionadas rotas de propostas avançadas ao router (`App.tsx`)
- Implementada exportação PDF nativa para propostas avançadas (`src/lib/advanced/`)

#### Breaking Changes

Nenhum — funcionalidade nova isolada.

#### Pendências

- **BUG:** Rota declarada vs navegada não correspondem (C6 da auditoria)

---

### [2026-08-07] — Architecture Baseline Documented

**Tipo:** docs + refactor
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** (anterior a `73af970`)
**Autor:** Agente anterior

#### Sumário

- Criado `download/ARCHITECTURE_BASELINE.md` (Protocolo de Engenharia v1.0)
- Documentada stack completa, estrutura, schema DB, auth, RLS, fluxo PDF
- Identificados 8 pontos críticos (incluindo `advanced_proposals` em falta — entretanto corrigido)
- Plano de implementação em 6 fases para Blueprint Engine

#### Breaking Changes

Nenhum.

#### Pendências

- Documentação foi parcialmente superada pela auditoria 2026-08-13
- `ARCHITECTURE_BASELINE.md:204-205` afirma `advanced_proposals` em falta — tabela já existe (4 registos)

---

### [2026-07-25] — Admin Platform + Multi-Tenant Hardening

**Tipo:** feat + security
**Branch:** `feature/multi-user-hierarchy`
**Commits:** vários (c0ec80d, fc10c8a, etc.)

#### Sumário

- Implementado painel admin completo (Metrics, Users, Tenants, Audit tabs)
- Adicionadas funções RPC: `admin_platform_metrics`, `admin_toggle_suspend`, `admin_remove_member`, `admin_signups_by_day`, `admin_most_active_users`
- Storage RLS org-aware (membros da org podem ler logos, admin+ pode escrever)
- Unique constraint `clients(organization_id, email)` — impede duplicados na mesma org
- Multi-tenant trigger hardening (5 bugs corrigidos)
- Admin-only enforcement + multi-org RLS safety
- Display name para members + invitation nome + RLS fix
- Permitir users em múltiplas organizações
- Sistema de convites com token + Edge Function + rota `/invite/accept`

#### Breaking Changes

- `organization_members` UNIQUE constraint passou a permitir multi-org (removida restrição de 1 user = 1 org)
- Funções `user_org_id`, `user_org_role`, `has_org_role_min` REMOVIDAS — substituídas por versões `_in_org`

#### Pendências

- `geracoes_ia_mes` default 2147483647 para todos os planos (H3 da auditoria)
- Hardcoded admin email em `handle_new_user()` (H4)
- Regressões em `fix_invitee_select_rpc.sql` (H2)

---

### [2026-06-12] — Multi-User Hierarchy (Fase Inicial)

**Tipo:** feat (breaking)
**Branch:** `feature/multi-user-hierarchy` (criada nesta data)
**Commits:** início da branch

#### Sumário

- Migration `20260612000000_multi_user_hierarchy.sql` — criou tabelas `organizations`, `organization_members`, `organization_invitations`
- Adicionado `organization_id` a todas as tabelas de dados (clients, catalog_items, proposals, invoices, profiles)
- Adicionado `created_by` para rastreio em proposals e invoices
- Criadas funções helper: `user_belongs_to_org`, `user_role_in_org`, `has_org_role_min_in_org`
- Novo padrão de RLS: `user_belongs_to_org(organization_id)` substitui `owner_id = auth.uid()`
- Migração automática: utilizadores existentes tornam-se "owner" da sua própria org
- Frontend: `useOrganization` hook, `Organizacao.tsx` page, components em `src/components/org/`

#### Breaking Changes

- **MAJOR:** Modelo de dados passou de single-tenant (owner_id) para multi-tenant (organization_id)
- RLS policies reescritas em todas as tabelas de dados
- `profiles.plano` deixou de ser fonte de verdade (passou para `organizations.plano`)

#### Pendências

- `has_org_role_min(uid, role)` legacy ainda referenciada em algumas policies antigas (M11)

---

### [2026-04-23] — Initial Setup (Lovable Scaffold)

**Tipo:** init
**Branch:** `main`
**Commits:** primeiros commits

#### Sumário

- Scaffold inicial via Lovable (React + Vite + TypeScript + shadcn/ui + Tailwind)
- Supabase setup: `001_consolidated_ia_setup.sql` + `staging_full_setup.sql`
- Criadas tabelas base: profiles, user_roles, subscriptions, plan_limits, clients, catalog_items, proposals, proposal_items, invoices, invoice_items, proposta_ai, user_activity, admin_audit_log
- Configurado bucket `logos` (privado)
- Implementado CRUD completo de propostas, clientes, catálogo, facturas
- Edge Function `generate-proposal` (inicialmente com OpenAI)
- Templates PDF: classic, modern, executive

#### Breaking Changes

Nenhum (projecto novo).

#### Pendências

- Várias migrações com hardcoded `graciochiziane@gmail.com` (H4)

---

## 5. Mudanças Pendentes (Roadmap de Correção)

> Baseado na auditoria E2E de 2026-08-13. Cada item deve ser movido para a secção 4 (Histórico) quando concluído.

### 5.1 P0 — Ação Imediata (7 findings críticos)

| ID | Acção | Esforço | Branch planeado | Estado |
|---|---|---|---|---|
| C1 | Remover `geminiClient.ts` do bundle client; rotacionar key; usar apenas via Edge Function | 2h | `fix/p0-c1-gemini-key` | ⏳ Pendente |
| C2 | Migration SQL: `REVOKE EXECUTE ... FROM PUBLIC, anon` em 10 funções admin + `has_role('admin')` check interno | 1h | `fix/p0-c2-revoke-admin-exec` | ⏳ Pendente |
| C3 | Adicionar `supabase.auth.getUser()` em `send-invite-email` Edge Function | 1h | `fix/p0-c3-send-invite-auth` | ⏳ Pendente |
| C4 | Substituir CORS `*` por allowlist de origins em 3 Edge Functions | 1h | `fix/p0-c4-cors-allowlist` | ⏳ Pendente |
| C5 | Adicionar `escapeHtml()` ou DOMPurify em `documentModel.ts` antes de `innerHTML` | 1h | `fix/p0-c5-xss-pdf` | ⏳ Pendente |
| C6 | Corrigir URL em `PreencherProposta.tsx:180`: `/proposta-avancada/${id}/revisao` → `/revisao-proposta/${id}` | 5min | `fix/p0-c6-route-broken` | ⏳ Pendente |
| C7 | Rotacionar password Supabase; criar script `git filter-repo` para purgar `.env` do history | 2h | `fix/p0-c7-rotate-secrets` | ⏳ Pendente |

### 5.2 P1 — Curto Prazo (12 findings high)

| ID | Acção | Esforço | Estado |
|---|---|---|---|
| H1 | Drop da função `has_role(uuid, text)` (overload ambíguo) | 30min | ⏳ |
| H2 | Restore do filtro `organization_id` em `transfer_ownership` (regressão) | 30min | ⏳ |
| H3 | Reset `geracoes_ia_mes` defaults em `plan_limits` (free=3, pro=50) | 15min | ⏳ |
| H4 | Migrar hardcoded admin email para tabela `platform_admins` | 2h | ⏳ |
| H5 | Adicionar `getUser()` + `has_role('admin')` em todas as 10 funções de `adminService.ts` | 2h | ⏳ |
| H6 | Adicionar auth/org filter em `analyticsService.ts` (6 métodos) | 1h | ⏳ |
| H7 | Validar membership antes de insert em `advancedProposalService.createAdvancedProposal` | 1h | ⏳ |
| H8 | Adicionar `getUser()` em `invitationService.getByToken`, `cancel`, `resend` | 1h | ⏳ |
| H9 | Allowlist de modelos Gemini em `generate-proposal` e `generate-section` | 30min | ⏳ |
| H10 | Remover `stack` do response de erro; usar HTTP status correcto | 30min | ⏳ |
| H11 | Adicionar prop `roles={['admin']}` ao `ProtectedRoute` | 1h | ⏳ |
| H12 | Unificar modelo Gemini para `gemini-3.1-flash-lite` em todo o código | 30min | ⏳ |

### 5.3 P2 — Médio Prazo (18 findings medium)

| ID | Acção | Estado |
|---|---|---|
| M1 | Adicionar verificação dupla client-side em services admin | ⏳ |
| M2 | Adoptar React Query em todos os services | ⏳ |
| M3 | Migrar PDF generation para server-side (ou manter client mas com Blob return) | ⏳ |
| M4 | Regenerar `types.ts` via `supabase gen types typescript` | ⏳ |
| M5 | Validar `org_id` em localStorage antes de usar | ⏳ |
| M6 | Limitar `resend` de invites (max 3 retries, não estender indefinidamente) | ⏳ |
| M7 | Adicionar rate limiting em Edge Functions IA (Upstash Redis) | ⏳ |
| M8 | Adicionar logging forense em `admin-create-tenant` | ⏳ |
| M9 | Sanitizar OData filter em `admin-create-tenant` (escape single quotes) | ⏳ |
| M10 | Refactor `gerarPDF` para retornar `Blob` | ⏳ |
| M11 | Fix footer em todas as páginas PDF (iterar `getNumberOfPages()`) | ⏳ |
| M12 | Enforcement de `isProTemplate` antes de renderizar | ⏳ |
| M13 | Unificar cores de brand entre templates | ⏳ |
| M14 | Unificar locale de data (pt-MZ em todo o lado) | ⏳ |
| M15 | Refactor `sidebar.ts` para usar `formatMZNLocal` partilhado | ⏳ |
| M16 | Adicionar `.catch()` em `useAuth.getSession` e `signOut` | ⏳ |
| M17 | Sanitizar `pathname` em `useActivityTracker` (remover query strings) | ⏳ |
| M18 | Adicionar `coverage` config em `vitest.config.ts` | ⏳ |

### 5.4 P3 — Longo Prazo (14 findings low + 9 info)

Ver auditoria completa em `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` secções 12.4 e 12.5.

---

## 6. Decisões Arquitecturais (ADRs)

> Formato ADR-lite. Cada decisão tem: Contexto, Decisão, Consequências, Status.

### ADR-001 — Admin de Plataforma via Email Hardcoded

**Data:** 2026-04-23
**Status:** ⚠️ Em revisão (será substituído por ADR-002)
**Contexto:** O projecto precisa de um platform admin para aceder ao painel admin (ver tenants, suspender, ver métricas globais).
**Decisão:** Hardcoded `graciochiziane@gmail.com` em `handle_new_user()` trigger. Qualquer signup com esse email ganha automaticamente `app_role = admin` + plano `business`.
**Consequências:**
- ✅ Simples de implementar
- ✅ Sem necessidade de UI de gestão de admins
- ❌ Se o email for comprometido, atacante ganha admin de plataforma
- ❌ Impossível adicionar outros admins sem alterar código
- ❌ Email visível no bundle JS (extraído do SQL migration)
**Referência:** `20260423185602_*.sql:12,34`, `20260612000000_multi_user_hierarchy.sql:530`
**Substituição planeada:** ADR-002

### ADR-002 — Tabela `platform_admins` (planeada)

**Data:** (planeada para P1-H4)
**Status:** 📋 Planeada
**Contexto:** ADR-001 tem vulnerabilidades significativas. Necessário permitir múltiplos admins sem alterar código.
**Decisão:** Criar tabela `platform_admins(user_id UUID PRIMARY KEY REFERENCES auth.users(id), granted_by UUID, granted_at TIMESTAMPTZ, active BOOLEAN)`. Remover hardcoded email de `handle_new_user()`. Adicionar admins via migration explícita.
**Consequências esperadas:**
- ✅ Múltiplos admins sem código changes
- ✅ Audit trail (granted_by, granted_at)
- ✅ Pode desactivar admins sem apagar (active = false)
- ❌ Requer migration + update de `has_role()` para consultar nova tabela

### ADR-003 — Multi-Tenant via `organization_id` + RLS

**Data:** 2026-06-12
**Status:** ✅ Activa
**Contexto:** Projecto cresceu de single-tenant B2C para multi-tenant B2B. Necessário partilhar dados dentro de uma empresa, isolar entre empresas.
**Decisão:** Modelo `Organization → Members → Data`. Todas as tabelas de dados têm `organization_id`. RLS filtra por `user_belongs_to_org(organization_id)`. Manter `owner_id` como fallback legacy.
**Consequências:**
- ✅ Isolamento forte ao nível da BD
- ✅ Suporta multi-org por utilizador (desde 2026-07-25)
- ✅ Fallback legacy mantém compatibilidade
- ❌ Services devem filtrar por `organization_id` client-side também (defesa em profundidade)
- ❌ Performance: `user_belongs_to_org()` executado em cada query (mitigado com STABLE + index)
**Referência:** `20260612000000_multi_user_hierarchy.sql`

### ADR-004 — PDF Client-Side com jsPDF

**Data:** 2026-04-23
**Status:** ⚠️ Parcialmente obsoleta (advanced usa html2canvas)
**Contexto:** Geração de PDFs de propostas. Necessário múltiplos templates visuais.
**Decisão:** Usar jsPDF + jspdf-autotable client-side. Sistema de temas (`PdfTheme`) permite cada template controlar aparência. Para propostas avançadas, usar html2canvas → JPEG → jsPDF.
**Consequências:**
- ✅ Sem dependência de servidor para PDF
- ✅ Templates visuais flexíveis
- ❌ PDFs avançados não acessíveis (image-based, texto não seleccionável)
- ❌ `gerarPDF` retorna void, não Blob
- ❌ Footer apenas na última página (6/7 templates)
- ❌ ~980 `doc.*` calls difíceis de migrar
**Referência:** `src/lib/pdf/`, `src/lib/advanced/`
**Substituição planeada:** Para propostas avançadas, migrar para React → HTML → CSS → Chromium → PDF (ver skill `references/pdf-engine.md`)

### ADR-005 — IA via Gemini (Edge Function)

**Data:** 2026-05-XX (migração de OpenAI para Gemini)
**Status:** ✅ Activa
**Contexto:** Geração de propostas comerciais por IA. Necessário modelo gratuito ou barato.
**Decisão:** Usar Google Gemini (`gemini-3.1-flash-lite` em produção) via Edge Function `generate-proposal`. System prompt anti-alucinação com estrutura de 8 secções obrigatórias.
**Consequências:**
- ✅ Modelo gratuito (Flash Lite)
- ✅ Edge Function mantém key server-side (em princípio)
- ❌ `src/services/geminiClient.ts` também faz chamadas directas com key hardcoded (C1)
- ❌ Modelo pode mudar sem aviso (sem allowlist)
- ❌ Sem rate limiting por plano
**Referência:** `supabase/functions/generate-proposal/index.ts`, `src/services/propostaAiService.ts`

### ADR-006 — Tipos TypeScript via `supabase gen types`

**Data:** 2026-04-23
**Status:** ⚠️ Stale
**Contexto:** Manter tipos TypeScript sincronizados com schema DB.
**Decisão:** Gerar `src/integrations/supabase/types.ts` via `supabase gen types typescript`. Não editar manualmente.
**Consequências:**
- ✅ Tipos automáticos
- ❌ Ficheiro está desactualizado — faltam 10 RPCs recentes (admin_*, accept_invitation, etc.)
- ❌ Services usam `as any` para contornar (8 instâncias)
**Acção:** Regenerar após cada migration (P2-M4)

---

## 7. Matriz de Documentação

> Qual doc ler para quê. Evita dispersão e docs contraditórias.

| Preciso de... | Ler... | Notas |
|---|---|---|
| Compreender o estado actual do projecto | **Este ficheiro** (secção 3) + `references/project-baseline.md` da skill | Fonte única de verdade |
| Histórico de mudanças | **Este ficheiro** (secção 4) | Mais recente primeiro |
| Decisões arquitecturais e o porquê | **Este ficheiro** (secção 6 — ADRs) | Contexto + Decisão + Consequências |
| Plano de correções pendentes | **Este ficheiro** (secção 5) | P0/P1/P2/P3 |
| Detalhes técnicos do stack | `references/project-baseline.md` da skill | Stack, estrutura, naming conventions |
| Regras de segurança e RLS | `references/security.md` da skill | Padrões multi-tenant, CORS, JWT |
| Padrões de migration e DB | `references/database.md` da skill | Templates de tabela, triggers, indexes |
| Motor PDF — arquitectura | `references/pdf-engine.md` da skill | Dois subsistemas, templates, regras jsPDF |
| Regras anti-alucinação para IA | `references/anti-hallucination.md` da skill | Output estruturado, estrutura controlada |
| Estratégia de testes | `references/testing.md` da skill | Frameworks, gaps, prioridades |
| Checklist antes de declarar concluído | `references/checklist.md` da skill | 7 categorias de verificação |
| Auditoria E2E completa (60 findings) | `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` | Relatório detalhado com referências file:line |
| Plano original multi-user | `PLAN_MULTI_USER.md` (root) | Documento histórico (2026-06-12) |
| Auditoria multi-tenant anterior | `AUDITORIA_MULTI_TENANT.md` (root) | Documento histórico (2026-07-09) |
| Estado do projecto (visão geral) | `PROJETO_STATUS.md` (root) | ⚠️ Parcialmente desactualizado |
| Baseline de arquitectura anterior | `download/ARCHITECTURE_BASELINE.md` | Documento histórico (2026-08-07) |
| Log de trabalho de agentes | `worklog.md` (root) | Append-only, formato específico |

### Documentos deprecated

| Documento | Status | Substituído por |
|---|---|---|
| `PROJETO_STATUS.md` | ⚠️ Parcialmente desactualizado | Secção 3 deste ficheiro (para estado actual) |
| `download/ARCHITECTURE_BASELINE.md` | ⚠️ Histórico | Secção 2 + 3 deste ficheiro |
| `AUDITORIA_MULTI_TENANT.md` | 📋 Histórico | `AUDITORIA_E2E_ProposalJa.md` (mais recente e completa) |

> **Acção planeada:** Após aplicar P0+P1, consolidar `PROJETO_STATUS.md` e `ARCHITECTURE_BASELINE.md` neste ficheiro e marcar os antigos como deprecated no topo.

---

## 8. Template para Nova Entrada de Histórico

> Copiar este template para a secção 4 (topo, mais recente primeiro) após qualquer alteração estrutural.

```markdown
### [AAAA-MM-DD] — Título Curto da Mudança

**Tipo:** feat | fix | refactor | migration | security | audit | docs | breaking
**Branch:** `<branch-name>`
**HEAD:** `<commit-sha>`
**Autor:** <nome ou agente>

#### Sumário

- 1-3 frases descrevendo o que foi feito
- Bullet points para alterações específicas

#### Breaking Changes

- Listar breaking changes (ou "Nenhum")
- Incluir instruções de migração se aplicável

#### Ficheiros Criados

- `/caminho/para/ficheiro.ts` — propósito

#### Ficheiros Alterados

- `/caminho/para/ficheiro.ts` — o que mudou e porquê

#### Database

- Migration: `supabase/migrations/YYYYMMDD_xxx.sql`
- Tabelas afectadas: ...
- RLS policies: ...
- Triggers: ...
- Funções: ...

#### Testes

- Unitários: ...
- Integração: ...
- E2E: ...

#### Segurança

- Auth: ...
- RLS: ...
- Secrets: ...

#### Regressão

- Fluxo login: ✅/❌
- Fluxo proposta simples: ✅/❌
- Fluxo PDF: ✅/❌
- Multi-tenant isolation: ✅/❌

#### Pendências

- Items que ficaram por fazer
- Issues conhecidas introduzidas

#### Referências

- Issue/PR: #N (se aplicável)
- ADR relacionado: ADR-NNN
- Audit finding: C1/H1/M1/etc. (se aplicável)
```

---

## 9. Convenções de Versionamento

### Versionamento deste documento

- **Major (X.0):** Quando o baseline muda significativamente (nova tabela core, novo stack, refactor arquitectural)
- **Minor (1.X):** Quando uma entrada é adicionada ao histórico ou um ADR é criado
- **Patch (1.X.Y):** Correcções typo, links quebrados, esclarecimentos

**Versão actual:** 1.0 (criação)

### Versionamento do código

O projecto não usa semver estruturado. Branches seguem o padrão:

| Prefixo | Uso |
|---|---|
| `main` | Produção |
| `staging` | Pré-produção |
| `develop` | Integração |
| `feature/<nome>` | Nova funcionalidade |
| `fix/<nome>` | Correção de bug |
| `backup/<nome>` | Snapshot de segurança |
| `docs/<nome>` | Alteração de documentação apenas |

### Commits

Convenção [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

types: feat, fix, refactor, docs, style, test, chore, perf, build, ci
scopes: auth, db, pdf, ai, ui, admin, org, etc.
```

**Exemplos:**
- `feat(ai): add rate limiting to generate-proposal edge function`
- `fix(security): revoke EXECUTE on admin functions from PUBLIC`
- `refactor(pdf): gerarPDF now returns Blob instead of void`
- `docs: add CHANGELOG_ARCHITECTURE.md`

---

## 10. Manutenção

### Responsável

- **Owner:** Engenheiro sénior do projecto (actualmente: graciochiziane)
- **Agentes IA:** Devem actualizar este ficheiro como parte de qualquer task estrutural (ver skill `proposaja-engineering` secção 43 — Relatório de Conclusão)

### Frequência de revisão

- **Semanal:** Verificar que secção 5 (Pendentes) está actualizada
- **A cada release:** Verificar que secção 3 (Baseline) corresponde ao código real
- **A cada auditoria:** Adicionar entrada na secção 4 + actualizar secção 5

### Sensores de drift

Se algum destes for verdadeiro, o documento está desactualizado:

- [ ] `git log --oneline -1` não corresponde ao HEAD na secção 0
- [ ] Contagem de tabelas na secção 3.2 não corresponde a `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'`
- [ ] Branches listados na secção 0 não correspondem a `git branch -r`
- [ ] Existem migrations em `supabase/migrations/` não mencionadas no histórico
- [ ] Existem services em `src/services/` não cobertos pela secção 3.1

### Comandos de verificação rápida

```bash
cd /home/z/my-project/repos/proposal-swift-main

# HEAD actual
git log --oneline -1

# Total de tabelas na BD
psql "postgresql://postgres.ewlkdrwrespnxyddwtgo:***@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Total de migrations
ls supabase/migrations/ | wc -l

# Total de services
ls src/services/*.ts | wc -l

# Branches remotos
git branch -r
```

---

## 11. Glossário

| Termo | Significado |
|---|---|
| **ADR** | Architectural Decision Record — registo de decisão arquitectural |
| **Baseline** | Estado de referência do projecto num momento no tempo |
| **Blueprint** | Definição da estrutura de uma proposta avançada (o que existe no documento) |
| **Finding** | Constatação de auditoria (Critical/High/Medium/Low/Info) |
| **Multi-tenant** | Múltiplas organizações a partilhar a mesma instância, com isolamento de dados |
| **Org** | Organization (workspace) — unidade de isolamento multi-tenant |
| **P0/P1/P2/P3** | Prioridade de correção (Imediato/Curto/Médio/Longo prazo) |
| **RLS** | Row-Level Security — política de BD que filtra linhas por utilizador |
| **Template** | Definição visual de um PDF (como o documento parece) |
| **Renderer** | Componente que transforma Document Model em PDF |

---

## 12. Notas Finais

Este ficheiro é **vivo**. Não deve ser tratado como documento estático. Se não foi actualizado na última semana, provavelmente está desactualizado.

Se encontrou drift entre este documento e o código real, **o código é a fonte de verdade** — actualize este documento para reflectir o código.

Se encontrou drift entre este documento e a auditoria E2E (`AUDITORIA_E2E_ProposalJa.md`), a auditoria é mais recente — actualize este documento.

**Última verificação de consistência:** 2026-08-13 contra HEAD `73af970` ✅
