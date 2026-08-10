#!/usr/bin/env python3
"""
ARCHITECTURE BASELINE AUDIT - ProposalJa
Generated: 2026-08-07
"""

import hashlib
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
    HRFlowable, ListFlowable, ListItem,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ============================================================
# PALETTE (cascade-generated)
# ============================================================
PAGE_BG       = colors.HexColor('#f2f1f3')
SECTION_BG    = colors.HexColor('#eae8eb')
CARD_BG       = colors.HexColor('#eeecef')
TABLE_STRIPE  = colors.HexColor('#eeecef')
HEADER_FILL   = colors.HexColor('#6b4d79')
COVER_BLOCK   = colors.HexColor('#6d517b')
BORDER        = colors.HexColor('#d2c7d7')
ICON          = colors.HexColor('#9149b5')
ACCENT        = colors.HexColor('#8b24be')
ACCENT_2      = colors.HexColor('#5fc55f')
TEXT_PRIMARY   = colors.HexColor('#151416')
TEXT_MUTED     = colors.HexColor('#78727b')
SEM_SUCCESS   = colors.HexColor('#439860')
SEM_WARNING   = colors.HexColor('#8e774a')
SEM_ERROR     = colors.HexColor('#944841')
SEM_INFO      = colors.HexColor('#4a6f95')

# ============================================================
# FONT REGISTRATION (Portuguese document - use Liberation Sans)
# ============================================================
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('LiberationSans', f'{FONT_DIR}/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSerif', f'{FONT_DIR}/truetype/chinese/LiberationSerif-Regular.ttf'))

# ============================================================
# STYLES
# ============================================================
W, H = A4
styles = getSampleStyleSheet()

style_body = ParagraphStyle(
    'BodyCustom', parent=styles['Normal'],
    fontName='Helvetica', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
    spaceAfter=8, spaceBefore=2,
)

style_h1 = ParagraphStyle(
    'H1Custom', parent=styles['Heading1'],
    fontName='Helvetica-Bold', fontSize=20, leading=26,
    textColor=HEADER_FILL, spaceAfter=14, spaceBefore=28,
    borderPadding=(0, 0, 4, 0),
)

style_h2 = ParagraphStyle(
    'H2Custom', parent=styles['Heading2'],
    fontName='Helvetica-Bold', fontSize=14, leading=19,
    textColor=ACCENT, spaceAfter=10, spaceBefore=18,
)

style_h3 = ParagraphStyle(
    'H3Custom', parent=styles['Heading3'],
    fontName='Helvetica-Bold', fontSize=11, leading=15,
    textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=12,
)

style_code = ParagraphStyle(
    'CodeCustom', parent=styles['Code'],
    fontName='Courier', fontSize=8, leading=11,
    textColor=colors.HexColor('#334155'),
    backColor=colors.HexColor('#f8f7fa'),
    borderPadding=(6, 6, 6, 6),
    spaceAfter=6, spaceBefore=4,
)

style_bullet = ParagraphStyle(
    'BulletCustom', parent=style_body,
    leftIndent=18, bulletIndent=6,
    spaceAfter=3, spaceBefore=1,
)

style_kicker = ParagraphStyle(
    'Kicker', fontName='Helvetica', fontSize=10,
    textColor=TEXT_MUTED, letterSpacing=3,
    spaceAfter=4,
)

style_toc_h0 = ParagraphStyle(
    'TOC0', fontName='Helvetica-Bold', fontSize=12, leading=18,
    leftIndent=0, textColor=HEADER_FILL,
)
style_toc_h1 = ParagraphStyle(
    'TOC1', fontName='Helvetica', fontSize=10, leading=16,
    leftIndent=20, textColor=TEXT_PRIMARY,
)

style_risk_high = ParagraphStyle('RiskHigh', parent=style_body, textColor=SEM_ERROR)
style_risk_med = ParagraphStyle('RiskMed', parent=style_body, textColor=SEM_WARNING)
style_risk_low = ParagraphStyle('RiskLow', parent=style_body, textColor=SEM_SUCCESS)

# ============================================================
# TOC TEMPLATE
# ============================================================
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ============================================================
# HELPERS
# ============================================================
heading_counter = {}

def add_heading(text, style, level=0):
    global heading_counter
    heading_counter[level] = heading_counter.get(level, 0) + 1
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def body(text):
    return Paragraph(text, style_body)

def bullet(text):
    return Paragraph(f'\u2022  {text}', style_bullet)

def code(text):
    return Paragraph(text.replace('<', '&lt;').replace('>', '&gt;'), style_code)

def make_table(headers, rows, col_widths=None):
    avail = W - 2 * 25*mm
    if col_widths is None:
        n = len(headers)
        col_widths = [avail / n] * n
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def spacer(h=6):
    return Spacer(1, h*mm)

# ============================================================
# CONTENT SECTIONS
# ============================================================

