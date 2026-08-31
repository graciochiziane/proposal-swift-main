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

### [2026-08-31] — 63 erros TS restantes eliminados: tsc chega a 0

**Tipo:** type safety cleanup + real bug fixes (1 commit)
**Branch:** `feature/multi-user-hierarchy`
**Commits:** `c90a566`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

Eliminação dos últimos 63 erros TS do `tsc -p tsconfig.app.json` (baseline da ronda), em 26 ficheiros. Evolução da sessão: 315 → 127 → 88 → 63 → **0**.

**Lote A — 26 erros de unused** (imports/vars/props/funcções mortas): remoção verificada individualmente por grep antes de cada remoção (regra: nunca remover sem provar zero usos). Inclui remoção de `handleDownloadHtml` (funcção morta) + `getProposalHtmlBlob` (import usado só por ela) e das props `stageColor`/`dotColor` do `OpportunityCard` (destruturação + tipo + 2 call sites — o corpo nunca as usava).

**Lote B — 37 type bugs reais**, com análise de causa raiz:

1. **`DonoProposta` + `email?`/`telefone?`** — os placeholders `{{empresa.email}}`/`{{empresa.telefone}}` (documentados em `AVAILABLE_PLACEHOLDERS`) acediam a campos inexistentes no tipo. Campos opcionais, backwards-compatible; `SAMPLE_EMPRESA` do TemplateManager completado (sem cast).
2. **`pdfExport.ts`** — `ProposalDocument` importado da fonte canónica `documentModel` (não re-exportado por `advancedPdfRenderer`).
3. **`renderTemplatePreview`** — `DOMPurify.sanitize.ALLOWED_TAGS/ALLOWED_ATTR` não existem na função `sanitize` (verificado nos types instalados, dompurify 3.4.14) → em runtime passavam `undefined`, i.e. o sanitize já corria com a allow-list default. Simplificado para `DOMPurify.sanitize(filled)` com comentário — comportamento runtime idêntico, código honesto.
4. **`organizationService`** — `Tables<'organizations'>['Row']` não existe no types.ts regenerado (M4): `Tables<T>` já É o Row. `OrganizationUpdate`/`Enums` removidos (unused).
5. **`profileService`** — casts duplos documentados para `dados_bancarios`/`mobile_money` (fronteira BD Json → tipo de domínio; padrão canónico para colunas jsonb).
6. **`PlanFeaturesDialog`** — `p_limit_value: limitValue ?? undefined` (×2) e omissão do arg no handleAddNew: a RPC `upsert_plan_feature` tem `p_limit_value INTEGER DEFAULT NULL` (migration 20260813150000); o gen types emite `p_limit_value?: number` sem null — omitir = default NULL = "ilimitado" (semântica preservada).
7. **`PlanLimitsDialog`** — `PlanRow.plano: PlanTier` (era `string`; `.eq('plano', ...)` exige o enum), guard `if (adminId)` (semântica non-blocking audit, igual ao precedente useAdminUsers) e `target_id: p.plano` (coluna NOT NULL; plan_limits é identificada pela PK `plano`).
8. **`adminService.logAction`** — `targetTable`/`targetId` agora obrigatórios (coluna `target_id` NOT NULL; os 4 callers já os passavam) e `snapshot?: Json` (o Insert exige Json, não `Record<string, unknown>`).
9. **`GerarPropostaIA`** — `Object.entries(fields) as [keyof PropostaAiFields, string | undefined][]` (×2 loops idênticos).
10. **`propostaService`** — `PropostaResumo.status: StatusProposta` (era `string` — os valores do enum DB são exactamente os 4 do domínio) e `observacoes?: string` adicionado ao select+mapper: **o filtro de busca por observações em Propostas.tsx nunca funcionava** (campo ausente do select). `ProposalWithClient` removido (anotação manual causava TS2345; inferência do select + relationships resolve). Insert de proposta: cast duplo documentado — `numero` NÃO é passado porque o trigger `set_proposal_numero()` o gera quando NULL (migration 20260708010000); o gen types exige `numero` (coluna NOT NULL sem default) porque não conhece triggers. `clienteSnapshot` com cast para o tipo alvo (`Proposta['clienteSnapshot']`).
11. **`advancedProposalService`/`crmService`** — `updates`/`updateData` tipados `TablesUpdate<'...'>`: o `.update()` do supabase rejeita `Record<string, unknown>` (RejectExcessProperties). `updateClienteCRM` reescrito com assignments explícitos por coluna (enum domain = enum DB confirmado: crm_estado/crm_origem idênticos). `description: string | null` da BD mapeado para `''` na fronteira (tipo de domínio exige `string`; consumidores inalterados).
12. **`invitationService`** — guard `if (data.token)` (Row tipa `token: string | null`; warn explícito no caso anómalo) e `nome: ''` no `getByToken` (a RPC `get_invitation_by_token` não devolve `nome` — ver invite_token.sql; comentário adicionado).
13. **`PreencherProposta`/`RevisaoProposta`** — `const proposalId = id` após o guard: o narrowing de `id` não persiste dentro de function declarations hoisted (precedente main.tsx).
14. **`NovaPropostaAvancada`** — `done={false}` no último `StepDot` (prop requerida).

#### Breaking Changes

- **Nenhum** — todos os fixes preservam comportamento runtime (verificados individualmente; os 2 comportamentos que já eram "default" em runtime — sanitize e p_limit_value — mantêm o mesmo output).
- `logAction` (adminService): assinatura tornou-se mais estrita (`targetTable`/`targetId` obrigatórios) — interno ao módulo, todos os callers já cumpriam.

#### Validação

- `tsc --noEmit -p tsconfig.app.json`: **0 erros** (de 63 nesta ronda; 315 no início da sessão)
- `eslint` (26 ficheiros alterados): **0 novos** — 25 problemas pre-existing provados via git stash roundtrip (20 `any`, 1 prefer-const, 1 interface vazia, 1 escape, 2 react-hooks warnings; linhas deslocadas apenas por imports removidos)
- `vitest`: 5/5 pass

#### Rollback

- Tag `checkpoint/2026-08-31-pre-typebugs` (HEAD antes da ronda = `1493098`)
- `git revert c90a566` ou reset para a tag

#### Notas de Segurança

- Nenhuma alteração de RLS/auth/queries — apenas tipos e formas de objectos client-side
- Sem `any` novo; casts duplos apenas em fronteiras BD-Json com documentação

---

### [2026-08-28] — Type bugs reais: 25 erros TS + posthog config inválida

**Tipo:** type safety / analytics fix (2 commits)
**Branch:** `feature/multi-user-hierarchy`
**Commits:** `d46b5d6` (types), `b11f2b6` (posthog)
**Autor:** Agente IA (Master Prompt protocol)

