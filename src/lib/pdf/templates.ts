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
    if (guardado === 'executivo' || guardado === 'editorial') return guardado;
  } catch { /* localStorage indisponível */ }
  return 'executivo';
}

export function definirTemplateDefault(id: PdfTemplateId): void {
  try {
    localStorage.setItem(CHAVE_DEFAULT, id);
  } catch { /* localStorage indisponível */ }
}
