// ============================================================
// Geração de Propostas em PDF — Parser markdown-lite
//
// Converte o conteúdo das secções (output da IA ou texto do
// utilizador) em blocos renderizáveis pelo motor PDF:
//   - títulos (##, ###)
//   - parágrafos com **negrito** e *itálico*
//   - listas ordenadas/não ordenadas
//   - tabelas markdown (cronograma)
//
// Markers de cronograma (TABELA_CRONOGRAMA_*) são removidos:
// as linhas |tabela| passam a tabela propriamente dita.
// ============================================================

export interface Segmento {
  texto: string;
  negrito: boolean;
  italico: boolean;
}

export type Bloco =
  | { tipo: 'titulo'; nivel: 2 | 3; texto: string }
  | { tipo: 'paragrafo'; segmentos: Segmento[] }
  | { tipo: 'lista'; itens: Segmento[][]; ordenada: boolean }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

const MARKERS_CRONO = ['TABELA_CRONOGRAMA_INICIO', 'TABELA_CRONOGRAMA_FIM'];

/** Remove markers de cronograma que envolvem tabelas geradas pela IA */
function removerMarkersCronograma(texto: string): string {
  let resultado = texto || '';
  for (const marker of MARKERS_CRONO) {
    resultado = resultado.split(marker).join('');
  }
  return resultado;
}

/**
 * Parse inline: **negrito**, *itálico* e `código` (renderizado
 * como itálico — não existe fonte mono na tabela WinAnsi básica).
 */
export function parseInline(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  // grupo 1 = **bold**, grupo 2 = *italic*, grupo 3 = `code`
  const padrao = /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(`([^`\n]+)`)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = padrao.exec(texto)) !== null) {
    if (m.index > cursor) {
      segmentos.push({ texto: texto.slice(cursor, m.index), negrito: false, italico: false });
    }
    if (m[2] !== undefined) segmentos.push({ texto: m[2], negrito: true, italico: false });
    else if (m[4] !== undefined) segmentos.push({ texto: m[4], negrito: false, italico: true });
    else if (m[6] !== undefined) segmentos.push({ texto: m[6], negrito: false, italico: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < texto.length) {
    segmentos.push({ texto: texto.slice(cursor), negrito: false, italico: false });
  }
  return segmentos.filter(s => s.texto.length > 0);
}

/** Linha de tabela markdown válida (só |, texto e separadores) */
function eLinhaSeparadora(linha: string): boolean {
  return /^\s*\|?[\s:-]*-[-\s:|]*\|?\s*$/.test(linha) && linha.includes('-');
}

function parseLinhaTabela(linha: string): string[] {
  return linha
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(cel => cel.trim());
}

/**
 * Converte texto markdown-lite em blocos.
 * Qualquer entrada desconhecida é tratada como parágrafo.
 */
export function parseMarkdown(texto: string): Bloco[] {
  const bruto = removerMarkersCronograma(texto || '');
  const linhas = bruto.split(/\r?\n/);
  const blocos: Bloco[] = [];

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    const aparada = linha.trim();

    // vazia
    if (!aparada) { i++; continue; }

    // título ## / ###
    const titulo = /^(#{2,3})\s+(.+)$/.exec(aparada);
    if (titulo) {
      blocos.push({
        tipo: 'titulo',
        nivel: titulo[1].length === 2 ? 2 : 3,
        texto: titulo[2].replace(/[*_`#]/g, '').trim(),
      });
      i++;
      continue;
    }

    // título # isolado → título 2
    const titulo1 = /^#\s+(.+)$/.exec(aparada);
    if (titulo1) {
      blocos.push({ tipo: 'titulo', nivel: 2, texto: titulo1[1].replace(/[*_`#]/g, '').trim() });
      i++;
      continue;
    }

    // tabela markdown
    if (aparada.includes('|') && i + 1 < linhas.length && eLinhaSeparadora(linhas[i + 1])) {
      const cabecalho = parseLinhaTabela(aparada);
      i += 2;
      const linhasTabela: string[][] = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) {
        linhasTabela.push(parseLinhaTabela(linhas[i]));
        i++;
      }
      if (cabecalho.length > 0) {
        blocos.push({ tipo: 'tabela', cabecalho, linhas: linhasTabela });
      }
      continue;
    }

    // listas
    const itemLista = /^[-*+]\s+(.+)$/.exec(aparada);
    const itemOrdenado = /^(\d+)[.)]\s+(.+)$/.exec(aparada);
    if (itemLista || itemOrdenado) {
      const ordenada = Boolean(itemOrdenado);
      const itens: Segmento[][] = [];
      while (i < linhas.length) {
        const actual = linhas[i].trim();
        const m = ordenada
          ? /^(\d+)[.)]\s+(.+)$/.exec(actual)
          : /^[-*+]\s+(.+)$/.exec(actual);
        if (!m) break;
        itens.push(parseInline(ordenada ? m[2] : m[1]));
        i++;
      }
      blocos.push({ tipo: 'lista', itens, ordenada });
      continue;
    }

    // parágrafo — acumula linhas consecutivas não vazias
    const buffer: string[] = [];
    while (i < linhas.length && linhas[i].trim()) {
      const actual = linhas[i].trim();
      if (
        /^(#{1,3})\s+/.test(actual) ||
        /^[-*+]\s+/.test(actual) ||
        /^\d+[.)]\s+/.test(actual) ||
        (actual.includes('|') && i + 1 < linhas.length && eLinhaSeparadora(linhas[i + 1]))
      ) break;
      buffer.push(actual);
      i++;
    }
    if (buffer.length > 0) {
      blocos.push({ tipo: 'paragrafo', segmentos: parseInline(buffer.join(' ')) });
    }
  }

  return blocos;
}
