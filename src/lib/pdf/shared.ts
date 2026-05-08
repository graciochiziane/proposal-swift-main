import jsPDF from 'jspdf';
import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { PdfTheme, NarrativeSection } from './types';
import { calcularTotal } from '@/lib/calculos';
import { formatMZN } from '@/services/propostaService';

// ============================================================
// Utility helpers
// ============================================================

/** Parse hex to RGB */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Lighten an RGB color towards white */
export function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map(c => Math.min(255, Math.round(c + (255 - c) * amount))) as [number, number, number];
}

/** Darken an RGB color towards black */
export function darken(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map(c => Math.max(0, Math.round(c * (1 - amount)))) as [number, number, number];
}

// ============================================================
// Context
// ============================================================

export interface PDFContext {
  doc: jsPDF;
  proposta: Proposta;
  cliente?: Cliente;
  dono: DonoProposta;
  primary: [number, number, number];
  pageWidth: number;
  margin: number;
  contentWidth: number;
  /** Active theme — controls how shared functions render */
  theme: PdfTheme;
  /** Optional narrative sections for AI proposals */
  narrative?: NarrativeSection[];
}

const defaultDono: DonoProposta = {
  nome: '', cargo: '', empresa: '', contacto: '',
  nuit: '', endereco: '', logotipo: '', corPrimaria: '#0B5394',
  dadosBancarios: { ativo: false, banco: '', numeroConta: '', nib: '' },
  mobileMoney: { mpesa: { ativo: false, numero: '' }, emola: { ativo: false, numero: '' }, mkesh: { ativo: false, numero: '' } },
};

const defaultTheme: PdfTheme = {
  table: {},
  totals: {},
  payment: {},
  footer: {},
  narrative: { enabled: false },
};

/**
 * Create a PDF rendering context.
 * Accepts an optional theme — if omitted, shared functions behave
 * exactly as before (backward compatible).
 */
export function createContext(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  theme?: PdfTheme,
  narrative?: NarrativeSection[],
): PDFContext {
  const doc = new jsPDF();
  const d = dono ?? defaultDono;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const brandHex = theme?.brandColor || d.corPrimaria || '#0B5394';
  return {
    doc,
    proposta,
    cliente,
    dono: d,
    primary: hexToRgb(brandHex),
    pageWidth,
    margin,
    contentWidth: pageWidth - margin * 2,
    theme: theme ?? defaultTheme,
    narrative,
  };
}

// ============================================================
// Logo
// ============================================================

/** Draw logo if available, returns used height */
export function drawLogo(ctx: PDFContext, x: number, y: number, maxH: number): number {
  if (!ctx.dono.logotipo) return 0;
  try {
    ctx.doc.addImage(ctx.dono.logotipo, 'PNG', x, y, 0, maxH);
    return maxH + 4;
  } catch {
    return 0;
  }
}

// ============================================================
// Items Table — theme-aware
// ============================================================

/** Render items table using autoTable */
export async function drawItemsTable(ctx: PDFContext, startY: number): Promise<number> {
  const { default: autoTable } = await import('jspdf-autotable');
  const { doc, proposta, primary, margin, contentWidth, theme } = ctx;

  const tableTheme = theme.table;

  const tableBody = proposta.itens.map(item => [
    item.nome || '\u2014',
    String(item.quantidade),
    formatMZN(item.precoUnitario),
    formatMZN(item.quantidade * item.precoUnitario),
  ]);

  const columnRatios = tableTheme.columnRatios ?? [0.45, 0.1, 0.22, 0.23];

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Descrição', 'Qtd', 'Preço Unitário', 'Total']],
    body: tableBody,
    theme: tableTheme.theme ?? 'plain',
    headStyles: {
      fillColor: (tableTheme.headerBg ?? lighten(primary, 0.85)) as [number, number, number],
      textColor: (tableTheme.headerColor ?? primary) as [number, number, number],
      fontStyle: 'bold',
      fontSize: tableTheme.headerFontSize ?? 8,
      cellPadding: tableTheme.cellPadding ?? 5,
    },
    bodyStyles: {
      textColor: [35, 35, 40],
      fontSize: tableTheme.bodyFontSize ?? 9,
      cellPadding: tableTheme.cellPadding ?? 5,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * columnRatios[0] },
      1: { halign: 'center', cellWidth: contentWidth * columnRatios[1] },
      2: { halign: 'right', cellWidth: contentWidth * columnRatios[2] },
      3: { halign: 'right', cellWidth: contentWidth * columnRatios[3] },
    },
    alternateRowStyles: {
      fillColor: (tableTheme.altRowBg ?? [248, 250, 252]) as [number, number, number],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY;
}

