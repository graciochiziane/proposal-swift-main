// ============================================================
// Geração de Propostas em PDF — Utilitários
//
// Cores (derivadas da cor primária da marca), moeda, datas e
// saneamento de texto para as fontes padrão do PDF (WinAnsi).
// ============================================================

/** RGB 0-255 */
export type Rgb = [number, number, number];

/** Converte hex (#RRGGBB / #RGB) em RGB */
export function hexToRgb(hex: string, fallback: Rgb = [15, 76, 129]): Rgb {
  const limpo = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(limpo)) return fallback;
  const expandido = limpo.length === 3
    ? limpo.split('').map(c => c + c).join('')
    : limpo;
  const num = parseInt(expandido, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Clareia uma cor hex (factor 0-1: 0 = igual, 1 = branco) */
export function clarear(hex: string, factor: number): Rgb {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  return [mix(r), mix(g), mix(b)];
}

/** Escurece uma cor hex (factor 0-1: 0 = igual, 1 = preto) */
export function escurecer(hex: string, factor: number): Rgb {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c * (1 - factor));
  return [mix(r), mix(g), mix(b)];
}

/** Luminância relativa (0-1) — para decidir texto claro/escuro sobre fundo */
export function luminancia(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Formata moeda em Metical (pt-MZ) — "1.250,00 MT" */
export function formatarMZN(valor: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 2,
  }).format(valor || 0);
}

/**
 * Formata moeda em estilo compacto da referência Tala Service:
 * separador de milhares a ESPAÇO, sem casas decimais quando o
 * valor é inteiro ("85 000"), com decimais só quando existem
 * ("85 000,50"). SEM sufixo — o template acrescenta " MZN" onde
 * a referência o mostra. (Intl usa NBSP/nnbsp como separador —
 * normalizado para espaço comum.)
 */
export function formatarMZNCompacto(valor: number): string {
  const v = valor || 0;
  const temCentavos = Math.abs(Math.round(v * 100) % 100) > 0;
  const bruto = new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: temCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(v);
  return bruto.replace(/[\u00A0\u202F\u2009]/g, ' ');
}

// ---- Valor por extenso (pt, Metical) ----
//
// Apresentação textual do total — usado pelo bloco "Valor por
// extenso" da referência. Calculado a partir do total do motor
// financeiro (nunca hardcoded). Domínio: 0 … 999.999.999,99.

const UNIDADES_EXTENSO = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove',
];

const DEZENAS_EXTENSO: Array<[number, string]> = [
  [2, 'vinte'], [3, 'trinta'], [4, 'quarenta'], [5, 'cinquenta'],
  [6, 'sessenta'], [7, 'setenta'], [8, 'oitenta'], [9, 'noventa'],
];

const CENTENAS_EXTENSO = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

/** Grupo 1-999 por extenso (0 é tratado pelo chamador) */
function grupoParaExtenso(n: number): string {
  if (n === 100) return 'cem';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) partes.push(CENTENAS_EXTENSO[c]);
  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES_EXTENSO[resto]);
    } else {
      const dezena = DEZENAS_EXTENSO.find(([d]) => Math.floor(resto / 10) === d);
      const unidade = resto % 10;
      if (dezena) {
        partes.push(unidade > 0 ? `${dezena[1]} e ${UNIDADES_EXTENSO[unidade]}` : dezena[1]);
      }
    }
  }
  return partes.join(' e ');
}

/** Número inteiro (0 … 999.999.999) por extenso em português */
export function numeroParaExtenso(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n === 0) return 'zero';
  if (n > 999_999_999) return String(Math.round(n));

  const partes: string[] = [];
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  if (milhoes > 0) partes.push(milhoes === 1 ? 'um milhão' : `${grupoParaExtenso(milhoes)} milhões`);
  if (milhares > 0) partes.push(milhares === 1 ? 'mil' : `${grupoParaExtenso(milhares)} mil`);
  if (partes.length === 0) return grupoParaExtenso(resto);
  if (resto === 0) return partes.join(' ');
  // "e" liga o último grupo quando é centena redonda ou dezena/unidade
  const ligarComE = resto < 100 || resto % 100 === 0;
  return partes.join(' ') + (ligarComE ? ' e ' : ' ') + grupoParaExtenso(resto);
}

/**
 * Valor monetário por extenso em Metiais: "noventa e oito mil e
 * seiscentos meticais", com centavos quando existem ("… e cinquenta
 * centavos"). Fora do domínio suportado devolve o numérico (nunca
 * inventa texto).
 */
