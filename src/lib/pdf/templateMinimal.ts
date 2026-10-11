// ============================================================
// Template PDF 4 — "Cotação Minimalista"
//
// Minimalismo tipográfico genuíno: folha branca, hierarquia
// construída apenas com tipografia, espaço em branco e
// hairlines. Sem bandas, cartões, molduras ou preenchimentos —
// a cor da marca entra só em micro-acentos (traço do título,
// régua do total, micro-marca do rodapé).
//
// Inclui TODOS os pressupostos do sistema:
//   - Logótipo no cabeçalho (ou nome da empresa em destaque)
//   - Dados fiscais da empresa: NUIT, endereço, email, telefone
//   - Cliente completo: nome, empresa, NUIT, endereço, contactos
//   - Metadados: número, data e validade
//   - Pagamentos completos: banco, conta, NIB, M-Pesa, e-Mola,
//     m-Kesh e formas dinâmicas (extras) SEM limite
//   - Tabela de itens em hairlines; desconto com rótulo e IVA
//   - Termos/observações, secções narrativas (IA) e assinaturas
//
// Fallback de cor: monocromático (quase-preto) quando a marca
// não define cor primária — minimalismo por natureza.
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf } from './tipos';
import { formatarDataCurta, formatarMZN, formatarQuantidade, hexToRgb, luminancia, medirLogotipo } from './utils';

const COR_TEXTO: Cor = [17, 24, 39];
const COR_CINZA: Cor = [107, 114, 128];
const COR_HAIRLINE: Cor = [226, 232, 233];
const BRANCO: Cor = [255, 255, 255];

/** Fallback monocromático — a cor da marca só entra quando definida */
const ACENTO_FALLBACK = '#111827';

const PT_MM = 0.352778;

interface Paleta {
  acento: Cor;
  /** cor para labels em acento — escurece quando a marca é clara demais */
  acentoTexto: Cor;
}

function construirPaleta(hexCor: string | undefined): Paleta {
  const hex = hexCor && /^#[0-9a-fA-F]{3,6}$/.test(hexCor) ? hexCor : ACENTO_FALLBACK;
  const acento = hexToRgb(hex);
  return {
    acento,
    acentoTexto: luminancia(hex) > 0.62 ? COR_TEXTO : acento,
  };
}

// ============================================================
// Ponto de entrada
// ============================================================

export function desenharMinimal(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 16, dir: 16, topo: 18, baixo: 22 });
  const p = construirPaleta(dados.empresa.corPrimaria);

  motor.aoIniciarPagina = m => cabecalhoContinuacao(m, dados, p);

  desenharCabecalho(motor, dados);
  desenharTitulo(motor, dados, p);
  blocoClientePagamento(motor, dados, p);

  if (dados.mostrarFinanceiro) {
    tabelaItens(motor, dados);
    areaInferior(motor, dados, p);
  }

  desenharSecoes(motor, dados, p);

  if (!dados.mostrarFinanceiro && dados.seccoes.length === 0) {
    motor.garantirEspaco(20);
    motor.paragrafo(
      '(Documento sem conteúdo financeiro ou narrativo registado.)',
      { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 },
      COR_CINZA,
    );
  }

  desenharAssinaturas(motor, dados);
  motor.aplicarRodapes((m, i, total) => rodape(m, dados, i, total, p));
  return motor;
}

// ============================================================
// CABEÇALHO — logótipo + dados fiscais (esq.) / metadados (dir.)
// ============================================================