#### Commit 1 — `d46b5d6` fix(types): 24 erros em 6 ficheiros

- `useAdminMetrics.ts:17` — `useState<ReturnType<...>>` → `Awaited<ReturnType<...>>` (função async devolve Promise; runtime já correcto via `await Promise.all`; resolve 17 erros em cascata no MetricsTab)
- `MetricsTab.tsx:22` — removido `planDistribution` placeholder não lido (real vem de useAdminUsers)
- `useAdminUsers.ts:82,114` — `admin_id` extraído para variável + guard `if (admin_id)` (Insert de `admin_audit_log` exige `string`; preserva semântica non-blocking)
- `useOrganization.ts:7,8` — `Enums<'org_role'>` (generic requer type arg); `Tables<'organizations'>` (Tables<T> já é o Row)
- `usePlanFeatures.ts:40` — param `plano` tipado como `Database['public']['Enums']['plan_tier']` (match com Args da RPC `get_plan_features`)
- `main.tsx:9` — const local para preservar narrowing em closures (bindings importados não preservam narrowing — verificado por teste)

#### Commit 2 — `b11f2b6` fix(analytics): posthog.ts

Confirmado por leitura directa das types instaladas (posthog-js 1.396.4 + @posthog/types) e teste de compilação individual de cada prop:

1. `mask_inputs: [...]` — **NÃO existe** em `PostHogConfig`. Era silenciosamente ignorado → email/tel/number **não estavam mascarados** nos session replays. Substituído por `session_recording.maskInputOptions` — **activa a máscara pretendida** (melhoria real de privacidade; password já mascarado por default do rrweb)
2. `ip_anonymization_default: true` — **NÃO existe**; prop `ip` equivalente está deprecated com NO EFFECT. Anonimização de IP é setting server-side do PostHog
3. `pageview_ignore_list: [...]` — **NÃO existe**; irrelevante porque `capture_pageview: false` (a app rastreia pageviews via `useActivityTracker` próprio)

#### Breaking Changes

Nenhuma. Commit 1 é type-level (runtime inalterado). Commit 2: remover props inválidas = zero mudança runtime (eram ignoradas); `maskInputOptions` = activa comportamento pretendido.

#### Análise de Impacto

- **Evolução erros TS:** 88 → 63 (−25)
- Cascata positiva: `Propostas.tsx` 8 → 7 (fix de `useOrganization`)
- eslint: 11 problemas pre-existing nos ficheiros tocados (confirmado via git stash roundtrip — 0 novos); `posthog.ts` limpo
- ⚠️ **PENDÊNCIA UTILIZADOR (PostHog):** activar "Discard IP data" no dashboard do projecto PostHog (server-side) — o client nunca controlou isto; a prop que constava no código nunca funcionou

#### Rollback

```bash
git revert d46b5d6 b11f2b6
```

#### Testes

- `tsc --noEmit`: 88 → 63 (0 novos)
- `eslint`: 0 novos (11 pre-existing)
- `vitest`: 5/5 pass

#### Notas de Segurança

- Nenhum token/credencial exposto; `import.meta.env` usado como no código original

---

### [2026-08-28] — Lote de 3 fixes: P3-config + test types + lint cleanup

**Tipo:** config fix / test fix / lint cleanup (3 commits)
**Branch:** `feature/multi-user-hierarchy`
**Commits:** `9d2ad23` (config), `00ee789` (test), `5a956d2` (lint)
**Autor:** Agente IA (Master Prompt protocol)

#### Commit 1 — `9d2ad23` fix(config): P3 — actualizar project ref legacy

- `supabase/config.toml`: project_id `ytbgfrbhyclnfdftmnoy` → `ewlkdrwrespnxyddwtgo`
- `PROJETO_STATUS.md`: URL Supabase actualizada
- Risco nulo: config é metadata do CLI; app usa `VITE_SUPABASE_URL` (client.ts)

#### Commit 2 — `00ee789` test(types): fix erros TS em calculos.test.ts

- Import explícito `describe/test/expect` de `vitest` (globals: true não dava tipos ao TS)
- Test objects completos com `id, nome, subtotal` (exigidos por `ItemProposta`)
- 19 erros TS eliminados; `bun run test` → 5/5 pass

#### Commit 3 — `5a956d2` chore(lint): remover 20 vars/imports não usados

- 10 ficheiros, todos verificados individualmente (leitura de código + tsc)
- Casos notáveis: `const [, setStep]` (setStep usado em 3 locais); params `_`-prefix em advancedPdfRenderer (assinaturas preservadas); `isProTemplate` removido do TemplateSelectorModal (M12 enforcement permanece pendente — componente usa `t.pro` para badge, mas não bloqueia selecção PRO por plano)
- 20 erros TS eliminados (evolução: 127 → 108 → 88)

#### Breaking Changes

Nenhuma — remoção de código morto, import de testes, e actualização de config.

#### Análise de Impacto

- **Evolução de erros TS nesta sessão:** 127 → 88 (39 eliminados)
- **ESLint:** 6 problemas pre-existing nos ficheiros tocados — **confirmado via git stash roundtrip que zero foram introduzidos por estes edits**:
  - `Organizacao.tsx:44` — `any` (pre-existing, Master Prompt secção 21: não usar any — fix pendente)
  - `advancedPdfRenderer.ts:396-398` — prefer-const r/g/b (pre-existing)
  - `propostaService.ts:53` — interface vazia `PropostaCompleta extends Proposta {}` (pre-existing)
  - `useAuth.tsx:143` — react-refresh warning (pre-existing)

#### Ficheiros Alterados

- Commit 1: `supabase/config.toml`, `PROJETO_STATUS.md`
- Commit 2: `src/lib/__tests__/calculos.test.ts`
- Commit 3: `propostaService.ts`, `UserProfile.tsx`, `TemplateSelectorModal.tsx`, `useAuth.tsx`, `advancedPdfRenderer.ts`, `narrativa.ts`, `Admin.tsx`, `GerarPropostaIA.tsx`, `Organizacao.tsx`, `Propostas.tsx`

#### Rollback

```bash
git revert 9d2ad23 00ee789 5a956d2  # inverte os 3 commits
```

#### Testes

- `tsc --noEmit`: 127 → 88 erros (0 novos)
- `eslint` (10 ficheiros alterados): 6 problemas pre-existing, 0 novos (confirmado)
- `vitest`: 5/5 tests pass

---

### [2026-08-28] — M4 completo: regenerar types.ts via `supabase gen types`

**Tipo:** type safety / bug fix
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `<a definir no commit>`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