// ============================================================
// Totals — theme-aware
// ============================================================

/** Draw totals block, returns new Y */
export function drawTotals(ctx: PDFContext, startY: number): number {
  const { doc, proposta, primary, pageWidth, margin, theme } = ctx;
  const totals = totalsTheme(theme.totals);

  const totais = calcularTotal(proposta.subtotal, proposta.descontoTipo, proposta.descontoValor, proposta.ivaPercentual);
  const currencyLabel = totals.currencyLabel ?? 'MT';

  const spacing = totals.spacingBefore ?? 10;
  let y = startY + spacing;

  // Determine X positions based on totals position
  const totalsWidth = 80;
  let totalsLeftX: number;
  switch (totals.position ?? 'right') {
    case 'left':
      totalsLeftX = margin;
      break;
    case 'center':
      totalsLeftX = (pageWidth - totalsWidth) / 2;
      break;
    case 'right':
    default:
      totalsLeftX = pageWidth - margin - totalsWidth;
      break;
  }
  const totalsRightX = totalsLeftX + totalsWidth;

  // Card background
  if (totals.showCard) {
    const cardH = 52;
    const cardBg = totals.cardBg ?? lighten(primary, 0.94);
    const cardBorder = totals.cardBorder ?? primary;
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsLeftX - 5, y - 4, totalsWidth + 10, cardH, 3, 3, 'FD');
    y += 2;
  }

  const drawRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(...(color ?? [60, 65, 70]));
    doc.text(label, totalsLeftX, y);
    doc.text(value, totalsRightX, y, { align: 'right' });
    y += bold ? 8 : 6;
  };

  drawRow(`Subtotal (${currencyLabel})`, formatMZN(proposta.subtotal));
  const descontoLabel = proposta.descontoTipo === 'percentual'
    ? `Desconto (${proposta.descontoValor}%)`
    : 'Desconto';
  drawRow(descontoLabel, `-${formatMZN(totais.desconto)}`);
  drawRow(`IVA (${proposta.ivaPercentual}%)`, formatMZN(totais.iva));

  y += 2;

  if (!totals.showCard) {
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.4);
    doc.line(totalsLeftX, y, totalsRightX, y);
  }

  y += 6;

  // Total highlight
  const highlight = totals.totalHighlight ?? true;
  const totalBg = totals.totalBg;
  const totalTextColor = totals.totalTextColor;

  if (highlight && totalBg) {
    // Colored background for total row
    doc.setFillColor(...totalBg);
    doc.roundedRect(totalsLeftX - 3, y - 5, totalsWidth + 6, 10, 2, 2, 'F');
    drawRow(`TOTAL A PAGAR (${currencyLabel})`, formatMZN(totais.total), true, totalTextColor ?? [255, 255, 255]);
  } else if (highlight) {
    drawRow(`TOTAL A PAGAR (${currencyLabel})`, formatMZN(totais.total), true, primary);
  } else {
    drawRow(`TOTAL A PAGAR (${currencyLabel})`, formatMZN(totais.total), true);
  }

  return y;
}

/** Helper to resolve totals theme with defaults */
function totalsTheme(t: PdfTheme['totals']): NonNullable<PdfTheme['totals']> {
  return t ?? {};
}

// ============================================================
// Payment Methods — theme-aware
// ============================================================