function desenharCabecalho(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const y0 = 18;
  const xDir = motor.medidas.larguraPagina - motor.medidas.margens.dir; // right-aligned
  const limiteEsq = 118; // zona esquerda até aqui

  // ---- logótipo à esquerda (lugar garantido) ----
  let xTexto = 16;
  let temLogo = false;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 30, 14);
    if (logo) {
      try {
        motor.doc.addImage(dados.empresa.logotipo, logo.formato, 16, y0, logo.largura, logo.altura);
        xTexto = 16 + logo.largura + 5;
        temLogo = true;
      } catch { /* logotipo inválido → nome da empresa em destaque */ }
    }
  }

  // ---- coluna esquerda: nome da empresa + dados fiscais ----
  let yEsq = y0;
  const larguraNome = limiteEsq - xTexto;
  const estiloNome: Estilo = { fonte: 'helvetica', peso: 'bold', tamanho: temLogo ? 10.5 : 12.5 };
  const nomeQuebrado = motor.quebrarTexto(dados.empresa.nome, Math.max(larguraNome, 40), estiloNome, 1.15).linhas;
  let yNome = temLogo ? y0 + 3.6 : y0 + 4.8;
  for (const linha of nomeQuebrado.slice(0, 2)) {
    motor.textoAbs(linha, xTexto, yNome, estiloNome, COR_TEXTO);
    yNome += estiloNome.tamanho * 1.15 * PT_MM;
  }
  const fiscais = [
    [dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '', dados.empresa.endereco || ''].filter(Boolean).join('  ·  '),
    [dados.empresa.email, dados.empresa.telefone].filter(Boolean).join('  ·  '),
  ].filter(Boolean);
  for (const f of fiscais) {
    const quebradas = motor.quebrarTexto(f, Math.max(larguraNome, 40), { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, 1.3).linhas;
    for (const q of quebradas.slice(0, 2)) {
      motor.textoAbs(q, xTexto, yNome + 1, { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, COR_CINZA);
      yNome += 7 * 1.3 * PT_MM;
    }
  }
  yEsq = Math.max(yEsq + (temLogo ? 14 : 4), yNome);

  // ---- coluna direita: metadados da cotação ----
  let yDir = y0 + 1.5;
  yDir = parMeta(motor, xDir, yDir, 'COTAÇÃO Nº', dados.numero || 'S/N', true);
  yDir = parMeta(motor, xDir, yDir, 'DATA', formatarDataCurta(dados.data), false);
  if (dados.validadeDias && dados.validadeDias > 0) {
    yDir = parMeta(motor, xDir, yDir, 'VALIDADE', `${dados.validadeDias} dias`, false);
  }

  // ---- filete separador ----
  const yFim = Math.max(yEsq, yDir) + 3.5;
  motor.linha(16, yFim, motor.medidas.larguraPagina - motor.medidas.margens.dir, yFim, COR_HAIRLINE, 0.25);
  motor.y = yFim + 5;
}

/** Par label/valor right-aligned; devolve o y seguinte */
function parMeta(motor: MotorPdf, x: number, y: number, label: string, valor: string, valorBold: boolean): number {
  motor.textoAbs(label, x, y, { fonte: 'helvetica', peso: 'bold', tamanho: 6.5 }, COR_CINZA, { alinhamento: 'right', espacamentoLetras: 1.2 });
  motor.textoAbs(valor, x, y + 4.2, { fonte: 'helvetica', peso: valorBold ? 'bold' : 'normal', tamanho: 9.5 }, COR_TEXTO, { alinhamento: 'right' });
  return y + 10.5;
}

// ============================================================
// TÍTULO — traço de acento + tipografia grande + "preparada para"
// ============================================================

function desenharTitulo(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.y += 4;
  motor.garantirEspaco(30);
  const y = motor.y;

  // traço de acento — o único sinal de cor no alto do documento
  motor.linha(16, y + 0.5, 26, y + 0.5, p.acento, 1);

  const estilo: Estilo = { fonte: 'helvetica', peso: 'bold', tamanho: 20 };
  const linhas = motor.quebrarTexto(dados.titulo || 'Proposta', motor.medidas.larguraConteudo, estilo, 1.08).linhas;
  let yT = y + 8.2;
  for (const l of linhas.slice(0, 2)) {
    motor.textoAbs(l, 16, yT, estilo, COR_TEXTO);
    yT += 20 * 1.08 * PT_MM;
  }
  const cliente = dados.cliente.empresa || dados.cliente.nome;
  if (cliente) {
    motor.textoAbs(`Preparada para ${cliente}`, 16, yT + 2.5, { fonte: 'helvetica', peso: 'normal', tamanho: 10 }, COR_CINZA);
    yT += 5;
  }
  motor.y = Math.max(motor.y + 8, yT + 3);
}

// ============================================================
// BLOCO CLIENTE (esq.) / PAGAMENTO (dir.) — pagamentos completos
// ============================================================

function blocoClientePagamento(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const xDir = 118;
  const larguraDir = motor.medidas.larguraPagina - motor.medidas.margens.dir - xDir;
  const larguraEsq = xDir - motor.medidas.margens.esq - 10;

  // ---- linhas de pagamento: TODAS as formas, SEM limite de extras ----
  const pag = dados.pagamento;
  const linhasPag: string[] = [];
  if (pag?.banco) linhasPag.push(pag.banco);
  if (pag?.conta) linhasPag.push(`Conta ${pag.conta}`);
  if (pag?.nib) linhasPag.push(`NIB ${pag.nib}`);
  if (pag?.mpesa) linhasPag.push(`M-Pesa ${pag.mpesa}`);
  if (pag?.emola) linhasPag.push(`e-Mola ${pag.emola}`);
  if (pag?.mkesh) linhasPag.push(`m-Kesh ${pag.mkesh}`);
  // formas dinâmicas criadas pelo dono — sem cap (o bloco pagina se crescer)
  for (const extra of pag?.extras ?? []) {
    linhasPag.push(`${extra.rotulo} ${extra.valor}`);
  }

  // garantir espaço para o bloco inteiro (cliente ~7 linhas vs pagamento)
  motor.garantirEspaco(12 + Math.max(7, linhasPag.length) * 4.4 + 6);

  const y0 = motor.y;

  // ---- coluna esquerda: cliente ----
  motor.textoAbs('CLIENTE', 16, y0 + 4, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, p.acentoTexto, { espacamentoLetras: 1.8 });
  const linhasCliente: Array<{ texto: string; bold: boolean }> = [
    { texto: dados.cliente.nome, bold: true },
  ];
  if (dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome) {
    linhasCliente.push({ texto: dados.cliente.empresa, bold: false });
  }
  for (const campo of [dados.cliente.endereco, dados.cliente.nuit ? `NUIT ${dados.cliente.nuit}` : '', dados.cliente.telefone, dados.cliente.email]) {
    if (campo) linhasCliente.push({ texto: campo, bold: false });
  }
  let py = y0 + 9.5;
  for (const l of linhasCliente.slice(0, 7)) {
    const estilo: Estilo = { fonte: 'helvetica', peso: l.bold ? 'bold' : 'normal', tamanho: l.bold ? 10.5 : 8.5 };
    const quebradas = motor.quebrarTexto(l.texto, larguraEsq, estilo, 1.25).linhas;
    for (const q of quebradas.slice(0, 2)) {
      motor.textoAbs(q, 16, py + estilo.tamanho * PT_MM * 0.78, estilo, l.bold ? COR_TEXTO : COR_CINZA);
      py += estilo.tamanho * 1.35 * PT_MM;
    }
  }

  // ---- coluna direita: pagamento ----
  let pyD = y0;
  if (linhasPag.length > 0) {
    motor.textoAbs('PAGAMENTO', xDir, y0 + 4, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, p.acentoTexto, { espacamentoLetras: 1.8 });
    pyD = y0 + 9.5;
    for (const linha of linhasPag) {
      const quebradas = motor.quebrarTexto(linha, larguraDir, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, 1.25).linhas;
      for (const q of quebradas.slice(0, 2)) {
        motor.textoAbs(q, xDir, pyD + 8.5 * PT_MM * 0.78, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, COR_TEXTO);
        pyD += 8.5 * 1.3 * PT_MM;
      }
    }
  }

  // filete sob o bloco
  const yFim = Math.max(py, pyD) + 4;
  motor.linha(16, yFim, motor.medidas.larguraPagina - motor.medidas.margens.dir, yFim, COR_HAIRLINE, 0.25);
  motor.y = yFim + 6;
}

// ============================================================
// TABELA DE ITENS — hairlines puras, sem preenchimentos
// ============================================================

function tabelaItens(motor: MotorPdf, dados: DadosPropostaPdf): void {
  motor.y += 2;
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
      fundoCabecalho: BRANCO, // sem preenchimento — hairlines puras
      corCabecalho: COR_CINZA, // labels discretos em uppercase
      corTexto: COR_TEXTO,
      corZebra: undefined,
      corBorda: COR_HAIRLINE,
      tamanho: 9,
      tamanhoCabecalho: 7.5,
      fonte: 'helvetica',
    },
  );
  motor.y += 2;
}

