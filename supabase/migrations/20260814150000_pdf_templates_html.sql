-- ============================================================
-- PDF Templates HTML — Sistema de templates dinâmicos
--
-- Permite que Admins de organização importem templates HTML
-- criados externamente (VS Code, CodePen, etc.) e os usem
-- para gerar PDFs de propostas.
--
-- Modelo de trabalho:
--   1. Admin cria HTML externamente (com <style> inline)
--   2. Cola o HTML no PropostaJá
--   3. Preview com dados de exemplo
--   4. Salva — template disponível para a org
--
-- Placeholders suportados:
--   {{proposta.numero}} {{proposta.data}} {{proposta.subtotal}}
--   {{proposta.desconto}} {{proposta.iva}} {{proposta.total}}
--   {{cliente.nome}} {{cliente.empresa}} {{cliente.email}}
--   {{cliente.telefone}} {{cliente.nuit}} {{cliente.endereco}}
--   {{empresa.nome}} {{empresa.nuit}} {{empresa.endereco}}
--   {{empresa.email}} {{empresa.telefone}}
--   {{observacoes}}
--   {{{items}}} — tabela HTML gerada automaticamente
--   {{{narrative}}} — secções narrativas (para propostas IA)
--
-- Rendering: HTML → DOMPurify → html2canvas → jsPDF
-- Futuro: migrar para Playwright (PDF acessível com texto seleccionável)
--
-- Data: 2026-08-14
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pdf_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    html TEXT NOT NULL,
    plan_tier public.plan_tier DEFAULT 'free',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pdf_templates_nome_check CHECK (length(nome) >= 2 AND length(nome) <= 100),
    CONSTRAINT pdf_templates_html_check CHECK (length(html) > 50)
);

-- Index
CREATE INDEX IF NOT EXISTS pdf_templates_org_idx
    ON public.pdf_templates(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS pdf_templates_system_idx
    ON public.pdf_templates(is_system) WHERE is_system = true;

-- Trigger updated_at
CREATE TRIGGER trg_pdf_templates_updated_at
    BEFORE UPDATE ON public.pdf_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da org vêem templates da sua org + system templates
DROP POLICY IF EXISTS "pdf_templates_select" ON public.pdf_templates;
CREATE POLICY "pdf_templates_select" ON public.pdf_templates
    FOR SELECT TO authenticated
    USING (
        is_system = true  -- templates globais do sistema
        OR public.user_belongs_to_org(organization_id)  -- templates da org
        OR public.has_role(auth.uid(), 'admin'::public.app_role)  -- platform admin
    );

-- INSERT: owner ou admin da org
DROP POLICY IF EXISTS "pdf_templates_insert" ON public.pdf_templates;
CREATE POLICY "pdf_templates_insert" ON public.pdf_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        (organization_id IS NOT NULL
         AND public.user_belongs_to_org(organization_id)
         AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- UPDATE: owner ou admin da org, ou platform admin
DROP POLICY IF EXISTS "pdf_templates_update" ON public.pdf_templates;
CREATE POLICY "pdf_templates_update" ON public.pdf_templates
    FOR UPDATE TO authenticated
    USING (
        public.user_belongs_to_org(organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    WITH CHECK (
        public.user_belongs_to_org(organization_id)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- DELETE: owner ou admin da org, ou platform admin
DROP POLICY IF EXISTS "pdf_templates_delete" ON public.pdf_templates;
CREATE POLICY "pdf_templates_delete" ON public.pdf_templates
    FOR DELETE TO authenticated
    USING (
        (organization_id IS NOT NULL AND public.has_org_role_min_in_org(organization_id, 'admin'::public.org_role))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
    );

-- ============================================================
-- Seed: 1 template de sistema (exemplo)
-- ============================================================
INSERT INTO public.pdf_templates (
    organization_id, nome, descricao, html, plan_tier, is_system, sort_order, created_by
) VALUES (
    NULL,
    'Clássico',
    'Template clássico com cabeçalho azul e tabela de itens',
    '<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #333; }
.header { border-bottom: 3px solid #0B5394; padding-bottom: 20px; margin-bottom: 30px; }
.header h1 { color: #0B5394; margin: 0; font-size: 28px; }
.header p { color: #666; margin: 5px 0 0 0; }
.cliente { margin-bottom: 30px; }
.cliente h2 { font-size: 16px; color: #999; margin: 0 0 5px 0; }
.cliente p { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: #0B5394; color: white; padding: 10px; text-align: left; font-size: 13px; }
td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
.totais { text-align: right; margin-top: 20px; }
.totais .linha { margin: 5px 0; }
.totais .total { font-size: 22px; color: #0B5394; font-weight: bold; }
.footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #999; }
</style>
<div class="header">
  <h1>PROPOSTA {{proposta.numero}}</h1>
  <p>{{proposta.data}}</p>
</div>
<div class="cliente">
  <h2>CLIENTE</h2>
  <p><strong>{{cliente.nome}}</strong></p>
  <p>{{cliente.empresa}}</p>
  <p>{{cliente.telefone}} | {{cliente.email}}</p>
</div>
{{{items}}}
<div class="totais">
  <div class="linha">Subtotal: {{proposta.subtotal}}</div>
  <div class="linha">Desconto: {{proposta.desconto}}</div>
  <div class="linha">IVA (16%): {{proposta.iva}}</div>
  <div class="total">Total: {{proposta.total}}</div>
</div>
<div class="footer">
  <p>{{empresa.nome}} | NUIT: {{empresa.nuit}} | {{empresa.endereco}}</p>
</div>',
    'free',
    true,
    0,
    (SELECT id FROM auth.users WHERE email = 'graciochiziane@gmail.com' LIMIT 1)
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.pdf_templates IS
'Sistema de templates HTML para PDFs de propostas. Admins importam HTML criado externamente. Placeholders {{}} são substituídos por dados reais. Rendering: html2canvas (futuro: Playwright para PDF acessível).';
