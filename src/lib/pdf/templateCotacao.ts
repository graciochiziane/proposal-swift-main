// ============================================================
// Template PDF 3 — "Cotação Minimalista"
//
// Réplica do layout de referência fornecido pelo cliente
// (mockup de factura/cotação): folha branca, logotipo à esquerda
// com banda de título arredondada à direita, bloco de metadados
// em duas colunas (cliente / proposta+pagamento), tabela com
// cabeçalho na cor da marca e filetes hairline, área inferior
// com termos à esquerda e totais empilhados à direita, e banda
// de rodapé full-bleed com contactos.
//
// A cor de acento deriva da cor primária da marca (fallback:
// laranja da referência). A paleta de neutral é fixa.
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf } from './tipos';
import { formatarDataCurta, formatarMZN, formatarQuantidade, hexToRgb, luminancia, medirLogotipo } from './utils';

const COR_TEXTO: Cor = [23, 28, 38];
const COR_CINZA: Cor = [104, 112, 125];
const COR_HAIRLINE: Cor = [224, 228, 234];
const BRANCO: Cor = [255, 255, 255];

/** Laranja do mockup de referência — usado quando a marca não define cor */
const ACENTO_REFERENCIA = '#F97316';

const PT_MM = 0.352778;

interface Paleta {
  acento: Cor;
  sobreAcento: Cor;
}

function construirPaleta(hexCor: string | undefined): Paleta {
  const hex = hexCor && /^#[0-9a-fA-F]{3,6}$/.test(hexCor) ? hexCor : ACENTO_REFERENCIA;
  return {
    acento: hexToRgb(hex),
    sobreAcento: luminancia(hex) > 0.55 ? COR_TEXTO : BRANCO,
  };
}

// ============================================================
// Ponto de entrada
// ============================================================

export function desenharCotacao(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 15, dir: 15, topo: 24, baixo: 26 });
  const p = construirPaleta(dados.empresa.corPrimaria);

  motor.aoIniciarPagina = m => cabecalhoContinuacao(m, dados, p);

  desenharCabecalho(motor, dados, p);
  desenharBlocoInfo(motor, dados);

  if (dados.mostrarFinanceiro) {
    tabelaItens(motor, dados, p);
    areaInferior(motor, dados, p);
  }

  desenharSeccoes(motor, dados, p);

  if (!dados.mostrarFinanceiro && dados.seccoes.length === 0) {
    motor.garantirEspaco(20);
    motor.paragrafo(
      '(Documento sem conteúdo financeiro ou narrativo registado.)',
      { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 },
      COR_CINZA,
    );
  }

  motor.aplicarRodapes((m, i, total) => bandaRodape(m, dados, i, total, p));
  return motor;
}

// ============================================================
// CABEÇALHO — logotipo/marca à esquerda + banda de título à direita
// ============================================================

