# AUDITORIA COMPLETA — PropostaJá Multi-Tenant
# Data: 2026-07-09 | Branch: feature/multi-user-hierarchy | HEAD: c0ec80d

## ═══════════════════════════════════════════════════════════
## 1. GITHUB — ESTADO DO REPOSITÓRIO
## ═══════════════════════════════════════════════════════════

Branch: feature/multi-user-hierarchy
Upstream: origin/feature/multi-user-hierarchy (synced)
Status: clean working tree, nothing to commit
Commits à frente de main: 22

### Commits recentes (multi-tenant):
c0ec80d fix: storage RLS org-aware — membros da org podem ler logos, admin+ pode escrever
fc10c8a fix: unique constraint clients(organization_id, email) — impede duplicados na mesma org
58090a2 fix: multi-tenant trigger hardening — 5 critical bugs + cleanup
7833837 fix: admin-only enforcement + multi-org RLS safety
b4ea47f feat: org-scoped RLS + queryClient cache clear on org switch
cfd57e2 feat: org switcher on Organizacao page
4c53675 feat: display_name for members + invitation nome + RLS fix
8c33250 feat(multi-org): allow users in multiple organizations
9103816 fix(audit): 8 bugs corrigidos no sistema de convites e membros
2808f86 feat(phase3): transfer ownership, resend invites, auth redirect
ca6f703 feat(fase2): token + edge function + /invite/accept route

### Migrations (14 ficheiros SQL no supabase/migrations/):
20260709010000_storage_rls_org_aware.sql     ← STORAGE RLS org-aware (nova)
20260709000000_clients_unique_email_per_org.sql ← UNIQUE clients (nova)
20260708020000_fix_unique_constraints_org.sql
20260708010000_multi_tenant_trigger_hardening.sql
20260708000000_admin_only_enforcement.sql
20260707010000_rls_org_scoped.sql
20260707000000_display_name_and_rls_fix.sql
20260612000000_multi_user_hierarchy.sql
+ 7 migrations anteriores (single-user era)


## ═══════════════════════════════════════════════════════════
## 2. SUPABASE — DADOS (confirmados agora)
## ═══════════════════════════════════════════════════════════

### 2.1 Tabelas e contagem de registos:
organizations             5 rows
organization_members      7 rows
organization_invitations  1 row  (1 pendente)
profiles                  6 rows
proposals                 2 rows
proposal_items            4 rows
invoices                  0 rows
invoice_items             0 rows
clients                   6 rows
catalog_items             7 rows
proposta_ai               0 rows
admin_audit_log           0 rows
user_activity            233 rows
user_roles                6 rows
plan_limits               3 rows
subscriptions             6 rows

### 2.2 Organizações (confirmadas na DB):
Nome                  | Plano | Membros | Logo
Chiz L,da              | free  | 2       | NULL
Empresa Alpha          | free  | 2       | NULL
Empresa Beta           | free  | 1       | NULL
o crime perfeito       | free  | 1       | NULL
teste01                | free  | 1       | NULL

### 2.3 Platform Roles (app_role):
chizianetonny@gmail.com         → user
o_crimeperfeito@hotmail.com     → user
pj.alpha.member@gmail.com       → user
pj.alpha.owner@gmail.com        → user
pj.beta.owner@gmail.com         → user
tese01@mail.com                 → user
(Nenhum user tem role 'admin' de plataforma — correto)

### 2.4 Plan Limits:
free:     propostas=5/mês, clientes=10, IA=3/mês, templates=[classic]
pro:      propostas=∞, clientes=∞, IA=50/mês, templates=[classic,modern]
business: propostas=∞, clientes=∞, IA=∞, templates=[classic,modern,executive]


## ═══════════════════════════════════════════════════════════
## 3. MULTI-TENANT ISOLATION — VERIFICAÇÃO COMPLETA
## ═══════════════════════════════════════════════════════════

### 3.1 NULL organization_id:
proposals     → 0 NULLs ✅
invoices      → 0 NULLs ✅
clients       → 0 NULLs ✅
catalog_items → 0 NULLs ✅
proposta_ai   → 0 NULLs ✅
profiles      → 0 NULLs ✅

### 3.2 RLS habilitada em TODAS as 16 tabelas public ✅

