// ============================================================
// Template PDF 6 — "Beleza Natura (Elegância Premium)"
//
// Réplica VISUAL DATA-DRIVEN do layout de referência «beleza
// natural» (proposta comercial de cosmética). A imagem define
// COMO o documento parece; o PropostaJá define DE ONDE cada
// informação vem. MODELO PAGO (restrito): disponível apenas por
// atribuição do superadmin (organization_templates).
//
// IDENTIDADE (fixa por design — faz parte do template):
//   A4 vertical, folha creme, faixa de cabeçalho rosa pálido,
//   dourado como cor de título/realce, borgonha nos títulos de
//   secção, tabela com cabeçalho rosado, cartões arredondados
//   (condições em rosa, resumo com moldura dourada), botões
//   M-Pesa/e-Mola e banda de rodapé dourada escura.
//
// DADOS (100% dinâmicos — NENHUM valor comercial hardcoded):
//   - Empresa/cliente/número/data/itens/totais: modelo normal
//     (DadosPropostaPdf) — motor financeiro intacto.
//   - Slogan (subtítulo do hero): camposPersonalizados.slogan.
//   - Localidade do cliente: cliente.endereco → cidade/país da
//     org (custom fields) — precedência §18, nunca inventar.
//   - Condições: derivadas de validadeDias, IVA, desconto e
//     observações reais da proposta (condicoesDaProposta).
//   - Botões M-Pesa/e-Mola: pagamento estruturado da org
//     (metodosMobileMoney) — sem método, sem botão.
//
// REGRAS DE OCULTAÇÃO (§11/§12): campo disponível → mostrar;
// sem campo → SEM fallback fictício → o bloco/linha desaparece
// de forma elegante.
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf } from './tipos';
import {
  formatarDataCurta,
  formatarMZNCompacto,
  formatarQuantidade,
  medirLogotipo,
} from './utils';

const PT_MM = 0.352778;

// ---- Paleta da referência (design do template) ----
/** Creme quente da folha (#FDF8F5) */
const FUNDO_CREME: Cor = [253, 248, 245];
/** Rosa pálido da faixa de cabeçalho (#F4E0D8) */
const ROSA_HEADER: Cor = [244, 224, 216];
/** Rosa do cabeçalho da tabela (#FADADD) */
const ROSA_TABELA: Cor = [250, 218, 221];
/** Rosa claríssimo do cartão de condições (#FEF0F0) */
const ROSA_CAIXA: Cor = [254, 240, 240];
/** Dourado antigo do título e realces (#B8860B) */
const DOURADO: Cor = [184, 134, 11];
/** Dourado escuro da banda de rodapé (#8B6914) */
const DOURADO_ESCURO: Cor = [139, 105, 20];
/** Dourado claro das réguas ornamentais (#D4AF37) */
const DOURADO_CLARO: Cor = [212, 175, 55];
/** Borgonha dos títulos de secção (#800020) */
const BORGONHA: Cor = [128, 0, 32];
/** Vermelho escuro do TOTAL (#A91B0D) */
const COR_TOTAL: Cor = [169, 27, 13];
/** Verde M-Pesa (#00A651) */
const VERDE_MPESA: Cor = [0, 166, 81];
/** Laranja e-Mola (#F37021) */
const LARANJA_EMOLA: Cor = [243, 112, 33];
const COR_TEXTO: Cor = [51, 51, 51];
const COR_CINZA: Cor = [102, 102, 102];
const COR_HEADER_TABELA: Cor = [68, 68, 68];
const HAIRLINE: Cor = [228, 214, 216];
const BRANCO: Cor = [255, 255, 255];

/** Altura da faixa de cabeçalho rosa (mm) */
const ALTURA_FAIXA_HEADER = 38;
/** Banda de agradecimento no fundo de cada página (mm) */
const ALTURA_BANDA_RODAPE = 16;

const FONTE: Estilo['fonte'] = 'helvetica';

// ============================================================
// Ponto de entrada
// ============================================================