def build_cover(story):
    """ReportLab-native cover page"""
    story.append(Spacer(1, 60*mm))
    story.append(Paragraph(
        'ARCHITECTURE BASELINE',
        ParagraphStyle('CoverKicker', fontName='Helvetica', fontSize=11,
                       textColor=TEXT_MUTED, letterSpacing=4, spaceAfter=8)
    ))
    story.append(HRFlowable(width='30%', thickness=3, color=ACCENT, spaceAfter=12, spaceBefore=4))
    story.append(Paragraph(
        'ProposalJa',
        ParagraphStyle('CoverTitle', fontName='Helvetica-Bold', fontSize=42,
                       textColor=TEXT_PRIMARY, leading=50, spaceAfter=12)
    ))
    story.append(Paragraph(
        'Auditoria Completa do Ambiente Tecnico',
        ParagraphStyle('CoverSub', fontName='Helvetica', fontSize=16,
                       textColor=TEXT_MUTED, leading=22, spaceAfter=24)
    ))
    story.append(Spacer(1, 30*mm))
    story.append(Paragraph('Stack, Estrutura, DB, Auth, RLS, Fluxo, PDF, Deps, Scripts, Riscos, Plano',
        ParagraphStyle('CoverDesc', fontName='Helvetica', fontSize=10,
                       textColor=TEXT_MUTED, leading=14, spaceAfter=8)
    ))
    story.append(hr())
    story.append(Paragraph('2026-08-07  |  Protocolo Rule 48  |  Audit v1.0',
        ParagraphStyle('CoverDate', fontName='Helvetica', fontSize=9,
                       textColor=TEXT_MUTED)
    ))
    story.append(PageBreak())

def build_toc(story):
    story.append(Paragraph('Indice', style_h1))
    toc = TableOfContents()
    toc.levelStyles = [style_toc_h0, style_toc_h1]
    story.append(toc)
    story.append(PageBreak())

def section_1_stack(story):
    story.append(add_heading('1. Stack Tecnologico', style_h1, 0))
    story.append(body(
        'O ProposalJa e uma aplicacao Single-Page Application (SPA) construida sobre um stack moderno '
        'de frontend com backend-as-a-service. Nao existe um servidor de aplicacao tradicional; toda a '
        'logica de negocio reside no cliente React com chamadas directas ao Supabase via PostgREST API. '
        'A escolha deste stack permite desenvolvimento rapido e custos operacionais reduzidos, '
        'mas introduz restricoes significativas em termos de processamento server-side e geracao de PDFs premium.'
    ))
    story.append(add_heading('1.1 Core', style_h2, 1))
    story.append(make_table(
        ['Camada', 'Tecnologia', 'Versao', 'Notas'],
        [
            ['Build Tool', 'Vite', '5.4.19', 'SWC plugin para React'],
            ['Framework UI', 'React', '18.3.1', 'SPA, sem SSR'],
            ['Linguagem', 'TypeScript', '5.8.3', 'Strict mode'],
            ['Routing', 'React Router DOM', '6.30.1', 'BrowserRouter (hash-free)'],
            ['State / Data', 'TanStack React Query', '5.83.0', 'Server state cache'],
            ['Forms', 'React Hook Form + Zod', '7.61.1 / 3.25', 'Validacao type-safe'],
            ['UI Components', 'Radix UI + shadcn/ui', 'multiple', '30+ componentes'],
            ['CSS', 'Tailwind CSS', '3.4.17', 'JIT, @apply minimo'],
            ['Backend / DB', 'Supabase (PostgreSQL)', '-', 'PostgREST + RLS + Auth'],
            ['Client DB', 'Supabase JS', '2.104.1', 'Auto-refresh token'],
            ['Analytics', 'PostHog', '1.236.7', 'Identify + reset events'],
            ['Temas', 'next-themes', '0.3.0', 'Light/dark system'],
        ],
        col_widths=[70, 120, 55, 180]
    ))
    story.append(spacer(4))
    story.append(add_heading('1.2 DevOps e Testes', style_h2, 1))
    story.append(make_table(
        ['Ferramenta', 'Versao', 'Uso'],
        [
            ['Vitest', '3.2.4', 'Unit tests (test/test:watch)'],
            ['Testing Library', '16.0.0', 'Component tests + jsdom'],
            ['Playwright', '1.58.2', 'E2E tests (devDep, ainda sem suites)'],
            ['ESLint', '9.32.0', 'Lint estatico'],
            ['lovable-tagger', '1.1.13', 'Component tagging (dev mode)'],
            ['pg', '8.22.0', 'Direct PostgreSQL (scripts de reparacao)'],
        ],
        col_widths=[120, 60, 250]
    ))
    story.append(spacer(4))
    story.append(body(
        '<b>Ponto notavel:</b> O projecto usa Vite (Nao Next.js). Isto significa que nao existem API routes '
        'ou server-side rendering. Toda a logica AI corre via Supabase Edge Functions '
        '(invocadas por supabase.functions.invoke). O unico backend disponivel e o PostgREST '
        'do Supabase + Edge Functions + PostgreSQL RPCs.'
    ))