export function valorPorExtensoMZN(valor: number): string {
  const centavosTotais = Math.round((valor || 0) * 100);
  const inteiro = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;
  if (inteiro > 999_999_999) return formatarMZNCompacto(valor);

  const usarDe = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0;
  const moeda = inteiro === 1 ? 'metical' : usarDe ? 'de meticais' : 'meticais';
  const base = inteiro === 0 && centavos > 0 ? '' : `${numeroParaExtenso(inteiro)} ${moeda}`;
  if (centavos === 0) return base || 'zero meticais';
  const parteCentavos = `${numeroParaExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return base ? `${base} e ${parteCentavos}` : parteCentavos;
}

/** Formata número sem símbolo (quantidades) */
export function formatarQuantidade(qtd: number): string {
  return new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 2 }).format(qtd || 0);
}

/** Formata data ISO em "14 de Agosto de 2026" */
export function formatarDataLonga(dataIso: string): string {
  try {
    return new Date(dataIso + (dataIso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-MZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dataIso;
  }
}

/** Formata data ISO em "14/08/2026" */
export function formatarDataCurta(dataIso: string): string {
  try {
    return new Date(dataIso + (dataIso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-MZ');
  } catch {
    return dataIso;
  }
}

// ---- Saneamento WinAnsi ----
//
// As fontes incorporadas no jsPDF (Helvetica/Times) usam
// WinAnsiEncoding: acentos portugueses, travessões e aspas
// curvas são suportados; emojis e símbolos fora desta tabela
// seriam trocados por lixo visual — aqui são removidos ou
// substituídos por equivalentes seguros.

const SUBSTITUICOES: Record<string, string> = {
  // símbolos frequentes no conteúdo IA
  '✓': '•', '✔': '•', '✗': 'x', '✘': 'x',
  '→': '->', '←': '<-', '⇒': '=>', '∞': 'infinito',
  '€': 'EUR', '£': 'GBP', '•': '•',
  '\u00A0': ' ', // nbsp
  // separadores invisíveis (zero-width e espaços unicode): sem estes
  // mapeamentos o whitelist WinAnsi remove-os e as palavras colam-se
  '\u200B': ' ', '\u200C': ' ', '\u200D': ' ', '\u2060': ' ', '\uFEFF': ' ',
  '\u2000': ' ', '\u2001': ' ', '\u2002': ' ', '\u2003': ' ', '\u2004': ' ',
  '\u2005': ' ', '\u2006': ' ', '\u2007': ' ', '\u2008': ' ', '\u2009': ' ',
  '\u200A': ' ', '\u202F': ' ', '\u205F': ' ', '\u00AD': '',
  '\u2011': '-', '\u2012': '-', '\u2013': '–', '\u2015': '—',
  '\u2026': '…',
  '\u2018': '‘', '\u2019': '’', '\u201C': '“', '\u201D': '”',
  '\u00AB': '«', '\u00BB': '»',
  '\u2212': '−',
};

/**
 * Remove/substitui caracteres não representáveis em WinAnsi.
 * Mantém Latin-1 + pontuação general (em-dash, aspas, etc.).
 */
export function limparTextoPdf(texto: string): string {
  if (!texto) return '';
  let resultado = texto;
  for (const [de, para] of Object.entries(SUBSTITUICOES)) {
    resultado = resultado.split(de).join(para);
  }
  // Emoji e blocos fora do Latin-1/Western → removidos
  resultado = resultado.replace(
    // eslint-disable-next-line no-control-regex
    /[^\u0009\u000A\u0020-\u007E\u00A1-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u2013-\u2014\u2018-\u201F\u2026\u2022\u2030-\u2044\u20AC\u2122]/gu,
    '',
  );
  // controlo residual → espaço
  // eslint-disable-next-line no-control-regex
  resultado = resultado.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ');
  return resultado.replace(/[ \t]+/g, ' ').trim();
}

/** Sanitiza nome de ficheiro e garante extensão .pdf */
export function nomeFicheiroPdf(nome: string): string {
  const base = (nome || 'proposta')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  const comExt = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  return comExt || 'proposta.pdf';
}

/**
 * Mede um logotipo (data URL) para caber numa caixa, devolvendo
 * { largura, altura, formato }. Devolve null se o formato não for
 * suportado pelo jsPDF (ex.: SVG) ou se o data URL for inválido.
 */
export function medirLogotipo(
  dataUrl: string,
  caixaLargura: number,
  caixaAltura: number,
): { largura: number; altura: number; formato: 'PNG' | 'JPEG' } | null {
  if (!dataUrl?.startsWith('data:')) return null;
  const match = /^data:image\/(png|jpeg|jpg);base64,/i.exec(dataUrl);
  if (!match) return null;
  const formato: 'PNG' | 'JPEG' = match[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG';

  const base64 = dataUrl.split(',')[1] ?? '';
  // PNG: dimensões nos bytes 16-23 do IHDR
  // JPEG: procurar marcador SOF0..SOF15
  let px = 0, py = 0;
  try {
    if (formato === 'PNG') {
      const bytes = atob(base64);
      px = (bytes.charCodeAt(16) << 24) | (bytes.charCodeAt(17) << 16) |
           (bytes.charCodeAt(18) << 8) | bytes.charCodeAt(19);
      py = (bytes.charCodeAt(20) << 24) | (bytes.charCodeAt(21) << 16) |
           (bytes.charCodeAt(22) << 8) | bytes.charCodeAt(23);
    } else {
      const bytes = atob(base64);
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes.charCodeAt(i) !== 0xFF) { i++; continue; }
        const marcador = bytes.charCodeAt(i + 1);
        const eSOF = marcador >= 0xC0 && marcador <= 0xCF && marcador !== 0xC4 && marcador !== 0xC8 && marcador !== 0xCC;
        if (eSOF) {
          py = (bytes.charCodeAt(i + 5) << 8) | bytes.charCodeAt(i + 6);
          px = (bytes.charCodeAt(i + 7) << 8) | bytes.charCodeAt(i + 8);
          break;
        }
        const tamanho = (bytes.charCodeAt(i + 2) << 8) | bytes.charCodeAt(i + 3);
        i += 2 + tamanho;
      }
    }
  } catch {
    px = 0; py = 0;
  }

  if (!px || !py) {
    // dimensões desconhecidas: usar caixa quadrada conservadora
    px = Math.min(caixaLargura, caixaAltura) * 2;
    py = Math.min(caixaLargura, caixaAltura) * 2;
  }

  const escala = Math.min(caixaLargura / px, caixaAltura / py);
  return { largura: px * escala, altura: py * escala, formato };
}