### 3.3 Profiles vs Org plano — consistência:
TODOS os profiles.plano = org.plano (0 mismatches) ✅

### 3.4 Funções removidas (confirmadas ausentes):
user_org_id      → REMOVIDA ✅
user_org_role    → REMOVIDA ✅
has_org_role_min → REMOVIDA ✅


## ═══════════════════════════════════════════════════════════
## 4. RLS POLICIES — ANÁLISE POR TABELA
## ═══════════════════════════════════════════════════════════

### organizations (2 policies)
- org_select_member (SELECT): user_belongs_to_org(id) OR has_role('admin')
- org_update_owner_admin (UPDATE): user_belongs_to_org(id) AND role IN (owner,admin) OR has_role('admin')
→ ✅ Só membros leem, só owner/admin actualizam

### organization_members (3 policies)
- om_accept_invitation (INSERT): user_id=auth.uid() + convite pendente válido para esta org
- om_manage_owner_admin (ALL): user_belongs_to_org AND role IN (owner,admin)
- om_select_member (SELECT): user_belongs_to_org OR has_role('admin')
→ ✅ Insert só via convite aceite, gestão só por owner/admin

### organization_invitations (4 policies)
- oi_accept (UPDATE): email=meu_email, pendente, não expirado
- oi_manage_owner_admin (ALL): user_belongs_to_org AND role IN (owner,admin)
- oi_read_by_token (SELECT): token válido + email=meu_email
- oi_select_own (SELECT): owner/admin da org OU email=meu_email
→ ✅ Aceitar só pelo destinatário, gestão só por owner/admin

### profiles (4 policies)
- profiles_insert_own (INSERT): id = auth.uid()
- profiles_select_org (SELECT): id=auth.uid() OR membro da mesma org OR admin
- profiles_update_admin (UPDATE): has_role('admin')
- profiles_update_own (UPDATE): id = auth.uid()
→ ✅ Select permite ver profiles da mesma org, update próprio perfil ou admin

### proposals (4 policies)
- proposals_select (SELECT): user_belongs_to_org(org_id) OR owner_id=auth.uid() OR admin
- proposals_insert (INSERT CHECK): user_belongs_to_org(org_id) AND has_org_role_min_in_org(org_id,'member')
                             OR (owner_id=auth.uid() AND NOT user_belongs_to_org) OR admin
- proposals_update (UPDATE): user_belongs_to_org(org_id) OR owner_id=auth.uid() OR admin
- proposals_delete (DELETE): user_belongs_to_org(org_id) AND has_org_role_min_in_org(org_id,'admin')
                             OR (owner_id=auth.uid() AND NOT user_belongs_to_org) OR admin
→ ✅ SELECT/UPDATE: qualquer membro vê. DELETE: só admin+

### proposal_items (2 policies)
- pi_select (SELECT): EXISTS(proposal onde user_belongs_to_org(proposal.org_id) OR owner=auth.uid() OR admin)
- pi_modify (ALL): EXISTS(proposal onde user_belongs_to_org(proposal.org_id) OR owner=auth.uid())
→ ✅ Herda acesso via proposta pai

### invoices (4 policies — espelho de proposals)
→ ✅ Mesmo padrão org-safe de proposals

### invoice_items (5 policies)
- ii_admin_all (ALL): has_role('admin')
- ii_org_select (SELECT): EXISTS(invoice onde user_belongs_to_org(i.org_id) OR owner=auth.uid() OR admin)
- ii_org_insert (INSERT CHECK): EXISTS(invoice onde user_belongs_to_org(i.org_id) OR owner=auth.uid() OR admin)
- ii_org_update (UPDATE): EXISTS(invoice onde user_belongs_to_org(i.org_id) OR owner=auth.uid() OR admin)
- ii_org_delete (DELETE): EXISTS(invoice onde user_belongs_to_org(i.org_id) OR owner=auth.uid() OR admin)
→ ✅ Herda acesso via factura pai

### clients (1 policy)
- clients_org_or_owner (ALL USING): user_belongs_to_org(org_id) OR owner_id=auth.uid() OR admin
- clients_org_or_owner (ALL CHECK): user_belongs_to_org(org_id) OR owner_id=auth.uid()
→ ✅ Membros da org ou dono