export function desenharBelezaNatura(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 16, dir: 16, topo: 18, baixo: 24 });

  // páginas 2+: fundo creme + mini-cabeçalho de continuação
  motor.aoIniciarPagina = m => paginaContinuacao(m, dados);

  // página 1: fundo creme PRIMEIRO (fica atrás de todo o conteúdo)
  fundoCreme(motor);

  faixaCabecalho(motor, dados); // posições absolutas (não move o cursor)
  motor.y = ALTURA_FAIXA_HEADER + 8;

  hero(motor, dados);
  detalhesCliente(motor, dados);
  divisorOrnamental(motor);

  if (dados.mostrarFinanceiro) {
    listaProdutos(motor, dados);
    areaInferior(motor, dados);
  } else {
    observacoesBloco(motor, dados);
  }

  seccoesNarrativas(motor, dados);

  if (!dados.mostrarFinanceiro && dados.seccoes.length === 0) {
    motor.garantirEspaco(20);
    motor.paragrafo(
      '(Documento sem conteúdo financeiro ou narrativo registado.)',
      { fonte: FONTE, peso: 'italic', tamanho: 9.5 },
      COR_CINZA,
    );
  }

  motor.aplicarRodapes((m, i, total) => bandaRodape(m, dados, i, total));
  return motor;
}

// ============================================================
// FUNDO + CABEÇALHO — folha creme; faixa rosa com logo/NUIT
// à esquerda e caixa de validade/número à direita.
// ============================================================

function fundoCreme(motor: MotorPdf): void {
  motor.rect(0, 0, motor.medidas.larguraPagina, motor.medidas.alturaPagina, FUNDO_CREME);
}

function faixaCabecalho(motor: MotorPdf, dados: DadosPropostaPdf): void {
  motor.rect(0, 0, motor.medidas.larguraPagina, ALTURA_FAIXA_HEADER, ROSA_HEADER);

  // ---- logótipo (canto superior esquerdo) ----
  let xNome = motor.medidas.margens.esq; // 16
  let temLogo = false;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 34, 18);
    if (logo) {
      try {
        motor.doc.addImage(dados.empresa.logotipo, logo.formato, 16, 10, logo.largura, logo.altura);
        temLogo = true;
        xNome = 16 + logo.largura + 4;
      } catch { /* logótipo inválido → fallback textual */ }
    }
  }

  // ---- nome da empresa + NUIT (junto ao logótipo) ----
  if (!temLogo) {
    motor.textoAbs(
      motor.quebrarTexto(dados.empresa.nome, 100, { fonte: FONTE, peso: 'bold', tamanho: 13 }, 1.15).linhas[0] ?? dados.empresa.nome,
      16, 22, { fonte: FONTE, peso: 'bold', tamanho: 13 }, COR_TEXTO,
    );
    if (dados.empresa.nuit) {
      motor.textoAbs(`NUIT ${dados.empresa.nuit}`, 16, 28, { fonte: FONTE, peso: 'normal', tamanho: 8 }, COR_CINZA);
    }
  } else {
    const nome = motor.quebrarTexto(dados.empresa.nome || '', xNome > 40 ? 90 : 120, { fonte: FONTE, peso: 'bold', tamanho: 11 }, 1.15).linhas[0] ?? '';
    if (nome) motor.textoAbs(nome, xNome, 19, { fonte: FONTE, peso: 'bold', tamanho: 11 }, COR_TEXTO);
    const nuit = dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '';
    if (nuit) motor.textoAbs(nuit, xNome, 24.5, { fonte: FONTE, peso: 'normal', tamanho: 8 }, COR_CINZA);
    if (dados.empresa.endereco) {
      motor.textoAbs(dados.empresa.endereco, xNome, 29.5, { fonte: FONTE, peso: 'normal', tamanho: 7.5 }, COR_CINZA);
    }
  }

  // ---- caixa de validade / número (canto superior direito) ----
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir; // 194
  const larguraCaixa = 58;
  const xCaixa = x1 - larguraCaixa;
  motor.doc.setDrawColor(DOURADO[0], DOURADO[1], DOURADO[2]);
  motor.doc.setLineWidth(0.35);
  motor.doc.roundedRect(xCaixa, 9, larguraCaixa, 20, 2.5, 2.5, 'S');

  const linha1 = dados.validadeDias
    ? `Válida por ${formatarQuantidade(dados.validadeDias)} dias`
    : `Proposta Nº ${dados.numero || 'S/N'}`;
  motor.textoAbs(linha1, xCaixa + larguraCaixa / 2, 16.5, { fonte: FONTE, peso: 'bold', tamanho: 9 }, DOURADO_ESCURO, { alinhamento: 'center' });
  const linha2 = dados.validadeDias
    ? `Emitida em: ${formatarDataCurta(dados.data)}`
    : formatarDataCurta(dados.data);
  motor.textoAbs(linha2, xCaixa + larguraCaixa / 2, 23, { fonte: FONTE, peso: 'normal', tamanho: 7.5 }, COR_CINZA, { alinhamento: 'center' });
}