- Regenerado `src/integrations/supabase/types.ts` via `npx supabase gen types typescript --project-id ewlkdrwrespnxyddwtgo` (Supabase CLI v2.116.0)
- Ficheiro passou de 1191 linhas (stale 2026-08-19) para 1922 linhas (+62%)
- 1441 adições, 712 remoções no diff vs versão anterior
- **Tabela nova adicionada:** `pdf_templates` (com colunas `html`, `is_system`, `is_active`, `plan_tier`, `sort_order`, etc.)
- **Tabela renomeada:** `graphql_public` → `graphql` (interno Supabase)
- **Funções RPC novas populadas:** `accept_invitation`, `admin_most_active_users`, `admin_remove_member`, `admin_toggle_suspend`, `transfer_ownership`, `upsert_plan_feature`, etc.
- **Relationships agora populadas** com `foreignKeyName`/`columns`/`isOneToOne` (antes vazias `[]`)

#### Breaking Changes

Nenhuma — ficheiro de tipos compile-time substituído por versão gerada oficialmente pelo Supabase CLI. Não afecta runtime nem schema.

#### Análise de Impacto

- **Erros TS antes do M4 completo** (após M4a): **315** (incluindo ~255 em cascata revelados pelo fix sintáctico)
- **Erros TS após M4 completo:** **127**
- **Redução:** **188 erros eliminados** (~60% de redução global)
- Caso paradigmático: `src/services/propostaService.ts` passou de **45 → 6 erros** (redução de 87%)
  - 3 erros remanescentes são unused vars (TS6133/TS6196) — fix trivial
  - 3 erros são bugs de tipo reais (TS2345/TS2352/TS2322) que precisam fix individual
- Distribuição residual por ficheiro (top 5):
  - `src/lib/__tests__/calculos.test.ts` (19) — falta `@types/jest`/`@types/vitest`
  - `src/pages/admin/MetricsTab.tsx` (17) — bugs de tipo pré-existentes
  - `src/pages/Propostas.tsx` (8) — unused vars + bugs de tipo
  - `src/pages/GerarPropostaIA.tsx` (7) — bugs de tipo pré-existentes
  - `src/services/propostaService.ts` (6) — 3 unused + 3 bugs de tipo reais
- Os erros residuais são maioritariamente:
  1. Unused imports/vars (TS6133/TS6196) — fix trivial
  2. Falta de `@types/jest` em ficheiros de teste (TS2582/TS2304)
  3. Bugs de tipo reais em services/components que precisam fix individual

#### Ficheiros Alterados

- `src/integrations/supabase/types.ts` — substituição completa (1191 → 1922 linhas)

#### Risco

**Baixo.** Ficheiro compile-time gerado oficialmente pelo Supabase CLI. Schema reflectido é o do projecto Supabase activo (`ewlkdrwrespnxyddwtgo`).

#### Pendências

- **Findings de configuração detectados** (documentar em P3 separado):
  1. `supabase/config.toml` tem `project_id = "ytbgfrbhyclnfdftmnoy"` (legacy/antigo) — deveria ser `ewlkdrwrespnxyddwtgo`
  2. `PROJETO_STATUS.md` referencia `https://ytbgfrbhyclnfdftmnoy.supabase.co` (legacy/antigo)
  3. `.env` histórico (commit `a02cca8`) também tinha `ytbgfrbhyclnfdftmnoy` (legacy/antigo)
  - Conclusão: projecto foi migrado de `ytbgfrbhyclnfdftmnoy` → `ewlkdrwrespnxyddwtgo` em momento não documentado; ficheiros de configuração não foram actualizados.
  - Acção: corrigir `supabase/config.toml` e `PROJETO_STATUS.md` num commit separado (item P3 novo).
- **Limpeza de unused vars** — fix trivial em ficheiros como `propostaService.ts` (3 unused), `useAuth.tsx` (1 unused), `UserProfile.tsx` (1 unused), `pages/Admin.tsx` (1 unused), etc. Pode ser feito em batch num commit de lint cleanup.
- **Fix dos bugs de tipo reais** — 6 erros em `propostaService.ts` (3 unused + 3 reais), 17 em `MetricsTab.tsx`, etc. Item separado.

#### Rollback

```bash
git checkout HEAD~1 -- src/integrations/supabase/types.ts
# ou
git reset --hard checkpoint/2026-08-28-pre-m4-full
```

#### Testes

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`:
  - **Antes (após M4a):** 315 erros TS
  - **Após M4 completo:** 127 erros TS
  - **Redução:** 188 erros eliminados (~60%)
- Sem alterações em runtime — types.ts é compile-time only
- Testes unitários não afectados

#### Notas de Segurança

- Access token Supabase (`sbp_***`) usado exclusivamente via variável de ambiente `SUPABASE_ACCESS_TOKEN` no comando `npx supabase gen types`
- Token NÃO foi echoado em output, NÃO foi gravado em ficheiro, NÃO foi commitado
- ⚠️ Token deve ser **revogado pelo utilizador** após conclusão do trabalho (ver `download/P0_C7_CREDENCIAIS_ROTACAO.md` secção 5)
- DB password `OperaOmnia#89` continua exposto (em P0-C7, rotação pendente pelo utilizador)

---

### [2026-08-28] — M4a: fix sintáctico duplicates em types.ts (subset de M4)

**Tipo:** type safety / bug fix
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `<a definir no commit>`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

- Removido duplicate `p_min_role` na declaração de `has_org_role_min` (linha 1151 — chaves duplicadas no mesmo objecto `Args`)
- Removida 2ª definição de `has_role` (linhas 1154-1155 — função definida 2x no mesmo bloco `Functions`)
- Removida declaração `type SupabaseClient = ...` não usada (linha 1185)
- Adicionado comentário `// FIXME(M4)` a documentar que types.ts está stale e precisa regeneração completa
- Adicionado `supabase/.temp/` ao `.gitignore` (artefactos do CLI não devem ser commitados)
- Removidos ficheiros `supabase/.temp/cli-latest` e `supabase/.temp/linked-project.json` (criados por `npx supabase` em sessão anterior, estavam em staged)

#### Breaking Changes

Nenhuma — fix é puramente sintáctico, não altera schema nem tipos reais.

#### Análise de Impacto

- **Erros TS eliminados:** 5 (4× TS2300 Duplicate identifier + 1× TS6196 unused)
- **Erros TS revelados em cascata:** ~255 — todos pré-existentes mas mascarados porque types.ts não compilava
  - Padrão dominante: `Property 'X' does not exist on type 'never'` em services que fazem joins Supabase (`propostaService`, `analyticsService`, `invitationService`, `profileService`, `clienteService`, `faturaService`, etc.)
  - **Causa raiz:** `Relationships: []` vazias em definições de tabelas no types.ts (ex.: `proposals` linha 954, `proposal_items` linha 805)
  - Quando supabase-js faz `.select('*, proposal_items(*)')` e a relação não está declarada no tipo, o TypeScript infere como `never`