/** Draw payment methods section */
export function drawPaymentMethods(ctx: PDFContext, startY: number): number {
  const { doc, dono, margin, primary, contentWidth, theme } = ctx;
  const paymentTheme = theme.payment;

  // Hidden?
  if (paymentTheme.position === 'hidden') return startY;

  const bank = dono.dadosBancarios;
  const mm = dono.mobileMoney;
  const hasBank = bank.ativo && (bank.banco || bank.numeroConta || bank.nib);
  const hasMM = mm.mpesa.ativo || mm.emola.ativo || mm.mkesh.ativo;
  if (!hasBank && !hasMM) return startY;

  const style = paymentTheme.style ?? 'list';
  const title = paymentTheme.title ?? 'METODOS DE PAGAMENTO';
  const showRef = paymentTheme.showReferenceNote ?? true;

  let y = startY + 8;

  // Section separator line
  doc.setDrawColor(225, 230, 235);
  doc.setLineWidth(0.25);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  // Section title
  doc.setDrawColor(225, 230, 235);
  doc.setTextColor(...primary);
  doc.setFontSize(style === 'compact' ? 7.5 : 8);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y += style === 'compact' ? 5 : 7;

  doc.setTextColor(50, 55, 60);
  doc.setFontSize(style === 'compact' ? 7.5 : 8.5);
  doc.setFont('helvetica', 'normal');

  if (hasBank) {
    if (style === 'detailed') {
      // Card style
      const cardBg = lighten(primary, 0.95);
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...lighten(primary, 0.7));
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, y - 3, contentWidth, style === 'detailed' && (bank.banco && bank.numeroConta && bank.nib) ? 24 : (style === 'detailed' ? 16 : 12), 2, 2, 'FD');
      y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Transferência Bancária', margin + (style === 'detailed' ? 4 : 0), y);
    y += style === 'compact' ? 4 : 5;
    doc.setFont('helvetica', 'normal');

    const bankLines: string[] = [];
    if (bank.banco) bankLines.push(`Banco: ${bank.banco}`);
    if (bank.numeroConta) bankLines.push(`Conta: ${bank.numeroConta}`);
    if (bank.nib) bankLines.push(`NIB/IBAN: ${bank.nib}`);

    for (const line of bankLines) {
      doc.text(line, margin + (style === 'detailed' ? 8 : 4), y);
      y += style === 'compact' ? 3.5 : 4.5;
    }
    y += style === 'compact' ? 2 : 3;
  }

  if (hasMM) {
    if (style === 'detailed') {
      // Card style for MM
      doc.setFillColor(...lighten(primary, 0.95));
      doc.setDrawColor(...lighten(primary, 0.7));
      doc.setLineWidth(0.2);
      const mmItems = [
        mm.mpesa, mm.emola, mm.mkesh,
      ].filter(m => m.ativo && m.numero);
      doc.roundedRect(margin, y - 3, contentWidth, 8 + mmItems.length * 5, 2, 2, 'FD');
      y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Mobile Money', margin + (style === 'detailed' ? 4 : 0), y);
    y += style === 'compact' ? 4 : 5;
    doc.setFont('helvetica', 'normal');

    const mmItems = [
      { label: 'M-Pesa', ...mm.mpesa },
      { label: 'e-Mola', ...mm.emola },
      { label: 'm-Kesh', ...mm.mkesh },
    ].filter(m => m.ativo && m.numero);

    for (const m of mmItems) {
      // Small colored circle as icon
      doc.setFillColor(...primary);
      doc.circle(margin + (style === 'detailed' ? 10 : 6), y - 1.2, 1.5, 'F');
      doc.text(`${m.label}: ${m.numero}`, margin + (style === 'detailed' ? 16 : 12), y);
      y += style === 'compact' ? 4 : 5;
    }
    y += 2;
  }

  // Reference note
  if (showRef) {
    doc.setFontSize(7.5);
    doc.setTextColor(120, 125, 130);
    doc.setFont('helvetica', 'italic');
    const refText = 'Por favor, use o número desta fatura como referência no comprovativo de pagamento.';
    doc.text(refText, margin, y);
    y += 6;
  }

  return y;
}

// ============================================================
// Footer — theme-aware
// ============================================================