// ============================================================
// HERO — «PROPOSTA COMERCIAL» dourado espaçado + slogan.
// ============================================================

function hero(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const titulo = (dados.titulo || 'Proposta Comercial').toUpperCase();
  motor.textoAbs(
    titulo,
    motor.medidas.larguraPagina / 2,
    motor.y + 7,
    { fonte: FONTE, peso: 'bold', tamanho: 19 },
    DOURADO,
    { alinhamento: 'center', espacamentoLetras: 2 },
  );
  motor.y += 10.5;

  const slogan = (dados.camposPersonalizados?.slogan || '').trim();
  if (slogan) {
    motor.textoAbs(
      slogan,
      motor.medidas.larguraPagina / 2,
      motor.y + 4.5,
      { fonte: FONTE, peso: 'italic', tamanho: 10 },
      BORGONHA,
      { alinhamento: 'center' },
    );
    motor.y += 9;
  } else {
    motor.y += 4;
  }
}

// ============================================================
// DETALHES DO CLIENTE — linhas etiquetadas (rótulo cinza +
// valor bold). Sem dado → linha omitida (regra de ocultação).
// ============================================================

function detalhesCliente(motor: MotorPdf, dados: DadosPropostaPdf): void {
  motor.garantirEspaco(30);
  motor.textoAbs(
    'DETALHES DO CLIENTE:',
    motor.medidas.margens.esq,
    motor.y + 3.5,
    { fonte: FONTE, peso: 'bold', tamanho: 10 },
    BORGONHA,
    { espacamentoLetras: 1 },
  );
  motor.y += 8;

  const campos = dados.camposPersonalizados ?? {};
  const localidade = dados.cliente.endereco
    || [campos.cidade, campos.pais].filter(Boolean).join(' • ');

  const linhas: Array<[string, string]> = [];
  if (dados.cliente.nome) linhas.push(['Cliente:', dados.cliente.nome]);
  if (dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome) {
    linhas.push(['Empresa:', dados.cliente.empresa]);
  }
  if (dados.cliente.telefone) linhas.push(['Contacto:', dados.cliente.telefone]);
  if (localidade) linhas.push(['Localidade:', localidade]);

  for (const [rotulo, valor] of linhas) {
    motor.garantirEspaco(6);
    const y = motor.y + 3.2;
    motor.textoAbs(rotulo, motor.medidas.margens.esq, y, { fonte: FONTE, peso: 'normal', tamanho: 9 }, COR_CINZA);
    motor.textoAbs(valor, motor.medidas.margens.esq + 22, y, { fonte: FONTE, peso: 'bold', tamanho: 9 }, COR_TEXTO);
    motor.y += 6;
  }
  motor.y += 2;
}

// ============================================================
// DIVISOR ORNAMENTAL — linha dourada com ponto central.
// ============================================================

function divisorOrnamental(motor: MotorPdf): void {
  motor.garantirEspaco(8);
  const y = motor.y + 2;
  const cx = motor.medidas.larguraPagina / 2;
  const x0 = motor.medidas.margens.esq;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  motor.linha(x0, y, cx - 3.5, y, DOURADO_CLARO, 0.4);
  motor.linha(cx + 3.5, y, x1, y, DOURADO_CLARO, 0.4);
  motor.doc.setFillColor(DOURADO_CLARO[0], DOURADO_CLARO[1], DOURADO_CLARO[2]);
  motor.doc.circle(cx, y, 1, 'F');
  motor.y += 7;
}

