// ============================================================
// Template PDF 1 — "Executivo Moderno"
//
// Design corporativo contemporâneo:
//   - Capa com banda superior em gradiente (derivado da cor da
//     marca), geometria decorativa em opacidade e chip do nº
//   - Cartões de dados Cliente/Emitente e cartão financeiro
//     de total destacado
//   - Cabeçalho fino nas páginas de conteúdo, secções numeradas
//     em chips, tabela zebra, totais com barra de destaque
//   - Rodapé com paginação
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf, ItemPdf } from './tipos';
import { clarear, escurecer, formatarDataLonga, formatarMZN, formatarQuantidade, hexToRgb, luminancia, medirLogotipo } from './utils';

const COR_TEXTO: Cor = [30, 41, 59];
const COR_CINZA: Cor = [100, 116, 139];
const COR_CINZA_CLARO: Cor = [148, 163, 184];
const COR_HAIRLINE: Cor = [226, 232, 240];
const COR_ZEBRA: Cor = [241, 245, 249];
const COR_CARTAO: Cor = [241, 245, 249];
const BRANCO: Cor = [255, 255, 255];

interface Paleta {
  primaria: Cor;
  escura: Cor;
  clara: Cor;
  /** texto legível sobre a cor primária */
  sobrePrimaria: Cor;
  hexPrimaria: string;
}

function construirPaleta(hexCor: string | undefined): Paleta {
  const hex = hexCor && /^#[0-9a-fA-F]{3,6}$/.test(hexCor) ? hexCor : '#0F4C81';
  const primaria = hexToRgb(hex);
  return {
    primaria,
    escura: escurecer(hex, 0.35),
    clara: clarear(hex, 0.90),
    sobrePrimaria: luminancia(hex) > 0.55 ? COR_TEXTO : BRANCO,
    hexPrimaria: hex,
  };
}

const PT_MM = 0.352778;

export function desenharExecutivo(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 16, dir: 16, topo: 26, baixo: 20 });
  const p = construirPaleta(dados.empresa.corPrimaria);

  desenharCapa(motor, dados, p);

  motor.aoIniciarPagina = (m) => cabecalhoPaginaConteudo(m, dados, p);
  motor.novaPagina();

  desenharConteudo(motor, dados, p);

  motor.aplicarRodapes((m, i, total) => rodape(m, dados, i, total, p));
  return motor;
}

// ============================================================
// CAPA
// ============================================================

