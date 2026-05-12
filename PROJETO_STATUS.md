# Proposal Swift — Estado do Projecto

## Tecnologia
- React 18 + Vite 5 + TypeScript + Supabase
- Tailwind CSS + lucide-react icons
- PostHog (analytics + session replay 30%)
- Deploy: Vercel (https://proposta2.vercel.app)
- Supabase: https://ytbgfrbhyclnfdftmnoy.supabase.co
- Admin: graciochiziane@gmail.com
- GitHub: https://github.com/graciochiziane/proposal-swift-main

## Módulos Implementados

### Autenticação
- Login/Registro via Supabase Auth
- Password reset (forgot/reset)
- RLS em todas as tabelas
- useAuth hook + ProtectedRoute
- PostHog identify() on login, reset() on logout

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

### Motor de Propostas IA (propostaAiService.ts)
- generate() — chamada à Edge Function via Supabase
- regenerate() — re-gera com mesmo contexto
- detectSector() — detecção automática de sector a partir dos itens
- saveEdited() — guarda secções editadas pelo utilizador
- markExported() — marca como exportado (lança erro em vez de silenciar)
- getByCotacao() — carrega proposta IA existente para uma cotação
- Modelos: Gemini 3.1 Flash Lite (gratuito, via Google AI)
- Formulário 3-step: Configuração → Campos → Preview/Exportação
- Dois modos: Rápido (4 campos) / Assertivo (9 campos)
- 4 tons: Formal Corporativo, Persuasivo Comercial, Técnico Directo, Consultivo
- 6 sectores: Bank, Telecom, Government, Retail, NGO, Outro

### Páginas
- Dashboard (stats + propostas recentes)
- Propostas (gestão: filtros, pesquisa, status, duplicar, eliminar)
- CriarProposta (formulário async com catalog autocomplete)
- ResumoProposta (detalhes + converter em factura + histórico)
- GerarPropostaIA (3-step flow: config → campos → preview editável → export PDF)
- Clientes (CRUD)
- Catálogo (CRUD + busca)
- Configuracoes (perfil + logo upload/remove)
- Admin, Auth, ForgotPassword, ResetPassword, NotFound

### PDF Templates (src/lib/pdf/) — Sistema de Temas
- **7 templates** registados via `registry.ts`
- **3 gratuitos:** classic, modern, executive
- **3 PRO:** sleek, sidebar, business
- **1 narrativo:** narrativa.ts (Doc A — standalone para propostas IA)
- Sistema de temas (`PdfTheme`): cada template controla aparência de tabela, totais, pagamento, footer
- `shared.ts` refacturado: `createContext()` aceita tema opcional, funções são theme-aware com defaults
- `drawNarrativeSections()` pronta para propostas geradas por IA
- `gerarPDFNarrativa()` — PDF standalone para Doc A (proposta comercial/técnica)
- Mostram sempre PROPOSTA (sem logica FATURA)
- Usam proposta.numero (PROP-XXXX)
- Ver secção "Sistema de Temas PDF" abaixo para detalhes técnicos

### Analytics — PostHog (Maio 2026)
- **posthog.ts** — configuração centralizada com safety checks
- **PostHogProvider** no main.tsx (wrapper condicional)
- Session Replay: 30% de sample rate
- Identificação: `posthog.identify()` no login, `posthog.reset()` no logout
- Privacidade: IP anonymization, mask de inputs (password, email, tel, number), mask de atributos de elementos
- Páginas ignoradas: /auth, /login, /register
- Autocapture: desactivado (capture manual via events)
- Env var: `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` (default: us.i.posthog.com)
- **ISSUE PENDENTE**: PostHog NAO está a capturar dados. Causa provável: `VITE_POSTHOG_KEY` marcado como "Sensitive" na Vercel, resultando em valor vazio no build. Fix: apagar variável na Vercel e recriar SEM flag "Sensitive", depois Redeploy.

---

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
- proposta_ai (dados de propostas geradas por IA)
- user_activity (métricas de uso por utilizador)
- admin_audit_log

## Regras Criticas
- proposal_items: NAO tem descricao, NAO tem owner_id
- proposals: NAO tem coluna validade
- Bucket logos: PRIVADO (usar createSignedUrl, nunca getPublicUrl)
- Import Supabase: @/integrations/supabase/client (NAO @/lib/supabase)
- Ficheiros eliminados: src/lib/storage.ts, src/lib/supabase.ts
- Tipos gerados: src/integrations/supabase/types.ts (regenerar após migrations)
- DescontoTipo: percentual | valor (NAO fixo)
- getById() SEMPRE filtra por user_id (ownership check — nunca expor dados de outros)
- markExported() lança Error em caso de falha (NAO silencia)

## Regras Criticas (PDF)
- jsPDF: NAO usar hex strings directos — usar `hexToRgb()` para converter para `[r,g,b]`
- jsPDF: NAO usar `doc.triangle()` — nao existe na API
- jsPDF: NAO usar alpha em `setFillColor` — so arrays RGB `[r,g,b]`
- jsPDF: NAO usar emojis no PDF
- `darken()` e `lighten()` existem em `shared.ts`
- `secondary` NAO existe no contexto PDF
- Até 3 `as any` aceitáveis em `shared.ts` para contornar tipagem jsPDF

## Regras Criticas (Edge Function)
- Modelo actual: Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`)
- NAO usar OpenAI (migrado para Google AI em Abril 2026)
- Secret: configurar `GEMINI_API_KEY` (NAO `OPENAI_API_KEY`)
- Diagnostic logging: 10 steps com [STEP-OK]/[STEP-FAIL] prefix
- Timeout: 60s limite do Supabase Edge Functions
- System prompt anti-alucinação: estrutura de 8 secções obrigatória

---

## Deploy
- Vercel via GitHub (branch main)
- vercel.json com SPA rewrites na raiz
- Supabase Site URL: https://proposta2.vercel.app
- Branch protection activa (main) — requer desactivar via API para pushes directos

---

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
- Todos os testes passam

---

## Auditoria Completa (Maio 2026)

### Bugs encontrados e corrigidos (8 instâncias)
1. **CRITICAL**: `createContext()` sem parâmetro `narrative` → `drawNarrativeSections()` era no-op em todos os 6 templates
   - Corrigido: adicionado `narrative?: NarrativeSection[]` ao `createContext()` e actualizado todos os 6 templates
2. **DUPLICATE IMPORT**: `GerarPropostaIA` importado duas vezes em `App.tsx` (linhas 15+18)
   - Corrigido: removida linha duplicada
3. **`as any` excedido**: 4 instâncias em `shared.ts` vs máximo de 3
   - Corrigido: 3 substituídas por casts tipados `[number, number, number]`, 1 mantida com eslint-disable
4. **getById() sem RLS**: potencial leak de dados entre utilizadores
   - Corrigido: adicionado `getUser()` + `.eq('user_id', user.id)` filter
5. **markExported() silenciava erros**: `console.error` sem throw
   - Corrigido: agora lança `Error` em vez de apenas loggar
   - Corrigido `GerarPropostaIA.tsx`: wrapped `markExported` em try-catch para não confundir utilizador
6. **Comentário enganoso em regenerate()**: dizia "apaga a antiga" mas nunca apagava
   - Corrigido: actualizado comentário para "cria novo registo com novo ID"
7. **Keyword duplicado 'solar' em detectSector()**: presente em Energia + Imobiliária
   - Corrigido: removido 'solar' de Imobiliária
8. **PROJETO_STATUS.md desactualizado**: Doc A PDF marcado como pendente
   - Corrigido: marcado como concluído com referência a `gerarPDFNarrativa()`

### Edge Function Rewrite (Maio 2026)
- Reescrita completa com logging diagnóstico em 10 passos
- Cada erro inclui campo `step` para identificação precisa do ponto de falha
- Safety checks em cada etapa: auth vazia, JSON inválido, resultados DB vazios, erros Gemini, conteúdo vazio, safety blocks, falhas de parse
- Migração de OpenAI para Google Gemini (gratuito)
- Modelo final: `gemini-3.1-flash-lite`

---

## Optimização Mobile (Maio 2026)

### Problema
Em ecrãs de 375px (iPhone), 80px desperdiçados em padding lateral, itens da proposta ilegíveis em 3 colunas.

### Alterações
- **tailwind.config.ts**: Container padding reduzido para `DEFAULT: "0.75rem"` (12px), `sm: "1rem"` (16px+)
- **CriarProposta.tsx**:
  - Card: `p-4 md:p-6` (era `p-6`) — poupa 16px
  - Inputs: `px-3 md:px-4` (era `px-4`) — poupa 8px
  - Itens: estrutura 2 linhas — Linha 1: Nome (100%), Linha 2: grid `cols-[25%_33%_25%_17%]` (Qtd/Preço/Subtotal/Acções)
  - Labels visíveis no mobile para Qtd, Preço e Subtotal
  - Touch targets: `p-2 md:p-1.5`, icon `h-4 w-4 md:h-3.5`
  - Labels: `text-xs` (era `text-sm`)
  - Total ganho: +32px de largura útil (+11% de espaço de conteúdo)

---

## Sistema de Temas PDF (Maio 2026)

### Motivação
Os templates originais (classic, modern, executive) partilhavam as mesmas funções rígidas de `shared.ts` (`drawItemsTable`, `drawTotals`, `drawPaymentMethods`, `drawFooter`). Todas as propostas se pareciam 90% iguais — diferiam apenas no header. O sistema de temas resolve isto permitindo que cada template defina o seu estilo visual.

### Arquitectura

```
src/lib/pdf/
├── types.ts        ← PdfTheme, NarrativeSection, TemplateEntry (interfaces)
├── themes.ts       ← 7 temas predefinidos + getTheme(id)
├── shared.ts       ← Motor com funções theme-aware + drawNarrativeSections
├── registry.ts     ← Registro centralizado de templates (Map)
├── classic.ts      ← Template "Clássico" (gratuito)
├── modern.ts       ← Template "Moderno" (gratuito)
├── executive.ts    ← Template "Executivo" (gratuito)
├── sleek.ts        ← Template "Sleek" (PRO) — colorido, badges
├── sidebar.ts      ← Template "Sidebar" (PRO) — barra lateral escura
├── business.ts     ← Template "Business" (PRO) — minimalista
├── narrativa.ts    ← PDF standalone Doc A (proposta IA)
└── index.ts        ← gerarPDF() unificado via registry
```

### Fluxo
```
gerarPDF(proposta, cliente, dono, 'sleek')
  → getTemplate('sleek')       // registry.ts
  → renderSleek(proposta, ...)  // sleek.ts
    → createContext(..., sleekTheme)  // shared.ts (passa tema)
    → drawItemsTable(ctx)       // lê ctx.theme.table
    → drawTotals(ctx)           // lê ctx.theme.totals
    → drawPaymentMethods(ctx)   // lê ctx.theme.payment
    → drawFooter(ctx)           // lê ctx.theme.footer
```

### PdfTheme — Interface principal
Cada tema controla:
- **table**: headerBg, headerColor, altRowBg, borderColor, borderWidth, fontSize, columnRatios
- **totals**: position (right/left/center), showCard, cardBg, totalHighlight, totalBg, totalTextColor
- **payment**: position (inline/cards/sidebar/hidden), style (list/compact/detailed), showReferenceNote
- **footer**: style (minimal/branded/detailed), showBranding, showDate, textColor
- **narrative**: enabled, headingFont/Size/Color, bodyFont/Size/Color, bulletStyle, sectionSeparator

### Templates disponíveis

| ID | Nome | Categoria | Características |
|----|------|-----------|-----------------|
| classic | Clássico | Gratuito | Barra de cabeçalho colorida, duas colunas |
| modern | Moderno | Gratuito | Centralizado, fundo claro, elegante |
| executive | Executivo | Gratuito | Barra de acento lateral, separadores decorativos |
| sleek | Sleek | PRO | Stripe de acento, badge de status, totais em cartão, pagamento em cards |
| sidebar | Sidebar | PRO | Barra lateral escura com dados empresa + pagamento integrado, tabela grid |
| business | Business | PRO | Minimalista, grayscale, cabeçalho limpo, footer detalhado |

### Doc A — PDF Narrativo (narrativa.ts)
- PDF standalone para propostas comerciais/técnicas geradas por IA
- Header com faixa de acento, bloco direito com número e data
- Seccções numeradas com badges e underline decorativo
- Suporta bullets (dot, check, arrow, dash)
- Page breaks automáticos
- Footer com branding em todas as páginas
- Nota de encerramento: "Para detalhamento financeiro completo, consultar o documento Cotacao Financeira (Doc B)"
- Exportado como `Proposta-{NUMERO}.pdf`

### Compatibilidade
- 100% backward compatible — templates antigos funcionam exactamente como antes
- `createContext()` sem tema = comportamento original (defaults)
- `gerarPDF()` sem `narrative` = fluxo normal de cotação

---

## Documentação Legal (Maio 2026)

### Ficheiros criados (nao integrados na app)
- `ProposalJa-Termos-de-Uso.docx` — 13 cláusulas com placeholders
- `ProposalJa-Politica-de-Privacidade.docx` — 12 cláusulas, Lei 9/2022 compliant

### Estado
- Criados como ficheiros .docx para revisão
- NAO integrados na app (sem links, sem checkbox de aceitação)
- Empresa ainda NAO registada (sem NUIT/Alvará)
- Precisa de: actualização dos placeholders, integração como rotas na app, checkbox no registo

---

## Documentos Gerados (Marketing e Comunicação)
- `ProposalJa_Pitch_Comercial.pdf` — Resumo comercial (4 págs): Cover, Comercial, Marketing, Visão
- `ProposalJa_Marketing_Servicos.pdf` — Marketing com serviços da plataforma e menção ao projecto de emissão de facturas
- `proposal_swift_relatorio_completo.pdf` — Relatório técnico completo do projecto
- `schema_fixes_documento.pdf` — Documentação de correcções de schema
- `plano_migracao_supabase.pdf` — Plano de migração para Supabase

---

## Roadmap (Prioridade)

### Fase 1 — Concluída
- [x] Sistema de Temas PDF (types, themes, shared refactor, registry, 3 novos templates)
- [x] Push para GitHub e deploy na Vercel
- [x] Testar templates no site após deploy
- [x] Auditoria completa (8 bugs corrigidos)
- [x] Edge Function rewrite com Gemini + diagnóstico 10-step
- [x] Optimização mobile (padding, 2-line items, labels)

### Fase 2 — UI de Templates
- [ ] Modal de seleção visual de templates (thumbnails + preview)
- [ ] Thumbnails gerados automaticamente para cada template
- [ ] Indicador "PRO" nos templates pagos

### Fase 3 — Motor de Propostas IA

#### Arquitectura: Dois Documentos Separados
O sistema gera dois PDFs distintos com a mesma referência (ex: PROP-202605-0001):

| Documento | Conteúdo | Gerado por | Público-alvo |
|---|---|---|---|
| **A — Proposta Comercial/Técnica** | Narrativa AI (8 secções) + Resumo de Investimento | Motor de Propostas IA | Decisores técnicos e de negócio |
| **B — Cotação Financeira** | Tabela de itens + Totais + Pagamento | Sistema existente | Departamento financeiro/compras |

- Doc B = Cotação actual (já funcional) — pode receber sufixo `-FIN` no header
- Doc A = Novo PDF narrativo — texto formatado, sem tabelas complexas
- A Proposta IA é **opcional**: botão "Gerar Proposta IA" aparece APÓS a Cotação estar salva
- Motor IA **NUNCA** gere preços — recebe o total como input numérico simples
- O "Resumo de Investimento" vem do total da Cotação, não do LLM

#### Decisões Estratégicas (SWOT consolidado)

| Ref | Decisão | Justificação |
|---|---|---|
| **W3** | Cotação preenche automaticamente o prompt IA | O Motor IA recebe os dados da Cotação (items, valores, cliente) como contexto. O utilizador NAO preenche novamente dados que ja existem na Cotação. |
| **W5** | Secções vazias = responsabilidade do autor | Se o utilizador nao preenche um campo dinamico, a secção correspondente NAO aparece na proposta (ou mostra "A definir"). NAO se forca o preenchimento. |
| **O2** | Sector detectado automaticamente, editavel | A IA identifica o sector a partir do contexto da Cotação (items, nome do cliente, descricao). O utilizador pode alterar. |
| **O5** | Termo "Rascunho" em vez de "Draft" | Todo o sistema usa a expressao moçambicana "rascunho". O output da IA é tratado como "rascunho editavel" ate o utilizador aprovar. |
| **T1** | Dois modos: Rapido vs Assertivo | **Rapido** (padrao): 4-5 campos obrigatorios, IA preenche o resto. **Assertivo**: todos os campos dinamicos disponiveis. |
| **T3** | Sem solucao para tom x campos | Combinacoes tom x campos sao exponenciais. Aberto — a resolver apos primeiros testes com utilizadores reais. |
| **T4** | Sem solucao para expectativas IA | Utilizadores esperam que a IA infira dados nao fornecidos. Aberto — mitigar com placeholders descritivos. |

#### Tarefas
- [x] Tabela `proposta_ai` (Supabase migration)
- [x] Edge Function `generate-proposal` (server-side LLM call via Supabase + Gemini)
- [x] Formulário dinâmico com dois modos (Rápido / Assertivo)
- [x] Campos dinâmicos com placeholders descritivos e exemplos moçambicanos
- [x] Detecção automática de sector a partir da Cotação (editável)
- [x] Auto-população dos campos a partir dos dados da Cotação (sem duplicação)
- [x] Selecção de tom: Formal Corporativo, Persuasivo Comercial, Técnico Directo, Consultivo
- [x] System prompt anti-alucinação (estrutura de 8 secções obrigatória)
- [x] Preview editável das secções geradas (rascunho)
- [x] Service `propostaAiService.ts` (CRUD + generate + detectSector)
- [x] Página `GerarPropostaIA.tsx` (3-step flow completo)
- [x] Rota `/proposta/:id/gerar-ia` + botão "Proposta IA" no ResumoProposta
- [x] PDF narrativo para Doc A (Proposta Comercial/Técnica) — `gerarPDFNarrativa()` standalone
- [x] Doc A + Doc B exportáveis separadamente
- [ ] Resumo de Investimento automático no Doc A (total da Cotação injectado como secção)
- [ ] Exportar Doc A + Doc B simultaneamente (zip ou PDF combinado)
- [ ] Sufixo `-FIN` no header da Cotação quando anexada à Proposta IA

### Fase 4 — Monetização
- [ ] Sistema de planos (Free: 5 propostas/mês; PRO: ilimitado, 250 MTn/mês)
- [ ] Rate limiting por plano
- [ ] Gateway M-Pesa / e-Mola
- [ ] Upload de logo (PRO)
- [ ] Multi-utilizador (PRO: até 3)

### Fase 5 — Documentação Legal e Compliance
- [ ] Preencher placeholders nos docs legais
- [ ] Integrar Termos de Uso + Política de Privacidade na app
- [ ] Checkbox de aceitação no registo
- [ ] Registo da empresa (NUIT/Alvará)

### Backlog
- [ ] TanStack Query (instalado, nao usado)
- [ ] Página dedicada de facturas
- [ ] Domínio próprio (propostaja.co.mz)
- [ ] Remover `as any` residuais em Propostas.tsx, faturaService.ts, profileService.ts, propostaService.ts
- [ ] (O3) Metricas de uso por campo — trackear quais campos os utilizadores preenchem mais
- [ ] (O4) Upselling via "Campos PRO" — campos avançados bloqueados no plano gratuito
- [ ] (T2) Sistema de advertências sobre mudanças futuras nos modelos de LLM
- [ ] (T5) Controlo de custo de tokens a longo prazo
- [ ] Fase 2 — UI de Templates: Modal de seleção visual, thumbnails, indicador PRO
- [ ] Templates de sector (Bank, Telecom, Government, etc.) com campos pré-preenchidos
- [ ] **PostHog**: corrigir VITE_POSTHOG_KEY na Vercel (apagar Sensitive, recriar, Redeploy)