- **Resolução definitiva:** M4 completo (regenerar types via `supabase gen types`) — pendente de access token Supabase

#### Ficheiros Alterados

- `src/integrations/supabase/types.ts` — 3 remoções + 4 linhas de comentário FIXME
- `.gitignore` — adicionada regra `supabase/.temp/`
- `supabase/.temp/cli-latest` — removido (não tracked anteriormente)
- `supabase/.temp/linked-project.json` — removido (não tracked anteriormente)

#### Risco

**Muito baixo.** Fix puramente sintáctico em ficheiro de tipos compile-time. Não afecta runtime nem schema.

#### Pendências

- **M4 completo:** regenerar `types.ts` via `npx supabase gen types typescript --project-id <ref>` (requer access token Supabase que não está disponível no sandbox)
  - Vai popular `Relationships` correctamente e resolver os ~255 erros em cascata
  - Project ref canónico: `ytbgfrbhyclnfdftmnoy` (em `supabase/config.toml` e `PROJETO_STATUS.md`)
  - ⚠️ Conflito detectado: `CHANGELOG_ARCHITECTURE.md` (escrito em sessão anterior) referia `ewlkdrwrespnxyddwtgo` — projecto Supabase diferente. Usar `ytbgfrbhyclnfdftmnoy` como canónico até confirmação do utilizador.

#### Rollback

```bash
git checkout HEAD~1 -- src/integrations/supabase/types.ts .gitignore
# ou
git reset --hard checkpoint/2026-08-28-pre-m4
```

#### Testes

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`:
  - **Antes do fix:** types.ts tinha 5 erros sintácticos (TS2300 ×4 + TS6196 ×1) que bloqueavam análise de dependências
  - **Após o fix:** types.ts compila. Erros em cascata revelados (não ocultados — Master Prompt secção 21)
- Sem alterações em runtime — testes unitários não afectados

#### Notas de Segurança

- Não foram expostas credenciais neste commit
- `supabase/.temp/` continha apenas `cli-latest` (versão do CLI) e `linked-project.json` (metadados do projecto) — sem secrets

---

### [2026-08-26] — M18: vitest coverage config

**Tipo:** test infrastructure
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `<a definir no commit>`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

- Adicionada config `coverage` em `vitest.config.ts` usando `v8` provider (padrão Vitest 3.x)
- Adicionada dependência `@vitest/coverage-v8@3.2.4` em `devDependencies` (versão correspondente a `vitest@^3.2.4`)
- Adicionado script `test:coverage` em `package.json`
- Adicionado `coverage/` ao `.gitignore` (output não é commitado)
- Reporters: `text` (console), `json` (CI), `html` (local dev)
- **Sem thresholds enforcement** — cobertura actual é ~0% (apenas 5 testes em `calculos.test.ts`), falhar build seria contraproducente
- Verify: `bun run test:coverage` → 5 tests pass + 100% coverage em `calculos.ts`

#### Breaking Changes

Nenhum — `test` script original mantido. `test:coverage` é novo e opcional.

#### Ficheiros Alterados

- `vitest.config.ts` — adicionada secção `coverage` dentro de `test` (24 linhas)
- `package.json` — adicionado script `test:coverage` + dep `@vitest/coverage-v8@3.2.4`
- `.gitignore` — adicionada linha `coverage/` (na secção sandbox artifacts)
- `bun.lock` — auto-actualizado por `bun add`

#### Testes

- `bun run test:coverage` — ✅ 5 tests pass, 100% coverage em `calculos.ts` (único ficheiro com testes)
- Coverage report HTML gerado em `coverage/index.html` (verificado, depois apagado para não commitar)

#### Segurança

N/A — item de infra-estrutura de testes, sem impacto em produção.

#### Rollback

- `git revert HEAD` para reverter a adição da config
- Alternativamente: remover a secção `coverage` do `vitest.config.ts` e o script `test:coverage` do `package.json`

#### Notas

- **Sem thresholds enforcement** — item separado poderia adicionar thresholds (ex: 80% mínimo) quando cobertura for significativa. Adicionar agora com 0% de cobertura iria falhar todos os builds.
- **Exclusões:** testes próprios, setup, types gerados (`types.ts`), components UI (shadcn gerado), `main.tsx`, `vite-env.d.ts`, `App.tsx` — estes não são código de aplicação que precisa de testes.

---

### [2026-08-26] — M17: sanitize pathname em useActivityTracker

**Tipo:** security
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `<a definir no commit>`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

- Adicionada função local `sanitizePath(pathname)` no hook `useActivityTracker`
- Strip de query string e hash fragment (split em `?` ou `#`)
- Validação que começa com `/` (fallback para `/`)
- Cap de comprimento em 500 chars (previne DoS em INSERTs em `user_activity.page`)
- Defensivo: `location.pathname` do react-router-dom já retorna pathname limpo, mas isto protege contra refactors futuros

#### Breaking Changes

Nenhum — interface pública do hook não mudou.

#### Ficheiros Alterados

- `src/hooks/useActivityTracker.tsx` — adicionada função `sanitizePath` (não exportada) + linha 45 alterada para chamar `sanitizePath(location.pathname)` em vez de `location.pathname` directo

#### Testes

- `eslint src/hooks/useActivityTracker.tsx` — ✅ 0 errors
- `tsc --noEmit -p tsconfig.app.json` em `useActivityTracker.tsx` — ✅ 0 errors neste ficheiro
- ⚠️ Pre-existing: 6 errors TS em `propostaService.ts` (causados por `types.ts` stale — ver M4 pendente)

#### Segurança

- Prevenção de DoS em `user_activity.page` column (cap 500 chars)
- Prevenção de path injection (validação `/` prefix)
- Defense in depth: não depende do comportamento do react-router

#### Rollback

- `git revert HEAD` para reverter a adição de `sanitizePath`

#### Conflito TS detectado

- `package.json` linha 28: `"typescript": "^7.0.2"` — mas o código foi escrito para TS 5.8 (per CHANGELOG secção 2)
- TS 7.0.2 quebra ESLint (TypeError: Cannot read properties of undefined (reading 'Cjs') em `@typescript-eslint/typescript-estree`)
- **Workaround neste sandbox:** instalei TS 5.8.3 localmente para validar
- **Pendência:** decidir se `package.json` é actualizado para `^5.8.3` ou se código/types são actualizados para TS 7 (item separado, não misturado com M17)

#### ADRs Relacionados

- ADR-006 (Tipos TypeScript via `supabase gen types`) — agora `types.ts` stale causa erros TS em `propostaService.ts`. M4 continua pendente.

---

### [2026-08-26] — Redaction de credencial literal + criação do doc P0_C7

**Tipo:** security + docs
**Branch:** `feature/multi-user-hierarchy`
**HEAD:** `382f8df`
**Autor:** Agente IA (Master Prompt protocol)

