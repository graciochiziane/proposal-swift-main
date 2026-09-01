// ============================================================
// Template PDF 2 — "Editorial Elegante"
//
// Design editorial minimalista em serif:
//   - Fundo marfim e moldura dupla em hairline
//   - Capa centrada: título serif grande, ornamento losango,
//     "Preparada para" em itálico, data por extenso
//   - Secções numeradas em serifa clara (01, 02, ...), regras
//     finas, tipografia com respiro
//   - Tabela sem preenchimentos (só hairlines), totais com
//     régua dupla, assinaturas centradas
// ============================================================

import { MotorPdf, type Cor, type Estilo } from './motor';
import type { DadosPropostaPdf, ItemPdf } from './tipos';
import { formatarDataLonga, formatarMZN, formatarQuantidade, hexToRgb, medirLogotipo } from './utils';

const MARFIM: Cor = [250, 248, 244];
const COR_TEXTO: Cor = [56, 50, 44];
const COR_CINZA: Cor = [130, 122, 112];
const COR_HAIRLINE: Cor = [216, 208, 198];

interface Paleta {
  acento: Cor;
  acentoSuave: Cor;
  hexAcento: string;
}

function construirPaleta(hexCor: string | undefined): Paleta {
  const hex = hexCor && /^#[0-9a-fA-F]{3,6}$/.test(hexCor) ? hexCor : '#8A6D3B';
  const acento = hexToRgb(hex);
  return {
    acento,
    acentoSuave: [
      Math.round(acento[0] * 0.55 + 130 * 0.45),
      Math.round(acento[1] * 0.55 + 120 * 0.45),
      Math.round(acento[2] * 0.55 + 108 * 0.45),
    ],
    hexAcento: hex,
  };
}

const PT_MM = 0.352778;

export function desenharEditorial(dados: DadosPropostaPdf): MotorPdf {
  const motor = new MotorPdf({ esq: 22, dir: 22, topo: 28, baixo: 24 });
  const p = construirPaleta(dados.empresa.corPrimaria);

  desenharCapa(motor, dados, p);

  motor.aoIniciarPagina = (m) => fundoPaginaConteudo(m, dados, p);
  motor.novaPagina();

  desenharConteudo(motor, dados, p);

  motor.aplicarRodapes((m, i, total) => rodape(m, dados, i, total));
  return motor;
}

// ============================================================
// Fundo / moldura
// ============================================================

function fundoMarfim(motor: MotorPdf): void {
  motor.rect(0, 0, motor.medidas.larguraPagina, motor.medidas.alturaPagina, MARFIM, 'F');
}

/** Ornamento losango preenchido no acento */
function losango(motor: MotorPdf, cx: number, cy: number, meio: number, cor: Cor): void {
  const { doc } = motor;
  doc.setFillColor(cor[0], cor[1], cor[2]);
  doc.triangle(cx, cy - meio, cx - meio, cy, cx + meio, cy, 'F');
  doc.triangle(cx - meio, cy, cx + meio, cy, cx, cy + meio, 'F');
}

// ============================================================
// CAPA
// ============================================================

