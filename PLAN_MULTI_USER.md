# ProposalJa — Plano: Modulo Multi-User & Hierarquia

## 1. Estado Actual (Diagnostico)

### Arquitectura Actual
```
auth.users (1:1) → profiles → {clients, proposals, catalog_items, invoices}
                    ↕
                user_roles (admin | user)
```

- **Puro single-tenant B2C**: cada utilizador esta isolado, sem partilha
- **Roles**: apenas `admin` e `user` (sem hierarquia intermedia)
- **Propriedade**: todos os dados usam `owner_id = auth.users.id`
- **RLS**: cada tabela tem `USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'))`
- **Planos**: free (5 propostas/mes), pro (50 IA), business (ilimitado)
- **Nenhum conceito de organizacao, equipa, ou workspace**

### Limitacoes Actuais
- Uma empresa com 3 funcionarios precisa de 3 contas separadas
- Dados (clientes, catalogo) NAO podem ser partilhados
- Nao existe controlo de quem ve o que dentro da mesma empresa
- O plano "business" menciona "ate 3 utilizadores" mas nao esta implementado

---

## 2. Visao Alvo

### Conceito Central: Organizacao (Workspace)

```
organizacoes
    │
    ├── 1:N → membros (users com roles na org)
    │       ├── owner  (dono, pagador, controlo total)
    │       ├── admin  (gestor, pode gerir membros e todos os dados)
    │       └── member (colaborador, pode criar/editar propostas)
    │
    ├── 1:N → clientes (partilhados na org)
    ├── 1:N → catalog_items (partilhados na org)
    ├── 1:N → proposals (pertencem a org, com created_by)
    ├── 1:N → invoices (pertencem a org, com created_by)
    └── 1:1 → subscription (plano da org)
```

### Hierarquia de Roles (dentro da organizacao)

| Role | Descricao | Criar Propostas | Gerir Clientes | Gerir Catalogo | Gerir Membros | Ver Dashboard | Exportar PDF | Admin Panel |
|------|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **owner** | Dono da organizacao. Pagador. | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **admin** | Gestor. Controlo total dos dados. | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **member** | Colaborador. Cria e edita propostas. | ✅ | ✅ | ✅ | ❌ | Proprias | ✅ | ❌ |
| **viewer** | Observador. So visualiza. | ❌ | ❌ | ❌ | ❌ | Leitura | ❌ | ❌ |

### Comportamento Chave
- **Cada utilizador pode pertencer a UMA organizacao** (simplicidade para v1)
- **Dados sao da organizacao, nao do individuo** — `organization_id` substitui `owner_id`
- **`created_by`** rastreia quem criou cada recurso (para dashboard e filtros)
- **Membros veem apenas dados da sua organizacao** (RLS por `organization_id`)
- **Utilizadores sem organizacao** funcionam como antes (single-user mode)
- **Migracao automatica**: utilizadores existentes sao automaticamente "owner" da sua propria org

---

## 3. Modelo de Dados

### 3.1 Novas Tabelas

```sql
-- Tipos
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Organizacoes
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,              -- para URLs amigaveis
    logo_url TEXT,
    cor_primaria TEXT DEFAULT '#0B5394',   -- override da cor da org (opcional)
    plano plan_tier NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros da organizacao
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    invited_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, user_id)       -- um utilizador so pode estar numa org
);

-- Convites pendentes
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role org_role NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, email, accepted_at)  -- um convite pendente por email
);
```

### 3.2 Tabelas a Modificar

```sql
-- Adicionar organization_id a todas as tabelas de dados
ALTER TABLE clients ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE catalog_items ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE proposals ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE invoices ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Adicionar created_by para rastreio
ALTER TABLE proposals ADD COLUMN created_by UUID REFERENCES auth.users(id);
ALTER TABLE invoices ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Mover plano da organizacao (profiles.plano passa a ser derivado ou legacy)
-- profiles.plano mantido como fallback para users sem org
```

### 3.3 Migracao de Dados Existente

```sql
-- 1. Criar uma organizacao para cada utilizador existente
INSERT INTO organizations (id, nome, slug, plano, created_at)
SELECT
    gen_random_uuid(),
    COALESCE(empresa, nome, email, 'Minha Organizacao'),
    'org-' || SUBSTRING(id::text, 1, 8),
    plano,
    created_at
FROM profiles;

-- 2. Associar cada utilizador como "owner" da sua org
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT o.id, p.id, 'owner', p.created_at
FROM profiles p
JOIN organizations o ON o.slug = 'org-' || SUBSTRING(p.id::text, 1, 8);

-- 3. Migrar owner_id para organization_id em todas as tabelas
UPDATE clients SET organization_id = o.id
FROM profiles p JOIN organization_members om ON om.user_id = p.id
JOIN organizations o ON o.id = om.organization_id
WHERE clients.owner_id = p.id AND om.role = 'owner';

-- (mesmo padrao para catalog_items, proposals, invoices)
```