def section_2_structure(story):
    story.append(add_heading('2. Estrutura do Projecto', style_h1, 0))
    story.append(body(
        'O projecto segue uma organizacao flat baseada em dominios funcionais. A pasta src/ contem '
        'todas as fontes da aplicacao, divididas em pages/, components/, services/, hooks/, lib/, e types/. '
        'A separacao entre propostas simples (fluxo actual) e propostas avancadas (Blueprint Engine) '
        'e feita pela existencia de pages/advanced/ e services/advancedProposalService.ts.'
    ))
    story.append(make_table(
        ['Pasta', 'Funcao', 'Ficheiros-chave'],
        [
            ['src/pages/', 'Paginas da SPA (14 ficheiros)', 'ResumoProposta.tsx, CriarProposta.tsx, Dashboard.tsx'],
            ['src/pages/advanced/', 'Propostas avancadas (Blueprint)', 'NovaPropostaAvancada.tsx, PreencherProposta.tsx'],
            ['src/pages/admin/', 'Painel de administracao', 'TenantsTab.tsx, UsersTab.tsx, MetricsTab.tsx, AuditTab.tsx'],
            ['src/components/ui/', 'shadcn/ui (50+ componentes)', 'button.tsx, dialog.tsx, table.tsx, etc.'],
            ['src/components/org/', 'Organizacao (membros, convites)', 'MemberList.tsx, InviteModal.tsx, RoleBadge.tsx'],
            ['src/services/', 'Camada de servicos (10 ficheiros)', 'propostaService.ts, advancedProposalService.ts'],
            ['src/lib/pdf/', 'Sistema PDF (11 ficheiros)', 'registry.ts, shared.ts, classic.ts, modern.ts, etc.'],
            ['src/hooks/', 'Custom hooks (4 ficheiros)', 'useAuth.tsx, useOrganization.ts, useActivityTracker.tsx'],
            ['src/types/', 'TypeScript types (3 ficheiros)', 'index.ts, advancedProposal.ts, admin.ts'],
            ['src/integrations/', 'Supabase client + types gerados', 'client.ts, types.ts (auto-generated)'],
            ['supabase/migrations/', 'Migrations SQL (30 ficheiros)', 'rls_org_scoped.sql, blueprint_engine.sql'],
        ],
        col_widths=[95, 160, 170]
    ))
    story.append(spacer(4))
    story.append(body(
        '<b>Arquitectura de modulos:</b> O fluxo de propostas simples (CriarProposta, ResumoProposta, GerarPropostaIA) '
        'e completamente independente do fluxo avancado (NovaPropostaAvancada, PreencherProposta). Partilham '
        'apenas o Supabase client e a camada de autenticacao. Esta separacao modular e critica para a '
        'estrategia de implementacao: o fluxo simples permanece intocado enquanto o avancado evolui.'
    ))

def section_3_db(story):
    story.append(add_heading('3. Banco de Dados', style_h1, 0))
    story.append(body(
        'O Supabase fornece uma instancia PostgreSQL gerida com PostgREST. O schema public contem '
        '21 tabelas cobrindo propostas, clientes, facturas, catalogo, organizacoes, AI, e o novo Blueprint Engine. '
        'A evolucao do schema foi rastreada ao longo de 30 migrations incrementais, desde o schema '
        'single-tenant inicial ate ao actual schema multi-tenant com RLS org-scoped.'
    ))
    story.append(add_heading('3.1 Tabelas do Schema Public', style_h2, 1))
    story.append(make_table(
        ['#', 'Tabela', 'Tipo', 'RLS', 'Notas'],
        [
            ['1', 'profiles', 'Dados do utilizador', 'Sim', 'Extends auth.users'],
            ['2', 'organizations', 'Tenant principal', 'Sim', 'Plano, limites, status'],
            ['3', 'organization_members', 'Pertence org/user', 'Sim', 'Roles: owner/admin/member'],
            ['4', 'organization_invitations', 'Convites pendentes', 'Sim', 'Token + expiracao'],
            ['5', 'clients', 'Clientes por org', 'Sim', 'Unique email per org'],
            ['6', 'proposals', 'Propostas simples', 'Sim', 'Snapshot do cliente, IVA, desconto'],
            ['7', 'proposal_items', 'Items da proposta', 'Sim (via parent)', 'Cascade delete'],
            ['8', 'invoices', 'Facturas', 'Sim', 'Conversion from proposal'],
            ['9', 'invoice_items', 'Items da factura', 'Sim (via parent)', 'FK to invoices'],
            ['10', 'catalog_items', 'Catalogo de servicos', 'Sim', 'Unique name per org'],
            ['11', 'subscriptions', 'Assinaturas/plano', 'Sim', 'Per-user, per-org limits'],
            ['12', 'proposta_ai', 'Geracao AI (Doc A)', 'Sim', 'Input/output/edited JSON'],
            ['13', 'business_categories', 'Categorias de negocio', 'Nao (global)', 'Blueprint Engine'],
            ['14', 'proposal_blueprints', 'Modelos de proposta', 'Nao (global)', 'Versionados por categoria'],
            ['15', 'proposal_sections', 'Secoes do blueprint', 'Nao (global)', 'Content rules JSONB'],
            ['16', 'section_questions', 'Perguntas por seccao', 'Nao (global)', 'Visibility rules JSONB'],
            ['17', 'company_brand_profiles', 'Identidade visual', 'Sim (via org)', 'Cores, fonte, estilo'],
            ['18', 'advanced_proposals', 'Propostas avancadas', 'Sim', 'Status machine 5 estados'],
            ['19', 'proposal_section_answers', 'Respostas + AI', 'Sim (via parent)', 'Upsert on section_id'],
            ['20', 'platform_audit_log', 'Auditoria global', 'Admin only', 'Login, export, RLS change'],
            ['21', 'tenant_metrics', 'Metricas por tenant', 'Admin only', 'Contadores diarios'],
        ],
        col_widths=[20, 110, 105, 70, 120]
    ))
    story.append(spacer(4))
    story.append(add_heading('3.2 Enums', style_h2, 1))
    story.append(make_table(
        ['Enum', 'Valores'],
        [
            ['proposal_status', 'rascunho, enviada, aceite, rejeitada'],
            ['invoice_status', 'rascunho, enviada, paga, vencida, cancelada'],
            ['org_role', 'owner, admin, member'],
            ['org_status', 'active, suspended, trial'],
            ['plan_type', 'free, pro, enterprise'],
            ['desconto_tipo', 'percentual, fixo'],
            ['visual_style', 'corporate, premium, minimal, technical'],
            ['content_status', 'pendente, gerando, gerado, editando, revisado, erro'],
        ],
        col_widths=[120, 305]
    ))
    story.append(spacer(4))
    story.append(add_heading('3.3 Funcoes PostgreSQL (RPCs)', style_h2, 1))
    story.append(body(
        'O sistema inclui funcoes SECURITY DEFINER que servem como pontes seguras entre o contexto '
        'auth.uid() e as operacoes de negocio. As funcoes criticas sao: user_belongs_to_org(p_org_id) '
        'que verifica se o utilizador actual e membro de uma organizacao especifica; user_role_in_org(p_org_id) '
        'que retorna o role do utilizador numa org; has_org_role_min(p_uid, p_role) que verifica se o utilizador '
        'tem um role minimo numa org qualquer; has_role(p_uid, p_role) que verifica roles ao nivel da plataforma '
        '(ex: admin). Adicionalmente, existem RPCs para metricas de plataforma, verificacao de limites de plano, '
        'e funcoes de trigger para auto-numeracao de propostas e facturas. Todas as funcoes SECURITY DEFINER '
        'usam SET search_path = public para evitar injection de search_path.'
    ))