function desenharCapa(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  fundoMarfim(motor);
  const { doc } = motor;
  const L = motor.medidas.larguraPagina;
  const cx = L / 2;

  // ---- moldura dupla ----
  doc.setDrawColor(p.acentoSuave[0], p.acentoSuave[1], p.acentoSuave[2]);
  doc.setLineWidth(0.5);
  doc.rect(8, 8, L - 16, 281, 'S');
  doc.setLineWidth(0.2);
  doc.rect(10.5, 10.5, L - 21, 276, 'S');

  // ---- rótulo superior ----
  // Nota: o charSpace do motor é expresso em mm (unidades do doc)
  const estiloRotulo: Estilo = { fonte: 'times', peso: 'bold', tamanho: 10 };
  const rotulo = dados.titulo.toUpperCase();
  const larguraRotulo = motor.medirLargura(rotulo, estiloRotulo) + 3 * (rotulo.length - 1);
  motor.textoAbs(rotulo, cx, 42, estiloRotulo, p.acento, { alinhamento: 'center', espacamentoLetras: 3 });
  const meiaLargura = larguraRotulo / 2;
  motor.linha(cx - meiaLargura - 5, 40, cx - meiaLargura - 25, 40, p.acentoSuave, 0.3);
  motor.linha(cx + meiaLargura + 5, 40, cx + meiaLargura + 25, 40, p.acentoSuave, 0.3);

  // ---- logotipo / nome da empresa ----
  let yPos = 58;
  if (dados.empresa.logotipo) {
    const logo = medirLogotipo(dados.empresa.logotipo, 44, 20);
    if (logo) {
      try {
        doc.addImage(dados.empresa.logotipo, logo.formato, cx - logo.largura / 2, yPos, logo.largura, logo.altura);
        yPos += logo.altura + 8;
      } catch { /* logotipo inválido → segue sem imagem */ }
    }
  }
  if (!dados.empresa.logotipo) {
    motor.textoAbs(dados.empresa.nome.toUpperCase(), cx, yPos + 4, { fonte: 'times', peso: 'bold', tamanho: 12 }, COR_TEXTO, { alinhamento: 'center', espacamentoLetras: 1.6 });
    yPos += 12;
  }

  // ---- título principal ----
  const nomeCliente = dados.cliente.empresa || dados.cliente.nome || 'Proposta';
  const estiloTitulo: Estilo = { fonte: 'times', peso: 'bold', tamanho: 25 };
  const linhas = motor.quebrarTexto(nomeCliente, 150, estiloTitulo, 1.1).linhas;
  let yTitulo = 118;
  for (const linha of linhas.slice(0, 2)) {
    motor.textoAbs(linha, cx, yTitulo, estiloTitulo, COR_TEXTO, { alinhamento: 'center' });
    yTitulo += 25 * 1.1 * PT_MM;
  }

  // ---- bloco "preparada para" emoldurado (âncora central) ----
  const yMoldura = yTitulo + 6;
  motor.linha(cx - 58, yMoldura, cx + 58, yMoldura, p.acentoSuave, 0.3);
  losango(motor, cx, yMoldura + 6.5, 2.2, p.acento);
  motor.textoAbs('Proposta preparada para', cx, yMoldura + 14, { fonte: 'times', peso: 'italic', tamanho: 10.5 }, COR_CINZA, { alinhamento: 'center' });
  motor.textoAbs(dados.cliente.nome || '', cx, yMoldura + 21.5, { fonte: 'times', peso: 'bold', tamanho: 14.5 }, COR_TEXTO, { alinhamento: 'center' });
  motor.linha(cx - 58, yMoldura + 27, cx + 58, yMoldura + 27, p.acentoSuave, 0.3);

  // ---- bloco financeiro resumido (cotação) ----
  if (dados.mostrarFinanceiro) {
    const yBloco = 216;
    motor.linha(cx - 34, yBloco, cx + 34, yBloco, COR_HAIRLINE, 0.25);
    motor.linha(cx - 34, yBloco + 0.8, cx + 34, yBloco + 0.8, COR_HAIRLINE, 0.25);
    motor.textoAbs('VALOR TOTAL DA PROPOSTA', cx, yBloco + 8, { fonte: 'times', peso: 'normal', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center', espacamentoLetras: 2 });
    motor.textoAbs(formatarMZN(dados.totais.total), cx, yBloco + 17.5, { fonte: 'times', peso: 'bold', tamanho: 17 }, p.acento, { alinhamento: 'center' });
    if (dados.totais.iva > 0) {
      motor.textoAbs(`inclui IVA de ${formatarQuantidade(dados.totais.ivaPercentual)}%`, cx, yBloco + 24, { fonte: 'times', peso: 'italic', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center' });
    }
    if (dados.itens.length > 0) {
      motor.textoAbs(`${dados.itens.length} ${dados.itens.length === 1 ? 'item' : 'itens'} · validade ${dados.validadeDias ?? 15} dias`, cx, yBloco + 29.5, { fonte: 'times', peso: 'italic', tamanho: 8 }, COR_CINZA, { alinhamento: 'center' });
    }
  }

  // ---- rodapé da capa ----
  motor.textoAbs(`N. ${dados.numero}`, cx, 258, { fonte: 'times', peso: 'normal', tamanho: 10 }, COR_TEXTO, { alinhamento: 'center' });
  motor.textoAbs(formatarDataLonga(dados.data), cx, 264, { fonte: 'times', peso: 'italic', tamanho: 9.5 }, COR_CINZA, { alinhamento: 'center' });
  if (dados.validadeDias && dados.validadeDias > 0) {
    motor.textoAbs(`Validade de ${dados.validadeDias} dias`, cx, 270, { fonte: 'times', peso: 'italic', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center' });
  }
  const contacto = [
    dados.empresa.nuit ? `NUIT ${dados.empresa.nuit}` : '',
    dados.empresa.endereco || '',
  ].filter(Boolean).join('  ·  ');
  if (contacto) {
    motor.textoAbs(contacto, cx, 278, { fonte: 'times', peso: 'normal', tamanho: 8 }, COR_CINZA, { alinhamento: 'center' });
  }
}

// ============================================================
// CONTEÚDO
// ============================================================

function fundoPaginaConteudo(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  fundoMarfim(motor);
  const cx = motor.medidas.larguraPagina / 2;
  motor.textoAbs(`PROPOSTA ${dados.numero}`, cx, 15, { fonte: 'times', peso: 'normal', tamanho: 8 }, COR_CINZA, { alinhamento: 'center', espacamentoLetras: 2.4 });
  motor.linha(motor.medidas.margens.esq, 19, motor.medidas.larguraPagina - motor.medidas.margens.dir, 19, COR_HAIRLINE, 0.25);
  motor.linha(motor.medidas.margens.esq, 19.8, motor.medidas.larguraPagina - motor.medidas.margens.dir, 19.8, COR_HAIRLINE, 0.25);
}

function desenharConteudo(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  let numeroSecao = 1;

  if (dados.mostrarFinanceiro) {
    cabecalhoSecao(motor, numeroSecao, 'Investimento Proposto', p);
    tabelaItens(motor, dados.itens, p);
    blocoTotais(motor, dados, p);
    motor.y += 8;
    numeroSecao++;
  }

  for (const seccao of dados.seccoes) {
    motor.garantirEspaco(26);
    cabecalhoSecao(motor, numeroSecao, seccao.titulo, p);
    motor.markdown(seccao.conteudo, {
      corTexto: COR_TEXTO,
      corTitulo: p.acento,
      tamanhoBase: 10.5,
      fonte: 'times',
      entrelinha: 1.6,
      recuoLista: 6,
    });
    motor.y += 5;
    numeroSecao++;
  }

  if (dados.observacoes?.trim()) {
    cabecalhoSecao(motor, numeroSecao, 'Observações', p);
    const estiloObs: Estilo = { fonte: 'times', peso: 'italic', tamanho: 10 };
    const altura = motor.quebrarTexto(dados.observacoes, motor.medidas.larguraConteudo - 8, estiloObs, 1.5).alturaMm;
    motor.garantirEspaco(altura + 6);
    motor.y += 2;
    const y0 = motor.y;
    motor.paragrafo(dados.observacoes, estiloObs, COR_CINZA, {
      alinhamento: 'justify', entrelinha: 1.5, x: 28, largura: motor.medidas.larguraConteudo - 8,
    });
    // régua de acento vertical à esquerda do bloco
    motor.linha(22, y0 - 1, 22, Math.min(motor.y, y0 + altura + 1), p.acento, 0.45);
    motor.y += 6;
    numeroSecao++;
  }

  const pag = dados.pagamento;
  const campos: Array<[string, string]> = [
    pag?.banco ? ['Banco', pag.banco] : null,
    pag?.conta ? ['Conta', pag.conta] : null,
    pag?.nib ? ['NIB', pag.nib] : null,
    pag?.mpesa ? ['M-Pesa', pag.mpesa] : null,
    pag?.emola ? ['e-Mola', pag.emola] : null,
    pag?.mkesh ? ['mKesh', pag.mkesh] : null,
  ].filter(Boolean) as Array<[string, string]>;

  if (campos.length > 0) {
    motor.garantirEspaco(campos.length * 7.5 + 12);
    cabecalhoSecao(motor, numeroSecao, 'Dados para Pagamento', p);
    let py = motor.y;
    for (const [rotulo, valor] of campos) {
      motor.linha(motor.medidas.margens.esq, py - 1.4, motor.medidas.larguraPagina - motor.medidas.margens.dir, py - 1.4, COR_HAIRLINE, 0.2);
      motor.textoAbs(rotulo.toUpperCase(), motor.medidas.margens.esq, py + 3.6, { fonte: 'times', peso: 'normal', tamanho: 8.5 }, p.acento, { espacamentoLetras: 1.6 });
      motor.textoAbs(valor, motor.medidas.larguraPagina - motor.medidas.margens.dir, py + 3.8, { fonte: 'times', peso: 'bold', tamanho: 10.5 }, COR_TEXTO, { alinhamento: 'right' });
      py += 7.2;
    }
    motor.linha(motor.medidas.margens.esq, py - 1.4, motor.medidas.larguraPagina - motor.medidas.margens.dir, py - 1.4, COR_HAIRLINE, 0.2);
    motor.y = py + 4;
    numeroSecao++;
  }

  desenharAssinaturas(motor, dados, p);
}

function cabecalhoSecao(motor: MotorPdf, numero: number, titulo: string, p: Paleta): void {
  motor.garantirEspaco(18);
  const y = motor.y;
  const numeroFormatado = String(numero).padStart(2, '0');
  motor.textoAbs(numeroFormatado, 22, y + 4.5, { fonte: 'times', peso: 'italic', tamanho: 17 }, p.acentoSuave);
  motor.textoAbs(titulo, 33, y + 4.8, { fonte: 'times', peso: 'bold', tamanho: 13.5 }, COR_TEXTO, { espacamentoLetras: 0.3 });
  motor.linha(22, y + 8.5, motor.medidas.larguraPagina - 22, y + 8.5, COR_HAIRLINE, 0.25);
  motor.y = y + 13.5;
}

function tabelaItens(motor: MotorPdf, itens: ItemPdf[], p: Paleta): void {
  motor.y += 2;
  if (itens.length === 0) {
    motor.paragrafo('(Sem itens registados nesta proposta.)', { fonte: 'times', peso: 'italic', tamanho: 10 }, COR_CINZA);
    motor.y += 3;
    return;
  }
  motor.tabela(
    [
      { cabecalho: 'Descrição', fracao: 0.48, alinhamento: 'left' },
      { cabecalho: 'Qtd', fracao: 0.10, alinhamento: 'center' },
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
      fundoCabecalho: [250, 248, 244],
      corCabecalho: p.acento,
      corTexto: COR_TEXTO,
      corZebra: undefined,
      corBorda: COR_HAIRLINE,
      tamanho: 9.5,
      tamanhoCabecalho: 8.5,
      fonte: 'times',
    },
  );
  // régua dupla sob o cabeçalho
  // (desenhada pela própria tabela via corCabecalho; hairlines cobrem o corpo)
}

function blocoTotais(motor: MotorPdf, dados: DadosPropostaPdf, p: Paleta): void {
  const linhas: Array<[string, string]> = [['Subtotal', formatarMZN(dados.totais.subtotal)]];
  if (dados.totais.desconto > 0) {
    linhas.push([`Desconto${dados.totais.descontoLabel ? ` (${dados.totais.descontoLabel})` : ''}`, `- ${formatarMZN(dados.totais.desconto)}`]);
  }
  if (dados.totais.iva > 0 || dados.totais.ivaPercentual > 0) {
    linhas.push([`IVA (${formatarQuantidade(dados.totais.ivaPercentual)}%)`, formatarMZN(dados.totais.iva)]);
  }

  motor.garantirEspaco(linhas.length * 6 + 22);
  const x = 92, largura = 96;
  motor.y += 4;
  let py = motor.y;
  for (const [rotulo, valor] of linhas) {
    motor.linha(x, py - 1.2, x + largura, py - 1.2, COR_HAIRLINE, 0.2);
    motor.textoAbs(rotulo, x, py + 3.4, { fonte: 'times', peso: 'normal', tamanho: 10 }, COR_CINZA);
    motor.textoAbs(valor, x + largura, py + 3.4, { fonte: 'times', peso: 'normal', tamanho: 10 }, COR_TEXTO, { alinhamento: 'right' });
    py += 6;
  }

  // régua dupla + total
  motor.linha(x, py - 1.2, x + largura, py - 1.2, p.acento, 0.7);
  motor.linha(x, py - 0.2, x + largura, py - 0.2, p.acento, 0.25);
  motor.textoAbs('TOTAL', x, py + 5, { fonte: 'times', peso: 'bold', tamanho: 11.5 }, COR_TEXTO, { espacamentoLetras: 1.2 });
  motor.textoAbs(formatarMZN(dados.totais.total), x + largura, py + 5.2, { fonte: 'times', peso: 'bold', tamanho: 14 }, p.acento, { alinhamento: 'right' });
  motor.y = py + 13;
}

function desenharAssinaturas(motor: MotorPdf, dados: DadosPropostaPdf, _p: Paleta): void {
  motor.garantirEspaco(40);
  motor.y += 10;
  const y = motor.y;
  const cx = motor.medidas.larguraPagina / 2;

  motor.textoAbs('Em assinatura,', cx, y, { fonte: 'times', peso: 'italic', tamanho: 10 }, COR_CINZA, { alinhamento: 'center' });

  // emitente
  motor.linha(cx - 36, y + 15, cx + 36, y + 15, COR_TEXTO, 0.3);
  motor.textoAbs(dados.empresa.nome, cx, y + 20.5, { fonte: 'times', peso: 'bold', tamanho: 10 }, COR_TEXTO, { alinhamento: 'center' });
  motor.textoAbs('Pelo emitente', cx, y + 25.5, { fonte: 'times', peso: 'italic', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center' });

  // cliente
  motor.linha(cx - 36, y + 32, cx + 36, y + 32, COR_TEXTO, 0.3);
  motor.textoAbs(dados.cliente.nome || dados.cliente.empresa || 'O Cliente', cx, y + 37.5, { fonte: 'times', peso: 'bold', tamanho: 10 }, COR_TEXTO, { alinhamento: 'center' });
  motor.textoAbs('Pelo cliente — aceite da proposta', cx, y + 42.5, { fonte: 'times', peso: 'italic', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center' });
  motor.y = y + 48;
}

// ============================================================
// RODAPÉ
// ============================================================

function rodape(motor: MotorPdf, dados: DadosPropostaPdf, i: number, total: number): void {
  const cx = motor.medidas.larguraPagina / 2;
  if (i === 1) return; // capa não tem rodapé paginado
  motor.textoAbs(`—  ${i}  —`, cx, 285, { fonte: 'times', peso: 'normal', tamanho: 8.5 }, COR_CINZA, { alinhamento: 'center' });
  motor.textoAbs(dados.empresa.nome.toUpperCase(), cx, 290, { fonte: 'times', peso: 'bold', tamanho: 7 }, COR_TEXTO, { alinhamento: 'center', espacamentoLetras: 1.8 });
}
