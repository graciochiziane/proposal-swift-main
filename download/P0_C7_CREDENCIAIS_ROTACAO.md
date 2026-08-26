# P0-C7 — Rotação de Credenciais e Purge do Git History

> **Documento crítico de segurança.**
> Status: ⏳ Pendente (execução manual pelo owner)
> Criado: 2026-08-26
> Última actualização: 2026-08-26
> Autor: Agente IA (Master Prompt protocol)
> Referência: CHANGELOG_ARCHITECTURE.md secção 4 (P0-C7) e secção 5.1

---

## 0. Resumo Executivo

Credenciais de produção foram expostas no histórico git do projecto PropostaJá entre Abril 2026 e Julho 2026 (commits `a02cca8` a `a8a32da`). Em 2026-07-24 (commit `a8a32da`), o ficheiro `.env` foi removido do tree, **mas o seu conteúdo permanece recuperável** via `git log --all -p -- .env` em commits anteriores.

Adicionalmente, em 2026-08-26, o owner partilhou TODAS as credenciais activas via chat em texto limpo — estas credenciais são as mesmas que estavam no `.env` histórico e **continuam válidas**.

**Conclusão:** TODAS as credenciais precisam ser rotacionadas. Após rotação, o git history deve ser purgado via `git filter-repo` para evitar futuras exposções.

---

## 1. Credenciais Expostas (Inventário)

| # | Credencial | Local de exposição | Onde rotacionar |
|---|---|---|---|
| 1 | GitHub PAT (`ghp_TXBO...`) | Chat 2026-08-26 + git history | GitHub → Settings → Developer settings → Personal access tokens |
| 2 | Supabase DB password (`OperaOmnia#89`) | Chat 2026-08-26 + `.env` no commit `ff1556c` + CHANGELOG_ARCHITECTURE.md:537 | Supabase Dashboard → Project Settings → Database → Reset database password |
| 3 | Supabase Access Token (`sbp_8a741...`) | Chat 2026-08-26 | Supabase Dashboard → Account → Access Tokens → Revoke + Create new |
| 4 | Supabase Access Token (`AQ.Ab8R...`) | Chat 2026-08-26 | Supabase Dashboard → Account → Access Tokens → Revoke + Create new |
| 5 | Gemini/Google AI API key (`AIzaSyBZiC6M...`) | git history (commit `a02cca8` etc.) | Google AI Studio → API Key → Delete + Create new |
| 6 | Supabase service_role key | git history (commit `a02cca8` etc.) | Supabase Dashboard → Project Settings → API → Reset service_role key |
| 7 | Supabase anon/publishable key | git history + .env.example (placeholder) | Supabase Dashboard → Project Settings → API → Reset anon key |
| 8 | Resend API key (se aplicável) | git history | Resend Dashboard → API Keys → Revoke |
| 9 | Supabase JWT secret | git history (commit `a02cca8`) | Supabase Dashboard → Project Settings → API → JWT Settings → Generate new JWT secret |
| 10 | Vercel tokens (se hardcoded) | Bundle scan | Vercel Dashboard → Account Settings → Tokens → Revoke |

> **Nota sobre (1) GitHub PAT:** o utilizador partilhou um PAT novo a 2026-08-26. Este PAT está apenas no chat e na `.git/config` local do sandbox (não commitado). Ainda assim, recomenda-se revogar após o trabalho estar completo.

---

## 2. Ordem de Execução (CRÍTICO)

A rotação deve ser feita **pela ordem abaixo** para minimizar downtime:

1. **Preparar** — ter todas as novas credenciais à mão antes de revogar as antigas
2. **Actualizar Supabase secrets das Edge Functions** (para que o novo `GEMINI_API_KEY` esteja disponível antes do deploy)
3. **Actualizar Vercel environment variables** (para que o frontend continue a funcionar)
4. **Rotacionar DB password** (Supabase Dashboard)
5. **Rotacionar Gemini API key** (Google AI Studio) + actualizar nos Supabase secrets
6. **Rotacionar Supabase access tokens** (Account → Access Tokens)
7. **Rotacionar GitHub PAT** (criar novo fine-grained, revogar antigo)
8. **Rotacionar service_role + anon keys** (Supabase API Settings)
9. **Rotacionar JWT secret** (Supabase API Settings)
10. **Verificar** — testar login + criação de proposta + Edge Function IA + PDF
11. **Purge do git history** (ver secção 4 — DESTRUTIVO, requer backup + force-push)

---

## 3. Passo-a-Passo Detalhado

### Passo 1 — Supabase Edge Function Secrets (sem downtime)

A Edge Function `generate-proposal` precisa de `GEMINI_API_KEY` como secret. Vamos atualizar ANTES de revogar a key antiga.