def section_4_auth(story):
    story.append(add_heading('4. Autenticacao e Autorizacao', style_h1, 0))
    story.append(body(
        'A autenticacao e inteiramente delegada ao Supabase Auth, com o cliente React a gerir a sessao via '
        'localStorage. O AuthProvider (useAuth.tsx) e o contexto central que expoe user, session, organization, '
        'orgRole, memberships, e funcoes auxiliares como hasOrgRoleMin() e setActiveOrganization().'
    ))
    story.append(add_heading('4.1 Fluxo Auth', style_h2, 1))
    story.append(bullet('Supabase Auth provider: email/password com confirmacao'))
    story.append(bullet('Sessao persistida em localStorage com autoRefreshToken = true'))
    story.append(bullet('onAuthStateChange: SIGNED_IN -> PostHog identify; SIGNED_OUT -> PostHog reset + redirect'))
    story.append(bullet('ProtectedRoute: verifica user != null, senao redirecciona para /auth'))
    story.append(bullet('Aceite de convite: rota /invite/accept com token-based verification'))
    story.append(spacer(3))
    story.append(add_heading('4.2 Modelo de Autorizacao', style_h2, 1))
    story.append(body(
        'O sistema implementa um modelo de autorizacao em 3 camadas: (1) Plataforma, com um role "admin" '
        'que tem acesso global a todos os tenants e dados; (2) Organizacao, com roles owner/admin/member '
        'geridos pela tabela organization_members; (3) Dados, com RLS policies que verificam '
        'user_belongs_to_org(organization_id) para cada operacao. A funcao hasOrgRoleMin() permite '
        'verificacao de role minimo (ex: member <= admin <= owner). Admins de plataforma contornam '
        'todas as policies de organizacao via has_role(auth.uid(), "admin").'
    ))
    story.append(add_heading('4.3 Gap Identificado', style_h2, 1))
    story.append(body(
        '<b>Nao existe middleware server-side.</b> Toda a verificacao de roles acontece no cliente (React) '
        'e nas RLS policies (PostgreSQL). Um utilizador com conhecimento tecnico pode modificar o cliente '
        'e contornar verificacoes de UI (ex: mostrar o botao de admin). Porem, as RLS policies protegem '
        'os dados de forma inviolavel no servidor. O risco e limitado a operacoes que dependem exclusivamente '
        'de logica cliente (ex: breadcrumbs, visibilidade de menus) e nao de operacoes de dados.'
    ))

def section_5_rls(story):
    story.append(add_heading('5. Row Level Security (RLS)', style_h1, 0))
    story.append(body(
        'Todas as 21 tabelas com dados de negocio possuem RLS activo. As politicas foram evoluindo ao '
        'longo das migrations: da abordagem inicial baseada em owner_id simples, para o modelo actual '
        'org-scoped que usa a funcao user_belongs_to_org(p_org_id) para validar pertença a organizacao '
        'especifica de cada registo. As tabelas globais do Blueprint Engine (business_categories, '
        'proposal_blueprints, proposal_sections, section_questions) nao tem RLS pois sao dados de '
        'referencia partilhados por todos os tenants.'
    ))
    story.append(add_heading('5.1 Politicas por Tabela', style_h2, 1))
    story.append(make_table(
        ['Tabela', 'Select', 'Insert', 'Update', 'Delete', 'Modelo'],
        [
            ['organizations', 'membro OR admin', '-', 'owner/admin OR admin', '-', 'Org-scoped'],
            ['organization_members', 'membro OR admin', 'owner/admin', 'owner/admin', 'owner/admin', 'Org-scoped'],
            ['clients', 'org OR owner', 'org OR owner', 'org OR owner', 'org OR owner', 'Dual (org+owner)'],
            ['proposals', 'org OR owner', 'org+member', 'org OR owner', 'org+admin', 'Org-scoped + role'],
            ['proposal_items', 'via parent', 'via parent', 'via parent', 'via parent', 'Subquery parent'],
            ['invoices', 'org OR owner', 'org+member', 'org OR owner', 'org+admin', 'Org-scoped + role'],
            ['invoice_items', 'via parent', 'via parent', 'via parent', 'via parent', 'Subquery parent'],
            ['proposta_ai', 'org OR user', 'org OR user', 'org OR user', 'org OR user', 'Org-scoped + user'],
            ['profiles', 'self OR org member', '-', '-', '-', 'Self + org members'],
            ['advanced_proposals', 'org-scoped', 'org-scoped', 'org-scoped', 'org-scoped', 'Org-scoped (novo)'],
            ['proposal_section_answers', 'via parent', 'via parent', 'via parent', 'via parent', 'Subquery parent (novo)'],
            ['company_brand_profiles', 'org-scoped', 'org-scoped', 'org-scoped', 'org-scoped', 'Org-scoped (novo)'],
        ],
        col_widths=[75, 65, 60, 65, 60, 100]
    ))
    story.append(spacer(4))
    story.append(add_heading('5.2 Padrao de Funcoes Auxiliares', style_h2, 1))
    story.append(body(
        'As RLS policies usam funcoes SECURITY DEFINER com SET search_path = public. Este padrao e '
        'critico para seguranca: sem SET search_path, um utilizador malicioso poderia criar funcoes '
        'com nomes que sobrepunham as funcoes do sistema e assim executar codigo arbitrario dentro do '
        'contexto SECURITY DEFINER. As funcoes-chave sao user_belongs_to_org(UUID) que faz EXISTS '
        'SELECT na tabela organization_members, e user_role_in_org(UUID) que retorna o enum org_role. '
        'A funcao has_role(auth.uid(), role) verifica se o utilizador e admin de plataforma consultando '
        'a tabela profiles.role diretamente.'
    ))
    story.append(add_heading('5.3 Estado da Migration do Blueprint Engine', style_h2, 1))
    story.append(body(
        'A migration 20260807000000 cria as 5 novas tabelas do Blueprint Engine, indexes, triggers, e '
        'RLS policies. Porem, a conectividade directa a base de dados nao esta disponivel neste '
        'ambiente (IPv6 ENETUNREACH), pelo que nao foi possivel verificar se esta migration ja foi '
        'aplicada ao Supabase remoto. O SQL foi validado sintacticamente e e idempotente (CREATE IF NOT EXISTS). '
        'A migration deve ser aplicada via Supabase Dashboard > SQL Editor ou Supabase CLI (supabase db push) '
        'antes de qualquer operacao nas novas tabelas.'
    ))