### 3.4 RLS Policies (Novo Padrao)

```sql
-- Helper function: buscar org do utilizador
CREATE OR REPLACE FUNCTION user_org_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT organization_id FROM organization_members WHERE user_id = _user_id LIMIT 1;
$$;

-- Helper function: role do utilizador na org
CREATE OR REPLACE FUNCTION user_org_role(_user_id UUID)
RETURNS org_role LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT role FROM organization_members WHERE user_id = _user_id LIMIT 1;
$$;

-- Exemplo: RLS para proposals (substitui owner_id pattern)
CREATE POLICY "org_proposals_select" ON proposals FOR SELECT TO authenticated
    USING (organization_id = user_org_id(auth.uid()));

CREATE POLICY "org_proposals_insert" ON proposals FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = user_org_id(auth.uid())
        AND user_org_role(auth.uid()) IN ('owner', 'admin', 'member')
    );

CREATE POLICY "org_proposals_update" ON proposals FOR UPDATE TO authenticated
    USING (organization_id = user_org_id(auth.uid()))
    WITH CHECK (organization_id = user_org_id(auth.uid()));

CREATE POLICY "org_proposals_delete" ON proposals FOR DELETE TO authenticated
    USING (
        organization_id = user_org_id(auth.uid())
        AND user_org_role(auth.uid()) IN ('owner', 'admin')
    );

-- Super admin (platform) mantem acesso via has_role()
-- Adicionar OR has_role(auth.uid(), 'admin') ao USING de cada politica
```

---

## 4. Arquitectura Frontend

### 4.1 Novos Servicos

```
src/services/
├── organizationService.ts    -- CRUD org, alterar nome, logo, cor
├── memberService.ts          -- listar membros, remover, alterar role
└── invitationService.ts      -- criar convite, aceitar, cancelar, listar
```

### 4.2 Novos Componentes

```
src/components/
├── org/
│   ├── OrgSwitcher.tsx        -- selector de org (header) — v2
│   ├── OrgSettings.tsx        -- definicoes da organizacao
│   ├── MemberList.tsx         -- tabela de membros com roles
│   ├── MemberRow.tsx          -- linha individual (avatar, nome, role, accoes)
│   ├── InviteModal.tsx        -- modal de convite por email
│   ├── InviteAccept.tsx       -- pagina de aceitacao de convite
│   └── RoleBadge.tsx          -- badge visual para role (owner/admin/member/viewer)
├── hooks/
│   └── useOrganization.ts     -- hook: org actual, membros, role do user
```

### 4.3 Paginas Novas/Modificadas

```
src/pages/
├── Organizacao.tsx            -- pagina principal da org (definicoes + membros)
├── Convites.tsx               -- lista de convites pendentes (para owner/admin)
├── AceitarConvite.tsx         -- pagina publica para aceitar convite
└── (modificadas)
    ├── Dashboard.tsx          -- filtrar por org em vez de user
    ├── Propostas.tsx          -- mostrar "Criado por" quando org tem >1 membro
    ├── Clientes.tsx           -- mesmo
    └── Catalogo.tsx           -- mesmo
```

### 4.4 Fluxo de Convite

```
1. Owner/Admin clica "Convidar Membro"
2. Preenche email + selecciona role (member/admin)
3. Email enviado (via Supabase ou edge function)
4. Convidado recebe link: /aceitar-convite/{token}
5. Se ja tem conta: aceita e entra na org
6. Se nao tem conta: regista-se e entra na org automaticamente
7. Convite expira em 7 dias
```

---

## 5. Plano de Implementacao (Fases)

### Fase A — Fundacao (Database + Auth Context) ≈ 2 dias

| # | Tarefa | Ficheiro |
|---|--------|----------|
| A1 | Migration: criar tabelas (organizations, members, invitations) | `supabase/migrations/` |
| A2 | Migration: adicionar organization_id + created_by | `supabase/migrations/` |
| A3 | Migration: funcoes helper (user_org_id, user_org_role) | `supabase/migrations/` |
| A4 | Migration: novo RLS policies por organizacao | `supabase/migrations/` |
| A5 | Migration: migracao de dados existentes | `supabase/migrations/` |
| A6 | Gerar tipos TypeScript actualizados | `src/integrations/supabase/types.ts` |
| A7 | Criar `useOrganization` hook | `src/hooks/useOrganization.ts` |
| A8 | Modificar `useAuth` para carregar org context | `src/hooks/useAuth.tsx` |

### Fase B — Servicos + Convites ≈ 2 dias