// ============================================================
// ÁREA INFERIOR — termos (esq.) + totais (dir.)
// ============================================================

function areaInferior(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const termos = (dados.observacoes || '').trim() || (
    `Proposta válida por ${dados.validadeDias ?? 15} dias a contar da data de emissão. `
    + 'Os valores estão expressos em Metiais (MZN), IVA à taxa legal em vigor.'
  );

  motor.garantirEspaco(46);
  const y0 = motor.y;
  const xTotais = 124;
  const larguraTotais = motor.medidas.larguraPagina - motor.medidas.margens.dir - xTotais;
  const larguraTermos = xTotais - motor.medidas.margens.esq - 10;

  // ---- totais (direita) — texto puro, régua de acento só no TOTAL ----
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

  // régua de acento + TOTAL — o momento de cor do documento
  motor.linha(xTotais, py + 1.6, xTotais + larguraTotais, py + 1.6, p.acento, 0.7);
  motor.textoAbs('TOTAL', xTotais, py + 8.4, { fonte: 'helvetica', peso: 'bold', tamanho: 10 }, COR_TEXTO, { espacamentoLetras: 1.5 });
  motor.textoAbs(formatarMZN(dados.totais.total), xTotais + larguraTotais, py + 9, { fonte: 'helvetica', peso: 'bold', tamanho: 15 }, COR_TEXTO, { alinhamento: 'right' });
  const fundoTotais = py + 13;

  // ---- termos (esquerda) ----
  motor.textoAbs('TERMOS E CONDIÇÕES', 16, y0 + 6, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, p.acentoTexto, { espacamentoLetras: 1.8 });
  motor.y = y0 + 9.5;
  motor.paragrafo(
    termos,
    { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 },
    COR_CINZA,
    { alinhamento: 'justify', entrelinha: 1.5, x: 16, largura: larguraTermos },
  );

  motor.y = Math.max(motor.y, fundoTotais) + 7;
}