def section_6_flux(story):
    story.append(add_heading('6. Fluxo Actual de Propostas', style_h1, 0))
    story.append(body(
        'O ProposalJa tem dois fluxos distinctos de criacao de propostas: o fluxo simples (existente, '
        'estavel, usado em producao) e o fluxo avancado (Blueprint Engine, em implementacao). Ambos '
        'produzem PDFs, mas por caminhos diferentes.'
    ))
    story.append(add_heading('6.1 Fluxo Simples (Producao)', style_h2, 1))
    story.append(body(
        'O fluxo simples comeca na pagina CriarProposta.tsx, onde o utilizador selecciona um cliente, '
        'adiciona items ao catalogo ou manualmente, define desconto e IVA, e grava a proposta. '
        'A PropostaService.criarProposta() cria um snapshot do cliente, calcula totais via calculos.ts, '
        'insere a proposta e os items numa transacao logica (delete + re-insert em caso de edicao). '
        'A pagina ResumoProposta.tsx mostra a proposta completa com opcoes de editar, duplicar, gerar PDF, '
        'ou converter em factura. O PDF e gerado client-side via jsPDF com o Registry Pattern '
        '(6 templates: classic, modern, executive = free; sleek, sidebar, business = PRO).'
    ))
    story.append(add_heading('6.2 Fluxo Avancado (Blueprint Engine)', style_h2, 1))
    story.append(body(
        'O fluxo avancado comeca em NovaPropostaAvancada.tsx com a seleccao de categoria de negocio '
        '(business_categories) seguida da seleccao de blueprint (proposal_blueprints). Apos criacao '
        'do registo advanced_proposals, o utilizador navega para PreencherProposta.tsx que apresenta '
        'um wizard de seccoes com perguntas fixas (section_questions). As respostas sao gravadas '
        'em proposal_section_answers via upsert. O fluxo de geracao AI (por seccao) e de renderizacao '
        'premium (HTML/CSS + Playwright) ainda nao esta implementado - e o principal objectivo '
        'da implementacao que se segue a esta auditoria.'
    ))
    story.append(add_heading('6.3 Fluxo AI (Doc A - Proposta Comercial)', style_h2, 1))
    story.append(body(
        'Existe um terceiro fluxo que cruza os dois: a geracao AI de conteudo narrativo. Na pagina '
        'GerarPropostaIA.tsx, o utilizador preenche campos de contexto (problema, solucao, beneficios, '
        'etc.), escolhe o tom e o modelo AI, e invoca a Edge Function generate-proposal via '
        'propostaAiService.ts. O resultado e gravado em proposta_ai e pode ser exportado como PDF '
        'narrativo via narrativa.ts (PDF independente sem tabela de items). Este fluxo funciona '
        'independentemente do fluxo de propostas simples e nao partilha dados com o Blueprint Engine.'
    ))