#### Sumário

- Criado `download/P0_C7_CREDENCIAIS_ROTACAO.md` (estava referenciado desde 2026-08-13 mas nunca existia — 427 linhas, 10 secções)
- Redacted password literal `OperaOmnia#89` da linha 537 deste ficheiro (vulnerabilidade adicional identificada durante análise 2026-08-26)
- Marcado M16 como parcialmente concluído (parte crítica resolvida por work anterior)

#### Breaking Changes

Nenhum — apenas docs.

#### Ficheiros Criados

- `/home/z/my-project/repos/proposal-swift-main/download/P0_C7_CREDENCIAIS_ROTACAO.md` — documento canónico de rotação de credenciais

#### Ficheiros Alterados

- `CHANGELOG_ARCHITECTURE.md` linha 537 — redact da password literal
- `CHANGELOG_ARCHITECTURE.md` secção 5.3 (M16) — marcado como parcialmente concluído

#### Testes

- N/A (apenas alterações de documentação)

#### Segurança

- Password literal exposta desde 2026-08-13 neste ficheiro — agora redacted
- Inventory completo de 10 credenciais a rotacionar documentado em P0_C7_CREDENCIAIS_ROTACAO.md
- Procedimento de purge do git history formalizado (destrutivo, requer acção manual)

#### Pendências

- Execução manual da rotação de credenciais (ver P0_C7_CREDENCIAIS_ROTACAO.md)
- Execução do `git filter-repo` para purgar `.env` do history (destrutivo, requer backup + force-push)
- Edge Function deployment — P0+P1 fixes ainda não deployed em produção

#### Rollback

- `git revert 382f8df` para reverter o commit do doc
- Edit manual para restaurar linha 537 com a password literal (NÃO recomendado)

---

### [2026-08-13] — Plan Features System + Propostas Avançadas Tab + Admin UI

**Tipo:** feat (new functionality)
**Branch:** `feature/multi-user-hierarchy` (merge P0+P1 + new features)
**HEAD:** `552f729`
**Autor:** Agente IA (skill: `proposaja-engineering`)

#### Sumário

- Merge dos 19 fixes P0+P1 (7 critical + 12 high) neste branch
- Novo sistema modular de features por plano (`plan_features` table)
- Nova aba "Propostas Avançadas" na sidebar + página de listagem
- Nova UI de super admin para gerir features por plano
- 4 commits de feature + 1 merge commit

#### Funcionalidades Implementadas

**1. Plan Features System (migration + RPCs):**

