// ============================================================
// Testes — Template "Cotação Corporativa (Tala Service)"
//
// Valida:
//   1. valor por extenso (pt, meticais) — casos canónicos;
//   2. mapeamento do bloco de pagamento (precedência §18:
//      estruturado → custom field → vazio/oculto);
//   3. render real: 1 página com os dados da REFERÊNCIA
//      (fixture de teste — nenhum valor comercial no template),
//      sem logótipo (sem marca d'água) e com logótipo (com
//      marca d'água via GState);
//   4. ocultação elegante: sem pagamento → bloco desaparece.
//
// PREVIEW_PDF=1 npx vitest run src/lib/__tests__/templateTalaService.test.ts
//   → escreve os PDFs de amostra em /home/z/my-project/preview-pdf
// ============================================================

import { describe, test, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gerarPropostaPdf } from '../pdf/gerar';
import { valorPorExtensoMZN, numeroParaExtenso, formatarMZNCompacto } from '../pdf/utils';
import { mapearPagamentoTala } from '../pdf/templateTalaService';
import type { DadosPropostaPdf } from '../pdf/tipos';

// ---- dados da REFERÊNCIA (fixture de teste; o template em si
//      não contém NENHUM valor comercial da Tala Service) ----
const REFERENCIA: DadosPropostaPdf = {
  titulo: 'Cotação',
  numero: '243-B',
  data: '2026-09-30',
  cliente: {
    nome: 'Gabinete da esposa do Governador de Maputo',
    nuit: '',
    telefone: '+258 84 034 7170',
    endereco: 'Cidade de Maputo',
  },
  empresa: {
    nome: 'Tala Service, Lda.',
    nuit: '402053951',
    endereco: 'Bairro George Dimitrov, Q1 C48',
    telefone: '+258 87 038 3066',
  },
  itens: [
    {
      nome: 'Cannon D850+, + Lente 55/200mm, + Carregador original, + Bateria extra',
      quantidade: 1,
      precoUnitario: 85000,
      subtotal: 85000,
    },
  ],
  mostrarFinanceiro: true,
  totais: {
    subtotal: 85000,
    desconto: 0,
    iva: 13600,
    ivaPercentual: 16,
    total: 98600,
  },
  seccoes: [],
  emitente: { nome: 'Emmanuel Tala', email: 'emmanueltala7@gmail.com' },
  camposPersonalizados: {
    cidade: 'Maputo',
    pais: 'Moçambique',
    whatsapp: '82/84 038 3065',
    payment_method_display: 'VISA',
    payment_instructions:
      'Esta factura deve ser paga por completo no período máximo de 72 horas após a conclusão do trabalho/recepção do material.',
    bank_name: 'BCI',
    nib: '0003 0000 12345678901231',
    payment_contact_name: 'Emmanuel Tala',
  },
  pagamento: {
    banco: 'BCI',
    nib: '0003 0000 12345678901231',
  },
};

// logótipo de TESTE: wordmark turquesa gerado por script (fixture) —
// substituto visual do logótipo da referência; em produção o logótipo
// vem SEMPRE da organização (organizations.logo_url → data URL)
const LOGO_TESTE =
  'data:image/png;base64,'
  + readFileSync(resolve(process.cwd(), 'src/lib/__tests__/fixtures/logo-tala-teste.png')).toString('base64');

describe('valorPorExtensoMZN (pt, Metical)', () => {
  test('casos canónicos da referência', () => {
    expect(valorPorExtensoMZN(98600)).toBe('noventa e oito mil e seiscentos meticais');
    expect(valorPorExtensoMZN(85000)).toBe('oitenta e cinco mil meticais');
    expect(valorPorExtensoMZN(13600)).toBe('treze mil e seiscentos meticais');
  });

  test('unidades, centenas e ligações com "e"', () => {
    expect(valorPorExtensoMZN(0)).toBe('zero meticais');
    expect(valorPorExtensoMZN(1)).toBe('um metical');
    expect(valorPorExtensoMZN(100)).toBe('cem meticais');
    expect(valorPorExtensoMZN(101)).toBe('cento e um meticais');
    expect(valorPorExtensoMZN(21)).toBe('vinte e um meticais');
    expect(numeroParaExtenso(123)).toBe('cento e vinte e três');
    expect(numeroParaExtenso(2200)).toBe('dois mil e duzentos');
    expect(numeroParaExtenso(2250)).toBe('dois mil duzentos e cinquenta');
  });

  test('milhões (com "de") e centavos', () => {
    expect(valorPorExtensoMZN(1_000_000)).toBe('um milhão de meticais');
    expect(valorPorExtensoMZN(2_000_000)).toBe('dois milhões de meticais');
    expect(valorPorExtensoMZN(98600.5)).toBe('noventa e oito mil e seiscentos meticais e cinquenta centavos');
    expect(valorPorExtensoMZN(0.01)).toBe('um centavo');
  });

  test('fora do domínio devolve numérico (nunca inventa texto)', () => {
    expect(valorPorExtensoMZN(2_000_000_000)).toBe('2 000 000 000');
  });
});