### catalog_items (1 policy)
- catalog_org_or_owner (ALL USING): user_belongs_to_org(org_id) OR owner_id=auth.uid() OR admin
- catalog_org_or_owner (ALL CHECK): user_belongs_to_org(org_id) OR owner_id=auth.uid()
→ ✅ Mesmo padrão de clients

### proposta_ai (2 policies)
- pai_select (SELECT): user_belongs_to_org(org_id) OR user_id=auth.uid() OR admin
- pai_modify (ALL): user_belongs_to_org(org_id) OR user_id=auth.uid()
→ ✅ Membros da org veem, qualquer membro modifica

### admin_audit_log (2 policies)
- audit_log_insert (INSERT CHECK): has_role('admin')
- audit_log_select (SELECT): admin_id=auth.uid() OR has_role('admin')
→ ✅ Apenas platform admins

### user_activity (3 policies)
- Users insert own activity (INSERT CHECK): user_id = auth.uid()
- Users see own activity (SELECT): user_id = auth.uid()
- Admin sees all activity (SELECT): has_role('admin')
→ ✅ User vê o seu, admin vê tudo


## ═══════════════════════════════════════════════════════════
## 5. UNIQUE INDEXES (multi-tenant safe)
## ═══════════════════════════════════════════════════════════

proposals_numero_org_unique:      (organization_id, numero) WHERE org_id NOT NULL ✅
proposals_numero_owner_unique:    (owner_id, numero) WHERE org_id IS NULL (legacy fallback) ✅
invoices_numero_org_unique:       (organization_id, numero) WHERE org_id NOT NULL ✅
invoices_numero_owner_unique:     (owner_id, numero) WHERE org_id IS NULL (legacy fallback) ✅
clients_email_org_unique:         (organization_id, email) WHERE org_id NOT NULL AND email NOT NULL AND email != '' ✅
catalog_items_org_nome_unique:    (organization_id, nome) ✅
organization_members_org_user:    (organization_id, user_id) ✅
organization_invitations_token:   (token) ✅
organizations_slug:               (slug) ✅


## ═══════════════════════════════════════════════════════════
## 6. SUPABASE STORAGE
## ═══════════════════════════════════════════════════════════

Bucket: logos (privado, 5MB, png/jpeg/webp)

4 policies org-aware:
- logos_select: user_belongs_to_org(folder[1]) OR folder[1]=auth.uid() OR admin
- logos_insert: (user_belongs_to_org(folder[1]) AND has_org_role_min(folder[1],'admin')) OR folder[1]=auth.uid()
- logos_update: (user_belongs_to_org(folder[1]) AND has_org_role_min(folder[1],'admin')) OR folder[1]=auth.uid() OR admin
- logos_delete: (user_belongs_to_org(folder[1]) AND has_org_role_min(folder[1],'admin')) OR folder[1]=auth.uid() OR admin

Path conventions:
  Legacy (profiles): {user_id}/{filename}
  Org (future):      {organization_id}/{filename}


## ═══════════════════════════════════════════════════════════
## 7. FUNÇÕES SQL CRÍTICAS (20 funções, todas SECURITY DEFINER)
## ═══════════════════════════════════════════════════════════

### 7.1 Core multi-tenant (todas org-specific):
user_belongs_to_org(p_org_id uuid) → boolean
  SELECT EXISTS(... WHERE organization_id = p_org_id AND user_id = auth.uid())

user_role_in_org(p_org_id uuid) → org_role
  SELECT role ... WHERE organization_id = p_org_id AND user_id = auth.uid() LIMIT 1

has_org_role_min_in_org(p_org_id uuid, p_min_role org_role) → boolean
  CASE user_role_in_org(p_org_id) WHEN owner/admin/member/viewer...

has_role(_user_id uuid, _role app_role) → boolean
  Platform-level role check (user_roles table)

### 7.2 Triggers (org-safe, confirmados):
enforce_proposal_limit()
  → Usa NEW.organization_id (NÃO reescreve)
  → Se org_id NOT NULL: conta em organizations, limit de plan_limits
  → Se org_id NULL: fallback a profiles (legacy)

set_proposal_numero()
  → Se organization_id NOT NULL: conta por org (MAX + 1)
  → Se NULL: conta por owner_id (legacy)

set_invoice_numero()
  → Mesmo padrão de set_proposal_numero

