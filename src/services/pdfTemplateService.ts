// ============================================================
// PDF Template Service — CRUD + render de templates HTML
//
// Modelo: admin cria HTML externamente, cola no PropostaJá.
// Placeholders {{}} são substituídos por dados reais.
// Rendering: HTML → DOMPurify → html2canvas → jsPDF
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { OrganizationService } from './organizationService';
import type { Proposta, Cliente, DonoProposta } from '@/types';
import DOMPurify from 'dompurify';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
// PDF Renderer — HTML → DOMPurify → html2canvas → jsPDF
// ============================================================

/**
 * Gera PDF a partir de um template HTML
 *
 * @param templateHtml HTML do template (com placeholders já substituídos)
 * @param fileName Nome do ficheiro (ex: Proposta-PROP-202608-0001.pdf)
 */
export async function renderHtmlToPdf(
  templateHtml: string,
  fileName: string,
): Promise<void> {
  // 1. Sanitizar HTML (XSS protection)
  const sanitized = DOMPurify.sanitize(templateHtml, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'ul', 'ol', 'li', 'br', 'hr', 'img', 'a',
      'strong', 'em', 'u', 'b', 'i', 'small', 'sub', 'sup',
      'style', 'header', 'footer', 'section', 'article',
    ],
    ALLOWED_ATTR: ['style', 'class', 'id', 'href', 'src', 'alt', 'colspan', 'rowspan', 'width', 'height', 'align', 'valign'],
  });

  // 2. Criar container off-screen
  const container = document.createElement('div');
  container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 794px; padding: 0; background: white;';
  container.innerHTML = sanitized;
  document.body.appendChild(container);

  try {
    // 3. html2canvas → imagem
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // 4. jsPDF → PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Primeira página
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Páginas adicionais
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 5. Download
    pdf.save(fileName);
  } finally {
    // 6. Limpar container
    document.body.removeChild(container);
  }
}

/**
 * Preview do template (renderiza HTML num container sem gerar PDF)
 * Útil para preview no editor de templates
 */
export function renderTemplatePreview(
  templateHtml: string,
  proposta: Proposta,
  cliente: Cliente | undefined,
  empresa: DonoProposta | undefined,
): string {
  const filled = renderTemplate(templateHtml, proposta, cliente, empresa);
  return DOMPurify.sanitize(filled, {
    ALLOWED_TAGS: DOMPurify.sanitize.ALLOWED_TAGS,
    ALLOWED_ATTR: DOMPurify.sanitize.ALLOWED_ATTR,
  });
}
