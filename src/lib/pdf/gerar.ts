// ============================================================
// Geração de Propostas em PDF — API pública
//
//   gerarPropostaPdf  → jsPDF (para casos especiais)
//   baixarPropostaPdf → download do ficheiro .pdf
//   previsualizarPdf  → abre o PDF numa nova janela (blob URL)
//   pdfPropostaBase64 → base64 para envio por email
// ============================================================

import type { jsPDF } from 'jspdf';
import type { DadosPropostaPdf, PdfTemplateId } from './tipos';
import { desenharExecutivo } from './templateExecutivo';
import { desenharEditorial } from './templateEditorial';
import { nomeFicheiroPdf } from './utils';

/** Gera o documento PDF (vectorial) com o template indicado */
export function gerarPropostaPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): jsPDF {
  const motor = templateId === 'editorial'
    ? desenharEditorial(dados)
    : desenharExecutivo(dados);
  return motor.doc;
}

/** Descarrega o PDF com nome normalizado "Proposta-<numero>.pdf" */
export function baixarPropostaPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): void {
  const doc = gerarPropostaPdf(dados, templateId);
  doc.save(nomeFicheiroPdf(`Proposta-${dados.numero}`));
}

/** Abre o PDF numa nova janela para pré-visualização */
export function previsualizarPdf(dados: DadosPropostaPdf, templateId: PdfTemplateId): void {
  const doc = gerarPropostaPdf(dados, templateId);
  const blob = doc.output('blob') as Blob;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Gera o PDF e devolve-o em base64 puro (sem prefixo data:)
 * — formato aceite pela edge function de envio por email.
 */
export function pdfPropostaBase64(dados: DadosPropostaPdf, templateId: PdfTemplateId): string {
  const doc = gerarPropostaPdf(dados, templateId);
  const dataUri = doc.output('datauristring') as string;
  return dataUri.split(',')[1] ?? '';
}
