# Proposal Swift — Estado do Projecto

## Tecnologia
- React 18 + Vite 5 + TypeScript + Supabase
- Tailwind CSS + lucide-react icons
- Deploy: Vercel (https://propostaja2.vercel.app)
- Supabase: https://ytbgfrbhyclnfdftmnoy.supabase.co
- Admin: graciochiziane@gmail.com
- GitHub: https://github.com/graciochiziane/proposal-swift-main

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

### PDF Templates (src/lib/pdf/) — Sistema de Temas
- **6 templates** registados via `registry.ts`
- **3 gratuitos:** classic, modern, executive
- **3 PRO:** sleek, sidebar, business
- Sistema de temas (`PdfTheme`): cada template controla aparência de tabela, totais, pagamento, footer
- `shared.ts` refacturado: `createContext()` aceita tema opcional, funções são theme-aware com defaults
- `drawNarrativeSections()` pronta para propostas geradas por IA
- Mostram sempre PROPOSTA (sem logica FATURA)
- Usam proposta.numero (PROP-XXXX)
- Ver secção "Sistema de Temas PDF" abaixo para detalhes técnicos

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

## Regras Criticas (PDF)
- jsPDF: NAO usar hex strings directos — usar `hexToRgb()` para converter para `[r,g,b]`
- jsPDF: NAO usar `doc.triangle()` — nao existe na API
- jsPDF: NAO usar alpha em `setFillColor` — so arrays RGB `[r,g,b]`
- jsPDF: NAO usar emojis no PDF
- `darken()` e `lighten()` existem em `shared.ts`
- `secondary` NAO existe no contexto PDF
- Até 3 `as any` aceitáveis em `shared.ts` para contornar tipagem jsPDF
- Templates antigos passam tema via `createContext(proposta, cliente, dono, tema)` — 4º parametro opcional

## Deploy
- Vercel via GitHub (branch main)
- vercel.json com SPA rewrites na raiz
- Supabase Site URL: https://propostaja2.vercel.app

## Pendente (Resumo)
Veja a seccao "Roadmap" para detalhes completos por fase.
- Fase 2: UI de Templates (adiada)
- Fase 3: Motor de Propostas IA (em curso — ver Fase 3 abaixo)
- Fase 4: Monetizacao (dependente da Fase 3)
- Fase 5: Documentacao Legal e Compliance
- Backlog: TanStack Query, paginas facturas, dominio proprio, as any residuais, O3/O4/T2/T5

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

### Compatibilidade
- 100% backward compatible — templates antigos funcionam exactamente como antes
- `createContext()` sem tema = comportamento original (defaults)
- `gerarPDF()` sem `narrative` = fluxo normal de cotação

### Preparado para IA
- `drawNarrativeSections(ctx, startY)` já implementada em `shared.ts`
- Aceita array de `NarrativeSection[]` (titulo, texto, itens)
- Suporta page breaks automáticos, bullets, separadores de secção
- Estilização via `PdfTheme.narrative`
- Apenas activada quando `narrative.enabled = true` no tema

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

## Roadmap (Prioridade)

### Fase 1 — Concluída (80%)
- [x] Sistema de Temas PDF (types, themes, shared refactor, registry, 3 novos templates)
- [x] Push para GitHub e deploy na Vercel
- [x] Testar templates no site após deploy (3 templates testados, ~80% bem)
- [ ] 20% ajustes menores nos templates (pendente)

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
| **W5** | Secções vazias = responsabilidade do autor | Se o utilizador nao preenche um campo dinamico, a secção correspondente NAO aparece na proposta (ou mostra "A definir"). NAO se forca o preenchimento — mantem-se a dinamica e nao se cansa quem quer simplicidade. |
| **O2** | Sector detectado automaticamente, editavel | A IA identifica o sector a partir do contexto da Cotação (items, nome do cliente, descricao). O utilizador pode alterar. Sectors sugeridos: Bank, Telecom, Government, Retail, NGO, Outro. |
| **O5** | Termo "Rascunho" em vez de "Draft" | Todo o sistema usa a expressao moçambicana "rascunho" (ja usada no enum `proposal_status`). O output da IA é tratado como "rascunho editavel" ate o utilizador aprovar. |
| **T1** | Dois modos: Rapido vs Assertivo | **Rapido** (padrao): 4-5 campos obrigatorios, IA preenche o resto com base nos dados da Cotação. **Assertivo**: todos os campos dinamicos disponiveis, utilizador controla cada secção. A escolha e do utilizador. |
| **T3** | Sem solucao para tom x campos | Combinacoes tom × campos sao exponenciais. Aberto — a resolver apos primeiros testes com utilizadores reais. |
| **T4** | Sem solucao para expectativas IA | Utilizadores esperam que a IA infira dados nao fornecidos. Aberto — mitigar com placeholders descritivos e exemplos nos campos. |

#### Tarefas
- [x] Tabela `proposta_ai` (Supabase migration)
- [x] Edge Function `generate-proposal` (server-side LLM call via Supabase)
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
- [ ] Resumo de Investimento no Doc A (total da Cotação, sem tabela detalhada)
- [ ] Exportar Doc A + Doc B simultaneamente
- [ ] Sufixo `-FIN` no header da Cotação quando anexada à Proposta

#### Pendente para funcionar
1. Executar `supabase/migrations/proposta_ai.sql` no SQL Editor do Supabase
2. Configurar `OPENAI_API_KEY` como secret do Supabase Edge Function

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
- [ ] (O3) Metricas de uso por campo — trackear quais campos os utilizadores preenchem mais para optimizar o formulário dinâmico apos 50+ propostas geradas
- [ ] (O4) Upselling via "Campos PRO" — campos avançados (ROI, Benchmark, Estudo de Caso) bloqueados no plano gratuito com tooltip
- [ ] (T2) Sistema de advertências aos clientes sobre mudanças futuras nos modelos de LLM (output pode variar entre versões)
- [ ] (T5) Controlo de custo de tokens a longo prazo — monitorizar uso e preco por modelo
- [ ] Fase 2 — UI de Templates: Modal de seleção visual, thumbnails, indicador PRO
- [ ] 20% ajustes nos templates PDF existentes (testados e aprovados a 80%)
- [ ] Templates de sector (Bank, Telecom, Government, etc.) com campos pré-preenchidos por contexto
