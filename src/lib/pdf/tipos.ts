// ============================================================
// Geração de Propostas em PDF — Tipos
//
// Modelo de dados unificado usado pelos 2 templates modernos
// (Executivo e Editorial). Todos os fluxos de exportação
// (cotação, narrativa IA, proposta avançada) convergem aqui.
// ============================================================

/** Identificadores dos templates PDF incorporados */
export type PdfTemplateId = 'executivo' | 'editorial';

/** Metadados de um template (para galeria/selectores) */
export interface PdfTemplateInfo {
  id: PdfTemplateId;
  nome: string;
  descricao: string;
  caracteristicas: string[];
}

/** Dados do cliente impressos no PDF */
export interface DadosPdfCliente {
  nome: string;
  empresa?: string;
  nuit?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

/** Dados da empresa emitente impressos no PDF */
export interface DadosPdfEmpresa {
  nome: string;
  nuit?: string;
  endereco?: string;
  email?: string;
  telefone?: string;
  /** logotipo em data URL (PNG/JPEG) */
  logotipo?: string;
  /** cor da marca em hex; os templates derivam a paleta daqui */
  corPrimaria?: string;
}

/** Secção narrativa (conteúdo markdown-lite gerado pela IA ou pelo utilizador) */
export interface SecaoPdf {
  titulo: string;
  conteudo: string;
}

/** Item da tabela financeira */
export interface ItemPdf {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

/** Totais calculados (já descontados, com IVA) */
export interface TotaisPdf {
  subtotal: number;
  desconto: number;
  /** ex.: "5%" ou "2.500,00 MT" */
  descontoLabel?: string;
  iva: number;
  ivaPercentual: number;
  total: number;
}

/** Dados de pagamento opcionais (rodapé financeiro) */
export interface PagamentoPdf {
  banco?: string;
  conta?: string;
  nib?: string;
  mpesa?: string;
  emola?: string;
  mkesh?: string;
}

/**
 * Documento completo a renderizar.
 * `mostrarFinanceiro=false` produz o Doc A (narrativa IA sem
 * tabela de itens/totais); `true` produz a cotação completa.
 */
export interface DadosPropostaPdf {
  titulo: string;
  numero: string;
  /** data ISO (yyyy-mm-dd) */
  data: string;
  validadeDias?: number;
  cliente: DadosPdfCliente;
  empresa: DadosPdfEmpresa;
  itens: ItemPdf[];
  mostrarFinanceiro: boolean;
  totais: TotaisPdf;
  seccoes: SecaoPdf[];
  observacoes?: string;
  pagamento?: PagamentoPdf;
}