function desenharCapa(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const { doc } = motor;
  const L = motor.medidas.larguraPagina;
  const alturaBanda = 108;

  // ---- banda em gradiente (36 faixas interpoladas) ----
  const faixas = 36;
  for (let i = 0; i < faixas; i++) {
    const t = i / (faixas - 1);
    const cor: Cor = [
      Math.round(p.escura[0] + (p.primaria[0] - p.escura[0]) * t),
      Math.round(p.escura[1] + (p.primaria[1] - p.escura[1]) * t),
      Math.round(p.escura[2] + (p.primaria[2] - p.escura[2]) * t),
    ];
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.rect(0, (alturaBanda / faixas) * i, L, alturaBanda / faixas + 0.15, 'F');
  }

  // ---- geometria decorativa (opacidade) ----
  doc.setGState(doc.GState({ opacity: 0.14 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.4);
  doc.circle(L - 32, 18, 46, 'S');
  doc.setLineWidth(0.7);
  doc.circle(L - 32, 18, 34, 'S');
  doc.setGState(doc.GState({ opacity: 0.10 }));
  doc.setFillColor(255, 255, 255);
  doc.circle(L - 58, 92, 20, 'F');
  doc.setGState(doc.GState({ opacity: 0.12 }));
  doc.circle(24, 96, 7, 'F');
  // pingo de acento no anel
  doc.setGState(doc.GState({ opacity: 0.45 }));
  doc.circle(L - 32 + 46 * Math.cos(-0.6), 18 + 46 * Math.sin(-0.6), 2.2, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  // ---- identidade (chip branco com logotipo) ----
  const yIdentidade = 16;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 30, 16);
    if (logo) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(16, yIdentidade, 36, 20, 2, 2, 'F');
      try {
        doc.addImage(
          dados.empresa.logotipo,
          logo.formato,
          16 + (36 - logo.largura) / 2,
          yIdentidade + (20 - logo.altura) / 2,
          logo.largura,
          logo.altura,
        );
      } catch { /* logotipo inválido → segue sem imagem */ }
    }
  }
  if (!dados.empresa.logotipo) {
    const nomeEmpresa = motor.quebrarTexto(dados.empresa.nome.toUpperCase(), 100, { fonte: 'helvetica', peso: 'bold', tamanho: 14 }, 1.2).linhas[0] ?? '';
    motor.textoAbs(nomeEmpresa, 16, yIdentidade + 7.5, { fonte: 'helvetica', peso: 'bold', tamanho: 14 }, BRANCO, { espacamentoLetras: 0.8 });
    if (dados.empresa.nuit) {
      motor.textoAbs(`NUIT ${dados.empresa.nuit}`, 16, yIdentidade + 13, { fonte: 'helvetica', peso: 'normal', tamanho: 8 }, [203, 213, 225]);
    }
  }

  // ---- rótulo e título ----
  motor.textoAbs(dados.titulo.toUpperCase(), 16, 54, { fonte: 'helvetica', peso: 'bold', tamanho: 9.5 }, BRANCO, { espacamentoLetras: 1.6 });

  const nomeCliente = dados.cliente.empresa || dados.cliente.nome || 'Cliente';
  const estiloTitulo: Estilo = { fonte: 'helvetica', peso: 'bold', tamanho: 23 };
  const linhasTitulo = motor.quebrarTexto(nomeCliente, 145, estiloTitulo, 1.15).linhas;
  let yTitulo = 64;
  for (const linha of linhasTitulo.slice(0, 2)) {
    motor.textoAbs(linha, 16, yTitulo, estiloTitulo, BRANCO);
    yTitulo += 23 * 1.15 * PT_MM;
  }

  // barra de acento
  motor.rect(16, yTitulo + 1.5, 28, 2.4, BRANCO);

  // ---- zona inferior da banda: destinatário (esq.) + número/data (dir.) ----
  motor.textoAbs('Preparada para', 16, 93, { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 }, [219, 228, 238], { espacamentoLetras: 0.6 });
  motor.textoAbs(dados.cliente.nome || '', 16, 99.5, { fonte: 'helvetica', peso: 'bold', tamanho: 11 }, BRANCO);
  motor.textoAbs(`N. ${dados.numero}`, 194, 93, { fonte: 'helvetica', peso: 'bold', tamanho: 9.5 }, BRANCO, { alinhamento: 'right' });
  motor.textoAbs(formatarDataLonga(dados.data), 194, 99.5, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, [203, 213, 225], { alinhamento: 'right' });

  // ---- cartões cliente / emitente ----
  const yCartoes = 124;
  const cartaoL = 84, cartaoA = 44;
  desenharCartaoDados(motor, 16, yCartoes, cartaoL, cartaoA, 'CLIENTE', [
    dados.cliente.nome,
    dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome ? dados.cliente.empresa : '',
    dados.cliente.nuit ? `NUIT: ${dados.cliente.nuit}` : '',
    dados.cliente.telefone || '',
    dados.cliente.email || '',
    dados.cliente.endereco || '',
  ], p);
  desenharCartaoDados(motor, 110, yCartoes, cartaoL, cartaoA, 'EMITENTE', [
    dados.empresa.nome,
    dados.empresa.nuit ? `NUIT: ${dados.empresa.nuit}` : '',
    dados.empresa.endereco || '',
    dados.empresa.telefone || dados.empresa.email || '',
  ], p);

  // ---- cartão financeiro (cotação) ou nota narrativa (Doc A) ----
  const yFinanceiro = 180;
  if (dados.mostrarFinanceiro) {
    doc.setFillColor(p.primaria[0], p.primaria[1], p.primaria[2]);
    doc.roundedRect(16, yFinanceiro, 178, 36, 3, 3, 'F');
    doc.setGState(doc.GState({ opacity: 0.16 }));
    doc.setFillColor(255, 255, 255);
    doc.circle(180, yFinanceiro + 34, 26, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));

    motor.textoAbs('TOTAL DO INVESTIMENTO', 24, yFinanceiro + 10, { fonte: 'helvetica', peso: 'bold', tamanho: 8.5 }, p.sobrePrimaria, { espacamentoLetras: 1.4 });
    const resumo = [
      `${dados.itens.length} ${dados.itens.length === 1 ? 'item' : 'itens'}`,
      dados.totais.iva > 0 ? `IVA ${formatarQuantidade(dados.totais.ivaPercentual)}%` : '',
      dados.totais.desconto > 0 ? 'Desconto aplicado' : '',
    ].filter(Boolean).join('   ·   ');
    motor.textoAbs(resumo, 24, yFinanceiro + 16, { fonte: 'helvetica', peso: 'normal', tamanho: 8 }, p.sobrePrimaria);
    motor.textoAbs(formatarMZN(dados.totais.total), 190, yFinanceiro + 24, { fonte: 'helvetica', peso: 'bold', tamanho: 20 }, p.sobrePrimaria, { alinhamento: 'right' });
  } else if (dados.seccoes.length > 0) {
    motor.rect(16, yFinanceiro, 2.4, 30, p.primaria);
    motor.textoAbs('PROPOSTA COMERCIAL NARRATIVA', 24, yFinanceiro + 7, { fonte: 'helvetica', peso: 'bold', tamanho: 8 }, p.primaria, { espacamentoLetras: 1.2 });
    motor.textoAbs(`${dados.seccoes.length} secções de conteúdo estruturado`, 24, yFinanceiro + 13, { fonte: 'helvetica', peso: 'normal', tamanho: 9.5 }, COR_CINZA);
    if (dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome) {
      motor.textoAbs(dados.cliente.empresa, 24, yFinanceiro + 19.5, { fonte: 'helvetica', peso: 'normal', tamanho: 9.5 }, COR_CINZA);
    }
  }

  // ---- validade ----
  if (dados.validadeDias && dados.validadeDias > 0) {
    const yValidade = 232;
    doc.setFillColor(p.primaria[0], p.primaria[1], p.primaria[2]);
    doc.roundedRect(16, yValidade, 3.4, 3.4, 0.6, 0.6, 'F');
    motor.textoAbs(
      `Validade da proposta: ${dados.validadeDias} dias a contar da data de emissão.`,
      24, yValidade + 3, { fonte: 'helvetica', peso: 'normal', tamanho: 9 }, COR_CINZA,
    );
  }
}

