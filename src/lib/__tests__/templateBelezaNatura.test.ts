// ============================================================
// Testes — Template "Beleza Natura (Elegância Premium)"
//
// Valida:
//   1. contratos de dados puros: condicoesDaProposta (validade,
//      IVA, desconto, observações — nunca texto fictício) e
//      metodosMobileMoney (só quando existem);
//   2. render real: 1 página com fixture de teste (réplica do
//      layout rosa/dourado), com e sem logótipo;
//   3. ocultação elegante: sem pagamento → sem botões M-Pesa;
//      sem condições → sem cartão de condições;
//   4. paginação: muitos itens → páginas de continuação com
//      banda de rodapé em todas.
//
// PREVIEW_PDF=1 npx vitest run src/lib/__tests__/templateBelezaNatura.test.ts
//   → escreve os PDFs de amostra em /home/z/my-project/preview-pdf
// ============================================================

import { describe, test, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gerarPropostaPdf } from '../pdf/gerar';
import { condicoesDaProposta, metodosMobileMoney } from '../pdf/templateBelezaNatura';
import type { DadosPropostaPdf } from '../pdf/tipos';

// ---- dados da REFERÊNCIA (fixture de teste; o template em si
//      não contém NENHUM valor comercial) ----
const REFERENCIA: DadosPropostaPdf = {
  titulo: 'Proposta Comercial',
  numero: '1024-A',
  data: '2026-10-02',
  validadeDias: 5,
  cliente: {
    nome: 'Ana Maria Cumbe',
    telefone: '+258 84 123 4567',
    endereco: 'Beira • Moçambique',
  },
  empresa: {
    nome: 'Beila Cosméticos',
    nuit: '401234567',
    endereco: 'Rua da Beira, 123 — Beira',
    email: 'vendas@beilacosmeticos.co.mz',
    telefone: '+258 84 123 4567',
  },
  itens: [
    { nome: 'Creme Clareador — Clareamento e hidratação facial, 50g', quantidade: 1, precoUnitario: 1200, subtotal: 1200 },
    { nome: 'Óleo de Rosa Mosqueta — Regenerador natural, 30ml', quantidade: 1, precoUnitario: 950, subtotal: 950 },
    { nome: 'Kit Skincare Completo — limpeza, tónico, sérum e hidratante', quantidade: 1, precoUnitario: 3500, subtotal: 3500 },
    { nome: 'Sabonete Íntimo Natural — Fórmula suave, 100ml', quantidade: 1, precoUnitario: 450, subtotal: 450 },
  ],
  mostrarFinanceiro: true,
  totais: {
    subtotal: 6100,
    desconto: 610,
    descontoLabel: '10%',
    iva: 0,
    ivaPercentual: 0,
    total: 5490,
  },
  seccoes: [],
  observacoes: 'Entrega em 3 a 5 dias úteis após confirmação do pagamento.',
  camposPersonalizados: {
    slogan: 'Beleza natural • Cuidados que realçam sua pele',
    cidade: 'Beira',
    pais: 'Moçambique',
  },
  pagamento: {
    mpesa: '84 000 0000',
    emola: '86 000 0000',
  },
};

// logótipo de TESTE (fixture partilhada do talaService —
// substituto visual; em produção vem sempre da organização)
const LOGO_TESTE =
  'data:image/png;base64,'
  + readFileSync(resolve(process.cwd(), 'src/lib/__tests__/fixtures/logo-tala-teste.png')).toString('base64');

describe('condicoesDaProposta (dados reais, nunca fictícios)', () => {
  test('validade + desconto + observações → 3 condições', () => {
    const c = condicoesDaProposta(REFERENCIA);
    expect(c.length).toBe(3);
    expect(c[0]).toContain('válida por 5 dias');
    expect(c[1]).toContain('Desconto de 10%');
    expect(c[2]).toContain('3 a 5 dias úteis');
  });

  test('IVA > 0 acrescenta a condição de preços com IVA', () => {
    const c = condicoesDaProposta({
      ...REFERENCIA,
      totais: { ...REFERENCIA.totais, iva: 878, ivaPercentual: 16, total: 6368 },
    });
    expect(c.some(x => x.includes('Preços incluem IVA (16%)'))).toBe(true);
  });

  test('sem validade/IVA/desconto/observações → lista vazia (cartão desaparece)', () => {
    const c = condicoesDaProposta({
      ...REFERENCIA,
      validadeDias: undefined,
      observacoes: undefined,
      totais: { subtotal: 100, desconto: 0, iva: 0, ivaPercentual: 0, total: 100 },
    });
    expect(c).toEqual([]);
  });
});

