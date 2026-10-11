# ProposalJa — ARCHITECTURE BASELINE
## Protocolo de Engenharia v1.0 — 2026-08-07

---

## 1. STACK

| Camada | Tecnologia | Versão | Notas |
|--------|-----------|--------|-------|
| **Framework** | React + Vite | 18.3 + 5.4 | SPA, NÃO é Next.js |
| **Linguagem** | TypeScript | 5.8 | Strict mode |
| **UI Library** | shadcn/ui (Radix) | — | 42+ componentes em `/ui/` |
| **CSS** | Tailwind CSS | 3.4 | + tailwindcss-animate |
| **Routing** | react-router-dom | 6.30 | BrowserRouter, SPA rewrite no Vercel |
| **State/Server** | TanStack React Query | 5.83 | Cache + async |
| **Forms** | react-hook-form + zod | 7.61 + 3.25 | Validação |
| **DB** | Supabase (PostgreSQL) | — | PostgREST + RLS |
| **Auth** | Supabase Auth | — | JWT + localStorage |
| **PDF** | jsPDF + jspdf-autotable | 4.2 + 5.0 | Client-side, ~980 doc.* calls |
| **AI** | Gemini (via Edge Function) | — | generate-proposal function |
| **Analytics** | PostHog | 1.8 | Event tracking |
| **Charts** | Recharts | 2.15 | Dashboard admin |
| **Hosting** | Vercel | — | SPA rewrite (vercel.json) |
| **Testes** | Vitest + Testing Library | 3.2 + 16.0 | 1 teste existente (calculos) |
| **Playwright** | @playwright/test | 1.58 | E2E configurado, 0 testes |
| **Package Manager** | bun | — | bun.lock presente |

**CRÍTICO**: Não é Next.js. É React SPA com Vite. Não há SSR/SSG.

---

## 2. ESTRUTURA DO PROJECTO

