// ============================================================
// Template PDF 5 — "Cotação Corporativa (Tala Service)"
//
// Réplica VISUAL DATA-DRIVEN da cotação de referência Tala
// Service, Lda. A imagem define COMO o documento parece; o
// PropostaJá define DE ONDE cada informação vem.
//
// IDENTIDADE (fixa por design — faz parte do template):
//   A4 vertical, folha branca, linhas finas, tipografia
//   preta/cinza, turquesa como única cor de destaque, muita
//   área branca, logótipo em destaque e marca d'água gigante
//   e suave do PRÓPRIO logótipo da organização ao centro.
//
// DADOS (100% dinâmicos — NENHUM valor comercial hardcoded):
//   - Empresa/cliente/número/data/itens/totais: modelo normal
//     (DadosPropostaPdf) — engine financeiro intacto.
//   - Emitente (rodapé): dados.emitente (converte o dono).
//   - Dados além do modelo estruturado: dados.camposPersonalizados
//     (organization.custom_fields.<key>), com precedência
//     §18: estruturado → custom field → ocultar (nunca inventar).
//     Chaves consumidas: telefone, whatsapp, cidade, pais,
//     payment_instructions, payment_method_display, bank_name,
//     bank_account, nib, payment_reference, payment_contact_name.
//   - Valor por extenso: calculado do total (valorPorExtensoMZN).
//
// REGRAS DE OCULTAÇÃO (§11/§12): campo disponível → mostrar;
// sem campo → SEM fallback fictício → o bloco/linha desaparece
// de forma elegante. "Nuit:"/"Telefone:" do cliente mantêm o
// rótulo com valor vazio (preserva o alinhamento do bloco,
// como na referência).
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf } from './tipos';
import {
  formatarDataCurta,
  formatarMZNCompacto,
  formatarQuantidade,
  medirLogotipo,
  valorPorExtensoMZN,
} from './utils';

const PT_MM = 0.352778;

// ---- Paleta da referência (design do template) ----
/** Turquesa do título «Cotação» e micro-acentos (#0FA3B1) */
const TURQUESA: Cor = [15, 163, 177];
const COR_TEXTO: Cor = [17, 24, 39];
const COR_CINZA: Cor = [107, 114, 128];
const COR_HAIRLINE: Cor = [214, 219, 224];
/** Réguas da tabela (fina, escura — estrutura do documento) */
const COR_REGUA: Cor = [96, 106, 116];

/** Opacidade da marca d'água — "extremamente suave" */
const OPACIDADE_MARCA_AGUA = 0.055;
/** Caixa máxima da marca d'água (mm) — grande, ao centro da página */
const CAIXA_MARCA_AGUA = { largura: 140, altura: 95 };

// ---- estilos base ----
const FONTE: Estilo['fonte'] = 'helvetica';

// ============================================================
// Ponto de entrada
// ============================================================

export function desenharTalaService(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 16, dir: 16, topo: 16, baixo: 22 });

  // páginas 2+: marca d'água + mini-cabeçalho de continuação
  motor.aoIniciarPagina = m => paginaContinuacao(m, dados);

  // página 1: marca d'água PRIMEIRO (fica atrás de todo o conteúdo)
  marcaAgua(motor, dados);

  cabecalho(motor, dados);

  if (dados.mostrarFinanceiro) {
    tabelaItens(motor, dados);
    areaInferior(motor, dados);
  }

  observacoes(motor, dados);
  seccoesNarrativas(motor, dados);

  if (!dados.mostrarFinanceiro && dados.seccoes.length === 0) {
    motor.garantirEspaco(20);
    motor.paragrafo(
      '(Documento sem conteúdo financeiro ou narrativo registado.)',
      { fonte: FONTE, peso: 'italic', tamanho: 9.5 },
      COR_CINZA,
    );
  }

  motor.aplicarRodapes((m, i, total) => rodape(m, dados, i, total));
  return motor;
}

