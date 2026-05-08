import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { NarrativeSection } from './types';
import { sidebarTheme } from './themes';
import {
  createContext, drawTotals,
  drawFooter, drawNarrativeSections,
  lighten, darken,
} from './shared';

/**
 * SIDEBAR template — Dark left sidebar with company info,
 * payment details, and accent branding.
 * Main content area: header badge + table + totals.
 */
export async function renderSidebar(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  narrative?: NarrativeSection[],
) {
  const ctx = createContext(proposta, cliente, dono, sidebarTheme);
  const { doc, margin, pageWidth, primary } = ctx;
  let y = 0;

  // ── Layout constants ──
  const sidebarW = 55;
  const mainMargin = sidebarW + 12;
  const mainContentW = pageWidth - mainMargin - margin;

  // ── Sidebar: dark background ──
  const sidebarDark = darken(primary, 0.8);
  doc.setFillColor(...sidebarDark);
  doc.rect(0, 0, sidebarW, doc.internal.pageSize.getHeight(), 'F');

  // Sidebar accent line at top
  doc.setFillColor(...primary);
  doc.rect(0, 0, sidebarW, 4, 'F');

  // ── Sidebar content ──
  const sx = 8; // sidebar x padding
  let sy = 14;

  // Logo in sidebar
  if (ctx.dono.logotipo) {
    try { doc.addImage(ctx.dono.logotipo, 'PNG', sx, sy, 0, 16); sy += 20; } catch { /* fallback */ }
  }

  // Company name (white on dark)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const companyLines = doc.splitTextToSize(ctx.dono.empresa || 'PropostaJá', sidebarW - 16);
  for (const line of companyLines) {
    doc.text(line, sx, sy);
    sy += 4;
  }
  sy += 3;

  // Divider line
  doc.setDrawColor(...lighten(sidebarDark, 0.2));
  doc.setLineWidth(0.3);
  doc.line(sx, sy, sidebarW - 8, sy);
  sy += 6;

  // Contact info (small white text)
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 220);
  const contactLines = [
    ctx.dono.contacto,
    ctx.dono.endereco,
    ctx.dono.nuit ? `NUIT: ${ctx.dono.nuit}` : '',
    ctx.dono.nome && ctx.dono.empresa ? ctx.dono.nome : '',
    ctx.dono.cargo,
  ].filter(Boolean);
  for (const line of contactLines) {
    const wrapped = doc.splitTextToSize(line, sidebarW - 16);
    for (const wLine of wrapped) {
      doc.text(wLine, sx, sy);
      sy += 3.2;
    }
  }

  // ── Payment info in sidebar (bottom area) ──
  const bank = ctx.dono.dadosBancarios;
  const mm = ctx.dono.mobileMoney;
  const hasBank = bank.ativo && (bank.banco || bank.numeroConta || bank.nib);
  const hasMM = mm.mpesa.ativo || mm.emola.ativo || mm.mkesh.ativo;

  if (hasBank || hasMM) {
    const payY = doc.internal.pageSize.getHeight() - 70;

    // Divider
    doc.setDrawColor(...lighten(sidebarDark, 0.2));
    doc.line(sx, payY, sidebarW - 8, payY);

    let py = payY + 6;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
    doc.text('PAGAMENTO', sx, py);
    py += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(180, 190, 200);

    if (hasBank) {
      if (bank.banco) { doc.text(`${bank.banco}`, sx, py); py += 3.5; }
      if (bank.numeroConta) { doc.text(`Conta: ${bank.numeroConta}`, sx, py); py += 3.5; }
      if (bank.nib) { doc.text(`NIB: ${bank.nib}`, sx, py); py += 3.5; }
    }

    if (hasMM) {
      py += 2;
      const mmItems = [
        { label: 'M-Pesa', ...mm.mpesa },
        { label: 'e-Mola', ...mm.emola },
        { label: 'm-Kesh', ...mm.mkesh },
      ].filter(m => m.ativo && m.numero);
      for (const m of mmItems) {
        doc.setFillColor(...primary);
        doc.circle(sx + 2, py - 1, 1, 'F');
        doc.text(`${m.label}: ${m.numero}`, sx + 6, py);
        py += 3.5;
      }
    }
  }

  // ── Main content area ──

  // Header bar (light)
  const headerH = 38;
  doc.setFillColor(...lighten(primary, 0.95));
  doc.rect(sidebarW, 0, pageWidth - sidebarW, headerH, 'F');

  // Proposal number + date (top right of main area)
  doc.setTextColor(130, 135, 140);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`N.º ${proposta.numero}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Data: ${new Date(proposta.data).toLocaleDateString('pt-BR')}`, pageWidth - margin, 21, { align: 'right' });

  // "PROPOSTA COMERCIAL" badge
  doc.setFillColor(...primary);
  const badgeW = 52;
  const badgeH = 14;
  doc.roundedRect(mainMargin, 12, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA', mainMargin + badgeW / 2, 21, { align: 'center' });

  // Bottom border of header
  doc.setFillColor(...primary);
  doc.rect(sidebarW, headerH - 1.5, pageWidth - sidebarW, 1.5, 'F');

  y = headerH + 12;

  // ── Client info ──
  doc.setTextColor(...primary);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', mainMargin, y);
  y += 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.cliente?.nome ?? 'N/A', mainMargin, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const cLines = [ctx.cliente?.empresa, ctx.cliente?.nuit ? `NUIT: ${ctx.cliente.nuit}` : '', ctx.cliente?.endereco, ctx.cliente?.email, ctx.cliente?.telefone].filter(Boolean) as string[];
  for (const l of cLines) { doc.text(l, mainMargin, y); y += 4; }
  y += 8;

  // ── Narrative sections (if AI proposal) ──
  if (narrative && narrative.length > 0) {
    y = drawNarrativeSections(ctx, y);
    y += 4;
  }

  // ── Observações ──
  if (proposta.observacoes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primary);
    doc.text('OBSERVAÇÕES', mainMargin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 75, 80);
    const obsLines = doc.splitTextToSize(proposta.observacoes, mainContentW);
    for (const line of obsLines) {
      doc.text(line, mainMargin, y);
      y += 4;
    }
    y += 6;
  }

  // ── Items table (adjusted for sidebar) ──
  const { default: autoTable } = await import('jspdf-autotable');
  const tableBody = proposta.itens.map(item => [
    item.nome || '\u2014',
    String(item.quantidade),
    formatMZNLocal(item.precoUnitario),
    formatMZNLocal(item.quantidade * item.precoUnitario),
  ]);

  const tableTheme = ctx.theme.table;
  const colRatios = tableTheme.columnRatios ?? [0.45, 0.1, 0.22, 0.23];

  autoTable(doc, {
    startY: y,
    margin: { left: mainMargin, right: margin },
    head: [['Descrição', 'Qtd', 'Preço Unitário', 'Total']],
    body: tableBody,
    theme: tableTheme.theme ?? 'grid',
    headStyles: {
      fillColor: (tableTheme.headerBg ?? darken(primary, 0.2)) as any,
      textColor: (tableTheme.headerColor ?? [255, 255, 255]) as any,
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
      0: { cellWidth: mainContentW * colRatios[0] },
      1: { halign: 'center', cellWidth: mainContentW * colRatios[1] },
      2: { halign: 'right', cellWidth: mainContentW * colRatios[2] },
      3: { halign: 'right', cellWidth: mainContentW * colRatios[3] },
    },
    alternateRowStyles: {
      fillColor: (tableTheme.altRowBg ?? [248, 250, 252]) as any,
    },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;

  // ── Totals ──
  drawTotals(ctx, tableEndY);

  // ── Footer ──
  drawFooter(ctx);

  doc.save(`proposta-${proposta.numero}.pdf`);
}

/** Local format helper (sidebar template uses MZN format) */
function formatMZNLocal(value: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
