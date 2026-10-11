// ============================================================
// Geração de Propostas em PDF — Motor de layout
//
// Wrapper sobre jsPDF com primitivas de fluxo:
//   - cursor Y com paginação automática (garantirEspaco)
//   - texto rico inline (**negrito**/*itálico*) com quebra
//     de linha e justificação
//   - tabelas com cabeçalho repetido em página nova e zebra
//   - render de blocos markdown por template
//   - rodapés aplicados a todas as páginas no final
//
// Os templates (Executivo/Editorial) desenham através do motor,
// garantindo paginação consistente independentemente do design.
// ============================================================

import { jsPDF } from 'jspdf';
import type { Segmento } from './markdown';
import { parseMarkdown } from './markdown';
import { limparTextoPdf } from './utils';

export type Cor = [number, number, number];
export type Peso = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface Estilo {
  fonte: 'helvetica' | 'times';
  peso: Peso;
  /** tamanho em pt */
  tamanho: number;
}

export interface Margens {
  esq: number;
  dir: number;
  topo: number;
  baixo: number;
}

export interface Medidas {
  larguraPagina: number;
  alturaPagina: number;
  larguraConteudo: number;
  topoConteudo: number;
  fundoConteudo: number;
  margens: Margens;
}

export interface ColunaTabela {
  /** fracção da largura útil (0-1); a soma deve ser 1 */
  fracao: number;
  cabecalho: string;
  alinhamento: 'left' | 'center' | 'right';
}

export interface EstiloTabela {
  fundoCabecalho: Cor;
  corCabecalho: Cor;
  corTexto: Cor;
  corZebra?: Cor;
  corBorda: Cor;
  tamanho: number;
  tamanhoCabecalho: number;
  fonte?: 'helvetica' | 'times';
  /** borda tracejada em vez de contínua (estilo editorial) */
  tracos?: number[];
}

export interface EstiloMarkdown {
  corTexto: Cor;
  corTitulo: Cor;
  tamanhoBase: number;
  fonte?: 'helvetica' | 'times';
  entrelinha?: number;
  /** recuo de lista em mm */
  recuoLista?: number;
}

const PT_MM = 0.352778;

interface Palavra {
  texto: string;
  negrito: boolean;
  italico: boolean;
}

export class MotorPdf {
  readonly doc: jsPDF;
  readonly medidas: Medidas;
  /** cursor Y corrente (mm, topo da próxima linha) */
  y: number;
  /** chamado após criar cada página nova (fundo/cabeçalho do template) */
  aoIniciarPagina?: (motor: MotorPdf, numeroPagina: number) => void;
  private paginaCorrente: number;