// ============================================================
// SECÇÕES NARRATIVAS (conteúdo IA) — título + hairline, só tipografia
// ============================================================

function desenharSecoes(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(24);
    const y = motor.y;
    motor.textoAbs(seccao.titulo, 16, y + 4.4, { fonte: 'helvetica', peso: 'bold', tamanho: 11 }, COR_TEXTO);
    motor.linha(16, y + 7.6, motor.medidas.larguraPagina - motor.medidas.margens.dir, y + 7.6, COR_HAIRLINE, 0.25);
    motor.y = y + 12;
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: p.acentoTexto,
      tamanhoBase: 9.5,
      fonte: 'helvetica',
      entrelinha: 1.5,
    });
    motor.y += 3.5;
  }
}

// ============================================================
// ASSINATURAS — emitente / cliente, linhas simples
// ============================================================

function desenharAssinaturas(motor: MotorPdf, dados: DadosPropostaPdf): void {
  motor.garantirEspaco(32);
  motor.y += 9;
  const y = motor.y;
  const largura = 78;
  const configuracoes = [
    { x: 16, titulo: 'O EMITENTE', nome: dados.empresa.nome },
    { x: motor.medidas.larguraPagina - motor.medidas.margens.dir - largura, titulo: 'O CLIENTE', nome: dados.cliente.nome || dados.cliente.empresa || '' },
  ];
  for (const cfg of configuracoes) {
    motor.textoAbs(cfg.titulo, cfg.x, y + 2.5, { fonte: 'helvetica', peso: 'bold', tamanho: 6.5 }, COR_CINZA, { espacamentoLetras: 1.4 });
    motor.linha(cfg.x, y + 15, cfg.x + largura, y + 15, COR_HAIRLINE, 0.35);
    const nomeQuebrado = motor.quebrarTexto(cfg.nome, largura, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, 1.2).linhas;
    motor.textoAbs(nomeQuebrado[0] ?? cfg.nome, cfg.x, y + 19.5, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, COR_TEXTO);
  }
  motor.y = y + 24;
}

// ============================================================
// CABEÇALHO DE CONTINUAÇÃO (páginas 2+)
// ============================================================

function cabecalhoContinuacao(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.textoAbs(dados.empresa.nome.toUpperCase(), 16, 11, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, COR_CINZA, { espacamentoLetras: 1.2 });
  motor.textoAbs(`Nº ${dados.numero || 'S/N'}`, motor.medidas.larguraPagina - motor.medidas.margens.dir, 11, { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, COR_CINZA, { alinhamento: 'right' });
  motor.linha(16, 13.5, motor.medidas.larguraPagina - motor.medidas.margens.dir, 13.5, COR_HAIRLINE, 0.25);
  motor.rect(16, 13.1, 10, 0.8, p.acento);
}

// ============================================================
// RODAPÉ — hairline + micro-marca de cor + contactos + paginação
// ============================================================

function rodape(motor: MotorPdf, dados: DadosPropostaPdf, i: number, total: number, p: Paleta): void {
  const yLinha = motor.medidas.alturaPagina - 15;
  motor.linha(16, yLinha, motor.medidas.larguraPagina - motor.medidas.margens.dir, yLinha, COR_HAIRLINE, 0.25);
  motor.rect(16, yLinha - 0.4, 10, 0.9, p.acento);

  const esquerda = [
    dados.empresa.nome,
    dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '',
  ].filter(Boolean).join('  ·  ');
  if (esquerda) {
    motor.textoAbs(esquerda, 16, yLinha + 4.5, { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, COR_CINZA);
  }
  const direita = [dados.empresa.email, dados.empresa.telefone].filter(Boolean).join('  ·  ');
  if (direita) {
    motor.textoAbs(direita, motor.medidas.larguraPagina - motor.medidas.margens.dir, yLinha + 4.5, { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, COR_CINZA, { alinhamento: 'right' });
  }
  if (total > 1) {
    motor.textoAbs(`Página ${i} de ${total}`, motor.medidas.larguraPagina / 2, yLinha + 4.5, { fonte: 'helvetica', peso: 'normal', tamanho: 6.5 }, COR_CINZA, { alinhamento: 'center' });
  }
}
