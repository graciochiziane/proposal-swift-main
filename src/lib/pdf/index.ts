// ============================================================
// Geração de Propostas em PDF — barrel público
//
// Único ponto de entrada do sistema de geração:
// PDF vectorial com 3 templates (Cotação/Executivo/Editorial).
// ============================================================

export type { PdfTemplateId, PdfTemplateInfo, DadosPropostaPdf, DadosPdfCliente, DadosPdfEmpresa, SecaoPdf, ItemPdf, TotaisPdf, PagamentoPdf } from './tipos';
export { TEMPLATES_PDF, obterTemplateDefault, obterTemplateNarrativa, definirTemplateDefault, obterTemplateInfo } from './templates';
export { gerarPropostaPdf, baixarPropostaPdf, previsualizarPdf, pdfPropostaBase64 } from './gerar';
export { construirDadosPdf, construirDadosNarrativaPdf, converterDocumentoAvancado, seccoesParaPdf } from './converter';
export { nomeFicheiroPdf } from './utils';
