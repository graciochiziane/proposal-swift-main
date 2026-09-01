// ============================================================
// PDF Template Service — CRUD + render de templates HTML
//
// Modelo: admin cria HTML externamente, cola no PropostaJá.
// Placeholders {{}} são substituídos por dados reais.
// Geração: HTML → DOMPurify → documento autónomo (.html)
// PDF via Imprimir do browser (sem jsPDF/html2canvas).
//
// Nota: o nome do serviço/tabela (pdf_templates) é mantido
// por compatibilidade com a DB; o OUTPUT é HTML.
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { OrganizationService } from './organizationService';
import type { Proposta, Cliente, DonoProposta } from '@/types';
import DOMPurify from 'dompurify';

// ---- Types ----

export interface PdfTemplate {
  id: string;
  organization_id: string | null;
  nome: string;
  descricao: string;
  html: string;
  plan_tier: 'free' | 'pro' | 'business';
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
}

// ---- Service ----

export const PdfTemplateService = {

  /**
   * Lista todos os templates disponíveis para a org actual
   * (system + org-specific)
   */
  async getTemplates(): Promise<PdfTemplate[]> {
    const { data, error } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as PdfTemplate[];
  },

  /**
   * Obtém um template por ID
   */
  async getTemplate(id: string): Promise<PdfTemplate | null> {
    const { data, error } = await supabase
      .from('pdf_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as PdfTemplate | null;
  },

  /**
   * Cria um novo template (importa HTML)
   */
  async createTemplate(input: {
    nome: string;
    descricao?: string;
    html: string;
    plan_tier?: 'free' | 'pro' | 'business';
  }): Promise<PdfTemplate> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Não autenticado');

    const orgId = await OrganizationService.getOrgIdForInsert();

    const { data, error } = await supabase
      .from('pdf_templates')
      .insert({
        organization_id: orgId,
        nome: input.nome,
        descricao: input.descricao || '',
        html: input.html,
        plan_tier: input.plan_tier || 'free',
        is_active: true,
        is_system: false,
        created_by: userData.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as PdfTemplate;
  },

  /**
   * Actualiza um template
   */
  async updateTemplate(id: string, input: Partial<{
    nome: string;
    descricao: string;
    html: string;
    plan_tier: 'free' | 'pro' | 'business';
    is_active: boolean;
  }>): Promise<void> {
    const { error } = await supabase
      .from('pdf_templates')
      .update(input)
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Elimina um template (apenas org-specific, não system)
   */
  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('pdf_templates')
      .delete()
      .eq('id', id)
      .eq('is_system', false); // nunca apagar system templates
    if (error) throw error;
  },
};

// ============================================================
// Template Engine — substitui placeholders por dados reais
// ============================================================

/**
 * Lista de placeholders disponíveis para documentação
 */
export const AVAILABLE_PLACEHOLDERS = [
  { placeholder: '{{proposta.numero}}', description: 'Número da proposta (ex: PROP-202608-0001)' },
  { placeholder: '{{proposta.data}}', description: 'Data formatada (ex: 14/08/2026)' },
  { placeholder: '{{proposta.subtotal}}', description: 'Subtotal formatado em MTn' },
  { placeholder: '{{proposta.desconto}}', description: 'Valor do desconto em MTn' },
  { placeholder: '{{proposta.iva}}', description: 'Valor do IVA em MTn' },
  { placeholder: '{{proposta.total}}', description: 'Total formatado em MTn' },
  { placeholder: '{{cliente.nome}}', description: 'Nome do cliente' },
  { placeholder: '{{cliente.empresa}}', description: 'Empresa do cliente' },
  { placeholder: '{{cliente.email}}', description: 'Email do cliente' },
  { placeholder: '{{cliente.telefone}}', description: 'Telefone do cliente' },
  { placeholder: '{{cliente.nuit}}', description: 'NUIT do cliente' },
  { placeholder: '{{cliente.endereco}}', description: 'Endereço do cliente' },
  { placeholder: '{{empresa.nome}}', description: 'Nome da empresa emissora' },
  { placeholder: '{{empresa.nuit}}', description: 'NUIT da empresa emissora' },
  { placeholder: '{{empresa.endereco}}', description: 'Endereço da empresa' },
  { placeholder: '{{empresa.email}}', description: 'Email de contacto' },
  { placeholder: '{{empresa.telefone}}', description: 'Telefone de contacto' },
  { placeholder: '{{observacoes}}', description: 'Texto de observações da proposta' },
  { placeholder: '{{{items}}}', description: 'Tabela HTML de itens (gerada automaticamente)' },
];

function formatMZN(value: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-MZ');
  } catch {
    return dateStr;
  }
}

/**
 * Substitui todos os placeholders no HTML template
 */
export function renderTemplate(
  html: string,
  proposta: Proposta,
  cliente: Cliente | undefined,
  empresa: DonoProposta | undefined,
): string {
  let result = html;

  // {{{items}}} — tabela HTML gerada automaticamente
  const itemsHtml = generateItemsTable(proposta);
  result = result.replace(/\{\{\{items\}\}\}/g, itemsHtml);

  // Blocos condicionais {{#campo}}...{{/campo}} — o bloco é
  // removido quando o valor está vazio (evita caixas vazias)
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, field: string, inner: string) => {
    const conditionalValues: Record<string, string> = {
      observacoes: proposta.observacoes || '',
    };
    return conditionalValues[field] ? inner : '';
  });

  // Placeholders simples {{ }}
  const replacements: Record<string, string> = {
    '{{proposta.numero}}': proposta.numero || '',
    '{{proposta.data}}': formatDate(proposta.data),
    '{{proposta.subtotal}}': formatMZN(proposta.subtotal),
    '{{proposta.desconto}}': formatMZN(proposta.descontoValor),
    '{{proposta.iva}}': formatMZN((proposta.subtotal - proposta.descontoValor) * (proposta.ivaPercentual / 100)),
    '{{proposta.total}}': formatMZN(proposta.total),
    '{{cliente.nome}}': cliente?.nome || '',
    '{{cliente.empresa}}': cliente?.empresa || '',
    '{{cliente.email}}': cliente?.email || '',
    '{{cliente.telefone}}': cliente?.telefone || '',
    '{{cliente.nuit}}': cliente?.nuit || '',
    '{{cliente.endereco}}': cliente?.endereco || '',
    '{{empresa.nome}}': empresa?.nome || empresa?.empresa || '',
    '{{empresa.nuit}}': empresa?.nuit || '',
    '{{empresa.endereco}}': empresa?.endereco || '',
    '{{empresa.email}}': empresa?.email || '',
    '{{empresa.telefone}}': empresa?.telefone || empresa?.contacto || '',
    '{{observacoes}}': proposta.observacoes || '',
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    // Escape regex special chars in placeholder
    const escaped = placeholder.replace(/[{}|[\]()]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), value || '');
  }

  return result;
}