```
/home/z/my-project/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Routes + Providers
│   ├── App.css                     # Estilos globais
│   ├── index.css                   # Tailwind imports
│   ├── vite-env.d.ts               # Env types
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts            # Supabase client (auto-gen)
│   │       └── types.ts             # DB types (auto-gen)
│   │
│   ├── types/
│   │   ├── index.ts                 # Core types (Proposta, Cliente, etc.)
│   │   ├── admin.ts                 # Admin types
│   │   └── advancedProposal.ts      # Blueprint Engine types (EXISTE)
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx              # Auth + org context provider
│   │   ├── useOrganization.ts       # Org data + role utils
│   │   ├── useActivityTracker.tsx   # Activity logging
│   │   └── use-mobile.tsx           # Responsive hook
│   │
│   ├── pages/
│   │   ├── Auth.tsx                 # Login/Register
│   │   ├── Dashboard.tsx            # Home dashboard
│   │   ├── Clientes.tsx             # Client CRUD
│   │   ├── Catalogo.tsx             # Product catalog
│   │   ├── CriarProposta.tsx         # Create/edit proposal
│   │   ├── Propostas.tsx            # Proposal list
│   │   ├── ResumoProposta.tsx       # Proposal detail + PDF
│   │   ├── GerarPropostaIA.tsx      # AI generation UI
│   │   ├── Configuracoes.tsx        # Settings/profile
│   │   ├── Organizacao.tsx          # Org management
│   │   ├── Admin.tsx                # SuperAdmin panel
│   │   ├── TenantDetailPage.tsx     # Admin tenant detail
│   │   ├── AcceptInvite.tsx         # Invitation acceptance
│   │   ├── ForgotPassword.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── NotFound.tsx
│   │   └── admin/
│   │       ├── TenantsTab.tsx
│   │       ├── UsersTab.tsx
│   │       ├── MetricsTab.tsx
│   │       ├── AuditTab.tsx
│   │       ├── PlanLimitsDialog.tsx
│   │       ├── CreateTenantDialog.tsx
│   │       ├── constants.ts
│   │       └── hooks/ (4 custom hooks)
│   │
│   ├── services/
│   │   ├── propostaService.ts       # CRUD propostas
│   │   ├── propostaAiService.ts     # AI generation calls
│   │   ├── clienteService.ts        # Client CRUD
│   │   ├── catalogService.ts        # Catalog CRUD
│   │   ├── faturaService.ts         # Invoice CRUD
│   │   ├── profileService.ts        # Profile get/update
│   │   ├── organizationService.ts   # Org CRUD
│   │   ├── memberService.ts         # Member management
│   │   ├── invitationService.ts     # Invitation flow
│   │   ├── adminService.ts          # Admin operations
│   │   ├── analyticsService.ts      # PostHog events
│   │   └── advancedProposalService.ts # Blueprint CRUD (EXISTE)
│   │
│   ├── components/
│   │   ├── AppLayout.tsx            # Sidebar + topbar layout
│   │   ├── ProtectedRoute.tsx       # Auth guard
│   │   ├── NavLink.tsx
│   │   ├── UserProfile.tsx
│   │   ├── pdf/
│   │   │   └── TemplateSelectorModal.tsx
│   │   ├── org/
│   │   │   ├── InviteModal.tsx
│   │   │   ├── MemberList.tsx
│   │   │   ├── RoleBadge.tsx
│   │   │   └── InvitationBanner.tsx
│   │   └── ui/ (42+ shadcn components)
│   │
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper
│   │   ├── calculos.ts              # MZN math (calcularTotal)
│   │   ├── posthog.ts               # PostHog init
│   │   ├── pdf/
│   │   │   ├── index.ts             # gerarPDF() entry point
│   │   │   ├── registry.ts          # Template registry (Map)
│   │   │   ├── types.ts             # PdfTheme, TemplateEntry
│   │   │   ├── themes.ts            # 6 theme definitions
│   │   │   ├── shared.ts            # 538 doc.* calls (drawTable, etc.)
│   │   │   ├── classic.ts           # 45 doc.* calls
│   │   │   ├── modern.ts            # 45 doc.* calls
│   │   │   ├── executive.ts         # 50 doc.* calls
│   │   │   ├── sleek.ts             # 63 doc.* calls (PRO)
│   │   │   ├── sidebar.ts           # 71 doc.* calls (PRO, quebra abstracção)
│   │   │   ├── business.ts          # 52 doc.* calls (PRO)
│   │   │   └── narrativa.ts         # 118 doc.* calls (independente)
│   │   └── __tests__/
│   │       └── calculos.test.ts     # Único teste
│   │
│   └── test/
│       ├── setup.ts
│       └── example.test.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/ (30+ files)
│   └── functions/
│       ├── generate-proposal/index.ts  # AI Edge Function (Gemini)
│       ├── send-invite-email/index.ts
│       └── admin-create-tenant/index.ts
│
├── package.json
├── vercel.json                       # SPA rewrite
├── tailwind.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── postcss.config.js
└── components.json                    # shadcn config

# Directórios auxiliares (NÃO editar):
# proposal-swift-audit/  — snapshot de auditoria
# repo-work/             — cópia de trabalho
```

**PONTOS CRÍTICOS DA ESTRUTURA**:
- `proposal-swift-audit/` e `repo-work/` são cópias estáticas — ignorar
- `src/types/advancedProposal.ts` JÁ EXISTE com tipos completos
- `src/services/advancedProposalService.ts` JÁ EXISTE com CRUD
- `supabase/migrations/20260807000000_advanced_proposals_blueprint_engine.sql` JÁ FOI CRIADA
- Falta: tabela `advanced_proposals` e `proposal_section_answers` no schema
- Falta: UI pages, componentes de pergunta, Document Model, Renderer

---

## 3. BANCO DE DADOS

### 3.1 Tabelas (22)