**Pré-requisito:** Supabase CLI instalado localmente:
```bash
# Instalar Supabase CLI (se não tiver)
brew install supabase/tap/supabase    # macOS
# ou
npm install -g supabase                # via npm
```

**Login:**
```bash
supabase login --access-token <NEW_SBP_TOKEN>
# (criar novo access token primeiro: https://supabase.com/dashboard/account/tokens)
```

**Link do projecto:**
```bash
cd /path/to/proposal-swift-main
supabase link --project-ref ewlkdrwrespnxyddwtgo
```

**Atualizar todos os secrets (com novos valores):**
```bash
supabase secrets set GEMINI_API_KEY=<NEW_GEMINI_KEY>
supabase secrets set SUPABASE_URL=https://ewlkdrwrespnxyddwtgo.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<NEW_ANON_KEY>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<NEW_SERVICE_ROLE_KEY>
# Adicionar outros conforme supabase/functions/_shared/*.ts referencie
```

**Verificar:**
```bash
supabase secrets list
```

---

### Passo 2 — Vercel Environment Variables

**URL:** https://vercel.com/<sua-conta>/proposal-swift-main/settings/environment-variables

Para cada variável, **NÃO uses "Sensitive"** para `VITE_POSTHOG_KEY` (isto causa o bug do PostHog não capturar dados — ver PROJETO_STATUS.md:96).

| Variável | Ambiente | Sensitive? |
|---|---|---|
| `VITE_SUPABASE_URL` | Production + Preview | Não |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production + Preview | Não |
| `VITE_POSTHOG_KEY` | Production + Preview | **NÃO (Causa bug)** |
| `VITE_POSTHOG_HOST` | Production + Preview | Não |
| `VITE_GEMINI_API_KEY` (se usado client-side) | Production | Sim (deveria ser removido — só via Edge Function após P0-C1) |

**Acção:**
1. Para cada variável antiga → Editar → substituir pelo novo valor → Save
2. Após actualizar todas → Deployments → Redeploy production

**Verificar após deploy:**
```bash
# Abrir o site em produção, abrir DevTools, correr:
# window.__supabase?.supabaseUrl  → deve mostrar novo URL
# posthog.config.api_host         → deve mostrar host configurado
```

---

### Passo 3 — Supabase DB Password

**URL:** https://supabase.com/dashboard/project/ewlkdrwrespnxyddwtgo/settings/database

**Acção:**
1. Clicar em "Reset database password"
2. Guardar a nova password em cofre seguro (1Password, Bitwarden, etc.)
3. **NÃO** partilhar via chat ou email

**Actualizar connection string local:**
```bash
# Em /home/z/my-project/repos/proposal-swift-main/.env.local (NÃO commitar)
DATABASE_URL=postgresql://postgres:<NEW_PASSWORD>@db.ewlkdrwrespnxyddwtgo.supabase.co:5432/postgres
```

**Verificar:**
```bash
psql "$DATABASE_URL" -c "SELECT current_user, current_database();"
# Deve mostrar: postgres | postgres
```

---

### Passo 4 — Gemini API Key

**URL:** https://aistudio.google.com/apikey

**Acção:**
1. Criar nova API key → copiar valor
2. Na lista de keys existentes → identificar `AIzaSyBZiC6M...` → Delete
3. Actualizar `GEMINI_API_KEY` nos Supabase secrets (ver Passo 1)

**Verificar:**
```bash
# Após deploy (ver Passo 1), criar uma proposta IA no site de produção
# Verificar nos logs da Edge Function:
supabase functions logs generate-proposal --project-ref ewlkdrwrespnxyddwtgo
# Não deve haver erros 401/403 do Gemini
```

---

### Passo 5 — Supabase Access Tokens

**URL:** https://supabase.com/dashboard/account/tokens

**Acção:**
1. Revogar todos os tokens existentes (`sbp_8a741...`, `AQ.Ab8R...`)
2. Criar novo token com nome descritivo (ex: "local-dev-2026-08-26")
3. Guardar em cofre seguro
4. Actualizar `~/.supabase/access-token` local (se usar CLI):
   ```bash
   supabase login --access-token <NEW_TOKEN>
   ```

---

### Passo 6 — GitHub PAT

**URL:** https://github.com/settings/tokens

**Acção:**
1. Criar novo **Fine-grained token** com:
   - Resource owner: `graciochiziane`
   - Repository access: Only select repositories → `proposal-swift-main`
   - Permissions:
     - Contents: Read and Write
     - Metadata: Read
     - Pull requests: Read and Write (para PRs)
     - **NÃO marcar:** Administration, Secrets, Workflows
   - Expiration: 30 dias (máximo)