handle_new_user() [trigger on auth.users INSERT]
  → Cria: profile + user_role + subscription + organization + membership
  → Seta profiles.organization_id = org_id

set_updated_at() [trigger genérico BEFORE UPDATE]

### 7.3 IA limites (org-safe):
get_ia_limit(p_user_id uuid) → integer
  → JOIN: organization_members → organizations → plan_limits
  → Usa organizations.plano (NÃO profiles.plano) ✅

count_ia_generations_this_month(p_org_id uuid) → integer
  → COUNT(*) FROM proposta_ai WHERE organization_id = p_org_id ✅

org_proposals_this_month(_org_id uuid) → integer
org_ia_generations_this_month(_org_id uuid) → integer

### 7.4 Convites e ownership:
accept_invitation(p_invitation_id, p_user_id, p_user_email) → void
  → Valida email, check duplicate, insert membership, update invitation
  → Copia invitation.nome → display_name
  → Atualiza profiles.organization_id

transfer_ownership(p_current_owner_id, p_target_member_id) → void
  → Valida que caller é owner DESTA org (não qualquer org)
  → Atomic swap: caller→admin, target→owner

get_invitation_by_token(p_token) → SETOF record (SECURITY DEFINER)
get_invitation_for_accept(p_id) → SETOF record (SECURITY DEFINER)
get_my_pending_invitations(p_email) → SETOF record (SECURITY DEFINER)

### 7.5 Outras:
cleanup_old_activity() — DELETE activity > 90 dias
log_admin_deletion() — Trigger BEFORE DELETE (clients, proposals, invoices, catalog_items)


## ═══════════════════════════════════════════════════════════
## 8. TRIGGERS ACTIVOS (16 triggers)
## ═══════════════════════════════════════════════════════════

proposals:
  trg_enforce_proposal_limit  (INSERT BEFORE) — enforce_proposal_limit()
  a_set_proposal_numero       (INSERT BEFORE) — set_proposal_numero()
  trg_proposals_updated_at    (UPDATE BEFORE) — set_updated_at()
  trg_audit_proposals_delete  (DELETE BEFORE) — log_admin_deletion()

invoices:
  a_set_invoice_numero        (INSERT BEFORE) — set_invoice_numero()
  trg_invoices_updated_at     (UPDATE BEFORE) — set_updated_at()
  trg_audit_invoices_delete   (DELETE BEFORE) — log_admin_deletion()

proposal_items:  trg_proposal_items_updated_at (UPDATE BEFORE)
invoice_items:   trg_invoice_items_updated_at  (UPDATE BEFORE)
clients:         trg_clients_updated_at + trg_audit_clients_delete
catalog_items:   trg_catalog_updated_at + trg_audit_catalog_delete
organizations:   trg_organizations_updated_at
profiles:        trg_profiles_updated_at
subscriptions:   trg_subscriptions_updated_at


## ═══════════════════════════════════════════════════════════
## 9. FRONTEND — SERVIÇOS E VARIÁVEIS DE ESTADO
## ═══════════════════════════════════════════════════════════

### 9.1 Estado da org (React):
useOrganization.ts:
  - State: memberships, activeOrgId, members, loading
  - Resolução: localStorage → profiles.org_id → first membership
  - setActiveOrganization(): escreve localStorage + React state + queryClient.clear()
  - Persistência: `propostaja_active_org_{userId}` no localStorage

useAuth.tsx:
  - Wraps useOrganization
  - Expose: organization, orgRole, hasOrgRoleMin, setActiveOrganization, refreshOrg
  - AuthProvider wraps toda a app

### 9.2 Services — filtro de org:

clienteService.ts:
  getClientes():       if orgId → .eq('organization_id', orgId) else → .eq('owner_id', userId) ✅
  criarCliente():      organization_id: orgId ✅
  atualizarCliente():  .eq('id', id) (RLS protege) ✅
  removerCliente():    .eq('id', id) (RLS protege) ✅

propostaService.ts:
  getPropostas():      if orgId → .eq('organization_id', orgId) ✅
  criarProposta():     organization_id: orgId ✅
  atualizarProposta(): .eq('id', id) (RLS protege) ✅
  removerProposta():   .eq('id', id) (RLS protege) ✅

faturaService.ts:
  getFaturas():        if orgId → .eq('organization_id', orgId) ✅
  converterProposta(): copia organization_id da proposta ✅