/** Draw footer on every page */
export function drawFooter(ctx: PDFContext) {
  const { doc, margin, pageWidth, primary, theme } = ctx;
  const ft = theme.footer;

  const style = ft.style ?? 'minimal';
  const showBranding = ft.showBranding ?? true;
  const showDate = ft.showDate ?? true;
  const lineColor = ft.lineColor ?? [220, 225, 230];
  const textColor = ft.textColor ?? [160, 170, 180];
  const fontSize = ft.fontSize ?? 7;

  const footerY = doc.internal.pageSize.getHeight() - 12;

  // Separator line
  if (style === 'branded') {
    // Double line with accent
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 6, margin + 30, footerY - 6);
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.2);
    doc.line(margin + 32, footerY - 6, pageWidth - margin, footerY - 6);
  } else if (style === 'detailed') {
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  } else {
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  }

  doc.setTextColor(...textColor);
  doc.setFontSize(fontSize);

  // Left text
  const leftText = ft.customText ?? (showBranding ? 'Gerado automaticamente por PropostaJá - www.propostaja.co.mz' : '');
  doc.text(leftText, margin, footerY);

  // Right text (date)
  if (showDate) {
    doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - margin, footerY, { align: 'right' });
  }
}

// ============================================================
// Narrative blocks — for AI-generated proposals
// ============================================================

/** Draw narrative sections (AI-generated proposal content) */
export function drawNarrativeSections(ctx: PDFContext, startY: number): number {
  const { doc, margin, contentWidth, primary, narrative, theme } = ctx;
  if (!narrative || narrative.length === 0) return startY;

  const nt = theme.narrative;
  if (!nt?.enabled) return startY;

  const headingFont = nt.headingFont ?? 'helvetica';
  const headingSize = nt.headingSize ?? 14;
  const headingBold = nt.headingBold ?? true;
  const headingColor = nt.headingColor ?? primary;
  const headingMB = nt.headingMarginBottom ?? 4;

  const bodyFont = nt.bodyFont ?? 'helvetica';
  const bodySize = nt.bodySize ?? 10;
  const bodyColor = nt.bodyColor ?? [50, 55, 60];
  const bodyMB = nt.bodyMarginBottom ?? 8;

  const bulletStyle = nt.bulletStyle ?? 'dot';
  const bulletIndent = nt.bulletIndent ?? 8;

  const sepType = nt.sectionSeparator ?? 'space';
  const sepColor = nt.separatorColor ?? [220, 225, 230];

  let y = startY;

  for (const section of narrative) {
    // Page check
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = margin;
    }

    // Section separator
    if (sepType === 'line' && y > margin) {
      doc.setDrawColor(...sepColor);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;
    } else if (sepType === 'space' && y > margin) {
      y += 4;
    }

    // Heading
    doc.setFont(headingFont, headingBold ? 'bold' : 'normal');
    doc.setFontSize(headingSize);
    doc.setTextColor(...headingColor);
    doc.text(section.titulo, margin, y);

    if (nt.headingUnderline) {
      const titleWidth = doc.getTextWidth(section.titulo);
      doc.setDrawColor(...headingColor);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 1, margin + titleWidth, y + 1);
    }

    y += headingMB + 2;

    // Body text — handle line wrapping and page breaks
    if (section.texto) {
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(bodySize);
      doc.setTextColor(...bodyColor);

      const lines = section.texto.split('\n');
      for (const line of lines) {
        const wrapped = doc.splitTextToSize(line, contentWidth);
        for (const wLine of wrapped) {
          if (y > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = margin;
          }
          doc.text(wLine, margin, y);
          y += bodySize * 0.45;
        }
      }
      y += 3;
    }

    // Bullet items
    if (section.itens && section.itens.length > 0) {
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(bodySize - 0.5);
      doc.setTextColor(...bodyColor);

      for (const item of section.itens) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = margin;
        }

        // Bullet character
        const bullet = bulletStyle === 'check' ? '\u2713'
          : bulletStyle === 'arrow' ? '>'
          : bulletStyle === 'dash' ? '-'
          : '\u2022'; // dot

        doc.text(bullet, margin + 2, y);
        const wrapped = doc.splitTextToSize(item, contentWidth - bulletIndent);
        for (const wLine of wrapped) {
          doc.text(wLine, margin + bulletIndent, y);
          y += bodySize * 0.4;
        }
        y += 1;
      }
    }

    y += bodyMB;
  }

  return y;
}