function desenharCabecalho(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const yBanda = 16;
  const bandaW = 112;
  const bandaH = 14;
  const bandaX = motor.medidas.larguraPagina - motor.medidas.margens.dir - bandaW;
  const limiteEsquerdo = bandaX - 6;

  // ---- identidade (logotipo ou marca com inicial) ----
  let xTexto = 15;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 26, 13);
    if (logo) {
      try {
        motor.doc.addImage(dados.empresa.logotipo, logo.formato, 15, yBanda, logo.largura, logo.altura);
        xTexto = 15 + logo.largura + 4;
      } catch { /* logotipo inválido → marca com inicial */ }
    }
  }
  if (!dados.empresa.logotipo || xTexto === 15) {
    motor.rect(15, yBanda, 9.5, 9.5, p.acento, 'F', 1.8);
    const inicial = (dados.empresa.nome.match(/[a-zA-Z0-9]/) || ['P'])[0].toUpperCase();
    motor.textoAbs(inicial, 19.75, yBanda + 6.9, { fonte: 'helvetica', peso: 'bold', tamanho: 11 }, p.sobreAcento, { alinhamento: 'center' });
    xTexto = 27.5;
  }

  // ---- nome da empresa + endereço/NUIT (coluna esquerda) ----
  const larguraNome = limiteEsquerdo - xTexto;
  const nomeQuebrado = motor.quebrarTexto(dados.empresa.nome, Math.max(larguraNome, 30), { fonte: 'helvetica', peso: 'bold', tamanho: 11.5 }, 1.15).linhas;
  let yNome = yBanda + 6.2;
  for (const linha of nomeQuebrado.slice(0, 2)) {
    motor.textoAbs(linha, xTexto, yNome, { fonte: 'helvetica', peso: 'bold', tamanho: 11.5 }, COR_TEXTO);
    yNome += 11.5 * 1.15 * PT_MM;
  }
  const detalhes = [
    dados.empresa.endereco || '',
    dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '',
  ].filter(Boolean);
  for (const detalhe of detalhes.slice(0, 2)) {
    const quebradas = motor.quebrarTexto(detalhe, Math.max(larguraNome, 30), { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, 1.25).linhas;
    for (const q of quebradas.slice(0, 2)) {
      motor.textoAbs(q, xTexto, yNome + 1.2, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, COR_CINZA);
      yNome += 7.5 * 1.25 * PT_MM;
    }
  }

  // ---- banda de título (arredondada, à direita) ----
  motor.rect(bandaX, yBanda, bandaW, bandaH, p.acento, 'F', 2.6);
  const ajuste = linhasTituloBanda(motor, dados.titulo, bandaW - 10);
  if (ajuste.linhas.length === 1) {
    motor.textoAbs(
      ajuste.linhas[0],
      bandaX + bandaW / 2,
      yBanda + bandaH / 2 + ajuste.tamanho * PT_MM * 0.36,
      { fonte: 'helvetica', peso: 'bold', tamanho: ajuste.tamanho },
      p.sobreAcento,
      { alinhamento: 'center', espacamentoLetras: 2 },
    );
  } else {
    ajuste.linhas.forEach((linha, idx) => {
      motor.textoAbs(
        linha,
        bandaX + bandaW / 2,
        yBanda + 5.7 + idx * 5.6,
        { fonte: 'helvetica', peso: 'bold', tamanho: ajuste.tamanho },
        p.sobreAcento,
        { alinhamento: 'center', espacamentoLetras: 1.6 },
      );
    });
  }

  motor.y = 38;
}

/** Ajusta o título da banda: 1 linha grande ou 2 linhas menores */
function linhasTituloBanda(motor: MotorPdf, titulo: string, larguraUtil: number): { linhas: string[]; tamanho: number } {
  const t = (titulo || 'Proposta').toUpperCase().trim();
  for (const tamanho of [12.5, 11.5, 10.5, 9.5]) {
    const estilo: Estilo = { fonte: 'helvetica', peso: 'bold', tamanho };
    const tracking = tamanho >= 12 ? 2 : 1.6;
    const largura1 = motor.medirLargura(t, estilo) + tracking * Math.max(0, t.length - 1);
    if (largura1 <= larguraUtil) return { linhas: [t], tamanho };
    const palavras = t.split(/\s+/);
    if (palavras.length >= 2) {
      const meio = Math.ceil(palavras.length / 2);
      const par = [palavras.slice(0, meio).join(' '), palavras.slice(meio).join(' ')];
      const cabe = par.every(l => motor.medirLargura(l, estilo) + tracking * Math.max(0, l.length - 1) <= larguraUtil);
      if (cabe) return { linhas: par, tamanho };
    }
  }
  return { linhas: [t.slice(0, 22)], tamanho: 9.5 };
}

// ============================================================
// BLOCO DE INFORMAÇÃO — cliente (esq.) / proposta+pagamento (dir.)
// ============================================================