| Componente | Descrição |
|---|---|
| `plan_features` table | Pares (plano, feature_key) com `enabled` + `limit_value` |
| `has_plan_feature(plano, key)` | Helper SQL → BOOLEAN |
| `get_plan_feature_limit(plano, key)` | Helper SQL → INTEGER (NULL = ilimitado) |
| `get_plan_features(plano)` | RPC para frontend → TABLE |
| `upsert_plan_feature(plano, key, enabled, limit)` | RPC para admin (REVOKE'd de anon) |

Seed inicial: 5 features × 3 planos = 15 rows
- `advanced_proposals`: enabled para todos (gate será activado quando lançar planos comerciais)
- `custom_branding`: free=false, pro/business=true
- `multi_user`: free=3, pro=10, business=ilimitado
- `api_access`: apenas business
- `pdf_export`: todos

**2. Hook `usePlanFeatures`:**
- `hasFeature(key)` → boolean
- `getFeatureLimit(key)` → number | null
- Cache por organização, recarrega em org switch

**3. Página `PropostasAvancadas.tsx` (nova):**
- Lista `advanced_proposals` da organização actual
- Estados: loading, empty, error, success (princípio 26)
- Status badges (rascunho, em_preenchimento, em_revisao, concluida, exportada)
- Progress bar para propostas incompletas
- Delete com confirmação
- Botão "Nova Proposta" (gated por `hasFeature('advanced_proposals')`)
- Empty state com CTA

**4. Sidebar + Rota:**
- Novo item "Propostas Avançadas" com ícone Sparkles
- Visível para todos os utilizadores (gate por plano será activado depois)
- Rota `/propostas-avancadas` em App.tsx

**5. Super Admin UI (`PlanFeaturesDialog`):**
- Botão "Features" ao lado de "Planos" em Admin → Tenants
- Grid: features × planos (free/pro/business)
- Toggle on/off via Switch
- Input de limite (vazio = ilimitado)
- Adicionar nova feature (cria para os 3 planos, desactivada)
- Eliminar feature (remove de todos os planos)
- Updates optimistas com rollback em erro
- Toasts de sucesso/erro

#### Ficheiros Criados

- `supabase/migrations/20260813150000_plan_features_system.sql` — Migration
- `src/hooks/usePlanFeatures.ts` — Hook para frontend
- `src/pages/PropostasAvancadas.tsx` — Página de listagem
- `src/pages/admin/PlanFeaturesDialog.tsx` — UI de super admin

#### Ficheiros Alterados

- `src/components/AppLayout.tsx` — adicionado item na sidebar
- `src/App.tsx` — adicionada rota `/propostas-avancadas`
- `src/pages/admin/TenantsTab.tsx` — adicionado botão "Features" + dialog

#### Database

Migration `20260813150000_plan_features_system.sql` aplicada ao vivo:
- Nova tabela `plan_features` (15 rows seeded)
- 4 novas funções SQL (todas SECURITY DEFINER)
- RLS: read para authenticated, write para admin apenas
- `upsert_plan_feature` REVOKE'd de PUBLIC/anon

#### Testes

- Typecheck: `tsc --noEmit` — ✅ passa
- Lint: `eslint .` — 70 erros pré-existentes
- Build: `vite build` — ✅ 11.63s
- Bundle scan: `grep "AIzaSy\|OperaOmnia\|sbp_8a741\|ghp_TXBO" dist/assets/*.js` — ✅ zero matches
- Verificações ao vivo: `has_plan_feature`, `get_plan_feature_limit`, `get_plan_features` — todas OK

#### Breaking Changes

Nenhum — todas as funcionalidades são aditivas.

#### Pendências

1. **Deploy para staging:** Vercel auto-deploy do branch `staging` (que precisa de ser actualizado para apontar para `feature/multi-user-hierarchy` ou merged)
2. **Deploy das Edge Functions:** `supabase functions deploy generate-proposal`, `generate-section`, `send-invite-email`
3. **Gate por plano comercial:** Quando lançar planos comerciais, actualizar seeds em `plan_features` para reflectir os tiers reais
4. **Rotação de credenciais:** Continua pendente (ver `download/P0_C7_CREDENCIAIS_ROTACAO.md`)

#### ADRs Relacionados

- ADR-007 (novo): Plan Features System — abordagem modular em vez de colunas avulsas em `plan_limits`

---

### [2026-08-13] — P1 Security High Fixes (12/12 high findings corrigidos)

**Tipo:** security + fix
**Branch:** `fix/p1-security-high` (baseada em `fix/p0-security-critical` @ `cf02421`)
**HEAD:** `8e62912`
**Autor:** Agente IA (skill: `proposaja-engineering`)

#### Sumário

- 12 de 12 findings high (P1) da auditoria E2E corrigidos
- 8 implementados de novo + 4 já estavam corrigidos por work anterior
- 13 commits incrementais com checkpoints entre cada fix
- Typecheck ✅ | Lint (70 erros pré-existentes) | Build ✅ (11.14s)

#### Fixes Aplicados

| ID | Fix | Commit | Notas |
|---|---|---|---|
| H1 | Hardened `has_role(uuid, text)` search_path (era vazio) | `fef3ac1` | 38 policies dependem do overload — não foi possível DROP, mas search_path corrigido |
| H2 | Confirmado que `transfer_ownership` já tem filtro `organization_id` | `1143377` | Regressão foi corrigida em migration posterior |
| H3 | Confirmado que `geracoes_ia_mes` defaults já estão correctos | `b4f3f14` | `ia_rate_limit.sql` corrigiu os valores |
| H4 | Criada tabela `platform_admins` + helper `is_platform_admin_email()` | `5febcfa` | Substitui email hardcoded em `handle_new_user()` |
| H5 | `requireAdmin()` adicionado a 10 funções em `adminService.ts` | `5670b30` | Defense in depth |
| H6 | `requireAdmin()` adicionado a 6 métodos em `analyticsService.ts` | `081e9df` | `trackPageVisit` mantém aberto (RLS protege) |
| H7 | Verificação de membership antes de insert em `createAdvancedProposal` | `9455ac8` | Impede criar propostas em orgs alheias |
| H8 | `getUser()` adicionado a `cancel` e `resend` em `invitationService` | `9c1e8b4` | `getByToken` mantém aberto (página pública) |
| H9 | Allowlist de modelos Gemini via `_shared/gemini.ts` | `5b65255` | `validateGeminiModel()` aplicado em ambas Edge Functions |
| H10 | Stack traces removidos do response; HTTP 500 em vez de 200 | `d2efbf3` | Stack continua em `console.error` server-side |
| H11 | `ProtectedRoute` com prop `roles={['admin']}` + cache de role | `67bfd10` | Aplicado a `/admin/*` em App.tsx |
| H12 | Confirmado modelo Gemini unificado (`gemini-3.1-flash-lite`) | `8e62912` | Já corrigido em P0-C1 |

#### Ficheiros Criados

- `supabase/migrations/20260813130000_p1_h1_has_role_search_path.sql` — H1
- `supabase/migrations/20260813140000_p1_h4_platform_admins_table.sql` — H4
- `supabase/functions/_shared/gemini.ts` — H9 (allowlist de modelos)
- `src/services/authHelpers.ts` — H11 (cache de role para ProtectedRoute)

#### Ficheiros Alterados

- `src/services/adminService.ts` — H5 (10 funções com requireAdmin)
- `src/services/analyticsService.ts` — H6 (6 métodos com requireAdmin)
- `src/services/advancedProposalService.ts` — H7 (validação de membership)
- `src/services/invitationService.ts` — H8 (auth em cancel/resend)
- `supabase/functions/generate-proposal/index.ts` — H9 (validateGeminiModel) + H10 (sem stack)
- `supabase/functions/generate-section/index.ts` — H9 (validateGeminiModel)
- `src/components/ProtectedRoute.tsx` — H11 (prop roles)
- `src/hooks/useAuth.tsx` — H11 (refreshRole/clearRoleCache)
- `src/App.tsx` — H11 (rotas /admin com role guard)
- `CHANGELOG_ARCHITECTURE.md` — actualização histórica

#### Database

Migrations aplicadas ao vivo na BD Supabase:

- `20260813130000_p1_h1_has_role_search_path.sql`:
  - `has_role(uuid, text)` recriada com `SET search_path TO 'public'` (era vazio)
  - 38 policies dependentes mantidas intactas

- `20260813140000_p1_h4_platform_admins_table.sql`:
  - Nova tabela `platform_admins` (user_id PK, email, granted_by, granted_at, active, notes)
  - RLS habilitada (apenas platform admins podem ler/escrever)
  - Helper function `is_platform_admin_email(p_email TEXT) → BOOLEAN`
  - `handle_new_user()` refactorizada para usar helper em vez de email hardcoded
  - Email existente migrado para a tabela (1 row: graciochiziane@gmail.com)

#### Testes

- Typecheck: `tsc --noEmit` — ✅ passa
- Lint: `eslint .` — 70 erros pré-existentes (mesmo nível do branch P0)
- Build: `vite build` — ✅ 11.14s, 3038 módulos
- Verificações ao vivo na BD: H1 (search_path), H4 (platform_admins row), H2/H3 (queries directas)

#### Segurança

Melhorias adicionais de defesa em profundidade:

| Camada | Antes | Depois |
|---|---|---|
| Frontend route guard | Apenas `user != null` | `roles={['admin']}` em /admin/* |
| Client-side service auth | Nenhuma | `requireAdmin()` em 16 funções (admin + analytics) |
| Membership validation | RLS apenas | Verificação explícita em `createAdvancedProposal` |
| Gemini model selection | Caller-supplied | Allowlist com fallback para default |
| Error responses | Stack traces leaked | Stack apenas server-side |
| Platform admin management | Hardcoded email | Tabela `platform_admins` (adicionar/remover sem código) |
| `has_role` security | search_path vazio | search_path=public |

#### Regressão

- Fluxo login: ✅ (não afectado — refreshRole é best-effort)
- Fluxo proposta simples: ✅
- Fluxo PDF: ✅
- Fluxo proposta avançada: ✅
- Fluxo admin: ✅ (agora com role guard no route + requireAdmin nos services)
- Fluxo invite: ✅ (getByToken mantém-se aberto para /invite/accept)
- Multi-tenant isolation: ✅ (RLS não modificada, apenas grants em funções)

#### Problemas Pendentes

Nenhum — todos os 12 P1 resolvidos.

#### ADRs Relacionados

- ADR-001 (Admin hardcoded email) — substituído por ADR-002 (platform_admins table)
- ADR-002 (platform_admins) — implementado em H4
- ADR-005 (Gemini via Edge Function) — allowlist adicionada em H9

#### Referências

- Audit: `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` secção 12.2
- Skill: `proposaja-engineering` princípios 2, 6, 14, 17, 36, 37
- Branch P0: `fix/p0-security-critical` (herdado)
- PR P0: #1

---

### [2026-08-13] — P0 Security Critical Fixes (7/7 critical findings corrigidos)

**Tipo:** security + fix + breaking
**Branch:** `fix/p0-security-critical` (baseada em `feature/multi-user-hierarchy` @ `73af970`)
**HEAD:** `1ef54b7`
**Autor:** Agente IA (skill: `proposaja-engineering`)

#### Sumário

- 7 de 7 findings críticos (P0) da auditoria E2E corrigidos
- 5 commits incrementais com checkpoints entre cada fix
- Typecheck ✅ | Lint (70 erros pré-existentes, -3 vs base) | Build ✅ (12.56s)
- Bundle de produção verificado: **zero secrets hardcoded**

#### Fixes Aplicados

| ID | Fix | Ficheiros |
|---|---|---|
| C1 | Removida Gemini API key hardcoded do bundle client | `src/services/geminiClient.ts` (deletado), `src/services/propostaAiSectionService.ts` (refactor: sem fallback directo, Edge Function apenas) |
| C2 | REVOKE EXECUTE de PUBLIC/anon em 10 funções SQL + has_role('admin') check interno em 4 | `supabase/migrations/20260813120000_p0_c2_revoke_admin_execute.sql` (303 linhas) |
| C3 | Adicionada JWT verification em `send-invite-email` Edge Function | `supabase/functions/send-invite-email/index.ts`, `supabase/functions/_shared/auth.ts` (novo) |
| C4 | CORS `*` substituído por allowlist em 3 Edge Functions | `supabase/functions/_shared/cors.ts` (novo), `generate-proposal/index.ts`, `generate-section/index.ts`, `send-invite-email/index.ts` |
| C5 | escapeHtml adicionado em `documentModel.ts` antes de markdown→HTML | `src/lib/advanced/documentModel.ts` |
| C6 | Rota quebrada corrigida em `PreencherProposta.tsx` | `src/pages/advanced/PreencherProposta.tsx:180` |
| C7 | 4 ficheiros com DB password hardcoded removidos + documento de rotação criado | `scripts/run_migration.{cjs,mjs}` (deletados), `scripts/proposaja_db_backup_restore.sql` (deletado), `download/proposaja_db_backup_restore.sql` (deletado), `download/P0_C7_CREDENCIAIS_ROTACAO.md` (novo) |

#### Breaking Changes

- **Edge Function `send-invite-email`**: agora requer header `Authorization: Bearer <jwt>`. Chamadas anónimas passam a falhar com 401.
- **Edge Functions IA**: CORS reflecte apenas origins na allowlist (`proposta2.vercel.app`, `proposal-swift-staging.vercel.app`, `localhost:5173/4173/3000`). Outros origins recebem header vazio.
- **Funções admin SQL**: chamadas anónias (com chave anon apenas) falham com `Acesso negado: apenas admins de plataforma`.
- **`propostaAiSectionService`**: removido fallback directo ao Gemini. Se Edge Function falhar após 3 retries, lança erro em vez de usar API key hardcoded.
- **Modelo Gemini unificado**: `RevisaoProposta.tsx` agora usa `gemini-3.1-flash-lite` (consistente com Edge Function e `propostaAiService.ts`).

#### Ficheiros Criados

- `supabase/migrations/20260813120000_p0_c2_revoke_admin_execute.sql` — Migration C2
- `supabase/functions/_shared/cors.ts` — Helper CORS partilhado
- `supabase/functions/_shared/auth.ts` — Helper JWT verification partilhado
- `download/P0_C7_CREDENCIAIS_ROTACAO.md` — Documento de execução manual para rotação de 6 credenciais + purge de git history

#### Ficheiros Alterados

- `src/pages/advanced/PreencherProposta.tsx` — rota `/revisao-proposta/:id` (C6)
- `src/pages/advanced/RevisaoProposta.tsx` — modelo Gemini unificado (H12)
- `src/services/propostaAiSectionService.ts` — refactor sem fallback directo (C1)
- `src/lib/advanced/documentModel.ts` — escapeHtml antes de markdown (C5)
- `supabase/functions/generate-proposal/index.ts` — CORS allowlist (C4)
- `supabase/functions/generate-section/index.ts` — CORS allowlist (C4)
- `supabase/functions/send-invite-email/index.ts` — JWT verification + CORS (C3+C4)

#### Ficheiros Deletados

- `src/services/geminiClient.ts` — continha API key hardcoded (C1)
- `scripts/run_migration.cjs` — continha DB password + ssl:false (C7)
- `scripts/run_migration.mjs` — continha DB password + ssl:false (C7)
- `scripts/proposaja_db_backup_restore.sql` — continha password em exemplos pg_dump (C7)
- `download/proposaja_db_backup_restore.sql` — duplicado do acima (C7)

#### Database

- Migration aplicada ao vivo: `20260813120000_p0_c2_revoke_admin_execute.sql`
- 4 funções admin recriadas com `has_role('admin')` check interno:
  - `admin_platform_metrics()`
  - `admin_signups_by_day(INTEGER)`
  - `admin_most_active_users(INTEGER, INTEGER)`
  - `organization_health_score(UUID)` (também permite owner/admin da própria org)
- `REVOKE EXECUTE FROM PUBLIC, anon` em 10 funções:
  - `admin_platform_metrics`, `admin_signups_by_day`, `admin_most_active_users`
  - `admin_toggle_suspend`, `admin_remove_member`, `organization_health_score`
  - `transfer_ownership`, `accept_invitation`
  - `get_invitation_by_token`, `get_my_pending_invitations`
- Verificado ao vivo: 0 funções com EXECUTE para PUBLIC/anon (era 10)

#### Testes

- Typecheck: `tsc --noEmit` — ✅ passa
- Lint: `eslint .` — 70 erros pré-existentes (73 no branch base, -3)
- Build: `vite build` — ✅ 12.56s, 3038 módulos
- Bundle scan: `grep "AIzaSy\|OperaOmnia\|sbp_8a741\|ghp_TXBO" dist/assets/*.js` — ✅ zero matches
- Teste manual XSS (C5): 6/6 testes passaram (script tag, img onerror, markdown preservado)

#### Segurança

- ✅ Auth: Edge Function `send-invite-email` agora verifica JWT
- ✅ RLS: 10 funções admin protegidas com has_role check interno + REVOKE de anon
- ✅ Secrets: Gemini key removida do bundle; 4 ficheiros com DB password removidos
- ✅ XSS: escapeHtml em conteúdo IA antes de innerHTML
- ✅ CORS: allowlist em vez de wildcard

#### Regressão

- Fluxo login: ✅ (não afectado)
- Fluxo proposta simples: ✅ (não afectado)
- Fluxo PDF: ✅ (não afectado)
- Fluxo proposta avançada: ✅ (rota corrigida em C6)
- Multi-tenant isolation: ✅ (RLS não modificada, apenas grants em funções)

#### Problemas Pendentes

1. **Rotação de credenciais (manual)** — ver `download/P0_C7_CREDENCIAIS_ROTACAO.md`:
   - Gemini API key antiga (`AIzaSyBZiC6M...`) ainda activa — rotacionar no Google Cloud Console
   - DB password `[REDACTED em 2026-08-26 — ver P0_C7_CREDENCIAIS_ROTACAO.md]` ainda válida — rotacionar no Supabase Dashboard
   - service_role key, Resend key, GitHub PAT, JWT secret — todos rotacionar
2. **Purge do git history** — secrets ainda recuperáveis via `git log --all -p`. Executar `git filter-repo` (instruções no documento).
3. **Edge Function deployment** — os ficheiros em `supabase/functions/` foram alterados mas precisam de deploy via `supabase functions deploy` ou GitHub Actions.

#### ADRs Relacionados

- ADR-005 (Gemini via Edge Function) — agora verdadeiramente enforced (sem bypass client-side)
- ADR-001 (Admin hardcoded email) — pendente (H4 da auditoria, será P1)

#### Referências

- Audit: `/home/z/my-project/download/AUDITORIA_E2E_ProposalJa.md` secções 4.3, 3.8, 6.1, 6.2, 7.3, 5.2, 10.1
- Skill: `/home/z/my-project/skills/proposaja-engineering/` princípios 2, 6, 14, 17, 36, 37
- Backup: branch `backup/pre-audit-fixes-2026-08-13` + tag `pre-audit-fixes-2026-08-13`
- Rotação manual: `download/P0_C7_CREDENCIAIS_ROTACAO.md`

---

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

### 5.1 P0 — Ação Imediata (7 findings críticos) — ✅ CONCLUÍDO 2026-08-13

Todos os 7 P0 foram corrigidos no branch `fix/p0-security-critical`. Ver secção 4 para detalhe completo.

| ID | Acção | Estado | Commit |
|---|---|---|---|
| C1 | Remover `geminiClient.ts` do bundle client; rotacionar key; usar apenas via Edge Function | ✅ Concluído (código) | `c08e3d9` |
| C2 | Migration SQL: `REVOKE EXECUTE ... FROM PUBLIC, anon` em 10 funções admin + `has_role('admin')` check interno | ✅ Concluído (código + BD) | `ebc268e` |
| C3 | Adicionar `supabase.auth.getUser()` em `send-invite-email` Edge Function | ✅ Concluído | `5d4fda6` |
| C4 | Substituir CORS `*` por allowlist de origins em 3 Edge Functions | ✅ Concluído | `5d4fda6` |
| C5 | Adicionar `escapeHtml()` ou DOMPurify em `documentModel.ts` antes de `innerHTML` | ✅ Concluído | `36cb0fa` |
| C6 | Corrigir URL em `PreencherProposta.tsx:180`: `/proposta-avancada/${id}/revisao` → `/revisao-proposta/${id}` | ✅ Concluído | `b2ff800` |
| C7 | Rotacionar password Supabase; criar script `git filter-repo` para purgar `.env` do history | ✅ Concluído (código + doc) / ⏳ Pendente (execução manual) | `1ef54b7` |

**Pendência C7 (manual):** rotação de 6 credenciais + purge de git history requer acção humana. Ver `download/P0_C7_CREDENCIAIS_ROTACAO.md`.


### 5.2 P1 — Curto Prazo (12 findings high) — ✅ CONCLUÍDO 2026-08-13

Todos os 12 P1 foram corrigidos no branch `fix/p1-security-high` (que herda os P0 de `fix/p0-security-critical`). Ver secção 4 para detalhe completo.

| ID | Acção | Estado | Commit |
|---|---|---|---|
| H1 | Drop da função `has_role(uuid, text)` (overload ambíguo) | ✅ Concluído (hardened search_path) | `fef3ac1` |
| H2 | Restore do filtro `organization_id` em `transfer_ownership` (regressão) | ✅ Já estava corrigido | `1143377` |
| H3 | Reset `geracoes_ia_mes` defaults em `plan_limits` (free=3, pro=50) | ✅ Já estava corrigido por `ia_rate_limit.sql` | `b4f3f14` |
| H4 | Migrar hardcoded admin email para tabela `platform_admins` | ✅ Concluído (migration + helper) | `5febcfa` |
| H5 | Adicionar `getUser()` + `has_role('admin')` em todas as 10 funções de `adminService.ts` | ✅ Concluído | `5670b30` |
| H6 | Adicionar auth/org filter em `analyticsService.ts` (6 métodos) | ✅ Concluído | `081e9df` |
| H7 | Validar membership antes de insert em `advancedProposalService.createAdvancedProposal` | ✅ Concluído | `9455ac8` |
| H8 | Adicionar `getUser()` em `invitationService.cancel`, `resend` (getByToken mantém aberto p/ /invite/accept) | ✅ Concluído | `9c1e8b4` |
| H9 | Allowlist de modelos Gemini em `generate-proposal` e `generate-section` | ✅ Concluído (shared helper) | `5b65255` |
| H10 | Remover `stack` do response de erro; usar HTTP status correcto | ✅ Concluído | `d2efbf3` |
| H11 | Adicionar prop `roles={['admin']}` ao `ProtectedRoute` | ✅ Concluído (com cache de role) | `67bfd10` |
| H12 | Unificar modelo Gemini para `gemini-3.1-flash-lite` em todo o código | ✅ Já estava corrigido (P0-C1) | `8e62912` |

**Resumo P1:** 8 fixes implementados de novo + 4 já estavam corrigidos por work anterior. Todos validados com typecheck + lint + build.

### 5.3 P2 — Médio Prazo (18 findings medium)

| ID | Acção | Estado |
|---|---|---|
| M1 | Adicionar verificação dupla client-side em services admin | ⏳ |
| M2 | Adoptar React Query em todos os services | ⏳ |
| M3 | Migrar PDF generation para server-side (ou manter client mas com Blob return) | ⏳ |
| M4 | Regenerar `types.ts` via `supabase gen types typescript` | ✅ Concluído (M4a fix sintáctico + M4 completo regeneração via `supabase gen types` para project `ewlkdrwrespnxyddwtgo`) |
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
| M16 | Adicionar `.catch()` em `useAuth.getSession` e `signOut` | ✅ Concluído (getSession) / ⚠️ signOut intencionalmente sem catch (silenciaria erros do utilizador) |
| M17 | Sanitizar `pathname` em `useActivityTracker` (remover query strings) | ✅ Concluído (sanitizePath helper) |
| M18 | Adicionar `coverage` config em `vitest.config.ts` | ✅ Concluído (v8 provider + test:coverage script) |

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