/**
 * Gera tabela HTML de itens da proposta
 */
function generateItemsTable(proposta: Proposta): string {
  if (!proposta.itens || proposta.itens.length === 0) {
    return '<p>(Sem itens)</p>';
  }

  const rows = proposta.itens.map(item => `
    <tr>
      <td>${item.nome}</td>
      <td style="text-align: center;">${item.quantidade}</td>
      <td style="text-align: right;">${formatMZN(item.precoUnitario)}</td>
      <td style="text-align: right;">${formatMZN(item.quantidade * item.precoUnitario)}</td>
    </tr>
  `).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="text-align: center;">Qtd</th>
          <th style="text-align: right;">Preço Unit.</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// ============================================================
// Template HTML incorporado (fallback)
// ============================================================

/**
 * Template padrão EMBUTIDO no código — garante que a geração
 * de propostas HTML funciona mesmo sem templates na DB
 * (ex.: org nova antes de importar/criar templates).
 *
 * Usa exactamente os mesmos placeholders dos templates da DB.
 */
export const DEFAULT_HTML_TEMPLATE = `<style>
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; margin: 0; color: #1e293b; font-size: 11pt; line-height: 1.6; }
  .doc { max-width: 186mm; margin: 0 auto; padding: 10mm 0 14mm; }
  .header { border-bottom: 3px solid #0B5394; padding-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .header h1 { color: #0B5394; margin: 0; font-size: 24px; }
  .header p { color: #64748b; margin: 4px 0 0; }
  .header .badge { background: #0B5394; color: #fff; text-align: right; padding: 8px 14px; border-radius: 6px; }
  .header .badge .num { font-weight: 700; font-size: 13px; }
  .header .badge .meta { font-size: 10px; opacity: .9; }
  .parties { display: flex; gap: 24px; margin: 24px 0; }
  .party { flex: 1; }
  .party h2 { font-size: 10px; letter-spacing: 1.5px; color: #0B5394; text-transform: uppercase; margin: 0 0 6px; }
  .party .name { font-weight: 700; margin: 0 0 2px; }
  .party p { margin: 2px 0; font-size: 9.5pt; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #0B5394; color: white; padding: 10px 12px; text-align: left; font-size: 12px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totais { text-align: right; margin-top: 18px; }
  .totais .linha { margin: 5px 0; color: #475569; }
  .totais .total { font-size: 20px; color: #0B5394; font-weight: bold; border-top: 2px solid #0B5394; padding-top: 8px; margin-top: 6px; }
  .obs { margin-top: 20px; padding: 14px; background: #f8fafc; border-left: 3px solid #0B5394; border-radius: 0 6px 6px 0; font-size: 10pt; color: #475569; }
  .obs p { margin: 0; white-space: pre-wrap; }
  .footer { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; }
  @media print { .doc { max-width: none; padding: 0; } }
</style>
<div class="doc">
  <div class="header">
    <div>
      <h1>PROPOSTA {{proposta.numero}}</h1>
      <p>{{proposta.data}}</p>
    </div>
    <div class="badge">
      <div class="num">{{cliente.nome}}</div>
      <div class="meta">{{cliente.empresa}}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h2>Cliente</h2>
      <p class="name">{{cliente.nome}}</p>
      <p>{{cliente.empresa}}</p>
      <p>{{cliente.telefone}}</p>
      <p>{{cliente.email}}</p>
      <p>{{cliente.nuit}}</p>
      <p>{{cliente.endereco}}</p>
    </div>
    <div class="party">
      <h2>Emitente</h2>
      <p class="name">{{empresa.nome}}</p>
      <p>NUIT: {{empresa.nuit}}</p>
      <p>{{empresa.endereco}}</p>
      <p>{{empresa.email}}</p>
      <p>{{empresa.telefone}}</p>
    </div>
  </div>
  {{{items}}}
  <div class="totais">
    <div class="linha">Subtotal: {{proposta.subtotal}}</div>
    <div class="linha">Desconto: {{proposta.desconto}}</div>
    <div class="linha">IVA: {{proposta.iva}}</div>
    <div class="total">Total: {{proposta.total}}</div>
  </div>
  {{#observacoes}}
  <div class="obs">
    <p>{{observacoes}}</p>
  </div>
  {{/observacoes}}
  <div class="footer">
    <p>{{empresa.nome}} · NUIT {{empresa.nuit}} · {{empresa.endereco}}</p>
    <p>Documento HTML — imprimir ou guardar como PDF via browser</p>
  </div>
</div>`;

/**
 * Preview do template (renderiza HTML num container sem gerar ficheiro)
 * Útil para preview no editor de templates
 */
export function renderTemplatePreview(
  templateHtml: string,
  proposta: Proposta,
  cliente: Cliente | undefined,
  empresa: DonoProposta | undefined,
): string {
  const filled = renderTemplate(templateHtml, proposta, cliente, empresa);
  // Sanitize com a allow-list default do DOMPurify.
  // Nota: a versão anterior passava `DOMPurify.sanitize.ALLOWED_TAGS/ALLOWED_ATTR`,
  // que são undefined em runtime (essas constantes não existem na função sanitize)
  // — ou seja, o comportamento efectivo já era o default. Simplificado para
  // reflectir o comportamento real.
  return DOMPurify.sanitize(filled);
}