// ============================================================
// MARCA D'ÁGUA — logótipo da ORGANIZAÇÃO, grande, centro,
// opacidade muito baixa, atrás do conteúdo. Dinâmica (§3):
// sem logótipo → sem marca d'água (nunca "TALA SERVICE").
// ============================================================

function marcaAgua(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const dataUrl = dados.empresa.logotipo;
  if (!dataUrl) return;
  const logo = medirLogotipo(dataUrl, CAIXA_MARCA_AGUA.largura, CAIXA_MARCA_AGUA.altura);
  if (!logo) return;
  const cx = motor.medidas.larguraPagina / 2;
  const cy = motor.medidas.alturaPagina / 2;
  const x = cx - logo.largura / 2;
  const y = cy - logo.altura / 2;
  try {
    motor.doc.setGState(motor.doc.GState({ opacity: OPACIDADE_MARCA_AGUA }));
    motor.doc.addImage(dataUrl, logo.formato, x, y, logo.largura, logo.altura);
    motor.doc.setGState(motor.doc.GState({ opacity: 1 }));
  } catch { /* logótipo inválido → segue sem marca d'água */ }
}

// ============================================================
// CABEÇALHO — logo (esq.) + «Cotação» turquesa e nº (dir.)
//                bloco empresa (esq.) / bloco cliente (dir.)
// ============================================================

function cabecalho(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const xDir = motor.medidas.larguraPagina - motor.medidas.margens.dir; // 194
  const campos = dados.camposPersonalizados ?? {};

  // ---- logótipo (canto superior esquerdo) ----
  let temLogo = false;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 36, 17);
    if (logo) {
      try {
        motor.doc.addImage(dados.empresa.logotipo, logo.formato, 16, 16, logo.largura, logo.altura);
        temLogo = true;
      } catch { /* logótipo inválido → fallback textual */ }
    }
  }
  if (!temLogo && dados.empresa.nome) {
    motor.textoAbs(
      motor.quebrarTexto(dados.empresa.nome, 100, { fonte: FONTE, peso: 'bold', tamanho: 13 }, 1.15).linhas[0] ?? dados.empresa.nome,
      16, 24, { fonte: FONTE, peso: 'bold', tamanho: 13 }, COR_TEXTO,
    );
  }

  // ---- título «Cotação» + número (canto superior direito) ----
  motor.textoAbs('Cotação', xDir, 23, { fonte: FONTE, peso: 'bold', tamanho: 16 }, TURQUESA, { alinhamento: 'right' });
  motor.textoAbs(dados.numero || 'S/N', xDir, 30.5, { fonte: FONTE, peso: 'bold', tamanho: 10 }, COR_TEXTO, { alinhamento: 'right' });

  // ---- bloco EMPRESA (esquerda) ----
  // telefone: custom field específico da org; fallback para o contacto
  // que o modelo actual transporta (§18 — estruturado → custom → ocultar;
  // nota: organizations ainda não tem coluna telefone própria).
  const telefoneEmpresa = campos.telefone || dados.empresa.telefone || '';
  const whatsEmpresa = campos.whatsapp || '';
  const cidadePais = [campos.cidade, campos.pais].filter(Boolean).join(' - ');

  const yBloco = 44;
  const larguraEsq = 92; // 16..108
  const linhasEmpresa: Array<{ texto: string; bold: boolean }> = [
    { texto: dados.empresa.nome, bold: true },
  ];
  if (dados.empresa.endereco) linhasEmpresa.push({ texto: dados.empresa.endereco, bold: false });
  if (cidadePais) linhasEmpresa.push({ texto: cidadePais, bold: false });
  if (dados.empresa.nuit) linhasEmpresa.push({ texto: `Nuit: ${dados.empresa.nuit}`, bold: false });
  if (telefoneEmpresa) linhasEmpresa.push({ texto: `Telefone: ${telefoneEmpresa}`, bold: false });
  if (whatsEmpresa) linhasEmpresa.push({ texto: whatsEmpresa, bold: false });
  const yE = desenharBlocoLinhas(motor, linhasEmpresa, 16, yBloco, larguraEsq);

  // ---- bloco CLIENTE (direita) ----
  const xCliente = 118;
  const larguraDir = xDir - xCliente; // 76
  const linhasCliente: Array<{ texto: string; bold: boolean }> = [
    { texto: dados.cliente.nome || 'Cliente', bold: true },
  ];
  if (dados.cliente.empresa && dados.cliente.empresa !== dados.cliente.nome) {
    linhasCliente.push({ texto: dados.cliente.empresa, bold: false });
  }
  if (dados.cliente.endereco) linhasCliente.push({ texto: dados.cliente.endereco, bold: false });
  // §4: rótulo presente, valor oculto quando não existe (preserva alinhamento)
  linhasCliente.push({ texto: `Nuit: ${dados.cliente.nuit || ''}`, bold: false });
  linhasCliente.push({ texto: `Telefone: ${dados.cliente.telefone || ''}`, bold: false });
  const yC = desenharBlocoLinhas(motor, linhasCliente, xCliente, yBloco, larguraDir);

  motor.y = Math.max(yE, yC) + 8;
}