function desenharBlocoInfo(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const y0 = motor.y;
  const xDir = 113;
  const larguraDir = motor.medidas.larguraPagina - motor.medidas.margens.dir - xDir;
  const larguraEsq = xDir - motor.medidas.margens.esq - 10;

  // ---- coluna esquerda: cliente ----
  motor.textoAbs('CLIENTE', 15, y0 + 6, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, COR_TEXTO);
  let py = y0 + 13;
  const linhasCliente: Array<{ texto: string; estilo: Estilo; cor: Cor }> = [
    { texto: dados.cliente.nome, estilo: { fonte: 'helvetica', peso: 'bold', tamanho: 10.5 }, cor: COR_TEXTO },
  ];
  if (dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome) {
    linhasCliente.push({ texto: dados.cliente.empresa, estilo: { fonte: 'helvetica', peso: 'normal', tamanho: 9.5 }, cor: COR_TEXTO });
  }
  for (const campo of [dados.cliente.endereco, dados.cliente.nuit ? `NUIT ${dados.cliente.nuit}` : '', dados.cliente.telefone, dados.cliente.email]) {
    if (campo) linhasCliente.push({ texto: campo, estilo: { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, cor: COR_CINZA });
  }
  for (const l of linhasCliente.slice(0, 7)) {
    const quebradas = motor.quebrarTexto(l.texto, larguraEsq, l.estilo, 1.25).linhas;
    for (const q of quebradas.slice(0, 2)) {
      motor.textoAbs(q, 15, py + l.estilo.tamanho * PT_MM * 0.78, l.estilo, l.cor);
      py += l.estilo.tamanho * 1.35 * PT_MM;
    }
  }

  // ---- coluna direita: metadados da proposta ----
  let pyD = y0 + 6;
  motor.textoAbs('PROPOSTA', xDir, pyD, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, COR_TEXTO);
  pyD += 6.5;
  motor.textoAbs(dados.numero || 'S/N', xDir, pyD + 2.8, { fonte: 'helvetica', peso: 'bold', tamanho: 11 }, COR_TEXTO);
  pyD += 8.5;

  motor.textoAbs('DATA', xDir, pyD + 2.4, { fonte: 'helvetica', peso: 'bold', tamanho: 8 }, COR_CINZA);
  motor.textoAbs(formatarDataCurta(dados.data), xDir, pyD + 6.6, { fonte: 'helvetica', peso: 'normal', tamanho: 9.5 }, COR_TEXTO);
  pyD += 11.5;

  if (dados.validadeDias && dados.validadeDias > 0) {
    motor.textoAbs('VALIDADE', xDir, pyD + 2.4, { fonte: 'helvetica', peso: 'bold', tamanho: 8 }, COR_CINZA);
    motor.textoAbs(`${dados.validadeDias} dias`, xDir, pyD + 6.6, { fonte: 'helvetica', peso: 'normal', tamanho: 9.5 }, COR_TEXTO);
    pyD += 11.5;
  }

  // ---- pagamento compacto (como no mockup: "Payment method") ----
  const pag = dados.pagamento;
  const linhasPag: string[] = [];
  if (pag?.banco) linhasPag.push(pag.banco);
  if (pag?.conta) linhasPag.push(`Conta ${pag.conta}`);
  if (pag?.nib) linhasPag.push(`NIB ${pag.nib}`);
  const mobile = [
    pag?.mpesa ? `M-Pesa ${pag.mpesa}` : '',
    pag?.emola ? `e-Mola ${pag.emola}` : '',
    pag?.mkesh ? `mKesh ${pag.mkesh}` : '',
  ].filter(Boolean).join('  ·  ');
  if (mobile) linhasPag.push(mobile);

  if (linhasPag.length > 0) {
    motor.textoAbs('PAGAMENTO', xDir, pyD + 2.4, { fonte: 'helvetica', peso: 'bold', tamanho: 8 }, COR_CINZA);
    pyD += 6.6;
    for (const linha of linhasPag.slice(0, 5)) {
      const quebradas = motor.quebrarTexto(linha, larguraDir, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, 1.25).linhas;
      for (const q of quebradas.slice(0, 2)) {
        motor.textoAbs(q, xDir, pyD + 2.4, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, COR_TEXTO);
        pyD += 8.5 * 1.3 * PT_MM;
      }
    }
  }

  // filete sob o bloco de informação
  const yFim = Math.max(py, pyD) + 4;
  motor.linha(15, yFim, motor.medidas.larguraPagina - motor.medidas.margens.dir, yFim, COR_HAIRLINE, 0.25);
  motor.y = yFim + 5;
}

// ============================================================
// TABELA DE ITENS — cabeçalho na cor da marca, filetes hairline
// ============================================================

function tabelaItens(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.y += 1;
  if (dados.itens.length === 0) {
    motor.paragrafo('(Sem itens registados nesta proposta.)', { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 }, COR_CINZA);
    motor.y += 3;
    return;
  }
  motor.tabela(
    [
      { cabecalho: 'Descrição', fracao: 0.48, alinhamento: 'left' },
      { cabecalho: 'Preço Unit.', fracao: 0.19, alinhamento: 'right' },
      { cabecalho: 'Qtd', fracao: 0.11, alinhamento: 'center' },
      { cabecalho: 'Subtotal', fracao: 0.22, alinhamento: 'right' },
    ],
    dados.itens.map(item => [
      item.nome,
      formatarMZN(item.precoUnitario),
      formatarQuantidade(item.quantidade),
      formatarMZN(item.subtotal),
    ]),
    {
      fundoCabecalho: p.acento,
      corCabecalho: p.sobreAcento,
      corTexto: COR_TEXTO,
      corBorda: COR_HAIRLINE,
      tamanho: 9,
      tamanhoCabecalho: 8.5,
      fonte: 'helvetica',
    },
  );
  motor.y += 2;
}

// ============================================================
// ÁREA INFERIOR — termos (esq.) + totais empilhados (dir.)
// ============================================================

function areaInferior(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const termos = (dados.observacoes || '').trim() || (
    `Proposta válida por ${dados.validadeDias ?? 15} dias a contar da data de emissão. `
    + 'Os valores estão expressos em Metiais (MZN), IVA à taxa legal em vigor.'
  );

  motor.garantirEspaco(46);
  const y0 = motor.y;
  const xTotais = 122;
  const larguraTotais = motor.medidas.larguraPagina - motor.medidas.margens.dir - xTotais;
  const larguraTermos = xTotais - motor.medidas.margens.esq - 8;

  // ---- totais (direita) em posições absolutas ----
  const linhas: Array<[string, string]> = [['Subtotal', formatarMZN(dados.totais.subtotal)]];
  if (dados.totais.desconto > 0) {
    linhas.push([`Desconto${dados.totais.descontoLabel ? ` (${dados.totais.descontoLabel})` : ''}`, `- ${formatarMZN(dados.totais.desconto)}`]);
  }
  if (dados.totais.iva > 0 || dados.totais.ivaPercentual > 0) {
    linhas.push([`IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%)`, formatarMZN(dados.totais.iva)]);
  }

  let py = y0 + 3;
  for (const [rotulo, valor] of linhas) {
    motor.textoAbs(rotulo, xTotais, py + 2.6, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, COR_CINZA);
    motor.textoAbs(valor, xTotais + larguraTotais, py + 2.6, { fonte: 'helvetica', peso: 'normal', tamanho: 9 }, COR_TEXTO, { alinhamento: 'right' });
    py += 5.2;
  }

  // régua de acento + TOTAL destacado (maior e bold, como na referência)
  motor.linha(xTotais, py + 1.6, xTotais + larguraTotais, py + 1.6, p.acento, 0.6);
  motor.textoAbs('TOTAL', xTotais, py + 8.6, { fonte: 'helvetica', peso: 'bold', tamanho: 10 }, COR_TEXTO);
  motor.textoAbs(formatarMZN(dados.totais.total), xTotais + larguraTotais, py + 9.2, { fonte: 'helvetica', peso: 'bold', tamanho: 15 }, COR_TEXTO, { alinhamento: 'right' });
  const fundoTotais = py + 13;

  // ---- termos (esquerda) com fluxo normal ----
  motor.textoAbs('TERMOS E CONDIÇÕES', 15, y0 + 6, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, COR_TEXTO);
  motor.y = y0 + 9.5;
  motor.paragrafo(
    termos,
    { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 },
    COR_CINZA,
    { alinhamento: 'justify', entrelinha: 1.5, x: 15, largura: larguraTermos },
  );

  motor.y = Math.max(motor.y, fundoTotais) + 7;
}

// ============================================================
// SECÇÕES NARRATIVAS (quando a cotação inclui conteúdo IA)
// ============================================================

function desenharSeccoes(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(24);
    const y = motor.y;
    motor.rect(15, y + 0.9, 3.2, 3.2, p.acento, 'F', 0.5);
    motor.textoAbs(seccao.titulo, 21, y + 4.7, { fonte: 'helvetica', peso: 'bold', tamanho: 11 }, COR_TEXTO);
    motor.linha(15, y + 8.6, motor.medidas.larguraPagina - motor.medidas.margens.dir, y + 8.6, COR_HAIRLINE, 0.2);
    motor.y = y + 12.5;
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: p.acento,
      tamanhoBase: 9.5,
      fonte: 'helvetica',
      entrelinha: 1.5,
    });
    motor.y += 3.5;
  }
}