describe('formatarMZNCompacto (estilo da referência)', () => {
  test('espaço de milhares, sem decimais quando inteiro', () => {
    expect(formatarMZNCompacto(85000)).toBe('85 000');
    expect(formatarMZNCompacto(98600)).toBe('98 600');
    expect(formatarMZNCompacto(98600.5)).toBe('98 600,50');
    expect(formatarMZNCompacto(0)).toBe('0');
  });
});

describe('mapearPagamentoTala (precedência §18)', () => {
  test('estruturado (pagamento) tem precedência sobre custom field', () => {
    const m = mapearPagamentoTala(REFERENCIA);
    expect(m.banco).toBe('BCI');
    expect(m.nib).toBe('0003 0000 12345678901231');
    expect(m.contacto).toBe('Emmanuel Tala');
    expect(m.instrucoes).toContain('72 horas');
    expect(m.metodoDisplay).toBe('VISA');
  });

  test('sem estruturado → cai no custom field', () => {
    const m = mapearPagamentoTala({
      ...REFERENCIA,
      pagamento: undefined,
      camposPersonalizados: { bank_name: 'Millennium BIM', nib: '0001 2345 6789' },
    });
    expect(m.banco).toBe('Millennium BIM');
    expect(m.nib).toBe('0001 2345 6789');
  });

  test('sem dados de pagamento → bloco invisível', () => {
    const m = mapearPagamentoTala({
      ...REFERENCIA,
      pagamento: undefined,
      camposPersonalizados: { cidade: 'Maputo' }, // campo não-pagamento
    });
    const visivel = !!(m.metodoDisplay || m.instrucoes || m.banco || m.nib || m.conta || m.referencia || m.linhasAdicionais.length || m.contacto);
    expect(visivel).toBe(false);
  });

  test('mobile money e extras estruturados entram nas linhas adicionais', () => {
    const m = mapearPagamentoTala({
      ...REFERENCIA,
      pagamento: { mpesa: '84 000 0000', extras: [{ rotulo: 'POS', valor: 'na loja' }] },
    });
    expect(m.linhasAdicionais).toContain('M-Pesa 84 000 0000');
    expect(m.linhasAdicionais).toContain('POS na loja');
  });
});

describe('render do template talaService', () => {
  test('1 página com os dados da referência (com marca d\u2019água)', () => {
    const doc = gerarPropostaPdf({ ...REFERENCIA, empresa: { ...REFERENCIA.empresa, logotipo: LOGO_TESTE } }, 'talaService');
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    // marca d'água: ExtGState com opacidade baixa + imagem embutida
    expect(raw).toMatch(/\/ca 0\.0\d+/);
    expect(raw).toContain('/Subtype /Image');
    // cabeçalho, extenso, totais e rodapé presentes no content stream
    expect(raw).toContain('Cota');
    expect(raw).toContain('noventa e oito mil e seiscentos meticais');
    expect(raw).toContain('1 de 1');
    if (process.env.PREVIEW_PDF) {
      const dir = '/home/z/my-project/preview-pdf';
      try { mkdirSync(dir, { recursive: true }); } catch { /* existe */ }
      writeFileSync(`${dir}/tala-1-referencia.pdf`, Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('sem logótipo → sem marca d\u2019água, layout degrada com elegância', () => {
    const doc = gerarPropostaPdf(REFERENCIA, 'talaService');
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).not.toContain('/Subtype /Image');
    // fallback textual: nome da empresa no lugar do logótipo
    expect(raw).toContain('Tala Service');
    if (process.env.PREVIEW_PDF) {
      writeFileSync('/home/z/my-project/preview-pdf/tala-2-sem-logo.pdf', Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('sem pagamento e sem custom fields → bloco de pagamento desaparece', () => {
    const doc = gerarPropostaPdf(
      { ...REFERENCIA, pagamento: undefined, camposPersonalizados: undefined },
      'talaService',
    );
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).not.toContain('Estimado Cliente');
    expect(raw).not.toContain('todos de pagamento dispon');
    if (process.env.PREVIEW_PDF) {
      writeFileSync('/home/z/my-project/preview-pdf/tala-3-sem-pagamento.pdf', Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('muitos itens → pagina com continuação (rodapé em todas as páginas)', () => {
    const itens = Array.from({ length: 28 }, (_, i) => ({
      nome: `Serviço técnico n. ${i + 1} com descrição suficientemente longa para ocupar linha`,
      quantidade: 1,
      precoUnitario: 1500,
      subtotal: 1500,
    }));
    const doc = gerarPropostaPdf(
      { ...REFERENCIA, itens, empresa: { ...REFERENCIA.empresa, logotipo: LOGO_TESTE } },
      'talaService',
    );
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    // marca d'água em TODAS as páginas: cada chamada de marcaAgua faz
    // 2 operações /GSn gs (aplicar + repor opacidade) → ≥4 nas 2 páginas
    const operacoesGs = (raw.match(/\/GS\d+ gs/g) ?? []).length;
    expect(operacoesGs).toBeGreaterThanOrEqual(4);
    if (process.env.PREVIEW_PDF) {
      writeFileSync('/home/z/my-project/preview-pdf/tala-4-multi-pagina.pdf', Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });
});