/** Desenha um bloco de linhas (bold/norm); devolve o y final. */
function desenharBlocoLinhas(
  motor: MotorPdf,
  linhas: Array<{ texto: string; bold: boolean }>,
  x: number,
  yInicio: number,
  largura: number,
): number {
  let y = yInicio;
  for (const l of linhas) {
    if (!l.texto) continue;
    const estilo: Estilo = { fonte: FONTE, peso: l.bold ? 'bold' : 'normal', tamanho: l.bold ? 10 : 8.5 };
    const quebradas = motor.quebrarTexto(l.texto, largura, estilo, 1.25).linhas;
    for (const q of quebradas.slice(0, 3)) {
      motor.textoAbs(q, x, y + estilo.tamanho * PT_MM * 0.78, estilo, l.bold ? COR_TEXTO : COR_CINZA);
      y += estilo.tamanho * 1.28 * PT_MM;
    }
  }
  return y;
}

// ============================================================
// TABELA DE ITENS — réplica fiel: régua superior, cabeçalhos
// pequenos, texto compacto, SEM cartões/preenchimentos/sepa-
// radores de linha, régua inferior. Desenho próprio (o
// motor.tabela desenharia zebra/separadores que destroem a
// fidelidade visual da referência).
// ============================================================

function tabelaItens(motor: MotorPdf, dados: DadosPropostaPdf): void {
  if (dados.itens.length === 0) {
    motor.paragrafo('(Sem itens registados nesta proposta.)', { fonte: FONTE, peso: 'italic', tamanho: 9.5 }, COR_CINZA);
    motor.y += 3;
    return;
  }

  const x0 = motor.medidas.margens.esq;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  const larguraTotal = x1 - x0;
  // colunas da referência: Descrição | Quantidade | Preço Unitário | Total
  const fracoes = [0.50, 0.14, 0.18, 0.18];
  const alinhamentos: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right', 'right'];
  const cabecalhos = ['Descrição', 'Quantidade', 'Preço Unitário', 'Total'];
  const larguras = fracoes.map(f => f * larguraTotal);
  const padX = 2;

  const desenharCabecalho = (): void => {
    let px = x0;
    for (let ci = 0; ci < 4; ci++) {
      const larguraTexto = motor.medirLargura(cabecalhos[ci].toUpperCase(), { fonte: FONTE, peso: 'bold', tamanho: 7 });
      const xTexto = alinhamentos[ci] === 'right'
        ? px + larguras[ci] - padX - larguraTexto
        : alinhamentos[ci] === 'center'
          ? px + larguras[ci] / 2 - larguraTexto / 2
          : px + padX;
      motor.textoAbs(cabecalhos[ci].toUpperCase(), xTexto, motor.y + 4.6, { fonte: FONTE, peso: 'bold', tamanho: 7 }, COR_CINZA);
      px += larguras[ci];
    }
    motor.y += 6.5;
  };

  motor.y += 6;
  motor.garantirEspaco(24);

  // régua superior (linha horizontal do topo da tabela)
  motor.linha(x0, motor.y, x1, motor.y, COR_REGUA, 0.35);
  motor.y += 2;
  desenharCabecalho();

  for (const item of dados.itens) {
    const celulas = [
      item.nome,
      formatarQuantidadePad(item.quantidade),
      formatarMZNCompacto(item.precoUnitario),
      formatarMZNCompacto(item.subtotal),
    ];
    // pré-quebra da descrição (células numéricas não quebram)
    const estiloCell: Estilo = { fonte: FONTE, peso: 'normal', tamanho: 8.5 };
    const partesDesc = motor.quebrarTexto(celulas[0], larguras[0] - padX * 2, estiloCell, 1.3).linhas;
    const nLinhas = Math.max(partesDesc.length, 1);
    const alturaLinha = nLinhas * MotorPdf.ptParaMm(8.5 * 1.3) + 2.4;

    if (motor.y + alturaLinha > motor.medidas.fundoConteudo) {
      motor.novaPagina(); // aoIniciarPagina desenha a continuação
      motor.y += 4;
      motor.linha(x0, motor.y, x1, motor.y, COR_REGUA, 0.35);
      motor.y += 2;
      desenharCabecalho();
    }

    let px = x0;
    for (let ci = 0; ci < 4; ci++) {
      const valor = ci === 0 ? (partesDesc[0] ?? '') : celulas[ci];
      motor.textoAbs(valor, xTextoColuna(alinhamentos[ci], px, larguras[ci], padX), motor.y + 3.4, estiloCell, COR_TEXTO, {
        alinhamento: alinhamentos[ci],
      });
      px += larguras[ci];
    }
    // linhas adicionais da descrição (multi-linha, como na referência)
    for (let li = 1; li < partesDesc.length; li++) {
      motor.textoAbs(partesDesc[li], x0 + padX, motor.y + 3.4 + li * MotorPdf.ptParaMm(8.5 * 1.3), estiloCell, COR_TEXTO);
    }
    motor.y += alturaLinha;
  }

  // régua inferior (fecha a tabela)
  motor.linha(x0, motor.y, x1, motor.y, COR_REGUA, 0.35);
  motor.y += 2;
}