function desenharCartaoDados(
  motor: MotorPdf, x: number, y: number, largura: number, altura: number,
  rotulo: string, linhas: string[], p: Paleta,
): void {
  motor.rect(x, y, largura, altura, COR_CARTAO, 'F', 2.5);
  motor.textoAbs(rotulo, x + 6, y + 8, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, p.primaria, { espacamentoLetras: 1.5 });
  const conteudo = linhas.filter(Boolean).slice(0, 5);
  let py = y + 15;
  motor.textoAbs(conteudo[0] || '', x + 6, py, { fonte: 'helvetica', peso: 'bold', tamanho: 10.5 }, COR_TEXTO);
  py += 5.6;
  for (const linha of conteudo.slice(1)) {
    const estilo: Estilo = { fonte: 'helvetica', peso: 'normal', tamanho: 8.5 };
    const quebradas = motor.quebrarTexto(linha, largura - 12, estilo, 1.25);
    for (const q of quebradas.linhas.slice(0, 2)) {
      motor.textoAbs(q, x + 6, py, estilo, COR_CINZA);
      py += 8.5 * 1.25 * PT_MM;
    }
  }
}

// ============================================================
// CONTEÚDO
// ============================================================

function cabecalhoPaginaConteudo(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.rect(16, 10, 4.2, 4.2, p.primaria, 'F', 0.8);
  motor.textoAbs(`PROPOSTA ${dados.numero}`, 23.5, 13.4, { fonte: 'helvetica', peso: 'bold', tamanho: 7.5 }, COR_CINZA, { espacamentoLetras: 1.2 });
  motor.textoAbs(dados.empresa.nome.toUpperCase(), 194, 13.4, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, COR_CINZA_CLARO, { alinhamento: 'right', espacamentoLetras: 0.8 });
  motor.linha(16, 17.5, 194, 17.5, COR_HAIRLINE, 0.2);
}

