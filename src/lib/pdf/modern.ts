import type { Proposta, Cliente, DonoProposta } from '@/types';
import {
  createContext, drawItemsTable, drawTotals,
  drawPaymentMethods, drawFooter, lighten,
} from './shared';

export async function renderModern(proposta: Proposta, cliente?: Cliente, dono?: DonoProposta) {
  const ctx = createContext(proposta, cliente, dono);
  const { doc, margin, pageWidth, primary } = ctx;
  let y = 0;

  // ── Header: centered brand block ──
  const headerH = 50;
  const bgLight = lighten(primary, 0.92);
  doc.setFillColor(...bgLight);
  doc.rect(0, 0, pageWidth, headerH, 'F');

  // Accent line at top
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Logo centered
  let logoRendered = false;
  if (ctx.dono.logotipo) {
    try { doc.addImage(ctx.dono.logotipo, 'PNG', pageWidth / 2 - 15, 8, 0, 18); logoRendered = true; } catch { }
  }

  if (!logoRendered) {
    doc.setTextColor(...primary);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(ctx.dono.empresa || 'PropostaJá', pageWidth / 2, 22, { align: 'center' });
  }

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 120);
  doc.text('PROPOSTAJÁ - PROPOSTA', pageWidth / 2, logoRendered ? 30 : 28, { align: 'center' });

  y = headerH + 6;

  // Label
  doc.setFontSize(8);
  doc.setTextColor(90, 95, 100);
  doc.text(`PROPOSTA N.º: ${proposta.numero}`, margin, y);
  doc.text(`Data: ${new Date(proposta.data).toLocaleDateString('pt-BR')}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // Separator
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Emitter info ──
  doc.setTextColor(130, 140, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE', margin, y);
  y += 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.dono.empresa || ctx.dono.nome || '', margin, y); y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const emitterLines = [ctx.dono.endereco, ctx.dono.nuit ? `NUIT: ${ctx.dono.nuit}` : '', ctx.dono.contacto, ctx.dono.nome && ctx.dono.empresa ? ctx.dono.nome : '', ctx.dono.cargo].filter(Boolean);
  for (const line of emitterLines) {
    doc.text(line, margin, y); y += 4;
  }
  y += 4;

  // ── Client info ──
  doc.setTextColor(130, 140, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE DESTINATÁRIO', margin, y);
  y += 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.cliente?.nome ?? 'N/A', margin, y); y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const clientLines = [ctx.cliente?.empresa, ctx.cliente?.nuit ? `NUIT: ${ctx.cliente.nuit}` : '', ctx.cliente?.endereco, ctx.cliente?.email, ctx.cliente?.telefone].filter(Boolean) as string[];
  for (const line of clientLines) {
    doc.text(line, margin, y); y += 4;
  }
  y += 8;

  // ── Items table ──
  const tableEndY = await drawItemsTable(ctx, y);
  let ty = drawTotals(ctx, tableEndY);
  ty = drawPaymentMethods(ctx, ty);
  drawFooter(ctx);

  doc.save(`proposta-${proposta.numero}.pdf`);
}
