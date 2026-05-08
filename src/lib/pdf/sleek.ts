import type { Proposta, Cliente, DonoProposta } from '@/types';
import type { NarrativeSection } from './types';
import { sleekTheme } from './themes';
import {
  createContext, drawLogo, drawItemsTable, drawTotals,
  drawPaymentMethods, drawFooter, drawNarrativeSections,
  lighten, darken,
} from './shared';

/**
 * SLEEK template — Colorful, modern corporate feel.
 * Features: accent stripe header, status badge, colored table header,
 * card-style totals, branded footer.
 */
export async function renderSleek(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  narrative?: NarrativeSection[],
) {
  const ctx = createContext(proposta, cliente, dono, sleekTheme, narrative);
  const { doc, margin, pageWidth, contentWidth, primary } = ctx;
  let y = 0;

  // ── Header: accent stripe + gradient-like band ──
  const headerH = 54;

  // Top accent stripe (3mm)
  doc.setFillColor(...darken(primary, 0.15));
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Main header background
  doc.setFillColor(...lighten(primary, 0.92));
  doc.rect(0, 3, pageWidth, headerH - 3, 'F');

  // Right accent block (decorative)
  const accentW = 60;
  doc.setFillColor(...primary);
  doc.rect(pageWidth - accentW, 3, accentW, headerH - 3, 'F');

  // Logo top-left
  let logoH = 0;
  if (ctx.dono.logotipo) {
    logoH = drawLogo(ctx, margin, 10, 20);
  }

  // Company name
  if (logoH === 0) {
    doc.setTextColor(...primary);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text(ctx.dono.empresa || 'PropostaJá', margin, 22);
  }

  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 125);
  doc.text('PROPOSTA COMERCIAL', margin, logoH > 0 ? 32 : 28);

  // Right side: proposal number + date (white text on accent)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(proposta.numero, pageWidth - accentW + 10, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(new Date(proposta.data).toLocaleDateString('pt-BR'), pageWidth - accentW + 10, 29);

  // Status badge on accent block
  const statusLabels: Record<string, string> = {
    rascunho: 'RASCUNHO',
    enviada: 'ENVIADA',
    aceite: 'ACEITE',
    rejeitada: 'REJEITADA',
  };
  const statusLabel = statusLabels[proposta.status] || proposta.status.toUpperCase();
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, pageWidth - accentW + 10, 38);

  y = headerH + 8;

  // ── Two-column info: Emitter left, Client right ──
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
  doc.text(ctx.dono.empresa || ctx.dono.nome || '', margin, ey); ey += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const eLines = [ctx.dono.endereco, ctx.dono.nuit ? `NUIT: ${ctx.dono.nuit}` : '', ctx.dono.contacto, ctx.dono.nome && ctx.dono.empresa ? ctx.dono.nome : '', ctx.dono.cargo].filter(Boolean);
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
  doc.text(ctx.cliente?.nome ?? 'N/A', rightX, cy); cy += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 75, 80);
  const cLines = [ctx.cliente?.empresa, ctx.cliente?.nuit ? `NUIT: ${ctx.cliente.nuit}` : '', ctx.cliente?.endereco, ctx.cliente?.email, ctx.cliente?.telefone].filter(Boolean) as string[];
  for (const l of cLines) { doc.text(l, rightX, cy); cy += 4; }

  y = Math.max(ey, cy) + 8;

  // ── Decorative separator ──
  doc.setFillColor(...primary);
  doc.rect(margin, y, 25, 1.2, 'F');
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.15);
  doc.line(margin + 28, y, pageWidth - margin, y);
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
    doc.text('OBSERVAÇÕES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 75, 80);
    const obsLines = doc.splitTextToSize(proposta.observacoes, contentWidth);
    for (const line of obsLines) {
      doc.text(line, margin, y);
      y += 4;
    }
    y += 6;
  }

  // ── Items table ──
  const tableEndY = await drawItemsTable(ctx, y);
  let ty = drawTotals(ctx, tableEndY);
  ty = drawPaymentMethods(ctx, ty);
  drawFooter(ctx);

  doc.save(`proposta-${proposta.numero}.pdf`);
}