def section_7_pdf(story):
    story.append(add_heading('7. Sistema PDF', style_h1, 0))
    story.append(body(
        'O sistema PDF e o componente mais complexo e mais criticado do ProposalJa. Usa jsPDF client-side '
        'com o Registry Pattern para gerar documentos PDF directamente no browser. O sistema compoe-se '
        'de 11 ficheiros TypeScript na pasta src/lib/pdf/, totalizando aproximadamente 980 chamadas doc.* '
        'distribuidas por 8 renderizadores.'
    ))
    story.append(add_heading('7.1 Arquitectura PDF', style_h2, 1))
    story.append(make_table(
        ['Ficheiro', 'Funcao', 'doc.* calls', 'Notas'],
        [
            ['registry.ts', 'Registo central de templates', '0', 'Map<string, TemplateEntry>'],
            ['types.ts', 'Tipos (PdfTheme, TemplateEntry)', '0', 'Interface definitions'],
            ['themes.ts', '6 temas visuais (PdfTheme)', '0', 'Cores, fontes, spacing'],
            ['shared.ts', 'Funcoes partilhadas', '538', 'drawItemsTable, drawTotals, drawPaymentMethods, drawFooter, drawNarrativeSections'],
            ['index.ts', 'Ponto de entrada unificado', '0', 'gerarPDF() -> getTemplate().render()'],
            ['classic.ts', 'Template Classico', '45', 'Free, header colorido'],
            ['modern.ts', 'Template Moderno', '45', 'Free, centralizado'],
            ['executive.ts', 'Template Executivo', '50', 'Free, barra lateral accent'],
            ['sleek.ts', 'Template Sleek', '63', 'PRO, badges + stripe'],
            ['sidebar.ts', 'Template Sidebar', '71', 'PRO, barra lateral escura (quebra abstracao)'],
            ['business.ts', 'Template Business', '52', 'PRO, estilo factura premium'],
            ['narrativa.ts', 'PDF narrativo AI', '118', 'Ignora template param, output independente'],
        ],
        col_widths=[70, 145, 55, 155]
    ))
    story.append(spacer(4))
    story.append(add_heading('7.2 Theme System', style_h2, 1))
    story.append(body(
        'Cada template define um PdfTheme com 5 subsistemas: table (headerBg, columnRatios, theme), '
        'totals (position, showCard, totalHighlight), payment (position, style, title), footer (style, '
        'showBranding), e narrative (enabled, headingSize, bodySize, bulletStyle). As shared functions '
        '(drawItemsTable, drawTotals, etc.) leem de ctx.theme com defaults que replicam o comportamento '
        'anterior a introducao do theme system. A funcao createContext() cria o PDFContext que e passada '
        'a todas as render functions.'
    ))
    story.append(add_heading('7.3 Problemas Conhecidos', style_h2, 1))
    story.append(bullet('<b>sidebar.ts quebra a abstracao:</b> Usa drawItemsTable() e drawTotals() de shared.ts mas reimplementa header e pagamento, ignorando o theme system parcialmente.'))
    story.append(bullet('<b>narrativa.ts ignora o template:</b> O parametro template e recebido mas nao usado; gera sempre o mesmo layout fixo sem suporte a cores/estilo da empresa.'))
    story.append(bullet('<b>jsPDF limitacoes:</b> Sem suporte nativo a CSS flexbox/grid; layout manual via coordenadas absolutas; sem kerning de fontes; sem suporte a imagens SVG; sem embed de fontes custom (limitado a Helvetica/Times/Courier).'))
    story.append(bullet('<b>Tamanho do bundle:</b> ~980 chamadas doc.* resultam num bundle PDF significativo. Lazy loading via dynamic import de jspdf-autotable mitiga parcialmente.'))
    story.append(add_heading('7.4 Strategia de Migracao Aprovada', style_h2, 1))
    story.append(body(
        'Foi aprovada a migracao do sistema PDF premium para HTML/CSS + Playwright: (1) Templates free '
        '(classic, modern, executive) mantem jsPDF com melhorias incrementais; (2) Templates PRO (sleek, '
        'sidebar, business) e novos templates avancados usam HTML/CSS + Playwright para renderizacao '
        'no browser, com page.pdf() para output vectorial; (3) O narrativa.ts e completamente substituido '
        'pelo novo sistema HTML/CSS; (4) O Registry Pattern e mantido, mas o render function passa a '
        'gerar HTML em vez de usar jsPDF diretamente para templates PRO.'
    ))

def section_8_deps(story):
    story.append(add_heading('8. Dependencias', style_h1, 0))
    story.append(body(
        'O projecto tem 34 dependencias de producao e 17 devDependencies. Abaixo estao as dependencias '
        'criticas para o sistema de propostas avancadas.'
    ))
    story.append(add_heading('8.1 Dependencias Criticas', style_h2, 1))
    story.append(make_table(
        ['Pacote', 'Versao', 'Uso no Sistema Avancado', 'Risco'],
        [
            ['jspdf', '4.2.1', 'PDF standard (free templates)', 'Manter, nao remover'],
            ['jspdf-autotable', '5.0.7', 'Tabelas nos PDFs', 'Manter'],
            ['@supabase/supabase-js', '2.104.1', 'Toda a comunicacao DB', 'Core dependency'],
            ['react-router-dom', '6.30.1', 'Navegacao SPA', 'Sem risco'],
            ['zod', '3.25.76', 'Validacao de forms', 'Usar para AI input validation'],
            ['@playwright/test', '1.58.2', 'E2E tests (devDep)', 'Precisa upgrade para browser PDF'],
            ['pg', '8.22.0', 'Scripts de reparacao DB', 'Somente scripts, nao runtime'],
            ['recharts', '2.15.4', 'Graficos no dashboard', 'Sem impacto no sistema avancado'],
        ],
        col_widths=[100, 55, 175, 95]
    ))
    story.append(spacer(4))
    story.append(add_heading('8.2 Dependencias em Falta', style_h2, 1))
    story.append(bullet('<b>playwright (runtime):</b> Necessario para HTML/CSS -> PDF premium. Actualmente apenas como devDep. Precisa ser adicionado como dependency de producao ou usar CDN bundle.'))
    story.append(bullet('<b>marked / markdown-it:</b> Necessario para converter markdown (output AI) em HTML para os PDFs premium.'))
    story.append(bullet('<b>html2canvas ou similar:</b> Apenas se for necessario fallback para navegadores sem suporte a page.pdf().'))


