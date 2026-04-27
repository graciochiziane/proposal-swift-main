import type { Proposta, Cliente, DonoProposta, PDFTemplate } from '@/types';
import { renderClassic } from './classic';
import { renderModern } from './modern';
import { renderExecutive } from './executive';

export async function gerarPDF(
  proposta: Proposta,
  cliente?: Cliente,
  dono?: DonoProposta,
  template: PDFTemplate = 'classic',
) {
  switch (template) {
    case 'modern':
      return renderModern(proposta, cliente, dono);
    case 'executive':
      return renderExecutive(proposta, cliente, dono);
    case 'classic':
    default:
      return renderClassic(proposta, cliente, dono);
  }
}
