// ============================================================
// Geração de Propostas em PDF — Templates incorporados
//
// Os 2 templates modernos são definidos em código (vectorial,
// determinísticos, sem dependência da DB). A escolha por
// omissão é persistida em localStorage por utilizador.
// ============================================================

import type { PdfTemplateId, PdfTemplateInfo } from './tipos';

const CHAVE_DEFAULT = 'ps_pdf_template_default';

export const TEMPLATES_PDF: PdfTemplateInfo[] = [
  {
    id: 'cotacao',
    nome: 'Cotação Minimalista',
    descricao:
      'Réplica do layout de referência (factura moderna): logotipo à esquerda com '
      + 'banda de título arredondada à direita, metadados em duas colunas, tabela com '
      + 'cabeçalho na cor da marca, termos e totais lado a lado e banda de rodapé '
      + 'full-bleed com contactos. Ideal para cotações rápidas e directas.',
    caracteristicas: [
      'Banda de título arredondada derivada da cor da marca',
      'Bloco de dados a duas colunas com pagamento compacto',
      'Tabela de itens com cabeçalho colorido e filetes hairline',
      'TOTAL destacado em corpo maior sobre régua de acento',
      'Banda de rodapé full-bleed com email e telefone',
    ],
  },
  {
    id: 'executivo',
    nome: 'Executivo Moderno',
    descricao:
      'Capa com banda gráfica em gradiente derivado da cor da marca, cartões de dados, '
      + 'secções numeradas em chips e tabela com zebra. Apropriado para propostas '
      + 'corporativas e respostas a concursos.',
    caracteristicas: [
      'Banda de capa em gradiente + geometria decorativa',
      'Cartão de total destacado na capa',
      'Tabela de itens com zebra e cabeçalho repetido',
      'Blocos de pagamento em cartões',
    ],
  },
  {
    id: 'editorial',
    nome: 'Editorial Elegante',
    descricao:
      'Estética editorial em serif sobre fundo marfim com moldura dupla, títulos '
      + 'ampl espaçados, régua dupla nos totais e assinaturas centradas. Ideal para '
      + 'propostas consultivas e de serviços premium.',
    caracteristicas: [
      'Moldura dupla e ornamento losango',
      'Tipografia serif com respiro generoso',
      'Tabela em hairlines (sem preenchimentos)',
      'Régua dupla sobre o valor total',
    ],
  },
];

export function obterTemplateInfo(id: PdfTemplateId): PdfTemplateInfo {
  return TEMPLATES_PDF.find(t => t.id === id) ?? TEMPLATES_PDF[0];
}

/** Template por omissão (localStorage; 'executivo' se não definido) */
export function obterTemplateDefault(): PdfTemplateId {
  try {
    const guardado = localStorage.getItem(CHAVE_DEFAULT);
    if (guardado === 'executivo' || guardado === 'editorial' || guardado === 'cotacao') return guardado;
  } catch { /* localStorage indisponível */ }
  return 'executivo';
}

/**
 * Template para documentos NARRATIVOS (Doc A / proposta avançada):
 * nunca devolve 'cotacao' — o layout de cotação é exclusivo do
 * fluxo financeiro (Resumo da Proposta), mantendo o design
 * narrativo intacto.
 */
export function obterTemplateNarrativa(): 'executivo' | 'editorial' {
  const guardado = obterTemplateDefault();
  return guardado === 'cotacao' ? 'executivo' : guardado;
}

export function definirTemplateDefault(id: PdfTemplateId): void {
  try {
    localStorage.setItem(CHAVE_DEFAULT, id);
  } catch { /* localStorage indisponível */ }
}