// ============================================================
// LISTA DE PRODUTOS — cabeçalho rosado, nome bold multi-linha,
// quantidade a 2 dígitos, preço da linha (subtotal) à direita.
// Desenho próprio (o motor.tabela não suporta bold só no nome).
// ============================================================

function listaProdutos(motor: MotorPdf, dados: DadosPropostaPdf): void {
  motor.garantirEspaco(26);
  motor.textoAbs(
    'LISTA DE PRODUTOS',
    motor.medidas.margens.esq,
    motor.y + 3.5,
    { fonte: FONTE, peso: 'bold', tamanho: 10 },
    BORGONHA,
    { espacamentoLetras: 1 },
  );
  motor.y += 8;

  if (dados.itens.length === 0) {
    motor.paragrafo('(Sem itens registados nesta proposta.)', { fonte: FONTE, peso: 'italic', tamanho: 9.5 }, COR_CINZA);
    motor.y += 3;
    return;
  }

  const x0 = motor.medidas.margens.esq;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  const larguraTotal = x1 - x0;
  // colunas da referência: Descrição | Qtd | Preço (MZN)
  const fracoes = [0.62, 0.13, 0.25];
  const alinhamentos: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
  const cabecalhos = ['DESCRIÇÃO DO PRODUTO', 'QTD', 'PREÇO (MZN)'];
  const larguras = fracoes.map(f => f * larguraTotal);
  const padX = 2.5;

  const desenharCabecalho = (): void => {
    motor.rect(x0, motor.y, larguraTotal, 7.5, ROSA_TABELA);
    let px = x0;
    for (let ci = 0; ci < 3; ci++) {
      const xTexto = alinhamentos[ci] === 'right'
        ? px + larguras[ci] - padX
        : alinhamentos[ci] === 'center'
          ? px + larguras[ci] / 2
          : px + padX;
      motor.textoAbs(cabecalhos[ci], xTexto, motor.y + 5, { fonte: FONTE, peso: 'bold', tamanho: 7.5 }, COR_HEADER_TABELA, {
        alinhamento: alinhamentos[ci],
      });
      px += larguras[ci];
    }
    motor.y += 7.5;
  };

  desenharCabecalho();

  for (const item of dados.itens) {
    const estiloNome: Estilo = { fonte: FONTE, peso: 'bold', tamanho: 9 };
    const partesNome = motor.quebrarTexto(item.nome, larguras[0] - padX * 2, estiloNome, 1.3).linhas;
    const nLinhas = Math.max(partesNome.length, 1);
    const alturaLinha = nLinhas * MotorPdf.ptParaMm(9 * 1.3) + 2.4;

    if (motor.y + alturaLinha > motor.medidas.fundoConteudo) {
      motor.novaPagina(); // aoIniciarPagina desenha a continuação
      motor.garantirEspaco(14);
      desenharCabecalho();
    }

    const yBase = motor.y + 3.4;
    for (let li = 0; li < nLinhas; li++) {
      motor.textoAbs(partesNome[li] ?? '', x0 + padX, yBase + li * MotorPdf.ptParaMm(9 * 1.3), estiloNome, COR_TEXTO);
    }
    motor.textoAbs(formatarQuantidadePad(item.quantidade), x0 + larguras[0] + larguras[1] / 2, yBase, { fonte: FONTE, peso: 'normal', tamanho: 9 }, COR_TEXTO, { alinhamento: 'center' });
    motor.textoAbs(formatarMZNCompacto(item.subtotal), x1 - padX, yBase, { fonte: FONTE, peso: 'normal', tamanho: 9 }, COR_TEXTO, { alinhamento: 'right' });

    motor.linha(x0, motor.y + alturaLinha, x1, motor.y + alturaLinha, HAIRLINE, 0.15);
    motor.y += alturaLinha;
  }
  motor.y += 6;
}

/** Quantidade no estilo da referência: "01" (2 dígitos) */
function formatarQuantidadePad(qtd: number): string {
  if (Number.isInteger(qtd)) return String(Math.max(0, qtd)).padStart(2, '0');
  return formatarQuantidade(qtd);
}