/** Alinhamento × posição x do texto da coluna */
function xTextoColuna(alinhamento: 'left' | 'center' | 'right', px: number, largura: number, padX: number): number {
  if (alinhamento === 'right') return px + largura - padX;
  if (alinhamento === 'center') return px + largura / 2;
  return px + padX;
}

/** Quantidade no estilo da referência: "01" (2 dígitos) */
function formatarQuantidadePad(qtd: number): string {
  if (Number.isInteger(qtd)) return String(Math.max(0, qtd)).padStart(2, '0');
  return formatarQuantidade(qtd);
}

// ============================================================
// ÁREA INFERIOR — como na referência: coluna ESQUERDA com
// «Valor por extenso» e, por baixo, o bloco de pagamento
// (zona configurável); coluna DIREITA com Sub Total / IVA /
// TOTAL. Valores do MOTOR financeiro existente — o template
// apenas apresenta.
// ============================================================

function areaInferior(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const p = mapearPagamentoTala(dados);
  const temDadosBancarios = !!(p.banco || p.nib || p.conta || p.referencia || p.linhasAdicionais.length > 0);
  const pagamentoVisivel = !!(p.metodoDisplay || p.instrucoes || temDadosBancarios || p.contacto);

  // ---- pré-cálculo (para paginar a área como um bloco) ----
  const estilo8: Estilo = { fonte: FONTE, peso: 'normal', tamanho: 8.5 };
  const extenso = valorPorExtensoMZN(dados.totais.total);
  const linhasExtenso = motor.quebrarTexto(extenso, 92, { fonte: FONTE, peso: 'normal', tamanho: 9 }, 1.35).linhas;
  const linhasInstrucoes = p.instrucoes
    ? motor.quebrarTexto(p.instrucoes, 98, estilo8, 1.35).linhas
    : [];
  const linhasBanco: string[] = [];
  if (p.banco && p.nib) linhasBanco.push(`NIB ${p.banco} - ${p.nib}`);
  else if (p.nib) linhasBanco.push(`NIB ${p.nib}`);
  else if (p.banco) linhasBanco.push(p.banco);
  if (p.conta) linhasBanco.push(`Conta ${p.conta}`);
  if (p.referencia) linhasBanco.push(p.referencia);
  linhasBanco.push(...p.linhasAdicionais);

  const alturaEsq =
    5.5 + Math.min(linhasExtenso.length, 3) * 4.2
    + (pagamentoVisivel
      ? 4 + (p.metodoDisplay ? 10 : 0) + 6 + linhasInstrucoes.length * 3.9 + 1.5
        + (temDadosBancarios ? 6.5 + linhasBanco.length * 3.9 + (p.contacto ? 4.5 : 0) : (p.contacto ? 4.5 : 0))
      : 0);

  // ancora na zona inferior da referência; flui se a tabela for longa
  motor.y = Math.max(motor.y + 14, 198);
  motor.garantirEspaco(Math.max(alturaEsq + 4, 30));
  const y0 = motor.y;

  // ================== COLUNA ESQUERDA ==================
  let yE = y0;

  // «Valor por extenso:» — calculado do total (nunca hardcoded)
  motor.textoAbs('Valor por extenso:', 16, yE + 2.8, { fonte: FONTE, peso: 'italic', tamanho: 8.5 }, COR_CINZA);
  yE += 5.5;
  for (const l of linhasExtenso.slice(0, 3)) {
    motor.textoAbs(l, 16, yE + 3, { fonte: FONTE, peso: 'normal', tamanho: 9 }, COR_TEXTO);
    yE += 9 * 1.35 * PT_MM;
  }

  // ---- bloco de pagamento (zona configurável; sem dados → desaparece) ----
  if (pagamentoVisivel) {
    yE += 4;

    // zona VISA / método (payment_method_display) — desaparece sem dados
    if (p.metodoDisplay) {
      const texto = p.metodoDisplay.toUpperCase();
      const larguraTexto = motor.medirLargura(texto, { fonte: FONTE, peso: 'bold', tamanho: 9.5 });
      const caixaL = larguraTexto + 10;
      motor.doc.setDrawColor(COR_HAIRLINE[0], COR_HAIRLINE[1], COR_HAIRLINE[2]);
      motor.doc.setLineWidth(0.3);
      motor.doc.roundedRect(16, yE, caixaL, 7.5, 1.5, 1.5, 'S');
      motor.textoAbs(texto, 16 + caixaL / 2, yE + 5.2, { fonte: FONTE, peso: 'bold', tamanho: 9.5 }, TURQUESA, { alinhamento: 'center', espacamentoLetras: 1.5 });
      yE += 10;
    }

    motor.textoAbs('Estimado Cliente,', 16, yE + 3, { fonte: FONTE, peso: 'italic', tamanho: 9 }, COR_CINZA);
    yE += 6.5;
    for (const l of linhasInstrucoes) {
      motor.textoAbs(l, 16, yE + 3, estilo8, COR_TEXTO);
      yE += 8.5 * 1.35 * PT_MM;
    }

    if (temDadosBancarios) {
      motor.textoAbs('Métodos de pagamento disponíveis', 16, yE + 3.5, { fonte: FONTE, peso: 'bold', tamanho: 8.5 }, COR_TEXTO);
      yE += 6.5;
      for (const l of linhasBanco) {
        motor.textoAbs(l, 16, yE + 3, estilo8, COR_TEXTO);
        yE += 8.5 * 1.3 * PT_MM;
      }
    }
    if (p.contacto) {
      motor.textoAbs(`(${p.contacto})`, 16, yE + 3, { fonte: FONTE, peso: 'italic', tamanho: 8.5 }, COR_CINZA);
      yE += 8.5 * 1.3 * PT_MM;
    }
  }

  // ================== COLUNA DIREITA (totais) ==================
  const xT = 124;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  const linhasTotais: Array<[string, string]> = [['Sub Total', `${formatarMZNCompacto(dados.totais.subtotal)} MZN`]];
  if (dados.totais.desconto > 0) {
    linhasTotais.push([`Desconto${dados.totais.descontoLabel ? ` (${dados.totais.descontoLabel})` : ''}`, `- ${formatarMZNCompacto(dados.totais.desconto)} MZN`]);
  }
  if (dados.totais.iva > 0 || dados.totais.ivaPercentual > 0) {
    linhasTotais.push([`IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%)`, `${formatarMZNCompacto(dados.totais.iva)} MZN`]);
  }

  let yT = y0;
  for (const [rotulo, valor] of linhasTotais) {
    motor.textoAbs(rotulo, xT, yT + 2.8, { fonte: FONTE, peso: 'normal', tamanho: 8.5 }, COR_CINZA);
    motor.textoAbs(valor, x1, yT + 2.8, { fonte: FONTE, peso: 'normal', tamanho: 9 }, COR_TEXTO, { alinhamento: 'right' });
    yT += 5;
  }
  // régua de acento turquesa + TOTAL
  motor.linha(xT, yT + 1.4, x1, yT + 1.4, TURQUESA, 0.5);
  motor.textoAbs('TOTAL', xT, yT + 8.2, { fonte: FONTE, peso: 'bold', tamanho: 10 }, COR_TEXTO, { espacamentoLetras: 1.2 });
  motor.textoAbs(`${formatarMZNCompacto(dados.totais.total)} MZN`, x1, yT + 8.8, { fonte: FONTE, peso: 'bold', tamanho: 13 }, COR_TEXTO, { alinhamento: 'right' });
  const yFimTotais = yT + 12.5;

  motor.y = Math.max(yE + 2, yFimTotais) + 6;
}

