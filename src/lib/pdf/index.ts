// ============================================================
// Geração de Propostas em PDF — barrel público
//
// Único ponto de entrada do sistema de geração:
// PDF vectorial com 3 templates (Cotação/Executivo/Editorial).
// ============================================================

export type { PdfTemplateId, PdfTemplateInfo, DadosPropostaPdf, DadosPdfCliente, DadosPdfEmpresa, SecaoPdf, ItemPdf, TotaisPdf, PagamentoPdf } from './tipos';
export { TEMPLATES_PDF, obterTemplateDefault, definirTemplateDefault, obterTemplateInfo, templatesVisiveisPara } from './templates';
export { gerarPropostaPdf, baixarPropostaPdf, previsualizarPdf, pdfPropostaBase64, resolverLogotipoParaPdf } from './gerar';
export { resolverTemplateParaOrg, chaveTemplateRegistada } from './resolver';
export type { ConsultadorTemplateOrg } from './resolver';
export { construirDadosPdf, construirDadosNarrativaPdf, converterDocumentoAvancado, seccoesParaPdf } from './converter';
export { nomeFicheiroPdf } from './utils';
