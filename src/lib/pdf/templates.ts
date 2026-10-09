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
    nome: 'Cotação Moderna',
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
    id: 'minimal',
    nome: 'Cotação Minimalista',
    descricao:
      'Minimalismo tipográfico puro: folha branca, hierarquia por tipografia e espaço '
      + 'em branco, hairlines discretas e a cor da marca apenas em micro-acentos. '
      + 'Logótipo no cabeçalho, todos os métodos de pagamento (incluindo formas '
      + 'dinâmicas, sem limite) e assinaturas de emitente e cliente.',
    caracteristicas: [
      'Logótipo no cabeçalho com NUIT, endereço e contactos da empresa',
      'Pagamentos completos: banco, mobile money e formas dinâmicas sem limite',
      'Tabela em hairlines com cabeçalho discreto',
      'TOTAL sobre régua de acento da marca',
      'Assinaturas para emitente e cliente',
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
  {
    id: 'talaService',
    nome: 'Cotação Corporativa (Tala Service)',
    restrito: true,
    descricao:
      'Réplica data-driven da cotação de referência Tala Service: folha branca '
      + 'minimalista, logótipo em destaque, título «Cotação Nº» em turquesa, tabela '
      + 'de itens entre réguas finas, marca d\u2019água gigante do próprio logótipo '
      + 'no centro, valor por extenso, bloco de pagamento configurável por campos '
      + 'personalizados da organização e rodapé discreto com data, emissor e paginação.',
    caracteristicas: [
      'Marca d\u2019água dinâmica: logótipo da organização ao centro com opacidade muito baixa',
      'Tabela simples sem cartões: régua superior + inferior, sem separadores de linha',
      'Valor por extenso calculado a partir do total do motor financeiro',
      'Bloco de pagamento alimentado por organization.custom_fields (banco, NIB, instruções, contacto)',
      'Blocos sem dados desaparecem de forma elegante (nunca texto fictício)',
    ],
  },
];

export function obterTemplateInfo(id: PdfTemplateId): PdfTemplateInfo {
  return TEMPLATES_PDF.find(t => t.id === id) ?? TEMPLATES_PDF[0];
}

/**
 * Catálogo visível para uma organização: modelos base (não
 * restritos) + modelos restritos ATRIBUÍDOS com linha activa à
 * org (chaves vêm de organization_templates, escrita exclusiva
 * do superadmin). Sem chaves (utilizador sem org / erro / org
 * sem atribuições) devolve apenas os modelos não restritos.
 */
export function templatesVisiveisPara(chavesAtribuidas: string[] | Set<string> | null | undefined): PdfTemplateInfo[] {
  const atribuidas = chavesAtribuidas instanceof Set ? chavesAtribuidas : new Set(chavesAtribuidas ?? []);
  return TEMPLATES_PDF.filter(t => !t.restrito || atribuidas.has(t.id));
}

/** Template por omissão (localStorage; 'executivo' se não definido) */
export function obterTemplateDefault(): PdfTemplateId;
/**
 * Template por omissão validado contra um catálogo permitido
 * (ex.: chaves visíveis para a org activa). Preferência guardada
 * fora do permitido (ex.: restrito des-atribuído) degrada para
 * 'executivo' — nunca erro, nunca uso de modelo não atribuído.
 */
export function obterTemplateDefault(permitidas: PdfTemplateId[]): PdfTemplateId;
export function obterTemplateDefault(permitidas?: PdfTemplateId[]): PdfTemplateId {
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem(CHAVE_DEFAULT);
    if (guardado === 'executivo' || guardado === 'editorial' || guardado === 'cotacao' || guardado === 'minimal' || guardado === 'talaService') {
      if (!permitidas || permitidas.includes(guardado)) return guardado;
    }
  } catch { /* localStorage indisponível */ }
  return 'executivo';
}

export function definirTemplateDefault(id: PdfTemplateId): void {
  try {
    localStorage.setItem(CHAVE_DEFAULT, id);
  } catch { /* localStorage indisponível */ }
}
