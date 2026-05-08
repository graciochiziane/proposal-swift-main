import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { NarrativeSection } from './types';
import { businessTheme } from './themes';
import {
  createContext, drawLogo, drawItemsTable, drawTotals,
  drawPaymentMethods, drawFooter, drawNarrativeSections,
} from './shared';

/**
 * BUSINESS template — Minimalist, clean, professional.
 * Inspired by premium invoice design. Uses grayscale tones
 * with subtle brand accents. No flashy decorations.
 */
export async function renderBusiness(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  narrative?: NarrativeSection[],
) {
  const ctx = createContext(proposta, cliente, dono, businessTheme, narrative);
  const { doc, margin, pageWidth, contentWidth } = ctx;
  let y = margin;

  // ── Top: Logo + Company (left), Proposal info (right) ──

  // Logo
  let logoH = 0;
  if (ctx.dono.logotipo) {
    logoH = drawLogo(ctx, margin, y, 18);
  }

  // Company name
  if (logoH === 0) {
    doc.setTextColor(30, 35, 40);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(ctx.dono.empresa || 'PropostaJá', margin, y + 10);
  }

  // Right side: proposal number + date
  doc.setTextColor(100, 105, 115);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proposta N.º ${proposta.numero}`, pageWidth - margin, y + 6, { align: 'right' });
  doc.text(`Data: ${new Date(proposta.data).toLocaleDateString('pt-BR')}`, pageWidth - margin, y + 12, { align: 'right' });

  // Subtle status label
  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho',
    enviada: 'Enviada',
    aceite: 'Aceite',
    rejeitada: 'Rejeitada',
  };
  doc.setTextColor(130, 135, 145);
  doc.setFontSize(7);
  doc.text(statusLabels[proposta.status] || proposta.status, pageWidth - margin, y + 18, { align: 'right' });

  y = (logoH > 0 ? y + logoH : y + 18) + 8;

  // Thin separator
  doc.setDrawColor(200, 205, 212);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── Two-column: Emitter left, Client right ──
  const colW = contentWidth / 2 - 8;
  const rightX = margin + colW + 16;

  // Emitter
  doc.setTextColor(130, 135, 145);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE', margin, y);
  let ey = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.dono.empresa || ctx.dono.nome || '', margin, ey); ey += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const eLines = [ctx.dono.endereco, ctx.dono.nuit ? `NUIT: ${ctx.dono.nuit}` : '', ctx.dono.contacto, ctx.dono.nome && ctx.dono.empresa ? ctx.dono.nome : '', ctx.dono.cargo].filter(Boolean);
  for (const l of eLines) { doc.text(l, margin, ey); ey += 4; }

  // Client
  doc.setTextColor(130, 135, 145);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', rightX, y);
  let cy = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.cliente?.nome ?? 'N/A', rightX, cy); cy += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const cLines = [ctx.cliente?.empresa, ctx.cliente?.nuit ? `NUIT: ${ctx.cliente.nuit}` : '', ctx.cliente?.endereco, ctx.cliente?.email, ctx.cliente?.telefone].filter(Boolean) as string[];
  for (const l of cLines) { doc.text(l, rightX, cy); cy += 4; }

  y = Math.max(ey, cy) + 8;

  // Thin separator
  doc.setDrawColor(200, 205, 212);
  doc.setLineWidth(0.15);
  doc.line(margin, y, pageWidth - margin, y);
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
    doc.setTextColor(100, 105, 115);
    doc.text('OBSERVAÇÕES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 85, 90);
    const obsLines = doc.splitTextToSize(proposta.observacoes, contentWidth);
    for (const line of obsLines) {
      doc.text(line, margin, y);
      y += 4;
    }
    y += 6;
  }

  // ── Items table ──
  const tableEndY = await drawItemsTable(ctx, y);

  // ── Totals ──
  let ty = drawTotals(ctx, tableEndY);

  // ── Payment methods ──
  ty = drawPaymentMethods(ctx, ty);

  // ── Footer ──
  drawFooter(ctx);

  doc.save(`proposta-${proposta.numero}.pdf`);
}