| # | Tabela | Tipo | Linhas (est.) | RLS |
|---|--------|------|--------------|-----|
| 1 | profiles | Dados | — | ✅ org-scoped |
| 2 | user_roles | Dados | — | ✅ own/admin |
| 3 | subscriptions | Dados | — | ✅ own/admin |
| 4 | plan_limits | Lookup | 3 | ✅ read all |
| 5 | clients | Dados | — | ✅ org/owner |
| 6 | catalog_items | Dados | — | ✅ org/owner |
| 7 | proposals | Dados | — | ✅ org/owner, split ops |
| 8 | proposal_items | Dados | — | ✅ via parent |
| 9 | invoices | Dados | — | ✅ org/owner, split ops |
| 10 | invoice_items | Dados | — | ✅ via parent |
| 11 | proposta_ai | Dados | — | ✅ org/owner |
| 12 | user_activity | Log | — | ✅ own/admin |
| 13 | admin_audit_log | Log | — | ✅ admin only |
| 14 | organizations | Multi-tenant | — | ✅ member/admin |
| 15 | organization_members | Multi-tenant | — | ✅ owner-admin/admin |
| 16 | organization_invitations | Multi-tenant | — | ✅ owner-admin/invitee |
| 17 | business_categories | Blueprint | 0 | ✅ read all, admin manage |
| 18 | proposal_blueprints | Blueprint | 0 | ✅ read all, admin manage |
| 19 | proposal_sections | Blueprint | 0 | ✅ read all, admin manage |
| 20 | section_questions | Blueprint | 0 | ✅ read all, admin manage |
| 21 | company_brand_profiles | Brand | 0 | ✅ org owner-admin |
| 22 | storage.objects (logos) | Storage | — | ✅ org-aware |

### 3.2 Tabelas em Falta (necessárias para o sistema)

| Tabela | Status | Acção |
|--------|--------|--------|
| `advanced_proposals` | **Falta** | Criar via migração |
| `proposal_section_answers` | **Falta** | Criar via migração |

O serviço `advancedProposalService.ts` já referencia estas tabelas.

### 3.3 Enums (8)

`app_role`, `plan_tier`, `subscription_status`, `proposal_status`, `invoice_status`, `desconto_tipo`, `org_role`, `visual_style`

### 3.4 Funções Críticas (15+)

- `set_updated_at()` — trigger utilitário
- `has_role(uid, role)` — plataforma admin check
- `user_belongs_to_org(org_id)` — org-scoped (MULTI-TENANT SAFE)
- `user_role_in_org(org_id)` — role numa org específica
- `has_org_role_min_in_org(org_id, role)` — hierarchy check org-specific
- `has_org_role_min(uid, role)` — LEGACY, ainda usada em algumas RLS
- `enforce_proposal_limit()` — org-aware + suspended check
- `set_proposal_numero()` — org-scoped sequential
- `set_invoice_numero()` — org-scoped sequential
- `handle_new_user()` — auto-create profile + org + membership
- `accept_invitation()` — join org with display_name
- `transfer_ownership()` — org-specific ownership swap
- `admin_toggle_suspend()` — admin suspend/reactivate
- `admin_platform_metrics()` — aggregated dashboard metrics
- `admin_remove_member()` — admin remove + cleanup

---

## 4. AUTH

- **Provider**: Supabase Auth (JWT, localStorage)
- **Signup**: Email/password, auto-triggers `handle_new_user()`
- **Admin**: Hardcoded `graciochiziane@gmail.com` → `app_role = admin`
- **Context**: `useAuth.tsx` fornece `{ user, session, organization, orgRole, memberships, hasOrgRoleMin }`
- **Guard**: `ProtectedRoute.tsx` redireciona para `/auth`
- **Org Switching**: `setActiveOrganization(orgId)` no AuthContext
- **Platform Admin**: `has_role(uid, 'admin')` — super-admin global
- **Org Roles**: `owner > admin > member > viewer` — hierárquicos

---

## 5. RLS

### 5.1 Modelo
- Todas as 22 tabelas têm RLS ENABLED
- 40+ policies activas
- **Org-scoped**: `user_belongs_to_org(organization_id)` em vez de `user_org_id(auth.uid())`
- **Dual access**: org members OR owner fallback (para dados legacy sem org)
- **Platform admin**: `has_role(auth.uid(), 'admin')` bypass em quase todas
- **Split operations**: proposals e invoices têm SELECT/INSERT/UPDATE/DELETE separados
- **INSERT restrictions**: `has_org_role_min_in_org(org_id, 'member')` para criar
- **DELETE restrictions**: `has_org_role_min_in_org(org_id, 'admin')` para apagar

### 5.2 Storage
- Bucket `logos` com 4 policies org-aware
- Path convention: `{org_id}/{filename}` ou `{user_id}/{filename}` (legacy)

---