// ============================================================
// BLOCO DE PAGAMENTO — zona configurável (custom fields) com
// fallback para o estruturado. Sem dados → desaparece.
// ============================================================

interface DadosPagamentoTala {
  metodoDisplay: string;
  instrucoes: string;
  banco: string;
  nib: string;
  conta: string;
  referencia: string;
  contacto: string;
  linhasAdicionais: string[];
}

/**
 * Mapeamento com precedência §18: estruturado existente →
 * custom field específico da org → vazio (bloco/linha oculta).
 * (exportado para testes unitários do contrato de dados)
 */
export function mapearPagamentoTala(dados: DadosPropostaPdf): DadosPagamentoTala {
  const campos = dados.camposPersonalizados ?? {};
  const pag = dados.pagamento;
  const linhasAdicionais: string[] = [];
  if (pag?.mpesa) linhasAdicionais.push(`M-Pesa ${pag.mpesa}`);
  if (pag?.emola) linhasAdicionais.push(`e-Mola ${pag.emola}`);
  if (pag?.mkesh) linhasAdicionais.push(`m-Kesh ${pag.mkesh}`);
  for (const extra of pag?.extras ?? []) {
    linhasAdicionais.push(`${extra.rotulo} ${extra.valor}`);
  }
  return {
    metodoDisplay: campos.payment_method_display || '',
    instrucoes: campos.payment_instructions || '',
    banco: pag?.banco || campos.bank_name || '',
    nib: pag?.nib || campos.nib || '',
    conta: pag?.conta || campos.bank_account || '',
    referencia: campos.payment_reference || '',
    contacto: campos.payment_contact_name || '',
    linhasAdicionais,
  };
}