function desenharConteudo(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  let numeroSecao = 1;

  // ---- secção financeira (cotação) ----
  if (dados.mostrarFinanceiro) {
    cabecalhoSecao(motor, numeroSecao, 'Investimento Proposto', p);
    tabelaItens(motor, dados.itens, p);
    blocoTotais(motor, dados, p);
    motor.y += 6;
    numeroSecao++;
  }

  // ---- secções narrativas ----
  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(24);
    cabecalhoSecao(motor, numeroSecao, seccao.titulo, p);
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: p.primaria,
      tamanhoBase: 10,
      fonte: 'helvetica',
      entrelinha: 1.55,
    });
    motor.y += 4;
    numeroSecao++;
  }

  // ---- observações ----
  if (dados.observacoes?.trim()) {
    motor.garantirEspaco(26);
    cabecalhoSecao(motor, numeroSecao, 'Observações', p);
    const alturaEstimada = motor.quebrarTexto(dados.observacoes, 160, { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 }, 1.4).alturaMm + 10;
    motor.garantirEspaco(alturaEstimada);
    const yObs = motor.y;
    motor.rect(16, yObs, 178, alturaEstimada, COR_ZEBRA, 'F', 2);
    motor.rect(16, yObs, 2.2, alturaEstimada, p.primaria, 'F');
    motor.y += 5;
    motor.paragrafo(dados.observacoes, { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 }, COR_CINZA, {
      alinhamento: 'justify', entrelinha: 1.4, x: 22, largura: 166,
    });
    motor.y += 4;
    numeroSecao++;
  }

  // ---- dados de pagamento ----
  const pag = dados.pagamento;
  const camposPagamento: Array<[string, string]> = [
    pag?.banco ? ['Banco', pag.banco] : null,
    pag?.conta ? ['Conta', pag.conta] : null,
    pag?.nib ? ['NIB', pag.nib] : null,
    pag?.mpesa ? ['M-Pesa', pag.mpesa] : null,
    pag?.emola ? ['e-Mola', pag.emola] : null,
    pag?.mkesh ? ['mKesh', pag.mkesh] : null,
  ].filter(Boolean) as Array<[string, string]>;

  if (camposPagamento.length > 0) {
    motor.garantirEspaco(26);
    cabecalhoSecao(motor, numeroSecao, 'Dados para Pagamento', p);
    const larguraCartao = 178 / Math.min(camposPagamento.length, 3) - 4;
    let px = 16;
    for (const [rotulo, valor] of camposPagamento) {
      if (px + larguraCartao > 194) { px = 16; motor.y += 18; motor.garantirEspaco(16); }
      const yCartao = motor.y;
      motor.rect(px, yCartao, larguraCartao, 14, COR_CARTAO, 'F', 2);
      motor.textoAbs(rotulo.toUpperCase(), px + 5, yCartao + 5.4, { fonte: 'helvetica', peso: 'bold', tamanho: 6.5 }, p.primaria, { espacamentoLetras: 1 });
      motor.textoAbs(valor, px + 5, yCartao + 10.8, { fonte: 'helvetica', peso: 'bold', tamanho: 8.5 }, COR_TEXTO);
      px += larguraCartao + 4;
    }
    motor.y += 20;
    numeroSecao++;
  }

  // ---- assinaturas ----
  desenharAssinaturas(motor, dados, p);
}

function cabecalhoSecao(motor: MotorPdf, numero: number, titulo: string, p: Paleta): void {
  motor.garantirEspaco(16);
  const y = motor.y;
  motor.rect(16, y, 7, 7, p.primaria, 'F', 1.4);
  motor.textoAbs(String(numero), 19.5, y + 5.2, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, p.sobrePrimaria, { alinhamento: 'center' });
  motor.textoAbs(titulo, 27, y + 5.4, { fonte: 'helvetica', peso: 'bold', tamanho: 13 }, COR_TEXTO);
  motor.linha(16, y + 10.5, 194, y + 10.5, COR_HAIRLINE, 0.2);
  motor.y = y + 14.5;
}

function tabelaItens(motor: MotorPdf, itens: ItemPdf[], p: Paleta): void {
  motor.y += 2;
  if (itens.length === 0) {
    motor.paragrafo('(Sem itens registados nesta proposta.)', { fonte: 'helvetica', peso: 'italic', tamanho: 9.5 }, COR_CINZA);
    motor.y += 3;
    return;
  }
  motor.tabela(
    [
      { cabecalho: 'Descrição', fracao: 0.46, alinhamento: 'left' },
      { cabecalho: 'Qtd', fracao: 0.12, alinhamento: 'center' },
      { cabecalho: 'Preço Unit.', fracao: 0.21, alinhamento: 'right' },
      { cabecalho: 'Subtotal', fracao: 0.21, alinhamento: 'right' },
    ],
    itens.map(item => [
      item.nome,
      formatarQuantidade(item.quantidade),
      formatarMZN(item.precoUnitario),
      formatarMZN(item.subtotal),
    ]),
    {
      fundoCabecalho: p.primaria,
      corCabecalho: p.sobrePrimaria,
      corTexto: COR_TEXTO,
      corZebra: COR_ZEBRA,
      corBorda: COR_HAIRLINE,
      tamanho: 9,
      tamanhoCabecalho: 8,
      fonte: 'helvetica',
    },
  );
}