catalogService.ts:
  getCatalogo():       if orgId → .eq('organization_id', orgId) ✅
  salvarItem():        organization_id: orgId, onConflict: 'organization_id,nome' ✅

organizationService.ts:
  _getMyOrgId():       localStorage → profiles.org_id → first membership (com validação) ✅
  getOrgIdForInsert(): alias de _getMyOrgId() ✅
  updateOrganization(): .eq('id', resolvedOrgId) ✅

memberService.ts:
  getMembers():        ._getMyOrgId() → .eq('organization_id', orgId) ✅
  changeRole():        .eq('id', memberId) (RLS protege) ✅
  removeMember():      .eq('id', memberId) (RLS protege) ✅
  transferOwnership(): RPC (valida org internamente) ✅

invitationService.ts:
  create():            ._getMyOrgId() → insert com organization_id ✅
  getPendingInvitations(): ._getMyOrgId() → .eq('organization_id', orgId) ✅
  accept():            RPC accept_invitation ✅
  acceptByToken():     RPC accept_invitation ✅
  getMyPendingInvitations(): RPC get_my_pending_invitations ✅

propostaAiService.ts:
  getByCotacao():      .eq('user_id', userId) (mais restritivo que RLS) ✅
  getById():           .eq('user_id', userId) ✅
  saveEdited():        .eq('id', id) (RLS protege) ✅
  markExported():      .eq('id', id) (RLS protege) ✅

profileService.ts:
  getProfile():        .eq('id', userId) (próprio perfil) ✅
  uploadLogo():        {userId}/{filename} (legacy path) ✅
  updateProfile():     .eq('id', userId) ✅

analyticsService.ts:
  Platform-admin only (lê dados globais) ✅

### 9.3 Nenhum service usa React Query para dados de negócio.
  Dashboard, Clientes, Propostas, etc. usam useState + fetch manual.
  queryClient.clear() existe em setActiveOrganization() para futuro uso.


## ═══════════════════════════════════════════════════════════
## 10. LEGACY / DÍVIDA TÉCNICA IDENTIFICADA
## ═══════════════════════════════════════════════════════════

### 10.1 profiles.plano (legacy — 6 registos com dados)
  A fonte de verdade é organizations.plano. profiles.plano é populado
  pelo handle_new_user mas NÃO é usado por nenhuma função crítica
  (enforce_proposal_limit usa organizations.plano, get_ia_limit usa
  organizations.plano). Risco: BAIXO — apenas inconsistência cosmética.

### 10.2 profiles.logotipo_url (legacy — 6 registos preenchidos, mas strings vazias)
  Verificado: 0 registos com logotipo_url não-vazio. O upload de logo
  via Configuracoes.tsx escreve em profiles.logotipo_url. O futuro
  logo da org usará organizations.logo_url com path {orgId}/.

### 10.3 profiles.propostas_mes_count / propostas_mes_reset_at (legacy)
  A fonte de verdade é organizations.propostas_mes_count. O fallback
  em enforce_proposal_limit ainda lê de profiles se org_id IS NULL,
  mas isso nunca acontece (0 NULLs).

### 10.4 AcceptInvite.tsx usa sessionStorage para invite_token
  Deveria ser localStorage. Se o user fechar o browser e reabrir,
  o token perde-se. Bug conhecido, sem fix ainda.

### 10.5 Auth.tsx lê invite_token de sessionStorage
  Mesmo problema — alinhado com AcceptInvite.tsx.

### 10.6 InvitationBanner.tsx não chama setActiveOrganization() após aceitar
  Após aceitar um convite, a org do user muda mas o state React
  pode não reflectir até refresh. O refreshOrg() é chamado mas
  o setActiveOrganization() não é.


## ═══════════════════════════════════════════════════════════
## 11. GITHUB — COMMIT & PUSH STATUS
## ═══════════════════════════════════════════════════════════

Local HEAD:  c0ec80d
Remote HEAD: c0ec80d (origin/feature/multi-user-hierarchy)
Status:      SYNCED ✅ (nothing to commit, working tree clean)

Commits da sessão actual (já no GitHub):
  fc10c8a — fix: unique constraint clients(organization_id, email)
  c0ec80d — fix: storage RLS org-aware — membros da org podem ler logos