2. Guardar em cofre seguro
3. Revogar todos os PATs antigos (`ghp_TXBO...`)

**Actualizar git remote (opcional, se quiser usar novo PAT):**
```bash
cd /home/z/my-project/repos/proposal-swift-main
git remote set-url origin "https://<NEW_GITHUB_PAT>@github.com/graciochiziane/proposal-swift-main.git"
```

---

### Passo 7 — Supabase service_role + anon Keys

**URL:** https://supabase.com/dashboard/project/ewlkdrwrespnxyddwtgo/settings/api

**Acção:**
1. Em "API Keys" → clicar "Reset" para `service_role`
2. Guardar novo valor em cofre seguro
3. Em "API Keys" → clicar "Reset" para `anon/publishable`
4. Guardar novo valor
5. Actualizar Vercel env vars (ver Passo 2) com novos valores
6. Actualizar Supabase Edge Function secrets (ver Passo 1)

> ⚠️ **Atenção:** o reset da `service_role` key pode demorar até 5 minutos a propagar.

---

### Passo 8 — Supabase JWT Secret

**URL:** https://supabase.com/dashboard/project/ewlkdrwrespnxyddwtgo/settings/api → JWT Settings

**Acção:**
1. Clicar "Generate new JWT secret"
2. Confirmar (esta acção invalida TODAS as sessões activas — todos os utilizadores terão de fazer login novamente)
3. Aplicar

> ⚠️ **Impacto:** todos os utilizadores ativos serão deslogados. Comunicar antes se houver utilizadores em produção.

---

### Passo 9 — Verificação Pós-Rotação

Após todos os passos, executar esta checklist:

```bash
# 1. Build não contém credenciais
cd /home/z/my-project/repos/proposal-swift-main
bun install
bun run build
grep -E "(AIzaSy[A-Za-z0-9_-]{20,}|OperaOmnia|sbp_8a741[A-Za-z0-9]+|ghp_[A-Za-z0-9]{30,})" dist/assets/*.js
# Esperado: ZERO matches
```

```bash
# 2. Edge Functions deployadas com novos secrets
supabase functions list --project-ref ewlkdrwrespnxyddwtgo
# Deve mostrar: generate-proposal, generate-section, send-invite-email, admin-create-tenant
```

```bash
# 3. Login funcional no site de produção
# Abrir https://proposta2.vercel.app → fazer login → sem erros no console
```

```bash
# 4. Edge Function IA funcional
# No site: criar nova proposta IA → deve gerar secções com sucesso
# Verificar logs: supabase functions logs generate-proposal
```

```bash
# 5. PDF export funcional
# No site: criar proposta → exportar PDF → deve descarregar ficheiro válido
```

---

## 4. Purge do Git History (DESTRUTIVO)

> ⚠️ **Atenção:** esta operação reescreve o histórico git. Todos os colaboradores terão de fazer `git fetch + git reset --hard origin/<branch>` após. Fazer backup completo antes.

### 4.1 — Pré-requisitos

```bash
# Instalar git-filter-repo (NÃO usar o antigo BFG ou git filter-branch)
pip install git-filter-repo

# Backup completo do repositório (clone bare)
git clone --mirror https://<GH_PAT>@github.com/graciochiziane/proposal-swift-main.git proposal-swift-main.git-backup
tar -czf proposal-swift-main-backup-$(date +%Y%m%d).tar.gz proposal-swift-main.git-backup
```

### 4.2 — Identificar ficheiros a purgar

```bash
# Ficheiros com credenciais (a purgar do histórico):
echo ".env" > /tmp/files-to-purge.txt
echo "src/services/geminiClient.ts" >> /tmp/files-to-purge.txt  # (removido em P0-C1)

# Strings literais a substituir por "REDACTED":
cat > /tmp/strings-to-replace.txt <<EOF
OperaOmnia#89==>REDACTED
AIzaSy[A-Za-z0-9_-]{20,}==>REDACTED
sbp_8a741[A-Za-z0-9]+==>REDACTED
ghp_[A-Za-z0-9]{36}==>REDACTED
EOF
```

### 4.3 — Executar purge (no clone bare)

```bash
cd proposal-swift-main.git-backup

# Purgar ficheiros inteiros do histórico
git filter-repo --replace /tmp/strings-to-replace.txt

# Verificar que não há matches restantes
git log --all -p | grep -E "(OperaOmnia|AIzaSy[A-Za-z0-9_-]{20,}|sbp_8a741|ghp_[A-Za-z0-9]{36})"
# Esperado: ZERO matches
```

### 4.4 — Force-push para o remoto

```bash
# ATENÇÃO: isto vai sobrescrever o histórico no GitHub
git push --force --mirror origin
```

### 4.5 — Re-clone em todos os colaboradores