function blocoTotais(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const linhas: Array<[string, string]> = [
    ['Subtotal', formatarMZN(dados.totais.subtotal)],
  ];
  if (dados.totais.desconto > 0) {
    linhas.push([`Desconto${dados.totais.descontoLabel ? ` (${dados.totais.descontoLabel})` : ''}`, `- ${formatarMZN(dados.totais.desconto)}`]);
  }
  if (dados.totais.iva > 0 || dados.totais.ivaPercentual > 0) {
    linhas.push([`IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%)`, formatarMZN(dados.totais.iva)]);
  }

  const alturaBloco = linhas.length * 5.6 + 14;
  motor.garantirEspaco(alturaBloco);

  const x = 114, largura = 80;
  motor.y += 3;
  let py = motor.y;
  for (const [rotulo, valor] of linhas) {
    motor.textoAbs(rotulo, x, py + 3.2, { fonte: 'helvetica', peso: 'normal', tamanho: 9 }, COR_CINZA);
    motor.textoAbs(valor, x + largura, py + 3.2, { fonte: 'helvetica', peso: 'normal', tamanho: 9 }, COR_TEXTO, { alinhamento: 'right' });
    py += 5.6;
  }

  // barra do total
  motor.rect(x, py + 1, largura, 12.5, p.primaria, 'F', 1.8);
  motor.textoAbs('TOTAL', x + 5, py + 8.8, { fonte: 'helvetica', peso: 'bold', tamanho: 9 }, p.sobrePrimaria, { espacamentoLetras: 1.2 });
  motor.textoAbs(formatarMZN(dados.totais.total), x + largura - 5, py + 9.2, { fonte: 'helvetica', peso: 'bold', tamanho: 12 }, p.sobrePrimaria, { alinhamento: 'right' });
  motor.y = py + 19;
}

function desenharAssinaturas(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  motor.garantirEspaco(34);
  motor.y += 8;
  const y = motor.y;
  const configuracoes: Array<{ x: number; titulo: string; nome: string }> = [
    { x: 16, titulo: 'O EMITENTE', nome: dados.empresa.nome },
    { x: 116, titulo: 'O CLIENTE', nome: dados.cliente.nome || dados.cliente.empresa || '' },
  ];
  for (const cfg of configuracoes) {
    motor.doc.setDrawColor(COR_HAIRLINE[0], COR_HAIRLINE[1], COR_HAIRLINE[2]);
    motor.doc.setLineWidth(0.25);
    motor.doc.setLineDashPattern([1.6, 1.4], 0);
    motor.doc.roundedRect(cfg.x, y, 78, 20, 2, 2, 'S');
    motor.doc.setLineDashPattern([], 0);
    motor.linha(cfg.x + 8, y + 14.5, cfg.x + 70, y + 14.5, COR_CINZA_CLARO, 0.3);
    motor.textoAbs(cfg.titulo, cfg.x + 39, y + 5.5, { fonte: 'helvetica', peso: 'bold', tamanho: 6.5 }, p.primaria, { alinhamento: 'center', espacamentoLetras: 1.2 });
    motor.textoAbs(cfg.nome, cfg.x + 39, y + 18.8, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, COR_CINZA, { alinhamento: 'center' });
  }
  motor.y = y + 24;
}

// ============================================================
// RODAPÉ
// ============================================================

function rodape(motor: MotorPdf, dados: DadosPropostaPdf, i: number, total: number, p: Paleta): void {
  if (i === 1) {
    // capa: linha de contacto centrada
    const contacto = [
      dados.empresa.nome,
      dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '',
      dados.empresa.email || dados.empresa.telefone || '',
    ].filter(Boolean).join('   ·   ');
    motor.textoAbs(contacto, 105, 286, { fonte: 'helvetica', peso: 'normal', tamanho: 7.5 }, COR_CINZA_CLARO, { alinhamento: 'center' });
    return;
  }
  motor.linha(16, 284, 194, 284, COR_HAIRLINE, 0.2);
  motor.rect(16, 283.2, 14, 1.6, p.primaria, 'F');
  const ladoEsq = dados.empresa.nome;
  motor.textoAbs(ladoEsq, 16, 288.5, { fonte: 'helvetica', peso: 'bold', tamanho: 7 }, COR_CINZA);
  motor.textoAbs(`Página ${i} de ${total}`, 194, 288.5, { fonte: 'helvetica', peso: 'normal', tamanho: 7 }, COR_CINZA_CLARO, { alinhamento: 'right' });
}
