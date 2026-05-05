import type { Proposta, Cliente, DonoProposta, PDFTemplate } from '@/types';
import type { NarrativeSection } from './types';
import { getTemplate } from './registry';
/**
 * Generate PDF — unified entry point.
 * Uses the template registry. Falls back to 'classic' if unknown.
 *
 * Existing templates (classic, modern, executive) are wrapped to
 * pass their theme via createContext (backward compatible).
 */
export async function gerarPDF(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  template: PDFTemplate = 'classic',
  narrative?: NarrativeSection[],
) {
  const entry = getTemplate(template);

  // Existing templates (classic, modern, executive) do not accept
  // narrative sections yet, but new ones do.
  // The registry render function signature accepts 4 params.
  await entry.render(proposta, cliente, dono, narrative);
}

/** Re-export for backward compatibility */
export type { NarrativeSection } from './types';
export { getAllTemplates, getTemplate, isProTemplate } from './registry';