Todos os clones locais existentes devem ser apagados e re-clonados:

```bash
# Em cada máquina de desenvolvimento:
cd /path/to/old/clone/parent/dir
rm -rf proposal-swift-main
git clone https://github.com/graciochiziane/proposal-swift-main.git
cd proposal-swift-main
git checkout feature/multi-user-hierarchy
bun install
```

### 4.6 — Verificação final

```bash
# Confirmar que o histórico está limpo
git log --all -p | grep -E "(OperaOmnia|AIzaSy[A-Za-z0-9_-]{20,}|sbp_8a741|ghp_[A-Za-z0-9]{36})"
# Esperado: ZERO matches (incluindo no CHANGELOG_ARCHITECTURE.md que tem a password na linha 537)

# Confirmar que o build funciona
bun install && bun run build
# Deve completar sem erros
```

---

## 5. Vulnerabilidade adicional identificada (novo)

Durante a análise de 2026-08-26, identifiquei que o `CHANGELOG_ARCHITECTURE.md` (linha 537) contém a password literal `OperaOmnia#89`. Este ficheiro está tracked no git desde 2026-08-13.

**Implicação:** mesmo sem aceder ao `.env` histórico, qualquer pessoa com acesso ao repo pode ver a password na linha 537 do CHANGELOG.

**Acção adicional necessária:**
1. Editar `CHANGELOG_ARCHITECTURE.md` linha 537 e substituir `OperaOmnia#89` por `REDACTED`
2. Commit: `docs(security): redact literal credential from CHANGELOG`
3. Push para feature/multi-user-hierarchy
4. Após purge do git history (secção 4), esta password também será removida do histórico

---

## 6. Comunicação aos Utilizadores (se aplicável)

Se houver utilizadores activos em produção, comunicar antes de executar:

> **Assunto:** Manutenção programada do PropostaJá
> **Data:** [agendar]
> **Duração estimada:** 30-60 minutos
> **Impacto:** Sessões podem ser terminadas (requer novo login). Edge Functions IA podem falhar durante breves janelas.
> **Acção do utilizador:** Nenhuma. Após manutenção, fazer login novamente.

---

## 7. Checklist Final

- [ ] Passo 1: Supabase Edge Function secrets actualizados
- [ ] Passo 2: Vercel env vars actualizadas + redeploy
- [ ] Passo 3: DB password rotacionada
- [ ] Passo 4: Gemini API key rotacionada + actualizada em Supabase secrets
- [ ] Passo 5: Supabase access tokens revogados + novo criado
- [ ] Passo 6: GitHub PAT antigo revogado + novo fine-grained criado
- [ ] Passo 7: service_role + anon keys rotacionadas (com 5 min de propagação)
- [ ] Passo 8: JWT secret rotacionado (utilizadores deslogados)
- [ ] Passo 9: Verificações executadas — build limpo + login + IA + PDF funcionais
- [ ] Secção 5: CHANGELOG linha 537 redacted
- [ ] Secção 4: git-filter-repo executado + force-push
- [ ] Todos os colaboradores avisados para re-clone
- [ ] Backup tar.gz guardado em local seguro (minimum 90 dias)

---

## 8. rollback (em caso de falha)

Se a rotação falhar (ex.: nova credencial não funciona, site quebra):

1. **NÃO revogar as credenciais antigas** até ter confirmado que as novas funcionam
2. Reverter Vercel env vars para valores antigos → Redeploy
3. Reverter Supabase Edge Function secrets para valores antigos (`supabase secrets set`)
4. Em último caso, reverter DB password para valor antigo (Supabase Dashboard → Database Settings → use a password antiga se ainda não foi reset)

> ⚠️ **Uma vez feita a rotação da JWT secret, NÃO é possível reverter.** Todos os utilizadores terão de fazer login novamente. Esta é a única operação não-reversível.

---

## 9. Referências

- CHANGELOG_ARCHITECTURE.md secção 4 (entrada P0-C7 de 2026-08-13)
- CHANGELOG_ARCHITECTURE.md secção 5.1 (P0 pendente)
- CHANGELOG_ARCHITECTURE.md linha 537 (password literal — a redactar)
- PROJETO_STATUS.md secção "Edge Function" (configuração Gemini)
- Commit `a8a32da` (2026-07-24) — remoção do `.env` do tree
- Commit `a02cca8` (first commit) — adição original do `.env` com credenciais

---

## 10. Histórico de Versões

| Data | Versão | Autor | Notas |
|---|---|---|---|
| 2026-08-26 | 1.0 | Agente IA (Master Prompt) | Criação do documento (estava referenciado no CHANGELOG desde 2026-08-13 mas nunca tinha sido escrito) |