## 6. FLUXO ACTUAL (Proposta Simples)

```
1. Dashboard → "Nova Proposta"
2. CriarProposta.tsx
   ├── Selecionar cliente (dropdown)
   ├── Adicionar items (nome, qtd, preço)
   ├── Observações
   └── Calcular automático: subtotal → desconto → IVA 16% → total
3. Guardar → proposals + proposal_items (via propostaService)
4. ResumoProposta.tsx
   ├── Ver detalhes
   ├── Gerar PDF (seleccionar template)
   ├── Gerar IA (via Edge Function)
   ├── Converter em factura
   └── Alterar status
```

**Rota**: `/proposta/nova` → `/proposta/:id` → `/proposta/:id/gerar-ia`

---

## 7. SISTEMA PDF

### 7.1 Arquitectura Actual

```
ResumoProposta.tsx
  → gerarPDF(proposta, cliente, dono, template, narrative?)
    → pdf/index.ts
      → getTemplate(template) [registry.ts]
        → entry.render(proposta, cliente, dono, narrative)
```

### 7.2 Templates

| ID | Nome | PRO | doc.* calls | Notas |
|----|------|-----|-------------|-------|
| classic | Clássico | ❌ | 45 | Estável |
| modern | Moderno | ❌ | 45 | Estável |
| executive | Executivo | ❌ | 50 | Estável |
| sleek | Sleek | ✅ | 63 | Estável |
| sidebar | Sidebar | ✅ | 71 | **QUEBRA abstracção** (próprio formatMZNLocal) |
| business | Business | ✅ | 52 | Estável |

### 7.3 Shared Helpers (shared.ts — 538 doc.* calls)
- `createContext()` — cria doc + seta fonte + cores
- `drawNarrativeSections()` — renderiza secções IA
- `drawItemsTable()` — tabela de items via autoTable
- `drawTotals()` — bloco de totais
- `drawPaymentMethods()` — métodos de pagamento
- `drawFooter()` — **BUG: só primeira página**

### 7.4 Narrativa (narrativa.ts — 118 doc.* calls)
- Caminho INDEPENDENTE — ignora template parameter
- Sem suporte a template visual
- Sem paginação automática

### 7.5 Problemas Conhecidos
1. **~980 doc.* calls** — difícil migrar
2. **sidebar.ts** quebra abstracção (próprio `formatMZNLocal`)
3. **narrativa.ts** independente (ignora template)
4. **Footer bug** — só aparece na primeira página
5. **Sem Blob return** — `gerarPDF()` retorna `void`, não `Blob`
6. **Sem error handling** — falhas silenciosas
7. **Dead code** em themes.ts (`getTheme()`, `getAllThemes()` nunca importados)

---

## 8. DEPENDÊNCIAS

### 8.1 Produção (29 deps)
- **Core**: react 18, react-dom, react-router-dom 6
- **UI**: 20+ @radix-ui packages, lucide-react, class-variance-authority, clsx, tailwind-merge
- **Data**: @supabase/supabase-js, @tanstack/react-query, zod, react-hook-form
- **PDF**: jspdf 4.2, jspdf-autotable 5.0
- **Analytics**: @posthog/react, posthog-js
- **Util**: date-fns, cmdk, embla-carousel-react, vaul, next-themes, sonner, recharts
- **DB**: pg (apenas para scripts de migração)

### 8.2 Dev (14 deps)
- vite 5.4, @vitejs/plugin-react-swc, typescript 5.8
- vitest 3.2, @testing-library/react 16, @testing-library/jest-dom, jsdom
- tailwindcss 3.4, postcss, autoprefixer, @tailwindcss/typography
- eslint, typescript-eslint, @playwright/test
- lovable-tagger (custom)

### 8.3 Em Falta para o Sistema Avançado
- `playwright` (já instalado mas não será usado para rendering PDF)
- O rendering HTML/CSS será **server-side via Supabase Edge Function** ou **client-side via Blob URL**

---

## 9. SCRIPTS

