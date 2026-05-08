// ============================================================
// ProposalJa — Narrative PDF Generator (Doc A)
// Standalone PDF for AI-generated proposal narrative.
// Doc A = Proposta Comercial/Tecnica (no items table, no totals).
// Doc B = Cotacao Financeira (existing gerarPDF with items).
// ============================================================

import jsPDF from 'jspdf';
import type { Proposta, DonoProposta, PDFTemplate } from '@/types';
import type { NarrativeSection, PdfTheme } from './types';
import { hexToRgb, lighten, darken } from './shared';

// ---- Narrative-specific theme (Doc A) ----

const narrativaTheme: PdfTheme = {
  brandColor: undefined, // uses dono.corPrimaria
  table: {},
  totals: {},
  payment: { position: 'hidden' },
  footer: {
    style: 'branded',
    showBranding: true,
    showDate: true,
    fontSize: 7,
    textColor: [140, 150, 165],
  },
  narrative: {
    enabled: true,
    headingFont: 'helvetica',
    headingSize: 14,
    headingBold: true,
    headingColor: undefined, // = primary
    headingUnderline: true,
    headingMarginBottom: 6,
    bodyFont: 'helvetica',
    bodySize: 10,
    bodyColor: [40, 45, 55],
    bodyMarginBottom: 10,
    sectionSeparator: 'line',
    separatorColor: [220, 225, 235],
    bulletStyle: 'dot',
    bulletIndent: 8,
  },
};

// ---- Public API ----

/**
 * Convert a seccoes record (from AI output) to NarrativeSection[].
 * Maps keys like "contexto" to labeled sections.
 */
export function seccoesToNarrative(
  seccoes: Record<string, string>,
  labels?: Record<string, string>,
): NarrativeSection[] {
  const defaultLabels: Record<string, string> = {
    contexto: '1. Contexto do Cliente',
    problema: '2. Problema Identificado',
    solucao: '3. Solucao Proposta',
    beneficios: '4. Beneficios Esperados',
    impacto: '5. Impacto Quantificavel',
    escopo: '6. Escopo Detalhado',
    cronograma: '7. Cronograma',
    condicoes: '8. Condicoes Especiais',
    investimento: '9. Resumo de Investimento',
  };

  const sectionLabels = labels ?? defaultLabels;
  const sections: NarrativeSection[] = [];

  // Maintain order by index
  const orderedKeys = Object.keys(defaultLabels);
  for (const key of orderedKeys) {
    if (seccoes[key]?.trim()) {
      sections.push({
        titulo: sectionLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
        texto: seccoes[key],
      });
    }
  }

  // Any extra keys not in the default order
  for (const key of Object.keys(seccoes)) {
    if (!defaultLabels[key] && seccoes[key]?.trim()) {
      sections.push({
        titulo: sectionLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
        texto: seccoes[key],
      });
    }
  }

  return sections;
}

/**
 * Generate a standalone narrative PDF (Doc A — Proposta Comercial).
 * This PDF contains ONLY the AI-generated narrative content, without
 * items table, totals, or payment methods.
 *
 * The file is named: Proposta-{NUMERO}.pdf (Doc A)
 */