// ============================================================
// CONTRATOS DE DADOS (exportados para testes unitários)
// ============================================================

/**
 * Condições comerciais derivadas dos dados REAIS da proposta
 * (nunca texto fictício): validade, IVA, desconto e observações.
 * Sem dados → lista vazia → cartão de condições desaparece.
 */
export function condicoesDaProposta(dados: DadosPropostaPdf): string[] {
  const condicoes: string[] = [];
  if (dados.validadeDias && dados.validadeDias > 0) {
    condicoes.push(`Proposta válida por ${formatarQuantidade(dados.validadeDias)} dias a partir da data de emissão: ${formatarDataCurta(dados.data)}.`);
  }
  if (dados.totais.iva > 0) {
    condicoes.push(`Preços incluem IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%).`);
  }
  if (dados.totais.desconto > 0) {
    const rotulo = dados.totais.descontoLabel || formatarMZNCompacto(dados.totais.desconto);
    condicoes.push(`Desconto de ${rotulo} aplicado exclusivamente a esta proposta.`);
  }
  const obs = (dados.observacoes || '').trim();
  if (obs) condicoes.push(obs);
  return condicoes;
}

/**
 * Métodos mobile money disponíveis para os botões do resumo
 * financeiro. Sem método → sem botão (regra de ocultação).
 */
export function metodosMobileMoney(dados: DadosPropostaPdf): Array<{ rotulo: string; numero: string; cor: Cor }> {
  const metodos: Array<{ rotulo: string; numero: string; cor: Cor }> = [];
  if (dados.pagamento?.mpesa) metodos.push({ rotulo: 'M-PESA', numero: dados.pagamento.mpesa, cor: VERDE_MPESA });
  if (dados.pagamento?.emola) metodos.push({ rotulo: 'E-MOLA', numero: dados.pagamento.emola, cor: LARANJA_EMOLA });
  return metodos;
}

// ============================================================
// ÁREA INFERIOR — cartão de CONDIÇÕES (rosa, esquerda) +
// cartão de RESUMO FINANCEIRO (branco com moldura dourada,
// direita) com TOTAL destacado e botões M-Pesa/e-Mola.
// ============================================================