```json
{
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- Sem script de **migração automática** (feito manualmente no SQL Editor)
- `scripts/run_migration.mjs` e `scripts/run_migration.cjs` — utilitários para rodar migrações

---

## 10. PONTOS CRÍTICOS

| # | Ponto | Severidade | Impacto |
|---|-------|-----------|--------|
| 1 | `advanced_proposals` e `proposal_section_answers` **não existem** na BD | CRÍTICO | O service vai falhar |
| 2 | A migração `20260807000000` criou blueprint tables mas NÃO criou `advanced_proposals` | CRÍTICO | Divergência schema/service |
| 3 | `has_org_role_min(uid, role)` é LEGACY mas ainda referenciada em RLS policies de insert/delete | ALTO | Não quebra mas é impreciso para multi-org |
| 4 | AI Edge Function usa modelo `gemini-3.1-flash-lite` — sem controlo de versão | MÉDIO | Pode mudar sem aviso |
| 5 | Sem Blob return no PDF — impossibilita download programático | MÉDIO | Bloqueia fluxo avançado |
| 6 | 1 único teste (calculos) — cobertura ≈ 0% | ALTO | Refactoring sem rede de segurança |
| 7 | `proposal-swift-audit/` e `repo-work/` duplicam o projecto | BAIXO | Confusão, não afecta build |
| 8 | `pg` como dependência de produção (deveria ser devDependency) | BAIXO | Infla bundle desnecessariamente |

---

## 11. RISCOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|--------|----------|
| Quebra do fluxo simples durante implementação | Baixa | Crítico | Sistema avançado como área separada, sem tocar nas páginas existentes |
| RLS leak em novas tabelas | Média | Crítico | Copiar padrão exacto das policies existentes, testar com 2 users de orgs diferentes |
| Gemini API instabilidade | Média | Alto | Fallback para modo offline, retry com backoff, guardar rascunhos |
| Schema drift entre migração e TypeScript types | Alta | Alto | Usar `supabase gen types` após cada migração |
| PDF rendering inconsistente entre templates | Média | Médio | Document Model como camada de abstracção |
| Performance com muitas secções AI | Baixa | Médio | Gerar por secção (não tudo de uma vez), streaming |

---

## 12. PLANO DE IMPLEMENTAÇÃO

### Fase 0: Pré-requisitos (DB + Schema Fix)
- [ ] Criar migração para `advanced_proposals` + `proposal_section_answers`
- [ ] Seed data: 3 business_categories, 3 blueprints, secções e perguntas
- [ ] Regenerar `supabase types.ts`
- [ ] Verificar RLS nas novas tabelas

### Fase 1: Blueprint Engine (Frontend)
- [ ] Página de seleção de categoria → blueprint
- [ ] Componente de listagem de secções e perguntas
- [ ] Formulário dinâmico de perguntas com regras de visibilidade
- [ ] Fluxo: categoria → blueprint → perguntas → respostas


### Fase 2: AI Integration (Por Secção)
- [ ] Prompt builder por secção (usa `content_rules` + `prompt_hint`)
- [ ] Anti-hallucination: AI só preenche dentro da estrutura aprovada
- [ ] Output contract: `{ sectionId, content, warnings, missingInformation }`
- [ ] Validação e armazenamento do conteúdo gerado
- [ ] Edição manual do conteúdo gerado

### Fase 3: Proposal Document Model
- [ ] Interface `ProposalDocument` (abstracção sobre dados)
- [ ] Transform: Blueprint + Answers + AI Content → Document Model
- [ ] Suporte para seções: narrative, items_table, pricing, timeline, terms, custom

### Fase 4: Renderer (HTML/CSS + Playwright)
- [ ] Para templates PREMIUM: renderizar HTML/CSS → Playwright snapshot → PDF
- [ ] Para templates STANDARD: manter jsPDF actual (sem alteração)
- [ ] Hybrid: `isProTemplate()` decide o caminho
- [ ] Componentes de bloco: `NarrativeBlock`, `TableBlock`, `TimelineBlock`, `PricingBlock`

### Fase 5: Brand Profiles
- [ ] UI para configurar cores, fonte, estilo visual
- [ ] Logo analysis via Gemini (extração de cores)
- [ ] Integração com o renderer (brand profile → CSS variables)

### Fase 6: Testes
- [ ] Testes unitários: Document Model, transform functions
- [ ] Testes de serviço: advancedProposalService mock
- [ ] Testes E2E: fluxo completo com Playwright