// ============================================================
// OBSERVAÇÕES / SECÇÕES NARRATIVAS — só quando existem dados
// (compatibilidade com os fluxos existentes; ocultas caso
// contrário, como manda a regra de ocultação elegante).
// ============================================================

function observacoes(motor: MotorPdf, dados: DadosPropostaPdf): void {
  const obs = (dados.observacoes || '').trim();
  if (!obs) return;
  motor.garantirEspaco(16);
  motor.y += 4;
  motor.textoAbs('Observações:', motor.medidas.margens.esq, motor.y + 3, { fonte: FONTE, peso: 'bold', tamanho: 8.5 }, COR_TEXTO);
  motor.y += 5.5;
  motor.paragrafo(obs, { fonte: FONTE, peso: 'italic', tamanho: 8 }, COR_CINZA, { entrelinha: 1.4 });
  motor.y += 2;
}

function seccoesNarrativas(motor: MotorPdf, dados: DadosPropostaPdf): void {
  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(22);
    const y = motor.y;
    motor.textoAbs(seccao.titulo, motor.medidas.margens.esq, y + 4, { fonte: FONTE, peso: 'bold', tamanho: 10.5 }, COR_TEXTO);
    motor.linha(motor.medidas.margens.esq, y + 7, motor.medidas.larguraPagina - motor.medidas.margens.dir, y + 7, COR_HAIRLINE, 0.25);
    motor.y = y + 11;
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: TURQUESA,
      tamanhoBase: 9.5,
      fonte: FONTE,
      entrelinha: 1.5,
    });
    motor.y += 3;
  }
}