def section_9_scripts(story):
    story.append(add_heading('9. Scripts Disponiveis', style_h1, 0))
    story.append(body(
        'Tres scripts SQL de seguranca foram criados na sessao anterior para protecao contra danos '
        'na base de dados. Todos estao disponiveis em /home/z/my-project/scripts/ e copiados para /download/.'
    ))
    story.append(make_table(
        ['Script', 'Linhas', 'Funcao'],
        [
            ['proposaja_db_repair.sql', '~800', 'Reparacao idempotente: 16 seccoes (diagnosticos, enums, funcoes, tabelas, colunas, constraints, triggers, RPCs, RLS 40+ policies, storage, backfill, verificacao)'],
            ['proposaja_db_backup_restore.sql', '~120', 'Funcoes de restore point: create_restore_point(), restore_from_point(), cleanup_restore_points(), list_restore_points() + pg_dump templates'],
            ['proposaja_db_diagnostics.sql', '~300', '25+ SELECT queries: inventario de schema, gaps RLS, dados orfaos, cross-tenant leaks, totais inconsistentes, indexes em falta, SECURITY DEFINER sem search_path, metricas de negocio'],
        ],
        col_widths=[130, 40, 255]
    ))
    story.append(spacer(4))
    story.append(body(
        'Alem destes, os npm scripts definidos em package.json sao: dev (vite), build (vite build), '
        'build:dev (vite build --mode development), lint (eslint), preview (vite preview), test (vitest run), '
        'e test:watch (vitest). Nao existem scripts de migracao, seed, ou deploy no package.json.'
    ))

def section_10_critical(story):
    story.append(add_heading('10. Pontos Criticos', style_h1, 0))
    story.append(body(
        'Esta seccao identifica os pontos de maior atencao tecnica que devem ser considerados durante '
        'a implementacao do sistema de propostas avancadas.'
    ))
    story.append(add_heading('10.1 Conectividade DB', style_h2, 1))
    story.append(body(
        'Nao foi possivel estabelecer ligacao directa PostgreSQL a partir deste ambiente (erro ENETUNREACH '
        'por resolucao IPv6). A API REST do Supabase tambem nao respondeu com as credenciais fornecidas '
        '(service_role key invalida ou expirada). Isto significa que todas as operacoes DB devem ser '
        'executadas pelo utilizador via Supabase Dashboard, CLI, ou pela aplicacao em producao. '
        'As migrations SQL foram preparadas e validadas sintacticamente, mas a aplicacao remota '
        'depende de intervencao manual para ser aplicada.'
    ))
    story.append(add_heading('10.2 Migration do Blueprint Engine', style_h2, 1))
    story.append(body(
        'A migration 20260807000000 cria 5 tabelas novas, mas o seu estado de aplicacao no Supabase '
        'remoto e desconhecido. A migration e idempotente (CREATE IF NOT EXISTS) pelo que pode ser '
        're-executada com seguranca. No entanto, a migration de seed data (20260807010000) que insere '
        'categorias e blueprints de exemplo usa INSERT sem ON CONFLICT, pelo que nao e idempotente '
        'e deve ser executada apenas uma vez.'
    ))
    story.append(add_heading('10.3 Tipos Supabase Auto-Generated', style_h2, 1))
    story.append(body(
        'O ficheiro src/integrations/supabase/types.ts e auto-gerado pelo Supabase CLI. Apos aplicar as '
        'migrations do Blueprint Engine, este ficheiro deve ser regenerado com supabase gen types para que '
        'os tipos TypeScript reflictam as novas tabelas e colunas. Sem esta regeneracao, o TypeScript '
        'reportara erros de tipos em todas as operacoes nas novas tabelas.'
    ))
    story.append(add_heading('10.4 Separacao de Modulos', style_h2, 1))
    story.append(body(
        'A separacao entre o fluxo simples e o fluxo avancado e bem definida ao nivel de paginas e servicos, '
        'mas existe partilha do mesmo Supabase client e do mesmo contexto de autenticacao. O sistema '
        'avancado depende da organizacao activa (organization?.id) para criar propostas, mas nao valida '
        'explicitamente se a organizacao tem um plano que suporta propostas avancadas. Esta validacao '
        'deve ser adicionada antes da criacao de propostas avancadas.'
    ))

def section_11_risks(story):
    story.append(add_heading('11. Riscos', style_h1, 0))
    story.append(make_table(
        ['Risco', 'Severidade', 'Probabilidade', 'Mitigacao'],
        [
            ['Migration nao aplicada no Supabase remoto', 'Alta', 'Media', 'Executar via Dashboard SQL Editor antes de qualquer operacao'],
            ['Tipos TypeScript desactualizados', 'Media', 'Alta', 'Executar supabase gen types apos migration'],
            ['RLS policies em falta nas novas tabelas', 'Alta', 'Baixa', 'A migration inclui RLS para todas as novas tabelas; verificar com diagnostics.sql'],
            ['Conexao IPv6 no ambiente actual', 'Media', 'Alta', 'Usar Supabase Dashboard ou CLI para operacoes DB; nao depende deste ambiente'],
            ['jsPDF limitacoes para PDFs premium', 'Media', 'Confirmada', 'Migracao aprovada para HTML/CSS + Playwright nos templates PRO'],
            ['AI hallucination em conteudo gerado', 'Alta', 'Media', 'Sistema anti-hallucination: AI preenche dentro de estrutura aprovada, usa [INFORMACAO EM FALTA] para gaps'],
            ['Playwright bundle size impact', 'Baixa', 'Media', 'Lazy loading; Playwright e ~15MB gzip mas so carregado quando necessario'],
            ['Divergencia de dados entre propostas simples e avancadas', 'Media', 'Media', 'Manter separation of concerns; opcional: future sync via shared proposal_id'],
        ],
        col_widths=[130, 50, 60, 185]
    ))