// ============================================================
// CABEÇALHO DE CONTINUAÇÃO (páginas 2+)
// ============================================================

function cabecalhoContinuacao(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.textoAbs(dados.empresa.nome.toUpperCase(), 15, 12, { fonte: 'helvetica', peso: 'bold', tamanho: 7.5 }, COR_CINZA, { espacamentoLetras: 1.1 });
  motor.textoAbs(`PROPOSTA ${dados.numero}`, motor.medidas.larguraPagina - motor.medidas.margens.dir, 12, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, COR_CINZA, { alinhamento: 'right' });
  motor.linha(15, 15.5, motor.medidas.larguraPagina - motor.medidas.margens.dir, 15.5, COR_HAIRLINE, 0.25);
  motor.rect(15, 14.9, 10, 1.2, p.acento);
}

// ============================================================
// BANDA DE RODAPÉ — full-bleed na cor da marca (todas as páginas)
// ============================================================

function bandaRodape(motor: MotorPdf, dados: DadosPropostaPdf, i: number, total: number, p: Paleta): void {
  const alturaPagina = motor.medidas.alturaPagina;
  const alturaBanda = 18;
  const yBanda = alturaPagina - alturaBanda;
  motor.rect(0, yBanda, motor.medidas.larguraPagina, alturaBanda, p.acento, 'F');

  const email = dados.empresa.email?.trim();
  const telefone = dados.empresa.telefone?.trim();
  const esquerda = email || telefone || dados.empresa.nome;
  const direita = email && telefone ? telefone : '';

  motor.textoAbs(esquerda, 15, yBanda + 9.6, { fonte: 'helvetica', peso: 'normal', tamanho: 8 }, p.sobreAcento);
  if (direita) {
    motor.textoAbs(direita, motor.medidas.larguraPagina - 15, yBanda + 9.6, { fonte: 'helvetica', peso: 'normal', tamanho: 8 }, p.sobreAcento, { alinhamento: 'right' });
  }
  if (total > 1) {
    motor.textoAbs(`Página ${i} de ${total}`, motor.medidas.larguraPagina / 2, yBanda + 9.6, { fonte: 'helvetica', peso: 'normal', tamanho: 6.5 }, p.sobreAcento, { alinhamento: 'center' });
  }
}