  constructor(margens: Margens, opcoes?: { orientacao?: 'p' | 'l' }) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: opcoes?.orientacao ?? 'p' });
    const larguraPagina = this.doc.internal.pageSize.getWidth();
    const alturaPagina = this.doc.internal.pageSize.getHeight();
    this.medidas = {
      larguraPagina,
      alturaPagina,
      larguraConteudo: larguraPagina - margens.esq - margens.dir,
      topoConteudo: margens.topo,
      fundoConteudo: alturaPagina - margens.baixo,
      margens,
    };
    this.y = margens.topo;
    this.paginaCorrente = 1;
  }

  // ---- Páginas ----

  get numeroPagina(): number {
    return this.paginaCorrente;
  }

  novaPagina(): void {
    this.doc.addPage();
    this.paginaCorrente += 1;
    this.y = this.medidas.topoConteudo;
    this.aoIniciarPagina?.(this, this.paginaCorrente);
  }

  /**
   * Garante espaço vertical; abre página nova se necessário.
   * Devolve true se abriu página.
   */
  garantirEspaco(alturaMm: number): boolean {
    if (this.y + alturaMm <= this.medidas.fundoConteudo) return false;
    this.novaPagina();
    return true;
  }

  avancar(deltaMm: number): void {
    this.y += deltaMm;
  }

  /** Aplica rodapé a todas as páginas (chamar no fim da renderização) */
  aplicarRodapes(fn: (motor: MotorPdf, numeroPagina: number, totalPaginas: number) => void): void {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      fn(this, i, total);
    }
  }

  // ---- Primitivas de texto ----

  private aplicar(estilo: Estilo, cor: Cor): void {
    this.doc.setFont(estilo.fonte, estilo.peso);
    this.doc.setFontSize(estilo.tamanho);
    this.doc.setTextColor(cor[0], cor[1], cor[2]);
  }

  medirLargura(texto: string, estilo: Estilo): number {
    this.aplicar(estilo, [0, 0, 0]);
    return this.doc.getTextWidth(limparTextoPdf(texto));
  }

  /**
   * Largura real do espaço — NÃO passa por limparTextoPdf (cujo
   * trim() devolve '' para a string ' '), o que anulava o espaçamento
   * entre palavras no paragrafo(). (Regressão das palavras coladas.)
   */
  medirEspaco(estilo: Estilo): number {
    this.aplicar(
      { fonte: estilo.fonte, peso: 'normal', tamanho: estilo.tamanho },
      [0, 0, 0],
    );
    return this.doc.getTextWidth(' ');
  }

  /**
   * Desenha uma string simples numa posição absoluta (mm).
   * Não move o cursor.
   *
   * Nota: o alinhamento nativo do jsPDF ignora o charSpace —
   * quando há espaçamento de letras, a largura é medida
   * manualmente (incluindo o tracking) e o x ajustado aqui.
   */
  textoAbs(
    texto: string,
    x: number,
    y: number,
    estilo: Estilo,
    cor: Cor,
    opcoes?: { alinhamento?: 'left' | 'center' | 'right'; espacamentoLetras?: number },
  ): void {
    const limpo = limparTextoPdf(texto);
    if (!limpo) return;
    this.aplicar(estilo, cor);
    const alinhamento = opcoes?.alinhamento ?? 'left';
    const espacamento = opcoes?.espacamentoLetras ?? 0;

    if (espacamento > 0 && alinhamento !== 'left') {
      const largura = this.doc.getTextWidth(limpo) + espacamento * (limpo.length - 1);
      const xAjustado = alinhamento === 'center' ? x - largura / 2 : x - largura;
      this.doc.text(limpo, xAjustado, y, { align: 'left', charSpace: espacamento });
      return;
    }

    this.doc.text(limpo, x, y, {
      align: alinhamento,
      charSpace: espacamento > 0 ? espacamento : undefined,
    });
  }

  /** Converte pt→mm */
  static ptParaMm(pt: number): number {
    return pt * PT_MM;
  }

  /**
   * Quebra um texto simples em linhas que cabem na largura.
   * Devolve as linhas e a altura total (mm).
   */
  quebrarTexto(texto: string, larguraMm: number, estilo: Estilo, entrelinha = 1.35): { linhas: string[]; alturaMm: number } {
    const limpo = limparTextoPdf(texto);
    const linhas = limpo
      ? this.doc.splitTextToSize(limpo, larguraMm) as string[]
      : [];
    const alturaLinha = MotorPdf.ptParaMm(estilo.tamanho * entrelinha);
    return { linhas, alturaMm: linhas.length * alturaLinha };
  }

  // ---- Texto rico com fluxo (usa o cursor) ----

  /**
   * Renderiza parágrafo com segmentos inline (negrito/itálico),
   * quebra de linha por palavra e justificação opcional.
   * Avança o cursor. Pagina automaticamente.
   */
  paragrafo(
    segmentos: Segmento[] | string,
    estiloBase: Estilo,
    cor: Cor,
    opcoes?: {
      alinhamento?: 'left' | 'justify';
      entrelinha?: number;
      largura?: number;
      x?: number;
      alturaMinima?: number;
    },
  ): void {
    const entrelinha = opcoes?.entrelinha ?? 1.4;
    const x = opcoes?.x ?? this.medidas.margens.esq;
    const largura = opcoes?.largura ?? this.medidas.larguraConteudo;
    const alturaLinha = MotorPdf.ptParaMm(estiloBase.tamanho * entrelinha);

    const segs: Segmento[] = typeof segmentos === 'string'
      ? [{ texto: segmentos, negrito: false, italico: false }]
      : segmentos;

    // tokenizar em palavras preservando o estilo
    const palavras: Palavra[] = [];
    for (const seg of segs) {
      const limpo = limparTextoPdf(seg.texto);
      if (!limpo) continue;
      for (const p of limpo.split(/\s+/)) {
        if (p) palavras.push({ texto: p, negrito: seg.negrito, italico: seg.italico });
      }
    }
    if (palavras.length === 0) return;

    const larguraPalavra = (p: Palavra): number =>
      this.medirLargura(p.texto, {
        fonte: estiloBase.fonte,
        tamanho: estiloBase.tamanho,
        peso: p.negrito
          ? (p.italico ? 'bolditalic' : 'bold')
          : (p.italico ? 'italic' : 'normal'),
      });

    const estiloPalavra = (p: Palavra): Estilo => ({
      fonte: estiloBase.fonte,
      tamanho: estiloBase.tamanho,
      peso: p.negrito ? (p.italico ? 'bolditalic' : 'bold') : (p.italico ? 'italic' : 'normal'),
    });

    const larguraEspaco = this.medirEspaco(estiloBase);

    // linhas por fluxo
    const linhas: Palavra[][] = [];
    let actual: Palavra[] = [];
    let larguraActual = 0;
    for (const p of palavras) {
      const wp = larguraPalavra(p);
      const acrescimo = actual.length === 0 ? wp : larguraEspaco + wp;
      if (actual.length > 0 && larguraActual + acrescimo > largura) {
        linhas.push(actual);
        actual = [p];
        larguraActual = wp;
      } else {
        actual.push(p);
        larguraActual += acrescimo;
      }
    }
    if (actual.length) linhas.push(actual);

    // página com espaço para a primeira linha?
    if (opcoes?.alturaMinima) this.garantirEspaco(Math.min(opcoes.alturaMinima, alturaLinha));
    else this.garantirEspaco(alturaLinha);

    for (let li = 0; li < linhas.length; li++) {
      this.garantirEspaco(alturaLinha);
      const linha = linhas[li];
      const ultima = li === linhas.length - 1;

      // justificar: distribuir espaço extra (excepto última linha / linha única)
      const larguraTexto = linha.reduce((s, p) => s + larguraPalavra(p), 0)
        + larguraEspaco * (linha.length - 1);
      const justificar = opcoes?.alinhamento === 'justify' && !ultima && linha.length > 1;
      const gap = justificar
        ? larguraEspaco + (largura - larguraTexto) / (linha.length - 1)
        : larguraEspaco;

      let px = x;
      const baseline = this.y + MotorPdf.ptParaMm(estiloBase.tamanho * 0.78);
      for (const p of linha) {
        this.aplicar(estiloPalavra(p), cor);
        this.doc.text(p.texto, px, baseline);
        px += larguraPalavra(p) + gap;
      }
      this.y += alturaLinha;
    }
  }

  // ---- Tabelas ----

  /**
   * Desenha tabela com fluxo e paginação. Cabeçalho repetido em
   * página nova. Avança o cursor.
   */
  tabela(
    colunas: ColunaTabela[],
    linhas: string[][],
    estilo: EstiloTabela,
    opcoes?: { margemTopo?: number },
  ): void {
    const fonte = estilo.fonte ?? 'helvetica';
    const padX = 2.6;
    const padY = 2.2;
    const x0 = this.medidas.margens.esq;
    const larguraTotal = this.medidas.larguraConteudo;
    const larguras = colunas.map(c => c.fracao * larguraTotal);
    const alturaCabecalho = MotorPdf.ptParaMm(estilo.tamanhoCabecalho * 1.25) + padY * 2;

    const desenharCabecalho = (): void => {
      let px = x0;
      this.doc.setFillColor(estilo.fundoCabecalho[0], estilo.fundoCabecalho[1], estilo.fundoCabecalho[2]);
      this.doc.setDrawColor(estilo.corBorda[0], estilo.corBorda[1], estilo.corBorda[2]);
      this.doc.rect(x0, this.y, larguraTotal, alturaCabecalho, 'F');
      for (let ci = 0; ci < colunas.length; ci++) {
        const col = colunas[ci];
        const texto = limparTextoPdf(col.cabecalho).toUpperCase();
        this.aplicar(
          { fonte, peso: 'bold', tamanho: estilo.tamanhoCabecalho },
          estilo.corCabecalho,
        );
        const baseline = this.y + alturaCabecalho / 2 + MotorPdf.ptParaMm(estilo.tamanhoCabecalho * 0.35);
        const xTexto = col.alinhamento === 'right'
          ? px + larguras[ci] - padX
          : col.alinhamento === 'center'
            ? px + larguras[ci] / 2
            : px + padX;
        this.doc.text(texto, xTexto, baseline, { align: col.alinhamento === 'right' ? 'right' : col.alinhamento === 'center' ? 'center' : 'left' });
        px += larguras[ci];
      }
      // régua sob o cabeçalho
      this.doc.setDrawColor(estilo.corBorda[0], estilo.corBorda[1], estilo.corBorda[2]);
      this.doc.setLineWidth(0.2);
      if (estilo.tracos) this.doc.setLineDashPattern(estilo.tracos, 0);
      this.doc.line(x0, this.y + alturaCabecalho, x0 + larguraTotal, this.y + alturaCabecalho);
      if (estilo.tracos) this.doc.setLineDashPattern([], 0);
      this.y += alturaCabecalho;
    };

    this.y += opcoes?.margemTopo ?? 4;
    this.garantirEspaco(alturaCabecalho + 10);
    desenharCabecalho();

    for (let ri = 0; ri < linhas.length; ri++) {
      const linha = linhas[ri].map(c => limparTextoPdf(c));
      // pré-quebrar células
      const celulas = linha.map((texto, ci) => {
        this.aplicar({ fonte, peso: 'normal', tamanho: estilo.tamanho }, estilo.corTexto);
        const max = larguras[ci] - padX * 2;
        const parts = texto
          ? (this.doc.splitTextToSize(texto, max) as string[])
          : [''];
        return parts;
      });
      const alturaLinha = Math.max(...celulas.map(c => c.length))
        * MotorPdf.ptParaMm(estilo.tamanho * 1.3) + padY * 2;

      if (this.y + alturaLinha > this.medidas.fundoConteudo) {
        this.novaPagina();
        this.y += opcoes?.margemTopo ?? 0;
        desenharCabecalho();
      }

      // fundo zebra
      if (estilo.corZebra && ri % 2 === 1) {
        this.doc.setFillColor(estilo.corZebra[0], estilo.corZebra[1], estilo.corZebra[2]);
        this.doc.rect(x0, this.y, larguraTotal, alturaLinha, 'F');
      }

      let px = x0;
      for (let ci = 0; ci < colunas.length; ci++) {
        const col = colunas[ci];
        const parts = celulas[ci];
        this.aplicar({ fonte, peso: 'normal', tamanho: estilo.tamanho }, estilo.corTexto);
        const alturaTexto = parts.length * MotorPdf.ptParaMm(estilo.tamanho * 1.3);
        let py = this.y + (alturaLinha - alturaTexto) / 2;
        for (const part of parts) {
          const baseline = py + MotorPdf.ptParaMm(estilo.tamanho * 0.78);
          const xTexto = col.alinhamento === 'right'
            ? px + larguras[ci] - padX
            : col.alinhamento === 'center'
              ? px + larguras[ci] / 2
              : px + padX;
          this.doc.text(part, xTexto, baseline, {
            align: col.alinhamento === 'right' ? 'right' : col.alinhamento === 'center' ? 'center' : 'left',
          });
          py += MotorPdf.ptParaMm(estilo.tamanho * 1.3);
        }
        px += larguras[ci];
      }

      // linha inferior por linha (estilo hairline)
      this.doc.setDrawColor(estilo.corBorda[0], estilo.corBorda[1], estilo.corBorda[2]);
      this.doc.setLineWidth(0.15);
      if (estilo.tracos) this.doc.setLineDashPattern(estilo.tracos, 0);
      this.doc.line(x0, this.y + alturaLinha, x0 + larguraTotal, this.y + alturaLinha);
      if (estilo.tracos) this.doc.setLineDashPattern([], 0);

      this.y += alturaLinha;
    }
  }

  // ---- Markdown ----

  /**
   * Renderiza conteúdo markdown-lite com os estilos do template.
   * Avança o cursor; pagina automaticamente.
   */
  markdown(conteudo: string, estilo: EstiloMarkdown): void {
    const blocos = parseMarkdown(conteudo);
    const fonte = estilo.fonte ?? 'helvetica';
    const base: Estilo = { fonte, peso: 'normal', tamanho: estilo.tamanhoBase };

    for (const bloco of blocos) {
      switch (bloco.tipo) {
        case 'titulo': {
          const tamanho = bloco.nivel === 2 ? estilo.tamanhoBase + 2 : estilo.tamanhoBase + 0.5;
          this.garantirEspaco(MotorPdf.ptParaMm(tamanho * 1.9) + 3);
          this.paragrafo(bloco.texto, { fonte, peso: 'bold', tamanho }, estilo.corTitulo, { entrelinha: 1.3 });
          this.y += 1.4;
          break;
        }
        case 'paragrafo': {
          this.paragrafo(bloco.segmentos, base, estilo.corTexto, {
            alinhamento: 'justify',
            entrelinha: estilo.entrelinha ?? 1.45,
          });
          this.y += 1.8;
          break;
        }
        case 'lista': {
          const recuo = estilo.recuoLista ?? 5;
          bloco.itens.forEach((item, idx) => {
            const marcador = bloco.ordenada ? `${idx + 1}.` : '•';
            this.garantirEspaco(MotorPdf.ptParaMm(estilo.tamanhoBase * 1.45));
            this.textoAbs(
              marcador,
              this.medidas.margens.esq,
              this.y + MotorPdf.ptParaMm(estilo.tamanhoBase * 0.78),
              { fonte, peso: 'bold', tamanho: estilo.tamanhoBase },
              estilo.corTitulo,
            );
            this.paragrafo(item, base, estilo.corTexto, {
              x: this.medidas.margens.esq + recuo,
              largura: this.medidas.larguraConteudo - recuo,
              entrelinha: estilo.entrelinha ?? 1.45,
              alturaMinima: MotorPdf.ptParaMm(estilo.tamanhoBase * 1.45),
            });
            this.y += 0.9;
          });
          this.y += 1.2;
          break;
        }
        case 'tabela': {
          const largura = bloco.cabecalho.length;
          const fracoes = bloco.linhas.reduce(
            (acc, l) => acc.map((f, i) => Math.max(f, (l[i] ?? '').length)),
            bloco.cabecalho.map(() => 1),
          );
          const soma = fracoes.reduce((s, f) => s + f, 0) || 1;
          const alinhamento = (i: number): 'left' | 'center' | 'right' => {
            const amostras = [bloco.cabecalho[i], ...bloco.linhas.map(l => l[i] ?? '')].join(' ');
            if (/[0-9]/.test(amostras) && !/[a-zA-Z]{3}/.test(amostras.replace(/[0-9\s.,%/MT-]/g, ''))) return 'center';
            return largura > 3 && i === 0 ? 'left' : largura > 3 ? 'center' : 'left';
          };
          this.tabela(
            bloco.cabecalho.map((c, i) => ({ cabecalho: c, fracao: fracoes[i] / soma, alinhamento: alinhamento(i) })),
            bloco.linhas.map(l => l.map(c => c)),
            {
              fundoCabecalho: estilo.corTitulo,
              corCabecalho: [255, 255, 255],
              corTexto: estilo.corTexto,
              corZebra: [248, 250, 252],
              corBorda: [226, 232, 240],
              tamanho: estilo.tamanhoBase - 1,
              tamanhoCabecalho: estilo.tamanhoBase - 1,
              fonte,
            },
          );
          this.y += 3;
          break;
        }
      }
    }
  }

  // ---- Primitivas geométricas (atalhos) ----

  rect(x: number, y: number, w: number, h: number, cor: Cor, estilo: 'F' | 'S' | 'FD' = 'F', raio?: number): void {
    this.doc.setFillColor(cor[0], cor[1], cor[2]);
    if (raio !== undefined) {
      this.doc.roundedRect(x, y, w, h, raio, raio, estilo);
    } else {
      this.doc.rect(x, y, w, h, estilo);
    }
  }

  linha(x1: number, y1: number, x2: number, y2: number, cor: Cor, espessura = 0.2, tracos?: number[]): void {
    this.doc.setDrawColor(cor[0], cor[1], cor[2]);
    this.doc.setLineWidth(espessura);
    if (tracos) this.doc.setLineDashPattern(tracos, 0);
    this.doc.line(x1, y1, x2, y2);
    if (tracos) this.doc.setLineDashPattern([], 0);
  }

  /** Texto multi-linha simples (ex.: blocos de endereço) */
  blocoTexto(
    linhas: Array<{ texto: string; estilo: Estilo; cor: Cor; entrelinha?: number }>,
    x: number,
    yInicio: number,
    largura: number,
  ): number {
    let py = yInicio;
    for (const l of linhas) {
      const limpa = limparTextoPdf(l.texto);
      if (!limpa) continue;
      const quebradas = this.quebrarTexto(limpa, largura, l.estilo, l.entrelinha ?? 1.3);
      for (const q of quebradas.linhas) {
        this.textoAbs(q, x, py + MotorPdf.ptParaMm(l.estilo.tamanho * 0.78), l.estilo, l.cor);
        py += MotorPdf.ptParaMm(l.estilo.tamanho * (l.entrelinha ?? 1.3));
      }
    }
    return py;
  }
}
