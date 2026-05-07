import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { NarrativeSection } from './types';
import { classicTheme } from './themes';
import {
  createContext, drawItemsTable, drawTotals,
  drawPaymentMethods, drawFooter, drawNarrativeSections,
} from './shared';

export async function renderClassic(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  narrative?: NarrativeSection[],
) {
  const ctx = createContext(proposta, cliente, dono, classicTheme);
  const { doc, margin, pageWidth, contentWidth, primary } = ctx;
  let y = margin;

  // ── Header bar ──
  const headerH = 22;
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');

  // Logo or brand name
  if (ctx.dono.logotipo) {
    try { doc.addImage(ctx.dono.logotipo, 'PNG', margin, 3, 0, 16); } catch {
      doc.text(ctx.dono.empresa || 'PropostaJá', margin, 14);
    }
  } else {
    doc.text(ctx.dono.empresa || 'PropostaJá', margin, 14);
  }

  // Label on right
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`PROPOSTA N.º: ${proposta.numero}`, pageWidth - margin, 9, { align: 'right' });
  doc.text(`Data de Emissão: ${new Date(proposta.data).toLocaleDateString('pt-BR')}`, pageWidth - margin, 15, { align: 'right' });

  y = headerH + 10;

  // ── Emitter (left) + Client (right) side by side ──
  const colW = contentWidth / 2 - 5;
  const leftX = margin;
  const rightX = margin + colW + 10;

  // Left: Emitter
  doc.setTextColor(130, 140, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('EMITENTE', leftX, y);
  let ey = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.dono.empresa || ctx.dono.nome || '', leftX, ey); ey += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  if (ctx.dono.endereco) { doc.text(ctx.dono.endereco, leftX, ey); ey += 4; }
  if (ctx.dono.nuit) { doc.text(`NUIT: ${ctx.dono.nuit}`, leftX, ey); ey += 4; }
  if (ctx.dono.contacto) { doc.text(ctx.dono.contacto, leftX, ey); ey += 4; }
  if (ctx.dono.nome && ctx.dono.empresa) { doc.text(ctx.dono.nome, leftX, ey); ey += 4; }
  if (ctx.dono.cargo) { doc.text(ctx.dono.cargo, leftX, ey); ey += 4; }

  // Right: Client
  doc.setTextColor(130, 140, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', rightX, y);
  let cy = y + 5;
  doc.setTextColor(30, 35, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(cliente?.nome ?? 'N/A', rightX, cy); cy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  if (cliente?.empresa) { doc.text(cliente.empresa, rightX, cy); cy += 4; }
  if (cliente?.nuit) { doc.text(`NUIT: ${cliente.nuit}`, rightX, cy); cy += 4; }
  if (cliente?.endereco) { doc.text(cliente.endereco, rightX, cy); cy += 4; }
  if (cliente?.email) { doc.text(cliente.email, rightX, cy); cy += 4; }
  if (cliente?.telefone) { doc.text(cliente.telefone, rightX, cy); cy += 4; }

  y = Math.max(ey, cy) + 10;

  // ── Narrative sections (if AI proposal) ──
  if (narrative && narrative.length > 0) {
    y = drawNarrativeSections(ctx, y);
    y += 4;
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