def section_12_plan(story):
    story.append(add_heading('12. Plano de Implementacao', style_h1, 0))
    story.append(body(
        'O plano de implementacao segue a diretiva do Protocolo Rule 48: apos a auditoria BASELINE, '
        'prosseguir automaticamente para a implementacao sem pedir permissao. O plano esta organizado '
        'em fases sequenciais com checkpoints de verificacao.'
    ))
    story.append(add_heading('Fase 1: Fundacao DB (Prioridade Maxima)', style_h2, 1))
    story.append(bullet('Verificar/aplicar migration 20260807000000 no Supabase remoto'))
    story.append(bullet('Aplicar migration de seed data 20260807010000 (categorias + blueprints)'))
    story.append(bullet('Executar supabase gen types para regenerar tipos TypeScript'))
    story.append(bullet('Executar diagnostics.sql para verificar integridade do schema'))
    story.append(bullet('Verificar RLS policies nas 5 novas tabelas'))
    story.append(spacer(3))
    story.append(add_heading('Fase 2: Document Model + Question Engine', style_h2, 1))
    story.append(bullet('Implementar DocumentModel que transforma answers + blueprint em estrutura de documento'))
    story.append(bullet('Criar type-safe content rules validation (minWords, maxWords, tone, etc.)'))
    story.append(bullet('Implementar visibility rules engine (showIf com equals/not_equals/contains)'))
    story.append(bullet('Adicionar validacao de respostas obrigatorias no wizard PreencherProposta.tsx'))
    story.append(spacer(3))
    story.append(add_heading('Fase 3: AI Integration (por seccao)', style_h2, 1))
    story.append(bullet('Criar AI service que gera conteudo por seccao (nao documento inteiro)'))
    story.append(bullet('Implementar prompt engineering com contexto da seccao + respostas + info da empresa'))
    story.append(bullet('Sistema anti-hallucination: AI preenche dentro de estrutura aprovada'))
    story.append(bullet('Usar [INFORMACAO EM FALTA] para gaps de dados'))
    story.append(bullet('Streaming de geracao com indicador de progresso'))
    story.append(bullet('Guardar ai_content, ai_model, ai_tokens_used em proposal_section_answers'))
    story.append(spacer(3))
    story.append(add_heading('Fase 4: HTML/CSS Renderer (Premium PDFs)', style_h2, 1))
    story.append(bullet('Criar design system base (typography scale, color system, spacing)'))
    story.append(bullet('Implementar render HTML a partir do DocumentModel'))
    story.append(bullet('Usar Playwright page.pdf() para output vectorial'))
    story.append(bullet('Criar pelo menos 1 template premium HTML/CSS'))
    story.append(bullet('Manter jsPDF para templates free (classic, modern, executive)'))
    story.append(spacer(3))
    story.append(add_heading('Fase 5: Brand Profiles + Design System', style_h2, 1))
    story.append(bullet('UI para configurar Brand Profile (cores, fonte, estilo visual)'))
    story.append(bullet('Integrar Brand Profile com o HTML/CSS renderer'))
    story.append(bullet('Extracao automatica de cores do logo (se disponivel)'))
    story.append(spacer(3))
    story.append(add_heading('Fase 6: Revisao + Exportacao', style_h2, 1))
    story.append(bullet('Pagina de revisao com todas as seccoes geradas'))
    story.append(bullet('Edicao inline do conteudo gerado pela AI'))
    story.append(bullet('Exportacao PDF (premium via Playwright, standard via jsPDF)'))
    story.append(bullet('Controlo de versoes do blueprint (blueprint_version)'))
    story.append(spacer(3))
    story.append(add_heading('Fase 7: Auditoria + Validacao Final', style_h2, 1))
    story.append(bullet('Verificar RLS em todas as operacoes do novo sistema'))
    story.append(bullet('Testes manuais do fluxo completo (categoria -> blueprint -> respostas -> AI -> PDF)'))
    story.append(bullet('Executar diagnostics.sql completo'))
    story.append(bullet('Verificar que o fluxo simples continua intacto (zero regressao)'))
    story.append(spacer(6))
    story.append(body(
        '<b>Regra de ouro:</b> O fluxo de propostas simples (CriarProposta, ResumoProposta, PDF jsPDF) '
        'e sagrado. Nenhum codigo existente deve ser modificado sem necessidade absoluta. Todo o novo '
        'sistema de propostas avancadas e adicionado em paralelo, com rotas, servicos e tipos proprios.'
    ))

# ============================================================
# BUILD
# ============================================================

def build():
    output_path = '/home/z/my-project/download/ProposalJa_ARCHITECTURE_BASELINE_Audit.pdf'
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=25*mm,
        bottomMargin=20*mm,
        leftMargin=25*mm,
        rightMargin=25*mm,
        title='ProposalJa - Architecture Baseline Audit',
        author='Z.ai Audit System',
        subject='Technical audit of the ProposalJa platform',
    )

    story = []
    build_cover(story)
    build_toc(story)
    section_1_stack(story)
    section_2_structure(story)
    section_3_db(story)
    section_4_auth(story)
    section_5_rls(story)
    section_6_flux(story)
    section_7_pdf(story)
    section_8_deps(story)
    section_9_scripts(story)
    section_10_critical(story)
    section_11_risks(story)
    section_12_plan(story)

    doc.multiBuild(story)
    print(f'PDF gerado: {output_path}')
    return output_path

if __name__ == '__main__':
    build()
