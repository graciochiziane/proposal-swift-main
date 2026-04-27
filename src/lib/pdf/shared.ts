import jsPDF from 'jspdf';
import type { Proposta, Cliente, DonoProposta } from '@/types';
import { calcularTotal } from '@/lib/calculos';
import { formatMZN } from '@/services/propostaService';

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

export interface PDFContext {
  doc: jsPDF;
  proposta: Proposta;
  cliente?: Cliente;
  dono: DonoProposta;
  primary: [number, number, number];
  pageWidth: number;
  margin: number;
  contentWidth: number;
}

export function createContext(proposta: Proposta, cliente?: Cliente, dono?: DonoProposta): PDFContext {
  const doc = new jsPDF();
  const d = dono ?? {
    nome: '', cargo: '', empresa: '', contacto: '',
    nuit: '', endereco: '', logotipo: '', corPrimaria: '#0B5394',
    dadosBancarios: { ativo: false, banco: '', numeroConta: '', nib: '' },
    mobileMoney: { mpesa: { ativo: false, numero: '' }, emola: { ativo: false, numero: '' }, mkesh: { ativo: false, numero: '' } },
  };
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  return {
    doc, proposta, cliente, dono: d,
    primary: hexToRgb(d.corPrimaria || '#0B5394'),
    pageWidth, margin,
    contentWidth: pageWidth - margin * 2,
  };
}

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

/** Render items table using autoTable */
export async function drawItemsTable(ctx: PDFContext, startY: number): Promise<number> {
  const { default: autoTable } = await import('jspdf-autotable');
  const tableBody = ctx.proposta.itens.map(item => [
    item.nome || '—',
    String(item.quantidade),
    formatMZN(item.precoUnitario),
    formatMZN(item.quantidade * item.precoUnitario),
  ]);

  autoTable(ctx.doc, {
    startY,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Descrição', 'Qtd', 'Preço Unitário', 'Total']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: lighten(ctx.primary, 0.85) as any,
      textColor: ctx.primary as any,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 5,
    },
    bodyStyles: {
      textColor: [35, 35, 40],
      fontSize: 9,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: ctx.contentWidth * 0.45 },
      1: { halign: 'center', cellWidth: ctx.contentWidth * 0.1 },
      2: { halign: 'right', cellWidth: ctx.contentWidth * 0.22 },
      3: { halign: 'right', cellWidth: ctx.contentWidth * 0.23 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  return (ctx.doc as any).lastAutoTable.finalY;
}

/** Draw totals block, returns new Y */
export function drawTotals(ctx: PDFContext, startY: number): number {
  let y = startY + 10;
  const { doc, proposta, primary } = ctx;
  const totais = calcularTotal(proposta.subtotal, proposta.descontoTipo, proposta.descontoValor, proposta.ivaPercentual);
  const totalsX = ctx.pageWidth - ctx.margin;

  const drawRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(...(color ?? [60, 65, 70]));
    doc.text(label, totalsX - 80, y);
    doc.text(value, totalsX, y, { align: 'right' });
    y += bold ? 8 : 6;
  };

  drawRow('Subtotal (MT)', formatMZN(proposta.subtotal));
  const descontoLabel = proposta.descontoTipo === 'percentual'
    ? `Desconto (${proposta.descontoValor}%)`
    : 'Desconto';
  drawRow(descontoLabel, `-${formatMZN(totais.desconto)}`);
  drawRow(`IVA (${proposta.ivaPercentual}%)`, formatMZN(totais.iva));

  y += 2;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(totalsX - 80, y, totalsX, y);
  y += 8;

  drawRow('TOTAL A PAGAR (MT)', formatMZN(totais.total), true, primary);
  return y;
}

/** Draw payment methods section */
export function drawPaymentMethods(ctx: PDFContext, startY: number): number {
  const { doc, dono, margin, primary, contentWidth } = ctx;
  const bank = dono.dadosBancarios;
  const mm = dono.mobileMoney;
  const hasBank = bank.ativo && (bank.banco || bank.numeroConta || bank.nib);
  const hasMM = mm.mpesa.ativo || mm.emola.ativo || mm.mkesh.ativo;
  if (!hasBank && !hasMM) return startY;

  let y = startY + 8;

  // Section title
  doc.setDrawColor(225, 230, 235);
  doc.setLineWidth(0.25);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  doc.setTextColor(...primary);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('MÉTODOS DE PAGAMENTO', margin, y);
  y += 7;

  doc.setTextColor(50, 55, 60);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  if (hasBank) {
    doc.setFont('helvetica', 'bold');
    doc.text('Transferência Bancária', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    if (bank.banco) { doc.text(`Banco: ${bank.banco}`, margin + 4, y); y += 4.5; }
    if (bank.numeroConta) { doc.text(`Conta: ${bank.numeroConta}`, margin + 4, y); y += 4.5; }
    if (bank.nib) { doc.text(`NIB/IBAN: ${bank.nib}`, margin + 4, y); y += 4.5; }
    y += 3;
  }

  if (hasMM) {
    doc.setFont('helvetica', 'bold');
    doc.text('Mobile Money', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    const mmItems = [
      { label: 'M-Pesa', ...mm.mpesa },
      { label: 'e-Mola', ...mm.emola },
      { label: 'm-Kesh', ...mm.mkesh },
    ].filter(m => m.ativo && m.numero);

    for (const m of mmItems) {
      // Small colored circle as icon
      doc.setFillColor(...primary);
      doc.circle(margin + 6, y - 1.2, 1.5, 'F');
      doc.text(`${m.label}: ${m.numero}`, margin + 12, y);
      y += 5;
    }
    y += 2;
  }

  // Reference note
  doc.setFontSize(7.5);
  doc.setTextColor(120, 125, 130);
  doc.setFont('helvetica', 'italic');
  const refText = 'Por favor, use o número desta fatura como referência no comprovativo de pagamento.';
  doc.text(refText, margin, y);
  y += 6;

  return y;
}

/** Draw footer */
export function drawFooter(ctx: PDFContext) {
  const { doc, margin, pageWidth } = ctx;
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setTextColor(160, 170, 180);
  doc.setFontSize(7);
  doc.text('Gerado automaticamente por PropostaJá • www.propostaja.co.mz', margin, footerY);
  doc.text(new Date().toLocaleDateString('pt-BR'), pageWidth - margin, footerY, { align: 'right' });
}
