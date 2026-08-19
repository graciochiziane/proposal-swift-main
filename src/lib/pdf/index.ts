import type { Proposta, Cliente, DonoProposta, PDFTemplate } from '@/types';
import type { NarrativeSection } from './types';
import { getTemplate, isProTemplate } from './registry';
import { gerarPDFNarrativa, seccoesToNarrative } from './narrativa';

/**
 * Generate PDF — unified entry point.
 * Uses the template registry. Falls back to 'classic' if unknown.
 *
 * All templates now support narrative sections (AI proposals).
 *
 * P1-FIX: Enforces isProTemplate — PRO templates (sleek, sidebar, business)
 * are downgraded to 'classic' for free/pro users. The caller can override
 * by passing `forcePro=true` after verifying plan access.
 */
export async function gerarPDF(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  template: PDFTemplate = 'classic',
  narrative?: NarrativeSection[],
  forcePro = false,
) {
  // P1-FIX: If template is PRO and caller didn't force, downgrade to classic
  let actualTemplate = template;
  if (!forcePro && isProTemplate(template)) {
    console.warn(`[gerarPDF] Template '${template}' é PRO — usando 'classic' (forcePro=false)`);
    actualTemplate = 'classic';
  }

  const entry = getTemplate(actualTemplate);
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
