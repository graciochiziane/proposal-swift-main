import type { Proposta, Cliente, DonoProposta, PDFTemplate } from '@/types';
import type { NarrativeSection } from './types';
import { getTemplate } from './registry';
import { gerarPDFNarrativa, seccoesToNarrative } from './narrativa';

/**
 * Generate PDF — unified entry point.
 * Uses the template registry. Falls back to 'classic' if unknown.
 *
 * All templates now support narrative sections (AI proposals).
 */
export async function gerarPDF(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  template: PDFTemplate = 'classic',
  narrative?: NarrativeSection[],
) {
  const entry = getTemplate(template);
  await entry.render(proposta, cliente, dono, narrative);
}

/**
 * Generate standalone narrative PDF (Doc A — Proposta Comercial).
 * Contains only AI-generated narrative, no items table or totals.
 */
export { gerarPDFNarrativa, seccoesToNarrative };

/** Re-export for backward compatibility */
export type { NarrativeSection } from './types';
export { getAllTemplates, getTemplate, isProTemplate } from './registry';