| # | Tarefa | Ficheiro |
|---|--------|----------|
| B1 | `organizationService.ts` (CRUD) | `src/services/organizationService.ts` |
| B2 | `memberService.ts` (listar, remover, alterar role) | `src/services/memberService.ts` |
| B3 | `invitationService.ts` (criar, aceitar, cancelar, listar) | `src/services/invitationService.ts` |
| B4 | Modificar `propostaService` para usar organization_id | `src/services/propostaService.ts` |
| B5 | Modificar `clienteService` para usar organization_id | `src/services/clienteService.ts` |
| B6 | Modificar `catalogoService` para usar organization_id | `src/services/catalogoService.ts` |
| B7 | Modificar `faturaService` para usar organization_id | `src/services/faturaService.ts` |

### Fase C — UI — Pagina Organizacao ≈ 2 dias

| # | Tarefa | Ficheiro |
|---|--------|----------|
| C1 | Pagina `Organizacao.tsx` (tabs: Definicoes, Membros, Convites) | `src/pages/Organizacao.tsx` |
| C2 | Componente `MemberList` + `MemberRow` + `RoleBadge` | `src/components/org/` |
| C3 | Componente `InviteModal` (email + role selector) | `src/components/org/InviteModal.tsx` |
| C4 | Pagina `AceitarConvite.tsx` | `src/pages/AceitarConvite.tsx` |
| C5 | Rota `/organizacao` + link no sidebar/navbar | `src/App.tsx` |

### Fase D — Adaptacao das Paginas Existentes ≈ 1 dia

| # | Tarefa | Ficheiro |
|---|--------|----------|
| D1 | Dashboard: mostrar propostas da org (filtro "Minhas" vs "Todas") | `src/pages/Dashboard.tsx` |
| D2 | Propostas: mostrar "Criado por" quando org tem multiplos membros | `src/pages/Propostas.tsx` |
| D3 | Clientes: partilhados na org | (ja funciona via org_id) |
| D4 | Configuracoes: distinguir perfil pessoal vs definicoes da org | `src/pages/Configuracoes.tsx` |

### Fase E — Edge Functions + Notifications ≈ 1 dia

| # | Tarefa | Ficheiro |
|---|--------|----------|
| E1 | Edge Function `send-invitation-email` | `supabase/functions/send-invitation-email/` |
| E2 | Trigger DB: notificar novo membro | `supabase/migrations/` |
| E3 | Actualizar `enforce_proposal_limit` para contar por org | `supabase/migrations/` |

---

## 6. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Migracao de dados existente falha | Perda de dados | Fazer backup antes; migracao idempotente; testar em staging |
| RLS quebra permissoes existentes | Users nao veem dados | Manter `owner_id` como fallback; politicas OR (org OR owner) |
| Convites por email falham (sem SMTP) | Feature inutilizavel | Supabase Auth link como fallback; convites por link partilhavel |
| Performance: user_org_id() em cada query | Lentidao | Adicionar `organization_id` cache no JWT ou contexto React |
| Regressao em single-user (sem org) | Experiencia degradada | Fazer `organization_id` nullable; sem org = comportamento actual |

---

## 7. Decisoes em Aberto (Precisam de Validacao)

1. **Um utilizador pode pertencer a multiplas organizacoes?** (Recomendacao: NAO na v1. Manter simples.)
2. **O que acontece ao perfil pessoal (empresa, NUIT, logo) quando o user entra numa org?** (Recomendacao: a org tem os proprios. O perfil pessoal e para autenticacao apenas.)
3. **Plano e limites: sao da org ou do user?** (Recomendacao: da org. Todos os membros partilham o mesmo limite.)
4. **Como enviar convites?** (Opcao A: Supabase edge function com SMTP. Opcao B: link partilhavel. Opcao C: email via Resend.)
5. **Viewer consegue exportar PDF?** (Recomendacao: NAO. So leitura.)
6. **Member consegue eliminar propostas?** (Recomendacao: So as que criou. Owner/Admin eliminam todas.)

---

## 8. Estimativa Total

| Fase | Duracao | Dependencias |
|------|---------|--------------|
| A — Fundacao (DB + Auth) | 2 dias | Nenhuma |
| B — Servicos + Adaptacao | 2 dias | Fase A |
| C — UI Organizacao | 2 dias | Fase B |
| D — Adaptacao Paginas | 1 dia | Fase B |
| E — Edge Functions | 1 dia | Fase A |
| **Total** | **~8 dias** | |

---

## 9. Branch & Git Strategy

- Branch: `feature/multi-user-hierarchy` (ja criado)
- Merge: PR para `main` apos Fase C (minimo viavel)
- Fases D e E podem ser mergeadas sequencialmente
- NUNCA forcar push para main (branch protection activa)