describe('metodosMobileMoney (botões só quando existem)', () => {
  test('M-Pesa + e-Mola → dois botões', () => {
    const m = metodosMobileMoney(REFERENCIA);
    expect(m.map(x => x.rotulo)).toEqual(['M-PESA', 'E-MOLA']);
    expect(m[0].numero).toBe('84 000 0000');
    expect(m[1].numero).toBe('86 000 0000');
  });

  test('sem pagamento → nenhum botão', () => {
    expect(metodosMobileMoney({ ...REFERENCIA, pagamento: undefined })).toEqual([]);
  });
});

describe('render do template belezaNatura', () => {
  test('1 página com os dados da referência', () => {
    const doc = gerarPropostaPdf({ ...REFERENCIA, empresa: { ...REFERENCIA.empresa, logotipo: LOGO_TESTE } }, 'belezaNatura');
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    // identidade do layout: hero, secções, totais, botões e rodapé
    expect(raw).toContain('PROPOSTA COMERCIAL');
    expect(raw).toContain('Beleza natural');
    expect(raw).toContain('DETALHES DO CLIENTE');
    expect(raw).toContain('LISTA DE PRODUTOS');
    expect(raw).toContain('DESCRI');
    expect(raw).toContain('RESUMO FINANCEIRO');
    expect(raw).toContain('TOTAL A PAGAR');
    // pt-PT usa grouping "min2": 5490 (4 dígitos) fica sem separador
    expect(raw).toContain('5490 MZN');
    expect(raw).toContain('M-PESA 84 000 0000');
    expect(raw).toContain('E-MOLA 86 000 0000');
    expect(raw).toContain('Obrigado pela sua confian');
    expect(raw).toContain('1 de 1');
    if (process.env.PREVIEW_PDF) {
      const dir = '/home/z/my-project/preview-pdf';
      try { mkdirSync(dir, { recursive: true }); } catch { /* existe */ }
      writeFileSync(`${dir}/beleza-1-referencia.pdf`, Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('sem logótipo → fallback textual do nome da empresa', () => {
    const doc = gerarPropostaPdf(REFERENCIA, 'belezaNatura');
    expect(doc.getNumberOfPages()).toBe(1);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).toContain('Beila Cosm');
    expect(raw).toContain('NUIT 401234567');
    if (process.env.PREVIEW_PDF) {
      writeFileSync('/home/z/my-project/preview-pdf/beleza-2-sem-logo.pdf', Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('sem pagamento → sem botões M-Pesa/e-Mola nem nota de comprovativo', () => {
    const doc = gerarPropostaPdf({ ...REFERENCIA, pagamento: undefined }, 'belezaNatura');
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).not.toContain('M-PESA');
    expect(raw).not.toContain('E-MOLA');
    expect(raw).not.toContain('comprovativo');
  });

  test('sem condições → cartão de condições desaparece', () => {
    const doc = gerarPropostaPdf(
      {
        ...REFERENCIA,
        validadeDias: undefined,
        observacoes: undefined,
        totais: { ...REFERENCIA.totais, desconto: 0, descontoLabel: undefined, total: 6100 },
      },
      'belezaNatura',
    );
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).not.toContain('CONDI');
    // o resumo financeiro permanece
    expect(raw).toContain('RESUMO FINANCEIRO');
  });

  test('muitos itens → pagina com continuação e rodapé em todas', () => {
    const itens = Array.from({ length: 30 }, (_, i) => ({
      nome: `Produto de cuidado intensivo número ${i + 1} com descrição longa para ocupar linhas`,
      quantidade: 1,
      precoUnitario: 750,
      subtotal: 750,
    }));
    const doc = gerarPropostaPdf({ ...REFERENCIA, itens }, 'belezaNatura');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).toContain('2 de ');
    // banda de agradecimento em todas as páginas
    const agradecimentos = (raw.match(/Obrigado pela sua confian/g) ?? []).length;
    expect(agradecimentos).toBe(doc.getNumberOfPages());
    if (process.env.PREVIEW_PDF) {
      writeFileSync('/home/z/my-project/preview-pdf/beleza-4-multi-pagina.pdf', Buffer.from(doc.output('arraybuffer') as ArrayBuffer));
    }
  });

  test('Doc A narrativo (sem financeiro) → secções sem tabela de produtos', () => {
    const doc = gerarPropostaPdf(
      {
        ...REFERENCIA,
        mostrarFinanceiro: false,
        seccoes: [
          { titulo: 'Contexto', conteudo: 'A cliente procura uma rotina de cuidados personalizada.' },
        ],
      },
      'belezaNatura',
    );
    const raw = Buffer.from(doc.output('arraybuffer') as ArrayBuffer).toString('latin1');
    expect(raw).toContain('Contexto');
    expect(raw).not.toContain('LISTA DE PRODUTOS');
    expect(raw).not.toContain('RESUMO FINANCEIRO');
  });
});