// ============================================================
// CONTINUAÇÃO (páginas 2+) — marca d'água + mini-cabeçalho
// ============================================================

function paginaContinuacao(motor: MotorPdf, dados: DadosPropostaPdf): void {
  marcaAgua(motor, dados); // atrás do conteúdo da página nova
  const xDir = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  motor.textoAbs(
    (dados.empresa.nome || '').toUpperCase(),
    motor.medidas.margens.esq, 11,
    { fonte: FONTE, peso: 'bold', tamanho: 7 }, COR_CINZA, { espacamentoLetras: 1.2 },
  );
  motor.textoAbs(`Cotação Nº ${dados.numero || 'S/N'}`, xDir, 11, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA, { alinhamento: 'right' });
  motor.linha(motor.medidas.margens.esq, 13.5, xDir, 13.5, COR_HAIRLINE, 0.25);
}

// ============================================================
// RODAPÉ — Data · Emitido por + email (esq.) · Página X de Y
// (dir.) — paginação REAL do motor, mostrada sempre como na
// referência ("Page 1 of 1" mesmo com uma única página).
// ============================================================

function rodape(motor: MotorPdf, dados: DadosPropostaPdf, pagina: number, total: number): void {
  const x0 = motor.medidas.margens.esq;
  const x1 = motor.medidas.larguraPagina - motor.medidas.margens.dir;
  const yLinha = motor.medidas.alturaPagina - 16;
  motor.linha(x0, yLinha, x1, yLinha, COR_HAIRLINE, 0.25);

  motor.textoAbs(`Data: ${formatarDataCurta(dados.data)}`, x0, yLinha + 4.2, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA);
  let y = yLinha + 7.8;
  if (dados.emitente?.nome) {
    motor.textoAbs(`Emitido por: ${dados.emitente.nome}`, x0, y, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA);
    y += 3.6;
  }
  const email = dados.emitente?.email || dados.empresa.email || '';
  if (email) {
    motor.textoAbs(email, x0, y, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA);
  }
  motor.textoAbs(`Página ${pagina} de ${total}`, x1, yLinha + 7.8, { fonte: FONTE, peso: 'normal', tamanho: 7 }, COR_CINZA, { alinhamento: 'right' });
}