function areaInferior(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const condicoes = condicoesDaProposta(dados);
  const metodos = metodosMobileMoney(dados);

  // ---- pré-cálculo das alturas (para paginar os cartões como bloco) ----
  const estiloCond: Estilo = { fonte: FONTE, peso: 'normal', tamanho: 8 };
  const linhasCond = condicoes.flatMap(c =>
    motor.quebrarTexto(c, 82, estiloCond, 1.35).linhas);

  const x0 = motor.medidas.margens.esq;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  const larguraEsq = 92; // x0 .. x0+92
  const larguraDir = x1 - x0 - larguraEsq - 6; // x0+98 .. x1

  const alturaEsq = condicoes.length
    ? 10 + linhasCond.length * MotorPdf.ptParaMm(8 * 1.5) + 4
    : 0;

  const alturaDir = 10 // título
    + (dados.totais.desconto > 0 ? 5 : 0)
    + (dados.totais.iva > 0 ? 5 : 0)
    + 5 // subtotal
    + 13 // régua + TOTAL
    + (metodos.length ? 10 + (metodos.length > 1 && larguraDir < 84 ? 8 : 0) : 0)
    + 4;

  const alturaBloco = Math.max(alturaEsq, alturaDir);
  motor.y = Math.max(motor.y + 2, 0);
  motor.garantirEspaco(alturaBloco + 4);
  const y0 = motor.y;

  // ================== CARTÃO ESQUERDO (condições) ==================
  if (condicoes.length) {
    motor.doc.setFillColor(ROSA_CAIXA[0], ROSA_CAIXA[1], ROSA_CAIXA[2]);
    motor.doc.roundedRect(x0, y0, larguraEsq, alturaEsq, 3, 3, 'F');
    motor.textoAbs('CONDIÇÕES & INFORMAÇÕES', x0 + 4, y0 + 6, { fonte: FONTE, peso: 'bold', tamanho: 8 }, BORGONHA);

    let yC = y0 + 12;
    for (const linha of linhasCond) {
      motor.doc.setFillColor(DOURADO[0], DOURADO[1], DOURADO[2]);
      motor.doc.circle(x0 + 4.5, yC + 0.8, 0.55, 'F');
      motor.textoAbs(linha, x0 + 7.5, yC + 1.6, estiloCond, COR_TEXTO);
      yC += MotorPdf.ptParaMm(8 * 1.5);
    }
  }

  // ================== CARTÃO DIREITO (resumo) ==================
  const xR = x0 + larguraEsq + 6;
  motor.doc.setFillColor(BRANCO[0], BRANCO[1], BRANCO[2]);
  motor.doc.setDrawColor(DOURADO[0], DOURADO[1], DOURADO[2]);
  motor.doc.setLineWidth(0.4);
  motor.doc.roundedRect(xR, y0, larguraDir, alturaDir, 3, 3, 'FD');

  motor.textoAbs('RESUMO FINANCEIRO', xR + 4, y0 + 6, { fonte: FONTE, peso: 'bold', tamanho: 8 }, BORGONHA);

  let yR = y0 + 12;
  const linhaTotal: Array<[string, string]> = [['Subtotal', `${formatarMZNCompacto(dados.totais.subtotal)} MZN`]];
  if (dados.totais.desconto > 0) {
    linhaTotal.push([`Desconto${dados.totais.descontoLabel ? ` (${dados.totais.descontoLabel})` : ''}`, `-${formatarMZNCompacto(dados.totais.desconto)}`]);
  }
  if (dados.totais.iva > 0) {
    linhaTotal.push([`IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%)`, `${formatarMZNCompacto(dados.totais.iva)} MZN`]);
  }
  for (const [rotulo, valor] of linhaTotal) {
    motor.textoAbs(rotulo, xR + 4, yR + 3, { fonte: FONTE, peso: 'normal', tamanho: 8 }, COR_CINZA);
    motor.textoAbs(valor, xR + larguraDir - 4, yR + 3, { fonte: FONTE, peso: 'normal', tamanho: 8.5 }, COR_TEXTO, { alinhamento: 'right' });
    yR += 5;
  }

  // régua dourada + TOTAL em vermelho escuro (destaque da referência)
  motor.linha(xR + 4, yR + 1, xR + larguraDir - 4, yR + 1, DOURADO, 0.5);
  motor.textoAbs('TOTAL A PAGAR', xR + 4, yR + 7.5, { fonte: FONTE, peso: 'bold', tamanho: 8.5 }, COR_TEXTO, { espacamentoLetras: 0.8 });
  motor.textoAbs(`${formatarMZNCompacto(dados.totais.total)} MZN`, xR + larguraDir - 4, yR + 8.5, { fonte: FONTE, peso: 'bold', tamanho: 12.5 }, COR_TOTAL, { alinhamento: 'right' });
  yR += 13;

  // ---- botões M-Pesa / e-Mola (só quando existem) ----
  if (metodos.length) {
    yR += 1;
    const textos = metodos.map(m => `${m.rotulo} ${m.numero}`);
    const largurasPill = textos.map(t => motor.medirLargura(t, { fonte: FONTE, peso: 'bold', tamanho: 7 }) + 7);
    const ladoALado = largurasPill.reduce((s, w) => s + w, 0) + 3 <= larguraDir - 8;

    let xP = xR + 4;
    for (let i = 0; i < metodos.length; i++) {
      motor.doc.setFillColor(metodos[i].cor[0], metodos[i].cor[1], metodos[i].cor[2]);
      motor.doc.roundedRect(xP, yR, largurasPill[i], 6.5, 2, 2, 'F');
      motor.textoAbs(textos[i], xP + largurasPill[i] / 2, yR + 4.4, { fonte: FONTE, peso: 'bold', tamanho: 7 }, BRANCO, { alinhamento: 'center' });
      if (ladoALado) xP += largurasPill[i] + 3;
      else yR += 8;
    }
    yR += 9;
    motor.textoAbs('Envie o comprovativo para validar o pedido.', xR + 4, yR + 2, { fonte: FONTE, peso: 'italic', tamanho: 6.5 }, COR_CINZA);
  }

  motor.y = Math.max(y0 + alturaEsq, y0 + alturaDir) + 6;
}