export async function gerarPDFNarrativa(
  proposta: Proposta,
  dono: DonoProposta,
  seccoes: Record<string, string>,
  template: PDFTemplate = 'sleek',
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const primary = hexToRgb(dono.corPrimaria || '#0B5394');

  const narrative = seccoesToNarrative(seccoes);
  const cliente = proposta.clienteSnapshot;
  const numSections = narrative.length;

  // ---- HEADER ----

  // Top accent stripe
  doc.setFillColor(...darken(primary, 0.15));
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Header background
  const headerH = 58;
  doc.setFillColor(...lighten(primary, 0.93));
  doc.rect(0, 3, pageWidth, headerH - 3, 'F');

  // Right accent block
  const accentW = 65;
  doc.setFillColor(...primary);
  doc.rect(pageWidth - accentW, 3, accentW, headerH - 3, 'F');

  // Logo
  let logoH = 0;
  if (dono.logotipo) {
    try {
      doc.addImage(dono.logotipo, 'PNG', margin, 10, 0, 20);
      logoH = 24;
    } catch {
      // fallback to text
    }
  }

  // Company name
  if (logoH === 0) {
    doc.setTextColor(...primary);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(dono.empresa || dono.nome || 'PropostaJa', margin, 24);
    logoH = 20;
  }

  // Subtitle
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 125);
  doc.text('PROPOSTA COMERCIAL', margin, 10 + logoH + 2);

  // Right side: proposal info (white text on accent)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`N. ${proposta.numero}`, pageWidth - accentW + 10, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(new Date(proposta.data).toLocaleDateString('pt-BR'), pageWidth - accentW + 10, 29);

  // Section count badge
  doc.setFontSize(6.5);
  doc.text(`${numSections} seccoes`, pageWidth - accentW + 10, 38);

  // "DOC A" label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DOC A', pageWidth - accentW + 10, 48);

  let y = headerH + 10;

  // ---- CLIENT INFO ----

  if (cliente) {
    // Two columns: Emitter left, Client right
    const colW = contentWidth / 2 - 5;
    const rightX = margin + colW + 10;

    // Emitter (left)
    doc.setTextColor(...primary);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('EMITENTE', margin, y);
    let ey = y + 5;
    doc.setTextColor(30, 35, 40);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(dono.empresa || dono.nome || '', margin, ey); ey += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 75, 80);
    const eLines = [
      dono.endereco,
      dono.nuit ? `NUIT: ${dono.nuit}` : '',
      dono.contacto,
      dono.nome && dono.empresa ? dono.nome : '',
      dono.cargo,
    ].filter(Boolean);
    for (const l of eLines) { doc.text(l, margin, ey); ey += 4; }

    // Client (right)
    doc.setTextColor(...primary);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', rightX, y);
    let cy = y + 5;
    doc.setTextColor(30, 35, 40);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(cliente.nome || 'N/A', rightX, cy); cy += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 75, 80);
    const cLines = [
      cliente.empresa,
      cliente.nuit ? `NUIT: ${cliente.nuit}` : '',
      cliente.endereco,
      cliente.email,
      cliente.telefone,
    ].filter(Boolean) as string[];
    for (const l of cLines) { doc.text(l, rightX, cy); cy += 4; }

    y = Math.max(ey, cy) + 6;
  }

  // ---- DECORATIVE SEPARATOR ----
  doc.setFillColor(...primary);
  doc.rect(margin, y, 30, 1.2, 'F');
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.15);
  doc.line(margin + 33, y, pageWidth - margin, y);
  y += 10;

  // ---- NARRATIVE SECTIONS ----

  const nt = narrativaTheme.narrative!;
  const headingFont = nt.headingFont ?? 'helvetica';
  const headingSize = nt.headingSize ?? 14;
  const headingBold = nt.headingBold ?? true;
  const headingColor = nt.headingColor ?? primary;
  const headingMB = nt.headingMarginBottom ?? 6;

  const bodyFont = nt.bodyFont ?? 'helvetica';
  const bodySize = nt.bodySize ?? 10;
  const bodyColor = nt.bodyColor ?? [40, 45, 55];
  const bodyMB = nt.bodyMarginBottom ?? 10;

  const bulletStyle = nt.bulletStyle ?? 'dot';
  const bulletIndent = nt.bulletIndent ?? 8;

  const sepColor = nt.separatorColor ?? [220, 225, 235];

  for (let i = 0; i < narrative.length; i++) {
    const section = narrative[i];

    // Page check
    if (y > doc.internal.pageSize.getHeight() - 45) {
      doc.addPage();
      y = margin;
    }

    // Section separator line
    if (i > 0) {
      doc.setDrawColor(...sepColor);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 8;
    }

    // Section number badge
    const sectionNum = i + 1;
    doc.setFillColor(...primary);
    doc.roundedRect(margin, y - 4, 8, 8, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(String(sectionNum), margin + 4, y + 1.5, { align: 'center' });

    // Heading
    doc.setTextColor(...headingColor);
    doc.setFontSize(headingSize);
    doc.setFont(headingFont, headingBold ? 'bold' : 'normal');
    doc.text(section.titulo, margin + 14, y + 1.5);

    // Underline
    if (nt.headingUnderline) {
      const titleWidth = doc.getTextWidth(section.titulo);
      doc.setDrawColor(...headingColor);
      doc.setLineWidth(0.35);
      doc.line(margin + 14, y + 3, margin + 14 + titleWidth, y + 3);
    }

    y += headingMB + 4;

    // Body text — handle line wrapping and page breaks
    if (section.texto) {
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(bodySize);
      doc.setTextColor(...bodyColor);

      // Check for bullet lines (lines starting with - or *)
      const lines = section.texto.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('\u2022 ');

        if (y > doc.internal.pageSize.getHeight() - 25) {
          doc.addPage();
          y = margin;
        }

        if (isBullet) {
          // Bullet point
          const bulletText = trimmed.replace(/^[-*\u2022]\s*/, '');
          const bulletChar = bulletStyle === 'check' ? '\u2713'
            : bulletStyle === 'arrow' ? '>'
            : bulletStyle === 'dash' ? '-'
            : '\u2022';

          doc.text(bulletChar, margin + 2, y);
          const wrapped = doc.splitTextToSize(bulletText, contentWidth - bulletIndent);
          for (const wLine of wrapped) {
            if (y > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              y = margin;
            }
            doc.text(wLine, margin + bulletIndent, y);
            y += bodySize * 0.42;
          }
          y += 1.5;
        } else {
          // Regular paragraph text
          const wrapped = doc.splitTextToSize(line, contentWidth);
          for (const wLine of wrapped) {
            if (y > doc.internal.pageSize.getHeight() - 20) {
              doc.addPage();
              y = margin;
            }
            doc.text(wLine, margin, y);
            y += bodySize * 0.45;
          }
          y += 3;
        }
      }
    }

    y += bodyMB - 4;
  }

  // ---- CLOSING NOTE ----
  if (y > doc.internal.pageSize.getHeight() - 35) {
    doc.addPage();
    y = margin;
  }

  y += 6;
  doc.setDrawColor(...sepColor);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 130, 145);
  doc.text(
    'Para detalhamento financeiro completo, consultar o documento Cotacao Financeira (Doc B) em anexo.',
    margin,
    y,
  );
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Ref: ${proposta.numero} | Data: ${new Date(proposta.data).toLocaleDateString('pt-BR')} | Gerado por PropostaJa`,
    margin,
    y,
  );

  // ---- FOOTER on all pages ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = doc.internal.pageSize.getHeight() - 12;

    // Separator line
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 6, margin + 30, footerY - 6);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(margin + 32, footerY - 6, pageWidth - margin, footerY - 6);

    doc.setTextColor(140, 150, 165);
    doc.setFontSize(7);
    doc.text('Gerado por PropostaJa - www.propostaja.co.mz', margin, footerY);
    doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - margin, footerY, { align: 'right' });
  }

  // Save
  doc.save(`Proposta-${proposta.numero}.pdf`);
}
