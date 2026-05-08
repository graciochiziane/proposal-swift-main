import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { NarrativeSection } from './types';
import { executiveTheme } from './themes';
import {
  createContext, drawItemsTable, drawTotals,
  drawPaymentMethods, drawFooter, drawNarrativeSections, lighten,
} from './shared';

export async function renderExecutive(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  narrative?: NarrativeSection[],
) {
  const ctx = createContext(proposta, cliente, dono, executiveTheme, narrative);
  const { doc, margin, pageWidth, contentWidth, primary } = ctx;
  let y = 0;

  // ── Executive header: left accent bar + right aligned brand ──
  const headerH = 52;
  // Left accent strip
  doc.setFillColor(...primary);
  doc.rect(0, 0, 6, headerH, 'F');

  // Light background
  const bgLight = lighten(primary, 0.95);
  doc.setFillColor(...bgLight);
  doc.rect(6, 0, pageWidth - 6, headerH, 'F');

  // Bottom border
  doc.setFillColor(...primary);
  doc.rect(0, headerH - 1.5, pageWidth, 1.5, 'F');

  // Logo top-left
  let logoRendered = false;
  if (ctx.dono.logotipo) {
    try { doc.addImage(ctx.dono.logotipo, 'PNG', margin, 6, 0, 18); logoRendered = true; } catch { }
  }

  if (!logoRendered) {
    doc.setTextColor(...primary);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(ctx.dono.empresa || 'PropostaJá', pageWidth - margin, 20, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 120);
  doc.text('PropostaJá - Proposta', pageWidth - margin, logoRendered ? 20 : 28, { align: 'right' });

  // Number
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 140);
  doc.text(`N.º ${proposta.numero}`, pageWidth - margin, 36, { align: 'right' });
  doc.text(`Data: ${new Date(proposta.data).toLocaleDateString('pt-BR')}`, pageWidth - margin, 42, { align: 'right' });

  y = headerH + 10;

  // ── Two-column: Emitter left, Client right ──
  const colW = contentWidth / 2 - 5;
  const rightX = margin + colW + 10;

  // Emitter
  doc.setTextColor(...primary);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE', margin, y);
  let ey = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.dono.empresa || ctx.dono.nome || '', margin, ey); ey += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const eLines = [ctx.dono.endereco, ctx.dono.nuit ? `NUIT: ${ctx.dono.nuit}` : '', ctx.dono.contacto, ctx.dono.nome && ctx.dono.empresa ? ctx.dono.nome : '', ctx.dono.cargo].filter(Boolean);
  for (const l of eLines) { doc.text(l, margin, ey); ey += 4; }

  // Client
  doc.setTextColor(...primary);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE DESTINATÁRIO', rightX, y);
  let cy = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.cliente?.nome ?? 'N/A', rightX, cy); cy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const cLines = [ctx.cliente?.empresa, ctx.cliente?.nuit ? `NUIT: ${ctx.cliente.nuit}` : '', ctx.cliente?.endereco, ctx.cliente?.email, ctx.cliente?.telefone].filter(Boolean) as string[];
  for (const l of cLines) { doc.text(l, rightX, cy); cy += 4; }

  y = Math.max(ey, cy) + 10;

  // Decorative separator
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + 30, y);
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.2);
  doc.line(margin + 32, y, pageWidth - margin, y);
  y += 8;

  // ── Narrative sections (if AI proposal) ──
  if (narrative && narrative.length > 0) {
    y = drawNarrativeSections(ctx, y);
    y += 4;
  }

  // ── Items table ──
  const tableEndY = await drawItemsTable(ctx, y);
  let ty = drawTotals(ctx, tableEndY);
  ty = drawPaymentMethods(ctx, ty);
  drawFooter(ctx);

  doc.save(`proposta-${proposta.numero}.pdf`);
}