// ============================================================
// OBSERVAÇÕES (Doc A sem financeiro) / SECÇÕES NARRATIVAS —
// títulos borgonha + régua dourada, só quando existem dados.
// ============================================================

function observacoesBloco(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const obs = (dados.observacoes || '').trim();
  if (!obs) return;
  motor.garantirEspaco(16);
  motor.textoAbs('Observações:', motor.medidas.margens.esq, motor.y + 3, { fonte: FONTE, peso: 'bold', tamanho: 8.5 }, BORGONHA);
  motor.y += 5.5;
  motor.paragrafo(obs, { fonte: FONTE, peso: 'italic', tamanho: 8 }, COR_CINZA, { entrelinha: 1.4 });
  motor.y += 2;
}

function seccoesNarrativas(motor: MotorPdf, dados: DadosPropostaPdf): void {
  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(22);
    const y = motor.y;
    motor.textoAbs(seccao.titulo, motor.medidas.margens.esq, y + 4, { fonte: FONTE, peso: 'bold', tamanho: 10.5 }, BORGONHA);
    motor.linha(motor.medidas.margens.esq, y + 7, motor.medidas.larguraPagina - motor.medidas.margens.dir, y + 7, DOURADO_CLARO, 0.3);
    motor.y = y + 11;
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: BORGONHA,
      tamanhoBase: 9.5,
      fonte: FONTE,
      entrelinha: 1.5,
    });
    motor.y += 3;
  }
}

// ============================================================
// CONTINUAÇÃO (páginas 2+) — fundo creme + mini-cabeçalho
// ============================================================

function paginaContinuacao(motor: MotorPdf, dados: DadosPropostaPdf): void {
  fundoCreme(motor);
  const xDir = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  motor.textoAbs(
    (dados.empresa.nome || '').toUpperCase(),
    motor.medidas.margens.esq, 11,
    { fonte: FONTE, peso: 'bold', tamanho: 7 }, COR_CINZA, { espacamentoLetras: 1.2 },
  );
  motor.textoAbs(`Proposta Nº ${dados.numero || 'S/N'}`, xDir, 11, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA, { alinhamento: 'right' });
  motor.linha(motor.medidas.margens.esq, 13.5, xDir, 13.5, HAIRLINE, 0.25);
  motor.y = 20;
}

// ============================================================
// BANDA DE RODAPÉ — dourado escuro full-bleed em TODAS as
// páginas: agradecimento (centro) + contactos + paginação.
// ============================================================

function bandaRodape(motor: MotorPdf, dados: DadosPropostaPdf, pagina: number, total: number): void {
  const yBanda = motor.medidas.alturaPagina - ALTURA_BANDA_RODAPE;
  motor.rect(0, yBanda, motor.medidas.larguraPagina, ALTURA_BANDA_RODAPE, DOURADO_ESCURO);

  motor.textoAbs(
    'Obrigado pela sua confiança!',
    motor.medidas.larguraPagina / 2,
    yBanda + 6.5,
    { fonte: FONTE, peso: 'bold', tamanho: 9.5 },
    BRANCO,
    { alinhamento: 'center' },
  );

  const contactos = [
    dados.empresa.telefone,
    dados.empresa.email,
    dados.empresa.endereco,
  ].filter(Boolean).join('  |  ');
  if (contactos) {
    motor.textoAbs(
      contactos,
      motor.medidas.larguraPagina / 2,
      yBanda + 12,
      { fonte: FONTE, peso: 'normal', tamanho: 6.5 },
      BRANCO,
      { alinhamento: 'center' },
    );
  }

  motor.textoAbs(
    `Página ${pagina} de ${total}`,
    motor.medidas.larguraPagina - motor.medidas.margens.dir,
    yBanda + 6.5,
    { fonte: FONTE, peso: 'normal', tamanho: 6.5 },
    BRANCO,
    { alinhamento: 'right' },
  );
}
